import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import api from "../../api/api";
import { showErrorToast } from "../../utils/toastUtils";
import "./SecureMessage.css";

export const SECURE_MESSAGE_TYPE = "secure";
export const SECURE_PLACEHOLDER = "🔒 Secure message";

export const isSecureMessage = (msg) => msg?.messageType === SECURE_MESSAGE_TYPE;

// "sealed" | "opened" | "expired" (a sealed one past its expiry is expired).
export const secureStateOf = (msg) => {
  const secure = msg?.secure || {};
  if (secure.state === "opened" || secure.openedAt) return "opened";
  if (secure.state === "expired") return "expired";
  const expiresAt = secure.expiresAt ? new Date(secure.expiresAt).getTime() : 0;
  if (expiresAt && expiresAt <= Date.now()) return "expired";
  return "sealed";
};

const timeLeftLabel = (expiresAt) => {
  const ms = new Date(expiresAt || 0).getTime() - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return "";
  const hours = Math.floor(ms / 3600000);
  if (hours >= 1) return `Expires in ${hours}h`;
  const minutes = Math.max(1, Math.floor(ms / 60000));
  return `Expires in ${minutes}m`;
};

// How long the content stays on screen: long enough to read, never forever.
const viewSecondsFor = (content) => {
  if (content?.attachment) return 30;
  const words = String(content?.text || "").trim().split(/\s+/).filter(Boolean).length;
  return Math.min(60, Math.max(10, Math.ceil(words / 3) + 8));
};

const isImageUrl = (url) =>
  /\.(png|jpe?g|gif|webp|heic|heif|bmp|svg)(\?|$)|\/image\/upload\//i.test(String(url || ""));

/**
 * Full-screen one-time viewer. The content only lives in this component's
 * state: it is never written to the message list, Redux or any cache.
 */
export const SecureMessageViewer = ({ content, senderName, onClose }) => {
  const total = viewSecondsFor(content);
  const [secondsLeft, setSecondsLeft] = useState(total);
  const [obscured, setObscured] = useState(
    typeof document !== "undefined" && document.visibilityState !== "visible",
  );
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const started = Date.now();
    const timer = window.setInterval(() => {
      const left = total - Math.floor((Date.now() - started) / 1000);
      setSecondsLeft(Math.max(0, left));
      if (left <= 0) {
        window.clearInterval(timer);
        closeRef.current?.();
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, [total]);

  // Hide the content whenever the tab / window is not in front (switching
  // apps, screen-capture pickers, alt-tab) and on Escape.
  useEffect(() => {
    const hide = () => setObscured(true);
    const sync = () =>
      setObscured(document.visibilityState !== "visible" || !document.hasFocus());
    const onKey = (event) => {
      if (event.key === "Escape") closeRef.current?.();
      if (event.key === "PrintScreen") hide();
    };
    window.addEventListener("blur", hide);
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", sync);
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    return () => {
      window.removeEventListener("blur", hide);
      window.removeEventListener("focus", sync);
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
    };
  }, []);

  const progress = Math.max(0, Math.min(1, secondsLeft / total));

  return createPortal(
    <div
      className="secure-viewer-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Secure message"
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="secure-viewer-card">
        <div className="secure-viewer-head">
          <span className="secure-viewer-badge">
            <i className="fas fa-lock" aria-hidden="true"></i> Secure message
          </span>
          {senderName ? <span className="secure-viewer-from">from {senderName}</span> : null}
          <button type="button" className="secure-viewer-close" onClick={onClose} aria-label="Close">
            <i className="fas fa-times" aria-hidden="true"></i>
          </button>
        </div>

        <div className={`secure-viewer-body${obscured ? " is-obscured" : ""}`}>
          {content?.attachment ? (
            isImageUrl(content.attachment) ? (
              <img
                src={content.attachment}
                alt="Secure attachment"
                className="secure-viewer-image"
                draggable={false}
              />
            ) : (
              <a className="secure-viewer-file" href={content.attachment} target="_blank" rel="noreferrer">
                <i className="fas fa-file" aria-hidden="true"></i> Open attachment
              </a>
            )
          ) : null}
          {content?.text ? <p className="secure-viewer-text">{content.text}</p> : null}
          {obscured ? (
            <div className="secure-viewer-shield">
              <i className="fas fa-eye-slash" aria-hidden="true"></i>
              <span>Hidden while Connect is in the background</span>
            </div>
          ) : null}
        </div>

        <div className="secure-viewer-foot">
          <div className="secure-viewer-progress" aria-hidden="true">
            <span style={{ transform: `scaleX(${progress})` }} />
          </div>
          <span className="secure-viewer-timer">
            Vanishes in {secondsLeft}s · it can't be opened again
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
};

/** The bubble content for a secure message (both sides). */
export const SecureMessageBubble = ({ msg, isMine, senderName, onStateChange }) => {
  const [opening, setOpening] = useState(false);
  const [content, setContent] = useState(null);
  const [, forceTick] = useState(0);
  const state = secureStateOf(msg);

  // Re-render once a minute so "Expires in" and expiry stay current.
  useEffect(() => {
    if (state !== "sealed") return undefined;
    const timer = window.setInterval(() => forceTick((n) => n + 1), 60000);
    return () => window.clearInterval(timer);
  }, [state]);

  const markState = useCallback(
    (nextState, openedAt = null) => onStateChange?.(msg._id, nextState, openedAt),
    [msg._id, onStateChange],
  );

  const open = async () => {
    if (opening || isMine || state !== "sealed" || msg.isOptimistic) return;
    setOpening(true);
    try {
      const { data } = await api.post("/message/secure/open", { messageId: msg._id });
      setContent(data?.content || { text: "" });
    } catch (error) {
      const serverState = error?.response?.data?.state;
      if (serverState === "opened" || serverState === "expired") markState(serverState);
      showErrorToast(error?.response?.data?.message || "Couldn't open this secure message");
    } finally {
      setOpening(false);
    }
  };

  const closeViewer = () => {
    setContent(null);
    markState("opened", new Date().toISOString());
  };

  let icon = "fa-lock";
  let title = SECURE_PLACEHOLDER.replace("🔒 ", "");
  let detail = "";
  if (msg.isOptimistic) {
    detail = msg.sendFailed ? "Not sent" : "Sending securely…";
  } else if (state === "opened") {
    icon = "fa-lock-open";
    detail = isMine ? "Opened" : "Opened · this message has vanished";
  } else if (state === "expired") {
    icon = "fa-hourglass-end";
    detail = isMine ? "Expired before it was opened" : "Expired";
  } else if (isMine) {
    detail = `Not opened yet · ${timeLeftLabel(msg.secure?.expiresAt) || "vanishes after it's read"}`;
  } else {
    detail = `Tap to view · vanishes after reading${
      msg.secure?.expiresAt ? ` · ${timeLeftLabel(msg.secure.expiresAt)}` : ""
    }`;
  }

  const canOpen = !isMine && state === "sealed" && !msg.isOptimistic;

  return (
    <>
      <button
        type="button"
        className={`secure-bubble is-${state}${canOpen ? " can-open" : ""}${isMine ? " is-mine" : ""}`}
        onClick={canOpen ? open : undefined}
        disabled={!canOpen || opening}
        aria-label={canOpen ? "Open secure message" : `Secure message, ${detail}`}
      >
        <span className="secure-bubble-icon" aria-hidden="true">
          <i className={`fas ${opening ? "fa-spinner fa-spin" : icon}`}></i>
        </span>
        <span className="secure-bubble-copy">
          <span className="secure-bubble-title">{title}</span>
          <span className="secure-bubble-detail">{detail}</span>
        </span>
        {canOpen ? (
          <span className="secure-bubble-cta" aria-hidden="true">
            View
          </span>
        ) : null}
      </button>
      {content ? (
        <SecureMessageViewer content={content} senderName={senderName} onClose={closeViewer} />
      ) : null}
    </>
  );
};
