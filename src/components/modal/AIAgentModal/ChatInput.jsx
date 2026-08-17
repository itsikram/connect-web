import React, { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";

const SUGGESTIONS = [
  // Navigation
  "Go to settings",
  "Open my profile",
  "Go to messages",
  "Go to friends page",
  "Open watch page",
  "Go to notes",
  "Go to tasks",
  "Open calendar",
  // Social
  "Call [friend name]",
  "Video call [friend name]",
  "Message [friend name]",
  "Bump [friend name]",
  // Profile navigation
  "Go to [friend]'s profile",
  "View [friend]'s friends",
  "See [friend]'s photos",
  "Where is [friend name]?",
  // Settings shortcuts
  "Open account settings",
  "Go to privacy settings",
  "Open notification settings",
  // Games
  "Play Ludo",
  "Invite [friend name] to Ludo",
  "Play Chess",
  // Videos
  "Play [video name]",
  "Play action",
  "Find videos about music",
  "Search for comedy video",
  // Other
  "Block [name]",
  "Unblock [name]",
  "What can you help with?",
];

const ChatInput = ({ value, onChange, onSend, isLoading }) => {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef(null);

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (value.trim()) onSend();
    }
  };

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height =
        Math.min(inputRef.current.scrollHeight, 120) + "px";
    }
  }, [value]);

  const handleSuggestionClick = (s) => {
    // Strip placeholder brackets, position cursor at end
    onChange(s.replace(/\[.*?\]/g, ""));
    setShowSuggestions(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  return (
    <motion.div
      className="ai-agent-chat-input-container"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
    >
      {/* Suggestions */}
      {showSuggestions && !value && (
        <motion.div
          className="ai-agent-suggestions"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
        >
          <p className="suggestions-label">
            <i
              className="fas fa-bolt"
              style={{ marginRight: 5, color: "#f59e0b" }}
            />
            Quick examples:
          </p>
          <div className="suggestions-grid">
            {SUGGESTIONS.map((s, i) => (
              <motion.button
                key={i}
                className="suggestion-chip"
                onClick={() => handleSuggestionClick(s)}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
              >
                {s}
              </motion.button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Input wrapper */}
      <div className={`ai-agent-input-wrapper ${isFocused ? "focused" : ""}`}>
        <textarea
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyPress={handleKeyPress}
          onFocus={() => {
            setIsFocused(true);
            setShowSuggestions(true);
          }}
          onBlur={() => {
            setIsFocused(false);
            setTimeout(() => setShowSuggestions(false), 200);
          }}
          placeholder="Try: 'go to settings', 'call John', 'open my profile'…"
          className="ai-agent-input"
          rows="1"
          disabled={isLoading}
        />

        <div className="ai-agent-input-actions">
          <motion.button
            className="ai-agent-send-btn"
            onClick={() => value.trim() && onSend()}
            disabled={!value.trim() || isLoading}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            type="button"
          >
            {isLoading ? (
              <i className="fas fa-circle-notch fa-spin" />
            ) : (
              <i className="fas fa-paper-plane" />
            )}
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
};

export default ChatInput;
