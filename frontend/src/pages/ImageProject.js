import React, { useState, useRef, useEffect } from 'react';
import Webcam from 'react-webcam';
import axios from 'axios';
import '../ImageProject.css';

const ImageProject = () => {
    // Constants
    const MIN_IMAGES_FOR_TRAINING = 5;
    const MAX_IMAGE_SIZE_MB = 5;

    // State initialization
    const [classes, setClasses] = useState([
        { id: 'class_1', name: 'Class 1', images: [] },
        { id: 'class_2', name: 'Class 2', images: [] }
    ]);
    const [newClassName, setNewClassName] = useState('');
    const [selectedClassId, setSelectedClassId] = useState('class_1');
    const [isTraining, setIsTraining] = useState(false);
    const [modelStatus, setModelStatus] = useState('No model trained');
    const [predictions, setPredictions] = useState(null);
    const [isPredicting, setIsPredicting] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [activeWebcam, setActiveWebcam] = useState(null);
    const [expandedClass, setExpandedClass] = useState('class_1');
// Add this to your state and refs section
const [predictionWebcamActive, setPredictionWebcamActive] = useState(false);

    // Refs
    const webcamRef = useRef(null);
    const predictionWebcamRef = useRef(null);
    const fileInputRef = useRef(null);
    const predictionFileInputRef = useRef(null);

    // Class management
    const addClass = () => {
        const className = newClassName.trim();
        if (!className) {
            setErrorMessage('Class name cannot be empty');
            return;
        }

        const newClass = {
            id: `class_${Date.now()}`,
            name: className,
            images: []
        };

        setClasses([...classes, newClass]);
        setNewClassName('');
        setStatusMessage(`Class "${className}" added successfully`);
    };

    // Image capture and handling
    const captureImage = (targetClassId) => {
        if (webcamRef.current) {
            const imageSrc = webcamRef.current.getScreenshot();
            addImageToClass(targetClassId, imageSrc);
        }
    };

    const handleFileUpload = (e, targetClassId) => {
        const files = Array.from(e.target.files);
        if (!files.length) return;

        files.forEach(file => {
            const reader = new FileReader();
            reader.onload = (event) => {
                addImageToClass(targetClassId, event.target.result);
            };
            reader.readAsDataURL(file);
        });
    };

    const addImageToClass = (classId, imageData) => {
        setClasses(prevClasses => 
            prevClasses.map(cls => 
                cls.id === classId 
                    ? { ...cls, images: [...cls.images, imageData] } 
                    : cls
            )
        );
        setStatusMessage('Image added successfully');
    };

    // Model operations
    const uploadImages = async () => {
        try {
            setStatusMessage('Uploading images...');
            setErrorMessage('');
            
            // Upload all images for all classes
            for (const cls of classes) {
                for (let i = 0; i < cls.images.length; i++) {
                    const formData = new FormData();
                    const imageFile = dataURLtoFile(cls.images[i], `${cls.name}_${i}.jpg`);
                    
                    formData.append('image', imageFile);
                    formData.append('class', cls.name);

                    await axios.post('http://127.0.0.1:5000/api/upload', formData, {
                        headers: { 'Content-Type': 'multipart/form-data' }
                    });
                }
            }
            
            setStatusMessage('All images uploaded successfully!');
        } catch (err) {
            console.error('Upload error:', err);
            setErrorMessage(`Upload failed: ${err.message}`);
            setStatusMessage('');
        }
    };

    const trainModel = async () => {
        const totalImages = classes.reduce((sum, cls) => sum + cls.images.length, 0);
        if (totalImages < MIN_IMAGES_FOR_TRAINING) {
            setErrorMessage(`Need at least ${MIN_IMAGES_FOR_TRAINING} images to train`);
            return;
        }

        try {
            setIsTraining(true);
            setModelStatus('Training started...');
            setErrorMessage('');
            setStatusMessage('Training in progress...');

            await axios.post('http://127.0.0.1:5000/api/train');
            checkTrainingStatus();
        } catch (err) {
            console.error('Training error:', err);
            setErrorMessage(`Training failed: ${err.message}`);
            setModelStatus('Training failed');
            setIsTraining(false);
        }
    };

    const checkTrainingStatus = async () => {
        try {
            const response = await axios.get('http://127.0.0.1:5000/api/training-status');
            
            if (response.data.status === 'completed') {
                setModelStatus('Training completed successfully!');
                setStatusMessage('Model is ready for predictions');
            } else if (response.data.status === 'failed') {
                setModelStatus(`Training failed: ${response.data.error}`);
                setStatusMessage('');
            } else if (response.data.status === 'in_progress') {
                setTimeout(checkTrainingStatus, 3000);
                return;
            }
        } catch (err) {
            console.error('Status check error:', err);
            setErrorMessage(`Status check failed: ${err.message}`);
        } finally {
            setIsTraining(false);
        }
    };

    const predictImage = async (imageSrc) => {
        try {
            setIsPredicting(true);
            setStatusMessage('Analyzing image...');
            setPredictions(null);

            const imageFile = dataURLtoFile(imageSrc, 'prediction.jpg');
            const formData = new FormData();
            formData.append('image', imageFile);

            const response = await axios.post('http://127.0.0.1:5000/api/predict', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            setPredictions({
                predicted_class: response.data.predicted_class,
                confidence: response.data.confidence
            });
            setStatusMessage('Prediction complete!');
        } catch (err) {
            console.error('Prediction error:', err);
            setErrorMessage(`Prediction failed: ${err.message}`);
        } finally {
            setIsPredicting(false);
        }
    };

    // Helper functions
    const dataURLtoFile = (dataurl, filename) => {
        const arr = dataurl.split(',');
        const mime = arr[0].match(/:(.*?);/)[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        return new File([u8arr], filename, { type: mime });
    };

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
                    {(isTraining || isPredicting) && <div className="spinner"></div>}
                </div>
            )}
        </>
    );

    const renderClassItem = (cls) => {
      const [captureCount, setCaptureCount] = useState(0);
      const [captureInterval, setCaptureInterval] = useState(null);
    
      const toggleClass = (e) => {
        // Only toggle if clicking on header, not buttons
        if (e.target.closest('.class-header')) {
          setExpandedClass(expandedClass === cls.id ? null : cls.id);
        }
      };
      const startMultiCapture = () => {
        setCaptureCount(0);
        const interval = setInterval(() => {
          if (webcamRef.current) {
            const imageSrc = webcamRef.current.getScreenshot();
            addImageToClass(cls.id, imageSrc);
            setCaptureCount(prev => prev + 1);
          }
        }, 500); // Capture every 500ms
        setCaptureInterval(interval);
        
        // Stop after 10 captures (5 seconds)
        setTimeout(() => {
          stopMultiCapture();
        }, 5000);
      };
    
      const stopMultiCapture = () => {
        if (captureInterval) {
          clearInterval(captureInterval);
          setCaptureInterval(null);
        }
      };
    
      return (
        <div 
      key={cls.id} 
      className={`class-item ${expandedClass === cls.id ? 'active' : ''}`}
      onClick={toggleClass}
    >
      <div className="class-header">
        <h3>{cls.name}</h3>
        <span className="image-count">{cls.images.length} images</span>
        <span className="chevron">{expandedClass === cls.id ? '▼' : '▶'}</span>
      </div>
      
      <div className="class-controls">
              <div className="capture-controls">
                <button
                  className="capture-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveWebcam(cls.id);
                  }}
                >
                  📷 Open Webcam
                </button>
    
                <label className="file-upload-btn">
                  📁 Upload Images
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    multiple
                    onChange={(e) => handleFileUpload(e, cls.id)}
                    hidden
                  />
                </label>
              </div>
              
              {/* In-class webcam */}
              {activeWebcam === cls.id && (
                <div className="class-webcam">
                  <Webcam
                    audio={false}
                    ref={webcamRef}
                    screenshotFormat="image/jpeg"
                    width={300}
                    height={225}
                  />
                  <div className="class-webcam-controls">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const imageSrc = webcamRef.current.getScreenshot();
                        addImageToClass(cls.id, imageSrc);
                      }}
                    >
                      Capture
                    </button>
                    <button
                      className="multi-capture-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (captureInterval) {
                          stopMultiCapture();
                        } else {
                          startMultiCapture();
                        }
                      }}
                    >
                      {captureInterval ? 'Stop' : 'Multi-Capture'}
                    </button>
                    {captureInterval && (
                      <span className="capture-count">{captureCount} captured</span>
                    )}
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        stopMultiCapture();
                        setActiveWebcam(null);
                      }}
                      className="close-btn"
                    >
                      ×
                    </button>
                  </div>
                </div>
              )}
              
              <div className="images-grid">
                {cls.images.map((img, idx) => (
                  <div key={idx} className="image-preview-container">
                    <img src={img} alt={`${cls.name} sample ${idx}`} className="image-preview" />
                    <button 
                      className="delete-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setClasses(prev => prev.map(c => 
                          c.id === cls.id 
                            ? { ...c, images: c.images.filter((_, i) => i !== idx) } 
                            : c
                        ));
                      }}
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            </div>
        </div>
      );}
    

    const renderPredictionResults = () => {
        if (isPredicting) {
            return (
                <div className="prediction-loading">
                    <div className="spinner"></div>
                    <p>Analyzing image...</p>
                </div>
            );
        }
        
        if (predictions) {
            return (
                <div className="prediction-results">
                    <h3>Results:</h3>
                    <div className="prediction-item">
                        <span className="class-name">{predictions.predicted_class}</span>
                        <span className="confidence-value">
                            {(predictions.confidence * 100).toFixed(1)}%
                        </span>
                        <div className="confidence-bar-container">
                            <div 
                                className="confidence-bar" 
                                style={{ width: `${predictions.confidence * 100}%` }}
                            />
                        </div>
                    </div>
                </div>
            );
        }
        
        return (
            <div className="prediction-placeholder">
                <p>Capture or upload an image to test predictions</p>
            </div>
        );
    };

    return (
        <div className="image-model-container">
            {renderStatusMessages()}

            <div className="model-grid">
                {/* Classes Panel */}
                <div className="panel classes-panel">
                    <div className="panel-header">
                        <h2>Classes</h2>
                        <div className="panel-icon">🖼️</div>
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

                    <button
                        onClick={uploadImages}
                        disabled={classes.reduce((sum, cls) => sum + cls.images.length, 0) === 0}
                        className="upload-button"
                    >
                        Upload All Images
                    </button>
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
                                    {classes.reduce((sum, cls) => sum + cls.images.length, 0)}
                                </span>
                                <span className="stat-label">Total Images</span>
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
                            disabled={isTraining || classes.reduce((sum, cls) => sum + cls.images.length, 0) < MIN_IMAGES_FOR_TRAINING}
                            className={`train-btn ${isTraining ? 'training' : ''}`}
                        >
                            {isTraining ? (
                                <>
                                    <div className="spinner"></div>
                                    Training...
                                </>
                            ) : 'Train Model'}
                        </button>
                    </div>
                </div>
                
                {/* Prediction Panel */}
{/* Updated Prediction Panel */}
<div className="panel prediction-panel">
  <div className="panel-header">
    <h2>Predictions</h2>
    <div className="panel-icon">🔮</div>
  </div>
  
  <div className="prediction-controls">
    <button
      className="predict-btn"
      onClick={() => setPredictionWebcamActive(!predictionWebcamActive)}
    >
      {predictionWebcamActive ? 'Close Webcam' : '📷 Open Webcam'}
    </button>

    <label className="file-upload-btn">
      📁 Upload Image
      <input
        type="file"
        ref={predictionFileInputRef}
        accept="image/*"
        onChange={(e) => {
          const file = e.target.files[0];
          if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
              predictImage(event.target.result);
            };
            reader.readAsDataURL(file);
          }
        }}
        hidden
      />
    </label>
  </div>

  {/* Inline Prediction Webcam */}
  {predictionWebcamActive && (
    <div className="prediction-webcam-container">
      <Webcam
        audio={false}
        ref={predictionWebcamRef}
        screenshotFormat="image/jpeg"
        width={300}
        height={225}
      />
      <div className="capture-button">
        <button
          onClick={() => {
            const imageSrc = predictionWebcamRef.current.getScreenshot();
            predictImage(imageSrc);
          }}
        >
          Capture and Predict
        </button>
      </div>
    </div>
  )}

  {renderPredictionResults()}
</div>
            </div>
        </div>
    );
};

export default ImageProject;