// server.js - Express backend for Audio Classification API
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const fileUpload = require('express-fileupload');
const path = require('path');
const fs = require('fs');

// ----- Config & Constants -----
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/audio-classification';
const PORT = parseInt(process.env.PORT, 10) || 5000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
const UPLOAD_DIR = path.join(__dirname, 'uploads');

// ----- Initialize App -----
const app = express();

// ----- Middleware -----
app.use(cors({ origin: CLIENT_ORIGIN, credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(fileUpload({
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  abortOnLimit: true,
  createParentPath: true
}));

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// ----- MongoDB Models -----
const classSchema = new mongoose.Schema({
  name: { type: String, unique: true, required: true }
}, { timestamps: true });
const Class = mongoose.model('Class', classSchema);

const sampleSchema = new mongoose.Schema({
  class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  filename: { type: String, required: true },
  filepath: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
}, { timestamps: true });
const Sample = mongoose.model('Sample', sampleSchema);

// ----- Connect to MongoDB -----
mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('MongoDB connected')).catch(err => {
  console.error('MongoDB connection error:', err);
  process.exit(1);
});

// ----- Routes -----
const router = express.Router();

// Create a new class
router.post('/audio/classes', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Class name is required' });
    const newClass = await Class.create({ name });
    res.status(201).json({ _id: newClass._id, name: newClass.name });
  } catch (err) {
    console.error('Error creating class:', err);
    if (err.code === 11000) return res.status(409).json({ error: 'Class already exists' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Upload a new sample
router.post('/audio/samples', async (req, res) => {
  try {
    if (!req.files || !req.files.audio) {
      return res.status(400).json({ error: 'Audio file is required' });
    }
    const audioFile = req.files.audio;
    // Accept either classId or class name
    const { classId, class: className } = req.body;
    let cls;
    if (classId) {
      cls = await Class.findById(classId);
    } else if (className) {
      cls = await Class.findOne({ name: className });
    }
    if (!cls) return res.status(404).json({ error: 'Class not found' });

    // Save file to disk
    const timestamp = Date.now();
    const filename = `${cls._id}_${timestamp}${path.extname(audioFile.name)}`;
    const filepath = path.join(UPLOAD_DIR, filename);
    await audioFile.mv(filepath);

    // Save record in DB
    const sample = await Sample.create({ class: cls._id, filename, filepath, timestamp });
    res.status(201).json({ _id: sample._id, timestamp: sample.timestamp });
  } catch (err) {
    console.error('Error saving sample:', err);
    res.status(500).json({ error: 'Failed to save sample' });
  }
});

// Serve audio playback by sample ID
router.get('/audio/samples/:id/play', async (req, res) => {
  try {
    const sample = await Sample.findById(req.params.id);
    if (!sample) return res.status(404).json({ error: 'Sample not found' });
    res.sendFile(sample.filepath);
  } catch (err) {
    console.error('Error serving sample:', err);
    res.status(500).json({ error: 'Failed to serve sample' });
  }
});

// Delete a sample by ID
router.delete('/audio/samples/:id', async (req, res) => {
  try {
    const sample = await Sample.findByIdAndDelete(req.params.id);
    if (!sample) return res.status(404).json({ error: 'Sample not found' });
    // Delete file from disk
    fs.unlinkSync(sample.filepath);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting sample:', err);
    res.status(500).json({ error: 'Failed to delete sample' });
  }
});

// Train model endpoint
router.post('/audio/train', async (req, res) => {
  try {
    // TODO: add training logic
    const accuracy = 0.85; // placeholder
    res.json({ accuracy });
  } catch (err) {
    console.error('Training error:', err);
    res.status(500).json({ error: 'Training failed' });
  }
});

// Predict endpoint
router.post('/audio/predict', async (req, res) => {
  try {
    if (!req.files || !req.files.audio) {
      return res.status(400).json({ error: 'Audio file is required for prediction' });
    }
    // TODO: add prediction logic
    const dummy = { 'Class 1': 0.6, 'Class 2': 0.4 };
    res.json(dummy);
  } catch (err) {
    console.error('Prediction error:', err);
    res.status(500).json({ error: 'Prediction failed' });
  }
});

// Mount router
app.use('/api', router);

// Start server
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
