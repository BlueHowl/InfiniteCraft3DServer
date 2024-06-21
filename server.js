const express = require('express');
const axios = require('axios');
const morgan = require('morgan');
const sqlite3 = require('better-sqlite3');
require('dotenv').config();

const app = express();

// Use morgan to log requests
app.use(morgan('dev'));

// Middleware to handle CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Middleware to parse JSON requests
app.use(express.json());


//SQLite3
const db = new sqlite3('./mydb.sqlite');

// Create a table for storing combinations
db.transaction(() => {
  db.exec(`CREATE TABLE IF NOT EXISTS combinations (
    str1 TEXT CHECK(length(str1) <= 100),
    str2 TEXT CHECK(length(str2) <= 100),
    cnId TEXT,
    PRIMARY KEY (str1, str2)
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS craftnode (
    id TEXT PRIMARY KEY,
    text TEXT CHECK(length(text) <= 100),
    emoji Text CHECK(length(emoji) <= 64),
    tags Text NULL,
    modelUrl TEXT NULL CHECK(length(modelUrl) <= 255),
    previewUrl TEXT NULL CHECK(length(previewUrl) <= 255)
  )`);
});


// API endpoint to create a new 3D model
app.post('/api/text-to-voxel', async (req, res) => {
  try {
    const response = await axios.post('https://api.meshy.ai/v1/text-to-voxel', req.body, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.MESHY_API_KEY}`
      }
    });
    res.status(response.status).json(response.data);
  } catch (error) {
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// API endpoint to get a 3D model by ID
app.get('/api/text-to-voxel/:id', async (req, res) => {
  try {
    const response = await axios.get(`https://api.meshy.ai/v1/text-to-voxel/${req.params.id}`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer msy_DIMG5PB47ejZ8NfvOlkTFtSq84lZTgqmGZlH'
      }
    });
    res.status(response.status).json(response.data);
  } catch (error) {
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});


// API endpoint to check if a combination exists
app.get('/api/check-combination', (req, res) => {
  const { str1, str2 } = req.query;

  const stmt = db.prepare('SELECT * FROM combinations WHERE (str1 = ? AND str2 = ?) OR (str1 = ? AND str2 = ?)');
  const row = stmt.get([str1, str2, str2, str1]);

  if (row) {
    const craftnodeStmt = db.prepare('SELECT * FROM craftnode WHERE id = ?');
    const cnRow = craftnodeStmt.get([row.cnId]);

    if (cnRow) {
      return res.json({ exists: true, result: cnRow });
    } else {
      return res.json({ exists: false });
    }
  } else {
    return res.json({ exists: false });
  }
});


// API endpoint to check if a craftnode with the same string result exists
app.get('/api/check-craftnode', (req, res) => {
  const { text } = req.query;

  const stmt = db.prepare('SELECT * FROM craftnode WHERE text = ?');
  const row = stmt.get([text]);

  if (row) {
    return res.json({ exists: true, result: row });
  } else {
    return res.json({ exists: false });
  }
});

// API endpoint to store a combination
app.post('/api/store-combination', (req, res) => {
  const { str1, str2, craftNode } = req.body;
  const { id, text, emoji, tags, previewUrl, modelUrl } = craftNode;

  // Check if the craftNode already exists
  const craftnodeStmt = db.prepare('SELECT id FROM craftnode WHERE text = ?');
  const row = craftnodeStmt.get([text]);

  if (row) {
    // If the craftNode exists, use its id
    const cnId = row.id;
    const combinationsStmt = db.prepare('INSERT INTO combinations (str1, str2, cnId) VALUES (?, ?, ?)');
    combinationsStmt.run([str1, str2, cnId]);
    return res.status(201).json({ message: 'Combination stored with existing craftNode' });
  } else {
    const craftnodeStmt = db.prepare('INSERT INTO craftnode (id, text, emoji, tags, modelUrl, previewUrl) VALUES (?, ?, ?, ?, ?, ?)');
    craftnodeStmt.run([id, text, emoji, tags, modelUrl, previewUrl]);

    const combinationsStmt = db.prepare('INSERT INTO combinations (str1, str2, cnId) VALUES (?, ?, ?)');
    combinationsStmt.run([str1, str2, id]);
    return res.status(201).json({ message: 'Combination stored with new craftNode' });
  }
});



// Start the server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`);
});
