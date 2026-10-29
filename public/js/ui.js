// LUMIERE GRAND CINEMA - UI & Interaction Orchestrator (Matching Video)
import { api } from './api.js';
import { soundEngine } from './audio.js';

export class UIManager {
  constructor(scene, parallax) {
    this.scene = scene;
    this.parallax = parallax;

    this.movies = [];
    this.currentMovie = null;
    this.seatsConfig = null;
    this.selectedSeatsData = [];
    this.selectedDate = "Today (Oct 29)";
    this.selectedShowtime = "13:00";
    this.lastSelectedChairMesh = null;

    // DOM Elements - Header
    this.tourAuditoriumBtn = document.getElementById('tour-auditorium-btn');
    this.fullscreenBtn = document.getElementById('fullscreen-btn');
    this.soundToggleBtn = document.getElementById('sound-toggle-btn');

    // DOM Elements - Left Overlay
    this.dpadUp = document.getElementById('dpad-up');
    this.dpadDown = document.getElementById('dpad-down');
    this.dpadLeft = document.getElementById('dpad-left');
    this.dpadRight = document.getElementById('dpad-right');
    this.dpadZoomIn = document.getElementById('dpad-zoom-in');
    this.dpadZoomOut = document.getElementById('dpad-zoom-out');

    // DOM Elements - Bottom Carousel
    this.carouselCounterEl = document.getElementById('carousel-counter');
    this.bottomMoviesTrackEl = document.getElementById('bottom-movies-track');

    // DOM Elements - Right Sidebar
    this.sidebarGenreEl = document.getElementById('sidebar-film-genre');
    this.sidebarTitleEl = document.getElementById('sidebar-film-title');
    this.sidebarBadgeEl = document.getElementById('sidebar-badge');
    this.sidebarDateCardsEl = document.getElementById('sidebar-date-cards');
    this.sidebarShowtimePillsEl = document.getElementById('sidebar-showtime-pills');
    this.openSeatmapBtn = document.getElementById('open-seatmap-btn');
    this.povPreviewBtn = document.getElementById('pov-preview-btn');
    this.selectedBadgesListEl = document.getElementById('selected-seats-badge-list');
    this.perTicketPriceEl = document.getElementById('per-ticket-price-text');
    this.totalAmountEl = document.getElementById('sidebar-total-amount');
    this.selectSeatsCtaBtn = document.getElementById('sidebar-select-seats-btn');

    // DOM Elements - 2D Seat Map Modal (Frame 4)
    this.seatmapModalEl = document.getElementById('seatmap-modal');
    this.closeSeatmapBtn = document.getElementById('close-seatmap-btn');
    this.seatmapSubinfoEl = document.getElementById('seatmap-modal-subinfo');
    this.seatmapGridEl = document.getElementById('seatmap-interactive-grid');
    this.confirmSeatmapBtn = document.getElementById('confirm-seatmap-btn');

    // DOM Elements - Checkout Modal
    this.checkoutModalEl = document.getElementById('checkout-modal');
    this.cancelCheckoutBtn = document.getElementById('cancel-checkout-btn');
    this.payConfirmBtn = document.getElementById('pay-confirm-btn');
    this.checkoutReceiptContentEl = document.getElementById('checkout-receipt-content');

    this.tooltipEl = document.getElementById('seat-tooltip');

    this.initEventListeners();
  }

  async loadInitialData() {
    try {
      const [moviesRes, seatsRes] = await Promise.all([
        api.getMovies(),
        api.getSeats()
      ]);

      if (moviesRes.success) {
        this.movies = moviesRes.data;
        this.renderBottomMovieCarousel();
        this.selectMovie(this.movies[0], 0);
      }

      if (seatsRes.success) {
        this.seatsConfig = seatsRes.data;
        this.scene.loadSeatsData(this.seatsConfig);
        this.render2DSeatMapGrid();
      }
    } catch (err) {
      console.error('Failed to load cinema data:', err);
    }
  }

  // 1. Bottom Movie Card Carousel (Matching Video Frame 1 & 2)
  renderBottomMovieCarousel() {
    this.bottomMoviesTrackEl.innerHTML = '';
    this.movies.forEach((movie, idx) => {
      const card = document.createElement('div');
      card.className = `movie-thumb-card ${idx === 0 ? 'active' : ''}`;
      card.innerHTML = `
        <div class="card-img-placeholder">🎬</div>
        <div class="card-text-block">
          <span class="card-movie-title">${movie.title}</span>
          <span class="card-movie-genre">${movie.genre}</span>
        </div>
      `;

      card.addEventListener('click', () => {
        soundEngine.playUiHover();
        this.selectMovie(movie, idx);
        document.querySelectorAll('.movie-thumb-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
      });

      this.bottomMoviesTrackEl.appendChild(card);
    });
  }

  selectMovie(movie, idx = 0) {
    this.currentMovie = movie;
    if (this.carouselCounterEl) {
      this.carouselCounterEl.innerText = `Choose a movie ${idx + 1} / ${this.movies.length}`;
    }

    this.sidebarTitleEl.innerText = movie.title;
    this.sidebarGenreEl.innerText = movie.genre;
    this.sidebarBadgeEl.innerText = movie.badge || "Feature Presentation";
    this.perTicketPriceEl.innerText = `Per ticket ${(movie.ticketPrice || 95000).toLocaleString()} UZS`;

    // Render Dates
    this.renderSidebarDates(movie.dates || ["Today (Oct 29)", "Fri (Oct 30)", "Sat (Oct 31)", "Sun (Nov 01)"]);

    // Render Showtimes
    this.renderSidebarShowtimes(movie.showtimes || ["13:00", "16:15", "19:00", "22:00"]);

    // Update 3D screen poster/trailer and hanging clock
    this.scene.setMovieTheme(movie.screenScene, this.selectedShowtime);

    this.updateSeatmapModalInfo();
    this.updatePriceCalculations();
  }

  // 2. Render Show Dates (4 Rectangular Cards)
  renderSidebarDates(dates) {
    this.sidebarDateCardsEl.innerHTML = '';
    dates.forEach((dateStr, idx) => {
      const parts = dateStr.split(' ');
      const dayName = parts[0];
      const dateVal = parts.slice(1).join(' ').replace(/[()]/g, '');

      const card = document.createElement('div');
      card.className = `date-card ${idx === 0 ? 'active' : ''}`;
      card.innerHTML = `
        <span class="date-day">${dayName}</span>
        <span class="date-val">${dateVal}</span>
      `;

      card.addEventListener('click', () => {
        soundEngine.playUiHover();
        document.querySelectorAll('.date-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        this.selectedDate = dateStr;
        this.updateSeatmapModalInfo();
      });

      this.sidebarDateCardsEl.appendChild(card);
    });
    this.selectedDate = dates[0];
  }

  // 3. Render Showtimes (Clicking updates 3D Hanging Clock!)
  renderSidebarShowtimes(showtimes) {
    this.sidebarShowtimePillsEl.innerHTML = '';
    showtimes.forEach((st, idx) => {
      const pill = document.createElement('div');
      pill.className = `showtime-pill ${idx === 0 ? 'active' : ''}`;
      pill.innerText = st;

      pill.addEventListener('click', () => {
        soundEngine.playUiHover();
        document.querySelectorAll('.showtime-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        this.selectedShowtime = st;

        // SIGNATURE LUMIERE FEATURE: Update the 3D hanging golden clock immediately!
        this.scene.updateClockTexture(st);
        this.updateSeatmapModalInfo();
      });

      this.sidebarShowtimePillsEl.appendChild(pill);
    });
    this.selectedShowtime = showtimes[0];
    this.scene.updateClockTexture(this.selectedShowtime);
  }

  // 4. Render Interactive 2D Seat Map Modal (Matching Frame 4)
  render2DSeatMapGrid() {
    if (!this.seatsConfig) return;
    this.seatmapGridEl.innerHTML = '';

    const { rows } = this.seatsConfig;
    rows.forEach(r => {
      const rowDiv = document.createElement('div');
      rowDiv.className = 'grid-seat-row';

      // Left Row Letter
      const leftLbl = document.createElement('span');
      leftLbl.className = 'row-letter-lbl';
      leftLbl.innerText = r.row;
      rowDiv.appendChild(leftLbl);

      // Seats 1 to 11
      for (let s = 1; s <= r.seatsCount; s++) {
        const seatId = `${r.row}-${s}`;
        const isOccupied = r.occupied.includes(s);

        const cell = document.createElement('div');
        cell.className = `seat-cell ${isOccupied ? 'occupied' : ''}`;
        cell.id = `cell-${seatId}`;
        cell.innerText = s;
        cell.title = `Seat ${seatId} (${r.type})`;

        if (!isOccupied) {
          cell.addEventListener('click', () => {
            this.toggleSeatSelection(seatId);
          });
        }

        rowDiv.appendChild(cell);
      }

      // Right Row Letter
      const rightLbl = leftLbl.cloneNode(true);
      rowDiv.appendChild(rightLbl);

      this.seatmapGridEl.appendChild(rowDiv);
    });
  }

  toggleSeatSelection(seatId) {
    const chairMesh = this.scene.seatMeshMap.get(seatId);
    if (!chairMesh || chairMesh.userData.isOccupied) return;

    chairMesh.userData.isSelected = !chairMesh.userData.isSelected;

    if (chairMesh.userData.isSelected) {
      this.scene.selectedSeats.add(seatId);
      this.scene.highlightSeat(chairMesh, 0xd4af37);
      soundEngine.playSeatClick(true);
    } else {
      this.scene.selectedSeats.delete(seatId);
      this.scene.resetSeatHighlight(chairMesh);
      soundEngine.playSeatClick(false);
    }

    this.handleSeatSelectionChange(Array.from(this.scene.selectedSeats), chairMesh.userData, chairMesh);
  }

  handleSeatSelectionChange(selectedSeatIds, lastSeatData, chairMesh) {
    this.selectedSeatsData = [];
    this.lastSelectedChairMesh = chairMesh;

    selectedSeatIds.forEach(id => {
      const mesh = this.scene.seatMeshMap.get(id);
      if (mesh && mesh.userData) {
        this.selectedSeatsData.push(mesh.userData);
      }
    });

    // Sync 2D grid cells
    document.querySelectorAll('.seat-cell').forEach(c => c.classList.remove('selected'));
    selectedSeatIds.forEach(id => {
      const cell = document.getElementById(`cell-${id}`);
      if (cell) cell.classList.add('selected');
    });

    // Toggle POV Preview Button
    if (this.povPreviewBtn) {
      if (this.selectedSeatsData.length > 0 && this.lastSelectedChairMesh) {
        this.povPreviewBtn.style.display = 'flex';
        const last = this.selectedSeatsData[this.selectedSeatsData.length - 1];
        this.povPreviewBtn.innerHTML = `👁️ O'rindiqqa o'tirish (POV: ${last.seatId})`;
        this.povPreviewBtn.classList.add('pulse-gold');
      } else {
        this.povPreviewBtn.style.display = 'none';
        this.povPreviewBtn.classList.remove('pulse-gold');
      }
    }

    this.renderSelectedSeatBadges();
    this.updateSeatmapModalInfo();
    this.updatePriceCalculations();
  }

  // Directly enter First-Person Seat POV
  enterSeatPOV(chairMesh) {
    if (!chairMesh || chairMesh.userData?.isOccupied) return;
    this.lastSelectedChairMesh = chairMesh;
    if (!chairMesh.userData.isSelected) {
      this.toggleSeatSelection(chairMesh.userData.seatId);
    }
    soundEngine.playUiHover();
    this.parallax.transitionToSeatPOV(chairMesh);
  }

  renderSelectedSeatBadges() {
    this.selectedBadgesListEl.innerHTML = '';
    this.selectedSeatsData.forEach(seat => {
      const badge = document.createElement('div');
      badge.className = 'seat-badge';
      badge.innerHTML = `
        <span>${seat.seatId}</span>
        <span class="del-btn" title="Remove">✕</span>
      `;

      badge.querySelector('.del-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleSeatSelection(seat.seatId);
      });

      this.selectedBadgesListEl.appendChild(badge);
    });
  }

  updateSeatmapModalInfo() {
    if (!this.seatmapSubinfoEl || !this.currentMovie) return;
    this.seatmapSubinfoEl.innerText = `${this.currentMovie.title} • ${this.selectedDate} • ${this.selectedShowtime} • ${this.selectedSeatsData.length} selected seats`;
  }

  updatePriceCalculations() {
    const ticketPrice = this.currentMovie?.ticketPrice || 95000;
    const total = this.selectedSeatsData.length * ticketPrice;

    this.totalAmountEl.innerText = `${total.toLocaleString()} UZS`;

    if (this.selectedSeatsData.length > 0) {
      this.selectSeatsCtaBtn.disabled = false;
      this.selectSeatsCtaBtn.innerHTML = `Confirm booking (${this.selectedSeatsData.length}) &gt;`;
    } else {
      this.selectSeatsCtaBtn.disabled = true;
      this.selectSeatsCtaBtn.innerHTML = `Select seats &gt;`;
    }
  }

  showSeatTooltip(seatData, event) {
    if (!seatData) {
      this.tooltipEl.classList.remove('active');
      return;
    }

    const { seatId, type, price, isOccupied } = seatData;
    this.tooltipEl.innerHTML = `
      <div style="font-weight:700; color:${isOccupied ? '#94a3b8' : '#d4af37'};">${seatId} • ${type}</div>
      <div style="font-size:0.7rem; color:#cbd5e1;">${isOccupied ? 'Band qilingan' : `${price.toLocaleString()} UZS • Tanlash`}</div>
      ${!isOccupied ? `<div style="font-size:0.68rem; color:#d4af37; margin-top:3px; font-weight:600;">👁️ 2 marta bosing: O'tirish va ekranni ko'rish</div>` : ''}
    `;

    this.tooltipEl.style.left = `${event.clientX}px`;
    this.tooltipEl.style.top = `${event.clientY}px`;
    this.tooltipEl.classList.add('active');
  }

  initEventListeners() {
    // Top Bar Actions
    this.tourAuditoriumBtn.addEventListener('click', () => {
      soundEngine.playUiHover();
      const isTour = this.parallax.toggleAutoTour();
      this.tourAuditoriumBtn.classList.toggle('active', isTour);
    });

    this.fullscreenBtn.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
      } else {
        document.exitFullscreen();
      }
    });

    this.soundToggleBtn.addEventListener('click', () => {
      const isSound = soundEngine.toggleSound();
      this.soundToggleBtn.innerHTML = isSound ? '🔊' : '🔇';
    });

    // D-Pad Navigation Buttons
    this.dpadUp.addEventListener('click', () => this.parallax.pan('up'));
    this.dpadDown.addEventListener('click', () => this.parallax.pan('down'));
    this.dpadLeft.addEventListener('click', () => this.parallax.pan('left'));
    this.dpadRight.addEventListener('click', () => this.parallax.pan('right'));
    this.dpadZoomIn.addEventListener('click', () => this.parallax.pan('zoom-in'));
    this.dpadZoomOut.addEventListener('click', () => this.parallax.pan('zoom-out'));

    // Seat POV Preview Button
    this.povPreviewBtn.addEventListener('click', () => {
      if (this.lastSelectedChairMesh) {
        soundEngine.playUiHover();
        this.parallax.transitionToSeatPOV(this.lastSelectedChairMesh);
      }
    });

    // 2D Seat Map Modal Trigger
    this.openSeatmapBtn.addEventListener('click', () => {
      soundEngine.playUiHover();
      this.seatmapModalEl.classList.add('active');
    });

    this.closeSeatmapBtn.addEventListener('click', () => {
      this.seatmapModalEl.classList.remove('active');
    });

    this.confirmSeatmapBtn.addEventListener('click', () => {
      soundEngine.playUiHover();
      this.seatmapModalEl.classList.remove('active');
      if (this.lastSelectedChairMesh) {
        this.parallax.transitionToSeatPOV(this.lastSelectedChairMesh);
      } else {
        this.parallax.setMode('Facing the screen');
      }
    });

    // Checkout & Booking Modal
    this.selectSeatsCtaBtn.addEventListener('click', () => {
      if (this.selectedSeatsData.length === 0) return;
      soundEngine.playUiHover();
      this.openCheckoutModal();
    });

    this.cancelCheckoutBtn.addEventListener('click', () => {
      this.checkoutModalEl.classList.remove('active');
    });

    this.payConfirmBtn.addEventListener('click', async () => {
      try {
        const seatKeys = this.selectedSeatsData.map(s => s.seatId);
        const res = await api.bookSeats({
          seats: seatKeys,
          movieId: this.currentMovie.id,
          showdate: this.selectedDate,
          showtime: this.selectedShowtime,
          customerName: 'Lumiere Cinema Guest'
        });

        if (res.success) {
          soundEngine.playPurchaseChime();
          this.scene.markSeatsOccupied(seatKeys);

          this.checkoutReceiptContentEl.innerHTML = `
            <div style="text-align:center; color:#d4af37; font-size:1.15rem; font-weight:800; margin-bottom:8px;">
              ✓ LUMIERE PASS ISSUED
            </div>
            <div class="checkout-receipt-row"><span>Booking Ref:</span><strong>${res.booking.ticketRef}</strong></div>
            <div class="checkout-receipt-row"><span>Film:</span><span>${this.currentMovie.title}</span></div>
            <div class="checkout-receipt-row"><span>Auditorium:</span><span>Lumiere Grand 01</span></div>
            <div class="checkout-receipt-row"><span>Date & Time:</span><span>${this.selectedDate} • ${this.selectedShowtime}</span></div>
            <div class="checkout-receipt-row"><span>Seats:</span><strong style="color:#d4af37;">${seatKeys.join(', ')}</strong></div>
            <div class="checkout-receipt-row" style="border-top:1px dashed #444; padding-top:6px; margin-top:4px;">
              <span>Total Paid:</span>
              <strong style="font-size:1.1rem; color:#d4af37;">${res.booking.grandTotal.toLocaleString()} UZS</strong>
            </div>
            <div style="margin-top:12px; padding:10px; background:#fff; color:#000; text-align:center; border-radius:6px; font-family:monospace; font-size:0.75rem;">
              ||| | |||| |||||| | ||||| |||| |||||
              <div style="font-size:0.65rem; font-weight:bold;">SCANNER VERIFICATION [${res.booking.ticketRef}]</div>
            </div>
          `;

          this.payConfirmBtn.style.display = 'none';
          this.cancelCheckoutBtn.innerText = 'Close Receipt';

          this.selectedSeatsData = [];
          this.handleSeatSelectionChange([], null, null);
        }
      } catch (e) {
        alert('Booking error.');
      }
    });
  }

  openCheckoutModal() {
    const total = this.selectedSeatsData.length * (this.currentMovie?.ticketPrice || 95000);
    this.payConfirmBtn.style.display = 'inline-block';
    this.cancelCheckoutBtn.innerText = 'Cancel';

    this.checkoutReceiptContentEl.innerHTML = `
      <div class="checkout-receipt-row"><span>Film:</span><strong>${this.currentMovie.title}</strong></div>
      <div class="checkout-receipt-row"><span>Auditorium:</span><span>Lumiere Grand 01</span></div>
      <div class="checkout-receipt-row"><span>Date & Time:</span><span>${this.selectedDate} • ${this.selectedShowtime}</span></div>
      <div class="checkout-receipt-row"><span>Seats (${this.selectedSeatsData.length}):</span><strong style="color:#d4af37;">${this.selectedSeatsData.map(s => s.seatId).join(', ')}</strong></div>
      <div class="checkout-receipt-row" style="border-top:1px dashed #444; padding-top:6px; margin-top:4px;">
        <span>Total Due:</span>
        <strong style="font-size:1.15rem; color:#d4af37;">${total.toLocaleString()} UZS</strong>
      </div>
    `;

    this.checkoutModalEl.classList.add('active');
  }
}
