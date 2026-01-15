import api from '../../../api/api';

// API functions for saving/loading game state
export const saveGameStateToDB = async (gameState, retries = 2) => {
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const response = await api.post('/ludo/save', gameState);
            return response.data;
        } catch (error) {
            const isVersionError = error.response?.status === 500 && 
                (error.response?.data?.message?.includes('VersionError') || 
                 error.response?.data?.message?.includes('No matching document'));
            
            // Version conflicts are expected in concurrent scenarios - don't log as error
            if (isVersionError) {
                // If this is the last attempt, silently fail (version conflict is acceptable)
                if (attempt === retries) {
                    return null;
                }
                // Wait before retrying (exponential backoff)
                await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, attempt)));
                continue;
            }
            
            // For other errors, log and return null
            if (attempt === retries) {
                console.debug('Error saving game state to database:', error);
            }
            return null;
        }
    }
    return null;
};

export const loadGameStateFromDB = async (gameId) => {
    try {
        const response = await api.get('/ludo/state', { params: { gameId } });
        return response.data?.game || null;
    } catch (error) {
        // 404 is expected if game doesn't exist yet - don't log as error
        if (error.response?.status === 404) {
            return null;
        }
        // Only log unexpected errors
        console.debug('Error loading game state from database:', error);
        return null;
    }
};

// Save game state to localStorage for reconnection
export const saveGameStateToLocalStorage = (gameId, myPlayerIndex, onlineMode, selectedPlayerCount, profileId) => {
    try {
        if (onlineMode && gameId && profileId) {
            const state = {
                gameId,
                myPlayerIndex,
                onlineMode,
                selectedPlayerCount,
                profileId,
                timestamp: Date.now()
            };
            localStorage.setItem('ludo_game_state', JSON.stringify(state));
            return state;
        }
    } catch (_e) {
        // Ignore localStorage errors
    }
    return null;
};

// Load game state from localStorage
export const loadGameStateFromLocalStorage = (myProfileId) => {
    try {
        const saved = localStorage.getItem('ludo_game_state');
        if (!saved) return null;
        const state = JSON.parse(saved);
        // Only restore if it's recent (within 24 hours) and belongs to current user
        const isRecent = state.timestamp && (Date.now() - state.timestamp) < 24 * 60 * 60 * 1000;
        const isMyGame = state.profileId && myProfileId && String(state.profileId) === String(myProfileId);
        if (isRecent && isMyGame) {
            return state;
        } else {
            // Clear stale state
            localStorage.removeItem('ludo_game_state');
        }
    } catch (_e) {
        localStorage.removeItem('ludo_game_state');
    }
    return null;
};

// Clear saved game state
export const clearGameStateFromLocalStorage = () => {
    try {
        localStorage.removeItem('ludo_game_state');
    } catch (_e) {
        // Ignore errors
    }
};
