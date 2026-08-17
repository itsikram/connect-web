import React from "react";
import { motion } from "framer-motion";

const ModalHeader = ({ onClose, onMenuToggle, isSidebarOpen }) => {
  return (
    <div className="ai-agent-modal-header">
      {/* ── Single compact row ─────────────────────────────────────── */}
      <div className="ai-agent-header-row">
        {/* Hamburger — visible only on mobile, hidden on desktop */}
        <button
          className="ai-agent-menu-btn"
          onClick={onMenuToggle}
          aria-label={isSidebarOpen ? "Close menu" : "Open menu"}
        >
          <i className={`fas ${isSidebarOpen ? "fa-times" : "fa-bars"}`} />
        </button>

        {/* Animated brain icon */}
        <motion.div
          className="ai-agent-icon"
          animate={{ y: [0, -4, 0] }}
          transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
        >
          <i className="fas fa-brain" />
        </motion.div>

        {/* Title block */}
        <div className="ai-agent-header-text">
          <h2 className="ai-agent-title">AI Agent</h2>
          <div className="ai-agent-status-bar">
            <span className="ai-agent-status-indicator" />
            <span className="ai-agent-status-text">Ready to assist</span>
          </div>
        </div>

        {/* Close button */}
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
