/**
 * Cache Manager for Posts
 * Handles caching, retrieval, and updates of post data with localStorage
 */

const CACHE_KEYS = {
  HOME_POSTS: 'cached_home_posts',
  HOME_POSTS_TIMESTAMP: 'home_posts_timestamp',
  CACHE_VERSION: 'cache_version',
};

const CACHE_VERSION = '1.0';
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes in milliseconds

class CacheManager {
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
      console.warn('Cache initialization error:', error);
    }
  }

  /**
   * Get cached posts
   * @returns {Array|null} Cached posts or null if expired/not found
   */
  static getCachedPosts() {
    try {
      const cachedData = localStorage.getItem(CACHE_KEYS.HOME_POSTS);
      const timestamp = localStorage.getItem(CACHE_KEYS.HOME_POSTS_TIMESTAMP);

      if (!cachedData || !timestamp) {
        return null;
      }

      const timeSinceCache = Date.now() - parseInt(timestamp, 10);
      if (timeSinceCache > CACHE_DURATION) {
        console.log('📦 Cache expired, clearing');
        this.clearCache();
        return null;
      }

      const posts = JSON.parse(cachedData);
      console.log('✅ Retrieved posts from cache:', posts.length);
      return posts;
    } catch (error) {
      console.error('Error retrieving cached posts:', error);
      return null;
    }
  }

  /**
   * Save posts to cache
   * @param {Array} posts - Posts to cache
   */
  static setCachedPosts(posts) {
    try {
      if (!Array.isArray(posts)) {
        console.warn('Invalid posts format for cache');
        return false;
      }

      localStorage.setItem(CACHE_KEYS.HOME_POSTS, JSON.stringify(posts));
      localStorage.setItem(CACHE_KEYS.HOME_POSTS_TIMESTAMP, Date.now().toString());
      console.log('💾 Posts cached successfully:', posts.length);
      return true;
    } catch (error) {
      console.error('Error caching posts:', error);
      return false;
    }
  }

  /**
   * Check if cache is still valid
   * @returns {boolean} True if cache exists and is not expired
   */
  static isCacheValid() {
    try {
      const cachedData = localStorage.getItem(CACHE_KEYS.HOME_POSTS);
      const timestamp = localStorage.getItem(CACHE_KEYS.HOME_POSTS_TIMESTAMP);

      if (!cachedData || !timestamp) {
        return false;
      }

      const timeSinceCache = Date.now() - parseInt(timestamp, 10);
      return timeSinceCache <= CACHE_DURATION;
    } catch (error) {
      console.warn('Error checking cache validity:', error);
      return false;
    }
  }

  /**
   * Get time until cache expires (in milliseconds)
   * @returns {number|null} Time until expiration or null if no cache
   */
  static getTimeUntilExpiry() {
    try {
      const timestamp = localStorage.getItem(CACHE_KEYS.HOME_POSTS_TIMESTAMP);
      if (!timestamp) return null;

      const timeSinceCache = Date.now() - parseInt(timestamp, 10);
      const timeUntilExpiry = CACHE_DURATION - timeSinceCache;
      return Math.max(0, timeUntilExpiry);
    } catch (error) {
      return null;
    }
  }

  /**
   * Clear all cached posts
   */
  static clearCache() {
    try {
      localStorage.removeItem(CACHE_KEYS.HOME_POSTS);
      localStorage.removeItem(CACHE_KEYS.HOME_POSTS_TIMESTAMP);
      console.log('🗑️ Cache cleared');
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }

  /**
   * Update cache with new posts (merge strategy)
   * New posts at the beginning, old posts at the end
   * @param {Array} newPosts - New posts from API
   * @param {Array} oldPosts - Previously cached posts
   * @returns {Array} Merged posts array
   */
  static mergePosts(newPosts, oldPosts = []) {
    try {
      if (!Array.isArray(newPosts)) return oldPosts;
      if (!Array.isArray(oldPosts)) return newPosts;

      // Create a set of post IDs from new posts for quick lookup
      const newPostIds = new Set(newPosts.map((p) => p._id));

      // Filter old posts to exclude duplicates
      const uniqueOldPosts = oldPosts.filter((p) => !newPostIds.has(p._id));

      // Combine: new posts first, then old posts
      const merged = [...newPosts, ...uniqueOldPosts];

      return merged;
    } catch (error) {
      console.error('Error merging posts:', error);
      return newPosts;
    }
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache stats
   */
  static getStats() {
    try {
      const cachedData = localStorage.getItem(CACHE_KEYS.HOME_POSTS);
      const timestamp = localStorage.getItem(CACHE_KEYS.HOME_POSTS_TIMESTAMP);

      if (!cachedData || !timestamp) {
        return { cached: false, count: 0, age: null, expiresIn: null };
      }

      const posts = JSON.parse(cachedData);
      const now = Date.now();
      const cacheTime = parseInt(timestamp, 10);
      const age = now - cacheTime;
      const expiresIn = Math.max(0, CACHE_DURATION - age);

      return {
        cached: true,
        count: posts.length,
        age: age,
        expiresIn: expiresIn,
        isExpired: age > CACHE_DURATION,
      };
    } catch (error) {
      console.error('Error getting cache stats:', error);
      return { cached: false, count: 0, age: null, expiresIn: null };
    }
  }
}

// Initialize on module load
CacheManager.initialize();

export default CacheManager;
