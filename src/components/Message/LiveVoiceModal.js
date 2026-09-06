import React from "react";
import ModalContainer from "../modal/ModalContainer";
import "./LiveVoiceModal.css";

const LiveVoiceModal = ({
  isOpen,
  onClose,
  isActive,
  duration,
  isConnecting,
  role,
  friendName,
  onStop,
  onEnableMicrophone,
  microphoneEnabled = false,
  microphonePending = false,
  connectionQuality = 4,
}) => {
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  const quality = connectionQuality || 4;
  const qualityLabel =
    quality >= 4 ? "Excellent" : quality >= 3 ? "Good" : quality >= 2 ? "Fair" : "Poor";
  const qualityColor =
    quality >= 4 ? "#1DB954" : quality >= 3 ? "#FFA500" : quality >= 2 ? "#FF6B6B" : "#FF4444";

  return (
    <ModalContainer
      isOpen={isOpen}
      onRequestClose={onClose}
      title="Live Voice Transfer"
      size="sm"
    >
      <div className="live-voice-modal">
        <div className="live-voice-modal-header">
          <div className="live-voice-header-content">
            <div className="live-voice-header-icon">
              <i className="fas fa-microphone-alt"></i>
            </div>
            <h3>Live Voice Transfer</h3>
          </div>
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
                  <div className="live-voice-spinner-ring"></div>
                  <i className="fas fa-phone"></i>
                </div>
              ) : isActive ? (
                <div className="live-voice-active">
                  <div className="live-voice-ripple"></div>
                  <div className="live-voice-ripple delay-1"></div>
                  <div className="live-voice-ripple delay-2"></div>
                  <i className="fas fa-phone"></i>
                </div>
              ) : (
                <div className="live-voice-inactive">
                  <i className="fas fa-phone-slash"></i>
                </div>
              )}
            </div>

            <div className="live-voice-info">
              <div className="live-voice-status-text">
                {isConnecting ? (
                  <span className="status-connecting">
                    <i className="fas fa-circle-notch fa-spin"></i>
                    Connecting...
                  </span>
                ) : isActive ? (
                  <span className="status-active">
                    <i className="fas fa-circle"></i>
                    Live Voice Active
                  </span>
                ) : (
                  <span className="status-inactive">
                    <i className="fas fa-circle"></i>
                    Inactive
                  </span>
                )}
              </div>

              {friendName && (
                <div className="live-voice-participant">
                  <i
                    className={`fas ${
                      role === "sender"
                        ? "fa-arrow-right"
                        : role === "receiver"
                          ? "fa-arrow-left"
                          : "fa-exchange-alt"
                    }`}
                  ></i>
                  <span>
                    {role === "sender" ? "Sending your voice to" : "Hearing"}:
                    <strong> {friendName}</strong>
                  </span>
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

          {role === "receiver" && isActive && !microphoneEnabled && typeof onEnableMicrophone === "function" && (
            <button
              className="live-voice-microphone-btn"
              onClick={onEnableMicrophone}
              disabled={microphonePending}
            >
              <i
                className={`fas ${microphonePending ? "fa-circle-notch fa-spin" : "fa-microphone"}`}
              ></i>
              <span>
                {microphonePending ? "Turning on microphone..." : "Turn on microphone"}
              </span>
            </button>
          )}

          {isActive && (
            <div className="live-voice-connection-quality">
              <div className="connection-quality-header">
                <i
                  className="fas fa-signal"
                  style={{ color: qualityColor }}
                ></i>
                <span>Connection Quality</span>
              </div>
              <div className="connection-quality-bar">
                <div
                  className="connection-quality-fill"
                  style={{
                    width: `${quality * 25}%`,
                    backgroundColor: qualityColor,
                  }}
                ></div>
              </div>
              <span
                className="connection-quality-label"
                style={{ color: qualityColor }}
              >
                {qualityLabel}
              </span>
            </div>
          )}

          <div className="live-voice-details">
            <div className="live-voice-detail-item">
              <div className="detail-icon">
                <i className="fas fa-info-circle"></i>
              </div>
              <div className="detail-content">
                <span className="detail-text">Two-way live voice</span>
              </div>
            </div>

            <div className="live-voice-detail-item">
              <div className="detail-icon">
                <i className="fas fa-network-wired"></i>
              </div>
              <div className="detail-content">
                <span className="detail-text">
                  Connection: {isActive ? "Active" : isConnecting ? "Connecting" : "Disconnected"}
                </span>
              </div>
            </div>
          </div>

          {(isActive || isConnecting) && typeof onStop === "function" && (
            <button className="live-voice-stop-btn" onClick={onStop}>
              <i className="fas fa-stop"></i>
              <span>
                {role === "sender" ? "Stop Live Voice" : "Leave Live Voice"}
              </span>
            </button>
          )}
        </div>
      </div>
    </ModalContainer>
  );
};

export default LiveVoiceModal;
