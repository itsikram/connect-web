import React, { useEffect, useState, useRef } from "react";
import { useSelector } from "react-redux";
import moment from "moment";
import UserPP from "../UserPP";
import api from "../../api/api";
import socket from "../../common/socket";
import $ from "jquery";
import checkImgLoading from "../../utils/checkImgLoading";
import isValidUrl from "../../utils/isValiUrl";
import ImageSkleton from "../../skletons/message/ImageSkleton";
import {
  isAudioUrl,
  isAudioMessage as isAudioMsg,
  hasImageAttachment,
  getMessageSnippet,
  getProfileDisplayName,
} from "../../utils/messageMedia";
import { speakMessageText } from "../../utils/speakMessage";
import { QUICK_REACTION_PRESETS } from "../../utils/chatThemes";

const normalizeReactions = (reacts) =>
  (Array.isArray(reacts) ? reacts : []).reduce((result, reaction) => {
    const profile = reaction?.profile || reaction;
    const profileId = String(profile?._id || profile || "");
    if (!profileId || result.some((item) => String(item.profile?._id || item.profile) === profileId)) {
      return result;
    }
    result.push({ profile, type: reaction?.type || "👍" });
    return result;
  }, []);

const reactionProfileId = (reaction) =>
  String(typeof reaction?.profile === "object" ? reaction.profile?._id || "" : reaction?.profile || "");

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
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const audioRef = useRef(null);
  const parentPollRef = useRef(null);

  useEffect(() => {
    const reactions = normalizeReactions(msg.reacts);
    setIsReactedByFriend(
      reactions.some((reaction) => reactionProfileId(reaction) === String(friendId)),
    );
    setIsReactedByMe(
      reactions.some((reaction) => reactionProfileId(reaction) === String(myId)),
    );
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

  const handleReaction = (reactionType = "👍") => {
    const messageId = msg?._id;
    if (!messageId || !myId) return;

    const previousReacts = normalizeReactions(msg.reacts);
    const currentReaction = previousReacts.find(
      (reaction) => reactionProfileId(reaction) === String(myId),
    );
    const shouldRemove =
      Boolean(currentReaction) && currentReaction.type === reactionType;
    const nextReacts = shouldRemove
      ? previousReacts.filter(
          (reaction) => reactionProfileId(reaction) !== String(myId),
        )
      : [
          ...previousReacts.filter(
            (reaction) => reactionProfileId(reaction) !== String(myId),
          ),
          { profile: myId, type: reactionType },
        ];

    setMessages?.((prevMessages) =>
      prevMessages.map((message) =>
        message._id === messageId ? { ...message, reacts: nextReacts } : message,
      ),
    );
    setIsReactedByMe(!shouldRemove);
    setShowReactionPicker(false);
    hideOptions();

    socket.emit(
      shouldRemove ? "removeReactMessage" : "reactMessage",
      shouldRemove
        ? { messageId, profileId: myId }
        : { messageId, profileId: myId, reactType: reactionType },
      (result) => {
        if (result?.ok) return;
        setMessages?.((prevMessages) =>
          prevMessages.map((message) =>
            message._id === messageId
              ? { ...message, reacts: previousReacts }
              : message,
          ),
        );
        setIsReactedByMe(Boolean(currentReaction));
        console.error("Message reaction failed:", result?.error || "unknown error");
      },
    );
  };

  const handleLikeMessage = (e) => {
    e?.stopPropagation?.();
    const currentReaction = normalizeReactions(msg.reacts).find(
      (reaction) => reactionProfileId(reaction) === String(myId),
    );
    if (currentReaction) {
      handleReaction(currentReaction.type);
    } else {
      setShowReactionPicker((visible) => !visible);
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

    try {
      const message = msg?.message || "";
      if (!speakMessageText(message)) {
        console.warn("Speak failed: this browser does not support text to speech or the message is empty");
      }
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
    if (!isFinite(secs) || secs < 0) return "0:00";
    const total = Math.floor(secs);
    const s = (total % 60).toString().padStart(2, "0");
    const m = Math.floor(total / 60);
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
    const duration = audioDuration > 0 ? audioDuration : 0;
    const current = audioCurrent > 0 ? audioCurrent : 0;
    const progressPct =
      duration > 0 ? Math.min(100, (current / duration) * 100) : 0;
    const shownTime =
      isPlaying || current > 0.25
        ? Math.max(0, duration - current)
        : duration;

    return (
      <div className="message-container mb-0 voice-message-container">
        <div className={`voice-message${isPlaying ? " is-playing" : ""}`}>
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
          >
            <i className={`fa ${isPlaying ? "fa-pause" : "fa-play"}`}></i>
          </button>
          <div
            className="voice-message-track"
            style={{ "--voice-progress": `${progressPct}%` }}
          >
            <div className="voice-waveform" aria-hidden="true">
              {Array.from({ length: 16 }, (_, i) => (
                <span key={i} />
              ))}
            </div>
            <input
              type="range"
              className="voice-slider"
              min={0}
              max={Math.max(1, Math.floor(duration))}
              value={Math.floor(current)}
              onChange={onSeek}
              aria-label="Seek voice message"
            />
          </div>
          <span className="voice-time">{formatTime(shownTime)}</span>
          <audio
            ref={audioRef}
            src={src}
            preload="metadata"
            onLoadedMetadata={onAudioLoaded}
            onTimeUpdate={onAudioTimeUpdate}
            onEnded={onAudioEnded}
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
            aria-label={isReactedByMe ? "Remove reaction" : "React to message"}
          >
            <i className="fa fa-thumbs-up"></i>
          </button>
          {showReactionPicker && (
            <div className="message-reaction-picker" role="menu" aria-label="Message reactions">
              {QUICK_REACTION_PRESETS.slice(0, 8).map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className={`message-reaction-choice ${
                    normalizeReactions(msg.reacts).some(
                      (reaction) =>
                        reactionProfileId(reaction) === String(myId) &&
                        reaction.type === emoji,
                    )
                      ? "selected"
                      : ""
                  }`}
                  onClick={() => handleReaction(emoji)}
                  aria-label={`React with ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            data-id={msg._id}
            className="chat-message-option reply"
            onClick={handleReplyMessage.bind(this)}
          >
            <i className="fa fa-reply"></i>
          </button>
          <button
            type="button"
            data-id={msg._id}
            className="chat-message-option share speaker"
            onClick={handleSpeakMessage.bind(this)}
            aria-label="Speak message"
            title="Speak message"
          >
            <i className="fa fa-volume-up"></i>
          </button>
          {isSent && (
            <>
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
        <span className="message-react" aria-label="Message reactions">
          {normalizeReactions(msg.reacts).map((reaction) => (
            <span
              key={`${reactionProfileId(reaction)}-${reaction.type}`}
              className="message-react-item"
              title={reactionProfileId(reaction) === String(myId) ? "Your reaction" : "Reaction"}
            >
              {reaction.type}
            </span>
          ))}
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
    isAudioMessage() ? "is-voice" : "",
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
