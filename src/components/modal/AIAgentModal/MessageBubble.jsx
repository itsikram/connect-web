import React from 'react';
import { motion } from 'framer-motion';

const MessageBubble = ({ message }) => {
  const isUser = message.type === 'user';

  return (
    <motion.div
      className={`ai-agent-message ${isUser ? 'user-message' : 'agent-message'}`}
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 100 }}
    >
      <div className={`ai-agent-bubble ${isUser ? 'user-bubble' : 'agent-bubble'}`}>
        {!isUser && (
          <div className="agent-avatar">
            <i className="fas fa-brain"></i>
          </div>
        )}

        <div className="message-content">
          <p>{message.content}</p>

          {!isUser && message.action && (
            <div className="suggested-action">
              <span className="action-label">Suggested: {message.action}</span>
            </div>
          )}

          <span className="message-time">
            {message.timestamp.toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: true,
            })}
          </span>
        </div>

        {isUser && (
          <div className="user-avatar">
            <i className="fas fa-user-circle"></i>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default MessageBubble;
