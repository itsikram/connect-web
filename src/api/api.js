import axios from "axios";
import {
  getServerAddress,
  getServerList,
  getNextServer,
  setPreferredServer,
  markServerDown,
} from "../utils/offlineUtils";
import {
  getUserFromStorage,
  setUserInStorage,
  removeStorageItem,
} from "../utils/storageUtils";
import { jwtDecode } from "jwt-decode";
import { normalizeCloudinaryUrl } from "../utils/profileImage";

// Get server address with offline fallback - computed once at module load
// This respects REACT_APP_SERVER_ADDR if set, otherwise uses fallback logic
const serverAddr = getServerAddress();
const baseURL = `${serverAddr}/api/`;

// Multiple servers (admin panel list or REACT_APP_SERVER_ADDR="https://a,https://b"):
// each browser sticks to one home server and only moves to the next one when
// it fails. The list can change at runtime, so this is checked per request.
const useFailover = () => getServerList().length > 1;
const DEFAULT_TIMEOUT_MS = 30000;
const FAILOVER_GET_TIMEOUT_MS = 12000;

// Helper function to check if token is expired
const isTokenExpired = (token) => {
  if (!token) return true;
  try {
    const decoded = jwtDecode(token);
    const currentTime = Date.now() / 1000;
    return decoded.exp < currentTime;
  } catch (error) {
    console.error("Error decoding token:", error);
    return true;
  }
};

// Create axios instance WITHOUT token in initial setup
// Token will be added dynamically via interceptor for each request
const api = axios.create({
  baseURL: baseURL,
  timeout: DEFAULT_TIMEOUT_MS,
  headers: {
    "Access-Control-Allow-Origin": "*",
  },
});

const inFlightGetRequests = new Map();
const getResponseCache = new Map();

const cloneAxiosResponse = (response) => ({
  ...response,
  headers: response.headers ? { ...response.headers } : response.headers,
});

const normalizeMediaUrls = (value) => {
  if (typeof value === "string") return normalizeCloudinaryUrl(value);
  if (Array.isArray(value)) return value.map(normalizeMediaUrls);
  if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, child]) => {
      value[key] = normalizeMediaUrls(child);
    });
  }
  return value;
};

const getRequestUrl = (requestConfig) => {
  const requestUri = api.getUri(requestConfig);
  const fallbackOrigin =
    typeof window !== "undefined"
      ? window.location.origin
      : "http://localhost";

  return new URL(requestUri, requestConfig.baseURL || baseURL || fallbackOrigin);
};

const getGetRequestOptimization = (requestConfig) => {
  if (
    requestConfig.method?.toLowerCase() !== "get" ||
    requestConfig.signal ||
    requestConfig.cancelToken
  ) {
    return null;
  }

  const requestUrl = getRequestUrl(requestConfig);
  const { pathname, searchParams } = requestUrl;

  // Deduplicate in-flight polls; do not reuse a stale inbox snapshot.
  if (pathname.includes("/message/new-messages")) {
    return { cacheTtl: 0 };
  }

  // Chat history must always reflect the latest messages; only dedupe
  // concurrent requests, never serve a remembered snapshot.
  if (pathname.includes("/message/getChatHistory")) {
    return { cacheTtl: 0 };
  }

  if (pathname.includes("/message/getOldMessages")) {
    return { cacheTtl: 0 };
  }

  if (pathname.includes("/message/chatList")) {
    return { cacheTtl: 30000 };
  }

  if (pathname.includes("/message/media")) {
    return { cacheTtl: 60000 };
  }

  if (pathname.includes("/profile/online-status")) {
    return { cacheTtl: 15000 };
  }

  if (pathname.includes("/story/")) {
    return { cacheTtl: 30000 };
  }

  if (
    pathname.endsWith("/profile") &&
    (!requestUrl.search || searchParams.has("profileId"))
  ) {
    return { cacheTtl: 60000 };
  }

  if (pathname.includes("/setting") && !pathname.includes("/update")) {
    return { cacheTtl: 60000 };
  }

  if (pathname.includes("/notification/new")) {
    return { cacheTtl: 15000 };
  }

  if (pathname.includes("/notification")) {
    return { cacheTtl: 20000 };
  }

  if (pathname.includes("/watch/related") || pathname.includes("watch/related")) {
    return { cacheTtl: 60000 };
  }

  if (
    pathname.includes("/post/newsFeed") &&
    searchParams.get("pageNumber") === "1"
  ) {
    return { cacheTtl: 10000 };
  }

  if (
    pathname.includes("/feed/posts") &&
    (!searchParams.has("page") || searchParams.get("page") === "1")
  ) {
    return { cacheTtl: 10000 };
  }

  return null;
};

const getRequestCacheKey = (requestConfig) => {
  const requestUrl = getRequestUrl(requestConfig);
  const authHeader =
    requestConfig.headers?.Authorization ||
    requestConfig.headers?.authorization ||
    "";

  return `get:${requestUrl.pathname}${requestUrl.search}:${authHeader}`;
};

const defaultAdapter = axios.getAdapter
  ? axios.getAdapter(api.defaults.adapter || axios.defaults.adapter)
  : api.defaults.adapter || axios.defaults.adapter;

api.defaults.adapter = async (requestConfig) => {
  const optimization = getGetRequestOptimization(requestConfig);

  if (!optimization) {
    return defaultAdapter(requestConfig);
  }

  const requestKey = getRequestCacheKey(requestConfig);
  const cachedEntry = getResponseCache.get(requestKey);

  if (optimization.cacheTtl > 0 && cachedEntry) {
    if (cachedEntry.expiresAt > Date.now()) {
      return cloneAxiosResponse(cachedEntry.response);
    }

    getResponseCache.delete(requestKey);
  }

  const inFlightRequest = inFlightGetRequests.get(requestKey);
  if (inFlightRequest) {
    return inFlightRequest.then((response) => cloneAxiosResponse(response));
  }

  const requestPromise = defaultAdapter(requestConfig)
    .then((response) => {
      if (optimization.cacheTtl > 0) {
        getResponseCache.set(requestKey, {
          expiresAt: Date.now() + optimization.cacheTtl,
          response: cloneAxiosResponse(response),
        });
      }

      return response;
    })
    .finally(() => {
      inFlightGetRequests.delete(requestKey);
    });

  inFlightGetRequests.set(requestKey, requestPromise);

  return requestPromise;
};

export const invalidateGetCache = (pathFragment = "") => {
  const fragment = String(pathFragment || "");
  Array.from(getResponseCache.keys()).forEach((key) => {
    if (!fragment || String(key).includes(fragment)) {
      getResponseCache.delete(key);
    }
  });
};

// Add request interceptor to dynamically get token from storage and handle load balancing
api.interceptors.request.use(
  (requestConfig) => {
    try {
      // Send each request to the current home server (see offlineUtils.js)
      if (
        getServerList().length > 0 &&
        requestConfig.url &&
        !requestConfig.url.startsWith("http")
      ) {
        const serverUrl = requestConfig._serverUrl || getServerAddress();
        requestConfig.baseURL = `${serverUrl}/api/`;
        // Store the server URL for error handling
        requestConfig._serverUrl = serverUrl;

        // A hung server should not stall reads for the full 30s when another
        // server can answer; timed-out GETs fail over (see below).
        if (
          useFailover() &&
          String(requestConfig.method || "get").toLowerCase() === "get" &&
          requestConfig.timeout === DEFAULT_TIMEOUT_MS
        ) {
          requestConfig.timeout = FAILOVER_GET_TIMEOUT_MS;
        }
      }

      const userData = getUserFromStorage();
      const token = userData?.accessToken;

      // Debug logging (opt-in): set REACT_APP_DEBUG_API=true to enable
      if (
        process.env.NODE_ENV === "development" &&
        process.env.REACT_APP_DEBUG_API === "true"
      ) {
        console.log("🔍 API Request to:", requestConfig.url);
        console.log("🔍 Base URL:", requestConfig.baseURL);
        console.log(
          "🔍 Token from storage:",
          token ? `${token.substring(0, 20)}...` : "MISSING!",
        );
      }

      // Ensure headers object exists
      if (!requestConfig.headers) {
        requestConfig.headers = {};
      }

      if (String(requestConfig.url || "").includes("ai-chat/complete")) {
        const requested = Number(requestConfig.timeout) || 0;
        requestConfig.timeout = Math.max(requested, 25000);
      }

      if (token) {
        // Check if token is expired (for logging purposes)
        if (isTokenExpired(token)) {
          console.warn(
            "⚠️ Token is expired, request may fail. Will attempt refresh on 401:",
            requestConfig.url,
          );
        }
        // Always send the token - let the server validate it
        // The response interceptor will handle 401 errors and attempt refresh
        // Server expects raw token (not "Bearer token")
        requestConfig.headers.Authorization = token;
      } else {
        console.warn(
          "⚠️ No token found in storage for request:",
          requestConfig.url,
        );
      }
    } catch (error) {
      console.error("❌ Error reading token from storage:", error);
    }

    return requestConfig;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// Track if we're currently refreshing to avoid multiple refresh attempts
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Add response interceptor for error handling with load balancer support
api.interceptors.response.use(
  (response) => {
    response.data = normalizeMediaUrls(response.data);
    return response;
  },
  async (error) => {
    // Requests cancelled by the app are never retried
    if (error.name === "CanceledError" || axios.isCancel(error)) {
      return Promise.reject(error);
    }

    const originalRequest = error.config;
    const isGet =
      String(originalRequest?.method || "get").toLowerCase() === "get";
    const isTimeout =
      error.code === "ECONNABORTED" || error.code === "ETIMEDOUT";

    // Failover: move to the next server when the home server is down.
    // Unreachable (no response) is safe to retry for any request; other 5xx
    // errors and timeouts are only retried for GET so a POST that may have
    // run is never sent twice.
    if (useFailover() && originalRequest?._serverUrl) {
      const status = error.response?.status;
      const isNetworkError = !error.response && !isTimeout;
      const isServerDown =
        [502, 503, 504].includes(status) ||
        (status >= 500 && isGet) ||
        (isTimeout && isGet);
      const triedCount = originalRequest._failoverCount || 0;

      if (
        (isNetworkError || isServerDown) &&
        triedCount < getServerList().length - 1
      ) {
        markServerDown(originalRequest._serverUrl);
        const nextServerUrl = getNextServer(originalRequest._serverUrl);
        originalRequest._failoverCount = triedCount + 1;
        originalRequest._serverUrl = nextServerUrl;
        originalRequest.baseURL = `${nextServerUrl}/api/`;
        setPreferredServer(nextServerUrl);
        console.warn(`🔄 Server unavailable, switching to ${nextServerUrl}`);
        return api(originalRequest);
      }
    }

    // Handle 401 Unauthorized errors
    if (
      error.response?.status === 401 &&
      !originalRequest?.skipAuthRefresh &&
      !originalRequest._retry
    ) {
      originalRequest._retry = true;

      console.warn("Unauthorized request, token may be invalid or expired");

      // Try to refresh token if we have a refresh token
      try {
        const userData = getUserFromStorage();
        const refreshToken = userData?.refreshToken;

        if (refreshToken && !isRefreshing) {
          isRefreshing = true;

          try {
            // Use current baseURL or fallback
            const refreshBaseURL = originalRequest?.baseURL || baseURL;
            const response = await axios.post(`${refreshBaseURL}auth/refresh`, {
              refreshToken,
            });

            if (response.data.accessToken) {
              // Update stored user data
              const updatedUser = {
                ...userData,
                accessToken: response.data.accessToken,
                refreshToken: response.data.refreshToken || refreshToken,
              };
              setUserInStorage(updatedUser);

              // Update the original request with new token
              originalRequest.headers.Authorization = response.data.accessToken;

              isRefreshing = false;
              processQueue(null, response.data.accessToken);

              // Retry the original request
              return api(originalRequest);
            }
          } catch (refreshError) {
            isRefreshing = false;
            processQueue(refreshError, null);

            // Refresh failed - clear auth and redirect to login
            console.error("Token refresh failed, clearing auth:", refreshError);
            removeStorageItem("user");

            // Dispatch logout event or redirect
            window.dispatchEvent(new CustomEvent("auth:logout"));
          }
        } else if (!refreshToken) {
          // No refresh token available - clear auth
          console.warn("No refresh token available, clearing auth");
          removeStorageItem("user");
          window.dispatchEvent(new CustomEvent("auth:logout"));
        }
      } catch (err) {
        console.error("Error handling 401:", err);
      }
    }

    return Promise.reject(error);
  },
);

export default api;
