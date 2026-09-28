import React from "react";

/**
 * Header + toolbar, laid out like the Connect mobile app's AI Agent:
 * gradient orb, "Connect AI" with a live status line, Auto/Ask pill,
 * speaker, minimize and close; below it the AI provider chip and Clear.
 */
const ModalHeader = ({
  onClose,
  onMinimize,
  autoRunActions,
  onToggleAutoRun,
  speakReplies = false,
  onToggleSpeak,
  onToggleProviderMenu,
  providerMenuOpen = false,
  showProviderCaret = true,
  onClearChat,
  canClearChat = false,
  providerLabel = "Gemini",
  modelLabel = "",
  statusLabel = "Ready",
  statusTone = "ok",
}) => (
  <div className="xa-header-wrap">
    <div className="xa-header">
      <div className="xa-orb xa-header-orb" aria-hidden="true">
        <i className="fas fa-magic" />
      </div>
      <div className="xa-title">
        <h2 className="xa-heading">Connect AI</h2>
        <div className="xa-status-line">
          <span className={`xa-status-dot tone-${statusTone}`} />
          <span className="xa-status-text">{statusLabel}</span>
        </div>
      </div>
      <button
        type="button"
        className={`xa-mode-pill${autoRunActions ? " is-on" : ""}`}
        onClick={onToggleAutoRun}
        role="switch"
        aria-checked={autoRunActions}
        aria-label={`Auto-run actions ${autoRunActions ? "on" : "off"}`}
        title={
          autoRunActions
            ? "Auto: runs actions right away"
            : "Ask: shows actions to confirm first"
        }
      >
        <i className={`fas ${autoRunActions ? "fa-bolt" : "fa-hand-pointer"}`} />
        <span>{autoRunActions ? "Auto" : "Ask"}</span>
      </button>
      <button
        type="button"
        className={`xa-icon-btn${speakReplies ? " is-on" : ""}`}
        onClick={onToggleSpeak}
        aria-label={speakReplies ? "Turn speaking off" : "Turn speaking on"}
        title={speakReplies ? "Speaking on" : "Speaking off"}
      >
        <i className={`fas ${speakReplies ? "fa-volume-up" : "fa-volume-mute"}`} />
      </button>
      <button
        type="button"
        className="xa-icon-btn"
        onClick={onMinimize}
        aria-label="Minimize AI Agent"
        title="Minimize"
      >
        <i className="fas fa-minus" />
      </button>
      <button
        type="button"
        className="xa-icon-btn xa-close"
        onClick={onClose}
        aria-label="Close AI Agent"
        title="Close"
      >
        <i className="fas fa-times" />
      </button>
    </div>
    <div className="xa-toolbar">
      <button
        type="button"
        className={`xa-chip${providerMenuOpen ? " is-active" : ""}`}
        onClick={onToggleProviderMenu}
        aria-expanded={providerMenuOpen}
        aria-label="Select AI provider"
        title={modelLabel ? `${providerLabel} · ${modelLabel}` : providerLabel}
      >
        <i className="fas fa-brain xa-chip-accent" />
        <span>{providerLabel}</span>
        {showProviderCaret ? (
          <i className={`fas ${providerMenuOpen ? "fa-chevron-up" : "fa-chevron-down"} xa-chip-caret`} />
        ) : null}
      </button>
      <span className="xa-flex" />
      <button
        type="button"
        className="xa-chip"
        onClick={onClearChat}
        disabled={!canClearChat}
        aria-label="Clear AI chat"
      >
        <i className="far fa-trash-alt" />
        <span>Clear</span>
      </button>
    </div>
  </div>
);

export default ModalHeader;
