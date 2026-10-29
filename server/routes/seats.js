import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seatsPath = path.join(__dirname, '../data/seats.json');

// In-memory runtime state populated from file
let runtimeSeatsData = null;

function loadSeats() {
  if (!runtimeSeatsData) {
    const raw = fs.readFileSync(seatsPath, 'utf8');
    runtimeSeatsData = JSON.parse(raw);
  }
  return runtimeSeatsData;
}

// Get all seats and current occupancy
router.get('/', (req, res) => {
  try {
    const data = loadSeats();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Could not load seating data' });
  }
});

// Book seats
router.post('/book', (req, res) => {
  try {
    const { seats, movieId, showtime, customerName } = req.body;
    if (!seats || !Array.isArray(seats) || seats.length === 0) {
      return res.status(400).json({ success: false, error: 'No seats selected' });
    }

    const data = loadSeats();
    const booked = [];
    const conflicts = [];

    seats.forEach(seatKey => {
      // Format expected: "C-5" (Row C, Seat 5)
      const parts = seatKey.split('-');
      const rowName = parts[0];
      const seatNum = parseInt(parts[1], 10);

      const targetRow = data.rows.find(r => r.row === rowName);
      if (targetRow) {
        if (targetRow.occupied.includes(seatNum)) {
          conflicts.push(seatKey);
        } else {
          targetRow.occupied.push(seatNum);
          booked.push({ seatKey, row: rowName, number: seatNum, price: targetRow.price });
        }
      }
    });

    if (conflicts.length > 0 && booked.length === 0) {
      return res.status(409).json({
        success: false,
        error: 'Selected seats already booked by another viewer',
        conflicts
      });
    }

    const totalPrice = booked.reduce((sum, item) => sum + item.price, 0);
    const bookingReference = 'TK-' + Math.random().toString(36).substring(2, 9).toUpperCase();

    res.json({
      success: true,
      message: 'Tickets confirmed successfully!',
      booking: {
        reference: bookingReference,
        customerName: customerName || 'VIP Guest',
        movieId: movieId || 'movie-1',
        showtime: showtime || '20:45',
        seats: booked.map(b => b.seatKey),
        totalPrice,
        timestamp: new Date().toISOString()
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Booking failed due to server error' });
  }
});

// Reset seats to initial state
router.post('/reset', (req, res) => {
  runtimeSeatsData = null;
  res.json({ success: true, message: 'Seats reinitialized to default' });
});

export default router;

