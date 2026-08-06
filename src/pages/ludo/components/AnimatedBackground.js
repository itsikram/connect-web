import React from 'react';

export const AnimatedBackground = () => {
    return (
        <div
            aria-hidden="true"
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: -1,
                pointerEvents: 'none',
                overflow: 'hidden',
                background:
                    'radial-gradient(1000px 700px at 12% -8%, #152436 0%, #0c1219 55%), radial-gradient(800px 600px at 100% 100%, #102018 0%, transparent 55%)',
            }}
        >
            <style>{`
                @keyframes ludoDriftA { 0% { transform: translate3d(-8%, -6%, 0); } 50% { transform: translate3d(6%, 8%, 0); } 100% { transform: translate3d(-8%, -6%, 0); } }
                @keyframes ludoDriftB { 0% { transform: translate3d(8%, 12%, 0); } 50% { transform: translate3d(-6%, -8%, 0); } 100% { transform: translate3d(8%, 12%, 0); } }
            `}</style>
            <div style={{ position: 'absolute', width: '48vw', height: '48vw', left: '-12vw', top: '-8vw', background: '#2ec4b6', opacity: 0.07, filter: 'blur(72px)', borderRadius: '50%', animation: 'ludoDriftA 22s ease-in-out infinite' }} />
            <div style={{ position: 'absolute', width: '42vw', height: '42vw', right: '-10vw', top: '18vh', background: '#3ec6ff', opacity: 0.08, filter: 'blur(80px)', borderRadius: '50%', animation: 'ludoDriftB 26s ease-in-out infinite' }} />
            <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px)', backgroundSize: '24px 24px', opacity: 0.5 }} />
        </div>
    );
};
