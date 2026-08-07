import config from '../config/config.json';
import ringtones from '../config/ringtones.json';
import { normalizeRingtoneId } from './normalizeRingtoneId';

/**
 * Audio Preloader Service
 * Preloads all notification sounds and ringtones on window load
 * to ensure they're ready to play even when tab is not focused
 */
class AudioPreloader {
    constructor() {
        this.audioCache = new Map(); // Store preloaded audio elements
        this.preloadingInProgress = false;
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

        if (this.preloadingInProgress && this.preloadPromise) {
            return this.preloadPromise;
        }

        this.preloadingInProgress = true;
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
            this.preloadingInProgress = false;
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
            
            let timeoutId;
            let isResolved = false;
            
            // Set up event handlers
            const handleCanPlay = () => {
                if (isResolved) return;
                isResolved = true;
                clearTimeout(timeoutId);
                audio.removeEventListener('canplaythrough', handleCanPlay);
                audio.removeEventListener('error', handleError);
                audio.removeEventListener('abort', handleError);
                audio.removeEventListener('loadstart', handleLoadStart);
                this.audioCache.set(src, audio);
                console.log(`✅ Preloaded: ${src}`);
                resolve(audio);
            };

            const handleError = (error) => {
                if (isResolved) return;
                isResolved = true;
                clearTimeout(timeoutId);
                audio.removeEventListener('canplaythrough', handleCanPlay);
                audio.removeEventListener('error', handleError);
                audio.removeEventListener('abort', handleError);
                audio.removeEventListener('loadstart', handleLoadStart);
                
                // Don't log timeout as error since it's expected behavior
                if (error.message !== 'Preload timeout') {
                    console.warn(`⚠️ Failed to preload: ${src}`, error);
                }
                
                // Still cache it so we can try to use it later
                this.audioCache.set(src, audio);
                resolve(audio);
            };

            const handleLoadStart = () => {
                console.log(`🔄 Loading: ${src}`);
            };

            audio.addEventListener('canplaythrough', handleCanPlay, { once: true });
            audio.addEventListener('error', handleError, { once: true });
            audio.addEventListener('abort', handleError, { once: true });
            audio.addEventListener('loadstart', handleLoadStart, { once: true });

            // Set source and start loading
            audio.src = src;
            audio.load();

            // Increase timeout to 30 seconds and handle it gracefully
            timeoutId = setTimeout(() => {
                if (!isResolved && !this.audioCache.has(src)) {
                    // Check if audio has started loading (readyState > 0)
                    if (audio.readyState > 0) {
                        console.log(`⏱️ Audio loading in progress: ${src} (readyState: ${audio.readyState})`);
                        // Consider it successful if it has started loading
                        handleCanPlay();
                    } else {
                        console.log(`⏱️ Preload timeout for: ${src} - will load on demand`);
                        handleError(new Error('Preload timeout'));
                    }
                }
            }, 30000); // Increased from 10 to 30 seconds
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
        const normalizedId = normalizeRingtoneId(ringtoneId);

        const ringtone = ringtones.find(r => r.id === normalizedId);
        if (ringtone?.src) {
            src = ringtone.src;
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
            // Ensure audio is ready, but don't block too long
            if (audio.readyState < 2) {
                try {
                    await new Promise((resolve, reject) => {
                        const timeout = setTimeout(() => {
                            // Don't reject on timeout - audio might still be playable
                            // Just resolve and try to play anyway
                            resolve();
                        }, 5000); // Increased from 2 to 5 seconds
                        
                        const handleCanPlay = () => {
                            clearTimeout(timeout);
                            resolve();
                        };
                        
                        const handleError = () => {
                            clearTimeout(timeout);
                            reject(new Error('Load error'));
                        };
                        
                        // If already loaded enough, resolve immediately
                        if (audio.readyState >= 2) {
                            clearTimeout(timeout);
                            resolve();
                            return;
                        }
                        
                        audio.addEventListener('canplaythrough', handleCanPlay, { once: true });
                        audio.addEventListener('canplay', handleCanPlay, { once: true }); // Also listen for canplay as fallback
                        audio.addEventListener('error', handleError, { once: true });
                        
                        // If audio hasn't started loading, trigger load
                        if (audio.readyState === 0) {
                            audio.load();
                        }
                    });
                } catch (loadError) {
                    // If load fails, still try to play - might work
                    console.warn('Audio load warning (will still attempt playback):', loadError);
                }
            }

            audio.currentTime = 0;
            audio.muted = false;
            audio.volume = 1.0;
            
            // Try to play
            await audio.play();
        } catch (error) {
            // Only log if it's not a timeout (timeout is handled gracefully above)
            if (error.message !== 'Timeout') {
                console.warn('Failed to play notification sound:', error);
            }
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

    /**
     * Check if preloading is in progress
     */
    get isPreloading() {
        return this.preloadingInProgress;
    }
}

// Create singleton instance
const audioPreloader = new AudioPreloader();

// Auto-start preloading on module load (when window is available)
if (typeof window !== 'undefined') {
    // Function to start preloading
    const startPreloading = () => {
        // Add a small delay to ensure page is fully rendered
        setTimeout(() => {
            audioPreloader.preloadAll().catch(err => console.warn('Audio preload error:', err));
        }, 1000);
    };

    // Start preloading on first user interaction (most reliable)
    const handleUserInteraction = () => {
        if (!audioPreloader.isReady() && !audioPreloader.isPreloading) {
            console.log('🎵 Starting audio preload on user interaction');
            startPreloading();
        }
        // Remove listeners after first interaction
        document.removeEventListener('click', handleUserInteraction);
        document.removeEventListener('touchstart', handleUserInteraction);
        document.removeEventListener('keydown', handleUserInteraction);
    };

    // Add user interaction listeners
    document.addEventListener('click', handleUserInteraction, { once: true });
    document.addEventListener('touchstart', handleUserInteraction, { once: true });
    document.addEventListener('keydown', handleUserInteraction, { once: true });

    // Also try to preload on page load (fallback)
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        // Already loaded, start preloading after a delay
        console.log('🎵 Page loaded, starting audio preload');
        startPreloading();
    } else {
        // Wait for window load
        window.addEventListener('load', () => {
            console.log('🎵 Window loaded, starting audio preload');
            startPreloading();
        }, { once: true });
    }
}

export default audioPreloader;
