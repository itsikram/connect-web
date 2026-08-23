import api from "../api/api";

const memoryCache = new Map();
const inflightRequests = new Map();

const now = () => Date.now();

const readStorageCache = (key, ttlMs) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;

    if (ttlMs && parsed.timestamp && now() - parsed.timestamp > ttlMs) {
      localStorage.removeItem(key);
      return null;
    }

    return parsed.data;
  } catch (error) {
    return null;
  }
};

const writeStorageCache = (key, data) => {
  try {
    localStorage.setItem(
      key,
      JSON.stringify({
        timestamp: now(),
        data,
      }),
    );
  } catch (error) {
    // Ignore storage write failures
  }
};

const readMemoryCache = (key, ttlMs) => {
  const cached = memoryCache.get(key);
  if (!cached) return null;

  if (ttlMs && now() - cached.timestamp > ttlMs) {
    memoryCache.delete(key);
    return null;
  }

  return cached.data;
};

const writeMemoryCache = (key, data) => {
  memoryCache.set(key, {
    timestamp: now(),
    data,
  });
};

const getCachedResource = async ({
  key,
  storageKey = key,
  fetcher,
  ttlMs = 30000,
  storageTtlMs = ttlMs,
  forceRefresh = false,
}) => {
  if (!forceRefresh) {
    const memoryData = readMemoryCache(key, ttlMs);
    if (memoryData !== null) return memoryData;

    const storageData = readStorageCache(storageKey, storageTtlMs);
    if (storageData !== null) {
      writeMemoryCache(key, storageData);
      return storageData;
    }
  }

  if (inflightRequests.has(key)) {
    return inflightRequests.get(key);
  }

  const request = (async () => {
    const data = await fetcher();
    writeMemoryCache(key, data);
    writeStorageCache(storageKey, data);
    return data;
  })();

  inflightRequests.set(key, request);

  try {
    return await request;
  } finally {
    inflightRequests.delete(key);
  }
};

export const primeCachedResource = (key, data, storageKey = key) => {
  writeMemoryCache(key, data);
  writeStorageCache(storageKey, data);
};

export const fetchProfileCached = async (
  profileId,
  { ttlMs = 60000, storageTtlMs = 300000, forceRefresh = false } = {},
) => {
  if (!profileId) return null;

  return getCachedResource({
    key: `profile:${profileId}`,
    storageKey: `profile:${profileId}`,
    ttlMs,
    storageTtlMs,
    forceRefresh,
    fetcher: async () => {
      const response = await api.get("/profile", {
        params: { profileId },
      });
      return response.data?.profile || response.data;
    },
  });
};

export const fetchProfileHasStoryCached = async (
  profileId,
  { ttlMs = 60000, storageTtlMs = 300000, forceRefresh = false } = {},
) => {
  if (!profileId) return null;

  return getCachedResource({
    key: `profileHasStory:${profileId}`,
    storageKey: `profileHasStory:${profileId}`,
    ttlMs,
    storageTtlMs,
    forceRefresh,
    fetcher: async () => {
      const response = await api.get("/profile/hasStory", {
        params: { profileId },
      });
      return response.data;
    },
  });
};

export const fetchProfilePostsCached = async (
  profileId,
  { ttlMs = 60000, storageTtlMs = 180000, forceRefresh = false } = {},
) => {
  if (!profileId) return [];

  return getCachedResource({
    key: `profilePosts:${profileId}`,
    storageKey: `profilePosts:${profileId}`,
    ttlMs,
    storageTtlMs,
    forceRefresh,
    fetcher: async () => {
      const response = await api.get("/post/myPosts", {
        params: { profile: profileId },
      });
      return Array.isArray(response.data) ? response.data : [];
    },
  });
};
