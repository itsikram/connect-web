import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import { useSelector } from "react-redux";
import api from "../../api/api";
import siteConfig from "../../config/config.json";
import { io } from "socket.io-client";
import { getSocketUrl } from "../../utils/offlineUtils";
import { unlockAudio, playTone, resumeAudioFromGesture } from "../../utils/audioUnlock";

// Import extracted modules
import {
  COLORS,
  PLAYER_NAMES,
  PLAYER_EMOJIS,
  PLAYER_LETTERS,
  PATHS,
  HOME_POSITIONS,
  STEP_DURATION_MS,
  HOME_COLUMN_LENGTH,
  BOARD_GRID_STROKE,
  BOARD_OUTER_STROKE,
} from "./constants/gameConstants";
import "./LudoGame.css";
import { adjustHexColor } from "./utils/colorUtils";
import {
  getMaxSteps,
  getPieceSteps,
} from "./utils/gameLogic";
import {
  saveGameStateToDB,
  loadGameStateFromDB,
  saveGameStateToLocalStorage,
  loadGameStateFromLocalStorage,
  clearGameStateFromLocalStorage,
} from "./utils/gameState";
import {
  getSocketBaseUrl,
  emitSocket,
  generateGameId,
  createInviteToken,
} from "./utils/socketHelpers";
import { DiceSVG, Dice3D, DICE_LAND_ROTATION } from "./components/DiceSVG";
import { AnimatedBackground } from "./components/AnimatedBackground";
import { WinnerConfetti } from "./components/WinnerConfetti";
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
import { useAudio } from "./hooks/useAudio";
import { useLudoVoice } from "./hooks/useLudoVoice";
import { showLudoInviteToast } from "../../utils/toastUtils";
import {
  shouldShowLudoInviteAlert,
  markInviteHandled,
  setActiveLudoGameId,
  clearActiveLudoGameId,
  clearHandledLudoInvites,
  resolveLudoInviteNotifications,
} from "../../utils/ludoInviteUtils";

const getBoardSeatIndex = (playerIndex, playerCount) =>
  Number(playerCount) === 2 && Number(playerIndex) === 1
    ? 3
    : Number(playerIndex);

const getPlayerIndexForBoardSeat = (boardSeatIndex, playerCount) => {
  if (Number(playerCount) === 2) {
    if (Number(boardSeatIndex) === 0) return 0;
    if (Number(boardSeatIndex) === 3) return 1;
    return null;
  }
  return Number(boardSeatIndex) < Number(playerCount)
    ? Number(boardSeatIndex)
    : null;
};

const applyPieceLifecycle = (piece, steps, maxStepsValue) => {
  const safeSteps = Number.isFinite(Number(steps))
    ? Math.max(0, Math.trunc(Number(steps)))
    : 0;
  piece.steps = safeSteps;
  piece.isHome = safeSteps === 0;
  piece.isInPlay = safeSteps > 0 && safeSteps < maxStepsValue;
  return piece;
};

const isHomeColumnSteps = (steps, maxStepsValue) => {
  const homeStart = maxStepsValue - (HOME_COLUMN_LENGTH - 1);
  return steps >= homeStart && steps <= maxStepsValue;
};

/**
 * LudoGame Component
 *
 * Web port of the React Native Ludo game with matching functions and logic.
 * Handles both offline and online multiplayer gameplay with real-time synchronization.
 *
 * @component
 */
const LudoGame = () => {
  // ============================================================================
  // SECTION 1: LAYOUT & RESPONSIVE CALCULATIONS
  // ============================================================================

  /**
   * Get current window dimensions
   */
  const getWindowSize = () => ({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  const [winSize, setWinSize] = useState(getWindowSize());

  // Update window size on resize
  useEffect(() => {
    const handleResize = () => setWinSize(getWindowSize());
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Board size calculations for responsive design (reserves chrome for header + dock)
  const isCompactLayout = winSize.width <= 768;
  const RESPONSIVE_PADDING_MIN = 8;
  const RESPONSIVE_PADDING_MAX = 20;
  const BOARD_SIZE_MAX = isCompactLayout ? 520 : 600;
  const BOARD_SIZE_MIN = isCompactLayout ? 280 : 300;
  const AVAILABLE_WIDTH_MIN = 200;
  const AVAILABLE_HEIGHT_MIN = 200;
  const BOARD_CELLS = 15; // 15x15 grid
  const CHROME_HEIGHT = isCompactLayout ? 210 : 230; // header + dock + gaps

  const responsivePadding = Math.min(
    RESPONSIVE_PADDING_MAX,
    Math.max(RESPONSIVE_PADDING_MIN, winSize.width * 0.04),
  );
  const totalPadding = responsivePadding * 2;

  const availableWidth = Math.max(
    AVAILABLE_WIDTH_MIN,
    winSize.width - totalPadding,
  );
  const availableHeight = Math.max(
    AVAILABLE_HEIGHT_MIN,
    winSize.height - CHROME_HEIGHT,
  );

  const calculatedBoardSize = Math.min(
    availableWidth,
    availableHeight,
    BOARD_SIZE_MAX,
  );

  const BOARD_SIZE = Math.round(
    Math.max(
      Math.min(BOARD_SIZE_MIN, availableWidth),
      Math.min(BOARD_SIZE_MAX, calculatedBoardSize),
    ),
  );
  const CELL_SIZE = BOARD_SIZE / BOARD_CELLS;

  // ============================================================================
  // SECTION 2: GAME CONSTANTS & CONFIGURATION
  // ============================================================================

  // Game constants from extracted modules
  const colors = COLORS;
  const playerNames = PLAYER_NAMES;
  const playerEmojis = PLAYER_EMOJIS;

  // Maximum steps a piece can take (prevents overruns near home)
  const maxSteps = useMemo(() => getMaxSteps(), []);

  // ============================================================================
  // SECTION 3: CORE GAME STATE
  // ============================================================================

  // User profile from Redux store
  const myProfile = useSelector((state) => state.profile);

  // Game state
  const [players, setPlayers] = useState([]);
  const [currentPlayer, setCurrentPlayer] = useState(0);
  const [diceValue, setDiceValue] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameEnded, setGameEnded] = useState(false);
  const [canRollDice, setCanRollDice] = useState(true);
  const [showPlayerSelection, setShowPlayerSelection] = useState(false);
  const [selectedPlayerCount, setSelectedPlayerCount] = useState(4);

  // Winner state
  const [winner, setWinner] = useState(null);
  const [winners, setWinners] = useState([]);
  const [showWinnerModal, setShowWinnerModal] = useState(false);

  // Consecutive sixes tracking (prevents unlimited 6s)
  const [consecutiveSixes, setConsecutiveSixes] = useState({});
  const consecutiveSixesRef = useRef({});

  // ============================================================================
  // SECTION 4: STATE REFS (for synchronous access in event handlers)
  // ============================================================================

  // Refs to avoid re-binding socket listeners and ensure synchronous access
  const playersRef = useRef(players);
  const currentPlayerRef = useRef(currentPlayer);
  const selectedPlayerCountRef = useRef(selectedPlayerCount);
  const winnersRef = useRef(winners);
  const maxStepsRef = useRef(0);
  const diceValueRef = useRef(diceValue);
  const gameStartedRef = useRef(gameStarted);
  const gameEndedRef = useRef(gameEnded);
  const canRollDiceRef = useRef(true);

  // Timing and synchronization refs
  const lastDiceValueRef = useRef(0);
  const lastLocalDiceRollTimeRef = useRef(0);
  const lastBroadcastRef = useRef(0);
  const lastTurnAdvanceTimeRef = useRef(0);
  const lastCanRollDiceUpdateRef = useRef({
    value: false,
    timestamp: 0,
    reason: "",
  });
  const currentPlayerUpdatedFromServerRef = useRef(false);
  const autoStartTriggeredRef = useRef(false);
  const recentMovesRef = useRef(new Map()); // pieceKey -> { toSteps, timestamp }
  const justKeptTurnRef = useRef({}); // playerIndex -> { value, ts } - tracks recent keep-turn events
  const latestSentPlayersSeqRef = useRef(0);
  const latestAppliedPlayersSeqRef = useRef(0);
  const selfHealPlayersGetRequestRef = useRef({ gameId: null, timestamp: 0 });
  const lastPlayersGetRequestRef = useRef({ gameId: null, timestamp: 0 });
  const lastInviteSyncRequestRef = useRef({ timestamp: 0 });
  // ============================================================================
  // SECTION 5: ONLINE MULTIPLAYER STATE
  // ============================================================================

  // Online mode and connection
  const [onlineMode, setOnlineMode] = useState(false);
  const [playWithComputer, setPlayWithComputer] = useState(false);
  const [gameId, setGameId] = useState(null);
  const [myPlayerIndex, setMyPlayerIndex] = useState(0);
  const [waitingForPlayers, setWaitingForPlayers] = useState(false);
  const [isReplacingWaitingPlayers, setIsReplacingWaitingPlayers] =
    useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [showReconnectModal, setShowReconnectModal] = useState(false);
  const [disconnectedPlayers, setDisconnectedPlayers] = useState(new Set());

  // Friend selection and invites
  const [selectedFriends, setSelectedFriends] = useState([]);
  const [friendSearchQuery, setFriendSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [friendList, setFriendList] = useState([]);

  // Robust friend search handler (debounced, tolerant of API shapes)
  const onChangeFriendSearch = (text) => {
    try {
      setFriendSearchQuery(text);
    } catch (_e) {}

    // Clear any pending timeout
    try {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
        searchTimeoutRef.current = null;
      }
    } catch (_e) {}

    const q = (text || "").trim();

    // If query too short, clear results
    if (q.length < 2) {
      setSearchResults([]);
      setLoadingSearch(false);
      console.log("Clearing search results - text too short");
      return;
    }

    setLoadingSearch(true);
    console.log("Setting up search timeout for:", q);

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        console.log("Starting search for:", q);
        // Prefer a GET with query param, but be tolerant of API differences
        let res;
        try {
          res = await api.get(`/search?input=${encodeURIComponent(q)}`);
        } catch (e) {
          // fallback to param style
          try {
            res = await api.get("/search", { params: { input: q } });
          } catch (_e) {
            throw e;
          }
        }

        // Normalize response shapes
        let users = [];
        const body = res && (res.data || res);
        if (Array.isArray(body)) {
          users = body;
        } else if (Array.isArray(body.users)) {
          users = body.users;
        } else if (Array.isArray(body.data)) {
          users = body.data;
        } else if (Array.isArray(res?.users)) {
          users = res.users;
        }

        setSearchResults(users || []);
      } catch (_e) {
        console.error("Friend search error:", _e);
        setSearchResults([]);
      } finally {
        setLoadingSearch(false);
        try {
          if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
            searchTimeoutRef.current = null;
          }
        } catch (_e) {}
      }
    }, 300);
  };

  // Invite management
  const [invitedStatusByFriendId, setInvitedStatusByFriendId] = useState({});
  const [invitedSlotByFriendId, setInvitedSlotByFriendId] = useState({});
  const [incomingInvite, setIncomingInvite] = useState(null);
  const [incomingInviteRequest, setIncomingInviteRequest] = useState(null);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [joinedGames, setJoinedGames] = useState([]);
  const [lastInviter, setLastInviter] = useState(null);

  // Online multiplayer refs
  const invitedStatusByFriendIdRef = useRef({});
  const invitedSlotByFriendIdRef = useRef({});
  const inviteTimestampsRef = useRef({});
  const searchTimeoutRef = useRef(null);
  const inviteHandlersAttachedRef = useRef(false);
  const isSavingGameStateRef = useRef(false);
  const shownInviteToastsRef = useRef(new Map());
  const joinedGamesRef = useRef([]);
  const gameIdRef = useRef(null);
  const newGameDraftIdRef = useRef(null);
  const gameSessionVersionRef = useRef(0);
  const myPlayerIndexRef = useRef(0);
  const pendingPersistRequestRef = useRef(null);
  const persistRequestVersionRef = useRef(0);
  const awaitingAuthoritativeSnapshotRef = useRef(false);
  // ============================================================================
  // SECTION 6: PLAYER EDITOR STATE
  // ============================================================================

  const [showPlayerEditor, setShowPlayerEditor] = useState(false);
  const [editingPlayerIndex, setEditingPlayerIndex] = useState(null);
  const [editName, setEditName] = useState("");
  const [editAvatarUrl, setEditAvatarUrl] = useState("");
  const avatarFileInputRef = useRef(null);

  // ============================================================================
  // SECTION 7: SOCKET & CONNECTION STATE
  // ============================================================================

  const socketRef = useRef(null);
  const socketCreatingRef = useRef(false);
  const socketEventsAttachedRef = useRef(false);
  const pendingConnectActionsRef = useRef(new Map());
  const savedGameStateRef = useRef(null);
  const hasProcessedReconnectionStateRef = useRef(false);
  const isRestoringFromServerRef = useRef(false);
  const isJoiningViaInviteRef = useRef(false);
  const inviteAcceptTimestampRef = useRef(0);
  const lastJoinRequestRef = useRef({ gameId: null, timestamp: 0 });
  const acceptIncomingInviteRef = useRef(null);
  // Guard to prevent duplicate accept emits from double-tap and to bound retries
  const acceptInFlightRef = useRef(false);

  const wrappedAcceptIncomingInvite = useCallback(
    async (inviteOverride = null) => {
      if (acceptInFlightRef.current) {
        console.log(
          "[LUDO][client] accept already in flight - ignoring duplicate",
        );
        return;
      }
      acceptInFlightRef.current = true;
      const invitePayload = inviteOverride?.gameId
        ? inviteOverride
        : incomingInviteRequest;
      try {
        // Prefer calling the full accept handler if it's been registered
        const HANDLER_WAIT_ATTEMPTS = 5;
        const HANDLER_WAIT_MS = 100;
        let handlerCalled = false;

        if (acceptIncomingInviteRef.current) {
          try {
            await acceptIncomingInviteRef.current(invitePayload);
            handlerCalled = true;
          } catch (err) {
            console.log(
              "[LUDO][client] acceptIncomingInvite threw:",
              err?.message || err,
            );
          }
        } else {
          // Wait briefly for the handler to register (cases where wrapper runs very early)
          for (
            let i = 0;
            i < HANDLER_WAIT_ATTEMPTS && !acceptIncomingInviteRef.current;
            i += 1
          ) {
            await new Promise((res) => setTimeout(res, HANDLER_WAIT_MS));
          }
          if (acceptIncomingInviteRef.current) {
            try {
              await acceptIncomingInviteRef.current(invitePayload);
              handlerCalled = true;
            } catch (err) {
              console.log(
                "[LUDO][client] acceptIncomingInvite threw after wait:",
                err?.message || err,
              );
            }
          }
        }

        // If handler wasn't available after a short wait, fall back to a minimal safe accept emit
        // to avoid losing auto-accepts that fire very early (best-effort fallback).
        if (!handlerCalled) {
          console.log(
            "[LUDO][client] accept handler unavailable - performing minimal fallback accept",
          );
          const payload = invitePayload;
          if (payload) {
            try {
              // Mark joining via invite and invalidate any old asynchronous restore.
              gameSessionVersionRef.current += 1;
              pendingConnectActionsRef.current.clear();
              isJoiningViaInviteRef.current = true;
              hasProcessedReconnectionStateRef.current = true;
              inviteAcceptTimestampRef.current = Date.now();
              setIsReconnecting(false);
              setShowReconnectModal(false);
              clearHiddenBoardGameId();
              markInviteHandled(payload.gameId, payload.from);
              setActiveLudoGameId(payload.gameId);
              resolveLudoInviteNotifications(payload.gameId, payload.from);
              savedGameStateRef.current = null;
              try {
                localStorage.removeItem("ludo_game_state");
              } catch (_e) {}

              setLastInviter({
                id: payload.from,
                name: payload.name,
                avatar: payload.avatar,
              });
              setOnlineMode(true);
              setWaitingForPlayers(true);
              newGameDraftIdRef.current = null;
              gameIdRef.current = payload.gameId;
              latestSentPlayersSeqRef.current = 0;
              latestAppliedPlayersSeqRef.current = 0;
              persistRequestVersionRef.current = 0;
              pendingPersistRequestRef.current = null;
              awaitingAuthoritativeSnapshotRef.current = false;
              recentMovesRef.current.clear();
              gameStartedRef.current = false;
              gameEndedRef.current = false;
              winnersRef.current = [];
              currentPlayerRef.current = 0;
              setGameStarted(false);
              setGameEnded(false);
              setWinners([]);
              setCurrentPlayer(0);
              setDiceValueImmediate(0);
              setGameId(payload.gameId);
              setSelectedPlayerCount(
                [2, 3, 4].includes(payload.playerCount)
                  ? payload.playerCount
                  : selectedPlayerCount,
              );
              if (typeof payload.slotIndex === "number") {
                setMyPlayerIndex(payload.slotIndex);
                myPlayerIndexRef.current = payload.slotIndex;
              }

              // Ensure socket is connected then emit join+accept+players:get as a best-effort fallback
              const doEmit = () => {
                try {
                  if (socketRef.current && socketRef.current.connected) {
                    try {
                      socketRef.current.emit("ludo:join", {
                        gameId: payload.gameId,
                      });
                      console.log(
                        "[ACCEPT_INVITE][fallback] Joined game room",
                        { gameId: payload.gameId },
                      );
                    } catch (_e) {
                      console.error("[ACCEPT_INVITE][fallback] join error", _e);
                    }

                    setTimeout(() => {
                      try {
                        socketRef.current.emit("ludo:accept", {
                          gameId: payload.gameId,
                          slotIndex: payload.slotIndex,
                          friend: {
                            _id: myProfile?._id,
                            fullName: myProfile?.fullName,
                            profilePic: myProfile?.profilePic,
                            coverPic: myProfile?.coverPic,
                          },
                          from: payload.from,
                        });
                        console.log(
                          "[ACCEPT_INVITE][fallback] Sent accept event",
                          {
                            gameId: payload.gameId,
                            slotIndex: payload.slotIndex,
                            friendId: myProfile?._id,
                          },
                        );
                      } catch (_e) {
                        console.error(
                          "[ACCEPT_INVITE][fallback] accept emit error",
                          _e,
                        );
                      }
                    }, 200);

                    setTimeout(() => {
                      try {
                        socketRef.current.emit("ludo:players:get", {
                          gameId: payload.gameId,
                        });
                      } catch (_e) {
                        console.error(
                          "[ACCEPT_INVITE][fallback] players:get error",
                          _e,
                        );
                      }
                    }, 300);

                    setTimeout(() => {
                      try {
                        socketRef.current.emit("ludo:invites:dismiss", {
                          gameId: payload.gameId,
                          by: payload.from,
                        });
                      } catch (_e) {}
                    }, 400);
                  } else {
                    // Schedule retry if socket not yet connected
                    setTimeout(doEmit, 100);
                  }
                } catch (_e) {
                  console.error(
                    "[ACCEPT_INVITE][fallback] unexpected emit flow error",
                    _e,
                  );
                }
              };

              doEmit();

              // Also update local players UI optimistically similar to full accept handler
              initializeGame(
                [2, 3, 4].includes(payload.playerCount)
                  ? payload.playerCount
                  : selectedPlayerCount,
              );
              setPlayers((prev) => {
                const copy = prev.map((p) => ({
                  ...p,
                  pieces: p.pieces.map((pc) => ({ ...pc })),
                }));
                const slot = payload.slotIndex;
                if (copy[slot]) {
                  copy[slot].name = myProfile?.fullName || copy[slot].name;
                  copy[slot].avatar =
                    myProfile?.profilePic || copy[slot].profilePic;
                  copy[slot].cover = myProfile?.coverPic || copy[slot].cover;
                  copy[slot].profileId = myProfile?._id || copy[slot].profileId;
                  copy[slot].isActive = true;
                  copy[slot].isOffline = false;
                }
                if (copy[0] && slot !== 0) {
                  copy[0].name = payload?.name || copy[0].name;
                  if (payload?.avatar) {
                    copy[0].avatar = payload.avatar;
                    copy[0].cover = payload.cover;
                  }
                  copy[0].profileId = payload?.from || copy[0].profileId;
                }
                playersRef.current = copy;
                return copy;
              });
              // Remove the accepted invite from pendingInvites when using fallback path
              try {
                setPendingInvites((prev) =>
                  prev.filter(
                    (i) =>
                      !(
                        String(i.gameId) === String(payload.gameId) &&
                        String(i.from) === String(payload.from)
                      ),
                  ),
                );
              } catch (_e) {}
              // Clear incoming invite UI now that fallback accepted
              try {
                setIncomingInviteRequest(null);
                setWaitingForPlayers(false);
                isJoiningViaInviteRef.current = false;
              } catch (_e) {}
            } catch (e) {
              console.error(
                "[ACCEPT_INVITE][fallback] Error performing minimal accept:",
                e,
              );
              // Reset joining flag on error
              isJoiningViaInviteRef.current = false;
            }
          } else {
            console.log(
              "[LUDO][client] No incomingInviteRequest available for fallback accept",
            );
          }
        }

        // Bounded retry: poll ludo:players:get every ~1s up to 6 attempts until local player appears
        const MAX_ATTEMPTS = 6;
        const myId = myProfile?._id;
        for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
          // Check local playersRef for presence
          const playersList = playersRef.current || players;
          const found = Array.isArray(playersList)
            ? playersList.some(
                (p) => p?.profileId && String(p.profileId) === String(myId),
              )
            : false;
          if (found) {
            console.log(
              "[LUDO][client] Accept confirmed in local players snapshot",
            );
            // Clear incoming invite UI and lobby waiting state now that we see ourselves in players
            try {
              setIncomingInviteRequest(null);
              setWaitingForPlayers(false);
              isJoiningViaInviteRef.current = false;
            } catch (_e) {}
            break;
          }
          try {
            if (socketRef.current && invitePayload?.gameId) {
              socketRef.current.emit("ludo:players:get", {
                gameId: invitePayload.gameId,
              });
              console.log(
                "[LUDO][client] Polling for players snapshot (attempt)",
                attempt + 1,
              );
            }
          } catch (_e) {}
          // Wait ~1s before next attempt
          await new Promise((res) => setTimeout(res, 1000));
        }
      } finally {
        acceptInFlightRef.current = false;
      }
    },
    [gameId, myProfile?._id],
  );

  const HIDDEN_BOARD_GAME_KEY = "ludo_hidden_board_game_id";

  const setHiddenBoardGameId = useCallback((gid) => {
    if (!gid) return;
    try {
      sessionStorage.setItem(HIDDEN_BOARD_GAME_KEY, String(gid));
    } catch (_e) {}
  }, []);

  const getHiddenBoardGameId = useCallback(() => {
    try {
      return sessionStorage.getItem(HIDDEN_BOARD_GAME_KEY) || "";
    } catch (_e) {
      return "";
    }
  }, []);

  const clearHiddenBoardGameId = useCallback(() => {
    try {
      sessionStorage.removeItem(HIDDEN_BOARD_GAME_KEY);
    } catch (_e) {}
  }, []);

  // ============================================================================
  // SECTION 8: DICE & ANIMATION STATE
  // ============================================================================

  const lastRollTimeRef = useRef(0);
  const isRollingRef = useRef(false);
  const moveTimersRef = useRef([]);
  const isMovingRef = useRef(false);
  const isAutoMovingRef = useRef(false);
  const playWithComputerRef = useRef(false);
  const botActingRef = useRef(false);
  const botActingPlayerIndexRef = useRef(null);
  const botTurnTimerRef = useRef(null);

  // Watchdog: recover from stuck rolling/moving state (online snapshot delay
  // or a local home-column auto-move that returned before clearing flags).
  useEffect(() => {
    if (!gameStarted || gameEnded || waitingForPlayers) return;
    const CHECK_INTERVAL_MS = 1000;
    const STUCK_THRESHOLD_MS = 4000;

    const watcher = setInterval(() => {
      try {
        const myIdx = myPlayerIndexRef.current;
        const isMyTurn = onlineMode
          ? typeof myIdx === "number" && currentPlayerRef.current === myIdx
          : !playersRef.current[currentPlayerRef.current]?.isBot;
        const isHostControlledBotTurn = Boolean(
          (onlineMode
            ? myIdx === 0
            : playWithComputerRef.current) &&
            playersRef.current[currentPlayerRef.current]?.isBot,
        );

        const now = Date.now();
        const lastLocalRoll = lastLocalDiceRollTimeRef.current || 0;
        const lastRoll = lastRollTimeRef.current || 0;
        const timeSinceLocalRoll =
          lastLocalRoll > 0 ? now - lastLocalRoll : now - lastRoll;

        const stuckRolling =
          (isMyTurn || isHostControlledBotTurn) &&
          isRollingRef.current === true &&
          diceValueRef.current === 0;

        const stuckMoving =
          (isMyTurn || isHostControlledBotTurn) &&
          (isMovingRef.current || isAutoMovingRef.current) &&
          timeSinceLocalRoll > STUCK_THRESHOLD_MS;

        if (
          (stuckRolling && timeSinceLocalRoll > STUCK_THRESHOLD_MS) ||
          stuckMoving
        ) {
          console.log(
            "[WATCHDOG] Detected stuck rolling/move state - forcing recovery",
            {
              gameId,
              myIdx,
              currentPlayer: currentPlayerRef.current,
              diceValue: diceValueRef.current,
              isRolling: isRollingRef.current,
              isMoving: isMovingRef.current,
              isAutoMoving: isAutoMovingRef.current,
              timeSinceLocalRoll,
            },
          );

          // Force-clear the moving/rolling refs and timers
          try {
            isRollingRef.current = false;
            isMovingRef.current = false;
            isAutoMovingRef.current = false;
            // Clear any pending move timers
            try {
              (moveTimersRef.current || []).forEach((t) => clearTimeout(t));
            } catch (_e) {}
            moveTimersRef.current = [];

            // Online recovery must wait for the requested authoritative
            // snapshot; never unlock a roll from stale local refs.
            if (!onlineMode) {
              setCanRollDice(true);
            } else {
              setCanRollDice(false);
              awaitingAuthoritativeSnapshotRef.current = true;
            }
            setDiceValueImmediate(0);
            lastLocalDiceRollTimeRef.current = 0;

            // Ask server for authoritative players snapshot to reconcile state
            if (socketRef.current && gameId) {
              try {
                socketRef.current.emit("ludo:players:get", { gameId });
                console.log(
                  "[WATCHDOG] Requested players snapshot to reconcile after forced recovery",
                  { gameId },
                );
              } catch (_e) {
                console.error("[WATCHDOG] Error emitting players:get", _e);
              }
            }
          } catch (err) {
            console.error("[WATCHDOG] Error while forcing recovery", err);
          }
        }
      } catch (err) {
        console.error("[WATCHDOG] Unexpected error in watchdog loop", err);
      }
    }, CHECK_INTERVAL_MS);

    return () => clearInterval(watcher);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onlineMode, gameStarted, gameEnded, waitingForPlayers, gameId]);

  // ============================================================================
  // SECTION 9: SOUND EFFECTS
  // ============================================================================

  const [soundsEnabled, setSoundsEnabled] = useState(true);
  const {
    micOn,
    voiceConnecting,
    voiceError,
    toggleMic,
    isSpeakingUid,
  } = useLudoVoice({
    enabled: Boolean(onlineMode && gameId && !gameEnded && myProfile?._id),
    gameId,
    profileId: myProfile?._id,
  });
  const [rollingFace, setRollingFace] = useState(1);
  const [diceRotation, setDiceRotation] = useState({ x: 0, y: 0, z: 0 });
  const diceRotationRef = useRef({ x: 0, y: 0, z: 0 });
  const soundRefs = useRef({
    diceRoll: null,
    pieceMove: null,
    capture: null,
    win: null,
    turnChange: null,
    buttonClick: null,
    pieceOut: null,
  });

  // Initialize audio for iOS PWA: keep a shared context and resume on gestures.
  useEffect(() => {
    if (typeof window === "undefined") return;

    soundRefs.current = {
      diceRoll: null,
      pieceMove: null,
      capture: null,
      win: null,
      turnChange: null,
      buttonClick: null,
      pieceOut: null,
    };

    resumeAudioFromGesture();
    unlockAudio().catch(() => {});

    const resumeOnForeground = () => {
      if (document.visibilityState === "hidden") return;
      resumeAudioFromGesture();
    };
    document.addEventListener("visibilitychange", resumeOnForeground);
    window.addEventListener("pageshow", resumeOnForeground);
    window.addEventListener("focus", resumeOnForeground);

    return () => {
      document.removeEventListener("visibilitychange", resumeOnForeground);
      window.removeEventListener("pageshow", resumeOnForeground);
      window.removeEventListener("focus", resumeOnForeground);
    };
  }, []);

  const playSound = useCallback(
    (soundType, options = {}) => {
      if (!soundsEnabled) return;

      resumeAudioFromGesture();

      const soundConfigs = {
          diceRoll: {
            frequency: 400,
            duration: 0.2,
            type: "sine",
            volume: 0.45,
          },
          pieceMove: {
            frequency: 300,
            duration: 0.15,
            type: "sine",
            volume: 0.4,
          },
          capture: {
            frequency: 200,
            duration: 0.3,
            type: "square",
            volume: 0.5,
          },
          win: { frequency: 600, duration: 0.5, type: "sine", volume: 0.6 },
          turnChange: {
            frequency: 350,
            duration: 0.2,
            type: "sine",
            volume: 0.4,
          },
          buttonClick: {
            frequency: 500,
            duration: 0.1,
            type: "sine",
            volume: 0.35,
          },
          pieceOut: {
            frequency: 450,
            duration: 0.25,
            type: "sine",
            volume: 0.45,
          },
      };

      const config = soundConfigs[soundType] || soundConfigs.buttonClick;
      playTone({ ...config, ...options }).catch(() => {});
    },
    [soundsEnabled],
  );
  const socketBaseUrl = useMemo(() => {
    try {
      // Use offline utils for fallback
      const url = getSocketUrl();
      const normalized = url.replace(/\/$/, "");
      return normalized;
    } catch (_e) {
      // Fallback to localhost if offline utils fail
      try {
        const loc = window.location;
        const hostname = loc.hostname;
        const protocol = loc.protocol;
        const fallback =
          hostname === "localhost" || hostname === "127.0.0.1"
            ? `${protocol}//localhost:4000`
            : `${protocol}//${hostname}`;
        return fallback.replace(/\/$/, "");
      } catch (_e2) {
        return "http://localhost:4000";
      }
    }
  }, []);

  // Safe helper to emit even if socket is still connecting
  const emitSocket = useCallback((event, payload) => {
    try {
      const s = socketRef.current;
      if (!s) return false;
      const doEmit = () => {
        try {
          s.emit(event, payload);
        } catch (_e) {}
      };
      if (s.connected) {
        doEmit();
        return true;
      }

      const key = `${event}:${JSON.stringify(payload || {})}`;
      if (!pendingConnectActionsRef.current.has(key)) {
        pendingConnectActionsRef.current.set(key, doEmit);
      }
      return true;
    } catch (_e) {
      return false;
    }
  }, []);

  const emitInviteSyncRequest = useCallback(
    (reason = "default") => {
      const socket = socketRef.current;
      if (!socket || !myProfile?._id || !socket.connected) return false;

      const now = Date.now();
      const lastInviteTs = lastInviteSyncRequestRef.current?.timestamp || 0;
      if (now - lastInviteTs < 10000) {
        return false;
      }

      lastInviteSyncRequestRef.current = { timestamp: now, reason };
      try {
        socket.emit("ludo:invites:get");
        return true;
      } catch (_e) {
        return false;
      }
    },
    [myProfile?._id],
  );

  const emitGameStateRefresh = useCallback((gid, opts = {}) => {
    const socket = socketRef.current;
    if (!socket || !gid || !socket.connected) return false;

    const now = Date.now();
    const { includeJoin = true, includePlayers = true } = opts;
    let sent = false;

    if (includeJoin) {
      const lastJoin = lastJoinRequestRef.current;
      const timeSinceLastJoin = now - (lastJoin?.timestamp || 0);
      if (lastJoin?.gameId !== gid || timeSinceLastJoin >= 1000) {
        lastJoinRequestRef.current = { gameId: gid, timestamp: now };
        try {
          socket.emit("ludo:join", { gameId: gid });
          sent = true;
        } catch (_e) {}
      }
    }

    if (includePlayers) {
      const lastRequest = lastPlayersGetRequestRef.current;
      const timeSinceLastRequest = now - (lastRequest?.timestamp || 0);
      if (lastRequest?.gameId !== gid || timeSinceLastRequest >= 2000) {
        lastPlayersGetRequestRef.current = { gameId: gid, timestamp: now };
        try {
          socket.emit("ludo:players:get", { gameId: gid });
          sent = true;
        } catch (_e) {}
      }
    }

    return sent;
  }, []);

  // Helper to properly cleanup socket
  const cleanupSocket = useCallback(() => {
    try {
      if (socketRef.current) {
        // Remove all event listeners
        socketRef.current.removeAllListeners();
        // Disconnect if connected
        if (socketRef.current.connected) {
          socketRef.current.disconnect();
        }
        // Close the connection
        socketRef.current.close();
        socketRef.current = null;
      }
      pendingConnectActionsRef.current.clear();
      socketEventsAttachedRef.current = false;
      // Reset guard flag
      socketCreatingRef.current = false;
    } catch (_e) {
      socketRef.current = null;
      pendingConnectActionsRef.current.clear();
      socketEventsAttachedRef.current = false;
      socketCreatingRef.current = false;
    }
  }, []);

  // Helper to attach socket event listeners (to avoid duplication)
  // Must be defined before ensureSocketConnected
  const attachSocketListeners = useCallback(
    (socket) => {
      if (!socket) return;

      // CRITICAL: Remove any existing listeners before attaching new ones to prevent duplication
      socket.off("error");
      socket.off("connect");
      socket.off("disconnect");
      socket.off("reconnect");
      socket.off("ludo:invite");
      socket.off("ludo:invites");
      socket.off("ludo:games");
      socket.off("ludo:players");
      socket.off("ludo:move");
      socket.off("ludo:roll");
      socket.off("ludo:accepted");
      socket.off("ludo:player-offline");
      socket.off("ludo:player-online");
      socket.off("ludo:player-left");
      socket.off("ludo:game-removed");
      socket.off("ludo:joined");

      socketEventsAttachedRef.current = true;

      socket.on("error", (err) => {
        console.error("[SOCKET] Error:", err);
      });

      socket.on("connect", () => {
        emitInviteSyncRequest("connect");
        try {
          for (const [
            key,
            action,
          ] of pendingConnectActionsRef.current.entries()) {
            try {
              action();
            } catch (_e) {}
            pendingConnectActionsRef.current.delete(key);
          }
        } catch (_e) {}
      });

      socket.on("disconnect", (reason) => {
        // If we were in an online game, show reconnect option
        // CRITICAL: Only show reconnection if we were actually in a started game
        // Don't show it if we're just joining (accepting invite) - check if game was actually started
        // Also don't show it if we're waiting for players (lobby state)
        const activeGameId = gameIdRef.current;
        const timeSinceInviteAccept =
          Date.now() - inviteAcceptTimestampRef.current;
        const inviteJoinGracePeriodActive =
          isJoiningViaInviteRef.current ||
          (inviteAcceptTimestampRef.current > 0 &&
            timeSinceInviteAccept < 15000);

        const wasInActiveGame =
          activeGameId &&
          gameStartedRef.current &&
          !gameEndedRef.current &&
          !inviteJoinGracePeriodActive;
        const isInLobby =
          activeGameId && !gameStartedRef.current && waitingForPlayers;

        if (wasInActiveGame && !isInLobby) {
          console.log(
            "[SOCKET] Disconnected from active game, will show reconnect modal",
            { reason },
          );
          setIsReconnecting(true);
          hasProcessedReconnectionStateRef.current = false; // Reset for new reconnection
          // Auto-attempt reconnect after a short delay
          setTimeout(() => {
            if (socketRef.current && !socketRef.current.connected) {
              setShowReconnectModal(true);
            }
          }, 2000);
        } else {
          // Disconnected but not in active game, ignoring
          // Clear any existing reconnecting state if we're in lobby
          if (isInLobby) {
            setIsReconnecting(false);
            setShowReconnectModal(false);
          }
        }
      });

      socket.on("reconnect", (attemptNumber) => {
        setIsReconnecting(false);
        setShowReconnectModal(false);
        if (
          isJoiningViaInviteRef.current ||
          (inviteAcceptTimestampRef.current > 0 &&
            Date.now() - inviteAcceptTimestampRef.current < 15000)
        ) {
          return;
        }
        // Auto-rejoin game if we have one
        const gidToRejoin = gameIdRef.current;
        if (gidToRejoin) {
          const now = Date.now();
          const lastJoin = lastJoinRequestRef.current;
          const timeSinceLastJoin = now - (lastJoin?.timestamp || 0);
          const MIN_JOIN_INTERVAL = 1000;

          if (
            lastJoin?.gameId !== gidToRejoin ||
            timeSinceLastJoin >= MIN_JOIN_INTERVAL
          ) {
            lastJoinRequestRef.current = {
              gameId: gidToRejoin,
              timestamp: now,
            };
          }

          emitGameStateRefresh(gidToRejoin, {
            includeJoin:
              lastJoin?.gameId !== gidToRejoin ||
              timeSinceLastJoin >= MIN_JOIN_INTERVAL,
            includePlayers: true,
          });

          // Restore only when there is no active room identity. The render-time
          // gameId can be stale immediately after creating/accepting a new game.
          if (savedGameStateRef.current && !gameIdRef.current) {
            gameIdRef.current = savedGameStateRef.current.gameId;
            setGameId(savedGameStateRef.current.gameId);
            setMyPlayerIndex(savedGameStateRef.current.myPlayerIndex || 0);
            setOnlineMode(true);
            if (savedGameStateRef.current.selectedPlayerCount) {
              setSelectedPlayerCount(
                savedGameStateRef.current.selectedPlayerCount,
              );
            }
          }
        }
      });

      socket.on("reconnect_attempt", (attemptNumber) => {
        if (
          isJoiningViaInviteRef.current ||
          (inviteAcceptTimestampRef.current > 0 &&
            Date.now() - inviteAcceptTimestampRef.current < 15000)
        ) {
          setIsReconnecting(false);
          setShowReconnectModal(false);
          return;
        }
        // Only set reconnecting if we were actually in a started game
        // Don't set if we're in lobby waiting for players
        const activeGameId = gameIdRef.current || gameId;
        const isInLobby =
          onlineMode && activeGameId && !gameStarted && waitingForPlayers;
        if (
          onlineMode &&
          activeGameId &&
          gameStarted &&
          gameStartedRef.current &&
          !isInLobby
        ) {
          setIsReconnecting(true);
          hasProcessedReconnectionStateRef.current = false; // Reset for new reconnection
        } else if (isInLobby) {
          // Clear reconnecting state if we're in lobby
          setIsReconnecting(false);
          setShowReconnectModal(false);
        }
      });

      socket.on("reconnect_error", (error) => {});

      socket.on("reconnect_failed", () => {
        setIsReconnecting(false);
        if (
          !isJoiningViaInviteRef.current &&
          !(
            inviteAcceptTimestampRef.current > 0 &&
            Date.now() - inviteAcceptTimestampRef.current < 15000
          ) &&
          onlineMode &&
          (gameIdRef.current || gameId) &&
          gameStarted
        ) {
          setShowReconnectModal(true);
        }
      });
    },
    [onlineMode, gameId, gameStarted, gameEnded],
  );

  // Ensure socket connection (used before game start for invites)
  // Must be defined before attemptReconnect to avoid TDZ error
  const ensureSocketConnected = useCallback(() => {
    try {
      if (!myProfile?._id) return;

      // Prevent multiple simultaneous socket creation attempts
      if (socketCreatingRef.current) {
        return;
      }

      // If socket exists and is connected, return early
      if (socketRef.current && socketRef.current.connected) {
        return;
      }

      // If socket exists but not connected, cleanup first
      if (socketRef.current && !socketRef.current.connected) {
        cleanupSocket();
      }

      // Set guard flag
      socketCreatingRef.current = true;

      // Create new socket
      const socketPath = "/socket.io";
      const opts = {
        transports: ["websocket", "polling"],
        path: socketPath,
        query: { profile: myProfile?._id },
        timeout: 40000,
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        forceNew: false, // Changed to false to reuse connection if possible
        withCredentials: true,
      };

      const newSocket = io(socketBaseUrl, opts);
      socketRef.current = newSocket;
      socketEventsAttachedRef.current = false;

      try {
        newSocket.on("connect_error", (err) => {
          // Fallbacks: try window.origin if different; then try :4000 if on :3000
          try {
            const origin = window.location.origin.replace(/\/$/, "");
            const currentBase = (socketBaseUrl || "").replace(/\/$/, "");
            const isLocal3000 =
              /localhost|127\.|::1/.test(window.location.hostname) &&
              String(window.location.port) === "3000";
            const alt4000 = `${window.location.protocol}//${window.location.hostname}:4000`;

            if (
              !newSocket.__triedFallback &&
              origin &&
              currentBase &&
              origin !== currentBase
            ) {
              newSocket.__triedFallback = true;
              // Cleanup old socket before creating new one
              const oldSocket = socketRef.current;
              if (oldSocket) {
                oldSocket.removeAllListeners();
                if (oldSocket.connected) oldSocket.disconnect();
                oldSocket.close();
              }
              // Create new socket with fallback URL
              const fallbackSocket = io(origin, opts);
              socketRef.current = fallbackSocket;
              socketEventsAttachedRef.current = false;
              // Re-attach event listeners to new socket
              attachSocketListeners(fallbackSocket);
              // Clear guard flag after fallback
              setTimeout(() => {
                socketCreatingRef.current = false;
              }, 1000);
              return;
            }

            if (!newSocket.__triedDev4000 && isLocal3000) {
              newSocket.__triedDev4000 = true;
              // Cleanup old socket before creating new one
              const oldSocket = socketRef.current;
              if (oldSocket) {
                oldSocket.removeAllListeners();
                if (oldSocket.connected) oldSocket.disconnect();
                oldSocket.close();
              }
              // Create new socket with fallback URL
              const fallbackSocket = io(alt4000, opts);
              socketRef.current = fallbackSocket;
              socketEventsAttachedRef.current = false;
              // Re-attach event listeners to new socket
              attachSocketListeners(fallbackSocket);
              // Clear guard flag after fallback
              setTimeout(() => {
                socketCreatingRef.current = false;
              }, 1000);
            }
          } catch (_e3) {}
        });

        attachSocketListeners(newSocket);
      } catch (_e) {}

      // Clear guard flag after a short delay to allow connection to establish
      setTimeout(() => {
        socketCreatingRef.current = false;
      }, 1000);
    } catch (_e) {
      socketCreatingRef.current = false;
    }
  }, [
    myProfile?._id,
    socketBaseUrl,
    onlineMode,
    gameId,
    gameStarted,
    gameEnded,
    cleanupSocket,
    attachSocketListeners,
  ]);

  const requestJoinedGames = useCallback(() => {
    if (!myProfile?._id) return;

    ensureSocketConnected();

    const emitGamesGet = () => {
      try {
        socketRef.current?.emit("ludo:games:get");
        console.log("[LUDO] Requested joined games");
      } catch (_e) {}
    };

    if (socketRef.current?.connected) {
      emitGamesGet();
    } else if (socketRef.current) {
      pendingConnectActionsRef.current.set("ludo:games:get", emitGamesGet);
    }
  }, [myProfile?._id, ensureSocketConnected]);

  useEffect(() => {
    playersRef.current = players;
  }, [players]);
  useEffect(() => {
    playWithComputerRef.current = playWithComputer;
  }, [playWithComputer]);
  useEffect(() => {
    currentPlayerRef.current = currentPlayer;
  }, [currentPlayer]);
  useEffect(() => {
    myPlayerIndexRef.current = myPlayerIndex;
  }, [myPlayerIndex]);
  useEffect(() => {
    selectedPlayerCountRef.current = selectedPlayerCount;
  }, [selectedPlayerCount]);
  useEffect(() => {
    winnersRef.current = winners;
  }, [winners]);
  useEffect(() => {
    consecutiveSixesRef.current = consecutiveSixes;
  }, [consecutiveSixes]);
  useEffect(() => {
    invitedStatusByFriendIdRef.current = invitedStatusByFriendId;
  }, [invitedStatusByFriendId]);
  useEffect(() => {
    invitedSlotByFriendIdRef.current = invitedSlotByFriendId;
  }, [invitedSlotByFriendId]);
  useEffect(() => {
    maxStepsRef.current = maxSteps;
  }, [maxSteps]);
  // CRITICAL: Keep all refs synced with state to avoid race conditions
  useEffect(() => {
    diceValueRef.current = diceValue;
  }, [diceValue]);
  useEffect(() => {
    currentPlayerRef.current = currentPlayer;
  }, [currentPlayer]);
  useEffect(() => {
    canRollDiceRef.current = canRollDice;
    lastCanRollDiceUpdateRef.current = {
      value: canRollDice,
      timestamp: Date.now(),
      reason: "state-update",
    };
  }, [canRollDice]);

  const setDiceValueImmediate = useCallback((value) => {
    setDiceValue(value);
    diceValueRef.current = value;
    lastDiceValueRef.current = value;
  }, []);

  const setCurrentPlayerImmediate = useCallback((value) => {
    setCurrentPlayer(value);
    currentPlayerRef.current = value;
    lastTurnAdvanceTimeRef.current = Date.now();
    lastCanRollDiceUpdateRef.current = {
      value: false,
      timestamp: Date.now(),
      reason: "turn-changed",
    };
    // CRITICAL: Reset consecutive 6s when turn changes (only for the next player, not current)
    // The previous player's count stays until their next turn
    // Note: We don't reset here anymore since 6s reset happens in onRoll handler
  }, []);

  useEffect(() => {
    gameStartedRef.current = gameStarted;
  }, [gameStarted]);
  useEffect(() => {
    gameEndedRef.current = gameEnded;
  }, [gameEnded]);

  // ============================================================================
  // SECTION 10: DEBUG & SPECIAL FEATURES
  // ============================================================================

  /**
   * Check if running in debug mode (localhost)
   */
  const isDebug = useMemo(() => {
    try {
      return /localhost|127\.0\.0\.1/.test(window.location.hostname);
    } catch (_e) {
      return false;
    }
  }, []);

  /**
   * Control mode enables choosing the next dice value for testing.
   */
  const [controlMode, setControlMode] = useState(false);
  const [showDiceValueModal, setShowDiceValueModal] = useState(false);
  const [debugPlayerIndex, setDebugPlayerIndex] = useState(0);
  const [debugPieceIndex, setDebugPieceIndex] = useState(0);
  const [debugSteps, setDebugSteps] = useState("");

  /**
   * Check if current user is a special user (has access to control mode)
   */
  const isSpecialUser = useMemo(() => {
    return myProfile?._id === "67bf1e4009395add03e1e234";
  }, [myProfile?._id]);

  /**
   * Check if it's the current player's turn
   */
  const isMyTurn = useMemo(() => {
    if (!onlineMode && !playWithComputer) {
      return !players[currentPlayer]?.isBot;
    }
    return currentPlayer === myPlayerIndex;
  }, [onlineMode, playWithComputer, currentPlayer, myPlayerIndex, players]);

  // ============================================================================
  // SECTION 11: GAME LOGIC HELPERS
  // ============================================================================

  /**
   * Get the next active player in turn order
   * Turn order: 4 players = Red -> Green -> Yellow -> Blue (0,1,3,2)
   *             2/3 logical players = [0,1] or [0,1,2]. In two-player
   *             matches logical player 1 is rendered at opposite board seat 3.
   *
   * @param {number} fromIndex - Current player index
   * @returns {number} Next active player index
   */
  const getNextActivePlayer = useCallback(
    (fromIndex) => {
      const PLAYER_ORDER_4 = [0, 1, 3, 2]; // Red, Green, Yellow, Blue
      const PLAYER_ORDER_2_3 = [0, 1, 2]; // Red, Green, Blue

      const baseOrder =
        selectedPlayerCount === 4
          ? PLAYER_ORDER_4
          : PLAYER_ORDER_2_3.slice(0, selectedPlayerCount);

      if (baseOrder.length === 0) return fromIndex;

      let currentIndex = baseOrder.indexOf(fromIndex);
      if (currentIndex === -1) currentIndex = 0;

      // Find next active player (skip offline players and winners)
      let attempts = 0;
      while (attempts < baseOrder.length) {
        currentIndex = (currentIndex + 1) % baseOrder.length;
        const candidateIndex = baseOrder[currentIndex];
        const player =
          playersRef.current?.[candidateIndex] || players[candidateIndex];

        const hasWon = winners.some((w) => w.id === candidateIndex);
        const isOffline = player?.isOffline && !player?.isBot;

        if (!hasWon && !isOffline) {
          return candidateIndex;
        }
        attempts++;
      }

      return fromIndex;
    },
    [selectedPlayerCount, winners, players],
  );

  /**
   * Player rendering order (matches dice sequence)
   */
  const renderPlayerOrder = useMemo(() => {
    const ORDER_4_PLAYERS = [0, 1, 3, 2];
    const ORDER_2_3_PLAYERS = [0, 1, 2];

    return selectedPlayerCount === 4
      ? ORDER_4_PLAYERS
      : ORDER_2_3_PLAYERS.slice(0, selectedPlayerCount);
  }, [selectedPlayerCount]);

  /**
   * Animation timing for piece movement
   */
  const stepDurationMs = STEP_DURATION_MS;
  const DICE_ROLL_ANIMATION_MS = 950;
  const AUTO_MOVE_DELAY_MS = 120;
  const TURN_TRANSITION_DELAY_MS = 200;
  const ROLL_UNLOCK_DELAY_MS = 100;
  const SIX_LIMIT_TRANSITION_DELAY_MS = 500;
  const ONLINE_MOVE_COMPLETION_MAX_MS = 100;

  // Cleanup move timers on unmount
  useEffect(
    () => () => {
      moveTimersRef.current.forEach((timer) => clearTimeout(timer));
    },
    [],
  );

  // Helpers (identical logic) - memoized for performance
  const getPositionOnPath = useCallback(
    (playerIndex, steps) => {
      const boardSeatIndex = getBoardSeatIndex(
        playerIndex,
        selectedPlayerCount,
      );
      const path = PATHS[boardSeatIndex];
      if (!path || steps <= 0 || steps > path.length) {
        return { x: 7, y: 7 };
      }
      return path[steps - 1];
    },
    [selectedPlayerCount],
  );

  // Safe zones - cannot capture here. Includes entry squares to home columns and classic star squares (board coordinates).
  const SAFE_CELLS = useMemo(() => {
    const cells = [
      // Entry squares to home columns (classic safe)
      [1, 6], // red entry
      [8, 1], // green entry
      [6, 13], // blue entry
      [13, 8], // yellow entry
      // Start squares (also treated safe)
      [7, 13], // red start
      [13, 7], // green start
      [7, 2], // blue start
      [2, 7], // yellow start
    ];
    Object.values(PATHS).forEach((path) => {
      if (!Array.isArray(path)) return;
      path.slice(-HOME_COLUMN_LENGTH).forEach((p) => {
        cells.push([p.x, p.y]);
      });
    });
    const map = new Set(cells.map(([x, y]) => `${x},${y}`));
    return map;
  }, []);

  const isSafePosition = (_playerIndex, position) => {
    return SAFE_CELLS.has(`${position.x},${position.y}`);
  };

  /**
   * Check if a move results in capturing opponent pieces
   *
   * @param {number} movingPlayerIndex - Index of the player making the move
   * @param {{x: number, y: number}} newPosition - New position of the moving piece
   * @param {number} movingPieceNewSteps - New step count of the moving piece
   * @returns {Array<{playerIndex: number, pieceIndex: number}>} Array of captured pieces
   */
  const checkForCapture = (
    movingPlayerIndex,
    newPosition,
    movingPieceNewSteps,
  ) => {
    const srcPlayers =
      playersRef.current && Array.isArray(playersRef.current)
        ? playersRef.current
        : players;
    const captured = [];

    if (isHomeColumnSteps(movingPieceNewSteps, maxSteps)) {
      return captured;
    }

    // Count tokens per player at the target position (including the moving player)
    const tokensAtPosition = new Map(); // playerIndex -> count

    srcPlayers.forEach((player, playerIndex) => {
      let count = 0;
      player.pieces.forEach((piece, pieceIndex) => {
        if (piece.isInPlay) {
          if (piece.steps >= maxSteps) return; // Skip finished pieces
          const piecePosition = getPositionOnPath(playerIndex, piece.steps);
          if (
            piecePosition.x === newPosition.x &&
            piecePosition.y === newPosition.y
          ) {
            count++;
          }
        }
      });
      if (count > 0) {
        tokensAtPosition.set(playerIndex, count);
      }
    });

    // Explicitly ensure the moving piece is counted at the new position
    // This handles cases where state hasn't updated yet or the piece isn't in state
    if (
      typeof movingPieceNewSteps === "number" &&
      movingPieceNewSteps > 0 &&
      movingPieceNewSteps < maxSteps
    ) {
      const movingPiecePosition = getPositionOnPath(
        movingPlayerIndex,
        movingPieceNewSteps,
      );
      if (
        movingPiecePosition.x === newPosition.x &&
        movingPiecePosition.y === newPosition.y
      ) {
        // Check if the moving piece is already counted in the state
        const movingPlayer = srcPlayers[movingPlayerIndex];
        let alreadyCounted = false;
        if (movingPlayer && Array.isArray(movingPlayer.pieces)) {
          alreadyCounted = movingPlayer.pieces.some((piece) => {
            if (piece.isInPlay && piece.steps === movingPieceNewSteps) {
              const pos = getPositionOnPath(movingPlayerIndex, piece.steps);
              return pos.x === newPosition.x && pos.y === newPosition.y;
            }
            return false;
          });
        }
        // Only add if not already counted
        if (!alreadyCounted) {
          const currentCount = tokensAtPosition.get(movingPlayerIndex) || 0;
          tokensAtPosition.set(movingPlayerIndex, currentCount + 1);
        }
      }
    }

    // Get the moving player's token count at the new position
    const movingPlayerTokenCount = tokensAtPosition.get(movingPlayerIndex) || 0;

    // Check captures for each opponent
    tokensAtPosition.forEach((count, playerIndex) => {
      if (playerIndex === movingPlayerIndex) return; // Skip the moving player

      const player = srcPlayers[playerIndex];

      // Find the first piece at this position to check if it's safe
      let firstPieceAtPosition = null;
      for (const piece of player.pieces) {
        if (piece.isInPlay && piece.steps < maxSteps) {
          const piecePosition = getPositionOnPath(playerIndex, piece.steps);
          if (
            piecePosition.x === newPosition.x &&
            piecePosition.y === newPosition.y
          ) {
            firstPieceAtPosition = piecePosition;
            break;
          }
        }
      }

      // Skip safe positions
      if (
        firstPieceAtPosition &&
        isSafePosition(playerIndex, firstPieceAtPosition)
      )
        return;

      // Rule 1: If moving player has 2+ tokens and opponent has 2 tokens, capture both opponent tokens
      if (movingPlayerTokenCount >= 2 && count === 2) {
        // Capture both opponent tokens
        player.pieces.forEach((piece, pieceIndex) => {
          if (piece.isInPlay && piece.steps < maxSteps) {
            const piecePosition = getPositionOnPath(playerIndex, piece.steps);
            if (
              piecePosition.x === newPosition.x &&
              piecePosition.y === newPosition.y
            ) {
              captured.push({ playerIndex, pieceIndex });
            }
          }
        });
      }
      // Rule 2: If moving player has 1 token and opponent has 1 token, capture the opponent's token
      else if (movingPlayerTokenCount === 1 && count === 1) {
        // Capture the single opponent token
        player.pieces.forEach((piece, pieceIndex) => {
          if (piece.isInPlay && piece.steps < maxSteps) {
            const piecePosition = getPositionOnPath(playerIndex, piece.steps);
            if (
              piecePosition.x === newPosition.x &&
              piecePosition.y === newPosition.y
            ) {
              captured.push({ playerIndex, pieceIndex });
            }
          }
        });
      }
      // If moving player has 2+ tokens and opponent has only 1 token, capture the single token
      else if (movingPlayerTokenCount >= 2 && count === 1) {
        // Moving player has double tokens, can capture single opponent token
        player.pieces.forEach((piece, pieceIndex) => {
          if (piece.isInPlay && piece.steps < maxSteps) {
            const piecePosition = getPositionOnPath(playerIndex, piece.steps);
            if (
              piecePosition.x === newPosition.x &&
              piecePosition.y === newPosition.y
            ) {
              captured.push({ playerIndex, pieceIndex });
            }
          }
        });
      }
      // If opponent has 2+ tokens and moving player has 1 token, opponent is safe (no capture)
    });

    return captured;
  };

  // Check for captures when a token moves AWAY from a position (rule 2: friend moves token away)
  /**
   * Check if any pieces can be captured after a piece moves away from a position
   * This handles cases where moving a piece reveals a capture opportunity
   *
   * @param {number} movingPlayerIndex - Index of the player who moved
   * @param {{x: number, y: number}} oldPosition - Previous position of the moved piece
   * @returns {Array<{playerIndex: number, pieceIndex: number}>} Array of pieces that can now be captured
   */
  const checkForCaptureAfterMoveAway = (movingPlayerIndex, oldPosition) => {
    const srcPlayers =
      playersRef.current && Array.isArray(playersRef.current)
        ? playersRef.current
        : players;
    const captured = [];

    // Count tokens per player at the old position (after the move)
    const tokensAtPosition = new Map(); // playerIndex -> count

    srcPlayers.forEach((player, playerIndex) => {
      let count = 0;
      player.pieces.forEach((piece, pieceIndex) => {
        if (piece.isInPlay) {
          if (piece.steps >= maxSteps) return; // Skip finished pieces
          const piecePosition = getPositionOnPath(playerIndex, piece.steps);
          if (
            piecePosition.x === oldPosition.x &&
            piecePosition.y === oldPosition.y
          ) {
            count++;
          }
        }
      });
      if (count > 0) {
        tokensAtPosition.set(playerIndex, count);
      }
    });

    // Check if any player now has a single token that should be captured
    tokensAtPosition.forEach((count, playerIndex) => {
      if (playerIndex === movingPlayerIndex) {
        // Check if moving player left behind tokens that can capture others
        if (count >= 2) {
          // Moving player has 2+ tokens left, can capture single tokens of others
          srcPlayers.forEach((opponent, opponentIndex) => {
            if (opponentIndex === playerIndex) return;
            const opponentCount = tokensAtPosition.get(opponentIndex) || 0;
            if (opponentCount === 1) {
              // Capture the single opponent token
              opponent.pieces.forEach((piece, pieceIndex) => {
                if (piece.isInPlay && piece.steps < maxSteps) {
                  const piecePosition = getPositionOnPath(
                    opponentIndex,
                    piece.steps,
                  );
                  if (
                    piecePosition.x === oldPosition.x &&
                    piecePosition.y === oldPosition.y
                  ) {
                    const position = getPositionOnPath(
                      opponentIndex,
                      piece.steps,
                    );
                    if (!isSafePosition(opponentIndex, position)) {
                      captured.push({ playerIndex: opponentIndex, pieceIndex });
                    }
                  }
                }
              });
            }
          });
        }
      } else {
        // Check if this player's single token should be captured by remaining tokens
        if (count === 1) {
          const movingPlayerRemainingCount =
            tokensAtPosition.get(movingPlayerIndex) || 0;
          if (movingPlayerRemainingCount >= 2) {
            // Moving player left 2+ tokens, can capture this single token
            const player = srcPlayers[playerIndex];
            player.pieces.forEach((piece, pieceIndex) => {
              if (piece.isInPlay && piece.steps < maxSteps) {
                const piecePosition = getPositionOnPath(
                  playerIndex,
                  piece.steps,
                );
                if (
                  piecePosition.x === oldPosition.x &&
                  piecePosition.y === oldPosition.y
                ) {
                  const position = getPositionOnPath(playerIndex, piece.steps);
                  if (!isSafePosition(playerIndex, position)) {
                    captured.push({ playerIndex, pieceIndex });
                  }
                }
              }
            });
          }
        }
      }
    });

    return captured;
  };

  const initializeGame = (
    playerCount = selectedPlayerCount,
    friends = selectedFriends,
  ) => {
    const newPlayers = [];
    const names = [];
    const avatars = [];
    const covers = [];
    names[0] = myProfile?.fullName || "You";
    avatars[0] = myProfile?.profilePic;
    covers[0] =
      myProfile?.coverPic ||
      myProfile?.cover ||
      myProfile?.profileCover ||
      undefined;
    for (let i = 1; i < playerCount; i++) {
      const f = friends[i - 1];
      const boardSeatIndex = getBoardSeatIndex(i, playerCount);
      names[i] = f?.fullName || playerNames[boardSeatIndex];
      avatars[i] = f?.profilePic;
      covers[i] = f?.coverPic || f?.cover || f?.profileCover || undefined;
    }
    for (let i = 0; i < playerCount; i++) {
      const boardSeatIndex = getBoardSeatIndex(i, playerCount);
      const pieces = [];
      for (let j = 0; j < 4; j++) {
        pieces.push({
          id: j,
          color: colors[boardSeatIndex],
          position: { x: 0, y: 0 },
          isHome: true,
          isInPlay: false,
          steps: 0,
        });
      }
      newPlayers.push({
        id: i,
        name: names[i] || playerNames[boardSeatIndex],
        color: colors[boardSeatIndex],
        pieces,
        isActive: i === 0,
        avatar: avatars[i],
        cover: covers[i],
        profileId: i === 0 ? myProfile?._id || "local" : undefined,
      });
    }
    playersRef.current = newPlayers;
    setPlayers(newPlayers);

    // CRITICAL: Initialize consecutive 6s tracking for all players
    const initialConsecutiveSixes = {};
    for (let i = 0; i < playerCount; i++) {
      initialConsecutiveSixes[i] = 0;
    }
    setConsecutiveSixes(initialConsecutiveSixes);
    consecutiveSixesRef.current = initialConsecutiveSixes;
  };

  // Save game state to localStorage for reconnection
  const saveGameState = useCallback(() => {
    try {
      // CRITICAL: Don't save game state when joining via invite (new join, not reconnection)
      // This prevents the reconnection logic from triggering when accepting an invite
      if (isJoiningViaInviteRef.current) {
        // Skipping save - joining via invite
        return;
      }

      if (onlineMode && gameId && myProfile?._id) {
        const state = {
          gameId,
          myPlayerIndex,
          onlineMode,
          selectedPlayerCount,
          profileId: myProfile._id,
          timestamp: Date.now(),
        };
        localStorage.setItem("ludo_game_state", JSON.stringify(state));
        savedGameStateRef.current = state;
      }
    } catch (_e) {
      // Ignore localStorage errors
    }
  }, [onlineMode, gameId, myPlayerIndex, selectedPlayerCount, myProfile?._id]);

  // Load game state from localStorage
  const loadGameState = useCallback(() => {
    try {
      const saved = localStorage.getItem("ludo_game_state");
      if (!saved) return null;
      const state = JSON.parse(saved);
      // Only restore if it's recent (within 24 hours) and belongs to current user
      const isRecent =
        state.timestamp && Date.now() - state.timestamp < 24 * 60 * 60 * 1000;
      const isMyGame =
        state.profileId &&
        myProfile?._id &&
        String(state.profileId) === String(myProfile._id);
      if (isRecent && isMyGame) {
        savedGameStateRef.current = state;
        return state;
      } else {
        // Clear stale state
        localStorage.removeItem("ludo_game_state");
        savedGameStateRef.current = null;
      }
    } catch (_e) {
      localStorage.removeItem("ludo_game_state");
      savedGameStateRef.current = null;
    }
    return null;
  }, [myProfile?._id]);

  // Clear saved game state
  const clearGameState = useCallback(() => {
    try {
      localStorage.removeItem("ludo_game_state");
      savedGameStateRef.current = null;
    } catch (_e) {
      // Ignore errors
    }
  }, []);

  useEffect(() => {
    initializeGame();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Connect socket early at mount (so we can receive invites even if not in online mode yet)
  useEffect(() => {
    // Add a small delay to prevent race conditions on initial mount
    const timer = setTimeout(() => {
      ensureSocketConnected();
    }, 100);
    return () => clearTimeout(timer);
  }, [ensureSocketConnected]);

  // Also connect when profile becomes available (initial load race fix)
  useEffect(() => {
    if (!myProfile?._id) return;
    // Only create socket if it doesn't exist or is not connected
    // Add a small delay to prevent rapid reconnection attempts
    if (!socketRef.current || !socketRef.current.connected) {
      const timer = setTimeout(() => {
        if (!socketRef.current || !socketRef.current.connected) {
          ensureSocketConnected();
        }
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [myProfile?._id, ensureSocketConnected]);

  // Check for pending invite from global handler (Main.js) and auto-accept if needed.
  // This is shared by two triggers:
  //  1. Mount-time check (localStorage may already have an invite if the page
  //     was just navigated to from the notification menu).
  //  2. A "ludo:pendingInviteUpdated" window event fired by Main.js, which is
  //     needed when this component is already mounted (e.g. the user is
  //     already on /ludo-game) so navigate("/ludo-game") is a no-op and would
  //     never re-trigger a mount-only effect.
  const processPendingInviteFromStorage = useCallback(
    (inviteFromEvent) => {
      if (!myProfile?._id) return;

      try {
        const pendingInviteSessionVersion = gameSessionVersionRef.current;
        let pendingInvite = inviteFromEvent || null;
        if (!pendingInvite) {
          const pendingInviteStr = localStorage.getItem("ludo_pending_invite");
          if (!pendingInviteStr) return;
          pendingInvite = JSON.parse(pendingInviteStr);
        }

        if (!pendingInvite || !pendingInvite.autoAccept) {
          // Not an auto-accept invite, clear it
          localStorage.removeItem("ludo_pending_invite");
          return;
        }

        // Clear the pending invite from localStorage immediately to prevent re-processing
        localStorage.removeItem("ludo_pending_invite");

        // Wait a bit for socket to be ready, then set the invite request
        const setPendingInvite = () => {
          if (pendingInviteSessionVersion !== gameSessionVersionRef.current) {
            return;
          }

          if (!socketRef.current) {
            // Socket not ready yet, retry
            setTimeout(setPendingInvite, 200);
            return;
          }

          // Set the invite request - this will trigger the auto-accept effect below
          setIncomingInviteRequest(pendingInvite);
        };

        // Wait for socket connection before setting invite
        if (socketRef.current && socketRef.current.connected) {
          setPendingInvite();
        } else {
          if (socketRef.current) {
            pendingConnectActionsRef.current.set(
              `pending-invite:${pendingInvite.gameId}:${pendingInvite.from}`,
              setPendingInvite,
            );
          } else {
            // Socket doesn't exist yet, wait a bit
            setTimeout(setPendingInvite, 500);
          }
        }
      } catch (error) {
        console.error("[LUDO] Error processing pending invite:", error);
        try {
          localStorage.removeItem("ludo_pending_invite");
        } catch (_e) {
          // Ignore
        }
      }
    },
    [myProfile?._id],
  );

  useEffect(() => {
    processPendingInviteFromStorage();
  }, [processPendingInviteFromStorage]);

  // Listen for invite acceptances triggered while this page is already
  // mounted (e.g. accepted from the notification bell dropdown while the
  // user is already on the Ludo page).
  useEffect(() => {
    const onPendingInviteUpdated = (e) => {
      processPendingInviteFromStorage(e?.detail);
    };
    window.addEventListener(
      "ludo:pendingInviteUpdated",
      onPendingInviteUpdated,
    );
    return () => {
      window.removeEventListener(
        "ludo:pendingInviteUpdated",
        onPendingInviteUpdated,
      );
    };
  }, [processPendingInviteFromStorage]);

  // Auto-accept invite if it has the autoAccept flag (from global handler)
  useEffect(() => {
    if (!incomingInviteRequest || !incomingInviteRequest.autoAccept) return;
    if (!myProfile?._id) return;

    // Small delay to ensure everything is ready
    const timer = setTimeout(() => wrappedAcceptIncomingInvite(), 300);

    return () => clearTimeout(timer);
  }, [incomingInviteRequest, myProfile?._id]);

  // Load saved game state on mount and attempt to reconnect
  useEffect(() => {
    if (!myProfile?._id) return;

    // CRITICAL: Skip reconnection if we're joining via invite (new join, not reconnection)
    // This is THE PRIMARY guard against reconnection modal on invite acceptance
    if (isJoiningViaInviteRef.current) {
      console.log("[RECONNECTION] Skipping - joining via invite");
      return;
    }

    // CRITICAL: Skip reconnection if we recently accepted an invite (within last 15 seconds)
    // This prevents reconnection logic from running when we've just joined a game via invite
    const timeSinceInviteAccept = Date.now() - inviteAcceptTimestampRef.current;
    if (inviteAcceptTimestampRef.current > 0 && timeSinceInviteAccept < 15000) {
      console.log("[RECONNECTION] Skipping - recently accepted invite", {
        timeSinceInviteAccept,
      });
      return;
    }

    // CRITICAL: Skip reconnection if we have an incoming invite request pending
    // This prevents showing reconnecting modal when user is in process of accepting invite
    if (incomingInviteRequest) {
      console.log("[RECONNECTION] Skipping - incoming invite request pending");
      return;
    }

    // CRITICAL: Skip reconnection if we already have a gameId and we're in online mode
    // This prevents reconnection logic from running when we've already joined a game via invite
    if (gameId && onlineMode) {
      console.log(
        "[RECONNECTION] Skipping - already have gameId and in online mode",
      );
      return;
    }

    const attemptReconnection = async () => {
      const restoreSessionVersion = gameSessionVersionRef.current;
      const restoreWasInvalidated = () =>
        restoreSessionVersion !== gameSessionVersionRef.current ||
        isJoiningViaInviteRef.current;

      // First try loading from localStorage
      const savedState = loadGameState();

      // CRITICAL: Check if this game was intentionally hidden from the board.
      if (savedState && savedState.gameId) {
        const hiddenBoardGameId = getHiddenBoardGameId();
        if (
          hiddenBoardGameId &&
          String(hiddenBoardGameId) === String(savedState.gameId) &&
          !isReconnecting
        ) {
          console.log(
            "[RECONNECT] Skipping reconnection - board was intentionally closed:",
            savedState.gameId,
          );
          // Clear the saved state since it's just hidden
          try {
            localStorage.removeItem("ludo_game_state");
            savedGameStateRef.current = null;
          } catch (_e) {}
          return;
        }

        // CRITICAL: Check if this game was explicitly exited by the user
        try {
          const exitedGames = JSON.parse(
            localStorage.getItem("ludo_exited_games") || "[]",
          );
          const gameIdStr = String(savedState.gameId);
          const isExited =
            Array.isArray(exitedGames) &&
            exitedGames.some((gid) => String(gid) === gameIdStr);
          if (isExited) {
            console.log(
              "[RECONNECT] Skipping reconnection - game was explicitly exited:",
              savedState.gameId,
            );
            // Clear the saved state since we're not reconnecting
            try {
              localStorage.removeItem("ludo_game_state");
              savedGameStateRef.current = null;
              // Also clear the exited games list for this game after 30 days or when explicitly exiting
              const exitedGames = JSON.parse(
                localStorage.getItem("ludo_exited_games") || "[]",
              );
              const gameIdStr = String(savedState.gameId);
              const filtered = Array.isArray(exitedGames)
                ? exitedGames.filter((gid) => String(gid) !== gameIdStr)
                : [];
              localStorage.setItem(
                "ludo_exited_games",
                JSON.stringify(filtered),
              );
            } catch (_e) {
              // Ignore errors
            }
            return;
          }
        } catch (_e) {
          // Ignore errors reading exited games list
        }
      }

      // CRITICAL: Skip if we're joining via invite or if we already have a gameId from invite
      if (isJoiningViaInviteRef.current) {
        // Skipping reconnection - joining via invite (checked after load)
        return;
      }

      // CRITICAL: If we already have a gameId set (from accepting invite), don't restore from saved state
      // This prevents restoring an old game when we're joining a new one
      if (
        gameId &&
        savedState &&
        savedState.gameId &&
        savedState.gameId !== gameId
      ) {
        // Skipping reconnection - gameId mismatch (new game joined)
        // Clear the old saved state since we're joining a new game
        try {
          localStorage.removeItem("ludo_game_state");
          savedGameStateRef.current = null;
        } catch (_e) {}
        return;
      }

      // CRITICAL: If we already have a gameId and it matches saved state, but we're not reconnecting,
      // this means we've already joined the game (possibly via invite), so skip restoration
      if (
        gameId &&
        savedState &&
        savedState.gameId === gameId &&
        !isReconnecting
      ) {
        // Skipping reconnection - already joined game, not reconnecting
        // Clear the saved state since we've already loaded it
        try {
          localStorage.removeItem("ludo_game_state");
          savedGameStateRef.current = null;
        } catch (_e) {}
        return;
      }

      if (savedState && savedState.gameId) {
        // Clear transient local action locks before restoring a live game.
        // These refs are not authoritative game state and can stay stuck if the
        // user left during a roll/move animation, which would block dice input
        // forever after restore.
        isRollingRef.current = false;
        isMovingRef.current = false;
        isAutoMovingRef.current = false;
        moveTimersRef.current = [];
        setCanRollDice(false);
        lastRollTimeRef.current = 0;
        lastLocalDiceRollTimeRef.current = 0;

        // Declare dbGameState outside try block so it's accessible throughout the function
        let dbGameState = null;

        // Try to load from database first (more reliable)
        try {
          dbGameState = await loadGameStateFromDB(savedState.gameId);

          const activeGameIdAfterLoad = gameIdRef.current;
          if (
            restoreWasInvalidated() ||
            (activeGameIdAfterLoad &&
              String(activeGameIdAfterLoad) !== String(savedState.gameId))
          ) {
            console.log(
              "[RECONNECT] Ignored old restore after new game selected",
              {
                restoreGameId: savedState.gameId,
                activeGameId: activeGameIdAfterLoad,
              },
            );
            return;
          }

          if (dbGameState) {
            // Database state found - use it to restore game
            // Restoring game state from database:

            // Restore game state from database
            if (dbGameState.players && Array.isArray(dbGameState.players)) {
              setPlayers(dbGameState.players);
              playersRef.current = dbGameState.players;
            }
            if (typeof dbGameState.currentPlayer === "number") {
              setCurrentPlayer(dbGameState.currentPlayer);
              currentPlayerRef.current = dbGameState.currentPlayer;
            }
            if (typeof dbGameState.diceValue === "number") {
              setDiceValueImmediate(dbGameState.diceValue);
            }
            if (typeof dbGameState.gameStarted === "boolean") {
              setGameStarted(dbGameState.gameStarted);
              gameStartedRef.current = dbGameState.gameStarted;
            }
            if (typeof dbGameState.gameEnded === "boolean") {
              setGameEnded(dbGameState.gameEnded);
              gameEndedRef.current = dbGameState.gameEnded;
            }
            if (Array.isArray(dbGameState.winners)) {
              setWinners(dbGameState.winners);
              winnersRef.current = dbGameState.winners;
            }
            if (typeof dbGameState.selectedPlayerCount === "number") {
              setSelectedPlayerCount(dbGameState.selectedPlayerCount);
            }

            // Determine my player index from database state
            const myId = myProfile?._id;
            if (myId && dbGameState.players) {
              const foundIdx = dbGameState.players.findIndex(
                (p) => p?.profileId && String(p.profileId) === String(myId),
              );
              if (foundIdx >= 0) {
                setMyPlayerIndex(foundIdx);
                myPlayerIndexRef.current = foundIdx;
              } else {
                // Fall back to saved state
                setMyPlayerIndex(savedState.myPlayerIndex || 0);
              }
            } else {
              setMyPlayerIndex(savedState.myPlayerIndex || 0);
            }
          } else {
            // No database state, use localStorage state (expected for new games)
            // Silently fall back to localStorage - no need to log expected behavior
          }
        } catch (error) {
          // Only log unexpected errors (404s are handled silently in loadGameStateFromDB)
          if (error.response?.status !== 404) {
            console.debug(
              "Error loading from database, using localStorage:",
              error,
            );
          }
        }

        // Re-check after all async restore work before activating the room.
        if (
          restoreWasInvalidated() ||
          (gameIdRef.current &&
            String(gameIdRef.current) !== String(savedState.gameId))
        ) {
          console.log("[RECONNECT] Cancelled stale reconnection setup", {
            restoreGameId: savedState.gameId,
            activeGameId: gameIdRef.current,
          });
          return;
        }

        // Set up reconnection state
        gameIdRef.current = savedState.gameId;
        setGameId(savedState.gameId);
        if (!dbGameState) {
          setMyPlayerIndex(savedState.myPlayerIndex || 0);
          setOnlineMode(true);
          if (savedState.selectedPlayerCount) {
            setSelectedPlayerCount(savedState.selectedPlayerCount);
          }
        } else {
          setOnlineMode(true);
        }

        // Ensure socket is connected, then rejoin game. Every delayed branch
        // re-checks the session version so starting a new game cannot join the
        // room that was current when this restore was originally scheduled.
        ensureSocketConnected();
        const attemptRejoin = () => {
          if (restoreWasInvalidated()) return;

          if (socketRef.current && socketRef.current.connected) {
            // Prevent multiple join requests
            const now = Date.now();
            const lastJoin = lastJoinRequestRef.current;
            const timeSinceLastJoin = now - lastJoin.timestamp;
            const MIN_JOIN_INTERVAL = 1000;

            if (
              lastJoin.gameId !== savedState.gameId ||
              timeSinceLastJoin >= MIN_JOIN_INTERVAL
            ) {
              lastJoinRequestRef.current = {
                gameId: savedState.gameId,
                timestamp: now,
              };
              try {
                socketRef.current.emit("ludo:join", {
                  gameId: savedState.gameId,
                });

                // Also prevent multiple players:get requests
                const lastRequest = lastPlayersGetRequestRef.current;
                const timeSinceLastRequest = now - lastRequest.timestamp;
                const MIN_REQUEST_INTERVAL = 2000;

                if (
                  lastRequest.gameId !== savedState.gameId ||
                  timeSinceLastRequest >= MIN_REQUEST_INTERVAL
                ) {
                  lastPlayersGetRequestRef.current = {
                    gameId: savedState.gameId,
                    timestamp: now,
                  };
                  socketRef.current.emit("ludo:players:get", {
                    gameId: savedState.gameId,
                  });
                }
              } catch (_e) {
                // Retry after a delay
                setTimeout(attemptRejoin, 1000);
              }
            }
          } else if (socketRef.current) {
            // Wait for connection
            socketRef.current.once("connect", () => {
              if (restoreWasInvalidated()) return;

              // Prevent multiple join requests
              const now = Date.now();
              const lastJoin = lastJoinRequestRef.current;
              const timeSinceLastJoin = now - lastJoin.timestamp;
              const MIN_JOIN_INTERVAL = 1000;

              if (
                lastJoin.gameId !== savedState.gameId ||
                timeSinceLastJoin >= MIN_JOIN_INTERVAL
              ) {
                lastJoinRequestRef.current = {
                  gameId: savedState.gameId,
                  timestamp: now,
                };
                try {
                  socketRef.current.emit("ludo:join", {
                    gameId: savedState.gameId,
                  });

                  // Also prevent multiple players:get requests
                  const lastRequest = lastPlayersGetRequestRef.current;
                  const timeSinceLastRequest = now - lastRequest.timestamp;
                  const MIN_REQUEST_INTERVAL = 2000;

                  if (
                    lastRequest.gameId !== savedState.gameId ||
                    timeSinceLastRequest >= MIN_REQUEST_INTERVAL
                  ) {
                    lastPlayersGetRequestRef.current = {
                      gameId: savedState.gameId,
                      timestamp: now,
                    };
                    socketRef.current.emit("ludo:players:get", {
                      gameId: savedState.gameId,
                    });
                  }
                } catch (_e) {}
              }
            });
          } else {
            // Socket not ready yet, retry
            setTimeout(attemptRejoin, 500);
          }
        };
        setIsReconnecting(true);
        hasProcessedReconnectionStateRef.current = false; // Reset for new reconnection
        setTimeout(attemptRejoin, 300);
      }
    };

    attemptReconnection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    myProfile?._id,
    loadGameState,
    ensureSocketConnected,
    getHiddenBoardGameId,
    isReconnecting,
  ]);

  // Handle visibility change (iPhone lock/unlock) - sync game state when page becomes visible
  useEffect(() => {
    if (!onlineMode || !gameId) return;

    // Shared function to sync game state
    const syncGameState = (source) => {
      // If we're in an active game, only resync when actually reconnecting.
      // During normal live play, focus/visibility events can otherwise replay an
      // older cached snapshot and overwrite a newer local/host state.
      if (gameId && gameStartedRef.current && !gameEnded) {
        const socket = socketRef.current;
        const shouldForceResync =
          isReconnecting ||
          !socket ||
          !socket.connected ||
          source === "PAGESHOW";

        console.log(`[${source}] Syncing game state`, {
          gameId,
          gameStarted: gameStartedRef.current,
          socketConnected: socket?.connected,
          shouldForceResync,
          isReconnecting,
        });

        if (!shouldForceResync) {
          console.log(
            `[${source}] Skipping live resync because socket is already healthy`,
          );
          return;
        }

        // If socket is not connected, ensure it connects
        if (!socket || !socket.connected) {
          console.log(`[${source}] Socket not connected - ensuring connection`);
          ensureSocketConnected();

          // Wait for connection, then request state
          const waitForConnection = () => {
            if (socketRef.current?.connected) {
              // Prevent multiple requests
              const now = Date.now();
              const lastRequest = lastPlayersGetRequestRef.current;
              const timeSinceLastRequest = now - lastRequest.timestamp;
              const MIN_REQUEST_INTERVAL = 1000;

              if (
                lastRequest.gameId !== gameId ||
                timeSinceLastRequest >= MIN_REQUEST_INTERVAL
              ) {
                try {
                  console.log(
                    `[${source}] Requesting latest game state after reconnection`,
                  );
                  emitGameStateRefresh(gameId, {
                    includeJoin: true,
                    includePlayers: true,
                  });
                } catch (e) {
                  console.error(`[${source}] Error requesting game state:`, e);
                }
              }
            } else if (socketRef.current) {
              // Wait for connection
              socketRef.current.once("connect", () => {
                const now = Date.now();
                const lastRequest = lastPlayersGetRequestRef.current;
                const timeSinceLastRequest = now - lastRequest.timestamp;
                const MIN_REQUEST_INTERVAL = 1000;

                if (
                  lastRequest.gameId !== gameId ||
                  timeSinceLastRequest >= MIN_REQUEST_INTERVAL
                ) {
                  try {
                    console.log(
                      `[${source}] Requesting latest game state after connection`,
                    );
                    emitGameStateRefresh(gameId, {
                      includeJoin: true,
                      includePlayers: true,
                    });
                  } catch (e) {
                    console.error(
                      `[${source}] Error requesting game state:`,
                      e,
                    );
                  }
                }
              });
            } else {
              // Retry after a delay
              setTimeout(waitForConnection, 500);
            }
          };

          setTimeout(waitForConnection, 300);
        } else {
          // Connected and explicitly forcing a resync (e.g. pageshow/rejoin)
          const now = Date.now();
          const lastRequest = lastPlayersGetRequestRef.current;
          const timeSinceLastRequest = now - lastRequest.timestamp;
          const MIN_REQUEST_INTERVAL = 1000;

          if (
            lastRequest.gameId !== gameId ||
            timeSinceLastRequest >= MIN_REQUEST_INTERVAL
          ) {
            try {
              console.log(
                `[${source}] Requesting latest game state (forced resync)`,
              );
              emitGameStateRefresh(gameId, {
                includeJoin: true,
                includePlayers: true,
              });
            } catch (e) {
              console.error(`[${source}] Error requesting game state:`, e);
            }
          }
        }
      }
    };

    const handleVisibilityChange = () => {
      // Only handle when page becomes visible (not when it becomes hidden)
      if (document.visibilityState === "visible") {
        syncGameState("VISIBILITY");
      }
    };

    const handlePageShow = (e) => {
      // Handle pageshow event (mobile browsers restore from cache)
      // Only sync if page was restored from cache (not initial load)
      if (e.persisted) {
        syncGameState("PAGESHOW");
      }
    };

    const handleFocus = () => {
      // Backup handler for window focus (some mobile browsers)
      // Only sync if we're in an active game and page is visible
      if (
        gameId &&
        gameStartedRef.current &&
        !gameEnded &&
        document.visibilityState === "visible"
      ) {
        syncGameState("FOCUS");
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pageshow", handlePageShow);
    window.addEventListener("focus", handleFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pageshow", handlePageShow);
      window.removeEventListener("focus", handleFocus);
    };
  }, [onlineMode, gameId, gameEnded, ensureSocketConnected]);

  // Fetch pending invites on connect/profile available
  useEffect(() => {
    if (!socketRef.current || !myProfile?._id) return;
    emitInviteSyncRequest("profile-change");
  }, [myProfile?._id, emitInviteSyncRequest]);

  // Parse invite tokens from URL (?ludoInvite=BASE64) and auto-start / auto-accept
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const token = params.get("ludoInvite");
      if (!token) return;
      const json = atob(token);
      const payload = JSON.parse(json);
      if (payload && payload.type === "ludo_invite") {
        setIncomingInvite(payload);
        const playerCountFromLink =
          payload.playerCount && [2, 3, 4].includes(payload.playerCount)
            ? payload.playerCount
            : undefined;
        if (playerCountFromLink) setSelectedPlayerCount(playerCountFromLink);
        const gid = payload.gameId || generateGameId();
        if (String(gameIdRef.current || "") !== String(gid)) {
          gameSessionVersionRef.current += 1;
          clearGameState();
        }
        gameIdRef.current = gid;
        setGameId(gid);
        setOnlineMode(true);

        const isInviter =
          myProfile?._id &&
          payload.by &&
          String(myProfile._id) === String(payload.by);
        const slotFromLink =
          typeof payload.slotIndex === "number" ? payload.slotIndex : undefined;

        // If current user is NOT the inviter, auto-accept the invite as the friend
        if (!isInviter) {
          ensureSocketConnected();
          const inviteRequest = {
            from: payload.by,
            name: payload.name,
            avatar: payload.avatar,
            cover: payload.cover,
            gameId: gid,
            slotIndex: slotFromLink,
            playerCount: playerCountFromLink,
            reinvite: payload.reinvite === true,
            inviteId: payload.inviteId,
            autoAccept: true,
            viaLink: true,
            ts: payload.ts || Date.now(),
          };
          try {
            localStorage.setItem(
              "ludo_pending_invite",
              JSON.stringify(inviteRequest),
            );
          } catch (_e) {}
          try {
            socketRef.current && socketRef.current.emit("ludo:invites:get");
          } catch (_e) {}
          setIncomingInviteRequest(inviteRequest);
          setTimeout(() => wrappedAcceptIncomingInvite(inviteRequest), 0);
          return;
        }

        // Else, inviter migration: auto-start as host on this device
        if (!gameStarted) {
          setShowPlayerSelection(false);
          setGameStarted(true);
          setCurrentPlayer(0);
          currentPlayerRef.current = 0;
          setDiceValueImmediate(0);
          setWinner(null);
          setCanRollDice(false);
          initializeGame(playerCountFromLink || selectedPlayerCount);
          ensureSocketConnected();
          // Wait for socket to be ready before emitting
          const waitAndEmit = () => {
            if (socketRef.current && socketRef.current.connected) {
              try {
                socketRef.current.emit("ludo:join", { gameId: gid });
                setMyPlayerIndex(0);
                myPlayerIndexRef.current = 0;
                persistAndBroadcastGameState("game_start_auto_link", {
                  gameId: gid,
                });
              } catch (_e) {}
            } else if (socketRef.current) {
              // Wait for connection
              socketRef.current.once("connect", () => {
                try {
                  socketRef.current.emit("ludo:join", { gameId: gid });
                  setMyPlayerIndex(0);
                  myPlayerIndexRef.current = 0;
                  persistAndBroadcastGameState("game_start_auto_link", {
                    gameId: gid,
                  });
                } catch (_e) {}
              });
            }
          };
          setTimeout(waitAndEmit, 100);
        }
      }
    } catch (_e) {}
  }, [gameStarted, myProfile?._id]);

  // Optional: load default friend list when opening player selection
  useEffect(() => {
    if (!showPlayerSelection) return;
    // Attempt to fetch friend list (adjust endpoint as needed)
    (async () => {
      try {
        // Use the search API without query to get all users, then filter friends
        const res = await api.get("/search?input=", { credentials: "include" });
        if (!res.success) {
          setFriendList([]);
          return;
        }
        const data = await res.data;
        // Show all users (no filtering)
        const allUsers = data.users || [];
        setFriendList(allUsers);
      } catch (_e) {
        console.error("Failed to load friend list:", _e);
        setFriendList([]);
      }
    })();
  }, [showPlayerSelection, myProfile?._id]);

  // Compute next open player slot (excluding host at 0)
  const getNextOpenSlot = useCallback(() => {
    const max = Math.max(2, Math.min(4, selectedPlayerCount));
    for (let i = 1; i < max; i++) {
      const p = players[i];
      if (!p) return i;
      if (!p.profileId && !p.isBot) return i;
    }
    return null;
  }, [players, selectedPlayerCount]);

  // Legacy function placeholder - will be defined after emitPlayersStateAfterSave
  let emitPlayersState;

  const removeOfflinePlayer = useCallback(
    (playerIndex) => {
      if (myPlayerIndex !== 0 || !onlineMode || !gameId) return;
      try {
        if (socketRef.current) {
          socketRef.current.emit("ludo:remove:player", { gameId, playerIndex });
        }
      } catch (_e) {}
    },
    [myPlayerIndex, onlineMode, gameId],
  );

  const serializePlayersForSnapshot = useCallback((sourcePlayers = []) => {
    return (Array.isArray(sourcePlayers) ? sourcePlayers : []).map((p) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      avatar: p.avatar,
      cover: p.cover,
      profileId: p.profileId,
      isActive: p.isActive !== undefined ? p.isActive : true,
      isOffline: p.isOffline || false,
      offlineSince: p.offlineSince,
      isBot: p.isBot || false,
      pieces: Array.isArray(p.pieces)
        ? p.pieces.map((pc) => ({
            id: pc.id,
            steps: typeof pc.steps === "number" ? pc.steps : 0,
            isHome: Boolean(pc.isHome),
            isInPlay: Boolean(pc.isInPlay),
            color: pc.color || p.color,
          }))
        : [],
    }));
  }, []);

  const sanitizeWinnersForSnapshot = useCallback((sourceWinners = []) => {
    return (Array.isArray(sourceWinners) ? sourceWinners : []).map((winner) => {
      const cleanWinner = { ...winner };
      if (
        cleanWinner.profileId === "local" ||
        !cleanWinner.profileId ||
        typeof cleanWinner.profileId !== "string" ||
        cleanWinner.profileId.length !== 24
      ) {
        delete cleanWinner.profileId;
      }
      return cleanWinner;
    });
  }, []);

  const buildMinimalGameState = useCallback(
    (overrides = {}, meta = {}) => {
      const nextSeq =
        typeof overrides.playersSeq === "number"
          ? overrides.playersSeq
          : typeof overrides.stateVersion === "number"
            ? overrides.stateVersion
            : latestSentPlayersSeqRef.current + 1;

      const sourcePlayers =
        overrides.players !== undefined
          ? overrides.players
          : playersRef.current;
      const sourceWinners =
        overrides.winners !== undefined
          ? overrides.winners
          : winnersRef.current;

      return {
        gameId: overrides.gameId || gameIdRef.current || gameId,
        players: serializePlayersForSnapshot(sourcePlayers),
        currentPlayer:
          typeof overrides.currentPlayer === "number"
            ? overrides.currentPlayer
            : currentPlayerRef.current,
        diceValue:
          typeof overrides.diceValue === "number"
            ? overrides.diceValue
            : diceValueRef.current || 0,
        gameStarted:
          typeof overrides.gameStarted === "boolean"
            ? overrides.gameStarted
            : Boolean(gameStartedRef.current),
        gameEnded:
          typeof overrides.gameEnded === "boolean"
            ? overrides.gameEnded
            : Boolean(gameEndedRef.current),
        winners: sanitizeWinnersForSnapshot(sourceWinners),
        selectedPlayerCount:
          typeof overrides.selectedPlayerCount === "number"
            ? overrides.selectedPlayerCount
            : selectedPlayerCountRef.current,
        playersSeq: nextSeq,
        stateVersion: nextSeq,
        timestamp: Date.now(),
        lastActionType: meta.actionType || overrides.lastActionType,
        ...(meta.extraMeta || {}),
      };
    },
    [gameId, serializePlayersForSnapshot, sanitizeWinnersForSnapshot],
  );

  // Create initial game state in database (host only) - called when starting a new game
  const createInitialGameState = useCallback(
    async (gid, currentPlayers) => {
      console.log("[LUDO][sync] create initial state requested", {
        gid,
        onlineMode,
        hasProfile: !!myProfile?._id,
        playersCount: currentPlayers?.length,
      });

      if (!onlineMode || !gid || !myProfile?._id) {
        console.log("[LUDO][sync] create initial state skipped", {
          gid,
          onlineMode,
          hasProfile: !!myProfile?._id,
        });
        return false;
      }

      const gameState = buildMinimalGameState(
        {
          gameId: gid,
          players: currentPlayers,
          currentPlayer: 0,
          diceValue: 0,
          gameStarted: false,
          gameEnded: false,
          winners: [],
          selectedPlayerCount: selectedPlayerCountRef.current,
          playersSeq: latestSentPlayersSeqRef.current,
          stateVersion: latestSentPlayersSeqRef.current,
        },
        { actionType: "game_lobby_create" },
      );

      console.log("[LUDO][sync] save started", {
        actionType: "game_lobby_create",
        gameId: gid,
      });
      const result = await saveGameStateToDB(gameState);
      const success = result !== null;
      if (success) {
        console.log("[LUDO][sync] save success", {
          actionType: "game_lobby_create",
          gameId: gid,
        });
      } else {
        console.error("[LUDO][sync] save failed", {
          actionType: "game_lobby_create",
          gameId: gid,
        });
      }
      return success;
    },
    [onlineMode, myProfile?._id, buildMinimalGameState],
  );

  // Save game state to database (host only) - returns saved snapshot or null
  const saveGameStateToDatabase = useCallback(
    async (overrides = {}, meta = {}) => {
      const activeGameId = gameIdRef.current || gameId;
      if (
        myPlayerIndexRef.current !== 0 ||
        !onlineMode ||
        !activeGameId ||
        !myProfile?._id
      ) {
        return null;
      }

      const snapshot = buildMinimalGameState(overrides, {
        actionType: meta.actionType || "save_only",
        extraMeta: meta.extraMeta || {},
      });

      console.log("[LUDO][sync] save started", {
        actionType: snapshot.lastActionType,
        gameId: snapshot.gameId,
        stateVersion: snapshot.stateVersion,
      });
      const result = await saveGameStateToDB(snapshot);
      if (result === null) {
        console.error("[LUDO][sync] save failed", {
          actionType: snapshot.lastActionType,
          gameId: snapshot.gameId,
          stateVersion: snapshot.stateVersion,
        });
        return null;
      }

      // A successfully persisted version is consumed even if a newer action
      // later suppresses its socket emission. This guarantees the queued final
      // state receives a strictly newer version and cannot be rejected as a
      // duplicate by a client that fetched the intermediate DB snapshot.
      latestSentPlayersSeqRef.current = Math.max(
        latestSentPlayersSeqRef.current,
        Number(snapshot.playersSeq || snapshot.stateVersion || 0),
      );
      console.log("[LUDO][sync] save success", {
        actionType: snapshot.lastActionType,
        gameId: snapshot.gameId,
        stateVersion: snapshot.stateVersion,
      });
      return snapshot;
    },
    [onlineMode, gameId, myProfile?._id, buildMinimalGameState],
  );

  const persistAndBroadcastGameState = useCallback(
    async (actionType, extraMeta = {}) => {
      const activeGameId = gameIdRef.current || gameId;
      if (
        myPlayerIndexRef.current !== 0 ||
        !onlineMode ||
        !activeGameId ||
        !socketRef.current
      ) {
        return null;
      }

      const requestVersion = persistRequestVersionRef.current + 1;
      persistRequestVersionRef.current = requestVersion;

      // Socket handlers run serially, and onPlayers updates canonical refs
      // synchronously before another action can run. Never discard a gameplay
      // action merely because a previous restore flag has not settled yet.
      if (isRestoringFromServerRef.current) {
        console.log("[LUDO][sync] persistence continuing after restore apply", {
          actionType,
          gameId,
        });
      }

      awaitingAuthoritativeSnapshotRef.current = true;

      // Real-time play must not wait for the database round trip. Broadcast the
      // host's canonical refs immediately; persistence remains serialized below
      // so reconnects still receive the latest durable snapshot.
      const liveSnapshot = buildMinimalGameState({}, { actionType, extraMeta });
      latestSentPlayersSeqRef.current = Number(
        liveSnapshot.playersSeq ||
          liveSnapshot.stateVersion ||
          latestSentPlayersSeqRef.current,
      );
      socketRef.current.emit("ludo:players", liveSnapshot);
      awaitingAuthoritativeSnapshotRef.current = false;
      if (liveSnapshot.diceValue === 0) {
        isRollingRef.current = false;
        isMovingRef.current = false;
        isAutoMovingRef.current = false;
        moveTimersRef.current = [];
      }
      setCanRollDice(
        Boolean(
          liveSnapshot.gameStarted &&
          !liveSnapshot.gameEnded &&
          liveSnapshot.diceValue === 0 &&
          liveSnapshot.currentPlayer === myPlayerIndexRef.current,
        ),
      );

      if (isSavingGameStateRef.current) {
        pendingPersistRequestRef.current = {
          actionType,
          extraMeta,
          requestVersion,
        };
        console.log("[LUDO][sync] persist queued", {
          actionType,
          gameId,
        });
        return null;
      }

      isSavingGameStateRef.current = true;
      try {
        const snapshot = await saveGameStateToDatabase(
          {},
          { actionType, extraMeta },
        );
        if (!snapshot) {
          console.error(
            "[LUDO][sync] authoritative emit skipped because save failed",
            {
              actionType,
              gameId,
            },
          );
          return null;
        }

        // A newer action arrived while this snapshot was being saved. The save
        // itself succeeded, but emitting it now would roll clients back to the
        // older board before the queued final action is persisted. Skip this
        // superseded emit; the queued request below will save and broadcast the
        // latest canonical refs instead.
        if (
          requestVersion !== persistRequestVersionRef.current ||
          pendingPersistRequestRef.current
        ) {
          console.log(
            "[LUDO][sync] superseded authoritative snapshot not emitted",
            {
              actionType,
              gameId: snapshot.gameId,
              stateVersion: snapshot.stateVersion,
              requestVersion,
              latestRequestVersion: persistRequestVersionRef.current,
            },
          );
          return null;
        }

        latestSentPlayersSeqRef.current = Number(
          snapshot.playersSeq ||
            snapshot.stateVersion ||
            latestSentPlayersSeqRef.current,
        );
        socketRef.current.emit("ludo:players", snapshot);

        // The host has already saved the canonical state successfully and must
        // not depend on the server echoing its own broadcast to unlock input.
        // Some Socket.IO broadcast paths exclude the sender, which otherwise
        // leaves the host showing the zero-dice logo indefinitely.
        awaitingAuthoritativeSnapshotRef.current = false;
        if (snapshot.diceValue === 0) {
          isRollingRef.current = false;
          isMovingRef.current = false;
          isAutoMovingRef.current = false;
          moveTimersRef.current = [];
        }
        setCanRollDice(
          Boolean(
            snapshot.gameStarted &&
            !snapshot.gameEnded &&
            snapshot.diceValue === 0 &&
            snapshot.currentPlayer === myPlayerIndexRef.current,
          ),
        );

        console.log("[LUDO][sync] authoritative state emitted", {
          actionType,
          gameId: snapshot.gameId,
          stateVersion: snapshot.stateVersion,
          currentPlayer: snapshot.currentPlayer,
          diceValue: snapshot.diceValue,
        });
        return snapshot;
      } finally {
        isSavingGameStateRef.current = false;
        const pending = pendingPersistRequestRef.current;
        if (pending) {
          pendingPersistRequestRef.current = null;
          setTimeout(() => {
            persistAndBroadcastGameState(
              pending.actionType,
              pending.extraMeta || {},
            );
          }, 0);
        }
      }
    },
    [gameId, onlineMode, buildMinimalGameState, saveGameStateToDatabase],
  );

  // Emit player state ONLY after database save completes (host only)
  const emitPlayersStateAfterSave = useCallback(
    async (actionType = "players_snapshot", extraMeta = {}) => {
      const normalizedActionType =
        typeof actionType === "string" ? actionType : "players_snapshot";
      return persistAndBroadcastGameState(normalizedActionType, extraMeta);
    },
    [persistAndBroadcastGameState],
  );

  // Legacy function - now redirects to save-first authoritative sync
  emitPlayersState = useCallback(
    (gid, actionType = "players_snapshot") => {
      if (!gid) return;
      persistAndBroadcastGameState(
        typeof actionType === "string" ? actionType : "players_snapshot",
      );
    },
    [persistAndBroadcastGameState],
  );

  const replacePlayerWithBot = useCallback(
    (playerIndex) => {
      const seatIndex = Number(playerIndex);
      const hadActiveGameId = Boolean(gameIdRef.current || gameId);
      const activeGameId =
        gameIdRef.current ||
        gameId ||
        (onlineMode ? newGameDraftIdRef.current || generateGameId() : null);
      if (
        myPlayerIndexRef.current !== 0 ||
        !Number.isInteger(seatIndex) ||
        seatIndex <= 0 ||
        seatIndex >= selectedPlayerCountRef.current ||
        isRollingRef.current ||
        isMovingRef.current ||
        isAutoMovingRef.current ||
        (onlineMode && !activeGameId)
      ) {
        return;
      }

      if (onlineMode && !hadActiveGameId && activeGameId) {
        newGameDraftIdRef.current = activeGameId;
        gameIdRef.current = activeGameId;
        setGameId(activeGameId);
      }

      const sourcePlayers = Array.isArray(playersRef.current)
        ? playersRef.current
        : players;
      const replacedPlayer = sourcePlayers[seatIndex];
      if (!replacedPlayer || replacedPlayer.isBot) return;

      const replacedProfileId = replacedPlayer.profileId
        ? String(replacedPlayer.profileId)
        : null;
      const nextPlayers = sourcePlayers.map((player, index) =>
        index === seatIndex
          ? {
              ...player,
              name: `Computer ${seatIndex}`,
              avatar: undefined,
              cover: undefined,
              profileId: null,
              isBot: true,
              isActive: true,
              isOffline: false,
              offlineSince: undefined,
              pieces: Array.isArray(player.pieces)
                ? player.pieces.map((piece) => ({ ...piece }))
                : [],
            }
          : player,
      );

      playersRef.current = nextPlayers;
      setPlayers(nextPlayers);

      if (replacedProfileId) {
        const nextStatuses = { ...invitedStatusByFriendIdRef.current };
        const nextSlots = { ...invitedSlotByFriendIdRef.current };
        delete nextStatuses[replacedProfileId];
        delete nextSlots[replacedProfileId];
        invitedStatusByFriendIdRef.current = nextStatuses;
        invitedSlotByFriendIdRef.current = nextSlots;
        setInvitedStatusByFriendId(nextStatuses);
        setInvitedSlotByFriendId(nextSlots);
        setSelectedFriends((prev) =>
          prev.filter(
            (friend) => String(friend?._id || "") !== replacedProfileId,
          ),
        );
      }

      if (onlineMode && hadActiveGameId) {
        try {
          socketRef.current?.emit("ludo:replace:bot", {
            gameId: activeGameId,
            playerIndex: seatIndex,
          });
        } catch (_e) {}
        setTimeout(() => {
          persistAndBroadcastGameState("player_replace_bot", {
            playerIndex: seatIndex,
            replacedProfileId,
          });
        }, 0);
      }

      setShowPlayerEditor(false);
      setEditingPlayerIndex(null);
      setEditName("");
      setEditAvatarUrl("");
    },
    [gameId, onlineMode, persistAndBroadcastGameState, players],
  );

  const replaceWaitingPlayersWithBots = useCallback(async () => {
    const activeGameId = gameIdRef.current || gameId;
    if (
      myPlayerIndexRef.current !== 0 ||
      !onlineMode ||
      !activeGameId ||
      gameStartedRef.current ||
      isReplacingWaitingPlayers
    ) {
      return;
    }

    const maxPlayers = Math.max(2, Math.min(4, selectedPlayerCountRef.current));
    const currentPlayers = Array.isArray(playersRef.current)
      ? playersRef.current
      : players;
    const statuses = invitedStatusByFriendIdRef.current;
    const slots = invitedSlotByFriendIdRef.current;
    const waitingSeatIndexes = [];

    for (let seatIndex = 1; seatIndex < maxPlayers; seatIndex += 1) {
      const seat = currentPlayers[seatIndex];
      if (seat?.isBot) continue;

      const profileId = seat?.profileId ? String(seat.profileId) : null;
      const inviteStatus = profileId
        ? statuses[profileId] || statuses[seat.profileId]
        : null;
      const wasInvitedToSeat =
        profileId &&
        (slots[profileId] === seatIndex || slots[seat.profileId] === seatIndex);
      const hasJoined = Boolean(
        profileId &&
        (wasInvitedToSeat
          ? inviteStatus === "joined"
          : inviteStatus !== "invited"),
      );

      if (!hasJoined) waitingSeatIndexes.push(seatIndex);
    }

    if (waitingSeatIndexes.length === 0) return;

    setIsReplacingWaitingPlayers(true);
    try {
      const waitingSeats = new Set(waitingSeatIndexes);
      const replacedProfileIds = [];
      const nextPlayers = currentPlayers.map((player, seatIndex) => {
        if (!waitingSeats.has(seatIndex)) return player;
        if (player?.profileId)
          replacedProfileIds.push(String(player.profileId));
        return {
          ...player,
          name: `Computer ${seatIndex}`,
          avatar: undefined,
          cover: undefined,
          profileId: null,
          isBot: true,
          isActive: true,
          isOffline: false,
          offlineSince: undefined,
          pieces: Array.isArray(player?.pieces)
            ? player.pieces.map((piece) => ({ ...piece }))
            : [],
        };
      });

      const nextStatuses = { ...statuses };
      const nextSlots = { ...slots };
      replacedProfileIds.forEach((profileId) => {
        delete nextStatuses[profileId];
        delete nextSlots[profileId];
      });

      playersRef.current = nextPlayers;
      setPlayers(nextPlayers);
      invitedStatusByFriendIdRef.current = nextStatuses;
      invitedSlotByFriendIdRef.current = nextSlots;
      setInvitedStatusByFriendId(nextStatuses);
      setInvitedSlotByFriendId(nextSlots);
      setSelectedFriends((previous) =>
        previous.filter(
          (friend) => !replacedProfileIds.includes(String(friend?._id || "")),
        ),
      );

      autoStartTriggeredRef.current = true;
      setGameStarted(true);
      gameStartedRef.current = true;
      setCurrentPlayer(0);
      currentPlayerRef.current = 0;
      setDiceValueImmediate(0);
      setCanRollDice(false);
      setWaitingForPlayers(false);

      waitingSeatIndexes.forEach((playerIndex) => {
        socketRef.current?.emit("ludo:replace:bot", {
          gameId: activeGameId,
          playerIndex,
        });
      });

      await persistAndBroadcastGameState("waiting_players_replaced", {
        playerIndexes: waitingSeatIndexes,
        replacedProfileIds,
      });
    } finally {
      setIsReplacingWaitingPlayers(false);
    }
  }, [
    gameId,
    isReplacingWaitingPlayers,
    onlineMode,
    persistAndBroadcastGameState,
    players,
    setDiceValueImmediate,
  ]);

  const inviteFriend = useCallback(
    (friend) => {
      if (!friend || !friend._id) return;

      const friendIdStr = String(friend._id);

      // Invite state is valid only while the friend still owns a seat in the
      // current setup. A delayed state update from a room that was just left
      // must not make that friend permanently appear joined in a new game.
      const currentPlayers = Array.isArray(playersRef.current)
        ? playersRef.current
        : players;
      const friendAlreadyInGame = currentPlayers.some(
        (p, index) =>
          index > 0 && p?.profileId && String(p.profileId) === friendIdStr,
      );
      let currentStatus = invitedStatusByFriendIdRef.current[friendIdStr];

      if (currentStatus && !friendAlreadyInGame) {
        const nextStatuses = { ...invitedStatusByFriendIdRef.current };
        const nextSlots = { ...invitedSlotByFriendIdRef.current };
        delete nextStatuses[friendIdStr];
        delete nextSlots[friendIdStr];
        invitedStatusByFriendIdRef.current = nextStatuses;
        invitedSlotByFriendIdRef.current = nextSlots;
        setInvitedStatusByFriendId(nextStatuses);
        setInvitedSlotByFriendId(nextSlots);
        currentStatus = undefined;
      }

      if (currentStatus === "joined") {
        console.log(
          `[INVITE_FRIEND] Skipping invite to ${friendIdStr} - already joined`,
        );
        return;
      }

      // Also check if the friend is already in the current game.
      if (friendAlreadyInGame) {
        console.log(
          `[INVITE_FRIEND] Skipping invite to ${friendIdStr} - already in game`,
        );
        // Update status to 'joined' if not already set
        if (currentStatus !== "joined") {
          setInvitedStatusByFriendId((prev) => {
            const updated = { ...prev, [friendIdStr]: "joined" };
            invitedStatusByFriendIdRef.current = updated;
            return updated;
          });
        }
        return;
      }

      // Must be online mode to invite
      if (!onlineMode) setOnlineMode(true);
      ensureSocketConnected();
      const gid = newGameDraftIdRef.current || generateGameId();
      newGameDraftIdRef.current = gid;
      gameIdRef.current = gid;
      if (gameId !== gid) setGameId(gid);
      // Reserve a slot for friend
      const slot = getNextOpenSlot();
      if (slot == null) return; // no open slot
      // Update local players with reservation
      setPlayers((prev) => {
        const copy = prev.map((p) => ({
          ...p,
          pieces: p.pieces.map((pc) => ({ ...pc })),
        }));
        if (!copy[slot]) return prev;
        copy[slot].name = friend.fullName || copy[slot].name;
        copy[slot].avatar = friend.profilePic || copy[slot].avatar;
        copy[slot].cover = friend.coverPic || copy[slot].cover;
        copy[slot].profileId = friend._id;
        return copy;
      });
      setInvitedStatusByFriendId((prev) => {
        const updated = { ...prev, [friendIdStr]: "invited" };
        // Setting status to 'invited' for friend
        // Update ref immediately for consistency
        invitedStatusByFriendIdRef.current = updated;
        return updated;
      });
      setInvitedSlotByFriendId((prev) => {
        const updated = { ...prev, [friendIdStr]: slot };
        invitedSlotByFriendIdRef.current = updated;
        return updated;
      });

      // CRITICAL: Add friend to selectedFriends if not already there
      setSelectedFriends((prev) => {
        const already = prev.some((p) => String(p?._id) === String(friend._id));
        if (already) {
          console.log(
            `[INVITE_FRIEND] Friend ${friendIdStr} already in selectedFriends`,
          );
          return prev;
        }
        const next = [...prev, friend];
        const maxFriends = Math.max(0, selectedPlayerCount - 1);
        const limited = next.slice(0, maxFriends);
        console.log(
          `[INVITE_FRIEND] Added friend ${friendIdStr} to selectedFriends (${limited.length}/${maxFriends})`,
        );
        return limited;
      });

      // Track when this friend was invited to prevent processing accept events that arrive immediately
      inviteTimestampsRef.current[friendIdStr] = Date.now();

      // CRITICAL: Only send invitation if game state has been created (game has started or gameId exists in DB)
      // If game hasn't started yet, the invitation will be sent when "Start Game" is clicked
      // Check if game has started or if we're in the process of creating it
      const shouldSendInviteNow = gameStarted || gameId; // Send if game started or gameId exists

      if (shouldSendInviteNow) {
        try {
          const targetId = friend?._id || friend?.id;
          if (!targetId) return;

          // Double-check status before sending (race condition protection)
          const statusBeforeSend =
            invitedStatusByFriendIdRef.current[friendIdStr];
          if (statusBeforeSend === "joined") {
            console.log(
              `[INVITE_FRIEND] Skipping invite to ${friendIdStr} - status changed to joined`,
            );
            return;
          }

          // Join/create room for host immediately (do before sending invite)
          try {
            emitSocket("ludo:join", { gameId: gid });
          } catch (_e) {}
          // Send invite (queued if socket is still connecting)
          emitSocket("ludo:invite", {
            to: targetId,
            by: myProfile?._id,
            name: myProfile?.fullName || "Player",
            avatar: myProfile?.profilePic,
            cover: myProfile?.coverPic,
            gameId: gid,
            slotIndex: slot,
            playerCount: selectedPlayerCount,
            ts: Date.now(),
          });
          // Fire a web notification to the friend's active browsers
          try {
            sendInviteNotificationToFriend(friend, gid, slot);
          } catch (_e) {}
        } catch (_e) {}
      }
      // If game hasn't started, the invitation will be sent in confirmPlayerCount after game state is created
    },
    [
      onlineMode,
      ensureSocketConnected,
      gameId,
      gameStarted,
      myProfile?._id,
      myProfile?.fullName,
      myProfile?.profilePic,
      selectedPlayerCount,
      getNextOpenSlot,
      emitSocket,
      players,
    ],
  );

  // Offline: assign a searched friend/profile to the next open local seat (no socket)
  const assignFriendOffline = useCallback(
    (friend) => {
      if (!friend || !friend._id) return;
      const slot = getNextOpenSlot();
      if (slot == null) return;
      setPlayers((prev) => {
        const copy = prev.map((p) => ({
          ...p,
          pieces: p.pieces.map((pc) => ({ ...pc })),
        }));
        if (!copy[slot]) return prev;
        copy[slot].name = friend.fullName || copy[slot].name;
        copy[slot].avatar = friend.profilePic || copy[slot].avatar;
        copy[slot].cover = friend.coverPic || copy[slot].cover;
        copy[slot].profileId = friend._id; // local-only association
        return copy;
      });
      setSelectedFriends((prev) => {
        const already = prev.some((p) => String(p?._id) === String(friend._id));
        if (already) return prev;
        const next = [...prev, friend];
        return next.slice(0, Math.max(0, selectedPlayerCount - 1));
      });
    },
    [getNextOpenSlot, selectedPlayerCount],
  );

  // Assign a searched friend/profile directly to a specific seat index (used by PlayerEditorModal)
  const assignFriendToSlot = useCallback(
    (friend, slotIndex) => {
      if (!friend || !friend._id) return;
      if (typeof slotIndex !== "number" || slotIndex < 0) return;
      setPlayers((prev) => {
        const copy = prev.map((p) => ({
          ...p,
          pieces: p.pieces.map((pc) => ({ ...pc })),
        }));
        if (!copy[slotIndex]) return prev;
        copy[slotIndex].name = friend.fullName || copy[slotIndex].name;
        copy[slotIndex].avatar = friend.profilePic || copy[slotIndex].avatar;
        copy[slotIndex].cover = friend.coverPic || copy[slotIndex].cover;
        copy[slotIndex].profileId = friend._id; // local-only association
        copy[slotIndex].isBot = false;
        copy[slotIndex].isActive = true;
        copy[slotIndex].isOffline = false;
        return copy;
      });
      setSelectedFriends((prev) => {
        const already = prev.some((p) => String(p?._id) === String(friend._id));
        if (already) return prev;
        const next = [...prev, friend];
        return next.slice(0, Math.max(0, selectedPlayerCount - 1));
      });
    },
    [selectedPlayerCount],
  );

  // Helper to check if all required players have actually joined (for online mode)
  const checkAllPlayersJoined = useCallback(() => {
    if (!onlineMode) return true; // Offline mode doesn't need to wait

    // Invitees should never be the authority that decides the lobby is ready.
    // Only the host can transition from waiting -> started; everyone else waits
    // for the host's authoritative players snapshot.
    if (myPlayerIndexRef.current !== 0) {
      return false;
    }

    const maxPlayers = Math.max(2, Math.min(4, selectedPlayerCount));
    const currentPlayers =
      playersRef.current && Array.isArray(playersRef.current)
        ? playersRef.current
        : players;
    const currentInvitedStatus = invitedStatusByFriendIdRef.current;
    const currentInvitedSlots = invitedSlotByFriendIdRef.current;

    console.log("[CHECK_ALL_PLAYERS_JOINED] Checking players", {
      maxPlayers,
      players: currentPlayers.map((p, idx) => ({
        index: idx,
        name: p?.name,
        profileId: p?.profileId,
        hasProfileId: Boolean(p?.profileId),
      })),
      invitedStatus: currentInvitedStatus,
      invitedSlots: currentInvitedSlots,
      myPlayerIndex: myPlayerIndexRef.current,
    });

    // Check each seat (excluding host at 0)
    for (let i = 1; i < maxPlayers; i++) {
      const seat = currentPlayers[i];
      const hasProfileId = Boolean(seat?.profileId);

      if (seat?.isBot) {
        continue;
      }

      if (!hasProfileId) {
        console.log(
          `[CHECK_ALL_PLAYERS_JOINED] Seat ${i} is empty - not all players joined`,
        );
        return false;
      }

      const profileIdStr = seat?.profileId ? String(seat.profileId) : null;
      const inviteStatus = profileIdStr
        ? currentInvitedStatus[profileIdStr] ||
          currentInvitedStatus[seat.profileId]
        : null;
      const wasInvitedToThisSlot =
        profileIdStr &&
        (currentInvitedSlots[profileIdStr] === i ||
          currentInvitedSlots[seat.profileId] === i);

      console.log(`[CHECK_ALL_PLAYERS_JOINED] Seat ${i} check:`, {
        profileId: profileIdStr,
        inviteStatus,
        wasInvitedToThisSlot,
        hasProfileId,
      });

      let isJoined = false;

      if (wasInvitedToThisSlot) {
        isJoined = inviteStatus === "joined";
        console.log(
          `[CHECK_ALL_PLAYERS_JOINED] Seat ${i} was invited to this slot - isJoined: ${isJoined} (status: ${inviteStatus})`,
        );
      } else {
        // For the host, a seat that has a profileId but no invite bookkeeping can
        // still be considered joined (e.g. legacy join/rejoin path, copied-link
        // acceptance normalized by the server, or restoration after refresh).
        isJoined = Boolean(profileIdStr) && inviteStatus !== "invited";
        console.log(
          `[CHECK_ALL_PLAYERS_JOINED] Seat ${i} was NOT invited to this slot - isJoined: ${isJoined} (status: ${inviteStatus})`,
        );
      }

      if (!isJoined) {
        console.log(
          `[CHECK_ALL_PLAYERS_JOINED] Seat ${i} player hasn't joined yet - status: ${inviteStatus}`,
        );
        return false;
      }
    }

    console.log("[CHECK_ALL_PLAYERS_JOINED] ✅ All players have joined");
    return true;
  }, [onlineMode, selectedPlayerCount, players]);

  // Determine if host should wait in lobby for invited players
  const recomputeWaitingState = useCallback(() => {
    try {
      // Gate waiting in online games for both host and invitees
      if (!onlineMode || myProfile?._id == null) {
        setWaitingForPlayers(false);
        return;
      }

      if (myPlayerIndexRef.current !== 0) {
        // Invitees/remotes stay in waiting mode until the host publishes the
        // started game snapshot. This prevents them from enabling dice locally
        // before the host starts the match.
        setWaitingForPlayers(!gameStartedRef.current);
        setCanRollDice(false);
        return;
      }

      // Also check if game has started - if started, don't wait (use ref to avoid stale closure)
      if (gameStartedRef.current) {
        setWaitingForPlayers(false);
        // CRITICAL: Don't set canRollDice to true unconditionally - let the useEffect handle it
        // This prevents friends from being able to roll dice when it's not their turn
        // setCanRollDice(true); // Removed - let useEffect handle based on turn
        return;
      }

      // Check if all players have actually joined
      const allPlayersJoined = checkAllPlayersJoined();
      const shouldWait = !allPlayersJoined;

      setWaitingForPlayers(shouldWait);
      if (shouldWait) {
        setCanRollDice(false);
      } else {
        // All players joined; but don't set canRollDice to true unconditionally
        // Let the useEffect handle it based on whether it's the player's turn
        // setCanRollDice(true); // Removed - let useEffect handle based on turn

        // If all players joined and game hasn't started yet, automatically start the game (host only)
        // Use refs to prevent infinite loop and multiple triggers
        if (
          !gameStartedRef.current &&
          !autoStartTriggeredRef.current &&
          allPlayersJoined &&
          myPlayerIndex === 0 &&
          onlineMode &&
          gameId
        ) {
          // Mark as triggered immediately to prevent multiple calls
          autoStartTriggeredRef.current = true;

          // Auto-start the game when all players have joined
          setTimeout(() => {
            // Use the latest players state
            const currentPlayers =
              playersRef.current && Array.isArray(playersRef.current)
                ? playersRef.current
                : players;

            setGameStarted(true);
            gameStartedRef.current = true; // Update ref immediately
            setCurrentPlayer(0);
            currentPlayerRef.current = 0;
            setDiceValueImmediate(0);
            setCanRollDice(false);
            setWaitingForPlayers(false);

            // Save and emit game start state to all players
            if (socketRef.current && myPlayerIndex === 0) {
              setTimeout(() => {
                persistAndBroadcastGameState("game_auto_start", {
                  trigger: "recomputeWaitingState",
                });
              }, 300); // Small delay to ensure state is synchronized
            }
          }, 500); // Small delay to ensure UI updates
        }
      }
    } catch (_e) {
      setWaitingForPlayers(false);
    }
  }, [
    onlineMode,
    myPlayerIndex,
    players,
    myProfile?._id,
    selectedPlayerCount,
    gameId,
    checkAllPlayersJoined,
    persistAndBroadcastGameState,
    setDiceValueImmediate,
  ]);

  const generateGameId = () =>
    `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

  const createInviteToken = (slotIndex) => {
    const gid = newGameDraftIdRef.current || generateGameId();
    newGameDraftIdRef.current = gid;
    gameIdRef.current = gid;
    if (gameId !== gid) setGameId(gid);
    const payload = {
      type: "ludo_invite",
      by: myProfile?._id || "anon",
      name: myProfile?.fullName || "Player",
      avatar: myProfile?.profilePic,
      cover: myProfile?.coverPic,
      ts: Date.now(),
      gameId: gid,
      playerCount: selectedPlayerCount,
      slotIndex: typeof slotIndex === "number" ? slotIndex : undefined,
    };
    return btoa(JSON.stringify(payload));
  };

  const sendInviteNotificationToFriend = async (
    friend,
    gid,
    slotIndex,
    options = {},
  ) => {
    try {
      const token = (() => {
        try {
          const payload = {
            type: "ludo_invite",
            by: myProfile?._id || "anon",
            name: myProfile?.fullName || "Player",
            ts: Date.now(),
            gameId: gid,
            playerCount: selectedPlayerCount,
            slotIndex,
            reinvite: options.reinvite === true,
            inviteId: options.inviteId,
          };
          return btoa(JSON.stringify(payload));
        } catch (_e) {
          return createInviteToken(slotIndex);
        }
      })();
      const url = `${window.location.origin}${window.location.pathname}`;
      const notificationData = {
        title: "Ludo Invitation",
        text: `${myProfile?.fullName || "A friend"} invited you to play Ludo`,
        icon: myProfile?.profilePic || siteConfig.logo,
        link: url,
        type: "ludo_invite",
        data: {
          gameId: gid,
          slotIndex,
          playerCount: selectedPlayerCount,
          inviterId: myProfile?._id,
          inviterName: myProfile?.fullName,
          inviterAvatar: myProfile?.profilePic,
          inviterCover: myProfile?.coverPic,
          reinvite: options.reinvite === true,
          inviteId: options.inviteId,
        },
      };
      await api.post("/web-notification/send-to-all-browsers", {
        profileId: friend?._id,
        notificationData,
      });
    } catch (_e) {}
  };

  // Resolve invited friend's display name for a given slot index
  const getInvitedNameForSlot = useCallback(
    (slotIndex) => {
      try {
        const entries = Object.entries(invitedSlotByFriendId || {});
        for (const [fid, slot] of entries) {
          if (Number(slot) === Number(slotIndex)) {
            // Only return name if friend hasn't joined yet
            const inviteStatus = invitedStatusByFriendId?.[fid];
            if (inviteStatus === "joined") {
              return null; // Friend has already joined, don't show as pending invite
            }
            const pool = [...selectedFriends, ...friendList, ...searchResults];
            const f = pool.find((u) => u && String(u._id) === String(fid));
            return f?.fullName || null;
          }
        }
      } catch (_e) {}
      return null;
    },
    [
      invitedSlotByFriendId,
      invitedStatusByFriendId,
      selectedFriends,
      friendList,
      searchResults,
    ],
  );

  // Reload game state from server
  const reloadGameState = useCallback(() => {
    if (!onlineMode || !gameId || !socketRef.current) {
      console.log("[RELOAD_STATE] Cannot reload - not online or no gameId");
      return;
    }

    console.log("[RELOAD_STATE] Requesting fresh game state from server");

    try {
      socketRef.current.emit("ludo:players:get", { gameId });

      // Show feedback to user
      if (socketRef.current?.connected) {
        // Brief visual feedback
        const originalText = "Connected";
        const statusElement = document.querySelector(
          "[data-connection-status]",
        );
        if (statusElement) {
          statusElement.textContent = "Reloading...";
          setTimeout(() => {
            statusElement.textContent = originalText;
          }, 2000);
        }
      }
    } catch (error) {
      console.error("[RELOAD_STATE] Error requesting game state:", error);
    }
  }, [onlineMode, gameId]);

  // Reconnect socket and sync game state
  const reconnectSocket = useCallback(() => {
    if (!onlineMode || !gameId) {
      console.log(
        "[RECONNECT_SOCKET] Cannot reconnect - not online or no gameId",
      );
      return;
    }

    console.log("[RECONNECT_SOCKET] Manually reconnecting socket");

    const socket = socketRef.current;

    // Show feedback to user
    const statusElement = document.querySelector("[data-connection-status]");
    const originalText = statusElement?.textContent || "Connected";

    if (statusElement) {
      statusElement.textContent = "Reconnecting...";
    }

    // Disconnect if connected
    if (socket && socket.connected) {
      console.log("[RECONNECT_SOCKET] Disconnecting current socket");
      socket.disconnect();
    }

    // Clean up old socket
    cleanupSocket();

    // Create new connection
    ensureSocketConnected();

    // Wait for connection and then rejoin game
    const waitForConnectionAndRejoin = () => {
      if (socketRef.current?.connected) {
        console.log("[RECONNECT_SOCKET] Socket connected, rejoining game");

        // Rejoin game
        const now = Date.now();
        lastJoinRequestRef.current = { gameId, timestamp: now };
        lastPlayersGetRequestRef.current = { gameId, timestamp: now };

        try {
          socketRef.current.emit("ludo:join", { gameId });
          socketRef.current.emit("ludo:players:get", { gameId });

          if (statusElement) {
            statusElement.textContent = "Reconnected";
            setTimeout(() => {
              statusElement.textContent = originalText;
            }, 2000);
          }
        } catch (error) {
          console.error("[RECONNECT_SOCKET] Error rejoining game:", error);
          if (statusElement) {
            statusElement.textContent = "Reconnect failed";
            setTimeout(() => {
              statusElement.textContent = originalText;
            }, 3000);
          }
        }
      } else if (socketRef.current) {
        // Wait for connection
        socketRef.current.once("connect", () => {
          console.log(
            "[RECONNECT_SOCKET] Socket connected via event, rejoining game",
          );

          const now = Date.now();
          lastJoinRequestRef.current = { gameId, timestamp: now };
          lastPlayersGetRequestRef.current = { gameId, timestamp: now };

          try {
            socketRef.current.emit("ludo:join", { gameId });
            socketRef.current.emit("ludo:players:get", { gameId });

            if (statusElement) {
              statusElement.textContent = "Reconnected";
              setTimeout(() => {
                statusElement.textContent = originalText;
              }, 2000);
            }
          } catch (error) {
            console.error("[RECONNECT_SOCKET] Error rejoining game:", error);
            if (statusElement) {
              statusElement.textContent = "Reconnect failed";
              setTimeout(() => {
                statusElement.textContent = originalText;
              }, 3000);
            }
          }
        });
      } else {
        // Retry after a delay
        setTimeout(waitForConnectionAndRejoin, 500);
      }
    };

    setTimeout(waitForConnectionAndRejoin, 300);
  }, [onlineMode, gameId, ensureSocketConnected]);

  // Re-invite players function for online mode
  const reInvitePlayers = useCallback(() => {
    if (!onlineMode || !gameId || !socketRef.current) {
      console.log("[RE_INVITE] Cannot re-invite - not online or no gameId");
      return;
    }

    console.log("[RE_INVITE] Re-inviting players to current game");

    try {
      const reinvitedFriendIds = new Set();
      // Find offline players or empty slots and re-invite them specifically
      players.forEach((player, index) => {
        // Skip current player and active online players
        if (
          index === myPlayerIndexRef.current ||
          (player.profileId && !player.isOffline)
        ) {
          return;
        }

        if (!player.profileId || player.isOffline) {
          // Case 1: Empty slot - send to all selected friends as potential invites
          if (!player.profileId) {
            console.log(
              "[RE_INVITE] Sending invites to selected friends for empty slot",
              index,
            );
            selectedFriends.forEach((friend) => {
              if (friend && friend._id) {
                const friendIdStr = String(friend._id);
                const reservedSlot =
                  invitedSlotByFriendIdRef.current[friendIdStr];
                if (
                  reinvitedFriendIds.has(friendIdStr) ||
                  (reservedSlot !== undefined &&
                    Number(reservedSlot) !== Number(index))
                ) {
                  return;
                }

                // Check the current roster, not stale invite status. An empty
                // seat means a previous joined/declined marker must not block a
                // fresh invitation.
                const currentStatus =
                  invitedStatusByFriendIdRef.current[friendIdStr];

                // Also check if the friend is already in the game
                const friendAlreadyInGame = players.some(
                  (p) => p?.profileId && String(p.profileId) === friendIdStr,
                );
                if (friendAlreadyInGame) {
                  console.log(
                    `[RE_INVITE] Skipping invite to ${friendIdStr} - already in game`,
                  );
                  if (currentStatus !== "joined") {
                    setInvitedStatusByFriendId((prev) => {
                      const updated = { ...prev, [friendIdStr]: "joined" };
                      invitedStatusByFriendIdRef.current = updated;
                      return updated;
                    });
                  }
                  return;
                }

                try {
                  reinvitedFriendIds.add(friendIdStr);
                  const inviteId = `${gameId}:${friendIdStr}:${Date.now()}`;
                  socketRef.current.emit("ludo:invite", {
                    to: friend._id,
                    by: myProfile?._id,
                    name: myProfile?.fullName || "Player",
                    avatar: myProfile?.profilePic,
                    cover: myProfile?.coverPic,
                    gameId,
                    slotIndex: index,
                    playerCount: selectedPlayerCount || 4,
                    reinvite: true,
                    inviteId,
                    ts: Date.now(),
                  });
                  invitedStatusByFriendIdRef.current[friendIdStr] = "invited";
                  invitedSlotByFriendIdRef.current[friendIdStr] = index;
                  setInvitedStatusByFriendId((prev) => ({
                    ...prev,
                    [friendIdStr]: "invited",
                  }));
                  setInvitedSlotByFriendId((prev) => ({
                    ...prev,
                    [friendIdStr]: index,
                  }));

                  // Fire web notification to friend
                  try {
                    sendInviteNotificationToFriend(friend, gameId, index, {
                      reinvite: true,
                      inviteId,
                    });
                  } catch (_e) {}
                  console.log(
                    "[RE_INVITE] Sent targeted invite to friend",
                    friend._id,
                    "for slot",
                    index,
                  );
                } catch (error) {
                  console.error(
                    "[RE_INVITE] Error sending invite to friend:",
                    error,
                  );
                }
              }
            });
          }
          // Case 2: Offline player - send targeted re-invite to their profile
          else if (player.isOffline && player.profileId) {
            const playerIdStr = String(player.profileId);

            console.log(
              "[RE_INVITE] Sending re-invite to offline player",
              player.profileId,
              "for slot",
              index,
            );
            try {
              if (reinvitedFriendIds.has(playerIdStr)) return;
              reinvitedFriendIds.add(playerIdStr);
              const inviteId = `${gameId}:${playerIdStr}:${Date.now()}`;
              socketRef.current.emit("ludo:invite", {
                to: player.profileId,
                by: myProfile?._id,
                name: myProfile?.fullName || "Player",
                avatar: myProfile?.profilePic,
                cover: myProfile?.coverPic,
                gameId,
                slotIndex: index,
                playerCount: selectedPlayerCount || 4,
                reinvite: true,
                inviteId,
                ts: Date.now(),
              });
              invitedStatusByFriendIdRef.current[playerIdStr] = "invited";
              invitedSlotByFriendIdRef.current[playerIdStr] = index;
              setInvitedStatusByFriendId((prev) => ({
                ...prev,
                [playerIdStr]: "invited",
              }));
              setInvitedSlotByFriendId((prev) => ({
                ...prev,
                [playerIdStr]: index,
              }));

              // Fire web notification to offline player
              const offlineFriend = {
                _id: player.profileId,
                fullName: player.name,
                profilePic: player.avatar,
              };
              try {
                sendInviteNotificationToFriend(offlineFriend, gameId, index, {
                  reinvite: true,
                  inviteId,
                });
              } catch (_e) {}
              console.log(
                "[RE_INVITE] Sent re-invite to offline player",
                player.profileId,
              );
            } catch (error) {
              console.error(
                "[RE_INVITE] Error sending re-invite to offline player:",
                error,
              );
            }
          }
        }
      });

      console.log("[RE_INVITE] Re-invitation process completed");
    } catch (error) {
      console.error("[RE_INVITE] Error in re-invitation process:", error);
    }
  }, [
    onlineMode,
    gameId,
    players,
    myPlayerIndexRef.current,
    myProfile,
    selectedPlayerCount,
    selectedFriends,
  ]);

  /**
   * Copy the game invite link to clipboard
   */
  const copyInviteLink = async (slotIndex) => {
    try {
      const token = createInviteToken(slotIndex);
      const url = `${window.location.origin}${window.location.pathname}?ludoInvite=${encodeURIComponent(token)}`;
      await navigator.clipboard.writeText(url);
      setInviteCopied(true);
      setTimeout(() => setInviteCopied(false), 2000);
    } catch (_e) {
      setInviteCopied(false);
    }
  };

  // ============================================================================
  // SECTION 12: PLAYER EDITOR FUNCTIONS
  // ============================================================================

  /**
   * Open the player editor modal for a specific player
   *
   * @param {number} playerIndex - Index of the player to edit
   */
  const openPlayerEditor = (playerIndex) => {
    if (playerIndex == null || playerIndex < 0 || playerIndex >= players.length)
      return;
    // If the player selection modal is open, close it to avoid overlapping
    // modal backdrops which can prevent inputs inside the editor from receiving focus.
    if (showPlayerSelection) setShowPlayerSelection(false);

    setEditingPlayerIndex(playerIndex);
    setEditName(players[playerIndex]?.name || "");
    setEditAvatarUrl(players[playerIndex]?.avatar || "");
    setShowPlayerEditor(true);
  };

  /**
   * Find all pieces that can be moved with the current dice value
   *
   * @param {number} playerIndex - Index of the player
   * @param {number} diceVal - Current dice value
   * @returns {Array<number>} Array of piece indices that can be moved
   */
  const getPlayablePieces = useCallback(
    (playerIndex, diceVal) => {
      const playerData =
        playersRef.current?.[playerIndex] || players[playerIndex];
      if (!playerData || !Array.isArray(playerData.pieces)) return [];
      const playable = [];
      playerData.pieces.forEach((piece, pieceIndex) => {
        const steps = getPieceSteps(piece);
        if (steps <= 0) {
          if (diceVal === 6) playable.push(pieceIndex);
          return;
        }
        if (steps < maxSteps && steps + diceVal <= maxSteps) {
          playable.push(pieceIndex);
        }
      });
      return playable;
    },
    [players, maxSteps],
  );

  const isBotPlayerIndex = useCallback((playerIndex) => {
    return Boolean(playersRef.current?.[playerIndex]?.isBot);
  }, []);

  const advanceTurnForPlayer = useCallback(
    (fromPlayer) => {
      const nextPlayer = getNextActivePlayer(fromPlayer);
      playSound("turnChange");
      setCurrentPlayerImmediate(nextPlayer);
      setDiceValueImmediate(0);
      lastLocalDiceRollTimeRef.current = 0;

      if (myPlayerIndexRef.current === 0 && onlineMode && gameId) {
        persistAndBroadcastGameState("turn_advance", {
          fromPlayer,
          toPlayer: nextPlayer,
        });
      }

      setTimeout(() => {
        if (
          !onlineMode &&
          currentPlayerRef.current === nextPlayer &&
          diceValueRef.current === 0
        ) {
          setCanRollDice(true);
        }
      }, 200);
    },
    [
      getNextActivePlayer,
      playSound,
      setDiceValueImmediate,
      setCurrentPlayerImmediate,
      onlineMode,
      gameId,
      persistAndBroadcastGameState,
    ],
  );

  const pickBotPiece = useCallback((playableIds, playerIndex) => {
    const pieces = playersRef.current[playerIndex]?.pieces || [];
    let best = playableIds[0];
    let bestSteps = -1;
    playableIds.forEach((id) => {
      const steps = pieces[id]?.steps ?? 0;
      if (steps > bestSteps) {
        bestSteps = steps;
        best = id;
      }
    });
    return best;
  }, []);

  const resolveWinnerStateForPlayer = useCallback(
    (updatedPlayers, playerIndex) => {
      const playerPieces = updatedPlayers?.[playerIndex]?.pieces || [];
      const finishedCount = playerPieces.filter(
        (p) => p.steps === maxStepsRef.current,
      ).length;

      if (finishedCount !== 4) {
        return {
          didFinish: false,
          winners: winnersRef.current || [],
          gameEnded: gameEndedRef.current || false,
        };
      }

      const winnerPlayer = updatedPlayers[playerIndex];
      const existingWinners = winnersRef.current || [];
      const alreadyWinner = existingWinners.some(
        (w) => String(w.id) === String(winnerPlayer?.id),
      );
      const nextWinners = alreadyWinner
        ? existingWinners
        : [...existingWinners, winnerPlayer];

      if (!alreadyWinner) {
        setWinners(nextWinners);
        winnersRef.current = nextWinners;
        setWinner(winnerPlayer);
        setShowWinnerModal(true);
        playSound("win");
      }

      const remainingPlayers = updatedPlayers.filter(
        (_, idx) => idx < selectedPlayerCountRef.current,
      );
      const nextGameEnded = nextWinners.length >= remainingPlayers.length - 1;
      if (nextGameEnded) {
        setGameEnded(true);
        gameEndedRef.current = true;
      }

      return {
        didFinish: true,
        winnerPlayer,
        winners: nextWinners,
        gameEnded: nextGameEnded,
      };
    },
    [playSound],
  );

  /**
   * Roll the dice for the current player
   * Handles both offline and online modes with proper synchronization
   */
  const rollDice = (controlledValue = null, bypassControlModal = false) => {
    resumeAudioFromGesture();
    const chosenDiceValue =
      Number.isInteger(controlledValue) &&
      controlledValue >= 1 &&
      controlledValue <= 6
        ? controlledValue
        : null;
    if (onlineMode && awaitingAuthoritativeSnapshotRef.current) {
      console.log("[ROLL_DICE] Blocked: awaiting authoritative snapshot", {
        gameId,
        currentPlayer: currentPlayerRef.current,
        myPlayerIndex: myPlayerIndexRef.current,
      });
      return;
    }

    // DEBUG: Log roll attempt
    console.log("[ROLL_DICE] Attempt to roll dice", {
      waitingForPlayers,
      canRollDice,
      isRollingRef: isRollingRef.current,
      onlineMode,
      myPlayerIndex: myPlayerIndexRef.current,
      currentPlayer: currentPlayerRef.current,
      diceValue: diceValueRef.current,
      isMoving: isMovingRef.current,
      isAutoMoving: isAutoMovingRef.current,
      moveTimersLength: moveTimersRef.current.length,
    });

    // Prevent multiple rolls - check multiple conditions
    if (waitingForPlayers) {
      console.log("[ROLL_DICE] Blocked: waitingForPlayers");
      return;
    }

    const isBotTurn =
      !onlineMode && playersRef.current[currentPlayerRef.current]?.isBot;
    const isBotActingForCurrentPlayer = Boolean(
      botActingRef.current &&
      botActingPlayerIndexRef.current === currentPlayerRef.current &&
      isBotPlayerIndex(currentPlayerRef.current),
    );

    if (!isBotActingForCurrentPlayer && isBotTurn) {
      return;
    }

    if (!isBotActingForCurrentPlayer) {
      if (!canRollDice || isRollingRef.current) {
        console.log(
          "[ROLL_DICE] Blocked: canRollDice=",
          canRollDice,
          "isRollingRef=",
          isRollingRef.current,
        );
        return;
      }
      if (isRollingRef.current) {
        console.log(
          "[ROLL_DICE] Blocked: isRollingRef.current=",
          isRollingRef.current,
        );
        return; // Additional guard
      }
    } else if (isRollingRef.current) {
      return;
    }

    // CRITICAL: Prevent rolling if a move is in progress
    if (isMovingRef.current || isAutoMovingRef.current) {
      console.log("[ROLL_DICE] Blocked: move in progress", {
        isMoving: isMovingRef.current,
        isAutoMoving: isAutoMovingRef.current,
      });
      return; // Don't allow dice roll while a move is being executed
    }

    // CRITICAL: Use refs to ensure we check the most current values (avoid stale closures)
    // Only the current player can roll dice in online or vs-computer mode.
    // Bot seats are controlled exclusively by the local bot-turn scheduler.
    if (
      onlineMode ||
      playWithComputerRef.current ||
      isBotPlayerIndex(currentPlayerRef.current)
    ) {
      const currentMyPlayerIndex = myPlayerIndexRef.current;
      const currentPlayerIndex = currentPlayerRef.current;
      const currentSeatIsBot = isBotPlayerIndex(currentPlayerIndex);
      if (currentSeatIsBot && !isBotActingForCurrentPlayer) {
        return;
      }
      const cpuTurn = isBotActingForCurrentPlayer;
      if (!cpuTurn && currentMyPlayerIndex !== currentPlayerIndex) {
        console.log("[ROLL_DICE] Blocked: not my turn", {
          myIndex: currentMyPlayerIndex,
          currentPlayer: currentPlayerIndex,
        });
        return;
      }
      if (diceValueRef.current > 0) {
        console.log("[ROLL_DICE] Blocked: dice value already set", {
          diceValue: diceValueRef.current,
        });
        return;
      }
    }

    // Prevent rapid successive rolls - skip cooldown for CPU turns
    const timeSinceLastRoll = Date.now() - lastRollTimeRef.current;
    const isCpuRoll =
      isBotActingForCurrentPlayer ||
      (playWithComputerRef.current &&
        !onlineMode &&
        playersRef.current[currentPlayerRef.current]?.isBot);
    if (!isCpuRoll && timeSinceLastRoll < 1000) return;

    // CRITICAL: Double-check conditions right before setting flags (prevent race conditions)
    // Re-check canRollDice and diceValue one more time after potential state updates
    if (!isBotActingForCurrentPlayer && (!canRollDice || isRollingRef.current))
      return;
    if (diceValueRef.current > 0 || diceValue > 0) return;
    if (
      (onlineMode || playWithComputerRef.current) &&
      !isBotActingForCurrentPlayer &&
      !isBotPlayerIndex(currentPlayerRef.current) &&
      myPlayerIndexRef.current !== currentPlayerRef.current
    )
      return;

    // CRITICAL: Final check - ensure no move is in progress (double-check after all other checks)
    // Only block if actually moving, not just because timers exist (timers might be stale)
    if (isMovingRef.current || isAutoMovingRef.current) {
      console.log("[ROLL_DICE] Blocked: move in progress (final check)", {
        isMoving: isMovingRef.current,
        isAutoMoving: isAutoMovingRef.current,
      });
      return; // Don't allow dice roll while a move is being executed
    }

    // Check if move timers are actually active (not stale)
    // Clear any stale timers that are older than 3 seconds (moves should complete faster, but account for animations)
    const now = Date.now();
    const staleTimers = [];
    const activeTimers = moveTimersRef.current.filter((timer) => {
      // If timer is a number (timeout ID), we can't determine age - assume it's active
      if (typeof timer === "number") {
        return true;
      }
      // If timer is an object with timestamp, check if it's recent
      if (timer && typeof timer === "object" && timer.timestamp) {
        const isStale = now - timer.timestamp >= 3000;
        if (isStale) {
          staleTimers.push(timer);
        }
        return !isStale;
      }
      // If we can't determine, assume it's stale to unblock rolling
      return false;
    });

    // Clear and remove stale timeout IDs
    staleTimers.forEach((timer) => {
      if (timer && typeof timer === "object" && timer.timeoutId) {
        try {
          clearTimeout(timer.timeoutId);
        } catch (_e) {}
      }
    });

    // Update moveTimersRef to only keep active timers
    if (activeTimers.length !== moveTimersRef.current.length) {
      console.log("[ROLL_DICE] Clearing stale move timers", {
        oldCount: moveTimersRef.current.length,
        newCount: activeTimers.length,
        staleCount: staleTimers.length,
      });
      moveTimersRef.current = activeTimers;
    }

    // Only block if there are actually active timers
    if (activeTimers.length > 0) {
      console.log("[ROLL_DICE] Blocked: active move timers", {
        activeTimersCount: activeTimers.length,
      });
      return;
    }

    if (controlMode && !bypassControlModal) {
      setShowDiceValueModal(true);
      return;
    }

    // Set rolling flags immediately to prevent duplicate rolls. Online play
    // remains locked until a saved authoritative snapshot is received.
    if (onlineMode) {
      awaitingAuthoritativeSnapshotRef.current = true;
    }
    isRollingRef.current = true;
    setCanRollDice(false);
    lastRollTimeRef.current = Date.now();

    console.log("[ROLL_DICE] ✅ Starting dice roll", {
      onlineMode,
      myPlayerIndex: myPlayerIndexRef.current,
      currentPlayer: currentPlayerRef.current,
      gameId,
    });

    // Ensure game is started when rolling dice
    if (!gameStarted) {
      setGameStarted(true);
      gameStartedRef.current = true;
      if (onlineMode && myPlayerIndexRef.current === 0 && gameId) {
        setTimeout(() => {
          persistAndBroadcastGameState("game_start_via_roll", {
            trigger: "rollDice",
          });
        }, 0);
      }
    }

    // Play dice roll sound
    playSound("diceRoll");

    // Generate the final dice value up-front, but reveal it only after a short animation
    const value = chosenDiceValue || Math.floor(Math.random() * 6) + 1;

    const currentRollPlayer = currentPlayerRef.current;
    const animationDuration = onlineMode ? 700 : DICE_ROLL_ANIMATION_MS;
    const land = DICE_LAND_ROTATION[value] || DICE_LAND_ROTATION[1];
    const prev = diceRotationRef.current;
    const spinX = 360 * (4 + Math.floor(Math.random() * 3));
    const spinY = 360 * (3 + Math.floor(Math.random() * 3));
    const dirX = Math.random() > 0.5 ? 1 : -1;
    const dirY = Math.random() > 0.5 ? 1 : -1;
    const targetX = prev.x + spinX * dirX;
    const targetY = prev.y + spinY * dirY;
    const alignX = ((land.x - targetX) % 360 + 360) % 360;
    const alignY = ((land.y - targetY) % 360 + 360) % 360;
    const nextRotation = {
      x: targetX + alignX,
      y: targetY + alignY,
      z: 0,
    };
    setRollingFace(value);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        diceRotationRef.current = nextRotation;
        setDiceRotation(nextRotation);
      });
    });

    setTimeout(() => {
      setRollingFace(value);

      // CRITICAL: Track consecutive 6s and limit them
      const currentSixCount =
        consecutiveSixesRef.current[currentRollPlayer] || 0;
      if (value === 6) {
        // Increment consecutive 6s count
        const newSixCount = currentSixCount + 1;
        setConsecutiveSixes((prev) => ({
          ...prev,
          [currentRollPlayer]: newSixCount,
        }));
        consecutiveSixesRef.current[currentRollPlayer] = newSixCount;

        // Limit consecutive 6s to 3 (maximum allowed)
        if (newSixCount >= 3) {
          console.log(
            "[ROLL_DICE] Player has reached 3 consecutive 6s, advancing turn",
            {
              player: currentRollPlayer,
              consecutiveSixes: newSixCount,
            },
          );

          // Reset consecutive 6s count for this player
          setConsecutiveSixes((prev) => ({ ...prev, [currentRollPlayer]: 0 }));
          consecutiveSixesRef.current[currentRollPlayer] = 0;

          // Still set the dice value to 6 for this roll, but advance turn after
          setDiceValueImmediate(value);
          lastDiceValueRef.current = value;
          lastLocalDiceRollTimeRef.current = Date.now();
          isRollingRef.current = false;

          // Play sound for rolling a 6 (special)
          playSound("pieceOut", { frequency: 500, duration: 0.3 });

          // Broadcast dice roll to other players immediately
          if (onlineMode && socketRef.current && gameId) {
            try {
              console.log("[ROLL] Broadcasting dice roll (3rd 6)", {
                value,
                by: myProfile?._id,
              });
              socketRef.current.emit("ludo:roll", {
                gameId,
                value,
                by: myProfile?._id,
                currentPlayer: currentPlayerRef.current,
                reachedSixLimit: true,
              });
            } catch (_e) {}
          }

          // Advance turn immediately after rolling the 3rd 6
          setTimeout(
            () => {
              const nextPlayer = getNextActivePlayer(currentPlayerRef.current);
              playSound("turnChange");
              setCurrentPlayerImmediate(nextPlayer);
              setDiceValueImmediate(0);
              lastLocalDiceRollTimeRef.current = 0;

              // Allow next player to roll
              setTimeout(() => {
                if (
                  !onlineMode &&
                  currentPlayerRef.current === nextPlayer &&
                  diceValueRef.current === 0
                ) {
                  setCanRollDice(true);
                }
              }, ROLL_UNLOCK_DELAY_MS);

              // Save and emit game state when turn changes (host only)
              if (myPlayerIndexRef.current === 0 && onlineMode && gameId) {
                setTimeout(() => {
                  persistAndBroadcastGameState("three_consecutive_sixes", {
                    playerIndex: currentRollPlayer,
                    rolledValue: value,
                  });
                }, 100);
              }
            },
            onlineMode ? 250 : SIX_LIMIT_TRANSITION_DELAY_MS,
          );

          return;
        }
      } else {
        // Reset consecutive 6s count if non-6 is rolled
        if (currentSixCount > 0) {
          console.log(
            "[ROLL_DICE] Non-6 rolled, resetting consecutive 6s for player",
            currentRollPlayer,
          );
          setConsecutiveSixes((prev) => ({
            ...prev,
            [currentRollPlayer]: 0,
          }));
          consecutiveSixesRef.current[currentRollPlayer] = 0;
        }
      }

      // Set dice value and broadcast
      setDiceValueImmediate(value);
      lastDiceValueRef.current = value;
      lastLocalDiceRollTimeRef.current = Date.now();
      isRollingRef.current = false;

      // Play sound for rolling a 6 (special)
      if (value === 6) {
        playSound("pieceOut", { frequency: 500, duration: 0.3 });
      }

      // Broadcast dice roll intent for responsiveness; host snapshot remains authoritative
      if (onlineMode && socketRef.current && gameId) {
        try {
          console.log("[ROLL] Broadcasting dice roll intent", {
            value,
            by: myProfile?._id,
          });
          socketRef.current.emit("ludo:roll", {
            gameId,
            value,
            by: myProfile?._id,
            currentPlayer: currentPlayerRef.current,
          });
        } catch (_e) {}
      }

      if (onlineMode && myPlayerIndexRef.current === 0 && gameId) {
        setTimeout(() => {
          persistAndBroadcastGameState("dice_roll", {
            playerIndex: currentRollPlayer,
            rolledValue: value,
          });
        }, 0);
      }

      const currentPlayersForRoll =
        playersRef.current && Array.isArray(playersRef.current)
          ? playersRef.current
          : players;
      const rollingPlayerIndex = currentPlayerRef.current;
      const currentPlayerData = currentPlayersForRoll[rollingPlayerIndex];
      const playablePieces = getPlayablePieces(rollingPlayerIndex, value);

      console.log("[ROLL_DICE] Roll completed", {
        player: rollingPlayerIndex,
        value,
        playablePieces: playablePieces.length,
        consecutiveSixes: consecutiveSixesRef.current[rollingPlayerIndex],
      });

      if (playablePieces.length === 0) {
        console.log(
          "[ROLL_DICE] No playable pieces, advancing turn and resetting 6s",
          {
            player: rollingPlayerIndex,
          },
        );
        setConsecutiveSixes((prev) => ({
          ...prev,
          [rollingPlayerIndex]: 0,
        }));
        consecutiveSixesRef.current[rollingPlayerIndex] = 0;

        setTimeout(
          () => {
            advanceTurnForPlayer(currentPlayerRef.current);
          },
          onlineMode ? 100 : TURN_TRANSITION_DELAY_MS,
        );
      } else if (playablePieces.length === 1) {
        const isCpuTurnNow =
          playWithComputerRef.current &&
          !onlineMode &&
          playersRef.current[currentPlayerRef.current]?.isBot;

        if (isCpuTurnNow) {
          return;
        }

        isAutoMovingRef.current = true;
        setCanRollDice(false);
        setTimeout(() => {
          try {
            if (
              diceValueRef.current === value &&
              currentPlayerRef.current === currentRollPlayer
            ) {
              movePiece(playablePieces[0]);
            } else {
              isAutoMovingRef.current = false;
              if (!onlineMode) {
                setCanRollDice(true);
              } else {
                setCanRollDice(false);
              }
            }
          } catch (err) {
            console.error("[ROLL_DICE] Auto-move failed", err);
            isAutoMovingRef.current = false;
            isMovingRef.current = false;
          }
        }, AUTO_MOVE_DELAY_MS);
      } else {
        if (!gameStarted) {
          setGameStarted(true);
          gameStartedRef.current = true;
        }
      }
    }, animationDuration);
  };

  // Components are now imported from separate files

  const captureToken = (playerIndex, pieceIndex) => {
    // Play capture sound
    playSound("capture");

    setPlayers((prev) => {
      const updated = prev.map((p) => ({
        ...p,
        pieces: p.pieces.map((pc) => ({ ...pc })),
      }));
      const capturedPiece = updated[playerIndex]?.pieces?.[pieceIndex];
      if (!capturedPiece) return prev;

      // Track this capture to prevent it from being overwritten by stale broadcasts
      // Keep capture tracking longer (10 seconds) since captures are important state changes
      const captureKey = `${playerIndex}-${pieceIndex}`;
      recentMovesRef.current.set(captureKey, {
        toSteps: 0,
        timestamp: Date.now(),
        isCapture: true,
      });

      // Clean up capture tracking after 10 seconds (longer than move tracking)
      setTimeout(() => {
        const tracked = recentMovesRef.current.get(captureKey);
        // Only delete if it's still a capture (hasn't been moved again)
        if (tracked && tracked.isCapture) {
          const currentPiece =
            playersRef.current[playerIndex]?.pieces?.[pieceIndex];
          // Only remove if token is still at home (wasn't moved again)
          if (currentPiece && currentPiece.isHome && currentPiece.steps === 0) {
            recentMovesRef.current.delete(captureKey);
          }
        }
      }, 10000);

      updated[playerIndex].pieces[pieceIndex] = {
        ...capturedPiece,
        isHome: true,
        isInPlay: false,
        steps: 0,
      };

      // Update ref immediately to ensure state is synchronized
      playersRef.current = updated;

      // Note: Don't broadcast here - broadcast will happen after all captures are processed
      // in the move completion callback to ensure all captures are included in one broadcast

      return updated;
    });
  };

  const animateTokenMovement = (
    playerIndex,
    pieceIndex,
    toSteps,
    fromStepsOverride,
    onComplete,
  ) => {
    // Optimized animation: use fewer updates for longer moves to improve performance
    const currentPlayers =
      playersRef.current && Array.isArray(playersRef.current)
        ? playersRef.current
        : players;
    const safePlayer = currentPlayers[playerIndex];
    const safePiece =
      safePlayer && Array.isArray(safePlayer.pieces)
        ? safePlayer.pieces[pieceIndex]
        : null;
    const fromSteps =
      typeof fromStepsOverride === "number" &&
      Number.isFinite(fromStepsOverride)
        ? fromStepsOverride
        : safePiece && typeof safePiece.steps === "number"
          ? safePiece.steps
          : 0;
    const stepsToGo = toSteps - fromSteps;

    // Track this move to prevent overwrites
    const pieceKey = `${playerIndex}-${pieceIndex}`;
    recentMovesRef.current.set(pieceKey, { toSteps, timestamp: Date.now() });

    if (stepsToGo <= 0) {
      onComplete && onComplete();
      return;
    }

    // For very short moves, animate every step; for longer moves, use fewer keyframes
    const updateEvery =
      stepsToGo <= 3 ? 1 : Math.max(2, Math.floor(stepsToGo / 6));
    const timers = [];

    // Update at intervals (only if state hasn't already reached target)
    for (let s = updateEvery; s < stepsToGo; s += updateEvery) {
      const timer = setTimeout(() => {
        moveTimersRef.current = moveTimersRef.current.filter(
          (t) => t !== timer,
        );
        // Check if state is already at or past target (for immediate updates)
        const currentState =
          playersRef.current?.[playerIndex]?.pieces?.[pieceIndex];
        const currentSteps = currentState?.steps ?? fromSteps;
        // Only update if we're not already at or past the target
        if (currentSteps < toSteps) {
          setPlayers((prev) => {
            const copy = prev.map((p) => ({
              ...p,
              pieces: p.pieces.map((pc) => ({ ...pc })),
            }));
            applyPieceLifecycle(
              copy[playerIndex].pieces[pieceIndex],
              fromSteps + s,
              maxStepsRef.current,
            );
            // Update ref immediately to keep in sync
            playersRef.current = copy;
            return copy;
          });
        }
      }, s * stepDurationMs);
      timers.push(timer);
    }

    // Final update to exact position (only if not already there). Online state
    // is already at the target before this cosmetic animation starts, so cap
    // completion latency instead of delaying authoritative turn persistence by
    // up to one full step duration per rolled square.
    const completionDelay = onlineMode
      ? Math.min(stepsToGo * stepDurationMs, ONLINE_MOVE_COMPLETION_MAX_MS)
      : stepsToGo * stepDurationMs;
    const finalTimer = setTimeout(() => {
      moveTimersRef.current = moveTimersRef.current.filter(
        (t) => t !== finalTimer,
      );
      const currentState =
        playersRef.current?.[playerIndex]?.pieces?.[pieceIndex];
      const currentSteps = currentState?.steps ?? fromSteps;
      // Only update if we're not already at the target
      if (currentSteps !== toSteps) {
        setPlayers((prev) => {
          const copy = prev.map((p) => ({
            ...p,
            pieces: p.pieces.map((pc) => ({ ...pc })),
          }));
          applyPieceLifecycle(
            copy[playerIndex].pieces[pieceIndex],
            toSteps,
            maxStepsRef.current,
          );
          // Update ref immediately to keep in sync
          playersRef.current = copy;
          return copy;
        });
      }
      // Keep move in recent moves for 2 seconds to prevent overwrites
      setTimeout(() => {
        recentMovesRef.current.delete(pieceKey);
      }, 2000);
      try {
        onComplete && onComplete();
      } catch (err) {
        console.error("[ANIMATE] onComplete failed", err);
        isMovingRef.current = false;
        isAutoMovingRef.current = false;
      }
    }, completionDelay);
    timers.push(finalTimer);

    moveTimersRef.current.push(...timers);
  };

  const movePiece = (pieceId) => {
    resumeAudioFromGesture();
    // Prevent multiple moves from a single dice roll - check moving flag
    // But allow automatic moves to proceed (they set isAutoMovingRef instead)
    if (isMovingRef.current && !isAutoMovingRef.current) {
      console.log("[MOVE_PIECE] Blocked: already moving", {
        isMoving: isMovingRef.current,
        isAutoMoving: isAutoMovingRef.current,
      });
      return;
    }

    // Always prefer ref value when available (prevents move from being blocked due to state sync issues)
    // The ref is updated immediately, while state updates are async
    // This matches the logic in token rendering
    const effectiveDiceValue =
      diceValueRef.current > 0 ? diceValueRef.current : diceValue;

    const abortMove = (reason, { skipTurnIfNoMoves = false } = {}) => {
      console.log("[MOVE_PIECE] Aborted", reason);
      isMovingRef.current = false;
      isAutoMovingRef.current = false;
      if (!skipTurnIfNoMoves) return;
      const diceVal =
        diceValueRef.current > 0 ? diceValueRef.current : diceValue;
      const remaining = getPlayablePieces(
        currentPlayerRef.current,
        diceVal,
      );
      if (remaining.length === 0 && diceVal > 0) {
        setTimeout(() => {
          advanceTurnForPlayer(currentPlayerRef.current);
        }, TURN_TRANSITION_DELAY_MS);
      }
    };

    if (effectiveDiceValue === 0) {
      abortMove("no dice value");
      return;
    }

    // Double-check: if dice value ref is 0, don't allow move (prevents race conditions)
    if (diceValueRef.current === 0 && diceValue === 0) {
      abortMove("dice refs empty");
      return;
    }

    // In online or vs-computer mode, only allow moves if it's the current player's turn.
    // Human clicks must never control a seat that the host replaced with a bot.
    if (
      onlineMode ||
      playWithComputerRef.current ||
      isBotPlayerIndex(currentPlayerRef.current)
    ) {
      const currentMyPlayerIndex = myPlayerIndexRef.current;
      const currentPlayerIndex = currentPlayerRef.current;
      const currentSeatIsBot = isBotPlayerIndex(currentPlayerIndex);
      const isBotActingForCurrentPlayer = Boolean(
        botActingRef.current &&
        botActingPlayerIndexRef.current === currentPlayerIndex &&
        currentSeatIsBot,
      );
      if (currentSeatIsBot && !isBotActingForCurrentPlayer) {
        abortMove("bot seat not acting");
        return;
      }
      const cpuTurn = isBotActingForCurrentPlayer;
      if (!cpuTurn && currentMyPlayerIndex !== currentPlayerIndex) {
        abortMove("not current player");
        return;
      }
    }

    // CRITICAL: Capture the rolled dice value BEFORE resetting it
    // This ensures turn advancement uses the actual rolled value, not the current dice state
    const rolledNow = effectiveDiceValue;
    const rolledDiceValue = rolledNow; // Explicitly name it for clarity
    // Capture the acting seat from the synchronous ref. The React state value
    // can still belong to the previous turn while a fresh host snapshot is
    // being rendered, which previously made moves update the wrong player.
    const actingPlayerIndex = currentPlayerRef.current;

    const currentPlayersForMove =
      playersRef.current && Array.isArray(playersRef.current)
        ? playersRef.current
        : players;
    const currentPlayerData = currentPlayersForMove[actingPlayerIndex];
    if (!currentPlayerData) {
      isMovingRef.current = false;
      isAutoMovingRef.current = false;
      return;
    }
    const piece = currentPlayerData.pieces[pieceId];
    if (!piece) {
      abortMove("missing piece");
      return;
    }

    const pieceSteps = getPieceSteps(piece);
    if (pieceSteps <= 0 && effectiveDiceValue !== 6) {
      abortMove("need 6 to leave yard", { skipTurnIfNoMoves: true });
      return;
    }
    if (pieceSteps > 0 && pieceSteps + effectiveDiceValue > maxSteps) {
      abortMove("home-column overshoot", { skipTurnIfNoMoves: true });
      return;
    }

    // If the host still has an earlier state (usually the dice-roll snapshot)
    // saving, mark it superseded immediately. Final move persistence happens
    // after animation/turn resolution; without this invalidation the earlier
    // snapshot could be emitted in that gap and visibly return the token.
    if (
      onlineMode &&
      myPlayerIndexRef.current === 0 &&
      isSavingGameStateRef.current
    ) {
      persistRequestVersionRef.current += 1;
      console.log("[LUDO][sync] in-flight snapshot invalidated by move", {
        gameId,
        playerIndex: actingPlayerIndex,
        pieceIndex: pieceId,
        requestVersion: persistRequestVersionRef.current,
      });
    }

    if (onlineMode) {
      awaitingAuthoritativeSnapshotRef.current = true;
    }

    // Set moving flag to prevent duplicate moves
    isMovingRef.current = true;
    // Clear auto-moving flag since we're now executing the move
    isAutoMovingRef.current = false;

    // CRITICAL: Add move timer to track active moves
    const moveTimerId = Date.now();
    moveTimersRef.current.push(moveTimerId);

    // CRITICAL: Reset dice value IMMEDIATELY to prevent multiple moves from same roll
    // But we've already captured rolledDiceValue above, so turn advancement will use the correct value
    setDiceValueImmediate(0);
    lastLocalDiceRollTimeRef.current = 0;

    const globalMove = () => {
      if (pieceSteps <= 0 && effectiveDiceValue === 6) {
        // Play piece out sound
        playSound("pieceOut");

        const movingPlayerIndex = actingPlayerIndex;
        const pieceKey = `${movingPlayerIndex}-${pieceId}`;
        recentMovesRef.current.set(pieceKey, {
          toSteps: 1,
          timestamp: Date.now(),
        });

        // CRITICAL: Update state synchronously to the moved position FIRST so
        // capture checks below see an accurate, already-moved board (this
        // avoids the previous bug where captures were computed AFTER the move
        // was already broadcast, which meant captures were silently dropped
        // for every other client when a remote player made the move).
        const sourcePlayersForMoveOut =
          playersRef.current && Array.isArray(playersRef.current)
            ? playersRef.current
            : players;
        const movedPlayers = sourcePlayersForMoveOut.map((p) => ({
          ...p,
          pieces: Array.isArray(p.pieces)
            ? p.pieces.map((pc) => ({ ...pc }))
            : [],
        }));
        movedPlayers[movingPlayerIndex].pieces[pieceId] = applyPieceLifecycle(
          {
            ...movedPlayers[movingPlayerIndex].pieces[pieceId],
            ...piece,
          },
          1,
          maxSteps,
        );
        playersRef.current = movedPlayers;

        // Compute captures synchronously (state already reflects the move)
        const newPosition = getPositionOnPath(movingPlayerIndex, 1);
        const capturedPieces = checkForCapture(
          movingPlayerIndex,
          newPosition,
          1,
        );
        const finalCaptures = Array.isArray(capturedPieces)
          ? capturedPieces
          : [];
        const didCaptureOnMoveOut = finalCaptures.length > 0;

        // Apply move + captures together in a single, consistent state update
        const finalPlayers = movedPlayers.map((p) => ({
          ...p,
          pieces: p.pieces.map((pc) => ({ ...pc })),
        }));
        finalCaptures.forEach(({ playerIndex, pieceIndex }) => {
          if (finalPlayers[playerIndex]?.pieces?.[pieceIndex]) {
            finalPlayers[playerIndex].pieces[pieceIndex] = applyPieceLifecycle(
              {
                ...finalPlayers[playerIndex].pieces[pieceIndex],
              },
              0,
              maxSteps,
            );
            const captureKey = `${playerIndex}-${pieceIndex}`;
            recentMovesRef.current.set(captureKey, {
              toSteps: 0,
              timestamp: Date.now(),
              isCapture: true,
            });
          }
        });

        setPlayers(finalPlayers);
        playersRef.current = finalPlayers;

        if (didCaptureOnMoveOut) {
          playSound("capture");
        }

        // Broadcast move + captures together so every client (host and
        // remaining players) applies the exact same result instead of
        // guessing or waiting on a later, potentially incomplete snapshot.
        if (onlineMode && socketRef.current && gameId) {
          try {
            console.log("[MOVE] Broadcasting move out of home", {
              playerIndex: movingPlayerIndex,
              pieceIndex: pieceId,
              toSteps: 1,
              fromSteps: 0,
              rolled: 6,
              captures: finalCaptures,
            });
            socketRef.current.emit("ludo:move", {
              gameId,
              by: myProfile?._id,
              playerIndex: movingPlayerIndex,
              pieceIndex: pieceId,
              toSteps: 1,
              fromSteps: 0,
              rolled: 6,
              captures: finalCaptures,
            });
          } catch (_e) {}
        }

        // Keep move protected for 5 seconds (longer for moves out of home to prevent reverts)
        setTimeout(() => {
          recentMovesRef.current.delete(pieceKey);
        }, 5000);

        isMovingRef.current = false; // Reset moving flag
        isAutoMovingRef.current = false; // Clear auto-moving flag
        // Remove the move timer
        moveTimersRef.current = moveTimersRef.current.filter(
          (t) => t !== moveTimerId,
        );

        // CRITICAL: In online mode, a non-host client must not expose a local
        // re-roll window immediately after consuming a move. When a player rolls
        // 6 and taps a piece quickly, currentPlayer remains the same until the
        // host emits the authoritative players snapshot. If we eagerly clear the
        // dice/rolling locks here, the canRollDice self-heal loop can briefly
        // re-enable rolling and allow a second roll before server confirmation.
        // Keep the local dice/rolling lock intact for remote clients and wait
        // for onPlayers/onMove from the host to finalize the state.
        const shouldDeferDiceResetToHost = onlineMode;
        if (!shouldDeferDiceResetToHost) {
          setDiceValueImmediate(0);
          lastLocalDiceRollTimeRef.current = 0;
          isRollingRef.current = false;
        }

        // Determine if player should keep turn: rolled 6 OR captured a token (traditional Ludo rule)
        // CRITICAL: Use the rolled dice value that was captured at the start of the move
        // Since we rolled 6 to move out, player gets another turn (traditional rule: rolling 6 gives another turn)
        // If they also captured, they still get another turn
        const rolledValueForMoveOut = rolledDiceValue; // Use the captured rolled value
        const keepTurnOnMoveOut =
          rolledValueForMoveOut === 6 || didCaptureOnMoveOut; // Rolling 6 or capturing gives another turn

        // CRITICAL: Only the host (or an offline/vs-computer game) is allowed
        // to locally mutate currentPlayer in online mode. If a non-host remote
        // player also mutated its own turn state here, it would race against
        // the host's authoritative decision made in onMove for this exact
        // same move (both use the same rolled/capture rule, but on different
        // timers), which was causing the host to sometimes never get its turn
        // back and the remote player's tokens to visibly "blink"/flicker as
        // the two conflicting turn decisions fought each other. Non-host
        // online players simply wait for the host's ludo:players snapshot to
        // update currentPlayer/canRollDice.
        const isTurnAuthorityLocal =
          !onlineMode || myPlayerIndexRef.current === 0;

        if (isTurnAuthorityLocal) {
          if (keepTurnOnMoveOut) {
            // CRITICAL: Add a small delay before allowing next roll to ensure all state is synchronized
            // This prevents the player from rolling twice in the same turn due to race conditions
            setTimeout(() => {
              // Double-check that it's still the same player's turn and dice is 0
              if (
                !onlineMode &&
                currentPlayerRef.current === movingPlayerIndex &&
                diceValueRef.current === 0
              ) {
                setCanRollDice(true); // keep turn on 6 (traditional Ludo rule)
              }
            }, ROLL_UNLOCK_DELAY_MS); // Small delay to ensure state propagation

            if (myPlayerIndexRef.current === 0 && onlineMode && gameId) {
              persistAndBroadcastGameState("keep_turn_after_move_from_home", {
                playerIndex: movingPlayerIndex,
                pieceIndex: pieceId,
                rolledValue: rolledValueForMoveOut,
                hasCapture: didCaptureOnMoveOut,
              });
            }
          } else {
            // No capture, advance turn
            setTimeout(() => {
              const nextPlayer = getNextActivePlayer(movingPlayerIndex);
              playSound("turnChange");
              setCurrentPlayerImmediate(nextPlayer);

              if (myPlayerIndexRef.current === 0 && onlineMode && gameId) {
                persistAndBroadcastGameState(
                  "turn_advance_after_move_from_home",
                  {
                    fromPlayer: movingPlayerIndex,
                    toPlayer: nextPlayer,
                    rolledValue: rolledValueForMoveOut,
                    hasCapture: didCaptureOnMoveOut,
                  },
                );
              }

              setTimeout(() => {
                if (
                  !onlineMode &&
                  currentPlayerRef.current === nextPlayer &&
                  diceValueRef.current === 0
                ) {
                  setCanRollDice(true);
                }
              }, ROLL_UNLOCK_DELAY_MS);
            }, TURN_TRANSITION_DELAY_MS);
          }
        } else {
          // Prevent a double-roll window: keep dice disabled locally until
          // the host's authoritative snapshot confirms the actual next turn.
          // Do this even when the player keeps the turn after a 6/capture;
          // otherwise the self-heal logic can reopen rolling before the host
          // confirms that the move was accepted.
          setCanRollDice(false);
          isRollingRef.current = true;
          console.log(
            "[MOVE_PIECE] Remote move out of home - waiting for host's authoritative turn update",
            {
              movingPlayerIndex,
              keepTurnOnMoveOut,
              diceValue: diceValueRef.current,
              currentPlayer: currentPlayerRef.current,
            },
          );
        }

        // Authoritative online sync for move-out-of-home is emitted only after
        // the host resolves the final keep-turn or turn-advance state above.
      } else if (pieceSteps > 0) {
        // Play piece move sound
        playSound("pieceMove");

        const movingPlayerIndex = actingPlayerIndex;
        const oldSteps = pieceSteps;
        const oldPosition = getPositionOnPath(movingPlayerIndex, oldSteps);
        const newSteps = pieceSteps + effectiveDiceValue;
        if (newSteps <= maxSteps) {
          // CRITICAL: Use the rolled dice value that was captured at the start of the move
          const capturedRolledValue = rolledDiceValue;
          const pieceKey = `${movingPlayerIndex}-${pieceId}`;

          // CRITICAL: Update state synchronously to the moved position FIRST so
          // capture checks below see an accurate, already-moved board. Previously
          // captures were computed AFTER the move was already broadcast (inside
          // the animation-complete callback), which meant captures were
          // silently dropped for every other client whenever a remote player
          // made the move - this is what caused token positions to diverge
          // between players in online mode.
          const sourcePlayersForMove =
            playersRef.current && Array.isArray(playersRef.current)
              ? playersRef.current
              : players;
          const movedPlayers = sourcePlayersForMove.map((p) => ({
            ...p,
            pieces: Array.isArray(p.pieces)
              ? p.pieces.map((pc) => ({ ...pc }))
              : [],
          }));
          movedPlayers[movingPlayerIndex].pieces[pieceId] = applyPieceLifecycle(
            {
              ...movedPlayers[movingPlayerIndex].pieces[pieceId],
            },
            newSteps,
            maxSteps,
          );
          playersRef.current = movedPlayers;

          // Compute captures synchronously (state already reflects the move)
          let finalCaptures = [];
          if (newSteps < maxSteps) {
            const newPosition = getPositionOnPath(movingPlayerIndex, newSteps);
            const capturedPieces = checkForCapture(
              movingPlayerIndex,
              newPosition,
              newSteps,
            );
            if (Array.isArray(capturedPieces)) {
              finalCaptures.push(...capturedPieces);
            }

            // Check for captures at the old position (when token moves away)
            // This handles the case where friend has double tokens and moves
            // one away, leaving a single token that should be captured
            if (oldSteps > 0 && oldSteps < maxSteps) {
              const capturedAfterMoveAway = checkForCaptureAfterMoveAway(
                movingPlayerIndex,
                oldPosition,
              );
              if (Array.isArray(capturedAfterMoveAway)) {
                finalCaptures.push(...capturedAfterMoveAway);
              }
            }
          }

          // Dedupe captures defensively (same piece could theoretically be
          // flagged by both capture checks above)
          const dedupedCaptureMap = new Map();
          finalCaptures.forEach((c) => {
            dedupedCaptureMap.set(`${c.playerIndex}-${c.pieceIndex}`, c);
          });
          finalCaptures = Array.from(dedupedCaptureMap.values());
          const didCapture = finalCaptures.length > 0;

          // Apply move + captures together in a single, consistent state update
          const finalPlayers = movedPlayers.map((p) => ({
            ...p,
            pieces: p.pieces.map((pc) => ({ ...pc })),
          }));
          finalCaptures.forEach(({ playerIndex, pieceIndex }) => {
            if (finalPlayers[playerIndex]?.pieces?.[pieceIndex]) {
              finalPlayers[playerIndex].pieces[pieceIndex] =
                applyPieceLifecycle(
                  {
                    ...finalPlayers[playerIndex].pieces[pieceIndex],
                  },
                  0,
                  maxSteps,
                );
              const captureKey = `${playerIndex}-${pieceIndex}`;
              recentMovesRef.current.set(captureKey, {
                toSteps: 0,
                timestamp: Date.now(),
                isCapture: true,
              });
            }
          });

          setPlayers(finalPlayers);
          playersRef.current = finalPlayers;

          if (didCapture) {
            playSound("capture");
          }

          // Track this move
          recentMovesRef.current.set(pieceKey, {
            toSteps: newSteps,
            timestamp: Date.now(),
          });

          // Broadcast move + captures together so every client (host and
          // remaining players) applies the exact same result instead of
          // guessing or waiting on a later, potentially incomplete snapshot.
          if (onlineMode && socketRef.current && gameId) {
            try {
              socketRef.current.emit("ludo:move", {
                gameId,
                by: myProfile?._id,
                playerIndex: movingPlayerIndex,
                pieceIndex: pieceId,
                toSteps: newSteps,
                fromSteps: oldSteps,
                rolled: rolledDiceValue, // Use the value captured before dice reset
                captures: finalCaptures,
              });
            } catch (_e) {}
          }

          // Animate the visual movement (state is already at target; this is
          // purely a visual/cosmetic slide for the local mover).
          animateTokenMovement(
            movingPlayerIndex,
            pieceId,
            newSteps,
            oldSteps,
            () => {
              // Keep move protected for 2 seconds after completion
              setTimeout(() => {
                recentMovesRef.current.delete(pieceKey);
              }, 2000);

              if (newSteps === maxSteps) {
                setPlayers((prev) => {
                  const updatedPlayers = prev.map((p) => ({
                    ...p,
                    pieces: p.pieces.map((pc) => ({ ...pc })),
                  }));
                  resolveWinnerStateForPlayer(
                    updatedPlayers,
                    movingPlayerIndex,
                  );
                  playersRef.current = updatedPlayers; // Update ref
                  return updatedPlayers;
                });
              }

              isMovingRef.current = false; // Reset moving flag
              isAutoMovingRef.current = false; // Clear auto-moving flag
              // CRITICAL: Remove this move's timer marker. Unlike the "move out
              // of home" branch above, this was never cleared here, leaving a
              // permanent stale entry in moveTimersRef.current after every
              // normal move. That stale entry made "isNotMoving"/"isIdle"
              // checks (used to decide whether the dice button should be
              // re-enabled) evaluate to false indefinitely, which was the
              // root cause of the next player's dice staying unclickable.
              moveTimersRef.current = moveTimersRef.current.filter(
                (t) => t !== moveTimerId,
              );

              // Determine if player should keep turn: rolled 6 OR captured a token (traditional Ludo rule)
              // CRITICAL: Use the captured rolled value to avoid closure issues
              const rolledValue =
                typeof capturedRolledValue === "number"
                  ? capturedRolledValue
                  : 0;
              const isSix = rolledValue === 6;
              const hasCapture = didCapture === true;
              // Player gets another turn if they roll 6 OR capture a token (traditional Ludo rule)
              // If both conditions are met, they definitely get another turn
              const keepTurn = isSix || hasCapture;

              console.log("[MOVE_PIECE] Move completed", {
                movingPlayerIndex,
                currentPlayerBefore: currentPlayerRef.current,
                rolledValue,
                isSix,
                hasCapture,
                keepTurn,
                diceValueBefore: diceValueRef.current,
                timestamp: Date.now(),
              });

              // CRITICAL: In online mode, a non-host client must keep its
              // local dice/rolling lock until the host confirms the post-move
              // state. Otherwise a fast move after rolling 6 can reopen the
              // dice locally before the authoritative snapshot arrives.
              const shouldDeferDiceResetToHost = onlineMode;
              if (!shouldDeferDiceResetToHost) {
                setDiceValueImmediate(0);
                lastLocalDiceRollTimeRef.current = 0;
                isRollingRef.current = false;
              }

              // The host emits a single final post-move snapshot only after it
              // resolves keep-turn vs turn-advance below, so all clients receive
              // the same canonical board and turn state together.

              // CRITICAL: Only the host (or an offline/vs-computer game) is
              // allowed to locally mutate currentPlayer in online mode. A
              // non-host remote mover must not also decide/advance the turn
              // here - the host already makes this exact decision (using the
              // same rolled/capture rule) inside onMove when it receives this
              // move. Letting both sides mutate currentPlayer independently
              // was the root cause of the host sometimes never regaining its
              // turn and of remote tokens visibly "blinking" from the two
              // conflicting decisions overwriting each other.
              const isTurnAuthorityLocal =
                !onlineMode || myPlayerIndexRef.current === 0;

              // CRITICAL: Check turn authority FIRST (outer branch), then decide
              // keep-turn vs advance-turn inside it. Previously "keepTurn" was
              // checked before "isTurnAuthorityLocal", so a non-host remote
              // client that rolled a 6/captured would skip the "wait for host
              // confirmation" branch entirely - inconsistent with the "move out
              // of home" branch below, which already gets this right.
              if (isTurnAuthorityLocal) {
                if (keepTurn) {
                  // Player keeps turn (rolled 6 or captured) - don't advance
                  console.log("[MOVE_PIECE] Player keeps turn", {
                    movingPlayerIndex,
                    currentPlayer: currentPlayerRef.current,
                    reason: isSix ? "rolled 6" : "captured token",
                  });

                  // CRITICAL: Explicitly re-enable rolling instead of relying
                  // solely on the passive useEffect - that effect is throttled
                  // and can miss this update, leaving the dice permanently
                  // disabled. This mirrors the pattern already used below for
                  // "move out of home" moves and in advanceTurnForPlayer.
                  setTimeout(() => {
                    if (
                      !onlineMode &&
                      currentPlayerRef.current === movingPlayerIndex &&
                      diceValueRef.current === 0
                    ) {
                      setCanRollDice(true);
                    }
                  }, ROLL_UNLOCK_DELAY_MS);

                  // Save and emit state after move completes (host only)
                  if (myPlayerIndexRef.current === 0 && onlineMode && gameId) {
                    persistAndBroadcastGameState("keep_turn_after_move", {
                      playerIndex: movingPlayerIndex,
                      rolledValue,
                      hasCapture,
                    });
                  }
                } else {
                  // CRITICAL: Advance to next player - this MUST happen for non-6, non-capture moves
                  const nextPlayer = getNextActivePlayer(movingPlayerIndex);

                  console.log("[MOVE_PIECE] Advancing turn", {
                    fromPlayer: movingPlayerIndex,
                    toPlayer: nextPlayer,
                    currentPlayerBefore: currentPlayerRef.current,
                    timestamp: Date.now(),
                  });

                  // Play turn change sound
                  playSound("turnChange");

                  // CRITICAL: Update ref first, then state, to ensure ref is always up-to-date
                  // This prevents race conditions where state hasn't updated yet but ref has
                  currentPlayerRef.current = nextPlayer; // Update ref immediately to prevent race conditions
                  lastTurnAdvanceTimeRef.current = Date.now(); // Track when we advanced the turn locally

                  // CRITICAL: Reset consecutive 6s for the player who lost their turn
                  if (consecutiveSixesRef.current[movingPlayerIndex] > 0) {
                    setConsecutiveSixes((prev) => ({
                      ...prev,
                      [movingPlayerIndex]: 0,
                    }));
                    consecutiveSixesRef.current[movingPlayerIndex] = 0;
                  }

                  // Update state using functional update to ensure consistency
                  setCurrentPlayer((prev) => {
                    // Ensure we're setting the correct next player
                    if (prev !== nextPlayer) {
                      return nextPlayer;
                    }
                    return prev; // Already correct, no change needed
                  });

                  console.log("[MOVE_PIECE] Turn advanced", {
                    currentPlayerAfter: currentPlayerRef.current,
                    nextPlayer,
                    lastTurnAdvanceTime: lastTurnAdvanceTimeRef.current,
                    myPlayerIndex: myPlayerIndexRef.current,
                    isMyTurn: nextPlayer === myPlayerIndexRef.current,
                  });

                  // CRITICAL: Save and emit game state when turn changes (host only)
                  if (myPlayerIndexRef.current === 0 && onlineMode && gameId) {
                    console.log(
                      "[MOVE_PIECE] Host persisting state after turn change",
                      {
                        currentPlayer: currentPlayerRef.current,
                        nextPlayer,
                        gameId,
                      },
                    );
                    persistAndBroadcastGameState("turn_advance_after_move", {
                      fromPlayer: movingPlayerIndex,
                      toPlayer: nextPlayer,
                      rolledValue,
                      hasCapture,
                    });
                  }

                  // CRITICAL: Explicitly re-enable rolling for the next player
                  // instead of relying solely on the passive useEffect. Without
                  // this, the next player's dice could stay disabled forever in
                  // offline hot-seat mode (the periodic self-heal safety net only
                  // runs in online mode) - this was the root cause of "the next
                  // player's dice is not clickable" after a move.
                  setTimeout(() => {
                    if (
                      !onlineMode &&
                      currentPlayerRef.current === nextPlayer &&
                      diceValueRef.current === 0
                    ) {
                      setCanRollDice(true);
                    }
                  }, ROLL_UNLOCK_DELAY_MS);
                }
              } else {
                // Prevent a double-roll window: keep dice disabled and the
                // rolling lock active locally until the host's authoritative
                // snapshot confirms the actual next turn (or same-player extra
                // turn after a 6/capture). currentPlayer is intentionally left
                // unchanged here - the host owns that decision.
                setCanRollDice(false);
                isRollingRef.current = true;
                console.log(
                  "[MOVE_PIECE] Remote move consumed - waiting for host's authoritative turn update",
                  {
                    movingPlayerIndex,
                    rolledValue,
                    hasCapture,
                    diceValue: diceValueRef.current,
                    currentPlayer: currentPlayerRef.current,
                  },
                );
              }
            },
          );
        } else {
          // Invalid move, reset flags
          isMovingRef.current = false;
          isAutoMovingRef.current = false;
        }
      } else {
        // Invalid move, reset flags
        isMovingRef.current = false;
        isAutoMovingRef.current = false;
      }
    };

    try {
      globalMove();
    } catch (err) {
      console.error("[MOVE_PIECE] Move failed", err);
      isMovingRef.current = false;
      isAutoMovingRef.current = false;
    }
  };

  // Online socket listeners (gameplay + sync)
  useEffect(() => {
    const s = socketRef.current;
    if (!s || !onlineMode) return;

    const onMove = (payload) => {
      try {
        if (!payload || payload.gameId !== gameId) return;

        // Processing move from other player

        // Ignore our own moves
        if (payload.by === myProfile?._id) return;

        const incomingCaptures = Array.isArray(payload.captures)
          ? payload.captures
          : [];
        if (myPlayerIndexRef.current === 0) {
          awaitingAuthoritativeSnapshotRef.current = true;
        }

        // A remote move can arrive while the host is still saving the preceding
        // dice-roll snapshot. Invalidate that emission before applying the move;
        // the post-move persist below will save and broadcast the complete board.
        if (myPlayerIndexRef.current === 0 && isSavingGameStateRef.current) {
          persistRequestVersionRef.current += 1;
          console.log(
            "[LUDO][sync] in-flight snapshot invalidated by remote move",
            {
              gameId,
              playerIndex: payload.playerIndex,
              pieceIndex: payload.pieceIndex,
              requestVersion: persistRequestVersionRef.current,
            },
          );
        }

        // Apply remote move AND any captures together, so every client's
        // board matches exactly what the mover computed. Previously captures
        // were never included in this payload, so a capture made by a remote
        // player was silently dropped here - the captured piece stayed on the
        // board for the host/other clients while it was already sent home on
        // the mover's own screen, causing token positions to diverge.
        const nextPlayers = (playersRef.current || []).map((p) => ({
          ...p,
          pieces: p.pieces.map((pc) => ({ ...pc })),
        }));
        const player = nextPlayers[payload.playerIndex];
        if (player && player.pieces[payload.pieceIndex]) {
          const piece = player.pieces[payload.pieceIndex];
          piece.steps = payload.toSteps;
          piece.isHome = payload.toSteps === 0;
          piece.isInPlay =
            payload.toSteps > 0 && payload.toSteps < maxStepsRef.current;
        }
        incomingCaptures.forEach(({ playerIndex, pieceIndex }) => {
          if (nextPlayers[playerIndex]?.pieces?.[pieceIndex]) {
            nextPlayers[playerIndex].pieces[pieceIndex] = {
              ...nextPlayers[playerIndex].pieces[pieceIndex],
              steps: 0,
              isHome: true,
              isInPlay: false,
            };
          }
        });
        setPlayers(nextPlayers);
        playersRef.current = nextPlayers;

        if (incomingCaptures.length > 0) {
          playSound("capture");
        }

        // CRITICAL: Track the rolled value from the move event so we can restore it
        // if the diceValue gets cleared before the host broadcasts the updated state
        if (payload.rolled > 0) {
          lastDiceValueRef.current = payload.rolled;
        }

        // Track the recent remote move (and captures) briefly so a
        // slightly-late snapshot does not visually revert them before the
        // authoritative players state arrives.
        const pieceKey = `${payload.playerIndex}-${payload.pieceIndex}`;
        recentMovesRef.current.set(pieceKey, {
          toSteps: payload.toSteps,
          timestamp: Date.now(),
        });
        incomingCaptures.forEach(({ playerIndex, pieceIndex }) => {
          const captureKey = `${playerIndex}-${pieceIndex}`;
          recentMovesRef.current.set(captureKey, {
            toSteps: 0,
            timestamp: Date.now(),
            isCapture: true,
          });
        });
        setTimeout(() => {
          const tracked = recentMovesRef.current.get(pieceKey);
          if (
            tracked &&
            tracked.toSteps === payload.toSteps &&
            Date.now() - tracked.timestamp >= 2500
          ) {
            recentMovesRef.current.delete(pieceKey);
          }
        }, 2600);

        // Host must publish the authoritative post-move snapshot even when the
        // move was made by a remote player, otherwise the next turn never reaches
        // the other clients. Capturing a token also keeps the turn, matching
        // the same rule the mover's own client uses.
        if (myPlayerIndexRef.current === 0 && onlineMode && gameId) {
          const rolledValue = Number(payload.rolled || 0);
          const hasCapture = incomingCaptures.length > 0;
          const keepTurn = rolledValue === 6 || hasCapture;

          resolveWinnerStateForPlayer(nextPlayers, payload.playerIndex);

          // CRITICAL: If keeping turn, reset the dice broadcast to 0 so the
          // mover's own client can clear its local rolling lock and re-enable the
          // dice for the next roll. Broadcasting the stale value keeps the turn
          // "kept" but leaves the client waiting on a stale roll state.
          if (keepTurn && rolledValue > 0) {
            diceValueRef.current = 0;
            setDiceValueImmediate(0);
            lastLocalDiceRollTimeRef.current = 0;
            // Mark that this player just kept their turn (for onPlayers dice protection logic)
            justKeptTurnRef.current[payload.playerIndex] = {
              value: rolledValue,
              ts: Date.now(),
            };
            // Clean up after 2.5 seconds
            setTimeout(() => {
              delete justKeptTurnRef.current[payload.playerIndex];
            }, 2500);
          }

          if (!keepTurn) {
            const nextPlayer = getNextActivePlayer(payload.playerIndex);
            currentPlayerRef.current = nextPlayer;
            lastTurnAdvanceTimeRef.current = Date.now();
            setCurrentPlayer(nextPlayer);
            // Only clear diceValue if turn is actually advancing
            setDiceValueImmediate(0);
            lastLocalDiceRollTimeRef.current = 0;

            console.log(
              "[ON_MOVE][HOST] Persisting authoritative turn change",
              {
                fromPlayer: payload.playerIndex,
                toPlayer: nextPlayer,
                rolledValue,
                hasCapture,
                diceValue: diceValueRef.current,
                gameId,
              },
            );
            persistAndBroadcastGameState("turn_advance_after_remote_move", {
              fromPlayer: payload.playerIndex,
              toPlayer: nextPlayer,
              rolledValue,
              hasCapture,
            });
          } else {
            // Keep turn - player rolled a 6 or captured.
            console.log(
              "[ON_MOVE][HOST] Persisting authoritative keep-turn state",
              {
                playerIndex: payload.playerIndex,
                rolledValue,
                hasCapture,
                diceValue: diceValueRef.current,
                gameId,
              },
            );
            persistAndBroadcastGameState("keep_turn_after_remote_move", {
              playerIndex: payload.playerIndex,
              rolledValue,
              hasCapture,
            });
          }
        }
      } catch (_e) {
        console.error("[ON_MOVE] Error processing move:", _e);
      }
    };

    const onRoll = (payload) => {
      console.log("[ON_ROLL] Received roll event", {
        payload,
        gameId,
        myProfileId: myProfile?._id,
        payloadBy: payload?.by,
        payloadPlayer: payload?.currentPlayer,
        currentPlayer: currentPlayerRef.current,
        isRollingRef: isRollingRef.current,
      });

      if (!payload || payload.gameId !== gameId) {
        console.log(
          "[ON_ROLL] ❌ Rejected: invalid payload or gameId mismatch",
        );
        return;
      }
      // Skip if this roll was from the current user (handled in rollDice)
      if (
        payload.by &&
        myProfile?._id &&
        String(payload.by) === String(myProfile._id)
      ) {
        console.log("[ON_ROLL] ❌ Rejected: this is my own roll");
        return;
      }

      // Server validates turn, so we trust this is correct
      console.log("[ON_ROLL] ✅ Processing remote roll (server validated)");

      const value = payload.value;
      const rollingPlayer =
        typeof payload.currentPlayer === "number"
          ? payload.currentPlayer
          : currentPlayerRef.current;
      const isHostAuthority = myPlayerIndexRef.current === 0;

      // Align the local turn pointer with the validated roll sender before we
      // process dice/counter state. This prevents us from attributing the roll
      // to the wrong player when snapshots are slightly behind.
      if (typeof rollingPlayer === "number") {
        currentPlayerRef.current = rollingPlayer;
        setCurrentPlayer((prev) =>
          prev === rollingPlayer ? prev : rollingPlayer,
        );
      }

      // CRITICAL: Track consecutive 6s for remote players and handle limit
      const currentSixCount = consecutiveSixesRef.current[rollingPlayer] || 0;
      console.log("[ON_ROLL] Tracking consecutive 6s", {
        player: rollingPlayer,
        currentSixCount,
        diceValue: value,
        isSix: value === 6,
      });

      if (value === 6) {
        // Increment consecutive 6s count for remote player
        const newSixCount = currentSixCount + 1;
        setConsecutiveSixes((prev) => ({
          ...prev,
          [rollingPlayer]: newSixCount,
        }));
        consecutiveSixesRef.current[rollingPlayer] = newSixCount;

        console.log("[ON_ROLL] Updated consecutive 6s", {
          player: rollingPlayer,
          previousCount: currentSixCount,
          newCount: newSixCount,
        });

        // Check if remote player reached the 6s limit (only if explicitly flagged or count is exactly 3)
        if (payload.reachedSixLimit || newSixCount >= 3) {
          console.log(
            "[ON_ROLL] Remote player reached 6s limit, advancing turn",
            {
              player: rollingPlayer,
              consecutiveSixes: newSixCount,
              reachedLimit: payload.reachedSixLimit,
            },
          );

          // Reset consecutive 6s count for this player
          setConsecutiveSixes((prev) => ({
            ...prev,
            [rollingPlayer]: 0,
          }));
          consecutiveSixesRef.current[rollingPlayer] = 0;

          // Only the host should publish the authoritative next turn in online mode.
          // Other clients wait for the next ludo:players snapshot to avoid split-brain.
          setDiceValueImmediate(value);
          lastDiceValueRef.current = value;
          isRollingRef.current = false;

          if (isHostAuthority && onlineMode && gameId) {
            setTimeout(() => {
              const nextPlayer = getNextActivePlayer(rollingPlayer);
              console.log("[ON_ROLL] Host advancing turn (6s limit reached)", {
                from: rollingPlayer,
                to: nextPlayer,
              });
              setCurrentPlayer(nextPlayer);
              currentPlayerRef.current = nextPlayer;
              lastTurnAdvanceTimeRef.current = Date.now();
              setDiceValueImmediate(0);
              lastLocalDiceRollTimeRef.current = 0;
              persistAndBroadcastGameState("three_consecutive_sixes", {
                playerIndex: rollingPlayer,
                rolledValue: value,
                reachedSixLimit: true,
              });
            }, TURN_TRANSITION_DELAY_MS);
          }

          return; // Exit early - don't proceed with normal move logic
        }
      } else {
        // Reset consecutive 6s count if non-6 is rolled
        if (currentSixCount > 0) {
          console.log("[ON_ROLL] Resetting consecutive 6s (non-6 rolled)", {
            player: rollingPlayer,
            previousCount: currentSixCount,
          });
          setConsecutiveSixes((prev) => ({
            ...prev,
            [rollingPlayer]: 0,
          }));
          consecutiveSixesRef.current[rollingPlayer] = 0;
        }
      }

      setDiceValueImmediate(value);
      lastDiceValueRef.current = value;
      isRollingRef.current = false; // Clear rolling flag

      const currentPlayerData = playersRef.current[rollingPlayer];

      // Check if current player can move
      const canMove = currentPlayerData?.pieces?.some((piece) => {
        const steps = getPieceSteps(piece);
        if (steps <= 0) return value === 6;
        if (steps < maxStepsRef.current && steps + value <= maxStepsRef.current)
          return true;
        return false;
      });

      if (!canMove) {
        // No moves available - advance turn after a short delay
        if (isHostAuthority && onlineMode && gameId) {
          setTimeout(() => {
            const nextPlayer = getNextActivePlayer(rollingPlayer);
            console.log("[ON_ROLL] Host advancing turn - no moves available", {
              from: rollingPlayer,
              to: nextPlayer,
            });
            setCurrentPlayer(nextPlayer);
            currentPlayerRef.current = nextPlayer;
            lastTurnAdvanceTimeRef.current = Date.now();
            setDiceValueImmediate(0);
            lastLocalDiceRollTimeRef.current = 0;
            persistAndBroadcastGameState("turn_advance_no_playable_move", {
              playerIndex: rollingPlayer,
              rolledValue: value,
            });
          }, TURN_TRANSITION_DELAY_MS);
        }
      } else {
        // Remote player has moves available - they should be able to make a move
        // CRITICAL: If they rolled a 6, they should keep their turn after moving
        // Don't advance turn automatically - let them make their move first
        console.log("[ON_ROLL] Remote player has moves available", {
          currentPlayer: currentPlayerRef.current,
          diceValue: value,
          canMove: true,
          isSix: value === 6,
        });

        // CRITICAL: Don't set canRollDice to true here - they should be moving, not rolling
        // The move will be handled by piece clicks, and turn will be handled after the move
        // Only set canRollDice if it's NOT a 6 and they should lose their turn
        if (value !== 6) {
          // For non-6 values, they might lose their turn after moving
          // But we still don't set canRollDice here - let the move logic handle it
          console.log(
            "[ON_ROLL] Non-6 rolled - turn will be handled after move",
          );
        } else {
          // For 6, they should keep their turn after moving
          console.log(
            "[ON_ROLL] 6 rolled - player will keep turn after moving",
          );
        }

        if (isHostAuthority && onlineMode && gameId) {
          setTimeout(() => {
            persistAndBroadcastGameState("dice_roll", {
              playerIndex: rollingPlayer,
              rolledValue: value,
              remoteRoll: true,
            });
          }, 0);
        }
      }
    };

    const onAccepted = (payload) => {
      try {
        const activeGameId = gameIdRef.current;
        if (
          !payload ||
          !activeGameId ||
          String(payload.gameId) !== String(activeGameId)
        )
          return;
        // Once the host has started the match, delayed invite acceptances must
        // not overwrite seats that were replaced with computer players.
        if (gameStartedRef.current) return;

        // Only process accept events if we're the host (myPlayerIndex === 0)
        // This ensures only the host processes friend join events
        if (myPlayerIndex !== 0) {
          console.log(
            `[onAccepted] Ignoring accept event - not host (myPlayerIndex=${myPlayerIndex})`,
          );
          return;
        }
        // Don't process accept events for ourselves
        if (
          payload.friend &&
          payload.friend._id &&
          myProfile?._id &&
          String(payload.friend._id) === String(myProfile._id)
        ) {
          console.log(
            `[onAccepted] Ignoring accept event - friend is ourselves`,
          );
          return;
        }
        // Host updates: friend joined; update status and broadcast players
        // Only mark as 'joined' if the friend was actually invited (not already joined or declined)
        if (payload.friend && payload.friend._id) {
          const friendId = payload.friend._id;
          const friendIdStr = String(friendId);
          // Use ref for synchronous check to avoid race conditions - try both string and original key
          // Note: payload.from is the host/inviter, payload.friend._id is the friend who accepted
          const currentStatus =
            invitedStatusByFriendIdRef.current[friendIdStr] ||
            invitedStatusByFriendIdRef.current[friendId];
          const expectedSlot =
            invitedSlotByFriendIdRef.current[friendIdStr] ||
            invitedSlotByFriendIdRef.current[friendId];
          console.log(
            `[onAccepted] friendId=${friendId} (as string: ${friendIdStr}), currentStatus=${currentStatus}, expectedSlot=${expectedSlot}, payload.slotIndex=${payload.slotIndex}, myPlayerIndex=${myPlayerIndex}, payload.from=${payload.from}`,
          );

          // NOTE: This handler previously ignored any "accepted" event that
          // arrived within 1 second of sending the invite, to guard against
          // spurious/duplicate events. In practice this silently dropped
          // legitimate fast acceptances (e.g. auto-accept invite links, or a
          // friend who already had the invite ready and tapped Accept
          // immediately) - the host would never learn the friend had joined,
          // while the friend's own client believed it had. This is a likely
          // cause of "stuck in lobby" / seats not filling reports. The other
          // guards below (status must be 'invited'/'joined', slot must match,
          // and de-dup once already 'joined') are sufficient to reject bad or
          // duplicate accept events without an arbitrary time-based cutoff.

          // CRITICAL: Only process if friend was previously 'invited' OR if status is undefined/null (first time accepting)
          // This allows processing accept events even if status wasn't set properly
          if (
            currentStatus &&
            currentStatus !== "invited" &&
            currentStatus !== "joined"
          ) {
            console.log(
              `[onAccepted] Ignoring accept event - friend status is '${currentStatus}', not 'invited' or undefined`,
            );
            return;
          }

          // If already joined, skip (prevent duplicate processing)
          if (currentStatus === "joined") {
            console.log(`[onAccepted] Friend already joined, skipping`);
            return;
          }

          // Only update to 'joined' if:
          // 1. The friend was previously 'invited' (not already joined or declined) - checked above
          // 2. The slot index matches the slot we invited them to (if provided)
          const slotMatches =
            typeof payload.slotIndex !== "number" ||
            expectedSlot === undefined ||
            Number(payload.slotIndex) === Number(expectedSlot);
          console.log(
            `[onAccepted] slotMatches=${slotMatches}, currentStatus === 'invited': ${currentStatus === "invited"}`,
          );
          if (slotMatches) {
            setInvitedStatusByFriendId((prev) => {
              const updated = { ...prev, [friendIdStr]: "joined" };
              console.log(
                `[onAccepted] Setting status to 'joined' for friend ${friendIdStr}, updated status:`,
                updated,
              );
              // Update ref immediately for synchronous checks
              invitedStatusByFriendIdRef.current = updated;
              return updated;
            });
            if (typeof payload.slotIndex === "number") {
              setInvitedSlotByFriendId((prev) => ({
                ...prev,
                [friendIdStr]: payload.slotIndex,
              }));
              invitedSlotByFriendIdRef.current = {
                ...invitedSlotByFriendIdRef.current,
                [friendIdStr]: payload.slotIndex,
              };
            }
          } else {
            console.log(
              `[onAccepted] Ignoring accept event - slot doesn't match (expected ${expectedSlot}, got ${payload.slotIndex})`,
            );
            return;
          }
        } else {
          // No friend data in payload, ignore
          console.log(
            `[onAccepted] Ignoring accept event - no friend data in payload`,
          );
          return;
        }
        if (typeof payload.slotIndex === "number") {
          setPlayers((prev) => {
            const copy = prev.map((p) => ({
              ...p,
              pieces: p.pieces.map((pc) => ({ ...pc })),
            }));
            const slot = payload.slotIndex;
            if (copy[slot]) {
              copy[slot].name = payload.friend?.fullName || copy[slot].name;
              copy[slot].avatar =
                payload.friend?.profilePic || copy[slot].avatar;
              copy[slot].cover =
                payload.friend?.coverPic ||
                payload.friend?.cover ||
                payload.friend?.profileCover ||
                copy[slot].cover;
              copy[slot].profileId =
                payload.friend?._id || copy[slot].profileId;
              copy[slot].isActive = true;
              copy[slot].isOffline = false;
              copy[slot].offlineSince = undefined;
            }
            // Ensure no other non-host seat keeps the same accepted profileId.
            copy.forEach((player, idx) => {
              if (
                idx !== 0 &&
                idx !== slot &&
                player?.profileId &&
                payload.friend?._id &&
                String(player.profileId) === String(payload.friend._id)
              ) {
                copy[idx] = {
                  ...player,
                  profileId: undefined,
                  isActive: false,
                  isOffline: false,
                  offlineSince: undefined,
                  name: playerNames[idx] || player.name,
                };
              }
            });
            playersRef.current = copy;
            return copy;
          });

          // CRITICAL: Clear reconnecting state when friend accepts (host only)
          // This prevents the reconnecting modal from showing when friend joins
          setIsReconnecting(false);
          setShowReconnectModal(false);
          console.log(
            "[onAccepted] Cleared reconnecting state - friend accepted invite",
          );

          // Use setTimeout to ensure state update completes before saving and emitting
          setTimeout(() => {
            // Save and emit state after friend accepts (host only)
            if (myPlayerIndex === 0) {
              persistAndBroadcastGameState("player_accept_join", {
                slotIndex: payload.slotIndex,
                friendId: payload.friend?._id,
              });
            }
            // Update lobby state based on new join
            recomputeWaitingState();

            // Acceptance is authoritative for the reserved slot. If every
            // required seat is now occupied, auto-start immediately instead of
            // waiting for a later snapshot/effect cycle that can occasionally lag.
            const maxPlayers = Math.max(
              2,
              Math.min(4, selectedPlayerCountRef.current),
            );
            const currentPlayers =
              playersRef.current && Array.isArray(playersRef.current)
                ? playersRef.current
                : [];
            const allSeatsFilled = Array.from({ length: maxPlayers - 1 }).every(
              (_, idx) =>
                Boolean(
                  currentPlayers[idx + 1]?.profileId ||
                  currentPlayers[idx + 1]?.isBot,
                ),
            );

            if (
              myPlayerIndex === 0 &&
              !gameStartedRef.current &&
              !autoStartTriggeredRef.current &&
              allSeatsFilled &&
              gameIdRef.current
            ) {
              autoStartTriggeredRef.current = true;
              setGameStarted(true);
              gameStartedRef.current = true;
              setCurrentPlayer(0);
              currentPlayerRef.current = 0;
              setDiceValueImmediate(0);
              setWaitingForPlayers(false);
              setCanRollDice(false);

              setTimeout(() => {
                persistAndBroadcastGameState("game_auto_start_after_accept", {
                  trigger: "onAccepted",
                });
              }, 150);
            }
          }, 200);
        } else {
          // If no slot index, still clear reconnecting and recompute
          setIsReconnecting(false);
          setShowReconnectModal(false);
          recomputeWaitingState();
        }
      } catch (_e) {}
    };

    const onPlayers = (payload) => {
      try {
        if (!payload) return;
        const payloadSeq = Number(
          payload.playersSeq || payload.stateVersion || 0,
        );
        // Accept if gameId matches current or saved game state (for reconnection)
        const currentGid =
          gameIdRef.current || savedGameStateRef.current?.gameId;
        if (payload.gameId !== currentGid) return;

        // A versioned dice snapshot may have started saving before a token was
        // moved. Do not let that pre-move board overwrite an optimistic move
        // while the host is preparing the newer post-move snapshot.
        const snapshotActionType = String(payload.lastActionType || "");
        const hasPendingMoveConflict =
          awaitingAuthoritativeSnapshotRef.current &&
          !snapshotActionType.includes("move") &&
          Array.from(recentMovesRef.current.entries()).some(
            ([pieceKey, tracked]) => {
              if (!tracked || Date.now() - tracked.timestamp > 5000)
                return false;
              const [playerIndex, pieceIndex] = pieceKey
                .split("-")
                .map((value) => Number(value));
              const incomingSteps =
                payload.players?.[playerIndex]?.pieces?.[pieceIndex]?.steps;
              return (
                typeof incomingSteps === "number" &&
                incomingSteps !== tracked.toSteps
              );
            },
          );
        if (payloadSeq > 0 && hasPendingMoveConflict) {
          console.log("[LUDO][sync] ignored pre-move authoritative snapshot", {
            payloadSeq,
            lastActionType: snapshotActionType,
            gameId: payload.gameId,
          });
          return;
        }

        if (
          payloadSeq > 0 &&
          latestAppliedPlayersSeqRef.current > 0 &&
          payloadSeq <= latestAppliedPlayersSeqRef.current
        ) {
          const snapshotMatchesCanonicalState =
            payloadSeq === latestAppliedPlayersSeqRef.current &&
            payload.currentPlayer === currentPlayerRef.current &&
            Number(payload.diceValue || 0) ===
              Number(diceValueRef.current || 0) &&
            Array.isArray(payload.players) &&
            payload.players.every(
              (player, playerIndex) =>
                Array.isArray(player?.pieces) &&
                player.pieces.every(
                  (piece, pieceIndex) =>
                    Number(piece?.steps || 0) ===
                    Number(
                      playersRef.current?.[playerIndex]?.pieces?.[pieceIndex]
                        ?.steps || 0,
                    ),
                ),
            );

          if (
            awaitingAuthoritativeSnapshotRef.current &&
            snapshotMatchesCanonicalState
          ) {
            awaitingAuthoritativeSnapshotRef.current = false;
            isRollingRef.current = false;
            isMovingRef.current = false;
            isAutoMovingRef.current = false;
            moveTimersRef.current = [];
            const canRollFromConfirmedSnapshot =
              Boolean(payload.gameStarted) &&
              !payload.gameEnded &&
              Number(payload.diceValue || 0) === 0 &&
              payload.currentPlayer === myPlayerIndexRef.current;
            setCanRollDice(canRollFromConfirmedSnapshot);
            console.log(
              "[LUDO][sync] matching duplicate snapshot confirmed pending action",
              {
                payloadSeq,
                gameId: payload.gameId,
                canRollDice: canRollFromConfirmedSnapshot,
              },
            );
            return;
          }

          console.log("[LUDO][sync] ignored stale or duplicate snapshot", {
            payloadSeq,
            latestApplied: latestAppliedPlayersSeqRef.current,
            gameId: payload.gameId,
          });
          return;
        }
        if (payloadSeq > 0) {
          latestAppliedPlayersSeqRef.current = payloadSeq;
          if (myPlayerIndexRef.current === 0) {
            latestSentPlayersSeqRef.current = Math.max(
              latestSentPlayersSeqRef.current,
              payloadSeq,
            );
          }
        }
        // If we're reconnecting and this matches saved state, restore gameId
        if (
          !gameIdRef.current &&
          savedGameStateRef.current?.gameId === payload.gameId
        ) {
          gameIdRef.current = payload.gameId;
          setGameId(payload.gameId);
        }

        // Check if this is a rejoin scenario (game already started but we're receiving state)
        // Check if game has started by looking at payload.gameStarted OR if pieces have moved
        const hasGameProgress =
          payload.players &&
          Array.isArray(payload.players) &&
          payload.players.some(
            (p) => p.pieces && p.pieces.some((pc) => pc.steps > 0),
          );

        // CRITICAL: Only treat as rejoin if we have saved game state (actual reconnection)
        // NOT if we just accepted an invite (new join)
        const hasSavedState =
          savedGameStateRef.current &&
          savedGameStateRef.current.gameId === payload.gameId;
        const isJoiningViaInvite =
          isJoiningViaInviteRef.current &&
          String(payload.gameId) === String(gameIdRef.current);

        if (isJoiningViaInvite) {
          setIsReconnecting(false);
          setShowReconnectModal(false);
        }

        const isRejoining =
          hasSavedState &&
          !isJoiningViaInvite &&
          !gameStarted &&
          (payload.gameStarted || hasGameProgress);

        // If game has started (from payload or local state), restore game state immediately
        if (payload.gameStarted || hasGameProgress) {
          // Restore game started state if we're reconnecting or joining
          if (!gameStarted && (payload.gameStarted || hasGameProgress)) {
            setGameStarted(true);
            gameStartedRef.current = true;
            setIsReconnecting(false);
            setShowReconnectModal(false);
            // Only clear recent moves if this is an actual reconnection (not new join)
            if (isRejoining) {
              recentMovesRef.current.clear();
              // Only reset hasProcessedReconnectionStateRef if we haven't processed it yet
              // This prevents the loop where it keeps getting reset
              if (hasProcessedReconnectionStateRef.current) {
                // Already processed, don't reset
              } else {
                // Mark that we need to process initial reconnection state
                hasProcessedReconnectionStateRef.current = false;
              }
            } else {
              // For new joins, mark as processed so we don't treat subsequent updates as reconnection
              hasProcessedReconnectionStateRef.current = true;
            }
          }
          setWaitingForPlayers(false);
          setIsReconnecting(false);
          setShowReconnectModal(false);
          // CRITICAL: Don't set canRollDice to true unconditionally - let the useEffect handle it
          // This prevents friends from being able to roll dice when it's not their turn
          // The useEffect will properly check if it's the player's turn before enabling dice roll
          // setCanRollDice(true); // Removed - let useEffect handle based on turn
          // CRITICAL: Clear reconnecting state when we receive valid game state
          // This handles both reconnection and initial join after accepting invite
          setIsReconnecting(false);
          setShowReconnectModal(false);
          // CRITICAL: Clear isJoiningViaInviteRef after game starts so normal state saving can resume
          // This allows the game to save state normally after the initial join is complete
          if (isJoiningViaInviteRef.current && payload.gameStarted) {
            console.log(
              "[ON_PLAYERS] Game started - clearing isJoiningViaInviteRef flag",
            );
            // Clear the flag after a short delay to ensure all initial state is processed
            setTimeout(() => {
              isJoiningViaInviteRef.current = false;
              inviteAcceptTimestampRef.current = 0; // Reset timestamp
            }, 1000);
          }
          // CRITICAL: Ensure onlineMode is set when receiving game state (for friend who accepted invite)
          if (!onlineMode && payload.gameStarted) {
            setOnlineMode(true);
            console.log(
              "[ON_PLAYERS] Set onlineMode=true after receiving game state",
            );
          }
          console.log(
            "[ON_PLAYERS] Cleared reconnecting state - received game state",
            {
              gameStarted: payload.gameStarted,
              hasGameProgress,
              isRejoining,
              hasSavedState,
              hasProcessedReconnection:
                hasProcessedReconnectionStateRef.current,
              onlineMode,
            },
          );
        }

        // Also update gameStartedRef if payload explicitly sets it
        if (payload.gameStarted !== undefined) {
          gameStartedRef.current = payload.gameStarted;
          // If game is starting/restarting, clear recent moves
          if (payload.gameStarted && !gameStarted) {
            recentMovesRef.current.clear();
          }
        }

        // Don't ignore broadcasts - always process them to keep state in sync
        // But protect dice value if we recently rolled locally
        const incomingCurrentPlayer =
          typeof payload.currentPlayer === "number"
            ? payload.currentPlayer
            : currentPlayerRef.current;
        const incomingDiceValue =
          typeof payload.diceValue === "number" ? payload.diceValue : 0;
        const isMyTurn = currentPlayerRef.current === myPlayerIndex;
        const hasActiveDice = diceValueRef.current > 0;
        const timeSinceLocalRoll =
          Date.now() - lastLocalDiceRollTimeRef.current;
        const recentlyRolledLocally =
          timeSinceLocalRoll < 5000 && lastLocalDiceRollTimeRef.current > 0;
        const shouldProtectDiceValue =
          isMyTurn && (hasActiveDice || recentlyRolledLocally);

        // Snapshot is authoritative for turn/dice resolution in online games.
        // If the turn changed or the host says there is no active dice value,
        // clear any stale local rolling/moving locks so the next player can act.
        if (onlineMode) {
          const turnChanged =
            incomingCurrentPlayer !== currentPlayerRef.current;
          const snapshotClearsDice = incomingDiceValue === 0;
          const samePlayerTurnStillActive =
            currentPlayerRef.current === myPlayerIndexRef.current &&
            !isMovingRef.current &&
            !isAutoMovingRef.current;
          if (turnChanged || snapshotClearsDice) {
            isRollingRef.current = false;
            // CRITICAL: Clear stale move timers when turn changes to prevent dice from getting stuck
            // This can happen if animation timers don't complete properly
            if (turnChanged) {
              const now = Date.now();
              moveTimersRef.current.forEach((timer) => {
                // Clear any timeout IDs
                if (typeof timer === "number") {
                  try {
                    clearTimeout(timer);
                  } catch (_e) {}
                }
              });
              moveTimersRef.current = [];
              isMovingRef.current = false;
              isAutoMovingRef.current = false;
              console.log(
                "[ON_PLAYERS] 🧹 Cleared stale move timers due to turn change",
              );
            }
            // CRITICAL FIX: A keep-turn snapshot explicitly clears dice to 0 and keeps the same
            // turn active. We must release the local rolling lock in that case so the current
            // player can roll again immediately instead of staying blocked forever.
            const shouldReleaseSamePlayerDiceLock =
              snapshotClearsDice &&
              samePlayerTurnStillActive &&
              currentPlayerRef.current === myPlayerIndexRef.current;
            if (
              snapshotClearsDice &&
              (turnChanged ||
                !shouldProtectDiceValue ||
                shouldReleaseSamePlayerDiceLock)
            ) {
              lastLocalDiceRollTimeRef.current = 0;
              setDiceValueImmediate(0);
              // Dice availability is reconciled after incomingCurrentPlayer is
              // applied below; never enable from the previous turn pointer.
            } else if (
              snapshotClearsDice &&
              shouldProtectDiceValue &&
              !turnChanged
            ) {
              console.log(
                "[ON_PLAYERS] 🛡️ Protected dice from stale snapshot clear",
                {
                  diceValue: diceValueRef.current,
                  recentlyRolledLocally,
                  hasActiveDice,
                  currentPlayer: currentPlayerRef.current,
                  myPlayerIndex: myPlayerIndexRef.current,
                },
              );
            }
            // isAutoMovingRef already cleared above if turnChanged
            // if (turnChanged) {
            //   isAutoMovingRef.current = false;
            // }
          }
        }

        if (Array.isArray(payload.players)) {
          const next = payload.players.map((p, pIdx) => {
            // Ensure we have all 4 pieces for each player
            const playerColor = p.color || colors[pIdx] || colors[0];
            const piecesArray = Array.isArray(p.pieces) ? p.pieces : [];
            // Fill up to 4 pieces, ensuring each has proper structure
            const pieces = [];
            for (let i = 0; i < 4; i++) {
              const existingPiece =
                piecesArray.find((pc) => pc.id === i) || piecesArray[i];
              if (existingPiece) {
                const pieceSteps =
                  typeof existingPiece.steps === "number"
                    ? existingPiece.steps
                    : 0;
                // Correctly determine isHome and isInPlay based on steps
                // isHome: true only if steps === 0
                // isInPlay: true if steps > 0 AND steps < maxSteps (not finished)
                const pieceIsHome = pieceSteps === 0;
                const pieceIsInPlay =
                  pieceSteps > 0 && pieceSteps < maxStepsRef.current;
                pieces.push({
                  id:
                    typeof existingPiece.id === "number" ? existingPiece.id : i,
                  color: playerColor,
                  position: { x: 0, y: 0 },
                  steps: pieceSteps,
                  isHome: pieceIsHome,
                  isInPlay: pieceIsInPlay,
                });
              } else {
                // Piece not in snapshot, initialize as home
                pieces.push({
                  id: i,
                  color: playerColor,
                  position: { x: 0, y: 0 },
                  steps: 0,
                  isHome: true,
                  isInPlay: false,
                });
              }
            }
            return {
              ...p,
              cover: p.cover || p.coverPic || p.profileCover || undefined,
              color: playerColor,
              pieces,
            };
          });

          // Invitee-side guard: reconcile host/my identity without overwriting a
          // newer authoritative snapshot from the host.
          try {
            const myId = myProfile?._id;
            const foundIdx = myId
              ? next.findIndex(
                  (p) =>
                    p && p.profileId && String(p.profileId) === String(myId),
                )
              : -1;
            const isUserInPlayers = foundIdx >= 0;

            // If user successfully joined, clear any pending invite UI for this game
            // and dismiss all other invite notifications as well.
            if (isUserInPlayers) {
              resolveLudoInviteNotifications(payload.gameId);
              setPendingInvites((prev) =>
                prev.filter(
                  (inv) => String(inv.gameId) !== String(payload.gameId),
                ),
              );
              setIncomingInviteRequest((prev) =>
                prev && String(prev.gameId) === String(payload.gameId)
                  ? null
                  : prev,
              );
              setIncomingInvite((prev) =>
                prev && String(prev.gameId) === String(payload.gameId)
                  ? null
                  : prev,
              );

              if (socketRef.current && socketRef.current.connected) {
                try {
                  socketRef.current.emit("ludo:invites:get", {});
                  localStorage.setItem(
                    "ludo_dismiss_all_other_invites",
                    "true",
                  );
                } catch (_e) {
                  // Ignore errors
                }
              }
            }

            // Only apply seat correction if the snapshot does NOT already contain me.
            // This avoids the previous bug where we overwrote the host seat or
            // duplicate-filled both seats with the invitee identity.
            if (
              !isUserInPlayers &&
              myPlayerIndex !== 0 &&
              next[myPlayerIndex]?.isBot
            ) {
              setMyPlayerIndex(-1);
              myPlayerIndexRef.current = -1;
              clearActiveLudoGameId();
              clearGameState();
            } else if (!isUserInPlayers && myPlayerIndex !== 0) {
              if (next[0] && lastInviter?.id) {
                next[0].profileId = lastInviter.id;
                if (lastInviter.name) next[0].name = lastInviter.name;
                if (lastInviter.avatar) next[0].avatar = lastInviter.avatar;
                if (lastInviter.cover) next[0].cover = lastInviter.cover;
              }

              if (typeof myPlayerIndex === "number" && next[myPlayerIndex]) {
                next[myPlayerIndex].profileId =
                  myProfile?._id || next[myPlayerIndex].profileId;
                next[myPlayerIndex].name =
                  myProfile?.fullName || next[myPlayerIndex].name;
                next[myPlayerIndex].avatar =
                  myProfile?.profilePic || next[myPlayerIndex].avatar;
                const myCover =
                  myProfile?.coverPic ||
                  myProfile?.cover ||
                  myProfile?.profileCover;
                if (myCover) next[myPlayerIndex].cover = myCover;
              }
            }

            if (foundIdx >= 0 && foundIdx !== myPlayerIndex) {
              setMyPlayerIndex(foundIdx);
            }
          } catch (_e) {}
          // Merge with previous known seats to avoid wiping already joined players if snapshot is momentarily incomplete
          try {
            const maxPlayers = Math.max(
              2,
              Math.min(
                4,
                typeof payload.selectedPlayerCount === "number"
                  ? payload.selectedPlayerCount
                  : selectedPlayerCountRef.current,
              ),
            );
            const prev = playersRef.current || [];
            for (let i = 0; i < maxPlayers; i++) {
              const hasIncomingId = next[i] && next[i].profileId;
              const prevId = prev[i] && prev[i].profileId;
              if (!hasIncomingId && prevId && !next[i]?.isBot) {
                next[i] = {
                  id:
                    typeof next[i]?.id === "number"
                      ? next[i].id
                      : (prev[i]?.id ?? i),
                  name: next[i]?.name || prev[i]?.name,
                  color: next[i]?.color || prev[i]?.color,
                  avatar: next[i]?.avatar || prev[i]?.avatar,
                  cover: next[i]?.cover || prev[i]?.cover,
                  profileId: prevId,
                  isActive:
                    next[i]?.isActive !== undefined
                      ? next[i].isActive
                      : prev[i]?.isActive !== undefined
                        ? prev[i].isActive
                        : true,
                  pieces: Array.isArray(next[i]?.pieces)
                    ? next[i].pieces
                    : Array.isArray(prev[i]?.pieces)
                      ? prev[i].pieces.map((pc) => ({ ...pc }))
                      : [],
                };
              }
            }
          } catch (_e) {}

          // Check if we're reconnecting (restoring game state after reload)
          // During reconnection, we should accept the server state without protection
          const isReconnectingState =
            isReconnecting ||
            (!gameStarted && (payload.gameStarted || hasGameProgress));
          const hasLocalGameState =
            playersRef.current &&
            playersRef.current.length > 0 &&
            playersRef.current.some(
              (p) => p && p.pieces && p.pieces.some((pc) => pc.steps > 0),
            );

          // Fresh versioned snapshots are canonical host truth and must be applied
          // exactly, including legitimate backward movement caused by captures.
          // Keep the legacy rollback protection only for unversioned payloads.
          const shouldApplyProtection =
            payloadSeq <= 0 && !isReconnectingState && hasLocalGameState;

          // Simplified protection logic - focus on preventing backward movement only
          const now = Date.now();

          // CRITICAL: Clean stale move timers first (timers older than 3 seconds are stale)
          moveTimersRef.current = moveTimersRef.current.filter(
            (t) => typeof t === "number" && now - t < 3000,
          );

          const isMoveInProgress =
            isMovingRef.current ||
            moveTimersRef.current.length > 0 ||
            isAutoMovingRef.current;

          const protectedNext = shouldApplyProtection
            ? next.map((player, playerIndex) => {
                if (!player || !Array.isArray(player.pieces)) return player;
                const protectedPieces = player.pieces.map(
                  (piece, pieceIndex) => {
                    const currentPiece =
                      playersRef.current[playerIndex]?.pieces[pieceIndex];
                    if (!currentPiece) return piece;

                    const currentSteps = currentPiece.steps ?? 0;
                    const broadcastSteps = piece?.steps ?? 0;
                    const currentIsHome = currentPiece.isHome ?? false;
                    const broadcastIsHome = piece?.isHome ?? false;

                    // Rule 1: Never allow backward movement
                    if (currentSteps > broadcastSteps) {
                      return {
                        ...piece,
                        steps: currentSteps,
                        isHome: currentSteps === 0,
                        isInPlay:
                          currentSteps > 0 &&
                          currentSteps < maxStepsRef.current,
                      };
                    }

                    // Rule 2: Never allow a piece that moved out of home to revert back
                    if (
                      !currentIsHome &&
                      currentSteps > 0 &&
                      broadcastIsHome &&
                      broadcastSteps === 0
                    ) {
                      return {
                        ...piece,
                        steps: currentSteps,
                        isHome: false,
                        isInPlay:
                          currentSteps > 0 &&
                          currentSteps < maxStepsRef.current,
                      };
                    }

                    // Rule 3: Protect recently moved pieces (within 3 seconds)
                    const pieceKey = `${playerIndex}-${pieceIndex}`;
                    const recentMove = recentMovesRef.current.get(pieceKey);
                    if (recentMove && now - recentMove.timestamp < 3000) {
                      // If we're at or ahead of the target position, protect it
                      if (currentSteps >= recentMove.toSteps) {
                        const protectedSteps = Math.max(
                          currentSteps,
                          recentMove.toSteps,
                        );
                        return {
                          ...piece,
                          steps: protectedSteps,
                          isHome: protectedSteps === 0,
                          isInPlay:
                            protectedSteps > 0 &&
                            protectedSteps < maxStepsRef.current,
                        };
                      }
                    }

                    return piece;
                  },
                );
                return { ...player, pieces: protectedPieces };
              })
            : next;

          // Only pause host persistence while applying an actual restore/rejoin snapshot.
          // Applying this guard to every normal ludo:players update blocks legitimate
          // host actions like player_accept_join and game_auto_start, which is what
          // was preventing invited users from fully joining the lobby.
          const shouldPausePersistsDuringSnapshotApply =
            isReconnectingState || isJoiningViaInvite;
          isRestoringFromServerRef.current =
            shouldPausePersistsDuringSnapshotApply;
          setPlayers(protectedNext);
          // Update ref immediately
          playersRef.current = protectedNext;
          awaitingAuthoritativeSnapshotRef.current = false;

          // Safety: if the authoritative snapshot says it's now THIS client's turn
          // and dice value is clear, ensure we release any local locks and enable
          // the dice button immediately. This handles rare timing/race cases where
          // move timers or rolling flags may have been left set and the passive
          // effects didn't re-enable the dice promptly.
          try {
            if (
              onlineMode &&
              typeof incomingCurrentPlayer === "number" &&
              incomingCurrentPlayer === myPlayerIndexRef.current &&
              incomingDiceValue === 0
            ) {
              // Clear rolling/moving refs and timers
              isRollingRef.current = false;
              isMovingRef.current = false;
              isAutoMovingRef.current = false;
              try {
                (moveTimersRef.current || []).forEach((t) => {
                  try {
                    clearTimeout(t);
                  } catch (_e) {}
                });
              } catch (_e) {}
              moveTimersRef.current = [];
              lastLocalDiceRollTimeRef.current = 0;
              // Enable dice for this player
              setCanRollDice(true);
              console.log(
                "[ON_PLAYERS] Re-enabled dice after authoritative snapshot for local player",
              );
            }
          } catch (_e) {
            // Defensive: swallow any errors here to avoid breaking sync
          }

          // CRITICAL: Only update invite status to 'joined' if player was previously invited AND game has started
          // This prevents automatically joining players who haven't accepted the invite
          // The onAccepted handler is the ONLY place that should mark players as 'joined' when they accept
          // We only update here during reconnection or if game has started (meaning they must have accepted)
          if (myPlayerIndex === 0) {
            // Only host should update invite status
            protectedNext.forEach((player, playerIndex) => {
              if (player && player.profileId && playerIndex > 0) {
                // Skip host (index 0)
                const playerIdStr = String(player.profileId);
                const currentStatus =
                  invitedStatusByFriendIdRef.current[playerIdStr];

                // Only update to 'joined' if:
                // 1. Player was previously invited (status === 'invited')
                // 2. AND game has started (meaning they must have accepted at some point)
                // This prevents auto-joining players who haven't accepted yet
                if (
                  currentStatus === "invited" &&
                  (payload.gameStarted || gameStartedRef.current)
                ) {
                  console.log(
                    `[ON_PLAYERS] Updating invite status to 'joined' for player ${playerIdStr} at slot ${playerIndex} (game started)`,
                  );
                  setInvitedStatusByFriendId((prev) => {
                    const updated = { ...prev, [playerIdStr]: "joined" };
                    invitedStatusByFriendIdRef.current = updated;
                    return updated;
                  });
                } else if (
                  currentStatus !== "invited" &&
                  currentStatus !== "joined" &&
                  (payload.gameStarted || gameStartedRef.current)
                ) {
                  // For reconnection scenarios: if game started and player is in snapshot but wasn't invited,
                  // they must have joined somehow (maybe from another device), so mark as joined
                  console.log(
                    `[ON_PLAYERS] Updating invite status to 'joined' for player ${playerIdStr} at slot ${playerIndex} (reconnection, game started)`,
                  );
                  setInvitedStatusByFriendId((prev) => {
                    const updated = { ...prev, [playerIdStr]: "joined" };
                    invitedStatusByFriendIdRef.current = updated;
                    return updated;
                  });
                } else if (
                  currentStatus === "invited" &&
                  !payload.gameStarted &&
                  !gameStartedRef.current
                ) {
                  // CRITICAL: If player was invited but game hasn't started, DON'T mark as joined
                  // They must explicitly accept via onAccepted handler
                  console.log(
                    `[ON_PLAYERS] Player ${playerIdStr} at slot ${playerIndex} is invited but game hasn't started - NOT marking as joined`,
                  );
                }
              }
            });
          }

          // Canonical refs are already updated synchronously above. Keeping this
          // guard active after onPlayers returns can discard the very next roll
          // or move, so always release it before another socket event can run.
          isRestoringFromServerRef.current = false;

          // Update waiting state after players state is updated
          setTimeout(() => {
            recomputeWaitingState();
          }, 100);
        }
        if (typeof payload.selectedPlayerCount === "number") {
          setSelectedPlayerCount(payload.selectedPlayerCount);
        }

        // Check dice value BEFORE updating currentPlayer to avoid race conditions
        // We need to check if it's our turn using BOTH current ref and payload value
        if (typeof payload.diceValue === "number") {
          if (payloadSeq > 0) {
            // Fresh versioned snapshots are authoritative for dice state.
            setDiceValueImmediate(payload.diceValue);
          } else {
            const localDiceValue = diceValueRef.current || 0;
            const currentTurnFromRef =
              currentPlayerRef.current === myPlayerIndex;
            const currentTurnFromPayload =
              typeof payload.currentPlayer === "number" &&
              payload.currentPlayer === myPlayerIndex;
            const isMyTurnFromPayload =
              currentTurnFromRef || currentTurnFromPayload;

            // CRITICAL: If a move just completed, never restore dice value from broadcast
            // A move completion means dice should be 0 (either for next player or for same player to roll again)
            const moveJustCompleted =
              isMovingRef.current === false &&
              moveTimersRef.current.length === 0;
            const shouldIgnoreDiceBroadcast =
              moveJustCompleted && localDiceValue === 0;

            // Preserve local dice value if it's our turn and we have an active dice value
            // OR if we recently rolled locally (within last 5 seconds)
            // OR if a move just completed and dice is already 0 (don't restore from broadcast)
            const shouldPreserve =
              shouldProtectDiceValue ||
              (isMyTurnFromPayload && localDiceValue > 0) ||
              shouldIgnoreDiceBroadcast;

            if (!shouldPreserve) {
              // Only update if the payload value is different and we're not in the middle of our turn
              // AND if local dice value is 0, only update if payload is also 0 (don't restore old values)
              if (payload.diceValue !== localDiceValue) {
                // If local dice is 0, check if player just kept their turn
                // In that case, ALLOW the dice value to be restored
                if (localDiceValue === 0 && payload.diceValue > 0) {
                  const currentPayloadPlayer =
                    typeof payload.currentPlayer === "number"
                      ? payload.currentPlayer
                      : currentPlayerRef.current;
                  const justKeptTurn =
                    justKeptTurnRef.current[currentPayloadPlayer];
                  const timeSinceKeptTurn = justKeptTurn
                    ? Date.now() - justKeptTurn.ts
                    : Infinity;
                  const recentKeepTurn = timeSinceKeptTurn < 2500;

                  if (!recentKeepTurn) {
                    // Normal case: ignore - don't restore old dice values after move completes
                    if (isDebug) {
                      console.log(
                        "[DICE_PROTECTION] Blocking dice restore (no recent keep-turn)",
                        {
                          currentPayloadPlayer,
                          payloadDiceValue: payload.diceValue,
                          timeSinceKeptTurn,
                        },
                      );
                    }
                  } else {
                    // NEW: Accept dice value if player just kept their turn
                    // This allows remote players to roll again after getting a 6 or capturing
                    if (isDebug) {
                      console.log(
                        "[DICE_PROTECTION] ✅ Accepting dice value (recent keep-turn detected)",
                        {
                          currentPayloadPlayer,
                          payloadDiceValue: payload.diceValue,
                          timeSinceKeptTurn,
                          justKeptTurnValue: justKeptTurn?.value,
                        },
                      );
                    }
                    setDiceValueImmediate(payload.diceValue);
                  }
                } else {
                  setDiceValueImmediate(payload.diceValue);
                }
              }
            }
          }
        }

        if (typeof payload.currentPlayer === "number") {
          const localCurrentPlayer = currentPlayerRef.current;
          const payloadCurrentPlayer = payload.currentPlayer;
          const timeSinceTurnAdvance =
            Date.now() - lastTurnAdvanceTimeRef.current;
          const recentlyAdvancedTurn =
            timeSinceTurnAdvance < 5000 && lastTurnAdvanceTimeRef.current > 0; // Increased to 5 seconds
          const moveJustCompleted =
            isMovingRef.current === false && moveTimersRef.current.length === 0;

          console.log("[ON_PLAYERS] Processing currentPlayer update", {
            localCurrentPlayer,
            payloadCurrentPlayer,
            timeSinceTurnAdvance,
            recentlyAdvancedTurn,
            moveJustCompleted,
            lastTurnAdvanceTime: lastTurnAdvanceTimeRef.current,
            isMoving: isMovingRef.current,
            moveTimersLength: moveTimersRef.current.length,
            myPlayerIndex: myPlayerIndexRef.current,
            isMyTurnLocal: localCurrentPlayer === myPlayerIndexRef.current,
            isMyTurnPayload: payloadCurrentPlayer === myPlayerIndexRef.current,
          });

          // CRITICAL: During initial reconnection/rejoining, accept server's currentPlayer value
          // to restore the correct turn state, but only on the FIRST state update
          // Only treat as initial reconnection if we have saved state (actual reconnection) OR if we're explicitly reconnecting
          // NOT if we just accepted an invite (new join)
          const hasSavedState =
            savedGameStateRef.current &&
            savedGameStateRef.current.gameId === payload.gameId;
          const isJoiningViaInvite =
            isJoiningViaInviteRef.current && payload.gameId === gameId;
          const isActualReconnection =
            !isJoiningViaInvite &&
            ((isReconnecting && hasSavedState) ||
              (isRejoining && hasSavedState));
          const isInitialReconnection =
            isActualReconnection && !hasProcessedReconnectionStateRef.current;

          // CRITICAL: If this is a new join via invite, mark as processed immediately
          // to prevent subsequent payloads from being treated as reconnection
          if (isJoiningViaInvite && !hasProcessedReconnectionStateRef.current) {
            hasProcessedReconnectionStateRef.current = true;
            console.log(
              "[ON_PLAYERS] New join via invite detected - marking as processed to prevent reconnection loop",
            );
            // Clear the flag after first successful state update
            setTimeout(() => {
              isJoiningViaInviteRef.current = false;
            }, 1000);
          }

          if (isInitialReconnection) {
            console.log(
              "[ON_PLAYERS] ✅ Initial reconnection - restoring state",
              {
                payloadCurrentPlayer: payload.currentPlayer,
                myPlayerIndex: myPlayerIndexRef.current,
                isMyTurn: payload.currentPlayer === myPlayerIndexRef.current,
                diceValue: payload.diceValue,
                gameStarted: payload.gameStarted,
                hasSavedState,
              },
            );

            // Always restore currentPlayer during initial reconnection (first state update only)
            setCurrentPlayer(payload.currentPlayer);
            currentPlayerRef.current = payload.currentPlayer;
            // Mark that we've processed the initial reconnection state
            hasProcessedReconnectionStateRef.current = true;
            // Mark that this update came from server to prevent broadcast loop
            currentPlayerUpdatedFromServerRef.current = true;

            // Don't set canRollDice here - let the useEffect handle it after state settles
            console.log(
              "[ON_PLAYERS] Initial reconnection complete, useEffect will handle canRollDice",
            );
          } else {
            // In online mode, the host is authoritative, but ludo:players snapshots can
            // still arrive slightly out of order relative to a just-completed local move.
            // If we advanced the turn locally moments ago, reject a snapshot that would
            // rewind currentPlayer back to the mover while the move is already complete.
            const shouldRejectRecentTurnRewind =
              payloadSeq <= 0 &&
              onlineMode &&
              recentlyAdvancedTurn &&
              moveJustCompleted &&
              payloadCurrentPlayer !== localCurrentPlayer &&
              payloadCurrentPlayer !== getNextActivePlayer(localCurrentPlayer);

            if (shouldRejectRecentTurnRewind) {
              console.log(
                "[ON_PLAYERS] ❌ Rejected stale turn rewind from server",
                {
                  localCurrentPlayer,
                  payloadCurrentPlayer,
                  timeSinceTurnAdvance,
                  lastTurnAdvanceTime: lastTurnAdvanceTimeRef.current,
                  myPlayerIndex: myPlayerIndexRef.current,
                  diceValue: payload.diceValue,
                  gameStarted: payload.gameStarted,
                },
              );
            } else if (payloadCurrentPlayer !== localCurrentPlayer) {
              console.log("[ON_PLAYERS] ✅ Accepting turn change from server", {
                oldPlayer: localCurrentPlayer,
                newPlayer: payloadCurrentPlayer,
                myPlayerIndex: myPlayerIndexRef.current,
                isMyTurn: payloadCurrentPlayer === myPlayerIndexRef.current,
                diceValue: payload.diceValue,
                gameStarted: payload.gameStarted,
              });

              setCurrentPlayer(payloadCurrentPlayer);
              currentPlayerRef.current = payloadCurrentPlayer; // Update ref immediately
              // Mark that this update came from server to prevent broadcast loop
              currentPlayerUpdatedFromServerRef.current = true;

              console.log(
                "[ON_PLAYERS] Turn updated, useEffect will handle canRollDice",
                {
                  payloadCurrentPlayer,
                  myPlayerIndex: myPlayerIndexRef.current,
                  isMyTurn: payloadCurrentPlayer === myPlayerIndexRef.current,
                },
              );
            } else {
              console.log("[ON_PLAYERS] Turn unchanged", {
                currentPlayer: localCurrentPlayer,
                payloadCurrentPlayer,
              });
            }
          }
        }

        if (payload.gameStarted !== undefined) {
          setGameStarted(payload.gameStarted);
          gameStartedRef.current = payload.gameStarted;
          // If game started, clear waiting state
          if (payload.gameStarted) {
            setWaitingForPlayers(false);
            // Don't set canRollDice here - let the useEffect handle it based on turn
            // Clear reconnecting state when game is confirmed started
            setIsReconnecting(false);
            setShowReconnectModal(false);
          }
        }
        if (payload.gameEnded !== undefined) {
          setGameEnded(payload.gameEnded);
        }
        if (Array.isArray(payload.winners)) {
          setWinners(payload.winners);
        }
      } catch (_e) {}
    };

    const onPlayerOffline = (payload) => {
      try {
        if (!payload || payload.gameId !== gameId) return;
        const pid = String(payload.profileId || "");
        if (!pid) return;

        // Check if current user is the host (player at index 0)
        const isHost =
          myPlayerIndex === 0 ||
          (playersRef.current &&
            playersRef.current[0]?.profileId &&
            String(playersRef.current[0].profileId) === String(myProfile?._id));

        // Count active players before the offline
        const activeBefore = playersRef.current.filter(
          (p) => p?.profileId && p?.isActive,
        ).length;

        // Update player status
        setPlayers((prev) => {
          const updated = prev.map((p) => {
            if (p.profileId && String(p.profileId) === pid) {
              // If host and friend disconnected, track it
              if (isHost && String(p.profileId) !== String(myProfile?._id)) {
                setDisconnectedPlayers((prev) => new Set([...prev, pid]));
              }
              return {
                ...p,
                isActive: false,
                isOffline: true,
                offlineSince: payload.timestamp,
              };
            }
            return p;
          });
          // Update ref immediately to keep state synchronized
          playersRef.current = updated;
          return updated;
        });

        // CRITICAL: If this player was the current player, advance turn to next active player
        const offlinePlayerIndex = playersRef.current.findIndex(
          (p) => p?.profileId && String(p.profileId) === pid,
        );
        if (
          offlinePlayerIndex >= 0 &&
          currentPlayerRef.current === offlinePlayerIndex &&
          gameStartedRef.current &&
          !gameEndedRef.current
        ) {
          const nextPlayer = getNextActivePlayer(offlinePlayerIndex);
          if (nextPlayer !== offlinePlayerIndex) {
            if (onlineMode && myPlayerIndexRef.current !== 0) {
              console.log(
                "[ON_PLAYER_OFFLINE] Non-host waiting for authoritative turn advance",
                { from: offlinePlayerIndex, to: nextPlayer },
              );
              return;
            }

            console.log(
              "[ON_PLAYER_OFFLINE] Current player went offline, advancing turn",
              { from: offlinePlayerIndex, to: nextPlayer },
            );
            // Clear any stale move timers from the offline player
            moveTimersRef.current.forEach((timer) => {
              if (typeof timer === "number") {
                try {
                  clearTimeout(timer);
                } catch (_e) {}
              }
            });
            moveTimersRef.current = [];
            isMovingRef.current = false;
            isAutoMovingRef.current = false;
            setCurrentPlayer(nextPlayer);
            currentPlayerRef.current = nextPlayer;
            setDiceValueImmediate(0);
            lastLocalDiceRollTimeRef.current = 0;
            isRollingRef.current = false;
            // Only the host may publish the authoritative turn change in online mode.
            if (
              onlineMode &&
              myPlayerIndexRef.current === 0 &&
              socketRef.current?.connected
            ) {
              setTimeout(() => {
                persistAndBroadcastGameState("player_offline_turn_advance", {
                  offlinePlayerIndex,
                  nextPlayer,
                });
              }, 100);
            }
          }
        }
      } catch (_e) {}
    };

    const onPlayerOnline = (payload) => {
      try {
        if (!payload || payload.gameId !== gameId) return;
        const pid = String(payload.profileId || "");
        if (!pid) return;

        // Update player status
        setPlayers((prev) => {
          const updated = prev.map((p) => {
            if (p.profileId && String(p.profileId) === pid) {
              // Remove from disconnected players set
              setDisconnectedPlayers((prev) => {
                const next = new Set(prev);
                next.delete(pid);
                return next;
              });
              return {
                ...p,
                isActive: true,
                isOffline: false,
                offlineSince: undefined,
              };
            }
            return p;
          });
          // Update ref immediately to keep state synchronized
          playersRef.current = updated;
          return updated;
        });
      } catch (_e) {}
    };

    const onPlayerLeft = (payload) => {
      try {
        if (!payload || payload.gameId !== gameId) return;
        const pid = String(payload.profileId || "");
        if (!pid) return;

        // Get the index of the player who is leaving
        const leftPlayerIndex = playersRef.current.findIndex(
          (p) => p?.profileId && String(p.profileId) === pid,
        );

        // Mark joined game as disconnected locally so UI shows Disconnected status
        try {
          setJoinedGames((prev) =>
            prev.map((g) => {
              if (String(g.gameId) === String(gameId)) {
                return {
                  ...g,
                  lastPlayers: {
                    ...(g.lastPlayers || {}),
                    isDisconnected: true,
                    gameStarted: false,
                  },
                };
              }
              return g;
            }),
          );
        } catch (_e) {}

        // Mark waiting state for remaining players so UI shows leave/reconnect flow
        try {
          setWaitingForPlayers(true);
        } catch (_e) {}

        setPlayers((prev) => {
          const updated = prev.map((p, idx) => {
            if (!p?.profileId || String(p.profileId) !== pid) return p;
            return {
              ...p,
              profileId: undefined,
              isActive: false,
              isOffline: false,
              offlineSince: undefined,
              name: idx === 0 ? p.name : playerNames[idx] || p.name,
            };
          });
          playersRef.current = updated;
          return updated;
        });

        setDisconnectedPlayers((prev) => {
          const next = new Set(prev);
          next.delete(pid);
          return next;
        });

        // CRITICAL: If the player who left was the current player, advance turn
        if (
          leftPlayerIndex >= 0 &&
          currentPlayerRef.current === leftPlayerIndex &&
          gameStartedRef.current &&
          !gameEndedRef.current
        ) {
          const nextPlayer = getNextActivePlayer(leftPlayerIndex);
          if (nextPlayer !== leftPlayerIndex) {
            if (onlineMode && myPlayerIndexRef.current !== 0) {
              console.log(
                "[ON_PLAYER_LEFT] Non-host waiting for authoritative turn advance",
                { from: leftPlayerIndex, to: nextPlayer },
              );
              return;
            }

            console.log(
              "[ON_PLAYER_LEFT] Current player left, advancing turn",
              { from: leftPlayerIndex, to: nextPlayer },
            );
            // Clear any stale move timers from the leaving player
            moveTimersRef.current.forEach((timer) => {
              if (typeof timer === "number") {
                try {
                  clearTimeout(timer);
                } catch (_e) {}
              }
            });
            moveTimersRef.current = [];
            isMovingRef.current = false;
            isAutoMovingRef.current = false;
            setCurrentPlayer(nextPlayer);
            currentPlayerRef.current = nextPlayer;
            setDiceValueImmediate(0);
            lastLocalDiceRollTimeRef.current = 0;
            isRollingRef.current = false;
            // Only the host may publish the authoritative turn change in online mode.
            if (
              onlineMode &&
              myPlayerIndexRef.current === 0 &&
              socketRef.current?.connected
            ) {
              setTimeout(() => {
                persistAndBroadcastGameState("player_left_turn_advance", {
                  leftPlayerIndex,
                  nextPlayer,
                });
              }, 100);
            }
          }
        }
      } catch (_e) {}
    };

    const onGameRemoved = (payload) => {
      try {
        if (!payload || payload.gameId !== gameId) return;
        setJoinedGames((prev) =>
          prev.filter((g) => String(g.gameId) !== String(payload.gameId)),
        );
        if (String(gameIdRef.current) === String(payload.gameId)) {
          // Clear every local trace so a removed room cannot be restored by a
          // delayed reconnect, invite, timer, or persisted browser snapshot.
          try {
            localStorage.removeItem("ludo_game_state");
            localStorage.removeItem("ludo_pending_invite");
            savedGameStateRef.current = null;
            clearHiddenBoardGameId();
            clearActiveLudoGameId();
            clearHandledLudoInvites();
            // Also mark as exited to prevent reconnection attempts
            const exitedGames = JSON.parse(
              localStorage.getItem("ludo_exited_games") || "[]",
            );
            const gameIdStr = String(payload.gameId);
            if (
              !Array.isArray(exitedGames) ||
              !exitedGames.some((gid) => String(gid) === gameIdStr)
            ) {
              exitedGames.push(payload.gameId);
              localStorage.setItem(
                "ludo_exited_games",
                JSON.stringify(exitedGames),
              );
            }
          } catch (_e) {}
          gameSessionVersionRef.current += 1;
          pendingConnectActionsRef.current.clear();
          moveTimersRef.current.forEach((timer) => {
            if (typeof timer === "number") clearTimeout(timer);
            if (timer?.timeoutId) clearTimeout(timer.timeoutId);
          });
          moveTimersRef.current = [];
          if (botTurnTimerRef.current) {
            clearTimeout(botTurnTimerRef.current);
            botTurnTimerRef.current = null;
          }

          setGameId(null);
          gameIdRef.current = null;
          newGameDraftIdRef.current = null;
          setOnlineMode(false);
          setPlayWithComputer(false);
          setGameStarted(false);
          gameStartedRef.current = false;
          setGameEnded(false);
          gameEndedRef.current = false;
          setCurrentPlayer(0);
          currentPlayerRef.current = 0;
          setDiceValueImmediate(0);
          setWinner(null);
          setWinners([]);
          winnersRef.current = [];
          setShowWinnerModal(false);
          setWaitingForPlayers(false);
          setIsReplacingWaitingPlayers(false);
          setCanRollDice(false);
          setIsReconnecting(false);
          setShowReconnectModal(false);
          setIncomingInviteRequest(null);
          setIncomingInvite(null);
          setPendingInvites([]);
          setSelectedFriends([]);
          setInvitedStatusByFriendId({});
          invitedStatusByFriendIdRef.current = {};
          setInvitedSlotByFriendId({});
          invitedSlotByFriendIdRef.current = {};
          setDisconnectedPlayers(new Set());
          isRollingRef.current = false;
          isMovingRef.current = false;
          isAutoMovingRef.current = false;
          botActingRef.current = false;
          botActingPlayerIndexRef.current = null;
          awaitingAuthoritativeSnapshotRef.current = false;
          pendingPersistRequestRef.current = null;
          playersRef.current = [];
          initializeGame(4);
        }
      } catch (_e) {}
    };

    s.off("ludo:roll", onRoll);
    s.off("ludo:accepted", onAccepted);
    s.off("ludo:players", onPlayers);
    s.off("ludo:move", onMove);
    s.off("ludo:player:offline", onPlayerOffline);
    s.off("ludo:player:online", onPlayerOnline);
    s.off("ludo:player:left", onPlayerLeft);
    s.off("ludo:game:removed", onGameRemoved);
    s.on("ludo:roll", onRoll);
    s.on("ludo:accepted", onAccepted);
    s.on("ludo:players", onPlayers);
    s.on("ludo:move", onMove);
    s.on("ludo:player:offline", onPlayerOffline);
    s.on("ludo:player:online", onPlayerOnline);
    s.on("ludo:player:left", onPlayerLeft);
    s.on("ludo:game:removed", onGameRemoved);
    const onJoined = (payload) => {};
    s.off("ludo:joined", onJoined);
    s.on("ludo:joined", onJoined);
    return () => {
      s.off("ludo:roll", onRoll);
      s.off("ludo:accepted", onAccepted);
      s.off("ludo:players", onPlayers);
      s.off("ludo:move", onMove);
      s.off("ludo:player:offline", onPlayerOffline);
      s.off("ludo:player:online", onPlayerOnline);
      s.off("ludo:player:left", onPlayerLeft);
      s.off("ludo:game:removed", onGameRemoved);
      s.off("ludo:joined", onJoined);
    };
  }, [onlineMode, gameId, myProfile?._id]);

  // Save game state whenever relevant values change
  useEffect(() => {
    if (onlineMode && gameId && myProfile?._id) {
      saveGameState();
    }
  }, [
    onlineMode,
    gameId,
    myPlayerIndex,
    selectedPlayerCount,
    myProfile?._id,
    saveGameState,
  ]);

  // Recompute waiting state whenever invite statuses or players change
  useEffect(() => {
    recomputeWaitingState();
  }, [
    invitedStatusByFriendId,
    players,
    selectedPlayerCount,
    onlineMode,
    myPlayerIndex,
    recomputeWaitingState,
  ]);

  // When waiting ends, allow dice interactions again
  useEffect(() => {
    // Prevent rapid toggling - only update if conditions actually changed
    const now = Date.now();
    const timeSinceLastUpdate =
      now - lastCanRollDiceUpdateRef.current.timestamp;
    const MIN_UPDATE_INTERVAL = 100; // Minimum 100ms between updates

    // Use refs to get current values to avoid stale closures
    const currentCanRollDice = canRollDice;

    if (!waitingForPlayers && !gameStarted) {
      // If not waiting and game hasn't started, allow dice roll only if all players joined
      const maxPlayers = Math.max(2, Math.min(4, selectedPlayerCount));
      const joinedSeats = players
        .slice(1, maxPlayers)
        .filter((p) => p && p.profileId).length;
      const allSeatsFilled = joinedSeats >= maxPlayers - 1;
      // Online games are unlocked only by a saved gameStarted snapshot.
      const shouldEnable = !onlineMode && allSeatsFilled;

      if (
        shouldEnable !== currentCanRollDice &&
        timeSinceLastUpdate > MIN_UPDATE_INTERVAL
      ) {
        lastCanRollDiceUpdateRef.current = {
          value: shouldEnable,
          timestamp: now,
          reason: "waiting ended",
        };
        setCanRollDice(shouldEnable);
      }
    } else if (!waitingForPlayers && gameStarted) {
      // CRITICAL: Only allow dice roll if:
      // 1. It's the current player's turn (in online mode)
      // 2. There's no dice value already set
      // 3. Dice is not currently rolling
      // 4. No move is in progress
      const currentMyPlayerIndex = myPlayerIndexRef.current;
      const currentPlayerIndex = currentPlayerRef.current;
      const isMyTurn =
        (!onlineMode &&
          !playWithComputer &&
          !playersRef.current[currentPlayerIndex]?.isBot) ||
        currentMyPlayerIndex === currentPlayerIndex;
      const hasNoDiceValue = diceValueRef.current === 0 && diceValue === 0;
      const isNotRolling = !isRollingRef.current;

      // Check for active move timers (not stale ones)
      const activeMoveTimers = moveTimersRef.current.filter((timer) => {
        if (typeof timer === "number") {
          return now - timer < 2000;
        }
        if (timer && typeof timer === "object" && timer.timestamp) {
          return now - timer.timestamp < 2000;
        }
        return true;
      });

      // Clear stale timers
      if (activeMoveTimers.length !== moveTimersRef.current.length) {
        moveTimersRef.current = activeMoveTimers;
      }

      const isNotMoving =
        !isMovingRef.current &&
        !isAutoMovingRef.current &&
        activeMoveTimers.length === 0;

      // Determine what canRollDice should be
      const hasAuthoritativeConfirmation =
        !onlineMode || !awaitingAuthoritativeSnapshotRef.current;
      const shouldEnable =
        isMyTurn &&
        hasNoDiceValue &&
        isNotRolling &&
        isNotMoving &&
        hasAuthoritativeConfirmation;

      // CRITICAL: Force update if it's not the player's turn but canRollDice is true
      // This fixes the bug where canRollDice stays true after game starts when it's not the player's turn
      const needsForceUpdate =
        !isMyTurn && currentCanRollDice && (onlineMode || playWithComputer);

      // Only update if value actually changed and enough time has passed, OR if we need to force update
      if (
        (shouldEnable !== currentCanRollDice &&
          timeSinceLastUpdate > MIN_UPDATE_INTERVAL) ||
        needsForceUpdate
      ) {
        const reason = !isMyTurn
          ? "not my turn"
          : !hasNoDiceValue
            ? "dice value set"
            : !isNotRolling
              ? "rolling"
              : !isNotMoving
                ? "moving"
                : "conditions met";

        lastCanRollDiceUpdateRef.current = {
          value: shouldEnable,
          timestamp: now,
          reason,
        };
        setCanRollDice(shouldEnable);

        // Log if we're forcing an update to help debug
        if (needsForceUpdate) {
          console.log(
            "[CAN_ROLL_DICE] Force update - not my turn but canRollDice was true",
            {
              myPlayerIndex: currentMyPlayerIndex,
              currentPlayer: currentPlayerIndex,
              isMyTurn,
              shouldEnable,
              onlineMode,
            },
          );
        }
      }
    } else if (waitingForPlayers) {
      if (currentCanRollDice && timeSinceLastUpdate > MIN_UPDATE_INTERVAL) {
        lastCanRollDiceUpdateRef.current = {
          value: false,
          timestamp: now,
          reason: "waiting for players",
        };
        setCanRollDice(false);
      }
    }
    // Removed canRollDice from dependencies to prevent infinite loop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    waitingForPlayers,
    gameStarted,
    players,
    selectedPlayerCount,
    onlineMode,
    playWithComputer,
    currentPlayer,
    myPlayerIndex,
    diceValue,
  ]);

  // Self-healing safety net #1: the effect above can occasionally skip an
  // update because of its anti-flicker throttle (MIN_UPDATE_INTERVAL), and
  // if no other dependency changes afterwards, canRollDice would stay wrong
  // forever - forcing the player to click "Reload" to unblock the dice
  // button after an opponent's move. Reconcile straight from refs on a
  // short interval so this always self-corrects within a fraction of a
  // second, with no user action required.
  useEffect(() => {
    if (!onlineMode || !gameStarted || gameEnded || waitingForPlayers) return;

    const interval = setInterval(() => {
      const isMyTurnNow = myPlayerIndexRef.current === currentPlayerRef.current;
      const isIdle =
        !awaitingAuthoritativeSnapshotRef.current &&
        !isRollingRef.current &&
        !isMovingRef.current &&
        !isAutoMovingRef.current &&
        moveTimersRef.current.length === 0;
      const shouldEnable = isMyTurnNow && diceValueRef.current === 0 && isIdle;

      setCanRollDice((prev) => {
        if (prev === shouldEnable) return prev;
        lastCanRollDiceUpdateRef.current = {
          value: shouldEnable,
          timestamp: Date.now(),
          reason: "self-heal reconcile",
        };
        console.log("[CAN_ROLL_DICE] Self-heal reconcile", {
          from: prev,
          to: shouldEnable,
          myPlayerIndex: myPlayerIndexRef.current,
          currentPlayer: currentPlayerRef.current,
        });
        return shouldEnable;
      });
    }, 600);

    return () => clearInterval(interval);
  }, [onlineMode, gameStarted, gameEnded, waitingForPlayers]);

  // Self-healing safety net #2: periodically pull the authoritative players
  // snapshot from the server while an online game is in progress. This
  // guarantees a client recovers automatically within a few seconds if a
  // real-time "ludo:move"/"ludo:players" broadcast is ever missed (e.g. a
  // brief network hiccup on either side), instead of leaving the player
  // stuck needing to manually click "Reload" to unblock their dice button.
  useEffect(() => {
    if (!onlineMode || !gameId || !gameStarted || gameEnded) return;

    const interval = setInterval(() => {
      const s = socketRef.current;
      if (!s || !s.connected) return;

      const now = Date.now();
      const lastRequest = selfHealPlayersGetRequestRef.current;
      const timeSinceLastRequest = now - lastRequest.timestamp;
      // Avoid every client flooding the room with duplicate snapshots while
      // the socket is healthy. Poll quickly only while an action is awaiting
      // confirmation; otherwise use a low-frequency recovery check.
      const MIN_REQUEST_INTERVAL = awaitingAuthoritativeSnapshotRef.current
        ? 3000
        : 15000;

      if (
        lastRequest.gameId !== gameId ||
        timeSinceLastRequest >= MIN_REQUEST_INTERVAL
      ) {
        selfHealPlayersGetRequestRef.current = { gameId, timestamp: now };
        try {
          s.emit("ludo:players:get", { gameId });
        } catch (_e) {}
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [onlineMode, gameId, gameStarted, gameEnded]);

  // CPU turns run locally in offline games and exclusively on the online host.
  useEffect(() => {
    const canControlBots = onlineMode
      ? myPlayerIndexRef.current === 0 && Boolean(gameId)
      : playWithComputer || playersRef.current.some((player) => player?.isBot);
    if (!canControlBots || !gameStarted || gameEnded || waitingForPlayers)
      return;

    const cp = currentPlayerRef.current;
    const player = playersRef.current[cp];
    if (!player?.isBot) {
      botActingRef.current = false;
      botActingPlayerIndexRef.current = null;
      return;
    }

    if (botTurnTimerRef.current) {
      clearTimeout(botTurnTimerRef.current);
    }

    const scheduleBotTurn = (delay = 900) => {
      botTurnTimerRef.current = setTimeout(() => {
        botTurnTimerRef.current = null;

        const stillControlsBots = onlineMode
          ? myPlayerIndexRef.current === 0 && Boolean(gameIdRef.current)
          : playWithComputerRef.current ||
            playersRef.current.some((candidate) => candidate?.isBot);
        const playerIndex = currentPlayerRef.current;
        if (
          !stillControlsBots ||
          !gameStartedRef.current ||
          gameEndedRef.current ||
          !playersRef.current[playerIndex]?.isBot
        ) {
          return;
        }

        // Online snapshots and movement animations can briefly overlap the next
        // bot turn. A one-shot timer used to abandon the turn in that window,
        // leaving the game stuck until some unrelated state update occurred.
        if (
          awaitingAuthoritativeSnapshotRef.current ||
          isMovingRef.current ||
          isAutoMovingRef.current ||
          isRollingRef.current
        ) {
          scheduleBotTurn(250);
          return;
        }

        botActingRef.current = true;
        botActingPlayerIndexRef.current = playerIndex;

        try {
          if (diceValueRef.current === 0) {
            rollDice();
            if (!isRollingRef.current && diceValueRef.current === 0) {
              scheduleBotTurn(250);
            }
            return;
          }

          const playable = getPlayablePieces(playerIndex, diceValueRef.current);
          if (playable.length === 0) {
            advanceTurnForPlayer(playerIndex);
            return;
          }

          const pick =
            playable.length === 1
              ? playable[0]
              : pickBotPiece(playable, playerIndex);
          movePiece(pick);
          if (!isMovingRef.current && diceValueRef.current > 0) {
            scheduleBotTurn(250);
          }
        } finally {
          setTimeout(() => {
            if (botActingPlayerIndexRef.current === playerIndex) {
              botActingRef.current = false;
              botActingPlayerIndexRef.current = null;
            }
          }, 2000);
        }
      }, delay);
    };

    scheduleBotTurn();

    return () => {
      if (botTurnTimerRef.current) {
        clearTimeout(botTurnTimerRef.current);
        botTurnTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    playWithComputer,
    players,
    onlineMode,
    gameId,
    myPlayerIndex,
    gameStarted,
    gameEnded,
    waitingForPlayers,
    currentPlayer,
    diceValue,
    canRollDice,
  ]);

  // DEBUG: Track canRollDice changes (reduced logging to prevent spam)
  const prevCanRollDiceRef = useRef(canRollDice);
  useEffect(() => {
    // Only log when canRollDice actually changes value
    if (prevCanRollDiceRef.current !== canRollDice) {
      prevCanRollDiceRef.current = canRollDice;
      // Only log when canRollDice changes to true or when there's a potential issue
      if (
        canRollDice ||
        (!canRollDice &&
          (isMovingRef.current ||
            isAutoMovingRef.current ||
            diceValueRef.current > 0))
      ) {
        // CRITICAL: Use refs for currentPlayer to avoid state/ref mismatch during async updates
        const effectiveCurrentPlayer =
          currentPlayerRef.current !== undefined
            ? currentPlayerRef.current
            : currentPlayer;
        console.log("[CAN_ROLL_DICE_CHANGED]", {
          canRollDice,
          onlineMode,
          myPlayerIndex: myPlayerIndexRef.current,
          currentPlayer: effectiveCurrentPlayer,
          currentPlayerState: currentPlayer,
          currentPlayerRef: currentPlayerRef.current,
          isMyTurn:
            !onlineMode || myPlayerIndexRef.current === effectiveCurrentPlayer,
          diceValue: diceValueRef.current,
          isRollingRef: isRollingRef.current,
          isMoving: isMovingRef.current,
          isAutoMoving: isAutoMovingRef.current,
          moveTimersLength: moveTimersRef.current.length,
          gameStarted,
          waitingForPlayers,
        });
      }
    }
  }, [
    canRollDice,
    onlineMode,
    currentPlayer,
    diceValue,
    gameStarted,
    waitingForPlayers,
  ]);

  // DEBUG: Track currentPlayer changes to detect unexpected turn changes
  const prevCurrentPlayerRef = useRef(currentPlayer);
  const prevDiceValueRef = useRef(diceValue);
  useEffect(() => {
    const timeSinceTurnAdvance = Date.now() - lastTurnAdvanceTimeRef.current;
    const recentlyAdvanced =
      timeSinceTurnAdvance < 5000 && lastTurnAdvanceTimeRef.current > 0;

    // Only log when currentPlayer or diceValue actually changes
    const currentPlayerChanged = prevCurrentPlayerRef.current !== currentPlayer;
    const diceValueChanged = prevDiceValueRef.current !== diceValue;

    if (currentPlayerChanged || diceValueChanged) {
      prevCurrentPlayerRef.current = currentPlayer;
      prevDiceValueRef.current = diceValue;

      // Log if currentPlayer changed unexpectedly (not from a recent turn advance)
      // CRITICAL: Don't log mismatch if we recently advanced the turn - this is expected during async state updates
      // React state updates are async, so there's a brief window where ref is updated but state hasn't caught up yet
      if (currentPlayer !== currentPlayerRef.current && !recentlyAdvanced) {
        console.log("[CURRENT_PLAYER_MISMATCH] State and ref out of sync", {
          currentPlayerState: currentPlayer,
          currentPlayerRef: currentPlayerRef.current,
          recentlyAdvanced,
          timeSinceTurnAdvance,
          myPlayerIndex: myPlayerIndexRef.current,
          isMyTurnState: currentPlayer === myPlayerIndexRef.current,
          isMyTurnRef: currentPlayerRef.current === myPlayerIndexRef.current,
          timestamp: Date.now(),
        });
      }

      // CRITICAL: Only log CURRENT_PLAYER_CHANGED when it's unexpected (not from a recent legitimate turn advance)
      // This prevents noise from normal turn changes that we initiated
      if (currentPlayerChanged && !recentlyAdvanced) {
        // Only log if the change wasn't from a recent turn advance we initiated
        // This indicates an unexpected change that we should investigate
        console.log("[CURRENT_PLAYER_CHANGED] Unexpected change detected", {
          currentPlayer,
          currentPlayerRef: currentPlayerRef.current,
          myPlayerIndex: myPlayerIndexRef.current,
          isMyTurn: currentPlayer === myPlayerIndexRef.current,
          diceValue,
          diceValueRef: diceValueRef.current,
          recentlyAdvanced,
          timeSinceTurnAdvance,
          timestamp: Date.now(),
        });
      }
    }
  }, [currentPlayer, diceValue]);

  // Keep refs in sync with state for invite handlers
  useEffect(() => {
    gameIdRef.current = gameId;
  }, [gameId]);

  useEffect(() => {
    joinedGamesRef.current = joinedGames;
  }, [joinedGames]);

  // Invite listeners attached regardless of onlineMode, so users receive invites anytime
  useEffect(() => {
    let retryTimer = null;
    let usedSocket = null;
    const attach = () => {
      const s = socketRef.current;
      if (!s) {
        retryTimer = setTimeout(attach, 300);
        return;
      }
      if (inviteHandlersAttachedRef.current) return;
      const onInvite = (payload) => {
        try {
          if (!payload) return;
          if (
            payload.to &&
            myProfile?._id &&
            String(payload.to) !== String(myProfile._id)
          )
            return;

          if (isJoiningViaInviteRef.current) return;

          const currentGameId = gameIdRef.current;
          const joinedGamesList = joinedGamesRef.current;
          if (
            !payload.reinvite &&
            currentGameId &&
            String(payload.gameId) === String(currentGameId)
          ) {
            return;
          }
          if (
            !payload.reinvite &&
            Array.isArray(joinedGamesList) &&
            joinedGamesList.some(
              (g) => String(g.gameId) === String(payload.gameId),
            )
          ) {
            return;
          }
          if (!shouldShowLudoInviteAlert(payload.gameId, payload.by, payload)) {
            return;
          }

          const inviteKey =
            payload.inviteId || `${payload.gameId}:${payload.by}`;
          const now = Date.now();

          const lastShownTime = shownInviteToastsRef.current.get(inviteKey);
          if (lastShownTime && now - lastShownTime < 300000) {
            return;
          }

          shownInviteToastsRef.current.set(inviteKey, now);

          for (const [
            key,
            timestamp,
          ] of shownInviteToastsRef.current.entries()) {
            if (now - timestamp > 600000) {
              shownInviteToastsRef.current.delete(key);
            }
          }

          try {
            if (payload?.by)
              setLastInviter({
                id: payload.by,
                name: payload.name,
                avatar: payload.avatar,
                cover: payload.cover,
              });
          } catch (_e) {}

          const inv = {
            from: payload.by,
            name: payload.name,
            avatar: payload.avatar,
            cover: payload.cover,
            gameId: payload.gameId,
            slotIndex: payload.slotIndex,
            playerCount: payload.playerCount,
            reinvite: payload.reinvite === true,
            inviteId: payload.inviteId,
            ts: payload.ts || now,
          };

          setPendingInvites((prev) => {
            const exists = prev.find(
              (i) =>
                String(i.gameId) === String(payload.gameId) &&
                String(i.from) === String(payload.by),
            );
            if (exists) {
              return [
                inv,
                ...prev.filter(
                  (i) =>
                    !(
                      String(i.gameId) === String(payload.gameId) &&
                      String(i.from) === String(payload.by)
                    ),
                ),
              ].slice(0, 20);
            }
            return [inv, ...prev].slice(0, 20);
          });

          showLudoInviteToast(
            payload.name || "A friend",
            payload.avatar,
            () => {
              markInviteHandled(payload.gameId, payload.by);
              setActiveLudoGameId(payload.gameId);
              resolveLudoInviteNotifications(payload.gameId, payload.by);
              setIncomingInviteRequest(inv);
              setTimeout(() => wrappedAcceptIncomingInvite(inv), 0);
            },
            () => {
              markInviteHandled(payload.gameId, payload.by);
              resolveLudoInviteNotifications(payload.gameId, payload.by);
              if (socketRef.current) {
                try {
                  socketRef.current.emit("ludo:invites:dismiss", {
                    gameId: payload.gameId,
                    by: payload.by,
                  });
                } catch (_e) {}
              }
              setPendingInvites((prev) =>
                prev.filter(
                  (i) =>
                    !(
                      String(i.gameId) === String(payload.gameId) &&
                      String(i.from) === String(payload.by)
                    ),
                ),
              );
            },
          );
        } catch (_e) {}
      };
      const onInvites = (payload) => {
        try {
          if (isJoiningViaInviteRef.current) return;

          const arr = Array.isArray(payload?.invites) ? payload.invites : [];
          const normalized = arr.map((x) => ({
            from: x.by ?? x.from,
            name: x.name,
            avatar: x.avatar,
            cover: x.cover,
            gameId: x.gameId,
            slotIndex: x.slotIndex,
            playerCount: x.playerCount,
            reinvite: x.reinvite === true,
            inviteId: x.inviteId,
            ts: x.ts || Date.now(),
          }));

          const currentGameId = gameIdRef.current;
          const joinedGamesList = joinedGamesRef.current;
          const filteredNormalized = normalized.filter((inv) => {
            if (
              !inv.reinvite &&
              currentGameId &&
              String(inv.gameId) === String(currentGameId)
            ) {
              return false;
            }
            if (
              !inv.reinvite &&
              Array.isArray(joinedGamesList) &&
              joinedGamesList.some(
                (g) => String(g.gameId) === String(inv.gameId),
              )
            ) {
              return false;
            }
            return shouldShowLudoInviteAlert(inv.gameId, inv.from, inv);
          });

          setPendingInvites((prev) => {
            const next = [...prev];
            filteredNormalized.forEach((inv) => {
              const existingIndex = next.findIndex(
                (pending) =>
                  String(pending.gameId) === String(inv.gameId) &&
                  String(pending.from) === String(inv.from),
              );
              if (existingIndex >= 0) next.splice(existingIndex, 1);
              next.unshift(inv);
            });
            return next.slice(0, 20);
          });

          const now = Date.now();
          const firstNewInvite = filteredNormalized.find((inv) => {
            const inviteKey = inv.inviteId || `${inv.gameId}:${inv.from}`;
            const lastShownTime = shownInviteToastsRef.current.get(inviteKey);
            if (lastShownTime && now - lastShownTime < 300000) {
              return false;
            }
            shownInviteToastsRef.current.set(inviteKey, now);
            return true;
          });

          if (firstNewInvite) {
            showLudoInviteToast(
              firstNewInvite.name || "A friend",
              firstNewInvite.avatar,
              () => {
                markInviteHandled(firstNewInvite.gameId, firstNewInvite.from);
                setActiveLudoGameId(firstNewInvite.gameId);
                resolveLudoInviteNotifications(
                  firstNewInvite.gameId,
                  firstNewInvite.from,
                );
                setIncomingInviteRequest(firstNewInvite);
                setTimeout(
                  () => wrappedAcceptIncomingInvite(firstNewInvite),
                  0,
                );
              },
              () => {
                markInviteHandled(firstNewInvite.gameId, firstNewInvite.from);
                resolveLudoInviteNotifications(
                  firstNewInvite.gameId,
                  firstNewInvite.from,
                );
                if (socketRef.current) {
                  try {
                    socketRef.current.emit("ludo:invites:dismiss", {
                      gameId: firstNewInvite.gameId,
                      by: firstNewInvite.from,
                    });
                  } catch (_e) {}
                }
                setPendingInvites((prev) =>
                  prev.filter(
                    (i) =>
                      !(
                        String(i.gameId) === String(firstNewInvite.gameId) &&
                        String(i.from) === String(firstNewInvite.from)
                      ),
                  ),
                );
              },
            );
          }

          try {
            if (filteredNormalized[0]?.from)
              setLastInviter({
                id: filteredNormalized[0].from,
                name: filteredNormalized[0].name,
                avatar: filteredNormalized[0].avatar,
              });
          } catch (_e) {}
        } catch (_e) {}
      };
      const onGames = (payload) => {
        try {
          const games = Array.isArray(payload?.games) ? payload.games : [];
          // Post-process games: if no players are connected for a game, mark it as disconnected locally
          const processed = games.map((g) => {
            try {
              const lp = g?.lastPlayers || {};
              const pls = Array.isArray(lp.players) ? lp.players : [];
              const anyConnected = pls.some(
                (p) => p && (p.profileId || p._id || p.connected),
              );
              if (!anyConnected) {
                // Mark disconnected so UI shows 'Disconnected' and avoids 'Resume'
                lp.isDisconnected = true;
                lp.gameStarted = false;
                g.lastPlayers = lp;
              }
            } catch (_e) {}
            return g;
          });
          setJoinedGames(processed);
          console.log("[LUDO] Received joined games:", processed.length);
        } catch (_e) {}
      };
      s.on("ludo:invite", onInvite);
      s.on("ludo:invites", onInvites);
      s.on("ludo:games", onGames);
      usedSocket = s;
      inviteHandlersAttachedRef.current = true;
      // store handlers on socket for cleanup
      s.__ludoInviteHandlers = { onInvite, onInvites, onGames };
    };
    attach();
    return () => {
      if (retryTimer) clearTimeout(retryTimer);
      try {
        const s = usedSocket || socketRef.current;
        const h = s && s.__ludoInviteHandlers;
        if (s && h) {
          s.off("ludo:invite", h.onInvite);
          s.off("ludo:invites", h.onInvites);
          s.off("ludo:games", h.onGames);
        }
      } catch (_e) {}
      inviteHandlersAttachedRef.current = false;
    };
  }, [myProfile?._id]);

  // Fetch joined games when socket connects
  useEffect(() => {
    requestJoinedGames();
  }, [requestJoinedGames]);

  // Refresh joined games when game state changes
  useEffect(() => {
    if (myProfile?._id && (onlineMode || joinedGamesRef.current.length > 0)) {
      requestJoinedGames();
      console.log("[LUDO] Refreshed joined games due to state change");
    }
  }, [gameId, onlineMode, gameStarted, myProfile?._id, requestJoinedGames]);

  // Cleanup socket on unmount
  useEffect(() => {
    return () => {
      cleanupSocket();
    };
  }, [cleanupSocket]);

  // Request latest players snapshot after joining a game (late join sync)
  useEffect(() => {
    if (!onlineMode || !gameId) return;
    const s = socketRef.current;
    if (!s) return;

    // Prevent rapid repeated requests - only request if gameId changed or enough time has passed
    const now = Date.now();
    const lastRequest = lastPlayersGetRequestRef.current;
    const timeSinceLastRequest = now - lastRequest.timestamp;
    const MIN_REQUEST_INTERVAL = 2000; // Minimum 2 seconds between requests

    if (
      lastRequest.gameId === gameId &&
      timeSinceLastRequest < MIN_REQUEST_INTERVAL
    ) {
      // Already requested for this gameId recently, skip
      return;
    }

    // Update tracking
    lastPlayersGetRequestRef.current = { gameId, timestamp: now };

    try {
      s.emit("ludo:players:get", { gameId });
    } catch (_e) {}
  }, [onlineMode, gameId]);

  const handleJoinGame = useCallback(
    (game) => {
      if (!game?.gameId) return;

      clearHiddenBoardGameId();
      setActiveLudoGameId(game.gameId);
      setShowPlayerSelection(false);
      setShowWinnerModal(false);
      setWinner(null);
      setGameEnded(false);
      setOnlineMode(true);
      setWaitingForPlayers(false);
      setIsReconnecting(false);
      setShowReconnectModal(false);
      gameIdRef.current = game.gameId;
      setGameId(game.gameId);

      // Clear transient local action locks before restoring/joining a live game.
      // Otherwise stale mid-roll or mid-move refs from a previous session can
      // keep canRollDice permanently disabled even after the server snapshot is loaded.
      isRollingRef.current = false;
      isMovingRef.current = false;
      isAutoMovingRef.current = false;
      moveTimersRef.current = [];
      setCanRollDice(false);
      setDiceValueImmediate(0);
      lastRollTimeRef.current = 0;
      lastLocalDiceRollTimeRef.current = 0;

      const gameStartedFromList = Boolean(game?.lastPlayers?.gameStarted);
      const playerCountFromList = [2, 3, 4].includes(game?.playerCount)
        ? game.playerCount
        : selectedPlayerCount;
      setSelectedPlayerCount(playerCountFromList);

      if (gameStartedFromList) {
        setGameStarted(true);
        gameStartedRef.current = true;
      } else {
        setGameStarted(false);
        gameStartedRef.current = false;
      }

      ensureSocketConnected();

      const joinAndLoad = () => {
        try {
          if (!socketRef.current) return;
          socketRef.current.emit("ludo:join", { gameId: game.gameId });
          socketRef.current.emit("ludo:players:get", {
            gameId: game.gameId,
          });
          requestJoinedGames();
        } catch (_e) {}
      };

      if (socketRef.current?.connected) {
        joinAndLoad();
      } else if (socketRef.current) {
        socketRef.current.once("connect", joinAndLoad);
      }
    },
    [
      clearHiddenBoardGameId,
      selectedPlayerCount,
      ensureSocketConnected,
      requestJoinedGames,
    ],
  );

  // Start a new game (cancel reconnection and clear saved state)
  const handleDeleteLiveGame = useCallback(
    async (game) => {
      const gid = game?.gameId;
      if (!gid || !myProfile?._id) return;

      const isHost =
        game?.lastPlayers?.players?.[0]?.profileId &&
        String(game.lastPlayers.players[0].profileId) === String(myProfile._id);

      if (!isHost) {
        window.alert("Only the host can delete this live game.");
        return;
      }

      const confirmed = window.confirm(
        `Delete live game #${String(gid).slice(-6)}? This will remove it from your active games list.`,
      );
      if (!confirmed) return;

      try {
        const res = await api.delete(
          `/ludo/delete?gameId=${encodeURIComponent(gid)}`,
        );
        if (!res?.success) {
          window.alert(res?.message || "Failed to delete live game.");
          return;
        }

        setJoinedGames((prev) =>
          prev.filter((g) => String(g.gameId) !== String(gid)),
        );

        if (String(gameIdRef.current) === String(gid)) {
          clearHiddenBoardGameId();
          setGameId(null);
          gameIdRef.current = null;
          setOnlineMode(false);
          setGameStarted(false);
          gameStartedRef.current = false;
          setGameEnded(false);
          gameEndedRef.current = false;
          setWaitingForPlayers(false);
          setCanRollDice(false);
          setCurrentPlayer(0);
          currentPlayerRef.current = 0;
          setDiceValueImmediate(0);
          setWinner(null);
          setWinners([]);
          winnersRef.current = [];
          setShowWinnerModal(false);
          clearActiveLudoGameId();
        }

        requestJoinedGames();
      } catch (error) {
        console.error("[LUDO] Failed to delete live game:", error);
        window.alert("Failed to delete live game.");
      }
    },
    [
      myProfile?._id,
      requestJoinedGames,
      clearHiddenBoardGameId,
      setDiceValueImmediate,
    ],
  );

  const startNewGame = () => {
    resumeAudioFromGesture();
    const previousGameId = gameIdRef.current || gameId;

    // Invalidate every delayed restore/invite action before clearing the room
    // identity. This applies equally to hosts and remote players.
    gameSessionVersionRef.current += 1;
    pendingConnectActionsRef.current.clear();
    isJoiningViaInviteRef.current = false;
    inviteAcceptTimestampRef.current = 0;
    setIncomingInviteRequest(null);
    setIncomingInvite(null);
    try {
      localStorage.removeItem("ludo_pending_invite");
    } catch (_e) {}

    // Leave the previous live room explicitly. Keeping the socket connected is
    // intentional so the user can create/invite into the new room immediately.
    if (previousGameId && socketRef.current?.connected) {
      try {
        socketRef.current.emit("ludo:leave", {
          gameId: previousGameId,
          profileId: myProfile?._id,
          playerIndex: myPlayerIndexRef.current,
        });
      } catch (_e) {}
    }

    // Clear reconnecting state
    setIsReconnecting(false);
    setShowReconnectModal(false);
    clearHiddenBoardGameId();
    clearActiveLudoGameId();
    // Clear saved game state
    clearGameState();
    // Clear exited games flag to allow new games
    try {
      localStorage.removeItem("ludo_exited_games");
    } catch (_e) {
      // Ignore errors
    }
    // Reset every session identity/ref before opening a new-game flow.
    setGameId(null);
    gameIdRef.current = null;
    newGameDraftIdRef.current = null;
    savedGameStateRef.current = null;
    setOnlineMode(false);
    setGameStarted(false);
    gameStartedRef.current = false;
    setCurrentPlayer(0);
    setDiceValueImmediate(0);
    setWinner(null);
    setWinners([]);
    winnersRef.current = [];
    setGameEnded(false);
    gameEndedRef.current = false;
    setWaitingForPlayers(false);
    setCanRollDice(false);
    currentPlayerRef.current = 0;
    playersRef.current = [];
    latestSentPlayersSeqRef.current = 0;
    latestAppliedPlayersSeqRef.current = 0;
    persistRequestVersionRef.current = 0;
    pendingPersistRequestRef.current = null;
    awaitingAuthoritativeSnapshotRef.current = false;
    botActingRef.current = false;
    botActingPlayerIndexRef.current = null;
    if (botTurnTimerRef.current) {
      clearTimeout(botTurnTimerRef.current);
      botTurnTimerRef.current = null;
    }
    recentMovesRef.current.clear();
    lastJoinRequestRef.current = { gameId: null, timestamp: 0 };
    lastPlayersGetRequestRef.current = { gameId: null, timestamp: 0 };
    selfHealPlayersGetRequestRef.current = { gameId: null, timestamp: 0 };
    invitedStatusByFriendIdRef.current = {};
    invitedSlotByFriendIdRef.current = {};
    setInvitedStatusByFriendId({});
    setInvitedSlotByFriendId({});
    setSelectedFriends([]);
    initializeGame(selectedPlayerCount, []);
    // Open player selection
    setShowPlayerSelection(true);
  };

  // Every user-facing start action must begin with the same clean session.
  const startGame = startNewGame;

  // Explicitly leaving always removes local state and persisted online data.
  const exitGame = () => {
    const isOnlineGame = Boolean(onlineMode && gameId && myProfile?._id);
    const isHost = Boolean(
      isOnlineGame &&
      playersRef.current?.[0]?.profileId &&
      String(playersRef.current[0].profileId) === String(myProfile._id),
    );

    const confirmed = window.confirm(
      isHost
        ? "Leave this game? The match will end for everyone and all game data will be removed."
        : "Leave this game? Your game data and progress will be removed.",
    );
    if (!confirmed) return;

    console.log("[EXIT_GAME] Starting complete cleanup of all game state");

    const leaveRequest = isOnlineGame
      ? api.post("/ludo/leave", { gameId }).catch((error) => {
          console.error("[LUDO] Failed to remove persisted game data:", error);
          return null;
        })
      : Promise.resolve(null);

    // Notify other players immediately while persisted cleanup runs in parallel
    if (
      onlineMode &&
      gameId &&
      socketRef.current &&
      socketRef.current.connected
    ) {
      try {
        // Emit leave event to notify server and other players
        socketRef.current.emit("ludo:leave", {
          gameId,
          profileId: myProfile?._id,
          playerIndex: myPlayerIndex,
        });
        // Give a small delay for the event to be sent before disconnecting
        setTimeout(() => {
          cleanupSocket();
        }, 100);
      } catch (_e) {
        // If emit fails, still cleanup
        cleanupSocket();
      }
    } else {
      // Not in online mode or socket not connected, just cleanup
      cleanupSocket();
    }

    // Cleanup is intentionally non-blocking; the authenticated request continues
    // after the board has been reset locally.
    void leaveRequest;

    // Clear all localStorage game state
    try {
      // Always clear saved game state when exiting completely
      try {
        localStorage.removeItem("ludo_game_state");
        savedGameStateRef.current = null;
      } catch (_e) {}

      // Store the exited gameId to prevent reconnection after page reload
      if (gameId) {
        const exitedGames = JSON.parse(
          localStorage.getItem("ludo_exited_games") || "[]",
        );
        const gameIdStr = String(gameId);
        const alreadyExited =
          Array.isArray(exitedGames) &&
          exitedGames.some((gid) => String(gid) === gameIdStr);
        if (!alreadyExited) {
          exitedGames.push(gameId);
          localStorage.setItem(
            "ludo_exited_games",
            JSON.stringify(exitedGames),
          );
          console.log(
            "[EXIT_GAME] Marked game as exited to prevent reconnection:",
            gameId,
          );
        }
      }
      localStorage.removeItem("ludo_game_state");
      localStorage.removeItem("ludo_pending_invite");
      clearHiddenBoardGameId();
      clearActiveLudoGameId();
      clearHandledLudoInvites();
      savedGameStateRef.current = null;
      console.log("[EXIT_GAME] Cleared localStorage game state");
    } catch (_e) {
      // Ignore errors
    }

    // Clear all search timeouts
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = null;
    }

    // Clear all move timers
    moveTimersRef.current.forEach((t) => {
      if (typeof t === "number") {
        clearTimeout(t);
      } else if (t && typeof t === "object" && t.timestamp) {
        // Timer object, clear if it has a timeout ID
        if (t.timeoutId) clearTimeout(t.timeoutId);
      }
    });
    moveTimersRef.current = [];

    // Reset all game state variables
    setGameId(null);
    gameIdRef.current = null;
    newGameDraftIdRef.current = null;
    setOnlineMode(false);
    setPlayWithComputer(false);
    setGameStarted(false);
    setGameEnded(false);
    setCurrentPlayer(0);
    setDiceValueImmediate(0);
    setCanRollDice(false); // Set to false initially
    setWinner(null);
    setWinners([]);
    setShowWinnerModal(false);
    setShowPlayerSelection(false);
    setWaitingForPlayers(false);
    setIsReplacingWaitingPlayers(false);
    setIsReconnecting(false);
    setShowReconnectModal(false);

    // Clear invite-related state
    setIncomingInviteRequest(null);
    setIncomingInvite(null);
    setPendingInvites([]);
    setInviteCopied(false);
    setSelectedFriends([]);
    setInvitedStatusByFriendId({});
    setInvitedSlotByFriendId({});
    setLastInviter(null);

    // Clear friend search state
    setFriendSearchQuery("");
    setSearchResults([]);
    setLoadingSearch(false);
    setFriendList([]);

    // Clear player editor state
    setShowPlayerEditor(false);
    setEditingPlayerIndex(null);
    setEditName("");
    setEditAvatarUrl("");
    if (avatarFileInputRef.current) {
      avatarFileInputRef.current.value = "";
    }

    // Clear disconnected players tracking
    setDisconnectedPlayers(new Set());

    // Reset selected player count to default
    setSelectedPlayerCount(4);

    // Reset all refs
    gameStartedRef.current = false;
    gameEndedRef.current = false;
    currentPlayerRef.current = 0;
    diceValueRef.current = 0;
    lastDiceValueRef.current = 0;
    myPlayerIndexRef.current = 0;
    selectedPlayerCountRef.current = 4;
    winnersRef.current = [];
    maxStepsRef.current = 0;
    invitedStatusByFriendIdRef.current = {};
    invitedSlotByFriendIdRef.current = {};
    inviteTimestampsRef.current = {};
    recentMovesRef.current.clear();
    lastTurnAdvanceTimeRef.current = 0;
    lastLocalDiceRollTimeRef.current = 0;
    lastRollTimeRef.current = 0;
    lastBroadcastRef.current = 0;
    lastCanRollDiceUpdateRef.current = {
      value: false,
      timestamp: 0,
      reason: "",
    };
    hasProcessedReconnectionStateRef.current = false;
    isRestoringFromServerRef.current = false;
    currentPlayerUpdatedFromServerRef.current = false;
    latestSentPlayersSeqRef.current = 0;
    latestAppliedPlayersSeqRef.current = 0;
    awaitingAuthoritativeSnapshotRef.current = false;
    isSavingGameStateRef.current = false;
    isRollingRef.current = false;
    isMovingRef.current = false;
    isAutoMovingRef.current = false;
    botActingRef.current = false;
    botActingPlayerIndexRef.current = null;
    if (botTurnTimerRef.current) {
      clearTimeout(botTurnTimerRef.current);
      botTurnTimerRef.current = null;
    }
    autoStartTriggeredRef.current = false;
    socketCreatingRef.current = false;
    inviteHandlersAttachedRef.current = false;
    isJoiningViaInviteRef.current = false;
    inviteAcceptTimestampRef.current = 0;
    lastJoinRequestRef.current = { gameId: null, timestamp: 0 };
    lastPlayersGetRequestRef.current = { gameId: null, timestamp: 0 };

    gameSessionVersionRef.current += 1;
    pendingConnectActionsRef.current.clear();
    pendingPersistRequestRef.current = null;
    persistRequestVersionRef.current = 0;
    savedGameStateRef.current = null;
    newGameDraftIdRef.current = null;
    setJoinedGames((previous) =>
      previous.filter((game) => String(game.gameId) !== String(gameId)),
    );

    // Reset players ref
    playersRef.current = [];

    // Reinitialize game to default state
    initializeGame(4); // Reset to default 4 players

    console.log("[EXIT_GAME] Complete cleanup finished - all state reset");
  };

  const confirmPlayerCount = () => {
    resumeAudioFromGesture();
    clearHiddenBoardGameId();

    // Starting from the player picker always creates a brand-new match. Do not
    // allow a hidden/resumable game or stale refs to supply its room or board.
    const newOnlineGameId = onlineMode
      ? newGameDraftIdRef.current || generateGameId()
      : null;
    if (onlineMode) {
      clearGameState();
      gameIdRef.current = newOnlineGameId;
      newGameDraftIdRef.current = null;
      setGameId(newOnlineGameId);
      setIsReconnecting(false);
      setShowReconnectModal(false);
      gameStartedRef.current = false;
      gameEndedRef.current = false;
      currentPlayerRef.current = 0;
      winnersRef.current = [];
      latestSentPlayersSeqRef.current = 0;
      latestAppliedPlayersSeqRef.current = 0;
      persistRequestVersionRef.current = 0;
      pendingPersistRequestRef.current = null;
      awaitingAuthoritativeSnapshotRef.current = false;
      recentMovesRef.current.clear();
    }
    console.log("[CONFIRM_PLAYER_COUNT] Called", {
      onlineMode,
      selectedPlayerCount,
      selectedFriendsCount: selectedFriends.length,
      selectedFriends: selectedFriends.map((f) => ({
        id: f._id,
        name: f.fullName,
      })),
      gameId,
      invitedSlots: invitedSlotByFriendIdRef.current,
    });

    setShowPlayerSelection(false);

    // Initialize game state (but don't start yet in online mode if players haven't joined)
    setCurrentPlayer(0);
    setDiceValueImmediate(0);
    setWinner(null);

    // Preserve any customizations made before starting; only adjust seat count and fill missing seats
    setPlayers((prev) => {
      const max = Math.max(2, Math.min(4, selectedPlayerCount));
      const next = [];
      for (let i = 0; i < max; i++) {
        const prevSeat = prev?.[i];
        const boardSeatIndex = getBoardSeatIndex(i, selectedPlayerCount);
        const baseName =
          i === 0 ? myProfile?.fullName || "You" : playerNames[boardSeatIndex];
        const baseAvatar = i === 0 ? myProfile?.profilePic : undefined;
        const baseCover =
          i === 0
            ? myProfile?.coverPic || myProfile?.cover || undefined
            : undefined;
        // A newly hosted game must always start with all tokens at home.
        const pieces = Array.from({ length: 4 }).map((_, j) => ({
          id: j,
          color: colors[boardSeatIndex],
          position: { x: 0, y: 0 },
          isHome: true,
          isInPlay: false,
          steps: 0,
        }));
        next.push({
          id: i,
          name: prevSeat?.name || baseName,
          color: colors[boardSeatIndex],
          pieces,
          isActive: i === 0 || Boolean(prevSeat?.isBot),
          avatar: prevSeat?.avatar || baseAvatar,
          cover: prevSeat?.cover || baseCover,
          profileId:
            i === 0
              ? myProfile?._id || "local"
              : onlineMode
                ? undefined
                : prevSeat?.profileId || undefined,
          isBot: prevSeat?.isBot || false,
        });
      }
      if (playWithComputer && !onlineMode) {
        for (let i = 1; i < next.length; i++) {
          const seat = next[i];
          const hasHumanFriend =
            seat?.profileId && !String(seat.profileId).startsWith("bot-");
          if (!hasHumanFriend) {
            next[i] = {
              ...seat,
              name: `Computer ${i}`,
              isBot: true,
              profileId: `bot-${i}`,
            };
          }
        }
      }
      // Update ref immediately to keep state synchronized
      playersRef.current = next;
      return next;
    });
    // Re-apply any reserved invited slots to the fresh players list
    // CRITICAL: Don't set profileId until friend accepts - only set name/avatar for display
    // This prevents the server from thinking they've joined before they accept
    // The profileId will be set when they accept via the onAccepted handler
    if (
      onlineMode &&
      invitedSlotByFriendId &&
      Object.keys(invitedSlotByFriendId).length > 0
    ) {
      setPlayers((prev) => {
        const copy = prev.map((p) => ({
          ...p,
          pieces: p.pieces.map((pc) => ({ ...pc })),
        }));
        Object.entries(invitedSlotByFriendId).forEach(([fid, slotStr]) => {
          const slot = Number(slotStr);
          const friend = [
            ...selectedFriends,
            ...friendList,
            ...searchResults,
          ].find((f) => String(f?._id) === String(fid));
          if (copy[slot] && friend) {
            const friendIdStr = String(friend._id);
            const inviteStatus =
              invitedStatusByFriendIdRef.current[friendIdStr];

            // Set name/avatar for UI display (so host can see who they invited)
            copy[slot].name = friend.fullName || copy[slot].name;
            copy[slot].avatar = friend.profilePic || copy[slot].avatar;
            copy[slot].cover =
              friend.coverPic ||
              friend.cover ||
              friend.profileCover ||
              copy[slot].cover;

            // CRITICAL: Only set profileId if friend has already accepted (status === 'joined')
            // Otherwise, DON'T set profileId - this prevents the server from thinking they've joined
            // The profileId will be set when they accept via the onAccepted handler
            if (inviteStatus === "joined") {
              copy[slot].profileId = friend._id;
            }
            // If status is not 'joined', leave profileId undefined - this is intentional
          }
        });
        // Update ref immediately to keep state synchronized
        playersRef.current = copy;
        return copy;
      });
    }

    // Setup online room/socket and check if we should wait for players
    if (onlineMode && myProfile?._id) {
      const gid = newOnlineGameId;
      console.log("[CONFIRM_PLAYER_COUNT] Setting up online game", {
        gid,
        hasGameId: !!gameId,
      });
      setGameId(gid);
      ensureSocketConnected();

      console.log("[CONFIRM_PLAYER_COUNT] Socket status", {
        hasSocket: !!socketRef.current,
        connected: socketRef.current?.connected,
      });

      // CRITICAL: Wait for players state to update, then create game state in database first, then send invitations
      // Use setTimeout to ensure state updates have been applied
      setTimeout(() => {
        console.log(
          "[CONFIRM_PLAYER_COUNT] Inside setTimeout, preparing to create game state",
          {
            gid,
            playersRefLength: playersRef.current?.length,
            playersLength: players.length,
            selectedFriendsCount: selectedFriends.length,
          },
        );

        // Get current players state for initial game creation (after state update)
        const currentPlayersForDB =
          playersRef.current && playersRef.current.length > 0
            ? playersRef.current
            : players; // Fallback to state if ref not updated yet

        console.log("[CONFIRM_PLAYER_COUNT] Calling createInitialGameState", {
          gid,
          playersCount: currentPlayersForDB.length,
        });

        // Create initial game state in database
        createInitialGameState(gid, currentPlayersForDB).then(
          (gameStateCreated) => {
            console.log(
              "[CONFIRM_PLAYER_COUNT] createInitialGameState completed",
              { gameStateCreated },
            );
            if (gameStateCreated) {
              console.log(
                "[CONFIRM_PLAYER_COUNT] Game state created, preparing to send invites",
                {
                  selectedFriendsCount: selectedFriends.length,
                  selectedFriends: selectedFriends.map((f) => ({
                    id: f._id,
                    name: f.fullName,
                  })),
                  invitedSlots: invitedSlotByFriendIdRef.current,
                },
              );

              // Wait for socket to be connected before sending invites
              const sendInvitesWhenReady = () => {
                if (!socketRef.current) {
                  console.log(
                    "[CONFIRM_PLAYER_COUNT] Socket not available, waiting...",
                  );
                  setTimeout(sendInvitesWhenReady, 200);
                  return;
                }

                if (!socketRef.current.connected) {
                  console.log(
                    "[CONFIRM_PLAYER_COUNT] Socket not connected, waiting for connection...",
                  );
                  pendingConnectActionsRef.current.set(
                    "send-ludo-invites",
                    () => {
                      console.log(
                        "[CONFIRM_PLAYER_COUNT] Socket connected, sending invites",
                      );
                      sendInvitesToFriends();
                    },
                  );
                  return;
                }

                // Socket is connected, send invites
                console.log(
                  "[CONFIRM_PLAYER_COUNT] Socket connected, sending invites immediately",
                );
                sendInvitesToFriends();
              };

              const sendInvitesToFriends = () => {
                // Game state created successfully - now send invitations to all selected friends
                // Send invitations to all friends in selectedFriends list
                // This includes friends that were selected before "Start Game" was clicked
                if (!selectedFriends || selectedFriends.length === 0) {
                  console.log(
                    "[CONFIRM_PLAYER_COUNT] No selected friends to invite",
                  );
                  return;
                }

                console.log(
                  "[CONFIRM_PLAYER_COUNT] Sending invites to",
                  selectedFriends.length,
                  "friends",
                );

                selectedFriends.forEach((friend) => {
                  if (friend && friend._id) {
                    const friendIdStr = String(friend._id);
                    const slot = invitedSlotByFriendIdRef.current[friendIdStr];

                    // If slot is not set, try to get it from the players array
                    let actualSlot = slot;
                    if (actualSlot === undefined) {
                      const currentPlayers = playersRef.current || players;
                      const playerIndex = currentPlayers.findIndex(
                        (p) =>
                          p?.profileId && String(p.profileId) === friendIdStr,
                      );
                      if (playerIndex >= 0) {
                        actualSlot = playerIndex;
                        // Update the ref
                        invitedSlotByFriendIdRef.current[friendIdStr] =
                          actualSlot;
                        setInvitedSlotByFriendId((prev) => ({
                          ...prev,
                          [friendIdStr]: actualSlot,
                        }));
                      }
                    }

                    if (actualSlot === undefined) {
                      console.error(
                        `[CONFIRM_PLAYER_COUNT] No slot found for friend ${friendIdStr}, skipping invite`,
                      );
                      return;
                    }

                    // CRITICAL: Only skip if friend has actually joined (status === 'joined')
                    // Don't skip if status is 'invited' or undefined - we need to send/re-send the invite
                    const currentStatus =
                      invitedStatusByFriendIdRef.current[friendIdStr];
                    if (currentStatus === "joined") {
                      console.log(
                        `[CONFIRM_PLAYER_COUNT] Skipping invite to ${friendIdStr} - already joined`,
                      );
                      return;
                    }

                    // Send invitation after game state is created
                    setTimeout(() => {
                      try {
                        const targetId = friend?._id || friend?.id;
                        if (!targetId) {
                          console.error(
                            `[CONFIRM_PLAYER_COUNT] No targetId for friend ${friendIdStr}`,
                          );
                          return;
                        }

                        // Double-check status before sending (race condition protection)
                        const statusBeforeSend =
                          invitedStatusByFriendIdRef.current[friendIdStr];
                        if (statusBeforeSend === "joined") {
                          console.log(
                            `[CONFIRM_PLAYER_COUNT] Skipping invite to ${friendIdStr} - status changed to joined`,
                          );
                          return;
                        }

                        // Ensure socket is still connected
                        if (
                          !socketRef.current ||
                          !socketRef.current.connected
                        ) {
                          console.error(
                            `[CONFIRM_PLAYER_COUNT] Socket not connected when trying to send invite to ${friendIdStr}`,
                          );
                          return;
                        }

                        // Join/create room for host (if not already joined)
                        try {
                          socketRef.current.emit("ludo:join", { gameId: gid });
                        } catch (_e) {
                          console.error(
                            `[CONFIRM_PLAYER_COUNT] Error joining game room:`,
                            _e,
                          );
                        }

                        console.log(
                          `[CONFIRM_PLAYER_COUNT] Sending invite to ${friendIdStr} (${friend.fullName || friend.name}) for slot ${actualSlot}`,
                          {
                            gameId: gid,
                            slotIndex: actualSlot,
                            playerCount: selectedPlayerCount,
                            socketConnected: socketRef.current.connected,
                          },
                        );

                        // Send invite now that game state exists
                        try {
                          socketRef.current.emit("ludo:invite", {
                            to: targetId,
                            by: myProfile?._id,
                            name: myProfile?.fullName || "Player",
                            avatar: myProfile?.profilePic,
                            cover: myProfile?.coverPic,
                            gameId: gid,
                            slotIndex: actualSlot,
                            playerCount: selectedPlayerCount,
                            ts: Date.now(),
                          });
                          console.log(
                            `[CONFIRM_PLAYER_COUNT] ✅ Invite sent successfully to ${friendIdStr}`,
                          );
                        } catch (emitError) {
                          console.error(
                            `[CONFIRM_PLAYER_COUNT] ❌ Error emitting invite to ${friendIdStr}:`,
                            emitError,
                          );
                        }

                        // Fire a web notification to the friend's active browsers
                        try {
                          sendInviteNotificationToFriend(
                            friend,
                            gid,
                            actualSlot,
                          );
                        } catch (notifError) {
                          console.error(
                            `[CONFIRM_PLAYER_COUNT] Error sending notification to ${friendIdStr}:`,
                            notifError,
                          );
                        }

                        // Update status to 'invited' if not already set
                        if (
                          invitedStatusByFriendIdRef.current[friendIdStr] !==
                          "joined"
                        ) {
                          setInvitedStatusByFriendId((prev) => {
                            const updated = {
                              ...prev,
                              [friendIdStr]: "invited",
                            };
                            invitedStatusByFriendIdRef.current = updated;
                            return updated;
                          });
                        }
                      } catch (_e) {
                        console.error(
                          `[CONFIRM_PLAYER_COUNT] Error sending invite to ${friendIdStr}:`,
                          _e,
                        );
                      }
                    }, 100); // Small delay to ensure game state is fully created
                  }
                });
              };

              // Start the invite sending process
              sendInvitesWhenReady();
            } else {
              console.error(
                "[CONFIRM_PLAYER_COUNT] Failed to create game state in database",
              );
            }
          },
        );
      }, 200); // Wait for state updates to complete

      // Wait for socket to be ready before emitting
      const waitAndEmit = () => {
        if (socketRef.current && socketRef.current.connected) {
          // Prevent multiple join requests for the same game
          const now = Date.now();
          const lastJoin = lastJoinRequestRef.current;
          const timeSinceLastJoin = now - lastJoin.timestamp;
          const MIN_JOIN_INTERVAL = 1000;

          if (
            lastJoin.gameId === gid &&
            timeSinceLastJoin < MIN_JOIN_INTERVAL
          ) {
            // Already joined this game recently, skip
            return;
          }

          // Update tracking
          lastJoinRequestRef.current = { gameId: gid, timestamp: now };

          try {
            try {
              console.log("[LUDO][client] emit ludo:join (host)", { gid });
            } catch (_e) {}
            socketRef.current.emit("ludo:join", { gameId: gid });
            setMyPlayerIndex(0);
            myPlayerIndexRef.current = 0;
            persistAndBroadcastGameState("game_lobby_initialized", {
              gameId: gid,
            });
          } catch (_e) {}
        } else if (socketRef.current) {
          // Wait for connection
          socketRef.current.once("connect", () => {
            // Prevent multiple join requests for the same game
            const now = Date.now();
            const lastJoin = lastJoinRequestRef.current;
            const timeSinceLastJoin = now - lastJoin.timestamp;
            const MIN_JOIN_INTERVAL = 1000;

            if (
              lastJoin.gameId === gid &&
              timeSinceLastJoin < MIN_JOIN_INTERVAL
            ) {
              // Already joined this game recently, skip
              return;
            }

            // Update tracking
            lastJoinRequestRef.current = { gameId: gid, timestamp: now };

            try {
              socketRef.current.emit("ludo:join", { gameId: gid });
              setMyPlayerIndex(0);
              myPlayerIndexRef.current = 0;
              persistAndBroadcastGameState("game_lobby_initialized", {
                gameId: gid,
              });
            } catch (_e) {}
          });
        }
      };
      setTimeout(waitAndEmit, 100);

      // CRITICAL: Set waiting state immediately after confirmPlayerCount
      // Don't check if all players joined yet - wait for invites to be sent and accepted
      setGameStarted(false);
      gameStartedRef.current = false;
      setCanRollDice(false);

      // Wait longer before checking if all players joined
      // This gives time for invites to be sent and players to accept
      setTimeout(() => {
        recomputeWaitingState();

        // Check if all players have joined after invites have been sent
        // This check will be handled by recomputeWaitingState and the useEffect that watches for player joins
        // Don't auto-start here - let the recomputeWaitingState and auto-start logic handle it
      }, 1000); // Wait 1 second for invites to be sent
    } else {
      // Offline mode - start immediately
      setGameStarted(true);
      gameStartedRef.current = true;
      autoStartTriggeredRef.current = false;
      setCanRollDice(true);

      // Save game state to database even in offline mode (if user is authenticated)
      if (myProfile?._id && gameId) {
        setTimeout(() => {
          saveGameStateToDatabase();
        }, 300);
      }
    }
  };

  const continueGame = () => {
    setShowWinnerModal(false);
    setWinner(null);

    if (onlineMode && myPlayerIndexRef.current !== 0) {
      setCanRollDice(false);
      return;
    }

    const fromPlayer = currentPlayerRef.current;
    const nextPlayer = getNextActivePlayer(fromPlayer);
    setCurrentPlayer(nextPlayer);
    currentPlayerRef.current = nextPlayer;
    setDiceValueImmediate(0);
    setCanRollDice(!onlineMode);

    if (onlineMode && gameId) {
      persistAndBroadcastGameState("continue_after_winner", {
        fromPlayer,
        toPlayer: nextPlayer,
      });
    }
  };

  const endGame = () => {
    clearHiddenBoardGameId();
    setShowWinnerModal(false);
    setGameEnded(true);
    gameEndedRef.current = true;
    setWinner(null);
    // Clear disconnected players tracking
    setDisconnectedPlayers(new Set());

    // Save final authoritative state before clearing local restore data.
    if (myPlayerIndex === 0 && onlineMode && gameId) {
      setTimeout(() => {
        persistAndBroadcastGameState("game_end", {
          trigger: "endGame",
        }).then((snapshot) => {
          if (snapshot) {
            clearGameState();
          }
        });
      }, 300);
    } else {
      // Clear saved game state when game fully ends
      clearGameState();
    }

    clearActiveLudoGameId();
    clearHandledLudoInvites();
  };

  // Debug: trigger celebration modal
  const triggerDebugCelebration = () => {
    try {
      const winnerPlayer = players[currentPlayer];
      if (!winnerPlayer) return;
      setWinner(winnerPlayer);
      setShowWinnerModal(true);
      setWinners((prev) =>
        prev.some((w) => w?.id === winnerPlayer?.id)
          ? prev
          : [...prev, winnerPlayer],
      );
    } catch (_e) {}
  };

  const debugTeleportPiece = () => {
    if (!isDebug || !gameStarted) return;
    const playerIndex = Number(debugPlayerIndex);
    const pieceIndex = Number(debugPieceIndex);
    const homeColumnStart = maxSteps - (HOME_COLUMN_LENGTH - 1);
    const requestedSteps =
      debugSteps === "" || debugSteps == null
        ? homeColumnStart
        : Number(debugSteps);
    if (
      !Number.isInteger(playerIndex) ||
      playerIndex < 0 ||
      playerIndex >= selectedPlayerCount
    ) {
      return;
    }
    if (!Number.isInteger(pieceIndex) || pieceIndex < 0 || pieceIndex > 3) {
      return;
    }
    if (!Number.isFinite(requestedSteps)) return;
    const targetSteps = Math.max(
      0,
      Math.min(maxSteps, Math.trunc(requestedSteps)),
    );

    isMovingRef.current = false;
    isAutoMovingRef.current = false;
    isRollingRef.current = false;
    moveTimersRef.current.forEach((t) => {
      try {
        clearTimeout(t);
      } catch (_e) {}
    });
    moveTimersRef.current = [];

    setPlayers((prev) => {
      const copy = prev.map((p) => ({
        ...p,
        pieces: Array.isArray(p.pieces)
          ? p.pieces.map((pc) => ({ ...pc }))
          : [],
      }));
      if (!copy[playerIndex]?.pieces?.[pieceIndex]) return prev;
      applyPieceLifecycle(
        copy[playerIndex].pieces[pieceIndex],
        targetSteps,
        maxSteps,
      );
      playersRef.current = copy;
      return copy;
    });

    setDiceValueImmediate(0);
    if (!onlineMode) {
      setCanRollDice(true);
    }
    console.log("[DEBUG] Teleported piece", {
      playerIndex,
      pieceIndex,
      steps: targetSteps,
      homeColumnStart: maxSteps - (HOME_COLUMN_LENGTH - 1),
    });
  };

  const resetGame = () => {
    // Confirm restart if game is in progress
    if (gameStarted && !gameEnded) {
      const confirmed = window.confirm(
        "Are you sure you want to restart the game? All progress will be lost.",
      );
      if (!confirmed) return;
    }

    // Reset moving flag
    isMovingRef.current = false;

    // Clear all move timers
    moveTimersRef.current.forEach((t) => clearTimeout(t));
    moveTimersRef.current = [];

    // Reset game state
    setGameStarted(false);
    gameStartedRef.current = false; // Reset ref
    autoStartTriggeredRef.current = false; // Reset auto-start trigger
    setWinner(null);
    setWinners([]);
    setGameEnded(false);
    setShowWinnerModal(false);
    setDiceValueImmediate(0);
    setCurrentPlayer(0);
    currentPlayerRef.current = 0;
    setCanRollDice(!onlineMode);
    setShowPlayerSelection(false);
    setWaitingForPlayers(false);

    // Clear disconnected players tracking
    setDisconnectedPlayers(new Set());

    // Reinitialize game with current player count
    initializeGame(selectedPlayerCount);

    // Reset invite tracking
    setInvitedStatusByFriendId({});
    setInvitedSlotByFriendId({});
    clearHandledLudoInvites();
    latestSentPlayersSeqRef.current = 0;
    latestAppliedPlayersSeqRef.current = 0;
    awaitingAuthoritativeSnapshotRef.current = false;

    setIncomingInviteRequest(null);

    // If in online mode and host, notify other players and reset game state on server
    // Use setTimeout to ensure state is updated after initializeGame
    setTimeout(() => {
      if (onlineMode && gameId && myPlayerIndex === 0 && socketRef.current) {
        try {
          // Get fresh players state after initializeGame
          const resetPlayers = playersRef.current.map((p) => ({
            id: p.id,
            name: p.name,
            color: p.color,
            avatar: p.avatar,
            cover: p.cover,
            profileId: p.profileId,
            isActive: p.isActive !== undefined ? p.isActive : true,
            pieces: p.pieces.map((pc) => ({
              id: pc.id,
              steps: 0,
              isHome: true,
              isInPlay: false,
            })),
          }));

          // Save and emit reset state to all players
          persistAndBroadcastGameState("game_reset", {
            trigger: "resetGame",
          });
        } catch (_e) {}
      }
    }, 100);

    // Only clear game ID and online mode if not in an active online game
    // This allows restarting without losing the game session
    // Uncomment below if you want to fully reset online mode:
    // setGameId(null);
    // setOnlineMode(false);
  };

  // Accept / decline an incoming invite
  const acceptIncomingInvite = useCallback(
    async (inviteOverride = null) => {
      // NOTE: selectedPlayerCount, initializeGame, ensureSocketConnected, clearHiddenBoardGameId are accessed
      // but not added to dependency array to avoid circular dependencies and excessive re-renders.
      // These are stable across renders in practice.
      const payload = inviteOverride?.gameId
        ? inviteOverride
        : incomingInviteRequest;
      if (!payload) return;
      try {
        // Mark as joining via invite first and invalidate any old asynchronous
        // restore before changing the active room.
        gameSessionVersionRef.current += 1;
        pendingConnectActionsRef.current.clear();
        isJoiningViaInviteRef.current = true; // Mark that we're joining via invite
        hasProcessedReconnectionStateRef.current = true; // Mark as processed to prevent reconnection logic
        inviteAcceptTimestampRef.current = Date.now(); // Track when we accepted invite to prevent reconnection

        // CRITICAL: Clear reconnecting state immediately and only once
        // This prevents the reconnection modal from showing when joining a new game
        setIsReconnecting(false);
        setShowReconnectModal(false);
        clearHiddenBoardGameId();
        markInviteHandled(payload.gameId, payload.from);
        setActiveLudoGameId(payload.gameId);
        resolveLudoInviteNotifications(payload.gameId, payload.from);

        // CRITICAL: Clear saved game state to prevent reconnection logic from triggering
        // This is a new join, not a reconnection
        savedGameStateRef.current = null;
        try {
          localStorage.removeItem("ludo_game_state");
          // Remove this gameId from exited games list if it exists (in case user exited and then got re-invited)
          const exitedGames = JSON.parse(
            localStorage.getItem("ludo_exited_games") || "[]",
          );
          const filtered = exitedGames.filter(
            (gid) => String(gid) !== String(payload.gameId),
          );
          if (filtered.length !== exitedGames.length) {
            localStorage.setItem("ludo_exited_games", JSON.stringify(filtered));
          }
        } catch (_e) {
          // Ignore localStorage errors
        }

        try {
          setLastInviter({
            id: payload.from,
            name: payload.name,
            avatar: payload.avatar,
          });
        } catch (_e) {}
        setOnlineMode(true);
        setWaitingForPlayers(true);
        setCanRollDice(false);
        isRollingRef.current = false;
        isMovingRef.current = false;
        isAutoMovingRef.current = false;
        moveTimersRef.current = [];
        newGameDraftIdRef.current = null;
        gameIdRef.current = payload.gameId;
        latestSentPlayersSeqRef.current = 0;
        latestAppliedPlayersSeqRef.current = 0;
        persistRequestVersionRef.current = 0;
        pendingPersistRequestRef.current = null;
        awaitingAuthoritativeSnapshotRef.current = false;
        recentMovesRef.current.clear();
        gameStartedRef.current = false;
        gameEndedRef.current = false;
        winnersRef.current = [];
        currentPlayerRef.current = 0;
        setGameStarted(false);
        setGameEnded(false);
        setWinners([]);
        setCurrentPlayer(0);
        setDiceValueImmediate(0);
        setGameId(payload.gameId);
        setSelectedPlayerCount(
          [2, 3, 4].includes(payload.playerCount)
            ? payload.playerCount
            : selectedPlayerCount,
        );

        // Set myPlayerIndex early so it's available when needed
        if (typeof payload.slotIndex === "number") {
          setMyPlayerIndex(payload.slotIndex);
          myPlayerIndexRef.current = payload.slotIndex;
        }

        // Ensure socket is connected (but don't treat this as a reconnection)
        ensureSocketConnected();

        // Wait for socket to be connected before proceeding with join and accept
        const waitForSocketConnected = () => {
          if (socketRef.current && socketRef.current.connected) {
            // Socket is connected, proceed with join and accept
            const now = Date.now();
            const lastJoin = lastJoinRequestRef.current;
            const timeSinceLastJoin = now - lastJoin.timestamp;
            const MIN_JOIN_INTERVAL = 1000;

            // Step 1: Send join event (only once)
            if (
              lastJoin.gameId !== payload.gameId ||
              timeSinceLastJoin >= MIN_JOIN_INTERVAL
            ) {
              lastJoinRequestRef.current = {
                gameId: payload.gameId,
                timestamp: now,
              };
              try {
                socketRef.current.emit("ludo:join", { gameId: payload.gameId });
                console.log("[ACCEPT_INVITE] Joined game room", {
                  gameId: payload.gameId,
                });
              } catch (_e) {
                console.error("[ACCEPT_INVITE] Error joining game room:", _e);
              }
            }

            // Step 2: Send accept event after join (DO NOT emit ludo:join again)
            setTimeout(() => {
              try {
                if (socketRef.current && socketRef.current.connected) {
                  socketRef.current.emit("ludo:accept", {
                    gameId: payload.gameId,
                    slotIndex: payload.slotIndex,
                    friend: {
                      _id: myProfile?._id,
                      fullName: myProfile?.fullName,
                      profilePic: myProfile?.profilePic,
                      coverPic: myProfile?.coverPic,
                    },
                    from: payload.from,
                  });
                  console.log("[ACCEPT_INVITE] Sent accept event", {
                    gameId: payload.gameId,
                    slotIndex: payload.slotIndex,
                    friendId: myProfile?._id,
                    from: payload.from,
                  });
                }
              } catch (_e) {
                console.error(
                  "[ACCEPT_INVITE] Error sending accept event:",
                  _e,
                );
              }
            }, 200);

            // Step 3: Request players snapshot
            setTimeout(() => {
              try {
                if (socketRef.current && socketRef.current.connected) {
                  socketRef.current.emit("ludo:players:get", {
                    gameId: payload.gameId,
                  });
                }
              } catch (_e) {
                console.error("[ACCEPT_INVITE] Error requesting players:", _e);
              }
            }, 300);

            // Step 4: Dismiss invite notification
            setTimeout(() => {
              try {
                if (socketRef.current && socketRef.current.connected) {
                  socketRef.current.emit("ludo:invites:dismiss", {
                    gameId: payload.gameId,
                    by: payload.from,
                  });
                }
              } catch (_e) {
                // Silent fail for dismiss - non-critical
              }
            }, 400);
          } else if (socketRef.current) {
            // Socket exists but not connected, wait for connection
            pendingConnectActionsRef.current.set(
              `accept-invite:${payload.gameId}`,
              () => {
                console.log(
                  "[ACCEPT_INVITE] Socket connected, proceeding with join",
                );
                waitForSocketConnected();
              },
            );
          } else {
            // Socket doesn't exist yet, retry
            setTimeout(waitForSocketConnected, 100);
          }
        };
        waitForSocketConnected();

        // Update local players for quick UI before host snapshot arrives
        initializeGame(
          [2, 3, 4].includes(payload.playerCount)
            ? payload.playerCount
            : selectedPlayerCount,
        );
        setPlayers((prev) => {
          const copy = prev.map((p) => ({
            ...p,
            pieces: p.pieces.map((pc) => ({ ...pc })),
          }));
          const slot = payload.slotIndex;
          // Place invitee (me) into the reserved slot
          if (copy[slot]) {
            copy[slot].name = myProfile?.fullName || copy[slot].name;
            copy[slot].avatar = myProfile?.profilePic || copy[slot].profilePic;
            // Use cover fields if available; do not override with avatar
            copy[slot].cover = myProfile?.coverPic || copy[slot].cover;
            copy[slot].profileId = myProfile?._id || copy[slot].profileId;
            copy[slot].isActive = true;
            copy[slot].isOffline = false;
          }
          // Ensure host (inviter) appears in seat 0 locally until host snapshot arrives
          // This prevents both players showing as the invitee
          if (copy[0] && slot !== 0) {
            copy[0].name = payload?.name || copy[0].name;
            // If inviter avatar is provided, use it; otherwise preserve whatever is there
            if (payload?.avatar) {
              copy[0].avatar = payload.avatar;
              // align cover with inviter avatar for the home background
              copy[0].cover = payload.cover;
            }
            copy[0].profileId = payload?.from || copy[0].profileId;
          }
          playersRef.current = copy;
          return copy;
        });
        // Clear incoming invite request now that we've performed the accept actions
        try {
          setIncomingInviteRequest(null);
        } catch (_e) {}
        // Remove the accepted invite from pendingInvites to avoid it being re-shown
        try {
          setPendingInvites((prev) =>
            prev.filter(
              (i) =>
                !(
                  String(i.gameId) === String(payload.gameId) &&
                  String(i.from) === String(payload.from)
                ),
            ),
          );
        } catch (_e) {}
      } catch (error) {
        console.error("[ACCEPT_INVITE] Error accepting invite:", error);
        // Reset state on error
        setOnlineMode(false);
        setGameId(null);
        setIncomingInviteRequest(null);
        // Reset invite refs on error
        isJoiningViaInviteRef.current = false;
      } finally {
        // No-op - incomingInviteRequest is cleared above on success or error
      }
    },
    [
      incomingInviteRequest,
      myProfile?._id,
      myProfile?.fullName,
      myProfile?.profilePic,
      myProfile?.coverPic,
    ],
  );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  // Note: selectedPlayerCount, initializeGame, ensureSocketConnected, clearHiddenBoardGameId are not included
  // in dependencies to avoid circular dependencies and excessive re-renders. These functions are stable enough.

  // Store accept function in ref for use in effects
  useEffect(() => {
    acceptIncomingInviteRef.current = acceptIncomingInvite;
  }, [acceptIncomingInvite]);

  const declineIncomingInvite = () => {
    const payload = incomingInviteRequest;
    if (!payload) return;

    try {
      markInviteHandled(payload.gameId, payload.from);
      resolveLudoInviteNotifications(payload.gameId, payload.from);

      // Emit dismiss event to socket
      if (socketRef.current) {
        try {
          socketRef.current.emit("ludo:invites:dismiss", {
            gameId: payload.gameId,
            by: payload.from,
          });
        } catch (_e) {}
      }

      // Remove from pending invites
      setPendingInvites((prev) =>
        prev.filter(
          (i) =>
            !(
              String(i.gameId) === String(payload.gameId) &&
              String(i.from) === String(payload.from)
            ),
        ),
      );

      // Clear the incoming invite request
      setIncomingInviteRequest(null);
    } catch (error) {
      console.error("[DECLINE_INVITE] Error declining invite:", error);
      // Still clear the state even on error
      setIncomingInviteRequest(null);
    }
  };

  // Helper function to calculate token offset for multiple tokens in the same cell
  const getTokenOffset = (index, count) => {
    // Use a fraction of cell size for spacing, rounded to whole pixels
    const delta = Math.round(CELL_SIZE * 0.35);
    if (count <= 1) return { dx: 0, dy: 0 };
    if (count === 2) {
      const dx = index === 0 ? -delta / 2 : delta / 2;
      return { dx: Math.round(dx), dy: 0 };
    }
    if (count === 3) {
      const positions = [
        { dx: -delta / 2, dy: -delta / 2 },
        { dx: delta / 2, dy: -delta / 2 },
        { dx: 0, dy: delta / 2 },
      ];
      const pos = positions[index] || { dx: 0, dy: 0 };
      return {
        dx: Math.round(pos.dx),
        dy: Math.round(pos.dy),
      };
    }
    // 4 or more - use 2x2 grid for first 4
    const grid = [
      { dx: -delta / 2, dy: -delta / 2 },
      { dx: delta / 2, dy: -delta / 2 },
      { dx: -delta / 2, dy: delta / 2 },
      { dx: delta / 2, dy: delta / 2 },
    ];
    const pos = grid[index % 4];
    return {
      dx: Math.round(pos.dx),
      dy: Math.round(pos.dy),
    };
  };

  const renderBoardGrid = () => {
    const rects = [];
    for (let row = 0; row < 15; row++) {
      for (let col = 0; col < 15; col++) {
        rects.push(
          <rect
            key={`cell-${row}-${col}`}
            x={col * CELL_SIZE}
            y={row * CELL_SIZE}
            width={CELL_SIZE}
            height={CELL_SIZE}
            fill={"#FAFAF8"}
            stroke={BOARD_GRID_STROKE}
            strokeWidth={0.75}
          />,
        );
      }
    }
    return rects;
  };

  const renderSafeStar = (col, row, color, key) => {
    const cx = (col + 0.5) * CELL_SIZE;
    const cy = (row + 0.5) * CELL_SIZE;
    const r = CELL_SIZE * 0.32;
    const points = [];
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI / 4) * i - Math.PI / 2;
      const radius = i % 2 === 0 ? r : r * 0.42;
      points.push(
        `${cx + Math.cos(angle) * radius},${cy + Math.sin(angle) * radius}`,
      );
    }
    return (
      <polygon
        key={key}
        points={points.join(" ")}
        fill={color}
        stroke={BOARD_OUTER_STROKE}
        strokeWidth={0.8}
        opacity={0.95}
      />
    );
  };

  const renderStaticRects = () => {
    const elems = [];
    const stroke = BOARD_OUTER_STROKE;
    // Corner home areas (colored border with inner white)
    const drawHome = (x0, y0, color, idx) => {
      elems.push(
        <rect
          key={`home-outer-${x0}-${y0}`}
          x={x0 * CELL_SIZE}
          y={y0 * CELL_SIZE}
          width={CELL_SIZE * 6}
          height={CELL_SIZE * 6}
          fill={color}
          stroke={stroke}
          strokeWidth={1.5}
          rx={CELL_SIZE * 0.15}
        />,
      );
      const innerX = (x0 + 1) * CELL_SIZE;
      const innerY = (y0 + 1) * CELL_SIZE;
      const innerW = CELL_SIZE * 4;
      const innerH = CELL_SIZE * 4;
      // Background cover image
      const playerIndex = getPlayerIndexForBoardSeat(idx, selectedPlayerCount);
      const homePlayer = playerIndex === null ? null : players[playerIndex];
      const coverUrl =
        homePlayer?.cover ||
        homePlayer?.coverPic ||
        homePlayer?.profileCover ||
        undefined;
      if (coverUrl && playerIndex !== null) {
        elems.push(
          <image
            key={`home-cover-${x0}-${y0}`}
            href={coverUrl}
            x={innerX}
            y={innerY}
            width={innerW}
            height={innerH}
            preserveAspectRatio="xMidYMid slice"
          />,
        );
        // Dark overlay over background image for contrast
        elems.push(
          <rect
            key={`home-cover-overlay-${x0}-${y0}`}
            x={innerX}
            y={innerY}
            width={innerW}
            height={innerH}
            fill="rgba(0,0,0,0.45)"
          />,
        );
        // Border frame over the image
        elems.push(
          <rect
            key={`home-inner-border-${x0}-${y0}`}
            x={innerX}
            y={innerY}
            width={innerW}
            height={innerH}
            fill="none"
            stroke={stroke}
            strokeWidth={1.5}
            rx={CELL_SIZE * 0.1}
          />,
        );
      } else {
        // Fallback soft cream background
        elems.push(
          <rect
            key={`home-inner-${x0}-${y0}`}
            x={innerX}
            y={innerY}
            width={innerW}
            height={innerH}
            fill="#FFFEFA"
            stroke={stroke}
            strokeWidth={1.5}
            rx={CELL_SIZE * 0.1}
          />,
        );
      }
      // four pips
      const cx = (x0 + 1) * CELL_SIZE + CELL_SIZE * 2;
      const cy = (y0 + 1) * CELL_SIZE + CELL_SIZE * 2;
      const pipRadius = CELL_SIZE * 0.3;
      const gap = CELL_SIZE * 0.45; // increase spacing between home placeholders
      const offsets = [
        [-gap, -gap],
        [gap, -gap],
        [-gap, gap],
        [gap, gap],
      ];
      offsets.forEach((o, i) => {
        elems.push(
          <circle
            key={`pip-${x0}-${y0}-${i}`}
            cx={cx + o[0]}
            cy={cy + o[1]}
            r={pipRadius}
            fill={color}
            stroke={stroke}
            strokeWidth={1.5}
          />,
        );
        elems.push(
          <circle
            key={`pip-inner-${x0}-${y0}-${i}`}
            cx={cx + o[0]}
            cy={cy + o[1]}
            r={pipRadius * 0.55}
            fill="rgba(255,255,255,0.35)"
          />,
        );
      });
    };
    drawHome(0, 0, colors[0], 0); // red
    drawHome(9, 0, colors[1], 1); // green
    drawHome(0, 9, colors[2], 2); // blue
    drawHome(9, 9, colors[3], 3); // yellow

    // Cross paths - single width
    for (let c = 0; c < 15; c++) {
      elems.push(
        <rect
          key={`hpath-${c}`}
          x={c * CELL_SIZE}
          y={7 * CELL_SIZE}
          width={CELL_SIZE}
          height={CELL_SIZE}
          fill="#FFFEFA"
          stroke={BOARD_GRID_STROKE}
          strokeWidth={0.75}
        />,
      );
    }
    for (let r = 0; r < 15; r++) {
      elems.push(
        <rect
          key={`vpath-${r}`}
          x={7 * CELL_SIZE}
          y={r * CELL_SIZE}
          width={CELL_SIZE}
          height={CELL_SIZE}
          fill="#FFFEFA"
          stroke={BOARD_GRID_STROKE}
          strokeWidth={0.75}
        />,
      );
    }

    // Colored home columns (five squares towards center)
    for (let r = 1; r <= 5; r++)
      elems.push(
        <rect
          key={`green-col-${r}`}
          x={7 * CELL_SIZE}
          y={r * CELL_SIZE}
          width={CELL_SIZE}
          height={CELL_SIZE}
          fill={colors[1]}
          stroke={BOARD_GRID_STROKE}
          strokeWidth={0.75}
        />,
      );
    for (let c = 9; c <= 13; c++)
      elems.push(
        <rect
          key={`yellow-row-${c}`}
          x={c * CELL_SIZE}
          y={7 * CELL_SIZE}
          width={CELL_SIZE}
          height={CELL_SIZE}
          fill={colors[3]}
          stroke={BOARD_GRID_STROKE}
          strokeWidth={0.75}
        />,
      );
    for (let r = 9; r <= 12; r++)
      elems.push(
        <rect
          key={`blue-col-${r}`}
          x={7 * CELL_SIZE}
          y={r * CELL_SIZE}
          width={CELL_SIZE}
          height={CELL_SIZE}
          fill={colors[2]}
          stroke={BOARD_GRID_STROKE}
          strokeWidth={0.75}
        />,
      );
    for (let c = 1; c <= 5; c++)
      elems.push(
        <rect
          key={`red-row-${c}`}
          x={c * CELL_SIZE}
          y={7 * CELL_SIZE}
          width={CELL_SIZE}
          height={CELL_SIZE}
          fill={colors[0]}
          stroke={BOARD_GRID_STROKE}
          strokeWidth={0.75}
        />,
      );

    // Center pinwheel across the full 3x3 center (cells 6..8,6..8)
    const cx = 7.5 * CELL_SIZE;
    const cy = 7.5 * CELL_SIZE;
    const xLeft = 6 * CELL_SIZE;
    const xRight = 9 * CELL_SIZE;
    const yTop = 6 * CELL_SIZE;
    const yBottom = 9 * CELL_SIZE;
    elems.push(
      <path
        key="center-tri-green"
        d={`M ${xLeft} ${yTop} L ${xRight} ${yTop} L ${cx} ${cy} Z`}
        fill={colors[1]}
        stroke={stroke}
        strokeWidth={1}
      />,
    );
    elems.push(
      <path
        key="center-tri-yellow"
        d={`M ${xRight} ${yTop} L ${xRight} ${yBottom} L ${cx} ${cy} Z`}
        fill={colors[3]}
        stroke={stroke}
        strokeWidth={1}
      />,
    );
    elems.push(
      <path
        key="center-tri-blue"
        d={`M ${xLeft} ${yBottom} L ${xRight} ${yBottom} L ${cx} ${cy} Z`}
        fill={colors[2]}
        stroke={stroke}
        strokeWidth={1}
      />,
    );
    elems.push(
      <path
        key="center-tri-red"
        d={`M ${xLeft} ${yTop} L ${xLeft} ${yBottom} L ${cx} ${cy} Z`}
        fill={colors[0]}
        stroke={stroke}
        strokeWidth={1}
      />,
    );

    // Highlight entry cells for all players
    elems.push(
      <rect
        key="highlight-1-6"
        x={1 * CELL_SIZE}
        y={6 * CELL_SIZE}
        width={CELL_SIZE}
        height={CELL_SIZE}
        fill={colors[0]}
        stroke={BOARD_GRID_STROKE}
        strokeWidth={0.75}
      />,
    );
    elems.push(
      <rect
        key="highlight-8-1"
        x={8 * CELL_SIZE}
        y={1 * CELL_SIZE}
        width={CELL_SIZE}
        height={CELL_SIZE}
        fill={colors[1]}
        stroke={BOARD_GRID_STROKE}
        strokeWidth={0.75}
      />,
    );
    elems.push(
      <rect
        key="highlight-6-13"
        x={6 * CELL_SIZE}
        y={13 * CELL_SIZE}
        width={CELL_SIZE}
        height={CELL_SIZE}
        fill={colors[2]}
        stroke={BOARD_GRID_STROKE}
        strokeWidth={0.75}
      />,
    );
    elems.push(
      <rect
        key="highlight-13-8"
        x={13 * CELL_SIZE}
        y={8 * CELL_SIZE}
        width={CELL_SIZE}
        height={CELL_SIZE}
        fill={colors[3]}
        stroke={BOARD_GRID_STROKE}
        strokeWidth={0.75}
      />,
    );

    // Ensure cell (7,13) is blue (home stretch entry)
    elems.push(
      <rect
        key="force-blue-7-12"
        x={7 * CELL_SIZE}
        y={13 * CELL_SIZE}
        width={CELL_SIZE}
        height={CELL_SIZE}
        fill={colors[2]}
        stroke={BOARD_GRID_STROKE}
        strokeWidth={0.75}
      />,
    );

    // Classic safe-zone stars on start/safe squares
    elems.push(renderSafeStar(2, 7, "#FFFEFA", "star-2-7"));
    elems.push(renderSafeStar(7, 2, "#FFFEFA", "star-7-2"));
    elems.push(renderSafeStar(13, 7, "#FFFEFA", "star-13-7"));
    elems.push(renderSafeStar(7, 13, "#FFFEFA", "star-7-13"));
    elems.push(renderSafeStar(1, 6, "rgba(255,255,255,0.85)", "star-1-6"));
    elems.push(renderSafeStar(8, 1, "rgba(255,255,255,0.85)", "star-8-1"));
    elems.push(renderSafeStar(6, 13, "rgba(255,255,255,0.85)", "star-6-13"));
    elems.push(renderSafeStar(13, 8, "rgba(255,255,255,0.85)", "star-13-8"));

    return <>{elems}</>;
  };

  // Calculate token size - round to whole pixels for precise rendering
  // Ensure minimum token size of 10px for very small screens to maintain visibility
  const tokenSize = Math.max(12, Math.round(CELL_SIZE * 0.88));
  const boardStyle = {
    "--ludo-board-size": `${BOARD_SIZE}px`,
    width: `${BOARD_SIZE}px`,
    height: `${BOARD_SIZE}px`,
  };

  // Calculate cell occupancy for tokens that are in play (to handle overlapping tokens)
  const cellOccupancy = useMemo(() => {
    const occupancy = new Map();
    renderPlayerOrder.forEach((playerIndex) => {
      const player = players[playerIndex];
      if (!player) return;
      player.pieces.forEach((piece, pieceIndex) => {
        const steps = getPieceSteps(piece);
        if (steps <= 0) return;
        const stepsToUse = steps >= maxSteps ? maxSteps : steps;
        const pos = getPositionOnPath(playerIndex, stepsToUse);
        const key = `${pos.x},${pos.y}`;
        if (!occupancy.has(key)) {
          occupancy.set(key, []);
        }
        occupancy.get(key).push({ playerIndex, pieceIndex });
      });
    });
    return occupancy;
  }, [players, renderPlayerOrder, maxSteps]);

  const tokenNode = (playerIndex, pieceIndex, piece) => {
    let x = 0;
    let y = 0;
    const pieceSteps = getPieceSteps(piece);
    if (pieceSteps <= 0) {
      const boardSeatIndex = getBoardSeatIndex(
        playerIndex,
        selectedPlayerCount,
      );
      const pos = HOME_POSITIONS[boardSeatIndex][pieceIndex];
      // Calculate cell center position precisely
      // Cell left edge is at pos.x * CELL_SIZE, right edge at (pos.x + 1) * CELL_SIZE
      // Center is exactly halfway: pos.x * CELL_SIZE + CELL_SIZE / 2 = (pos.x + 0.5) * CELL_SIZE
      const cellLeft = pos.x * CELL_SIZE;
      const cellTop = pos.y * CELL_SIZE;
      const cellCenterX = cellLeft + CELL_SIZE / 2;
      const cellCenterY = cellTop + CELL_SIZE / 2;
      // Position token so its center aligns with cell center
      // Token left = cell center - half token width
      x = cellCenterX - tokenSize / 2;
      y = cellCenterY - tokenSize / 2;
    } else {
      // Position piece on board - in play, home column, or finished
      const stepsToUse = pieceSteps >= maxSteps ? maxSteps : pieceSteps;
      const pos = getPositionOnPath(playerIndex, stepsToUse);
      // Calculate cell center position precisely
      const cellLeft = pos.x * CELL_SIZE;
      const cellTop = pos.y * CELL_SIZE;
      const cellCenterX = cellLeft + CELL_SIZE / 2;
      const cellCenterY = cellTop + CELL_SIZE / 2;
      // Position token so its center aligns with cell center
      x = cellCenterX - tokenSize / 2;
      y = cellCenterY - tokenSize / 2;
      // Apply overlap offset for multiple tokens in same cell
      const key = `${pos.x},${pos.y}`;
      const group = cellOccupancy.get(key) || [];
      const idxInGroup = group.findIndex(
        (g) => g.playerIndex === playerIndex && g.pieceIndex === pieceIndex,
      );
      const { dx, dy } = getTokenOffset(
        idxInGroup >= 0 ? idxInGroup : group.length,
        group.length,
      );
      x += dx;
      y += dy;
    }
    // Round to whole pixels to avoid sub-pixel rendering issues
    // Critical for mobile devices like iPhone 12 mini
    x = Math.round(x);
    y = Math.round(y);

    // Mobile device detection and adjustment
    const isMobile =
      winSize.width <= 500 ||
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent,
      );

    // Calculate touchable area padding for mobile
    const touchPadding = isMobile ? 12 : 4; // Larger padding for mobile

    const isCurrentPlayer =
      playerIndex ===
      (currentPlayerRef.current != null
        ? currentPlayerRef.current
        : currentPlayer);
    const isActivePlayer = playerIndex < selectedPlayerCount;
    // Always prefer ref value when available for current player (prevents button from being disabled due to state sync issues)
    // The ref is updated immediately, while state updates are async
    // For current player, always use ref if it has a value, otherwise use state
    // For other players, use state (which comes from broadcasts)
    const effectiveDiceValue = isCurrentPlayer
      ? diceValueRef.current > 0
        ? diceValueRef.current
        : diceValue
      : diceValue;

    // CRITICAL FIX: If this is my turn but diceValue is 0, there might be a sync issue
    // This can happen when a remote move completes and the turn comes back to us
    // In this case, we should wait for the next broadcast or check the state more carefully
    const isDiceValueMissing =
      isCurrentPlayer && diceValue === 0 && diceValueRef.current === 0;
    const canMove =
      isCurrentPlayer &&
      effectiveDiceValue > 0 &&
      !isMovingRef.current &&
      !isAutoMovingRef.current &&
      ((pieceSteps <= 0 && effectiveDiceValue === 6) ||
        (pieceSteps > 0 &&
          pieceSteps < maxSteps &&
          pieceSteps + effectiveDiceValue <= maxSteps));

    // Debug: Log if this is my turn but I can't move due to missing dice
    if (isDiceValueMissing && isActivePlayer) {
      // Don't block - this is just a debug flag
    }

    const avatar = players[playerIndex]?.avatar;
    return (
      <div
        key={`token-${playerIndex}-${pieceIndex}`}
        style={{
          position: "absolute",
          left: `${x - touchPadding}px`,
          top: `${y - touchPadding}px`,
          width: `${tokenSize + touchPadding * 2}px`,
          height: `${tokenSize + touchPadding * 2}px`,
          zIndex:
            effectiveDiceValue > 0 &&
            isCurrentPlayer &&
            !isMovingRef.current &&
            !isAutoMovingRef.current
              ? 100
              : 10,
          pointerEvents: "auto",
          transition: `left ${stepDurationMs}ms ease, top ${stepDurationMs}ms ease`,
          // Ensure pixel-perfect alignment on mobile devices
          willChange: "left, top",
        }}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            // Only call movePiece if conditions are met - check both ref and state
            const currentDiceValue =
              diceValueRef.current > 0 ? diceValueRef.current : diceValue;
            if (
              ((!onlineMode &&
                !playWithComputer &&
                !playersRef.current[currentPlayerRef.current]?.isBot) ||
                myPlayerIndexRef.current === currentPlayerRef.current) &&
              isActivePlayer &&
              isCurrentPlayer &&
              canMove &&
              currentDiceValue > 0 &&
              !isMovingRef.current &&
              !isAutoMovingRef.current
            ) {
              console.log("[TOKEN_CLICK] Moving piece", {
                playerIndex,
                pieceIndex,
                diceValue: currentDiceValue,
              });
              movePiece(pieceIndex);
            } else if (isCurrentPlayer && isDiceValueMissing) {
              console.warn(
                "[TOKEN_CLICK] Cannot move - missing diceValue despite being current player",
                { playerIndex, diceValueRef: diceValueRef.current, diceValue },
              );
            }
          }}
          disabled={
            !isActivePlayer ||
            !isCurrentPlayer ||
            effectiveDiceValue === 0 ||
            !canMove ||
            isMovingRef.current ||
            isAutoMovingRef.current ||
            isDiceValueMissing
          }
          style={{
            width: "100%",
            height: "100%",
            borderRadius: "50%",
            background: "transparent",
            border: "none",
            outline: "none",
            WebkitAppearance: "none",
            appearance: "none",
            boxShadow: "none",
            position: "relative",
            overflow: "visible",
            cursor:
              isActivePlayer &&
              isCurrentPlayer &&
              effectiveDiceValue > 0 &&
              !isMovingRef.current &&
              !isAutoMovingRef.current
                ? "pointer"
                : "default",
            transform: "translateZ(0)",
            backfaceVisibility: "hidden",
            WebkitTapHighlightColor: "transparent",
            pointerEvents: "auto",
          }}
          aria-label={`Piece ${pieceIndex + 1} of ${
            playerNames[getBoardSeatIndex(playerIndex, selectedPlayerCount)]
          }`}
        >
          {/* Actual token visual - centered in the larger touch area */}
          <div
            style={{
              position: "absolute",
              left: `${touchPadding}px`,
              top: `${touchPadding}px`,
              width: `${tokenSize}px`,
              height: `${tokenSize}px`,
              borderRadius: "50%",
              background: `radial-gradient(circle at 35% 30%, ${adjustHexColor(piece.color, 35)}, ${piece.color} 55%, ${adjustHexColor(piece.color, -25)})`,
              border: `2.5px solid ${adjustHexColor(piece.color, -40)}`,
              boxShadow: isActivePlayer
                ? `0 3px 0 ${adjustHexColor(piece.color, -45)}, 0 6px 12px rgba(0,0,0,0.35)`
                : "none",
              opacity: 1,
              overflow: "hidden",
              animation: canMove
                ? "ludo-token-pulse 900ms ease-in-out infinite, ludo-token-glow 1200ms ease-in-out infinite"
                : "none",
              transform: "translateZ(0)",
              backfaceVisibility: "hidden",
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                position: "absolute",
                left: 3,
                top: 3,
                right: 3,
                bottom: 3,
                border: `2px solid rgba(255,255,255,0.55)`,
                borderRadius: tokenSize / 2 - 3,
                pointerEvents: "none",
              }}
            />
            {avatar ? (
              <img
                src={avatar}
                alt={players[playerIndex]?.name || "avatar"}
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  transform: "translate(-50%, -50%)",
                  width: tokenSize * 0.68,
                  height: tokenSize * 0.68,
                  borderRadius: (tokenSize * 0.68) / 2,
                  objectFit: "cover",
                  pointerEvents: "none",
                  border: "1.5px solid rgba(255,255,255,0.7)",
                  imageRendering: "-webkit-optimize-contrast",
                  WebkitFontSmoothing: "antialiased",
                  backfaceVisibility: "hidden",
                  willChange: "auto",
                }}
              />
            ) : null}
          </div>
        </button>
      </div>
    );
  };

  // Screens
  if (gameEnded) {
    return (
      <div
        className="ludo-root"
        onPointerDown={resumeAudioFromGesture}
        onTouchStart={resumeAudioFromGesture}
      >
        <AnimatedBackground />
        <GameEndedScreen winners={winners} onResetGame={resetGame} />
      </div>
    );
  }

  if (showPlayerSelection) {
    return (
      <div
        className="ludo-root"
        onPointerDown={resumeAudioFromGesture}
        onTouchStart={resumeAudioFromGesture}
      >
        <AnimatedBackground />
        <PlayerSelectionModal
          show={showPlayerSelection}
          selectedPlayerCount={selectedPlayerCount}
          onlineMode={onlineMode}
          playWithComputer={playWithComputer}
          friendSearchQuery={friendSearchQuery}
          loadingSearch={loadingSearch}
          searchResults={searchResults}
          friendList={friendList}
          selectedFriends={selectedFriends}
          invitedStatusByFriendId={invitedStatusByFriendId}
          players={players}
          myProfile={myProfile}
          joinedGames={joinedGames}
          inviteCopied={inviteCopied}
          incomingInvite={incomingInvite}
          socketRef={socketRef}
          onPlayerCountChange={setSelectedPlayerCount}
          onOnlineModeToggle={() => setOnlineMode(!onlineMode)}
          onPlayWithComputerToggle={() => {
            setPlayWithComputer((prev) => {
              const next = !prev;
              if (next) setOnlineMode(false);
              return next;
            });
          }}
          onFriendSearchChange={onChangeFriendSearch}
          onFriendSelect={(f, isSelected) => {
            setSelectedFriends((prev) => {
              if (isSelected) return prev.filter((p) => p._id !== f._id);
              const next = [...prev, f];
              return next.slice(0, Math.max(0, selectedPlayerCount - 1));
            });
          }}
          onInviteFriend={inviteFriend}
          onAssignFriendOffline={assignFriendOffline}
          onGetNextOpenSlot={getNextOpenSlot}
          onGetInvitedNameForSlot={getInvitedNameForSlot}
          onOpenPlayerEditor={openPlayerEditor}
          onCopyInviteLink={copyInviteLink}
          onPlaySound={playSound}
          onCancel={() => setShowPlayerSelection(false)}
          onConfirmPlayerCount={confirmPlayerCount}
          onJoinGame={handleJoinGame}
          onDeleteLiveGame={handleDeleteLiveGame}
        />
        <PlayerEditorModal
          show={showPlayerEditor}
          editingPlayerIndex={editingPlayerIndex}
          player={
            editingPlayerIndex != null ? players[editingPlayerIndex] : null
          }
          editName={editName}
          editAvatarUrl={editAvatarUrl}
          inviteCopied={inviteCopied}
          avatarFileInputRef={avatarFileInputRef}
          onNameChange={setEditName}
          onAvatarUrlChange={setEditAvatarUrl}
          onPickAvatarFile={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              const reader = new FileReader();
              reader.onload = (event) => {
                setEditAvatarUrl(event.target.result);
              };
              reader.readAsDataURL(file);
            }
          }}
          onCopyInviteLink={copyInviteLink}
          onClose={() => {
            setShowPlayerEditor(false);
            setEditingPlayerIndex(null);
            setEditName("");
            setEditAvatarUrl("");
          }}
          // Search/assign props for picking a user inside editor
          friendSearchQuery={friendSearchQuery}
          loadingSearch={loadingSearch}
          searchResults={searchResults}
          friendList={friendList}
          onFriendSearchChange={onChangeFriendSearch}
          onAssignFriendToSlot={assignFriendToSlot}
          onPlaySound={playSound}
          canReplaceWithComputer={
            myPlayerIndex === 0 &&
            Number(editingPlayerIndex) > 0 &&
            !isRollingRef.current &&
            !isMovingRef.current &&
            !isAutoMovingRef.current
          }
          onReplaceWithComputer={() => replacePlayerWithBot(editingPlayerIndex)}
          onSave={() => {
            if (editingPlayerIndex != null) {
              setPlayers((prev) => {
                const copy = prev.map((p) => ({
                  ...p,
                  pieces: p.pieces.map((pc) => ({ ...pc })),
                }));
                if (copy[editingPlayerIndex]) {
                  if (editName.trim())
                    copy[editingPlayerIndex].name = editName.trim();
                  if (editAvatarUrl.trim())
                    copy[editingPlayerIndex].avatar = editAvatarUrl.trim();
                }
                return copy;
              });
              setShowPlayerEditor(false);
              setEditingPlayerIndex(null);
              setEditName("");
              setEditAvatarUrl("");
            }
          }}
        />
      </div>
    );
  }

  const effectiveCurrentPlayer =
    currentPlayerRef.current !== undefined
      ? currentPlayerRef.current
      : currentPlayer;
  const effectiveDiceForUi = diceValueRef.current || diceValue || 0;
  const canTapDice = canRollDice && effectiveDiceForUi === 0 && isMyTurn;
  const turnHint = !gameStarted
    ? "Waiting…"
    : !isMyTurn
      ? players[effectiveCurrentPlayer]?.isBot
        ? "Computer turn"
        : "Opponent turn"
      : canTapDice
        ? "Tap dice to roll"
        : effectiveDiceForUi > 0
          ? "Tap a glowing piece"
          : "Wait…";

  const getJoinedGameStatus = (game) => {
    if (!game?.gameId) return "Unknown";
    // Disconnected status (explicit flag from server or local adjustments)
    if (game?.lastPlayers?.isDisconnected) return "Disconnected";
    if (game?.lastPlayers?.gameEnded || game?.lastPlayers?.winner) {
      return "Finished";
    }
    return game?.lastPlayers?.gameStarted ? "In Progress" : "Waiting";
  };

  const hiddenBoardGameId = getHiddenBoardGameId();
  const liveJoinedGames = (
    Array.isArray(joinedGames)
      ? joinedGames.filter((game) => getJoinedGameStatus(game) !== "Finished")
      : []
  ).sort((a, b) => {
    const aHidden =
      hiddenBoardGameId && String(a?.gameId) === String(hiddenBoardGameId)
        ? 1
        : 0;
    const bHidden =
      hiddenBoardGameId && String(b?.gameId) === String(hiddenBoardGameId)
        ? 1
        : 0;
    if (aHidden !== bHidden) return bHidden - aHidden;

    const aTime = new Date(a?.createdAt || 0).getTime() || 0;
    const bTime = new Date(b?.createdAt || 0).getTime() || 0;
    return bTime - aTime;
  });

  return (
    <div
      className="ludo-root"
      style={{ "--ludo-board-size": `${BOARD_SIZE}px` }}
      onPointerDown={resumeAudioFromGesture}
      onTouchStart={resumeAudioFromGesture}
    >
      <AnimatedBackground />
      <GameHeader
        gameStarted={gameStarted}
        playWithComputer={playWithComputer}
        gameId={gameId}
        savedGameStateRef={savedGameStateRef}
        isDebug={isDebug}
        isSpecialUser={isSpecialUser}
        controlMode={controlMode}
        onStartGame={startGame}
        onResetGame={resetGame}
        onExitGame={exitGame}
        onTriggerDebugCelebration={triggerDebugCelebration}
        onToggleControlMode={() => setControlMode(!controlMode)}
        onPlaySound={playSound}
      />

      {controlMode && gameStarted && (
        <div className="ludo-debug-move">
          <div className="ludo-debug-move__title">
            Localhost move
            <span>
              Home column {maxSteps - (HOME_COLUMN_LENGTH - 1)}–{maxSteps}
            </span>
          </div>
          <label>
            Player
            <select
              value={debugPlayerIndex}
              onChange={(e) => setDebugPlayerIndex(Number(e.target.value))}
            >
              {Array.from({ length: selectedPlayerCount }).map((_, idx) => (
                <option key={idx} value={idx}>
                  {players[idx]?.name || `P${idx + 1}`} ({idx})
                </option>
              ))}
            </select>
          </label>
          <label>
            Piece
            <select
              value={debugPieceIndex}
              onChange={(e) => setDebugPieceIndex(Number(e.target.value))}
            >
              {[0, 1, 2, 3].map((idx) => {
                const steps = getPieceSteps(
                  players[debugPlayerIndex]?.pieces?.[idx],
                );
                return (
                  <option key={idx} value={idx}>
                    {idx + 1} (steps {steps})
                  </option>
                );
              })}
            </select>
          </label>
          <label>
            Steps
            <input
              type="number"
              min={0}
              max={maxSteps}
              placeholder={`${maxSteps - (HOME_COLUMN_LENGTH - 1)}`}
              value={debugSteps}
              onChange={(e) => setDebugSteps(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") debugTeleportPiece();
              }}
            />
          </label>
          <button
            type="button"
            className="ludo-btn ludo-btn--sm ludo-btn--primary"
            onClick={debugTeleportPiece}
          >
            Move
          </button>
        </div>
      )}

      {showDiceValueModal && (
        <div
          className="ludo-modal-backdrop"
          role="presentation"
          onClick={() => {
            setShowDiceValueModal(false);
            rollDice(null, true);
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
                setShowDiceValueModal(false);
                rollDice(null, true);
              }}
              aria-label="Close and roll a random value"
            >
              ×
            </button>
            <h2 id="ludo-dice-picker-title" className="ludo-modal__title">
              Choose Dice Value
            </h2>
            <p className="ludo-modal__subtitle">
              Select a value, or close to roll randomly
            </p>
            <div className="ludo-dice-picker__grid">
              {[1, 2, 3, 4, 5, 6].map((value) => (
                <button
                  key={value}
                  type="button"
                  className="ludo-dice-picker__button"
                  onClick={() => {
                    setShowDiceValueModal(false);
                    rollDice(value, true);
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
        pendingInvites={pendingInvites}
        onDismissInvite={(inv) => {
          if (socketRef.current) {
            try {
              socketRef.current.emit("ludo:invites:dismiss", {
                gameId: inv.gameId,
                by: inv.from,
              });
            } catch (_e) {}
          }
          setPendingInvites((prev) =>
            prev.filter(
              (i) =>
                !(
                  String(i.gameId) === String(inv.gameId) &&
                  String(i.from) === String(inv.from)
                ),
            ),
          );
        }}
        onAcceptInvite={(inv) => {
          setIncomingInviteRequest(inv);
          setTimeout(() => wrappedAcceptIncomingInvite(inv), 0);
        }}
      />

      {(gameStarted || (onlineMode && waitingForPlayers) || isReconnecting) &&
      (!onlineMode || gameId) ? (
        <div
          className="ludo-stage"
          style={{
            paddingLeft: responsivePadding,
            paddingRight: responsivePadding,
          }}
          onPointerDown={resumeAudioFromGesture}
          onTouchStart={resumeAudioFromGesture}
        >
          <div className="ludo-board-wrap" style={boardStyle}>
            <svg
              width={BOARD_SIZE}
              height={BOARD_SIZE}
              viewBox={`0 0 ${BOARD_SIZE} ${BOARD_SIZE}`}
              preserveAspectRatio="xMidYMid meet"
              style={{
                display: "block",
                width: `${BOARD_SIZE}px`,
                height: `${BOARD_SIZE}px`,
              }}
            >
              <rect
                x="0"
                y="0"
                width={BOARD_SIZE}
                height={BOARD_SIZE}
                fill="#FAFAF8"
                stroke={BOARD_OUTER_STROKE}
                strokeWidth="2"
                rx="12"
                ry="12"
              />
              {renderBoardGrid()}
              {renderStaticRects()}
            </svg>
            <div
              className="ludo-tokens"
              style={{ width: `${BOARD_SIZE}px`, height: `${BOARD_SIZE}px` }}
            >
              {renderPlayerOrder.map((playerIndex) =>
                players[playerIndex]?.pieces.map((piece, pieceIndex) =>
                  tokenNode(playerIndex, pieceIndex, piece),
                ),
              )}
            </div>

            {waitingForPlayers && (
              <div className="ludo-overlay">
                <div className="ludo-card">
                  <div className="ludo-card__title">
                    {myPlayerIndex === 0
                      ? "Waiting for players…"
                      : "Waiting for others…"}
                  </div>
                  <div className="ludo-card__body">
                    {myPlayerIndex === 0
                      ? "Invites sent. The match starts when everyone joins."
                      : "The match starts when all players have joined."}
                  </div>
                  <div className="ludo-muted" style={{ marginBottom: 8 }}>
                    {(() => {
                      const max = Math.max(2, Math.min(4, selectedPlayerCount));
                      const joined = Array.from({ length: max }).filter(
                        (_, i) => {
                          if (i === 0)
                            return Boolean(
                              players[0]?.profileId || myProfile?._id,
                            );
                          const seat = players[i];
                          if (seat?.isBot) return true;
                          const hasProfileId = Boolean(seat?.profileId);
                          if (!hasProfileId) return false;
                          const profileIdStr = seat?.profileId
                            ? String(seat.profileId)
                            : null;
                          const inviteStatus = profileIdStr
                            ? invitedStatusByFriendId[profileIdStr] ||
                              invitedStatusByFriendId[seat.profileId]
                            : null;
                          const wasInvitedToThisSlot =
                            profileIdStr &&
                            (invitedSlotByFriendId[profileIdStr] === i ||
                              invitedSlotByFriendId[seat.profileId] === i);
                          return wasInvitedToThisSlot
                            ? inviteStatus === "joined"
                            : inviteStatus !== "invited";
                        },
                      ).length;
                      return `Joined ${joined}/${max}`;
                    })()}
                  </div>
                  <div className="ludo-seat-list">
                    {Array.from({
                      length: Math.max(2, Math.min(4, selectedPlayerCount)),
                    }).map((_, i) => {
                      const seat = players[i];
                      const hasProfileId =
                        i === 0
                          ? Boolean(seat?.profileId || myProfile?._id)
                          : Boolean(seat?.profileId || seat?.isBot);
                      const profileIdStr = seat?.profileId
                        ? String(seat.profileId)
                        : null;
                      const inviteStatus =
                        i === 0
                          ? null
                          : profileIdStr
                            ? invitedStatusByFriendId[profileIdStr] ||
                              invitedStatusByFriendId[seat.profileId]
                            : null;
                      const wasInvitedToThisSlot =
                        profileIdStr &&
                        (invitedSlotByFriendId[profileIdStr] === i ||
                          invitedSlotByFriendId[seat.profileId] === i);
                      const joined =
                        Boolean(seat?.isBot) ||
                        (hasProfileId &&
                          (i === 0 ||
                            (wasInvitedToThisSlot
                              ? inviteStatus === "joined"
                              : inviteStatus !== "invited")));
                      const name =
                        seat?.name ||
                        (i === 0
                          ? myProfile?.fullName || "You"
                          : `Seat ${i + 1}`);
                      const invitedName = !joined
                        ? getInvitedNameForSlot(i)
                        : null;
                      return (
                        <div key={`seatstat-${i}`} className="ludo-seat">
                          <div className="ludo-seat__avatar">
                            {seat?.avatar ? (
                              <img src={seat.avatar} alt="" />
                            ) : (
                              <span>{PLAYER_LETTERS[i] || "P"}</span>
                            )}
                          </div>
                          <div className="ludo-seat__name">{name}</div>
                          <div
                            className={`ludo-seat__badge ${joined ? "ludo-seat__badge--joined" : "ludo-seat__badge--waiting"}`}
                          >
                            {joined
                              ? "Joined"
                              : invitedName
                                ? `Invited: ${invitedName}`
                                : "Waiting…"}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {myPlayerIndex === 0 && (
                    <button
                      type="button"
                      className="ludo-btn ludo-btn--primary ludo-btn--block ludo-waiting-replace"
                      onClick={replaceWaitingPlayersWithBots}
                      disabled={isReplacingWaitingPlayers}
                    >
                      {isReplacingWaitingPlayers
                        ? "Starting game…"
                        : "Replace with computer"}
                    </button>
                  )}
                </div>
              </div>
            )}

            {isReconnecting && (
              <div className="ludo-overlay">
                <div className="ludo-card">
                  <div className="ludo-card__title">Reconnecting…</div>
                  <div className="ludo-card__body">
                    Restoring your game session. Hang tight.
                  </div>
                  <div className="ludo-spinner" />
                  <button
                    type="button"
                    className="ludo-btn ludo-btn--primary"
                    onClick={startNewGame}
                  >
                    Start New Game
                  </button>
                </div>
              </div>
            )}

            {(() => {
              const isHost =
                myPlayerIndex === 0 ||
                (players &&
                  players[0]?.profileId &&
                  String(players[0].profileId) === String(myProfile?._id));
              const hasDisconnectedFriends =
                disconnectedPlayers.size > 0 &&
                gameStarted &&
                onlineMode &&
                isHost &&
                !isReconnecting;
              if (!hasDisconnectedFriends) return null;
              const disconnectedNames = Array.from(disconnectedPlayers)
                .map((pid) => {
                  const player = players.find(
                    (p) => p.profileId && String(p.profileId) === pid,
                  );
                  return player?.name || "Friend";
                })
                .filter(Boolean);
              return (
                <div className="ludo-overlay ludo-overlay--warn">
                  <div className="ludo-card ludo-card--danger">
                    <div className="ludo-card__title ludo-card__title--danger">
                      Friend Disconnected
                    </div>
                    <div className="ludo-card__body">
                      {disconnectedNames.length === 1
                        ? `${disconnectedNames[0]} left the match.`
                        : `${disconnectedNames.length} friends left the match.`}
                    </div>
                    {disconnectedNames.length > 0 && (
                      <div
                        className="ludo-seat"
                        style={{ marginBottom: 12, justifyContent: "center" }}
                      >
                        <div
                          className="ludo-seat__name"
                          style={{ textAlign: "center", whiteSpace: "normal" }}
                        >
                          {disconnectedNames.join(", ")}
                        </div>
                      </div>
                    )}
                    <div className="ludo-spinner ludo-spinner--danger" />
                    <div className="ludo-muted">Waiting for reconnection…</div>
                  </div>
                </div>
              );
            })()}

            <div
              className={`ludo-dice-hit ${(diceValueRef.current > 0 || diceValue > 0) && currentPlayer === myPlayerIndex ? "ludo-dice-hit--low" : ""} ${canTapDice ? "ludo-dice-hit--active" : ""}`}
            >
              <button
                type="button"
                className={`ludo-dice-btn ${canTapDice ? "ludo-dice-btn--ready" : ""}`}
                onClick={rollDice}
                disabled={
                  !canRollDice ||
                  ((onlineMode || playWithComputer) &&
                    effectiveCurrentPlayer !== myPlayerIndex)
                }
                aria-label={canTapDice ? "Roll dice" : "Dice"}
              >
                {(() => {
                  const isMobile =
                    winSize.width <= 768 ||
                    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
                      navigator.userAgent,
                    );
                  const diceSize = isMobile
                    ? Math.min(72, BOARD_SIZE * 0.18)
                    : Math.min(108, BOARD_SIZE * 0.2);
                  const avatarSize = isMobile
                    ? Math.min(56, BOARD_SIZE * 0.14)
                    : Math.min(80, BOARD_SIZE * 0.15);
                  const showDice =
                    isRollingRef.current || effectiveDiceForUi > 0;
                  return (
                    <div
                      style={{
                        width: diceSize,
                        height: diceSize,
                        perspective: "800px",
                      }}
                    >
                      <div
                        style={{
                          width: "100%",
                          height: "100%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {!showDice ? (
                          <img
                            src={
                              players[effectiveCurrentPlayer]?.avatar ||
                              siteConfig.logo
                            }
                            alt="current player"
                            className="ludo-center-avatar"
                            style={{
                              width: avatarSize,
                              height: avatarSize,
                              objectFit: players[effectiveCurrentPlayer]?.avatar
                                ? "cover"
                                : "contain",
                              border: `3px solid ${players[effectiveCurrentPlayer]?.color || "#2ec4b6"}`,
                            }}
                          />
                        ) : (
                          <Dice3D
                            value={
                              isRollingRef.current
                                ? rollingFace
                                : effectiveDiceForUi || 1
                            }
                            size={diceSize}
                            strokeColor={
                              players[effectiveCurrentPlayer]?.color ||
                              "#2ec4b6"
                            }
                            rolling={isRollingRef.current}
                            rotation={diceRotation}
                            durationMs={
                              onlineMode ? 700 : DICE_ROLL_ANIMATION_MS
                            }
                          />
                        )}
                      </div>
                    </div>
                  );
                })()}
              </button>
            </div>
          </div>

          <div className="ludo-dock" style={{ maxWidth: BOARD_SIZE }}>
            <div className="ludo-dock__label">Current Turn</div>
            <div
              className="ludo-turn"
              style={{
                background: players[effectiveCurrentPlayer]?.color || "#2ec4b6",
              }}
            >
              {players[effectiveCurrentPlayer]?.avatar ? (
                <img
                  src={players[effectiveCurrentPlayer].avatar}
                  alt=""
                  className="ludo-turn__avatar"
                />
              ) : (
                <div className="ludo-turn__avatar ludo-turn__avatar--empty" />
              )}
              <div className="ludo-turn__name">
                {players[effectiveCurrentPlayer]?.name || "Player"}
              </div>
              <div className="ludo-turn__hint">{turnHint}</div>
            </div>

            <div className="ludo-players-row">
              {renderPlayerOrder.map((idx) => (
                <button
                  key={`pbtn-${idx}`}
                  type="button"
                  className={`ludo-player-chip ${idx === effectiveCurrentPlayer ? "ludo-player-chip--active" : ""} ${
                    onlineMode && isSpeakingUid(players[idx]?.profileId)
                      ? "ludo-player-chip--speaking"
                      : ""
                  }`}
                  style={{ background: players[idx]?.color }}
                  onClick={() => openPlayerEditor(idx)}
                  title={players[idx]?.name || "Player"}
                  aria-label={`Edit ${players[idx]?.name || "player"}`}
                >
                  {players[idx]?.avatar ? (
                    <img src={players[idx].avatar} alt="" />
                  ) : (
                    <span className="ludo-player-chip__letter">
                      {PLAYER_LETTERS[idx] || "P"}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="ludo-toolbar">
              {onlineMode && (
                <button
                  type="button"
                  className={`ludo-tool ${micOn ? "ludo-tool--on" : "ludo-tool--muted"}`}
                  onClick={() => {
                    playSound("buttonClick");
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
                  <span className="ludo-tool__label">
                    {voiceConnecting
                      ? "Voice…"
                      : micOn
                        ? "Mic On"
                        : "Mic Off"}
                  </span>
                </button>
              )}
              <button
                type="button"
                className={`ludo-tool ${soundsEnabled ? "ludo-tool--on" : ""}`}
                onClick={() => {
                  setSoundsEnabled(!soundsEnabled);
                  if (!soundsEnabled) playSound("buttonClick");
                }}
                title={soundsEnabled ? "Disable sounds" : "Enable sounds"}
              >
                <span className="ludo-tool__icon" aria-hidden="true">
                  <LudoIcon name={soundsEnabled ? "volume" : "volumeOff"} />
                </span>
                <span className="ludo-tool__dot" />
                <span className="ludo-tool__label">
                  {soundsEnabled ? "Sound On" : "Sound Off"}
                </span>
              </button>
              {onlineMode && (
                <button
                  type="button"
                  className="ludo-tool"
                  onClick={() => {
                    playSound("buttonClick");
                    reloadGameState();
                  }}
                  title="Reload game state from server"
                >
                  <span className="ludo-tool__icon" aria-hidden="true">
                    <LudoIcon name="refresh" />
                  </span>
                  <span className="ludo-tool__label">Reload</span>
                </button>
              )}
              {onlineMode && gameStarted && !gameEnded && (
                <button
                  type="button"
                  className="ludo-tool"
                  onClick={() => {
                    playSound("buttonClick");
                    reconnectSocket();
                  }}
                  title="Reconnect socket and sync"
                >
                  <span className="ludo-tool__icon" aria-hidden="true">
                    <LudoIcon name="reconnect" />
                  </span>
                  <span className="ludo-tool__label">Reconnect</span>
                </button>
              )}
              {onlineMode && myPlayerIndex === 0 && (
                <button
                  type="button"
                  className="ludo-tool"
                  onClick={() => {
                    playSound("buttonClick");
                    reInvitePlayers();
                  }}
                  title="Re-invite players to fill empty slots"
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
      ) : (
        <div className="ludo-idle">
          <div
            className="ludo-header__mark"
            style={{ width: 56, height: 56, borderRadius: 16 }}
          >
            <div
              className="ludo-header__mark-grid"
              style={{ width: 28, height: 28, gap: 3 }}
            >
              <span />
              <span />
              <span />
              <span />
            </div>
          </div>
          <div className="ludo-idle__title">Ludo Classic</div>
          <div className="ludo-idle__copy">
            Start a local match or invite friends for an online game.
          </div>
          <div className="ludo-idle__actions">
            <button
              type="button"
              className="ludo-btn ludo-btn--primary"
              onClick={startGame}
            >
              Start Game
            </button>
            {liveJoinedGames.length > 0 && (
              <button
                type="button"
                className="ludo-btn ludo-btn--ghost"
                onClick={requestJoinedGames}
              >
                Refresh Live Games
              </button>
            )}
          </div>

          {liveJoinedGames.length > 0 && (
            <div className="ludo-live-games">
              <div className="ludo-live-games__header">
                <div>
                  <div className="ludo-live-games__title">Your Live Games</div>
                  <div className="ludo-live-games__copy">
                    Rejoin any waiting or in-progress online match.
                  </div>
                </div>
              </div>

              <div className="ludo-live-games__list">
                {liveJoinedGames.map((game) => {
                  const gameStatus = getJoinedGameStatus(game);
                  const isHiddenBoardGame =
                    hiddenBoardGameId &&
                    String(game?.gameId) === String(hiddenBoardGameId);

                  return (
                    <button
                      key={game.gameId}
                      type="button"
                      className="ludo-live-game"
                      onClick={() => handleJoinGame(game)}
                    >
                      <div className="ludo-live-game__badge-wrap">
                        <div className="ludo-live-game__icon">🎲</div>
                        <div
                          className={`ludo-seat__badge ${gameStatus === "In Progress" ? "ludo-seat__badge--joined" : "ludo-seat__badge--waiting"}`}
                        >
                          {gameStatus}
                        </div>
                      </div>
                      <div className="ludo-live-game__meta">
                        <div className="ludo-live-game__title-row">
                          <div className="ludo-live-game__name">
                            Game #{game.gameId?.slice(-6) || "Unknown"}
                          </div>
                          {isHiddenBoardGame && (
                            <div className="ludo-live-game__hint">
                              Last opened
                            </div>
                          )}
                        </div>
                        <div className="ludo-live-game__sub">
                          {game.playerCount} Players ·{" "}
                          {game.isOnline ? "Connected" : "Offline"}
                        </div>
                      </div>
                      <span className="ludo-live-game__cta">Resume</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <WinnerModal
        winner={winner}
        gameEnded={gameEnded}
        onContinueGame={continueGame}
        onEndGame={endGame}
      />

      <IncomingInviteModal
        inviteRequest={incomingInviteRequest}
        onAccept={wrappedAcceptIncomingInvite}
        onDecline={declineIncomingInvite}
      />

      <ConnectionStatus
        socket={socketRef.current}
        onlineMode={onlineMode}
        gameStarted={gameStarted}
        gameEnded={gameEnded}
      />

      <PlayerEditorModal
        show={showPlayerEditor}
        editingPlayerIndex={editingPlayerIndex}
        player={editingPlayerIndex != null ? players[editingPlayerIndex] : null}
        editName={editName}
        editAvatarUrl={editAvatarUrl}
        inviteCopied={inviteCopied}
        avatarFileInputRef={avatarFileInputRef}
        onNameChange={setEditName}
        onAvatarUrlChange={setEditAvatarUrl}
        onPickAvatarFile={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
              setEditAvatarUrl(event.target.result);
            };
            reader.readAsDataURL(file);
          }
        }}
        onCopyInviteLink={copyInviteLink}
        onClose={() => {
          setShowPlayerEditor(false);
          setEditingPlayerIndex(null);
          setEditName("");
          setEditAvatarUrl("");
        }}
        // Search/assign props for picking a user inside editor
        friendSearchQuery={friendSearchQuery}
        loadingSearch={loadingSearch}
        searchResults={searchResults}
        friendList={friendList}
        onFriendSearchChange={onChangeFriendSearch}
        onAssignFriendToSlot={assignFriendToSlot}
        onPlaySound={playSound}
        canReplaceWithComputer={
          myPlayerIndex === 0 &&
          Number(editingPlayerIndex) > 0 &&
          !isRollingRef.current &&
          !isMovingRef.current &&
          !isAutoMovingRef.current
        }
        onReplaceWithComputer={() => replacePlayerWithBot(editingPlayerIndex)}
        onSave={() => {
          if (editingPlayerIndex != null) {
            setPlayers((prev) => {
              const copy = prev.map((p) => ({
                ...p,
                pieces: p.pieces.map((pc) => ({ ...pc })),
              }));
              if (copy[editingPlayerIndex]) {
                if (editName.trim())
                  copy[editingPlayerIndex].name = editName.trim();
                if (editAvatarUrl.trim())
                  copy[editingPlayerIndex].avatar = editAvatarUrl.trim();
              }
              return copy;
            });
            setShowPlayerEditor(false);
            setEditingPlayerIndex(null);
            setEditName("");
            setEditAvatarUrl("");
          }
        }}
      />
    </div>
  );
};

export default LudoGame;
