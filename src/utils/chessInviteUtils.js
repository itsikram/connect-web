import api from "../api/api";

const HANDLED_KEY = "chess_handled_invites";
const ACTIVE_GAME_KEY = "chess_active_game_id";

export const getChessInviteKey = (gameId, from) => `${gameId}:${from || ""}`;

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

export const markChessInviteHandled = (gameId, from) => {
  if (!gameId) return;
  const set = readHandledSet();
  set.add(getChessInviteKey(gameId, from));
  writeHandledSet(set);
};

export const isChessInviteHandled = (gameId, from) => {
  if (!gameId) return false;
  return readHandledSet().has(getChessInviteKey(gameId, from));
};

export const setActiveChessGameId = (gameId) => {
  if (!gameId) return;
  try {
    sessionStorage.setItem(ACTIVE_GAME_KEY, String(gameId));
  } catch (_) {}
};

export const getActiveChessGameId = () => {
  try {
    return sessionStorage.getItem(ACTIVE_GAME_KEY) || "";
  } catch (_) {
    return "";
  }
};

export const clearActiveChessGameId = () => {
  try {
    sessionStorage.removeItem(ACTIVE_GAME_KEY);
  } catch (_) {}
};

export const clearHandledChessInvites = () => {
  try {
    sessionStorage.removeItem(HANDLED_KEY);
  } catch (_) {}
};

export const isUserInChessGame = (gameId) => {
  if (!gameId) return false;
  const activeId = getActiveChessGameId();
  if (activeId && String(activeId) === String(gameId)) return true;

  try {
    const savedState = localStorage.getItem("chess_game_state");
    if (savedState) {
      const parsed = JSON.parse(savedState);
      if (parsed?.gameId && String(parsed.gameId) === String(gameId)) {
        return true;
      }
    }
  } catch (_) {}

  return false;
};

export const shouldShowChessInviteAlert = (gameId, from, invite = null) => {
  if (!gameId) return false;
  if (invite?.reinvite === true) return true;
  if (isChessInviteHandled(gameId, from)) return false;
  if (isUserInChessGame(gameId)) return false;
  return true;
};

export const resolveChessInviteNotifications = async (gameId, inviterId) => {
  if (!gameId) return;
  try {
    await api.post("/notification/resolve-chess-invite", {
      gameId,
      inviterId,
    });
  } catch (_e) {
    // Local handled/active-game checks still hide the invite if this fails.
  }
};
