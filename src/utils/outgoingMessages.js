// Sending chat messages over the socket, shared by the chat page and the
// sticky chat boxes. Until the server confirms a message its payload is kept
// here by tempId, so "Retry" re-sends the same message: the server ignores a
// second copy with the same tempId, so a retry never duplicates it.
//
// While offline, socket.io buffers the emit and sends it on reconnect; the
// message shows "not sent" (no internet icon) until the server answers, and
// a late answer still confirms it.
import socket from "../common/socket";

export const SEND_TIMEOUT_MS = 10000;
const outgoing = new Map(); // tempId -> payload

export const getOutgoingPayload = (tempId) =>
  tempId ? outgoing.get(String(tempId)) : undefined;

export const forgetOutgoingPayload = (tempId) => {
  if (tempId) outgoing.delete(String(tempId));
};

/**
 * Emit `sendMessage`.
 *   onConfirmed(updatedMessage)  saved on the server (also after a timeout)
 *   onRejected(error)            blocked / refused by the server
 *   onTimeout()                  no answer yet after SEND_TIMEOUT_MS
 */
export function emitOutgoingMessage(payload, { onConfirmed, onRejected, onTimeout } = {}) {
  const tempId = String(payload?.tempId || "");
  if (tempId) outgoing.set(tempId, payload);
  let answered = false;
  const timer = setTimeout(() => {
    if (!answered && onTimeout) onTimeout();
  }, SEND_TIMEOUT_MS);

  try {
    socket.emit("sendMessage", payload, (response) => {
      if (!response) return;
      answered = true;
      clearTimeout(timer);
      if (response.ok === false || response.blocked) {
        forgetOutgoingPayload(tempId);
        if (onRejected) {
          onRejected(new Error(response.reason || response.error || "Message blocked"));
        }
        return;
      }
      if (response.updatedMessage) {
        forgetOutgoingPayload(tempId);
        if (onConfirmed) onConfirmed(response.updatedMessage);
      }
    });
  } catch (error) {
    answered = true;
    clearTimeout(timer);
    if (onRejected) onRejected(error);
  }
}

// Payload for re-sending a "not sent" message: the original one, or (after a
// reload) one rebuilt from the message. Secure messages only exist in their
// original payload, so they cannot be rebuilt.
export function retryPayloadFor(msg, { userId, connectId } = {}) {
  const saved = getOutgoingPayload(msg?.tempId || msg?._id);
  if (saved) return saved;
  if (!msg || msg.messageType === "secure") return null;
  const tempId = String(msg.tempId || msg._id || "");
  if (!tempId || !userId || !connectId) return null;
  return {
    room: [String(userId), String(connectId)].sort().join("_"),
    senderId: userId,
    receiverId: connectId,
    message: msg.message || "",
    attachment: msg.attachment || false,
    parent: msg.parent?._id || msg.parent || false,
    messageType: msg.messageType || "text",
    tempId,
  };
}

/** Make sure a retry goes out now rather than after socket.io's backoff. */
export function ensureSocketConnected() {
  try {
    if (!socket.connected) socket.connect();
  } catch (_e) {
    /* reconnects on its own */
  }
}
