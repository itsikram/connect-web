import React, { useState } from "react";
import { motion } from "framer-motion";
import { getActionMeta } from "./agentActions";
import { getConnectDisplayName } from "./agentIntentParser";
import "./ConnectResultCard.css";

/**
 * ConnectResultCard
 * Shows a matched connect with an action button.
 *
 * Props:
 *   connect      – profile object
 *   action      – action type string (e.g. 'VIDEO_CALL')
 *   actionLabel – optional label override for the button
 *   onAction    – async callback(connect)
 *   compact     – smaller layout when multiple cards are shown
 */
const ConnectResultCard = ({
  connect,
  action,
  actionLabel,
  onAction,
  compact = false,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const meta = getActionMeta(action);
  const displayName = getConnectDisplayName(connect);
  const profilePic = connect.profilePic;
  const initials = displayName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();
  const btnLabel = actionLabel || meta.label;

  const handleClick = async () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      await onAction(connect);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      className={`connect-result-card ${compact ? "compact" : ""}`}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.01 }}
    >
      {/* Avatar */}
      <div className="frc-avatar">
        {profilePic ? (
          <img src={profilePic} alt={displayName} className="frc-avatar-img" />
        ) : (
          <div
            className="frc-avatar-initials"
            style={{ background: meta.color }}
          >
            {initials}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="frc-info">
        <span className="frc-name">{displayName}</span>
        {connect.nickname && (
          <span className="frc-nickname">@{connect.nickname}</span>
        )}
      </div>

      {/* Action Button */}
      <motion.button
        className="frc-action-btn"
        style={{ "--btn-color": meta.color }}
        onClick={handleClick}
        disabled={isLoading}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.97 }}
      >
        {isLoading ? (
          <i className="fas fa-circle-notch fa-spin" />
        ) : (
          <i className={`fas ${meta.icon}`} />
        )}
        <span>{isLoading ? "Working…" : btnLabel}</span>
      </motion.button>
    </motion.div>
  );
};

export default ConnectResultCard;
