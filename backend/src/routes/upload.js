const express = require('express');
const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');
const verifyToken = require('../middleware/verifyToken');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

// POST /api/upload — upload an image to Cloudinary
router.post('/upload', verifyToken, upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No image provided' });

  try {
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'notes-app', resource_type: 'image' },
        (err, result) => (err ? reject(err) : resolve(result))
      );
      stream.end(req.file.buffer);
    });
    res.json({ url: result.secure_url });
  } catch (err) {
    console.error('Cloudinary upload error:', err);
    res.status(500).json({ message: 'Upload failed', detail: err?.message });
  }
});

module.exports = router;
