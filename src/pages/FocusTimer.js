import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

const FocusTimer = () => {
    const [minutes, setMinutes] = useState(25);
    const [seconds, setSeconds] = useState(0);
    const [isRunning, setIsRunning] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [sessionType, setSessionType] = useState('focus'); // focus, short, long
    const [completedSessions, setCompletedSessions] = useState(0);
    const intervalRef = useRef(null);

    // Load completed sessions from localStorage
    useEffect(() => {
        const saved = localStorage.getItem('timerCompletedSessions');
        if (saved) {
            setCompletedSessions(parseInt(saved, 10) || 0);
        }
    }, []);

    // Save completed sessions to localStorage
    useEffect(() => {
        localStorage.setItem('timerCompletedSessions', completedSessions.toString());
    }, [completedSessions]);

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

    const handleTimerComplete = () => {
        setIsRunning(false);
        setIsPaused(false);
        if (sessionType === 'focus') {
            setCompletedSessions(prev => prev + 1);
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
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center'
    };

    const headerStyle = {
        position: 'absolute',
        top: '24px',
        left: '24px',
        display: 'flex',
        alignItems: 'center',
        gap: '16px'
    };

    const backButtonStyle = {
        padding: '8px 16px',
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '8px',
        color: '#E5E7EB',
        textDecoration: 'none',
        fontSize: '14px',
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
        gap: '48px',
        maxWidth: '600px',
        width: '100%'
    };

    const statsStyle = {
        display: 'flex',
        gap: '24px',
        alignItems: 'center'
    };

    const statItemStyle = {
        textAlign: 'center'
    };

    const statValueStyle = {
        fontSize: '32px',
        fontWeight: 700,
        background: 'linear-gradient(135deg, #F59E0B, #F97316)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        marginBottom: '4px'
    };

    const statLabelStyle = {
        fontSize: '14px',
        opacity: 0.7
    };

    const timerCircleStyle = {
        width: '300px',
        height: '300px',
        borderRadius: '50%',
        background: `conic-gradient(from 0deg, #F59E0B 0% ${progress}%, rgba(255,255,255,0.1) ${progress}% 100%)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        boxShadow: '0 8px 32px rgba(245,158,11,0.2)'
    };

    const timerInnerStyle = {
        width: '260px',
        height: '260px',
        borderRadius: '50%',
        background: 'linear-gradient(180deg, #0B1220 0%, #0F172A 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px'
    };

    const timeDisplayStyle = {
        fontSize: '56px',
        fontWeight: 700,
        fontFamily: 'monospace',
        letterSpacing: '4px'
    };

    const sessionTypeStyle = {
        fontSize: '14px',
        opacity: 0.7,
        textTransform: 'uppercase',
        letterSpacing: '2px'
    };

    const controlsStyle = {
        display: 'flex',
        gap: '12px',
        flexWrap: 'wrap',
        justifyContent: 'center'
    };

    const buttonStyle = {
        padding: '12px 28px',
        border: 'none',
        borderRadius: '12px',
        fontSize: '16px',
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
        gap: '12px',
        flexWrap: 'wrap',
        justifyContent: 'center'
    };

    const presetButtonStyle = {
        padding: '10px 24px',
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '8px',
        color: '#E5E7EB',
        fontSize: '14px',
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