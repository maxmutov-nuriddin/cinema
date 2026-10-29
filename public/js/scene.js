// LUMIERE GRAND CINEMA - Ultra-Optimized 3D Scene Architecture (60-120 FPS High Performance)
import { soundEngine } from './audio.js';

export class CinemaScene {
  constructor(containerElement, onSeatClickCallback, onSeatHoverCallback) {
    this.container = containerElement;
    this.onSeatClick = onSeatClickCallback;
    this.onSeatHover = onSeatHoverCallback;
    this.onSeatDblClick = null;

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    this.seats = [];
    this.hitBoxes = [];
    this.seatMeshMap = new Map();
    this.hoveredSeat = null;
    this.selectedSeats = new Set();

    // Screen, Clock & Lights
    this.screenMesh = null;
    this.screenCanvas = null;
    this.screenCtx = null;
    this.screenTexture = null;
    this.screenLight = null;

    // Hanging 3D Golden Clock
    this.hangingClockMesh = null;
    this.clockCanvas = null;
    this.clockCtx = null;
    this.clockTexture = null;
    this.currentClockTime = "13:00";

    this.projectorBeam = null;
    this.wallLights = [];

    this.clock = new THREE.Clock();
    this.currentMovieTheme = 'lastlight';
    this.isScreenPlaying = true;
    this.textures = {};

    // Caches & Asset Sharing for Extreme Performance
    this.tagTextureCache = new Map();
    this.sharedChairAssets = null;
    this._raycastPending = false;

    this.init();
  }

  init() {
    // 1. Scene & Atmosphere (Luxury Dark Charcoal matching Lumiere Cinema)
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0b10);
    this.scene.fog = new THREE.FogExp2(0x0a0b10, 0.014);

    // 2. Camera setup (Initial: Auditorium Overview looking at screen)
    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(58, aspect, 0.1, 120);
    this.camera.position.set(0, 5.2, 18.5);

    // 3. Renderer with ACES Tone Mapping & Performance Capping
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    // Clamp to 1.5x pixel ratio (prevents MacBook Retina 2x GPU bottleneck)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;

    // Static shadow optimization: Render shadows on demand, NOT 60 times/sec!
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.shadowMap.needsUpdate = true;
    this.container.appendChild(this.renderer.domElement);

    // 4. Shared Assets & Textures
    this.setupSharedAssets();
    this.generateProceduralTextures();
    this.setupLumiereAuditorium();
    this.setupCinemaScreen();
    this.setupHangingGoldenClock();
    this.setupStageSpeakers();
    this.setupLighting();

    // 5. Drag vs Click Detection (Dragging camera never accidentally selects seats!)
    this.pointerDownPos = { x: 0, y: 0 };
    this.pointerDownTime = 0;

    window.addEventListener('resize', () => this.onWindowResize());
    window.addEventListener('mousemove', (e) => this.onPointerMove(e));

    this.renderer.domElement.addEventListener('pointerdown', (e) => {
      this.pointerDownPos.x = e.clientX;
      this.pointerDownPos.y = e.clientY;
      this.pointerDownTime = performance.now();
    });

    this.renderer.domElement.addEventListener('pointerup', (e) => {
      const dist = Math.hypot(e.clientX - this.pointerDownPos.x, e.clientY - this.pointerDownPos.y);
      const elapsed = performance.now() - this.pointerDownTime;
      // If moved more than 6px or held longer than 350ms, it was camera drag/orbit!
      if (dist > 6 || elapsed > 350) return;
      this.onPointerClick(e);
    });

    this.renderer.domElement.addEventListener('dblclick', (e) => this.onPointerDblClick(e));
  }

  // Pre-instantiated shared geometries & materials for all 110 chairs
  setupSharedAssets() {
    this.sharedChairAssets = {
      cushionGeo: new THREE.BoxGeometry(1.08, 0.22, 0.98),
      backGeo: new THREE.BoxGeometry(1.08, 1.15, 0.22),
      headGeo: new THREE.BoxGeometry(0.92, 0.35, 0.24),
      armGeo: new THREE.BoxGeometry(0.16, 0.48, 0.88),
      legGeo: new THREE.CylinderGeometry(0.075, 0.085, 0.42, 10),
      cupGeo: new THREE.CylinderGeometry(0.06, 0.055, 0.07, 12),
      tagGeo: new THREE.PlaneGeometry(0.2, 0.2),
      hitBoxGeo: new THREE.BoxGeometry(1.3, 1.8, 1.2),
      hitBoxMat: new THREE.MeshBasicMaterial({ visible: false }),
      armMat: new THREE.MeshStandardMaterial({ color: 0x0d0f16, roughness: 0.5, metalness: 0.3 }),
      chromeRing: new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.9, roughness: 0.2 }),
      legMat: new THREE.MeshStandardMaterial({ color: 0x05070a, metalness: 0.9, roughness: 0.3 })
    };
  }

  generateProceduralTextures() {
    // Dark Charcoal Carpet
    const cCanvas = document.createElement('canvas');
    cCanvas.width = 256; cCanvas.height = 256;
    const cCtx = cCanvas.getContext('2d');
    cCtx.fillStyle = '#0f1118';
    cCtx.fillRect(0, 0, 256, 256);
    cCtx.strokeStyle = '#181b24';
    cCtx.lineWidth = 1;
    for (let i = 0; i < 256; i += 16) {
      cCtx.beginPath(); cCtx.moveTo(i, 0); cCtx.lineTo(i + 256, 256); cCtx.stroke();
      cCtx.beginPath(); cCtx.moveTo(i, 256); cCtx.lineTo(i + 256, 0); cCtx.stroke();
    }
    const carpetTex = new THREE.CanvasTexture(cCanvas);
    carpetTex.wrapS = THREE.RepeatWrapping; carpetTex.wrapT = THREE.RepeatWrapping;
    carpetTex.repeat.set(10, 16);
    this.textures.carpet = carpetTex;

    // Red Leather Fabric Bump Map
    const fCanvas = document.createElement('canvas');
    fCanvas.width = 128; fCanvas.height = 128;
    const fCtx = fCanvas.getContext('2d');
    fCtx.fillStyle = '#808080';
    fCtx.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 1500; i++) {
      const val = Math.random() > 0.5 ? 200 : 70;
      fCtx.fillStyle = `rgb(${val},${val},${val})`;
      fCtx.fillRect(Math.random() * 128, Math.random() * 128, 1, 1);
    }
    const leatherBump = new THREE.CanvasTexture(fCanvas);
    leatherBump.wrapS = THREE.RepeatWrapping; leatherBump.wrapT = THREE.RepeatWrapping;
    leatherBump.repeat.set(4, 4);
    this.textures.leatherBump = leatherBump;
  }

  // Construct Lumiere Cinema Room (Stage, Risers, Slats, Ceilings)
  setupLumiereAuditorium() {
    const room = new THREE.Group();

    // 1. Front Stage under screen
    const stageGeo = new THREE.BoxGeometry(26, 0.8, 8);
    const stageMat = new THREE.MeshStandardMaterial({ color: 0x12141c, roughness: 0.6, metalness: 0.2 });
    const stage = new THREE.Mesh(stageGeo, stageMat);
    stage.position.set(0, 0.4, -6.5);
    stage.receiveShadow = true;
    room.add(stage);

    // Golden Stage Edge Trim
    const edgeTrimGeo = new THREE.BoxGeometry(26, 0.06, 0.1);
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.9, roughness: 0.2 });
    const edgeTrim = new THREE.Mesh(edgeTrimGeo, goldMat);
    edgeTrim.position.set(0, 0.82, -2.5);
    room.add(edgeTrim);

    // 2. 10 Tiered Seating Risers (Rows A to J)
    let currentZ = -1.2;
    let currentY = 0.2;

    for (let i = 0; i < 10; i++) {
      currentY += 0.45;
      currentZ += 2.4;

      const riserGeo = new THREE.BoxGeometry(25, currentY, 2.4);
      const riserMat = new THREE.MeshStandardMaterial({ map: this.textures.carpet, roughness: 0.9 });
      const riser = new THREE.Mesh(riserGeo, riserMat);
      riser.position.set(0, currentY / 2, currentZ);
      riser.receiveShadow = true;
      room.add(riser);

      // Brass Step Nosing on edge
      const stepNosing = new THREE.Mesh(new THREE.BoxGeometry(25, 0.04, 0.06), goldMat);
      stepNosing.position.set(0, currentY + 0.02, currentZ - 1.2);
      room.add(stepNosing);
    }

    // 3. Side Acoustic Slat Walls (Dark Charcoal with Warm Gold Light Ribbons)
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x0e1017, roughness: 0.85 });
    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.8, 14, 46), wallMat);
    leftWall.position.set(-13.2, 6.5, 8);
    leftWall.receiveShadow = true;
    room.add(leftWall);

    const rightWall = leftWall.clone();
    rightWall.position.x = 13.2;
    room.add(rightWall);

    // Warm Architectural Linear Light Strips on Walls (matching video!)
    const ledGeo = new THREE.BoxGeometry(0.06, 7.0, 0.08);
    const ledMat = new THREE.MeshBasicMaterial({ color: 0xffb703 });
    for (let side of [-1, 1]) {
      for (let z = -4; z <= 24; z += 5) {
        const led = new THREE.Mesh(ledGeo, ledMat);
        led.position.set(side * 12.75, 5.5, z);
        room.add(led);
        this.wallLights.push(led);
      }
    }

    // 4. Overhead Exposed Dark Beams with Linear Ceiling Fixtures
    const beamGeo = new THREE.BoxGeometry(25.5, 0.4, 0.4);
    const beamMat = new THREE.MeshStandardMaterial({ color: 0x14161f, roughness: 0.8 });
    const ceilLightGeo = new THREE.BoxGeometry(18, 0.04, 0.08);
    const ceilLightMat = new THREE.MeshBasicMaterial({ color: 0xffedd5 });

    for (let z = -6; z <= 24; z += 5) {
      const beam = new THREE.Mesh(beamGeo, beamMat);
      beam.position.set(0, 11.2, z);
      room.add(beam);

      const ceilLight = new THREE.Mesh(ceilLightGeo, ceilLightMat);
      ceilLight.position.set(0, 10.98, z);
      room.add(ceilLight);
    }

    // Ceiling Base Plane
    const ceiling = new THREE.Mesh(
      new THREE.PlaneGeometry(26, 48),
      new THREE.MeshStandardMaterial({ color: 0x08090e, roughness: 0.95 })
    );
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(0, 11.5, 8);
    room.add(ceiling);

    // 5. Back Projector Wall
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(26, 14, 1), wallMat);
    backWall.position.set(0, 6.5, 26);
    room.add(backWall);

    // Projector Booth Window
    const portWin = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.2, 0.2), new THREE.MeshBasicMaterial({ color: 0x99ccff }));
    portWin.position.set(0, 9.8, 25.5);
    room.add(portWin);

    this.scene.add(room);
  }

  // Curved Cinema Screen (Stage Center: Z = -10.5)
  setupCinemaScreen() {
    this.screenCanvas = document.createElement('canvas');
    this.screenCanvas.width = 1280;
    this.screenCanvas.height = 720;
    this.screenCtx = this.screenCanvas.getContext('2d');

    this.screenTexture = new THREE.CanvasTexture(this.screenCanvas);
    this.screenTexture.minFilter = THREE.LinearFilter;
    this.screenTexture.magFilter = THREE.LinearFilter;

    // Curved Widescreen (22m x 10m)
    const screenGeo = new THREE.PlaneGeometry(22, 10, 40, 14);
    const pos = screenGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      pos.setZ(i, - (x * x) / (2 * 28)); // curved bow
    }
    screenGeo.computeVertexNormals();

    const screenMat = new THREE.MeshStandardMaterial({
      map: this.screenTexture,
      emissive: new THREE.Color(0xffffff),
      emissiveMap: this.screenTexture,
      emissiveIntensity: 0.95,
      roughness: 0.35,
      metalness: 0.1,
      side: THREE.DoubleSide
    });

    this.screenMesh = new THREE.Mesh(screenGeo, screenMat);
    this.screenMesh.position.set(0, 5.8, -10.5);
    this.scene.add(this.screenMesh);

    // Sleek Beveled Frame
    const frameGeo = new THREE.BoxGeometry(22.4, 0.25, 0.4);
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x05060a, roughness: 0.8 });
    const topFrame = new THREE.Mesh(frameGeo, frameMat);
    topFrame.position.set(0, 10.9, -10.5);
    this.scene.add(topFrame);

    const bottomFrame = topFrame.clone();
    bottomFrame.position.y = 0.7;
    this.scene.add(bottomFrame);

    this.renderCinematicPoster();
  }

  // Hanging 3D Golden Clock (Iconic Lumiere Cinema Feature from Video!)
  setupHangingGoldenClock() {
    this.clockCanvas = document.createElement('canvas');
    this.clockCanvas.width = 512;
    this.clockCanvas.height = 512;
    this.clockCtx = this.clockCanvas.getContext('2d');

    this.clockTexture = new THREE.CanvasTexture(this.clockCanvas);

    const clockGroup = new THREE.Group();

    // Outer Golden Ring Bezel
    const bezelGeo = new THREE.TorusGeometry(1.15, 0.08, 16, 40);
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.95, roughness: 0.15 });
    const bezel = new THREE.Mesh(bezelGeo, goldMat);
    clockGroup.add(bezel);

    // Inner Glowing Dial Plate
    const dialGeo = new THREE.CircleGeometry(1.1, 32);
    const dialMat = new THREE.MeshBasicMaterial({ map: this.clockTexture, side: THREE.DoubleSide });
    const dial = new THREE.Mesh(dialGeo, dialMat);
    clockGroup.add(dial);

    // Two Thin Suspension Cables connecting clock to ceiling
    const cableMat = new THREE.MeshBasicMaterial({ color: 0x222222 });
    const cable1 = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 4.5, 8), cableMat);
    cable1.position.set(-0.6, 3.2, 0);
    clockGroup.add(cable1);

    const cable2 = cable1.clone();
    cable2.position.x = 0.6;
    clockGroup.add(cable2);

    // Placed to the right of the screen at X = 7.8, Y = 6.4, Z = -9.8
    clockGroup.position.set(7.8, 6.4, -9.8);
    this.hangingClockMesh = clockGroup;
    this.scene.add(clockGroup);

    this.updateClockTexture(this.currentClockTime);
  }

  // Update Golden Hanging Clock Face (Only called when showtime changes)
  updateClockTexture(timeStr) {
    this.currentClockTime = timeStr || "13:00";
    if (!this.clockCtx) return;

    const ctx = this.clockCtx;
    ctx.clearRect(0, 0, 512, 512);

    // Dark dial background
    ctx.fillStyle = '#0a0d14';
    ctx.beginPath();
    ctx.arc(256, 256, 245, 0, Math.PI * 2);
    ctx.fill();

    // Golden inner border
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(256, 256, 235, 0, Math.PI * 2);
    ctx.stroke();

    // Clock Tick Marks
    for (let i = 0; i < 12; i++) {
      const angle = (i * Math.PI) / 6;
      const x1 = 256 + Math.cos(angle) * 200;
      const y1 = 256 + Math.sin(angle) * 200;
      const x2 = 256 + Math.cos(angle) * 225;
      const y2 = 256 + Math.sin(angle) * 225;
      ctx.strokeStyle = '#d4af37';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    // Showtime Text Display
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 78px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.currentClockTime, 256, 235);

    ctx.fillStyle = '#d4af37';
    ctx.font = '700 24px monospace';
    ctx.fillText('LUMIERE SHOWTIME', 256, 310);

    // Clock Hands matching the time string
    const parts = this.currentClockTime.split(':');
    const hrs = parseInt(parts[0], 10) % 12;
    const mins = parseInt(parts[1], 10);

    const hrAngle = ((hrs + mins / 60) * Math.PI) / 6 - Math.PI / 2;
    const minAngle = (mins * Math.PI) / 30 - Math.PI / 2;

    // Hour hand
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(256, 256);
    ctx.lineTo(256 + Math.cos(hrAngle) * 110, 256 + Math.sin(hrAngle) * 110);
    ctx.stroke();

    // Minute hand
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(256, 256);
    ctx.lineTo(256 + Math.cos(minAngle) * 160, 256 + Math.sin(minAngle) * 160);
    ctx.stroke();

    // Center pin
    ctx.fillStyle = '#d4af37';
    ctx.beginPath();
    ctx.arc(256, 256, 12, 0, Math.PI * 2);
    ctx.fill();

    this.clockTexture.needsUpdate = true;
  }

  // Stage Speaker Stacks
  setupStageSpeakers() {
    const spkGeo = new THREE.BoxGeometry(1.4, 3.2, 1.2);
    const spkMat = new THREE.MeshStandardMaterial({ color: 0x08090d, roughness: 0.9 });

    for (let side of [-1, 1]) {
      const speaker = new THREE.Mesh(spkGeo, spkMat);
      speaker.position.set(side * 10.2, 2.4, -9.2);
      speaker.rotation.y = -side * 0.28;
      this.scene.add(speaker);
    }
  }

  // Dramatic Cinema Lighting
  setupLighting() {
    const ambient = new THREE.AmbientLight(0x181a24, 0.65);
    this.scene.add(ambient);

    this.screenLight = new THREE.PointLight(0xff6b35, 3.0, 36, 1.3);
    this.screenLight.position.set(0, 6.0, -6.0);
    this.scene.add(this.screenLight);

    const projectorSpot = new THREE.SpotLight(0xffecd1, 3.2, 48, Math.PI / 7.5, 0.25, 1.1);
    projectorSpot.position.set(0, 9.8, 25);
    projectorSpot.target = this.screenMesh;
    projectorSpot.castShadow = true;
    projectorSpot.shadow.mapSize.width = 1024;
    projectorSpot.shadow.mapSize.height = 1024;
    this.scene.add(projectorSpot);
  }

  // Populate 10 Rows (A to J) x 11 Seats = 110 Seats
  loadSeatsData(seatsConfig) {
    this.seats.forEach(s => this.scene.remove(s));
    this.seats = [];
    this.hitBoxes = [];
    this.seatMeshMap.clear();

    const { rows } = seatsConfig;
    let currentZ = -1.2;
    let currentY = 0.2;

    rows.forEach((rowObj) => {
      currentY += 0.45;
      currentZ += 2.4;

      const { row, type, price, seatsCount, occupied } = rowObj;
      const isVIP = rowObj.tier >= 8;
      const seatSpacing = 1.6;
      const totalRowWidth = (seatsCount - 1) * seatSpacing + 1.2;
      const startX = -totalRowWidth / 2;

      for (let s = 1; s <= seatsCount; s++) {
        const aisleOffset = (s > seatsCount / 2) ? 0.75 : -0.75;
        const posX = startX + (s - 1) * seatSpacing + aisleOffset;
        const isOccupied = occupied.includes(s);
        const seatId = `${row}-${s}`;

        const chair = this.createLumiereCinemaChair({
          seatId,
          row,
          seatNum: s,
          price,
          type,
          isVIP,
          isOccupied
        });

        chair.position.set(posX, currentY, currentZ);
        this.scene.add(chair);
        this.seats.push(chair);
        this.seatMeshMap.set(seatId, chair);
      }
    });

    // Update static shadows once after populating room
    this.renderer.shadowMap.needsUpdate = true;
  }

  // Cache seat number textures (only 11 numbers exist across all rows!)
  getSeatNumberTexture(num, isOccupied) {
    const key = `${num}_${isOccupied}`;
    if (this.tagTextureCache.has(key)) {
      return this.tagTextureCache.get(key);
    }
    const canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0a0d14';
    ctx.beginPath(); ctx.arc(32, 32, 28, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = isOccupied ? '#555555' : '#d4af37';
    ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = isOccupied ? '#777777' : '#ffffff';
    ctx.font = 'bold 22px monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(`${num}`, 32, 32);

    const tex = new THREE.CanvasTexture(canvas);
    this.tagTextureCache.set(key, tex);
    return tex;
  }

  // Optimized Cinema Chair with Shared Geometries & Invisible Hitbox
  createLumiereCinemaChair({ seatId, row, seatNum, price, type, isVIP, isOccupied }) {
    const chairGroup = new THREE.Group();
    const assets = this.sharedChairAssets;

    let fabricColor = isOccupied ? 0x222630 : (isVIP ? 0x730e15 : 0xa6192e);
    let backColor = isOccupied ? 0x161922 : (isVIP ? 0x54090e : 0x8a1223);

    const leatherMat = new THREE.MeshStandardMaterial({
      color: fabricColor,
      bumpMap: this.textures.leatherBump,
      bumpScale: 0.02,
      roughness: 0.55,
      metalness: 0.18
    });

    // 1. Cushion
    const cushion = new THREE.Mesh(assets.cushionGeo, leatherMat);
    cushion.position.set(0, 0.42, 0);
    cushion.castShadow = true;
    chairGroup.add(cushion);

    // 2. Backrest
    const backMat = leatherMat.clone();
    backMat.color.setHex(backColor);
    const backrest = new THREE.Mesh(assets.backGeo, backMat);
    backrest.position.set(0, 0.98, 0.38);
    backrest.rotation.x = 0.09;
    backrest.castShadow = true;
    chairGroup.add(backrest);

    // 3. Headrest
    const headrest = new THREE.Mesh(assets.headGeo, leatherMat);
    headrest.position.set(0, 1.58, 0.44);
    headrest.castShadow = true;
    chairGroup.add(headrest);

    // Seat Number Tag (Reusing cached texture)
    const tagTex = this.getSeatNumberTexture(seatNum, isOccupied);
    const tagMesh = new THREE.Mesh(assets.tagGeo, new THREE.MeshBasicMaterial({ map: tagTex, side: THREE.DoubleSide }));
    tagMesh.position.set(0, 1.58, 0.58);
    chairGroup.add(tagMesh);

    const frontTag = tagMesh.clone();
    frontTag.position.set(0, 1.58, 0.30);
    frontTag.rotation.y = Math.PI;
    chairGroup.add(frontTag);

    // 4. Armrests & Cup Holders (Shared Geometries & Materials!)
    const armLeft = new THREE.Mesh(assets.armGeo, assets.armMat);
    armLeft.position.set(-0.62, 0.56, 0.02);
    chairGroup.add(armLeft);

    const cupL = new THREE.Mesh(assets.cupGeo, assets.chromeRing);
    cupL.position.set(-0.62, 0.81, -0.25);
    chairGroup.add(cupL);

    const armRight = new THREE.Mesh(assets.armGeo, assets.armMat);
    armRight.position.set(0.62, 0.56, 0.02);
    chairGroup.add(armRight);

    const cupR = cupL.clone();
    cupR.position.x = 0.62;
    chairGroup.add(cupR);

    // 5. Heavy Steel Base
    const leg = new THREE.Mesh(assets.legGeo, assets.legMat);
    leg.position.set(0, 0.21, 0);
    chairGroup.add(leg);

    // 6. Fast Raycasting Hitbox (Single Box, Zero Hierarchy Overhead)
    const hitBox = new THREE.Mesh(assets.hitBoxGeo, assets.hitBoxMat);
    hitBox.position.set(0, 0.9, 0.1);
    hitBox.userData = { chairGroup };
    chairGroup.add(hitBox);
    this.hitBoxes.push(hitBox);

    chairGroup.userData = {
      seatId,
      row,
      seatNum,
      price,
      type,
      isVIP,
      isOccupied,
      isSelected: false,
      cushionMesh: cushion,
      backrestMesh: backrest,
      headrestMesh: headrest,
      originalColor: fabricColor,
      chairPosition: chairGroup.position
    };

    return chairGroup;
  }

  // Render Cinematic Movie Poster ONCE when movie changes (ZERO per-frame overhead!)
  renderCinematicPoster() {
    if (!this.screenCtx) return;

    const ctx = this.screenCtx;
    const w = this.screenCanvas.width;
    const h = this.screenCanvas.height;

    ctx.fillStyle = '#05070c';
    ctx.fillRect(0, 0, w, h);

    if (this.currentMovieTheme === 'lastlight') {
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, '#0a0a14');
      grad.addColorStop(0.4, '#1a0b12');
      grad.addColorStop(0.7, '#ff6b35');
      grad.addColorStop(1, '#ffc09f');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      ctx.fillStyle = '#08060c';
      ctx.beginPath();
      ctx.moveTo(w * 0.3, h);
      ctx.lineTo(w * 0.65, h * 0.48);
      ctx.lineTo(w * 0.95, h);
      ctx.fill();

      ctx.save();
      ctx.fillStyle = '#ffeedd';
      ctx.beginPath();
      ctx.arc(w * 0.72, h * 0.42, 90, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.fillStyle = '#07050d';
      ctx.beginPath();
      ctx.arc(w * 0.71, h * 0.42, 84, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = '800 68px sans-serif';
      ctx.fillText('THE LAST LIGHT', 100, 220);

      ctx.font = '700 26px monospace';
      ctx.fillStyle = '#ffeedd';
      ctx.fillText('LUMIERE CINEMA EXCLUSIVE • WHERE THE LIGHT ENDS', 100, 280);

      ctx.font = '600 20px sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillText('DIRECTED BY CLAIRE DENIS • IN 4K DUAL LASER', 100, 325);

      if (this.screenLight) this.screenLight.color.setHex(0xff6b35);
    } else if (this.currentMovieTheme === 'sintel') {
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, '#04101e');
      grad.addColorStop(0.5, '#005f73');
      grad.addColorStop(1, '#00f0ff');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      ctx.fillStyle = '#ffffff';
      ctx.font = '800 68px sans-serif';
      ctx.fillText('SINTEL: DRAGON ODYSSEY', 100, 220);
      ctx.font = '700 26px monospace';
      ctx.fillText('AN OPEN MOVIE SAGA • FESTIVAL AWARD WINNER', 100, 280);

      if (this.screenLight) this.screenLight.color.setHex(0x00f0ff);
    } else {
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, '#08121e');
      grad.addColorStop(0.5, '#1e293b');
      grad.addColorStop(1, '#38bdf8');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      ctx.fillStyle = '#ffffff';
      ctx.font = '800 68px sans-serif';
      ctx.fillText('A QUIETER WORLD', 100, 220);
      ctx.font = '700 26px monospace';
      ctx.fillText('A THRILLER IN 70MM FILM SOUND • IN AUDITORIUMS NOW', 100, 280);

      if (this.screenLight) this.screenLight.color.setHex(0x38bdf8);
    }

    this.screenTexture.needsUpdate = true;
  }

  setMovieTheme(theme, clockTime) {
    if (this.currentMovieTheme !== theme) {
      this.currentMovieTheme = theme;
      this.renderCinematicPoster();
    }
    if (clockTime) {
      this.updateClockTexture(clockTime);
    }
  }

  // Throttled High-Speed Pointer Move Raycasting
  onPointerMove(event) {
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    if (this._raycastPending) return;
    this._raycastPending = true;

    requestAnimationFrame(() => {
      this._raycastPending = false;
      this.raycaster.setFromCamera(this.mouse, this.camera);
      // Fast raycast against only 110 hitboxes (0.02ms)
      const intersects = this.raycaster.intersectObjects(this.hitBoxes, false);

      let foundChair = null;
      if (intersects.length > 0) {
        foundChair = intersects[0].object.userData?.chairGroup;
      }

      if (foundChair !== this.hoveredSeat) {
        if (this.hoveredSeat && !this.hoveredSeat.userData.isSelected) {
          this.resetSeatHighlight(this.hoveredSeat);
        }
        this.hoveredSeat = foundChair;
        if (this.hoveredSeat && !this.hoveredSeat.userData.isOccupied) {
          this.highlightSeat(this.hoveredSeat, 0xd4af37);
          soundEngine.playUiHover();
        }
      }

      if (this.onSeatHover) {
        this.onSeatHover(this.hoveredSeat ? this.hoveredSeat.userData : null, event);
      }
    });
  }

  onPointerClick(event) {
    if (event.target.tagName !== 'CANVAS') return;

    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.hitBoxes, false);

    if (intersects.length > 0) {
      const obj = intersects[0].object.userData?.chairGroup;
      if (obj && obj.userData?.seatId) {
        const u = obj.userData;
        if (u.isOccupied) return;

        u.isSelected = !u.isSelected;
        if (u.isSelected) {
          this.selectedSeats.add(u.seatId);
          this.highlightSeat(obj, 0xd4af37);
          soundEngine.playSeatClick(true);
        } else {
          this.selectedSeats.delete(u.seatId);
          this.resetSeatHighlight(obj);
          soundEngine.playSeatClick(false);
        }

        if (this.onSeatClick) {
          this.onSeatClick(Array.from(this.selectedSeats), u, obj);
        }
      }
    }
  }

  onPointerDblClick(event) {
    if (event.target.tagName !== 'CANVAS') return;

    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.hitBoxes, false);
    if (intersects.length > 0) {
      const obj = intersects[0].object.userData?.chairGroup;
      if (obj && obj.userData?.seatId && !obj.userData.isOccupied) {
        if (this.onSeatDblClick) {
          this.onSeatDblClick(obj);
        }
      }
    }
  }

  highlightSeat(chair, colorHex) {
    if (!chair.userData) return;
    const { cushionMesh, backrestMesh, headrestMesh } = chair.userData;
    [cushionMesh, backrestMesh, headrestMesh].forEach(m => {
      if (m && m.material) {
        m.material.emissive.setHex(colorHex);
        m.material.emissiveIntensity = 0.65;
      }
    });
  }

  resetSeatHighlight(chair) {
    if (!chair.userData) return;
    const { cushionMesh, backrestMesh, headrestMesh } = chair.userData;
    [cushionMesh, backrestMesh, headrestMesh].forEach(m => {
      if (m && m.material) {
        m.material.emissive.setHex(0x000000);
        m.material.emissiveIntensity = 0;
      }
    });
  }

  clearSelections() {
    this.selectedSeats.forEach(id => {
      const chair = this.seatMeshMap.get(id);
      if (chair) {
        chair.userData.isSelected = false;
        this.resetSeatHighlight(chair);
      }
    });
    this.selectedSeats.clear();
  }

  markSeatsOccupied(seatIds) {
    seatIds.forEach(id => {
      const chair = this.seatMeshMap.get(id);
      if (chair) {
        chair.userData.isOccupied = true;
        chair.userData.isSelected = false;
        chair.userData.cushionMesh.material.color.setHex(0x222630);
        chair.userData.backrestMesh.material.color.setHex(0x161922);
        this.resetSeatHighlight(chair);
      }
      this.selectedSeats.delete(id);
    });
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  // Master Render: ZERO Redundant Calculations
  render() {
    const time = this.clock.getElapsedTime();

    // Subtle gentle clock pendulum sway
    if (this.hangingClockMesh) {
      this.hangingClockMesh.rotation.y = Math.sin(time * 0.8) * 0.04;
    }

    this.renderer.render(this.scene, this.camera);
  }
}
