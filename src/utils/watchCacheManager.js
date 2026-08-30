/**
 * Watch page cache (related feed + single videos).
 * Stale-while-revalidate: show last snapshot immediately, refresh in the background.
 */

export const WATCH_CACHE_EVENT = "watch-cache-updated";

const CACHE_KEYS = {
  FEED_PREFIX: "cached_watch_feed_",
  FEED_TS_PREFIX: "watch_feed_timestamp_",
  ITEM_PREFIX: "cached_watch_item_",
  ITEM_TS_PREFIX: "watch_item_timestamp_",
  CACHE_VERSION: "watch_cache_version",
};

const CACHE_VERSION = "1.0";
const WATCH_CACHE_DURATION = 15 * 60 * 1000;

const memoryCache = new Map();
const inflight = new Map();

const now = () => Date.now();

const emitUpdate = (detail) => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(WATCH_CACHE_EVENT, { detail }));
};

class WatchCacheManager {
  static feedKey(profileId) {
    return `${CACHE_KEYS.FEED_PREFIX}${profileId}`;
  }

  static feedTsKey(profileId) {
    return `${CACHE_KEYS.FEED_TS_PREFIX}${profileId}`;
  }

  static itemKey(watchId) {
    return `${CACHE_KEYS.ITEM_PREFIX}${watchId}`;
  }

  static itemTsKey(watchId) {
    return `${CACHE_KEYS.ITEM_TS_PREFIX}${watchId}`;
  }

  static initialize() {
    try {
      const cachedVersion = localStorage.getItem(CACHE_KEYS.CACHE_VERSION);
      if (cachedVersion !== CACHE_VERSION) {
        this.clearCache();
        localStorage.setItem(CACHE_KEYS.CACHE_VERSION, CACHE_VERSION);
      }
    } catch (error) {
      console.warn("Watch cache initialization error:", error);
    }
  }

  static readValue(storageKey, tsKey, memoryKey, { allowExpired = true } = {}) {
    try {
      const memory = memoryCache.get(memoryKey);
      if (memory && memory.data != null) {
        const expired = now() - memory.timestamp > WATCH_CACHE_DURATION;
        if (!expired || allowExpired) return memory.data;
      }

      const raw = localStorage.getItem(storageKey);
      const timestamp = localStorage.getItem(tsKey);
      if (!raw || !timestamp) return null;

      const age = now() - parseInt(timestamp, 10);
      if (age > WATCH_CACHE_DURATION && !allowExpired) {
        localStorage.removeItem(storageKey);
        localStorage.removeItem(tsKey);
        memoryCache.delete(memoryKey);
        return null;
      }

      const parsed = JSON.parse(raw);
      memoryCache.set(memoryKey, {
        timestamp: parseInt(timestamp, 10),
        data: parsed,
      });
      return parsed;
    } catch (error) {
      console.error("Error reading watch cache:", error);
      return null;
    }
  }

  static writeValue(storageKey, tsKey, memoryKey, data) {
    try {
      if (data == null) return false;
      const timestamp = now();
      localStorage.setItem(storageKey, JSON.stringify(data));
      localStorage.setItem(tsKey, String(timestamp));
      memoryCache.set(memoryKey, { timestamp, data });
      return true;
    } catch (error) {
      if (error?.name === "QuotaExceededError") {
        try {
          localStorage.removeItem(storageKey);
          localStorage.removeItem(tsKey);
        } catch (_) {}
      }
      console.error("Error writing watch cache:", error);
      return false;
    }
  }

  static getCachedFeed(profileId, options) {
    if (!profileId) return null;
    const feed = this.readValue(
      this.feedKey(profileId),
      this.feedTsKey(profileId),
      `feed:${profileId}`,
      options,
    );
    return Array.isArray(feed) ? feed : null;
  }

  static setCachedFeed(profileId, items) {
    if (!profileId || !Array.isArray(items)) return false;
    const wrote = this.writeValue(
      this.feedKey(profileId),
      this.feedTsKey(profileId),
      `feed:${profileId}`,
      items,
    );
    items.forEach((item) => {
      if (item?._id) this.setCachedWatch(item, { emit: false });
    });
    if (wrote) {
      emitUpdate({ profileId, list: "feed", items });
    }
    return wrote;
  }

  static getCachedWatch(watchId, options) {
    if (!watchId) return null;
    const item = this.readValue(
      this.itemKey(watchId),
      this.itemTsKey(watchId),
      `item:${watchId}`,
      options,
    );
    return item && typeof item === "object" ? item : null;
  }

  static findWatch(profileId, watchId) {
    if (!watchId) return null;
    const fromItem = this.getCachedWatch(watchId);
    if (fromItem) return fromItem;
    const feed = this.getCachedFeed(profileId) || [];
    return feed.find((item) => item?._id === watchId) || null;
  }

  static setCachedWatch(watch, { emit = true } = {}) {
    if (!watch?._id) return false;
    const wrote = this.writeValue(
      this.itemKey(watch._id),
      this.itemTsKey(watch._id),
      `item:${watch._id}`,
      watch,
    );
    if (wrote && emit) {
      emitUpdate({ watchId: watch._id, list: "item", item: watch });
    }
    return wrote;
  }

  static prependWatch(profileId, watch) {
    if (!watch?._id) return false;
    this.setCachedWatch(watch, { emit: false });
    if (!profileId) return true;
    const feed = this.getCachedFeed(profileId) || [];
    const next = [watch, ...feed.filter((item) => item?._id !== watch._id)];
    return this.setCachedFeed(profileId, next);
  }

  static removeWatch(profileId, watchId) {
    if (!watchId) return false;
    try {
      localStorage.removeItem(this.itemKey(watchId));
      localStorage.removeItem(this.itemTsKey(watchId));
      memoryCache.delete(`item:${watchId}`);
    } catch (_) {}
    if (!profileId) return true;
    const feed = this.getCachedFeed(profileId);
    if (!Array.isArray(feed)) return true;
    return this.setCachedFeed(
      profileId,
      feed.filter((item) => item?._id !== watchId),
    );
  }

  static updateWatch(profileId, watchId, updates) {
    if (!watchId || !updates) return false;
    const current = this.findWatch(profileId, watchId);
    const nextItem = current ? { ...current, ...updates } : null;

    if (nextItem) this.setCachedWatch(nextItem, { emit: true });

    if (!profileId) return Boolean(nextItem);
    const feed = this.getCachedFeed(profileId);
    if (!Array.isArray(feed)) return Boolean(nextItem);

    const nextFeed = feed.map((item) =>
      item?._id === watchId ? { ...item, ...updates } : item,
    );
    return this.setCachedFeed(profileId, nextFeed);
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
      setCached(data);
      return data;
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
        localStorage.removeItem(this.feedKey(profileId));
        localStorage.removeItem(this.feedTsKey(profileId));
        memoryCache.delete(`feed:${profileId}`);
        return;
      }

      Object.keys(localStorage).forEach((key) => {
        if (
          key.startsWith(CACHE_KEYS.FEED_PREFIX) ||
          key.startsWith(CACHE_KEYS.FEED_TS_PREFIX) ||
          key.startsWith(CACHE_KEYS.ITEM_PREFIX) ||
          key.startsWith(CACHE_KEYS.ITEM_TS_PREFIX)
        ) {
          localStorage.removeItem(key);
        }
      });
      memoryCache.clear();
    } catch (error) {
      console.error("Error clearing watch cache:", error);
    }
  }
}

WatchCacheManager.initialize();

export default WatchCacheManager;
