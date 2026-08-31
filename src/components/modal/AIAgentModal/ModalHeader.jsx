import React from "react";
import { motion } from "framer-motion";

const ModalHeader = ({
  onClose,
  onMenuToggle,
  isSidebarOpen,
  autoRunActions,
  onToggleAutoRun,
  onOpenSettings,
  onClearChat,
  canClearChat = false,
  settingsOpen = false,
  providerLabel = "Gemini",
  modelLabel = "",
}) => {
  return (
    <div className="ai-agent-modal-header">
      <div className="ai-agent-header-row">
        <button
          className="ai-agent-menu-btn"
          onClick={onMenuToggle}
          aria-label={isSidebarOpen ? "Close menu" : "Open menu"}
        >
          <i className={`fas ${isSidebarOpen ? "fa-times" : "fa-bars"}`} />
        </button>

        <motion.div
          className="ai-agent-icon"
          animate={{ y: [0, -4, 0] }}
          transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
        >
          <i className="fas fa-brain" />
        </motion.div>

        <div className="ai-agent-header-text">
          <h2 className="ai-agent-title">AI Agent</h2>
          <div className="ai-agent-status-bar">
            <span className="ai-agent-status-indicator" />
            <span className="ai-agent-status-text">
              {providerLabel}
              {modelLabel ? ` · ${modelLabel}` : ""}
            </span>
          </div>
        </div>

        <label
          className="ai-agent-auto-run-toggle"
          title="Automatically run single-match actions without needing a button click"
        >
          <input
            type="checkbox"
            checked={autoRunActions}
            onChange={onToggleAutoRun}
            aria-label="Toggle auto-run actions"
          />
          <span className="ai-agent-auto-run-slider" />
          <span className="ai-agent-auto-run-label">Auto-run</span>
        </label>

        <button
          className="ai-agent-settings-btn-header"
          onClick={onClearChat}
          aria-label="Clear chat"
          title="Clear chat"
          type="button"
          disabled={!canClearChat}
        >
          <i className="fas fa-trash-alt" />
        </button>

        <button
          className={`ai-agent-settings-btn-header ${settingsOpen ? "active" : ""}`}
          onClick={onOpenSettings}
          aria-label="AI Agent settings"
          title="AI provider, model, and API keys"
          type="button"
        >
          <i className="fas fa-cog" />
        </button>

        <button
          className="ai-agent-close-btn"
          onClick={onClose}
          aria-label="Close"
        >
          <i className="fas fa-times" />
        </button>
      </div>
    </div>
  );
};

export default ModalHeader;
