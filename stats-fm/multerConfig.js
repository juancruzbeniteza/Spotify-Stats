const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Set up storage for file uploads
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  }
});

// Configure multer
const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    // Log incoming file details
    console.log('Received file:', {
      fieldname: file.fieldname,
      originalname: file.originalname,
      mimetype: file.mimetype
    });

    // Only accept .json files
    if (!file.originalname.toLowerCase().endsWith('.json')) {
      return cb(new Error('Only .json files are allowed'));
    }

    cb(null, true);
  }
});

// Wrapper function for better error handling
const uploadMiddleware = (req, res, next) => {
  upload.array('files', 10)(req, res, (err) => {
    if (err) {
      console.error('Multer error:', err);
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File size too large. Maximum size is 50MB.' });
      }
      return res.status(400).json({ error: err.message });
    }
    next();
  });
};

module.exports = uploadMiddleware;
