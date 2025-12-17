import React from 'react';
import ModalContainer from '../modal/ModalContainer';
import './LiveVoiceModal.css';

const LiveVoiceModal = ({ isOpen, onClose, isActive, duration, isConnecting, role, friendName, onStop }) => {
    const formatDuration = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <ModalContainer
            isOpen={isOpen}
            onRequestClose={onClose}
            title="Live Voice Transfer"
            style={{ maxWidth: '400px' }}
        >
            <div className="live-voice-modal">
                <div className="live-voice-modal-header">
                    <h3>Live Voice Transfer</h3>
                    <button 
                        className="live-voice-close-btn"
                        onClick={onClose}
                        aria-label="Close"
                    >
                        <i className="fas fa-times"></i>
                    </button>
                </div>
                
                <div className="live-voice-modal-content">
                    <div className="live-voice-status-container">
                        <div className="live-voice-icon-container">
                            {isConnecting ? (
                                <div className="live-voice-connecting">
                                    <i className="fas fa-spinner fa-spin"></i>
                                </div>
                            ) : isActive ? (
                                <>
                                    <div className="live-voice-active">
                                        <i className="fas fa-phone"></i>
                                    </div>
                                    <span className="live-voice-pulse"></span>
                                </>
                            ) : (
                                <div className="live-voice-inactive">
                                    <i className="fas fa-phone-slash"></i>
                                </div>
                            )}
                        </div>
                        
                        <div className="live-voice-info">
                            <div className="live-voice-status-text">
                                {isConnecting ? (
                                    <span className="status-connecting">Connecting...</span>
                                ) : isActive ? (
                                    <span className="status-active">Live Voice Active</span>
                                ) : (
                                    <span className="status-inactive">Inactive</span>
                                )}
                            </div>
                            
                            {friendName && (
                                <div className="live-voice-participant">
                                    {role === 'sender' ? (
                                        <span>Transferring to: <strong>{friendName}</strong></span>
                                    ) : (
                                        <span>Receiving from: <strong>{friendName}</strong></span>
                                    )}
                                </div>
                            )}
                            
                            {isActive && duration !== null && (
                                <div className="live-voice-duration">
                                    <i className="fas fa-clock"></i>
                                    <span>{formatDuration(duration)}</span>
                                </div>
                            )}
                        </div>
                    </div>
                    
                    <div className="live-voice-details">
                        <div className="live-voice-detail-item">
                            <i className="fas fa-info-circle"></i>
                            <span>
                                {role === 'sender' 
                                    ? 'Your voice is being transmitted in real-time'
                                    : 'You are receiving live audio'}
                            </span>
                        </div>
                        <div className="live-voice-detail-item">
                            <i className="fas fa-signal"></i>
                            <span>Connection: {isActive ? 'Active' : isConnecting ? 'Connecting' : 'Disconnected'}</span>
                        </div>
                    </div>
                    
                    {role === 'sender' && isActive && (
                        <div className="live-voice-actions">
                            <button 
                                className="live-voice-stop-btn"
                                onClick={onStop}
                            >
                                <i className="fas fa-stop"></i>
                                Stop Live Voice
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </ModalContainer>
    );
};

export default LiveVoiceModal;

