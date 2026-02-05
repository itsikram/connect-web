import React from 'react';
import { WinnerConfetti } from './WinnerConfetti';

export const WinnerModal = ({ winner, gameEnded, onContinueGame, onEndGame }) => {
    if (!winner) return null;

    return (
        <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 3000 }}>
            <div style={{ width: '100%', maxWidth: 520, position: 'relative' }}>
                <WinnerConfetti />
                <div style={{
                    background: 'linear-gradient(180deg, rgba(26,35,50,0.95), rgba(26,35,50,0.92))',
                    borderRadius: 28,
                    padding: 28,
                    border: '2px solid rgba(255, 215, 0, 0.6)',
                    color: 'white',
                    textAlign: 'center',
                    boxShadow: '0 12px 40px rgba(0,0,0,0.5)'
                }}>
                    <div style={{ position: 'relative', marginBottom: 10 }}>
                        <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: 160, height: 160, borderRadius: 80, background: winner?.color || '#FFD700', filter: 'blur(32px)', opacity: 0.6, animation: 'winnerGlow 2.2s ease-in-out infinite' }} />
                        <div style={{ fontSize: 74, position: 'relative', animation: 'winnerPop 600ms ease forwards' }}>🏆</div>
                    </div>
                    <div style={{
                        fontSize: 28,
                        fontWeight: 900,
                        marginBottom: 6,
                        background: 'linear-gradient(90deg, #fff, #FFD700, #fff)',
                        WebkitBackgroundClip: 'text',
                        backgroundClip: 'text',
                        color: 'transparent',
                        backgroundSize: '200% 100%',
                        animation: 'textShine 2.8s linear infinite'
                    }}>{winner?.name} Wins!</div>
                    <div style={{ color: '#B0B0B0', marginBottom: 18 }}>Congratulations on your victory!</div>
                    <div style={{ display: 'flex', gap: 12 }}>
                        {!gameEnded && (
                            <button onClick={onContinueGame} style={{ flex: 1, background: winner?.color || '#555', color: 'white', padding: '12px 0', border: 'none', borderRadius: 20, cursor: 'pointer', fontWeight: 'bold' }}>Continue Game</button>
                        )}
                        <button onClick={onEndGame} style={{ flex: 1, background: '#FF4444', color: 'white', padding: '12px 0', border: 'none', borderRadius: 20, cursor: 'pointer', fontWeight: 'bold' }}>End Game</button>
                    </div>
                </div>
            </div>
        </div>
    );
};
