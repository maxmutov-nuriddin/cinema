import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const moviesPath = path.join(__dirname, '../data/movies.json');

// Get all movies
router.get('/', (req, res) => {
  try {
    const rawData = fs.readFileSync(moviesPath, 'utf8');
    const movies = JSON.parse(rawData);
    res.json({ success: true, count: movies.length, data: movies });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to load movie catalog' });
  }
});

// Get movie by ID
router.get('/:id', (req, res) => {
  try {
    const rawData = fs.readFileSync(moviesPath, 'utf8');
    const movies = JSON.parse(rawData);
    const movie = movies.find(m => m.id === req.params.id);
    if (!movie) {
      return res.status(404).json({ success: false, error: 'Movie not found' });
    }
    res.json({ success: true, data: movie });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to load movie details' });
  }
});

export default router;

