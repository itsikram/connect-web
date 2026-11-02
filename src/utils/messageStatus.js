// Delivery status of my own messages (server: utils/messageStatus.js).
//   pending   - not sent yet (offline / waiting for the server): no-internet icon
//   sent      - saved on the server, receiver notified (push):    one check
//   delivered - receiver opened the app after it was sent:        double check
//   seen      - receiver read it:                                 eye
//
// Socket events (server -> client):
//   messagesDelivered { senderId, receiverId, room, messageIds, deliveredAt }
//   messageSeen / seenMessage (one message, optional messageIds)
//   allMessagesSeen   { receiverId, senderIds, count } - "mark all as read"
//                     done on another of my devices

// Same as idOf in optimisticMessage.js (kept here so that module can use
// these helpers without a circular import).
const idOf = (value) => {
  if (value == null || value === "") return "";
  if (typeof value === "object") {
    if (value._id != null && value._id !== value) return idOf(value._id);
    if (typeof value.toHexString === "function") return value.toHexString();
    const asString = typeof value.toString === "function" ? value.toString() : "";
    return asString && asString !== "[object Object]" ? asString : "";
  }
  return String(value);
};

export const MESSAGE_STATUS_LABELS = {
  pending: "Not sent",
  sent: "Sent",
  delivered: "Delivered",
  seen: "Seen",
};

const isTempId = (id) => {
  const value = idOf(id);
  return !value || value.startsWith("temp-");
};

export function getMessageStatus(msg) {
  if (!msg) return "pending";
  if (msg.isOptimistic || msg.sendFailed || isTempId(msg._id)) return "pending";
  if (msg.isSeen) return "seen";
  if (msg.isDelivered) return "delivered";
  return "sent";
}

// Status events can reach this tab before the message itself (sent from
// another device, or a slow response). Remember them briefly and apply them
// when the message shows up.
const EARLY_TTL_MS = 2 * 60 * 1000;
const MAX_EARLY = 500;
const early = new Map();

export function rememberStatus(ids, patch = {}) {
  const now = Date.now();
  (Array.isArray(ids) ? ids : []).forEach((raw) => {
    const id = idOf(raw);
    if (!id) return;
    const prev = early.get(id);
    early.set(id, {
      isDelivered: Boolean(prev?.isDelivered || patch.isDelivered || patch.isSeen),
      isSeen: Boolean(prev?.isSeen || patch.isSeen),
      at: now,
    });
  });
  if (early.size > MAX_EARLY) {
    for (const [id, entry] of early) {
      if (early.size <= MAX_EARLY && now - entry.at < EARLY_TTL_MS) break;
      early.delete(id);
    }
  }
}

/** Status only moves forward: keep anything this tab already knew. */
export function withKnownStatus(msg, previous = null) {
  if (!msg) return msg;
  const id = idOf(msg._id);
  let remembered = id ? early.get(id) : undefined;
  if (remembered && Date.now() - remembered.at > EARLY_TTL_MS) {
    early.delete(id);
    remembered = undefined;
  }
  const isSeen = Boolean(msg.isSeen || previous?.isSeen || remembered?.isSeen);
  const isDelivered = Boolean(
    msg.isDelivered || previous?.isDelivered || remembered?.isDelivered || isSeen,
  );
  if (isSeen === Boolean(msg.isSeen) && isDelivered === Boolean(msg.isDelivered)) {
    return msg;
  }
  return {
    ...msg,
    isSeen,
    isDelivered,
    deliveredAt: msg.deliveredAt || previous?.deliveredAt || null,
  };
}

/** `messagesDelivered`: { messageIds, deliveredAt }. Same array when unchanged. */
export function applyDelivered(messages, payload) {
  const list = Array.isArray(messages) ? messages : [];
  const ids = new Set(
    (Array.isArray(payload?.messageIds) ? payload.messageIds : [])
      .map((id) => idOf(id))
      .filter(Boolean),
  );
  if (!ids.size) return list;
  let changed = false;
  const found = new Set();
  const next = list.map((msg) => {
    const id = idOf(msg?._id);
    if (!msg || !ids.has(id)) return msg;
    found.add(id);
    if (msg.isDelivered || msg.isSeen) return msg;
    changed = true;
    return {
      ...msg,
      isDelivered: true,
      deliveredAt: payload?.deliveredAt || new Date().toISOString(),
    };
  });
  const missing = [...ids].filter((id) => !found.has(id));
  if (missing.length) rememberStatus(missing, { isDelivered: true });
  return changed ? next : list;
}

/**
 * `messageSeen` / `seenMessage`: the seen message and every earlier one from
 * the same sender become seen (and delivered); `messageIds` (sent by "mark
 * all as read") are marked even when the newest one is not loaded.
 */
export function applySeen(messages, data) {
  const list = Array.isArray(messages) ? messages : [];
  const seenId = idOf(data?.messageId || data?._id);
  const ids = new Set(
    (Array.isArray(data?.messageIds) ? data.messageIds : [])
      .map((id) => idOf(id))
      .filter(Boolean),
  );
  if (seenId) ids.add(seenId);
  if (!ids.size) return list;

  const target = seenId ? list.find((msg) => msg && idOf(msg._id) === seenId) : null;
  const targetSender = idOf(target?.senderId || data?.senderId);
  const cutoff = target
    ? new Date(target.timestamp || 0).getTime()
    : data?.messageTimestamp
      ? new Date(data.messageTimestamp).getTime()
      : NaN;

  let changed = false;
  const found = new Set();
  const next = list.map((msg) => {
    if (!msg || msg.isOptimistic) return msg;
    const id = idOf(msg._id);
    const listed = ids.has(id);
    if (listed) found.add(id);
    const earlier =
      Boolean(targetSender) &&
      idOf(msg.senderId) === targetSender &&
      Number.isFinite(cutoff) &&
      new Date(msg.timestamp || 0).getTime() <= cutoff;
    if (!listed && !earlier) return msg;
    if (msg.isSeen && msg.isDelivered) return msg;
    changed = true;
    return { ...msg, isSeen: true, isDelivered: true };
  });
  const missing = [...ids].filter((id) => !found.has(id));
  if (missing.length) rememberStatus(missing, { isSeen: true });
  return changed ? next : list;
}

// Chat-list contacts ({ person, messages }): apply a status change to the
// conversation it belongs to. `kind` is "delivered" or "seen".
export function applyStatusToContacts(contacts, kind, data, myId) {
  const list = Array.isArray(contacts) ? contacts : [];
  if (!data) return list;
  const me = idOf(myId);
  const sender = idOf(data.senderId);
  const receiver = idOf(data.receiverId);
  const other = sender && sender === me ? receiver : sender;
  let changed = false;
  const next = list.map((contact) => {
    if (!contact || !Array.isArray(contact.messages) || !contact.messages.length) {
      return contact;
    }
    if (other && idOf(contact.person?._id) !== other) return contact;
    const messages =
      kind === "delivered"
        ? applyDelivered(contact.messages, data)
        : applySeen(contact.messages, data);
    if (messages === contact.messages) return contact;
    changed = true;
    return { ...contact, messages };
  });
  return changed ? next : list;
}

// "Mark all as read": every message I received becomes seen, in every
// conversation or only those with `senderIds`.
export function markContactsRead(contacts, myId, senderIds = null) {
  const list = Array.isArray(contacts) ? contacts : [];
  const me = idOf(myId);
  if (!me) return list;
  const only =
    Array.isArray(senderIds) && senderIds.length
      ? new Set(senderIds.map((id) => idOf(id)))
      : null;
  let changed = false;
  const next = list.map((contact) => {
    if (!contact || !Array.isArray(contact.messages)) return contact;
    if (only && !only.has(idOf(contact.person?._id))) return contact;
    let contactChanged = false;
    const messages = contact.messages.map((msg) => {
      if (!msg || idOf(msg.receiverId) !== me || msg.isSeen) return msg;
      contactChanged = true;
      return { ...msg, isSeen: true, isDelivered: true };
    });
    if (!contactChanged) return contact;
    changed = true;
    return { ...contact, messages };
  });
  return changed ? next : list;
}
