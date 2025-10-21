import { useEffect, useRef } from 'react';

/**
 * Hook to monitor component performance
 * @param {string} componentName - Name of the component for logging
 * @param {boolean} enabled - Whether to enable monitoring (default: development mode)
 */
export const usePerformanceMonitor = (componentName, enabled = process.env.NODE_ENV === 'development') => {
    const renderStartTime = useRef(null);
    const renderCount = useRef(0);

    useEffect(() => {
        if (!enabled) return;

        renderStartTime.current = performance.now();
        renderCount.current += 1;

        return () => {
            if (renderStartTime.current) {
                const renderTime = performance.now() - renderStartTime.current;
                
                // Log slow renders (>16ms for 60fps)
                if (renderTime > 16) {
                    console.warn(
                        `🐌 Slow render detected in ${componentName}:`,
                        `${renderTime.toFixed(2)}ms (render #${renderCount.current})`
                    );
                } else if (renderTime > 8) {
                    console.log(
                        `⚠️ Moderate render time in ${componentName}:`,
                        `${renderTime.toFixed(2)}ms (render #${renderCount.current})`
                    );
                }
            }
        };
    });

    // Return performance metrics
    return {
        renderCount: renderCount.current,
        isSlowRender: renderStartTime.current ? 
            (performance.now() - renderStartTime.current) > 16 : false
    };
};

export default usePerformanceMonitor;
