import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../../api/api";
import siteConfig from "../../config/config.json";
import { unlockAudio, resumeAudioFromGesture } from "../../utils/audioUnlock";
import "./LudoGame.css";
import { COLORS, PLAYER_LETTERS, PLAYER_NAMES } from "./constants/gameConstants";
import { adjustHexColor } from "./utils/colorUtils";
import {
  boardSeatOf,
  cellFor,
  renderOrderFor,
  tokenOffset,
  yardCellFor,
} from "./utils/boardGeometry";
import { DiceSVG, Dice3D, DICE_LAND_ROTATION } from "./components/DiceSVG";
import { AnimatedBackground } from "./components/AnimatedBackground";
import { ConnectionStatus } from "./components/ConnectionStatus";
import { GameBoard } from "./components/GameBoard";
import { GameEndedScreen } from "./components/GameEndedScreen";
import { WinnerModal } from "./components/WinnerModal";
import { IncomingInviteModal } from "./components/IncomingInviteModal";
import { PlayerEditorModal } from "./components/PlayerEditorModal";
import { GameHeader } from "./components/GameHeader";
import { LudoIcon } from "./components/LudoIcon";
import { PendingInvitesBanner } from "./components/PendingInvitesBanner";
import { PlayerSelectionModal } from "./components/PlayerSelectionModal";
import { PausedOverlay } from "./components/PausedOverlay";
import FunFxLayer, { createBurst } from "./components/FunFxLayer";
import { playFunSound } from "./utils/funSounds";
import { useLudoVoice } from "./hooks/useLudoVoice";
import { useConnectionHealth } from "./hooks/useConnectionHealth";
import { useLudoSocket } from "./hooks/useLudoSocket";
import { useServerGame } from "./hooks/useServerGame";
import { showLudoInviteToast, dismissToast } from "../../utils/toastUtils";
import {
  clearActiveLudoGameId,
  markInviteHandled,
  resolveLudoInviteNotifications,
  setActiveLudoGameId,
} from "../../utils/ludoInviteUtils";

// The dice sits in the 3x3 centre, a little smaller than it so each colour's
// triangle keeps an outer band where finished tokens are shown (in cells).
const CENTER_DICE_CELLS = 2.1;
const FINISHED_TOKEN_BAND_CELLS = 1.28;
const FINISHED_TOKEN_SIZE_CELLS = 0.4;
const FINISHED_TOKEN_GAP_CELLS = 0.5;
const DICE_TUMBLE_MS = 450;
const NOTICE_MS = 3500;

const ludoPath = (gameId) => `/ludo-game/${encodeURIComponent(gameId)}`;

const gameIdFromPath = (pathname) => {
  const match = /\/ludo-game\/([^/?#]+)/.exec(pathname || "");
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch (_e) {
    return match[1];
  }
};

/** The seat a player controls: their own, or local seats for the host. */
const canControlSeat = (state, me, index) => {
  const seat = state?.players?.[index];
  if (!seat || !me) return false;
  if (seat.kind === "human") return String(seat.profileId) === String(me);
  if (seat.kind === "local") return String(state.hostId) === String(me);
  return false;
};

// Cube rotation showing `value`; with `spin`, whole extra turns so it tumbles.
const rotationForDiceFace = (prev, value, spin = false) => {
  const land = DICE_LAND_ROTATION[value] || DICE_LAND_ROTATION[1];
  const dirX = Math.random() > 0.5 ? 1 : -1;
  const dirY = Math.random() > 0.5 ? 1 : -1;
  const baseX = prev.x + (spin ? 360 * (2 + Math.floor(Math.random() * 2)) * dirX : 0);
  const baseY = prev.y + (spin ? 360 * (2 + Math.floor(Math.random() * 2)) * dirY : 0);
  let alignX = (((land.x - baseX) % 360) + 360) % 360;
  let alignY = (((land.y - baseY) % 360) + 360) % 360;
  if (!spin) {
    if (alignX > 180) alignX -= 360;
    if (alignY > 180) alignY -= 360;
  }
  return { x: baseX + alignX, y: baseY + alignY, z: 0 };
};

const isMobileAgent = () =>
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    typeof navigator !== "undefined" ? navigator.userAgent : "",
  );

// ----------------------------------------------------------------- layout

const useBoardMetrics = () => {
  const getSize = () => ({ width: window.innerWidth, height: window.innerHeight });
  const [win, setWin] = useState(getSize);
  useEffect(() => {
    const onResize = () => setWin(getSize());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const compact = win.width <= 768;
  const padding = Math.min(20, Math.max(8, win.width * 0.04));
  const availableWidth = Math.max(200, win.width - padding * 2);
  const availableHeight = Math.max(200, win.height - (compact ? 210 : 230));
  const max = compact ? 520 : 600;
  const min = compact ? 280 : 300;
  const boardSize = Math.round(
    Math.max(Math.min(min, availableWidth), Math.min(max, Math.min(availableWidth, availableHeight, max))),
  );
  return {
    boardSize,
    cellSize: boardSize / 15,
    padding,
    mobile: win.width <= 768 || isMobileAgent(),
    narrow: win.width <= 500 || isMobileAgent(),
  };
};

// ----------------------------------------------------------- sound + fx

const useSoundFx = () => {
  const [soundsEnabled, setSoundsEnabled] = useState(true);
  const soundsEnabledRef = useRef(soundsEnabled);
  soundsEnabledRef.current = soundsEnabled;
  const [fxBursts, setFxBursts] = useState([]);
  const [boardFx, setBoardFx] = useState("");
  const boardFxTimerRef = useRef(null);

  useEffect(() => {
    resumeAudioFromGesture();
    unlockAudio().catch(() => {});
    const resume = () => {
      if (document.visibilityState !== "hidden") resumeAudioFromGesture();
    };
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("pageshow", resume);
    window.addEventListener("focus", resume);
    return () => {
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("pageshow", resume);
      window.removeEventListener("focus", resume);
      clearTimeout(boardFxTimerRef.current);
    };
  }, []);

  const removeFxBurst = useCallback((id) => {
    setFxBursts((prev) => prev.filter((b) => b.id !== id));
  }, []);

  const playSound = useCallback((kind, options = {}) => {
    const burst = createBurst(kind);
    if (burst) setFxBursts((prev) => [...prev.slice(-3), burst]);
    const boardAnim =
      kind === "capture" || kind === "threeSixes"
        ? "ludo-shake"
        : kind === "rolledSix" || kind === "win"
          ? "ludo-jiggle"
          : "";
    if (boardAnim) {
      setBoardFx("");
      clearTimeout(boardFxTimerRef.current);
      requestAnimationFrame(() => setBoardFx(boardAnim));
      boardFxTimerRef.current = setTimeout(() => setBoardFx(""), 700);
    }
    if (soundsEnabledRef.current) playFunSound(kind, options);
  }, []);

  return { soundsEnabled, setSoundsEnabled, playSound, fxBursts, removeFxBurst, boardFx };
};

// --------------------------------------------------------------- invites

const normalizeInvite = (invite) => ({
  ...invite,
  from: invite.from || invite.by,
  by: invite.by || invite.from,
});

// Open invites for this player (the server keeps them until they are
// accepted, declined or withdrawn). New ones also pop a toast.
const useInvites = ({ socket, connected, me, currentGameId, onAccept, playSound }) => {
  const [invites, setInvites] = useState([]);
  const toastRef = useRef(null);
  const shownRef = useRef(new Set());
  const onAcceptRef = useRef(onAccept);
  onAcceptRef.current = onAccept;
  const currentGameIdRef = useRef(currentGameId);
  currentGameIdRef.current = currentGameId;

  const dismissToastNow = useCallback(() => {
    if (toastRef.current != null) {
      try {
        dismissToast(toastRef.current);
      } catch (_e) {}
      toastRef.current = null;
    }
  }, []);

  const decline = useCallback(
    (invite) => {
      if (!invite?.gameId) return;
      markInviteHandled(invite.gameId, invite.from);
      setInvites((prev) => prev.filter((i) => i.gameId !== invite.gameId));
      socket?.emit("ludo:invites:dismiss", { gameId: invite.gameId, by: invite.from });
      resolveLudoInviteNotifications(invite.gameId, invite.from);
      dismissToastNow();
    },
    [socket, dismissToastNow],
  );

  const accept = useCallback(
    (invite) => {
      if (!invite?.gameId) return;
      dismissToastNow();
      setInvites((prev) => prev.filter((i) => i.gameId !== invite.gameId));
      onAcceptRef.current?.(invite);
    },
    [dismissToastNow],
  );

  useEffect(() => {
    if (!socket || !me) return undefined;
    const announce = (invite) => {
      if (String(invite.gameId) === String(currentGameIdRef.current)) return;
      const key = invite.inviteId || `${invite.gameId}:${invite.ts}`;
      if (shownRef.current.has(key)) return;
      shownRef.current.add(key);
      dismissToastNow();
      playSound?.("turnChange");
      const toastId = showLudoInviteToast(
        invite.name || "A connect",
        invite.avatar,
        () => accept(invite),
        () => decline(invite),
      );
      toastRef.current = toastId;
    };
    const onList = (payload) => {
      const list = (Array.isArray(payload?.invites) ? payload.invites : []).map(normalizeInvite);
      setInvites(list.filter((i) => String(i.gameId) !== String(currentGameIdRef.current)));
      if (list[0]) announce(list[0]);
    };
    const onOne = (payload) => {
      if (!payload?.gameId) return;
      if (payload.to && String(payload.to) !== String(me)) return;
      const invite = normalizeInvite(payload);
      if (String(invite.gameId) !== String(currentGameIdRef.current)) {
        setInvites((prev) => [invite, ...prev.filter((i) => i.gameId !== invite.gameId)]);
      }
      announce(invite);
    };
    socket.on("ludo:invites", onList);
    socket.on("ludo:invite", onOne);
    return () => {
      socket.off("ludo:invites", onList);
      socket.off("ludo:invite", onOne);
    };
  }, [socket, me, accept, decline, playSound, dismissToastNow]);

  useEffect(() => {
    if (socket && connected && me) socket.emit("ludo:invites:get", {});
  }, [socket, connected, me]);

  useEffect(() => () => dismissToastNow(), [dismissToastNow]);

  return { invites, accept, decline };
};

// ------------------------------------------------------- connect search

const useConnectSearch = (me, active) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState([]);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!active || !me) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get("/connects/getConnects", { params: { profile: me } });
        const body = res?.data;
        const users = Array.isArray(body) ? body : Array.isArray(body?.connects) ? body.connects : [];
        if (!cancelled) setList(users.filter((u) => u?._id && String(u._id) !== String(me)));
      } catch (_e) {
        if (!cancelled) setList([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [active, me]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const onChange = useCallback(
    (text) => {
      setQuery(text);
      clearTimeout(timerRef.current);
      const q = (text || "").trim();
      if (q.length < 2) {
        setResults([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      timerRef.current = setTimeout(async () => {
        try {
          const res = await api.get(`/search?input=${encodeURIComponent(q)}`);
          const body = res?.data;
          const users = Array.isArray(body) ? body : Array.isArray(body?.users) ? body.users : [];
          setResults(users.filter((u) => u?._id && String(u._id) !== String(me)));
        } catch (_e) {
          setResults([]);
        } finally {
          setLoading(false);
        }
      }, 300);
    },
    [me],
  );

  return { query, results, loading, list, onChange };
};

// ================================================================== menu

const MenuScreen = ({ conn, me, myProfile, fx, invites, notice, setNotice }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { request, connected, socket } = conn;
  const [showSelection, setShowSelection] = useState(Boolean(location.state?.newGame));
  const [games, setGames] = useState([]);
  const [creating, setCreating] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(null);

  // New-game draft
  const [playerCount, setPlayerCount] = useState(4);
  const [onlineMode, setOnlineMode] = useState(false);
  const [playWithComputer, setPlayWithComputer] = useState(false);
  const [selectedConnects, setSelectedConnects] = useState([]);
  const [invitedSlots, setInvitedSlots] = useState({}); // connectId -> seat
  const [localSeats, setLocalSeats] = useState({}); // seat -> { name, avatar, cover, profileId? }
  const [editing, setEditing] = useState(null);
  const [editName, setEditName] = useState("");
  const [editAvatar, setEditAvatar] = useState("");
  const avatarFileInputRef = useRef(null);
  const search = useConnectSearch(me, showSelection || editing != null);

  // Older links: "?gameId=<id>" and "?ludoInvite=<token>" point at a game.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const linkedGameId = params.get("gameId");
    if (linkedGameId) {
      navigate(ludoPath(linkedGameId), { replace: true, state: { acceptInvite: {} } });
      return;
    }
    const token = params.get("ludoInvite");
    if (!token) return;
    try {
      const payload = JSON.parse(atob(decodeURIComponent(token)));
      if (payload?.gameId) {
        navigate(ludoPath(payload.gameId), { replace: true, state: { acceptInvite: { slotIndex: payload.slotIndex } } });
      }
    } catch (_e) {}
  }, [location.search, navigate]);

  const refreshGames = useCallback(async () => {
    const result = await request("ludo:games:get", {});
    if (result?.ok) setGames(Array.isArray(result.games) ? result.games : []);
  }, [request]);

  useEffect(() => {
    if (connected) refreshGames();
  }, [connected, refreshGames]);

  useEffect(() => {
    if (!socket) return undefined;
    const onGames = (payload) => setGames(Array.isArray(payload?.games) ? payload.games : []);
    // A seat handed to the computer is no longer this player's game.
    const onSeatReplaced = () => refreshGames();
    socket.on("ludo:games", onGames);
    socket.on("ludo:seat:replaced", onSeatReplaced);
    return () => {
      socket.off("ludo:games", onGames);
      socket.off("ludo:seat:replaced", onSeatReplaced);
    };
  }, [socket, refreshGames]);

  const seatName = (index) => PLAYER_NAMES[boardSeatOf(index, playerCount)];

  const connectById = (id) =>
    [...selectedConnects, ...search.list, ...search.results].find((c) => String(c?._id) === String(id));

  const takenSlots = () => {
    const taken = new Set(Object.values(invitedSlots).map(Number));
    Object.entries(localSeats).forEach(([slot, seat]) => {
      if (seat?.profileId) taken.add(Number(slot));
    });
    return taken;
  };

  const nextOpenSlot = () => {
    const taken = takenSlots();
    for (let i = 1; i < playerCount; i++) if (!taken.has(i)) return i;
    return null;
  };

  const draftPlayers = useMemo(() => {
    const slotOwner = {};
    Object.entries(invitedSlots).forEach(([id, slot]) => {
      slotOwner[slot] = connectById(id);
    });
    return Array.from({ length: playerCount }, (_, i) => {
      const color = COLORS[boardSeatOf(i, playerCount)];
      if (i === 0) {
        return { id: 0, name: myProfile?.fullName || "You", avatar: myProfile?.profilePic, color, profileId: me };
      }
      const invited = onlineMode ? slotOwner[i] : null;
      if (invited) return { id: i, name: invited.fullName || "Invited", avatar: invited.profilePic, color };
      const local = localSeats[i];
      if (local?.profileId || (!onlineMode && local)) {
        return { id: i, name: local.name || seatName(i), avatar: local.avatar, color, profileId: local.profileId };
      }
      if (playWithComputer || onlineMode) return { id: i, name: `Computer ${i}`, color, isBot: playWithComputer };
      return { id: i, name: local?.name || seatName(i), avatar: local?.avatar, color };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerCount, invitedSlots, localSeats, onlineMode, playWithComputer, myProfile, me, selectedConnects, search.list, search.results]);

  const invitedStatusByConnectId = useMemo(() => {
    const status = {};
    if (onlineMode) Object.keys(invitedSlots).forEach((id) => (status[id] = "invited"));
    return status;
  }, [invitedSlots, onlineMode]);

  const inviteConnect = (connect) => {
    if (!connect?._id) return;
    setOnlineMode(true);
    setPlayWithComputer(false);
    if (invitedSlots[connect._id] != null) return;
    const slot = nextOpenSlot();
    if (slot == null) return;
    setInvitedSlots((prev) => ({ ...prev, [connect._id]: slot }));
    setSelectedConnects((prev) => (prev.some((c) => c._id === connect._id) ? prev : [...prev, connect]));
  };

  const assignConnectOffline = (connect, slotIndex) => {
    if (!connect?._id) return;
    const slot = Number.isInteger(slotIndex) && slotIndex > 0 ? slotIndex : nextOpenSlot();
    if (slot == null) return;
    setLocalSeats((prev) => ({
      ...prev,
      [slot]: {
        name: connect.fullName,
        avatar: connect.profilePic,
        cover: connect.coverPic || connect.cover,
        profileId: connect._id,
      },
    }));
    setSelectedConnects((prev) => (prev.some((c) => c._id === connect._id) ? prev : [...prev, connect]));
  };

  const assignConnectToSlot = (connect, slotIndex) => {
    if (onlineMode) {
      setInvitedSlots((prev) => {
        const next = {};
        Object.entries(prev).forEach(([id, slot]) => {
          if (Number(slot) !== Number(slotIndex) && id !== String(connect._id)) next[id] = slot;
        });
        next[connect._id] = slotIndex;
        return next;
      });
      setSelectedConnects((prev) => (prev.some((c) => c._id === connect._id) ? prev : [...prev, connect]));
    } else {
      assignConnectOffline(connect, slotIndex);
    }
  };

  const onConnectSelect = (connect, isSelected) => {
    if (isSelected) {
      setSelectedConnects((prev) => prev.filter((c) => c._id !== connect._id));
      setInvitedSlots((prev) => {
        const next = { ...prev };
        delete next[connect._id];
        return next;
      });
      setLocalSeats((prev) => {
        const next = {};
        Object.entries(prev).forEach(([slot, seat]) => {
          if (String(seat?.profileId) !== String(connect._id)) next[slot] = seat;
        });
        return next;
      });
      return;
    }
    setSelectedConnects((prev) => [...prev, connect].slice(0, Math.max(0, playerCount - 1)));
  };

  const changePlayerCount = (count) => {
    setPlayerCount(count);
    setInvitedSlots((prev) => {
      const next = {};
      Object.entries(prev).forEach(([id, slot]) => {
        if (Number(slot) < count) next[id] = slot;
      });
      return next;
    });
  };

  const getInvitedNameForSlot = (slot) => {
    const entry = Object.entries(invitedSlots).find(([, s]) => Number(s) === Number(slot));
    return entry ? connectById(entry[0])?.fullName || null : null;
  };

  const openEditor = (index) => {
    if (index == null || index <= 0) return;
    setEditing(index);
    setEditName(draftPlayers[index]?.name || "");
    setEditAvatar(draftPlayers[index]?.avatar || "");
  };
  const closeEditor = () => {
    setEditing(null);
    setEditName("");
    setEditAvatar("");
  };
  const saveEditor = () => {
    if (editing != null) {
      setLocalSeats((prev) => ({
        ...prev,
        [editing]: {
          ...(prev[editing] || {}),
          name: editName.trim() || prev[editing]?.name,
          avatar: editAvatar.trim() || prev[editing]?.avatar,
        },
      }));
    }
    closeEditor();
  };

  const confirmPlayerCount = async () => {
    if (creating) return;
    resumeAudioFromGesture();
    // Selected connects without a seat yet are invited too.
    const slots = { ...invitedSlots };
    if (onlineMode) {
      const taken = new Set(Object.values(slots).map(Number));
      selectedConnects.forEach((connect) => {
        if (slots[connect._id] != null) return;
        for (let i = 1; i < playerCount; i++) {
          if (!taken.has(i)) {
            slots[connect._id] = i;
            taken.add(i);
            break;
          }
        }
      });
    }
    const bySlot = {};
    Object.entries(slots).forEach(([id, slot]) => {
      bySlot[slot] = id;
    });
    const seats = [];
    for (let i = 1; i < playerCount; i++) {
      const local = localSeats[i];
      if (onlineMode && bySlot[i]) {
        const connect = connectById(bySlot[i]);
        seats.push({ kind: "invite", profileId: bySlot[i], name: connect?.fullName, avatar: connect?.profilePic });
      } else if (onlineMode || (playWithComputer && !local?.profileId)) {
        seats.push({ kind: "bot" });
      } else {
        seats.push({ kind: "local", name: local?.name || seatName(i), avatar: local?.avatar, cover: local?.cover });
      }
    }
    setCreating(true);
    const result = await request("ludo:create", {
      playerCount,
      seats,
      host: { name: myProfile?.fullName, avatar: myProfile?.profilePic, cover: myProfile?.coverPic },
    });
    setCreating(false);
    if (!result?.ok) {
      setNotice(result?.message || "Couldn't start the game. Try again.");
      return;
    }
    setShowSelection(false);
    navigate(ludoPath(result.gameId));
  };

  const removeGame = async (game) => {
    setConfirmRemove(null);
    const result = await request("ludo:leave", { gameId: game.gameId });
    if (!result?.ok && result?.error !== "not_found") {
      setNotice(result?.message || "Couldn't remove the game.");
    }
    refreshGames();
  };

  const statusLabel = (game) => {
    if (game.paused) return "⏸ Paused";
    if (game.status === "lobby") return "Waiting";
    return "In Progress";
  };

  if (showSelection) {
    return (
      <div className="ludo-root" onPointerDown={resumeAudioFromGesture} onTouchStart={resumeAudioFromGesture}>
        <AnimatedBackground />
        <PlayerSelectionModal
          show
          selectedPlayerCount={playerCount}
          onlineMode={onlineMode}
          playWithComputer={playWithComputer}
          connectSearchQuery={search.query}
          loadingSearch={search.loading}
          searchResults={search.results}
          connectList={search.list}
          selectedConnects={selectedConnects}
          invitedStatusByConnectId={invitedStatusByConnectId}
          players={draftPlayers}
          myProfile={myProfile}
          joinedGames={[]}
          inviteCopied={false}
          incomingInvite={null}
          socketRef={conn.socketRef}
          onPlayerCountChange={changePlayerCount}
          onOnlineModeToggle={() => {
            setOnlineMode((prev) => {
              if (!prev) setPlayWithComputer(false);
              return !prev;
            });
          }}
          onPlayWithComputerToggle={() => {
            setPlayWithComputer((prev) => {
              if (!prev) setOnlineMode(false);
              return !prev;
            });
          }}
          onConnectSearchChange={search.onChange}
          onConnectSelect={onConnectSelect}
          onInviteConnect={inviteConnect}
          onAssignConnectOffline={(connect) => assignConnectOffline(connect)}
          onGetNextOpenSlot={nextOpenSlot}
          onGetInvitedNameForSlot={getInvitedNameForSlot}
          onOpenPlayerEditor={openEditor}
          onPlaySound={fx.playSound}
          onCancel={() => setShowSelection(false)}
          onConfirmPlayerCount={confirmPlayerCount}
        />
        <PlayerEditorModal
          show={editing != null}
          editingPlayerIndex={editing}
          player={editing != null ? draftPlayers[editing] : null}
          editName={editName}
          editAvatarUrl={editAvatar}
          inviteCopied={false}
          avatarFileInputRef={avatarFileInputRef}
          onNameChange={setEditName}
          onAvatarUrlChange={setEditAvatar}
          onPickAvatarFile={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (event) => setEditAvatar(event.target.result);
            reader.readAsDataURL(file);
          }}
          onClose={closeEditor}
          onSave={saveEditor}
          connectSearchQuery={search.query}
          loadingSearch={search.loading}
          searchResults={search.results}
          connectList={search.list}
          onConnectSearchChange={search.onChange}
          onAssignConnectToSlot={assignConnectToSlot}
          onPlaySound={fx.playSound}
          canReplaceWithComputer={false}
        />
        {creating && (
          <div className="ludo-overlay" role="status">
            <div className="ludo-card">
              <div className="ludo-spinner" />
              <div className="ludo-card__title">Starting game…</div>
            </div>
          </div>
        )}
        {notice && <div className="ludo-notice" role="alert">{notice}</div>}
      </div>
    );
  }

  return (
    <div className="ludo-root" onPointerDown={resumeAudioFromGesture} onTouchStart={resumeAudioFromGesture}>
      <AnimatedBackground />
      <GameHeader gameStarted={false} onStartGame={() => setShowSelection(true)} onPlaySound={fx.playSound} />
      <PendingInvitesBanner
        pendingInvites={invites.invites}
        onDismissInvite={invites.decline}
        onAcceptInvite={invites.accept}
      />
      {notice && <div className="ludo-notice" role="alert">{notice}</div>}
      <div className="ludo-idle">
        <div className="ludo-header__mark" style={{ width: 56, height: 56, borderRadius: 16 }}>
          <div className="ludo-header__mark-grid" style={{ width: 28, height: 28, gap: 3 }}>
            <span />
            <span />
            <span />
            <span />
          </div>
        </div>
        <div className="ludo-idle__title">Ludo Classic</div>
        <div className="ludo-idle__copy">
          Play the computer, pass and play, or invite connects online. Every game is saved — pause any time and
          pick it up later on any device.
        </div>
        <div className="ludo-idle__actions">
          <button type="button" className="ludo-btn ludo-btn--primary" onClick={() => setShowSelection(true)}>
            Start Game
          </button>
          {games.length > 0 && (
            <button type="button" className="ludo-btn ludo-btn--ghost" onClick={refreshGames}>
              Refresh Games
            </button>
          )}
        </div>

        {!connected && (
          <div className="ludo-muted" style={{ marginTop: 12 }} role="status">
            Connecting to the game server…
          </div>
        )}

        {games.length > 0 && (
          <div className="ludo-live-games" data-testid="ludo-your-games">
            <div className="ludo-live-games__header">
              <div>
                <div className="ludo-live-games__title">Your Games</div>
                <div className="ludo-live-games__copy">Resume a paused, waiting or in-progress match.</div>
              </div>
            </div>
            <div className="ludo-live-games__list">
              {games.map((game) => {
                const turn = game.players?.[game.currentPlayer];
                const others = (game.players || []).filter((p) => p.seat !== game.mySeat);
                const label =
                  game.mode === "computer"
                    ? "Vs computer"
                    : game.mode === "local"
                      ? "Pass & play"
                      : others
                          .filter((p) => p.kind === "human")
                          .map((p) => p.name)
                          .join(", ") || "Online match";
                return (
                  <div key={game.gameId} className="ludo-saved-game">
                    <button
                      type="button"
                      className="ludo-live-game"
                      onClick={() => navigate(ludoPath(game.gameId))}
                    >
                      <div className="ludo-live-game__badge-wrap">
                        <div className="ludo-live-game__icon">
                          {game.mode === "computer" ? "🤖" : game.mode === "local" ? "🎲" : "🌐"}
                        </div>
                        <div
                          className={`ludo-seat__badge ${game.status === "playing" && !game.paused ? "ludo-seat__badge--joined" : "ludo-seat__badge--waiting"}`}
                        >
                          {statusLabel(game)}
                        </div>
                      </div>
                      <div className="ludo-live-game__meta">
                        <div className="ludo-live-game__title-row">
                          <div className="ludo-live-game__name">
                            {label} · {game.playerCount} players
                          </div>
                        </div>
                        <div className="ludo-live-game__sub">
                          {game.progress || 0}% done
                          {turn && game.status === "playing" ? ` · ${turn.name}'s turn` : ""}
                          {game.updatedAt ? ` · ${new Date(game.updatedAt).toLocaleDateString()}` : ""}
                        </div>
                      </div>
                      <span className="ludo-live-game__cta">Resume</span>
                    </button>
                    <button
                      type="button"
                      className="ludo-saved-game__delete"
                      onClick={() => setConfirmRemove(game)}
                      aria-label={game.isHost ? "Delete game" : "Leave game"}
                      title={game.isHost ? "Delete game" : "Leave game"}
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {confirmRemove && (
        <div className="ludo-modal-backdrop" role="presentation" onClick={() => setConfirmRemove(null)}>
          <div
            className="ludo-modal ludo-leave-confirm"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="ludo-modal__title">{confirmRemove.isHost ? "Delete this game?" : "Leave this game?"}</h2>
            <p className="ludo-modal__subtitle">
              {confirmRemove.isHost
                ? "It ends for everyone in it and can't be resumed."
                : "A computer takes over your seat."}
            </p>
            <div className="ludo-leave-confirm__actions">
              <button type="button" className="ludo-btn ludo-btn--ghost" onClick={() => setConfirmRemove(null)}>
                Keep
              </button>
              <button type="button" className="ludo-btn ludo-btn--danger" onClick={() => removeGame(confirmRemove)}>
                {confirmRemove.isHost ? "Delete" : "Leave"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ================================================================= board

const BoardScreen = ({ conn, gameId, me, myProfile, fx, invites, notice, setNotice }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const metrics = useBoardMetrics();
  const { boardSize: BOARD_SIZE, cellSize: CELL_SIZE } = metrics;
  const [removedReason, setRemovedReason] = useState(null);
  const [winnerToShow, setWinnerToShow] = useState(null);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showRestartConfirm, setShowRestartConfirm] = useState(false);
  const [pendingMove, setPendingMove] = useState(false);
  const [busyAction, setBusyAction] = useState(false);
  const [editing, setEditing] = useState(null);
  const [editName, setEditName] = useState("");
  const [editAvatar, setEditAvatar] = useState("");
  const [inviteCopied, setInviteCopied] = useState(false);
  const [controlMode, setControlMode] = useState(false);
  const [showDicePicker, setShowDicePicker] = useState(false);
  const [diceRotation, setDiceRotation] = useState({ x: 0, y: 0, z: 0 });
  const diceRotationRef = useRef({ x: 0, y: 0, z: 0 });
  const avatarFileInputRef = useRef(null);
  const autoAcceptRef = useRef(false);

  const handleEvent = useCallback(
    (kind, detail) => {
      fx.playSound(kind);
      if (kind === "diceRoll") {
        // Tumble: spin the cube; it settles on the face once the value lands.
        const next = rotationForDiceFace(diceRotationRef.current, 1 + Math.floor(Math.random() * 6), true);
        diceRotationRef.current = next;
        setDiceRotation(next);
      }
      if (kind === "win" && detail) setWinnerToShow(detail.seat);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fx.playSound],
  );

  const { snapshot, joinInfo, actions } = useServerGame({
    socket: conn.socket,
    connected: conn.connected,
    request: conn.request,
    gameId,
    onEvent: handleEvent,
    onRemoved: (payload) => setRemovedReason(payload?.reason || "removed"),
    onSeatReplaced: () => setRemovedReason("replaced"),
  });
  const { state, pieces, moving, dice } = snapshot;
  const animating = Boolean(moving);

  const players = state?.players || [];
  const playerCount = state?.playerCount || 4;
  const pathLength = state?.pathLength;
  const maxSteps = state?.maxSteps || 57;
  const stepMs = state?.stepMs || 150;
  const isHost = Boolean(state && String(state.hostId) === String(me));
  const mySeat = players.findIndex((p) => p.kind === "human" && String(p.profileId) === String(me));
  const isMember = mySeat >= 0 || isHost;
  const myIndex = mySeat >= 0 ? mySeat : 0;
  const current = state?.currentPlayer ?? 0;
  const controlsCurrent = canControlSeat(state, me, current);
  const otherHumans = players.some((p, i) => i !== mySeat && p.kind === "human");
  const isOnlineGame = state?.mode === "online" || otherHumans;
  const paused = Boolean(state?.paused);
  const ended = Boolean(state?.gameEnded);
  const lobby = state?.status === "lobby";
  const playing = state?.status === "playing";
  const renderOrder = useMemo(() => renderOrderFor(playerCount), [playerCount]);

  const isDebug = useMemo(() => /localhost|127\.0\.0\.1/.test(window.location.hostname), []);
  const isSpecialUser = String(me) === "67bf1e4009395add03e1e234";

  const connectionHealth = useConnectionHealth(Boolean(gameId), conn.connected, conn.socketRef, isMember ? gameId : null);
  const connectionReady = connectionHealth === "ok";
  const canTapDice =
    playing &&
    state?.phase === "roll" &&
    controlsCurrent &&
    !paused &&
    connectionReady &&
    !dice.rolling &&
    !animating &&
    !busyAction;

  const { micOn, voiceConnecting, voiceError, toggleMic, isSpeakingUid } = useLudoVoice({
    enabled: Boolean(state && otherHumans && !ended && isMember && me),
    gameId,
    profileId: me,
  });

  const search = useConnectSearch(me, editing != null);

  // While this game is open, invites to it are handled here, not as toasts.
  useEffect(() => {
    if (isMember && gameId) setActiveLudoGameId(gameId);
    return () => clearActiveLudoGameId();
  }, [isMember, gameId]);

  // Keep the cube showing the landed face.
  useEffect(() => {
    if (dice.rolling || !(dice.value >= 1)) return;
    const next = rotationForDiceFace(diceRotationRef.current, dice.value, false);
    diceRotationRef.current = next;
    setDiceRotation(next);
  }, [dice.value, dice.rolling]);

  const report = useCallback(
    (result) => {
      if (result && !result.ok && result.error !== "wrong_phase") {
        setNotice(result.message || "Something went wrong.");
      }
      return result;
    },
    [setNotice],
  );

  // Opened from an invite (toast, notification or link): take the seat.
  const inviteAccept = location.state?.acceptInvite;
  useEffect(() => {
    if (!inviteAccept || autoAcceptRef.current) return;
    if (joinInfo.status !== "ready" || !state) return;
    autoAcceptRef.current = true;
    if (isMember) return;
    if (!joinInfo.canJoin) {
      setNotice(lobby ? "That seat was taken." : "This match has already started.");
      return;
    }
    markInviteHandled(gameId, joinInfo.invite?.from || state.hostId);
    resolveLudoInviteNotifications(gameId, state.hostId);
    actions.accept(inviteAccept.slotIndex).then(report);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inviteAccept, joinInfo.status, joinInfo.canJoin, state, isMember]);

  const exitToMenu = useCallback(() => navigate("/ludo-game"), [navigate]);

  const roll = async (value) => {
    if (!canTapDice) return;
    resumeAudioFromGesture();
    const result = await actions.roll(current, value);
    report(result);
  };

  const onDiceClick = () => {
    if (!canTapDice) return;
    if (controlMode) {
      setShowDicePicker(true);
      return;
    }
    roll();
  };

  const movePiece = async (pieceIndex) => {
    if (pendingMove) return;
    resumeAudioFromGesture();
    setPendingMove(true);
    const result = await actions.move(pieceIndex);
    setPendingMove(false);
    report(result);
  };

  const pauseGame = async () => {
    fx.playSound("buttonClick");
    report(await actions.pause(myProfile?.fullName || players[myIndex]?.name));
  };
  const resumeGame = async () => {
    fx.playSound("buttonClick");
    report(await actions.resume());
  };
  const saveAndExit = async () => {
    fx.playSound("buttonClick");
    if (!paused && playing) await actions.pause(myProfile?.fullName || players[myIndex]?.name);
    exitToMenu();
  };

  const confirmLeave = async () => {
    setShowLeaveConfirm(false);
    setBusyAction(true);
    await actions.leave();
    setBusyAction(false);
    navigate("/");
  };

  // Restart (computer and pass-and-play games): a fresh game, same seats.
  const restartGame = async () => {
    setShowRestartConfirm(false);
    if (!state) return;
    setBusyAction(true);
    const seats = players.slice(1).map((p) =>
      p.kind === "local" ? { kind: "local", name: p.name, avatar: p.avatar, cover: p.cover } : { kind: "bot" },
    );
    const created = await conn.request("ludo:create", {
      playerCount,
      seats,
      host: { name: myProfile?.fullName, avatar: myProfile?.profilePic, cover: myProfile?.coverPic },
    });
    if (created?.ok) {
      await actions.leave();
      setBusyAction(false);
      navigate(ludoPath(created.gameId), { replace: true });
      return;
    }
    setBusyAction(false);
    report(created);
  };

  const copyInviteLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${ludoPath(gameId)}`);
      setInviteCopied(true);
      setTimeout(() => setInviteCopied(false), 2000);
    } catch (_e) {
      setInviteCopied(false);
    }
  };

  const openEditor = (index) => {
    if (index == null || !players[index]) return;
    setEditing(index);
    setEditName(players[index]?.name || "");
    setEditAvatar(players[index]?.avatar || "");
  };
  const closeEditor = () => {
    setEditing(null);
    setEditName("");
    setEditAvatar("");
  };
  const saveEditor = async () => {
    const seat = players[editing];
    if (isHost && seat && (seat.kind === "local" || seat.kind === "bot" || seat.kind === "open")) {
      const avatar = editAvatar.trim();
      report(
        await actions.updateSeat(editing, {
          name: editName.trim(),
          avatar: avatar && !avatar.startsWith("data:") ? avatar : undefined,
        }),
      );
    }
    closeEditor();
  };

  const replaceWithComputer = async (index) => {
    fx.playSound("buttonClick");
    closeEditor();
    report(await actions.replaceWithComputer(index));
  };

  // ------------------------------------------------------------ views

  if (removedReason || joinInfo.status === "not_found") {
    const text =
      removedReason === "host_left"
        ? "The host ended this game."
        : removedReason === "replaced"
          ? "The host gave your seat to the computer."
          : "This game has ended or no longer exists.";
    return (
      <div className="ludo-root">
        <AnimatedBackground />
        <div className="ludo-idle" data-testid="ludo-game-gone">
          <div className="ludo-idle__title">Game unavailable</div>
          <div className="ludo-idle__copy">{text}</div>
          <div className="ludo-idle__actions">
            <button type="button" className="ludo-btn ludo-btn--primary" onClick={exitToMenu}>
              Back to Ludo
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (ended) {
    const standings = (state.standings?.length ? state.standings : state.winners).map((w) => ({
      ...w,
      id: boardSeatOf(w.seat ?? w.id, playerCount),
    }));
    return (
      <div className="ludo-root" onPointerDown={resumeAudioFromGesture}>
        <AnimatedBackground />
        <GameEndedScreen winners={standings} onResetGame={() => navigate("/ludo-game", { state: { newGame: true } })} />
      </div>
    );
  }

  if (!state) {
    return (
      <div className="ludo-root">
        <AnimatedBackground />
        <div className="ludo-idle" role="status">
          <div className="ludo-spinner" />
          <div className="ludo-idle__copy">
            {joinInfo.status === "error" ? joinInfo.message || "Couldn't open the game. Retrying…" : "Opening game…"}
          </div>
          <div className="ludo-idle__actions">
            <button type="button" className="ludo-btn ludo-btn--ghost" onClick={exitToMenu}>
              Back to Ludo
            </button>
          </div>
        </div>
      </div>
    );
  }

  const showJoinPrompt = !isMember && joinInfo.canJoin && !inviteAccept;
  const currentSeat = players[current];
  const turnHint = lobby
    ? "Waiting…"
    : paused
      ? "Paused"
      : !controlsCurrent
        ? currentSeat?.isBot
          ? "Computer turn"
          : "Opponent turn"
        : canTapDice
          ? "Tap dice to roll"
          : state.phase === "move" && !animating
            ? "Tap a glowing piece"
            : "Wait…";

  const diceOwner = dice.showing ? dice.seat : current;
  const tokenSize = Math.max(12, Math.round(CELL_SIZE * 0.88));
  const finishedTokenSize = Math.max(9, Math.round(CELL_SIZE * FINISHED_TOKEN_SIZE_CELLS));
  const myMovable =
    playing && state.phase === "move" && controlsCurrent && !paused && connectionReady && !animating && !pendingMove
      ? new Set(state.movable || [])
      : new Set();

  const occupancy = new Map();
  renderOrder.forEach((seat) => {
    (pieces[seat] || []).forEach((steps, piece) => {
      if (steps <= 0 || steps >= maxSteps) return;
      const pos = cellFor(seat, steps, playerCount, pathLength);
      const key = `${pos.x},${pos.y}`;
      if (!occupancy.has(key)) occupancy.set(key, []);
      occupancy.get(key).push({ seat, piece });
    });
  });

  const tokenNode = (seat, piece, steps) => {
    const player = players[seat];
    const color = player?.color || COLORS[boardSeatOf(seat, playerCount)];
    const finished = steps >= maxSteps;
    const size = finished ? finishedTokenSize : tokenSize;
    let x;
    let y;
    if (steps <= 0) {
      const pos = yardCellFor(seat, piece, playerCount);
      x = (pos.x + 0.5) * CELL_SIZE - size / 2;
      y = (pos.y + 0.5) * CELL_SIZE - size / 2;
    } else if (finished) {
      // The last square is under the dice: line finished tokens up along the
      // outer edge of their colour's triangle instead.
      const end = cellFor(seat, maxSteps, playerCount, pathLength);
      const dirX = Math.sign(end.x - 7);
      const dirY = Math.sign(end.y - 7);
      const done = (pieces[seat] || []).map((s, i) => (s >= maxSteps ? i : -1)).filter((i) => i >= 0);
      const slot = Math.max(0, done.indexOf(piece));
      const spread = (slot - (done.length - 1) / 2) * FINISHED_TOKEN_GAP_CELLS;
      x = (7.5 + dirX * FINISHED_TOKEN_BAND_CELLS + (dirX === 0 ? spread : 0)) * CELL_SIZE - size / 2;
      y = (7.5 + dirY * FINISHED_TOKEN_BAND_CELLS + (dirY === 0 ? spread : 0)) * CELL_SIZE - size / 2;
    } else {
      const pos = cellFor(seat, steps, playerCount, pathLength);
      x = (pos.x + 0.5) * CELL_SIZE - size / 2;
      y = (pos.y + 0.5) * CELL_SIZE - size / 2;
      const group = occupancy.get(`${pos.x},${pos.y}`) || [];
      const at = group.findIndex((g) => g.seat === seat && g.piece === piece);
      const { dx, dy } = tokenOffset(at >= 0 ? at : group.length, group.length, CELL_SIZE);
      x += dx;
      y += dy;
    }
    x = Math.round(x);
    y = Math.round(y);
    const canMove = seat === current && myMovable.has(piece);
    const pad = finished ? 0 : metrics.narrow ? 12 : 4;
    const isMoving = moving && moving.seat === seat && moving.piece === piece;
    const avatar = player?.avatar;
    return (
      <div
        key={`token-${seat}-${piece}`}
        style={{
          position: "absolute",
          left: `${x - pad}px`,
          top: `${y - pad}px`,
          width: `${size + pad * 2}px`,
          height: `${size + pad * 2}px`,
          zIndex: finished ? 60 : isMoving ? 120 : canMove ? 100 : 10,
          pointerEvents: "auto",
          transition: `left ${Math.min(stepMs, 160)}ms ease, top ${Math.min(stepMs, 160)}ms ease`,
          willChange: "left, top",
        }}
      >
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            event.preventDefault();
            if (canMove) movePiece(piece);
          }}
          disabled={!canMove}
          aria-label={`Piece ${piece + 1} of ${PLAYER_NAMES[boardSeatOf(seat, playerCount)]}`}
          style={{
            width: "100%",
            height: "100%",
            borderRadius: "50%",
            background: "transparent",
            border: "none",
            outline: "none",
            appearance: "none",
            WebkitAppearance: "none",
            position: "relative",
            overflow: "visible",
            cursor: canMove ? "pointer" : "default",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          <div
            key={`hop-${x}-${y}`}
            className="ludo-token-hop"
            style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
          >
            <div
              style={{
                position: "absolute",
                left: `${pad}px`,
                top: `${pad}px`,
                width: `${size}px`,
                height: `${size}px`,
                borderRadius: "50%",
                background: `radial-gradient(circle at 35% 30%, ${adjustHexColor(color, 35)}, ${color} 55%, ${adjustHexColor(color, -25)})`,
                border: `2.5px solid ${adjustHexColor(color, -40)}`,
                boxShadow: `0 3px 0 ${adjustHexColor(color, -45)}, 0 6px 12px rgba(0,0,0,0.35)`,
                overflow: "hidden",
                animation: canMove
                  ? "ludo-token-pulse 900ms ease-in-out infinite, ludo-token-glow 1200ms ease-in-out infinite"
                  : "none",
                pointerEvents: "none",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: 3,
                  border: "2px solid rgba(255,255,255,0.55)",
                  borderRadius: size / 2 - 3,
                  pointerEvents: "none",
                }}
              />
              {avatar ? (
                <img
                  src={avatar}
                  alt={player?.name || "avatar"}
                  style={{
                    position: "absolute",
                    left: "50%",
                    top: "50%",
                    transform: "translate(-50%, -50%)",
                    width: size * 0.68,
                    height: size * 0.68,
                    borderRadius: (size * 0.68) / 2,
                    objectFit: "cover",
                    pointerEvents: "none",
                    border: "1.5px solid rgba(255,255,255,0.7)",
                  }}
                />
              ) : null}
            </div>
          </div>
        </button>
      </div>
    );
  };

  const offlinePeers = playing
    ? players
        .map((seat, index) => ({ seat, index }))
        .filter(({ seat, index }) => index !== mySeat && seat.kind === "human" && seat.isOffline)
    : [];
  const diceSize = Math.round(CELL_SIZE * CENTER_DICE_CELLS);
  const avatarSize = metrics.mobile ? Math.min(56, BOARD_SIZE * 0.14) : Math.min(80, BOARD_SIZE * 0.15);
  const joinedCount = players.filter((p) => p.kind !== "open").length;
  const editingSeat = editing != null ? players[editing] : null;
  const winnerPlayer = winnerToShow != null ? players[winnerToShow] : null;
  const subtitle =
    state.mode === "computer" ? "Vs computer" : state.mode === "local" ? "Pass & play" : "Online match";

  return (
    <div
      className="ludo-root"
      style={{ "--ludo-board-size": `${BOARD_SIZE}px` }}
      onPointerDown={resumeAudioFromGesture}
      onTouchStart={resumeAudioFromGesture}
    >
      <AnimatedBackground />
      <GameHeader
        gameStarted
        gameId={gameId}
        subtitle={subtitle}
        isDebug={isDebug}
        isSpecialUser={isSpecialUser}
        controlMode={controlMode}
        onResetGame={isHost && !isOnlineGame && !lobby ? () => setShowRestartConfirm(true) : undefined}
        onExitGame={() => setShowLeaveConfirm(true)}
        onTriggerDebugCelebration={() => fx.playSound("win")}
        onToggleControlMode={() => setControlMode((v) => !v)}
        onPlaySound={fx.playSound}
        gameEnded={ended}
        gamePaused={paused}
        pauseDisabled={!playing || !isMember || busyAction}
        onPauseGame={isMember && playing ? pauseGame : undefined}
      />

      {showDicePicker && (
        <div
          className="ludo-modal-backdrop"
          role="presentation"
          onClick={() => {
            setShowDicePicker(false);
            roll();
          }}
        >
          <div
            className="ludo-modal ludo-dice-picker"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ludo-dice-picker-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="ludo-modal__close"
              onClick={() => {
                setShowDicePicker(false);
                roll();
              }}
              aria-label="Close and roll a random value"
            >
              ×
            </button>
            <h2 id="ludo-dice-picker-title" className="ludo-modal__title">
              Choose Dice Value
            </h2>
            <p className="ludo-modal__subtitle">
              {otherHumans ? "Online games always roll randomly" : "Select a value, or close to roll randomly"}
            </p>
            <div className="ludo-dice-picker__grid">
              {[1, 2, 3, 4, 5, 6].map((value) => (
                <button
                  key={value}
                  type="button"
                  className="ludo-dice-picker__button"
                  onClick={() => {
                    setShowDicePicker(false);
                    roll(value);
                  }}
                  aria-label={`Roll ${value}`}
                >
                  <DiceSVG value={value} size={64} strokeColor="#2ec4b6" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <PendingInvitesBanner
        pendingInvites={invites.invites.filter((i) => String(i.gameId) !== String(gameId))}
        onDismissInvite={invites.decline}
        onAcceptInvite={invites.accept}
      />

      <div
        className="ludo-stage"
        style={{ paddingLeft: metrics.padding, paddingRight: metrics.padding }}
      >
        {notice && (
          <div className="ludo-notice" role="alert" style={{ maxWidth: BOARD_SIZE }}>
            {notice}
          </div>
        )}
        {!isMember && !showJoinPrompt && (
          <div className="ludo-peer-banner" role="status" style={{ maxWidth: BOARD_SIZE }}>
            <span className="ludo-peer-banner__text">You're watching this game.</span>
          </div>
        )}
        {offlinePeers.length > 0 && (
          <div
            className="ludo-peer-banner"
            data-testid="ludo-peer-offline"
            role="status"
            aria-live="polite"
            style={{ maxWidth: BOARD_SIZE }}
          >
            <span className="ludo-spinner ludo-spinner--sm" aria-hidden="true" />
            <span className="ludo-peer-banner__text">
              {offlinePeers.map(({ seat }) => seat.name || "A player").join(", ")}{" "}
              {offlinePeers.length === 1 ? "is" : "are"} away. Their turns are skipped until they're back.
            </span>
            {isHost &&
              offlinePeers.map(({ index }) => (
                <button
                  key={`peer-bot-${index}`}
                  type="button"
                  className="ludo-btn ludo-btn--sm ludo-peer-banner__btn"
                  onClick={() => replaceWithComputer(index)}
                >
                  Use computer
                </button>
              ))}
          </div>
        )}

        <div className={`ludo-board-wrap${fx.boardFx ? ` ${fx.boardFx}` : ""}`} style={{ width: BOARD_SIZE, height: BOARD_SIZE }}>
          <FunFxLayer bursts={fx.fxBursts} onDone={fx.removeFxBurst} />
          <PausedOverlay
            pause={
              paused
                ? { profileId: state.pausedBy?.profileId, name: state.pausedBy?.name, at: state.pausedAt }
                : null
            }
            isMine={Boolean(paused && String(state.pausedBy?.profileId) === String(me))}
            canResume={isMember}
            onlineMode={isOnlineGame}
            resumeDenied={false}
            onResume={resumeGame}
            onSaveAndExit={saveAndExit}
          />
          <GameBoard size={BOARD_SIZE} cellSize={CELL_SIZE} players={players} playerCount={playerCount} />
          <div className="ludo-tokens" style={{ width: `${BOARD_SIZE}px`, height: `${BOARD_SIZE}px` }}>
            {renderOrder.map((seat) => (pieces[seat] || []).map((steps, piece) => tokenNode(seat, piece, steps)))}
          </div>

          {lobby && (
            <div className="ludo-overlay">
              <div className="ludo-card">
                <div className="ludo-card__title">{isHost ? "Waiting for players…" : "Waiting for others…"}</div>
                <div className="ludo-card__body">
                  {isHost
                    ? "Invites sent. The match starts when everyone joins."
                    : "The match starts when all players have joined."}
                </div>
                <div className="ludo-muted" style={{ marginBottom: 8 }}>
                  Joined {joinedCount}/{playerCount}
                </div>
                <div className="ludo-seat-list">
                  {players.map((seat, i) => {
                    const joined = seat.kind !== "open";
                    const photo = seat.avatar || seat.invited?.avatar;
                    return (
                      <div key={`seatstat-${i}`} className="ludo-seat">
                        <div className="ludo-seat__avatar">
                          {photo ? <img src={photo} alt="" /> : <span>{PLAYER_LETTERS[i] || "P"}</span>}
                        </div>
                        <div className="ludo-seat__name">{seat.name || `Seat ${i + 1}`}</div>
                        <div
                          className={`ludo-seat__badge ${joined ? "ludo-seat__badge--joined" : "ludo-seat__badge--waiting"}`}
                        >
                          {seat.kind === "bot"
                            ? "Computer"
                            : joined
                              ? "Joined"
                              : seat.invited
                                ? `Invited: ${seat.invited.name}`
                                : "Waiting…"}
                        </div>
                        {isHost && seat.kind === "open" && (
                          <button
                            type="button"
                            className="ludo-btn ludo-btn--sm ludo-btn--ghost"
                            onClick={() => openEditor(i)}
                          >
                            {seat.invited ? "Change" : "Invite"}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
                {isHost && (
                  <button
                    type="button"
                    className="ludo-btn ludo-btn--primary ludo-btn--block ludo-waiting-replace"
                    onClick={async () => {
                      setBusyAction(true);
                      report(await actions.start());
                      setBusyAction(false);
                    }}
                    disabled={busyAction}
                  >
                    {busyAction ? "Starting game…" : "Replace with computer"}
                  </button>
                )}
              </div>
            </div>
          )}

          {(connectionHealth !== "ok" || joinInfo.status === "error") && (
            <div className="ludo-overlay" data-testid="ludo-reconnecting" role="status" aria-live="polite">
              <div className="ludo-card">
                <div className="ludo-spinner" />
                <div className="ludo-card__title">Reconnecting…</div>
                <div className="ludo-card__body">
                  {connectionHealth === "slow"
                    ? "Your connection is slow. Moves are paused until it recovers."
                    : "Connection lost. Your game is saved on the server and resumes automatically."}
                </div>
                <button type="button" className="ludo-btn ludo-btn--ghost ludo-btn--sm" onClick={exitToMenu}>
                  Back to Ludo
                </button>
              </div>
            </div>
          )}

          <div className={`ludo-dice-hit ${dice.showing && !canTapDice ? "ludo-dice-hit--low" : ""} ${canTapDice ? "ludo-dice-hit--active" : ""}`}>
            <button
              type="button"
              className={`ludo-dice-btn ${canTapDice ? "ludo-dice-btn--ready" : ""}`}
              onClick={onDiceClick}
              disabled={!canTapDice}
              aria-label={canTapDice ? "Roll dice" : "Dice"}
            >
              <div style={{ width: diceSize, height: diceSize, perspective: "800px" }}>
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {!dice.showing ? (
                    <img
                      src={currentSeat?.avatar || siteConfig.logo}
                      alt="current player"
                      className="ludo-center-avatar"
                      style={{
                        width: avatarSize,
                        height: avatarSize,
                        objectFit: currentSeat?.avatar ? "cover" : "contain",
                        border: `3px solid ${currentSeat?.color || "#2ec4b6"}`,
                      }}
                    />
                  ) : (
                    <Dice3D
                      value={dice.value || 1}
                      size={diceSize}
                      strokeColor={players[diceOwner]?.color || "#2ec4b6"}
                      rolling={dice.rolling}
                      rotation={diceRotation}
                      durationMs={DICE_TUMBLE_MS}
                    />
                  )}
                </div>
              </div>
            </button>
          </div>
        </div>

        <div className="ludo-dock" style={{ maxWidth: BOARD_SIZE }}>
          <div className="ludo-dock__label">Current Turn</div>
          <div className="ludo-turn" style={{ background: currentSeat?.color || "#2ec4b6" }}>
            {currentSeat?.avatar ? (
              <img src={currentSeat.avatar} alt="" className="ludo-turn__avatar" />
            ) : (
              <div className="ludo-turn__avatar ludo-turn__avatar--empty" />
            )}
            <div className="ludo-turn__name">{currentSeat?.name || "Player"}</div>
            <div className="ludo-turn__hint">{turnHint}</div>
          </div>

          <div className="ludo-players-row">
            {renderOrder.map((idx) => (
              <button
                key={`pbtn-${idx}`}
                type="button"
                className={`ludo-player-chip ${idx === current ? "ludo-player-chip--active" : ""} ${
                  isSpeakingUid(players[idx]?.profileId) ? "ludo-player-chip--speaking" : ""
                } ${players[idx]?.isOffline ? "ludo-player-chip--away" : ""}`}
                style={{ background: players[idx]?.color }}
                onClick={() => openEditor(idx)}
                title={`${players[idx]?.name || "Player"}${players[idx]?.isOffline ? " (away)" : ""}`}
                aria-label={`Edit ${players[idx]?.name || "player"}`}
              >
                {players[idx]?.avatar ? (
                  <img src={players[idx].avatar} alt="" />
                ) : (
                  <span className="ludo-player-chip__letter">{PLAYER_LETTERS[idx] || "P"}</span>
                )}
              </button>
            ))}
          </div>

          <div className="ludo-toolbar">
            {otherHumans && isMember && (
              <button
                type="button"
                className={`ludo-tool ${micOn ? "ludo-tool--on" : "ludo-tool--muted"}`}
                onClick={() => {
                  fx.playSound("buttonClick");
                  toggleMic();
                }}
                disabled={voiceConnecting}
                title={
                  voiceError
                    ? String(voiceError)
                    : voiceConnecting
                      ? "Connecting voice…"
                      : micOn
                        ? "Mute microphone"
                        : "Unmute microphone"
                }
                aria-pressed={micOn}
                aria-label={micOn ? "Mute microphone" : "Unmute microphone"}
              >
                <span className="ludo-tool__icon" aria-hidden="true">
                  <LudoIcon name={micOn ? "mic" : "micOff"} />
                </span>
                <span className="ludo-tool__dot" />
                <span className="ludo-tool__label">{voiceConnecting ? "Voice…" : micOn ? "Mic On" : "Mic Off"}</span>
              </button>
            )}
            <button
              type="button"
              className={`ludo-tool ${fx.soundsEnabled ? "ludo-tool--on" : ""}`}
              onClick={() => {
                fx.setSoundsEnabled(!fx.soundsEnabled);
                if (!fx.soundsEnabled) fx.playSound("buttonClick");
              }}
              title={fx.soundsEnabled ? "Disable sounds" : "Enable sounds"}
            >
              <span className="ludo-tool__icon" aria-hidden="true">
                <LudoIcon name={fx.soundsEnabled ? "volume" : "volumeOff"} />
              </span>
              <span className="ludo-tool__dot" />
              <span className="ludo-tool__label">{fx.soundsEnabled ? "Sound On" : "Sound Off"}</span>
            </button>
            <button
              type="button"
              className="ludo-tool"
              onClick={async () => {
                fx.playSound("buttonClick");
                report(await actions.reload());
              }}
              title="Reload the game from the server"
            >
              <span className="ludo-tool__icon" aria-hidden="true">
                <LudoIcon name="refresh" />
              </span>
              <span className="ludo-tool__label">Reload</span>
            </button>
            <button
              type="button"
              className="ludo-tool"
              onClick={() => {
                fx.playSound("buttonClick");
                const s = conn.socketRef.current;
                if (s) {
                  s.disconnect();
                  s.connect();
                }
              }}
              title="Reconnect to the game server"
            >
              <span className="ludo-tool__icon" aria-hidden="true">
                <LudoIcon name="reconnect" />
              </span>
              <span className="ludo-tool__label">Reconnect</span>
            </button>
            {isHost && isOnlineGame && (
              <button
                type="button"
                className="ludo-tool"
                onClick={async () => {
                  fx.playSound("buttonClick");
                  const result = report(await actions.reinvite());
                  if (result?.ok) {
                    setNotice(result.sent ? `Re-invited ${result.sent} player${result.sent === 1 ? "" : "s"}.` : "Everyone is already here.");
                  }
                }}
                title="Invite away players back to this game"
              >
                <span className="ludo-tool__icon" aria-hidden="true">
                  <LudoIcon name="invite" />
                </span>
                <span className="ludo-tool__label">Re-invite</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <WinnerModal
        winner={winnerPlayer && !ended ? winnerPlayer : null}
        gameEnded={ended}
        onContinueGame={() => setWinnerToShow(null)}
        onEndGame={() => {
          setWinnerToShow(null);
          exitToMenu();
        }}
      />

      <IncomingInviteModal
        inviteRequest={
          showJoinPrompt
            ? {
                gameId,
                name: players[0]?.name,
                avatar: players[0]?.avatar,
                playerCount,
                slotIndex: Math.max(
                  0,
                  players.findIndex((p) => p.kind === "open" && (!p.invited || String(p.invited.profileId) === String(me))),
                ),
              }
            : null
        }
        onAccept={async (invite) => {
          markInviteHandled(gameId, state.hostId);
          report(await actions.accept(invite?.slotIndex));
        }}
        onDecline={async () => {
          await actions.decline();
          exitToMenu();
        }}
      />

      {showLeaveConfirm && (
        <div className="ludo-modal-backdrop" role="presentation" onClick={() => setShowLeaveConfirm(false)}>
          <div
            className="ludo-modal ludo-leave-confirm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ludo-leave-title"
            data-testid="leave-confirm"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="ludo-leave-title" className="ludo-modal__title">
              Leave this game?
            </h2>
            <p className="ludo-modal__subtitle">
              {!isMember
                ? "You'll stop watching this game."
                : isHost
                  ? isOnlineGame
                    ? "You're the host — the match ends for everyone who joined. To finish it later, use Pause → Save & exit."
                    : "This game will be deleted. To finish it later, use Pause → Save & exit."
                  : "You'll leave the match; a computer takes over your seat."}
            </p>
            <div className="ludo-leave-confirm__actions">
              <button type="button" className="ludo-btn ludo-btn--ghost" onClick={() => setShowLeaveConfirm(false)} autoFocus>
                Stay
              </button>
              <button
                type="button"
                className="ludo-btn ludo-btn--danger"
                data-testid="leave-confirm-yes"
                onClick={isMember ? confirmLeave : () => navigate("/")}
              >
                Leave game
              </button>
            </div>
          </div>
        </div>
      )}

      {showRestartConfirm && (
        <div className="ludo-modal-backdrop" role="presentation" onClick={() => setShowRestartConfirm(false)}>
          <div
            className="ludo-modal ludo-leave-confirm"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="ludo-modal__title">Restart from the beginning?</h2>
            <p className="ludo-modal__subtitle">This game is replaced by a new one with the same players.</p>
            <div className="ludo-leave-confirm__actions">
              <button type="button" className="ludo-btn ludo-btn--ghost" onClick={() => setShowRestartConfirm(false)}>
                Cancel
              </button>
              <button type="button" className="ludo-btn ludo-btn--danger" onClick={restartGame}>
                Restart
              </button>
            </div>
          </div>
        </div>
      )}

      <ConnectionStatus socket={conn.socket} onlineMode gameStarted={playing} gameEnded={ended} />

      <PlayerEditorModal
        show={editing != null}
        editingPlayerIndex={editing}
        player={editingSeat}
        editName={editName}
        editAvatarUrl={editAvatar}
        inviteCopied={inviteCopied}
        avatarFileInputRef={avatarFileInputRef}
        onNameChange={setEditName}
        onAvatarUrlChange={setEditAvatar}
        onPickAvatarFile={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (event) => setEditAvatar(event.target.result);
          reader.readAsDataURL(file);
        }}
        onCopyInviteLink={copyInviteLink}
        onClose={closeEditor}
        onSave={saveEditor}
        connectSearchQuery={search.query}
        loadingSearch={search.loading}
        searchResults={search.results}
        connectList={search.list}
        onConnectSearchChange={search.onChange}
        onAssignConnectToSlot={async (connect, slotIndex) => {
          if (!isHost) return;
          report(await actions.invite(connect._id, slotIndex));
        }}
        onPlaySound={fx.playSound}
        canReplaceWithComputer={isHost && Number(editing) > 0 && !ended}
        onReplaceWithComputer={() => replaceWithComputer(editing)}
      />
    </div>
  );
};

// ================================================================== page

const LudoGame = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const myProfile = useSelector((state) => state.profile);
  const me = myProfile?._id ? String(myProfile._id) : "";
  const conn = useLudoSocket(me || null);
  const gameId = gameIdFromPath(location.pathname);
  const fx = useSoundFx();
  const [notice, setNoticeState] = useState("");
  const noticeTimerRef = useRef(null);
  const setNotice = useCallback((text) => {
    clearTimeout(noticeTimerRef.current);
    setNoticeState(text || "");
    if (text) noticeTimerRef.current = setTimeout(() => setNoticeState(""), NOTICE_MS);
  }, []);
  useEffect(() => () => clearTimeout(noticeTimerRef.current), []);

  const invites = useInvites({
    socket: conn.socket,
    connected: conn.connected,
    me,
    currentGameId: gameId,
    playSound: fx.playSound,
    onAccept: (invite) => {
      markInviteHandled(invite.gameId, invite.from);
      resolveLudoInviteNotifications(invite.gameId, invite.from);
      navigate(ludoPath(invite.gameId), { state: { acceptInvite: { slotIndex: invite.slotIndex } } });
    },
  });

  if (!me) {
    return (
      <div className="ludo-root">
        <AnimatedBackground />
        <div className="ludo-idle">
          <div className="ludo-idle__title">Ludo Classic</div>
          <div className="ludo-idle__copy">Sign in to play Ludo.</div>
        </div>
      </div>
    );
  }

  const shared = { conn, me, myProfile, fx, invites, notice, setNotice };
  return gameId ? <BoardScreen key={gameId} gameId={gameId} {...shared} /> : <MenuScreen {...shared} />;
};

export default LudoGame;
