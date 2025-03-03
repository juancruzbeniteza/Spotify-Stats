const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");
const { format } = require('date-fns');
const spotifyAPI = require('./spotifyAPI');
const handleUpload = require('./uploadHandler');

const app = express();
const PORT = 5000;
const JWT_SECRET = process.env.JWT_SECRET || "spotify_stats_secret";

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

// Create tables
db.serialize(() => {
  // Create users table
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL
  )`);
  
  // Create spotify_tokens table
  db.run(`CREATE TABLE IF NOT EXISTS spotify_tokens (
    user_id INTEGER PRIMARY KEY,
    access_token TEXT,
    refresh_token TEXT,
    token_expiry DATETIME,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);
  
  // Create archives table
  db.run(`CREATE TABLE IF NOT EXISTS archives (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    file_path TEXT NOT NULL,
    upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);
  
  // Create track_plays table
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

  // Create indices for faster lookups and better data handling
  db.serialize(() => {
    // Index for deduplication
    db.run(`CREATE INDEX IF NOT EXISTS idx_track_plays_dedup ON track_plays (
      user_id,
      master_metadata_track_name,
      master_metadata_album_artist_name,
      played_at,
      duration_ms
    )`);

    // Index for artist stats
    db.run(`CREATE INDEX IF NOT EXISTS idx_track_plays_artist ON track_plays (
      user_id,
      master_metadata_album_artist_name,
      duration_ms,
      platform,
      skipped,
      shuffle
    )`);

    // Index for track stats
    db.run(`CREATE INDEX IF NOT EXISTS idx_track_plays_track ON track_plays (
      user_id,
      master_metadata_track_name,
      master_metadata_album_artist_name,
      master_metadata_album_album_name,
      duration_ms,
      platform,
      conn_country,
      skipped,
      shuffle
    )`);

    // Index for album stats
    db.run(`CREATE INDEX IF NOT EXISTS idx_track_plays_album ON track_plays (
      user_id,
      master_metadata_album_album_name,
      master_metadata_album_artist_name,
      master_metadata_track_name,
      duration_ms
    )`);

    // Index for platform stats
    db.run(`CREATE INDEX IF NOT EXISTS idx_track_plays_platform ON track_plays (
      user_id,
      platform,
      master_metadata_track_name,
      master_metadata_album_artist_name,
      duration_ms,
      conn_country,
      skipped,
      shuffle
    )`);

    // Index for country stats
    db.run(`CREATE INDEX IF NOT EXISTS idx_track_plays_country ON track_plays (
      user_id,
      conn_country,
      master_metadata_track_name,
      master_metadata_album_artist_name,
      duration_ms,
      platform
    )`);

    // Index for listening patterns
    db.run(`CREATE INDEX IF NOT EXISTS idx_track_plays_patterns ON track_plays (
      user_id,
      played_at,
      master_metadata_track_name,
      duration_ms,
      shuffle,
      skipped
    )`);
  });
});

// Spotify auth endpoints
app.get('/spotify/auth', authenticateToken, (req, res) => {
  const authUrl = spotifyAPI.getAuthUrl();
  res.json({ url: authUrl });
});

app.get('/callback', async (req, res) => {
  const { code, state } = req.query;
  
  try {
    const tokens = await spotifyAPI.getAccessToken(code);
    const decoded = jwt.verify(state, JWT_SECRET);
    
    // Store tokens in database
    await new Promise((resolve, reject) => {
      const expiryDate = new Date(Date.now() + tokens.expiresIn * 1000).toISOString();
      db.run(
        `INSERT OR REPLACE INTO spotify_tokens (user_id, access_token, refresh_token, token_expiry)
         VALUES (?, ?, ?, ?)`,
        [decoded.id, tokens.accessToken, tokens.refreshToken, expiryDate],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    res.redirect('http://localhost:3000/stats');
  } catch (error) {
    console.error('Error in callback:', error);
    res.redirect('http://localhost:3000/error');
  }
});

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
  const query = `
    SELECT SUM(duration_ms) AS total_ms 
    FROM track_plays 
    WHERE user_id = ? 
      AND duration_ms > 0
      AND master_metadata_track_name IS NOT NULL 
      AND master_metadata_track_name != ''`;
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
  const query = `
    SELECT SUM(duration_ms) AS total_ms 
    FROM track_plays 
    WHERE user_id = ? 
      AND DATE(played_at) = ?
      AND duration_ms > 0
      AND master_metadata_track_name IS NOT NULL 
      AND master_metadata_track_name != ''`;
  
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
      WITH artist_stats AS (
        SELECT 
          master_metadata_album_artist_name as artist_name,
          COUNT(*) as play_count,
          SUM(duration_ms) as total_time,
          GROUP_CONCAT(DISTINCT master_metadata_album_album_name) as albums,
          COUNT(DISTINCT platform) as platforms_used,
          SUM(CASE WHEN skipped = 1 THEN 1 ELSE 0 END) as skipped_count,
          SUM(CASE WHEN shuffle = 1 THEN 1 ELSE 0 END) as shuffle_count,
          ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC, SUM(duration_ms) DESC) as rank
        FROM track_plays
        WHERE user_id = ? 
          AND master_metadata_album_artist_name IS NOT NULL
          AND master_metadata_album_artist_name != ''
        GROUP BY master_metadata_album_artist_name
      )
      SELECT * FROM artist_stats WHERE rank <= 10
    `,
    topTracks: `
      WITH track_stats AS (
        SELECT 
          master_metadata_track_name as track_name,
          master_metadata_album_artist_name as artist_name,
          master_metadata_album_album_name as album_name,
          COUNT(*) as play_count,
          SUM(duration_ms) as total_time,
          spotify_track_uri,
          COUNT(DISTINCT platform) as platforms_used,
          SUM(CASE WHEN skipped = 1 THEN 1 ELSE 0 END) as skipped_count,
          SUM(CASE WHEN shuffle = 1 THEN 1 ELSE 0 END) as shuffle_count,
          GROUP_CONCAT(DISTINCT conn_country) as countries_played,
          ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC, SUM(duration_ms) DESC) as rank
        FROM track_plays
        WHERE user_id = ? 
          AND master_metadata_track_name IS NOT NULL 
          AND master_metadata_track_name != ''
          AND master_metadata_album_artist_name IS NOT NULL
          AND master_metadata_album_artist_name != ''
        GROUP BY 
          master_metadata_track_name, 
          master_metadata_album_artist_name, 
          master_metadata_album_album_name
      )
      SELECT * FROM track_stats WHERE rank <= 10
    `,
    topAlbums: `
      WITH album_stats AS (
        SELECT 
          master_metadata_album_album_name as album_name,
          master_metadata_album_artist_name as artist_name,
          COUNT(*) as play_count,
          COUNT(DISTINCT master_metadata_track_name) as unique_tracks,
          SUM(duration_ms) as total_time,
          ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC, SUM(duration_ms) DESC) as rank
        FROM track_plays
        WHERE user_id = ? 
          AND master_metadata_album_album_name IS NOT NULL 
          AND master_metadata_album_album_name != ''
          AND master_metadata_album_artist_name IS NOT NULL
          AND master_metadata_album_artist_name != ''
        GROUP BY 
          master_metadata_album_album_name,
          master_metadata_album_artist_name
      )
      SELECT * FROM album_stats WHERE rank <= 10
    `,
    listeningPatterns: `
      WITH pattern_stats AS (
        SELECT 
          strftime('%H', played_at) as hour,
          COUNT(*) as play_count,
          SUM(duration_ms) as total_time,
          AVG(CASE WHEN shuffle = 1 THEN 1 ELSE 0 END) as shuffle_ratio,
          AVG(CASE WHEN skipped = 1 THEN 1 ELSE 0 END) as skip_ratio,
          ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC) as rank
        FROM track_plays
        WHERE user_id = ? 
          AND played_at IS NOT NULL
          AND master_metadata_track_name IS NOT NULL
          AND master_metadata_track_name != ''
        GROUP BY hour
      )
      SELECT 
        hour,
        play_count,
        total_time,
        shuffle_ratio,
        skip_ratio
      FROM pattern_stats 
      ORDER BY CAST(hour AS INTEGER)
    `,
    platformStats: `
      WITH platform_stats AS (
        SELECT 
          platform,
          COUNT(*) as play_count,
          COUNT(DISTINCT master_metadata_track_name) as unique_tracks,
          COUNT(DISTINCT master_metadata_album_artist_name) as unique_artists,
          SUM(duration_ms) as total_time,
          COUNT(DISTINCT conn_country) as countries_count,
          SUM(CASE WHEN skipped = 1 THEN 1 ELSE 0 END) as skipped_count,
          SUM(CASE WHEN shuffle = 1 THEN 1 ELSE 0 END) as shuffle_count,
          GROUP_CONCAT(DISTINCT conn_country) as countries,
          ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC, SUM(duration_ms) DESC) as rank
        FROM track_plays
        WHERE user_id = ? 
          AND platform IS NOT NULL 
          AND platform != ''
        GROUP BY platform
      )
      SELECT * FROM platform_stats WHERE rank <= 10
    `,
    countryStats: `
      WITH country_stats AS (
        SELECT 
          conn_country,
          COUNT(*) as play_count,
          COUNT(DISTINCT master_metadata_track_name) as unique_tracks,
          COUNT(DISTINCT master_metadata_album_artist_name) as unique_artists,
          SUM(duration_ms) as total_time,
          COUNT(DISTINCT platform) as platforms_count,
          GROUP_CONCAT(DISTINCT platform) as platforms,
          ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC, SUM(duration_ms) DESC) as rank
        FROM track_plays
        WHERE user_id = ? 
          AND conn_country IS NOT NULL 
          AND conn_country != ''
        GROUP BY conn_country
      )
      SELECT * FROM country_stats WHERE rank <= 10
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
    
    // First, remove duplicate entries keeping only the first occurrence
    db.run(`
      DELETE FROM track_plays 
      WHERE id NOT IN (
        SELECT MIN(id)
        FROM track_plays
        WHERE user_id = ?
          AND duration_ms > 0
          AND master_metadata_track_name IS NOT NULL 
          AND master_metadata_track_name != ''
          AND master_metadata_album_artist_name IS NOT NULL
          AND master_metadata_album_artist_name != ''
        GROUP BY 
          master_metadata_track_name,
          master_metadata_album_artist_name,
          master_metadata_album_album_name,
          played_at,
          duration_ms,
          platform,
          conn_country,
          spotify_track_uri
      )
      AND user_id = ?
    `, [req.user.id, req.user.id], (err) => {
      if (err) {
        db.run("ROLLBACK");
        return res.status(500).json({ error: "Failed to deduplicate track plays" });
      }

      // Then delete all remaining entries
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
});

// Function to store track play data
const storeTrackPlay = (db, trackData) => {
  return new Promise((resolve, reject) => {
    const query = `
      INSERT INTO track_plays (
        user_id, track_name, artist_name, album_name, played_at,
        duration_ms, platform, spotify_track_uri,
        master_metadata_track_name, master_metadata_album_artist_name,
        master_metadata_album_album_name, shuffle, offline, incognito_mode
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      trackData.user_id,
      trackData.track_name,
      trackData.artist_name,
      trackData.album_name,
      trackData.played_at,
      trackData.duration_ms,
      trackData.platform,
      trackData.spotify_track_uri,
      trackData.master_metadata_track_name,
      trackData.master_metadata_album_artist_name,
      trackData.master_metadata_album_album_name,
      trackData.shuffle ? 1 : 0,
      trackData.offline ? 1 : 0,
      trackData.incognito_mode ? 1 : 0
    ];

    db.run(query, params, function(err) {
      if (err) {
        console.error('Error storing track play:', err);
        reject(err);
      } else {
        resolve(this.lastID);
      }
    });
  });
};

// Function to refresh expired tokens
const refreshTokenIfNeeded = async (userId, tokenData) => {
  if (!tokenData) return null;
  
  const now = new Date();
  const expiry = new Date(tokenData.token_expiry);
  
  if (now >= expiry) {
    try {
      const newTokens = await spotifyAPI.refreshAccessToken(tokenData.refresh_token);
      const newExpiry = new Date(Date.now() + newTokens.expiresIn * 1000).toISOString();
      
      await new Promise((resolve, reject) => {
        db.run(
          `UPDATE spotify_tokens 
           SET access_token = ?, token_expiry = ? 
           WHERE user_id = ?`,
          [newTokens.accessToken, newExpiry, userId],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });
      
      return newTokens.accessToken;
    } catch (error) {
      console.error('Error refreshing token:', error);
      return null;
    }
  }
  
  return tokenData.access_token;
};

// Magic Loop to collect live Spotify play data
const startSpotifyDataCollection = (db) => {
  const userLastTracks = new Map(); // Store last track info per user

  const collectData = async () => {
    try {
      // Get all users with Spotify tokens
      const users = await new Promise((resolve, reject) => {
        db.all(
          `SELECT u.id, st.access_token, st.refresh_token, st.token_expiry
           FROM users u
           JOIN spotify_tokens st ON u.id = st.user_id`,
          [],
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          }
        );
      });

      // Collect data for each user
      for (const user of users) {
        const accessToken = await refreshTokenIfNeeded(user.id, user);
        if (!accessToken) continue;

        const trackData = await spotifyAPI.getCurrentPlayback(user.id, accessToken);
        
        if (trackData) {
          const lastTrack = userLastTracks.get(user.id);
          
          if (!lastTrack || 
              trackData.spotify_track_uri !== lastTrack.uri || 
              new Date(trackData.played_at) - new Date(lastTrack.time) >= 30000) {
            
            await storeTrackPlay(db, trackData);
            
            // Update last track info for this user
            userLastTracks.set(user.id, {
              uri: trackData.spotify_track_uri,
              time: trackData.played_at
            });

            console.log(`Stored play data for user ${user.id}: ${trackData.track_name} by ${trackData.artist_name}`);
          }
        }
      }
    } catch (error) {
      console.error('Error in data collection loop:', error);
    }
  };

  // Run the collection every 30 seconds
  setInterval(collectData, 30000);
  
  // Run immediately on start
  collectData();
};

// Start server and initialize data collection
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  startSpotifyDataCollection(db);
  console.log('Started Spotify data collection loop');
});
