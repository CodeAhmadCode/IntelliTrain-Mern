require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const fileUpload = require('express-fileupload');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');

// ----- Config & Constants -----
const MONGO_URI = process.env.MONGO_URI?.trim(); // Remove hidden whitespace
console.log("Connecting to MongoDB with URI:", MONGO_URI);
const PORT = process.env.PORT || 5000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRE = process.env.JWT_EXPIRE || '1d';
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, 'uploads');

// ----- Initialize App -----
const app = express();

// ----- Middleware -----
app.use(cors({
  origin: [CLIENT_ORIGIN,"https://intellitrain-mern-1.onrender.com"],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE']
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());
app.use(fileUpload({
  limits: { fileSize: 50 * 1024 * 1024 },
  abortOnLimit: true,
  createParentPath: true
}));

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// ----- MongoDB Models -----
const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    match: /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/
  },
  password: {
    type: String,
    required: true,
    minlength: 8,
    select: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Add password hashing before save
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Method to generate JWT token
userSchema.methods.getSignedJwtToken = function() {
  return jwt.sign({ id: this._id }, JWT_SECRET, { expiresIn: JWT_EXPIRE });
};

// Method to compare passwords
userSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', userSchema);

// Audio Classification Models
const classSchema = new mongoose.Schema({
  name: { type: String, unique: true, required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });
const Class = mongoose.model('Class', classSchema);

const sampleSchema = new mongoose.Schema({
  class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  filename: { type: String, required: true },
  filepath: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });
const Sample = mongoose.model('Sample', sampleSchema);

// ----- Connect to MongoDB -----
mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  retryWrites: true,
  w: 'majority'
})
.then(() => console.log('MongoDB connected successfully'))
.catch(err => {
  console.error('MongoDB connection error:', err.message);
  process.exit(1);
});

app.get('/', (req, res) => {
  res.send('IntelliTrain API is running');
});

// ----- Authentication Middleware -----
const protect = async (req, res, next) => {
  let token;

  // Get token from header or cookie
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return res.status(401).json({ error: 'Not authorized' });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = await User.findById(decoded.id);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Not authorized' });
  }
};

// ----- Routes -----

// Authentication Routes
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Create user
    const user = await User.create({ email, password });

    // Create token
    const token = user.getSignedJwtToken();

    res.status(201).json({ 
      success: true,
      token,
      user: {
        id: user._id,
        email: user.email
      }
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: 'Email already exists' });
    }
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check for user
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Create token
    const token = user.getSignedJwtToken();

    res.status(200).json({ 
      success: true,
      token,
      user: {
        id: user._id,
        email: user.email
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// Audio Classification Routes
app.post('/api/audio/classes', protect, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Class name is required' });
    
    const newClass = await Class.create({ 
      name,
      user: req.user.id 
    });
    
    res.status(201).json({ _id: newClass._id, name: newClass.name });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'Class already exists' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/audio/samples', protect, async (req, res) => {
  try {
    if (!req.files || !req.files.audio) {
      return res.status(400).json({ error: 'Audio file is required' });
    }
    
    const audioFile = req.files.audio;
    const { classId, class: className } = req.body;
    
    let cls;
    if (classId) {
      cls = await Class.findById(classId);
    } else if (className) {
      cls = await Class.findOne({ name: className });
    }
    
    if (!cls) return res.status(404).json({ error: 'Class not found' });

    const timestamp = Date.now();
    const filename = `${cls._id}_${timestamp}${path.extname(audioFile.name)}`;
    const filepath = path.join(UPLOAD_DIR, filename);
    await audioFile.mv(filepath);

    const sample = await Sample.create({ 
      class: cls._id, 
      filename, 
      filepath, 
      timestamp,
      user: req.user.id 
    });
    
    res.status(201).json({ _id: sample._id, timestamp: sample.timestamp });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save sample' });
  }
});

app.get('/api/audio/samples/:id/play', protect, async (req, res) => {
  try {
    const sample = await Sample.findOne({ 
      _id: req.params.id,
      user: req.user.id 
    });
    
    if (!sample) return res.status(404).json({ error: 'Sample not found' });
    res.sendFile(sample.filepath);
  } catch (err) {
    res.status(500).json({ error: 'Failed to serve sample' });
  }
});

// Additional protected routes would go here...

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});