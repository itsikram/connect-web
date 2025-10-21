import React, { createContext, useContext, useState, useCallback } from 'react';

const CallMinimizeContext = createContext();

export const useCallMinimize = () => {
    const context = useContext(CallMinimizeContext);
    if (!context) {
        throw new Error('useCallMinimize must be used within a CallMinimizeProvider');
    }
    return context;
};

export const CallMinimizeProvider = ({ children }) => {
    const [minimizedCalls, setMinimizedCalls] = useState([]);

    const minimizeCall = useCallback((callData) => {
        setMinimizedCalls(prev => {
            // Remove any existing call with the same id to avoid duplicates
            const filtered = prev.filter(call => call.id !== callData.id);
            return [...filtered, callData];
        });
    }, []);

    const restoreCall = useCallback((callId) => {
        setMinimizedCalls(prev => prev.filter(call => call.id !== callId));
    }, []);

    const endMinimizedCall = useCallback((callId) => {
        setMinimizedCalls(prev => prev.filter(call => call.id !== callId));
    }, []);

    const updateMinimizedCall = useCallback((callId, updates) => {
        setMinimizedCalls(prev => 
            prev.map(call => 
                call.id === callId ? { ...call, ...updates } : call
            )
        );
    }, []);

    const getMinimizedCall = useCallback((callId) => {
        return minimizedCalls.find(call => call.id === callId);
    }, [minimizedCalls]);

    const value = {
        minimizedCalls,
        minimizeCall,
        restoreCall,
        endMinimizedCall,
        updateMinimizedCall,
        getMinimizedCall
    };

    return (
        <CallMinimizeContext.Provider value={value}>
            {children}
        </CallMinimizeContext.Provider>
    );
};

export default CallMinimizeContext;
