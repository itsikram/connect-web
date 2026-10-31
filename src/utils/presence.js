// Live online/offline status of other profiles, fed by the server's socket
// presence (server/sockets/presence.js):
//   presence_snapshot { statuses }  - sent on (re)connect for all connects and
//                                     in reply to presence:subscribe
//   presence_update   { profileId, isActive, lastSeen } - instant changes
// Components read it with usePresence(id) / usePresenceVersion(); a status
// from here always wins over HTTP / cached contact data.
import { useEffect, useSyncExternalStore } from "react";
import socket from "../common/socket";

const statuses = new Map(); // profileId -> { isActive, lastSeen }
const watchCounts = new Map(); // profileId -> number of mounted watchers
const listeners = new Set();
let version = 0;
let started = false;
let pendingSubscribe = new Set();
let subscribeTimer = null;

const emitChange = () => {
  version += 1;
  listeners.forEach((listener) => {
    try {
      listener();
    } catch (_e) {
      /* ignore */
    }
  });
};

const applyStatus = (profileId, status) => {
  if (!profileId || !status) return false;
  const id = String(profileId);
  const next = {
    isActive: Boolean(status.isActive),
    lastSeen: status.lastSeen || null,
  };
  const prev = statuses.get(id);
  if (prev && prev.isActive === next.isActive && prev.lastSeen === next.lastSeen) {
    return false;
  }
  statuses.set(id, next);
  return true;
};

const applySnapshot = (payload) => {
  const map = payload?.statuses || {};
  let changed = false;
  Object.keys(map).forEach((id) => {
    if (applyStatus(id, map[id])) changed = true;
  });
  if (changed) emitChange();
};

const handleUpdate = (payload) => {
  if (!payload?.profileId) return;
  if (applyStatus(payload.profileId, payload)) emitChange();
};

let pendingConnects = false;

const flushSubscribe = () => {
  subscribeTimer = null;
  const ids = [...pendingSubscribe];
  const connects = pendingConnects;
  pendingSubscribe = new Set();
  pendingConnects = false;
  if ((!ids.length && !connects) || !socket.connected) return;
  socket.emit("presence:subscribe", { profileIds: ids, connects }, applySnapshot);
};

const queueSubscribe = (ids, { connects = false } = {}) => {
  ids.forEach((id) => pendingSubscribe.add(String(id)));
  if (connects) pendingConnects = true;
  if (!subscribeTimer) subscribeTimer = setTimeout(flushSubscribe, 50);
};

const isLoggedIn = () => {
  try {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    return Boolean(user && (user.profile || user.user_id));
  } catch (_e) {
    return false;
  }
};

// Tells the server whether the user is looking at this tab right now; while
// any of their tabs/devices is focused the server skips push notifications.
const isFocused = () =>
  document.visibilityState === "visible" && document.hasFocus();
let lastFocus = null;
const reportFocus = (force = false) => {
  const focused = isFocused();
  if (!socket.connected || (!force && focused === lastFocus)) return;
  lastFocus = focused;
  socket.emit("presence:focus", { focused });
};

export const startPresence = () => {
  if (started || typeof window === "undefined") return;
  started = true;

  socket.on("presence_snapshot", applySnapshot);
  socket.on("presence_update", handleUpdate);
  // The socket may have connected (and received its snapshot) before this
  // module started listening: ask again.
  if (socket.connected) queueSubscribe([...watchCounts.keys()], { connects: true });
  socket.on("connect", () => {
    // The server re-sends the connects snapshot itself; re-watch the rest.
    if (watchCounts.size) queueSubscribe([...watchCounts.keys()]);
    if (document.visibilityState === "visible") socket.emit("presence:active");
    reportFocus(true);
  });
  if (socket.connected) reportFocus(true);

  // Coming back to the tab / network: reconnect right away instead of
  // waiting for socket.io's backoff, and refresh statuses.
  const wake = () => {
    if (!isLoggedIn()) return;
    if (!socket.connected) {
      socket.connect();
    } else {
      socket.emit("presence:active");
      queueSubscribe([...watchCounts.keys()], { connects: true });
    }
  };
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") wake();
    reportFocus();
  });
  window.addEventListener("online", wake);
  window.addEventListener("focus", () => {
    wake();
    reportFocus();
  });
  window.addEventListener("blur", () => reportFocus());
};

export const getPresence = (profileId) =>
  profileId ? statuses.get(String(profileId)) : undefined;

export const watchPresence = (profileIds) => {
  const ids = [...new Set((profileIds || []).filter(Boolean).map(String))];
  startPresence();
  const fresh = [];
  ids.forEach((id) => {
    const count = watchCounts.get(id) || 0;
    if (count === 0) fresh.push(id);
    watchCounts.set(id, count + 1);
  });
  if (fresh.length) queueSubscribe(fresh);
  return () => {
    ids.forEach((id) => {
      const count = (watchCounts.get(id) || 1) - 1;
      if (count <= 0) watchCounts.delete(id);
      else watchCounts.set(id, count);
    });
  };
};

const subscribeStore = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const getVersion = () => version;

// Re-render whenever any status changes; read values with getPresence().
export const usePresenceVersion = () => {
  useEffect(() => {
    startPresence();
  }, []);
  return useSyncExternalStore(subscribeStore, getVersion, getVersion);
};

// Live { isActive, lastSeen } for one profile, or undefined until known.
export const usePresence = (profileId) => {
  const id = profileId ? String(profileId) : "";
  useEffect(() => (id ? watchPresence([id]) : undefined), [id]);
  return useSyncExternalStore(
    subscribeStore,
    () => (id ? statuses.get(id) : undefined),
    () => undefined,
  );
};
