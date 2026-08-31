import React from "react";
import { motion } from "framer-motion";
import MessageBubble from "./MessageBubble";
import ChatInput from "./ChatInput";

const ChatArea = ({
  messages,
  isLoading,
  onSendMessage,
  inputValue,
  onInputChange,
  messagesEndRef,
  userProfilePic,
  autoRunActions,
  modalInteractionVersion,
  liveTalkOn = false,
  onToggleLiveTalk,
  onInterruptSpeech,
  isSpeaking = false,
  speechSupported = true,
  onPlayVideo,
  onDownloadYoutube,
}) => {
  const lastStreaming = Boolean(messages[messages.length - 1]?.streaming);

  return (
    <div className="ai-agent-chat-area">
      <div className="ai-agent-messages-container">
        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={msg.streaming ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.08 }}
          >
            <MessageBubble
              message={msg}
              userProfilePic={userProfilePic}
              onPlayVideo={onPlayVideo}
              onDownloadYoutube={onDownloadYoutube}
            />
          </motion.div>
        ))}

        {isLoading && !lastStreaming && (
          <motion.div
            className="ai-agent-typing-indicator"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="typing-dot" />
            <div className="typing-dot" />
            <div className="typing-dot" />
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <ChatInput
        value={inputValue}
        onChange={onInputChange}
        onSend={onSendMessage}
        isLoading={isLoading && !lastStreaming}
        isStreaming={lastStreaming}
        autoRunActions={autoRunActions}
        modalInteractionVersion={modalInteractionVersion}
        liveTalkOn={liveTalkOn}
        onToggleLiveTalk={onToggleLiveTalk}
        onInterruptSpeech={onInterruptSpeech}
        isSpeaking={isSpeaking}
        speechSupported={speechSupported}
      />
    </div>
  );
};

export default ChatArea;
