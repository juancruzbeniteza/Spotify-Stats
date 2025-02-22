const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");
const { format } = require('date-fns');

// Import upload handler
const handleUpload = require('./uploadHandler');

const app = express();
const PORT = 5000;
const JWT_SECRET = process.env.JWT_SECRET || "spotify_stats_secret";

// Email configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

const sendRegistrationEmail = (email) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Welcome to Spotify Stats!',
    html: `<p>Thank you for registering with Spotify Stats!</p>
          <p>You can now start tracking your listening history and analyzing your music preferences.</p>`
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error('Error sending email:', error);
    } else {
      console.log('Email sent:', info.response);
    }
  });
};

// CORS configuration
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Content-Length'],
  exposedHeaders: ['Content-Length', 'Content-Type']
}));

// Handle preflight requests
app.options('*', cors());

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize SQLite database
const dbFile = path.join(__dirname, "spotify.db");
const db = new sqlite3.Database(dbFile, (err) => {
  if (err) {
    console.error("Error opening database", err);
  } else {
    console.log("Connected to SQLite database.");
  }
});

// Make db available to request handlers
app.locals.db = db;

// Create tables
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL
  )`);
  
  db.run(`CREATE TABLE IF NOT EXISTS archives (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    file_path TEXT NOT NULL,
    upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);
  
  db.run(`CREATE TABLE IF NOT EXISTS track_plays (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    track_name TEXT,
    artist_name TEXT,
    album_name TEXT,
    played_at DATETIME,
    duration_ms INTEGER,
    platform TEXT,
    conn_country TEXT,
    master_metadata_track_name TEXT,
    master_metadata_album_artist_name TEXT,
    master_metadata_album_album_name TEXT,
    spotify_track_uri TEXT,
    reason_start TEXT,
    reason_end TEXT,
    shuffle BOOLEAN,
    skipped BOOLEAN,
    offline BOOLEAN,
    incognito_mode BOOLEAN,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);
});

// Auth middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  
  if (!authHeader) {
    return res.status(401).json({ error: "Authorization header missing" });
  }

  const token = authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: "Access token missing" });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(403).json({ error: "Token expired" });
      }
      return res.status(403).json({ error: "Invalid token" });
    }
    
    db.get("SELECT id FROM users WHERE id = ?", [user.id], (err, row) => {
      if (err || !row) {
        return res.status(403).json({ error: "User not found" });
      }
      req.user = user;
      next();
    });
  });
};

// Register endpoint
app.post("/register", async (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    db.run(
      "INSERT INTO users (email, password_hash) VALUES (?, ?)",
      [email, hashedPassword],
      function(err) {
        if (err) {
          return res.status(400).json({ error: "Email already exists" });
        }
        sendRegistrationEmail(email);
        res.status(201).json({ id: this.lastID });
      }
    );
  } catch (error) {
    res.status(500).json({ error: "Registration failed" });
  }
});

// Login endpoint
app.post("/login", (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  db.get("SELECT * FROM users WHERE email = ?", [email], async (err, user) => {
    if (err || !user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    try {
      if (await bcrypt.compare(password, user.password_hash)) {
        const accessToken = jwt.sign(
          { id: user.id, email: user.email },
          JWT_SECRET,
          { expiresIn: '1h' }
        );
        res.json({ accessToken });
      } else {
        res.status(401).json({ error: "Invalid credentials" });
      }
    } catch (error) {
      res.status(500).json({ error: "Login failed" });
    }
  });
});

// Upload endpoint
app.post("/upload", authenticateToken, handleUpload);

// Stats endpoints
app.get("/total-time", authenticateToken, (req, res) => {
  const query = "SELECT SUM(duration_ms) AS total_ms FROM track_plays WHERE user_id = ?";
  db.get(query, [req.user.id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: "Database query error" });
    }
    res.json({ total_time_ms: row.total_ms || 0 });
  });
});

app.get("/daily-time", authenticateToken, (req, res) => {
  const { year, month, day } = req.query;
  if (!year || !month || !day) {
    return res.status(400).json({ error: "Missing date parameters" });
  }

  const dateStr = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  const query = "SELECT SUM(duration_ms) AS total_ms FROM track_plays WHERE user_id = ? AND DATE(played_at) = ?";
  
  db.get(query, [req.user.id, dateStr], (err, row) => {
    if (err) {
      return res.status(500).json({ error: "Database query error" });
    }
    res.json({ date: dateStr, total_time_ms: row.total_ms || 0 });
  });
});

app.get("/archives", authenticateToken, (req, res) => {
  const query = "SELECT * FROM archives WHERE user_id = ? ORDER BY upload_date DESC";
  db.all(query, [req.user.id], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: "Database query error" });
    }
    res.json({ archives: rows });
  });
});

app.get("/stats", authenticateToken, (req, res) => {
  const queries = {
    topArtists: `
      SELECT 
        artist_name, 
        COUNT(*) as play_count,
        SUM(duration_ms) as total_time,
        GROUP_CONCAT(DISTINCT album_name) as albums,
        COUNT(DISTINCT platform) as platforms_used,
        SUM(CASE WHEN skipped = 1 THEN 1 ELSE 0 END) as skipped_count,
        SUM(CASE WHEN shuffle = 1 THEN 1 ELSE 0 END) as shuffle_count
      FROM track_plays
      WHERE user_id = ? AND artist_name IS NOT NULL
      GROUP BY artist_name
      ORDER BY play_count DESC
      LIMIT 10
    `,
    topTracks: `
      SELECT 
        track_name,
        artist_name,
        album_name,
        COUNT(*) as play_count,
        SUM(duration_ms) as total_time,
        spotify_track_uri,
        COUNT(DISTINCT platform) as platforms_used,
        SUM(CASE WHEN skipped = 1 THEN 1 ELSE 0 END) as skipped_count,
        SUM(CASE WHEN shuffle = 1 THEN 1 ELSE 0 END) as shuffle_count,
        GROUP_CONCAT(DISTINCT conn_country) as countries_played
      FROM track_plays
      WHERE user_id = ? AND track_name IS NOT NULL
      GROUP BY track_name, artist_name, album_name
      ORDER BY play_count DESC
      LIMIT 10
    `,
    topAlbums: `
      SELECT 
        album_name,
        artist_name,
        COUNT(*) as play_count,
        COUNT(DISTINCT track_name) as unique_tracks,
        SUM(duration_ms) as total_time
      FROM track_plays
      WHERE user_id = ? AND album_name IS NOT NULL
      GROUP BY album_name, artist_name
      ORDER BY play_count DESC
      LIMIT 10
    `,
    listeningPatterns: `
      SELECT 
        strftime('%H', played_at) as hour,
        COUNT(*) as play_count,
        SUM(duration_ms) as total_time,
        AVG(CASE WHEN shuffle = 1 THEN 1 ELSE 0 END) as shuffle_ratio,
        AVG(CASE WHEN skipped = 1 THEN 1 ELSE 0 END) as skip_ratio
      FROM track_plays
      WHERE user_id = ?
      GROUP BY hour
      ORDER BY hour
    `,
    platformStats: `
      SELECT 
        platform,
        COUNT(*) as play_count,
        COUNT(DISTINCT track_name) as unique_tracks,
        COUNT(DISTINCT artist_name) as unique_artists,
        SUM(duration_ms) as total_time,
        COUNT(DISTINCT conn_country) as countries_count,
        SUM(CASE WHEN skipped = 1 THEN 1 ELSE 0 END) as skipped_count,
        SUM(CASE WHEN shuffle = 1 THEN 1 ELSE 0 END) as shuffle_count,
        GROUP_CONCAT(DISTINCT conn_country) as countries
      FROM track_plays
      WHERE user_id = ? AND platform IS NOT NULL
      GROUP BY platform
      ORDER BY play_count DESC
    `,
    countryStats: `
      SELECT 
        conn_country,
        COUNT(*) as play_count,
        COUNT(DISTINCT track_name) as unique_tracks,
        COUNT(DISTINCT artist_name) as unique_artists,
        SUM(duration_ms) as total_time,
        COUNT(DISTINCT platform) as platforms_count,
        GROUP_CONCAT(DISTINCT platform) as platforms
      FROM track_plays
      WHERE user_id = ? AND conn_country IS NOT NULL
      GROUP BY conn_country
      ORDER BY play_count DESC
    `
  };

  const stats = {};
  let completed = 0;
  const totalQueries = Object.keys(queries).length;

  Object.entries(queries).forEach(([key, query]) => {
    db.all(query, [req.user.id], (err, rows) => {
      if (err) {
        console.error(`Error in ${key} query:`, err);
        stats[key] = [];
      } else {
        stats[key] = rows;
      }
      
      completed++;
      if (completed === totalQueries) {
        res.json(stats);
      }
    });
  });
});

// Clear Data endpoint
app.delete("/clear-data", authenticateToken, (req, res) => {
  db.serialize(() => {
    db.run("BEGIN TRANSACTION");
    
    db.run("DELETE FROM track_plays WHERE user_id = ?", [req.user.id], (err) => {
      if (err) {
        db.run("ROLLBACK");
        return res.status(500).json({ error: "Failed to clear track plays" });
      }
      
      db.run("DELETE FROM archives WHERE user_id = ?", [req.user.id], (err) => {
        if (err) {
          db.run("ROLLBACK");
          return res.status(500).json({ error: "Failed to clear archives" });
        }
        
        db.run("COMMIT", (err) => {
          if (err) {
            db.run("ROLLBACK");
            return res.status(500).json({ error: "Failed to commit changes" });
          }
          
          // Delete files after successful database clear
          const uploadsDir = path.join(__dirname, "uploads");
          if (fs.existsSync(uploadsDir)) {
            fs.readdir(uploadsDir, (err, files) => {
              if (!err) {
                files.forEach(file => {
                  const filePath = path.join(uploadsDir, file);
                  fs.unlink(filePath, err => {
                    if (err) console.error(`Error deleting file ${file}:`, err);
                  });
                });
              }
            });
          }
          
          res.json({ message: "All data cleared successfully" });
        });
      });
    });
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
