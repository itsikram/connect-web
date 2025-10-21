'use client';

import React, { useCallback } from 'react';
import Particles from 'react-tsparticles';
import type { Engine } from 'tsparticles-engine';
import { loadFull } from 'tsparticles';

type ParticleBackgroundProps = { id?: string };

const ParticlesBackground: React.FC<ParticleBackgroundProps> = ({ id = 'tsparticles' }) => {
  const particlesInit = useCallback(async (engine: Engine) => {
    await loadFull(engine);
  }, []);

  // Responsive particle count based on screen size
  const getParticleCount = () => {
    if (typeof window === 'undefined') return 200;
    const width = window.innerWidth;
    if (width < 480) return 50;
    if (width < 768) return 100;
    if (width < 992) return 150;
    return 200;
  };

  return (
    <Particles
      id={id}
      init={particlesInit}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      options={{
        fullScreen: { enable: false },
        background: {
          color: 'transparent',
        },
        particles: {
          number: {
            value: getParticleCount(),
            density: {
              enable: true,
              area: 800,
            },
          },
          color: {
            value: '#ffffff',
          },
          shape: {
            type: 'circle',
          },
          opacity: {
            value: 0.7,
            random: true,
          },
          size: {
            value: { min: 1, max: 4 },
          },
          move: {
            enable: true,
            speed: { min: 0.3, max: 1 },
            direction: 'bottom',
            straight: false,
            outModes: {
              default: 'out',
            },
            random: true,
          },
          wobble: {
            enable: true,
            distance: 5,
            speed: 0.5,
          },
        },
        interactivity: {
          events: {
            onHover: {
              enable: false,
            },
            onClick: {
              enable: false,
            },
            resize: true,
          },
        },
        detectRetina: true,
      }}
    />
  );
};

export default ParticlesBackground;
