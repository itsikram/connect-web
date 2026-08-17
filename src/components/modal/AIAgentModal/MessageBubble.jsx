import React from "react";
import { motion } from "framer-motion";
import FriendResultCard from "./FriendResultCard";

/**
 * MessageBubble
 *
 * Supports message types:
 *   'user'         – standard user text bubble
 *   'agent'        – standard agent text bubble
 *   'friend-picker'– agent bubble + list of FriendResultCards
 *   'action-result'– agent bubble showing result of an executed action
 */
const MessageBubble = ({ message, userProfilePic }) => {
  const isUser = message.type === "user";
  const isFriendPicker = message.type === "friend-picker";
  const isActionResult = message.type === "action-result";

  // Determine avatar
  const agentAvatar = (
    <div className="agent-avatar">
      <i className="fas fa-brain" />
    </div>
  );

  const userAvatar = userProfilePic ? (
    <div className="user-avatar" style={{ padding: 0, overflow: "hidden" }}>
      <img
        src={userProfilePic}
        alt="You"
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          borderRadius: "50%",
        }}
      />
    </div>
  ) : (
    <div className="user-avatar">
      <i className="fas fa-user-circle" />
    </div>
  );

  const timestamp =
    message.timestamp instanceof Date
      ? message.timestamp.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        })
      : "";

  // ── User bubble ──────────────────────────────────────────────────────────────
  if (isUser) {
    return (
      <motion.div
        className="ai-agent-message user-message"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 120 }}
      >
        <div className="ai-agent-bubble user-bubble">
          <div className="message-content">
            <p>{message.content}</p>
            <span className="message-time">{timestamp}</span>
          </div>
          {userAvatar}
        </div>
      </motion.div>
    );
  }

  // ── Friend picker bubble ──────────────────────────────────────────────────────
  if (isFriendPicker) {
    const { friends, action, onAction, content } = message;
    const isMultiple = friends && friends.length > 1;

    return (
      <motion.div
        className="ai-agent-message agent-message"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 120 }}
      >
        <div className="ai-agent-bubble agent-bubble">
          {agentAvatar}
          <div
            className="message-content"
            style={{ maxWidth: "100%", minWidth: 0 }}
          >
            <p>{content}</p>

            {/* Friend result cards */}
            <div className="friend-picker-cards">
              {friends &&
                friends.map((friend) => (
                  <FriendResultCard
                    key={friend._id}
                    friend={friend}
                    action={action}
                    actionLabel={message.actionLabel}
                    onAction={onAction}
                    compact={isMultiple}
                  />
                ))}
            </div>

            <span className="message-time">{timestamp}</span>
          </div>
        </div>
      </motion.div>
    );
  }

  // ── Action result bubble ───────────────────────────────────────────────────────
  if (isActionResult) {
    const successColor = message.success ? "#10b981" : "#ef4444";
    return (
      <motion.div
        className="ai-agent-message agent-message"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 120 }}
      >
        <div className="ai-agent-bubble agent-bubble">
          {agentAvatar}
          <div className="message-content">
            <div
              className="action-result-badge"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 12px",
                background: message.success ? "#ecfdf5" : "#fef2f2",
                border: `1px solid ${successColor}30`,
                borderRadius: 10,
                color: successColor,
                fontSize: 13,
                fontWeight: 600,
                marginBottom: 4,
              }}
            >
              <i
                className={`fas ${message.success ? "fa-check-circle" : "fa-exclamation-circle"}`}
              />
              <span>{message.content}</span>
            </div>

            {/* Location map link */}
            {message.location?.latitude && message.location?.longitude && (
              <a
                href={`https://maps.google.com/?q=${message.location.latitude},${message.location.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: 12,
                  color: "#6366f1",
                  textDecoration: "none",
                  marginTop: 4,
                }}
              >
                <i className="fas fa-external-link-alt" />
                Open in Google Maps
              </a>
            )}

            <span className="message-time">{timestamp}</span>
          </div>
        </div>
      </motion.div>
    );
  }

  // ── Default agent bubble ───────────────────────────────────────────────────────
  return (
    <motion.div
      className="ai-agent-message agent-message"
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 120 }}
    >
      <div className="ai-agent-bubble agent-bubble">
        {agentAvatar}
        <div className="message-content">
          {/* Render newlines properly */}
          <p style={{ whiteSpace: "pre-wrap" }}>{message.content}</p>

          {message.action && (
            <div className="suggested-action">
              <i
                className="fas fa-lightbulb"
                style={{ marginRight: 4, color: "#f59e0b" }}
              />
              <span className="action-label">{message.action}</span>
            </div>
          )}

          <span className="message-time">{timestamp}</span>
        </div>
      </div>
    </motion.div>
  );
};

export default MessageBubble;
