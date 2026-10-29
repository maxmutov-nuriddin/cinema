import { CinemaScene } from './scene.js';
import { ParallaxController } from './parallax.js';
import { UIManager } from './ui.js';

window.addEventListener('DOMContentLoaded', async () => {
  const container = document.getElementById('webgl-container');

  let uiManager;
  let parallaxController;

  // Initialize Three.js Cinema Scene
  const scene = new CinemaScene(
    container,
    (selectedIds, seatData, chairGroup) => {
      if (uiManager) uiManager.handleSeatSelectionChange(selectedIds, seatData, chairGroup);
    },
    (hoveredSeatData, event) => {
      if (uiManager) uiManager.showSeatTooltip(hoveredSeatData, event);
    }
  );

  // Initialize Parallax & Dolly controller
  parallaxController = new ParallaxController(scene.camera, scene);

  // Initialize UI & Data manager
  uiManager = new UIManager(scene, parallaxController);
  await uiManager.loadInitialData();

  // Double-click any seat in 3D to instantly sit down and view screen (POV)!
  scene.onSeatDblClick = (chairGroup) => {
    uiManager.enterSeatPOV(chairGroup);
  };

  // Master Render & Animation Loop
  function animate() {
    requestAnimationFrame(animate);

    // Update 3D parallax & scroll dolly
    parallaxController.update();

    // Render cinema room scene
    scene.render();
  }

  animate();
});

