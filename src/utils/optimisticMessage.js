export const CHAT_MESSAGE_EVENT = "connect_chat_message";

export function idOf(value) {
  if (value == null || value === "") return "";
  if (typeof value === "object") {
    if (value._id != null && value._id !== value) return idOf(value._id);
    if (typeof value.toHexString === "function") return value.toHexString();
    const asString = typeof value.toString === "function" ? value.toString() : "";
    if (asString && asString !== "[object Object]") return asString;
    return "";
  }
  return String(value);
}

export function emitChatMessage(updatedMessage, meta = {}) {
  if (typeof window === "undefined" || !updatedMessage) return;
  window.dispatchEvent(
    new CustomEvent(CHAT_MESSAGE_EVENT, {
      detail: { updatedMessage, ...meta },
    }),
  );
}

export function otherContactId(message, myId) {
  if (!message) return "";
  const me = idOf(myId);
  const sender = idOf(message.senderId);
  const receiver = idOf(message.receiverId);
  if (sender && sender === me) return receiver;
  if (receiver && receiver === me) return sender;
  return sender || receiver;
}

export function upsertConfirmedMessage(prev, confirmed, tempId) {
  const list = Array.isArray(prev) ? prev.filter(Boolean) : [];
  if (!confirmed || !confirmed._id) return list;

  const confirmedId = idOf(confirmed._id);
  const matchTemp = tempId || confirmed.tempId || null;

  const withoutDupes = list.filter((msg) => {
    if (matchTemp && (msg.tempId === matchTemp || msg._id === matchTemp)) {
      return false;
    }
    if (idOf(msg._id) === confirmedId) {
      return false;
    }
    if (
      msg.isOptimistic &&
      idOf(msg.senderId) === idOf(confirmed.senderId) &&
      msg.message === confirmed.message
    ) {
      const dt = Math.abs(
        new Date(msg.timestamp) - new Date(confirmed.timestamp),
      );
      if (Number.isFinite(dt) && dt < 15000) return false;
    }
    return true;
  });

  return [...withoutDupes, confirmed];
}

export function isConversationMessage(msg, userId, connectId) {
  if (!msg) return false;
  const sender = idOf(msg.senderId);
  const receiver = idOf(msg.receiverId);
  const connect = idOf(connectId);
  const me = idOf(userId);
  if (!connect) return false;
  if (!me) return sender === connect || receiver === connect;
  return (
    (sender === me && receiver === connect) ||
    (sender === connect && receiver === me)
  );
}

// Apply a `seenMessage` / `messageSeen` socket payload to a conversation's
// message list. Seen events for other conversations are ignored, and only
// messages up to (and including) the seen one are marked — previously any
// seen event anywhere marked every message I had sent as seen.
export function applySeenToMessages(prev, data, userId, connectId) {
  const list = Array.isArray(prev) ? prev : [];
  const seenId = idOf(data?.messageId || data?._id);
  if (!seenId) return list;
  if (
    data?.senderId &&
    data?.receiverId &&
    !isConversationMessage(data, userId, connectId)
  ) {
    return list;
  }
  const target = list.find((m) => m && idOf(m._id) === seenId);
  if (!target) return list;
  const cutoff = new Date(target.timestamp || 0).getTime();
  const targetSender = idOf(target.senderId);
  let changed = false;
  const next = list.map((msg) => {
    if (!msg || msg.isSeen === true || msg.isOptimistic) return msg;
    const isTarget = idOf(msg._id) === seenId;
    const isEarlierFromSameSender =
      idOf(msg.senderId) === targetSender &&
      new Date(msg.timestamp || 0).getTime() <= cutoff;
    if (isTarget || isEarlierFromSameSender) {
      changed = true;
      return { ...msg, isSeen: true };
    }
    return msg;
  });
  return changed ? next : list;
}

export function mergeHistoryWithLive(history, live) {
  const hist = Array.isArray(history) ? history.filter(Boolean) : [];
  const liveList = Array.isArray(live) ? live.filter(Boolean) : [];
  const histIds = new Set(hist.map((m) => idOf(m._id)).filter(Boolean));

  const extras = liveList.filter((msg) => {
    if (msg.isOptimistic) {
      const alreadyInHistory = hist.some(
        (h) =>
          idOf(h.senderId) === idOf(msg.senderId) &&
          h.message === msg.message &&
          Math.abs(new Date(h.timestamp) - new Date(msg.timestamp)) < 15000,
      );
      return !alreadyInHistory;
    }
    const id = idOf(msg._id);
    return id && !histIds.has(id);
  });

  return [...hist, ...extras];
}

export function applyLastMessageToContacts(contacts, message, myId) {
  if (!message || !Array.isArray(contacts)) return { contacts, found: false };
  const contactId = otherContactId(message, myId);
  if (!contactId) return { contacts, found: false };

  const idx = contacts.findIndex((c) => idOf(c?.person?._id) === contactId);
  if (idx === -1) return { contacts, found: false };

  const current = contacts[idx];
  const existing = current.messages || [];
  const msgId = idOf(message._id);
  const tempId = message.tempId;
  const filtered = existing.filter((m) => {
    if (!m) return false;
    if (msgId && idOf(m._id) === msgId) return false;
    if (tempId && (m.tempId === tempId || m._id === tempId)) return false;
    return true;
  });

  const updated = {
    ...current,
    messages: [message, ...filtered],
  };
  const next = contacts.slice();
  next.splice(idx, 1);
  return { contacts: [updated, ...next], found: true };
}

export function mergeContactsPreferNewer(serverContacts, localContacts) {
  if (!Array.isArray(serverContacts)) return localContacts || [];
  const localMap = new Map(
    (localContacts || []).map((c) => [idOf(c?.person?._id), c]),
  );

  return serverContacts.map((server) => {
    const id = idOf(server?.person?._id);
    const local = localMap.get(id);
    const localTs = new Date(local?.messages?.[0]?.timestamp || 0).getTime();
    const serverTs = new Date(server?.messages?.[0]?.timestamp || 0).getTime();
    if (local?.messages?.[0] && localTs > serverTs) {
      return { ...server, messages: local.messages };
    }
    return server;
  });
}
