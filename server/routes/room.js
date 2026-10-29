import express from 'express';

const router = express.Router();

const roomSpecs = {
  name: "Onyx Horizon 3D Cinema",
  specs: {
    screen: {
      type: "Super-Curved High-Gain Silver Screen",
      curvatureRadius: 36,
      widthMeters: 24,
      heightMeters: 10.5,
      gain: 2.4,
      laserProjector: "Dual 4K RGB Laser Christie 60,000 Lumens"
    },
    audio: {
      system: "Dolby Atmos Spatial 128ch",
      subwoofers: "4x 21-inch infrasonic sub-bass drivers (down to 16Hz)",
      surroundSpeakers: "64 side, ceiling and rear coaxial monitors"
    },
    acoustics: {
      reverbTimeRT60: "0.22 seconds",
      absorptionPanels: "Micro-perforated acoustic velvet wall arrays"
    }
  },
  lightingPresets: [
    {
      id: "cinematic-dim",
      name: "Cinematic Immersion",
      ambientColor: "#050814",
      ambientIntensity: 0.25,
      screenGlowIntensity: 1.8,
      aisleLights: true,
      wallSconcesIntensity: 0.1
    },
    {
      id: "neon-cyber",
      name: "Neon Glow",
      ambientColor: "#0b0420",
      ambientIntensity: 0.5,
      screenGlowIntensity: 2.2,
      aisleLights: true,
      wallSconcesIntensity: 0.8
    },
    {
      id: "trailer-spotlight",
      name: "Showtime Intro",
      ambientColor: "#08121e",
      ambientIntensity: 0.4,
      screenGlowIntensity: 1.5,
      aisleLights: true,
      wallSconcesIntensity: 0.4
    }
  ],
  cameraPresets: [
    { id: "default", name: "Auditorium Walkthrough", position: { x: 0, y: 5.5, z: 22 }, target: { x: 0, y: 4, z: -10 } },
    { id: "vip", name: "VIP Director's Balcony", position: { x: 0, y: 11, z: 27 }, target: { x: 0, y: 3.5, z: -10 } },
    { id: "center", name: "Sweet Spot (Row C)", position: { x: 0, y: 3.8, z: 12 }, target: { x: 0, y: 4.5, z: -10 } },
    { id: "front", name: "Front Row IMAX Immersion", position: { x: 0, y: 2.2, z: 3 }, target: { x: 0, y: 5.0, z: -10 } }
  ]
};

router.get('/', (req, res) => {
  res.json({ success: true, data: roomSpecs });
});

export default router;

