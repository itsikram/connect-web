/**
 * Configuration validation utility
 * Ensures all required environment variables are present
 */

export const validateConfig = () => {
    const requiredEnvVars = [
        'REACT_APP_SERVER_ADDR'
    ];

    const missingVars = [];
    const warnings = [];

    // Check required environment variables
    requiredEnvVars.forEach(varName => {
        if (!process.env[varName]) {
            missingVars.push(varName);
        }
    });

    // Check for common configuration issues
    if (process.env.REACT_APP_SERVER_ADDR) {
        try {
            new URL(process.env.REACT_APP_SERVER_ADDR);
        } catch (error) {
            warnings.push('REACT_APP_SERVER_ADDR appears to be an invalid URL');
        }
    }

    // Log errors and warnings
    if (missingVars.length > 0) {
        console.error('❌ Missing required environment variables:', missingVars);
        console.error('Please check your .env file and ensure all required variables are set.');
    }

    if (warnings.length > 0) {
        warnings.forEach(warning => {
            console.warn('⚠️ Configuration warning:', warning);
        });
    }

    return {
        isValid: missingVars.length === 0,
        missingVars,
        warnings
    };
};

// Auto-validate on import in development
if (process.env.NODE_ENV === 'development') {
    validateConfig();
}

export default validateConfig;
