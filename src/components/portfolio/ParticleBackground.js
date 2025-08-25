// ParticleBackground.js
import React from "react";
import Particles from "react-tsparticles";
import { loadFull } from "tsparticles"; // core loader
import { useCallback } from "react";

const ParticleBackground = () => {
  const particlesInit = useCallback(async (engine) => {
    // engine should be the actual tsParticles engine, provided by <Particles />
    await loadFull(engine);
  }, []);

  const particlesLoaded = useCallback(async (container) => {
    // optional
  }, []);

  return (
    <Particles
      id="tsparticles"
      init={particlesInit}
      loaded={particlesLoaded}
      options={{
        background: {
          color: "#0d47a1"
        },
        particles: {
          color: { value: "#ffffff" },
          links: { enable: true, color: "#ffffff" },
          move: { enable: true },
          number: { value: 60 },
          opacity: { value: 0.5 },
          shape: { type: "circle" },
          size: { value: { min: 1, max: 5 } }
        }
      }}
    />
  );
};

export default ParticleBackground;
