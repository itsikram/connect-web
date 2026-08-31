import React, { memo, useCallback, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import config from "../../config/config.json";
import {
  PROFILE_IMG_REFERRER_POLICY,
  sanitizeProfileImageUrl,
} from "../../utils/profileImage";
import "./HeaderMessageMenu.css";

const MAX_VISIBLE = 20;
const EMPTY_LIST = [];

const selectConversations = (state) =>
  Array.isArray(state.message) ? state.message : EMPTY_LIST;
const selectMyId = (state) => state.profile?._id || "";

function idStr(value) {
  if (value == null || value === "") return "";
  if (typeof value === "object") {
    if (value._id != null) return idStr(value._id);
    return String(value);
  }
  return String(value);
}

function getDisplayName(person) {
  if (!person) return "Unknown User";
  if (person.fullName) return person.fullName;
  const first = person.user?.firstName || "";
  const last = person.user?.surname || "";
  const combined = `${first} ${last}`.trim();
  return combined || person.displayName || person.username || "Unknown User";
}

function isAudioAttachmentUrl(url) {
  if (!url || typeof url !== "string") return false;
  const lower = url.split("?")[0].toLowerCase();
  return [".mp3", ".m4a", ".aac", ".ogg", ".oga", ".opus", ".wav", ".webm"].some(
    (ext) => lower.endsWith(ext),
  );
}

function getLastMessagePreview(lastMessage) {
  if (
    !lastMessage ||
    (!lastMessage.message &&
      !lastMessage.attachment &&
      !lastMessage.messageType)
  ) {
    return "Start a conversation...";
  }

  if (lastMessage.messageType === "call") {
    const isVideo = lastMessage.callType === "video";
    const isMissed = lastMessage.callEvent === "missed";
    if (isMissed) return isVideo ? "Missed video call" : "Missed audio call";
    return isVideo ? "Video call" : "Audio call";
  }

  if (
    lastMessage.messageType === "audio" ||
    isAudioAttachmentUrl(lastMessage.attachment)
  ) {
    return "Voice message";
  }

  if (lastMessage.message) {
    const text = String(lastMessage.message);
    return text.length > 64 ? `${text.slice(0, 64)}...` : text;
  }

  if (lastMessage.attachment) return "Photo";
  return "Start a conversation...";
}

function getShortTimeAgo(timestamp) {
  if (!timestamp) return "";
  const then = new Date(timestamp).getTime();
  if (!Number.isFinite(then)) return "";
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (seconds < 60) return "now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo`;
  return `${Math.floor(days / 365)}y`;
}

function countUnread(messages, myId) {
  if (!Array.isArray(messages) || !myId) return 0;
  const me = String(myId);
  let count = 0;
  for (let i = 0; i < messages.length; i += 1) {
    const msg = messages[i];
    if (msg && String(msg.receiverId) === me && msg.isSeen !== true) {
      count += 1;
    }
  }
  return count;
}

const ConversationRow = memo(function ConversationRow({ row, onOpen }) {
  return (
    <li className={`hr-msg-item${row.unreadCount > 0 ? " unread" : ""}`}>
      <button
        type="button"
        className="hr-msg-item-btn"
        onClick={() => onOpen(row.id)}
      >
        <div className="hr-msg-avatar-wrap">
          <img
            className="hr-msg-avatar"
            src={row.avatar}
            alt=""
            referrerPolicy={PROFILE_IMG_REFERRER_POLICY}
          />
          {row.isOnline ? <span className="hr-msg-online" /> : null}
        </div>
        <div className="hr-msg-body">
          <div className="hr-msg-top">
            <span className="hr-msg-name">{row.name}</span>
            {row.time ? <span className="hr-msg-time">{row.time}</span> : null}
          </div>
          <div className="hr-msg-preview">
            {row.isOutgoing ? <span className="hr-msg-you">You: </span> : null}
            <span className="hr-msg-text">{row.preview}</span>
            {row.unreadCount > 0 ? (
              <span className="hr-msg-unread">{row.unreadCount}</span>
            ) : null}
          </div>
        </div>
      </button>
    </li>
  );
});

const HeaderMessageMenu = ({ menuStyle, onChatSelect }) => {
  const navigate = useNavigate();
  const conversations = useSelector(selectConversations);
  const myId = useSelector(selectMyId);
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const me = String(myId || "");
    const needle = query.trim().toLowerCase();
    const mapped = [];

    for (let i = 0; i < conversations.length; i += 1) {
      const contact = conversations[i];
      const person = contact?.person;
      const id = idStr(person?._id);
      if (!id) continue;

      const messages = contact.messages;
      const last = messages?.[0] || null;
      const name = getDisplayName(person);
      if (needle) {
        const lastText = String(last?.message || "").toLowerCase();
        if (!name.toLowerCase().includes(needle) && !lastText.includes(needle)) {
          continue;
        }
      }

      mapped.push({
        id,
        name,
        avatar:
          sanitizeProfileImageUrl(person.profilePic, 96) ||
          config.defaultProfile,
        isOnline: Boolean(contact.isOnline),
        preview: getLastMessagePreview(last),
        time: getShortTimeAgo(last?.timestamp),
        unreadCount: countUnread(messages, me),
        isOutgoing: last ? idStr(last.senderId) === me : false,
        sortTs: last?.timestamp ? new Date(last.timestamp).getTime() || 0 : 0,
      });
    }

    mapped.sort((a, b) => b.sortTs - a.sortTs);
    return mapped.slice(0, MAX_VISIBLE);
  }, [conversations, myId, query]);

  const openChat = useCallback(
    (id) => {
      navigate(`/message/${id}`);
      if (onChatSelect) onChatSelect();
    },
    [navigate, onChatSelect],
  );

  const goToMessages = useCallback(() => {
    navigate("/message");
    if (onChatSelect) onChatSelect();
  }, [navigate, onChatSelect]);

  const goToNewChat = useCallback(() => {
    navigate("/friends/suggestions");
    if (onChatSelect) onChatSelect();
  }, [navigate, onChatSelect]);

  return (
    <div className="hr-message-menu">
      <div className="hr-msg-search">
        <i className="fas fa-search" aria-hidden="true" />
        <input
          type="search"
          className="hr-msg-search-input"
          placeholder="Search conversations..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search conversations"
        />
      </div>

      <ul className="hr-msg-list" style={menuStyle} role="listbox">
        {rows.length > 0 ? (
          rows.map((row) => (
            <ConversationRow key={row.id} row={row} onOpen={openChat} />
          ))
        ) : (
          <li className="hr-msg-empty">
            {query ? `No conversations match “${query}”` : "No messages yet"}
          </li>
        )}
      </ul>

      <div className="hr-msg-footer">
        <button type="button" className="hr-msg-footer-btn" onClick={goToNewChat}>
          <i className="fas fa-plus" aria-hidden="true" />
          New Chat
        </button>
        <button type="button" className="hr-msg-footer-btn ghost" onClick={goToMessages}>
          See all
        </button>
      </div>
    </div>
  );
};

export default memo(HeaderMessageMenu);
