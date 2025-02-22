const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Set up upload directory
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Add timestamp to prevent filename collisions
    const timestamp = Date.now();
    cb(null, `${timestamp}-${file.originalname}`);
  }
});

// Configure multer
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
    files: 10 // Max 10 files
  },
  fileFilter: (req, file, cb) => {
    // Log file details
    console.log('Processing file:', {
      fieldname: file.fieldname,
      originalname: file.originalname,
      mimetype: file.mimetype
    });

    // Only accept JSON files
    if (!file.originalname.toLowerCase().endsWith('.json')) {
      return cb(new Error('Only .json files are allowed'));
    }
    cb(null, true);
  }
});

// Process JSON file
const processJsonFile = async (filePath, userId, db) => {
  try {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const jsonData = JSON.parse(fileContent);
    
    if (!Array.isArray(jsonData)) {
      throw new Error('File content must be an array of listening history entries');
    }

    // Insert file record into archives
    await new Promise((resolve, reject) => {
      db.run(
        "INSERT INTO archives (user_id, file_path) VALUES (?, ?)",
        [userId, filePath],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    // Process each track entry
    for (const entry of jsonData) {
      await new Promise((resolve, reject) => {
        db.run(`
          INSERT INTO track_plays (
            user_id,
            track_name,
            artist_name,
            album_name,
            played_at,
            duration_ms,
            platform,
            conn_country,
            master_metadata_track_name,
            master_metadata_album_artist_name,
            master_metadata_album_album_name,
            spotify_track_uri,
            reason_start,
            reason_end,
            shuffle,
            skipped,
            offline,
            incognito_mode
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          userId,
          entry.master_metadata_track_name,
          entry.master_metadata_album_artist_name,
          entry.master_metadata_album_album_name,
          entry.ts,
          entry.ms_played || 0,
          entry.platform || null,
          entry.conn_country || null,
          entry.master_metadata_track_name,
          entry.master_metadata_album_artist_name,
          entry.master_metadata_album_album_name,
          entry.spotify_track_uri || null,
          entry.reason_start || null,
          entry.reason_end || null,
          entry.shuffle || false,
          entry.skipped || false,
          entry.offline || false,
          entry.incognito_mode || false
        ], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }

    return {
      name: path.basename(filePath),
      entries: jsonData.length
    };
  } catch (error) {
    console.error('Error processing file:', filePath, error);
    throw error;
  }
};

// Handle file upload
const handleUpload = (req, res) => {
  console.log('Upload request received:', {
    method: req.method,
    url: req.url,
    headers: {
      'content-type': req.headers['content-type'],
      'content-length': req.headers['content-length'],
      'authorization': req.headers['authorization'] ? 'Bearer [hidden]' : 'none'
    }
  });

  upload.array('files', 10)(req, res, async (err) => {
    if (err) {
      console.error('Upload error:', err);

      if (err instanceof multer.MulterError) {
        switch (err.code) {
          case 'LIMIT_FILE_SIZE':
            return res.status(400).json({
              error: 'File too large',
              details: 'Maximum file size is 50MB',
              help: 'Please reduce your file size or split into multiple files'
            });
          case 'LIMIT_FILE_COUNT':
            return res.status(400).json({
              error: 'Too many files',
              details: 'Maximum number of files is 10',
              help: 'Please upload fewer files'
            });
          default:
            return res.status(400).json({
              error: 'Upload error',
              details: err.message
            });
        }
      }

      return res.status(400).json({
        error: 'Upload failed',
        details: err.message
      });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        error: 'No files received',
        help: 'Please select at least one JSON file to upload'
      });
    }

    console.log('Files received:', {
      count: req.files.length,
      files: req.files.map(f => ({
        name: f.originalname,
        size: f.size,
        path: f.path
      }))
    });

    try {
      const processedFiles = [];
      for (const file of req.files) {
        const result = await processJsonFile(file.path, req.user.id, req.app.locals.db);
        processedFiles.push(result);
      }

      res.json({
        message: "Files processed successfully",
        files: processedFiles
      });
    } catch (error) {
      console.error('Error processing files:', error);
      res.status(500).json({
        error: 'Failed to process files',
        details: error.message
      });
    }
  });
};

module.exports = handleUpload;
