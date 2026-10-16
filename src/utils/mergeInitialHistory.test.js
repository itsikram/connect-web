import {
  mergeInitialHistory,
  mergeHistoryWithLive,
  prependOlderMessages,
  reconcileWithSnapshot,
  sortMessages,
  upsertConfirmedMessage,
} from "./optimisticMessage";

const msg = (id, ts, extra = {}) => ({
  _id: id,
  senderId: "a",
  receiverId: "b",
  message: id,
  timestamp: new Date(ts).toISOString(),
  ...extra,
});

describe("mergeInitialHistory", () => {
  it("keeps cached messages newer than a stale server snapshot", () => {
    const history = [msg("1", 1000), msg("2", 2000)];
    const prev = [msg("1", 1000), msg("2", 2000), msg("3", 3000)];
    const result = mergeInitialHistory(history, prev, new Set(["1", "2", "3"]));
    expect(result.map((m) => m._id)).toEqual(["1", "2", "3"]);
  });

  it("drops cached messages inside the snapshot range (deleted on server)", () => {
    const history = [msg("1", 1000), msg("3", 3000)];
    const prev = [msg("1", 1000), msg("2", 2000), msg("3", 3000)];
    const result = mergeInitialHistory(history, prev, new Set(["1", "2", "3"]));
    expect(result.map((m) => m._id)).toEqual(["1", "3"]);
  });

  it("drops all cached messages when the server returns none", () => {
    const prev = [msg("1", 1000)];
    expect(mergeInitialHistory([], prev, new Set(["1"]))).toEqual([]);
  });

  it("keeps live socket and optimistic messages", () => {
    const history = [msg("1", 1000)];
    const prev = [
      msg("1", 1000),
      msg("live", 500),
      msg("temp-1", 4000, { isOptimistic: true, message: "hi" }),
    ];
    const result = mergeInitialHistory(history, prev, new Set(["1"]));
    // Chronological: the live message is older than "1"; pending ones go last.
    expect(result.map((m) => m._id)).toEqual(["live", "1", "temp-1"]);
  });
});

describe("message ordering (old messages must never render among new ones)", () => {
  it("keeps an older page above the latest page after a refresh", () => {
    const olderPage = [msg("1", 1000), msg("2", 2000)];
    const latest = [msg("3", 3000), msg("4", 4000)];
    const onScreen = [...olderPage, ...latest];
    const result = reconcileWithSnapshot(latest, onScreen, {
      knownIds: new Set(onScreen.map((m) => m._id)),
      keepOlder: true,
      hasMore: true,
    });
    expect(result.map((m) => m._id)).toEqual(["1", "2", "3", "4"]);
  });

  it("mergeHistoryWithLive sorts instead of appending old messages last", () => {
    const result = mergeHistoryWithLive(
      [msg("3", 3000), msg("4", 4000)],
      [msg("1", 1000), msg("3", 3000)],
    );
    expect(result.map((m) => m._id)).toEqual(["1", "3", "4"]);
  });

  it("prepends older messages without duplicates", () => {
    const result = prependOlderMessages(
      [msg("1", 1000), msg("2", 2000)],
      [msg("2", 2000), msg("3", 3000)],
    );
    expect(result.map((m) => m._id)).toEqual(["1", "2", "3"]);
  });

  it("replaces the optimistic copy in place of a confirmed one", () => {
    const pending = msg("temp-9", 9999999, { tempId: "temp-9", isOptimistic: true });
    const confirmed = msg("9", 5000, { tempId: "temp-9" });
    const result = upsertConfirmedMessage([msg("1", 1000), pending], confirmed, "temp-9");
    expect(result.map((m) => m._id)).toEqual(["1", "9"]);
    expect(result[1].isOptimistic).toBe(false);
  });

  it("keeps pending messages after confirmed ones even with a skewed clock", () => {
    const pending = msg("temp-1", 1, { tempId: "temp-1", isOptimistic: true });
    const result = sortMessages([pending, msg("1", 1000), msg("2", 2000)]);
    expect(result.map((m) => m._id)).toEqual(["1", "2", "temp-1"]);
  });

  it("de-duplicates by id and tempId", () => {
    const a = msg("5", 5000, { tempId: "t5" });
    const b = { ...a, isSeen: true };
    const result = sortMessages([a, msg("4", 4000), b]);
    expect(result.map((m) => m._id)).toEqual(["4", "5"]);
    expect(result[1].isSeen).toBe(true);
  });
});
