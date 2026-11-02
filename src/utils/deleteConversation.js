import api, { invalidateGetCache } from "../api/api";
import { invalidateCachedResource } from "./requestCache";
import MessageCacheManager from "./messageCacheManager";

// Fired on window after this tab deletes a conversation, so the chat list
// and open chats update even if the socket's `conversationDeleted` is missed.
export const CONVERSATION_DELETED_EVENT = "connect:conversation-deleted";

// Drop every locally cached copy of a conversation and the chat list.
export const clearConversationCaches = (profileId, connectId) => {
  if (!profileId || !connectId) return;
  MessageCacheManager.clearConversationCache(String(profileId), String(connectId));
  invalidateCachedResource(`chatList:${profileId}`);
  invalidateGetCache("/message/chatList");
};

// Deletes the whole conversation with `connectId` for both participants.
// Throws on failure so callers can show the error.
export const deleteConversation = async ({ profileId, connectId }) => {
  if (!profileId || !connectId) {
    throw new Error("Missing conversation participants.");
  }
  const res = await api.post("/message/deleteConversation", {
    profileId: String(profileId),
    connectId: String(connectId),
  });
  clearConversationCaches(profileId, connectId);
  window.dispatchEvent(
    new CustomEvent(CONVERSATION_DELETED_EVENT, {
      detail: { profileId: String(profileId), connectId: String(connectId) },
    }),
  );
  return res?.data;
};

export const getDeleteConversationError = (error) =>
  error?.response?.data?.message || "Failed to delete conversation. Please try again.";
