import React, { useRef, useCallback } from 'react';
import Webcam from 'react-webcam';

const ImageCapture = ({ onImageCapture }) => {
  const webcamRef = useRef(null);

  const capture = useCallback(() => {
    const imageSrc = webcamRef.current.getScreenshot();
    onImageCapture(imageSrc);
  }, [webcamRef, onImageCapture]);

  return (
    <div>
      <Webcam
        audio={false}
        ref={webcamRef}
        screenshotFormat="image/jpeg"
      />
      <button onClick={capture}>Capture Photo</button>
    </div>
  );
};

export default ImageCapture;
