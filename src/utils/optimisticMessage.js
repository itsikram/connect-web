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

const timeOf = (message) => {
  const ts = new Date(message?.timestamp || message?.createdAt || 0).getTime();
  return Number.isFinite(ts) ? ts : 0;
};

// Stable React key: the tempId survives the optimistic -> confirmed swap, so
// the bubble is not re-mounted (no flicker) when the server confirms it.
export function messageKey(message) {
  return String(message?.tempId || idOf(message?._id) || "");
}

// Confirmed messages in server-time order, then still-pending (optimistic /
// failed) ones in the order they were sent. Pending messages carry the
// device clock, which can be off, so they never sort into the confirmed
// history. Duplicates (same _id or tempId) keep the last copy.
export function sortMessages(messages) {
  const list = Array.isArray(messages) ? messages.filter(Boolean) : [];
  const slots = [];
  const slotByKey = new Map();
  list.forEach((message) => {
    const keys = [];
    const id = idOf(message._id);
    if (id) keys.push(`id:${id}`);
    if (message.tempId) keys.push(`temp:${message.tempId}`);
    const slot = keys.map((key) => slotByKey.get(key)).find((s) => s != null);
    if (slot == null) {
      slots.push(message);
      keys.forEach((key) => slotByKey.set(key, slots.length - 1));
      return;
    }
    // A confirmed copy always wins over a pending one.
    if (slots[slot].isOptimistic || !message.isOptimistic) slots[slot] = message;
    keys.forEach((key) => slotByKey.set(key, slot));
  });
  const confirmed = [];
  const pending = [];
  slots.forEach((message, index) => {
    (message.isOptimistic ? pending : confirmed).push({ message, index });
  });
  confirmed.sort(
    (a, b) =>
      timeOf(a.message) - timeOf(b.message) ||
      idOf(a.message._id).localeCompare(idOf(b.message._id)) ||
      a.index - b.index,
  );
  pending.sort((a, b) => a.index - b.index);
  return [...confirmed, ...pending].map(({ message }) => message);
}

// Reconcile the list on screen with a fresh "latest page" from the server.
//   knownIds  ids that were on screen (or in cache) before the request; a
//             known message missing from the snapshot was deleted, unless it
//             is older than the snapshot window and `keepOlder` is set
//             (an older page the user scrolled up to load).
//   Anything not known arrived live while the request was in flight: keep it.
export function reconcileWithSnapshot(
  snapshot,
  current,
  { knownIds, keepOlder = false, hasMore = true } = {},
) {
  const hist = sortMessages(snapshot);
  const known = knownIds instanceof Set ? knownIds : new Set();
  const histIds = new Set(hist.map((m) => idOf(m._id)).filter(Boolean));
  const confirmedHist = hist.filter((m) => !m.isOptimistic);
  const oldestTs = confirmedHist.length ? timeOf(confirmedHist[0]) : 0;
  const newestTs = confirmedHist.length
    ? timeOf(confirmedHist[confirmedHist.length - 1])
    : 0;

  const extras = (Array.isArray(current) ? current : []).filter((msg) => {
    if (!msg) return false;
    if (msg.isOptimistic) {
      // Already confirmed in the snapshot (same tempId) -> drop the pending copy.
      return !hist.some((h) => msg.tempId && h.tempId === msg.tempId);
    }
    const id = idOf(msg._id);
    if (!id || histIds.has(id)) return false;
    if (!known.has(id)) return true;
    const ts = timeOf(msg);
    if (hist.length === 0) return false;
    if (ts > newestTs) return true;
    return keepOlder && hasMore && ts < oldestTs;
  });

  return sortMessages([...hist, ...extras]);
}

// Older page loaded by scrolling up: prepend without duplicating anything.
export function prependOlderMessages(older, current) {
  return sortMessages([
    ...(Array.isArray(older) ? older : []),
    ...(Array.isArray(current) ? current : []),
  ]);
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

  return sortMessages([...withoutDupes, { ...confirmed, isOptimistic: false }]);
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

  return sortMessages([...hist, ...extras]);
}

// Replace locally cached history with a fresh server snapshot while keeping
// optimistic/socket messages that arrived during the request. A cached
// message missing from the snapshot is only dropped when it falls inside the
// time range the snapshot covers (i.e. it was deleted); anything newer than
// the snapshot's latest message means the snapshot is behind, so keep it.
export function mergeInitialHistory(history, prev, cachedIds) {
  return reconcileWithSnapshot(history, prev, { knownIds: cachedIds });
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
