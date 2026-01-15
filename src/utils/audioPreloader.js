import config from '../config/config.json';
import ringtones from '../config/ringtones.json';

/**
 * Audio Preloader Service
 * Preloads all notification sounds and ringtones on window load
 * to ensure they're ready to play even when tab is not focused
 */
class AudioPreloader {
    constructor() {
        this.audioCache = new Map(); // Store preloaded audio elements
        this.isPreloading = false;
        this.preloadComplete = false;
        this.preloadPromise = null;
    }

    /**
     * Preload all audio files
     */
    async preloadAll() {
        if (this.preloadComplete) {
            return Promise.resolve();
        }

        if (this.isPreloading && this.preloadPromise) {
            return this.preloadPromise;
        }

        this.isPreloading = true;
        this.preloadPromise = this._doPreload();
        return this.preloadPromise;
    }

    async _doPreload() {
        const audioFiles = new Set();

        // Add notification sound
        if (config?.defaultNotificationSound) {
            audioFiles.add(config.defaultNotificationSound);
        }

        // Add calling beep
        if (config?.callingBeep) {
            audioFiles.add(config.callingBeep);
        }

        // Add all ringtones
        ringtones.forEach(ringtone => {
            if (ringtone.src) {
                audioFiles.add(ringtone.src);
            }
        });

        console.log('🔊 Preloading audio files:', Array.from(audioFiles));

        const preloadPromises = Array.from(audioFiles).map(src => this._preloadAudio(src));

        try {
            await Promise.allSettled(preloadPromises);
            this.preloadComplete = true;
            console.log('✅ Audio preloading complete');
        } catch (error) {
            console.warn('⚠️ Some audio files failed to preload:', error);
        } finally {
            this.isPreloading = false;
        }
    }

    /**
     * Preload a single audio file
     */
    _preloadAudio(src) {
        return new Promise((resolve, reject) => {
            // Check if already cached
            if (this.audioCache.has(src)) {
                resolve(this.audioCache.get(src));
                return;
            }

            const audio = new Audio();
            audio.preload = 'auto';
            audio.volume = 1.0;
            
            // Set up event handlers
            const handleCanPlay = () => {
                audio.removeEventListener('canplaythrough', handleCanPlay);
                audio.removeEventListener('error', handleError);
                audio.removeEventListener('abort', handleError);
                this.audioCache.set(src, audio);
                console.log(`✅ Preloaded: ${src}`);
                resolve(audio);
            };

            const handleError = (error) => {
                audio.removeEventListener('canplaythrough', handleCanPlay);
                audio.removeEventListener('error', handleError);
                audio.removeEventListener('abort', handleError);
                console.warn(`⚠️ Failed to preload: ${src}`, error);
                // Still cache it so we can try to use it later
                this.audioCache.set(src, audio);
                resolve(audio);
            };

            audio.addEventListener('canplaythrough', handleCanPlay, { once: true });
            audio.addEventListener('error', handleError, { once: true });
            audio.addEventListener('abort', handleError, { once: true });

            // Set source and start loading
            audio.src = src;
            audio.load();

            // Timeout after 10 seconds
            setTimeout(() => {
                if (!this.audioCache.has(src)) {
                    console.warn(`⏱️ Preload timeout for: ${src}`);
                    handleError(new Error('Preload timeout'));
                }
            }, 10000);
        });
    }

    /**
     * Get a preloaded audio element (creates a clone for independent playback)
     */
    getAudio(src) {
        const cached = this.audioCache.get(src);
        if (cached) {
            // Clone the audio element for independent playback
            // This allows multiple simultaneous plays
            const clone = cached.cloneNode();
            clone.src = src;
            clone.volume = cached.volume;
            clone.preload = 'auto';
            return clone;
        }

        // If not preloaded, create a new one (fallback)
        console.warn(`⚠️ Audio not preloaded: ${src}, creating on-demand`);
        const audio = new Audio(src);
        audio.preload = 'auto';
        audio.volume = 1.0;
        return audio;
    }

    /**
     * Get notification sound audio element
     */
    getNotificationSound() {
        const src = config?.defaultNotificationSound;
        if (!src) {
            console.warn('Notification sound not configured');
            return null;
        }
        return this.getAudio(src);
    }

    /**
     * Get ringtone audio element
     */
    getRingtone(ringtoneId = null) {
        let src = config?.callingBeep; // Default fallback

        if (ringtoneId) {
            const ringtone = ringtones.find(r => r.id === ringtoneId);
            if (ringtone?.src) {
                src = ringtone.src;
            }
        }

        if (!src) {
            console.warn('Ringtone not configured');
            return null;
        }

        return this.getAudio(src);
    }

    /**
     * Play notification sound (handles background playback)
     */
    async playNotificationSound() {
        const audio = this.getNotificationSound();
        if (!audio) return;

        try {
            // Ensure audio is ready
            if (audio.readyState < 2) {
                await new Promise((resolve, reject) => {
                    const timeout = setTimeout(() => reject(new Error('Timeout')), 2000);
                    audio.addEventListener('canplaythrough', () => {
                        clearTimeout(timeout);
                        resolve();
                    }, { once: true });
                    audio.addEventListener('error', () => {
                        clearTimeout(timeout);
                        reject(new Error('Load error'));
                    }, { once: true });
                });
            }

            audio.currentTime = 0;
            audio.muted = false;
            audio.volume = 1.0;
            
            // Try to play
            await audio.play();
        } catch (error) {
            console.warn('Failed to play notification sound:', error);
            // Try again when tab becomes visible
            if (error.name === 'NotAllowedError' && document.hidden) {
                const handleVisibilityChange = () => {
                    if (document.visibilityState === 'visible') {
                        audio.play().catch(e => console.warn('Retry play failed:', e));
                        document.removeEventListener('visibilitychange', handleVisibilityChange);
                    }
                };
                document.addEventListener('visibilitychange', handleVisibilityChange);
            }
        }
    }

    /**
     * Check if preloading is complete
     */
    isReady() {
        return this.preloadComplete;
    }
}

// Create singleton instance
const audioPreloader = new AudioPreloader();

// Auto-start preloading on module load (when window is available)
if (typeof window !== 'undefined') {
    // Preload on window load
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        // Already loaded, start preloading immediately
        audioPreloader.preloadAll().catch(err => console.warn('Audio preload error:', err));
    } else {
        // Wait for window load
        window.addEventListener('load', () => {
            audioPreloader.preloadAll().catch(err => console.warn('Audio preload error:', err));
        });
    }

    // Also try to preload on DOMContentLoaded (earlier)
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            audioPreloader.preloadAll().catch(err => console.warn('Audio preload error:', err));
        });
    }
}

export default audioPreloader;
