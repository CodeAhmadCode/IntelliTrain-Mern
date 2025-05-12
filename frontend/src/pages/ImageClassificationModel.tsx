import React, { useState, useRef, useEffect, MutableRefObject } from 'react';
import * as tf from '@tensorflow/tfjs';
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
  Box,
  Modal,
  Collapse,
  Tooltip,
  Switch,
  LinearProgress,
  CircularProgress
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
  ExpandLess as ExpandLessIcon
} from '@mui/icons-material';

interface WebcamModalProps {
  classId: number;
  addImageToClass: (classId: number, image: string) => void;
  onClose: () => void;
}

// Define a more precise type for dataLayer events
export type DataLayerEvent = {
  event: string;
  classId?: number;
  [key: string]: unknown;
};

// Extend Window interface for dataLayer
declare global {
  interface Window {
    dataLayer: DataLayerEvent[];
  }
}

const WebcamModal: React.FC<WebcamModalProps> = ({ classId, addImageToClass, onClose }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const intervalRef = useRef<number | null>(null);
  const [capturedImages, setCapturedImages] = useState<string[]>([]);

  useEffect(() => {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: 'webcam_opened', classId });

    navigator.mediaDevices.getUserMedia({ video: true })
      .then(stream => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(err => console.error('webcam error:', err));

    return () => {
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      }
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
      }
    };
  }, [classId]);

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
    <Modal open onClose={onClose}>
      <Box sx={{
        top: '50%', left: '50%',
        transform: 'translate(-50%,-50%)', bgcolor: 'background.paper',
        p: 4, width: '80%', maxWidth: 800, display: 'flex', gap: 2, position: 'relative'
      }}>
        <IconButton
          size="small"
          onClick={onClose}
          sx={{ position: 'absolute', top: 8, right: 8, color: 'grey.600' }}
        >
          <CloseIcon />
        </IconButton>

        <Box sx={{ flex: 1 }}>
          <Typography variant="h6" sx={{ bgcolor: '#4285f4', color: 'white', p: 1, mb: 2 }}>
            Webcam
          </Typography>
          <video
            ref={videoRef}
            autoPlay
            onLoadedMetadata={handleLoadedMetadata}
            style={{ width: '100%', borderRadius: 8 }}
          />
          <canvas ref={canvasRef} style={{ display: 'none' }} />
          <Button
            variant="contained"
            sx={{ mt: 2, width: '100%' }}
            onMouseDown={startRecording}
            onMouseUp={stopRecording}
            onMouseLeave={stopRecording}
            onTouchStart={startRecording}
            onTouchEnd={stopRecording}
            onClick={captureImage}
          >
            Hold to Record
          </Button>
        </Box>

        <Box sx={{ flex: 1, maxHeight: 400, overflowY: 'auto' }}>
          <Typography variant="h6" sx={{ bgcolor: '#e0e0e0', p: 1, mb: 2 }}>
            Captured Images
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {capturedImages.map((src, i) => (
              <img
                key={i}
                src={src}
                alt={`Capture ${i + 1}`}
                style={{ width: 80, height: 60, objectFit: 'cover', borderRadius: 4 }}
              />
            ))}
          </Box>
        </Box>
      </Box>
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
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleSave = () => {
    setClasses(prev => prev.map(c => c.id === classItem.id ? { ...c, name: tempName } : c));
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

  return (
    <Card sx={{ mb: 2 }}>
      <CardHeader
        title={
          isEditing ? (
            <TextField
              value={tempName}
              onChange={e => setTempName(e.target.value)}
              onBlur={handleSave}
              size="small"
              autoFocus
            />
          ) : tempName
        }
        action={
          <>
            <IconButton onClick={() => setIsEditing(true)}><EditIcon /></IconButton>
            <IconButton onClick={e => setAnchorEl(e.currentTarget)}><MoreVertIcon /></IconButton>
            <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
              <MenuItem onClick={() => setClasses(prev => prev.filter(c => c.id !== classItem.id))}>
                Delete Class
              </MenuItem>
            </Menu>
          </>
        }
      />

      <CardContent>
        <Typography variant="body2">Add Image Samples:</Typography>
        <Button
          variant="outlined"
          startIcon={<CameraAltIcon />}
          onClick={() => setIsWebcamOpen(true)}
          sx={{ mr: 1, mt: 1 }}
        >
          Webcam
        </Button>
        <Button
          variant="outlined"
          startIcon={<UploadIcon />}
          onClick={() => fileInputRef.current?.click()}
          sx={{ mt: 1 }}
        >
          Upload
        </Button>
        <input
          type="file"
          accept="image/*"
          multiple
          ref={fileInputRef}
          style={{ display: 'none' }}
          onChange={handleUpload}
        />
        {classItem.images.length > 0 && (
          <Box sx={{
            mt: 2,
            display: 'flex',
            overflowX: 'auto',
            gap: 1,
            p: 1,
            bgcolor: '#fafafa',
            borderRadius: 1
          }}>
            {classItem.images.map((src, idx) => (
              <Box key={idx} sx={{ position: 'relative' }}>
                <img
                  src={src}
                  alt={`Class ${classItem.id} img ${idx + 1}`}
                  style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 4 }}
                />
                <IconButton
                  size="small"
                  sx={{
                    position: 'absolute',
                    top: 2,
                    right: 2,
                    bgcolor: 'rgba(255,255,255,0.8)'
                  }}
                  onClick={() => removeImageFromClass(classItem.id, idx)}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Box>
            ))}
          </Box>
        )}
      </CardContent>

      {isWebcamOpen && (
        <WebcamModal
          classId={classItem.id}
          addImageToClass={addImageToClass}
          onClose={() => setIsWebcamOpen(false)}
        />
      )}
    </Card>
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
}

const TrainingCard: React.FC<TrainingCardProps> = ({ classes, truncatedNet, headModelRef }) => {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [epochs, setEpochs] = useState(50);
  const [batchSize, setBatchSize] = useState(16);
  const [learningRate, setLearningRate] = useState(0.001);
  const [isTraining, setIsTraining] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentEpoch, setCurrentEpoch] = useState(0);
  const [trainAcc, setTrainAcc] = useState(0);
  const [valAcc, setValAcc] = useState(0);

  const trainModel = async () => {
    if (!truncatedNet || classes.length === 0) return;
    setIsTraining(true);
    setProgress(0);

    const numClasses = classes.length;
    headModelRef.current = createHeadModel(numClasses, learningRate);

    const embeddings: tf.Tensor<tf.Rank>[] = [];
    const labels: number[] = [];
    for (let ci = 0; ci < numClasses; ci++) {
      for (const src of classes[ci].images) {
        const img = new Image();
        img.src = src;
        //await new Promise<void>(res => { img.onload = res; });
        await new Promise<void>(res => { 
        img.onload = () => res();  // Wrap res() in a function that ignores the event parameter
      });
        const embed = tf.tidy(() => {
          // Start with 3D tensor from pixels [height, width, channels]
          let t = tf.browser.fromPixels(img).toFloat().div(255);
          
          // Explicitly type as Tensor3D for resizeBilinear
          t = tf.image.resizeBilinear(t as tf.Tensor3D, [224, 224]);
          
          // Add batch dimension to make 4D [1, height, width, channels]
          t = t.expandDims(0);
          
          // Rest of your augmentation pipeline
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
          }
        }
      ]
    });

    embeddings.forEach(e => e.dispose());
    xs.dispose();
    ys.dispose();

    setProgress(100);
    setTimeout(() => setIsTraining(false), 500);
  };

  return (
    <Card sx={{ minWidth: 200 }}>
      <CardHeader title="Training" />
      <CardContent>
        <Button
          variant="contained"
          fullWidth
          disabled={!truncatedNet || isTraining}
          onClick={trainModel}
        >
          {isTraining ? 'Training...' : 'Train Model'}
        </Button>
        {isTraining && (
          <>
            <LinearProgress variant="determinate" value={progress} sx={{ mt: 1 }} />
            <Typography variant="body2" sx={{ mt: 1, textAlign: 'center' }}>
              Epoch {currentEpoch} / {epochs} — Train: {(trainAcc * 100).toFixed(1)}% | Val: {(valAcc * 100).toFixed(1)}%
            </Typography>
          </>
        )}
        <Button
          variant="outlined"
          fullWidth
          endIcon={advancedOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          onClick={() => setAdvancedOpen(o => !o)}
          sx={{ mt: 1, justifyContent: 'space-between' }}
        >
          Advanced
        </Button>
        <Collapse in={advancedOpen}>
          <Box sx={{ mt: 2, p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <Typography sx={{ width: 90 }}>Epochs:</Typography>
              <TextField
                type="number"
                value={epochs}
                onChange={e => setEpochs(+e.target.value)}
                size="small"
                sx={{ width: '10ch', mr: 1 }}
              />
              <Tooltip title="How many times to iterate over the full training data.">
                <IconButton size="small"><HelpOutlineIcon fontSize="small" /></IconButton>
              </Tooltip>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <Typography sx={{ width: 90 }}>Batch Size:</Typography>
              <TextField
                select
                value={batchSize}
                onChange={e => setBatchSize(+e.target.value)}
                size="small"
                sx={{ width: '11ch', mr: 1 }}
              >
                {[8, 16, 32, 64].map(n => (
                  <MenuItem key={n} value={n}>{n}</MenuItem>
                ))}
              </TextField>
              <Tooltip title="Number of samples processed before updating the model.">
                <IconButton size="small"><HelpOutlineIcon fontSize="small" /></IconButton>
              </Tooltip>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Typography sx={{ width: 90 }}>Learning Rate:</Typography>
              <TextField
                type="number"
                value={learningRate}
                onChange={e => setLearningRate(+e.target.value)}
                size="small"
                sx={{ width: '19ch', mr: 1 }}
                inputProps={{ step: 0.0001 }}
              />
              <Tooltip title="How quickly the model updates its weights.">
                <IconButton size="small"><HelpOutlineIcon fontSize="small" /></IconButton>
              </Tooltip>
            </Box>
          </Box>
        </Collapse>
      </CardContent>
    </Card>
  );
};

interface PreviewCardProps {
  classes: ClassItem[];
  truncatedNet: tf.LayersModel;
  headModelRef: MutableRefObject<tf.LayersModel | null>;
}

const PreviewCard: React.FC<PreviewCardProps> = ({ classes, truncatedNet, headModelRef }) => {
  const [inputOn, setInputOn] = useState(false);
  const [source, setSource] = useState<'Webcam' | 'File'>('Webcam');
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [results, setResults] = useState<{ label: string; confidence: number; }[]>([]);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const intervalRef = useRef<number | null>(null);

  const runPredict = async () => {
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
      const img = new Image(); img.src = previewSrc;
      await new Promise<void>(res => { 
        img.onload = () => res();  // Wrap res() in a function that ignores the event parameter
      });
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
  };

  useEffect(() => {
    if (intervalRef.current !== null) clearInterval(intervalRef.current);
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
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
        .catch(err => console.error('webcam error:', err));
      intervalRef.current = window.setInterval(runPredict, 1000);
    }
    if (source === 'File' && inputOn && previewSrc) {
      runPredict();
    }

    return () => {
      if (intervalRef.current !== null) clearInterval(intervalRef.current);
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      }
    };
  }, [previewSrc, source, inputOn, truncatedNet, headModelRef, classes]);

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

  return (
    <Card sx={{ minWidth: 200 }}>
      <CardHeader title="Preview" />
      <CardContent>
        <Button
          variant="outlined"
          fullWidth
          sx={{ mb: 2 }}
          onClick={() => alert('Download Model (not yet implemented)')}
        >
          Download Model
        </Button>

        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 1 }}>
          <Typography>Input</Typography>
          <Switch checked={inputOn} onChange={e => setInputOn(e.target.checked)} />
          <Typography>{inputOn ? 'ON' : 'OFF'}</Typography>
        </Box>

        {inputOn && (
          <>
            <TextField
              select
              value={source}
              onChange={e => setSource(e.target.value as 'Webcam' | 'File')}
              size="small"
              fullWidth
              sx={{ mb: 2 }}
            >
              <MenuItem value="Webcam">Webcam</MenuItem>
              <MenuItem value="File">File</MenuItem>
            </TextField>

            {source === 'Webcam' && (
              <Box sx={{ mb: 2 }}>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  style={{ width: '100%', borderRadius: 8 }}
                />
              </Box>
            )}

            {source === 'File' && (
              <Box sx={{ mb: 2, textAlign: 'center' }}>
                <Button variant="outlined" onClick={() => fileRef.current?.click()}>
                  Upload Image
                </Button>
                <input
                  type="file"
                  accept="image/*"
                  ref={fileRef}
                  style={{ display: 'none' }}
                  onChange={handleUpload}
                />
                {previewSrc && (
                  <Box
                    component="img"
                    src={previewSrc}
                    sx={{ mt: 1, width: 200, height: 'auto', borderRadius: 1 }}
                  />
                )}
              </Box>
            )}

            {results.map((res, i) => (
              <Box key={i} sx={{ mb: 1 }}>
                <Typography>{res.label}: {(res.confidence * 100).toFixed(1)}%</Typography>
                <LinearProgress variant="determinate" value={res.confidence * 100} />
              </Box>
            ))}
          </>
        )}
      </CardContent>
    </Card>
  );
};

interface ClassInputSectionProps {
  classes: ClassItem[];
  setClasses: React.Dispatch<React.SetStateAction<ClassItem[]>>;
  addImageToClass: (classId: number, image: string) => void;
  removeImageFromClass: (classId: number, index: number) => void;
}

const ClassInputSection: React.FC<ClassInputSectionProps> = ({ classes, setClasses, addImageToClass, removeImageFromClass }) => (
  <Box sx={{
    flex: 1,
    maxHeight: '75vh',
    overflowY: 'auto',
    pr: 1
  }}>
    {classes.map(c => (
      <ClassCard
        key={c.id}
        classItem={c}
        setClasses={setClasses}
        addImageToClass={addImageToClass}
        removeImageFromClass={removeImageFromClass}
      />
    ))}
    <Button variant="contained" onClick={() => {
      const newId = classes.length ? classes[classes.length - 1].id + 1 : 1;
      setClasses([...classes, { id: newId, name: `Class ${newId}`, images: [] }]);
    }} fullWidth sx={{ mt: 2 }}>
      Add Class
    </Button>
  </Box>
);

const ImageClassificationModel: React.FC = () => {
  const [classes, setClasses] = useState<ClassItem[]>([
    { id: 1, name: 'Class 1', images: [] },
    { id: 2, name: 'Class 2', images: [] }
  ]);
  const [truncatedNet, setTruncatedNet] = useState<tf.LayersModel | null>(null);
  const headModelRef = useRef<tf.LayersModel | null>(null);

  useEffect(() => {
    (async () => {
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
    return <Box sx={{ p: 2, textAlign: 'center' }}><CircularProgress /></Box>;
  }

  return (
    <Box sx={{ p: 2 }}>
      <Box display="flex" gap={2} flexDirection={{ xs: 'column', md: 'row' }}>
        <ClassInputSection
          classes={classes}
          setClasses={setClasses}
          addImageToClass={addImageToClass}
          removeImageFromClass={removeImageFromClass}
        />
        <Box display="flex" alignItems="center" flex={1}>
          <TrainingCard classes={classes} truncatedNet={truncatedNet} headModelRef={headModelRef} />
          <ArrowForwardIcon sx={{ mx: 2, color: '#4285f4' }} />
          <PreviewCard classes={classes} truncatedNet={truncatedNet} headModelRef={headModelRef} />
        </Box>
      </Box>
    </Box>
  );
};

export default ImageClassificationModel;
