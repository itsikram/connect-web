import React, { useState } from 'react';
import { showSuccessToast, showErrorToast } from '../../utils/toastUtils';
import { SAVED_VIDEO_DB_NAME } from '../../utils/useSavedVideos';

// Databases holding the user's own content, not cache. Never cleared here.
const PRESERVED_DATABASES = new Set([SAVED_VIDEO_DB_NAME]);

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

            // Clear IndexedDB caches, keeping saved (downloaded) videos.
            if ('indexedDB' in window && typeof indexedDB.databases === 'function') {
                try {
                    const databases = await indexedDB.databases();
                    await Promise.all(
                        databases
                            .filter((db) => db?.name && !PRESERVED_DATABASES.has(db.name))
                            .map((db) => new Promise((resolve) => {
                                const request = indexedDB.deleteDatabase(db.name);
                                request.onsuccess = resolve;
                                request.onerror = resolve;
                                request.onblocked = resolve;
                            })),
                    );
                } catch (error) {
                    console.warn('Failed to clear IndexedDB:', error);
                }
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
                            Your saved videos are kept.
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

