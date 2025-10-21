import { useState, useCallback } from 'react';
import { showErrorToast } from '../utils/toastUtils';

/**
 * Custom hook for making API calls with built-in error handling and loading states
 * @param {Function} apiFunction - The API function to call
 * @param {Object} options - Configuration options
 */
export const useApiCall = (apiFunction, options = {}) => {
    const {
        showErrorToast: showToast = true,
        errorMessage = 'Something went wrong. Please try again.',
        onSuccess = null,
        onError = null
    } = options;

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [data, setData] = useState(null);

    const execute = useCallback(async (...args) => {
        setLoading(true);
        setError(null);

        try {
            const result = await apiFunction(...args);
            setData(result.data || result);
            
            if (onSuccess) {
                onSuccess(result.data || result);
            }
            
            return result.data || result;
        } catch (err) {
            const errorMsg = err.response?.data?.message || err.message || errorMessage;
            setError(errorMsg);
            
            if (showToast) {
                showErrorToast(errorMsg, {
                    title: 'Error',
                    autoClose: 5000
                });
            }
            
            if (onError) {
                onError(err);
            }
            
            throw err;
        } finally {
            setLoading(false);
        }
    }, [apiFunction, showToast, errorMessage, onSuccess, onError]);

    const reset = useCallback(() => {
        setError(null);
        setData(null);
        setLoading(false);
    }, []);

    return {
        execute,
        loading,
        error,
        data,
        reset
    };
};

export default useApiCall;
