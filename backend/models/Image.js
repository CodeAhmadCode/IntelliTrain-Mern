// models/Image.js
const mongoose = require('mongoose');

const imageSchema = new mongoose.Schema({
  className: String,
  images: [String], // Array of base64 strings
});

module.exports = mongoose.model('Image', imageSchema);
