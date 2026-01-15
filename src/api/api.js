import axios from "axios";
import { getServerAddress } from "../utils/offlineUtils";
import { getUserFromStorage, setUserInStorage, removeStorageItem } from "../utils/storageUtils";
import { jwtDecode } from "jwt-decode";

// Get server address with offline fallback - computed once at module load
// This respects REACT_APP_SERVER_ADDR if set, otherwise uses fallback logic
const serverAddr = getServerAddress();
const baseURL = `${serverAddr}/api/`;
// const baseURL = `https://spirits-review-carbon-berkeley.trycloudflare.com/api/`;

// Helper function to check if token is expired
const isTokenExpired = (token) => {
    if (!token) return true;
    try {
        const decoded = jwtDecode(token);
        const currentTime = Date.now() / 1000;
        return decoded.exp < currentTime;
    } catch (error) {
        console.error('Error decoding token:', error);
        return true;
    }
};

// Create axios instance WITHOUT token in initial setup
// Token will be added dynamically via interceptor for each request
const api = axios.create({
    baseURL: baseURL,
    timeout: 30000, // 30 second timeout
    headers: {
        "User-Agent": "MyCustomUserAgent",
        "Access-Control-Allow-Origin": "*",
    }
});

// Add request interceptor to dynamically get token from storage
api.interceptors.request.use(
    (config) => {
        try {
            const userData = getUserFromStorage();
            const token = userData?.accessToken;
            
            // Debug logging
            if (process.env.NODE_ENV === 'development') {
                console.log('🔍 API Request to:', config.url);
                console.log('🔍 Token from storage:', token ? `${token.substring(0, 20)}...` : 'MISSING!');
            }
            
            // Ensure headers object exists
            if (!config.headers) {
                config.headers = {};
            }
            
            if (token) {
                // Check if token is expired (for logging purposes)
                if (isTokenExpired(token)) {
                    console.warn('⚠️ Token is expired, request may fail. Will attempt refresh on 401:', config.url);
                }
                // Always send the token - let the server validate it
                // The response interceptor will handle 401 errors and attempt refresh
                // Server expects raw token (not "Bearer token")
                config.headers.Authorization = token;
            } else {
                console.warn('⚠️ No token found in storage for request:', config.url);
            }
        } catch (error) {
            console.error('❌ Error reading token from storage:', error);
        }
        
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Track if we're currently refreshing to avoid multiple refresh attempts
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
    failedQueue.forEach(prom => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token);
        }
    });
    failedQueue = [];
};

// Add response interceptor for error handling
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        // Don't process aborted requests
        if (error.code === 'ECONNABORTED' || error.name === 'CanceledError') {
            return Promise.reject(error);
        }
        
        const originalRequest = error.config;
        
        // Handle 401 Unauthorized errors
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;
            
            console.warn('Unauthorized request, token may be invalid or expired');
            
            // Try to refresh token if we have a refresh token
            try {
                const userData = getUserFromStorage();
                const refreshToken = userData?.refreshToken;
                
                if (refreshToken && !isRefreshing) {
                    isRefreshing = true;
                    
                    try {
                        const response = await axios.post(
                            `${baseURL}auth/refresh`,
                            { refreshToken }
                        );
                        
                        if (response.data.accessToken) {
                            // Update stored user data
                            const updatedUser = {
                                ...userData,
                                accessToken: response.data.accessToken,
                                refreshToken: response.data.refreshToken || refreshToken
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
                        console.error('Token refresh failed, clearing auth:', refreshError);
                        removeStorageItem("user");
                        
                        // Dispatch logout event or redirect
                        window.dispatchEvent(new CustomEvent('auth:logout'));
                    }
                } else if (!refreshToken) {
                    // No refresh token available - clear auth
                    console.warn('No refresh token available, clearing auth');
                    removeStorageItem("user");
                    window.dispatchEvent(new CustomEvent('auth:logout'));
                }
            } catch (err) {
                console.error('Error handling 401:', err);
            }
        }
        
        return Promise.reject(error);
    }
);

export default api;