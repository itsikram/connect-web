import axios from "axios";

// Create axios instance WITHOUT token in initial setup
// Token will be added dynamically via interceptor for each request
const api = axios.create({
    baseURL: process.env.REACT_APP_SERVER_ADDR+'/api/',
    headers: {
        "User-Agent": "MyCustomUserAgent",
        "Access-Control-Allow-Origin": "*",
    }
});

// Add request interceptor to dynamically get token from localStorage
api.interceptors.request.use(
    (config) => {
        try {
            const user = localStorage.getItem("user") || '{}';
            const userJson = JSON.parse(user);
            const token = userJson.accessToken;
            
            // Debug logging
            if (process.env.NODE_ENV === 'development') {
                console.log('🔍 API Request to:', config.url);
                console.log('🔍 Token from localStorage:', token ? `${token.substring(0, 20)}...` : 'MISSING!');
            }
            
            if (token) {
                // Server expects raw token (not "Bearer token")
                config.headers.Authorization = token;
            } else {
                console.warn('⚠️ No token found in localStorage for request:', config.url);
            }
        } catch (error) {
            console.error('❌ Error reading token from localStorage:', error);
        }
        
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Add response interceptor for error handling
api.interceptors.response.use(
    (response) => response,
    (error) => {
        // Handle 401 Unauthorized errors
        if (error.response?.status === 401) {
            console.warn('Unauthorized request, token may be invalid or expired');
            // You could trigger a logout here if needed
        }
        return Promise.reject(error);
    }
);

export default api;