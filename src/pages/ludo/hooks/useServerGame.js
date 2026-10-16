import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { createStateFeed } from "../utils/stateFeed";

/**
 * One server-hosted game on screen: joins its room (again after every
 * reconnect), follows `ludo:state`, and exposes the player's actions.
 *
 * joinInfo.status: "joining" | "ready" | "not_found" | "error"
 */
export const useServerGame = ({ socket, connected, request, gameId, onEvent, onRemoved, onSeatReplaced }) => {
  const [, render] = useReducer((n) => n + 1, 0);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;
  const onRemovedRef = useRef(onRemoved);
  onRemovedRef.current = onRemoved;
  const onSeatReplacedRef = useRef(onSeatReplaced);
  onSeatReplacedRef.current = onSeatReplaced;

  const feedRef = useRef(null);
  if (!feedRef.current) {
    feedRef.current = createStateFeed({
      onChange: () => render(),
      onEvent: (kind, detail) => onEventRef.current?.(kind, detail),
    });
  }
  const feed = feedRef.current;
  useEffect(() => () => feed.dispose(), [feed]);

  const [joinInfo, setJoinInfo] = useState({ status: "joining", seat: -1, canJoin: false, invite: null });

  useEffect(() => {
    if (!socket || !gameId) return undefined;
    const onState = (state) => {
      if (state?.gameId === gameId) feed.push(state);
    };
    const onGameRemoved = (payload) => {
      if (payload?.gameId === gameId) onRemovedRef.current?.(payload);
    };
    const onReplaced = (payload) => {
      if (payload?.gameId === gameId) onSeatReplacedRef.current?.(payload);
    };
    socket.on("ludo:state", onState);
    socket.on("ludo:game:removed", onGameRemoved);
    socket.on("ludo:seat:replaced", onReplaced);
    return () => {
      socket.off("ludo:state", onState);
      socket.off("ludo:game:removed", onGameRemoved);
      socket.off("ludo:seat:replaced", onReplaced);
    };
  }, [socket, gameId, feed]);

  const join = useCallback(async () => {
    if (!gameId) return null;
    const result = await request("ludo:join", { gameId });
    if (result?.ok) {
      if (result.state) feed.push(result.state);
      setJoinInfo({
        status: "ready",
        seat: Number.isInteger(result.seat) ? result.seat : -1,
        canJoin: Boolean(result.canJoin),
        invite: result.invite || null,
      });
    } else if (result?.error === "not_found") {
      setJoinInfo({ status: "not_found", seat: -1, canJoin: false, invite: null });
    } else {
      setJoinInfo((prev) => ({ ...prev, status: prev.status === "ready" ? "ready" : "error", message: result?.message }));
    }
    return result;
  }, [gameId, request, feed]);

  // Join when the board opens and after every reconnect (a new socket is not
  // in the game's room yet, and the board may have moved on meanwhile).
  useEffect(() => {
    if (!socket || !gameId || !connected) return;
    join();
  }, [socket, gameId, connected, join]);

  // Leaving the board keeps the seat; the server marks this player away.
  useEffect(
    () => () => {
      if (socket && gameId) {
        try {
          socket.emit("ludo:board:closed", { gameId });
        } catch (_e) {}
      }
    },
    [socket, gameId],
  );

  const act = useCallback(
    (event, payload = {}) => request(event, { ...payload, gameId }),
    [request, gameId],
  );

  const actions = {
    join,
    accept: async (slotIndex) => {
      const result = await act("ludo:accept", Number.isInteger(slotIndex) ? { slotIndex } : {});
      if (result?.ok) {
        if (result.state) feed.push(result.state);
        setJoinInfo({ status: "ready", seat: result.seat, canJoin: false, invite: null });
      }
      return result;
    },
    decline: () => act("ludo:invites:dismiss"),
    roll: async (seat, value) => {
      feed.beginLocalRoll(seat);
      const result = await act("ludo:roll", Number.isInteger(value) ? { value } : {});
      if (!result?.ok) feed.cancelLocalRoll();
      return result;
    },
    move: (pieceIndex) => act("ludo:move", { pieceIndex }),
    pause: (name) => act("ludo:pause", { name }),
    resume: () => act("ludo:resume"),
    start: () => act("ludo:start"),
    invite: (to, slotIndex) => act("ludo:invite", { to, slotIndex }),
    reinvite: () => act("ludo:reinvite"),
    replaceWithComputer: (playerIndex) => act("ludo:replace:bot", { playerIndex }),
    updateSeat: (playerIndex, seat) => act("ludo:seat:update", { playerIndex, ...seat }),
    leave: () => act("ludo:leave"),
    reload: async () => {
      const result = await act("ludo:state:get");
      if (result?.ok && result.state) feed.push(result.state);
      return result;
    },
  };

  return { snapshot: feed.snapshot(), joinInfo, actions };
};
