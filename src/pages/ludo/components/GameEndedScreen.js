import React from 'react';
import { PLAYER_EMOJIS } from '../constants/gameConstants';

export const GameEndedScreen = ({ winners, onResetGame }) => {
    return (
        <div style={{ minHeight: '100vh', background: '#1a1a2e', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div style={{ maxWidth: 600, textAlign: 'center' }}>
                <div style={{ fontSize: 100, color: '#FFD700', marginBottom: 16 }}>🏆</div>
                <div style={{ fontSize: 36, fontWeight: 'bold', color: '#FFD700', marginBottom: 8 }}>Game Complete!</div>
                <div style={{ color: '#B0B0B0', marginBottom: 24 }}>All players have finished!</div>
                <div>
                    {winners.map((w, i) => (
                        <div key={w.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: w.color, padding: 12, borderRadius: 12, marginBottom: 10 }}>
                            <div style={{ fontWeight: 'bold' }}>#{i + 1}</div>
                            <div style={{ fontWeight: 'bold', flex: 1 }}>{w.name}</div>
                            <div>{PLAYER_EMOJIS[w.id]}</div>
                        </div>
                    ))}
                </div>
                <button onClick={onResetGame} style={{ marginTop: 16, background: '#00AA00', color: 'white', padding: '12px 24px', borderRadius: 20, border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>
                    Play Again
                </button>
            </div>
        </div>
    );
};
