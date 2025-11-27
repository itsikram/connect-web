/**
 * Configuration validation utility
 * Ensures all required environment variables are present
 * Provides fallbacks for offline/local development
 */

import { getServerAddress } from './offlineUtils';

export const validateConfig = () => {
    const warnings = [];

    // Check for common configuration issues
    if (process.env.REACT_APP_SERVER_ADDR) {
        try {
            new URL(process.env.REACT_APP_SERVER_ADDR);
        } catch (error) {
            warnings.push('REACT_APP_SERVER_ADDR appears to be an invalid URL');
        }
    }

    // Warn if REACT_APP_SERVER_ADDR is missing, but don't fail (fallback will be used)
    if (!process.env.REACT_APP_SERVER_ADDR) {
        const fallbackUrl = getServerAddress();
        warnings.push(`REACT_APP_SERVER_ADDR not set, using fallback: ${fallbackUrl}`);
        console.warn('ℹ️ Using fallback server address for offline/local development');
    }

    if (warnings.length > 0) {
        warnings.forEach(warning => {
            console.warn('⚠️ Configuration warning:', warning);
        });
    }

    return {
        isValid: true, // Always valid now, with fallbacks
        warnings
    };
};

// Auto-validate on import in development
if (process.env.NODE_ENV === 'development') {
    validateConfig();
}

export default validateConfig;
