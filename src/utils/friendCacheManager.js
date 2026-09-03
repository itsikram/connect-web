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

const CACHE_VERSION = "1.1";
const FRIEND_CACHE_DURATION = 15 * 60 * 1000;

const memoryCache = new Map();
const inflight = new Map();

const TOMBSTONE_TTL = 60 * 1000;
const tombstones = new Map();

const now = () => Date.now();

const uniqueById = (items) => {
  if (!Array.isArray(items)) return [];
  const seen = new Set();
  return items.filter((item) => {
    const id = String(item?._id || "");
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
};

const emitUpdate = (profileId, list, items) => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(FRIEND_CACHE_EVENT, {
      detail: { profileId, list, items },
    }),
  );
};

const sameIdList = (a, b) => {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
    return false;
  }
  return a.every((item, index) => item?._id === b[index]?._id);
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

  static tombstoneKey(profileId, list) {
    return `${list}:${profileId || "anon"}`;
  }

  static markRemoved(profileId, list, id) {
    if (!id) return;
    const key = this.tombstoneKey(profileId, list);
    const bucket = tombstones.get(key) || new Map();
    bucket.set(String(id), now());
    tombstones.set(key, bucket);
  }

  static filterTombstones(profileId, list, items) {
    if (!Array.isArray(items)) return [];
    const bucket = tombstones.get(this.tombstoneKey(profileId, list));
    if (!bucket || bucket.size === 0) return items;
    const cutoff = now() - TOMBSTONE_TTL;
    bucket.forEach((removedAt, id) => {
      if (removedAt < cutoff) bucket.delete(id);
    });
    return items.filter((item) => !bucket.has(String(item?._id)));
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
      const current = memoryCache.get(memoryKey)?.data;
      const next = uniqueById(this.filterTombstones(profileId, list, items));
      const timestamp = now();
      localStorage.setItem(storageKey, JSON.stringify(next));
      localStorage.setItem(tsKey, String(timestamp));
      memoryCache.set(memoryKey, { timestamp, data: next });
      if (!sameIdList(current, next)) {
        emitUpdate(profileId, list, next);
      }
      return true;
    } catch (error) {
      memoryCache.set(memoryKey, { timestamp: now(), data: items });
      if (error?.name !== "QuotaExceededError") {
        console.error("Error writing friend cache:", error);
      }
      return false;
    }
  }

  static getCachedRequests(profileId, options) {
    if (!profileId) return null;
    const list = this.readList(
      this.requestsKey(profileId),
      this.requestsTsKey(profileId),
      `requests:${profileId}`,
      options,
    );
    return Array.isArray(list)
      ? uniqueById(this.filterTombstones(profileId, "requests", list))
      : null;
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
    const list = this.readList(
      this.suggestionsKey(profileId),
      this.suggestionsTsKey(profileId),
      `suggestions:${profileId}`,
      options,
    );
    return Array.isArray(list)
      ? uniqueById(this.filterTombstones(profileId, "suggestions", list))
      : null;
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
    this.markRemoved(profileId, list, targetId);
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
      const list = uniqueById(data);
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
