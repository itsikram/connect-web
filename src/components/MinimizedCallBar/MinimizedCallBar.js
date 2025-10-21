import React from 'react';
import { useCallMinimize } from '../../contexts/CallMinimizeContext';
import UserPP from '../UserPP';
import './MinimizedCallBar.scss';

const MinimizedCallBar = () => {
    const { minimizedCalls, restoreCall, endMinimizedCall, updateMinimizedCall } = useCallMinimize();

    if (minimizedCalls.length === 0) {
        return null;
    }

    const handleRestore = (callId) => {
        const call = minimizedCalls.find(c => c.id === callId);
        if (call && call.onRestore) {
            call.onRestore();
        }
        restoreCall(callId);
    };

    const handleEnd = (callId) => {
        const call = minimizedCalls.find(c => c.id === callId);
        if (call && call.onEnd) {
            call.onEnd();
        }
        endMinimizedCall(callId);
    };

    const handleMute = (callId) => {
        const call = minimizedCalls.find(c => c.id === callId);
        if (call && call.onToggleMute) {
            const newMutedState = !call.isMuted;
            call.onToggleMute();
            updateMinimizedCall(callId, { isMuted: newMutedState });
        }
    };

    const handleCamera = (callId) => {
        const call = minimizedCalls.find(c => c.id === callId);
        if (call && call.onToggleCamera) {
            const newCameraState = !call.isCameraOn;
            call.onToggleCamera();
            updateMinimizedCall(callId, { isCameraOn: newCameraState });
        }
    };

    const formatDuration = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="minimized-call-bar">
            {minimizedCalls.map((call) => (
                <div key={call.id} className={`minimized-call-item ${call.type}`}>
                    <div className="call-info" onClick={() => handleRestore(call.id)}>
                        <div className="caller-avatar">
                            {call.callerProfilePic ? (
                                <UserPP 
                                    profilePic={call.callerProfilePic} 
                                    hasStory={false} 
                                    profile={call.callerId}
                                    size="small"
                                />
                            ) : (
                                <div className="default-avatar">
                                    <i className="fas fa-user"></i>
                                </div>
                            )}
                        </div>
                        <div className="call-details">
                            <span className="caller-name">{call.callerName}</span>
                            <div className="call-status">
                                <span className={`status-indicator ${call.status}`}></span>
                                <span className="status-text">
                                    {call.status === 'connected' && call.duration ? 
                                        formatDuration(call.duration) : 
                                        call.status
                                    }
                                </span>
                                {call.type === 'video' && (
                                    <i className="fas fa-video call-type-icon"></i>
                                )}
                                {call.type === 'audio' && (
                                    <i className="fas fa-phone call-type-icon"></i>
                                )}
                            </div>
                        </div>
                    </div>
                    
                    <div className="call-controls">
                        {call.status === 'connected' && (
                            <>
                                {call.type === 'video' && (
                                    <button 
                                        className={`control-btn camera-btn ${!call.isCameraOn ? 'disabled' : ''}`}
                                        onClick={() => handleCamera(call.id)}
                                        title={call.isCameraOn ? 'Turn off camera' : 'Turn on camera'}
                                    >
                                        <i className={`fas ${call.isCameraOn ? 'fa-video' : 'fa-video-slash'}`}></i>
                                    </button>
                                )}
                                <button 
                                    className={`control-btn mic-btn ${call.isMuted ? 'disabled' : ''}`}
                                    onClick={() => handleMute(call.id)}
                                    title={call.isMuted ? 'Unmute' : 'Mute'}
                                >
                                    <i className={`fas ${call.isMuted ? 'fa-microphone-slash' : 'fa-microphone'}`}></i>
                                </button>
                            </>
                        )}
                        <button 
                            className="control-btn end-btn"
                            onClick={() => handleEnd(call.id)}
                            title="End call"
                        >
                            <i className="fas fa-phone-slash"></i>
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default MinimizedCallBar;
