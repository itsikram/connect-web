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
export const getServerAddress = () => {
  // PRIORITY 1: Always use environment variable if available (even when offline)
  if (process.env.REACT_APP_SERVER_ADDR) {
    return normalizeServerUrl(process.env.REACT_APP_SERVER_ADDR);
  }
  
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

