import { mergeInitialHistory } from "./optimisticMessage";

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
    expect(result.map((m) => m._id)).toEqual(["1", "live", "temp-1"]);
  });
});
