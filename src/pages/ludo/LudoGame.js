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
import { unlockAudio } from "../../utils/audioUnlock";

// Import extracted modules
import {
  COLORS,
  PLAYER_NAMES,
  PLAYER_EMOJIS,
  PLAYER_LETTERS,
  PATHS,
  SAFE_CELLS,
  HOME_POSITIONS,
  STEP_DURATION_MS,
  DEFAULT_MAX_STEPS,
  BOARD_GRID_STROKE,
  BOARD_OUTER_STROKE,
} from "./constants/gameConstants";
import "./LudoGame.css";
import { adjustHexColor } from "./utils/colorUtils";
import {
  getPositionOnPath,
  isSafePosition,
  getMaxSteps,
  checkForCapture,
  checkForCaptureAfterMoveAway,
  getPlayablePieces,
  getNextActivePlayer,
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
import { DiceSVG } from "./components/DiceSVG";
import { AnimatedBackground } from "./components/AnimatedBackground";
import { WinnerConfetti } from "./components/WinnerConfetti";
import { ConnectionStatus } from "./components/ConnectionStatus";
import { GameBoard } from "./components/GameBoard";
import { GameEndedScreen } from "./components/GameEndedScreen";
import { WinnerModal } from "./components/WinnerModal";
import { IncomingInviteModal } from "./components/IncomingInviteModal";
import { PlayerEditorModal } from "./components/PlayerEditorModal";
import { GameHeader } from "./components/GameHeader";
import { PendingInvitesBanner } from "./components/PendingInvitesBanner";
import { PlayerSelectionModal } from "./components/PlayerSelectionModal";
import { useAudio } from "./hooks/useAudio";
import { showLudoInviteToast } from "../../utils/toastUtils";
import {
  shouldShowLudoInviteAlert,
  markInviteHandled,
  setActiveLudoGameId,
  clearActiveLudoGameId,
  clearHandledLudoInvites,
  resolveLudoInviteNotifications,
} from "../../utils/ludoInviteUtils";

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
  const latestSentPlayersSeqRef = useRef(0);
  const latestAppliedPlayersSeqRef = useRef(0);
  const selfHealPlayersGetRequestRef = useRef({ gameId: null, timestamp: 0 });
  const lastPlayersGetRequestRef = useRef({ gameId: null, timestamp: 0 });
  // ============================================================================
  // SECTION 5: ONLINE MULTIPLAYER STATE
  // ============================================================================

  // Online mode and connection
  const [onlineMode, setOnlineMode] = useState(false);
  const [playWithComputer, setPlayWithComputer] = useState(false);
  const [gameId, setGameId] = useState(null);
  const [myPlayerIndex, setMyPlayerIndex] = useState(0);
  const [waitingForPlayers, setWaitingForPlayers] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [showReconnectModal, setShowReconnectModal] = useState(false);
  const [disconnectedPlayers, setDisconnectedPlayers] = useState(new Set());

  // Friend selection and invites
  const [selectedFriends, setSelectedFriends] = useState([]);
  const [friendSearchQuery, setFriendSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [friendList, setFriendList] = useState([]);

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
  const myPlayerIndexRef = useRef(0);
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
  const botTurnTimerRef = useRef(null);

  // ============================================================================
  // SECTION 9: SOUND EFFECTS
  // ============================================================================

  const [soundsEnabled, setSoundsEnabled] = useState(true);
  const soundRefs = useRef({
    diceRoll: null,
    pieceMove: null,
    capture: null,
    win: null,
    turnChange: null,
    buttonClick: null,
    pieceOut: null,
  });

  // Initialize audio elements for sound effects
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Create audio elements for each sound effect
    // Using data URIs for simple beep sounds (can be replaced with actual sound files)
    const createBeepSound = (frequency, duration, type = "sine") => {
      try {
        const audioContext = new (
          window.AudioContext || window.webkitAudioContext
        )();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = frequency;
        oscillator.type = type;

        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(
          0.01,
          audioContext.currentTime + duration,
        );

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + duration);

        return audioContext;
      } catch (e) {
        // Failed to create beep sound
        return null;
      }
    };

    // Create HTML5 Audio elements for sound effects (using simple tones)
    // In production, replace these with actual sound file URLs
    const createAudioElement = (frequency, duration, volume = 0.5) => {
      const audio = new Audio();
      audio.volume = volume;
      audio.preload = "auto";
      // For now, we'll use Web Audio API directly in play functions
      // This is just a placeholder structure
      return audio;
    };

    // Initialize sound refs (will be created on-demand)
    soundRefs.current = {
      diceRoll: null,
      pieceMove: null,
      capture: null,
      win: null,
      turnChange: null,
      buttonClick: null,
      pieceOut: null,
    };

    // Unlock audio on first user interaction
    unlockAudio().catch(() => {});
  }, []);

  // Play sound effect helper
  const playSound = useCallback(
    async (soundType, options = {}) => {
      if (!soundsEnabled) return;

      try {
        await unlockAudio();

        const audioContext = new (
          window.AudioContext || window.webkitAudioContext
        )();
        if (audioContext.state === "suspended") {
          await audioContext.resume();
        }

        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        // Sound configurations
        const soundConfigs = {
          diceRoll: {
            frequency: 400,
            duration: 0.2,
            type: "sine",
            volume: 0.3,
          },
          pieceMove: {
            frequency: 300,
            duration: 0.15,
            type: "sine",
            volume: 0.25,
          },
          capture: {
            frequency: 200,
            duration: 0.3,
            type: "square",
            volume: 0.4,
          },
          win: { frequency: 600, duration: 0.5, type: "sine", volume: 0.5 },
          turnChange: {
            frequency: 350,
            duration: 0.2,
            type: "sine",
            volume: 0.3,
          },
          buttonClick: {
            frequency: 500,
            duration: 0.1,
            type: "sine",
            volume: 0.2,
          },
          pieceOut: {
            frequency: 450,
            duration: 0.25,
            type: "sine",
            volume: 0.35,
          },
        };

        const config = soundConfigs[soundType] || soundConfigs.buttonClick;
        const { frequency, duration, type, volume } = { ...config, ...options };

        oscillator.frequency.value = frequency;
        oscillator.type = type;

        gainNode.gain.setValueAtTime(volume, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(
          0.01,
          audioContext.currentTime + duration,
        );

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + duration);

        // Clean up after sound finishes
        setTimeout(
          () => {
            try {
              audioContext.close();
            } catch (e) {
              // Ignore cleanup errors
            }
          },
          duration * 1000 + 100,
        );
      } catch (error) {
        // Silently fail if audio can't be played (e.g., autoplay restrictions)
        console.debug("Sound playback failed:", error);
      }
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
        try {
          socket.emit("ludo:invites:get");
        } catch (_e) {}
        try {
          for (const [key, action] of pendingConnectActionsRef.current.entries()) {
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
        const timeSinceInviteAccept = Date.now() - inviteAcceptTimestampRef.current;
        const inviteJoinGracePeriodActive =
          isJoiningViaInviteRef.current ||
          (inviteAcceptTimestampRef.current > 0 && timeSinceInviteAccept < 15000);

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
          // Prevent multiple join requests
          const now = Date.now();
          const lastJoin = lastJoinRequestRef.current;
          const timeSinceLastJoin = now - lastJoin.timestamp;
          const MIN_JOIN_INTERVAL = 1000;

          if (
            lastJoin.gameId !== gidToRejoin ||
            timeSinceLastJoin >= MIN_JOIN_INTERVAL
          ) {
            lastJoinRequestRef.current = {
              gameId: gidToRejoin,
              timestamp: now,
            };
            try {
              socket.emit("ludo:join", { gameId: gidToRejoin });

              // Also prevent multiple players:get requests
              const lastRequest = lastPlayersGetRequestRef.current;
              const timeSinceLastRequest = now - lastRequest.timestamp;
              const MIN_REQUEST_INTERVAL = 2000;

              if (
                lastRequest.gameId !== gidToRejoin ||
                timeSinceLastRequest >= MIN_REQUEST_INTERVAL
              ) {
                lastPlayersGetRequestRef.current = {
                  gameId: gidToRejoin,
                  timestamp: now,
                };
                socket.emit("ludo:players:get", { gameId: gidToRejoin });
              }
            } catch (_e) {}
          }
          // Restore state if needed
          if (savedGameStateRef.current && !gameId) {
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
          !(inviteAcceptTimestampRef.current > 0 && Date.now() - inviteAcceptTimestampRef.current < 15000) &&
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
   * Control mode enables dice value prompts for testing
   */
  const [controlMode, setControlMode] = useState(false);

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
    if (!onlineMode && !playWithComputer) return true; // Offline hot-seat
    return currentPlayer === myPlayerIndex;
  }, [onlineMode, playWithComputer, currentPlayer, myPlayerIndex]);

  // ============================================================================
  // SECTION 11: GAME LOGIC HELPERS
  // ============================================================================

  /**
   * Get the next active player in turn order
   * Turn order: 4 players = Red -> Green -> Yellow -> Blue (0,1,3,2)
   *             2/3 players = [Red, Green] or [Red, Green, Blue]
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
      const path = PATHS[playerIndex];
      if (!path || steps <= 0 || steps > path.length) {
        return { x: 7, y: 7 };
      }
      return path[steps - 1];
    },
    [PATHS],
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

  const initializeGame = (playerCount = selectedPlayerCount) => {
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
      const f = selectedFriends[i - 1];
      names[i] = f?.fullName || playerNames[i];
      avatars[i] = f?.profilePic;
      covers[i] = f?.coverPic || f?.cover || f?.profileCover || undefined;
    }
    for (let i = 0; i < playerCount; i++) {
      const pieces = [];
      for (let j = 0; j < 4; j++) {
        pieces.push({
          id: j,
          color: colors[i],
          position: { x: 0, y: 0 },
          isHome: true,
          isInPlay: false,
          steps: 0,
        });
      }
      newPlayers.push({
        id: i,
        name: names[i] || playerNames[i],
        color: colors[i],
        pieces,
        isActive: i === 0,
        avatar: avatars[i],
        cover: covers[i],
        profileId: i === 0 ? myProfile?._id || "local" : undefined,
      });
    }
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
    const timer = setTimeout(() => {
      // Call acceptIncomingInvite via ref
      if (acceptIncomingInviteRef.current) {
        acceptIncomingInviteRef.current();
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [incomingInviteRequest, myProfile?._id]);

  // Load saved game state on mount and attempt to reconnect
  useEffect(() => {
    if (!myProfile?._id) return;

    // CRITICAL: Skip reconnection if we're joining via invite (new join, not reconnection)
    if (isJoiningViaInviteRef.current) {
      // Skipping reconnection - joining via invite
      return;
    }

    // CRITICAL: Skip reconnection if we recently accepted an invite (within last 10 seconds)
    // This prevents reconnection logic from running when we've just joined a game via invite
    const timeSinceInviteAccept = Date.now() - inviteAcceptTimestampRef.current;
    if (inviteAcceptTimestampRef.current > 0 && timeSinceInviteAccept < 10000) {
      // Skipping reconnection - recently accepted invite
      return;
    }

    // CRITICAL: Skip reconnection if we already have a gameId and we're not in reconnecting state
    // This prevents reconnection logic from running when we've already joined a game via invite
    if (gameId && !isReconnecting) {
      // Skipping reconnection - already have gameId and not reconnecting
      return;
    }

    const attemptReconnection = async () => {
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
        return;
      }

      if (savedState && savedState.gameId) {
        // Declare dbGameState outside try block so it's accessible throughout the function
        let dbGameState = null;

        // Try to load from database first (more reliable)
        try {
          dbGameState = await loadGameStateFromDB(savedState.gameId);

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

        // Set up reconnection state
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

        // Ensure socket is connected, then rejoin game
        ensureSocketConnected();
        const attemptRejoin = () => {
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
                lastPlayersGetRequestRef.current = { gameId, timestamp: now };
                try {
                  console.log(
                    `[${source}] Requesting latest game state after reconnection`,
                  );
                  socketRef.current.emit("ludo:join", { gameId });
                  socketRef.current.emit("ludo:players:get", { gameId });
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
                  lastPlayersGetRequestRef.current = { gameId, timestamp: now };
                  try {
                    console.log(
                      `[${source}] Requesting latest game state after connection`,
                    );
                    socketRef.current.emit("ludo:join", { gameId });
                    socketRef.current.emit("ludo:players:get", { gameId });
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
            lastPlayersGetRequestRef.current = { gameId, timestamp: now };
            try {
              console.log(
                `[${source}] Requesting latest game state (forced resync)`,
              );
              socket.emit("ludo:join", { gameId });
              socket.emit("ludo:players:get", { gameId });
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
    try {
      socketRef.current.emit("ludo:invites:get");
    } catch (_e) {}
  }, [myProfile?._id]);

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
          setTimeout(() => {
            if (acceptIncomingInviteRef.current) {
              acceptIncomingInviteRef.current();
            }
          }, 0);
          return;
        }

        // Else, inviter migration: auto-start as host on this device
        if (!gameStarted) {
          setShowPlayerSelection(false);
          setGameStarted(true);
          setCurrentPlayer(0);
          setDiceValueImmediate(0);
          setWinner(null);
          setCanRollDice(true);
          initializeGame(playerCountFromLink || selectedPlayerCount);
          ensureSocketConnected();
          // Wait for socket to be ready before emitting
          const waitAndEmit = () => {
            if (socketRef.current && socketRef.current.connected) {
              try {
                socketRef.current.emit("ludo:join", { gameId: gid });
                setMyPlayerIndex(0);
                emitPlayersState(gid);
              } catch (_e) {}
            } else if (socketRef.current) {
              // Wait for connection
              socketRef.current.once("connect", () => {
                try {
                  socketRef.current.emit("ludo:join", { gameId: gid });
                  setMyPlayerIndex(0);
                  emitPlayersState(gid);
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
      if (!p.profileId) return i;
    }
    return null;
  }, [players, selectedPlayerCount]);

  // Legacy function placeholder - will be defined after emitPlayersStateAfterSave
  let emitPlayersState;

  // Handle offline player actions (host only)
  const replacePlayerWithBot = useCallback(
    (playerIndex) => {
      if (myPlayerIndex !== 0 || !onlineMode || !gameId) return;
      try {
        if (socketRef.current) {
          socketRef.current.emit("ludo:replace:bot", { gameId, playerIndex });
        }
      } catch (_e) {}
    },
    [myPlayerIndex, onlineMode, gameId],
  );

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

  // Create initial game state in database (host only) - called when starting a new game
  const createInitialGameState = useCallback(
    async (gid, currentPlayers) => {
      console.log("[CREATE_INITIAL_GAME_STATE] Called", {
        gid,
        onlineMode,
        hasProfile: !!myProfile?._id,
        playersCount: currentPlayers?.length,
      });

      if (!onlineMode || !gid || !myProfile?._id) {
        console.log("[CREATE_INITIAL_GAME_STATE] Skipped - invalid params", {
          onlineMode,
          gid,
          hasProfile: !!myProfile?._id,
        });
        return false;
      }

      // Prevent concurrent saves to avoid version conflicts
      if (isSavingGameStateRef.current) {
        console.log(
          "[CREATE_INITIAL_GAME_STATE] Skipped - save already in progress",
        );
        return false; // Skip if a save is already in progress
      }

      try {
        isSavingGameStateRef.current = true; // Mark as saving
        console.log(
          "[CREATE_INITIAL_GAME_STATE] Starting to create game state...",
        );

        const minimalPlayers = currentPlayers.map((p) => ({
          id: p.id,
          name: p.name,
          color: p.color,
          avatar: p.avatar,
          cover: p.cover,
          profileId: p.profileId,
          isActive: p.isActive !== undefined ? p.isActive : true,
          isOffline: p.isOffline || false,
          pieces: Array.isArray(p.pieces)
            ? p.pieces.map((pc) => ({
                id: pc.id,
                steps: pc.steps,
                isHome: pc.isHome,
                isInPlay: pc.isInPlay,
                color: pc.color,
              }))
            : [],
        }));

        const gameState = {
          gameId: gid,
          players: minimalPlayers,
          currentPlayer: 0,
          diceValue: 0,
          gameStarted: false,
          gameEnded: false,
          winners: [],
          selectedPlayerCount: selectedPlayerCountRef.current,
        };

        console.log("[CREATE_INITIAL_GAME_STATE] Saving game state to DB...", {
          gameId: gid,
          playersCount: minimalPlayers.length,
        });
        const result = await saveGameStateToDB(gameState);
        const success = result !== null;
        console.log("[CREATE_INITIAL_GAME_STATE] Save result:", {
          success,
          result,
        });
        return success; // Return true if successfully created
      } catch (error) {
        console.error(
          "[CREATE_INITIAL_GAME_STATE] Failed to create initial game state:",
          error,
        );
        return false;
      } finally {
        // Always reset the flag, even if save fails
        isSavingGameStateRef.current = false;
      }
    },
    [onlineMode, myProfile?._id],
  );

  // Save game state to database (host only) - returns promise
  const saveGameStateToDatabase = useCallback(async () => {
    if (myPlayerIndex !== 0 || !onlineMode || !gameId || !myProfile?._id) {
      // Skipped: not host or invalid state
      return false;
    }

    // CRITICAL: Don't save if we're currently restoring from server (prevents save/restore loops)
    if (isRestoringFromServerRef.current) {
      // Skipped: currently restoring from server
      return false; // Skip save during restoration
    }

    // Prevent concurrent saves to avoid version conflicts
    if (isSavingGameStateRef.current) {
      // Skipped: save already in progress
      return false; // Skip if a save is already in progress
    }

    try {
      isSavingGameStateRef.current = true; // Mark as saving
      // Starting database save

      const minimalPlayers = playersRef.current.map((p) => ({
        id: p.id,
        name: p.name,
        color: p.color,
        avatar: p.avatar,
        cover: p.cover,
        profileId: p.profileId,
        isActive: p.isActive !== undefined ? p.isActive : true,
        isOffline: p.isOffline || false,
        pieces: Array.isArray(p.pieces)
          ? p.pieces.map((pc) => ({
              id: pc.id,
              steps: pc.steps,
              isHome: pc.isHome,
              isInPlay: pc.isInPlay,
              color: pc.color,
            }))
          : [],
      }));

      // Filter winners to remove invalid profileIds (like "local")
      const validWinners = (winnersRef.current || []).map((winner) => {
        // Only include profileId if it's a valid ObjectId (not "local" or undefined)
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

      const gameState = {
        gameId,
        players: minimalPlayers,
        currentPlayer: currentPlayerRef.current,
        diceValue: diceValueRef.current || 0,
        gameStarted: gameStartedRef.current || false,
        gameEnded: gameEndedRef.current || false,
        winners: validWinners,
        selectedPlayerCount: selectedPlayerCountRef.current,
      };

      const result = await saveGameStateToDB(gameState);
      // Database save completed
      return result !== null;
    } catch (error) {
      // Log error but don't interrupt gameplay
      // Failed to save game state to database
      return false;
    } finally {
      // Always reset the flag, even if save fails
      isSavingGameStateRef.current = false;
    }
  }, [myPlayerIndex, onlineMode, gameId, myProfile?._id]);

  // Emit player state ONLY after database save completes (host only)
  // This prevents re-rendering loops and ensures state consistency
  const emitPlayersStateAfterSave = useCallback(
    async (force = false) => {
      if (!onlineMode || !gameId || !socketRef.current) return;

      // Prevent concurrent saves
      if (isSavingGameStateRef.current && !force) return;

      try {
        isSavingGameStateRef.current = true;

        // Create minimal state payload for faster transmission
        const minimalPlayers = playersRef.current.map((p) => ({
          id: p.id,
          name: p.name,
          color: p.color,
          avatar: p.avatar,
          cover: p.cover,
          profileId: p.profileId,
          isActive: p.isActive !== undefined ? p.isActive : true,
          pieces: Array.isArray(p.pieces)
            ? p.pieces.map((pc) => ({
                id: pc.id,
                steps: pc.steps,
                isHome: pc.isHome,
                isInPlay: pc.isInPlay,
              }))
            : [],
        }));

        const nextPlayersSeq = latestSentPlayersSeqRef.current + 1;
        latestSentPlayersSeqRef.current = nextPlayersSeq;

        const payload = {
          gameId,
          players: minimalPlayers,
          selectedPlayerCount: selectedPlayerCountRef.current,
          currentPlayer: currentPlayerRef.current,
          diceValue: diceValueRef.current,
          gameStarted: gameStartedRef.current,
          timestamp: Date.now(),
          playersSeq: nextPlayersSeq,
        };

        // Emitting optimized state

        // Emit immediately without delay for better real-time sync
        socketRef.current.emit("ludo:players", payload);

        // Save to database in background (non-blocking)
        saveGameStateToDB(payload).catch((err) => {
          // Failed to save to DB
        });
      } catch (_e) {
        // Error in emit state
      } finally {
        isSavingGameStateRef.current = false;
      }
    },
    [onlineMode, gameId, saveGameStateToDB],
  );

  // Legacy function - now redirects to emitPlayersStateAfterSave
  // Only used for initial game setup before game starts
  emitPlayersState = useCallback(
    (gid, forceEmit = true) => {
      if (!gid) return;
      // For initial setup, emit immediately without waiting for save
      emitPlayersStateAfterSave(forceEmit);
    },
    [emitPlayersStateAfterSave],
  );

  const inviteFriend = useCallback(
    (friend) => {
      if (!friend || !friend._id) return;

      const friendIdStr = String(friend._id);

      // CRITICAL: Check if friend has already joined before sending invite
      const currentStatus = invitedStatusByFriendIdRef.current[friendIdStr];
      if (currentStatus === "joined") {
        console.log(
          `[INVITE_FRIEND] Skipping invite to ${friendIdStr} - already joined`,
        );
        return;
      }

      // Also check if the friend is already in the game
      const currentPlayers = playersRef.current || players;
      const friendAlreadyInGame = currentPlayers.some(
        (p) => p?.profileId && String(p.profileId) === friendIdStr,
      );
      if (friendAlreadyInGame) {
        console.log(
          `[INVITE_FRIEND] Skipping invite to ${friendIdStr} - already in game`,
        );
        // Update status to 'joined' if not already set
        if (currentStatus !== "joined") {
          setInvitedStatusByFriendId((prev) => ({
            ...prev,
            [friendIdStr]: "joined",
          }));
        }
        return;
      }

      // Must be online mode to invite
      if (!onlineMode) setOnlineMode(true);
      ensureSocketConnected();
      const gid = gameId || generateGameId();
      if (!gameId) setGameId(gid);
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
        return updated;
      });
      setInvitedSlotByFriendId((prev) => ({ ...prev, [friendIdStr]: slot }));

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
                emitPlayersStateAfterSave(false);
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
  ]);

  const onChangeFriendSearch = (text) => {
    console.log("Search input changed:", text);
    setFriendSearchQuery(text);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (!text || text.trim().length < 2) {
      console.log("Clearing search results - text too short");
      setSearchResults([]);
      return;
    }
    console.log("Setting up search timeout for:", text.trim());
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        setLoadingSearch(true);
        console.log("Starting search for:", text.trim());
        // Use the search API with query parameter
        const res = await api.get(
          `/search?input=${encodeURIComponent(text.trim())}`,
          { credentials: "include" },
        );
        console.log("res fr", res);
        // if (!res.success) {
        //     setSearchResults([]);
        //     return;
        // }
        const data = res.data;
        console.log("Search results data:", data);

        // Show all users (no filtering)
        const allUsers = data.users || [];
        console.log("All users to show:", allUsers);
        setSearchResults(allUsers);
      } catch (_e) {
        console.error("Friend search error:", _e);
        setSearchResults([]);
      } finally {
        setLoadingSearch(false);
      }
    }, 300);
  };

  const generateGameId = () =>
    `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

  const createInviteToken = (slotIndex) => {
    const gid = gameId || generateGameId();
    if (!gameId) setGameId(gid);
    const payload = {
      type: "ludo_invite",
      by: myProfile?._id || "anon",
      name: myProfile?.fullName || "Player",
      avatar: myProfile?.profilePic,
      cover: myProfile?.coverPic,
      ts: Date.now(),
      gameId: gid,
      playerCount: selectedPlayerCount,
      slotIndex:
        typeof slotIndex === "number" ? slotIndex : undefined,
    };
    return btoa(JSON.stringify(payload));
  };

  const sendInviteNotificationToFriend = async (friend, gid, slotIndex) => {
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
            const pool = [...selectedFriends, ...friendList, ...searchResults];
            const f = pool.find((u) => u && String(u._id) === String(fid));
            return f?.fullName || null;
          }
        }
      } catch (_e) {}
      return null;
    },
    [invitedSlotByFriendId, selectedFriends, friendList, searchResults],
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

                // CRITICAL: Check if friend has already joined before sending invite
                const currentStatus =
                  invitedStatusByFriendIdRef.current[friendIdStr];
                if (currentStatus === "joined") {
                  console.log(
                    `[RE_INVITE] Skipping invite to ${friendIdStr} - already joined`,
                  );
                  return;
                }

                // Also check if the friend is already in the game
                const friendAlreadyInGame = players.some(
                  (p) => p?.profileId && String(p.profileId) === friendIdStr,
                );
                if (friendAlreadyInGame) {
                  console.log(
                    `[RE_INVITE] Skipping invite to ${friendIdStr} - already in game`,
                  );
                  if (currentStatus !== "joined") {
                    setInvitedStatusByFriendId((prev) => ({
                      ...prev,
                      [friendIdStr]: "joined",
                    }));
                  }
                  return;
                }

                try {
                  socketRef.current.emit("ludo:invite", {
                    to: friend._id,
                    by: myProfile?._id,
                    name: myProfile?.fullName || "Player",
                    avatar: myProfile?.profilePic,
                    cover: myProfile?.coverPic,
                    gameId,
                    slotIndex: index,
                    playerCount: selectedPlayerCount || 4,
                    ts: Date.now(),
                  });

                  // Fire web notification to friend
                  try {
                    sendInviteNotificationToFriend(friend, gameId, index);
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

            // CRITICAL: Check if player has already joined (status might be 'joined' even if marked offline)
            const currentStatus =
              invitedStatusByFriendIdRef.current[playerIdStr];
            if (currentStatus === "joined" || !player.isOffline) {
              console.log(
                `[RE_INVITE] Skipping re-invite to ${playerIdStr} - already joined or online`,
              );
              return;
            }

            console.log(
              "[RE_INVITE] Sending re-invite to offline player",
              player.profileId,
              "for slot",
              index,
            );
            try {
              socketRef.current.emit("ludo:invite", {
                to: player.profileId,
                by: myProfile?._id,
                name: myProfile?.fullName || "Player",
                avatar: myProfile?.profilePic,
                cover: myProfile?.coverPic,
                gameId,
                slotIndex: index,
                playerCount: selectedPlayerCount || 4,
                ts: Date.now(),
              });

              // Fire web notification to offline player
              const offlineFriend = {
                _id: player.profileId,
                fullName: player.name,
                profilePic: player.avatar,
              };
              try {
                sendInviteNotificationToFriend(offlineFriend, gameId, index);
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
        if (piece.isHome && diceVal === 6) {
          playable.push(pieceIndex);
        } else if (piece.isInPlay && piece.steps + diceVal <= maxSteps) {
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
        setTimeout(() => {
          emitPlayersStateAfterSave(false);
        }, 300);
      }

      setTimeout(() => {
        if (
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
      emitPlayersStateAfterSave,
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

  /**
   * Roll the dice for the current player
   * Handles both offline and online modes with proper synchronization
   */
  const rollDice = () => {
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
      playWithComputerRef.current &&
      !onlineMode &&
      playersRef.current[currentPlayerRef.current]?.isBot;

    if (!botActingRef.current && isBotTurn) {
      return;
    }

    if (!botActingRef.current) {
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
    // Only the current player can roll dice in online or vs-computer mode
    if (onlineMode || playWithComputerRef.current) {
      const currentMyPlayerIndex = myPlayerIndexRef.current;
      const currentPlayerIndex = currentPlayerRef.current;
      const cpuTurn =
        isBotPlayerIndex(currentPlayerIndex) || botActingRef.current;
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
      botActingRef.current ||
      (playWithComputerRef.current &&
        !onlineMode &&
        playersRef.current[currentPlayerRef.current]?.isBot);
    if (!isCpuRoll && timeSinceLastRoll < 1000) return;

    // CRITICAL: Double-check conditions right before setting flags (prevent race conditions)
    // Re-check canRollDice and diceValue one more time after potential state updates
    if (!botActingRef.current && (!canRollDice || isRollingRef.current)) return;
    if (diceValueRef.current > 0 || diceValue > 0) return;
    if (
      (onlineMode || playWithComputerRef.current) &&
      !botActingRef.current &&
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
    // Clear any stale timers that are older than 2 seconds (moves should complete faster)
    const now = Date.now();
    const activeTimers = moveTimersRef.current.filter((timer) => {
      // If timer is a number (timestamp), check if it's recent
      // If timer is an object with timestamp, check if it's recent
      if (typeof timer === "number") {
        return now - timer < 2000; // Timer is active if less than 2 seconds old
      }
      if (timer && typeof timer === "object" && timer.timestamp) {
        return now - timer.timestamp < 2000;
      }
      // If we can't determine, assume it's active (better safe than sorry)
      return true;
    });

    // Update moveTimersRef to only keep active timers
    if (activeTimers.length !== moveTimersRef.current.length) {
      console.log("[ROLL_DICE] Clearing stale move timers", {
        oldCount: moveTimersRef.current.length,
        newCount: activeTimers.length,
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

    // Set rolling flags immediately to prevent duplicate rolls
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
      // Broadcast game start state if in online mode
      if (onlineMode && socketRef.current && gameId) {
        try {
          const minimalPlayers = playersRef.current.map((p) => ({
            id: p.id,
            name: p.name,
            color: p.color,
            avatar: p.avatar,
            cover: p.cover,
            profileId: p.profileId,
            isActive: p.isActive !== undefined ? p.isActive : true,
            pieces: Array.isArray(p.pieces)
              ? p.pieces.map((pc) => ({
                  id: pc.id,
                  steps: pc.steps,
                  isHome: pc.isHome,
                  isInPlay: pc.isInPlay,
                }))
              : [],
          }));
          const nextPlayersSeq = latestSentPlayersSeqRef.current + 1;
          latestSentPlayersSeqRef.current = nextPlayersSeq;
          socketRef.current.emit("ludo:players", {
            gameId,
            players: minimalPlayers,
            selectedPlayerCount: selectedPlayerCountRef.current,
            currentPlayer: currentPlayerRef.current,
            diceValue: 0,
            gameStarted: true,
            gameEnded: false,
            winners: [],
            playersSeq: nextPlayersSeq,
          });
        } catch (_e) {}
      }
    }

    // Optional debug value entry (localhost only) or control mode
    let debugChosenValue = null;
    if ((isDebug && controlMode) || controlMode) {
      try {
        const input = window.prompt("Enter dice value (1-6). Cancel = random");
        const n = Number(input);
        if (Number.isFinite(n) && n >= 1 && n <= 6) {
          debugChosenValue = Math.floor(n);
        }
      } catch (_e) {}
    }

    // Play dice roll sound
    playSound("diceRoll");

    // Generate dice value immediately (no animation)
    const value =
      debugChosenValue && debugChosenValue >= 1 && debugChosenValue <= 6
        ? debugChosenValue
        : Math.floor(Math.random() * 6) + 1;

    // CRITICAL: Track consecutive 6s and limit them
    const currentSixCount = consecutiveSixesRef.current[currentPlayer] || 0;
    if (value === 6) {
      // Increment consecutive 6s count
      const newSixCount = currentSixCount + 1;
      setConsecutiveSixes((prev) => ({
        ...prev,
        [currentPlayer]: newSixCount,
      }));
      consecutiveSixesRef.current[currentPlayer] = newSixCount;

      // Limit consecutive 6s to 3 (maximum allowed)
      if (newSixCount >= 3) {
        console.log(
          "[ROLL_DICE] Player has reached 3 consecutive 6s, advancing turn",
          {
            player: currentPlayer,
            consecutiveSixes: newSixCount,
          },
        );

        // Reset consecutive 6s count for this player
        setConsecutiveSixes((prev) => ({ ...prev, [currentPlayer]: 0 }));
        consecutiveSixesRef.current[currentPlayer] = 0;

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
              reachedSixLimit: true, // Indicate that 6s limit was reached
            });
          } catch (_e) {}
        }

        // Advance turn immediately after rolling the 3rd 6
        setTimeout(() => {
          const nextPlayer = getNextActivePlayer(currentPlayerRef.current);
          playSound("turnChange");
          setCurrentPlayerImmediate(nextPlayer);
          setDiceValueImmediate(0);
          lastLocalDiceRollTimeRef.current = 0;

          // Allow next player to roll
          setTimeout(() => {
            if (
              currentPlayerRef.current === nextPlayer &&
              diceValueRef.current === 0
            ) {
              setCanRollDice(true);
            }
          }, 150);

          // Save and emit game state when turn changes (host only)
          if (myPlayerIndexRef.current === 0 && onlineMode && gameId) {
            setTimeout(() => {
              emitPlayersStateAfterSave(false);
            }, 100);
          }
        }, 1000); // Give player time to see they rolled 6, then advance turn

        return; // Exit early - don't proceed with normal move logic (don't reset 6s again)
      }
    } else {
      // Reset consecutive 6s count if non-6 is rolled
      if (currentSixCount > 0) {
        console.log(
          "[ROLL_DICE] Non-6 rolled, resetting consecutive 6s for player",
          currentPlayer,
        );
        setConsecutiveSixes((prev) => ({ ...prev, [currentPlayer]: 0 }));
        consecutiveSixesRef.current[currentPlayer] = 0;
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

    // Broadcast dice roll to other players immediately
    if (onlineMode && socketRef.current && gameId) {
      try {
        console.log("[ROLL] Broadcasting dice roll", {
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
      // No moves available - advance turn using the authoritative ref value,
      // not the render-time state variable, to avoid stale online turn handoff.
      // CRITICAL: Reset this player's consecutive 6s before advancing turn
      // This ensures the next player starts fresh when the turn passes
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

      setTimeout(() => {
        advanceTurnForPlayer(currentPlayerRef.current);
      }, 400);
    } else if (playablePieces.length === 1) {
      const isCpuTurnNow =
        playWithComputerRef.current &&
        !onlineMode &&
        playersRef.current[currentPlayerRef.current]?.isBot;

      // CPU moves via the bot-turn effect after dice state updates
      if (isCpuTurnNow) {
        return;
      }

      // Only one playable piece - move it automatically
      isAutoMovingRef.current = true;
      setCanRollDice(false);
      // CRITICAL: Don't reset 6s here - they stay active until turn ends
      // Reset happens either when non-6 is rolled, or turn advances without move
      setTimeout(() => {
        if (
          diceValueRef.current === value &&
          currentPlayerRef.current === currentPlayer
        ) {
          movePiece(playablePieces[0]);
        } else {
          isAutoMovingRef.current = false;
          setCanRollDice(true);
        }
      }, 200);
    } else {
      // Multiple pieces are playable - allow user to choose
      // CRITICAL: Don't reset 6s here - they stay active during piece selection
      // Reset happens when non-6 is rolled, or when move completes and turn ends
      if (!gameStarted) {
        setGameStarted(true);
        gameStartedRef.current = true;
      }
    }
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
            copy[playerIndex].pieces[pieceIndex].steps = fromSteps + s;
            copy[playerIndex].pieces[pieceIndex].isHome = false;
            copy[playerIndex].pieces[pieceIndex].isInPlay = true;
            // Update ref immediately to keep in sync
            playersRef.current = copy;
            return copy;
          });
        }
      }, s * stepDurationMs);
      timers.push(timer);
    }

    // Final update to exact position (only if not already there)
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
          copy[playerIndex].pieces[pieceIndex].steps = toSteps;
          copy[playerIndex].pieces[pieceIndex].isHome = false;
          copy[playerIndex].pieces[pieceIndex].isInPlay = true;
          // Update ref immediately to keep in sync
          playersRef.current = copy;
          return copy;
        });
      }
      // Keep move in recent moves for 2 seconds to prevent overwrites
      setTimeout(() => {
        recentMovesRef.current.delete(pieceKey);
      }, 2000);
      onComplete && onComplete();
    }, stepsToGo * stepDurationMs);
    timers.push(finalTimer);

    moveTimersRef.current.push(...timers);
  };

  const movePiece = (pieceId) => {
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

    if (effectiveDiceValue === 0) {
      return;
    }

    // Double-check: if dice value ref is 0, don't allow move (prevents race conditions)
    if (diceValueRef.current === 0 && diceValue === 0) {
      return;
    }

    // In online or vs-computer mode, only allow moves if it's the current player's turn
    // CRITICAL: Use refs to get the most current values (avoid stale closures)
    if (onlineMode || playWithComputerRef.current) {
      const currentMyPlayerIndex = myPlayerIndexRef.current;
      const currentPlayerIndex = currentPlayerRef.current;
      const cpuTurn =
        isBotPlayerIndex(currentPlayerIndex) || botActingRef.current;
      if (!cpuTurn && currentMyPlayerIndex !== currentPlayerIndex) {
        return; // Not the current player's turn
      }
    }

    // CRITICAL: Capture the rolled dice value BEFORE resetting it
    // This ensures turn advancement uses the actual rolled value, not the current dice state
    const rolledNow = effectiveDiceValue;
    const rolledDiceValue = rolledNow; // Explicitly name it for clarity

    const currentPlayersForMove =
      playersRef.current && Array.isArray(playersRef.current)
        ? playersRef.current
        : players;
    const currentPlayerData = currentPlayersForMove[currentPlayer];
    if (!currentPlayerData) {
      isMovingRef.current = false;
      isAutoMovingRef.current = false;
      return;
    }
    const piece = currentPlayerData.pieces[pieceId];
    if (!piece) {
      return;
    }

    if (piece.isHome && effectiveDiceValue !== 6) {
      return;
    }
    if (piece.isInPlay && piece.steps + effectiveDiceValue > maxSteps) {
      return;
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
      if (piece.isHome && effectiveDiceValue === 6) {
        // Play piece out sound
        playSound("pieceOut");

        const movingPlayerIndex = currentPlayer;
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
        movedPlayers[movingPlayerIndex].pieces[pieceId] = {
          ...movedPlayers[movingPlayerIndex].pieces[pieceId],
          ...piece,
          isHome: false,
          isInPlay: true,
          steps: 1,
        };
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
            finalPlayers[playerIndex].pieces[pieceIndex] = {
              ...finalPlayers[playerIndex].pieces[pieceIndex],
              isHome: true,
              isInPlay: false,
              steps: 0,
            };
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
        moveTimersRef.current = moveTimersRef.current.filter(t => t !== moveTimerId);
        // Reset dice value
        setDiceValueImmediate(0);
        lastLocalDiceRollTimeRef.current = 0;

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
        const isTurnAuthorityLocal = !onlineMode || myPlayerIndex === 0;

        if (isTurnAuthorityLocal) {
          if (keepTurnOnMoveOut) {
            // CRITICAL: Add a small delay before allowing next roll to ensure all state is synchronized
            // This prevents the player from rolling twice in the same turn due to race conditions
            setTimeout(() => {
              // Double-check that it's still the same player's turn and dice is 0
              if (
                currentPlayerRef.current === currentPlayer &&
                diceValueRef.current === 0
              ) {
                setCanRollDice(true); // keep turn on 6 (traditional Ludo rule)
              }
            }, 200); // Small delay to ensure state propagation
          } else {
            // No capture, advance turn
            setTimeout(() => {
              const nextPlayer = getNextActivePlayer(currentPlayerRef.current);
              playSound("turnChange");
              setCurrentPlayerImmediate(nextPlayer);

              setTimeout(() => {
                if (
                  currentPlayerRef.current === nextPlayer &&
                  diceValueRef.current === 0
                ) {
                  setCanRollDice(true);
                }
              }, 200);
            }, 200);
          }
        } else {
          // Prevent a double-roll window: keep dice disabled locally until
          // the host's authoritative snapshot confirms the actual next turn.
          if (!keepTurnOnMoveOut) {
            setCanRollDice(false);
          }
          console.log(
            "[MOVE_PIECE] Remote move out of home - waiting for host's authoritative turn update",
            { movingPlayerIndex: currentPlayer, keepTurnOnMoveOut },
          );
        }

        // Save and emit state after move and captures are processed (moves out of home)
        if (onlineMode && myPlayerIndex === 0 && gameId) {
          // Small delay to ensure all capture state updates have been applied
          setTimeout(() => {
            emitPlayersStateAfterSave(false);
          }, 200);
        }
      } else if (piece.isInPlay) {
        // Play piece move sound
        playSound("pieceMove");

        const movingPlayerIndex = currentPlayer;
        const oldSteps = piece.steps;
        const oldPosition = getPositionOnPath(movingPlayerIndex, oldSteps);
        const newSteps = piece.steps + effectiveDiceValue;
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
          movedPlayers[movingPlayerIndex].pieces[pieceId] = {
            ...movedPlayers[movingPlayerIndex].pieces[pieceId],
            steps: newSteps,
            isHome: false,
            isInPlay: newSteps > 0 && newSteps < maxSteps,
          };
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
              finalPlayers[playerIndex].pieces[pieceIndex] = {
                ...finalPlayers[playerIndex].pieces[pieceIndex],
                steps: 0,
                isHome: true,
                isInPlay: false,
              };
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
                rolled: lastDiceValueRef.current, // Include the dice value that was rolled
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
                  const finishedCount = updatedPlayers[
                    movingPlayerIndex
                  ].pieces.filter((p) => p.steps === maxSteps).length;
                  if (finishedCount === 4) {
                    const winnerPlayer = updatedPlayers[movingPlayerIndex];
                    const newWinners = [...winners, winnerPlayer];
                    setWinners(newWinners);
                    winnersRef.current = newWinners;
                    setWinner(winnerPlayer);
                    setShowWinnerModal(true);
                    // Play win sound
                    playSound("win");
                    const remainingPlayers = updatedPlayers.filter(
                      (_, idx) => idx < selectedPlayerCount,
                    );
                    if (newWinners.length >= remainingPlayers.length - 1) {
                      setGameEnded(true);
                      gameEndedRef.current = true;
                    }
                    // Save game state to database after winner (host only)
                    if (myPlayerIndex === 0 && onlineMode && gameId) {
                      setTimeout(() => {
                        saveGameStateToDatabase();
                      }, 500);
                    }
                  }
                  playersRef.current = updatedPlayers; // Update ref
                  return updatedPlayers;
                });
              }

              isMovingRef.current = false; // Reset moving flag
              isAutoMovingRef.current = false; // Clear auto-moving flag

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

              // CRITICAL: Always reset dice value first (regardless of keepTurn)
              setDiceValueImmediate(0);
              lastLocalDiceRollTimeRef.current = 0;

              // Save and emit game state after move completes (host only)
              if (myPlayerIndex === 0 && onlineMode && gameId) {
                setTimeout(() => {
                  emitPlayersStateAfterSave(false);
                }, 500); // Small delay to ensure all state updates are complete
              }

              // CRITICAL: Only the host (or an offline/vs-computer game) is
              // allowed to locally mutate currentPlayer in online mode. A
              // non-host remote mover must not also decide/advance the turn
              // here - the host already makes this exact decision (using the
              // same rolled/capture rule) inside onMove when it receives this
              // move. Letting both sides mutate currentPlayer independently
              // was the root cause of the host sometimes never regaining its
              // turn and of remote tokens visibly "blinking" from the two
              // conflicting decisions overwriting each other.
              const isTurnAuthorityLocal = !onlineMode || myPlayerIndex === 0;

              if (keepTurn) {
                // Player keeps turn (rolled 6 or captured) - don't advance
                console.log("[MOVE_PIECE] Player keeps turn", {
                  movingPlayerIndex,
                  currentPlayer: currentPlayerRef.current,
                  reason: isSix ? "rolled 6" : "captured token",
                });

                // Don't manually set canRollDice - let the useEffect handle it after state settles
                // The useEffect will detect that it's still the same player's turn and dice is 0

                // Save and emit state after move completes (host only)
                if (myPlayerIndex === 0 && onlineMode && gameId) {
                  setTimeout(() => {
                    emitPlayersStateAfterSave(false);
                  }, 200);
                }
              } else if (isTurnAuthorityLocal) {
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
                if (myPlayerIndex === 0 && onlineMode && gameId) {
                  setTimeout(() => {
                    console.log(
                      "[MOVE_PIECE] Host emitting state after turn change",
                      {
                        currentPlayer: currentPlayerRef.current,
                        nextPlayer,
                        gameId,
                      },
                    );
                    emitPlayersStateAfterSave(false);
                  }, 300); // Small delay to ensure state is synchronized
                }

                // Don't manually set canRollDice - let the useEffect handle it after state settles
                // The useEffect will detect the turn change and update canRollDice accordingly
              } else {
                // Prevent a double-roll window: keep dice disabled locally
                // until the host's authoritative snapshot confirms the
                // actual next turn (currentPlayer is intentionally left
                // unchanged here - the host owns that decision).
                setCanRollDice(false);
                console.log(
                  "[MOVE_PIECE] Remote move consumed - waiting for host's authoritative turn update",
                  { movingPlayerIndex, rolledValue, hasCapture },
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

    globalMove();
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

        // Apply remote move AND any captures together, so every client's
        // board matches exactly what the mover computed. Previously captures
        // were never included in this payload, so a capture made by a remote
        // player was silently dropped here - the captured piece stayed on the
        // board for the host/other clients while it was already sent home on
        // the mover's own screen, causing token positions to diverge.
        setPlayers((prev) => {
          const updated = prev.map((p) => ({
            ...p,
            pieces: p.pieces.map((pc) => ({ ...pc })),
          }));
          const player = updated[payload.playerIndex];
          if (player && player.pieces[payload.pieceIndex]) {
            const piece = player.pieces[payload.pieceIndex];
            piece.steps = payload.toSteps;
            piece.isHome = payload.toSteps === 0;
            piece.isInPlay =
              payload.toSteps > 0 && payload.toSteps < maxStepsRef.current;
          }
          incomingCaptures.forEach(({ playerIndex, pieceIndex }) => {
            if (updated[playerIndex]?.pieces?.[pieceIndex]) {
              updated[playerIndex].pieces[pieceIndex] = {
                ...updated[playerIndex].pieces[pieceIndex],
                steps: 0,
                isHome: true,
                isInPlay: false,
              };
            }
          });
          playersRef.current = updated;
          return updated;
        });

        if (incomingCaptures.length > 0) {
          playSound("capture");
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

          if (!keepTurn) {
            const nextPlayer = getNextActivePlayer(payload.playerIndex);
            currentPlayerRef.current = nextPlayer;
            lastTurnAdvanceTimeRef.current = Date.now();
            setCurrentPlayer(nextPlayer);
            setDiceValueImmediate(0);
            lastLocalDiceRollTimeRef.current = 0;

            setTimeout(() => {
              console.log(
                "[ON_MOVE][HOST] Emitting authoritative turn change",
                {
                  fromPlayer: payload.playerIndex,
                  toPlayer: nextPlayer,
                  rolledValue,
                  hasCapture,
                  gameId,
                },
              );
              emitPlayersStateAfterSave(false);
            }, 120);
          } else {
            setTimeout(() => {
              console.log(
                "[ON_MOVE][HOST] Emitting authoritative keep-turn state",
                {
                  playerIndex: payload.playerIndex,
                  rolledValue,
                  hasCapture,
                  gameId,
                },
              );
              emitPlayersStateAfterSave(false);
            }, 120);
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
      const currentSixCount =
        consecutiveSixesRef.current[rollingPlayer] || 0;
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
              emitPlayersStateAfterSave(false);
            }, 500);
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
        if (piece.isHome && value === 6) return true;
        if (piece.isInPlay && piece.steps + value <= maxStepsRef.current)
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
            emitPlayersStateAfterSave(false);
          }, 250);
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
      }
    };

    const onAccepted = (payload) => {
      try {
        if (!payload || payload.gameId !== gameId) return;
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

          // CRITICAL: Ignore accept events that arrive too soon after sending invite (within 1 second)
          // This prevents processing events that are incorrectly fired immediately after invite
          const inviteTimestamp =
            inviteTimestampsRef.current[friendIdStr] ||
            inviteTimestampsRef.current[friendId];
          if (inviteTimestamp && Date.now() - inviteTimestamp < 1000) {
            console.log(
              `[onAccepted] Ignoring accept event - received too soon after invite (${Date.now() - inviteTimestamp}ms ago, need at least 1000ms)`,
            );
            return;
          }

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
              emitPlayersStateAfterSave(false);
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
              (_, idx) => Boolean(currentPlayers[idx + 1]?.profileId),
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
                emitPlayersStateAfterSave(false);
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
        const payloadSeq = Number(payload.playersSeq || 0);
        if (
          payloadSeq > 0 &&
          latestAppliedPlayersSeqRef.current > 0 &&
          payloadSeq < latestAppliedPlayersSeqRef.current
        ) {
          console.log("[ON_PLAYERS] Ignoring stale players snapshot", {
            payloadSeq,
            latestApplied: latestAppliedPlayersSeqRef.current,
            gameId: payload.gameId,
          });
          return;
        }
        if (payloadSeq > 0) {
          latestAppliedPlayersSeqRef.current = payloadSeq;
        }
        // Accept if gameId matches current or saved game state (for reconnection)
        const currentGid = gameId || savedGameStateRef.current?.gameId;
        if (payload.gameId !== currentGid) return;
        // If we're reconnecting and this matches saved state, restore gameId
        if (!gameId && savedGameStateRef.current?.gameId === payload.gameId) {
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
          isJoiningViaInviteRef.current && payload.gameId === gameId;

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
          if (turnChanged || snapshotClearsDice) {
            isRollingRef.current = false;
            if (snapshotClearsDice) {
              lastLocalDiceRollTimeRef.current = 0;
              setDiceValueImmediate(0);
            }
            if (turnChanged) {
              isAutoMovingRef.current = false;
            }
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
            if (!isUserInPlayers && myPlayerIndex !== 0) {
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
              if (!hasIncomingId && prevId) {
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

          // Only apply protection if we have an active local game state (not during initial reconnection)
          const shouldApplyProtection =
            !isReconnectingState && hasLocalGameState;

          // Simplified protection logic - focus on preventing backward movement only
          const now = Date.now();
          
          // CRITICAL: Clean stale move timers first (timers older than 3 seconds are stale)
          moveTimersRef.current = moveTimersRef.current.filter(
            (t) => typeof t === "number" && now - t < 3000
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

          // CRITICAL: Set flag to prevent saves during state restoration (prevents save/restore loops)
          isRestoringFromServerRef.current = true;
          setPlayers(protectedNext);
          // Update ref immediately
          playersRef.current = protectedNext;

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
                  setInvitedStatusByFriendId((prev) => ({
                    ...prev,
                    [playerIdStr]: "joined",
                  }));
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
                  setInvitedStatusByFriendId((prev) => ({
                    ...prev,
                    [playerIdStr]: "joined",
                  }));
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

          // Clear the flag after a delay to allow normal saves again
          setTimeout(() => {
            isRestoringFromServerRef.current = false;
          }, 1000); // 1 second delay to ensure all state updates are complete

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
          const localDiceValue = diceValueRef.current || 0;
          const currentTurnFromRef = currentPlayerRef.current === myPlayerIndex;
          const currentTurnFromPayload =
            typeof payload.currentPlayer === "number" &&
            payload.currentPlayer === myPlayerIndex;
          const isMyTurnFromPayload =
            currentTurnFromRef || currentTurnFromPayload;

          // CRITICAL: If a move just completed, never restore dice value from broadcast
          // A move completion means dice should be 0 (either for next player or for same player to roll again)
          const moveJustCompleted =
            isMovingRef.current === false && moveTimersRef.current.length === 0;
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
              // If local dice is 0, only accept 0 from broadcast (don't restore old dice values)
              if (localDiceValue === 0 && payload.diceValue > 0) {
                // Ignore - don't restore old dice values after move completes
              } else {
                setDiceValueImmediate(payload.diceValue);
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
            // Simplified logic: trust server validation and accept turn changes
            // Server now validates turns, so we don't need complex protection mechanisms
            if (payloadCurrentPlayer !== localCurrentPlayer) {
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
      } catch (_e) {}
    };

    const onGameRemoved = (payload) => {
      try {
        if (!payload || payload.gameId !== gameId) return;
        setJoinedGames((prev) =>
          prev.filter((g) => String(g.gameId) !== String(payload.gameId)),
        );
        if (String(gameIdRef.current) === String(payload.gameId)) {
          setGameId(null);
          gameIdRef.current = null;
          setOnlineMode(false);
          setGameStarted(false);
          gameStartedRef.current = false;
          setWaitingForPlayers(false);
          setCanRollDice(false);
          setIsReconnecting(false);
          setShowReconnectModal(false);
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
      const shouldEnable = allSeatsFilled;

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
        (!onlineMode && !playWithComputer) ||
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
      const shouldEnable =
        isMyTurn && hasNoDiceValue && isNotRolling && isNotMoving;

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
      const MIN_REQUEST_INTERVAL = 3000;

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

  // CPU opponent turns in local vs-computer mode
  useEffect(() => {
    if (
      !playWithComputer ||
      onlineMode ||
      !gameStarted ||
      gameEnded ||
      waitingForPlayers
    )
      return;

    const cp = currentPlayerRef.current;
    const player = playersRef.current[cp];
    if (!player?.isBot) return;

    if (botTurnTimerRef.current) {
      clearTimeout(botTurnTimerRef.current);
    }

    botTurnTimerRef.current = setTimeout(() => {
      botTurnTimerRef.current = null;

      if (
        isMovingRef.current ||
        isAutoMovingRef.current ||
        isRollingRef.current
      ) {
        return;
      }

      const playerIndex = currentPlayerRef.current;
      if (!playersRef.current[playerIndex]?.isBot) return;

      botActingRef.current = true;

      try {
        if (diceValueRef.current === 0) {
          rollDice();
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
      } finally {
        setTimeout(() => {
          botActingRef.current = false;
        }, 2000);
      }
    }, 900);

    return () => {
      if (botTurnTimerRef.current) {
        clearTimeout(botTurnTimerRef.current);
        botTurnTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    playWithComputer,
    onlineMode,
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
            currentGameId &&
            String(payload.gameId) === String(currentGameId)
          ) {
            return;
          }
          if (
            Array.isArray(joinedGamesList) &&
            joinedGamesList.some(
              (g) => String(g.gameId) === String(payload.gameId),
            )
          ) {
            return;
          }
          if (!shouldShowLudoInviteAlert(payload.gameId, payload.by)) {
            return;
          }

          const inviteKey = `${payload.gameId}:${payload.by}`;
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
            ts: now,
          };

          setPendingInvites((prev) => {
            const exists = prev.find(
              (i) =>
                String(i.gameId) === String(payload.gameId) &&
                String(i.from) === String(payload.by),
            );
            if (exists) return prev;
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
              setTimeout(() => acceptIncomingInvite(), 0);
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
            ts: x.ts || Date.now(),
          }));

          const currentGameId = gameIdRef.current;
          const joinedGamesList = joinedGamesRef.current;
          const filteredNormalized = normalized.filter((inv) => {
            if (currentGameId && String(inv.gameId) === String(currentGameId)) {
              return false;
            }
            if (
              Array.isArray(joinedGamesList) &&
              joinedGamesList.some(
                (g) => String(g.gameId) === String(inv.gameId),
              )
            ) {
              return false;
            }
            return shouldShowLudoInviteAlert(inv.gameId, inv.from);
          });

          setPendingInvites((prev) => {
            const invitesToAdd = filteredNormalized.filter(
              (inv) =>
                !prev.find(
                  (p) =>
                    String(p.gameId) === String(inv.gameId) &&
                    String(p.from) === String(inv.from),
                ),
            );
            return [...prev, ...invitesToAdd].slice(0, 20);
          });

          const now = Date.now();
          const firstNewInvite = filteredNormalized.find((inv) => {
            const inviteKey = `${inv.gameId}:${inv.from}`;
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
                setTimeout(() => acceptIncomingInvite(), 0);
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
          setJoinedGames(games);
          console.log("[LUDO] Received joined games:", games.length);
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

  const startGame = () => {
    setShowPlayerSelection(true);
  };

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
      setGameId(game.gameId);

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
        const res = await api.delete(`/ludo/delete?gameId=${encodeURIComponent(gid)}`);
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
    [myProfile?._id, requestJoinedGames, clearHiddenBoardGameId, setDiceValueImmediate],
  );

  const startNewGame = () => {
    // Clear reconnecting state
    setIsReconnecting(false);
    setShowReconnectModal(false);
    clearHiddenBoardGameId();
    // Clear saved game state
    clearGameState();
    // Clear exited games flag to allow new games
    try {
      localStorage.removeItem("ludo_exited_games");
    } catch (_e) {
      // Ignore errors
    }
    // Reset game state
    setGameId(null);
    setOnlineMode(false);
    setGameStarted(false);
    gameStartedRef.current = false;
    setCurrentPlayer(0);
    setDiceValueImmediate(0);
    setWinner(null);
    setWinners([]);
    setGameEnded(false);
    setWaitingForPlayers(false);
    // Open player selection
    setShowPlayerSelection(true);
  };

  // Exit game - online matches become resumable, offline matches clear state
  const exitGame = () => {
    const isResumableOnlineGame = Boolean(
      onlineMode && gameId && myProfile?._id,
    );

    const confirmed = window.confirm(
      isResumableOnlineGame
        ? "Leave the board? Your live online game will stay available on this page so you can rejoin it any time."
        : "Are you sure you want to exit the game? All progress will be lost.",
    );
    if (!confirmed) return;

    if (isResumableOnlineGame) {
      try {
        setHiddenBoardGameId(gameId);
      } catch (_e) {}

      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
        searchTimeoutRef.current = null;
      }

      moveTimersRef.current.forEach((t) => {
        if (typeof t === "number") {
          clearTimeout(t);
        } else if (t && typeof t === "object" && t.timestamp) {
          if (t.timeoutId) clearTimeout(t.timeoutId);
        }
      });
      moveTimersRef.current = [];

      setGameId(null);
      gameIdRef.current = null;
      setOnlineMode(false);
      setGameStarted(false);
      gameStartedRef.current = false;
      setGameEnded(false);
      gameEndedRef.current = false;
      setCurrentPlayer(0);
      currentPlayerRef.current = 0;
      setDiceValueImmediate(0);
      lastDiceValueRef.current = 0;
      setCanRollDice(false);
      setWinner(null);
      setWinners([]);
      winnersRef.current = [];
      setShowWinnerModal(false);
      setShowPlayerSelection(false);
      setWaitingForPlayers(false);
      setIsReconnecting(false);
      setShowReconnectModal(false);
      setMyPlayerIndex(0);
      myPlayerIndexRef.current = 0;
      setDisconnectedPlayers(new Set());
      setSelectedFriends([]);
      setInvitedStatusByFriendId({});
      invitedStatusByFriendIdRef.current = {};
      setInvitedSlotByFriendId({});
      invitedSlotByFriendIdRef.current = {};
      setFriendSearchQuery("");
      setSearchResults([]);
      setLoadingSearch(false);
      currentPlayerUpdatedFromServerRef.current = false;
      isRollingRef.current = false;
      isMovingRef.current = false;
      isAutoMovingRef.current = false;
      lastTurnAdvanceTimeRef.current = 0;
      lastLocalDiceRollTimeRef.current = 0;
      lastRollTimeRef.current = 0;
      recentMovesRef.current.clear();
      requestJoinedGames();
      return;
    }

    console.log("[EXIT_GAME] Starting complete cleanup of all game state");

    // Notify other players if in online mode before cleaning up
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

    // Clear all localStorage game state
    try {
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
    setOnlineMode(false);
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
    isSavingGameStateRef.current = false;
    isRollingRef.current = false;
    isMovingRef.current = false;
    isAutoMovingRef.current = false;
    autoStartTriggeredRef.current = false;
    socketCreatingRef.current = false;
    inviteHandlersAttachedRef.current = false;
    isJoiningViaInviteRef.current = false;
    inviteAcceptTimestampRef.current = 0;
    lastJoinRequestRef.current = { gameId: null, timestamp: 0 };
    lastPlayersGetRequestRef.current = { gameId: null, timestamp: 0 };

    // Reset players ref
    playersRef.current = [];

    // Reinitialize game to default state
    initializeGame(4); // Reset to default 4 players

    console.log("[EXIT_GAME] Complete cleanup finished - all state reset");
  };

  const confirmPlayerCount = () => {
    clearHiddenBoardGameId();
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
        const baseName =
          i === 0 ? myProfile?.fullName || "You" : playerNames[i];
        const baseAvatar = i === 0 ? myProfile?.profilePic : undefined;
        const baseCover =
          i === 0
            ? myProfile?.coverPic || myProfile?.cover || undefined
            : undefined;
        const pieces =
          Array.isArray(prevSeat?.pieces) && prevSeat.pieces.length === 4
            ? prevSeat.pieces.map((pc, idx) => ({
                id: idx,
                color: colors[i],
                position: { x: 0, y: 0 },
                isHome: pc.isHome,
                isInPlay: pc.isInPlay,
                steps: pc.steps,
              }))
            : Array.from({ length: 4 }).map((_, j) => ({
                id: j,
                color: colors[i],
                position: { x: 0, y: 0 },
                isHome: true,
                isInPlay: false,
                steps: 0,
              }));
        next.push({
          id: i,
          name: prevSeat?.name || baseName,
          color: colors[i],
          pieces,
          isActive: i === 0,
          avatar: prevSeat?.avatar || baseAvatar,
          cover: prevSeat?.cover || baseCover,
          profileId:
            i === 0
              ? myProfile?._id || "local"
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
      const gid = gameId || generateGameId();
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
                          setInvitedStatusByFriendId((prev) => ({
                            ...prev,
                            [friendIdStr]: "invited",
                          }));
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
            // Broadcast players snapshot so remotes sync
            emitPlayersState(gid);
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
              // Broadcast players snapshot so remotes sync
              emitPlayersState(gid);
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
    const nextPlayer = getNextActivePlayer(currentPlayer);
    setCurrentPlayer(nextPlayer);
    setDiceValueImmediate(0);
    setCanRollDice(true);
  };

  const endGame = () => {
    clearHiddenBoardGameId();
    setShowWinnerModal(false);
    setGameEnded(true);
    gameEndedRef.current = true;
    setWinner(null);
    // Clear disconnected players tracking
    setDisconnectedPlayers(new Set());

    // Save final game state to database before clearing (host only)
    if (myPlayerIndex === 0 && onlineMode && gameId) {
      setTimeout(() => {
        saveGameStateToDatabase().then(() => {
          // Clear saved game state after saving final state
          clearGameState();
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
    setCanRollDice(true);
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
          emitPlayersStateAfterSave(true); // Force emit for reset
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
  const acceptIncomingInvite = async () => {
    const payload = incomingInviteRequest;
    if (!payload) return;
    try {
      // CRITICAL: Clear reconnecting state immediately when accepting invite
      // This prevents the reconnection modal from showing when joining a new game
      setIsReconnecting(false);
      setShowReconnectModal(false);
      hasProcessedReconnectionStateRef.current = true; // Mark as processed to prevent reconnection logic
      isJoiningViaInviteRef.current = true; // Mark that we're joining via invite
      inviteAcceptTimestampRef.current = Date.now(); // Track when we accepted invite to prevent reconnection
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
              console.error("[ACCEPT_INVITE] Error sending accept event:", _e);
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
    } catch (error) {
      console.error("[ACCEPT_INVITE] Error accepting invite:", error);
      // Reset state on error
      setOnlineMode(false);
      setGameId(null);
      setIncomingInviteRequest(null);
    } finally {
      setIncomingInviteRequest(null);
    }
  };

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
      const coverUrl =
        players[idx]?.cover ||
        players[idx]?.coverPic ||
        players[idx]?.profileCover ||
        undefined;
      if (coverUrl && idx < selectedPlayerCount) {
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
        // Only track pieces that are in play or finished (not at home)
        if (piece.isInPlay || (piece.steps > 0 && piece.steps === maxSteps)) {
          const stepsToUse = piece.steps === maxSteps ? maxSteps : piece.steps;
          const pos = getPositionOnPath(playerIndex, stepsToUse);
          const key = `${pos.x},${pos.y}`;
          if (!occupancy.has(key)) {
            occupancy.set(key, []);
          }
          occupancy.get(key).push({ playerIndex, pieceIndex });
        }
      });
    });
    return occupancy;
  }, [players, renderPlayerOrder, maxSteps]);

  const tokenNode = (playerIndex, pieceIndex, piece) => {
    let x = 0;
    let y = 0;
    if (piece.isHome) {
      const pos = HOME_POSITIONS[playerIndex][pieceIndex];
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
    } else if (
      piece.isInPlay ||
      (piece.steps > 0 && piece.steps === maxSteps)
    ) {
      // Position piece on board - either in play or finished (at end of path)
      // For finished pieces, use maxSteps to get the last position on the path
      const stepsToUse = piece.steps === maxSteps ? maxSteps : piece.steps;
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

    const isCurrentPlayer = playerIndex === currentPlayer;
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
    const canMove =
      isCurrentPlayer &&
      effectiveDiceValue > 0 &&
      !isMovingRef.current &&
      !isAutoMovingRef.current &&
      ((piece.isHome && effectiveDiceValue === 6) ||
        (piece.isInPlay && piece.steps + effectiveDiceValue <= maxSteps));

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
              ((!onlineMode && !playWithComputer) ||
                myPlayerIndex === currentPlayer) &&
              isActivePlayer &&
              isCurrentPlayer &&
              currentDiceValue > 0 &&
              !isMovingRef.current &&
              !isAutoMovingRef.current
            ) {
              movePiece(pieceIndex);
            }
          }}
          disabled={
            !isActivePlayer ||
            !isCurrentPlayer ||
            effectiveDiceValue === 0 ||
            isMovingRef.current ||
            isAutoMovingRef.current
          }
          style={{
            width: "100%",
            height: "100%",
            borderRadius: "50%",
            background: "transparent",
            border: "none",
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
            // Ensure proper rendering on mobile
            transform: "translateZ(0)",
            backfaceVisibility: "hidden",
            // Ensure button can receive clicks
            pointerEvents: "auto",
            // Add visual feedback for touch area on mobile (optional)
            ...(isMobile && {
              WebkitTapHighlightColor: "rgba(255, 255, 255, 0.1)",
            }),
          }}
          aria-label={`Piece ${pieceIndex + 1} of ${playerNames[playerIndex]}`}
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
      <div className="ludo-root">
        <AnimatedBackground />
        <GameEndedScreen winners={winners} onResetGame={resetGame} />
      </div>
    );
  }

  if (showPlayerSelection) {
    return (
      <div className="ludo-root">
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
          setTimeout(() => acceptIncomingInvite(), 0);
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
                          : Boolean(seat?.profileId);
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
                        hasProfileId &&
                        (i === 0 ||
                          (wasInvitedToThisSlot
                            ? inviteStatus === "joined"
                            : inviteStatus !== "invited"));
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
                    currentPlayer !== myPlayerIndex)
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
                          filter: "drop-shadow(0 6px 10px rgba(0,0,0,0.4))",
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
                          <DiceSVG
                            value={effectiveDiceForUi || 0}
                            size={diceSize}
                            strokeColor={
                              players[effectiveCurrentPlayer]?.color ||
                              "#2ec4b6"
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
                  className={`ludo-player-chip ${idx === effectiveCurrentPlayer ? "ludo-player-chip--active" : ""}`}
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
              <button
                type="button"
                className={`ludo-tool ${soundsEnabled ? "ludo-tool--on" : ""}`}
                onClick={() => {
                  setSoundsEnabled(!soundsEnabled);
                  if (!soundsEnabled) playSound("buttonClick");
                }}
                title={soundsEnabled ? "Disable sounds" : "Enable sounds"}
              >
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
        onAccept={acceptIncomingInvite}
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
