import React, { useState, useRef, useEffect } from 'react';
import axios, { AxiosError } from 'axios';
import './AudioModel.css';
import { motion } from 'framer-motion';
import { AlertCircle, ChevronDown, ChevronRight, FileInput, Mic, Settings, Wand2, Upload, X, Check } from 'lucide-react';
declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

interface Sample {
  id: string;
  url: string;
  timestamp: string;
}

interface ClassType {
  id: string;
  name: string;
  samples: Sample[];
}

interface MediaRecorderRef {
  audioContext?: AudioContext;
  processor?: ScriptProcessorNode;
  source?: MediaStreamAudioSourceNode;
  stream?: MediaStream;
  stop?: () => void;
}

interface Predictions {
  [className: string]: number;
}

const AudioClassificationProject: React.FC = () => {
  // Constants
  const MIN_SAMPLES_FOR_TRAINING = 5;
  const MIN_RECORDING_TIME = 1;

  // State initialization
  const [classes, setClasses] = useState<ClassType[]>([
    { id: 'class_1', name: 'Class 1', samples: [] },
    { id: 'class_2', name: 'Class 2', samples: [] }
  ]);
  const [newClassName, setNewClassName] = useState<string>('');
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isRecordingForPrediction, setIsRecordingForPrediction] = useState<boolean>(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string>('');
  const [predictionAudioBlob, setPredictionAudioBlob] = useState<Blob | null>(null);
  const [predictionAudioUrl, setPredictionAudioUrl] = useState<string>('');
  const [selectedClassId, setSelectedClassId] = useState<string>('class_1');
  const [isTraining, setIsTraining] = useState<boolean>(false);
  const [modelStatus, setModelStatus] = useState<string>('No model trained');
  const [predictions, setPredictions] = useState<Predictions | null>(null);
  const [isPredicting, setIsPredicting] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  //const [isLoading, setIsLoading] = useState<boolean>(true);
  const [recordingTime, setRecordingTime] = useState<number>(0);
  const [filesProcessing, setFilesProcessing] = useState<number>(0);
  const [expandedClass, setExpandedClass] = useState<string>('class_1');

  // Refs
  const mediaRecorderRef = useRef<MediaRecorderRef | null>(null);
  //const chunksRef = useRef<Blob[]>([]);
  const audioPlayerRef = useRef<HTMLAudioElement>(null);
  const predictionAudioPlayerRef = useRef<HTMLAudioElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const predictionFileInputRef = useRef<HTMLInputElement>(null);

  // Class selection handler
  const handleClassSelect = (classId: string) => {
    if (expandedClass === classId) return;
    setExpandedClass(classId);
    setSelectedClassId(classId);
    if (isRecording || isRecordingForPrediction) stopRecording();
    audioPlayerRef.current?.pause();
    predictionAudioPlayerRef.current?.pause();
    setAudioBlob(null);
    setAudioUrl('');
  };

  // Audio Processing Functions
  const createWavHeader = (dataLength: number, sampleRate: number, numChannels: number): Uint8Array => {
    const bytesPerSample = 2;
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = dataLength * bytesPerSample;
    
    const buffer = new ArrayBuffer(44);
    const view = new DataView(buffer);
    
    const writeString = (view: DataView, offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 16, true);
    writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);
    
    return new Uint8Array(buffer);
  };

  // File Upload Handler with Multi-File Support
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, forPrediction = false) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    try {
      setErrorMessage('');
      setFilesProcessing(files.length);
      setStatusMessage(`Processing ${files.length} file(s)...`);

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setStatusMessage(`Processing file ${i + 1} of ${files.length}: ${file.name}`);

        const arrayBuffer = await file.arrayBuffer();
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
        const sampleRate = 16000;
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        
        const processor = audioContext.createScriptProcessor(4096, 1, 1);
        const audioData: Float32Array[] = [];
        
        source.connect(processor);
        processor.connect(audioContext.destination);
        
        processor.onaudioprocess = (e: AudioProcessingEvent) => {
          const inputData = e.inputBuffer.getChannelData(0);
          audioData.push(new Float32Array(inputData));
        };
        
        source.start(0);
        
        await new Promise<boolean>((resolve) => {
          source.onended = () => {
            processor.disconnect();
            source.disconnect();
            
            const completeAudioData = audioData.flatMap(chunk => Array.from(chunk));
            const pcmData = new Int16Array(completeAudioData.length);
            
            for(let i = 0; i < completeAudioData.length; i++) {
              const s = Math.max(-1, Math.min(1, completeAudioData[i]));
              pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            }
            
            const wavHeader = createWavHeader(pcmData.length, sampleRate, 1);
            const wavBlob = new Blob([wavHeader, pcmData], { type: 'audio/wav' });
            const url = URL.createObjectURL(wavBlob);
            
            if (forPrediction && i === files.length - 1) {
              setPredictionAudioBlob(wavBlob);
              setPredictionAudioUrl(url);
            } else if (!forPrediction) {
              setAudioBlob(wavBlob);
              setAudioUrl(url);
              setRecordingTime(Math.floor(audioBuffer.duration));
              saveSample(wavBlob);
            }
            
            audioContext.close();
            resolve(true);
          };
          
          setTimeout(() => {
            source.stop();
            resolve(true);
          }, audioBuffer.duration * 1000 + 1000);
        });

        setFilesProcessing(prev => prev - 1);
      }

      setStatusMessage(`Successfully processed ${files.length} file(s)`);
    } catch (err: unknown) {
        console.error('File conversion error:', err);
        // Narrow the error to an instance of Error before accessing .message
        if (err instanceof Error) {
            setErrorMessage(`File processing error: ${err.message}`);
        } else {
            setErrorMessage('File processing error: Unknown error');
        }
        setStatusMessage('');
    } finally {
      setFilesProcessing(0);
      if (e.target) e.target.value = '';
    }
  };

  // Recording Functions
  const startRecording = async (forPrediction = false) => {
    try {
      setErrorMessage('');
      setStatusMessage('Starting recording...');
      setRecordingTime(0);
      
      const constraints: MediaStreamConstraints = {
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          sampleSize: 16,
          echoCancellation: false
        }
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      const audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 16000
      });
      
      const source = audioContext.createMediaStreamSource(stream);
      const gainNode = audioContext.createGain();
      gainNode.gain.value = 2.0; // Boost input volume by 2x
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      source.connect(gainNode);
      source.connect(processor);
      processor.connect(audioContext.destination);
      
      const audioData: Float32Array[] = [];
      
      processor.onaudioprocess = (e: AudioProcessingEvent) => {
        const inputData = e.inputBuffer.getChannelData(0);
        audioData.push(new Float32Array(inputData));
      };
      
      mediaRecorderRef.current = {
        audioContext,
        processor,
        source,
        stream,
        stop: () => {
          processor.disconnect();
          source.disconnect();
          audioContext.close();
          stream.getTracks().forEach(track => track.stop());
          
          const sampleRate = 16000;
          const completeAudioData = audioData.flatMap(chunk => Array.from(chunk));
          const pcmData = new Int16Array(completeAudioData.length);
          
          for(let i = 0; i < completeAudioData.length; i++) {
            const s = Math.max(-1, Math.min(1, completeAudioData[i]));
            pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
          }
          
          const wavHeader = createWavHeader(pcmData.length, sampleRate, 1);
          const wavBlob = new Blob([wavHeader, pcmData], { type: 'audio/wav' });
          const url = URL.createObjectURL(wavBlob);
          
          if (forPrediction) {
            setPredictionAudioBlob(wavBlob);
            setPredictionAudioUrl(url);
          } else {
            setAudioBlob(wavBlob);
            setAudioUrl(url);
          }
          setStatusMessage('Recording complete. Ready to save or predict.');
        }
      };
      
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
      if (forPrediction) {
        setIsRecordingForPrediction(true);
      } else {
        setIsRecording(true);
      }
      setStatusMessage('Recording in progress...');
    }catch (err: unknown) {
    console.error('Recording error:', err);
    if (err instanceof Error) {
      setErrorMessage(`Recording failed: ${err.message}`);
    } else {
      setErrorMessage('Recording failed: Unknown error');
    }
    setStatusMessage('');
    clearInterval(timerRef.current as NodeJS.Timeout);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && (isRecording || isRecordingForPrediction)) {
      mediaRecorderRef.current.stop?.();
      setIsRecording(false);
      setIsRecordingForPrediction(false);
      clearInterval(timerRef.current as NodeJS.Timeout);
    }
  };

  // Class Management
  const addClass = async () => {
    const className = newClassName.trim();
    if (!className) {
      setErrorMessage('Class name cannot be empty');
      return;
    }

    if (classes.some(c => c.name.toLowerCase() === className.toLowerCase())) {
      setErrorMessage('Class already exists');
      return;
    }

    try {
      setStatusMessage('Adding new class...');
      setErrorMessage('');
      
      const response = await axios.post<{ _id: string }>('/api/audio/classes', { name: className });
      
      setClasses(prev => [
        ...prev,
        { 
          id: response.data._id || `class_${Date.now()}`, 
          name: className, 
          samples: [] 
        }
      ]);
      
      setNewClassName('');
      setStatusMessage(`Class "${className}" added successfully`);
    } catch (err: unknown) {
        console.error('Add class error:', err);

        // default fallback
        let msg = 'Unknown error';

        // 1) If it's an AxiosError, narrow and cast its data
        if (axios.isAxiosError(err)) {
        // we know our backend returns { error: string } on failure
        const axiosErr = err as AxiosError<{ error?: string }>;
        msg = axiosErr.response?.data?.error ?? axiosErr.message;
        }
        // 2) If it's a plain Error, use its message
        else if (err instanceof Error) {
        msg = err.message;
        }

        setErrorMessage(`Failed to add class: ${msg}`);
        setStatusMessage('');
    }
  };

  // Sample Management
  const saveSample = async (blob: Blob | null = null): Promise<boolean> => {
  const sampleBlob = blob || audioBlob;
  if (!sampleBlob || !selectedClassId) {
    if (!blob) setErrorMessage('No audio selected');
    return false;
  }
    const selectedClass = classes.find(c => c.id === selectedClassId);
    if (!selectedClass) {
        setErrorMessage('Invalid class selected');
        return false;
    }
  try {
    setStatusMessage('Saving sample...');

    if (recordingTime < MIN_RECORDING_TIME && !blob) {
      throw new Error(`Recording too short (minimum ${MIN_RECORDING_TIME} seconds)`);
    }

    const formData = new FormData();
    formData.append('audio', sampleBlob, `${selectedClass.name}_${Date.now()}.wav`);
    formData.append('class', selectedClass.name);

    const response = await axios.post<{ _id: string; timestamp: string }>('/api/audio/samples', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });


     const newSample: Sample = {
      id: response.data._id,
      url: `/api/audio/samples/${response.data._id}/play`,
      timestamp: response.data.timestamp
    };

       setClasses(prev =>
      prev.map(cls =>
        cls.id === selectedClassId
          ? { ...cls, samples: [...cls.samples, newSample] }
          : cls
      )
    );

    if (!blob) {
      setAudioBlob(null);
      setAudioUrl('');
    }

    setStatusMessage('Sample saved successfully!');
    return true;

  } catch (err: unknown) {
    console.error('Save error:', err);

    // default message
    let msg = 'Unknown error';

    if (axios.isAxiosError(err)) {
      // Tell TS that our error‐response body may have an "error" string
      const axiosErr = err as AxiosError<{ error?: string }>;
      msg = axiosErr.response?.data?.error ?? axiosErr.message;
    }
    else if (err instanceof Error) {
      msg = err.message;
    }

    setErrorMessage(`Save failed: ${msg}`);
    return false;
  }
};

  const deleteSample = async (sampleId: string) => {
    try {
      setStatusMessage('Deleting sample...');
      await axios.delete(`/api/audio/samples/${sampleId}`);
      
      setClasses(prev => 
        prev.map(cls => ({
          ...cls,
          samples: cls.samples.filter(s => s.id !== sampleId)
        }))
      );
      
      setStatusMessage('Sample deleted successfully');
    } catch (err: unknown) {
      const error = err as AxiosError;
      console.error('Delete error:', error);
      setErrorMessage(`Failed to delete sample: ${error.message}`);
      setStatusMessage('');
    }
  };

  // Model Operations
const trainModel = async () => {
    const totalSamples = classes.reduce((sum, cls) => sum + cls.samples.length, 0);
    if (totalSamples < MIN_SAMPLES_FOR_TRAINING) {
        setErrorMessage(`Need at least ${MIN_SAMPLES_FOR_TRAINING} samples total to train`);
        return;
    }

    try {
        setIsTraining(true);
        setModelStatus('Training started...');
        setErrorMessage('');
        setStatusMessage('Training in progress. This may take several minutes...');

        const response = await axios.post<{ accuracy: number }>('/api/audio/train');

        setModelStatus(
        `Training complete! Accuracy: ${(response.data.accuracy * 100).toFixed(1)}%`
        );
        setStatusMessage('Model is ready for predictions');
    } catch (err: unknown) {
        console.error('Training error:', err);

        // Default fallback message
        let msg = 'Unknown error';

        if (axios.isAxiosError(err)) {
        // Tell TS that our error‐response body may have an "error" string
        const axiosErr = err as AxiosError<{ error?: string }>;
        msg = axiosErr.response?.data?.error ?? axiosErr.message;
        } else if (err instanceof Error) {
        msg = err.message;
        }

        setErrorMessage(`Training failed: ${msg}`);
        setModelStatus('Training failed');
        setStatusMessage('');
    } finally {
        setIsTraining(false);
    }
    };

    
  const predict = async () => {
  const blobToUse = predictionAudioBlob || audioBlob;
  if (!blobToUse) {
    setErrorMessage('Please record or select audio first');
    return;
  }

  try {
    setIsPredicting(true);
    setStatusMessage('Analyzing audio...');
    setPredictions(null);

    const formData = new FormData();
    formData.append('audio', blobToUse, 'prediction.wav');

    const response = await axios.post<Predictions>('/api/audio/predict', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });

    setPredictions(response.data);
    setStatusMessage('Prediction complete!');
  } catch (err: unknown) {
    console.error('Prediction error:', err);

    // Default fallback message
    let msg = 'Unknown error';

    if (axios.isAxiosError(err)) {
      // Tell TS our error-response body may have { error?: string }
      const axiosErr = err as AxiosError<{ error?: string }>;
      msg = axiosErr.response?.data?.error ?? axiosErr.message;
    }
    else if (err instanceof Error) {
      msg = err.message;
    }

    setErrorMessage(`Prediction failed: ${msg}`);
  } finally {
    setIsPredicting(false);
  }
};

  // Cleanup
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current?.stream) {
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
      clearInterval(timerRef.current as NodeJS.Timeout);
    };
  }, []);

  // UI Components

const renderStatusMessages = () => (
  <>
    {errorMessage && (
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-red-900/50 border border-red-500/50 text-red-100"
      >
        <AlertCircle size={18} />
        <span className="flex-1">{errorMessage}</span>
        <button 
          onClick={() => setErrorMessage('')}
          className="text-white/50 hover:text-white"
        >
          <X size={18} />
        </button>
      </motion.div>
    )}
    
    {statusMessage && (
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-blue-900/50 border border-blue-500/50 text-blue-100"
      >
        {(isTraining || isPredicting || filesProcessing > 0) && (
          <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
        )}
        <span className="flex-1">{statusMessage}</span>
        {filesProcessing > 0 && (
          <span className="text-sm text-white/70">
            {filesProcessing} file(s) remaining
          </span>
        )}
      </motion.div>
    )}
  </>
);

const renderClassItem = (cls: ClassType) => (
  <motion.div
    key={cls.id}
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    className={`bg-white/5 rounded-xl border border-white/10 overflow-hidden mb-3 transition-all duration-300 ${
      expandedClass === cls.id ? 'ring-2 ring-blue-500/30' : ''
    }`}
    onClick={() => handleClassSelect(cls.id)}
  >
    <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/5 transition-colors">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-blue-900/30 flex items-center justify-center">
          <Mic size={16} />
        </div>
        <h3 className="font-medium">{cls.name}</h3>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm text-white/50">{cls.samples.length} samples</span>
        {expandedClass === cls.id ? (
          <ChevronDown size={18} className="text-white/50" />
        ) : (
          <ChevronRight size={18} className="text-white/50" />
        )}
      </div>
    </div>
    
    {expandedClass === cls.id && (
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: 'auto', opacity: 1 }}
        className="px-4 pb-4 space-y-4"
      >
        <div className="flex gap-3">
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={(e) => {
              e.stopPropagation();
              if (isRecording) {
                stopRecording();
              } else {
                startRecording();
              }
            }}
            className={`flex-1 py-2.5 rounded-lg flex items-center justify-center gap-2 ${
              isRecording 
                ? 'bg-red-500/20 text-red-400 border border-red-500/30' 
                : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
            }`}
          >
            <Mic size={16} />
            {isRecording ? `Stop (${recordingTime}s)` : 'Record Sample'}
            {isRecording && (
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            )}
          </motion.button>

          <label className="flex-1 py-2.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors flex items-center justify-center gap-2 cursor-pointer">
            <Upload size={16} />
            Upload Audio
            <input
              type="file"
              ref={fileInputRef}
              accept="audio/*"
              multiple
              onChange={(e) => {
                handleFileUpload(e);
                e.target.value = '';
              }}
              className="hidden"
            />
          </label>
        </div>
        
        {audioUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-3"
          >
            <audio 
              ref={audioPlayerRef} 
              src={audioUrl} 
              controls 
              className="w-full rounded-lg"
            />
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={(e) => {
                e.stopPropagation();
                saveSample();
              }}
              className="w-full py-2.5 rounded-lg bg-gradient-to-r from-cyan-400 to-blue-500 text-space-black font-medium"
            >
              Save Sample
            </motion.button>
          </motion.div>
        )}
        
        <div className="border-t border-white/10 pt-3">
          <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
            <FileInput size={16} />
            <span>Samples</span>
          </h4>
          
          {cls.samples.length > 0 ? (
            <div className="space-y-2">
              {cls.samples.map((sample, idx) => (
                <motion.div
                  key={sample.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="bg-white/5 rounded-lg p-3 border border-white/10"
                >
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm">Sample {idx + 1}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteSample(sample.id);
                      }}
                      className="text-red-400 hover:text-red-300 p-1"
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <audio src={sample.url} controls className="w-full" />
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4 text-white/50 text-sm">
              No samples yet. Record or upload audio to get started.
            </div>
          )}
        </div>
      </motion.div>
    )}
  </motion.div>
);

const renderPredictionResults = () => {
  if (isPredicting) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col items-center justify-center py-8"
      >
        <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-white/70">Analyzing audio...</p>
      </motion.div>
    );
  }
  
  if (predictions) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="space-y-4"
      >
        <h3 className="font-medium">Results:</h3>
        {Object.entries(predictions)
          .sort(([, a], [, b]) => b - a)
          .map(([className, confidence]) => {
            const confidencePercent = (confidence * 100).toFixed(1);
            const isConfident = confidence > 0.7;
            
            return (
              <div key={className} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{className}</span>
                  <span className={`flex items-center gap-1 ${
                    isConfident ? 'text-green-400' : 'text-white/70'
                  }`}>
                    {confidencePercent}%
                    {isConfident && (
                      <Check size={14} className="text-green-400" />
                    )}
                  </span>
                </div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${
                      isConfident ? 'bg-gradient-to-r from-green-400 to-cyan-400' : 'bg-blue-400'
                    }`}
                    style={{ width: `${confidencePercent}%` }}
                  />
                </div>
              </div>
            );
          })}
      </motion.div>
    );
  }
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-4 text-sm text-white/70"
    >
      <p>Record audio or upload a file to test predictions</p>
      <div className="bg-white/5 rounded-lg p-4 border border-white/10">
        <p className="font-medium mb-2">For best results:</p>
        <ul className="space-y-1 list-disc list-inside">
          <li>Use clear audio samples</li>
          <li>Minimum 1 second duration</li>
          <li>Supported formats: MP3, WAV, OGG, AAC</li>
        </ul>
      </div>
    </motion.div>
  );
};

return (
  <section className="min-h-screen bg-space-black text-white p-6 relative">
    <div className="absolute inset-0 grid-pattern opacity-10"></div>
    
    <div className="max-w-7xl mx-auto relative z-10 pt-6">
      {renderStatusMessages()}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Classes Panel */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-white/5 backdrop-blur-lg rounded-2xl shadow-lg border border-white/10 overflow-hidden"
        >
          <div className="p-5 border-b border-white/10 flex items-center justify-between">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Mic size={20} />
              <span>Classes</span>
            </h2>
            <div className="text-white/30">{classes.length}</div>
          </div>
          
          <div className="p-5 space-y-4">
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
              {classes.map(renderClassItem)}
            </div>
            
            <div className="flex gap-2 mt-4">
              <input
                type="text"
                value={newClassName}
                onChange={(e) => setNewClassName(e.target.value)}
                placeholder="New class name"
                onKeyPress={(e) => e.key === 'Enter' && addClass()}
                className="flex-1 p-2.5 rounded-lg bg-white/5 border border-white/10 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={addClass}
                disabled={!newClassName.trim()}
                className="px-4 py-2.5 rounded-lg bg-gradient-to-r from-purple-500 to-blue-500 disabled:opacity-50 disabled:pointer-events-none"
              >
                Add
              </motion.button>
            </div>
          </div>
        </motion.div>
        
        {/* Training Panel */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-white/5 backdrop-blur-lg rounded-2xl shadow-lg border border-white/10 overflow-hidden"
        >
          <div className="p-5 border-b border-white/10 flex items-center justify-between">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Settings size={20} />
              <span>Model Training</span>
            </h2>
            <div className="text-white/30">
              {classes.reduce((sum, cls) => sum + cls.samples.length, 0)} samples
            </div>
          </div>
          
          <div className="p-5 space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-blue-900/10 p-3 rounded-lg border border-blue-500/20">
                <div className="text-2xl font-bold mb-1">
                  {classes.reduce((sum, cls) => sum + cls.samples.length, 0)}
                </div>
                <div className="text-xs text-white/70">Total Samples</div>
              </div>
              <div className="bg-purple-900/10 p-3 rounded-lg border border-purple-500/20">
                <div className="text-2xl font-bold mb-1">
                  {classes.length}
                </div>
                <div className="text-xs text-white/70">Classes</div>
              </div>
            </div>
            
            <div>
              <h3 className="text-sm font-medium mb-2">Status:</h3>
              <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                {modelStatus}
              </div>
            </div>
            
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={trainModel}
              disabled={isTraining || classes.reduce((sum, cls) => sum + cls.samples.length, 0) < MIN_SAMPLES_FOR_TRAINING}
              className={`w-full py-3 rounded-lg flex items-center justify-center gap-2 ${
                isTraining
                  ? 'bg-blue-500/20'
                  : 'bg-gradient-to-r from-cyan-400 to-blue-500 text-space-black font-bold'
              }`}
            >
              {isTraining ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Training...
                </>
              ) : (
                <>
                  <Wand2 size={18} />
                  Train Model
                </>
              )}
            </motion.button>
            
            <div className="bg-white/5 rounded-lg p-4 border border-white/10">
              <h3 className="text-sm font-medium mb-2">Requirements:</h3>
              <ul className="text-sm space-y-1 list-disc list-inside text-white/70">
                <li>At least 2 classes</li>
                <li>Minimum {MIN_SAMPLES_FOR_TRAINING} samples total</li>
                <li>At least 2 samples per class</li>
              </ul>
            </div>
          </div>
        </motion.div>
        
        {/* Prediction Panel */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="bg-white/5 backdrop-blur-lg rounded-2xl shadow-lg border border-white/10 overflow-hidden"
        >
          <div className="p-5 border-b border-white/10">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Wand2 size={20} />
              <span>Predictions</span>
            </h2>
          </div>
          
          <div className="p-5 space-y-5">
            <div>
              <h3 className="text-sm font-medium mb-3">Audio Input</h3>
              <div className="flex gap-3">
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => {
                    if (isRecordingForPrediction) {
                      stopRecording();
                    } else {
                      startRecording(true);
                    }
                  }}
                  className={`flex-1 py-2.5 rounded-lg flex items-center justify-center gap-2 ${
                    isRecordingForPrediction 
                      ? 'bg-red-500/20 text-red-400 border border-red-500/30' 
                      : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                  }`}
                >
                  <Mic size={16} />
                  {isRecordingForPrediction ? `Stop (${recordingTime}s)` : 'Record'}
                  {isRecordingForPrediction && (
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  )}
                </motion.button>

                <label className="flex-1 py-2.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors flex items-center justify-center gap-2 cursor-pointer">
                  <Upload size={16} />
                  Upload
                  <input
                    type="file"
                    ref={predictionFileInputRef}
                    accept="audio/*"
                    multiple
                    onChange={(e) => {
                      handleFileUpload(e, true);
                      e.target.value = '';
                    }}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
            
            {predictionAudioUrl && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-3"
              >
                <audio 
                  ref={predictionAudioPlayerRef}
                  src={predictionAudioUrl} 
                  controls 
                  className="w-full rounded-lg"
                />
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={predict}
                  disabled={isPredicting}
                  className="w-full py-2.5 rounded-lg bg-gradient-to-r from-purple-500 to-blue-500 text-space-black font-medium flex items-center justify-center gap-2"
                >
                  {isPredicting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    'Predict'
                  )}
                </motion.button>
              </motion.div>
            )}
            
            <div className="text-xs text-white/50 text-center">
              Supports: MP3, WAV, OGG, AAC (converted automatically)
            </div>
            
            <div className="border-t border-white/10 pt-4">
              {renderPredictionResults()}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  </section>
);
};

export default AudioClassificationProject;