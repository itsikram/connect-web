import { getServerAddress } from './offlineUtils';

/**
 * Make authenticated API calls to the backend
 * @param {string} method - HTTP method (GET, POST, PUT, DELETE, etc.)
 * @param {string} endpoint - API endpoint (e.g., '/api/saved-videos/history')
 * @param {any} data - Request body data (for POST, PUT, etc.)
 * @returns {Promise<any>} - Response data
 */
export const apiCall = async (method, endpoint, data = null) => {
  try {
    const token = getAuthToken();
    
    console.log(`[API] Starting ${method} request to ${endpoint}`);
    console.log(`[API] Token present: ${!!token}`);
    
    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    if (token) {
      headers.Authorization = token;
      console.log(`[API] Authorization header set: ${token.substring(0, 30)}...`);
    } else {
      console.warn(`[API] ⚠️ NO TOKEN FOUND - API call may fail!`);
    }

    const baseUrl = getServerAddress();
    const url = `${baseUrl}${endpoint}`;
    
    console.log(`[API] Full URL: ${url}`);

    const options = {
      method,
      headers,
      mode: 'cors',
      // Token-based auth; avoid cookies so CORS with origin '*' works
      credentials: 'omit',
    };

    if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      options.body = JSON.stringify(data);
      console.log(`[API] Request body:`, JSON.stringify(data).substring(0, 100) + '...');
    }

    console.log(`[API] Making request to: ${url}`);
    console.log(`[API] Request options:`, {
      method,
      hasAuth: !!headers.Authorization,
      hasBody: !!options.body
    });
    
    let response;
    try {
      response = await fetch(url, options);
      console.log(`[API] Response received with status: ${response.status}`);
    } catch (fetchError) {
      console.error(`[API] ❌ FETCH FAILED:`, {
        message: fetchError.message,
        url: url,
        type: fetchError.name
      });
      throw fetchError;
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMsg = errorData.error || errorData.message || `HTTP ${response.status}`;
      console.error(`[API] ❌ Error response:`, errorData);
      throw new Error(errorMsg);
    }

    const responseData = await response.json();
    console.log(`[API] ✓ Success:`, responseData);
    return responseData;
  } catch (error) {
    console.error(`[API] ❌ FAILED [${method} ${endpoint}]:`, error.message);
    throw error;
  }
};

/**
 * Get authentication token from storage
 * @returns {string|null} - JWT token or null
 */
const getAuthToken = () => {
  try {
    console.log('[Token] Looking for auth token...');
    
    // Check localStorage for user object
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        const token = user?.accessToken || user?.token;
        if (token) {
          console.log('[Token] ✓ Found in localStorage.user.accessToken');
          return token;
        }
      } catch (e) {
        console.warn('[Token] Failed to parse user from localStorage:', e);
      }
    }

    // Check sessionStorage for user object
    const sessionUserStr = sessionStorage.getItem('user');
    if (sessionUserStr) {
      try {
        const user = JSON.parse(sessionUserStr);
        const token = user?.accessToken || user?.token;
        if (token) {
          console.log('[Token] ✓ Found in sessionStorage.user.accessToken');
          return token;
        }
      } catch (e) {
        console.warn('[Token] Failed to parse user from sessionStorage:', e);
      }
    }

    // Fallback to direct token storage
    const localToken = localStorage.getItem('authToken');
    if (localToken) {
      console.log('[Token] ✓ Found in localStorage.authToken');
      return localToken;
    }

    const sessionToken = sessionStorage.getItem('authToken');
    if (sessionToken) {
      console.log('[Token] ✓ Found in sessionStorage.authToken');
      return sessionToken;
    }

    // No token found - log storage contents for debugging
    console.warn('[Token] ❌ NO TOKEN FOUND!');
    console.log('[Token] localStorage keys:', Object.keys(localStorage));
    console.log('[Token] sessionStorage keys:', Object.keys(sessionStorage));
    
    // Log the actual user object if it exists
    try {
      const userData = JSON.parse(localStorage.getItem('user') || '{}');
      console.log('[Token] user object keys:', Object.keys(userData));
      console.log('[Token] user.accessToken:', !!userData.accessToken);
    } catch (e) {
      // ignore
    }

    return null;
  } catch (error) {
    console.warn('[Token] Error getting auth token:', error);
    return null;
  }
};
