import React, { useState } from 'react';
import axios from 'axios';

function TrainModel() {
  const [numClasses, setNumClasses] = useState(0);
  const [classImages, setClassImages] = useState({});
  const [classNames, setClassNames] = useState([]);

  const handleNumClassesChange = (e) => {
    setNumClasses(e.target.value);
    const names = [];
    for (let i = 0; i < e.target.value; i++) {
      names.push(`Class ${i + 1}`);
    }
    setClassNames(names);
  };

  const handleImageUpload = (e, className) => {
    const files = e.target.files;
    setClassImages({
      ...classImages,
      [className]: files,
    });
  };

  const handleTrainModel = async () => {
    const formData = new FormData();
    formData.append('numClasses', numClasses);

    Object.keys(classImages).forEach((className) => {
      const images = classImages[className];
      for (let i = 0; i < images.length; i++) {
        formData.append(`${className}_images`, images[i]);
      }
    });

    try {
      const response = await axios.post('/api/train-model', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      alert('Model trained successfully!');
    } catch (error) {
      console.error(error);
      alert('Error training the model');
    }
  };

  return (
    <div>
      <h2>Train Your Model</h2>
      <input type="number" value={numClasses} onChange={handleNumClassesChange} />
      {classNames.map((className, index) => (
        <div key={index}>
          <h4>{className}</h4>
          <input type="file" multiple onChange={(e) => handleImageUpload(e, className)} />
        </div>
      ))}
      <button onClick={handleTrainModel}>Train Model</button>
    </div>
  );
}

export default TrainModel;
