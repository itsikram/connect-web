import React, { Fragment } from "react";

// Deterministic (non-random) widths so the skeleton doesn't jitter between
// renders, while still looking like varied message lengths rather than one
// giant uniform block.
const BUBBLE_WIDTHS = [170, 110, 150, 90, 130, 160, 100, 140];

// A natural-ish alternation of received/sent bubbles instead of a strict
// 1:1 receive/sent repeat, so it reads more like a real conversation.
const SENT_PATTERN = [false, false, true, false, true, true, false, true];

const SkeletonRow = ({ index }) => {
  const isSent = SENT_PATTERN[index % SENT_PATTERN.length];
  const primaryWidth = BUBBLE_WIDTHS[index % BUBBLE_WIDTHS.length];
  const hasSecondLine = index % 3 === 1;

  const avatar = (
    <div className="chat-message-profilePic">
      <div className="msg-skeleton-avatar" />
    </div>
  );

  const bubble = (
    <div className="chat-message msg-skeleton-bubble">
      <div className="message-container mb-0">
        <span
          className="msg-skeleton-line"
          style={{ width: `${primaryWidth}px` }}
        />
        {hasSecondLine && (
          <span
            className="msg-skeleton-line"
            style={{ width: `${Math.round(primaryWidth * 0.55)}px` }}
          />
        )}
      </div>
    </div>
  );

  return (
    <div
      className={`chat-message-container ${isSent ? "message-sent" : "message-receive"} msg-skeleton-row`}
      aria-hidden="true"
    >
      {!isSent && avatar}
      {bubble}
      {isSent && avatar}
    </div>
  );
};

// Renders placeholder rows that reuse the *real* chat bubble classes
// (chat-message-container / chat-message / chat-message-profilePic), so the
// skeleton automatically matches the exact bubble shape, tail, colors and
// sizing used by SingleMessage — in both the main chat box and the sticky
// chat box — without needing separately maintained skeleton-specific CSS.
const SingleMsgSkleton = ({ count = 1 }) => {
  return (
    <Fragment>
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonRow key={index} index={index} />
      ))}
    </Fragment>
  );
};

export default SingleMsgSkleton;
