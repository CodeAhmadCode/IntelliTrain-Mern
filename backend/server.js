// server.js - Updated Code
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');
const fileUpload = require('express-fileupload'); // Add this

const app = express();

// Middleware
app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
app.use(fileUpload()); // Handle multipart/form-data
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// MongoDB Connection (No changes here)
mongoose.connect('mongodb://localhost:27017/', { 
  useNewUrlParser: true, 
  useUnifiedTopology: true 
})
.then(() => console.log('Connected to MongoDB'))
.catch(console.error);

// Audio API Proxy - Simplified
app.use('/api/audio', createProxyMiddleware({
  target: 'http://localhost:5001',
  changeOrigin: true,
  pathRewrite: { '^/api/audio': '' },
  onProxyReq: (proxyReq, req) => {
    // Forward multipart data as-is
    if (req.headers['content-type']?.startsWith('multipart/form-data')) {
      proxyReq.setHeader('Content-Type', req.headers['content-type']);
      if (req.body) {
        proxyReq.write(req.body);
      }
    }
  }
}));

// Keep other proxies unchanged
app.use('/api/train', createProxyMiddleware({ target: 'http://localhost:5000', changeOrigin: true }));
app.use('/api/predict', createProxyMiddleware({ target: 'http://localhost:5000', changeOrigin: true }));

const PORT = 8000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));