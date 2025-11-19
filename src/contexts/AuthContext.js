import React, { createContext, useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import axios from 'axios';
import { useDispatch } from 'react-redux';
import { clearAllState } from '../services/actions/authActions';
// Import socket lazily to avoid circular dependency at module load time
const getSocket = () => {
    // Dynamic import to break circular dependency
    return require('../common/socket').default;
};

export const AuthContext = createContext(null);

const AUTH_STORAGE_KEY = 'user';

export const AuthProvider = ({ children }) => {
    const dispatch = useDispatch();
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(null);
    const [refreshToken, setRefreshToken] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [authError, setAuthError] = useState(null);
    const tokenRefreshTimeoutRef = useRef(null);

    // Initialize auth state from localStorage
    useEffect(() => {
        initializeAuth();
    }, []);

    const initializeAuth = useCallback(() => {
        try {
            const storedUser = localStorage.getItem(AUTH_STORAGE_KEY);
            if (storedUser && storedUser !== '{}') {
                const userData = JSON.parse(storedUser);
                
                if (userData.accessToken) {
                    const isExpired = checkTokenExpiration(userData.accessToken);
                    
                    if (!isExpired) {
                        setToken(userData.accessToken);
                        setRefreshToken(userData.refreshToken);
                        setUser(userData);
                        setIsAuthenticated(true);
                        scheduleTokenRefresh(userData.accessToken);
                    } else {
                        // Token expired, try to refresh or logout
                        console.log('Token expired on initialization');
                        // handleLogout();
                    }
                }
            }
        } catch (error) {
            console.error('Error initializing auth:', error);
            // handleLogout();
        } finally {
            setLoading(false);
        }
    }, []);

    // Check if token is expired
    const checkTokenExpiration = (token) => {
        try {
            const decoded = jwtDecode(token);
            const currentTime = Date.now() / 1000;
            return decoded.exp < currentTime;
        } catch (error) {
            console.error('Error decoding token:', error);
            return true;
        }
    };

    // Get token expiration time
    const getTokenExpirationTime = (token) => {
        try {
            const decoded = jwtDecode(token);
            return decoded.exp * 1000; // Convert to milliseconds
        } catch (error) {
            console.error('Error getting token expiration:', error);
            return null;
        }
    };

    // Schedule token refresh before it expires
    const scheduleTokenRefresh = useCallback((accessToken) => {
        if (tokenRefreshTimeoutRef.current) {
            clearTimeout(tokenRefreshTimeoutRef.current);
        }

        const expirationTime = getTokenExpirationTime(accessToken);
        if (expirationTime) {
            // Refresh token 5 minutes before it expires
            const refreshTime = expirationTime - Date.now() - (5 * 60 * 1000);
            
            if (refreshTime > 0) {
                tokenRefreshTimeoutRef.current = setTimeout(() => {
                    refreshAuthToken();
                }, refreshTime);
            } else {
                // Token is about to expire or already expired
                refreshAuthToken();
            }
        }
    }, []);

    // Refresh authentication token
    const refreshAuthToken = useCallback(async () => {
        try {
            if (!refreshToken) {
                console.log('No refresh token available');
                // handleLogout();
                return;
            }

            const response = await axios.post(
                `${process.env.REACT_APP_SERVER_ADDR}/api/auth/refresh`,
                { refreshToken }
            );

            if (response.data.accessToken) {
                const userData = {
                    ...user,
                    accessToken: response.data.accessToken,
                    refreshToken: response.data.refreshToken || refreshToken
                };

                localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(userData));
                setToken(response.data.accessToken);
                setRefreshToken(response.data.refreshToken || refreshToken);
                setUser(userData);
                scheduleTokenRefresh(response.data.accessToken);
                
                console.log('Token refreshed successfully');
            }
        } catch (error) {
            console.error('Error refreshing token:', error);
            // handleLogout();
        }
    }, [refreshToken, user]);

    // Handle login
    const handleLogin = useCallback(async (credentials) => {
        setLoading(true);
        setAuthError(null);

        try {
            const response = await axios.post(
                `${process.env.REACT_APP_SERVER_ADDR}/api/auth/login`,
                credentials
            );

            if (response.status === 202 && response.data.accessToken) {
                const userData = response.data;
                
                console.log('📦 Login response data:', {
                    hasAccessToken: !!userData.accessToken,
                    hasProfile: !!userData.profile,
                    tokenLength: userData.accessToken?.length
                });
                
                // Store in localStorage with verification
                try {
                    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(userData));
                    
                    // Immediate verification
                    const verification = localStorage.getItem(AUTH_STORAGE_KEY);
                    const parsed = JSON.parse(verification);
                    
                    console.log('✅ Login Success - Stored in localStorage');
                    console.log('✅ Token:', userData.accessToken?.substring(0, 30) + '...');
                    console.log('✅ Can read back:', !!verification);
                    console.log('✅ Parsed token matches:', parsed.accessToken === userData.accessToken);
                } catch (storageError) {
                    console.error('❌ Error storing in localStorage:', storageError);
                }
                
                // Update context state
                setToken(userData.accessToken);
                setRefreshToken(userData.refreshToken);
                setUser(userData);
                setIsAuthenticated(true);
                setLoading(false);
                scheduleTokenRefresh(userData.accessToken);

                return { success: true, data: userData };
            } else {
                const errorMsg = response.data.message || 'Login failed';
                setAuthError(errorMsg);
                return { success: false, error: errorMsg };
            }
        } catch (error) {
            console.error('Login error:', error);
            const errorMsg = error.response?.data?.message || 'Login failed. Please try again.';
            setAuthError(errorMsg);
            return { success: false, error: errorMsg };
        } finally {
            setLoading(false);
        }
    }, []);

    // Handle Google OAuth login
    const handleGoogleLogin = useCallback(async (googleData) => {
        setLoading(true);
        setAuthError(null);

        try {
            const response = await axios.post(
                `${process.env.REACT_APP_SERVER_ADDR}/api/auth/google-signin`,
                googleData
            );

            if ((response.status === 201 || response.status === 202) && response.data.accessToken) {
                const userData = response.data;
                
                localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(userData));
                setToken(userData.accessToken);
                setRefreshToken(userData.refreshToken);
                setUser(userData);
                setIsAuthenticated(true);
                scheduleTokenRefresh(userData.accessToken);

                return { success: true, data: userData };
            } else {
                const errorMsg = response.data.message || 'Google sign-in failed';
                setAuthError(errorMsg);
                return { success: false, error: errorMsg };
            }
        } catch (error) {
            console.error('Google login error:', error);
            const errorMsg = error.response?.data?.message || 'Google sign-in failed. Please try again.';
            setAuthError(errorMsg);
            return { success: false, error: errorMsg };
        } finally {
            setLoading(false);
        }
    }, []);

    // Handle signup
    const handleSignup = useCallback(async (signupData) => {
        setLoading(true);
        setAuthError(null);

        try {
            const response = await axios.post(
                `${process.env.REACT_APP_SERVER_ADDR}/api/auth/signup`,
                signupData
            );

            if (response.status === 201 && response.data.accessToken) {
                const userData = response.data;
                
                localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(userData));
                setToken(userData.accessToken);
                setRefreshToken(userData.refreshToken);
                setUser(userData);
                setIsAuthenticated(true);
                scheduleTokenRefresh(userData.accessToken);

                return { success: true, data: userData };
            } else {
                const errorMsg = response.data.message || 'Signup failed';
                setAuthError(errorMsg);
                return { success: false, error: errorMsg };
            }
        } catch (error) {
            console.error('Signup error:', error);
            const errorMsg = error.response?.data?.message || 'Signup failed. Please try again.';
            setAuthError(errorMsg);
            return { success: false, error: errorMsg };
        } finally {
            setLoading(false);
        }
    }, []);

    // Handle logout
    const handleLogout = useCallback(() => {
        console.log('🚪 Logging out user...');
        
        // Disconnect socket connection (lazy import to avoid circular dependency)
        try {
            const socket = getSocket();
            if (socket && socket.connected) {
                socket.disconnect();
                console.log('🔌 Socket disconnected');
            }
        } catch (error) {
            console.warn('Warning: Could not disconnect socket:', error);
        }
        
        // Clear token refresh timeout
        if (tokenRefreshTimeoutRef.current) {
            clearTimeout(tokenRefreshTimeoutRef.current);
        }

        // Clear all Redux state
        dispatch(clearAllState());
        
        // Clear state FIRST
        setToken(null);
        setRefreshToken(null);
        setUser(null);
        setIsAuthenticated(false);
        setAuthError(null);
        setLoading(false);

        // Clear localStorage
        try {
            localStorage.removeItem(AUTH_STORAGE_KEY);
            // Clear any other app-specific storage
            localStorage.removeItem('lastPostId');
            localStorage.removeItem('download_app_modal_dismissed');
        } catch (error) {
            console.warn('Warning: Could not clear localStorage:', error);
        }
        
        console.log('✅ User logged out successfully - All data cleared from Redux store');
    }, [dispatch]);

    // Update user data (for profile updates, etc.)
    const updateUser = useCallback((userData) => {
        try {
            const currentUser = JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) || '{}');
            const updatedUser = { ...currentUser, ...userData };
            
            localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updatedUser));
            setUser(updatedUser);
            
            return { success: true };
        } catch (error) {
            console.error('Error updating user:', error);
            return { success: false, error: 'Failed to update user data' };
        }
    }, []);

    // Get current token (useful for API calls)
    const getToken = useCallback(() => {
        return token;
    }, [token]);

    // Check if user is authenticated
    const checkAuth = useCallback(() => {
        if (!token) return false;
        return !checkTokenExpiration(token);
    }, [token]);

    // Clear auth error
    const clearError = useCallback(() => {
        setAuthError(null);
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (tokenRefreshTimeoutRef.current) {
                clearTimeout(tokenRefreshTimeoutRef.current);
            }
        };
    }, []);

    const value = {
        // State
        user,
        token,
        isAuthenticated,
        loading,
        authError,
        
        // Methods
        login: handleLogin,
        googleLogin: handleGoogleLogin,
        signup: handleSignup,
        logout: handleLogout,
        updateUser,
        getToken,
        checkAuth,
        clearError,
        refreshToken: refreshAuthToken,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

