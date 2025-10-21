// Global type declarations for JavaScript modules that don't have TypeScript definitions

declare module '*.css' {
  const content: { [className: string]: string };
  export default content;
}

declare module '*.scss' {
  const content: { [className: string]: string };
  export default content;
}

declare module '*.sass' {
  const content: { [className: string]: string };
  export default content;
}

declare module '*.png' {
  const content: string;
  export default content;
}

declare module '*.jpg' {
  const content: string;
  export default content;
}

declare module '*.jpeg' {
  const content: string;
  export default content;
}

declare module '*.gif' {
  const content: string;
  export default content;
}

declare module '*.svg' {
  const content: string;
  export default content;
}

declare module '*.ico' {
  const content: string;
  export default content;
}

declare module '*.webp' {
  const content: string;
  export default content;
}

// Common modules that might not have TypeScript definitions
declare module 'react-tsparticles' {
  import { ComponentType } from 'react';
  import { Engine } from 'tsparticles-engine';
  
  interface ParticlesProps {
    id?: string;
    init?: (engine: Engine) => Promise<void>;
    options?: any;
    className?: string;
    style?: React.CSSProperties;
  }
  
  const Particles: ComponentType<ParticlesProps>;
  export default Particles;
}

declare module 'tsparticles-engine' {
  export interface Engine {
    // Add basic engine properties if needed
  }
}

declare module 'tsparticles' {
  export function loadFull(engine: any): Promise<void>;
}

// Add declarations for other modules as needed
declare module 'react-confirm-alert';
declare module 'react-password-checklist';
declare module 'react-scroll-to-bottom';
declare module 'react-responsive-masonry';
declare module 'react-router-guarded-routes';
declare module 'mic-recorder-to-mp3';
declare module 'local-ip';
declare module 'simple-peer';
declare module 'peerjs';

// Global variables that might be used in your app
declare global {
  interface Window {
    // Add any global window properties your app uses
    [key: string]: any;
  }
}

export {};
