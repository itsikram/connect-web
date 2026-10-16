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

// Server list set in the admin panel (Settings → Servers), served by every
// live server at /api/connect/server-config and remembered in this browser.
// It replaces REACT_APP_SERVER_ADDR, except in builds that point at a local
// server, which keep using their own.
const SERVER_CONFIG_KEY = 'connect.serverConfig';
const SERVER_CONFIG_REFRESH_MS = 10 * 60 * 1000;
const SERVER_CONFIG_FETCH_TIMEOUT_MS = 6000;
const LIVE_SERVER_URL_PATTERN = /^https:\/\/[A-Za-z0-9.-]+(?::\d{1,5})?(?:\/[A-Za-z0-9._~/-]*)?$/;

const getEnvServerList = () =>
  String(process.env.REACT_APP_SERVER_ADDR || '')
    .split(',')
    .map((url) => normalizeServerUrl(url))
    .filter(Boolean);

const isLocalUrl = (url) => /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/i.test(url);
const acceptsRuntimeConfig = () => {
  const envList = getEnvServerList();
  return envList.length > 0 && !envList.some(isLocalUrl);
};

const parseServerConfig = (value) => {
  if (!value || typeof value !== 'object') return null;
  const serverUrls = Array.from(
    new Set(
      (Array.isArray(value.serverUrls) ? value.serverUrls : [])
        .map((url) => String(url || '').trim().replace(/\/+$/, ''))
        .filter((url) => LIVE_SERVER_URL_PATTERN.test(url)),
    ),
  );
  if (!serverUrls.length) return null;
  const seconds = Number(value.downCooldownSeconds);
  return {
    mode: value.mode === 'single' ? 'single' : 'multi',
    serverUrls: value.mode === 'single' ? serverUrls.slice(0, 1) : serverUrls,
    strategy: value.strategy === 'priority' ? 'priority' : 'random',
    downCooldownMs: Number.isFinite(seconds) && seconds >= 5 ? seconds * 1000 : SERVER_DOWN_COOLDOWN_MS,
    updatedAt: value.updatedAt || null,
  };
};

let runtimeConfig = null;
try {
  if (acceptsRuntimeConfig()) {
    runtimeConfig = parseServerConfig(JSON.parse(localStorage.getItem(SERVER_CONFIG_KEY) || 'null'));
  }
} catch (_) { /* ignore */ }

/**
 * All configured API servers: the admin panel's list when one was received,
 * otherwise REACT_APP_SERVER_ADDR (a single URL or a comma-separated list,
 * e.g. "https://a.onrender.com,https://b.onrender.com").
 */
export const getServerList = () =>
  runtimeConfig ? runtimeConfig.serverUrls : getEnvServerList();

/** True when the admin panel's list is in use (it overrides socket env lists too). */
export const usesRuntimeServerConfig = () => Boolean(runtimeConfig);

const getDownCooldownMs = () => runtimeConfig?.downCooldownMs || SERVER_DOWN_COOLDOWN_MS;

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
  if (url) downUntil.set(url, Date.now() + getDownCooldownMs());
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
  // Priority: always the first server in admin order that is not down.
  if (runtimeConfig?.strategy === 'priority') {
    const chosen = list.find((url) => !isServerDown(url)) || list[0];
    if (chosen !== preferredServer) setPreferredServer(chosen);
    return chosen;
  }
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
 * Use the server list from the admin panel. Moves this browser to a listed
 * server when its current one was removed (or, with "priority", when a
 * higher-priority server is listed first).
 */
export const applyServerConfig = (value) => {
  if (!acceptsRuntimeConfig()) return false;
  const next = parseServerConfig(value);
  if (!next) return false;
  runtimeConfig = next;
  try {
    localStorage.setItem(SERVER_CONFIG_KEY, JSON.stringify(value));
  } catch (_) { /* ignore */ }
  getServerAddress();
  if (preferredServer && !next.serverUrls.includes(preferredServer)) {
    setPreferredServer(next.serverUrls.find((url) => !isServerDown(url)) || next.serverUrls[0]);
  }
  return true;
};

/** Fetch the admin panel's server list from the first live server that answers. */
export const refreshServerConfig = async () => {
  if (!acceptsRuntimeConfig()) return false;
  const current = getServerAddress();
  const candidates = [current, ...getServerList(), ...getEnvServerList()]
    .filter((url, i, all) => url && all.indexOf(url) === i && !isServerDown(url));
  for (const url of candidates) {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller && setTimeout(() => controller.abort(), SERVER_CONFIG_FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(`${url}/api/connect/server-config`, {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
        signal: controller?.signal,
      });
      // 404: that server runs an older build; try the next one.
      if (response.ok && applyServerConfig(await response.json())) return true;
    } catch (_) {
      // Unreachable: try the next server.
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  return false;
};

let serverConfigTimer = null;
/** Load the admin server list now and keep it fresh. */
export const startServerConfigSync = () => {
  if (serverConfigTimer || !acceptsRuntimeConfig()) return;
  refreshServerConfig();
  serverConfigTimer = setInterval(refreshServerConfig, SERVER_CONFIG_REFRESH_MS);
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

