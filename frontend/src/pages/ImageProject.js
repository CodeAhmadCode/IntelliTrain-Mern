import React, { useState, useRef } from 'react';
import Webcam from 'react-webcam';
import axios from 'axios';
import '../ImageProject.css';

const ImageProject = () => {
  const [class1Images, setClass1Images] = useState([]);
  const [class2Images, setClass2Images] = useState([]);
  const [class1Mode, setClass1Mode] = useState(null);
  const [class2Mode, setClass2Mode] = useState(null);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [trainStatus, setTrainStatus] = useState(null);
  const [predictionResult, setPredictionResult] = useState(null);
  const [isPredicting, setIsPredicting] = useState(false);
  
  const webcamRef1 = useRef(null);
  const webcamRef2 = useRef(null);
  const predictionWebcamRef = useRef(null);

  const handleCapture = (webcamRef, setImages) => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      setImages((prevImages) => [...prevImages, imageSrc]);
    }
  };

  const handleFileChange = (event, setImages) => {
    const files = event.target.files;
    const newImages = Array.from(files).map((file) => URL.createObjectURL(file));
    setImages((prevImages) => [...prevImages, ...newImages]);
  };

  const closeWebcam = () => {
    setClass1Mode(null);
    setClass2Mode(null);
    setIsPredicting(false);
  };

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

  const handleSendBatch = async () => {
    try {
      // Upload Class 1 images
      for (let i = 0; i < class1Images.length; i++) {
        const formData = new FormData();
        let imageFile;
        
        if (class1Images[i].startsWith('data:image')) {
          imageFile = dataURLtoFile(class1Images[i], `class1_image_${i}.jpg`);
        } else {
          const response = await fetch(class1Images[i]);
          const blob = await response.blob();
          imageFile = new File([blob], `class1_image_${i}.jpg`, { type: 'image/jpeg' });
        }
        
        formData.append('image', imageFile);
        formData.append('class', 'class1');
        
        await axios.post('http://127.0.0.1:5000/api/upload', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
      }

      // Upload Class 2 images
      for (let i = 0; i < class2Images.length; i++) {
        const formData = new FormData();
        let imageFile;
        
        if (class2Images[i].startsWith('data:image')) {
          imageFile = dataURLtoFile(class2Images[i], `class2_image_${i}.jpg`);
        } else {
          const response = await fetch(class2Images[i]);
          const blob = await response.blob();
          imageFile = new File([blob], `class2_image_${i}.jpg`, { type: 'image/jpeg' });
        }
        
        formData.append('image', imageFile);
        formData.append('class', 'class2');
        
        await axios.post('http://127.0.0.1:5000/api/upload', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
      }

      setUploadStatus('Images uploaded successfully!');
    } catch (error) {
      setUploadStatus('Failed to upload images. Please try again.');
      console.error('Error uploading images:', error);
    }
  };

  

  const handleTrainModel = async () => {
    try {
      setTrainStatus('Training in progress...');
      await axios.post('http://127.0.0.1:5000/api/train');
      checkTrainingStatus();
    } catch (error) {
      console.error('Error training model:', error);
      setTrainStatus('Error starting training. Please try again.');
    }
  };
  
  const checkTrainingStatus = async () => {
    try {
      const response = await axios.get('http://127.0.0.1:5000/api/training-status');
      console.log('Training status response:', response.data);
  
      if (response.data.status === 'completed') {
        setTrainStatus('Training completed successfully!');
      } else if (response.data.status === 'failed') {
        setTrainStatus(`Training failed: ${response.data.error || 'Please try again.'}`);
      } else if (response.data.status === 'in_progress') {
        setTrainStatus('Training in progress... This may take a few minutes.');
        // Check again after 5 seconds
        setTimeout(checkTrainingStatus, 5000);
      } else {
        setTrainStatus('Unknown training status. Please try again.');
      }
    } catch (error) {
      console.error('Error checking training status:', error);
      setTrainStatus('Error checking training status. Please try again.');
    }
  };

  const handlePredict = async () => {
    setIsPredicting(true);
    setPredictionResult(null);
  };

  const capturePrediction = async () => {
    try {
      if (predictionWebcamRef.current) {
        const imageSrc = predictionWebcamRef.current.getScreenshot();
        const imageFile = dataURLtoFile(imageSrc, 'predict_image.jpg');

        const formData = new FormData();
        formData.append('image', imageFile);

        const response = await axios.post('http://127.0.0.1:5000/api/predict', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
        
        setPredictionResult(response.data.predicted_class);
      }
    } catch (error) {
      console.error('Prediction failed:', error);
      setPredictionResult('Prediction failed');
    }
  };

  return (
    <div className="container">
      {/* Left Panel: Class Sections */}
      <div className="class-panel">
        <div className="class-section">
          <h2>Class 1</h2>
          <button onClick={() => setClass1Mode('file')}>Select File</button>
          <button onClick={() => setClass1Mode('webcam')}>Webcam</button>
          {class1Mode === 'file' && (
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={(e) => handleFileChange(e, setClass1Images)}
            />
          )}
         {class1Mode === 'webcam' && (
  <div className="webcam-container">
    <Webcam audio={false} ref={webcamRef1} screenshotFormat="image/jpeg" width={320} height={240} />
    <button onClick={() => handleCapture(webcamRef1, setClass1Images)}>Capture</button>
    <button onClick={closeWebcam}>❌</button>
  </div>
)}
          <div className="captured-images">
            {class1Images.map((image, index) => (
              <img key={index} src={image} alt={`Class 1 Image ${index + 1}`} className="image-preview" />
            ))}
          </div>
        </div>
  
        <div className="class-section">
          <h2>Class 2</h2>
          <button onClick={() => setClass2Mode('file')}>Select File</button>
          <button onClick={() => setClass2Mode('webcam')}>Webcam</button>
          {class2Mode === 'file' && (
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={(e) => handleFileChange(e, setClass2Images)}
            />
          )}
          {class2Mode === 'webcam' && (
            <div className="webcam-container">
              <Webcam audio={false} ref={webcamRef2} screenshotFormat="image/jpeg" width={320} height={240} />
              <button onClick={() => handleCapture(webcamRef2, setClass2Images)}>Capture</button>
              <button onClick={closeWebcam}>❌</button>
            </div>
          )}
          <div className="captured-images">
            {class2Images.map((image, index) => (
              <img key={index} src={image} alt={`Class 2 Image ${index + 1}`} className="image-preview" />
            ))}
          </div>
        </div>
  
        {/* Upload Button at the Bottom */}
        <button
          onClick={handleSendBatch}
          disabled={!(class1Images.length && class2Images.length)}
          className="upload-button"
        >
          Upload Images
        </button>
        {uploadStatus && <p className="status-message">{uploadStatus}</p>}
      </div>
  
      {/* Center Panel: Train Button */}
      <div className="train-panel">
        <button onClick={handleTrainModel} className="train-button">
          Train Model
        </button>
        {trainStatus && <p className="status-message">{trainStatus}</p>}
      </div>
  
      {/* Right Panel: Prediction Section */}
      <div className="prediction-panel">
        <button onClick={handlePredict} className="predict-button">
          Open Prediction Webcam
        </button>
  
        {isPredicting && (
          <div className="webcam-container">
            <Webcam audio={false} ref={predictionWebcamRef} screenshotFormat="image/jpeg" width={320} height={240} />
            <button onClick={capturePrediction}>Capture</button>
            <button onClick={closeWebcam}>❌</button>
          </div>
        )}
  
        {predictionResult && <p className="prediction-result">Prediction: {predictionResult}</p>}
      </div>
    </div>
  );
  
};

export default ImageProject;
