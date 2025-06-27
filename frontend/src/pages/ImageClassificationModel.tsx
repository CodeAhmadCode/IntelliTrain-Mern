import React, { useState, useRef, useEffect, MutableRefObject, useCallback } from 'react';
import { motion } from 'framer-motion';
import * as tf from '@tensorflow/tfjs';
import JSZip from 'jszip';

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
  RadioGroup,
  FormControlLabel,
  Radio,
  Snackbar,
  Alert,
  Box
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
  FileCopy as FileCopyIcon,
} from '@mui/icons-material';
import { LockIcon } from 'lucide-react';

// Utility to prompt user before refreshing if unsaved images exist
function useUnsavedChangesPrompt(hasImages: boolean) {
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasImages) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasImages]);
}

interface WebcamModalProps {
  classId: number;
  addImageToClass: (classId: number, image: string) => void;
  onClose: () => void;
   streamRef: React.MutableRefObject<MediaStream | null>;
}

export type DataLayerEvent = {
  event: string;
  classId?: number;
  [key: string]: unknown;
};

declare global {
  interface Window {
    dataLayer: DataLayerEvent[];
  }
}

const WebcamModal: React.FC<WebcamModalProps> = ({ classId, addImageToClass, onClose, streamRef }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const intervalRef = useRef<number | null>(null);
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: 'webcam_opened', classId });

    navigator.mediaDevices.getUserMedia({ video: true })
      .then(stream => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          streamRef.current = stream;
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('webcam error:', err);
        setError('Cannot access camera. Please check permissions or device.');
        setLoading(false);
      });

    return () => {
      console.log('Cleaning up WebcamModal stream');
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, [classId, streamRef]);

  const handleLoadedMetadata = () => {
    if (!videoRef.current || !canvasRef.current) return;
    canvasRef.current.width = videoRef.current.videoWidth;
    canvasRef.current.height = videoRef.current.videoHeight;
  };

  const captureImage = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg');
    setCapturedImages(prev => [...prev, dataUrl]);
    addImageToClass(classId, dataUrl);
    window.dataLayer.push({ event: 'image_captured', classId });
  };

  const startRecording = () => {
    if (intervalRef.current === null) {
      intervalRef.current = window.setInterval(captureImage, 500);
      window.dataLayer.push({ event: 'record_started', classId });
    }
  };

  const stopRecording = () => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
      window.dataLayer.push({ event: 'record_stopped', classId });
    }
  };

  return (
    <Modal open onClose={onClose} disableScrollLock>
      <div 
        className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center" 
        onClick={onClose}
      >
        <motion.div
          onClick={e => e.stopPropagation()}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="relative shadow-lg p-8 rounded-2xl w-[95%] max-w-4xl flex flex-col md:flex-row gap-6"
          style={{ background: 'linear-gradient(to bottom, #F0F8FF, #FFFFFF)' }}
        >
          <IconButton
            size="small"
            onClick={onClose}
            sx={{
              position: 'absolute',
              top: 4,
              right: 4,
              color: '#FF312E',
              '&:hover': { color: '#DB3069' },
            }}
          >
            <CloseIcon />
          </IconButton>

          <div className="flex-1">
            <Typography variant="h6" sx={{ color: '#333333', fontWeight: 'bold',textAlign:'center' }}>
              Webcam Live Preview
            </Typography>
            <Box sx={{ height: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {loading && (
                <Box
                  sx={{
                    display: 'flex',
                    '@keyframes pulse': {
                      '0%': { transform: 'scale(1)' },
                      '50%': { transform: 'scale(1.5)' },
                      '100%': { transform: 'scale(1)' },
                    },
                  }}
                >
                  <Box
                    sx={{
                      width: '10px',
                      height: '10px',
                      backgroundColor: '#4A90E2',
                      borderRadius: '50%',
                      margin: '0 5px',
                      animation: 'pulse 1.5s infinite ease-in-out 0s',
                    }}
                  />
                  <Box
                    sx={{
                      width: '10px',
                      height: '10px',
                      backgroundColor: '#4A90E2',
                      borderRadius: '50%',
                      margin: '0 5px',
                      animation: 'pulse 1.5s infinite ease-in-out 0.3s',
                    }}
                  />
                  <Box
                    sx={{
                      width: '10px',
                      height: '10px',
                      backgroundColor: '#4A90E2',
                      borderRadius: '50%',
                      margin: '0 5px',
                      animation: 'pulse 1.5s infinite ease-in-out 0.6s',
                    }}
                  />
                </Box>
              )}
              {error && <Typography color="error" sx={{ mb: 2 }}>{error}</Typography>}
              {!loading && !error && (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  onLoadedMetadata={handleLoadedMetadata}
                  className="w-full rounded-lg border border-gray-200"
                  style={{ maxHeight: '400px' }}
                />
              )}
            </Box>
            <canvas ref={canvasRef} className="hidden" />
            <Button
              variant="contained"
              className="mt-1 w-full uppercase tracking-wider transition-all duration-300"
              sx={{
                backgroundColor: '#4A90E2',
                color: '#FFFFFF',
                '&:hover': {
                  backgroundColor: '#3A7BC8',
                  transform: 'scale(1.02)',
                },
              }}
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

          <div
            className="flex-1 max-h-[400px] overflow-y-auto rounded-lg p-4"
            
          >
            <Typography variant="h6" sx={{ color: '#333333', fontWeight: 'bold', mb: 2,mt:6, textAlign:'center' }}>
              Captured Images ({capturedImages.length})
            </Typography>
            <div className="flex flex-wrap gap-2">
              {capturedImages.map((src, i) => (
                <motion.img
                  key={i}
                  src={src}
                  alt={`Capture ${i + 1}`}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3 }}
                  className="w-20 h-20 object-cover rounded-lg shadow-md"
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
}

const ClassCard: React.FC<ClassCardProps> = ({ classItem, setClasses, addImageToClass, removeImageFromClass }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempName, setTempName] = useState(classItem.name);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [isWebcamOpen, setIsWebcamOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const webcamStreamRef = useRef<MediaStream | null>(null);

  const handleDeleteClick = () => {
    setConfirmOpen(true);
    setAnchorEl(null);
  };

  const confirmDelete = () => {
    setClasses(prev => prev.filter(c => c.id !== classItem.id));
    setConfirmOpen(false);
  };

  const handleSave = () => {
    setClasses(prev => prev.map(c => (c.id === classItem.id ? { ...c, name: tempName } : c)));
    setIsEditing(false);
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
    imageFiles.forEach(file => {
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

    function handleWebcamClose() {
        // stop everything immediately
        if (webcamStreamRef.current) {
          webcamStreamRef.current.getTracks().forEach(t => t.stop());
          webcamStreamRef.current = null;
        }
      setIsWebcamOpen(false);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.4 }}
      className="max-w-sm mx-auto"
    >
      <Card
        elevation={0}
        sx={{
          backgroundColor: '#254E70',
          borderRadius: '16px',
          boxShadow: '0 0 10px rgba(0, 0, 0, 0.2)',
          overflow: 'hidden',
          position: 'relative',
        }}
        className="mt-6 mb-6"
      >
        {/* Floating Action Buttons */}
        <div className="absolute top-4 right-4 flex flex-col gap-1">
          <IconButton
            size="small"
            sx={{
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.2)' },
              width: 32,
              height: 32,
            }}
            onClick={() => setIsEditing(true)}
          >
            <EditIcon sx={{ color: '#FFFFFF', fontSize: '16px' }} />
          </IconButton>
          <IconButton
            size="small"
            sx={{
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.2)' },
              width: 32,
              height: 32,
            }}
            onClick={e => setAnchorEl(e.currentTarget)}
          >
            <MoreVertIcon sx={{ color: '#FFFFFF', fontSize: '16px' }} />
          </IconButton>
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={() => setAnchorEl(null)}
            PaperProps={{
              sx: {
                backgroundColor: '#1A3A5A',
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
                color: '#FFFFFF',
              },
            }}
          >
            <MenuItem
              onClick={handleDeleteClick}
              sx={{ color: '#E57373', '&:hover': { backgroundColor: 'rgba(229, 115, 115, 0.1)' } }}
            >
              Delete Class
            </MenuItem>
          </Menu>
        </div>

        <CardHeader
          title={
            isEditing ? (
              <TextField
                value={tempName}
                onChange={e => setTempName(e.target.value)}
                onBlur={handleSave}
                size="small"
                variant="outlined"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: '4px',
                    '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.2)' },
                    '&:hover fieldset': { borderColor: '#4A90E2' },
                  },
                  '& .MuiInputBase-input': { color: '#FFFFFF', fontWeight: 'bold' },
                }}
              />
            ) : (
              <Typography
                variant="h6"
                sx={{
                  color: '#FFFFFF',
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                {tempName}
              </Typography>
            )
          }
          subheader={
            <Typography variant="body2" sx={{ color: '#AEDFF7' }}>
              {classItem.images.length} Samples
            </Typography>
          }
          sx={{ p: 2, pb: 1 }}
        />

        <CardContent sx={{ p: 2, pt: 0 }}>
          {/* Captured Images Section */}
          {classItem.images.length > 0 && (
            <Box sx={{ maxHeight: 200, overflowY: 'auto', mt: 2 }}>
              <Typography variant="body2" sx={{ color: '#AEDFF7', mb: 1 }}>
                Captured Images
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
                {classItem.images.map((src, idx) => (
                  <Box key={idx} sx={{ position: 'relative', aspectRatio: '1 / 1' }} className="image-container">
                    <motion.img
                      src={src}
                      alt={`Image ${idx + 1}`}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      //whileHover={{ scale: 1.05 }}
                      transition={{ duration: 0.3 }}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '4px' }}
                    />
                    <IconButton
                      size="small"
                      onClick={() => removeImageFromClass(classItem.id, idx)}
                      sx={{
                        position: 'absolute',
                        top: 4,
                        right: 4,
                        backgroundColor: '#EF3E36',
                        opacity: 1,
                        '&:hover': { backgroundColor: '#EF3E36', opacity:1 },
                        
                      }}
                      className="delete-icon"
                    >
                      <DeleteIcon sx={{ color: '#FFFFFF', fontSize: '16px' }} />
                    </IconButton>
                  </Box>
                ))}
              </Box>
            </Box>
          )}

          {/* Add Image Samples Buttons */}
          <div className="flex flex-wrap justify-between mt-4 gap-2">
            <Tooltip title="Capture Images with your Camera" arrow>
              <Button
                variant="contained"
                startIcon={<CameraAltIcon />}
                onClick={() => setIsWebcamOpen(true)}
                sx={{
                  backgroundColor: '#4A90E2',
                  color: '#FFFFFF',
                  borderRadius: '4px',
                  px: 2,
                  py: 1,
                  flex: '1 1 48%',
                  '&:hover': {
                    backgroundColor: '#357ABD',
                    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
                  },
                }}
              >
                Webcam
              </Button>
            </Tooltip>

            <Tooltip title="Upload Images from your gallery" arrow>
              <Button
                variant="contained"
                startIcon={<UploadIcon />}
                onClick={() => fileInputRef.current?.click()}
                sx={{
                  backgroundColor: '#4A90E2',
                  color: '#FFFFFF',
                  borderRadius: '4px',
                  px: 2,
                  py: 1,
                  flex: '1 1 48%',
                  '&:hover': {
                    backgroundColor: '#357ABD',
                    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
                  },
                }}
              >
                Upload
              </Button>
            </Tooltip>

            <input
              type="file"
              accept="image/*"
              multiple
              ref={fileInputRef}
              className="hidden"
              onChange={handleUpload}
            />
          </div>
        </CardContent>
      </Card>

      {isWebcamOpen && (
            <WebcamModal
              classId={classItem.id}
              addImageToClass={addImageToClass}
              onClose={handleWebcamClose}
              streamRef={webcamStreamRef}
            />
          
      )}
    

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle sx={{ color: '#FFFFFF', backgroundColor: '#254E70' }}>
          Confirm Delete
        </DialogTitle>
        <DialogContent sx={{ color: '#AEDFF7', backgroundColor: '#1A3A5A' }}>
          Are you sure you want to delete class "{classItem.name}"?
        </DialogContent>
        <DialogActions sx={{ backgroundColor: '#1A3A5A' }}>
          <Button onClick={() => setConfirmOpen(false)} sx={{ color: '#AEDFF7' }}>
            Cancel
          </Button>
          <Button onClick={confirmDelete} sx={{ color: '#E57373' }}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </motion.div>
  );
};

function createHeadModel(numClasses: number, learningRate: number): tf.LayersModel {
  const l2 = tf.regularizers.l2({ l2: 0.01 });
  const model = tf.sequential();
  model.add(tf.layers.dense({
    inputShape: [1280],
    units: 128,
    activation: 'relu',
    kernelRegularizer: l2
  }));
  model.add(tf.layers.batchNormalization());
  model.add(tf.layers.dropout({ rate: 0.5 }));
  model.add(tf.layers.dense({
    units: numClasses,
    activation: 'softmax',
    kernelRegularizer: l2
  }));
  model.compile({
    optimizer: tf.train.adam(learningRate),
    loss: 'categoricalCrossentropy',
    metrics: ['accuracy'],
  });
  return model;
}

interface TrainingCardProps {
  classes: ClassItem[];
  truncatedNet: tf.LayersModel;
  headModelRef: MutableRefObject<tf.LayersModel | null>;
  onTrainingComplete: () => void;
  isTrained: boolean; // Added to track training state
}

const TrainingCard: React.FC<TrainingCardProps> = ({ classes, truncatedNet, headModelRef, onTrainingComplete, isTrained }) => {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [epochs, setEpochs] = useState(50);
  const [batchSize, setBatchSize] = useState(16);
  const [learningRate, setLearningRate] = useState(0.001);
  const [isTraining, setIsTraining] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentEpoch, setCurrentEpoch] = useState(0);
  const [trainAcc, setTrainAcc] = useState(0);
  const [valAcc, setValAcc] = useState(0);
  const [showTrainingModal, setShowTrainingModal] = useState(false);
  const [showRetrainModal, setShowRetrainModal] = useState(false);

  const canTrain = classes.filter(c => c.images.length > 0).length >= 2;

  useEffect(() => {
    if (showTrainingModal) {
      const timer = setTimeout(() => setShowTrainingModal(false), 20000);
      return () => clearTimeout(timer);
    }
  }, [showTrainingModal]);

  const trainModel = async () => {
    if (!truncatedNet || classes.length === 0) return;
    setIsTraining(true);
    setProgress(0);
    setShowTrainingModal(true);

    const numClasses = classes.length;
    headModelRef.current = createHeadModel(numClasses, learningRate);

    const embeddings: tf.Tensor<tf.Rank>[] = [];
    const labels: number[] = [];
    for (let ci = 0; ci < numClasses; ci++) {
      for (const src of classes[ci].images) {
        const img = new Image();
        img.src = src;
        await new Promise<void>(res => {
          img.onload = () => res();
        });
        const embed = tf.tidy(() => {
          let t = tf.browser.fromPixels(img).toFloat().div(255);
          t = tf.image.resizeBilinear(t as tf.Tensor3D, [224, 224]);
          t = t.expandDims(0);
          if (Math.random() > 0.5) {
            t = tf.image.flipLeftRight(t as tf.Tensor4D);
          }
          const delta = tf.randomUniform([1, 1, 1, 1], -0.1, 0.1);
          t = t.add(delta).clipByValue(0, 1);
          return truncatedNet.predict(t) as tf.Tensor;
        });

        embeddings.push(embed);
        labels.push(ci);
      }
    }

    const xs = tf.concat(embeddings, 0);
    const ys = tf.oneHot(tf.tensor1d(labels, 'int32'), numClasses);

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
            setValAcc((logs.val_acc as number) ?? 0);
            await tf.nextFrame();
          },
        },
      ],
    });

    embeddings.forEach(e => e.dispose());
    xs.dispose();
    ys.dispose();

    setProgress(100);
    setIsTraining(false);
    setShowTrainingModal(false);
    onTrainingComplete();
  };

  const handleTrainClick = () => {
    if (isTrained) {
      setShowRetrainModal(true);
    } else {
      trainModel();
    }
  };

  const handleRetrainConfirm = () => {
    setShowRetrainModal(false);
    trainModel();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.4 }}
      className="max-w-sm mx-auto"
    >
      <Card
        elevation={0}
        sx={{
          width: 250,
          borderRadius: '16px',
          backgroundColor: '#254E70',
          boxShadow: '0 0 10px rgba(0, 0, 0, 0.2)',
          overflow: 'hidden',
        }}
        className="mt-4 mb-4"
      >
        <CardHeader
          title={
            <Typography
              variant="h6"
              sx={{
                color: '#FFFFFF',
                fontWeight: 'bold',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              Training
            </Typography>
          }
          sx={{ p: 2, pb: 1 }}
        />

        <CardContent sx={{ p: 2, pt: 0 }}>
          <Tooltip
            title={
              !truncatedNet
                ? 'You must load the base machine learning model before training can begin.'
                : isTraining
                ? 'Training is currently in progress. Please wait until it completes.'
                : !canTrain
                ? 'You need at least two classes with image examples to start training.'
                : 'Click to start training the model with your provided image classes.'
            }
            arrow
            disableHoverListener={Boolean(truncatedNet && !isTraining && canTrain)}
          >
            <span>
              <Button
                variant="contained"
                fullWidth
                disabled={!truncatedNet || isTraining || !canTrain}
                onClick={handleTrainClick}
                sx={{
                  backgroundColor: '#4A90E2',
                  color: '#FFFFFF',
                  borderRadius: '4px',
                  py: 1,
                  textTransform: 'none',
                  '&:hover': {
                    backgroundColor: '#357ABD',
                    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
                  },
                  '&.Mui-disabled': {
                    backgroundColor: 'rgba(0, 0, 0, 0.2)',
                    color: 'rgba(255, 255, 255, 0.3)',
                  },
                }}
              >
                {isTraining ? 'Training…' : isTrained ? 'Retrain' : 'Train'}
              </Button>
            </span>
          </Tooltip>

          {isTraining && (
            <Box sx={{ mt: 2 }}>
              <LinearProgress
                variant="determinate"
                value={progress}
                sx={{
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  '& .MuiLinearProgress-bar': { backgroundColor: '#4A90E2' },
                }}
              />
              <Box sx={{ mt: 1, textAlign: 'center' }}>
                <motion.div
                  key={currentEpoch}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <Typography
                    variant="caption"
                    sx={{ color: '#AEDFF7', display: 'block' }}
                  >
                    Epoch {currentEpoch}/{epochs}
                  </Typography>
                  <Tooltip
                    title={trainAcc === 1 ? '100% train accuracy might mean overfitting. Try adding more diverse images or tweaking the model settings.' : ''}
                    arrow
                  >
                    <Typography
                      variant="caption"
                      sx={{
                        color: trainAcc >= 0.8 ? '#4CAF50' : trainAcc >= 0.6 ? '#FFCA28' : '#E57373',
                        display: 'block',
                      }}
                    >
                      Train Accuracy: {(trainAcc * 100).toFixed(1)}%
                    </Typography>
                  </Tooltip>
                  <Tooltip
                    title={valAcc === 1 ? '100% validation accuracy could indicate overfitting or too little validation data. Consider increasing your dataset.' : ''}
                    arrow
                  >
                    <Typography
                      variant="caption"
                      sx={{
                        color: valAcc >= 0.8 ? '#4CAF50' : valAcc >= 0.6 ? '#FFCA28' : '#E57373',
                        display: 'block',
                      }}
                    >
                      Validation Accuracy: {(valAcc * 100).toFixed(1)}%
                    </Typography>
                  </Tooltip>
                </motion.div>
                <Typography
                  variant="caption"
                  sx={{ color: '#AEDFF7', display: 'block', mt: 1, fontStyle: 'italic' }}
                >
                  Train accuracy reflects fit to training data; validation accuracy shows generalization. Very high values might suggest overfitting.
                </Typography>
              </Box>
            </Box>
          )}

          <Button
            variant="outlined"
            fullWidth
            endIcon={advancedOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            onClick={() => setAdvancedOpen(o => !o)}
            sx={{
              mt: 2,
              borderRadius: '4px',
              borderColor: 'rgba(255, 255, 255, 0.2)',
              color: '#FFFFFF',
              textTransform: 'none',
              py: 1,
              '&:hover': {
                borderColor: '#4A90E2',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
              },
            }}
          >
            Advanced Options
          </Button>

          <Collapse in={advancedOpen}>
            <Box
              sx={{
                mt: 2,
                p: 2,
                borderRadius: '4px',
                backgroundColor: '#1A3A5A',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 1 }}>
                <Typography sx={{ color: '#AEDFF7', width: 80, fontSize: '0.875rem' }}>
                  Epochs:
                </Typography>
                <TextField
                  type="number"
                  value={epochs}
                  onChange={e => setEpochs(+e.target.value)}
                  size="small"
                  sx={{
                    flex: 1,
                    '& .MuiInputBase-input': { color: '#FFFFFF', fontSize: '0.875rem', py: 0.5 },
                    '& .MuiOutlinedInput-root': {
                      '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.2)' },
                      '&:hover fieldset': { borderColor: '#4A90E2' },
                    },
                  }}
                  inputProps={{ min: 1 }}
                />
                <Tooltip
                  title="Epochs define how many times the model sees the entire dataset during training. Higher values can improve accuracy but take longer and may overfit if too high. Default: 50."
                  arrow
                >
                  <HelpOutlineIcon sx={{ color: '#AEDFF7', fontSize: '16px' }} />
                </Tooltip>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 1 }}>
                <Typography sx={{ color: '#AEDFF7', width: 80, fontSize: '0.875rem' }}>
                  Batch Size:
                </Typography>
                <TextField
                  select
                  value={batchSize}
                  onChange={e => setBatchSize(+e.target.value)}
                  size="small"
                  sx={{
                    flex: 1,
                    '& .MuiInputBase-input': { color: '#FFFFFF', fontSize: '0.875rem', py: 0.5 },
                    '& .MuiOutlinedInput-root': {
                      '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.2)' },
                      '&:hover fieldset': { borderColor: '#4A90E2' },
                    },
                  }}
                >
                  {[8, 16, 32, 64].map(n => (
                    <MenuItem key={n} value={n}>
                      {n}
                    </MenuItem>
                  ))}
                </TextField>
                <Tooltip
                  title="Batch size is the number of images processed before the model updates its weights. Smaller batches use less memory but may be less stable. Default: 16."
                  arrow
                >
                  <HelpOutlineIcon sx={{ color: '#AEDFF7', fontSize: '16px' }} />
                </Tooltip>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography sx={{ color: '#AEDFF7', width: 80, fontSize: '0.875rem' }}>
                  Learning Rate:
                </Typography>
                <TextField
                  type="number"
                  value={learningRate}
                  onChange={e => setLearningRate(+e.target.value)}
                  size="small"
                  sx={{
                    flex: 1,
                    minWidth: '100px', // Ensures visibility of small values
                    '& .MuiInputBase-input': { color: '#FFFFFF', fontSize: '0.875rem', py: 0.5 },
                    '& .MuiOutlinedInput-root': {
                      '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.2)' },
                      '&:hover fieldset': { borderColor: '#4A90E2' },
                    },
                  }}
                  inputProps={{ step: 0.0001, min: 0 }}
                />
                <Tooltip
                  title="Learning rate controls how much the model adjusts its weights per update. Lower values are slower but more precise; higher values are faster but may overshoot. Default: 0.001."
                  arrow
                >
                  <HelpOutlineIcon sx={{ color: '#AEDFF7', fontSize: '16px' }} />
                </Tooltip>
              </Box>
            </Box>
          </Collapse>
        </CardContent>
      </Card>

      <Modal
        open={showTrainingModal}
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
          mt: '30px',
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
        >
          <Box
            sx={{
              backgroundColor: '#1A3A5A',
              borderRadius: '8px',
              p: 2,
              maxWidth: 400,
              width: '90%',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
              color: '#FFFFFF',
              position: 'relative',
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="h6" sx={{ fontWeight: 'bold', fontSize: '1rem' }}>
                Training Started
              </Typography>
              <IconButton
                onClick={() => setShowTrainingModal(false)}
                sx={{ color: '#E57373', p: 0.5 }}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>
            <Typography sx={{ color: '#AEDFF7', fontSize: '0.875rem' }}>
              Training may take a few minutes depending on your images and settings. Please stay on this tab, as switching tabs will stop the training process.
            </Typography>
          </Box>
        </motion.div>
      </Modal>

      <Modal
        open={showRetrainModal}
        onClose={() => setShowRetrainModal(false)}
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.3 }}
        >
          <Box
            sx={{
              backgroundColor: '#1A3A5A',
              borderRadius: '8px',
              p: 3,
              maxWidth: 400,
              width: '90%',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
              color: '#FFFFFF',
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 'bold', fontSize: '1rem', mb: 2 }}>
              Retrain Model?
            </Typography>
            <Typography sx={{ color: '#AEDFF7', fontSize: '0.875rem', mb: 3 }}>
              Your model is already trained. Retraining may improve accuracy but will take additional time depending on your settings.
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
              <Button
                onClick={() => setShowRetrainModal(false)}
                sx={{
                  color: '#E57373',
                  fontSize: '0.875rem',
                  textTransform: 'none',
                }}
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                onClick={handleRetrainConfirm}
                sx={{
                  backgroundColor: '#4A90E2',
                  color: '#FFFFFF',
                  borderRadius: '4px',
                  py: 1,
                  px: 2,
                  fontSize: '0.875rem',
                  textTransform: 'none',
                  '&:hover': { backgroundColor: '#357ABD' },
                }}
              >
                Retrain
              </Button>
            </Box>
          </Box>
        </motion.div>
      </Modal>
    </motion.div>
  );
};



interface PreviewCardProps {
  classes: { name: string }[];
  truncatedNet: tf.LayersModel | null;
  headModelRef: React.MutableRefObject<tf.LayersModel | null>;
  isTrained: boolean;
}


const PreviewCard: React.FC<PreviewCardProps> = ({ classes, truncatedNet, headModelRef, isTrained }) => {
  const [inputOn, setInputOn] = useState(false);
  const [source, setSource] = useState<'Webcam' | 'File'>('Webcam');
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [results, setResults] = useState<{ label: string; confidence: number }[]>([]);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [ setSelectedFormat] = useState<'TF.js' | 'TF' | 'TF Lite' | null>('TF.js');
  const [isExporting, setIsExporting] = useState(false);
  const [showCodeSnippet, setShowCodeSnippet] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [isSnackbarOpen, setIsSnackbarOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const intervalRef = useRef<number | null>(null);

  const codeSnippet = `
<div>Teachable Machine Image Model</div>
<button type="button" onclick="init()">Start</button>
<div id="webcam-container"></div>
<div id="label-container"></div>
<script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@latest/dist/tf.min.js"></script>
<script type="text/javascript">
    const modelPath = "path/to/your/model/";
    let model, webcam, maxPredictions;
    
    async function init() {
        const modelURL = modelPath + "model.json";
        const metadataURL = modelPath + "metadata.json";
        
        model = await tf.loadLayersModel(modelURL);
        const metadata = await (await fetch(metadataURL)).json();
        
        maxPredictions = metadata.classes.length;
        
        webcam = new tmImage.Webcam(200, 200, true);
        await webcam.setup();
        await webcam.play();
        
        document.getElementById("webcam-container").appendChild(webcam.canvas);
        
        const labelContainer = document.getElementById("label-container");
        labelContainer.innerHTML = '';
        metadata.classes.forEach((className) => {
            labelContainer.appendChild(document.createElement("div"));
        });
        
        predictLoop();
    }

    async function predictLoop() {
        webcam.update();
        await predict();
        window.requestAnimationFrame(predictLoop);
    }

    async function predict() {
        const prediction = await model.predict(webcam.canvas);
        const values = await prediction.data();
        prediction.dispose();
        
        const labelContainer = document.getElementById("label-container");
        for (let i = 0; i < maxPredictions; i++) {
            const classPrediction = 
                \`\${metadata.classes[i]}: \${values[i].toFixed(2)}\`;
            labelContainer.childNodes[i].innerHTML = classPrediction;
        }
    }
</script>
  `.trim();

  const handleCopyCode = () => {
    navigator.clipboard.writeText(codeSnippet);
    setIsSnackbarOpen(true);
  };

  const handleSnackbarClose = () => {
    setIsSnackbarOpen(false);
  };

  const fullModel = React.useMemo(() => {
    if (!truncatedNet || !headModelRef.current) return null;
    const model = tf.sequential();
    model.add(truncatedNet);
    model.add(headModelRef.current);
    return model;
  }, [truncatedNet, headModelRef]);

  const runPredict = useCallback(async () => {
    if (!truncatedNet || !headModelRef.current) return;
    let embedding: tf.Tensor | undefined;
    if (source === 'Webcam') {
      const video = videoRef.current;
      if (!video || video.videoWidth === 0) return;
      embedding = tf.tidy(() => {
        const imgTensor = tf.browser.fromPixels(video).toFloat().div(255);
        const batched = imgTensor.expandDims(0);
        const resized = tf.image.resizeBilinear(batched as tf.Tensor3D, [224, 224]);
        return truncatedNet.predict(resized) as tf.Tensor;
      });
    } else if (previewSrc) {
      const img = new Image();
      img.src = previewSrc;
      await new Promise<void>(res => { img.onload = () => res(); });
      embedding = tf.tidy(() => {
        const imgTensor = tf.browser.fromPixels(img).toFloat().div(255);
        const batched = imgTensor.expandDims(0);
        const resized = tf.image.resizeBilinear(batched as tf.Tensor3D, [224, 224]);
        return truncatedNet.predict(resized) as tf.Tensor;
      });
    }
    if (!embedding) return;

    const prediction = tf.tidy(() => headModelRef.current!.predict(embedding) as tf.Tensor);
    const values = await prediction.data();
    const classesWithConfidences = classes.map((c, i) => ({
      label: c.name,
      confidence: values[i],
    }));
    setResults(classesWithConfidences);
    tf.dispose([embedding, prediction]);
  }, [previewSrc, source, truncatedNet, headModelRef, classes]);

  useEffect(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
    setResults([]);
    setPreviewSrc(null);

    if (!inputOn) return;

    if (source === 'Webcam') {
      navigator.mediaDevices.getUserMedia({ video: true })
        .then(stream => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play();
          }
        })
        .catch(err => console.error('Webcam error:', err));
      intervalRef.current = window.setInterval(runPredict, 1000);
    } else if (source === 'File' && previewSrc) {
      runPredict();
    }

    return () => {
      if (intervalRef.current !== null) clearInterval(intervalRef.current);
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
        videoRef.current.srcObject = null;
      }
    };
  }, [previewSrc, source, inputOn, runPredict]);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
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

  const handleExportClick = () => {
    setIsExportModalOpen(true);
    setShowCodeSnippet(false);
    setExportError(null);
    //setSelectedFormat('TF.js');
  };

// Updated handleExport function
const handleExport = async () => {
  if (!fullModel) {
    setExportError('Model is not trained yet. Please train the model first.');
    return;
  }
  setIsExporting(true);
  setExportError(null);

  try {
    const metadata = {
      classes: classes.map(c => c.name),
      inputShape: [224, 224, 3],
      outputShape: [classes.length],
      created: new Date().toISOString(),
    };

    await fullModel.save(tf.io.withSaveHandler(async (artifacts) => {
      const zip = new JSZip();
      zip.file("model.json", JSON.stringify(artifacts.modelTopology));
      if (artifacts.weightData) {
        let weightsBuffer: ArrayBuffer;
        if (Array.isArray(artifacts.weightData)) {
          const totalLength = artifacts.weightData.reduce((acc, buf) => acc + buf.byteLength, 0);
          const temp = new Uint8Array(totalLength);
          let offset = 0;
          for (const buf of artifacts.weightData) {
            temp.set(new Uint8Array(buf), offset);
            offset += buf.byteLength;
          }
          weightsBuffer = temp.buffer;
        } else {
          weightsBuffer = artifacts.weightData;
        }
        zip.file("weights.bin", weightsBuffer);
      }
      zip.file("metadata.json", JSON.stringify(metadata, null, 2));
      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const a = document.createElement("a");
      a.href = url;
      a.download = "teachable-model.zip";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setShowCodeSnippet(true);
      return {
        modelArtifactsInfo: {
          dateSaved: new Date(),
          modelTopologyType: 'JSON',
        },
      };
    }));
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Export failed';
    setExportError(errorMsg);
  } finally {
    setIsExporting(false);
  }
};
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.4 }}
      className="max-w-md mx-auto"
    >
      <Card
        elevation={0}
        sx={{
          width:400,
          backgroundColor: '#254E70',
          borderRadius: '16px',
          boxShadow: '0 0 10px rgba(0, 0, 0, 0.2)',
          overflow: 'hidden',
        }}
        className="mt-4 mb-4"
      >
        <CardHeader
          title={
            <Typography
              variant="h6"
              sx={{
                color: '#FFFFFF',
                fontWeight: 'bold',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              Preview
            </Typography>
          }
          sx={{ p: 2, pb: 1 }}
        />
        <CardContent sx={{ p: 3, pt: 0 }}>
          <Tooltip
            title={
              !isTrained
                ? "The Export Model button is disabled because the model has not been trained yet. To enable it, go to the Training section, ensure you have at least two classes with images, and click 'Train'. Training teaches the model to recognize your classes. Once trained, you can export the model to use in your projects (e.g., web apps, Python, or mobile devices)."
                : "Export your trained model to use it in your projects, such as web applications (TensorFlow.js), Python projects (TensorFlow), or mobile devices (TensorFlow Lite)."
            }
            arrow
            disableHoverListener={isTrained}
          >
            <span>
              <Button
                variant="contained"
                fullWidth
                disabled={!isTrained}
                onClick={handleExportClick}
                startIcon={!isTrained ? <LockIcon /> : null}
                sx={{
                  mb: 3,
                  backgroundColor: '#4A90E2',
                  color: '#FFFFFF',
                  borderRadius: '4px',
                  textTransform: 'none',
                  py: 1.5,
                  fontSize: '1rem',
                  '&:hover': {
                    backgroundColor: '#357ABD',
                    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
                  },
                  '&.Mui-disabled': {
                    backgroundColor: 'rgba(0, 0, 0, 0.2)',
                    color: 'rgba(255, 255, 255, 0.3)',
                  },
                }}
              >
                Export Model
              </Button>
            </span>
          </Tooltip>

          
          <Modal
              open={isExportModalOpen}
              onClose={() => {
                setIsExportModalOpen(false);
                setShowCodeSnippet(false);
                setExportError(null);
              }}
              sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
              <Box
                sx={{
                  backgroundColor: '#1A3A5A',
                  borderRadius: '8px',
                  p: 3,
                  width: '90%',
                  maxWidth: 600,
                  maxHeight: '80vh',
                  overflowY: 'auto',
                  color: '#FFFFFF',
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                    Export Model
                  </Typography>
                  <IconButton
                    onClick={() => setIsExportModalOpen(false)}
                    sx={{ color: '#E57373' }}
                  >
                    <CloseIcon />
                  </IconButton>
                </Box>
                {isExporting ? (
                  <Box sx={{ textAlign: 'center' }}>
                    <CircularProgress size={24} sx={{ color: '#4A90E2', mb: 2 }} />
                    <Typography sx={{ color: '#AEDFF7' }}>
                      Exporting your model, please wait...
                    </Typography>
                  </Box>
                ) : exportError ? (
                  <Box>
                    <Typography sx={{ color: '#E57373', mb: 2 }}>{exportError}</Typography>
                    <Button
                      onClick={() => setIsExportModalOpen(false)}
                      sx={{ color: '#E57373' }}
                    >
                      Close
                    </Button>
                  </Box>
                ) : showCodeSnippet ? (
                  <Box>
                    <Typography sx={{ color: '#AEDFF7', mb: 2 }}>
                      Model exported successfully! Your download should start shortly.
                    </Typography>
                    <Typography sx={{ color: '#AEDFF7', mb: 2 }}>
                      Use this code snippet to load your model in a web project:
                    </Typography>
                    <Box
                      sx={{
                        maxHeight: 250,
                        overflowY: 'auto',
                        p: 2,
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        borderRadius: '4px',
                        backgroundColor: '#254E70',
                        mb: 2,
                      }}
                    >
                      <pre style={{ fontSize: '0.875rem', color: '#FFFFFF', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        <code>{codeSnippet}</code>
                      </pre>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                      <Button
                        variant="outlined"
                        startIcon={<FileCopyIcon />}
                        onClick={handleCopyCode}
                        sx={{
                          color: '#FFFFFF',
                          borderColor: 'rgba(255, 255, 255, 0.2)',
                          '&:hover': { borderColor: '#4A90E2', backgroundColor: 'rgba(255, 255, 255, 0.05)' },
                        }}
                      >
                        Copy Code
                      </Button>
                      <Button
                        variant="contained"
                        onClick={() => setIsExportModalOpen(false)}
                        sx={{
                          backgroundColor: '#4A90E2',
                          color: '#FFFFFF',
                          '&:hover': { backgroundColor: '#357ABD' },
                        }}
                      >
                        Close
                      </Button>
                    </Box>
                  </Box>
                ) : (
                  <Box>
                    <Typography sx={{ color: '#AEDFF7', mb: 2 }}>
                      Your model will be exported in <strong>TensorFlow.js</strong> format.
                    </Typography>
                    <Typography sx={{ color: '#AEDFF7', mb: 2 }}>
                      TensorFlow.js is a powerful library that lets you run machine learning models directly in web browsers or Node.js environments. Export your model to deploy it in interactive web applications, leveraging JavaScript for real-time predictions!
                    </Typography>
                    <Button
                      variant="outlined"
                      sx={{
                        color: '#4A90E2',
                        borderColor: '#4A90E2',
                        mb: 2,
                        '&:hover': { backgroundColor: 'rgba(74, 144, 226, 0.1)', borderColor: '#357ABD' },
                      }}
                      onClick={() => window.open('https://www.tensorflow.org/js', '_blank')}
                    >
                      Learn More About TensorFlow.js
                    </Button>
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                      <Button
                        onClick={() => setIsExportModalOpen(false)}
                        sx={{ color: '#E57373' }}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleExport}
                        disabled={isExporting}
                        variant="contained"
                        sx={{
                          backgroundColor: '#4A90E2',
                          color: '#FFFFFF',
                          '&:hover': { backgroundColor: '#357ABD' },
                          '&.Mui-disabled': { backgroundColor: 'rgba(0, 0, 0, 0.2)' },
                        }}
                      >
                        {isExporting ? 'Exporting...' : 'Export'}
                      </Button>
                    </Box>
                  </Box>
                )}
                <Snackbar
                  open={isSnackbarOpen}
                  autoHideDuration={3000}
                  onClose={handleSnackbarClose}
                  anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                >
                  <Alert
                    onClose={handleSnackbarClose}
                    severity="success"
                    sx={{ backgroundColor: '#4A90E2', color: '#FFFFFF' }}
                  >
                    Code copied to clipboard!
                  </Alert>
                </Snackbar>
              </Box>
              </Modal>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, gap: 1 }}>
            <Typography sx={{ color: '#FFFFFF', fontSize: '1rem' }}>Input</Typography>
            <Switch
              checked={inputOn}
              onChange={e => setInputOn(e.target.checked)}
              sx={{
                '& .MuiSwitch-track': { backgroundColor: 'rgba(255, 255, 255, 0.2)' },
                '& .MuiSwitch-thumb': { backgroundColor: '#4A90E2' },
              }}
            />
            <Typography sx={{ color: '#AEDFF7', fontSize: '1rem' }}>
              {inputOn ? 'ON' : 'OFF'}
            </Typography>
          </Box>

          {inputOn && (
            <>
              <TextField
                select
                value={source}
                onChange={e => setSource(e.target.value as 'Webcam' | 'File')}
                size="small"
                fullWidth
                sx={{
                  mb: 3,
                  '& .MuiInputBase-input': { color: '#FFFFFF', fontSize: '1rem' },
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.2)' },
                    '&:hover fieldset': { borderColor: '#4A90E2' },
                  },
                }}
              >
                {['Webcam', 'File'].map(opt => (
                  <MenuItem key={opt} value={opt}>
                    {opt}
                  </MenuItem>
                ))}
              </TextField>

              {source === 'Webcam' && (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  style={{ width: '100%', borderRadius: '8px', marginBottom: '24px' }}
                />
              )}

              {source === 'File' && (
                <Box sx={{ mb: 3, textAlign: 'center' }}>
                  <Button
                    variant="contained"
                    startIcon={<UploadIcon />}
                    onClick={() => fileRef.current?.click()}
                    sx={{
                      backgroundColor: '#4A90E2',
                      color: '#FFFFFF',
                      borderRadius: '4px',
                      py: 1,
                      '&:hover': { backgroundColor: '#357ABD' },
                    }}
                  >
                    Upload Image
                  </Button>
                  <input
                    type="file"
                    accept="image/*"
                    ref={fileRef}
                    className="hidden"
                    onChange={handleUpload}
                  />
                  {previewSrc && (
                    <img
                      src={previewSrc}
                      style={{ maxWidth: '100%', height: 'auto', borderRadius: '8px', marginTop: '16px' }}
                    />
                  )}
                </Box>
              )}

              {results.map((res, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  sx={{
                    mb: 2,
                    p: 2,
                    borderRadius: '4px',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography sx={{ color: '#FFFFFF', fontSize: '1rem' }}>
                      {res.label}
                    </Typography>
                    <Typography sx={{ color: '#AEDFF7', fontSize: '1rem' }}>
                      {(res.confidence * 100).toFixed(1)}%
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={res.confidence * 100}
                    sx={{
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      '& .MuiLinearProgress-bar': { backgroundColor: '#4A90E2' },
                    }}
                  />
                </motion.div>
              ))}
            </>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};

interface ClassInputSectionProps {
  classes: ClassItem[];
  setClasses: React.Dispatch<React.SetStateAction<ClassItem[]>>;
  addImageToClass: (classId: number, image: string) => void;
  removeImageFromClass: (classId: number, index: number) => void;
}

const ClassInputSection: React.FC<ClassInputSectionProps> = ({ classes, setClasses, addImageToClass, removeImageFromClass }) => (
  <div className="flex-1 min-h-0 overflow-y-auto pr-4 scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-100">
    {classes.map(c => (
      <ClassCard
        key={c.id}
        classItem={c}
        setClasses={setClasses}
        addImageToClass={addImageToClass}
        removeImageFromClass={removeImageFromClass}
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
            backgroundColor: '#4A90E2',
            color: '#FFFFFF',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            borderRadius: '12px',
            boxShadow: '0 4px 15px rgba(0, 0, 0, 0.1)',
            py: 1.5,
            transition: 'all 0.3s ease',
            '&:hover': {
              backgroundColor: '#3A7BC8',
              boxShadow: '0 6px 20px rgba(0, 0, 0, 0.15)',
              transform: 'translateY(-2px)',
            },
            '&:active': {
              transform: 'translateY(0)',
              boxShadow: '0 3px 10px rgba(0, 0, 0, 0.1)',
            },
          }}
        >
          Add another class
        </Button>
      </span>
    </Tooltip>
  </div>
);

const ImageClassificationModel: React.FC = () => {
  const [classes, setClasses] = useState<ClassItem[]>([
    { id: 1, name: 'Class 1', images: [] },
    { id: 2, name: 'Class 2', images: [] }
  ]);
  const [truncatedNet, setTruncatedNet] = useState<tf.LayersModel | null>(null);
  const headModelRef = useRef<tf.LayersModel | null>(null);
  const [isTrained, setIsTrained] = useState(false);

  const hasAnyImages = classes.some(c => c.images.length > 0);
  useUnsavedChangesPrompt(hasAnyImages);

  useEffect(() => {
    (async () => {
      await tf.ready();
      const mobilenet = await tf.loadLayersModel('https://storage.googleapis.com/teachable-machine-models/mobilenet_v2_weights_tf_dim_ordering_tf_kernels_1.0_224_no_top/model.json');
      const layer = mobilenet.getLayer('out_relu');
      const truncatedModel = tf.model({ inputs: mobilenet.inputs, outputs: layer.output });
      const model = tf.sequential();
      model.add(truncatedModel);
      model.add(tf.layers.globalAveragePooling2d({}));
      setTruncatedNet(model);
    })();
  }, []);

  const addImageToClass = (classId: number, image: string) => {
    setClasses(prev => prev.map(c => c.id === classId ? { ...c, images: [...c.images, image] } : c));
  };
  const removeImageFromClass = (classId: number, index: number) => {
    setClasses(prev => prev.map(c => c.id === classId
      ? { ...c, images: c.images.filter((_, i) => i !== index) }
      : c
    ));
  };

  if (!truncatedNet) {
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
        <ClassInputSection
          classes={classes}
          setClasses={setClasses}
          addImageToClass={addImageToClass}
          removeImageFromClass={removeImageFromClass}
        />
        
        <ArrowForwardIcon className="hidden lg:block text-space-white text-glow my-auto mx-4" />
        
        <div className="flex flex-col items-center md:flex-row md:justify-center md:space-x-8 space-y-8 md:space-y-0">
          <TrainingCard classes={classes} truncatedNet={truncatedNet} headModelRef={headModelRef} onTrainingComplete={() => setIsTrained(true)} isTrained={isTrained}/>
          <ArrowForwardIcon className="hidden lg:block text-space-white text-glow my-auto mx-4" />
          <PreviewCard classes={classes} truncatedNet={truncatedNet} headModelRef={headModelRef} isTrained={isTrained}/>
        </div>
      </div>
    </motion.div>
  );
};

export default ImageClassificationModel;