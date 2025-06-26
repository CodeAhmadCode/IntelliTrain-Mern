import React, {
  useState,
  useRef,
  useEffect,
  MutableRefObject,
  ChangeEvent,
} from 'react';
import { motion } from 'framer-motion';
import * as tf from '@tensorflow/tfjs';
import * as posedetection from '@tensorflow-models/pose-detection';
import { PoseDetector, SupportedModels } from '@tensorflow-models/pose-detection';
import {
  Card,
  CardHeader,
  CardContent,
  Button,
  IconButton,
  Typography,
  TextField,
  Menu,
  MenuItem,
  Modal,
  Collapse,
  Tooltip,
  Switch,
  LinearProgress,
  CircularProgress,
  Dialog,
  
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Edit as EditIcon,
  MoreVert as MoreVertIcon,
  CameraAlt as CameraAltIcon,
  Upload as UploadIcon,
  ArrowForward as ArrowForwardIcon,
  Delete as DeleteIcon,
  Close as CloseIcon,
  HelpOutline as HelpOutlineIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  ArrowDropDown as ArrowDropDownIcon
} from '@mui/icons-material';

// Enable mixed precision training
tf.enableProdMode();

const KEYPOINT_CONNECTIONS: Array<[number, number]> = [
  // Face and head connections
  [0, 1], [0, 2],  // Nose to eyes
  [1, 3], [2, 4],  // Eyes to ears
  [1, 2],           // Bridge between eyes
  [3, 5], [4, 6],  // Ears to shoulders
  [0, 5], [0, 6],  // Nose to shoulders
  
  // Upper body (arms)
  [5, 7], [7, 9],   // Left arm
  [6, 8], [8, 10],  // Right arm

  
  
  // Lower body (legs)
  [11, 13], [13, 15], // Left leg
  [12, 14], [14, 16], // Right leg
  
  // Torso and core connections
  [5, 6],           // Shoulders
  [11, 12],         // Hips
  [5, 11], [6, 12] // Body sides
];

export const drawKeypoints = (
  ctx: CanvasRenderingContext2D,
  poses: posedetection.Pose[],
  imageWidth: number,
  imageHeight: number
) => {
  ctx.strokeStyle = '#E1F4CB';
  ctx.fillStyle = '#3943B7';
  ctx.lineWidth = 3;

  const cw = ctx.canvas.width;
  const ch = ctx.canvas.height;
  const scaleX = cw / imageWidth;
  const scaleY = ch / imageHeight;

  poses.forEach((pose) => {
    if (pose.keypoints.some(kp => !kp)) {
      console.warn('Pose with undefined keypoints:', pose);
    }
    for (let i = 0; i < pose.keypoints.length; i++) {
      const kp = pose.keypoints[i];
      if (kp && kp.score != null && kp.score > 0.5) {
        const x = kp.x * scaleX;
        const y = kp.y * scaleY;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, 2 * Math.PI);
        ctx.fill();
      }
    }
    for (let j = 0; j < KEYPOINT_CONNECTIONS.length; j++) {
      const [aIdx, bIdx] = KEYPOINT_CONNECTIONS[j];
      const a = pose.keypoints[aIdx];
      const b = pose.keypoints[bIdx];
      if (a && b && a.score != null && b.score != null && a.score > 0.5 && b.score > 0.5) {
        const x1 = a.x * scaleX;
        const y1 = a.y * scaleY;
        const x2 = b.x * scaleX;
        const y2 = b.y * scaleY;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
    }
  });
};

declare global {
  interface Window {
    dataLayer: DataLayerEvent[];
  }
}

interface WebcamModalProps {
  classId: number;
  addImageToClass: (classId: number, image: string) => void;
  onClose: () => void;
  poseDetector: PoseDetector | null;
}

export type DataLayerEvent = { event: string; classId?: number; [k: string]: unknown; };

const WebcamModal: React.FC<WebcamModalProps> = ({
  classId,
  addImageToClass,
  onClose,
  poseDetector,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number>(0);
  const captureIntervalRef = useRef<number | null>(null);

  const [videoReady, setVideoReady] = useState(false);
  const [capturedImages, setCapturedImages] = useState<string[]>([]);

  useEffect(() => {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: 'webcam_opened', classId });

    navigator.mediaDevices
      .getUserMedia({ video: true })
      .then((stream) => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      })
      .catch((err) => console.error('webcam error:', err));

    return () => {
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
      }
      cancelAnimationFrame(animationFrameRef.current);
      if (captureIntervalRef.current !== null) {
        clearInterval(captureIntervalRef.current);
        captureIntervalRef.current = null;
      }
    };
  }, [classId]);

  const handleVideoMetadata = () => {
    if (!videoRef.current) return;
    const vw = videoRef.current.videoWidth;
    const vh = videoRef.current.videoHeight;
    if (overlayCanvasRef.current) {
      overlayCanvasRef.current.width = vw;
      overlayCanvasRef.current.height = vh;
    }
    if (captureCanvasRef.current) {
      captureCanvasRef.current.width = vw;
      captureCanvasRef.current.height = vh;
    }
    setVideoReady(true);
  };

  useEffect(() => {
    if (!poseDetector || !videoReady) return;

    let isCanceled = false;

    const detectLoop = async () => {
      if (isCanceled) return;

      const video = videoRef.current;
      const overlayCanvas = overlayCanvasRef.current;
      if (!video || video.videoWidth === 0 || video.videoHeight === 0 || !overlayCanvas) {
        animationFrameRef.current = requestAnimationFrame(detectLoop);
        return;
      }

      let poses: posedetection.Pose[] = [];
      tf.engine().startScope();
      try {
        poses = await poseDetector.estimatePoses(video, {
          maxPoses: 1,
          flipHorizontal: false,
        });
      } finally {
        tf.engine().endScope();
      }

      const ctx = overlayCanvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
        drawKeypoints(ctx, poses, video.videoWidth, video.videoHeight);
      }

      await new Promise((r) => setTimeout(r, 50));
      animationFrameRef.current = requestAnimationFrame(detectLoop);
    };

    detectLoop();
    return () => {
      isCanceled = true;
      cancelAnimationFrame(animationFrameRef.current);
    };
  }, [poseDetector, videoReady]);

  const captureImage = async () => {
    if (!videoReady) return;
    const video = videoRef.current!;
    const capCanvas = captureCanvasRef.current!;
    const overlayCanvas = overlayCanvasRef.current!;
    const capCtx = capCanvas.getContext('2d')!;
    const overlayCtx = overlayCanvas.getContext('2d')!;

    capCtx.drawImage(video, 0, 0, capCanvas.width, capCanvas.height);

    if (poseDetector) {
      let poses: posedetection.Pose[] = [];
      tf.engine().startScope();
      try {
        poses = await poseDetector.estimatePoses(video, {
          maxPoses: 1,
          flipHorizontal: false,
        });
      } finally {
        tf.engine().endScope();
      }

      overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
      drawKeypoints(overlayCtx, poses, video.videoWidth, video.videoHeight);
      capCtx.drawImage(overlayCanvas, 0, 0);
    }

    const dataUrl = capCanvas.toDataURL('image/jpeg');
    setCapturedImages((prev) => [...prev, dataUrl]);
    addImageToClass(classId, dataUrl);
    window.dataLayer.push({ event: 'image_captured', classId });
  };

  const startRecording = () => {
    if (captureIntervalRef.current === null) {
      captureIntervalRef.current = window.setInterval(() => {
        captureImage();
      }, 1000);
      window.dataLayer.push({ event: 'record_started', classId });
    }
  };

  const stopRecording = () => {
    if (captureIntervalRef.current !== null) {
      clearInterval(captureIntervalRef.current);
      captureIntervalRef.current = null;
      window.dataLayer.push({ event: 'record_stopped', classId });
    }
  };

  return (
    <Modal open onClose={onClose} disableScrollLock>
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center"
      >
        <motion.div
          onClick={(e) => e.stopPropagation()}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="relative bg-space-gray backdrop-blur-md p-6 rounded-2xl w-[95%] max-w-4xl flex flex-col md:flex-row gap-6"
        >
          <IconButton
            size="small"
            onClick={onClose}
            className="absolute top-4 right-4 text-space-white hover:text-glow bg-space-purple hover:bg-space-purple/90"
          >
            <CloseIcon />
          </IconButton>
          <div className="flex-1 relative">
            <Typography
              variant="h6"
              className="bg-space-black text-space-white text-glow p-2 mb-4 rounded"
            >
              Webcam
            </Typography>
            <div className="relative">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                onLoadedMetadata={handleVideoMetadata}
                className="w-full rounded-lg"
              />
              <canvas
                ref={overlayCanvasRef}
                className="absolute top-0 left-0 w-full h-full"
                style={{ zIndex: 10 }}
              />
            </div>
            <canvas ref={captureCanvasRef} className="hidden" />
            <Button
              variant="contained"
              className="mt-8 w-full uppercase tracking-wider transition-all duration-300 bg-space-purple hover:bg-space-purple/90 text-space-white button-glow"
              onMouseDown={startRecording}
              onMouseUp={stopRecording}
              onMouseLeave={stopRecording}
              onTouchStart={startRecording}
              onTouchEnd={stopRecording}
              onClick={captureImage}
            >
              Hold to Record
            </Button>
          </div>
          <div className="flex-1 max-h-[400px] overflow-y-auto">
            <Typography
              variant="h6"
              className="bg-space-black text-space-white text-glow p-2 mb-4 rounded"
            >
              Captured Images
            </Typography>
            <div className="flex flex-wrap gap-2">
              {capturedImages.map((src, i) => (
                <img
                  key={i}
                  src={src}
                  alt={`Capture ${i + 1}`}
                  className="w-20 h-15 object-cover rounded"
                />
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </Modal>
  );
};

interface ClassItem {
  id: number;
  name: string;
  images: string[];
}

interface ClassCardProps {
  classItem: ClassItem;
  setClasses: React.Dispatch<React.SetStateAction<ClassItem[]>>;
  addImageToClass: (classId: number, image: string) => void;
  removeImageFromClass: (classId: number, index: number) => void;
  poseDetector: PoseDetector | null;
}

const ClassCard: React.FC<ClassCardProps> = ({
  classItem,
  setClasses,
  addImageToClass,
  removeImageFromClass,
  poseDetector,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempName, setTempName] = useState(classItem.name);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [isWebcamOpen, setIsWebcamOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);

  useEffect(() => {
    if (!poseDetector) return;
    classItem.images.forEach((src, idx) => {
      const canvas = canvasRefs.current[idx];
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const img = new Image();
      img.src = src;
      img.onload = async () => {
        canvas.width = 80;
        canvas.height = 60;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const poses = await poseDetector.estimatePoses(img, { maxPoses: 1, flipHorizontal: false });
        drawKeypoints(ctx, poses, canvas.width, canvas.height);
      };
    });
  }, [classItem.images, poseDetector]);

  const handleDeleteClick = () => setConfirmOpen(true);
  const confirmDelete = () => {
    setClasses((prev) => prev.filter((c) => c.id !== classItem.id));
    setConfirmOpen(false);
  };

  const handleSave = () => {
    setClasses((prev) =>
      prev.map((c) => (c.id === classItem.id ? { ...c, name: tempName } : c))
    );
    setIsEditing(false);
  };

  const handleUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const imageFiles = Array.from(files).filter((f) => f.type.startsWith('image/'));
    imageFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        addImageToClass(classItem.id, result);
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({ event: 'image_uploaded', classId: classItem.id });
      };
      reader.readAsDataURL(file);
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.04 }}
      transition={{ duration: 0.4 }}
    >
      <Card
        elevation={0}
        sx={{
          background: 'linear-gradient(135deg, #2E8B57 0%, #98FF98 100%)',
          borderRadius: '20px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
        }}
        className="mt-6 mb-6"
      >
        <div className="backdrop-blur-md p-4 rounded-lg" style={{ background: 'rgba(255, 255, 255, 0.05)' }}>
          <CardHeader
            title={
              isEditing ? (
                <TextField
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  onBlur={handleSave}
                  size="small"
                  className="bg-transparent text-white font-semibold"
                  slotProps={{
                      input: {
                        disableUnderline: true,
                        sx: { color: '#f0e6ff' },
                      },
                    }}

                />
              ) : (
                <span className="text-white text-xl font-bold uppercase tracking-wide hover:text-[#ffebf0] transition-colors duration-200">
                  {tempName}
                </span>
              )
            }
            subheader={<Typography variant="body2" sx={{ color: '#d3cce3' }}>{classItem.images.length} Samples</Typography>}
            action={
              <div className="flex gap-2">
                <IconButton sx={{ background: '#5c5470', '&:hover': { background: '#6e60a1' } }} onClick={() => setIsEditing(true)}>
                  <EditIcon sx={{ color: '#fff' }} />
                </IconButton>
                <IconButton sx={{ background: '#5c5470', '&:hover': { background: '#6e60a1' } }} onClick={(e) => setAnchorEl(e.currentTarget)}>
                  <MoreVertIcon sx={{ color: '#fff' }} />
                </IconButton>
                <Menu
                  anchorEl={anchorEl}
                  open={Boolean(anchorEl)}
                  onClose={() => setAnchorEl(null)}
                  PaperProps={{ sx: { background: 'rgba(30, 30, 60, 0.9)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' } }}
                >
                  <MenuItem onClick={handleDeleteClick} sx={{ color: '#ff6b6b', '&:hover': { background: 'rgba(255,107,107,0.2)' } }}>
                    Delete Class
                  </MenuItem>
                </Menu>
              </div>
            }
            sx={{ p: 0, mb: 2 }}
          />
          <CardContent sx={{ p: 0 }}>
            <Typography variant="body2" sx={{ color: '#f8f8f8', mb: 1 }}>Add Image Samples:</Typography>
            <div className="flex flex-wrap gap-3">
              <Tooltip title="Capture Images with your Camera" arrow>
                <span>
                  <Button
                    variant="contained"
                    startIcon={<CameraAltIcon />}
                    onClick={() => setIsWebcamOpen(true)}
                    sx={{ background: 'linear-gradient(45deg, #7b5aff, #8e8ffa)', color: '#fff', borderRadius: '8px', '&:hover': { background: 'linear-gradient(45deg, #6f4eff, #8486f3)' } }}
                  >
                    Webcam
                  </Button>
                </span>
              </Tooltip>
              <Tooltip title="Upload Images from your gallery" arrow>
                <span>
                  <Button
                    variant="contained"
                    startIcon={<UploadIcon />}
                    onClick={() => fileInputRef.current?.click()}
                    sx={{ background: 'linear-gradient(45deg, #7b5aff, #8e8ffa)', color: '#fff', borderRadius: '8px', '&:hover': { background: 'linear-gradient(45deg, #6f4eff, #8486f3)' } }}
                  >
                    Upload
                  </Button>
                </span>
              </Tooltip>
              <input type="file" accept="image/*" multiple ref={fileInputRef} className="hidden" onChange={handleUpload} />
            </div>
            {classItem.images.length > 0 && (
              <div className="mt-6 w-full overflow-x-auto">
                <div className="flex flex-nowrap space-x-3">
                  {classItem.images.map((src, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ scale: 0.9 }}
                      animate={{ scale: 1 }}
                      whileHover={{ scale: 1.05, boxShadow: '0 0 16px rgba(255,255,255,0.2)' }}
                      transition={{ delay: idx * 0.05 }}
                      className="relative w-20 h-15 flex-shrink-0 rounded-lg overflow-hidden"
                    >
                      <canvas ref={(el) => (canvasRefs.current[idx] = el)} className="w-full h-full" />
                      <IconButton
                        size="small"
                        onClick={() => removeImageFromClass(classItem.id, idx)}
                        sx={{ position: 'absolute', top: 4, right: 4, background: '#ff4c4c', '&:hover': { background: '#ff1e1e' } }}
                      >
                        <DeleteIcon fontSize="small" sx={{ color: '#fff' }} />
                      </IconButton>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </div>
        {isWebcamOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50" onClick={() => setIsWebcamOpen(false)}>
            <div onClick={(e) => e.stopPropagation()} className="relative">
              <IconButton
                onClick={() => setIsWebcamOpen(false)}
                sx={{ position: 'absolute', top: -10, right: -10, background: '#5c5470', '&:hover': { background: '#6e60a1' } }}
              >
                <CloseIcon sx={{ color: '#fff' }} />
              </IconButton>
              <WebcamModal classId={classItem.id} addImageToClass={addImageToClass} onClose={() => setIsWebcamOpen(false)} poseDetector={poseDetector} />
            </div>
          </div>
        )}
      </Card>
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>Are you sure you want to delete class "{classItem.name}"?</DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
          <Button onClick={confirmDelete} color="error">Delete</Button>
        </DialogActions>
      </Dialog>
    </motion.div>
  );
};

// Updated Classification Head with Keypoint Integration
function createHeadModel(numClasses: number, learningRate: number, keypointDim: number = 34): tf.LayersModel {
  const l2 = tf.regularizers.l2({ l2: 0.01 });
  const model = tf.sequential();
  
  // Input: Keypoints (34 for MoveNet's 17 keypoints * 2 for x,y)
  model.add(
    tf.layers.dense({
      inputShape: [keypointDim],
      units: 64,
      activation: 'relu',
      kernelRegularizer: l2,
    })
  );
  model.add(tf.layers.batchNormalization());
  model.add(tf.layers.dropout({ rate: 0.4 }));
  model.add(
    tf.layers.dense({
      units: numClasses,
      activation: 'softmax',
      kernelRegularizer: l2,
    })
  );
  
  const optimizer = tf.train.adam(learningRate);
  model.compile({
    optimizer,
    loss: 'categoricalCrossentropy',
    metrics: ['accuracy'],
  });
  return model;
}

interface TrainingCardProps {
  classes: ClassItem[];
  headModelRef: MutableRefObject<tf.LayersModel | null>;
  onTrainingComplete: () => void;
  poseDetector: PoseDetector | null;
}

interface CustomOptimizer extends tf.Optimizer {
  learningRate: tf.Scalar | number;
}

const TrainingCard: React.FC<TrainingCardProps> = ({
  classes,
  headModelRef,
  onTrainingComplete,
  poseDetector,
}) => {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [epochs, setEpochs] = useState(30);
  const [batchSize, setBatchSize] = useState(16);
  const [learningRate, setLearningRate] = useState(0.001);
  const [isTraining, setIsTraining] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentEpoch, setCurrentEpoch] = useState(0);
  const [trainAcc, setTrainAcc] = useState(0);
  const [valAcc, setValAcc] = useState(0);
  const [bestValAcc, setBestValAcc] = useState(0);

  const canTrain = classes.filter((c) => c.images.length > 0).length >= 2;

  const trainModel = async () => {
    if (!poseDetector || classes.length === 0) return;
    setIsTraining(true);
    setProgress(0);

    const numClasses = classes.length;
    headModelRef.current = createHeadModel(numClasses, learningRate);

    const keypointsList: tf.Tensor<tf.Rank>[] = [];
    const labels: number[] = [];

    for (let ci = 0; ci < numClasses; ci++) {
      for (const src of classes[ci].images) {
        const img = new Image();
        img.src = src;
        await new Promise<void>((res) => (img.onload = () => res()));

        const poses = await poseDetector.estimatePoses(img, {
          maxPoses: 1,
          flipHorizontal: false,
        });

        const keypoints = tf.tidy(() => {
          const keypointsData =
            poses[0]?.keypoints.map((kp) => [kp.x / img.width, kp.y / img.height]).flat() ||
            Array(34).fill(0);
          return tf.tensor2d(keypointsData, [1, 34]);
        });

        keypointsList.push(keypoints);
        labels.push(ci);
      }
    }

    const xs = tf.concat(keypointsList, 0);
    const ys = tf.oneHot(tf.tensor1d(labels, 'int32'), numClasses);

    const patience = 5;
    let earlyStopCounter = 0;

    await headModelRef.current.fit(xs, ys, {
      epochs,
      batchSize,
      shuffle: true,
      validationSplit: 0.2,
      callbacks: [
        {
          onEpochEnd: async (epoch: number, logs?: tf.Logs) => {
            if (!logs) return;
            setProgress(((epoch + 1) / epochs) * 100);
            setCurrentEpoch(epoch + 1);
            setTrainAcc(logs.acc ?? 0);
            const newValAcc = (logs.val_acc as number) ?? 0;
            setValAcc(newValAcc);

            if (newValAcc > bestValAcc) {
              setBestValAcc(newValAcc);
              earlyStopCounter = 0;
            } else {
              earlyStopCounter++;
              if (earlyStopCounter >= patience) {
                console.log('Early stopping condition met at epoch', epoch + 1);
              }
            }

            const progress = epoch / (epochs - 1);
            const newLr = learningRate * (1 + Math.cos(Math.PI * progress)) / 2;
            (headModelRef.current!.optimizer as CustomOptimizer).learningRate = newLr;

            await tf.nextFrame();
          },
        },
      ],
    });

    keypointsList.forEach((k) => k.dispose());
    xs.dispose();
    ys.dispose();

    setProgress(100);
    setTimeout(() => setIsTraining(false), 500);
    onTrainingComplete();
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} whileHover={{ scale: 1.02 }} transition={{ duration: 0.4 }}>
      <Card
        elevation={0}
        sx={{ width: 300, borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', background: 'linear-gradient(135deg, #2E8B57, #98FF98)', boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}
        className="mt-4 mb-4 overflow-hidden"
      >
        <div className="backdrop-blur p-2" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <CardHeader title={<span className="text-white text-base font-semibold uppercase">Training</span>} sx={{ p: 1, mb: 1, background: 'rgba(255,255,255,0.12)', borderRadius: '8px 8px 0 0' }} />
          <CardContent sx={{ p: 1 }}>
            <Tooltip
              title={isTraining ? 'Training in progress' : !canTrain ? 'Add at least two classes with images' : ''}
              arrow
              disableHoverListener={Boolean(!isTraining && canTrain)}
            >
              <span>
                <Button
                  variant="contained"
                  fullWidth
                  size="small"
                  disabled={isTraining || !canTrain}
                  onClick={trainModel}
                  sx={{
                    background: 'linear-gradient(45deg, #7b5aff, #8e8ffa)',
                    textTransform: 'none',
                    borderRadius: '6px',
                    py: 0.75,
                    boxShadow: '0 2px 8px rgba(123,90,255,0.3)',
                    '&:hover': { transform: 'translateY(-1px)', boxShadow: '0 4px 12px rgba(123,90,255,0.5)' },
                    '&.Mui-disabled': { background: 'rgba(200,200,200,0.5)', boxShadow: 'none', color: 'rgba(0, 0, 0, 0.26)' },
                  }}
                >
                  {isTraining ? 'Training…' : 'Train'}
                </Button>
              </span>
            </Tooltip>
            {isTraining && (
              <>
                <LinearProgress variant="determinate" value={progress} sx={{ mt: 1, height: 6, borderRadius: 3 }} />
                <Typography variant="caption" className="block text-center text-white mt-1">
                  {currentEpoch}/{epochs} • {(trainAcc * 100).toFixed(0)}% / {(valAcc * 100).toFixed(0)}%
                </Typography>
              </>
            )}
            <Button
              variant="outlined"
              fullWidth
              size="small"
              endIcon={advancedOpen ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
              onClick={() => setAdvancedOpen((o) => !o)}
              sx={{ mt: 1, borderRadius: '6px', textTransform: 'none', borderColor: '#fff', fontSize: '0.75rem', py: 0.75, boxShadow: '0 0 8px rgba(255,255,255,0.1)', '&:hover': { transform: 'translateY(-1px)' } }}
            >
              Advanced
            </Button>
            <Collapse in={advancedOpen}>
              <div className="mt-2 p-2 rounded" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <div className="flex items-center mb-2 space-x-2 text-white text-sm">
                  <Typography className="w-16">Epochs:</Typography>
                  <TextField
                    variant="standard"
                    type="number"
                    value={epochs}
                    onChange={(e) => setEpochs(+e.target.value)}
                    size="small"
                    sx={{ flex: 1, '& .MuiInputBase-input': { py: 0.25, fontSize: '0.75rem' } }}
                    slotProps={{ input:{disableUnderline: true }}}
                  />
                  <Tooltip title="Full passes"><HelpOutlineIcon fontSize="small" className="text-white" /></Tooltip>
                </div>
                <div className="flex items-center mb-2 space-x-2 text-white text-sm">
                  <Typography className="w-16">Batch:</Typography>
                  <TextField
                    variant="standard"
                    select
                    value={batchSize}
                    onChange={(e) => setBatchSize(+e.target.value)}
                    size="small"
                    sx={{ width: 80, '& .MuiInputBase-input': { py: 0.25, fontSize: '0.75rem' } }}
                    slotProps={{ input:{disableUnderline: true }}}
                  >
                    {[8, 16, 32, 64].map((n) => <MenuItem key={n} value={n}>{n}</MenuItem>)}
                  </TextField>
                  <Tooltip title="Samples per update"><HelpOutlineIcon fontSize="small" className="text-white" /></Tooltip>
                </div>
                <div className="flex items-center space-x-2 text-white text-sm">
                  <Typography className="w-16">LR:</Typography>
                  <TextField
                    variant="standard"
                    type="number"
                    value={learningRate}
                    onChange={(e) => setLearningRate(+e.target.value)}
                    size="small"
                    sx={{ width: 100, '& .MuiInputBase-input': { py: 0.25, fontSize: '0.75rem' } }}
                    inputProps={{ step: 0.0001 }}
                    slotProps={{ input:{disableUnderline: true }}}
                  />
                  <Tooltip title="Step size"><HelpOutlineIcon fontSize="small" className="text-white" /></Tooltip>
                </div>
              </div>
            </Collapse>
          </CardContent>
        </div>
      </Card>
    </motion.div>
  );
};


interface PreviewCardProps {
  classes: ClassItem[];
  headModelRef: MutableRefObject<tf.LayersModel | null>;
  isTrained: boolean;
  poseDetector: PoseDetector | null;
}

const PreviewCard: React.FC<PreviewCardProps> = ({
  classes,
  headModelRef,
  isTrained,
  poseDetector,
}) => {
  const [inputOn, setInputOn] = useState(false);
  const [source, setSource] = useState<'Webcam' | 'File'>('Webcam');
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [results, setResults] = useState<{ label: string; confidence: number }[]>([]);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const animationFrameRef = useRef<number>(0);

  const runPredict = async () => {
    if (!headModelRef.current || !poseDetector) return;
    let keypoints: tf.Tensor | undefined;
    let poses: posedetection.Pose[] = [];

    if (source === 'Webcam') {
      const video = videoRef.current;
      if (!video || video.videoWidth === 0) return;

      poses = await poseDetector.estimatePoses(video, {
        maxPoses: 1,
        flipHorizontal: false,
      });

      keypoints = tf.tidy(() => {
        const keypointsData =
          poses[0]?.keypoints.map((kp) => [kp.x / video.videoWidth, kp.y / video.videoHeight]).flat() ||
          Array(34).fill(0);
        return tf.tensor2d(keypointsData, [1, 34]);
      });

      if (overlayCanvasRef.current) {
        const ctx = overlayCanvasRef.current.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);
          drawKeypoints(ctx, poses, video.videoWidth, video.videoHeight);
        }
      }
    } else if (previewSrc) {
      const img = new Image();
      img.src = previewSrc;
      await new Promise<void>((res) => {
        img.onload = () => {
          if (overlayCanvasRef.current) {
            const displayWidth = 200;
            const aspectRatio = img.height / img.width;
            overlayCanvasRef.current.width = displayWidth;
            overlayCanvasRef.current.height = displayWidth * aspectRatio;
          }
          res();
        };
      });

      poses = await poseDetector.estimatePoses(img, {
        maxPoses: 1,
        flipHorizontal: false,
      });

      keypoints = tf.tidy(() => {
        const keypointsData =
          poses[0]?.keypoints.map((kp) => [kp.x / img.width, kp.y / img.height]).flat() ||
          Array(34).fill(0);
        return tf.tensor2d(keypointsData, [1, 34]);
      });

      if (overlayCanvasRef.current) {
        const ctx = overlayCanvasRef.current.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);
          drawKeypoints(ctx, poses, img.width, img.height);
        }
      }
    }

    if (!keypoints) return;
    const prediction = tf.tidy(() => headModelRef.current!.predict(keypoints) as tf.Tensor);
    const values = await prediction.data();
    const classesWithConfidences = classes.map((c, i) => ({
      label: c.name,
      confidence: values[i],
    }));
    setResults(classesWithConfidences);
    tf.dispose([keypoints, prediction]);
  };

  useEffect(() => {
    if (inputOn && source === 'Webcam') {
      navigator.mediaDevices
        .getUserMedia({ video: true })
        .then((stream) => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        })
        .catch((err) => console.error('webcam error:', err));
      const detectLoop = async () => {
        await runPredict();
        animationFrameRef.current = requestAnimationFrame(detectLoop);
      };
      animationFrameRef.current = requestAnimationFrame(detectLoop);
    }
    if (!inputOn) {
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
      }
      cancelAnimationFrame(animationFrameRef.current);
      setResults([]);
      setPreviewSrc(null);
    }
    return () => {
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
      }
      cancelAnimationFrame(animationFrameRef.current);
    };
  }, [inputOn, source, headModelRef, poseDetector]);

  const handleUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setPreviewSrc(result);
      runPredict();
    };
    reader.readAsDataURL(file);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} whileHover={{ scale: 1.04 }} transition={{ duration: 0.5 }}>
      <Card
        elevation={0}
        sx={{ width: 400, background: 'linear-gradient(135deg, #2E8B57 0%, #98FF98 100%)', borderRadius: '20px', border: '1px solid rgba(255, 255, 255, 0.1)', boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)' }}
        className="mt-6 mb-6 overflow-hidden"
      >
        <div className="backdrop-blur-md p-4" style={{ background: 'rgba(255,255,255,0.05)' }}>
          <CardHeader
            title={<span className="text-white text-xl font-bold uppercase tracking-wide hover:text-[#ffebf0] transition-colors duration-200">Preview</span>}
            sx={{ p: 2, mb: 2, background: 'rgba(255,255,255,0.1)', borderRadius: '12px 12px 0 0' }}
          />
          <CardContent sx={{ p: 0 }}>
            <div className="px-4">
              <Tooltip title={!isTrained ? 'Train model first' : ''} arrow disableHoverListener={isTrained}>
                <span>
                  <Button
                    variant="outlined"
                    fullWidth
                    disabled={!isTrained}
                    onClick={() => alert('Download Model (not yet implemented)')}
                    sx={{
                      mb: 2,
                      borderRadius: '8px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                      transition: 'all 0.3s ease',
                      borderColor: '#fff',
                      color: '#fff',
                      background: 'linear-gradient(45deg, #1c0038 0%, #2e0051 100%)',
                      boxShadow: '0 0 10px rgba(255,255,255,0.1)',
                      '&:hover': { background: '#fff', color: '#1b0031', boxShadow: '0 0 15px rgba(255,255,255,0.3)', transform: 'translateY(-1px)' },
                      '&:active': { transform: 'translateY(0)' },
                      '&.Mui-disabled': { background: 'rgba(0, 0, 0, 0.12)', borderColor: 'rgba(0, 0, 0, 0.12)', color: 'rgba(0, 0, 0, 0.26)', boxShadow: 'none' },
                    }}
                  >
                    Download Model
                  </Button>
                </span>
              </Tooltip>
              <div className="flex items-center mb-4 gap-2">
                <Typography className="text-white">Input</Typography>
                <Switch checked={inputOn} onChange={(e) => setInputOn(e.target.checked)} />
                <Typography className="text-white">{inputOn ? 'ON' : 'OFF'}</Typography>
              </div>
              {inputOn && (
                <>
                  <TextField
                    select
                    value={source}
                    onChange={(e) => setSource(e.target.value as 'Webcam' | 'File')}
                    size="small"
                    fullWidth
                    className="mb-4 bg-transparent text-white rounded"
                    slotProps={{
                        input: {
                          disableUnderline: true,
                          sx: { color: '#f0e6ff' },
                        },
                        select: {
                          IconComponent: () => <ArrowDropDownIcon sx={{ color: '#fff' }} />,
                        },
                    }}
                  >
                    {['Webcam', 'File'].map((opt) => <MenuItem key={opt} value={opt}>{opt}</MenuItem>)}
                  </TextField>
                  {source === 'Webcam' && (
                    <div className="mb-4 relative">
                      <video ref={videoRef} autoPlay playsInline className="w-full rounded-lg" />
                      <canvas ref={overlayCanvasRef} className="absolute top-0 left-0 w-full h-full" style={{ zIndex: 10 }} />
                    </div>
                  )}
                  {source === 'File' && (
                    <div className="mb-4 text-center">
                      <Button
                        variant="contained"
                        startIcon={<UploadIcon />}
                        onClick={() => fileRef.current?.click()}
                        sx={{
                          background: 'linear-gradient(45deg, #7b5aff 0%, #8e8ffa 100%)',
                          color: '#fff',
                          borderRadius: '8px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.1em',
                          transition: 'all 0.3s ease',
                          '&:hover': { background: 'linear-gradient(45deg, #6f4eff 0%, #8486f3 100%)' },
                        }}
                      >
                        Upload Image
                      </Button>
                      <input type="file" accept="image/*" ref={fileRef} className="hidden" onChange={handleUpload} />
                      {previewSrc && (
                        <div className="relative inline-block mt-2">
                          <img src={previewSrc} className="w-[200px] h-auto rounded-lg" style={{ display: 'block' }} />
                          <canvas ref={overlayCanvasRef} className="absolute top-0 left-0" style={{ zIndex: 10 }} />
                        </div>
                      )}
                    </div>
                  )}
                  {results.map((res, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.05 }}
                      className="mb-2 p-3 rounded-lg"
                      style={{ background: 'rgba(255, 255, 255, 0.05)' }}
                    >
                      <div className="flex justify-between mb-1">
                        <Typography className="text-white font-medium">{res.label}</Typography>
                        <Typography className="text-white/70">{(res.confidence * 100).toFixed(1)}%</Typography>
                      </div>
                      <LinearProgress
                        variant="determinate"
                        value={res.confidence * 100}
                        className="h-2 rounded-full"
                        sx={{ background: 'rgba(255,255,255,0.1)', '& .MuiLinearProgress-bar': { background: 'linear-gradient(45deg, #7b5aff 0%, #8e8ffa 100%)' } }}
                      />
                    </motion.div>
                  ))}
                </>
              )}
            </div>
          </CardContent>
        </div>
      </Card>
    </motion.div>
  );
};

interface ClassInputSectionProps {
  classes: ClassItem[];
  setClasses: React.Dispatch<React.SetStateAction<ClassItem[]>>;
  addImageToClass: (classId: number, image: string) => void;
  removeImageFromClass: (classId: number, index: number) => void;
  poseDetector: PoseDetector | null;
}

const ClassInputSection: React.FC<ClassInputSectionProps> = ({
  classes,
  setClasses,
  addImageToClass,
  removeImageFromClass,
  poseDetector,
}) => (
  <div className="flex-1 min-h-0 overflow-y-auto pr-4 scrollbar-thin scrollbar-thumb-space-white/20 scrollbar-track-transparent">
    {classes.map((c) => (
      <ClassCard
        key={c.id}
        classItem={c}
        setClasses={setClasses}
        addImageToClass={addImageToClass}
        removeImageFromClass={removeImageFromClass}
        poseDetector={poseDetector}
      />
    ))}
    <Tooltip title="Add a new class" arrow>
      <span>
        <Button
          variant="contained"
          fullWidth
          onClick={() => {
            const newId = classes.length ? classes[classes.length - 1].id + 1 : 1;
            setClasses([...classes, { id: newId, name: `Class ${newId}`, images: [] }]);
          }}
          sx={{
            background: 'linear-gradient(45deg, #7b5aff 0%, #8e8ffa 100%)',
            color: '#ffffff',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            borderRadius: '12px',
            boxShadow: '0 4px 15px rgba(123, 90, 255, 0.4)',
            py: 1.5,
            transition: 'all 0.3s ease',
            '&:hover': { background: 'linear-gradient(45deg, #6f4eff 0%, #8486f3 100%)', boxShadow: '0 6px 20px rgba(123, 90, 255, 0.6)', transform: 'translateY(-2px)' },
            '&:active': { transform: 'translateY(0)', boxShadow: '0 3px 10px rgba(123, 90, 255, 0.3)' },
          }}
        >
          Add another class
        </Button>
      </span>
    </Tooltip>
  </div>
);

const PoseEstimationModel: React.FC = () => {
  const [classes, setClasses] = useState<ClassItem[]>([
    { id: 1, name: 'Class 1', images: [] },
    { id: 2, name: 'Class 2', images: [] },
  ]);
  const [poseDetector, setPoseDetector] = useState<PoseDetector | null>(null);
  const headModelRef = useRef<tf.LayersModel | null>(null);
  const [isTrained, setIsTrained] = useState(false);

  useEffect(() => {
    (async () => {
      await tf.ready();
      await tf.setBackend('webgl');
      const detector = await posedetection.createDetector(SupportedModels.MoveNet, {
        modelType: posedetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
        enableSmoothing: true,
      });
      setPoseDetector(detector);
    })();
  }, []);

  const addImageToClass = (classId: number, image: string) => {
    setClasses((prev) => prev.map((c) => (c.id === classId ? { ...c, images: [...c.images, image] } : c)));
  };

  const removeImageFromClass = (classId: number, index: number) => {
    setClasses((prev) => prev.map((c) => (c.id === classId ? { ...c, images: c.images.filter((_, i) => i !== index) } : c)));
  };

  if (!poseDetector) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="p-4 text-center bg-space-black text-space-white flex justify-center items-center min-h-screen"
      >
        <CircularProgress className="text-space-white" />
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
      className="bg-space-black text-space-white p-4 max-w-7xl mx-auto relative min-h-screen"
    >
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-8 z-10 mt-10">
        <ClassInputSection classes={classes} setClasses={setClasses} addImageToClass={addImageToClass} removeImageFromClass={removeImageFromClass} poseDetector={poseDetector} />
        <ArrowForwardIcon className="hidden lg:block text-space-white text-glow my-auto mx-4" />
        <div className="flex flex-col items-center md:flex-row md:justify-center md:space-x-8 space-y-8 md:space-y-0">
          <TrainingCard classes={classes} headModelRef={headModelRef} onTrainingComplete={() => setIsTrained(true)} poseDetector={poseDetector} />
          <ArrowForwardIcon className="hidden lg:block text-space-white text-glow my-auto mx-4" />
          <PreviewCard classes={classes} headModelRef={headModelRef} isTrained={isTrained} poseDetector={poseDetector} />
        </div>
      </div>
    </motion.div>
  );
};

export default PoseEstimationModel;