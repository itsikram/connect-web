import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';

const ChatInput = ({ value, onChange, onSend, isLoading }) => {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef(null);

  const suggestions = [
    'What can you help with?',
    'Show recent posts',
    'Find users',
    'Summarize content',
  ];

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (value.trim()) {
        onSend(); // Call with no parameter - will use inputValue from parent
      }
    }
  };

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 100) + 'px';
    }
  }, [value]);

  return (
    <motion.div
      className="ai-agent-chat-input-container"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
    >
      {showSuggestions && !value && (
        <motion.div
          className="ai-agent-suggestions"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
        >
          <p className="suggestions-label">Quick suggestions:</p>
          <div className="suggestions-grid">
            {suggestions.map((suggestion, index) => (
              <motion.button
                key={index}
                className="suggestion-chip"
                onClick={() => {
                  onChange(suggestion);
                  setShowSuggestions(false);
                }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {suggestion}
              </motion.button>
            ))}
          </div>
        </motion.div>
      )}

      <div className={`ai-agent-input-wrapper ${isFocused ? 'focused' : ''}`}>
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
          placeholder="Ask me anything or type a command..."
          className="ai-agent-input"
          rows="1"
          disabled={isLoading}
        />

        <div className="ai-agent-input-actions">
          <motion.button
            className="ai-agent-emoji-btn"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            type="button"
          >
            <i className="fas fa-smile"></i>
          </motion.button>

          <motion.button
            className="ai-agent-send-btn"
            onClick={() => value.trim() && onSend()}
            disabled={!value.trim() || isLoading}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            type="button"
          >
            {isLoading ? (
              <i className="fas fa-circle-notch fa-spin"></i>
            ) : (
              <i className="fas fa-paper-plane"></i>
            )}
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
};

export default ChatInput;
