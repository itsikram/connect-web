import api from "../api/api";

const HANDLED_KEY = "ludo_handled_invites";
const ACTIVE_GAME_KEY = "ludo_active_game_id";

export const getInviteKey = (gameId, from) => `${gameId}:${from || ""}`;

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
    return sessionStorage.getItem(ACTIVE_GAME_KEY) || "";
  } catch (_) {
    return "";
  }
};

export const clearActiveLudoGameId = () => {
  try {
    sessionStorage.removeItem(ACTIVE_GAME_KEY);
  } catch (_) {}
};

export const clearHandledLudoInvites = () => {
  try {
    sessionStorage.removeItem(HANDLED_KEY);
  } catch (_) {}
};

export const clearHandledLudoInvite = (gameId, from) => {
  if (!gameId) return;
  try {
    const set = readHandledSet();
    set.delete(getInviteKey(gameId, from));
    writeHandledSet(set);
  } catch (_) {}
};

export const isUserInLudoGame = (gameId) => {
  if (!gameId) return false;
  const activeId = getActiveLudoGameId();
  if (activeId && String(activeId) === String(gameId)) return true;

  try {
    const savedState = localStorage.getItem("ludo_game_state");
    if (savedState) {
      const parsed = JSON.parse(savedState);
      if (parsed?.gameId && String(parsed.gameId) === String(gameId)) {
        return true;
      }
    }
  } catch (_) {}

  return false;
};

export const shouldShowLudoInviteAlert = (gameId, from, invite = null) => {
  if (!gameId) return false;
  // A re-invite is a new explicit request for the same room. It must not be
  // hidden by the handled/active markers belonging to the earlier invite.
  if (invite?.reinvite === true) return true;
  if (isInviteHandled(gameId, from)) return false;
  if (isUserInLudoGame(gameId)) return false;
  return true;
};

// Once an invite has been accepted or declined, remove the persisted
// database notification(s) for it too, so "X invited you to play Ludo"
// never resurfaces (e.g. in the notification bell, on another device, or
// after clearing session storage). Invitation alerts/notifications should
// only ever be visible before the invite is resolved.
export const resolveLudoInviteNotifications = async (gameId, inviterId) => {
  if (!gameId) return;
  try {
    await api.post("/notification/resolve-ludo-invite", {
      gameId,
      inviterId,
    });
  } catch (_e) {
    // Non-critical - the client-side handled/active-game checks already
    // hide the invite locally even if this cleanup call fails.
  }
};
