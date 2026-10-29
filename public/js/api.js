// API Service for communicating with Node.js backend & Netlify Static / Serverless hosting
const STORAGE_KEY_SEATS = 'lumiere_booked_seats';

export const api = {
  async getMovies() {
    try {
      const res = await fetch('/api/movies');
      if (res.ok) return await res.json();
    } catch (_) {}

    // Netlify Static Fallback
    const staticRes = await fetch('/data/movies.json');
    const data = await staticRes.json();
    return { success: true, data };
  },

  async getSeats() {
    try {
      const res = await fetch('/api/seats');
      if (res.ok) return await res.json();
    } catch (_) {}

    // Netlify Static Fallback with LocalStorage Persistence
    const staticRes = await fetch('/data/seats.json');
    const data = await staticRes.json();

    try {
      const localBooked = JSON.parse(localStorage.getItem(STORAGE_KEY_SEATS) || '[]');
      if (Array.isArray(localBooked) && localBooked.length > 0) {
        localBooked.forEach(seatId => {
          const [row, numStr] = seatId.split('-');
          const num = parseInt(numStr, 10);
          const rObj = data.rows.find(r => r.row === row);
          if (rObj && !rObj.occupied.includes(num)) {
            rObj.occupied.push(num);
          }
        });
      }
    } catch (_) {}

    return { success: true, data };
  },

  async getRoomSpecs() {
    try {
      const res = await fetch('/api/room');
      if (res.ok) return await res.json();
    } catch (_) {}

    return {
      success: true,
      data: {
        name: "Lumiere Grand Auditorium 01",
        screen: "22m Curved Laser Screen",
        sound: "Dolby Atmos 128ch Spatial Audio"
      }
    };
  },

  async bookSeats(bookingData) {
    try {
      const res = await fetch('/api/seats/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bookingData)
      });
      if (res.ok) return await res.json();
    } catch (_) {}

    // Netlify Static Fallback
    try {
      const localBooked = JSON.parse(localStorage.getItem(STORAGE_KEY_SEATS) || '[]');
      (bookingData.seatIds || []).forEach(id => {
        if (!localBooked.includes(id)) localBooked.push(id);
      });
      localStorage.setItem(STORAGE_KEY_SEATS, JSON.stringify(localBooked));
    } catch (_) {}

    return {
      success: true,
      bookingId: 'LUM-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
      message: 'Tickets successfully booked!',
      bookedSeats: bookingData.seatIds,
      totalAmount: bookingData.totalAmount
    };
  },

  async resetSeats() {
    try {
      const res = await fetch('/api/seats/reset', { method: 'POST' });
      if (res.ok) return await res.json();
    } catch (_) {}

    try {
      localStorage.removeItem(STORAGE_KEY_SEATS);
    } catch (_) {}

    return { success: true, message: 'All seats reset to initial state' };
  }
};
