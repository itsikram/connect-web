import {
  applyDelivered,
  applySeen,
  applyStatusToContacts,
  getMessageStatus,
  markContactsRead,
} from "./messageStatus";
import {
  applySeenToMessages,
  mergeContactsPreferNewer,
  reconcileWithSnapshot,
  upsertConfirmedMessage,
} from "./optimisticMessage";

const ME = "aaaaaaaaaaaaaaaaaaaaaaaa";
const THEM = "bbbbbbbbbbbbbbbbbbbbbbbb";
const OTHER = "cccccccccccccccccccccccc";

let clock = Date.parse("2026-11-02T09:00:00.000Z");
const msg = (id, extra = {}) => ({
  _id: id,
  senderId: ME,
  receiverId: THEM,
  message: `text ${id}`,
  timestamp: new Date((clock += 1000)).toISOString(),
  isSeen: false,
  isDelivered: false,
  ...extra,
});

describe("getMessageStatus", () => {
  it("covers not sent, sent, delivered and seen", () => {
    expect(getMessageStatus(msg("temp-1", { isOptimistic: true }))).toBe("pending");
    expect(getMessageStatus(msg("1", { sendFailed: true }))).toBe("pending");
    expect(getMessageStatus(msg("2"))).toBe("sent");
    expect(getMessageStatus(msg("3", { isDelivered: true }))).toBe("delivered");
    expect(getMessageStatus(msg("4", { isSeen: true }))).toBe("seen");
  });
});

describe("applyDelivered / applySeen", () => {
  it("marks delivered ids and keeps the array when nothing changes", () => {
    const list = [msg("1"), msg("2")];
    const next = applyDelivered(list, { messageIds: ["2"] });
    expect(next.map(getMessageStatus)).toEqual(["sent", "delivered"]);
    expect(applyDelivered(next, { messageIds: ["2"] })).toBe(next);
  });

  it("seen marks earlier messages from the same sender only", () => {
    const list = [msg("1"), msg("2", { senderId: THEM, receiverId: ME }), msg("3"), msg("4")];
    const next = applySeen(list, { messageId: "3" });
    expect(next.map(getMessageStatus)).toEqual(["seen", "sent", "seen", "sent"]);
  });

  it("applySeenToMessages ignores other conversations and uses messageIds", () => {
    const list = [msg("1"), msg("2")];
    expect(
      applySeenToMessages(list, { messageId: "x", senderId: ME, receiverId: OTHER }, ME, THEM),
    ).toBe(list);
    const next = applySeenToMessages(
      list,
      { messageId: "missing", messageIds: ["1", "2"], senderId: ME, receiverId: THEM },
      ME,
      THEM,
    );
    expect(next.map(getMessageStatus)).toEqual(["seen", "seen"]);
  });
});

describe("status never goes backwards", () => {
  it("a delivered event before the confirmation is kept", () => {
    applyDelivered([], { messageIds: ["early-1"] });
    const list = [msg("temp-5", { tempId: "temp-5", isOptimistic: true })];
    const next = upsertConfirmedMessage(list, msg("early-1"), "temp-5");
    expect(next).toHaveLength(1);
    expect(getMessageStatus(next[0])).toBe("delivered");
  });

  it("a stale server snapshot keeps the newer local status", () => {
    const local = msg("9", { isSeen: true, isDelivered: true });
    const stale = { ...local, isSeen: false, isDelivered: false };
    const next = reconcileWithSnapshot([stale], [local], { knownIds: new Set(["9"]) });
    expect(getMessageStatus(next[0])).toBe("seen");

    const contacts = mergeContactsPreferNewer(
      [{ person: { _id: THEM }, messages: [stale] }],
      [{ person: { _id: THEM }, messages: [local] }],
    );
    expect(getMessageStatus(contacts[0].messages[0])).toBe("seen");
  });
});

describe("chat list contacts", () => {
  const contacts = () => [
    { person: { _id: THEM }, messages: [msg("m1"), msg("r1", { senderId: THEM, receiverId: ME })] },
    { person: { _id: OTHER }, messages: [msg("r2", { senderId: OTHER, receiverId: ME })] },
  ];

  it("applies delivered and seen to the right conversation", () => {
    const delivered = applyStatusToContacts(contacts(), "delivered", { senderId: ME, receiverId: THEM, messageIds: ["m1"] }, ME);
    expect(getMessageStatus(delivered[0].messages[0])).toBe("delivered");
    const seen = applyStatusToContacts(contacts(), "seen", { messageId: "r2", senderId: OTHER, receiverId: ME }, ME);
    expect(seen[1].messages[0].isSeen).toBe(true);
    expect(seen[0].messages[1].isSeen).toBe(false);
  });

  it("marks all received messages read, or only some senders", () => {
    const all = markContactsRead(contacts(), ME);
    expect(all[0].messages[1].isSeen).toBe(true);
    expect(all[1].messages[0].isSeen).toBe(true);
    expect(all[0].messages[0].isSeen).toBe(false);
    const some = markContactsRead(contacts(), ME, [OTHER]);
    expect(some[0].messages[1].isSeen).toBe(false);
    expect(some[1].messages[0].isSeen).toBe(true);
    const list = contacts();
    expect(markContactsRead(markContactsRead(list, ME), ME)).not.toBe(list);
  });
});
