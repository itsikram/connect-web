import {
  applyMessageEdit,
  applyMessageEditToContacts,
  canEditMessage,
  mergeContactsPreferNewer,
  reconcileWithSnapshot,
} from "./optimisticMessage";

const msg = (id, extra = {}) => ({
  _id: id,
  senderId: "me",
  receiverId: "them",
  message: `text ${id}`,
  messageType: "text",
  timestamp: new Date(1767000000000 + (Number(id) || 0) * 1000).toISOString(),
  ...extra,
});

const edit = (id, message, editedAt = "2026-10-29T10:00:00.000Z") => ({
  messageId: id,
  _id: id,
  senderId: "me",
  receiverId: "them",
  message,
  isEdited: true,
  editedAt,
});

describe("applyMessageEdit", () => {
  it("replaces the text and marks the message edited", () => {
    const list = [msg("1"), msg("2")];
    const next = applyMessageEdit(list, edit("2", "fixed"));
    expect(next[1]).toMatchObject({
      _id: "2",
      message: "fixed",
      isEdited: true,
      editedAt: "2026-10-29T10:00:00.000Z",
    });
    expect(next[0]).toBe(list[0]);
    expect(list[1].message).toBe("text 2");
  });

  it("updates reply quotes of the edited message", () => {
    const list = [msg("1"), msg("2", { parent: { _id: "1", message: "text 1" } })];
    const next = applyMessageEdit(list, edit("1", "new words"));
    expect(next[0].message).toBe("new words");
    expect(next[1].parent).toEqual({ _id: "1", message: "new words" });
    expect(next[1].message).toBe("text 2");
  });

  it("returns the same array when nothing changes or the payload is unusable", () => {
    const list = [msg("1")];
    expect(applyMessageEdit(list, edit("9", "other"))).toBe(list);
    expect(applyMessageEdit(list, null)).toBe(list);
    expect(applyMessageEdit(list, { messageId: "1" })).toBe(list);
    const edited = applyMessageEdit(list, edit("1", "x"));
    expect(applyMessageEdit(edited, edit("1", "x"))).toBe(edited);
  });

  it("can restore the previous values (rollback)", () => {
    const original = msg("1");
    const optimistic = applyMessageEdit([original], edit("1", "draft"));
    const restored = applyMessageEdit(optimistic, {
      messageId: "1",
      message: original.message,
      isEdited: false,
      editedAt: null,
    });
    expect(restored[0]).toMatchObject({ message: "text 1", isEdited: false, editedAt: null });
  });
});

describe("applyMessageEditToContacts", () => {
  it("updates a chat-list preview in place without reordering", () => {
    const contacts = [
      { person: { _id: "a" }, messages: [msg("5")] },
      { person: { _id: "them" }, messages: [msg("3")] },
    ];
    const next = applyMessageEditToContacts(contacts, edit("3", "edited preview"));
    expect(next.map((c) => c.person._id)).toEqual(["a", "them"]);
    expect(next[1].messages[0].message).toBe("edited preview");
    expect(next[0]).toBe(contacts[0]);
    expect(applyMessageEditToContacts(contacts, edit("99", "x"))).toBe(contacts);
  });
});

describe("canEditMessage", () => {
  it("allows only my own confirmed text messages that have text", () => {
    expect(canEditMessage(msg("1"), "me")).toBe(true);
    expect(canEditMessage(msg("1", { messageType: undefined }), "me")).toBe(true);
    expect(canEditMessage(msg("1"), "them")).toBe(false);
    expect(canEditMessage(msg("temp-1", { isOptimistic: true }), "me")).toBe(false);
    expect(canEditMessage(msg("1", { sendFailed: true }), "me")).toBe(false);
    expect(canEditMessage(msg("1", { messageType: "call" }), "me")).toBe(false);
    expect(canEditMessage(msg("1", { messageType: "audio", message: "" }), "me")).toBe(false);
    expect(canEditMessage(msg("1", { messageType: "secure" }), "me")).toBe(false);
    expect(canEditMessage(msg("1", { message: "", attachment: "https://x/p.jpg" }), "me")).toBe(false);
    expect(canEditMessage(msg("1"), null)).toBe(false);
  });
});

describe("refreshes never bring back the old text", () => {
  it("keeps a newer local edit over a snapshot taken before it", () => {
    const onScreen = [msg("1"), msg("2", { message: "fixed", isEdited: true, editedAt: "2026-10-29T10:00:00.000Z" })];
    const staleSnapshot = [msg("1"), msg("2")];
    const result = reconcileWithSnapshot(staleSnapshot, onScreen, { knownIds: new Set(["1", "2"]) });
    expect(result[1]).toMatchObject({ message: "fixed", isEdited: true });
  });

  it("takes the server copy when it has the newer edit", () => {
    const onScreen = [msg("2", { message: "first edit", isEdited: true, editedAt: "2026-10-29T10:00:00.000Z" })];
    const snapshot = [msg("2", { message: "second edit", isEdited: true, editedAt: "2026-10-29T11:00:00.000Z" })];
    const result = reconcileWithSnapshot(snapshot, onScreen, { knownIds: new Set(["2"]) });
    expect(result[0].message).toBe("second edit");
  });

  it("chat list: a cached server response does not undo a live edit", () => {
    const local = [{ person: { _id: "them" }, messages: [msg("3", { message: "fixed", isEdited: true, editedAt: "2026-10-29T10:00:00.000Z" })] }];
    const server = [{ person: { _id: "them" }, messages: [msg("3")] }];
    expect(mergeContactsPreferNewer(server, local)[0].messages[0].message).toBe("fixed");
    expect(mergeContactsPreferNewer(server, [{ person: { _id: "them" }, messages: [msg("3")] }])[0]).toBe(server[0]);
  });
});
