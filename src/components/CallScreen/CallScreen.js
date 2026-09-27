import React from "react";
import { createPortal } from "react-dom";
import config from "../../config/config.json";
import "./CallScreen.css";

// WhatsApp / Messenger style full-screen call UI shared by AudioCall and
// VideoCall. It is purely presentational: every action is a callback and the
// video containers are passed in as refs so Agora can render into them.

const Icon = ({ name, size = 26 }) => {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  };
  switch (name) {
    case "phone":
      return (
        <svg {...common} fill="currentColor" stroke="none">
          <path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z" />
        </svg>
      );
    case "end":
      return (
        <svg {...common} fill="currentColor" stroke="none">
          <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08a.96.96 0 0 1 0-1.36C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.72a.96.96 0 0 1 0 1.36l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.1-.7-.28a11.3 11.3 0 0 0-2.67-1.85.99.99 0 0 1-.56-.9v-3.1A15 15 0 0 0 12 9z" />
        </svg>
      );
    case "video":
      return (
        <svg {...common}>
          <path d="M23 7l-7 5 7 5V7z" />
          <rect x="1" y="5" width="15" height="14" rx="2" />
        </svg>
      );
    case "video-off":
      return (
        <svg {...common}>
          <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10" />
          <line x1="1" y1="1" x2="23" y2="23" />
        </svg>
      );
    case "mic":
      return (
        <svg {...common}>
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="23" />
          <line x1="8" y1="23" x2="16" y2="23" />
        </svg>
      );
    case "mic-off":
      return (
        <svg {...common}>
          <line x1="1" y1="1" x2="23" y2="23" />
          <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
          <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
          <line x1="12" y1="19" x2="12" y2="23" />
          <line x1="8" y1="23" x2="16" y2="23" />
        </svg>
      );
    case "flip":
      return (
        <svg {...common}>
          <path d="M20 7h-3l-2-3H9L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z" />
          <path d="M9 13.5a3 3 0 0 1 5.2-2" />
          <path d="M15 12.5a3 3 0 0 1-5.2 2" />
          <polyline points="14.5 9.5 14.5 11.5 12.5 11.5" />
          <polyline points="9.5 16.5 9.5 14.5 11.5 14.5" />
        </svg>
      );
    case "minimize":
      return (
        <svg {...common}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      );
    case "expand":
      return (
        <svg {...common}>
          <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
        </svg>
      );
    case "filter":
      return (
        <svg {...common}>
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
        </svg>
      );
    case "lock":
      return (
        <svg {...common}>
          <rect x="3" y="11" width="18" height="11" rx="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      );
    default:
      return null;
  }
};

const ControlButton = ({ icon, label, onClick, active, danger, disabled }) => (
  <button
    type="button"
    className={`cs-ctrl${active ? " is-active" : ""}${danger ? " is-danger" : ""}`}
    onClick={onClick}
    disabled={disabled}
    aria-label={label}
    title={label}
  >
    <Icon name={icon} size={danger ? 30 : 24} />
  </button>
);

export const formatCallDuration = (seconds) => {
  const total = Math.max(0, Math.floor(seconds || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
};

/**
 * phase: "incoming" | "outgoing" | "connecting" | "connected" | "ended"
 */
const CallScreen = ({
  open,
  type = "audio",
  phase,
  name,
  avatar,
  statusText,
  reconnecting = false,
  muted = false,
  cameraOn = true,
  hasCamera = true,
  remoteVideoOn = false,
  remoteVideoRef,
  localVideoRef,
  remoteVideoClassName = "",
  localVideoClassName = "",
  localPreviewVisible = false,
  onAccept,
  onDecline,
  onEnd,
  onToggleMute,
  onToggleCamera,
  onSwitchCamera,
  onToggleFilter,
  filterActive = false,
  onMinimize,
  onToggleFullscreen,
  children,
}) => {
  const isVideo = type === "video";
  const avatarSrc = avatar || config?.defaultProfile;
  const showVideoStage = isVideo && phase === "connected" && remoteVideoOn;
  const incoming = phase === "incoming";
  const ended = phase === "ended";
  const inCall = phase === "connecting" || phase === "connected";

  const screen = (
    <div
      className={`cs-root cs-${type} cs-phase-${phase}${open ? " is-open" : ""}${
        showVideoStage ? " has-remote-video" : ""
      }`}
      role="dialog"
      aria-modal="true"
      aria-label={`${isVideo ? "Video" : "Audio"} call with ${name || "contact"}`}
      style={open ? undefined : { display: "none" }}
    >
      <div
        className="cs-backdrop"
        style={{ backgroundImage: `url("${avatarSrc}")` }}
        aria-hidden="true"
      />
      <div className="cs-backdrop-shade" aria-hidden="true" />

      {isVideo && (
        <div
          ref={remoteVideoRef}
          className={`cs-remote-video ${remoteVideoClassName}`}
          style={{ visibility: showVideoStage ? "visible" : "hidden" }}
          data-video-type="connect-remote-video"
        />
      )}

      {isVideo && (
        <div
          ref={localVideoRef}
          className={`cs-local-video ${localVideoClassName}${
            phase === "connected" ? " is-pip" : " is-preview"
          }`}
          style={{
            visibility:
              localPreviewVisible && cameraOn && !ended ? "visible" : "hidden",
          }}
          data-video-type="my-local-video"
        />
      )}

      <div className="cs-top">
        <div className="cs-top-left">
          {onMinimize && inCall && (
            <button
              type="button"
              className="cs-icon-btn"
              onClick={onMinimize}
              aria-label="Minimize call"
              title="Minimize"
            >
              <Icon name="minimize" size={22} />
            </button>
          )}
        </div>
        <div className="cs-caption">
          <Icon name="lock" size={12} />
          <span>Connect {isVideo ? "video" : "voice"} call</span>
        </div>
        <div className="cs-top-right">
          {onToggleFullscreen && inCall && (
            <button
              type="button"
              className="cs-icon-btn"
              onClick={onToggleFullscreen}
              aria-label="Toggle full screen"
              title="Full screen"
            >
              <Icon name="expand" size={20} />
            </button>
          )}
        </div>
      </div>

      <div className="cs-identity">
        <h2 className="cs-name">{name || "Unknown"}</h2>
        <p className={`cs-status${reconnecting ? " is-warning" : ""}`}>
          {reconnecting ? "Reconnecting…" : statusText}
        </p>
      </div>

      {!showVideoStage && !(isVideo && localPreviewVisible && !ended && phase !== "connected") && (
        <div className="cs-avatar-wrap">
          <div className={`cs-avatar${phase === "incoming" || phase === "outgoing" ? " is-ringing" : ""}`}>
            <img
              src={avatarSrc}
              alt=""
              onError={(e) => {
                if (config?.defaultProfile && e.currentTarget.src !== config.defaultProfile) {
                  e.currentTarget.src = config.defaultProfile;
                }
              }}
            />
          </div>
        </div>
      )}

      {children && <div className="cs-extra">{children}</div>}

      <div className="cs-bottom">
        {incoming && (
          <div className="cs-incoming-actions">
            <div className="cs-action">
              <button
                type="button"
                className="cs-big-btn is-decline"
                onClick={onDecline}
                aria-label="Decline"
              >
                <Icon name="end" size={32} />
              </button>
              <span>Decline</span>
            </div>
            <div className="cs-action">
              <button
                type="button"
                className="cs-big-btn is-accept"
                onClick={onAccept}
                aria-label="Accept"
              >
                <Icon name={isVideo ? "video" : "phone"} size={30} />
              </button>
              <span>Accept</span>
            </div>
          </div>
        )}

        {!incoming && !ended && (
          <div className="cs-controls">
            {isVideo && onSwitchCamera && (
              <ControlButton
                icon="flip"
                label="Switch camera"
                onClick={onSwitchCamera}
                disabled={!hasCamera || !cameraOn}
              />
            )}
            {isVideo && onToggleCamera && (
              <ControlButton
                icon={cameraOn ? "video" : "video-off"}
                label={cameraOn ? "Turn camera off" : "Turn camera on"}
                onClick={onToggleCamera}
                active={!cameraOn}
                disabled={!hasCamera}
              />
            )}
            {isVideo && onToggleFilter && phase === "connected" && (
              <ControlButton
                icon="filter"
                label="Video filter"
                onClick={onToggleFilter}
                active={filterActive}
              />
            )}
            {onToggleMute && (
              <ControlButton
                icon={muted ? "mic-off" : "mic"}
                label={muted ? "Unmute" : "Mute"}
                onClick={onToggleMute}
                active={muted}
              />
            )}
            <ControlButton icon="end" label="End call" onClick={onEnd} danger />
          </div>
        )}
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(screen, document.body);
};

export default CallScreen;
