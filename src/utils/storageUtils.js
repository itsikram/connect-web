/**
 * Storage utility with fallback to sessionStorage and quota management
 * Handles localStorage quota exceeded errors gracefully
 */

// Storage keys that should be prioritized (keep these even if quota is low)
const PRIORITY_KEYS = ['user', 'connect_browser_id'];

// Cache to avoid repeated quota checks
let storageCache = null;
let lastQuotaCheck = 0;
let lastQuotaWarning = 0;
const QUOTA_CHECK_INTERVAL = 60000; // Check every minute

/**
 * Get storage with fallback
 * Tries localStorage first, falls back to sessionStorage if quota exceeded
 */
export const getStorage = () => {
  // Return cached result if available and recent
  const now = Date.now();
  if (storageCache && (now - lastQuotaCheck) < QUOTA_CHECK_INTERVAL) {
    return storageCache;
  }

  try {
    // Try to write a small test value to check if localStorage is writable
    const testKey = '__storage_test__';
    
    // Try to write a small test value
    try {
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
      storageCache = localStorage;
      lastQuotaCheck = now;
      return localStorage;
    } catch (writeError) {
      // Quota exceeded or write failed - try cleanup first
      if (writeError.name === 'QuotaExceededError' || 
          (writeError.name === 'DOMException' && writeError.message?.includes('quota'))) {
        // Try proactive cleanup
        try {
          cleanupStorage(null);
          // Try test write again after cleanup
          localStorage.setItem(testKey, 'test');
          localStorage.removeItem(testKey);
          storageCache = localStorage;
          lastQuotaCheck = now;
          return localStorage;
        } catch (cleanupError) {
          // Cleanup didn't help, fall back to sessionStorage
          storageCache = sessionStorage;
          lastQuotaCheck = now;
          // Only log in development mode and once per interval to reduce noise
          if (process.env.NODE_ENV === 'development' && 
              ((now - lastQuotaWarning) >= QUOTA_CHECK_INTERVAL || lastQuotaWarning === 0)) {
            console.debug('localStorage quota exceeded, using sessionStorage as fallback');
            lastQuotaWarning = now;
          }
          return sessionStorage;
        }
      } else {
        // Other error, fall back to sessionStorage
        storageCache = sessionStorage;
        lastQuotaCheck = now;
        // Only log non-quota errors in development
        if (process.env.NODE_ENV === 'development') {
          console.debug('localStorage not available, using sessionStorage:', writeError);
        }
        return sessionStorage;
      }
    }
  } catch (error) {
    // localStorage not available (disabled, etc.)
    storageCache = sessionStorage;
    lastQuotaCheck = now;
    // Only log non-quota errors in development mode
    if (process.env.NODE_ENV === 'development' &&
        error.name !== 'QuotaExceededError' && 
        !(error.name === 'DOMException' && error.message?.includes('quota'))) {
      console.debug('localStorage not available, using sessionStorage:', error);
    }
    return sessionStorage;
  }
};

/**
 * Get item from storage with fallback
 */
export const getStorageItem = (key) => {
  try {
    const storage = getStorage();
    return storage.getItem(key);
  } catch (error) {
    console.error(`Error getting ${key} from storage:`, error);
    // Try sessionStorage as last resort
    try {
      return sessionStorage.getItem(key);
    } catch (sessionError) {
      console.error(`Error getting ${key} from sessionStorage:`, sessionError);
      return null;
    }
  }
};

/**
 * Set item in storage with fallback and cleanup
 */
export const setStorageItem = (key, value) => {
  try {
    const storage = getStorage();
    storage.setItem(key, value);
    return true;
  } catch (error) {
    if (error.name === 'QuotaExceededError' || error.name === 'DOMException') {
      console.warn(`Storage quota exceeded for key: ${key}. Attempting cleanup...`);
      
      // Try to free up space by removing non-priority items
      try {
        cleanupStorage(key);
        
        // Try again after cleanup
        const storage = getStorage();
        storage.setItem(key, value);
        console.log(`Successfully stored ${key} after cleanup`);
        return true;
      } catch (cleanupError) {
        console.warn(`Cleanup failed, trying sessionStorage for key: ${key}`);
        
        // Fallback to sessionStorage
        try {
          sessionStorage.setItem(key, value);
          console.log(`Stored ${key} in sessionStorage as fallback`);
          return true;
        } catch (sessionError) {
          console.error(`Failed to store ${key} in sessionStorage:`, sessionError);
          return false;
        }
      }
    } else {
      console.error(`Error storing ${key}:`, error);
      return false;
    }
  }
};

/**
 * Remove item from storage
 */
export const removeStorageItem = (key) => {
  try {
    const storage = getStorage();
    storage.removeItem(key);
    // Also try to remove from sessionStorage in case it was stored there
    try {
      sessionStorage.removeItem(key);
    } catch (e) {
      // Ignore
    }
    return true;
  } catch (error) {
    console.error(`Error removing ${key} from storage:`, error);
    return false;
  }
};

/**
 * Clean up storage by removing non-priority items
 * Works directly with localStorage to ensure we're cleaning the right storage
 */
const cleanupStorage = (newKey) => {
  try {
    // Always clean localStorage directly (not through getStorage which might return sessionStorage)
    if (typeof localStorage === 'undefined') {
      return;
    }

    const keysToRemove = [];
    const keySizes = [];
    
    // Collect all keys with their sizes, except priority keys and the new key
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && !PRIORITY_KEYS.includes(key) && key !== newKey && !key.startsWith('__storage_test__')) {
        try {
          const value = localStorage.getItem(key);
          const size = new Blob([value || '']).size;
          keysToRemove.push(key);
          keySizes.push({ key, size });
        } catch (e) {
          // If we can't read the key, try to remove it anyway
          keysToRemove.push(key);
          keySizes.push({ key, size: 0 });
        }
      }
    }
    
    // Sort by size (largest first) to free up more space quickly
    keySizes.sort((a, b) => b.size - a.size);
    
    // Remove non-priority keys
    let removedCount = 0;
    let freedBytes = 0;
    keySizes.forEach(({ key, size }) => {
      try {
        localStorage.removeItem(key);
        removedCount++;
        freedBytes += size;
      } catch (e) {
        console.warn(`Failed to remove key ${key}:`, e);
      }
    });
    
    if (removedCount > 0) {
      console.log(`Cleaned up ${removedCount} storage items, freed ~${(freedBytes / 1024).toFixed(2)} KB`);
    }
    
    // Also clean sessionStorage of non-priority items
    if (typeof sessionStorage !== 'undefined') {
      try {
        for (let i = 0; i < sessionStorage.length; i++) {
          const key = sessionStorage.key(i);
          if (key && !PRIORITY_KEYS.includes(key) && key !== newKey && !key.startsWith('__storage_test__')) {
            try {
              sessionStorage.removeItem(key);
            } catch (e) {
              // Ignore sessionStorage cleanup errors
            }
          }
        }
      } catch (e) {
        // Ignore sessionStorage cleanup errors
      }
    }
  } catch (error) {
    console.error('Error during storage cleanup:', error);
    throw error;
  }
};

/**
 * Get user data from storage (with fallback)
 */
export const getUserFromStorage = () => {
  try {
    const userStr = getStorageItem('user');
    if (userStr && userStr !== '{}') {
      return JSON.parse(userStr);
    }
    return null;
  } catch (error) {
    console.error('Error getting user from storage:', error);
    return null;
  }
};

/**
 * Set user data in storage (with fallback)
 */
export const setUserInStorage = (userData) => {
  try {
    const userStr = JSON.stringify(userData);
    return setStorageItem('user', userStr);
  } catch (error) {
    console.error('Error setting user in storage:', error);
    return false;
  }
};

/**
 * Clear all storage (both localStorage and sessionStorage)
 */
export const clearAllStorage = () => {
  // Clear cache
  storageCache = null;
  lastQuotaCheck = 0;
  lastQuotaWarning = 0;
  
  try {
    localStorage.clear();
  } catch (error) {
    console.warn('Error clearing localStorage:', error);
  }
  
  try {
    sessionStorage.clear();
  } catch (error) {
    console.warn('Error clearing sessionStorage:', error);
  }
};

/**
 * Get storage usage information
 */
export const getStorageUsage = () => {
  const info = {
    localStorage: { used: 0, keys: 0, items: {} },
    sessionStorage: { used: 0, keys: 0, items: {} }
  };

  // Check localStorage
  if (typeof localStorage !== 'undefined') {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          try {
            const value = localStorage.getItem(key);
            const size = new Blob([value || '']).size;
            info.localStorage.used += size;
            info.localStorage.keys++;
            info.localStorage.items[key] = {
              size: size,
              sizeKB: (size / 1024).toFixed(2)
            };
          } catch (e) {
            // Ignore errors reading individual items
          }
        }
      }
    } catch (e) {
      // Ignore errors
    }
  }

  // Check sessionStorage
  if (typeof sessionStorage !== 'undefined') {
    try {
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key) {
          try {
            const value = sessionStorage.getItem(key);
            const size = new Blob([value || '']).size;
            info.sessionStorage.used += size;
            info.sessionStorage.keys++;
            info.sessionStorage.items[key] = {
              size: size,
              sizeKB: (size / 1024).toFixed(2)
            };
          } catch (e) {
            // Ignore errors reading individual items
          }
        }
      }
    } catch (e) {
      // Ignore errors
    }
  }

  info.localStorage.usedKB = (info.localStorage.used / 1024).toFixed(2);
  info.sessionStorage.usedKB = (info.sessionStorage.used / 1024).toFixed(2);
  
  return info;
};

/**
 * Force clear storage cache (useful for testing or after manual cleanup)
 */
export const clearStorageCache = () => {
  storageCache = null;
  lastQuotaCheck = 0;
  lastQuotaWarning = 0;
};

/**
 * Proactive storage health check and cleanup
 * Call this periodically to prevent quota issues
 * @param {number} thresholdKB - Cleanup if storage usage exceeds this (default: 4500 KB, ~90% of typical 5MB limit)
 * @returns {boolean} - true if cleanup was performed, false otherwise
 */
export const checkStorageHealth = (thresholdKB = 4500) => {
  try {
    if (typeof localStorage === 'undefined') {
      return false;
    }

    const usage = getStorageUsage();
    const usedKB = parseFloat(usage.localStorage.usedKB);

    if (usedKB > thresholdKB) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`Storage usage (${usedKB.toFixed(2)} KB) exceeds threshold (${thresholdKB} KB), performing cleanup...`);
      }
      
      // Perform cleanup
      cleanupStorage(null);
      
      // Check usage after cleanup
      const newUsage = getStorageUsage();
      const newUsedKB = parseFloat(newUsage.localStorage.usedKB);
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`Storage cleanup complete. New usage: ${newUsedKB.toFixed(2)} KB`);
      }
      
      return true;
    }
    
    return false;
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Error checking storage health:', error);
    }
    return false;
  }
};

