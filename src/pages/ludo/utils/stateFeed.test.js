import { createStateFeed } from "./stateFeed";

const player = (steps) => ({ pieces: steps.map((s, id) => ({ id, steps: s })) });

const stateOf = (version, players, extra = {}) => ({
  gameId: "g1",
  epoch: "e1",
  version,
  stepMs: 100,
  phase: "roll",
  currentPlayer: 0,
  players: players.map(player),
  ...extra,
});

describe("stateFeed", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("ignores stale versions, but takes a new epoch as-is", () => {
    const feed = createStateFeed();
    feed.push(stateOf(5, [[0, 0, 0, 0], [0, 0, 0, 0]]));
    feed.push(stateOf(4, [[9, 9, 9, 9], [0, 0, 0, 0]]));
    expect(feed.snapshot().pieces[0]).toEqual([0, 0, 0, 0]);

    // Reloaded on the server: lower version, new epoch.
    feed.push(stateOf(2, [[3, 0, 0, 0], [0, 0, 0, 0]], { epoch: "e2" }));
    expect(feed.snapshot().pieces[0]).toEqual([3, 0, 0, 0]);
    feed.dispose();
  });

  it("moves a token square by square, then sends captured pieces home", () => {
    const events = [];
    const feed = createStateFeed({ onEvent: (kind) => events.push(kind) });
    feed.push(stateOf(1, [[2, 0, 0, 0], [5, 0, 0, 0]], { lastAction: { id: 1, type: "turn" } }));
    feed.push(
      stateOf(2, [[5, 0, 0, 0], [0, 0, 0, 0]], {
        phase: "busy",
        lastAction: { id: 2, type: "move", seat: 0, piece: 0, from: 2, to: 5, captures: [{ seat: 1, piece: 0 }] },
      }),
    );
    expect(feed.snapshot().moving).toEqual({ seat: 0, piece: 0 });
    jest.advanceTimersByTime(0);
    expect(feed.snapshot().pieces[0][0]).toBe(3);
    expect(feed.snapshot().pieces[1][0]).toBe(5); // not captured yet
    jest.advanceTimersByTime(100);
    expect(feed.snapshot().pieces[0][0]).toBe(4);
    jest.advanceTimersByTime(100);
    expect(feed.snapshot().pieces[0][0]).toBe(5);
    jest.advanceTimersByTime(100);
    expect(feed.snapshot().pieces[1][0]).toBe(0);
    expect(events).toEqual(["pieceMove", "pieceMove", "pieceMove", "capture"]);
    jest.advanceTimersByTime(200);
    expect(feed.snapshot().moving).toBeNull();
    feed.dispose();
  });

  it("a roll tumbles, then lands on the server's value", () => {
    const events = [];
    const feed = createStateFeed({ onEvent: (kind) => events.push(kind) });
    feed.push(stateOf(1, [[0, 0, 0, 0], [0, 0, 0, 0]]));
    feed.beginLocalRoll(0);
    expect(feed.snapshot().dice.rolling).toBe(true);
    feed.push(
      stateOf(2, [[0, 0, 0, 0], [0, 0, 0, 0]], {
        phase: "move",
        diceValue: 6,
        lastAction: { id: 1, type: "roll", seat: 0, value: 6 },
      }),
    );
    jest.advanceTimersByTime(500);
    const { dice } = feed.snapshot();
    expect(dice.rolling).toBe(false);
    expect(dice.value).toBe(6);
    expect(dice.showing).toBe(true);
    expect(events).toEqual(["diceRoll", "rolledSix"]);
    feed.dispose();
  });
});
