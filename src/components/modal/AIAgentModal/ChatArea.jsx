import React from "react";
import { motion } from "framer-motion";
import MessageBubble from "./MessageBubble";
import ChatInput from "./ChatInput";

// Same eight starters as the Connect mobile app.
const CAPABILITIES = [
  { icon: "fa-comment-dots", title: "Messages", prompt: "Open my messages", tint: "#3B82F6" },
  { icon: "fa-video", title: "Calls", prompt: "Start a video call", tint: "#10B981" },
  { icon: "fa-pen", title: "Post", prompt: "Create a post with a funny caption", tint: "#F59E0B" },
  { icon: "fa-tasks", title: "Tasks", prompt: "What are my open tasks?", tint: "#8B5CF6" },
  { icon: "fa-play-circle", title: "YouTube", prompt: "Search YouTube for lo-fi music", tint: "#EF4444" },
  { icon: "fa-gamepad", title: "Games", prompt: "Start a Ludo game", tint: "#14B8A6" },
  { icon: "fa-calendar-alt", title: "Plan", prompt: "Add an event tomorrow at 10:00: team meeting", tint: "#EC4899" },
  { icon: "fa-bell", title: "Updates", prompt: "Any new notifications?", tint: "#0EA5E9" },
];

const StartScreen = ({ bn, onTapToTalk, onPrompt, disabled, speechSupported }) => (
  <div className="xa-empty">
    <div className="xa-orb xa-hero-orb" aria-hidden="true">
      <i className="fas fa-magic" />
    </div>
    <h3 className="xa-hero-title">
      {bn ? "কী করতে পারি?" : "What can I do for you?"}
    </h3>
    <p className="xa-hero-subtitle">
      {bn
        ? "বলুন বা লিখুন — আমি Connect-এ কাজগুলো করে দেব।"
        : "Type or speak — I can run actions across Connect for you."}
    </p>
    <button
      type="button"
      className="xa-hero-talk"
      onClick={onTapToTalk}
      disabled={!speechSupported}
      aria-label={bn ? "কথা বলতে চাপুন" : "Tap to talk"}
    >
      <span className="xa-orb xa-hero-talk-circle">
        <i className="fas fa-microphone" />
      </span>
      <span className="xa-hero-talk-label">
        {bn ? "কথা বলতে চাপুন" : "Tap to talk"}
      </span>
      <span className="xa-hero-talk-hint">
        {bn ? "বাংলা বা ইংরেজি — যেভাবে খুশি বলুন" : "Speak in Bangla or English"}
      </span>
    </button>
    <div className="xa-capability-grid">
      {CAPABILITIES.map((capability) => (
        <button
          key={capability.title}
          type="button"
          className="xa-capability-card"
          disabled={disabled}
          onClick={() => onPrompt(capability.prompt)}
        >
          <span
            className="xa-capability-icon"
            style={{ background: `${capability.tint}1F`, color: capability.tint }}
          >
            <i className={`fas ${capability.icon}`} />
          </span>
          <span className="xa-capability-title">{capability.title}</span>
          <span className="xa-capability-prompt">{capability.prompt}</span>
        </button>
      ))}
    </div>
  </div>
);

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
  onStartTalk,
  onInterruptSpeech,
  onStop,
  isSpeaking = false,
  speechSupported = true,
  onPlayVideo,
  onDownloadYoutube,
  isFreshChat = false,
  runningLabel = "",
  bn = false,
}) => {
  const lastStreaming = Boolean(messages[messages.length - 1]?.streaming);

  return (
    <div className="ai-agent-chat-area">
      <div
        className={`ai-agent-messages-container${isFreshChat ? " is-empty" : ""}`}
      >
        {isFreshChat ? (
          <StartScreen
            bn={bn}
            onTapToTalk={onStartTalk}
            onPrompt={(prompt) => onSendMessage(prompt)}
            disabled={isLoading}
            speechSupported={speechSupported}
          />
        ) : (
          messages.map((msg) => (
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
          ))
        )}

        {(isLoading || runningLabel) && !lastStreaming && (
          <div className="xa-row">
            <div className="xa-orb xa-avatar" aria-hidden="true">
              <i className="fas fa-magic" />
            </div>
            <div className="xa-bubble xa-bubble-agent">
              {runningLabel ? (
                <span className="xa-running">
                  <i className="fas fa-circle-notch fa-spin" />
                  {runningLabel}…
                </span>
              ) : (
                <span className="xa-typing" aria-label="Thinking">
                  <span />
                  <span />
                  <span />
                </span>
              )}
            </div>
          </div>
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
        onStartTalk={onStartTalk}
        onInterruptSpeech={onInterruptSpeech}
        onStop={onStop}
        isSpeaking={isSpeaking}
        speechSupported={speechSupported}
        runningLabel={runningLabel}
        bn={bn}
      />
    </div>
  );
};

export default ChatArea;
