/**
 * Audio Unlock Utility
 * Unlocks audio playback on first user interaction to allow background audio
 */

let audioUnlocked = false;
let audioContext = null;
let unlockAudioElement = null;

/**
 * Unlock audio by playing a silent sound on first user interaction
 * This allows audio to play even when the tab is not focused
 */
export const unlockAudio = () => {
    if (audioUnlocked) return Promise.resolve();

    return new Promise((resolve) => {
        // Create a silent audio element
        if (!unlockAudioElement) {
            unlockAudioElement = document.createElement('audio');
            unlockAudioElement.preload = 'auto';
            // Create a valid silent audio data URL (100ms of silence at 44.1kHz, 16-bit, mono)
            // Generate a proper WAV file with valid headers and sample data
            const sampleRate = 44100;
            const duration = 0.1; // 100ms
            const numSamples = Math.floor(sampleRate * duration);
            const numChannels = 1;
            const bitsPerSample = 16;
            const bytesPerSample = bitsPerSample / 8;
            const dataSize = numSamples * numChannels * bytesPerSample;
            
            // WAV file structure
            const buffer = new ArrayBuffer(44 + dataSize);
            const view = new DataView(buffer);
            
            // RIFF header
            const writeString = (offset, string) => {
                for (let i = 0; i < string.length; i++) {
                    view.setUint8(offset + i, string.charCodeAt(i));
                }
            };
            
            writeString(0, 'RIFF');
            view.setUint32(4, 36 + dataSize, true); // File size - 8
            writeString(8, 'WAVE');
            
            // fmt chunk
            writeString(12, 'fmt ');
            view.setUint32(16, 16, true); // fmt chunk size
            view.setUint16(20, 1, true); // Audio format (PCM)
            view.setUint16(22, numChannels, true);
            view.setUint32(24, sampleRate, true);
            view.setUint32(28, sampleRate * numChannels * bytesPerSample, true); // Byte rate
            view.setUint16(32, numChannels * bytesPerSample, true); // Block align
            view.setUint16(34, bitsPerSample, true);
            
            // data chunk
            writeString(36, 'data');
            view.setUint32(40, dataSize, true);
            // Data is already zeros (silence) since ArrayBuffer initializes to 0
            
            // Convert to base64
            const bytes = new Uint8Array(buffer);
            let binary = '';
            for (let i = 0; i < bytes.length; i++) {
                binary += String.fromCharCode(bytes[i]);
            }
            const base64 = btoa(binary);
            const silentAudio = `data:audio/wav;base64,${base64}`;
            
            unlockAudioElement.src = silentAudio;
            unlockAudioElement.volume = 0.01; // Very quiet but not silent
        }

        // Try to play the silent audio
        const playPromise = unlockAudioElement.play();
        
        if (playPromise !== undefined) {
            playPromise
                .then(() => {
                    audioUnlocked = true;
                    console.log('Audio unlocked successfully');
                    unlockAudioElement.pause();
                    unlockAudioElement.currentTime = 0;
                    resolve();
                })
                .catch((error) => {
                    console.warn('Audio unlock failed:', error);
                    // Still mark as attempted
                    audioUnlocked = true;
                    resolve();
                });
        } else {
            audioUnlocked = true;
            resolve();
        }
    });
};

/**
 * Initialize audio unlock on first user interaction
 */
export const initializeAudioUnlock = () => {
    if (audioUnlocked) return;

    const unlockOnInteraction = () => {
        unlockAudio().then(() => {
            // Remove listeners after successful unlock
            document.removeEventListener('click', unlockOnInteraction);
            document.removeEventListener('touchstart', unlockOnInteraction);
            document.removeEventListener('keydown', unlockOnInteraction);
        });
    };

    // Listen for any user interaction
    document.addEventListener('click', unlockOnInteraction, { once: true });
    document.addEventListener('touchstart', unlockOnInteraction, { once: true });
    document.addEventListener('keydown', unlockOnInteraction, { once: true });
};

/**
 * Check if audio is unlocked
 */
export const isAudioUnlocked = () => audioUnlocked;

/**
 * Create or get Web Audio API context (for more reliable background playback)
 */
export const getAudioContext = () => {
    if (!audioContext) {
        try {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (AudioContextClass) {
                audioContext = new AudioContextClass();
                // Resume context if suspended (required by some browsers)
                if (audioContext.state === 'suspended') {
                    audioContext.resume();
                }
            }
        } catch (error) {
            console.warn('Web Audio API not available:', error);
        }
    }
    return audioContext;
};

/**
 * Play audio using Web Audio API (more reliable for background playback)
 */
export const playAudioWithWebAudio = async (audioElement) => {
    const context = getAudioContext();
    if (!context) {
        // Fallback to regular audio play
        return audioElement.play();
    }

    try {
        // Resume context if suspended
        if (context.state === 'suspended') {
            await context.resume();
        }

        // For background playback, we just ensure the context is active
        // and then use regular audio element play
        // Note: Creating MediaElementSource multiple times causes errors,
        // so we use regular play which works better with unlocked audio
        return audioElement.play();
    } catch (error) {
        console.warn('Web Audio context resume failed, falling back to regular audio:', error);
        return audioElement.play();
    }
};

// Auto-initialize on module load
if (typeof window !== 'undefined') {
    initializeAudioUnlock();
}

