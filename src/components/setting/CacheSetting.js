import React, { useState } from 'react';
import { showSuccessToast, showErrorToast } from '../../utils/toastUtils';

const CacheSetting = () => {
    const [isClearing, setIsClearing] = useState(false);

    const handleClearCache = async () => {
        setIsClearing(true);
        try {
            // Clear various types of cache
            if ('caches' in window) {
                const cacheNames = await caches.keys();
                await Promise.all(
                    cacheNames.map(cacheName => caches.delete(cacheName))
                );
            }

            // Clear localStorage (optional - you might want to be selective)
            // localStorage.clear();

            // Clear sessionStorage
            sessionStorage.clear();

            // Clear IndexedDB (if used)
            if ('indexedDB' in window) {
                indexedDB.databases().then(databases => {
                    databases.forEach(db => {
                        if (db.name) {
                            indexedDB.deleteDatabase(db.name);
                        }
                    });
                });
            }

            showSuccessToast('Browser cache cleared successfully!');
            
            // Optionally reload the page after clearing cache
            setTimeout(() => {
                window.location.reload();
            }, 1500);
        } catch (error) {
            console.error('Error clearing cache:', error);
            showErrorToast('Failed to clear cache. Please try again.');
        } finally {
            setIsClearing(false);
        }
    };

    return (
        <>
            <div className='profile-setting'>
                <div className='setting-field-container'>
                    <h3>Browser Cache</h3>
                    <p className="setting-section-desc">Clear stored data if pages look outdated or something feels stuck.</p>
                    <div className="form-group mb-4">
                        <p className="mb-3">
                            Clear your browser cache to free up space and potentially resolve loading issues. 
                            This will clear cached files, session storage, and other browser data.
                        </p>
                        <p className="text-muted small mb-3">
                            Note: After clearing the cache, the page will reload automatically.
                        </p>
                    </div>
                    <button 
                        onClick={handleClearCache} 
                        type="button" 
                        className="btn btn-primary"
                        disabled={isClearing}
                    >
                        {isClearing ? 'Clearing Cache...' : 'Clear Browser Cache'}
                    </button>
                </div>
            </div>
        </>
    );
};

export default CacheSetting;

