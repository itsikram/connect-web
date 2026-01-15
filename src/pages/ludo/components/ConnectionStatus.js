import React from 'react';

export const ConnectionStatus = ({ socket, onlineMode, gameStarted, gameEnded }) => {
    if (!onlineMode || !gameStarted || gameEnded) return null;
    
    return (
        <div style={{ 
            position: 'fixed', 
            top: 10, 
            right: 10, 
            zIndex: 1000, 
            background: socket?.connected ? 'rgba(0, 200, 0, 0.9)' : 'rgba(255, 0, 0, 0.9)',
            color: 'white',
            padding: '6px 12px',
            borderRadius: 20,
            fontSize: 12,
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
        }}>
            <div style={{ 
                width: 8, 
                height: 8, 
                borderRadius: '50%', 
                background: socket?.connected ? '#00FF00' : '#FF0000'
            }} />
            {socket?.connected ? 'Connected' : 'Disconnected'}
        </div>
    );
};
