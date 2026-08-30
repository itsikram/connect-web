/**
 * Friends page cache (requests + suggestions).
 * Stale-while-revalidate: show last snapshot immediately, refresh in the background.
 */

export const FRIEND_CACHE_EVENT = "friends-cache-updated";

const CACHE_KEYS = {
  REQUESTS_PREFIX: "cached_friend_requests_",
  REQUESTS_TS_PREFIX: "friend_requests_timestamp_",
  SUGGESTIONS_PREFIX: "cached_friend_suggestions_",
  SUGGESTIONS_TS_PREFIX: "friend_suggestions_timestamp_",
  CACHE_VERSION: "friend_cache_version",
};

const CACHE_VERSION = "1.0";
const FRIEND_CACHE_DURATION = 15 * 60 * 1000;

const memoryCache = new Map();
const inflight = new Map();

const now = () => Date.now();

const emitUpdate = (profileId, list, items) => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(FRIEND_CACHE_EVENT, {
      detail: { profileId, list, items },
    }),
  );
};

class FriendCacheManager {
  static requestsKey(profileId) {
    return `${CACHE_KEYS.REQUESTS_PREFIX}${profileId}`;
  }

  static requestsTsKey(profileId) {
    return `${CACHE_KEYS.REQUESTS_TS_PREFIX}${profileId}`;
  }

  static suggestionsKey(profileId) {
    return `${CACHE_KEYS.SUGGESTIONS_PREFIX}${profileId}`;
  }

  static suggestionsTsKey(profileId) {
    return `${CACHE_KEYS.SUGGESTIONS_TS_PREFIX}${profileId}`;
  }

  static initialize() {
    try {
      const cachedVersion = localStorage.getItem(CACHE_KEYS.CACHE_VERSION);
      if (cachedVersion !== CACHE_VERSION) {
        this.clearCache();
        localStorage.setItem(CACHE_KEYS.CACHE_VERSION, CACHE_VERSION);
      }
    } catch (error) {
      console.warn("Friend cache initialization error:", error);
    }
  }

  static readList(storageKey, tsKey, memoryKey, { allowExpired = true } = {}) {
    try {
      const memory = memoryCache.get(memoryKey);
      if (memory && Array.isArray(memory.data)) {
        const expired = now() - memory.timestamp > FRIEND_CACHE_DURATION;
        if (!expired || allowExpired) return memory.data;
      }

      const raw = localStorage.getItem(storageKey);
      const timestamp = localStorage.getItem(tsKey);
      if (!raw || !timestamp) return null;

      const age = now() - parseInt(timestamp, 10);
      if (age > FRIEND_CACHE_DURATION && !allowExpired) {
        localStorage.removeItem(storageKey);
        localStorage.removeItem(tsKey);
        memoryCache.delete(memoryKey);
        return null;
      }

      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return null;

      memoryCache.set(memoryKey, {
        timestamp: parseInt(timestamp, 10),
        data: parsed,
      });
      return parsed;
    } catch (error) {
      console.error("Error reading friend cache:", error);
      return null;
    }
  }

  static writeList(storageKey, tsKey, memoryKey, items, profileId, list) {
    try {
      if (!Array.isArray(items)) return false;
      const timestamp = now();
      localStorage.setItem(storageKey, JSON.stringify(items));
      localStorage.setItem(tsKey, String(timestamp));
      memoryCache.set(memoryKey, { timestamp, data: items });
      emitUpdate(profileId, list, items);
      return true;
    } catch (error) {
      console.error("Error writing friend cache:", error);
      return false;
    }
  }

  static getCachedRequests(profileId, options) {
    if (!profileId) return null;
    return this.readList(
      this.requestsKey(profileId),
      this.requestsTsKey(profileId),
      `requests:${profileId}`,
      options,
    );
  }

  static setCachedRequests(profileId, items) {
    if (!profileId) return false;
    return this.writeList(
      this.requestsKey(profileId),
      this.requestsTsKey(profileId),
      `requests:${profileId}`,
      items,
      profileId,
      "requests",
    );
  }

  static getCachedSuggestions(profileId, options) {
    if (!profileId) return null;
    return this.readList(
      this.suggestionsKey(profileId),
      this.suggestionsTsKey(profileId),
      `suggestions:${profileId}`,
      options,
    );
  }

  static setCachedSuggestions(profileId, items) {
    if (!profileId) return false;
    return this.writeList(
      this.suggestionsKey(profileId),
      this.suggestionsTsKey(profileId),
      `suggestions:${profileId}`,
      items,
      profileId,
      "suggestions",
    );
  }

  static removeProfile(profileId, list, targetId) {
    if (!profileId || !targetId) return;
    const isRequests = list === "requests";
    const current = isRequests
      ? this.getCachedRequests(profileId)
      : this.getCachedSuggestions(profileId);
    if (!Array.isArray(current)) return;
    const next = current.filter((item) => item?._id !== targetId);
    if (isRequests) this.setCachedRequests(profileId, next);
    else this.setCachedSuggestions(profileId, next);
  }

  static async fetchWithCache({
    key,
    setCached,
    fetcher,
    forceRefresh = false,
  }) {
    if (!forceRefresh && inflight.has(key)) {
      return inflight.get(key);
    }

    const request = (async () => {
      const data = await fetcher();
      const list = Array.isArray(data) ? data : [];
      setCached(list);
      return list;
    })();

    inflight.set(key, request);
    try {
      return await request;
    } finally {
      inflight.delete(key);
    }
  }

  static clearCache(profileId = null) {
    try {
      if (profileId) {
        localStorage.removeItem(this.requestsKey(profileId));
        localStorage.removeItem(this.requestsTsKey(profileId));
        localStorage.removeItem(this.suggestionsKey(profileId));
        localStorage.removeItem(this.suggestionsTsKey(profileId));
        memoryCache.delete(`requests:${profileId}`);
        memoryCache.delete(`suggestions:${profileId}`);
        return;
      }

      Object.keys(localStorage).forEach((key) => {
        if (
          key.startsWith(CACHE_KEYS.REQUESTS_PREFIX) ||
          key.startsWith(CACHE_KEYS.REQUESTS_TS_PREFIX) ||
          key.startsWith(CACHE_KEYS.SUGGESTIONS_PREFIX) ||
          key.startsWith(CACHE_KEYS.SUGGESTIONS_TS_PREFIX)
        ) {
          localStorage.removeItem(key);
        }
      });
      memoryCache.clear();
    } catch (error) {
      console.error("Error clearing friend cache:", error);
    }
  }
}

FriendCacheManager.initialize();

export default FriendCacheManager;
