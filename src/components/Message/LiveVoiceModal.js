import React, { useState, useEffect } from "react";
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
  transcriptionStatus = null,
  connectionQuality = null,
}) => {
  const [audioLevel, setAudioLevel] = useState(0);

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Simulate audio level for visual feedback (can be replaced with actual audio level from Agora)
  useEffect(() => {
    if (!isActive) {
      setAudioLevel(0);
      return;
    }

    const interval = setInterval(() => {
      // Simulate varying audio levels for visual feedback
      setAudioLevel(Math.random() * 0.7 + 0.3);
    }, 100);

    return () => clearInterval(interval);
  }, [isActive]);

  const getConnectionQualityLabel = () => {
    if (!connectionQuality) return "Good";
    if (connectionQuality >= 4) return "Excellent";
    if (connectionQuality >= 3) return "Good";
    if (connectionQuality >= 2) return "Fair";
    return "Poor";
  };

  const getConnectionQualityColor = () => {
    if (!connectionQuality) return "#1DB954";
    if (connectionQuality >= 4) return "#1DB954";
    if (connectionQuality >= 3) return "#FFA500";
    if (connectionQuality >= 2) return "#FF6B6B";
    return "#FF4444";
  };

  const getTranscriptionStatusDisplay = () => {
    if (!transcriptionStatus) {
      // Default: assume transcription is active if live voice is active
      return isActive
        ? { status: "active", text: "Transcription Active", color: "#1DB954" }
        : null;
    }

    switch (transcriptionStatus.toLowerCase()) {
      case "active":
      case "connected":
        return {
          status: "active",
          text: "Transcription Active",
          color: "#1DB954",
        };
      case "connecting":
      case "pending":
        return {
          status: "connecting",
          text: "Transcription Connecting...",
          color: "#FFA500",
        };
      case "error":
      case "failed":
        return {
          status: "error",
          text: "Transcription Error",
          color: "#FF4444",
        };
      case "disconnected":
      case "inactive":
        return {
          status: "inactive",
          text: "Transcription Inactive",
          color: "#666",
        };
      default:
        return {
          status: "active",
          text: "Transcription Active",
          color: "#1DB954",
        };
    }
  };

  const transcriptionInfo = getTranscriptionStatusDisplay();

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
                <>
                  <div className="live-voice-active">
                    <div className="live-voice-ripple"></div>
                    <div className="live-voice-ripple delay-1"></div>
                    <div className="live-voice-ripple delay-2"></div>
                    <i className="fas fa-phone"></i>
                  </div>
                  {/* Audio level visualization */}
                  <div className="live-voice-audio-waves">
                    {[...Array(5)].map((_, i) => (
                      <div
                        key={i}
                        className="live-voice-wave-bar"
                        style={{
                          height: `${audioLevel * (20 + i * 15)}%`,
                          animationDelay: `${i * 0.1}s`,
                        }}
                      />
                    ))}
                  </div>
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
                    className={`fas ${role === "sender" ? "fa-arrow-right" : role === "receiver" ? "fa-arrow-left" : "fa-exchange-alt"}`}
                  ></i>
                  <span>
                    {role === "sender" ? "Sending your voice to" : "Hearing"}:
                    <strong> {friendName}</strong>
                  </span>
                </div>
              )}

              {isActive && duration !== null && (
                <div className="live-voice-duration">
                  <div className="live-voice-duration-icon">
                    <i className="fas fa-clock"></i>
                  </div>
                  <span>{formatDuration(duration)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Connection Quality Indicator */}
          {isActive && (
            <div className="live-voice-connection-quality">
              <div className="connection-quality-header">
                <i
                  className="fas fa-signal"
                  style={{ color: getConnectionQualityColor() }}
                ></i>
                <span>Connection Quality</span>
              </div>
              <div className="connection-quality-bar">
                <div
                  className="connection-quality-fill"
                  style={{
                    width: `${(connectionQuality || 4) * 25}%`,
                    backgroundColor: getConnectionQualityColor(),
                  }}
                ></div>
              </div>
              <span
                className="connection-quality-label"
                style={{ color: getConnectionQualityColor() }}
              >
                {getConnectionQualityLabel()}
              </span>
            </div>
          )}

          <div className="live-voice-details">
            <div className="live-voice-detail-item">
              <div className="detail-icon">
                <i className="fas fa-info-circle"></i>
              </div>
              <div className="detail-content">
                <span className="detail-label">Mode</span>
                <span className="detail-value">
                  {role === "sender"
                    ? "Two-way live voice"
                    : role === "receiver"
                      ? "Two-way live voice"
                      : "Two-way live voice"}
                </span>
              </div>
            </div>

            <div className="live-voice-detail-item">
              <div className="detail-icon">
                <i className="fas fa-network-wired"></i>
              </div>
              <div className="detail-content">
                <span className="detail-label">Connection</span>
                <span className="detail-value">
                  {isActive
                    ? "Active"
                    : isConnecting
                      ? "Connecting"
                      : "Disconnected"}
                </span>
              </div>
            </div>

            {/* Transcription Status */}
            {transcriptionInfo && (
              <div className="live-voice-detail-item transcription-status">
                <div className="detail-icon">
                  <i
                    className="fas fa-file-alt"
                    style={{ color: transcriptionInfo.color }}
                  ></i>
                </div>
                <div className="detail-content">
                  <span className="detail-label">Transcription</span>
                  <span
                    className="detail-value transcription-status-value"
                    style={{ color: transcriptionInfo.color }}
                  >
                    <span
                      className="transcription-status-dot"
                      style={{ backgroundColor: transcriptionInfo.color }}
                    ></span>
                    {transcriptionInfo.text}
                  </span>
                </div>
              </div>
            )}
          </div>

          {(isActive || isConnecting) && typeof onStop === "function" && (
            <div className="live-voice-actions">
              {role === "receiver" && isActive && !microphoneEnabled && typeof onEnableMicrophone === "function" && (
                <button
                  className="live-voice-microphone-btn"
                  onClick={onEnableMicrophone}
                  disabled={microphonePending}
                >
                  <i className={`fas ${microphonePending ? "fa-circle-notch fa-spin" : "fa-microphone"}`}></i>
                  <span>{microphonePending ? "Turning on microphone..." : "Turn on microphone"}</span>
                </button>
              )}
              <button className="live-voice-stop-btn" onClick={onStop}>
                <i className="fas fa-stop"></i>
                <span>
                  {role === "sender" ? "Stop Live Voice" : "Leave Live Voice"}
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    </ModalContainer>
  );
};

export default LiveVoiceModal;
