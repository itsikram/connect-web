/**
 * Contact Cache Manager
 * Handles caching of message contact lists (chat sidebar)
 */

const CACHE_KEYS = {
  CONTACTS: 'cached_message_contacts',
  CONTACTS_TIMESTAMP: 'message_contacts_timestamp',
  ACTIVE_FRIENDS: 'cached_active_friends',
  ACTIVE_FRIENDS_TIMESTAMP: 'active_friends_timestamp',
  CACHE_VERSION: 'contact_cache_version',
};

const CACHE_VERSION = '1.0';
const CONTACT_CACHE_DURATION = 30 * 60 * 1000; // 30 minutes in milliseconds

class ContactCacheManager {
  /**
   * Initialize cache manager and check version
   */
  static initialize() {
    try {
      const cachedVersion = localStorage.getItem(CACHE_KEYS.CACHE_VERSION);
      if (cachedVersion !== CACHE_VERSION) {
        this.clearCache();
        localStorage.setItem(CACHE_KEYS.CACHE_VERSION, CACHE_VERSION);
      }
    } catch (error) {
      console.warn('Contact cache initialization error:', error);
    }
  }

  /**
   * Get cached contacts
   * @returns {Array|null} Cached contacts or null if expired/not found
   */
  static getCachedContacts() {
    try {
      const cachedData = localStorage.getItem(CACHE_KEYS.CONTACTS);
      const timestamp = localStorage.getItem(CACHE_KEYS.CONTACTS_TIMESTAMP);

      if (!cachedData || !timestamp) {
        return null;
      }

      const timeSinceCache = Date.now() - parseInt(timestamp, 10);
      if (timeSinceCache > CONTACT_CACHE_DURATION) {
        console.log('📦 Contact cache expired, clearing');
        this.clearCache();
        return null;
      }

      const contacts = JSON.parse(cachedData);
      console.log('✅ Retrieved contacts from cache:', contacts.length);
      return Array.isArray(contacts) ? contacts : null;
    } catch (error) {
      console.error('Error retrieving cached contacts:', error);
      return null;
    }
  }

  /**
   * Save contacts to cache
   * @param {Array} contacts - Contacts to cache
   */
  static setCachedContacts(contacts) {
    try {
      if (!Array.isArray(contacts)) {
        console.warn('Invalid contacts format for cache');
        return false;
      }

      localStorage.setItem(CACHE_KEYS.CONTACTS, JSON.stringify(contacts));
      localStorage.setItem(CACHE_KEYS.CONTACTS_TIMESTAMP, Date.now().toString());
      console.log('💾 Contacts cached successfully:', contacts.length);
      return true;
    } catch (error) {
      console.error('Error caching contacts:', error);
      return false;
    }
  }

  /**
   * Get cached active friends (online friends list)
   * @returns {Array|null} Cached active friend IDs or null if expired/not found
   */
  static getCachedActiveFriends() {
    try {
      const cachedData = localStorage.getItem(CACHE_KEYS.ACTIVE_FRIENDS);
      const timestamp = localStorage.getItem(CACHE_KEYS.ACTIVE_FRIENDS_TIMESTAMP);

      if (!cachedData || !timestamp) {
        return null;
      }

      const timeSinceCache = Date.now() - parseInt(timestamp, 10);
      if (timeSinceCache > CONTACT_CACHE_DURATION) {
        console.log('📦 Active friends cache expired, clearing');
        this.clearActiveFriendsCache();
        return null;
      }

      const activeFriends = JSON.parse(cachedData);
      console.log('✅ Retrieved active friends from cache:', activeFriends.length);
      return Array.isArray(activeFriends) ? activeFriends : null;
    } catch (error) {
      console.error('Error retrieving cached active friends:', error);
      return null;
    }
  }

  /**
   * Save active friends to cache
   * @param {Array} activeFriends - Active friend IDs to cache
   */
  static setCachedActiveFriends(activeFriends) {
    try {
      if (!Array.isArray(activeFriends)) {
        console.warn('Invalid active friends format for cache');
        return false;
      }

      localStorage.setItem(CACHE_KEYS.ACTIVE_FRIENDS, JSON.stringify(activeFriends));
      localStorage.setItem(CACHE_KEYS.ACTIVE_FRIENDS_TIMESTAMP, Date.now().toString());
      console.log('💾 Active friends cached successfully:', activeFriends.length);
      return true;
    } catch (error) {
      console.error('Error caching active friends:', error);
      return false;
    }
  }

  /**
   * Merge new contacts with cached contacts
   * @param {Array} newContacts - New contacts from API
   * @param {Array} cachedContacts - Previously cached contacts
   * @returns {Array} Merged contacts array
   */
  static mergeContacts(newContacts, cachedContacts = []) {
    try {
      if (!Array.isArray(newContacts)) return cachedContacts;
      if (!Array.isArray(cachedContacts)) return newContacts;

      // Create a set of contact IDs from new contacts for quick lookup
      const newContactIds = new Set(newContacts.map((c) => c.person?._id || c._id));

      // Filter cached contacts to exclude duplicates
      const uniqueCachedContacts = cachedContacts.filter(
        (c) => !newContactIds.has(c.person?._id || c._id)
      );

      // Combine: new contacts first, then cached contacts
      const merged = [...newContacts, ...uniqueCachedContacts];

      return merged;
    } catch (error) {
      console.error('Error merging contacts:', error);
      return newContacts;
    }
  }

  /**
   * Check if contact cache is still valid
   * @returns {boolean} True if cache exists and is not expired
   */
  static isCacheValid() {
    try {
      const cachedData = localStorage.getItem(CACHE_KEYS.CONTACTS);
      const timestamp = localStorage.getItem(CACHE_KEYS.CONTACTS_TIMESTAMP);

      if (!cachedData || !timestamp) {
        return false;
      }

      const timeSinceCache = Date.now() - parseInt(timestamp, 10);
      return timeSinceCache <= CONTACT_CACHE_DURATION;
    } catch (error) {
      console.warn('Error checking contact cache validity:', error);
      return false;
    }
  }

  /**
   * Clear all cached contacts and active friends
   */
  static clearCache() {
    try {
      localStorage.removeItem(CACHE_KEYS.CONTACTS);
      localStorage.removeItem(CACHE_KEYS.CONTACTS_TIMESTAMP);
      localStorage.removeItem(CACHE_KEYS.ACTIVE_FRIENDS);
      localStorage.removeItem(CACHE_KEYS.ACTIVE_FRIENDS_TIMESTAMP);
      console.log('🗑️ All contact caches cleared');
    } catch (error) {
      console.error('Error clearing contact cache:', error);
    }
  }

  /**
   * Clear only active friends cache
   */
  static clearActiveFriendsCache() {
    try {
      localStorage.removeItem(CACHE_KEYS.ACTIVE_FRIENDS);
      localStorage.removeItem(CACHE_KEYS.ACTIVE_FRIENDS_TIMESTAMP);
      console.log('🗑️ Active friends cache cleared');
    } catch (error) {
      console.error('Error clearing active friends cache:', error);
    }
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache stats
   */
  static getStats() {
    try {
      const cachedData = localStorage.getItem(CACHE_KEYS.CONTACTS);
      const timestamp = localStorage.getItem(CACHE_KEYS.CONTACTS_TIMESTAMP);

      if (!cachedData || !timestamp) {
        return {
          contacts: { cached: false, count: 0, age: null, expiresIn: null },
          activeFriends: { cached: false, count: 0 },
        };
      }

      const contacts = JSON.parse(cachedData);
      const now = Date.now();
      const cacheTime = parseInt(timestamp, 10);
      const age = now - cacheTime;
      const expiresIn = Math.max(0, CONTACT_CACHE_DURATION - age);

      const activeFriendsData = localStorage.getItem(CACHE_KEYS.ACTIVE_FRIENDS);
      const activeFriends = activeFriendsData ? JSON.parse(activeFriendsData) : [];

      return {
        contacts: {
          cached: true,
          count: contacts.length,
          age: age,
          expiresIn: expiresIn,
          isExpired: age > CONTACT_CACHE_DURATION,
        },
        activeFriends: {
          cached: activeFriends.length > 0,
          count: activeFriends.length,
        },
      };
    } catch (error) {
      console.error('Error getting contact cache stats:', error);
      return {
        contacts: { cached: false, count: 0, age: null, expiresIn: null },
        activeFriends: { cached: false, count: 0 },
      };
    }
  }
}

// Initialize on module load
ContactCacheManager.initialize();

export default ContactCacheManager;
