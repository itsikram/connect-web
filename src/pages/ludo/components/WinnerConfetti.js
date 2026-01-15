import React from 'react';

export const WinnerConfetti = ({ count = 60 }) => {
    const pieces = Array.from({ length: count }).map((_, i) => {
        const left = Math.random() * 100; // vw percentage
        const size = 6 + Math.random() * 6;
        const hue = Math.floor(Math.random() * 360);
        const delay = (Math.random() * 1.5).toFixed(2) + 's';
        const duration = (2 + Math.random() * 2.5).toFixed(2) + 's';
        const rotate = Math.random() * 360;
        return (
            <div key={i} style={{
                position: 'absolute',
                top: -20,
                left: left + '%',
                width: size,
                height: size * 0.36,
                background: `hsl(${hue} 85% 60%)`,
                transform: `rotate(${rotate}deg)`,
                borderRadius: 2,
                animation: `confettiFall ${duration} ease-in forwards`,
                animationDelay: delay,
                boxShadow: '0 0 6px rgba(0,0,0,0.15)'
            }} />
        );
    });
    return (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
            <style>{`
                @keyframes confettiFall {
                    0% { transform: translateY(-20px) rotate(0deg); opacity: 0; }
                    10% { opacity: 1; }
                    100% { transform: translateY(100vh) rotate(720deg); opacity: 0.9; }
                }
                @keyframes winnerPop { 0% { transform: scale(0.6); opacity: 0; } 60% { transform: scale(1.08); opacity: 1; } 100% { transform: scale(1); }
                }
                @keyframes winnerGlow { 0% { opacity: 0.6; transform: scale(0.9); } 50% { opacity: 1; transform: scale(1.05);} 100% { opacity: 0.6; transform: scale(0.9);} }
                @keyframes textShine { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
            `}</style>
            {pieces}
        </div>
    );
};
