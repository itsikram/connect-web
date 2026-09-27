import React, { useState } from "react";
import { motion } from "framer-motion";
import ConnectResultCard from "./ConnectResultCard";
import VideoResultCard from "./VideoResultCard";

/**
 * One chat row, styled like the Connect mobile app's AI Agent:
 *   'user'           – right-aligned bubble
 *   'agent'          – left bubble with the gradient orb avatar
 *   'connect-picker' – agent bubble + person choice cards
 *   'video-results' / 'search-results' – agent bubble + result cards
 *   'action-result'  – ✓/✗ result card (like the app's action results)
 */

const formatTime = (timestamp) => {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
};

const AgentAvatar = () => (
  <div className="xa-orb xa-avatar" aria-hidden="true">
    <i className="fas fa-magic" />
  </div>
);

/** Copy button with a short "Copied" confirmation (long-press on the app). */
const useCopy = (text) => {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    const value = String(text || "").trim();
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch (_) {}
  };
  return { copied, copy };
};

const Footer = ({ timestamp, copied, onCopy, isUser }) => (
  <div className={`xa-time${isUser ? " is-user" : ""}${copied ? " is-copied" : ""}`}>
    {copied ? "Copied" : formatTime(timestamp)}
    {onCopy ? (
      <button
        type="button"
        className="xa-copy"
        onClick={onCopy}
        aria-label="Copy message"
        title="Copy"
      >
        <i className="far fa-copy" />
      </button>
    ) : null}
  </div>
);

const Row = ({ isUser, children }) => (
  <motion.div
    className={`xa-row${isUser ? " is-user" : ""}`}
    initial={{ opacity: 0, y: 6 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.12 }}
  >
    {!isUser && <AgentAvatar />}
    <div className={`xa-column${isUser ? " is-user" : ""}`}>{children}</div>
  </motion.div>
);

const MessageBubble = ({ message, onPlayVideo, onDownloadYoutube }) => {
  const { copied, copy } = useCopy(message.content);
  const type = message.type;

  if (type === "user") {
    return (
      <Row isUser>
        <div className="xa-bubble xa-bubble-user">
          <p>{message.content}</p>
        </div>
        <Footer isUser timestamp={message.timestamp} copied={copied} onCopy={copy} />
      </Row>
    );
  }

  if (type === "action-result") {
    const ok = Boolean(message.success);
    const label = message.label || (ok ? "Done" : "Couldn't finish");
    return (
      <Row>
        <div className="xa-result-card">
          <div className="xa-result-row">
            <i
              className={`fas ${ok ? "fa-check-circle" : "fa-exclamation-circle"} xa-result-icon ${ok ? "is-ok" : "is-fail"}`}
            />
            <div className="xa-result-body">
              <span className={`xa-result-label ${ok ? "is-ok" : "is-fail"}`}>
                {label}
              </span>
              <span className="xa-result-text">{message.content}</span>
              {message.location?.latitude && message.location?.longitude ? (
                <a
                  className="xa-result-link"
                  href={`https://maps.google.com/?q=${message.location.latitude},${message.location.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <i className="fas fa-external-link-alt" /> Open in Google Maps
                </a>
              ) : null}
            </div>
          </div>
        </div>
        <Footer timestamp={message.timestamp} copied={copied} onCopy={copy} />
      </Row>
    );
  }

  const text = message.content ? (
    <div className="xa-bubble xa-bubble-agent">
      <p>
        {message.content}
        {message.streaming ? <span className="xa-caret" aria-hidden="true" /> : null}
      </p>
    </div>
  ) : null;

  if (type === "connect-picker") {
    const { connects = [], action, onAction } = message;
    return (
      <Row>
        {text}
        <div className="xa-choices">
          {connects.map((connect) => (
            <ConnectResultCard
              key={connect._id}
              connect={connect}
              action={action}
              actionLabel={message.actionLabel}
              onAction={onAction}
              compact={connects.length > 1}
            />
          ))}
        </div>
        <Footer timestamp={message.timestamp} copied={copied} onCopy={copy} />
      </Row>
    );
  }

  if (type === "video-results") {
    const { videos = [], onPlay, onDownload, source, defaultPostAsWatch } = message;
    return (
      <Row>
        {text}
        {videos.length > 0 && (
          <div className="xa-choices">
            {videos.map((video) => (
              <VideoResultCard
                key={video._id || video.videoId || video.url}
                video={video}
                onPlay={onPlay || onPlayVideo}
                onDownload={onDownload || onDownloadYoutube}
                source={source}
                defaultPostAsWatch={defaultPostAsWatch}
                compact={videos.length > 3}
              />
            ))}
          </div>
        )}
        <Footer timestamp={message.timestamp} copied={copied} onCopy={copy} />
      </Row>
    );
  }

  if (type === "search-results") {
    const { users = [], posts = [], videos = [], onPlay, onOpenUser, onOpenPost } = message;
    return (
      <Row>
        {text}
        {users.length > 0 && (
          <div className="xa-choices">
            {users.slice(0, 8).map((user) => (
              <ConnectResultCard
                key={user._id}
                connect={user}
                action="VIEW_PROFILE"
                actionLabel="Open"
                onAction={onOpenUser}
                compact={users.length > 2}
              />
            ))}
          </div>
        )}
        {posts.length > 0 && (
          <div className="xa-choices">
            {posts.slice(0, 6).map((post) => (
              <button
                key={post._id}
                type="button"
                className="xa-list-button"
                onClick={() => onOpenPost?.(post)}
              >
                {(post.caption || "Untitled post").slice(0, 90)}
              </button>
            ))}
          </div>
        )}
        {videos.length > 0 && (
          <div className="xa-choices">
            {videos.slice(0, 6).map((video) => (
              <VideoResultCard
                key={video._id || video.videoId || video.url}
                video={video}
                onPlay={onPlay}
                compact={videos.length > 2}
              />
            ))}
          </div>
        )}
        <Footer timestamp={message.timestamp} copied={copied} onCopy={copy} />
      </Row>
    );
  }

  // Default agent reply (optionally with confirmation buttons).
  return (
    <Row>
      {text}
      {Array.isArray(message.actions) && message.actions.length > 0 && (
        <div className="xa-action-pills">
          {message.actions.map((action, index) => (
            <button
              key={action.label || index}
              type="button"
              className={`xa-pill${index === 0 ? " is-primary" : ""}`}
              onClick={() => action.onClick?.()}
            >
              {action.label || "Continue"}
            </button>
          ))}
        </div>
      )}
      <Footer timestamp={message.timestamp} copied={copied} onCopy={copy} />
    </Row>
  );
};

export default MessageBubble;
