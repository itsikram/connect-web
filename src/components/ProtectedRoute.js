import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import config from '../config/config.json';

/**
 * ProtectedRoute component
 * Protects routes by checking authentication status
 * Redirects to login if user is not authenticated
 */
const ProtectedRoute = ({ children }) => {
    const { isAuthenticated, loading, checkAuth } = useAuth();
    const location = useLocation();

    // Show loading state while checking authentication
    if (loading) {
        return (
            <div id="site-loader">
                <div className="loader-logo-container">
                    <img src={config?.logo} alt="C" />
                </div>
                {/* <LoadingSpinner size="medium" color="primary" text="Checking authentication..." /> */}
            </div>
        );
    }

    // Check authentication
    const isAuth = checkAuth();
    
    // If not authenticated, redirect to login immediately
    if (!isAuthenticated || !isAuth) {
        console.log('🔒 Not authenticated, redirecting to login');
        const redirectPath = location.pathname + location.search;
        return <Navigate to="/login" replace state={{ from: redirectPath }} />;
    }

    // Only render children if authenticated
    return <>{children}</>;
}

export default ProtectedRoute;

