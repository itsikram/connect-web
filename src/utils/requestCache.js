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

export const invalidateCachedResource = (key) => {
  if (!key) return;
  memoryCache.delete(key);
  try {
    localStorage.removeItem(key);
  } catch (error) {
    // Ignore storage failures
  }
};

export const fetchProfileCached = async (
  profileId,
  { ttlMs = 60000, storageTtlMs = 300000, forceRefresh = false, lite = false } = {},
) => {
  if (!profileId) return null;

  const cacheKey = lite ? `profileLite:${profileId}` : `profile:${profileId}`;

  return getCachedResource({
    key: cacheKey,
    storageKey: cacheKey,
    ttlMs,
    storageTtlMs,
    forceRefresh,
    fetcher: async () => {
      const response = await api.get("/profile", {
        params: lite ? { profileId, lite: 1 } : { profileId },
      });
      const profile = response.data?.profile || response.data;
      if (profile && !lite) {
        writeMemoryCache(`profileLite:${profileId}`, profile);
      }
      return profile;
    },
  });
};

const parseOnlineStatusPayload = (data, fallbackIds = []) => {
  const statuses = {};
  if (data?.statuses && typeof data.statuses === "object") {
    Object.entries(data.statuses).forEach(([id, status]) => {
      statuses[String(id)] = {
        isActive: Boolean(status?.isActive),
        lastSeen: status?.lastSeen || null,
      };
    });
  }

  if (fallbackIds.length === 1 && data && data.isActive !== undefined) {
    const id = String(fallbackIds[0]);
    statuses[id] = {
      isActive: Boolean(data.isActive),
      lastSeen: data.lastSeen || statuses[id]?.lastSeen || null,
    };
  }

  return statuses;
};

export const fetchOnlineStatusesCached = async (
  profileIds,
  { ttlMs = 30000, forceRefresh = false } = {},
) => {
  const ids = [
    ...new Set((profileIds || []).map((id) => String(id || "")).filter(Boolean)),
  ];
  if (ids.length === 0) return {};

  const statuses = {};
  const missingIds = [];

  ids.forEach((id) => {
    if (!forceRefresh) {
      const cached = readMemoryCache(`onlineStatus:${id}`, ttlMs);
      if (cached !== null) {
        statuses[id] = cached;
        return;
      }
    }
    missingIds.push(id);
  });

  if (missingIds.length === 0) return statuses;

  const inflightKey = `onlineStatusBatch:${[...missingIds].sort().join(",")}`;
  if (inflightRequests.has(inflightKey)) {
    const inflightStatuses = await inflightRequests.get(inflightKey);
    return { ...inflightStatuses, ...statuses };
  }

  const request = (async () => {
    const response = await api.get("/profile/online-status", {
      params:
        missingIds.length === 1
          ? { profileId: missingIds[0] }
          : { profileIds: missingIds.join(",") },
    });
    const batch = parseOnlineStatusPayload(response.data, missingIds);
    missingIds.forEach((id) => {
      const status = batch[id] || { isActive: false, lastSeen: null };
      writeMemoryCache(`onlineStatus:${id}`, status);
      statuses[id] = status;
    });
    return statuses;
  })();

  inflightRequests.set(inflightKey, request);
  try {
    return await request;
  } finally {
    inflightRequests.delete(inflightKey);
  }
};

export const fetchChatListCached = async (
  profileId,
  { ttlMs = 30000, storageTtlMs = 120000, forceRefresh = false } = {},
) => {
  if (!profileId) return [];

  return getCachedResource({
    key: `chatList:${profileId}`,
    storageKey: `chatList:${profileId}`,
    ttlMs,
    storageTtlMs,
    forceRefresh,
    fetcher: async () => {
      const response = await api.get("/message/chatList", {
        params: { profileId },
      });
      const body = response.data;
      const contacts = Array.isArray(body)
        ? body
        : Array.isArray(body?.contacts)
          ? body.contacts
          : Array.isArray(body?.data)
            ? body.data
            : [];

      contacts.forEach((contact) => {
        const personId = contact?.person?._id;
        if (!personId) return;
        writeMemoryCache(`onlineStatus:${personId}`, {
          isActive: Boolean(contact.isOnline),
          lastSeen: contact.lastSeen || null,
        });
      });

      return contacts;
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

export const prependProfilePostCache = (profileId, post) => {
  if (!profileId || !post) return;

  const key = `profilePosts:${profileId}`;
  const cachedPosts = readMemoryCache(key) ?? readStorageCache(key) ?? [];
  const nextPosts = [
    post,
    ...cachedPosts.filter((cachedPost) => cachedPost?._id !== post?._id),
  ];

  primeCachedResource(key, nextPosts);
};

export const removeProfilePostCache = (profileId, postId) => {
  if (!profileId || !postId) return;

  const key = `profilePosts:${profileId}`;
  const cachedPosts = readMemoryCache(key) ?? readStorageCache(key) ?? [];
  const nextPosts = cachedPosts.filter((post) => post?._id !== postId);

  primeCachedResource(key, nextPosts);
};

export const updateProfilePostCache = (profileId, updatedPost) => {
  if (!profileId || !updatedPost?._id) return;

  const key = `profilePosts:${profileId}`;
  const cachedPosts = readMemoryCache(key) ?? readStorageCache(key) ?? [];
  const nextPosts = cachedPosts.map((post) => {
    if (post?._id !== updatedPost._id) return post;

    return {
      ...post,
      ...updatedPost,
      author:
        updatedPost?.author && typeof updatedPost.author === "object"
          ? updatedPost.author
          : post?.author,
      parentPost:
        updatedPost?.parentPost && typeof updatedPost.parentPost === "object"
          ? updatedPost.parentPost
          : post?.parentPost,
      comments:
        Array.isArray(updatedPost?.comments) &&
        updatedPost.comments.some((comment) => comment && typeof comment === "object")
          ? updatedPost.comments
          : post?.comments,
    };
  });

  primeCachedResource(key, nextPosts);
};
