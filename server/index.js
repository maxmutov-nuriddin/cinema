import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, '../public');
const MOVIES_PATH = path.join(__dirname, 'data/movies.json');
const SEATS_PATH = path.join(__dirname, 'data/seats.json');

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.mjs': 'application/javascript; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4'
};

let runtimeSeatsData = null;
function getSeatsData() {
  if (!runtimeSeatsData) {
    const raw = fs.readFileSync(SEATS_PATH, 'utf8');
    runtimeSeatsData = JSON.parse(raw);
  }
  return runtimeSeatsData;
}

const roomSpecs = {
  name: "Grand IMAX Laser Hall 1",
  city: "Tashkent",
  specs: {
    screen: {
      type: "24m Curved IMAX Silver Screen 4K Dual Laser",
      curvatureRadius: 32,
      widthMeters: 24,
      heightMeters: 11.2,
      gain: 2.4
    },
    audio: {
      system: "Dolby Atmos 128-Channel Spatial Audio",
      subwoofers: "4x 21-inch infrasonic drivers (16Hz)",
      monitors: "64 side, ceiling and rear surround channels"
    }
  },
  cameraPresets: [
    { id: "default", name: "Auditorium Walkthrough", position: { x: 0, y: 5.6, z: 23 }, target: { x: 0, y: 4.8, z: -10 } },
    { id: "vip", name: "VIP Director's Balcony", position: { x: 0, y: 9.8, z: 26 }, target: { x: 0, y: 4.5, z: -10 } },
    { id: "center", name: "Sweet Spot (Row C)", position: { x: 0, y: 3.8, z: 12 }, target: { x: 0, y: 4.8, z: -10 } },
    { id: "front", name: "Front Row IMAX Immersion", position: { x: 0, y: 2.4, z: 4.5 }, target: { x: 0, y: 5.2, z: -10 } }
  ]
};

function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=UTF-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  // 1. API: Health
  if (pathname === '/api/health') {
    return sendJSON(res, 200, {
      status: 'online',
      system: 'Onyx Horizon Commercial 3D Cinema Engine',
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    });
  }

  // 2. API: Movies Catalog
  if (pathname === '/api/movies') {
    try {
      const raw = fs.readFileSync(MOVIES_PATH, 'utf8');
      const movies = JSON.parse(raw);
      return sendJSON(res, 200, { success: true, count: movies.length, data: movies });
    } catch (e) {
      return sendJSON(res, 500, { success: false, error: 'Could not load movies' });
    }
  }

  // 3. API: Seating & Snacks
  if (pathname === '/api/seats') {
    return sendJSON(res, 200, { success: true, data: getSeatsData() });
  }

  // 4. API: Book Seats & Snacks with Real Ticket Generation
  if (pathname === '/api/seats/book' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const { seats, snacks, movieId, showtime, showdate, customerName, phone, paymentMethod } = body;

      if (!seats || !Array.isArray(seats) || seats.length === 0) {
        return sendJSON(res, 400, { success: false, error: 'Hech bo\'lmasa 1 ta joy tanlang' });
      }

      const data = getSeatsData();
      const booked = [];
      const conflicts = [];

      seats.forEach(seatKey => {
        const parts = seatKey.split('-');
        const rowName = parts[0];
        const seatNum = parseInt(parts[1], 10);
        const targetRow = data.rows.find(r => r.row === rowName);
        if (targetRow) {
          if (targetRow.occupied.includes(seatNum)) {
            conflicts.push(seatKey);
          } else {
            targetRow.occupied.push(seatNum);
            booked.push({ seatKey, row: rowName, number: seatNum, type: targetRow.type, price: targetRow.price });
          }
        }
      });

      if (conflicts.length > 0 && booked.length === 0) {
        return sendJSON(res, 409, {
          success: false,
          error: 'Ushbu joylar boshqa tomoshabin tomonidan band qilindi',
          conflicts
        });
      }

      const seatsTotal = booked.reduce((sum, item) => sum + item.price, 0);

      // Calculate snacks if any
      let snacksTotal = 0;
      const snacksBooked = [];
      if (snacks && Array.isArray(snacks)) {
        snacks.forEach(s => {
          const item = data.snacksMenu.find(m => m.id === s.id);
          if (item) {
            const qty = s.quantity || 1;
            snacksTotal += item.price * qty;
            snacksBooked.push({ name: item.name, quantity: qty, price: item.price * qty });
          }
        });
      }

      const grandTotal = seatsTotal + snacksTotal;
      const ticketRef = 'IMAX-' + Math.floor(100000 + Math.random() * 900000);
      const qrData = `TICKET:${ticketRef}|SEATS:${booked.map(b => b.seatKey).join(',')}|SUM:${grandTotal}|DATE:${showdate || '28-Oct'}`;

      return sendJSON(res, 200, {
        success: true,
        message: 'Chiptalar muvaffaqiyatli rasmiylashtirildi!',
        booking: {
          ticketRef,
          customerName: customerName || 'Hurmatli Mehmon',
          phone: phone || '+998 90 123 45 67',
          paymentMethod: paymentMethod || 'Payme / Click',
          movieId: movieId || 'movie-1',
          hall: 'Grand IMAX Laser Hall 1',
          showdate: showdate || 'Bugun, 28-Oktabr',
          showtime: showtime || '21:30',
          seats: booked,
          snacks: snacksBooked,
          seatsTotal,
          snacksTotal,
          grandTotal,
          currency: 'UZS',
          qrData,
          issuedAt: new Date().toISOString()
        }
      });
    } catch (e) {
      return sendJSON(res, 500, { success: false, error: 'Xatolik yuz berdi' });
    }
  }

  // 5. API: Room Specs
  if (pathname === '/api/room') {
    return sendJSON(res, 200, { success: true, data: roomSpecs });
  }

  // 6. Static File Serving from /public
  let relativeFilePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  let filePath = path.join(PUBLIC_DIR, relativeFilePath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(PUBLIC_DIR, 'index.html');
  }

  try {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const content = fs.readFileSync(filePath);

    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': content.length,
      'Cache-Control': 'no-cache'
    });
    res.end(content);
  } catch (err) {
    res.writeHead(500);
    res.end('Internal Server Error');
  }
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`\n⚠️ Port ${PORT} band, server boshqa jarayonda ishlab turibdi.`);
  } else {
    console.error(err);
  }
});

server.listen(PORT, () => {
  console.log('\n======================================================');
  console.log(`🎬 3D CINEMA ROOM IS RUNNING!`);
  console.log(`👉 BROWSER URL: http://localhost:${PORT}`);
  console.log('======================================================\n');
});
