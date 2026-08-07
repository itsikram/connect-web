const HANDLED_KEY = 'ludo_handled_invites';
const ACTIVE_GAME_KEY = 'ludo_active_game_id';

export const getInviteKey = (gameId, from) => `${gameId}:${from || ''}`;

const readHandledSet = () => {
    try {
        const raw = sessionStorage.getItem(HANDLED_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return new Set(Array.isArray(parsed) ? parsed : []);
    } catch (_) {
        return new Set();
    }
};

const writeHandledSet = (set) => {
    try {
        sessionStorage.setItem(HANDLED_KEY, JSON.stringify([...set]));
    } catch (_) {}
};

export const markInviteHandled = (gameId, from) => {
    if (!gameId) return;
    const set = readHandledSet();
    set.add(getInviteKey(gameId, from));
    writeHandledSet(set);
};

export const isInviteHandled = (gameId, from) => {
    if (!gameId) return false;
    return readHandledSet().has(getInviteKey(gameId, from));
};

export const setActiveLudoGameId = (gameId) => {
    if (!gameId) return;
    try {
        sessionStorage.setItem(ACTIVE_GAME_KEY, String(gameId));
    } catch (_) {}
};

export const getActiveLudoGameId = () => {
    try {
        return sessionStorage.getItem(ACTIVE_GAME_KEY) || '';
    } catch (_) {
        return '';
    }
};

export const clearActiveLudoGameId = () => {
    try {
        sessionStorage.removeItem(ACTIVE_GAME_KEY);
    } catch (_) {}
};

export const isUserInLudoGame = (gameId) => {
    if (!gameId) return false;
    const activeId = getActiveLudoGameId();
    if (activeId && String(activeId) === String(gameId)) return true;

    try {
        const savedState = localStorage.getItem('ludo_game_state');
        if (savedState) {
            const parsed = JSON.parse(savedState);
            if (parsed?.gameId && String(parsed.gameId) === String(gameId)) {
                return true;
            }
        }
    } catch (_) {}

    return false;
};

export const shouldShowLudoInviteAlert = (gameId, from) => {
    if (!gameId) return false;
    if (isInviteHandled(gameId, from)) return false;
    if (isUserInLudoGame(gameId)) return false;
    return true;
};
