import React from 'react';
import { motion } from 'framer-motion';
import MessageBubble from './MessageBubble';
import ChatInput from './ChatInput';

const ChatArea = ({
  messages,
  isLoading,
  onSendMessage,
  inputValue,
  onInputChange,
  messagesEndRef,
}) => {
  return (
    <div className="ai-agent-chat-area">
      <div className="ai-agent-messages-container">
        {messages.map((msg, index) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <MessageBubble message={msg} />
          </motion.div>
        ))}

        {isLoading && (
          <motion.div
            className="ai-agent-typing-indicator"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="typing-dot"></div>
            <div className="typing-dot"></div>
            <div className="typing-dot"></div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <ChatInput
        value={inputValue}
        onChange={onInputChange}
        onSend={onSendMessage}
        isLoading={isLoading}
      />
    </div>
  );
};

export default ChatArea;
