import React, { useEffect, useState, useRef } from "react";
import { useSelector } from "react-redux";
import moment from "moment";
import UserPP from "../UserPP";
import api from "../../api/api";
import $ from "jquery";
import checkImgLoading from "../../utils/checkImgLoading";
import isValidUrl from "../../utils/isValiUrl";
import ImageSkleton from "../../skletons/message/ImageSkleton";
import socket from "../../common/socket";
import {
  isAudioUrl,
  isAudioMessage as isAudioMsg,
  hasImageAttachment,
  getMessageSnippet,
  getProfileDisplayName,
} from "../../utils/messageMedia";

const getMessageTime = (timestamp) => {
  const inputDate = moment(timestamp);
  return inputDate.format("DD/MM/YY hh:mm A");
};

const MessageAttachment = ({ src, alt = "Photo" }) => {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setLoaded(false);
    setFailed(false);
    if (!isValidUrl(src) || isAudioUrl(src)) return;
    checkImgLoading(src, (ok) => {
      setLoaded(!!ok);
      setFailed(!ok);
    });
  }, [src]);

  if (!isValidUrl(src) || isAudioUrl(src)) return null;

  if (failed) {
    return (
      <div className="message-attachment-frame is-failed">
        <i className="fa fa-image" aria-hidden="true"></i>
        <span>Photo unavailable</span>
      </div>
    );
  }

  return (
    <a
      href={src}
      target="_blank"
      rel="noreferrer"
      className={`message-attachment-frame${loaded ? " is-loaded" : ""}`}
      aria-label="Open photo"
    >
      {!loaded && <ImageSkleton />}
      <img
        src={src}
        alt={alt}
        className="message-attachment"
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        style={{ display: loaded ? "block" : "none" }}
      />
      {loaded && (
        <span className="message-attachment-zoom" aria-hidden="true">
          <i className="fa fa-expand"></i>
        </span>
      )}
    </a>
  );
};

const ReplyQuote = ({
  parent,
  myId,
  friendProfile,
  onActivate,
}) => {
  if (!parent?._id) return null;

  const isMine = String(parent.senderId) === String(myId);
  const name = isMine ? "You" : getProfileDisplayName(friendProfile, "Reply");
  const snippet = getMessageSnippet(parent);
  const showPhotoThumb = hasImageAttachment(parent);
  const showVoice = isAudioMsg(parent);
  const showCall = parent.messageType === "call";

  return (
    <button
      type="button"
      data-parent={parent._id}
      className={`msg-reply-quote${showPhotoThumb ? " has-thumb" : ""}`}
      onClick={onActivate}
      aria-label={`Jump to ${name}'s message`}
    >
      <span className="msg-reply-quote-accent" />
      <div className="msg-reply-quote-copy">
        <span className="msg-reply-quote-name">{name}</span>
        <span className="msg-reply-quote-text">
          {showVoice && <i className="fa fa-microphone" aria-hidden="true"></i>}
          {showCall && (
            <i
              className={`fa ${parent.callType === "video" ? "fa-video-camera" : "fa-phone"}`}
              aria-hidden="true"
            ></i>
          )}
          {showPhotoThumb && !parent.message && (
            <i className="fa fa-image" aria-hidden="true"></i>
          )}
          {snippet}
        </span>
      </div>
      {showPhotoThumb && (
        <span className="msg-reply-quote-thumb">
          <img src={parent.attachment} alt="" />
        </span>
      )}
    </button>
  );
};

const SingleMessage = ({
  index,
  msg,
  friendProfile,
  setMessages,
  setReplyData,
  setIsReplying,
  msgListRef,
  setIsPreview,
  isMsgLoading,
}) => {
  const myProfile = useSelector((state) => state.profile);
  const myId = myProfile._id;
  const friendId = friendProfile._id;
  const [isReactedByMe, setIsReactedByMe] = useState(
    (msg.reacts || []).includes(myId),
  );
  const [isReactedByFriend, setIsReactedByFriend] = useState(
    (msg.reacts || []).includes(friendId),
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioCurrent, setAudioCurrent] = useState(0);
  const [showOptions, setShowOptions] = useState(true);
  const audioRef = useRef(null);
  const parentPollRef = useRef(null);

  useEffect(() => {
    if (msg.reacts && friendId) {
      setIsReactedByFriend(msg.reacts.includes(friendId));
    }
    if (msg.reacts) {
      setIsReactedByMe(msg.reacts.includes(myId));
    }
  }, [msg.reacts, friendId, myId]);

  useEffect(() => {
    return () => {
      if (parentPollRef.current) clearInterval(parentPollRef.current);
    };
  }, []);

  const hideOptions = () => {
    setShowOptions(false);
    setTimeout(() => {
      setShowOptions(true);
    }, 100);
  };

  const handleDeleteMessage = async (e) => {
    const messageId = $(e.currentTarget).data("id");
    hideOptions();

    try {
      await api.post("/message/delete", { messageId });
      if (setMessages) {
        setMessages((prevMessages) =>
          prevMessages.filter((message) => message._id !== messageId),
        );
      }
    } catch (error) {
      console.error("Error deleting message:", error);
    }
  };

  const handleLikeMessage = async (e) => {
    const messageId = $(e.currentTarget).data("id");
    hideOptions();

    if (!isReactedByMe) {
      const postReactRes = await api.post("/message/addReact", {
        messageId,
        myId,
      });
      if (postReactRes.status == 200) {
        setIsReactedByMe(true);
        if (setMessages) {
          setMessages((prevMessages) =>
            prevMessages.map((m) =>
              m._id === messageId
                ? { ...m, reacts: [...(m.reacts || []), myId] }
                : m,
            ),
          );
        }
      }
    } else {
      const removeReactRes = await api.post("/message/removeReact", {
        messageId,
        myId,
      });
      if (removeReactRes.status == 200) {
        setIsReactedByMe(false);
        if (setMessages) {
          setMessages((prevMessages) =>
            prevMessages.map((m) =>
              m._id === messageId
                ? { ...m, reacts: (m.reacts || []).filter((id) => id !== myId) }
                : m,
            ),
          );
        }
      }
    }
  };

  const handleReplyMessage = async (e) => {
    const messageId = $(e.currentTarget).data("id");
    hideOptions();
    setIsReplying(true);
    setIsPreview(true);
    setReplyData({
      messageId,
      body: msg.message,
      attachment: msg.attachment || null,
      senderId: msg.senderId,
      messageType: msg.messageType,
    });
    requestAnimationFrame(() => {
      const input =
        document.getElementById("newMessageInput") ||
        document.querySelector(".sticky-chat-input");
      input?.focus?.({ preventScroll: true });
    });
  };

  const handleSpeakMessage = async (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    hideOptions();

    if (String(msg?.senderId) !== String(myId)) {
      return;
    }

    try {
      const msgId = msg?._id || msg?.id;
      const message = msg?.message || "";
      const attachment = msg?.attachment || "";
      const messageType = msg?.messageType || "";
      const targetFriendId = msg?.receiverId || friendId;

      if (!targetFriendId || !msgId) {
        console.warn("Speak failed: missing friendId or msgId", {
          targetFriendId,
          msgId,
        });
        return;
      }

      socket.emit("speak_message", {
        msgId,
        friendId: targetFriendId,
        message,
        attachment,
        messageType,
      });
    } catch (err) {
      console.error("Speak failed:", err);
    }
  };

  const flashQuotedMessage = (el) => {
    if (!el) return;
    document
      .querySelectorAll(".chat-message.quoted-flash")
      .forEach((node) => node.classList.remove("quoted-flash"));
    el.classList.add("quoted-flash");
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => el.classList.remove("quoted-flash"), 1800);
  };

  const handleParentMsgClick = (e) => {
    const parentId = e.currentTarget.dataset.parent;
    if (!parentId) return;

    const findTarget = () =>
      document.querySelector(
        `.chat-message-container.message-id-${parentId} .chat-message`,
      );

    const selectedMessage = findTarget();
    if (selectedMessage) {
      flashQuotedMessage(selectedMessage);
      return;
    }

    if (parentPollRef.current) clearInterval(parentPollRef.current);
    let attempts = 0;
    parentPollRef.current = setInterval(() => {
      attempts += 1;
      const next = findTarget();
      if (next) {
        flashQuotedMessage(next);
        clearInterval(parentPollRef.current);
        parentPollRef.current = null;
        return;
      }
      if (!isMsgLoading && msgListRef?.current) {
        msgListRef.current.scrollTop = 10;
      }
      if (attempts > 8) {
        clearInterval(parentPollRef.current);
        parentPollRef.current = null;
      }
    }, 1200);
  };

  const isCallMessage = msg.messageType === "call";
  const isAudioMessage = () => isAudioMsg(msg);
  const hasMedia = hasImageAttachment(msg);
  const hasCaption = Boolean(String(msg.message || "").trim());
  const isMediaOnly = hasMedia && !hasCaption && !isCallMessage && !isAudioMessage();

  const formatTime = (secs) => {
    if (!isFinite(secs)) return "00:00";
    const s = Math.floor(secs % 60)
      .toString()
      .padStart(2, "0");
    const m = Math.floor(secs / 60)
      .toString()
      .padStart(2, "0");
    return `${m}:${s}`;
  };

  const onAudioLoaded = () => {
    if (audioRef.current) {
      setAudioDuration(audioRef.current.duration || 0);
    }
  };
  const onAudioTimeUpdate = () => {
    if (audioRef.current) {
      setAudioCurrent(audioRef.current.currentTime || 0);
    }
  };
  const togglePlay = () => {
    if (!audioRef.current) return;
    if (audioRef.current.paused) {
      audioRef.current.play();
      setIsPlaying(true);
    } else {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };
  const onSeek = (e) => {
    if (!audioRef.current) return;
    const value = Number(e.target.value);
    audioRef.current.currentTime = value;
    setAudioCurrent(value);
  };
  const onAudioEnded = () => {
    setIsPlaying(false);
    setAudioCurrent(audioDuration);
  };

  const renderCallContent = () => {
    const isVideo = msg.callType === "video";
    const event = msg.callEvent || "ended";
    const iconClass = isVideo ? "fa-video-camera" : "fa-phone";
    const color = event === "missed" ? "#e11d48" : "#64748b";
    const text =
      msg.message ||
      (event === "missed"
        ? isVideo
          ? "Missed video call"
          : "Missed audio call"
        : isVideo
          ? "Video call"
          : "Audio call");
    return (
      <div className="message-container mb-0">
        <div
          style={{ display: "flex", alignItems: "center", gap: "8px", color }}
        >
          <i className={`fa ${iconClass}`}></i>
          <span className="message-text" style={{ color }}>
            {text}
          </span>
        </div>
      </div>
    );
  };

  const renderAudioContent = () => {
    const src = msg.attachment;
    return (
      <div className="message-container mb-0">
        <div
          className="voice-message"
          style={{ display: "flex", alignItems: "center", gap: 10 }}
        >
          <button
            type="button"
            onClick={togglePlay}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                togglePlay();
              }
            }}
            aria-label={
              isPlaying ? "Pause voice message" : "Play voice message"
            }
            className="voice-play-btn"
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              border: "1px solid rgba(255,255,255,0.15)",
              background: "rgba(255,255,255,0.06)",
              color: "#1DB954",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <i className={`fa ${isPlaying ? "fa-pause" : "fa-play"}`}></i>
          </button>
          <input
            type="range"
            min={0}
            max={Math.max(1, Math.floor(audioDuration))}
            value={Math.floor(audioCurrent)}
            onChange={onSeek}
            aria-label="Seek voice message"
            style={{ flex: 1, accentColor: "#1DB954" }}
          />
          <span
            className="voice-time"
            style={{
              color: "#cbd5e1",
              fontSize: 12,
              minWidth: 52,
              textAlign: "right",
            }}
          >
            {formatTime(audioCurrent)} / {formatTime(audioDuration)}
          </span>
          <a
            href={src}
            target="_blank"
            rel="noreferrer"
            aria-label="Open in new tab"
            style={{ color: "#94a3b8" }}
          >
            <i className="fa fa-external-link"></i>
          </a>
          <audio
            ref={audioRef}
            src={src}
            preload="metadata"
            onLoadedMetadata={onAudioLoaded}
            onTimeUpdate={onAudioTimeUpdate}
            onEnded={onAudioEnded}
            style={{ display: "none" }}
          />
        </div>
      </div>
    );
  };

  const renderBubbleBody = (isSent) => (
    <>
      {!isCallMessage && (
        <div
          className={`chat-message-options ${!showOptions ? "options-hidden" : ""}`}
        >
          <button
            type="button"
            data-id={msg._id}
            className={`chat-message-option like ${isReactedByMe == true ? "reacted" : ""}`}
            onClick={handleLikeMessage.bind(this)}
          >
            <i className="fa fa-thumbs-up"></i>
          </button>
          <button
            type="button"
            data-id={msg._id}
            className="chat-message-option reply"
            onClick={handleReplyMessage.bind(this)}
          >
            <i className="fa fa-reply"></i>
          </button>
          {isSent && (
            <>
              <button
                type="button"
                data-id={msg._id}
                className="chat-message-option share speaker"
                onClick={handleSpeakMessage.bind(this)}
              >
                <i className="fa fa-volume-up"></i>
              </button>
              <button
                type="button"
                data-id={msg._id}
                className="chat-message-option delete"
                onClick={handleDeleteMessage.bind(this)}
              >
                <i className="fa fa-trash"></i>
              </button>
            </>
          )}
        </div>
      )}

      <ReplyQuote
        parent={msg.parent}
        myId={myId}
        friendProfile={friendProfile}
        onActivate={handleParentMsgClick}
      />

      {isCallMessage ? (
        renderCallContent()
      ) : isAudioMessage() ? (
        renderAudioContent()
      ) : hasCaption ? (
        <div className="message-container mb-0">
          <span className="message-text">{msg.message}</span>
        </div>
      ) : null}

      {!isCallMessage && !isAudioMessage() && (
        <MessageAttachment src={msg.attachment} />
      )}

      <div className="message-meta">
        <span className="message-time">{getMessageTime(msg.timestamp)}</span>
        <span className="message-react">
          <i>👍</i>
        </span>
        {isSent &&
          (msg.sendFailed ? (
            <span
              className="message-seen-check failed"
              title="Failed to send"
              aria-label="Failed to send"
            >
              <i className="fas fa-exclamation-circle"></i>
            </span>
          ) : msg.isSeen ? (
            <span
              className="message-seen-check seen"
              title="Seen"
              aria-label="Seen"
            >
              <i className="fas fa-check-double"></i>
            </span>
          ) : (
            <span
              className="message-seen-check sent"
              title="Sent"
              aria-label="Sent"
            >
              <i className="fas fa-check"></i>
            </span>
          ))}
      </div>
    </>
  );

  const isMine = msg.senderId === myId;
  const bubbleClass = [
    "chat-message",
    hasMedia ? "has-attachment" : "",
    isMediaOnly ? "media-only" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      {!isMine ? (
        <div
          key={index}
          className={`chat-message-container message-receive message-id-${msg._id} ${isReactedByMe === true || isReactedByFriend == true ? "message-reacted" : ""} ${msg.isOptimistic ? "message-optimistic" : ""}`}
          data-toggle="tooltip"
          title={getMessageTime(msg.timestamp)}
        >
          <div className="chat-message-profilePic">
            <UserPP
              profilePic={`${friendProfile.profilePic}`}
              profile={friendProfile._id}
              active={friendProfile.isActive}
            ></UserPP>
          </div>
          <div className={bubbleClass}>{renderBubbleBody(false)}</div>
          <div className="chat-message-seen-status d-none">Seen</div>
        </div>
      ) : (
        <div
          key={index}
          className={`chat-message-container message-sent message-id-${msg._id} ${isReactedByMe === true || isReactedByFriend == true ? "message-reacted" : ""} ${msg.isOptimistic ? "message-optimistic" : ""}`}
          data-toggle="tooltip"
          title={getMessageTime(msg.timestamp)}
          style={{ position: "relative" }}
        >
          <div className={bubbleClass}>{renderBubbleBody(true)}</div>
          <div className="chat-message-profilePic">
            <UserPP
              profilePic={`${myProfile.profilePic || ""}`}
              profile={myId}
              active={false}
            />
          </div>
        </div>
      )}
    </>
  );
};

export default SingleMessage;
