import axios from "axios";
import { getServerAddress } from "../utils/offlineUtils";
import {
  getUserFromStorage,
  setUserInStorage,
  removeStorageItem,
} from "../utils/storageUtils";
import { jwtDecode } from "jwt-decode";
import { LoadBalancer } from "../utils/loadBalancer";

// Production server URLs for load balancing
// Add all your Render server URLs here
const prodServerUrls = [
  "https://connect-server-7h7d.onrender.com",
  // Add more Render server URLs here, for example:
  // "https://connect-server-def456.onrender.com",
  // "https://connect-server-ghi789.onrender.com",
];

// const prodServerUrls = [
//     "https://connect-server-1.onrender.com",
//     // Add more Render server URLs here, for example:
//     "https://connect-server-7h7d.onrender.com",
//     // "https://connect-server-def456.onrender.com",
//     // "https://connect-server-ghi789.onrender.com",
//   ];

// Get server address with offline fallback - computed once at module load
// This respects REACT_APP_SERVER_ADDR if set, otherwise uses fallback logic
const serverAddr = getServerAddress();
const baseURL = `${serverAddr}/api/`;

// Client-side round-robin is disabled. Point REACT_APP_SERVER_ADDR at the
// Connect load balancer (default :4000). That process routes /api by CPU
// and keeps Socket.IO sticky. Splitting hosts in the browser breaks sockets.
let loadBalancer = null;
const useLoadBalancer = false;

if (useLoadBalancer) {
  try {
    loadBalancer = new LoadBalancer(prodServerUrls);
    if (process.env.NODE_ENV === "development") {
      console.log("✅ Load balancer enabled with servers:", prodServerUrls);
    }
  } catch (error) {
    console.error("❌ Failed to initialize load balancer:", error);
  }
}

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
  timeout: 30000, // 30 second timeout
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

  if (pathname.includes("/message/getChatHistory")) {
    return { cacheTtl: 4000 };
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
      // If load balancer is enabled, set baseURL dynamically
      if (
        loadBalancer &&
        requestConfig.url &&
        !requestConfig.url.startsWith("http")
      ) {
        const serverUrl = loadBalancer.getNextServer();
        requestConfig.baseURL = `${serverUrl}/api/`;
        // Store the server URL for error handling
        requestConfig._serverUrl = serverUrl;
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
    // Mark server as healthy on successful response
    if (loadBalancer && response.config?._serverUrl) {
      loadBalancer.markServerHealthy(response.config._serverUrl);
    }
    return response;
  },
  async (error) => {
    // Don't process aborted requests
    if (error.code === "ECONNABORTED" || error.name === "CanceledError") {
      return Promise.reject(error);
    }

    const originalRequest = error.config;

    // Handle load balancer retry logic
    if (loadBalancer && originalRequest?._serverUrl) {
      const isNetworkError =
        !error.response ||
        error.code === "ECONNABORTED" ||
        error.code === "ENOTFOUND" ||
        error.code === "ECONNREFUSED" ||
        error.message?.includes("timeout") ||
        error.message?.includes("Network Error");

      const isServerError =
        error.response?.status && error.response.status >= 500;

      // Retry with different server on network errors or 5xx errors
      if (
        (isNetworkError || isServerError) &&
        (!originalRequest._retryCount || originalRequest._retryCount < 2)
      ) {
        originalRequest._retryCount = (originalRequest._retryCount || 0) + 1;

        // Mark current server as unhealthy
        loadBalancer.markServerUnhealthy(originalRequest._serverUrl, error);

        // Try next server
        const nextServerUrl = loadBalancer.getNextServer();
        originalRequest.baseURL = `${nextServerUrl}/api/`;
        originalRequest._serverUrl = nextServerUrl;

        if (process.env.NODE_ENV === "development") {
          console.log(
            `🔄 Retrying request on server ${nextServerUrl} (attempt ${originalRequest._retryCount})`,
          );
        }

        return api(originalRequest);
      } else if (isNetworkError || isServerError) {
        // All retries exhausted, mark server as unhealthy
        loadBalancer.markServerUnhealthy(originalRequest._serverUrl, error);
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
