import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/api';
import { showErrorToast } from '../utils/toastUtils';
import { openCreatePost } from '../utils/openComposer';

const FocusTimer = () => {
    const navigate = useNavigate();
    const [justCompleted, setJustCompleted] = useState(false);
    const [minutes, setMinutes] = useState(25);
    const [seconds, setSeconds] = useState(0);
    const [isRunning, setIsRunning] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [sessionType, setSessionType] = useState('focus'); // focus, short, long
    const [completedSessions, setCompletedSessions] = useState(0);
    const intervalRef = useRef(null);

    // Load completed sessions from API
    useEffect(() => {
        loadTimerSession();
    }, []);

    const loadTimerSession = async () => {
        try {
            const response = await api.get('/timer');
            if (response.data.success) {
                setCompletedSessions(response.data.session?.completedSessions || 0);
            }
        } catch (error) {
            console.error('Error loading timer session:', error);
        }
    };

    // Timer presets
    const presets = {
        focus: { minutes: 25, seconds: 0, label: 'Focus' },
        short: { minutes: 5, seconds: 0, label: 'Short Break' },
        long: { minutes: 15, seconds: 0, label: 'Long Break' }
    };

    useEffect(() => {
        if (isRunning && !isPaused) {
            intervalRef.current = setInterval(() => {
                setSeconds((prev) => {
                    if (prev === 0) {
                        setMinutes((prevMin) => {
                            if (prevMin === 0) {
                                // Timer completed
                                handleTimerComplete();
                                return 0;
                            }
                            return prevMin - 1;
                        });
                        return 59;
                    }
                    return prev - 1;
                });
            }, 1000);
        } else {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        }

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [isRunning, isPaused]);



    const handleTimerComplete = async () => {
        setIsRunning(false);
        setIsPaused(false);
        setJustCompleted(true);
        if (sessionType === 'focus') {
            try {
                const response = await api.post('/timer/update', {
                    sessionType: 'focus'
                });
                if (response.data.success) {
                    setCompletedSessions(response.data.session?.completedSessions || 0);
                }
            } catch (error) {
                console.error('Error updating timer session:', error);
                showErrorToast('Failed to save session');
            }
        }
        // Play notification sound or show alert
        if (window.Notification && Notification.permission === 'granted') {
            new Notification('Timer Complete!', {
                body: `${presets[sessionType].label} session finished.`
            });
        }
    };

    const handleStart = () => {
        setIsRunning(true);
        setIsPaused(false);
        setJustCompleted(false);
    };

    const handlePause = () => {
        setIsPaused(true);
    };

    const handleResume = () => {
        setIsPaused(false);
    };

    const handleStop = () => {
        setIsRunning(false);
        setIsPaused(false);
        const preset = presets[sessionType];
        setMinutes(preset.minutes);
        setSeconds(preset.seconds);
    };

    const handlePresetSelect = (type) => {
        if (isRunning) {
            if (!window.confirm('Timer is running. Do you want to reset?')) {
                return;
            }
        }
        setSessionType(type);
        const preset = presets[type];
        setMinutes(preset.minutes);
        setSeconds(preset.seconds);
        setIsRunning(false);
        setIsPaused(false);
    };

    // Request notification permission
    useEffect(() => {
        if (window.Notification && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }, []);

    const totalSeconds = minutes * 60 + seconds;
    const progress = (() => {
        const preset = presets[sessionType];
        const totalPresetSeconds = preset.minutes * 60 + preset.seconds;
        return ((totalPresetSeconds - totalSeconds) / totalPresetSeconds) * 100;
    })();

    const formatTime = (mins, secs) => {
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    };

    const pageStyle = {
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #0B1220 0%, #0F172A 100%)',
        color: '#E5E7EB',
        padding: 'clamp(12px, 3vw, 24px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center'
    };

    const headerStyle = {
        position: 'absolute',
        top: 'clamp(12px, 3vw, 24px)',
        left: 'clamp(12px, 3vw, 24px)',
        display: 'flex',
        alignItems: 'center',
        gap: 'clamp(12px, 3vw, 16px)'
    };

    const backButtonStyle = {
        padding: 'clamp(6px, 1.5vw, 8px) clamp(12px, 3vw, 16px)',
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '8px',
        color: '#E5E7EB',
        textDecoration: 'none',
        fontSize: 'clamp(12px, 3vw, 14px)',
        fontWeight: 500,
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        transition: 'all 0.2s'
    };

    const containerStyle = {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 'clamp(24px, 6vw, 48px)',
        maxWidth: '600px',
        width: '100%'
    };

    const statsStyle = {
        display: 'flex',
        gap: 'clamp(16px, 4vw, 24px)',
        alignItems: 'center'
    };

    const statItemStyle = {
        textAlign: 'center'
    };

    const statValueStyle = {
        fontSize: 'clamp(24px, 6vw, 32px)',
        fontWeight: 700,
        background: 'linear-gradient(135deg, #F59E0B, #F97316)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        marginBottom: '4px'
    };

    const statLabelStyle = {
        fontSize: 'clamp(12px, 3vw, 14px)',
        opacity: 0.7
    };

    const timerCircleStyle = {
        width: 'clamp(200px, 40vw, 300px)',
        height: 'clamp(200px, 40vw, 300px)',
        borderRadius: '50%',
        background: `conic-gradient(from 0deg, #F59E0B 0% ${progress}%, rgba(255,255,255,0.1) ${progress}% 100%)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        boxShadow: '0 8px 32px rgba(245,158,11,0.2)'
    };

    const timerInnerStyle = {
        width: 'clamp(170px, 34vw, 260px)',
        height: 'clamp(170px, 34vw, 260px)',
        borderRadius: '50%',
        background: 'linear-gradient(180deg, #0B1220 0%, #0F172A 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px'
    };

    const timeDisplayStyle = {
        fontSize: 'clamp(36px, 8vw, 56px)',
        fontWeight: 700,
        fontFamily: 'monospace',
        letterSpacing: 'clamp(2px, 0.5vw, 4px)'
    };

    const sessionTypeStyle = {
        fontSize: 'clamp(12px, 3vw, 14px)',
        opacity: 0.7,
        textTransform: 'uppercase',
        letterSpacing: 'clamp(1px, 0.25vw, 2px)'
    };

    const controlsStyle = {
        display: 'flex',
        gap: 'clamp(8px, 2vw, 12px)',
        flexWrap: 'wrap',
        justifyContent: 'center'
    };

    const buttonStyle = {
        padding: 'clamp(10px, 2.5vw, 12px) clamp(20px, 5vw, 28px)',
        border: 'none',
        borderRadius: '12px',
        fontSize: 'clamp(14px, 3.5vw, 16px)',
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'all 0.2s'
    };

    const primaryButtonStyle = {
        ...buttonStyle,
        background: 'linear-gradient(135deg, #F59E0B, #F97316)',
        color: '#ffffff'
    };

    const secondaryButtonStyle = {
        ...buttonStyle,
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        color: '#E5E7EB'
    };

    const dangerButtonStyle = {
        ...buttonStyle,
        background: 'rgba(239,68,68,0.2)',
        border: '1px solid rgba(239,68,68,0.3)',
        color: '#EF4444'
    };

    const presetsStyle = {
        display: 'flex',
        gap: 'clamp(8px, 2vw, 12px)',
        flexWrap: 'wrap',
        justifyContent: 'center'
    };

    const presetButtonStyle = {
        padding: 'clamp(8px, 2vw, 10px) clamp(16px, 4vw, 24px)',
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '8px',
        color: '#E5E7EB',
        fontSize: 'clamp(12px, 3vw, 14px)',
        fontWeight: 500,
        cursor: 'pointer',
        transition: 'all 0.2s'
    };

    const presetButtonActiveStyle = {
        ...presetButtonStyle,
        background: 'linear-gradient(135deg, #F59E0B, #F97316)',
        borderColor: 'transparent',
        color: '#ffffff'
    };

    return (
        <div style={pageStyle}>
            <div style={headerStyle}>
                <Link to="/menu" style={backButtonStyle}>
                    ← Back
                </Link>
            </div>

            <div style={containerStyle}>
                <div style={statsStyle}>
                    <div style={statItemStyle}>
                        <div style={statValueStyle}>{completedSessions}</div>
                        <div style={statLabelStyle}>Sessions Completed</div>
                    </div>
                </div>

                <div style={timerCircleStyle}>
                    <div style={timerInnerStyle}>
                        <div style={timeDisplayStyle}>
                            {formatTime(minutes, seconds)}
                        </div>
                        <div style={sessionTypeStyle}>
                            {presets[sessionType].label}
                        </div>
                    </div>
                </div>

                <div style={controlsStyle}>
                    {!isRunning && !isPaused && (
                        <button onClick={handleStart} style={primaryButtonStyle}>
                            Start
                        </button>
                    )}
                    {isRunning && !isPaused && (
                        <button onClick={handlePause} style={secondaryButtonStyle}>
                            Pause
                        </button>
                    )}
                    {isPaused && (
                        <>
                            <button onClick={handleResume} style={primaryButtonStyle}>
                                Resume
                            </button>
                            <button onClick={handleStop} style={dangerButtonStyle}>
                                Stop
                            </button>
                        </>
                    )}
                    {isRunning && !isPaused && (
                        <button onClick={handleStop} style={dangerButtonStyle}>
                            Stop
                        </button>
                    )}
                </div>

                {justCompleted && (
                    <div style={{
                        marginTop: 16,
                        padding: 12,
                        borderRadius: 12,
                        background: 'rgba(0, 212, 255, 0.08)',
                        border: '1px solid rgba(0, 212, 255, 0.2)',
                        textAlign: 'center',
                    }}>
                        <div style={{ marginBottom: 8, fontWeight: 600 }}>
                            {presets[sessionType].label} session finished.
                        </div>
                        <button
                            type="button"
                            style={primaryButtonStyle}
                            onClick={() =>
                                openCreatePost({
                                    caption: `I finished a ${presets[sessionType].label.toLowerCase()} session on Connect.`,
                                    audience: 2,
                                    navigate,
                                })
                            }
                        >
                            Share
                        </button>
                    </div>
                )}

                <div style={presetsStyle}>
                    {Object.keys(presets).map((type) => (
                        <button
                            key={type}
                            onClick={() => handlePresetSelect(type)}
                            style={sessionType === type ? presetButtonActiveStyle : presetButtonStyle}
                            disabled={isRunning && !isPaused}
                        >
                            {presets[type].label}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default FocusTimer;