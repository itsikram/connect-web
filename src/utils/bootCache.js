import { getUserFromStorage } from "./storageUtils";

// Remembers what the app needs to paint its first screen (your profile,
// settings, notifications) so a reopened app shows it at once instead of
// waiting on the network. The app still asks the server for fresh data on
// every start and replaces what is shown here (stale-while-revalidate).
//
// Every entry records which account wrote it and is only handed back while
// that same account is signed in, so a different account on the same
// browser never sees someone else's data.

const PREFIX = "connect.boot.v1:";
const DEFAULT_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

export const BOOT_SLICES = {
  PROFILE: "profile",
  SETTINGS: "settings",
  NOTIFICATIONS: "notifications",
};

const idOf = (value) => {
  if (!value) return "";
  if (typeof value === "object") return String(value._id || value.id || "");
  return String(value);
};

// The profile id of the signed-in account, or "" when nobody is signed in.
export const getSessionProfileId = () => {
  try {
    const user = getUserFromStorage();
    if (!user || !user.accessToken) return "";
    return idOf(user.profile || user.profileId);
  } catch (error) {
    return "";
  }
};

// The account whose cached data the Redux store started with. Captured once,
// when this module first loads, which is before the store is created.
export const BOOT_OWNER_ID = getSessionProfileId();

export const readBootCache = (
  slice,
  { ownerId = getSessionProfileId(), maxAgeMs = DEFAULT_MAX_AGE_MS } = {},
) => {
  const owner = idOf(ownerId);
  if (!owner) return null;
  try {
    const raw = localStorage.getItem(PREFIX + slice);
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (!entry || typeof entry !== "object" || entry.owner !== owner) return null;
    if (!entry.savedAt || Date.now() - entry.savedAt > maxAgeMs) return null;
    return entry.data ?? null;
  } catch (error) {
    return null;
  }
};

export const writeBootCache = (slice, data, ownerId = getSessionProfileId()) => {
  const owner = idOf(ownerId);
  if (!owner || data === undefined || data === null) return false;
  try {
    localStorage.setItem(
      PREFIX + slice,
      JSON.stringify({ owner, savedAt: Date.now(), data }),
    );
    return true;
  } catch (error) {
    // Storage full or blocked: the app simply loads from the network.
    return false;
  }
};

export const removeBootCache = (slice) => {
  try {
    localStorage.removeItem(PREFIX + slice);
  } catch (error) {
    // ignore
  }
};

export const clearBootCache = () => {
  try {
    const keys = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key && key.startsWith(PREFIX)) keys.push(key);
    }
    keys.forEach((key) => localStorage.removeItem(key));
  } catch (error) {
    // ignore
  }
};
