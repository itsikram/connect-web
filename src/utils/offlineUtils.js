/**
 * Offline detection and configuration utilities
 * Provides fallback configurations for offline/local development
 */

/**
 * Check if the browser is currently offline
 */
export const isOffline = () => {
  if (typeof navigator !== 'undefined' && 'onLine' in navigator) {
    return !navigator.onLine;
  }
  return false;
};

/**
 * Normalize API/server base URLs for production (Render always uses HTTPS).
 */
export const normalizeServerUrl = (url) => {
  if (!url) return url;

  let normalized = String(url).trim().replace(/\/+$/, '');
  if (!normalized) return normalized;

  if (!/^https?:\/\//i.test(normalized)) {
    normalized = `https://${normalized}`;
  }

  try {
    const parsed = new URL(normalized);
    const isLocal =
      parsed.hostname === 'localhost' ||
      parsed.hostname === '127.0.0.1' ||
      parsed.hostname === '[::1]';

    if (!isLocal && /\.onrender\.com$/i.test(parsed.hostname)) {
      parsed.protocol = 'https:';
    } else if (
      typeof window !== 'undefined' &&
      window.location.protocol === 'https:' &&
      parsed.protocol === 'http:' &&
      !isLocal
    ) {
      parsed.protocol = 'https:';
    }

    return parsed.toString().replace(/\/$/, '');
  } catch (_) {
    return normalized.replace(/^http:\/\//i, 'https://');
  }
};

/**
 * Get the server address with fallback for offline/local development
 * Priority: Environment variable > Online detection > Localhost fallback
 */
const PREFERRED_SERVER_KEY = 'connect.server';
export const SERVER_CHANGED_EVENT = 'connect:server-changed';
// A server that just failed is skipped by every caller for this long, so API
// requests and the socket stop trying it instead of each timing out on it.
const SERVER_DOWN_COOLDOWN_MS = 60 * 1000;
let preferredServer = null;
const downUntil = new Map();

/**
 * All configured API servers. REACT_APP_SERVER_ADDR may be a single URL or a
 * comma-separated list, e.g. "https://a.onrender.com,https://b.onrender.com".
 */
export const getServerList = () =>
  String(process.env.REACT_APP_SERVER_ADDR || '')
    .split(',')
    .map((url) => normalizeServerUrl(url))
    .filter(Boolean);

/**
 * Make `url` this browser's home server (used after a failover so every
 * caller of getServerAddress() moves together).
 */
export const setPreferredServer = (url) => {
  if (!url) return;
  const changed = preferredServer !== url;
  preferredServer = url;
  try {
    localStorage.setItem(PREFERRED_SERVER_KEY, url);
  } catch (_) { /* ignore */ }
  if (changed && typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent(SERVER_CHANGED_EVENT, { detail: { url } }));
    } catch (_) { /* ignore */ }
  }
};

/** Remember that `url` just failed so other callers skip it for a while. */
export const markServerDown = (url) => {
  if (url) downUntil.set(url, Date.now() + SERVER_DOWN_COOLDOWN_MS);
};

export const isServerDown = (url) => {
  const until = downUntil.get(url);
  if (!until) return false;
  if (until > Date.now()) return true;
  downUntil.delete(url);
  return false;
};

/**
 * The server after `url` in `list` (wraps around), skipping servers that
 * recently failed. Falls back to the plain next server if all look down.
 */
export const getNextServer = (url, list = getServerList()) => {
  if (list.length < 2) return list[0] || url;
  const start = list.indexOf(url);
  for (let step = 1; step < list.length; step += 1) {
    const candidate = list[(start + step) % list.length];
    if (!isServerDown(candidate)) return candidate;
  }
  return list[(start + 1) % list.length];
};

const pickPreferredServer = (list) => {
  if (preferredServer && list.includes(preferredServer)) {
    if (!isServerDown(preferredServer)) return preferredServer;
    const next = getNextServer(preferredServer, list);
    setPreferredServer(next);
    return next;
  }
  let saved = null;
  try {
    saved = localStorage.getItem(PREFERRED_SERVER_KEY);
  } catch (_) { /* ignore */ }
  // Each browser sticks to one server; new visitors are spread at random.
  const chosen = saved && list.includes(saved)
    ? saved
    : list[Math.floor(Math.random() * list.length)];
  setPreferredServer(chosen);
  return chosen;
};

export const getServerAddress = () => {
  // PRIORITY 1: Always use environment variable if available (even when offline)
  const serverList = getServerList();
  if (serverList.length === 1) return serverList[0];
  if (serverList.length > 1) return pickPreferredServer(serverList);
  
  // PRIORITY 2: If offline and no env var, use localhost
  if (isOffline()) {
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    // Default to localhost:4000 for offline mode
    return `${protocol}//${hostname === 'localhost' || hostname === '127.0.0.1' ? 'localhost:4000' : hostname}`;
  }
  
  // PRIORITY 3: Online but no env var - fallback to localhost for local development
  const hostname = window.location.hostname;
  const protocol = window.location.protocol;
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]') {
    return `${protocol}//${hostname}:4000`;
  }
  
  // PRIORITY 4: Last resort: use current origin
  return window.location.origin;
};

/**
 * Get socket URL with fallback for offline/local development
 * Priority: Environment variable > Server address (which handles offline)
 */
export const getSocketUrl = () => {
  // PRIORITY 1: Always use environment variable if available
  if (process.env.REACT_APP_SOCKET_URL) {
    return process.env.REACT_APP_SOCKET_URL;
  }
  
  // PRIORITY 2: Use server address (which handles offline/online fallbacks)
  return getServerAddress();
};

/**
 * Get YouTube download API URL with fallback
 * Priority: Environment variable > Offline detection > Default remote URL
 */
export const getYtDownloadApiUrl = () => {
  // PRIORITY 1: Always use environment variable if available
  if (process.env.REACT_APP_YT_DL_API_URL) {
    return normalizeServerUrl(process.env.REACT_APP_YT_DL_API_URL);
  }
  
  // PRIORITY 2: Use the main Connect server (Node.js ytdl-core service)
  return getServerAddress();
};

/**
 * Wrap API calls with offline detection
 */
export const withOfflineHandling = async (apiCall, fallbackValue = null) => {
  if (isOffline()) {
    console.warn('⚠️ Offline mode: API call blocked');
    return fallbackValue;
  }
  
  try {
    return await apiCall();
  } catch (error) {
    // Check if error is due to network failure
    if (!navigator.onLine || error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
      console.warn('⚠️ Network error detected, treating as offline');
      return fallbackValue;
    }
    throw error;
  }
};

/**
 * Listen for online/offline events
 */
export const setupOnlineListener = (onOnline, onOffline) => {
  if (typeof window === 'undefined') return () => {};
  
  const handleOnline = () => {
    console.log('🌐 Back online');
    if (onOnline) onOnline();
  };
  
  const handleOffline = () => {
    console.log('📴 Gone offline');
    if (onOffline) onOffline();
  };
  
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  
  // Return cleanup function
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
};

export default {
  isOffline,
  getServerAddress,
  getSocketUrl,
  getYtDownloadApiUrl,
  withOfflineHandling,
  setupOnlineListener
};

