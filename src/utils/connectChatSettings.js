import {
  DEFAULT_CONNECT_CHAT_SETTINGS,
  normalizeConnectChatSettings,
} from "./chatThemes";

export const CONNECT_CHAT_SETTINGS_EVENT = "connectChatSettingsUpdated";

const storageKey = (userId) => `connect.connectChatSettings.${userId}`;
const legacyStorageKey = (userId) => `connect.friendChatSettings.${userId}`;

const canUseStorage = () =>
  typeof window !== "undefined" && typeof window.localStorage !== "undefined";

export const readConnectChatSettingsMap = (userId) => {
  if (!userId || !canUseStorage()) return {};
  try {
    const currentKey = storageKey(userId);
    const legacyKey = legacyStorageKey(userId);
    const raw =
      window.localStorage.getItem(currentKey) ||
      window.localStorage.getItem(legacyKey);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (
      !window.localStorage.getItem(currentKey) &&
      window.localStorage.getItem(legacyKey)
    ) {
      window.localStorage.setItem(currentKey, raw);
    }
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    return {};
  }
};

export const writeConnectChatSettingsMap = (userId, map) => {
  if (!userId || !canUseStorage()) return;
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(map || {}));
  } catch (error) {
    // Ignore quota / private-mode failures; in-memory state still works.
  }
};

export const getConnectChatSettings = (userId, connectId, serverMap) => {
  if (!connectId) return { ...DEFAULT_CONNECT_CHAT_SETTINGS };
  const localMap = readConnectChatSettingsMap(userId);
  const fromLocal = localMap[connectId];
  const fromServer =
    serverMap && typeof serverMap === "object" ? serverMap[connectId] : null;
  return normalizeConnectChatSettings(fromLocal || fromServer || {});
};

export const setConnectChatSettingsLocal = (userId, connectId, next) => {
  if (!userId || !connectId) return next;
  const normalized = normalizeConnectChatSettings(next);
  const map = readConnectChatSettingsMap(userId);
  map[connectId] = normalized;
  writeConnectChatSettingsMap(userId, map);
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(CONNECT_CHAT_SETTINGS_EVENT, {
        detail: { userId, connectId, settings: normalized },
      }),
    );
  }
  return normalized;
};

export const mergeServerConnectChatMap = (userId, serverMap) => {
  if (!userId || !serverMap || typeof serverMap !== "object") return;
  const localMap = readConnectChatSettingsMap(userId);
  const merged = { ...serverMap, ...localMap };
  writeConnectChatSettingsMap(userId, merged);
  return merged;
};
