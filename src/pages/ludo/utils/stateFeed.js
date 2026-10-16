// Turns the server's `ludo:state` stream into what the board shows: token
// positions that hop square by square when a piece moves, a dice that tumbles
// and lands, and sound/effect events. The server's state is the truth; this
// only paces how it appears. The Expo app has a copy of this file
// (expo-connect-app/src/lib/ludo/stateFeed.ts); keep them in step.

const LOCAL_TUMBLE_MS = 450; // own roll: at least this long before landing
const REMOTE_TUMBLE_MS = 450;
const ROLL_REQUEST_TIMEOUT_MS = 5000;
const DICE_HOLD_MS = 1800; // a landed face stays up at least this long

const piecesOf = (state) =>
  (state?.players || []).map((player) => (player.pieces || []).map((piece) => Number(piece.steps) || 0));

const clonePieces = (pieces) => (pieces || []).map((list) => [...list]);

export const createStateFeed = ({ onChange, onEvent, now = () => Date.now() } = {}) => {
  let state = null;
  let pieces = [];
  let moving = null; // { seat, piece }
  let moveTimers = [];
  let lastActionId = null;
  const dice = { rolling: false, value: 0, seat: 0, since: 0, heldUntil: 0, pendingLocal: false };
  let diceTimers = [];
  let disposed = false;

  const emit = (kind, detail) => {
    try {
      onEvent?.(kind, detail);
    } catch (_e) {}
  };
  const changed = () => {
    if (!disposed) onChange?.();
  };

  const clearMoveTimers = () => {
    moveTimers.forEach((t) => clearTimeout(t));
    moveTimers = [];
  };
  const clearDiceTimers = () => {
    diceTimers.forEach((t) => clearTimeout(t));
    diceTimers = [];
  };
  const later = (list, ms, fn) => {
    const timer = setTimeout(() => {
      if (!disposed) fn();
    }, Math.max(0, ms));
    list.push(timer);
    return timer;
  };

  const settle = () => {
    clearMoveTimers();
    moving = null;
    pieces = piecesOf(state);
  };

  const landDice = (value, seat, { forfeit = false } = {}) => {
    dice.rolling = false;
    dice.pendingLocal = false;
    dice.value = value;
    dice.seat = seat;
    dice.heldUntil = now() + DICE_HOLD_MS;
    if (forfeit) emit("threeSixes");
    else if (value === 6) emit("rolledSix");
    // Re-render when the hold ends so the face can give way to the avatar.
    later(diceTimers, DICE_HOLD_MS + 20, changed);
    changed();
  };

  const showRoll = (action) => {
    clearDiceTimers();
    const value = Number(action.value) || 0;
    const seat = Number(action.seat) || 0;
    if (dice.rolling) {
      const elapsed = now() - dice.since;
      later(diceTimers, LOCAL_TUMBLE_MS - elapsed, () => landDice(value, seat, { forfeit: action.forfeit }));
      return;
    }
    dice.rolling = true;
    dice.since = now();
    dice.seat = seat;
    emit("diceRoll");
    later(diceTimers, REMOTE_TUMBLE_MS, () => landDice(value, seat, { forfeit: action.forfeit }));
    changed();
  };

  const animateMove = (action, previous) => {
    clearMoveTimers();
    const seat = Number(action.seat);
    const piece = Number(action.piece);
    const from = Number(action.from) || 0;
    const to = Number(action.to) || 0;
    const stepMs = Math.max(30, Number(state?.stepMs) || 150);
    // Start from the board as it was before this move.
    pieces = previous ? piecesOf(previous) : clonePieces(pieces);
    if (!pieces[seat]) {
      settle();
      return;
    }
    pieces[seat][piece] = from;
    moving = { seat, piece };
    const path = [];
    if (from <= 0) path.push(1);
    else for (let s = from + 1; s <= to; s += 1) path.push(s);
    if (!path.length) path.push(to);

    path.forEach((square, index) => {
      later(moveTimers, index * stepMs, () => {
        pieces = clonePieces(pieces);
        pieces[seat][piece] = square;
        emit(from <= 0 && index === 0 ? "pieceOut" : "pieceMove");
        changed();
      });
    });
    later(moveTimers, path.length * stepMs, () => {
      const captures = Array.isArray(action.captures) ? action.captures : [];
      if (captures.length) {
        pieces = clonePieces(pieces);
        captures.forEach((hit) => {
          if (pieces[hit.seat]) pieces[hit.seat][hit.piece] = 0;
        });
        emit("capture", { captures });
      }
      if (action.won) emit("win", { seat });
      moving = null;
      // Whatever arrived meanwhile (turn change, etc.) shows now.
      later(moveTimers, captures.length ? 120 : 0, () => {
        settle();
        changed();
      });
      changed();
    });
    changed();
  };

  const push = (next) => {
    if (!next || disposed) return;
    const previous = state;
    const sameGame = previous && previous.gameId === next.gameId;
    if (sameGame && Number(next.version) <= Number(previous.version)) return;
    state = next;

    const action = next.lastAction;
    const isNewAction = Boolean(action && action.id !== lastActionId && sameGame);
    if (action) lastActionId = action.id;

    if (!sameGame) {
      // First state of a game (or another game): show it as it is.
      clearDiceTimers();
      dice.rolling = false;
      dice.pendingLocal = false;
      dice.value = next.phase === "move" ? Number(next.diceValue) || 0 : 0;
      dice.seat = Number(next.currentPlayer) || 0;
      dice.heldUntil = 0;
      settle();
      changed();
      return;
    }

    if (isNewAction && action.type === "move") {
      // Skipped versions (a reconnect) jump straight to the new board.
      if (Number(next.version) - Number(previous.version) > 3) settle();
      else animateMove(action, previous);
    } else if (!moving) {
      pieces = piecesOf(next);
    }

    if (isNewAction) {
      if (action.type === "roll") showRoll(action);
      else if (action.type === "turn" && !action.again && Number(action.seat) !== Number(previous.currentPlayer)) {
        emit("turnChange");
      }
    }
    if (dice.pendingLocal && (next.phase !== "roll" || next.paused)) {
      // Our roll request was answered by something else (e.g. a pause).
      if (!(isNewAction && action.type === "roll")) {
        dice.rolling = false;
        dice.pendingLocal = false;
      }
    }
    changed();
  };

  /** Starts the tumble the moment the player taps the dice. */
  const beginLocalRoll = (seat) => {
    clearDiceTimers();
    dice.rolling = true;
    dice.pendingLocal = true;
    dice.since = now();
    dice.seat = seat;
    emit("diceRoll");
    later(diceTimers, ROLL_REQUEST_TIMEOUT_MS, () => {
      if (dice.pendingLocal) {
        dice.rolling = false;
        dice.pendingLocal = false;
        changed();
      }
    });
    changed();
  };

  const cancelLocalRoll = () => {
    if (!dice.pendingLocal) return;
    clearDiceTimers();
    dice.rolling = false;
    dice.pendingLocal = false;
    changed();
  };

  const reset = () => {
    clearMoveTimers();
    clearDiceTimers();
    state = null;
    pieces = [];
    moving = null;
    lastActionId = null;
    Object.assign(dice, { rolling: false, value: 0, seat: 0, since: 0, heldUntil: 0, pendingLocal: false });
    changed();
  };

  const snapshot = () => {
    const t = now();
    const showDice =
      dice.rolling ||
      (dice.value > 0 &&
        (t < dice.heldUntil ||
          (state && state.currentPlayer === dice.seat && (state.phase === "move" || state.phase === "busy"))));
    return {
      state,
      pieces,
      moving,
      dice: { ...dice, showing: showDice },
      animating: Boolean(moving),
    };
  };

  const dispose = () => {
    disposed = true;
    clearMoveTimers();
    clearDiceTimers();
  };

  return { push, beginLocalRoll, cancelLocalRoll, reset, snapshot, dispose, getState: () => state };
};
