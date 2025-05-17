import React, { useState, useRef, useEffect } from 'react';
import axios, { AxiosError } from 'axios';
import './AudioModel.css';


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
        <div className="alert alert-error">
          {errorMessage}
          <button onClick={() => setErrorMessage('')} className="close-btn">×</button>
        </div>
      )}
      
      {statusMessage && (
        <div className="alert alert-info">
          {statusMessage}
          {(isTraining || isPredicting || filesProcessing > 0) && <div className="spinner"></div>}
          {filesProcessing > 0 && (
            <span className="files-processing">
              {filesProcessing} file(s) remaining
            </span>
          )}
        </div>
      )}
    </>
  );

  const renderClassItem = (cls: ClassType) => {return(
    <div 
      key={cls.id} 
      className={`class-item ${expandedClass === cls.id ? 'active' : ''}`}
      onClick={() => handleClassSelect(cls.id)}
    >
      <div className="class-header">
        <h3>{cls.name}</h3>
        <span className="sample-count">{cls.samples.length} samples</span>
        <span className="chevron">{expandedClass === cls.id ? '▼' : '▶'}</span>
      </div>
      
      {expandedClass === cls.id ? (
        <div className="class-controls">
          <div className="recording-controls">
            <button
              className={`record-btn ${isRecording ? 'recording' : ''}`}
               onClick={(e) => {
                e.stopPropagation();
                if (isRecording) {
                    stopRecording();
                } else {
                    startRecording();
                }
                }}
            >
              {isRecording ? `⏹ Stop (${recordingTime}s)` : '⏺ Record Sample'}
            </button>

            <label className="file-upload-btn">
              📁 Upload Audio
              <input
                type="file"
                ref={fileInputRef}
                accept="audio/*"
                multiple
                onChange={(e) => {
                  handleFileUpload(e);
                  e.target.value = '';
                }}
                hidden
              />
            </label>

            {isRecording ? (
              <div className="recording-indicator">
                <div className="pulse"></div>
                <span>Recording...</span>
              </div>
            ):null}
          </div>
          
          {audioUrl ? (
            <div className="recording-preview">
              <audio ref={audioPlayerRef} src={audioUrl} controls />
              <div className="preview-actions">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    saveSample();
                  }}
                  className="save-btn"
                >
                  Save Sample
                </button>
              </div>
            </div>
          ):null}
          
          <div className="samples-list">
            {cls.samples.length > 0 ? (
              cls.samples.map((sample, idx) => (
                <div key={sample.id} className="sample-item">
                  <div className="sample-header">
                    <span>Sample {idx + 1}</span>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteSample(sample.id);
                      }}
                      className="delete-btn"
                    >
                      Delete
                    </button>
                  </div>
                  <audio src={sample.url} controls />
                </div>
              ))
            ) : (
              <div className="no-samples">
                No samples yet. Record or upload audio to get started.
              </div>
            )}
          </div>
        </div>
      ):null}
    </div>
  );
  };

  const renderPredictionResults = () => {
    if (isPredicting) {
      return (
        <div className="prediction-loading">
          <div className="spinner"></div>
          <p>Analyzing audio...</p>
        </div>
      );
    }
    
    if (predictions) {
      return (
        <div className="prediction-results">
          <h3>Results:</h3>
          {Object.entries(predictions)
            .map(([className, confidence]) => {
              const confidencePercent = (confidence * 100).toFixed(1);
              const isConfident = confidence > 0.7;
              
              return (
                <div key={className} className={`prediction-item ${isConfident ? 'confident' : ''}`}>
                  <div className="prediction-class">
                    <span className="class-name">{className}</span>
                    <span className="confidence-value">
                      {confidencePercent}%
                      {isConfident && <span className="confidence-badge">✓</span>}
                    </span>
                  </div>
                  <div className="confidence-bar-container">
                    <div 
                      className="confidence-bar" 
                      style={{ width: `${confidencePercent}%` }}
                    />
                  </div>
                </div>
              );
            })}
        </div>
      );
    }
    
    return (
      <div className="prediction-placeholder">
        <p>Record audio or upload a file to test predictions</p>
        <div className="prediction-tips">
          <p>For best results:</p>
          <ul>
            <li>Use clear audio samples</li>
            <li>Minimum 1 second duration</li>
            <li>Supported formats: MP3, WAV, OGG, AAC</li>
          </ul>
        </div>
      </div>
    );
  };

  return (
    <div className="audio-model-container">
      {renderStatusMessages()}

      <div className="model-grid">
        {/* Classes Panel */}
        <div className="panel classes-panel">
          <div className="panel-header">
            <h2>Classes</h2>
            <div className="panel-icon">🎙️</div>
          </div>
          <div className="class-list">
            {classes.map(renderClassItem)}
          </div>
          
          <div className="add-class-form">
            <input
              type="text"
              value={newClassName}
              onChange={(e) => setNewClassName(e.target.value)}
              placeholder="New class name"
              onKeyPress={(e) => e.key === 'Enter' && addClass()}
            />
            <button 
              onClick={addClass}
              disabled={!newClassName.trim()}
              className="add-class-btn"
            >
              Add Class
            </button>
          </div>
        </div>
        
        {/* Training Panel */}
        <div className="panel training-panel">
          <div className="panel-header">
            <h2>Model Training</h2>
            <div className="panel-icon">⚙️</div>
          </div>
          
          <div className="training-info">
            <div className="stats">
              <div className="stat-item">
                <span className="stat-value">
                  {classes.reduce((sum, cls) => sum + cls.samples.length, 0)}
                </span>
                <span className="stat-label">Total Samples</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">
                  {classes.length}
                </span>
                <span className="stat-label">Classes</span>
              </div>
            </div>
            
            <div className="training-status">
              <h3>Status:</h3>
              <p>{modelStatus}</p>
            </div>
            
            <button
              onClick={trainModel}
              disabled={isTraining || classes.reduce((sum, cls) => sum + cls.samples.length, 0) < MIN_SAMPLES_FOR_TRAINING}
              className={`train-btn ${isTraining ? 'training' : ''}`}
            >
              {isTraining ? (
                <>
                  <div className="spinner"></div>
                  Training...
                </>
              ) : 'Train Model'}
            </button>
            
            <div className="requirements">
              <p>Minimum requirements:</p>
              <ul>
                <li>At least 2 classes</li>
                <li>Minimum {MIN_SAMPLES_FOR_TRAINING} samples total</li>
                <li>At least 2 samples per class</li>
              </ul>
            </div>
          </div>
        </div>
        
        {/* Prediction Panel */}
        <div className="panel prediction-panel">
          <div className="panel-header">
            <h2>Predictions</h2>
            <div className="panel-icon">🔮</div>
          </div>
          
          <div className="prediction-recording">
            <h3>Audio Input for Prediction</h3>
            <div className="input-options">
              <button
                className={`record-btn ${isRecordingForPrediction ? 'recording' : ''}`}
                onClick={() => {
                    if (isRecordingForPrediction) {
                    stopRecording();
                    } else {
                    startRecording(true);
                    }
                }}
              >
                {isRecordingForPrediction ? `⏹ Stop (${recordingTime}s)` : '⏺ Record'}
              </button>

              <label className="file-upload-btn">
                📁 Upload File
                <input
                  type="file"
                  ref={predictionFileInputRef}
                  accept="audio/*"
                  multiple
                  onChange={(e) => {
                    handleFileUpload(e, true);
                    e.target.value = '';
                  }}
                  hidden
                />
              </label>
            </div>
            
            {predictionAudioUrl ? (
              <div className="recording-preview">
                <audio 
                  ref={predictionAudioPlayerRef}
                  src={predictionAudioUrl} 
                  controls 
                />
                <button 
                  onClick={predict}
                  disabled={isPredicting}
                  className="predict-btn"
                >
                  {isPredicting ? (
                    <>
                      <div className="spinner"></div>
                      Analyzing...
                    </>
                  ) : 'Predict'}
                </button>
              </div>
            ):null}
            
            <div className="audio-format-note">
              Supports multiple files: MP3, WAV, OGG, AAC (converted automatically)
            </div>
          </div>

          {renderPredictionResults()}
        </div>
      </div>
    </div>
  );
};

export default AudioClassificationProject;