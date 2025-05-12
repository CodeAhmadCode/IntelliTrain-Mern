import React, { useState, useRef, useEffect } from 'react';
import Webcam from 'react-webcam';
import * as tf from '@tensorflow/tfjs';
import * as mobilenetModule from '@tensorflow-models/mobilenet';
import * as knnClassifier from '@tensorflow-models/knn-classifier';
import './ImageProject.css';

const IMG_SIZE = 224;
const KNN_K = 10;

const ImageProject = () => {
  const webcamRef = useRef(null);
  const mobilenetRef = useRef(null);
  const classifierRef = useRef(knnClassifier.create());
  const nnModelRef = useRef(null);
  const captureIntervalRef = useRef(null);

  const [classes, setClasses] = useState([
    { id: '0', name: 'Class 1' },
    { id: '1', name: 'Class 2' }
  ]);
  const [newClassName, setNewClassName] = useState('');
  const [exampleCounts, setExampleCounts] = useState({});
  const [samples, setSamples] = useState({}); // Store image samples
  const [status, setStatus] = useState('Loading MobileNet...');
  const [predictions, setPredictions] = useState(null);
  const [predictionMethod, setPredictionMethod] = useState('knn');
  const [trainEpochs, setTrainEpochs] = useState(5);
  const [learningRate, setLearningRate] = useState(0.001);
  const [trainProgress, setTrainProgress] = useState(0);
  const [isTraining, setIsTraining] = useState(false);
  const [editingClassId, setEditingClassId] = useState(null);

  useEffect(() => {
    (async () => {
      const m = await mobilenetModule.load({ version: 2, alpha: 1.0 });
      mobilenetRef.current = m;
      classifierRef.current = knnClassifier.create({ k: KNN_K });
      setStatus('MobileNet ready');
    })();
  }, []);

  const updateCounts = () => {
    const data = classifierRef.current.getClassifierDataset();
    const counts = {};
    Object.entries(data).forEach(([label, tensor]) => {
      counts[label] = tensor.shape[0];
    });
    setExampleCounts(counts);
  };

  const addClass = () => {
    const name = newClassName.trim();
    if (!name) {
      alert('Class name cannot be empty');
      return;
    }
    const id = Date.now().toString();
    setClasses(prev => [...prev, { id, name }]);
    setNewClassName('');
    setStatus(`Added new class '${name}'`);
  };

  const addExample = async (classId) => {
    setStatus('Capturing example...');
    const imageSrc = webcamRef.current.getScreenshot();
    const imgTensor = tf.browser
      .fromPixels(webcamRef.current.video)
      .resizeNearestNeighbor([IMG_SIZE, IMG_SIZE])
      .toFloat();
    const emb = mobilenetRef.current.infer(imgTensor, 'conv_preds');
    classifierRef.current.addExample(emb.squeeze(), classId);
    imgTensor.dispose();
    emb.dispose();
    setSamples(prev => ({
      ...prev,
      [classId]: [...(prev[classId] || []), imageSrc]
    }));
    updateCounts();
    setStatus(`Example added to ${classes.find(c => c.id === classId).name}`);
  };

  const handleUpload = (e, classId) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setStatus('Uploading images...');
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = ({ target }) => {
        const imageSrc = target.result;
        setSamples(prev => ({
          ...prev,
          [classId]: [...(prev[classId] || []), imageSrc]
        }));
        const img = new Image();
        img.src = imageSrc;
        img.onload = () => {
          const tensor = tf.browser
            .fromPixels(img)
            .resizeNearestNeighbor([IMG_SIZE, IMG_SIZE])
            .toFloat();
          const emb = mobilenetRef.current.infer(tensor, 'conv_preds');
          classifierRef.current.addExample(emb.squeeze(), classId);
          tensor.dispose();
          emb.dispose();
          updateCounts();
        };
      };
      reader.readAsDataURL(file);
    });
    setStatus(`Uploaded ${files.length} images to ${classes.find(c => c.id === classId).name}`);
  };

  const trainModel = async () => {
    const total = Object.values(exampleCounts).reduce((a, b) => a + b, 0);
    if (!total) return alert('Please add some examples before training.');
    setIsTraining(true);
    setTrainProgress(0);
    setStatus('Preparing dataset...');

    // build tensors
    const data = classifierRef.current.getClassifierDataset();
    const xs = [], ys = [];
    Object.entries(data).forEach(([label, tensor]) => {
      tensor.arraySync().forEach(vec => { xs.push(vec); ys.push(parseInt(label)); });
    });
    const xTensor = tf.tensor2d(xs);
    const yTensor = tf.oneHot(tf.tensor1d(ys, 'int32'), classes.length);

    // compile head
    if (!nnModelRef.current) {
      const head = tf.sequential();
      head.add(tf.layers.dense({ inputShape: [xTensor.shape[1]], units: 64, activation: 'relu' }));
      head.add(tf.layers.dropout({ rate: 0.25 }));
      head.add(tf.layers.dense({ units: classes.length, activation: 'softmax' }));
      nnModelRef.current = head;
    }
    nnModelRef.current.compile({ optimizer: tf.train.adam(learningRate), loss: 'categoricalCrossentropy', metrics: ['accuracy'] });

    // train with progress
    await nnModelRef.current.fit(xTensor, yTensor, {
      epochs: trainEpochs,
      batchSize: 32,
      validationSplit: 0.15,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          const prog = Math.round(((epoch + 1) / trainEpochs) * 100);
          setTrainProgress(prog);
          setStatus(`Training: ${prog}% (loss: ${logs.loss.toFixed(4)})`);
        }
      }
    });

    xTensor.dispose(); yTensor.dispose();
    setIsTraining(false);
    setStatus('Training complete - Neural Network is ready');
  };

  const predictWithNN = async (imgTensor) => {
    const features = mobilenetRef.current.infer(imgTensor, 'conv_preds').squeeze();
    const prediction = nnModelRef.current.predict(features.expandDims(0));
    const probabilities = await prediction.data();
    
    let maxProb = 0;
    let bestClass = 0;
    const confidences = {};
    
    for (let i = 0; i < classes.length; i++) {
      const confidence = probabilities[i] * 100; // Already in percentage
      confidences[i.toString()] = confidence;
      if (confidence > maxProb) {
        maxProb = confidence;
        bestClass = i;
      }
    }
    
    features.dispose();
    prediction.dispose();
    
    return {
      label: bestClass.toString(),
      confidences: confidences
    };
  };

  const predictWebcam = async () => {
    const total = Object.values(exampleCounts).reduce((a, b) => a + b, 0);
    if (!total) return alert('Please add some examples before predicting.');
    setStatus('Predicting...');
    const imgTensor = tf.browser
      .fromPixels(webcamRef.current.video)
      .resizeNearestNeighbor([IMG_SIZE, IMG_SIZE])
      .toFloat();
    
    let result;
    if (predictionMethod === 'knn') {
      const knnResult = await classifierRef.current.predictClass(
        mobilenetRef.current.infer(imgTensor, 'conv_preds').squeeze()
      );
      const confidences = {};
      Object.entries(knnResult.confidences).forEach(([k, v]) => {
        confidences[k] = v * 100; // Convert 0-1 to 0-100
      });
      result = { label: knnResult.label, confidences };
    } else if (predictionMethod === 'nn') {
      result = await predictWithNN(imgTensor);
    } else if (predictionMethod === 'ensemble') {
      const knnResult = await classifierRef.current.predictClass(
        mobilenetRef.current.infer(imgTensor, 'conv_preds').squeeze()
      );
      const nnResult = await predictWithNN(imgTensor);
      const combinedConfidences = {};
      let maxProb = 0;
      let bestClass = null;
      classes.forEach(c => {
        const knnConf = (knnResult.confidences[c.id] || 0) * 100; // Convert to percentage
        const nnConf = nnResult.confidences[c.id] || 0; // Already in percentage
        const avgConf = (knnConf + nnConf) / 2;
        combinedConfidences[c.id] = avgConf;
        if (avgConf > maxProb) {
          maxProb = avgConf;
          bestClass = c.id;
        }
      });
      result = { label: bestClass, confidences: combinedConfidences };
    }
    
    imgTensor.dispose();
    setPredictions(result);
    setStatus('Prediction done');
  };

  const handlePredictUpload = async (e) => {
    const total = Object.values(exampleCounts).reduce((a, b) => a + b, 0);
    if (!total) return alert('Please add some examples before predicting.');
    const file = e.target.files[0]; if (!file) return;
    setStatus('Predicting from file...');
    const reader = new FileReader();
    reader.onload = ({ target }) => {
      const img = new Image(); img.src = target.result;
      img.onload = async () => {
        const tensor = tf.browser
          .fromPixels(img)
          .resizeNearestNeighbor([IMG_SIZE, IMG_SIZE])
          .toFloat();
        
        let result;
        if (predictionMethod === 'knn') {
          const knnResult = await classifierRef.current.predictClass(
            mobilenetRef.current.infer(tensor, 'conv_preds').squeeze()
          );
          const confidences = {};
          Object.entries(knnResult.confidences).forEach(([k, v]) => {
            confidences[k] = v * 100; // Convert 0-1 to 0-100
          });
          result = { label: knnResult.label, confidences };
        } else if (predictionMethod === 'nn') {
          result = await predictWithNN(tensor);
        } else if (predictionMethod === 'ensemble') {
          const knnResult = await classifierRef.current.predictClass(
            mobilenetRef.current.infer(tensor, 'conv_preds').squeeze()
          );
          const nnResult = await predictWithNN(tensor);
          const combinedConfidences = {};
          let maxProb = 0;
          let bestClass = null;
          classes.forEach(c => {
            const knnConf = (knnResult.confidences[c.id] || 0) * 100; // Convert to percentage
            const nnConf = nnResult.confidences[c.id] || 0; // Already in percentage
            const avgConf = (knnConf + nnConf) / 2;
            combinedConfidences[c.id] = avgConf;
            if (avgConf > maxProb) {
              maxProb = avgConf;
              bestClass = c.id;
            }
          });
          result = { label: bestClass, confidences: combinedConfidences };
        }
        
        tensor.dispose();
        setPredictions(result);
        setStatus('File prediction done');
      };
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="image-model-container">
      <div className="flow-container" style={{ display: 'flex', gap: '1rem', overflowX: 'auto', alignItems: 'flex-start' }}>
        {/* Add Examples Panel */}
        <div className="panel" style={{ minWidth: '280px' }}>
          <h3>Add Examples</h3>
          <div className="classes-row" style={{ display: 'flex', gap: '0.75rem', overflowX: 'auto' }}>
            {classes.map(c => (
              <div key={c.id} className="class-block card" style={{ flex: '0 0 200px', textAlign: 'center', padding: '1rem' }}>
                <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  {editingClassId === c.id ? (
                    <input
                      value={classes.find(cls => cls.id === c.id).name}
                      onChange={e => setClasses(prev => prev.map(cls => cls.id === c.id ? { ...cls, name: e.target.value } : cls))}
                      onBlur={() => setEditingClassId(null)}
                      autoFocus
                      style={{ width: '60%', fontSize: '1rem', fontWeight: '500' }}
                    />
                  ) : (
                    <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: '500' }}>
                      {c.name} ({exampleCounts[c.id] || 0})
                      <span
                        onClick={() => setEditingClassId(c.id)}
                        style={{ cursor: 'pointer', marginLeft: '4px' }}
                      >
                        ✎
                      </span>
                      <span style={{ cursor: 'pointer', marginLeft: '4px' }}>⋯</span>
                    </h4>
                  )}
                </header>
                <div style={{ marginBottom: '0.5rem' }}>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Add Image Samples:</p>
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                    <button
                      className="btn-success action-btn"
                      onMouseDown={() => {
                        captureIntervalRef.current = setInterval(() => addExample(c.id), 500);
                      }}
                      onMouseUp={() => clearInterval(captureIntervalRef.current)}
                      onMouseLeave={() => clearInterval(captureIntervalRef.current)}
                    >
                      📷 Hold to Record
                    </button>
                    <label className="upload-btn action-btn">📁 Upload
                      <input type="file" accept="image/*" multiple onChange={e => handleUpload(e, c.id)} hidden />
                    </label>
                  </div>
                </div>
                <div className="samples-grid" style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {samples[c.id]?.map((src, idx) => (
                    <img
                      key={idx}
                      src={src}
                      alt={`sample ${idx}`}
                      style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '4px' }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div
            className="new-class-row add-card"
            style={{ marginTop: '1rem', padding: '1rem', textAlign: 'center', cursor: 'pointer' }}
            onClick={() => {
              const name = prompt('Enter new class name:');
              if (name) {
                setNewClassName(name);
                addClass();
              }
            }}
          >
            <span style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>⁺ Add a class</span>
          </div>
        </div>

        {/* Train Model Panel */}
        <div className="panel" style={{ minWidth: '220px', textAlign: 'center' }}>
          <h3>Train Model</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center', marginTop: '1rem' }}>
            <label>Epochs: <input type="number" value={trainEpochs} min={1} onChange={e => setTrainEpochs(+e.target.value)} style={{ width: '60px' }} /></label>
            <label>LR: <input type="number" value={learningRate} step="0.0001" onChange={e => setLearningRate(+e.target.value)} style={{ width: '80px' }} /></label>
            <button className="btn-primary" onClick={trainModel} disabled={isTraining}>Train Neural Network</button>
            {isTraining && <progress value={trainProgress} max={100} style={{ width: '100%' }} />}
          </div>
        </div>

        {/* Predict Panel */}
        <div className="panel" style={{ minWidth: '280px', textAlign: 'center' }}>
          <h3>Predict</h3>
          <Webcam audio={false} ref={webcamRef} width={IMG_SIZE} height={IMG_SIZE} className="webcam-video" style={{ borderRadius: '6px', marginBottom: '1rem' }} />
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
            <button className="btn-warning" onClick={predictWebcam}>Predict Live</button>
            <label className="upload-btn" style={{ background: '#f3f4f6', borderRadius: '4px', padding: '0.5rem 1rem', cursor: 'pointer' }}>📁 Upload & Predict
              <input type="file" accept="image/*" onChange={handlePredictUpload} hidden />
            </label>
          </div>
          {predictions && (
            <div className="prediction-result" style={{ marginTop: '1rem' }}>
              <p><strong>{classes.find(c => c.id === predictions.label)?.name}</strong></p>
              <p>Confidence: {(predictions.confidences[predictions.label]).toFixed(1)}%</p>
              {Object.entries(predictions.confidences).length > 1 && (
                <div style={{ marginTop: '0.5rem', textAlign: 'left', fontSize: '0.85rem' }}>
                  <p><strong>All confidences:</strong></p>
                  {Object.entries(predictions.confidences).map(([id, conf]) => (
                    <div key={id} style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>{classes.find(c => c.id === id)?.name}:</span>
                      <span>{conf.toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: '1rem' }}>
        <label>Prediction Method: </label>
        <select value={predictionMethod} onChange={e => {
          setPredictionMethod(e.target.value);
          setStatus(`Using ${e.target.value === 'knn' ? 'KNN Classifier' : e.target.value === 'nn' ? 'Neural Network' : 'Ensemble (KNN + NN)'} for predictions`);
        }}>
          <option value="knn">KNN Classifier</option>
          {nnModelRef.current && <option value="nn">Neural Network</option>}
          {nnModelRef.current && <option value="ensemble">Ensemble (KNN + NN)</option>}
        </select>
      </div>

      <div className="status-bar" style={{ marginTop: '1rem', fontStyle: 'italic' }}>{status}</div>
    </div>
  );
};

export default ImageProject;