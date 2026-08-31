import {
  DEFAULT_FRIEND_CHAT_SETTINGS,
  normalizeFriendChatSettings,
} from "./chatThemes";

export const FRIEND_CHAT_SETTINGS_EVENT = "friendChatSettingsUpdated";

const storageKey = (userId) => `connect.friendChatSettings.${userId}`;

const canUseStorage = () =>
  typeof window !== "undefined" && typeof window.localStorage !== "undefined";

export const readFriendChatSettingsMap = (userId) => {
  if (!userId || !canUseStorage()) return {};
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    return {};
  }
};

export const writeFriendChatSettingsMap = (userId, map) => {
  if (!userId || !canUseStorage()) return;
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(map || {}));
  } catch (error) {
    // Ignore quota / private-mode failures; in-memory state still works.
  }
};

export const getFriendChatSettings = (userId, friendId, serverMap) => {
  if (!friendId) return { ...DEFAULT_FRIEND_CHAT_SETTINGS };
  const localMap = readFriendChatSettingsMap(userId);
  const fromLocal = localMap[friendId];
  const fromServer =
    serverMap && typeof serverMap === "object" ? serverMap[friendId] : null;
  return normalizeFriendChatSettings(fromLocal || fromServer || {});
};

export const setFriendChatSettingsLocal = (userId, friendId, next) => {
  if (!userId || !friendId) return next;
  const normalized = normalizeFriendChatSettings(next);
  const map = readFriendChatSettingsMap(userId);
  map[friendId] = normalized;
  writeFriendChatSettingsMap(userId, map);
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(FRIEND_CHAT_SETTINGS_EVENT, {
        detail: { userId, friendId, settings: normalized },
      }),
    );
  }
  return normalized;
};

export const mergeServerFriendChatMap = (userId, serverMap) => {
  if (!userId || !serverMap || typeof serverMap !== "object") return;
  const localMap = readFriendChatSettingsMap(userId);
  const merged = { ...serverMap, ...localMap };
  writeFriendChatSettingsMap(userId, merged);
  return merged;
};
