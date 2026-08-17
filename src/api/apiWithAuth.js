import axios from "axios";
import { getServerAddress } from "../utils/offlineUtils";

/**
 * Create an axios instance that uses authentication token from context
 * This should be used in components that have access to AuthContext
 */
export const createAuthenticatedApi = (getToken) => {
  const serverBase = getServerAddress();

  // Create axios instance WITHOUT token in initial setup
  // Token will be added dynamically via interceptor for each request
  const api = axios.create({
    baseURL: `${serverBase}/api/`,
    headers: {
      "Access-Control-Allow-Origin": "*",
    },
  });

  // Request interceptor to add auth token
  api.interceptors.request.use(
    (config) => {
      try {
        // Try to get token from context first
        let token = getToken ? getToken() : null;

        // Fallback to localStorage if getToken is not provided
        if (!token) {
          const user = localStorage.getItem("user") || "{}";
          const userJson = JSON.parse(user);
          token = userJson?.accessToken;
        }

        if (token) {
          // Server expects raw token (not "Bearer token")
          config.headers.Authorization = token;
        }
      } catch (error) {
        console.error("Error reading token:", error);
      }
      return config;
    },
    (error) => {
      return Promise.reject(error);
    },
  );

  // Response interceptor to handle auth errors
  api.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config;

      // Handle different error types
      if (error.response?.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true;

        // Try to refresh token (handled by AuthContext)
        try {
          // The token refresh will be handled by the AuthContext
          // Just retry the request with the new token
          let token = getToken ? getToken() : null;

          // Fallback to localStorage
          if (!token) {
            const user = localStorage.getItem("user") || "{}";
            const userJson = JSON.parse(user);
            token = userJson?.accessToken;
          }

          if (token) {
            // Server expects raw token (not "Bearer token")
            originalRequest.headers.Authorization = token;
            return api(originalRequest);
          }
        } catch (refreshError) {
          // Token refresh failed, user will be logged out by AuthContext
          console.error("Token refresh failed:", refreshError);
          return Promise.reject(refreshError);
        }
      } else if (error.response?.status >= 500) {
        // Server errors
        console.error(
          "Server error:",
          error.response?.status,
          error.response?.data,
        );
        error.message = "Server error. Please try again later.";
      } else if (error.response?.status === 403) {
        // Forbidden
        console.error("Access forbidden:", error.response?.data);
        error.message =
          "Access denied. You don't have permission to perform this action.";
      } else if (error.response?.status === 404) {
        // Not found
        console.error("Resource not found:", error.response?.data);
        error.message = "Requested resource not found.";
      } else if (!error.response) {
        // Network error
        console.error("Network error:", error.message);
        error.message =
          "Network error. Please check your connection and try again.";
      }

      return Promise.reject(error);
    },
  );

  return api;
};

/**
 * Create API instance with static token from localStorage
 * This is for backward compatibility with existing code
 */
export const createApiFromStorage = () => {
  const serverBase = getServerAddress();

  // Create axios instance WITHOUT token in initial setup
  // Token will be added dynamically via interceptor for each request
  const api = axios.create({
    baseURL: `${serverBase}/api/`,
    headers: {
      "Access-Control-Allow-Origin": "*",
    },
  });

  // Add request interceptor to include token
  api.interceptors.request.use(
    (config) => {
      try {
        const user = localStorage.getItem("user") || "{}";
        const userJson = JSON.parse(user);
        const token = userJson?.accessToken;

        if (token) {
          // Server expects raw token (not "Bearer token")
          config.headers.Authorization = token;
        }
      } catch (error) {
        console.error("Error reading token from localStorage:", error);
      }
      return config;
    },
    (error) => {
      return Promise.reject(error);
    },
  );

  return api;
};

export default createAuthenticatedApi;
