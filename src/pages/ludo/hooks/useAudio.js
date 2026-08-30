import { useState, useEffect, useCallback, useRef } from 'react';
import { unlockAudio, playTone, resumeAudioFromGesture } from '../../../utils/audioUnlock';

const SOUND_CONFIGS = {
    diceRoll: { frequency: 400, duration: 0.2, type: 'sine', volume: 0.45 },
    pieceMove: { frequency: 300, duration: 0.15, type: 'sine', volume: 0.4 },
    capture: { frequency: 200, duration: 0.3, type: 'square', volume: 0.5 },
    win: { frequency: 600, duration: 0.5, type: 'sine', volume: 0.6 },
    turnChange: { frequency: 350, duration: 0.2, type: 'sine', volume: 0.4 },
    buttonClick: { frequency: 500, duration: 0.1, type: 'sine', volume: 0.35 },
    pieceOut: { frequency: 450, duration: 0.25, type: 'sine', volume: 0.45 }
};

export const useAudio = () => {
    const [soundsEnabled, setSoundsEnabled] = useState(true);
    const soundRefs = useRef({
        diceRoll: null,
        pieceMove: null,
        capture: null,
        win: null,
        turnChange: null,
        buttonClick: null,
        pieceOut: null
    });

    useEffect(() => {
        if (typeof window === 'undefined') return;

        soundRefs.current = {
            diceRoll: null,
            pieceMove: null,
            capture: null,
            win: null,
            turnChange: null,
            buttonClick: null,
            pieceOut: null
        };

        resumeAudioFromGesture();
        unlockAudio().catch(() => {});

        const resumeOnForeground = () => {
            if (document.visibilityState === 'hidden') return;
            resumeAudioFromGesture();
        };
        document.addEventListener('visibilitychange', resumeOnForeground);
        window.addEventListener('pageshow', resumeOnForeground);
        window.addEventListener('focus', resumeOnForeground);

        return () => {
            document.removeEventListener('visibilitychange', resumeOnForeground);
            window.removeEventListener('pageshow', resumeOnForeground);
            window.removeEventListener('focus', resumeOnForeground);
        };
    }, []);

    const playSound = useCallback((soundType, options = {}) => {
        if (!soundsEnabled) return;
        resumeAudioFromGesture();
        const config = SOUND_CONFIGS[soundType] || SOUND_CONFIGS.buttonClick;
        playTone({ ...config, ...options }).catch(() => {});
    }, [soundsEnabled]);

    return { soundsEnabled, setSoundsEnabled, playSound };
};
