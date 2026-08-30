/**
 * Message Cache Manager
 * Handles caching of individual chat messages with profileId and friendId
 */

const CACHE_KEYS = {
  MESSAGE_PREFIX: 'cached_messages_',
  MESSAGE_TIMESTAMP_PREFIX: 'message_timestamp_',
  CACHE_VERSION: 'message_cache_version',
};

const CACHE_VERSION = '1.0';
const MESSAGE_CACHE_DURATION = 30 * 60 * 1000; // 30 minutes in milliseconds

class MessageCacheManager {
  /**
   * Initialize cache manager and check version
   */
  static initialize() {
    try {
      const cachedVersion = localStorage.getItem(CACHE_KEYS.CACHE_VERSION);
      if (cachedVersion !== CACHE_VERSION) {
        this.clearAllMessageCache();
        localStorage.setItem(CACHE_KEYS.CACHE_VERSION, CACHE_VERSION);
      }
    } catch (error) {
      console.warn('Message cache initialization error:', error);
    }
  }

  /**
   * Generate cache key for a specific conversation
   * @param {string} profileId - Current user's profile ID
   * @param {string} friendId - Friend's profile ID
   * @returns {string} Cache key for the conversation
   */
  static getCacheKey(profileId, friendId) {
    return `${CACHE_KEYS.MESSAGE_PREFIX}${profileId}_${friendId}`;
  }

  /**
   * Generate timestamp key for a conversation
   * @param {string} profileId - Current user's profile ID
   * @param {string} friendId - Friend's profile ID
   * @returns {string} Timestamp key
   */
  static getTimestampKey(profileId, friendId) {
    return `${CACHE_KEYS.MESSAGE_TIMESTAMP_PREFIX}${profileId}_${friendId}`;
  }

  /**
   * Get cached messages for a conversation
   * @param {string} profileId - Current user's profile ID
   * @param {string} friendId - Friend's profile ID
   * @returns {Array|null} Cached messages or null if expired/not found
   */
  static getCachedMessages(profileId, friendId) {
    try {
      if (!profileId || !friendId) return null;

      const cacheKey = this.getCacheKey(profileId, friendId);
      const timestampKey = this.getTimestampKey(profileId, friendId);
      
      const cachedData = localStorage.getItem(cacheKey);
      const timestamp = localStorage.getItem(timestampKey);

      if (!cachedData || !timestamp) {
        return null;
      }

      const timeSinceCache = Date.now() - parseInt(timestamp, 10);
      if (timeSinceCache > MESSAGE_CACHE_DURATION) {
        console.log('📦 Message cache expired, clearing');
        this.clearConversationCache(profileId, friendId);
        return null;
      }

      const messages = JSON.parse(cachedData);
      console.log('✅ Retrieved messages from cache:', messages.length);
      return Array.isArray(messages) ? messages : null;
    } catch (error) {
      console.error('Error retrieving cached messages:', error);
      return null;
    }
  }

  /**
   * Save messages to cache for a conversation
   * @param {string} profileId - Current user's profile ID
   * @param {string} friendId - Friend's profile ID
   * @param {Array} messages - Messages to cache
   */
  static setCachedMessages(profileId, friendId, messages) {
    try {
      if (!profileId || !friendId) return false;
      if (!Array.isArray(messages)) {
        console.warn('Invalid messages format for cache');
        return false;
      }

      const cacheKey = this.getCacheKey(profileId, friendId);
      const timestampKey = this.getTimestampKey(profileId, friendId);

      localStorage.setItem(cacheKey, JSON.stringify(messages));
      localStorage.setItem(timestampKey, Date.now().toString());
      console.log('💾 Messages cached successfully:', messages.length);
      return true;
    } catch (error) {
      console.error('Error caching messages:', error);
      return false;
    }
  }

  /**
   * Merge old cached messages with new messages
   * Appends new messages to the end of cached messages, removing duplicates
   * @param {Array} newMessages - New messages from API
   * @param {Array} cachedMessages - Previously cached messages
   * @returns {Array} Merged messages array
   */
  static mergeMessages(newMessages, cachedMessages = []) {
    try {
      if (!Array.isArray(newMessages)) return cachedMessages;
      if (!Array.isArray(cachedMessages)) return newMessages;

      // Create a set of message IDs from new messages for quick lookup
      const newMessageIds = new Set(newMessages.map((m) => m._id));

      // Filter cached messages to exclude duplicates
      const uniqueCachedMessages = cachedMessages.filter(
        (m) => !newMessageIds.has(m._id)
      );

      // Combine: new messages first, then cached messages
      const merged = [...newMessages, ...uniqueCachedMessages];

      return merged;
    } catch (error) {
      console.error('Error merging messages:', error);
      return newMessages;
    }
  }

  /**
   * Check if cache is still valid for a conversation
   * @param {string} profileId - Current user's profile ID
   * @param {string} friendId - Friend's profile ID
   * @returns {boolean} True if cache exists and is not expired
   */
  static isCacheValid(profileId, friendId) {
    try {
      if (!profileId || !friendId) return false;

      const cacheKey = this.getCacheKey(profileId, friendId);
      const timestampKey = this.getTimestampKey(profileId, friendId);

      const cachedData = localStorage.getItem(cacheKey);
      const timestamp = localStorage.getItem(timestampKey);

      if (!cachedData || !timestamp) {
        return false;
      }

      const timeSinceCache = Date.now() - parseInt(timestamp, 10);
      return timeSinceCache <= MESSAGE_CACHE_DURATION;
    } catch (error) {
      console.warn('Error checking message cache validity:', error);
      return false;
    }
  }

  /**
   * Clear cache for a specific conversation
   * @param {string} profileId - Current user's profile ID
   * @param {string} friendId - Friend's profile ID
   */
  static clearConversationCache(profileId, friendId) {
    try {
      if (!profileId || !friendId) return;

      const cacheKey = this.getCacheKey(profileId, friendId);
      const timestampKey = this.getTimestampKey(profileId, friendId);

      localStorage.removeItem(cacheKey);
      localStorage.removeItem(timestampKey);
      console.log('🗑️ Conversation cache cleared');
    } catch (error) {
      console.error('Error clearing conversation cache:', error);
    }
  }

  /**
   * Clear all message caches
   */
  static clearAllMessageCache() {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach((key) => {
        if (
          key.startsWith(CACHE_KEYS.MESSAGE_PREFIX) ||
          key.startsWith(CACHE_KEYS.MESSAGE_TIMESTAMP_PREFIX)
        ) {
          localStorage.removeItem(key);
        }
      });
      console.log('🗑️ All message caches cleared');
    } catch (error) {
      console.error('Error clearing all message caches:', error);
    }
  }

  /**
   * Get cache statistics for a conversation
   * @param {string} profileId - Current user's profile ID
   * @param {string} friendId - Friend's profile ID
   * @returns {Object} Cache stats
   */
  static getStats(profileId, friendId) {
    try {
      if (!profileId || !friendId) {
        return { cached: false, count: 0, age: null, expiresIn: null };
      }

      const cacheKey = this.getCacheKey(profileId, friendId);
      const timestampKey = this.getTimestampKey(profileId, friendId);

      const cachedData = localStorage.getItem(cacheKey);
      const timestamp = localStorage.getItem(timestampKey);

      if (!cachedData || !timestamp) {
        return { cached: false, count: 0, age: null, expiresIn: null };
      }

      const messages = JSON.parse(cachedData);
      const now = Date.now();
      const cacheTime = parseInt(timestamp, 10);
      const age = now - cacheTime;
      const expiresIn = Math.max(0, MESSAGE_CACHE_DURATION - age);

      return {
        cached: true,
        count: messages.length,
        age: age,
        expiresIn: expiresIn,
        isExpired: age > MESSAGE_CACHE_DURATION,
      };
    } catch (error) {
      console.error('Error getting message cache stats:', error);
      return { cached: false, count: 0, age: null, expiresIn: null };
    }
  }
}

// Initialize on module load
MessageCacheManager.initialize();

export default MessageCacheManager;
