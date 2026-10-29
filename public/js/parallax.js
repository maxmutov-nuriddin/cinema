// LUMIERE CINEMA - Ultra-Smooth Camera, Gentle Parallax & Navigation Controller
export class ParallaxController {
  constructor(camera, sceneInstance) {
    this.camera = camera;
    this.scene = sceneInstance;

    // OrbitControls: Super-smooth, lightweight and responsive
    this.controls = new THREE.OrbitControls(this.camera, this.scene.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.rotateSpeed = 0.65;
    this.controls.enablePan = true;
    this.controls.panSpeed = 0.75;
    this.controls.screenSpacePanning = true;
    this.controls.enableZoom = true;
    this.controls.zoomSpeed = 0.85;

    // Boundaries: strictly within cinema hall limits
    this.controls.minDistance = 2.0;
    this.controls.maxDistance = 26.0;
    // maxPolarAngle ~86 deg: prevents camera from going under floor horizon
    this.controls.maxPolarAngle = Math.PI * 0.485;
    this.controls.minPolarAngle = Math.PI * 0.10;

    // Center of auditorium target
    this.controls.target.set(0, 4.2, 5.0);

    // Camera modes
    this.currentMode = "Auditorium overview";
    this.isTransitioning = false;
    this.transitionStart = 0;
    this.transitionDuration = 1100;
    this.startCamPos = new THREE.Vector3();
    this.targetCamPos = new THREE.Vector3();
    this.startTargetPos = new THREE.Vector3();
    this.targetTargetPos = new THREE.Vector3();

    // Gentle Cinematic Mouse Parallax Tilt ("Yengil qimirlash")
    this.mouseTilt = { x: 0, y: 0, targetX: 0, targetY: 0 };

    // First-Person Seat POV State
    this.isSeatPOV = false;
    this.activeChairMesh = null;
    this.seatEyePos = new THREE.Vector3();
    this.seatLookTarget = new THREE.Vector3(0, 5.2, -10.5);
    this.seatYaw = 0;
    this.seatPitch = 0;
    this.targetSeatYaw = 0;
    this.targetSeatPitch = 0;
    this.isDraggingPOV = false;
    this.prevPointer = { x: 0, y: 0 };

    // Auto Tour
    this.isAutoTouring = false;
    this.tourAngle = 0;

    // DOM Elements
    this.distanceIndicatorEl = document.getElementById('camera-distance-indicator');
    this.modeSelectorEl = document.getElementById('view-mode-select');
    this.fovSliderEl = document.getElementById('fov-slider');
    this.fovValueEl = document.getElementById('fov-value');
    this.povBannerEl = document.getElementById('seat-pov-banner');
    this.povSeatLabelEl = document.getElementById('pov-seat-label');
    this.povDistLabelEl = document.getElementById('pov-distance-label');
    this.exitPovBtn = document.getElementById('exit-pov-btn');

    this.setupEvents();
  }

  setupEvents() {
    // 1. Gentle Mouse Parallax Tracking (Subtle cinematic floating depth)
    window.addEventListener('mousemove', (e) => {
      const nx = (e.clientX / window.innerWidth - 0.5) * 2;
      const ny = (e.clientY / window.innerHeight - 0.5) * 2;
      this.mouseTilt.targetX = nx * 0.45;
      this.mouseTilt.targetY = -ny * 0.25;

      // In Seat POV: drag to look around
      if (this.isSeatPOV && this.isDraggingPOV) {
        const dx = e.clientX - this.prevPointer.x;
        const dy = e.clientY - this.prevPointer.y;
        this.prevPointer.x = e.clientX;
        this.prevPointer.y = e.clientY;

        this.targetSeatYaw -= dx * 0.003;
        this.targetSeatPitch -= dy * 0.0025;

        const maxYaw = Math.PI * 0.42;
        const maxPitch = Math.PI * 0.22;
        this.targetSeatYaw = THREE.MathUtils.clamp(this.targetSeatYaw, -maxYaw, maxYaw);
        this.targetSeatPitch = THREE.MathUtils.clamp(this.targetSeatPitch, -maxPitch, maxPitch);
      }
    });

    window.addEventListener('pointerdown', (e) => {
      if (this.isSeatPOV) {
        this.isDraggingPOV = true;
        this.prevPointer.x = e.clientX;
        this.prevPointer.y = e.clientY;
      }
    });

    window.addEventListener('pointerup', () => {
      this.isDraggingPOV = false;
    });

    // 2. Keyboard Navigation (Relative to viewing direction)
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isSeatPOV) {
        this.exitSeatPOV();
        return;
      }
      if (this.isSeatPOV) return;

      const moveSpeed = 0.8;
      const forward = new THREE.Vector3();
      this.camera.getWorldDirection(forward);
      forward.y = 0;
      forward.normalize();

      const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

      switch (e.key.toLowerCase()) {
        case 'w':
          this.camera.position.addScaledVector(forward, moveSpeed);
          this.controls.target.addScaledVector(forward, moveSpeed);
          break;
        case 's':
          this.camera.position.addScaledVector(forward, -moveSpeed);
          this.controls.target.addScaledVector(forward, -moveSpeed);
          break;
        case 'a':
          this.camera.position.addScaledVector(right, -moveSpeed);
          this.controls.target.addScaledVector(right, -moveSpeed);
          break;
        case 'd':
          this.camera.position.addScaledVector(right, moveSpeed);
          this.controls.target.addScaledVector(right, moveSpeed);
          break;
        case 'q':
          this.camera.position.y += moveSpeed * 0.5;
          this.controls.target.y += moveSpeed * 0.5;
          break;
        case 'e':
          this.camera.position.y -= moveSpeed * 0.5;
          this.controls.target.y -= moveSpeed * 0.5;
          break;
      }
    });

    // 3. FOV Slider
    if (this.fovSliderEl) {
      this.fovSliderEl.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        this.camera.fov = val;
        this.camera.updateProjectionMatrix();
        if (this.fovValueEl) this.fovValueEl.innerText = `${val}°`;
      });
    }

    // 4. Mode Selector Dropdown
    if (this.modeSelectorEl) {
      this.modeSelectorEl.addEventListener('change', (e) => {
        this.setMode(e.target.value);
      });
    }

    // 5. Exit POV Button
    if (this.exitPovBtn) {
      this.exitPovBtn.addEventListener('click', () => {
        this.exitSeatPOV();
      });
    }
  }

  setMode(mode) {
    if (this.isSeatPOV && mode !== "Screen view from seat") {
      this.exitSeatPOV(false);
    }

    this.currentMode = mode;
    if (this.modeSelectorEl) this.modeSelectorEl.value = mode;

    if (mode === "Facing the screen") {
      this.animateTo(new THREE.Vector3(0, 3.6, 5.0), new THREE.Vector3(0, 5.2, -10.5));
    } else if (mode === "Auditorium overview") {
      this.animateTo(new THREE.Vector3(0, 5.2, 17.5), new THREE.Vector3(0, 4.8, -10.5));
    } else if (mode === "Free flight") {
      this.animateTo(new THREE.Vector3(0, 3.2, -5.5), new THREE.Vector3(0, 4.8, 14.0));
    }
  }

  // Smooth View Transition with Easing
  animateTo(targetPosition, targetLookAt, duration = 1100, onComplete = null) {
    this.isTransitioning = true;
    this.transitionStart = performance.now();
    this.transitionDuration = duration;
    this.onTransitionComplete = onComplete;

    this.startCamPos.copy(this.camera.position);
    this.targetCamPos.copy(targetPosition);

    this.startTargetPos.copy(this.controls.target);
    this.targetTargetPos.copy(targetLookAt);
  }

  // First-Person Seated POV
  transitionToSeatPOV(chairGroup) {
    if (!chairGroup) return;
    this.activeChairMesh = chairGroup;
    this.currentMode = "Screen view from seat";
    if (this.modeSelectorEl) this.modeSelectorEl.value = "Auditorium overview";

    const pos = chairGroup.position;
    const u = chairGroup.userData || {};

    // Eye level sitting in the plush chair looking straight at screen center (-Z)
    this.seatEyePos.set(pos.x, pos.y + 1.40, pos.z + 0.22);
    this.seatLookTarget.set(0, 5.2, -10.5);

    this.seatYaw = 0;
    this.seatPitch = 0;
    this.targetSeatYaw = 0;
    this.targetSeatPitch = 0;

    this.animateTo(this.seatEyePos, this.seatLookTarget, 1100, () => {
      this.isSeatPOV = true;
      this.controls.enabled = false;
    });

    if (this.povBannerEl) {
      this.povBannerEl.style.display = 'flex';
      if (this.povSeatLabelEl) {
        this.povSeatLabelEl.innerText = `O'rindiq: ${u.seatId || 'Zal'}`;
      }
      if (this.povDistLabelEl) {
        const dist = Math.abs(pos.z - (-10.5));
        this.povDistLabelEl.innerText = `Ekrangacha masofa: ${Math.round(dist)} m`;
      }
    }
  }

  exitSeatPOV(animate = true) {
    this.isSeatPOV = false;
    this.controls.enabled = true;

    if (this.povBannerEl) {
      this.povBannerEl.style.display = 'none';
    }

    if (animate) {
      this.setMode("Auditorium overview");
    }
  }

  // D-Pad Navigation Controls (Relative and Natural)
  pan(direction) {
    if (this.isSeatPOV) {
      this.exitSeatPOV(false);
    }

    const step = 2.4;
    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();

    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

    if (direction === 'up') {
      this.controls.target.addScaledVector(forward, step);
      this.camera.position.addScaledVector(forward, step);
    } else if (direction === 'down') {
      this.controls.target.addScaledVector(forward, -step);
      this.camera.position.addScaledVector(forward, -step);
    } else if (direction === 'left') {
      this.controls.target.addScaledVector(right, -step);
      this.camera.position.addScaledVector(right, -step);
    } else if (direction === 'right') {
      this.controls.target.addScaledVector(right, step);
      this.camera.position.addScaledVector(right, step);
    } else if (direction === 'zoom-in') {
      this.camera.position.lerp(this.controls.target, 0.25);
    } else if (direction === 'zoom-out') {
      const dir = new THREE.Vector3().subVectors(this.camera.position, this.controls.target).normalize();
      this.camera.position.addScaledVector(dir, 3.0);
    }
  }

  toggleAutoTour() {
    this.isAutoTouring = !this.isAutoTouring;
    if (this.isAutoTouring) {
      if (this.isSeatPOV) this.exitSeatPOV(false);
      this.tourAngle = 0;
    }
    return this.isAutoTouring;
  }

  update() {
    // 1. Transition Flight Animation
    if (this.isTransitioning) {
      const now = performance.now();
      const progress = Math.min(1, (now - this.transitionStart) / this.transitionDuration);
      const ease = 1 - Math.pow(1 - progress, 3);

      this.camera.position.lerpVectors(this.startCamPos, this.targetCamPos, ease);
      this.controls.target.lerpVectors(this.startTargetPos, this.targetTargetPos, ease);
      this.camera.lookAt(this.controls.target);

      if (progress >= 1) {
        this.isTransitioning = false;
        if (this.onTransitionComplete) {
          this.onTransitionComplete();
          this.onTransitionComplete = null;
        }
      }
      this.updateDistanceIndicator();
      return;
    }

    // 2. Seated POV Mode: Look Around with Mouse
    if (this.isSeatPOV) {
      this.camera.position.copy(this.seatEyePos);

      this.seatYaw += (this.targetSeatYaw - this.seatYaw) * 0.12;
      this.seatPitch += (this.targetSeatPitch - this.seatPitch) * 0.12;

      const baseDir = new THREE.Vector3().subVectors(this.seatLookTarget, this.seatEyePos).normalize();
      const lookDir = baseDir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), this.seatYaw);
      const rightAxis = new THREE.Vector3().crossVectors(lookDir, new THREE.Vector3(0, 1, 0)).normalize();
      lookDir.applyAxisAngle(rightAxis, this.seatPitch);

      this.camera.lookAt(this.seatEyePos.clone().add(lookDir));
      this.updateDistanceIndicator();
      return;
    }

    // 3. Auto Tour Mode
    if (this.isAutoTouring) {
      this.tourAngle += 0.005;
      const radius = 14.0;
      const camX = Math.sin(this.tourAngle) * radius;
      const camZ = 8.0 + Math.cos(this.tourAngle) * 9.0;
      const camY = 5.2 + Math.sin(this.tourAngle * 2) * 1.5;

      this.camera.position.set(camX, camY, camZ);
      this.controls.target.set(0, 4.5, -5.0);
      this.camera.lookAt(this.controls.target);
      this.updateDistanceIndicator();
      return;
    }

    // 4. Gentle Parallax Tilt & Smooth Orbit Controls
    this.mouseTilt.x += (this.mouseTilt.targetX - this.mouseTilt.x) * 0.06;
    this.mouseTilt.y += (this.mouseTilt.targetY - this.mouseTilt.y) * 0.06;

    // Apply gentle parallax depth to camera
    this.camera.position.x += this.mouseTilt.x * 0.015;
    this.camera.position.y += this.mouseTilt.y * 0.015;

    this.controls.update();

    // 5. Soft Cinema Bounds (No Hard Freezing or Fighting)
    const cam = this.camera.position;
    cam.x = THREE.MathUtils.clamp(cam.x, -11.2, 11.2);
    cam.z = THREE.MathUtils.clamp(cam.z, -6.0, 23.0);

    // Floor height: tiered risers
    let minFloorY = 1.8;
    if (cam.z > 0) {
      minFloorY = 1.0 + Math.min(1.0, cam.z / 23.0) * 4.2;
    }
    cam.y = THREE.MathUtils.clamp(cam.y, minFloorY, 10.0);

    // Target clamping inside hall
    const tgt = this.controls.target;
    tgt.x = THREE.MathUtils.clamp(tgt.x, -8.0, 8.0);
    tgt.y = THREE.MathUtils.clamp(tgt.y, 1.8, 7.0);
    tgt.z = THREE.MathUtils.clamp(tgt.z, -9.0, 16.0);

    this.updateDistanceIndicator();
  }

  updateDistanceIndicator() {
    if (this.distanceIndicatorEl) {
      const dist = Math.abs(this.camera.position.z - (-10.5));
      const h = this.camera.position.y;
      this.distanceIndicatorEl.innerText = `Distance to screen ${Math.round(dist)} m • Height ${h.toFixed(1)} m`;
    }
  }
}
