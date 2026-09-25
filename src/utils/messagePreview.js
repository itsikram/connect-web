// One-line preview of a chat message for toasts / OS notifications.
// Mirrors server/utils/messagePreview.js so web, Expo and push text match.
const IMAGE_RE = /\.(png|jpe?g|gif|webp|heic|heif|bmp|svg)(\?|$)|\/image\/upload\//i;
const VIDEO_RE = /\.(mp4|mov|m4v|webm|mkv|avi|3gp)(\?|$)|\/video\/upload\//i;
const AUDIO_RE = /\.(mp3|wav|ogg|m4a|aac|opus)(\?|$)|\/audio\/|voice-/i;

export function chatMessagePreview(msg = {}) {
  const text = typeof msg.message === "string" ? msg.message.trim() : "";
  const attachment = typeof msg.attachment === "string" ? msg.attachment : "";

  if (msg.messageType === "call") {
    if (text) return text;
    const label = msg.callType === "video" ? "video" : "audio";
    return msg.callEvent === "missed"
      ? `Missed ${label} call`
      : `${label === "video" ? "Video" : "Audio"} call`;
  }
  if (msg.messageType === "audio" || (attachment && AUDIO_RE.test(attachment))) {
    return text || "🎤 Voice message";
  }
  if (attachment) {
    const kind = VIDEO_RE.test(attachment)
      ? "🎥 Video"
      : IMAGE_RE.test(attachment)
        ? "📷 Photo"
        : "📎 Attachment";
    return text ? `${kind}: ${text}` : kind;
  }
  return text || "New message";
}

// True when the user can already see this conversation, so an extra toast /
// OS notification would just be noise.
export function isViewingChatWith(profileId) {
  if (!profileId || typeof window === "undefined") return false;
  if (typeof document !== "undefined" && document.visibilityState !== "visible") {
    return false;
  }
  const id = String(profileId);
  const path = window.location.pathname.replace(/\/+$/, "");
  if (path === `/message/${id}`) return true;
  try {
    return (
      typeof window.isStickyChatOpen === "function" &&
      Boolean(window.isStickyChatOpen(id))
    );
  } catch (_e) {
    return false;
  }
}
