import React from 'react';

export const ConnectionStatus = ({ socket, onlineMode, gameStarted, gameEnded }) => {
    if (!onlineMode || !gameStarted || gameEnded) return null;

    const connected = Boolean(socket?.connected);

    return (
        <div
            className={`ludo-connection ${connected ? 'ludo-connection--ok' : 'ludo-connection--bad'}`}
            data-connection-status
            aria-live="polite"
        >
            <span className="ludo-connection__dot" />
            {connected ? 'Connected' : 'Disconnected'}
        </div>
    );
};
