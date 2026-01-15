import { getSocketUrl } from '../../../utils/offlineUtils';

// Get socket base URL
export const getSocketBaseUrl = () => {
    try {
        // Use offline utils for fallback
        const url = getSocketUrl();
        const normalized = url.replace(/\/$/, '');
        return normalized;
    } catch (_e) {
        // Fallback to localhost if offline utils fail
        try {
            const loc = window.location;
            const hostname = loc.hostname;
            const protocol = loc.protocol;
            const fallback = (hostname === 'localhost' || hostname === '127.0.0.1') 
                ? `${protocol}//localhost:4000`
                : `${protocol}//${hostname}`;
            return fallback.replace(/\/$/, '');
        } catch (_e2) {
            return 'http://localhost:4000';
        }
    }
};

// Safe helper to emit even if socket is still connecting
export const emitSocket = (socket, event, payload) => {
    try {
        if (!socket) return false;
        const doEmit = () => { try { socket.emit(event, payload); } catch (_e) { } };
        if (socket.connected) { doEmit(); return true; }
        const onConnect = () => { doEmit(); socket.off('connect', onConnect); };
        socket.on('connect', onConnect);
        return true;
    } catch (_e) { return false; }
};

// Generate game ID
export const generateGameId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

// Create invite token
export const createInviteToken = (gameId, myProfile, selectedPlayerCount) => {
    const payload = {
        type: 'ludo_invite',
        by: myProfile?._id || 'anon',
        name: myProfile?.fullName || 'Player',
        ts: Date.now(),
        gameId: gameId || generateGameId(),
        playerCount: selectedPlayerCount
    };
    return btoa(JSON.stringify(payload));
};
