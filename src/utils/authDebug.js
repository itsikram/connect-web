/**
 * Debugging utilities for authentication
 */

export const debugAuthToken = () => {
    try {
        const user = localStorage.getItem('user');
        console.log('🔍 Auth Debug - Raw localStorage:', user);
        
        if (user && user !== '{}') {
            const userData = JSON.parse(user);
            console.log('🔍 Auth Debug - Parsed user:', userData);
            console.log('🔍 Auth Debug - Token exists:', !!userData.accessToken);
            console.log('🔍 Auth Debug - Token value:', userData.accessToken?.substring(0, 20) + '...');
            return userData.accessToken;
        } else {
            console.warn('⚠️ Auth Debug - No user data in localStorage');
            return null;
        }
    } catch (error) {
        console.error('❌ Auth Debug - Error reading token:', error);
        return null;
    }
};

export const logApiRequest = (url, headers) => {
    console.log('🌐 API Request:', url);
    console.log('🔑 Authorization header:', headers.Authorization ? 
        headers.Authorization.substring(0, 20) + '...' : 'MISSING!');
};

