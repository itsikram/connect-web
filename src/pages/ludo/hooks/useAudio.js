import { useState, useEffect, useCallback, useRef } from 'react';
import { unlockAudio } from '../../../utils/audioUnlock';

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
    
    // Initialize audio elements for sound effects
    useEffect(() => {
        if (typeof window === 'undefined') return;
        
        // Initialize sound refs (will be created on-demand)
        soundRefs.current = {
            diceRoll: null,
            pieceMove: null,
            capture: null,
            win: null,
            turnChange: null,
            buttonClick: null,
            pieceOut: null
        };
        
        // Unlock audio on first user interaction
        unlockAudio().catch(() => {});
    }, []);
    
    // Play sound effect helper
    const playSound = useCallback(async (soundType, options = {}) => {
        if (!soundsEnabled) return;
        
        try {
            await unlockAudio();
            
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            if (audioContext.state === 'suspended') {
                await audioContext.resume();
            }
            
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            // Sound configurations
            const soundConfigs = {
                diceRoll: { frequency: 400, duration: 0.2, type: 'sine', volume: 0.3 },
                pieceMove: { frequency: 300, duration: 0.15, type: 'sine', volume: 0.25 },
                capture: { frequency: 200, duration: 0.3, type: 'square', volume: 0.4 },
                win: { frequency: 600, duration: 0.5, type: 'sine', volume: 0.5 },
                turnChange: { frequency: 350, duration: 0.2, type: 'sine', volume: 0.3 },
                buttonClick: { frequency: 500, duration: 0.1, type: 'sine', volume: 0.2 },
                pieceOut: { frequency: 450, duration: 0.25, type: 'sine', volume: 0.35 }
            };
            
            const config = soundConfigs[soundType] || soundConfigs.buttonClick;
            const { frequency, duration, type, volume } = { ...config, ...options };
            
            oscillator.frequency.value = frequency;
            oscillator.type = type;
            
            gainNode.gain.setValueAtTime(volume, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + duration);
            
            // Clean up after sound finishes
            setTimeout(() => {
                try {
                    audioContext.close();
                } catch (e) {
                    // Ignore cleanup errors
                }
            }, duration * 1000 + 100);
        } catch (error) {
            // Silently fail if audio can't be played (e.g., autoplay restrictions)
            console.debug('Sound playback failed:', error);
        }
    }, [soundsEnabled]);
    
    return { soundsEnabled, setSoundsEnabled, playSound };
};
