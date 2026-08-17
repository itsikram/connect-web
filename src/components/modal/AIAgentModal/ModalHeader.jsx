import React from "react";
import { motion } from "framer-motion";

const ModalHeader = ({ onClose }) => {
  return (
    <motion.div
      className="ai-agent-modal-header"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
    >
      <div className="ai-agent-header-content">
        <div className="ai-agent-header-title">
          <div className="ai-agent-icon">
            <i className="fas fa-brain"></i>
          </div>
          <div>
            <h2>AI Agent Assistant</h2>
            <p className="ai-agent-subtitle">Powered by Gemini 3.5 Flash</p>
          </div>
        </div>
        <button
          className="ai-agent-close-btn"
          onClick={onClose}
          aria-label="Close modal"
        >
          <i className="fas fa-times"></i>
        </button>
      </div>
      <div className="ai-agent-status-bar">
        <span className="ai-agent-status-indicator"></span>
        <span className="ai-agent-status-text">Ready to assist</span>
      </div>
    </motion.div>
  );
};

export default ModalHeader;
