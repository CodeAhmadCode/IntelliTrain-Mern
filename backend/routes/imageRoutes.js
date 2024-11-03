const express = require('express');
const Image = require('../models/Image');
const router = express.Router();

router.post('/upload_images', async (req, res) => {
  const { class1Images, class2Images } = req.body;

  try {
    await Image.updateOne(
      { className: 'Class 1' },
      { $push: { images: { $each: class1Images } } },
      { upsert: true }
    );

    await Image.updateOne(
      { className: 'Class 2' },
      { $push: { images: { $each: class2Images } } },
      { upsert: true }
    );

    res.status(200).json({ message: 'Images uploaded successfully' });
  } catch (error) {
    console.error('Error uploading images:', error);
    res.status(500).json({ message: 'Failedd to upload images' });
  }
});

router.get('/get_images', async (req, res) => {
  try {
    const class1Images = await Image.findOne({ className: 'Class 1' });
    const class2Images = await Image.findOne({ className: 'Class 2' });

    res.status(200).json({
      class1Images: class1Images ? class1Images.images : [],
      class2Images: class2Images ? class2Images.images : [],
    });
  } catch (error) {
    console.error('Error fetching images:', error);
    res.status(500).json({ message: 'Failed to fetch images' });
  }
});

module.exports = router;
