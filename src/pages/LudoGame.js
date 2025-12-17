import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import api from '../api/api';
import siteConfig from '../config/config.json';
import { io } from 'socket.io-client';
import { getSocketUrl } from '../utils/offlineUtils';

// Web port of the RN Ludo game with matching functions and logic
const LudoGame = () => {
    // Layout
    const getWindowSize = () => ({ width: window.innerWidth, height: window.innerHeight });
    const [winSize, setWinSize] = useState(getWindowSize());
    useEffect(() => {
        const onResize = () => setWinSize(getWindowSize());
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    // Ensure board fits within viewport on very small screens
    // Calculate responsive padding (5-20px based on screen size)
    const responsivePadding = Math.min(20, Math.max(5, winSize.width * 0.05));
    const totalPadding = responsivePadding * 2; // padding on both sides
    // Account for padding and ensure board fits
    const availableWidth = Math.max(200, winSize.width - totalPadding);
    const availableHeight = Math.max(200, winSize.height - totalPadding);
    const maxBoardSize = 600; // Maximum size for larger screens
    // Calculate board size based on available space, ensuring it fits
    const calculatedBoardSize = Math.min(availableWidth * 0.98, availableHeight * 0.65, maxBoardSize);
    // Ensure minimum board size but don't exceed available space
    const minBoardSize = Math.min(250, availableWidth * 0.95); // Minimum but respect viewport
    const BOARD_SIZE = Math.max(minBoardSize, Math.min(maxBoardSize, calculatedBoardSize));
    // Calculate CELL_SIZE precisely - use exact division to maintain grid alignment
    const CELL_SIZE = BOARD_SIZE / 15;

    // Types mirrored from RN (JS only)
    // Position: { x: number, y: number }
    // Piece: { id, color, position, isHome, isInPlay, steps }
    // Player: { id, name, color, pieces, isActive, avatar, profileId }

    // Constants
    const colors = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00'];
    const playerNames = ['Red', 'Green', 'Blue', 'Yellow'];
    const playerEmojis = ['🔴', '🟢', '🔵', '🟡'];
    const DEFAULT_MAX_STEPS = 59; // fallback if PATH length cannot be derived

    // Utility to darken or lighten a hex color
    const adjustHexColor = (hex, amt) => {
        try {
            let h = hex.startsWith('#') ? hex.slice(1) : hex;
            if (h.length === 3) h = h.split('').map(ch => ch + ch).join('');
            let num = parseInt(h, 16);
            if (Number.isNaN(num)) return hex;
            let r = (num >> 16) + amt;
            let g = ((num >> 8) & 0x00ff) + amt;
            let b = (num & 0x0000ff) + amt;
            r = Math.max(0, Math.min(255, r));
            g = Math.max(0, Math.min(255, g));
            b = Math.max(0, Math.min(255, b));
            const out = (r << 16) | (g << 8) | b;
            return '#' + out.toString(16).padStart(6, '0');
        } catch (_e) {
            return hex;
        }
    };



    // Precomputed board paths (identical to RN)
    const PATHS = useMemo(() => ({
        0: [
            { x: 1, y: 6 }, { x: 2, y: 6 }, { x: 3, y: 6 }, { x: 4, y: 6 }, { x: 5, y: 6 },
            { x: 6, y: 5 }, { x: 6, y: 4 }, { x: 6, y: 3 }, { x: 6, y: 2 }, { x: 6, y: 1 },
            { x: 6, y: 0 }, { x: 7, y: 0 }, { x: 8, y: 0 },
            { x: 8, y: 1 }, { x: 8, y: 2 }, { x: 8, y: 3 }, { x: 8, y: 4 }, { x: 8, y: 5 },
            { x: 9, y: 6 }, { x: 10, y: 6 }, { x: 11, y: 6 }, { x: 12, y: 6 }, { x: 13, y: 6 },
            { x: 14, y: 6 }, { x: 14, y: 7 }, { x: 14, y: 8 },
            { x: 13, y: 8 }, { x: 12, y: 8 }, { x: 11, y: 8 }, { x: 10, y: 8 }, { x: 9, y: 8 },
            { x: 8, y: 9 }, { x: 8, y: 10 }, { x: 8, y: 11 }, { x: 8, y: 12 }, { x: 8, y: 13 },
            { x: 8, y: 14 }, { x: 7, y: 14 }, { x: 6, y: 14 },
            { x: 6, y: 13 }, { x: 6, y: 12 }, { x: 6, y: 11 }, { x: 6, y: 10 }, { x: 6, y: 9 },
            { x: 5, y: 8 }, { x: 4, y: 8 }, { x: 3, y: 8 }, { x: 2, y: 8 }, { x: 1, y: 8 },
            { x: 0, y: 8 }, { x: 0, y: 7 },
            { x: 1, y: 7 }, { x: 2, y: 7 }, { x: 3, y: 7 }, { x: 4, y: 7 }, { x: 5, y: 7 }, { x: 6, y: 7 }
        ],
        1: [
            { x: 8, y: 1 }, { x: 8, y: 2 }, { x: 8, y: 3 }, { x: 8, y: 4 }, { x: 8, y: 5 },
            { x: 9, y: 6 }, { x: 10, y: 6 }, { x: 11, y: 6 }, { x: 12, y: 6 }, { x: 13, y: 6 },
            { x: 14, y: 6 }, { x: 14, y: 7 }, { x: 14, y: 8 },
            { x: 13, y: 8 }, { x: 12, y: 8 }, { x: 11, y: 8 }, { x: 10, y: 8 }, { x: 9, y: 8 },
            { x: 8, y: 9 }, { x: 8, y: 10 }, { x: 8, y: 11 }, { x: 8, y: 12 }, { x: 8, y: 13 },
            { x: 8, y: 14 }, { x: 7, y: 14 }, { x: 6, y: 14 },
            { x: 6, y: 13 }, { x: 6, y: 12 }, { x: 6, y: 11 }, { x: 6, y: 10 }, { x: 6, y: 9 },
            { x: 5, y: 8 }, { x: 4, y: 8 }, { x: 3, y: 8 }, { x: 2, y: 8 }, { x: 1, y: 8 },
            { x: 0, y: 8 }, { x: 0, y: 7 }, { x: 0, y: 6 },
            { x: 1, y: 6 }, { x: 2, y: 6 }, { x: 3, y: 6 }, { x: 4, y: 6 }, { x: 5, y: 6 },
            { x: 6, y: 5 }, { x: 6, y: 4 }, { x: 6, y: 3 }, { x: 6, y: 2 }, { x: 6, y: 1 },
            { x: 6, y: 0 }, { x: 7, y: 0 }, 
            { x: 7, y: 1 }, { x: 7, y: 2 }, { x: 7, y: 3 }, { x: 7, y: 4 }, { x: 7, y: 5 }, { x: 7, y: 6 }
        ],
        2: [
            { x: 6, y: 13 }, { x: 6, y: 12 }, { x: 6, y: 11 }, { x: 6, y: 10 }, { x: 6, y: 9 },
            { x: 5, y: 8 }, { x: 4, y: 8 }, { x: 3, y: 8 }, { x: 2, y: 8 }, { x: 1, y: 8 },
            { x: 0, y: 8 }, { x: 0, y: 7 }, { x: 0, y: 6 },
            { x: 1, y: 6 }, { x: 2, y: 6 }, { x: 3, y: 6 }, { x: 4, y: 6 }, { x: 5, y: 6 },
            { x: 6, y: 5 }, { x: 6, y: 4 }, { x: 6, y: 3 }, { x: 6, y: 2 }, { x: 6, y: 1 },
            { x: 6, y: 0 }, { x: 7, y: 0 }, { x: 8, y: 0 },
            { x: 8, y: 1 }, { x: 8, y: 2 }, { x: 8, y: 3 }, { x: 8, y: 4 }, { x: 8, y: 5 },
            { x: 9, y: 6 }, { x: 10, y: 6 }, { x: 11, y: 6 }, { x: 12, y: 6 }, { x: 13, y: 6 },
            { x: 14, y: 6 }, { x: 14, y: 7 }, { x: 14, y: 8 },
            { x: 13, y: 8 }, { x: 12, y: 8 }, { x: 11, y: 8 }, { x: 10, y: 8 }, { x: 9, y: 8 },
            { x: 8, y: 9 }, { x: 8, y: 10 }, { x: 8, y: 11 }, { x: 8, y: 12 }, { x: 8, y: 13 },
            { x: 8, y: 14 }, { x: 7, y: 14 },
            { x: 7, y: 13 }, { x: 7, y: 12 }, { x: 7, y: 11 }, { x: 7, y: 10 }, { x: 7, y: 9 }, { x: 7, y: 8 }
        ],
        3: [
            { x: 13, y: 8 }, { x: 12, y: 8 }, { x: 11, y: 8 }, { x: 10, y: 8 }, { x: 9, y: 8 },
            { x: 8, y: 9 }, { x: 8, y: 10 }, { x: 8, y: 11 }, { x: 8, y: 12 }, { x: 8, y: 13 },
            { x: 8, y: 14 }, { x: 7, y: 14 }, { x: 6, y: 14 },
            { x: 6, y: 13 }, { x: 6, y: 12 }, { x: 6, y: 11 }, { x: 6, y: 10 }, { x: 6, y: 9 },
            { x: 5, y: 8 }, { x: 4, y: 8 }, { x: 3, y: 8 }, { x: 2, y: 8 }, { x: 1, y: 8 },
            { x: 0, y: 8 }, { x: 0, y: 7 }, { x: 0, y: 6 },
            { x: 1, y: 6 }, { x: 2, y: 6 }, { x: 3, y: 6 }, { x: 4, y: 6 }, { x: 5, y: 6 },
            { x: 6, y: 5 }, { x: 6, y: 4 }, { x: 6, y: 3 }, { x: 6, y: 2 }, { x: 6, y: 1 },
            { x: 6, y: 0 }, { x: 7, y: 0 }, { x: 8, y: 0 },
            { x: 8, y: 1 }, { x: 8, y: 2 }, { x: 8, y: 3 }, { x: 8, y: 4 }, { x: 8, y: 5 },
            { x: 9, y: 6 }, { x: 10, y: 6 }, { x: 11, y: 6 }, { x: 12, y: 6 }, { x: 13, y: 6 },
            { x: 14, y: 6 }, { x: 14, y: 7 },
            { x: 13, y: 7 }, { x: 12, y: 7 }, { x: 11, y: 7 }, { x: 10, y: 7 }, { x: 9, y: 7 }, { x: 8, y: 7 }
        ]
    }), []); // Static paths - no dependencies needed

    // Use exact path length as the true max steps (prevents overruns near home)
    const maxSteps = useMemo(() => {
        try {
            const len0 = Array.isArray(PATHS?.[0]) ? PATHS[0].length : undefined;
            return (typeof len0 === 'number' && len0 > 0) ? len0 : DEFAULT_MAX_STEPS;
        } catch (_e) {
            return DEFAULT_MAX_STEPS;
        }
    }, [PATHS]);

    // State (mirrors RN)
    const myProfile = useSelector(state => state.profile);
    const [players, setPlayers] = useState([]);
    const [currentPlayer, setCurrentPlayer] = useState(0);
    const [diceValue, setDiceValue] = useState(0);
    const [gameStarted, setGameStarted] = useState(false);
    const [winner, setWinner] = useState(null);
    const [winners, setWinners] = useState([]);
    const [showWinnerModal, setShowWinnerModal] = useState(false);
    const [gameEnded, setGameEnded] = useState(false);
    const [diceRolling, setDiceRolling] = useState(false);
    const [canRollDice, setCanRollDice] = useState(true);
    const [diceRotateX, setDiceRotateX] = useState(0);
    const [diceRotateY, setDiceRotateY] = useState(0);
    const [showPlayerSelection, setShowPlayerSelection] = useState(false);
    const [selectedPlayerCount, setSelectedPlayerCount] = useState(4);
    // Refs to avoid re-binding socket listeners on every state change
    const playersRef = useRef(players);
    const currentPlayerRef = useRef(currentPlayer);
    const selectedPlayerCountRef = useRef(selectedPlayerCount);
    const winnersRef = useRef(winners);
    const maxStepsRef = useRef(0);
    const lastDiceValueRef = useRef(0);
    const diceValueRef = useRef(diceValue);
    const gameStartedRef = useRef(gameStarted);
    const gameEndedRef = useRef(gameEnded);
    const autoStartTriggeredRef = useRef(false); // Track if auto-start has been triggered
    const lastLocalDiceRollTimeRef = useRef(0); // Track when dice was last rolled locally (to prevent stale broadcasts from overwriting)
    const lastBroadcastRef = useRef(0); // Track last broadcast time for throttling
    const recentMovesRef = useRef(new Map()); // Track recent moves: pieceKey -> { toSteps, timestamp } to prevent overwrites
    const lastTurnAdvanceTimeRef = useRef(0); // Track when turn was last advanced locally (to prevent stale broadcasts from reverting it)
    // Online friends selection
    const [onlineMode, setOnlineMode] = useState(false);
    const [selectedFriends, setSelectedFriends] = useState([]); // [{ _id, fullName, profilePic }]
    const [friendSearchQuery, setFriendSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [loadingSearch, setLoadingSearch] = useState(false);
    const [friendList, setFriendList] = useState([]);
    const [invitedStatusByFriendId, setInvitedStatusByFriendId] = useState({}); // { friendId: 'invited'|'joined'|'declined' }
    const [invitedSlotByFriendId, setInvitedSlotByFriendId] = useState({}); // { friendId: slotIndex }
    const invitedStatusByFriendIdRef = useRef({}); // Ref to track invited status for synchronous checks in event handlers
    const invitedSlotByFriendIdRef = useRef({}); // Ref to track invited slots for synchronous checks
    const inviteTimestampsRef = useRef({}); // Track when each friend was invited to prevent immediate accept events
    const searchTimeoutRef = useRef(null);
    const inviteHandlersAttachedRef = useRef(false);
    const [incomingInvite, setIncomingInvite] = useState(null);
    const [inviteCopied, setInviteCopied] = useState(false);
    const [incomingInviteRequest, setIncomingInviteRequest] = useState(null); // { from, name, avatar, gameId, slotIndex, playerCount }
    const [pendingInvites, setPendingInvites] = useState([]); // [{ from, name, avatar, gameId, slotIndex, playerCount, ts }]
    // Lobby/waiting state
    const [waitingForPlayers, setWaitingForPlayers] = useState(false);
    // Track inviter identity to fix seat 0 identity on invitee until host snapshot is correct
    const [lastInviter, setLastInviter] = useState(null); // { id, name, avatar }
    // Player editor modal
    const [showPlayerEditor, setShowPlayerEditor] = useState(false);
    const [editingPlayerIndex, setEditingPlayerIndex] = useState(null);
    const [editName, setEditName] = useState('');
    const [editAvatarUrl, setEditAvatarUrl] = useState('');
    const avatarFileInputRef = useRef(null);
    // Online play socket state
    const socketRef = useRef(null);
    const socketCreatingRef = useRef(false); // Guard to prevent multiple simultaneous socket creations
    const [gameId, setGameId] = useState(null);
    const [myPlayerIndex, setMyPlayerIndex] = useState(0);
    // Track last roll to prevent multiple rolls
    const lastRollTimeRef = useRef(0);
    const isRollingRef = useRef(false);
    const socketBaseUrl = useMemo(() => {
        try {
            // Use offline utils for fallback
            const url = getSocketUrl();
            const normalized = url.replace(/\/$/, '');
            return normalized;
        } catch (_e) {
            // Fallback to localhost if offline utils fail
            try {
                const loc = window.location;
                const hostname = loc.hostname;
                const protocol = loc.protocol;
                const fallback = (hostname === 'localhost' || hostname === '127.0.0.1') 
                    ? `${protocol}//localhost:4000`
                    : `${protocol}//${hostname}`;
                return fallback.replace(/\/$/, '');
            } catch (_e2) {
                return 'http://localhost:4000';
            }
        }
    }, []);

    // Safe helper to emit even if socket is still connecting
    const emitSocket = useCallback((event, payload) => {
        try {
            const s = socketRef.current;
            if (!s) return false;
            const doEmit = () => { try { s.emit(event, payload); } catch (_e) { } };
            if (s.connected) { doEmit(); return true; }
            const onConnect = () => { doEmit(); s.off('connect', onConnect); };
            s.on('connect', onConnect);
            return true;
        } catch (_e) { return false; }
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
            // Reset guard flag
            socketCreatingRef.current = false;
        } catch (_e) {
            socketRef.current = null;
            socketCreatingRef.current = false;
        }
    }, []);

    // Helper to attach socket event listeners (to avoid duplication)
    // Must be defined before ensureSocketConnected
    const attachSocketListeners = useCallback((socket) => {
        if (!socket) return;
        
        socket.on('error', (err) => {
        });
        
        socket.on('disconnect', (reason) => {
                        // If we were in an online game, show reconnect option
                        if (onlineMode && gameId && gameStarted && !gameEnded) {
                            setIsReconnecting(true);
                            // Auto-attempt reconnect after a short delay
                            setTimeout(() => {
                                if (socketRef.current && !socketRef.current.connected) {
                                    setShowReconnectModal(true);
                                }
                            }, 2000);
                        }
                    });
        
        socket.on('reconnect', (attemptNumber) => {
                        setIsReconnecting(false);
                        setShowReconnectModal(false);
                        // Auto-rejoin game if we have one
                        if (savedGameStateRef.current?.gameId && onlineMode) {
                            try {
                    socket.emit('ludo:join', { gameId: savedGameStateRef.current.gameId });
                    socket.emit('ludo:players:get', { gameId: savedGameStateRef.current.gameId });
                            } catch (_e) { }
                        }
                    });
        
        socket.on('reconnect_attempt', (attemptNumber) => {
                        if (onlineMode && gameId && gameStarted) {
                            setIsReconnecting(true);
                        }
                    });
        
        socket.on('reconnect_error', (error) => {
                    });
        
        socket.on('reconnect_failed', () => {
                        setIsReconnecting(false);
                        if (onlineMode && gameId && gameStarted) {
                            setShowReconnectModal(true);
                        }
                    });
    }, [onlineMode, gameId, gameStarted, gameEnded]);

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
                const socketPath = '/socket.io';
                const opts = {
                    transports: ['websocket', 'polling'],
                    path: socketPath,
                    query: { profile: myProfile?._id },
                    timeout: 40000,
                    reconnection: true,
                    reconnectionAttempts: Infinity,
                    reconnectionDelay: 1000,
                    reconnectionDelayMax: 5000,
                forceNew: false, // Changed to false to reuse connection if possible
                    withCredentials: true
                };
            
            const newSocket = io(socketBaseUrl, opts);
            socketRef.current = newSocket;
            
            try {
                newSocket.on('connect', () => {
                    try { newSocket?.emit('ludo:invites:get'); } catch (_e) { }
                });
                
                newSocket.on('connect_error', (err) => {
                        // Fallbacks: try window.origin if different; then try :4000 if on :3000
                        try {
                            const origin = window.location.origin.replace(/\/$/, '');
                            const currentBase = (socketBaseUrl || '').replace(/\/$/, '');
                            const isLocal3000 = /localhost|127\.|::1/.test(window.location.hostname) && String(window.location.port) === '3000';
                            const alt4000 = `${window.location.protocol}//${window.location.hostname}:4000`;
                        
                        if (!newSocket.__triedFallback && origin && currentBase && origin !== currentBase) {
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
            } catch (_e) { }

            // Clear guard flag after a short delay to allow connection to establish
            setTimeout(() => {
                socketCreatingRef.current = false;
            }, 1000);
        } catch (_e) {
            socketCreatingRef.current = false;
        }
    }, [myProfile?._id, socketBaseUrl, onlineMode, gameId, gameStarted, gameEnded, cleanupSocket, attachSocketListeners]);


    useEffect(() => { playersRef.current = players; }, [players]);
    useEffect(() => { currentPlayerRef.current = currentPlayer; }, [currentPlayer]);
    useEffect(() => { selectedPlayerCountRef.current = selectedPlayerCount; }, [selectedPlayerCount]);
    useEffect(() => { winnersRef.current = winners; }, [winners]);
    useEffect(() => { invitedStatusByFriendIdRef.current = invitedStatusByFriendId; }, [invitedStatusByFriendId]);
    useEffect(() => { invitedSlotByFriendIdRef.current = invitedSlotByFriendId; }, [invitedSlotByFriendId]);
    useEffect(() => { maxStepsRef.current = maxSteps; }, [maxSteps]);
    // Don't update ref here - it's updated in setDiceValueImmediate to avoid race conditions
    // Removed excessive logging to prevent infinite loops

    const setDiceValueImmediate = useCallback((value) => {
        setDiceValue(value);
        diceValueRef.current = value;
    }, []);
    useEffect(() => { gameStartedRef.current = gameStarted; }, [gameStarted]);
    useEffect(() => { gameEndedRef.current = gameEnded; }, [gameEnded]);

    // Debug flag (show dev-only controls on localhost)
    const isDebug = useMemo(() => {
        try {
            return /localhost|127\.0\.0\.1/.test(window.location.hostname);
        } catch (_e) {
            return false;
        }
    }, []);

    // Turn order helper
    // 4 players: Red -> Green -> Yellow -> Blue (0,1,3,2)
    // 2/3 players: [Red, Green] or [Red, Green, Blue]
    const getNextActivePlayer = useCallback((fromIndex) => {
        const baseOrder = selectedPlayerCount === 4 ? [0, 1, 3, 2] : [0, 1, 2].slice(0, selectedPlayerCount);
        const order = baseOrder;
        if (order.length === 0) return fromIndex;
        let idx = order.indexOf(fromIndex);
        if (idx === -1) idx = 0;
        let attempts = 0;
        while (attempts < order.length) {
            idx = (idx + 1) % order.length;
            const candidate = order[idx];
            const player = players[candidate];
            // Skip offline players and winners
            const playerWon = winners.some(w => w.id === candidate);
            const isOffline = player && player.isOffline && !player.isBot;
            if (!playerWon && !isOffline) return candidate;
            attempts++;
        }
        return fromIndex;
    }, [selectedPlayerCount, winners, players]);

    // Rendering order to match dice sequence
    const renderPlayerOrder = useMemo(() => {
        return selectedPlayerCount === 4 ? [0, 1, 3, 2] : [0, 1, 2].slice(0, selectedPlayerCount);
    }, [selectedPlayerCount]);

    // Animation timing (web simulation) - optimized for faster gameplay
    const stepDurationMs = 150;
    const moveTimersRef = useRef([]);
    const isMovingRef = useRef(false); // Prevent multiple moves from single dice roll
    const isAutoMovingRef = useRef(false); // Track if an automatic move is in progress
    useEffect(() => () => {
        moveTimersRef.current.forEach(t => clearTimeout(t));
    }, []);

    // Helpers (identical logic) - memoized for performance
    const getPositionOnPath = useCallback((playerIndex, steps) => {
        const path = PATHS[playerIndex];
        if (!path || steps <= 0 || steps > path.length) {
            return { x: 7, y: 7 };
        }
        return path[steps - 1];
    }, [PATHS]);

    // Safe zones - cannot capture here. Includes entry squares to home columns and classic star squares (board coordinates).
    const SAFE_CELLS = useMemo(() => {
        const cells = [
            // Entry squares to home columns (classic safe)
            [1, 6],  // red entry
            [8, 1],  // green entry
            [6, 13], // blue entry
            [13, 8], // yellow entry
            // Start squares (also treated safe)
            [7, 13], // red start
            [13, 7], // green start
            [7, 2],  // blue start
            [2, 7],  // yellow start
        ];
        const map = new Set(cells.map(([x, y]) => `${x},${y}`));
        return map;
    }, []);

    const isSafePosition = (_playerIndex, position) => {
        return SAFE_CELLS.has(`${position.x},${position.y}`);
    };

    const checkForCapture = (movingPlayerIndex, newPosition, movingPieceNewSteps) => {
        const srcPlayers = playersRef.current && Array.isArray(playersRef.current) ? playersRef.current : players;
        const captured = [];
        
        // Count tokens per player at the target position (including the moving player)
        const tokensAtPosition = new Map(); // playerIndex -> count
        
        srcPlayers.forEach((player, playerIndex) => {
            let count = 0;
            player.pieces.forEach((piece, pieceIndex) => {
                if (piece.isInPlay) {
                    if (piece.steps >= maxSteps) return; // Skip finished pieces
                    const piecePosition = getPositionOnPath(playerIndex, piece.steps);
                    if (piecePosition.x === newPosition.x && piecePosition.y === newPosition.y) {
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
        if (typeof movingPieceNewSteps === 'number' && movingPieceNewSteps > 0 && movingPieceNewSteps < maxSteps) {
            const movingPiecePosition = getPositionOnPath(movingPlayerIndex, movingPieceNewSteps);
            if (movingPiecePosition.x === newPosition.x && movingPiecePosition.y === newPosition.y) {
                // Check if the moving piece is already counted in the state
                const movingPlayer = srcPlayers[movingPlayerIndex];
                let alreadyCounted = false;
                if (movingPlayer && Array.isArray(movingPlayer.pieces)) {
                    alreadyCounted = movingPlayer.pieces.some(piece => {
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
                    if (piecePosition.x === newPosition.x && piecePosition.y === newPosition.y) {
                        firstPieceAtPosition = piecePosition;
                        break;
                    }
                }
            }
            
            // Skip safe positions
            if (firstPieceAtPosition && isSafePosition(playerIndex, firstPieceAtPosition)) return;
            
            // Rule 1: If moving player has 2+ tokens and opponent has 2 tokens, capture both opponent tokens
            if (movingPlayerTokenCount >= 2 && count === 2) {
                // Capture both opponent tokens
                player.pieces.forEach((piece, pieceIndex) => {
                    if (piece.isInPlay && piece.steps < maxSteps) {
                        const piecePosition = getPositionOnPath(playerIndex, piece.steps);
                        if (piecePosition.x === newPosition.x && piecePosition.y === newPosition.y) {
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
                        if (piecePosition.x === newPosition.x && piecePosition.y === newPosition.y) {
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
                        if (piecePosition.x === newPosition.x && piecePosition.y === newPosition.y) {
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
    const checkForCaptureAfterMoveAway = (movingPlayerIndex, oldPosition) => {
        const srcPlayers = playersRef.current && Array.isArray(playersRef.current) ? playersRef.current : players;
        const captured = [];
        
        // Count tokens per player at the old position (after the move)
        const tokensAtPosition = new Map(); // playerIndex -> count
        
        srcPlayers.forEach((player, playerIndex) => {
            let count = 0;
            player.pieces.forEach((piece, pieceIndex) => {
                if (piece.isInPlay) {
                    if (piece.steps >= maxSteps) return; // Skip finished pieces
                    const piecePosition = getPositionOnPath(playerIndex, piece.steps);
                    if (piecePosition.x === oldPosition.x && piecePosition.y === oldPosition.y) {
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
                                    const piecePosition = getPositionOnPath(opponentIndex, piece.steps);
                                    if (piecePosition.x === oldPosition.x && piecePosition.y === oldPosition.y) {
                                        const position = getPositionOnPath(opponentIndex, piece.steps);
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
                    const movingPlayerRemainingCount = tokensAtPosition.get(movingPlayerIndex) || 0;
                    if (movingPlayerRemainingCount >= 2) {
                        // Moving player left 2+ tokens, can capture this single token
                        const player = srcPlayers[playerIndex];
                        player.pieces.forEach((piece, pieceIndex) => {
                            if (piece.isInPlay && piece.steps < maxSteps) {
                                const piecePosition = getPositionOnPath(playerIndex, piece.steps);
                                if (piecePosition.x === oldPosition.x && piecePosition.y === oldPosition.y) {
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
        names[0] = myProfile?.fullName || 'You';
        avatars[0] = myProfile?.profilePic;
        covers[0] = myProfile?.coverPic || myProfile?.coverPic || myProfile?.cover || myProfile?.profileCover || undefined;
        for (let i = 1; i < playerCount; i++) {
            const f = selectedFriends[i - 1];
            names[i] = f?.fullName || playerNames[i];
            avatars[i] = f?.profilePic;
            covers[i] = f?.coverPic || f?.coverPic || f?.cover || f?.profileCover || undefined;
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
                profileId: i === 0 ? (myProfile?._id || 'local') : undefined,
            });
        }
        setPlayers(newPlayers);
    };

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

    // Fetch pending invites on connect/profile available
    useEffect(() => {
        if (!socketRef.current || !myProfile?._id) return;
        try { socketRef.current.emit('ludo:invites:get'); } catch (_e) { }
    }, [myProfile?._id]);

    // Parse invite tokens from URL (?ludoInvite=BASE64) and auto-start / auto-accept
    useEffect(() => {
        try {
            const params = new URLSearchParams(window.location.search);
            const token = params.get('ludoInvite');
            if (!token) return;
            const json = atob(token);
            const payload = JSON.parse(json);
            if (payload && payload.type === 'ludo_invite') {
                setIncomingInvite(payload);
                const playerCountFromLink = (payload.playerCount && [2, 3, 4].includes(payload.playerCount)) ? payload.playerCount : undefined;
                if (playerCountFromLink) setSelectedPlayerCount(playerCountFromLink);
                const gid = payload.gameId || generateGameId();
                setGameId(gid);
                setOnlineMode(true);

                const isInviter = myProfile?._id && payload.by && String(myProfile._id) === String(payload.by);
                const slotFromLink = (typeof payload.slotIndex === 'number') ? payload.slotIndex : undefined;

                // If current user is NOT the inviter, auto-accept the invite as the friend
                if (!isInviter) {
                    ensureSocketConnected();
                    try { socketRef.current && socketRef.current.emit('ludo:invites:get'); } catch (_e) {}
                    setIncomingInviteRequest({
                        from: payload.by,
                        name: payload.name,
                        avatar: payload.avatar,
                        cover: payload.cover,
                        gameId: gid,
                        slotIndex: slotFromLink,
                        playerCount: playerCountFromLink
                    });
                    setTimeout(() => acceptIncomingInvite(), 0);
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
                    setDiceRolling(false);
                    initializeGame(playerCountFromLink || selectedPlayerCount);
                    ensureSocketConnected();
                    // Wait for socket to be ready before emitting
                    const waitAndEmit = () => {
                        if (socketRef.current && socketRef.current.connected) {
                            try {
                        socketRef.current.emit('ludo:join', { gameId: gid });
                        setMyPlayerIndex(0);
                        emitPlayersState(gid);
                    } catch (_e) { }
                        } else if (socketRef.current) {
                            // Wait for connection
                            socketRef.current.once('connect', () => {
                                try {
                                    socketRef.current.emit('ludo:join', { gameId: gid });
                                    setMyPlayerIndex(0);
                                    emitPlayersState(gid);
                                } catch (_e) { }
                            });
                        }
                    };
                    setTimeout(waitAndEmit, 100);
                }
            }
        } catch (_e) { }
    }, [gameStarted, myProfile?._id]);

    // Optional: load default friend list when opening player selection
    useEffect(() => {
        if (!showPlayerSelection) return;
        // Attempt to fetch friend list (adjust endpoint as needed)
        (async () => {
            try {
                const res = await fetch('/api/friends', { credentials: 'include' });
                if (!res.ok) return;
                const data = await res.json();
                setFriendList(Array.isArray(data) ? data : (Array.isArray(data?.friends) ? data.friends : []));
            } catch (_e) {
                setFriendList([]);
            }
        })();
    }, [showPlayerSelection]);

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

    const emitPlayersState = useCallback((gid) => {
        if (!onlineMode || !socketRef.current || !gid) return;
        try {
            const minimalPlayers = players.map(p => ({
                id: p.id,
                name: p.name,
                color: p.color,
                avatar: p.avatar,
                cover: p.cover,
                profileId: p.profileId,
                isActive: p.isActive !== undefined ? p.isActive : true,
                // keep piece steps so remotes can render tokens
                pieces: (Array.isArray(p.pieces) ? p.pieces.map(pc => ({ id: pc.id, steps: pc.steps, isHome: pc.isHome, isInPlay: pc.isInPlay })) : [])
            }));
            // Host guard: normalize seat 0 profileId to host
            if (minimalPlayers[0]) {
                minimalPlayers[0].profileId = myProfile?._id || minimalPlayers[0].profileId;
                minimalPlayers[0].name = myProfile?.fullName || minimalPlayers[0].name;
                minimalPlayers[0].avatar = myProfile?.profilePic || minimalPlayers[0].avatar;
                minimalPlayers[0].cover = myProfile?.coverPic || minimalPlayers[0].cover;
            }
            socketRef.current.emit('ludo:players', { 
                gameId: gid, 
                players: minimalPlayers, 
                selectedPlayerCount, 
                currentPlayer,
                diceValue: diceValueRef.current || 0,
                gameStarted: gameStartedRef.current || false,
                gameEnded: gameEndedRef.current || false,
                winners: winnersRef.current || []
            });
        } catch (_e) { }
    }, [players, selectedPlayerCount, currentPlayer, onlineMode, myProfile]);

    // Handle offline player actions (host only)
    const replacePlayerWithBot = useCallback((playerIndex) => {
        if (myPlayerIndex !== 0 || !onlineMode || !gameId) return;
        try {
            if (socketRef.current) {
                socketRef.current.emit('ludo:replace:bot', { gameId, playerIndex });
            }
        } catch (_e) {}
    }, [myPlayerIndex, onlineMode, gameId]);

    const removeOfflinePlayer = useCallback((playerIndex) => {
        if (myPlayerIndex !== 0 || !onlineMode || !gameId) return;
        try {
            if (socketRef.current) {
                socketRef.current.emit('ludo:remove:player', { gameId, playerIndex });
            }
        } catch (_e) {}
    }, [myPlayerIndex, onlineMode, gameId]);

    // Broadcast game state periodically (host only)
    const broadcastGameState = useCallback(() => {
        if (myPlayerIndex !== 0 || !onlineMode || !gameId || !gameStarted || !socketRef.current) return;
        try {
            const minimalPlayers = playersRef.current.map(p => ({
                id: p.id,
                name: p.name,
                color: p.color,
                avatar: p.avatar,
                cover: p.cover,
                profileId: p.profileId,
                isActive: p.isActive !== undefined ? p.isActive : true,
                pieces: (Array.isArray(p.pieces) ? p.pieces.map(pc => ({ id: pc.id, steps: pc.steps, isHome: pc.isHome, isInPlay: pc.isInPlay })) : [])
            }));
            // Use current dice value from ref
            // IMPORTANT: Always use the ref value, which is updated immediately when dice is rolled
            const currentDiceValue = diceValueRef.current || 0;
            
            socketRef.current.emit('ludo:players', { 
                gameId, 
                players: minimalPlayers, 
                selectedPlayerCount: selectedPlayerCountRef.current, 
                currentPlayer: currentPlayerRef.current,
                diceValue: currentDiceValue,
                gameStarted: gameStartedRef.current || false,
                gameEnded: gameEndedRef.current || false,
                winners: winnersRef.current || []
            });
        } catch (_e) {}
    }, [myPlayerIndex, onlineMode, gameId, gameStarted]);

    // Periodically broadcast game state (host only) - optimized frequency
    useEffect(() => {
        if (myPlayerIndex !== 0 || !onlineMode || !gameId || !gameStarted) return;
        const interval = setInterval(() => {
            broadcastGameState();
        }, 3000); // Broadcast every 3 seconds (reduced from 5 for better sync)
        return () => clearInterval(interval);
    }, [myPlayerIndex, onlineMode, gameId, gameStarted, broadcastGameState]);

    // Also broadcast when game state changes significantly - optimized debounce
    useEffect(() => {
        if (myPlayerIndex === 0 && onlineMode && gameId && gameStarted) {
            const now = Date.now();
            // Throttle broadcasts to max once per 300ms
            const timeSinceLastBroadcast = now - lastBroadcastRef.current;
            const delay = timeSinceLastBroadcast < 300 ? 300 - timeSinceLastBroadcast : 0;
            
            const timeout = setTimeout(() => {
                lastBroadcastRef.current = Date.now();
                broadcastGameState();
            }, delay);
            return () => clearTimeout(timeout);
        }
    }, [players, currentPlayer, diceValue, gameStarted, gameEnded, winners, myPlayerIndex, onlineMode, gameId, broadcastGameState]);

    const inviteFriend = useCallback((friend) => {
        if (!friend || !friend._id) return;
        // Must be online mode to invite
        if (!onlineMode) setOnlineMode(true);
        ensureSocketConnected();
        const gid = gameId || generateGameId();
        if (!gameId) setGameId(gid);
        // Reserve a slot for friend
        const slot = getNextOpenSlot();
        if (slot == null) return; // no open slot
        // Update local players with reservation
        setPlayers(prev => {
            const copy = prev.map(p => ({ ...p, pieces: p.pieces.map(pc => ({ ...pc })) }));
            if (!copy[slot]) return prev;
            copy[slot].name = friend.fullName || copy[slot].name;
            copy[slot].avatar = friend.profilePic || copy[slot].avatar;
            copy[slot].cover = friend.coverPic || copy[slot].cover;
            copy[slot].profileId = friend._id;
            return copy;
        });
        const friendIdStr = String(friend._id);
        setInvitedStatusByFriendId(prev => {
            const updated = { ...prev, [friendIdStr]: 'invited' };
            console.log(`[inviteFriend] Setting status to 'invited' for friend ${friend._id} (as string: ${friendIdStr}), slot ${slot}, updated status:`, updated);
            return updated;
        });
        setInvitedSlotByFriendId(prev => ({ ...prev, [friendIdStr]: slot }));
        // Track when this friend was invited to prevent processing accept events that arrive immediately
        inviteTimestampsRef.current[friendIdStr] = Date.now();
        try {
            const targetId = friend?._id || friend?.id;
            if (!targetId) return;
            // Join/create room for host immediately (do before sending invite)
            try { emitSocket('ludo:join', { gameId: gid }); } catch (_e) { }
            // Send invite (queued if socket is still connecting)
            emitSocket('ludo:invite', {
                to: targetId,
                by: myProfile?._id,
                name: myProfile?.fullName || 'Player',
                avatar: myProfile?.profilePic,
                cover: myProfile?.coverPic,
                gameId: gid,
                slotIndex: slot,
                playerCount: selectedPlayerCount,
                ts: Date.now(),
            });
            // Fire a web notification to the friend's active browsers
            try { sendInviteNotificationToFriend(friend, gid, slot); } catch (_e) { }
        } catch (_e) { }
    }, [onlineMode, ensureSocketConnected, gameId, myProfile?._id, myProfile?.fullName, myProfile?.profilePic, selectedPlayerCount, getNextOpenSlot, emitSocket]);

    // Offline: assign a searched friend/profile to the next open local seat (no socket)
    const assignFriendOffline = useCallback((friend) => {
        if (!friend || !friend._id) return;
        const slot = getNextOpenSlot();
        if (slot == null) return;
        setPlayers(prev => {
            const copy = prev.map(p => ({ ...p, pieces: p.pieces.map(pc => ({ ...pc })) }));
            if (!copy[slot]) return prev;
            copy[slot].name = friend.fullName || copy[slot].name;
            copy[slot].avatar = friend.profilePic || copy[slot].avatar;
            copy[slot].cover = friend.coverPic || copy[slot].cover;
            copy[slot].profileId = friend._id; // local-only association
            return copy;
        });
        setSelectedFriends(prev => {
            const already = prev.some(p => String(p?._id) === String(friend._id));
            if (already) return prev;
            const next = [...prev, friend];
            return next.slice(0, Math.max(0, selectedPlayerCount - 1));
        });
    }, [getNextOpenSlot, selectedPlayerCount]);

    // Helper to check if all required players have actually joined (for online mode)
    const checkAllPlayersJoined = useCallback(() => {
        if (!onlineMode) return true; // Offline mode doesn't need to wait
        
        const maxPlayers = Math.max(2, Math.min(4, selectedPlayerCount));
        const currentPlayers = playersRef.current && Array.isArray(playersRef.current) ? playersRef.current : players;
        const currentInvitedStatus = invitedStatusByFriendIdRef.current;
        const currentInvitedSlots = invitedSlotByFriendIdRef.current;
        
        // Check each seat (excluding host at 0)
        for (let i = 1; i < maxPlayers; i++) {
            const seat = currentPlayers[i];
            const hasProfileId = Boolean(seat?.profileId);
            
            if (!hasProfileId) {
                // No profileId means seat is empty - not all players joined
                return false;
            }
            
            // If they have profileId, check if they actually joined (not just invited)
            const profileIdStr = seat?.profileId ? String(seat.profileId) : null;
            const inviteStatus = profileIdStr ? (currentInvitedStatus[profileIdStr] || currentInvitedStatus[seat.profileId]) : null;
            const wasInvitedToThisSlot = profileIdStr && (currentInvitedSlots[profileIdStr] === i || currentInvitedSlots[seat.profileId] === i);
            
            // Consider them joined only if:
            // - If they were invited to this slot: only joined if status is explicitly 'joined'
            // - If they were NOT invited to this slot: joined (offline assignment)
            const isJoined = wasInvitedToThisSlot 
                ? inviteStatus === 'joined'  // If invited, only joined if status is 'joined'
                : inviteStatus !== 'invited';  // If not invited, joined unless status is 'invited'
            
            if (!isJoined) {
                // This player hasn't actually joined yet
                return false;
            }
        }
        
        // All seats are filled and all players have joined
        return true;
    }, [onlineMode, selectedPlayerCount]);

    // Determine if host should wait in lobby for invited players
    const recomputeWaitingState = useCallback(() => {
        try {
            // Gate waiting in online games for both host and invitees
            if (!onlineMode || myProfile?._id == null) {
                setWaitingForPlayers(false);
                return;
            }
            
            // Also check if game has started - if started, don't wait (use ref to avoid stale closure)
            if (gameStartedRef.current) {
                setWaitingForPlayers(false);
                setCanRollDice(true);
                return;
            }
            
            // Check if all players have actually joined
            const allPlayersJoined = checkAllPlayersJoined();
            const shouldWait = !allPlayersJoined;

            
            setWaitingForPlayers(shouldWait);
            if (shouldWait) {
                setCanRollDice(false);
            } else {
                // All players joined; ensure dice can roll
                setCanRollDice(true);
                
                // If all players joined and game hasn't started yet, automatically start the game (host only)
                // Use refs to prevent infinite loop and multiple triggers
                if (!gameStartedRef.current && !autoStartTriggeredRef.current && allPlayersJoined && myPlayerIndex === 0 && onlineMode && gameId) {
                    // Mark as triggered immediately to prevent multiple calls
                    autoStartTriggeredRef.current = true;
                    
                    // Auto-start the game when all players have joined
                    setTimeout(() => {
                        // Use the latest players state
                        const currentPlayers = playersRef.current && Array.isArray(playersRef.current) ? playersRef.current : players;
                        
                        setGameStarted(true);
                        gameStartedRef.current = true; // Update ref immediately
                        setCurrentPlayer(0);
                        setDiceValueImmediate(0);
                        setCanRollDice(true);
                        setDiceRolling(false);
                        setWaitingForPlayers(false);
                        
                        // Broadcast game start to all players
                        if (socketRef.current) {
                            try {
                                const minimalPlayers = currentPlayers.map(p => ({
                                    id: p.id,
                                    name: p.name,
                                    color: p.color,
                                    avatar: p.avatar,
                                    cover: p.cover,
                                    profileId: p.profileId,
                                    isActive: p.isActive !== undefined ? p.isActive : true,
                                    pieces: (Array.isArray(p.pieces) ? p.pieces.map(pc => ({ id: pc.id, steps: pc.steps, isHome: pc.isHome, isInPlay: pc.isInPlay })) : [])
                                }));
                                socketRef.current.emit('ludo:players', {
                                    gameId,
                                    players: minimalPlayers,
                                    selectedPlayerCount: selectedPlayerCountRef.current,
                                    currentPlayer: 0,
                                    diceValue: 0,
                                    gameStarted: true,
                                    gameEnded: false,
                                    winners: []
                                });
                            } catch (_e) {
                            }
                        }
                    }, 500); // Small delay to ensure UI updates
                }
            }
        } catch (_e) {
            setWaitingForPlayers(false);
        }
    }, [onlineMode, myPlayerIndex, players, myProfile?._id, selectedPlayerCount, gameId, checkAllPlayersJoined]);

    const onChangeFriendSearch = (text) => {
        setFriendSearchQuery(text);
        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
        if (!text || text.trim().length < 2) {
            setSearchResults([]);
            return;
        }
        searchTimeoutRef.current = setTimeout(async () => {
            try {
                setLoadingSearch(true);
                const res = await api.get(`/search?input=${encodeURIComponent(text)}`);
                const data = res?.data || {};
                setSearchResults(Array.isArray(data?.users) ? data.users : []);
            } catch (_e) {
                setSearchResults([]);
            } finally {
                setLoadingSearch(false);
            }
        }, 300);
    };

    const generateGameId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

    const createInviteToken = () => {
        const gid = gameId || generateGameId();
        if (!gameId) setGameId(gid);
        const payload = {
            type: 'ludo_invite',
            by: myProfile?._id || 'anon',
            name: myProfile?.fullName || 'Player',
            ts: Date.now(),
            gameId: gid,
            playerCount: selectedPlayerCount
        };
        return btoa(JSON.stringify(payload));
    };

    const sendInviteNotificationToFriend = async (friend, gid, slotIndex) => {
        try {
            const token = (() => {
                try {
                    const payload = {
                        type: 'ludo_invite',
                        by: myProfile?._id || 'anon',
                        name: myProfile?.fullName || 'Player',
                        ts: Date.now(),
                        gameId: gid,
                        playerCount: selectedPlayerCount,
                        slotIndex
                    };
                    return btoa(JSON.stringify(payload));
                } catch (_e) {
                    return createInviteToken();
                }
            })();
            const url = `${window.location.origin}${window.location.pathname}`;
            const notificationData = {
                title: 'Ludo Invitation',
                text: `${myProfile?.fullName || 'A friend'} invited you to play Ludo`,
                icon: myProfile?.profilePic || siteConfig.logo,
                link: url,
                type: 'ludo_invite',
                data: {
                    gameId: gid,
                    slotIndex,
                    playerCount: selectedPlayerCount,
                    inviterId: myProfile?._id,
                    inviterName: myProfile?.fullName,
                    inviterAvatar: myProfile?.profilePic,
                    inviterCover: myProfile?.coverPic,
                }
            };
            await api.post('/web-notification/send-to-all-browsers', {
                profileId: friend?._id,
                notificationData
            });
        } catch (_e) { }
    };

    // Resolve invited friend's display name for a given slot index
    const getInvitedNameForSlot = useCallback((slotIndex) => {
        try {
            const entries = Object.entries(invitedSlotByFriendId || {});
            for (const [fid, slot] of entries) {
                if (Number(slot) === Number(slotIndex)) {
                    const pool = [...selectedFriends, ...friendList, ...searchResults];
                    const f = pool.find(u => u && String(u._id) === String(fid));
                    return f?.fullName || null;
                }
            }
        } catch (_e) { }
        return null;
    }, [invitedSlotByFriendId, selectedFriends, friendList, searchResults]);

    const copyInviteLink = async () => {
        try {
            const token = createInviteToken();
            const url = `${window.location.origin}${window.location.pathname}?ludoInvite=${encodeURIComponent(token)}`;
            await navigator.clipboard.writeText(url);
            setInviteCopied(true);
            setTimeout(() => setInviteCopied(false), 2000);
        } catch (_e) {
            setInviteCopied(false);
        }
    };

    // Helper to find all playable pieces for a given dice value
    const getPlayablePieces = useCallback((playerIndex, diceVal) => {
        const playerData = players[playerIndex];
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
    }, [players, maxSteps]);

    const rollDice = () => {
        // Prevent multiple rolls - check multiple conditions
        if (waitingForPlayers) return;
        if (!canRollDice || diceRolling) return;
        if (isRollingRef.current) return; // Additional guard
        if (onlineMode && myPlayerIndex !== currentPlayer) return; // only active player may roll online
        if (onlineMode && diceValueRef.current > 0) return; // Already have a dice value, wait for move
        
        // Prevent rapid successive rolls
        const timeSinceLastRoll = Date.now() - lastRollTimeRef.current;
        if (timeSinceLastRoll < 500) return; // Minimum 500ms between rolls
        
        // Set rolling flags immediately to prevent duplicate rolls
        isRollingRef.current = true;
        setDiceRolling(true);
        setCanRollDice(false);
        lastRollTimeRef.current = Date.now();
        
        // Ensure game is started when rolling dice
        if (!gameStarted) {
            setGameStarted(true);
            gameStartedRef.current = true;
            // Broadcast game start state if in online mode
            if (onlineMode && socketRef.current && gameId) {
                try {
                    const minimalPlayers = playersRef.current.map(p => ({
                        id: p.id,
                        name: p.name,
                        color: p.color,
                        avatar: p.avatar,
                        cover: p.cover,
                        profileId: p.profileId,
                        isActive: p.isActive !== undefined ? p.isActive : true,
                        pieces: (Array.isArray(p.pieces) ? p.pieces.map(pc => ({ id: pc.id, steps: pc.steps, isHome: pc.isHome, isInPlay: pc.isInPlay })) : [])
                    }));
                    socketRef.current.emit('ludo:players', {
                        gameId,
                        players: minimalPlayers,
                        selectedPlayerCount: selectedPlayerCountRef.current,
                        currentPlayer: currentPlayerRef.current,
                        diceValue: 0,
                        gameStarted: true,
                        gameEnded: false,
                        winners: []
                    });
                } catch (_e) {}
            }
        }
        
        // Optional debug value entry (localhost only)
        let debugChosenValue = null;
        if (isDebug) {
            try {
                const input = window.prompt('Enter dice value (1-6). Cancel = random');
                const n = Number(input);
                if (Number.isFinite(n) && n >= 1 && n <= 6) {
                    debugChosenValue = Math.floor(n);
                }
            } catch (_e) { }
        }
        
        // Animate 3D spin
        setDiceRotateX(prev => prev + 360);
        setDiceRotateY(prev => prev + 360);
        
        // Generate dice value after animation
        setTimeout(() => {
            const value = (debugChosenValue && debugChosenValue >= 1 && debugChosenValue <= 6)
                ? debugChosenValue
                : (Math.floor(Math.random() * 6) + 1);
            
            // Set dice value and broadcast
            setDiceValueImmediate(value);
            lastDiceValueRef.current = value;
            lastLocalDiceRollTimeRef.current = Date.now();
            setDiceRolling(false);
            isRollingRef.current = false;
            
            // Broadcast dice roll to other players
            if (onlineMode && socketRef.current && gameId) {
                try { 
                    socketRef.current.emit('ludo:roll', { 
                        gameId, 
                        value, 
                        by: myProfile?._id,
                        currentPlayer: currentPlayerRef.current,
                        timestamp: Date.now()
                    }); 
                } catch (_e) { }
            }

            const currentPlayerData = players[currentPlayer];
            const playablePieces = getPlayablePieces(currentPlayer, value);

            if (playablePieces.length === 0) {
                // No moves available - advance turn
                setTimeout(() => {
                    const nextPlayer = getNextActivePlayer(currentPlayer);
                setCurrentPlayer(nextPlayer);
                    currentPlayerRef.current = nextPlayer;
                    lastTurnAdvanceTimeRef.current = Date.now();
                setDiceValueImmediate(0);
                    lastLocalDiceRollTimeRef.current = 0;
                setCanRollDice(true);
                }, 400);
            } else if (playablePieces.length === 1) {
                // Only one playable piece - move it automatically
                isAutoMovingRef.current = true;
                setCanRollDice(false);
                setTimeout(() => {
                    if (diceValueRef.current === value && currentPlayerRef.current === currentPlayer) {
                    movePiece(playablePieces[0]);
                    } else {
                        isAutoMovingRef.current = false;
                        setCanRollDice(true);
                    }
                }, 200);
            } else {
                // Multiple pieces are playable - allow user to choose
                if (!gameStarted) {
                    setGameStarted(true);
                    gameStartedRef.current = true;
                }
            }
        }, 300);
    };

    const DiceSVG = ({ value, size = 80, strokeColor = '#d0d0d0' }) => {
        const pipR = 7;
        const scaleFactor = 0.75; // 10% smaller
        const pip = (cx, cy, key) => (
            <circle key={key} cx={cx} cy={cy} r={pipR} fill="#111" />
        );
        const positions = {
            1: [[50, 50]],
            2: [[30, 30], [70, 70]],
            3: [[30, 30], [50, 50], [70, 70]],
            4: [[30, 30], [70, 30], [30, 70], [70, 70]],
            5: [[30, 30], [70, 30], [50, 50], [30, 70], [70, 70]],
            6: [[30, 25], [70, 25], [30, 50], [70, 50], [30, 75], [70, 75]],
        };
        const pts = (value && positions[value]) ? positions[value] : [];
        return (
            <svg width={size} height={size} viewBox="0 0 100 100" style={{ display: 'block', filter: 'drop-shadow(0 6px 10px rgba(0,0,0,0.4))' }}>
                <defs>
                    <linearGradient id="diceGrad" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#ffffff" />
                        <stop offset="100%" stopColor="#e9e9e9" />
                    </linearGradient>
                </defs>
                <g transform={`translate(50,50) scale(${scaleFactor}) translate(-50,-50)`}>
                    <rect x="5" y="5" width="90" height="90" rx="18" ry="18" fill="url(#diceGrad)" stroke={strokeColor} strokeWidth="3" />
                    {pts.map(([x, y], idx) => pip(x, y, idx))}
                </g>
            </svg>
        );
    };

    // Animated background matching site's accent colors
    const AnimatedBackground = () => {
        const primary = '#FFD700'; // gold accent used across app
        const secondary = '#29B1A9'; // teal accent used in buttons
        const base1 = '#1a1a2e';
        const base2 = '#0f1420';
        return (
            <>
                <style>{`
                @keyframes driftA { 0% { transform: translate3d(-10%, -10%, 0) scale(1); } 50% { transform: translate3d(5%, 10%, 0) scale(1.05); } 100% { transform: translate3d(-10%, -10%, 0) scale(1); } }
                @keyframes driftB { 0% { transform: translate3d(10%, 20%, 0) scale(1); } 50% { transform: translate3d(-5%, -10%, 0) scale(1.08); } 100% { transform: translate3d(10%, 20%, 0) scale(1); } }
                @keyframes driftC { 0% { transform: translate3d(-20%, 15%, 0) scale(1); } 50% { transform: translate3d(10%, -15%, 0) scale(1.06); } 100% { transform: translate3d(-20%, 15%, 0) scale(1); } }
                `}</style>
                <div style={{ position: 'fixed', inset: 0, zIndex: -1, pointerEvents: 'none', overflow: 'hidden', background: `radial-gradient(1200px 800px at 10% -10%, ${base2} 0%, ${base1} 60%)` }}>
                    <div style={{ position: 'absolute', width: '50vw', height: '50vw', left: '-10vw', top: '-10vw', background: primary, opacity: 0.08, filter: 'blur(70px)', borderRadius: '50%', animation: 'driftA 18s ease-in-out infinite' }} />
                    <div style={{ position: 'absolute', width: '45vw', height: '45vw', right: '-12vw', top: '5vh', background: secondary, opacity: 0.10, filter: 'blur(80px)', borderRadius: '50%', animation: 'driftB 22s ease-in-out infinite' }} />
                    <div style={{ position: 'absolute', width: '60vw', height: '60vw', left: '10vw', bottom: '-20vw', background: primary, opacity: 0.06, filter: 'blur(90px)', borderRadius: '50%', animation: 'driftC 26s ease-in-out infinite' }} />
                </div>
            </>
        );
    };

    // Lightweight confetti for winner modal
    const WinnerConfetti = ({ count = 60 }) => {
        const pieces = Array.from({ length: count }).map((_, i) => {
            const left = Math.random() * 100; // vw percentage
            const size = 6 + Math.random() * 6;
            const hue = Math.floor(Math.random() * 360);
            const delay = (Math.random() * 1.5).toFixed(2) + 's';
            const duration = (2 + Math.random() * 2.5).toFixed(2) + 's';
            const rotate = Math.random() * 360;
            return (
                <div key={i} style={{
                    position: 'absolute',
                    top: -20,
                    left: left + '%',
                    width: size,
                    height: size * 0.36,
                    background: `hsl(${hue} 85% 60%)`,
                    transform: `rotate(${rotate}deg)`,
                    borderRadius: 2,
                    animation: `confettiFall ${duration} ease-in forwards`,
                    animationDelay: delay,
                    boxShadow: '0 0 6px rgba(0,0,0,0.15)'
                }} />
            );
        });
        return (
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
                <style>{`
                    @keyframes confettiFall {
                        0% { transform: translateY(-20px) rotate(0deg); opacity: 0; }
                        10% { opacity: 1; }
                        100% { transform: translateY(100vh) rotate(720deg); opacity: 0.9; }
                    }
                    @keyframes winnerPop { 0% { transform: scale(0.6); opacity: 0; } 60% { transform: scale(1.08); opacity: 1; } 100% { transform: scale(1); }
                    }
                    @keyframes winnerGlow { 0% { opacity: 0.6; transform: scale(0.9); } 50% { opacity: 1; transform: scale(1.05);} 100% { opacity: 0.6; transform: scale(0.9);} }
                    @keyframes textShine { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
                `}</style>
                {pieces}
            </div>
        );
    };

    const captureToken = (playerIndex, pieceIndex) => {
        setPlayers(prev => {
            const updated = prev.map(p => ({ ...p, pieces: p.pieces.map(pc => ({ ...pc })) }));
            const capturedPiece = updated[playerIndex]?.pieces?.[pieceIndex];
            if (!capturedPiece) return prev;
            
            // Track this capture to prevent it from being overwritten by stale broadcasts
            // Keep capture tracking longer (10 seconds) since captures are important state changes
            const captureKey = `${playerIndex}-${pieceIndex}`;
            recentMovesRef.current.set(captureKey, { toSteps: 0, timestamp: Date.now(), isCapture: true });
            
            // Clean up capture tracking after 10 seconds (longer than move tracking)
            setTimeout(() => {
                const tracked = recentMovesRef.current.get(captureKey);
                // Only delete if it's still a capture (hasn't been moved again)
                if (tracked && tracked.isCapture) {
                    const currentPiece = playersRef.current[playerIndex]?.pieces?.[pieceIndex];
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
            
            // Broadcast the capture in online mode
            if (onlineMode && socketRef.current && gameId) {
                try {
                    const minimalPlayers = updated.map(p => ({
                        id: p.id,
                        name: p.name,
                        color: p.color,
                        avatar: p.avatar,
                        cover: p.cover,
                        profileId: p.profileId,
                        isActive: p.isActive !== undefined ? p.isActive : true,
                        pieces: (Array.isArray(p.pieces) ? p.pieces.map(pc => ({ id: pc.id, steps: pc.steps, isHome: pc.isHome, isInPlay: pc.isInPlay })) : [])
                    }));
                    socketRef.current.emit('ludo:players', {
                        gameId,
                        players: minimalPlayers,
                        selectedPlayerCount: selectedPlayerCountRef.current,
                        currentPlayer: currentPlayerRef.current,
                        diceValue: diceValueRef.current || 0,
                        gameStarted: gameStartedRef.current || false,
                        gameEnded: gameEndedRef.current || false,
                        winners: winnersRef.current || []
                    });
                } catch (_e) { }
            }
            
            return updated;
        });
    };

    const animateTokenMovement = (playerIndex, pieceIndex, toSteps, fromStepsOverride, onComplete) => {
        // Optimized animation: use fewer updates for longer moves to improve performance
        const currentPlayers = playersRef.current && Array.isArray(playersRef.current) ? playersRef.current : players;
        const safePlayer = currentPlayers[playerIndex];
        const safePiece = safePlayer && Array.isArray(safePlayer.pieces) ? safePlayer.pieces[pieceIndex] : null;
        const fromSteps = (typeof fromStepsOverride === 'number' && Number.isFinite(fromStepsOverride))
            ? fromStepsOverride
            : (safePiece && typeof safePiece.steps === 'number' ? safePiece.steps : 0);
        const stepsToGo = toSteps - fromSteps;
        
        // Track this move to prevent overwrites
        const pieceKey = `${playerIndex}-${pieceIndex}`;
        recentMovesRef.current.set(pieceKey, { toSteps, timestamp: Date.now() });
        
        if (stepsToGo <= 0) {
            onComplete && onComplete();
            return;
        }
        
        // For very short moves, animate every step; for longer moves, use fewer keyframes
        const updateEvery = stepsToGo <= 3 ? 1 : Math.max(2, Math.floor(stepsToGo / 6));
        const timers = [];
        
        // Update at intervals
        for (let s = updateEvery; s < stepsToGo; s += updateEvery) {
            const timer = setTimeout(() => {
                setPlayers(prev => {
                    const copy = prev.map(p => ({ ...p, pieces: p.pieces.map(pc => ({ ...pc })) }));
                    copy[playerIndex].pieces[pieceIndex].steps = fromSteps + s;
                    copy[playerIndex].pieces[pieceIndex].isHome = false;
                    copy[playerIndex].pieces[pieceIndex].isInPlay = true;
                    return copy;
                });
            }, s * stepDurationMs);
            timers.push(timer);
        }
        
        // Final update to exact position
        const finalTimer = setTimeout(() => {
            setPlayers(prev => {
                const copy = prev.map(p => ({ ...p, pieces: p.pieces.map(pc => ({ ...pc })) }));
                copy[playerIndex].pieces[pieceIndex].steps = toSteps;
                copy[playerIndex].pieces[pieceIndex].isHome = false;
                copy[playerIndex].pieces[pieceIndex].isInPlay = true;
                return copy;
            });
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
            return;
        }
        
        // Always prefer ref value when available (prevents move from being blocked due to state sync issues)
        // The ref is updated immediately, while state updates are async
        // This matches the logic in token rendering
        const effectiveDiceValue = (diceValueRef.current > 0) ? diceValueRef.current : diceValue;
        
        if (effectiveDiceValue === 0) {
            return;
        }
        
        // Double-check: if dice value ref is 0, don't allow move (prevents race conditions)
        if (diceValueRef.current === 0 && diceValue === 0) {
            return;
        }
        
        // In online mode, only allow moves if it's the current player's turn
        if (onlineMode && myPlayerIndex !== currentPlayer) {
            return;
        }
        
        const rolledNow = effectiveDiceValue;
        const currentPlayerData = players[currentPlayer];
        if (!currentPlayerData) {
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
        
        // CRITICAL: Reset dice value IMMEDIATELY to prevent multiple moves from same roll
        setDiceValueImmediate(0);
        lastLocalDiceRollTimeRef.current = 0;

        const globalMove = () => {
            if (piece.isHome && effectiveDiceValue === 6) {
                // Move out
                const pieceKey = `${currentPlayer}-${pieceId}`;
                recentMovesRef.current.set(pieceKey, { toSteps: 1, timestamp: Date.now() });
                
                const updated = players.map(p => ({ ...p, pieces: p.pieces.map(pc => ({ ...pc })) }));
                updated[currentPlayer].pieces[pieceId] = {
                    ...piece,
                    isHome: false,
                    isInPlay: true,
                    steps: 1,
                };
                setPlayers(updated);
                if (onlineMode && socketRef.current && gameId) {
                    try { socketRef.current.emit('ludo:move', { gameId, by: myProfile?._id, playerIndex: currentPlayer, pieceIndex: pieceId, toSteps: 1, fromSteps: 0, rolled: 6 }); } catch (_e) { }
                }
                
                // Keep move protected for 2 seconds
                setTimeout(() => {
                    recentMovesRef.current.delete(pieceKey);
                }, 2000);

                // Capture at start position
                const newPosition = getPositionOnPath(currentPlayer, 1);
                const capturedPieces = checkForCapture(currentPlayer, newPosition, 1);
                capturedPieces.forEach(({ playerIndex, pieceIndex }) => {
                    // Track capture to prevent it from being overwritten
                    const captureKey = `${playerIndex}-${pieceIndex}`;
                    recentMovesRef.current.set(captureKey, { toSteps: 0, timestamp: Date.now(), isCapture: true });
                    captureToken(playerIndex, pieceIndex);
                });

                isMovingRef.current = false; // Reset moving flag
                isAutoMovingRef.current = false; // Clear auto-moving flag
                // Reset dice value so player can roll again (since it's a 6, they get another turn)
                setDiceValueImmediate(0);
                lastLocalDiceRollTimeRef.current = 0;
                setCanRollDice(true); // keep turn on 6
            } else if (piece.isInPlay) {
                const oldSteps = piece.steps;
                const oldPosition = getPositionOnPath(currentPlayer, oldSteps);
                const newSteps = piece.steps + effectiveDiceValue;
                if (newSteps <= maxSteps) {
                    if (onlineMode && socketRef.current && gameId) {
                        try { 
                            socketRef.current.emit('ludo:move', { 
                                gameId, 
                                by: myProfile?._id, 
                                playerIndex: currentPlayer, 
                                pieceIndex: pieceId, 
                                toSteps: newSteps, 
                                fromSteps: oldSteps, 
                                rolled: rolledNow 
                            });
                        } catch (_e) { }
                    }
                    // Track this move
                    const pieceKey = `${currentPlayer}-${pieceId}`;
                    recentMovesRef.current.set(pieceKey, { toSteps: newSteps, timestamp: Date.now() });
                    
                    // Capture the current player index to avoid stale closure
                    const movingPlayerIndex = currentPlayer;
                    
                    // Capture rolledNow value before animation to avoid closure issues
                    const capturedRolledValue = rolledNow;
                    
                    animateTokenMovement(movingPlayerIndex, pieceId, newSteps, undefined, () => {
                        // After animation, run capture/win checks
                        setPlayers(prev => {
                            const updatedPlayers = prev.map(p => ({ ...p, pieces: p.pieces.map(pc => ({ ...pc })) }));
                            updatedPlayers[movingPlayerIndex].pieces[pieceId].steps = newSteps;
                            updatedPlayers[movingPlayerIndex].pieces[pieceId].isHome = false;
                            updatedPlayers[movingPlayerIndex].pieces[pieceId].isInPlay = newSteps > 0 && newSteps < maxSteps;
                            return updatedPlayers;
                        });
                        
                        // Keep move protected for 2 seconds after completion
                        setTimeout(() => {
                            recentMovesRef.current.delete(pieceKey);
                        }, 2000);

                        let didCapture = false;
                        if (newSteps < maxSteps) {
                            const newPosition = getPositionOnPath(movingPlayerIndex, newSteps);
                            
                            // Check for captures at the new position
                            // Pass newSteps to ensure the moving piece is counted correctly
                            const capturedPieces = checkForCapture(movingPlayerIndex, newPosition, newSteps);
                            didCapture = Array.isArray(capturedPieces) && capturedPieces.length > 0;
                            capturedPieces.forEach(({ playerIndex, pieceIndex }) => {
                                // Track capture to prevent it from being overwritten
                                const captureKey = `${playerIndex}-${pieceIndex}`;
                                recentMovesRef.current.set(captureKey, { toSteps: 0, timestamp: Date.now(), isCapture: true });
                                captureToken(playerIndex, pieceIndex);
                            });
                            
                            // Check for captures at the old position (when token moves away)
                            // This handles the case where friend has double tokens and moves one away,
                            // leaving a single token that should be captured
                            if (oldSteps > 0 && oldSteps < maxSteps) {
                                const capturedAfterMoveAway = checkForCaptureAfterMoveAway(movingPlayerIndex, oldPosition);
                                if (capturedAfterMoveAway.length > 0) {
                                    didCapture = true; // Count this as a capture for turn purposes
                                    capturedAfterMoveAway.forEach(({ playerIndex, pieceIndex }) => {
                                        // Track capture to prevent it from being overwritten
                                        const captureKey = `${playerIndex}-${pieceIndex}`;
                                        recentMovesRef.current.set(captureKey, { toSteps: 0, timestamp: Date.now(), isCapture: true });
                                        captureToken(playerIndex, pieceIndex);
                                    });
                                }
                            }
                        }

                        if (newSteps === maxSteps) {
                            setPlayers(prev => {
                                const updatedPlayers = prev.map(p => ({ ...p, pieces: p.pieces.map(pc => ({ ...pc })) }));
                                const finishedCount = updatedPlayers[movingPlayerIndex].pieces.filter(p => p.steps === maxSteps).length;
                                if (finishedCount === 4) {
                                    const winnerPlayer = updatedPlayers[movingPlayerIndex];
                                    const newWinners = [...winners, winnerPlayer];
                                    setWinners(newWinners);
                                    setWinner(winnerPlayer);
                                    setShowWinnerModal(true);
                                    const remainingPlayers = updatedPlayers.filter((_, idx) => idx < selectedPlayerCount);
                                    if (newWinners.length >= remainingPlayers.length - 1) {
                                        setGameEnded(true);
                                    }
                                }
                                return updatedPlayers;
                            });
                        }

                        // Verify final state before completing
                        const finalState = playersRef.current[movingPlayerIndex]?.pieces[pieceId];
                        
                        // If state doesn't match, force update one more time
                        if (finalState?.steps !== newSteps) {
                            setPlayers(prev => {
                                const corrected = prev.map(p => ({ ...p, pieces: p.pieces.map(pc => ({ ...pc })) }));
                                corrected[movingPlayerIndex].pieces[pieceId].steps = newSteps;
                                corrected[movingPlayerIndex].pieces[pieceId].isHome = false;
                                corrected[movingPlayerIndex].pieces[pieceId].isInPlay = newSteps > 0 && newSteps < maxSteps;
                                return corrected;
                            });
                        }
                        
                        isMovingRef.current = false; // Reset moving flag
                        isAutoMovingRef.current = false; // Clear auto-moving flag
                        
                        // Determine if player should keep turn: rolled 6 OR captured a token
                        // CRITICAL: Use the captured rolled value to avoid closure issues
                        const rolledValue = typeof capturedRolledValue === 'number' ? capturedRolledValue : 0;
                        const isSix = rolledValue === 6;
                        const hasCapture = didCapture === true;
                        const keepTurn = isSix || hasCapture;
                        
                        // CRITICAL: Always reset dice value first (regardless of keepTurn)
                        setDiceValueImmediate(0);
                        lastLocalDiceRollTimeRef.current = 0;
                        
                        if (keepTurn) {
                            // Player keeps turn (rolled 6 or captured) - don't advance
                            setCanRollDice(true);
                            // Broadcast state after move completes
                            if (onlineMode && socketRef.current && gameId) {
                                try {
                                    const minimalPlayers = playersRef.current.map(p => ({
                                        id: p.id,
                                        name: p.name,
                                        color: p.color,
                                        avatar: p.avatar,
                                        cover: p.cover,
                                        profileId: p.profileId,
                                        isActive: p.isActive !== undefined ? p.isActive : true,
                                        pieces: (Array.isArray(p.pieces) ? p.pieces.map(pc => ({ id: pc.id, steps: pc.steps, isHome: pc.isHome, isInPlay: pc.isInPlay })) : [])
                                    }));
                                    socketRef.current.emit('ludo:players', {
                                        gameId,
                                        players: minimalPlayers,
                                        selectedPlayerCount: selectedPlayerCountRef.current,
                                        currentPlayer: currentPlayerRef.current,
                                        diceValue: 0,
                                        gameStarted: gameStartedRef.current || false,
                                        gameEnded: gameEndedRef.current || false,
                                        winners: winnersRef.current || []
                                    });
                                } catch (_e) { }
                            }
                        } else {
                            // CRITICAL: Advance to next player - this MUST happen for non-6, non-capture moves
                            const nextPlayer = getNextActivePlayer(movingPlayerIndex);
                            
                            // Force update current player and ref immediately - use both setState and direct ref update
                                setCurrentPlayer(nextPlayer);
                            currentPlayerRef.current = nextPlayer; // Update ref immediately to prevent race conditions
                            lastTurnAdvanceTimeRef.current = Date.now(); // Track when we advanced the turn locally
                                setCanRollDice(true);
                            
                            // Broadcast state after turn advances
                            if (onlineMode && socketRef.current && gameId) {
                                try {
                                    const minimalPlayers = playersRef.current.map(p => ({
                                        id: p.id,
                                        name: p.name,
                                        color: p.color,
                                        avatar: p.avatar,
                                        cover: p.cover,
                                        profileId: p.profileId,
                                        isActive: p.isActive !== undefined ? p.isActive : true,
                                        pieces: (Array.isArray(p.pieces) ? p.pieces.map(pc => ({ id: pc.id, steps: pc.steps, isHome: pc.isHome, isInPlay: pc.isInPlay })) : [])
                                    }));
                                    socketRef.current.emit('ludo:players', {
                                        gameId,
                                        players: minimalPlayers,
                                        selectedPlayerCount: selectedPlayerCountRef.current,
                                        currentPlayer: nextPlayer,
                                        diceValue: 0,
                                        gameStarted: gameStartedRef.current || false,
                                        gameEnded: gameEndedRef.current || false,
                                        winners: winnersRef.current || []
                                    });
                                } catch (_e) { }
                            }
                        }
                    });
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

        const onRoll = (payload) => {
            if (!payload || payload.gameId !== gameId) return;
            // Skip if this roll was from the current user (handled in rollDice)
            if (payload.by && myProfile?._id && String(payload.by) === String(myProfile._id)) return;
            
            // Only accept rolls if it's the correct player's turn
            const payloadPlayer = typeof payload.currentPlayer === 'number' ? payload.currentPlayer : currentPlayerRef.current;
            if (payloadPlayer !== currentPlayerRef.current) {
                // Wrong player - ignore this roll
                return;
            }
            
            // Prevent conflicts - if we're rolling locally, ignore remote roll
            if (isRollingRef.current || diceRolling) {
                return;
            }
            
            const value = payload.value;
            setDiceValueImmediate(value);
            setDiceRolling(false);
            lastDiceValueRef.current = value;
            isRollingRef.current = false; // Clear rolling flag
            
            const currentPlayerData = playersRef.current[currentPlayerRef.current];
            
            // Check if current player can move
            const canMove = currentPlayerData?.pieces?.some(piece => {
                if (piece.isHome && value === 6) return true;
                if (piece.isInPlay && piece.steps + value <= maxStepsRef.current) return true;
                return false;
            });
            
            if (!canMove) {
                // No moves available - advance turn
                setTimeout(() => {
                    const nextPlayer = getNextActivePlayer(currentPlayerRef.current);
                setCurrentPlayer(nextPlayer);
                    currentPlayerRef.current = nextPlayer;
                    lastTurnAdvanceTimeRef.current = Date.now();
                setDiceValueImmediate(0);
                    lastLocalDiceRollTimeRef.current = 0;
                setCanRollDice(true);
                }, 600);
            }
        };

        const onAccepted = (payload) => {
            try {
                if (!payload || payload.gameId !== gameId) return;
                // Only process accept events if we're the host (myPlayerIndex === 0)
                // This ensures only the host processes friend join events
                if (myPlayerIndex !== 0) {
                    console.log(`[onAccepted] Ignoring accept event - not host (myPlayerIndex=${myPlayerIndex})`);
                    return;
                }
                // Don't process accept events for ourselves
                if (payload.friend && payload.friend._id && myProfile?._id && String(payload.friend._id) === String(myProfile._id)) {
                    console.log(`[onAccepted] Ignoring accept event - friend is ourselves`);
                    return;
                }
                // Host updates: friend joined; update status and broadcast players
                // Only mark as 'joined' if the friend was actually invited (not already joined or declined)
                if (payload.friend && payload.friend._id) {
                    const friendId = payload.friend._id;
                    const friendIdStr = String(friendId);
                    // Use ref for synchronous check to avoid race conditions - try both string and original key
                    // Note: payload.from is the host/inviter, payload.friend._id is the friend who accepted
                    const currentStatus = invitedStatusByFriendIdRef.current[friendIdStr] || invitedStatusByFriendIdRef.current[friendId];
                    const expectedSlot = invitedSlotByFriendIdRef.current[friendIdStr] || invitedSlotByFriendIdRef.current[friendId];
                    console.log(`[onAccepted] friendId=${friendId} (as string: ${friendIdStr}), currentStatus=${currentStatus}, expectedSlot=${expectedSlot}, payload.slotIndex=${payload.slotIndex}, myPlayerIndex=${myPlayerIndex}, payload.from=${payload.from}`);
                    
                    // CRITICAL: Ignore accept events that arrive too soon after sending invite (within 1 second)
                    // This prevents processing events that are incorrectly fired immediately after invite
                    const inviteTimestamp = inviteTimestampsRef.current[friendIdStr] || inviteTimestampsRef.current[friendId];
                    if (inviteTimestamp && Date.now() - inviteTimestamp < 1000) {
                        console.log(`[onAccepted] Ignoring accept event - received too soon after invite (${Date.now() - inviteTimestamp}ms ago, need at least 1000ms)`);
                        return;
                    }
                    
                    // CRITICAL: Only process if friend was previously 'invited' - this ensures we don't process events that fire before friend accepts
                    if (currentStatus !== 'invited') {
                        console.log(`[onAccepted] Ignoring accept event - friend status is '${currentStatus}', not 'invited'`);
                        return;
                    }
                    
                    // Only update to 'joined' if:
                    // 1. The friend was previously 'invited' (not already joined or declined) - checked above
                    // 2. The slot index matches the slot we invited them to (if provided)
                    const slotMatches = typeof payload.slotIndex !== 'number' || expectedSlot === undefined || Number(payload.slotIndex) === Number(expectedSlot);
                    console.log(`[onAccepted] slotMatches=${slotMatches}, currentStatus === 'invited': ${currentStatus === 'invited'}`);
                    if (slotMatches) {
                        setInvitedStatusByFriendId(prev => {
                            const updated = { ...prev, [friendIdStr]: 'joined' };
                            console.log(`[onAccepted] Setting status to 'joined' for friend ${friendIdStr}, updated status:`, updated);
                            return updated;
                        });
                    } else {
                        console.log(`[onAccepted] Ignoring accept event - slot doesn't match (expected ${expectedSlot}, got ${payload.slotIndex})`);
                        return;
                    }
                } else {
                    // No friend data in payload, ignore
                    console.log(`[onAccepted] Ignoring accept event - no friend data in payload`);
                    return;
                }
                if (typeof payload.slotIndex === 'number') {
                    setPlayers(prev => {
                        const copy = prev.map(p => ({ ...p, pieces: p.pieces.map(pc => ({ ...pc })) }));
                        const slot = payload.slotIndex;
                        if (copy[slot]) {
                            copy[slot].name = payload.friend?.fullName || copy[slot].name;
                            copy[slot].avatar = payload.friend?.profilePic || copy[slot].avatar;
                            copy[slot].cover = payload.friend?.coverPic || copy[slot].cover;
                            copy[slot].profileId = payload.friend?._id || copy[slot].profileId;
                            copy[slot].isActive = true;
                        }
                        return copy;
                    });
                    
                    // Use setTimeout to ensure state update completes before recomputing
                    setTimeout(() => {
                        // Broadcast current players snapshot with full game state
                        try {
                            const minimalPlayers = playersRef.current.map(p => ({
                                id: p.id,
                                name: p.name,
                                color: p.color,
                                avatar: p.avatar,
                                cover: p.cover,
                                profileId: p.profileId,
                                isActive: p.isActive !== undefined ? p.isActive : true,
                                pieces: (Array.isArray(p.pieces) ? p.pieces.map(pc => ({ id: pc.id, steps: pc.steps, isHome: pc.isHome, isInPlay: pc.isInPlay })) : [])
                            }));
                            s.emit('ludo:players', { 
                                gameId: payload.gameId, 
                                players: minimalPlayers, 
                                selectedPlayerCount: selectedPlayerCountRef.current, 
                                currentPlayer: currentPlayerRef.current,
                                diceValue: diceValueRef.current || 0,
                                gameStarted: gameStartedRef.current || false,
                                gameEnded: gameEndedRef.current || false,
                                winners: winnersRef.current || []
                            });
                        } catch (_e) { }
                        // Update lobby state based on new join
                        recomputeWaitingState();
                    }, 100);
                } else {
                    // If no slot index, still recompute
                    recomputeWaitingState();
                }
            } catch (_e) { }
        };

        const onPlayers = (payload) => {
            try {
                if (!payload || payload.gameId !== gameId) return;
                
                // Check if this is a rejoin scenario (game already started but we're receiving state)
                const isRejoining = gameStarted && payload.players && Array.isArray(payload.players) && payload.players.some(p => p.pieces && p.pieces.some(pc => pc.steps > 0));
                
                // If game has started (from payload or local state), clear waiting state immediately
                if (payload.gameStarted || gameStarted || isRejoining) {
                    setWaitingForPlayers(false);
                    setCanRollDice(true);
                }
                
                // Don't ignore broadcasts - always process them to keep state in sync
                // But protect dice value if we recently rolled locally
                const isMyTurn = currentPlayerRef.current === myPlayerIndex;
                const hasActiveDice = diceValueRef.current > 0;
                const timeSinceLocalRoll = Date.now() - lastLocalDiceRollTimeRef.current;
                const recentlyRolledLocally = timeSinceLocalRoll < 5000 && lastLocalDiceRollTimeRef.current > 0;
                const shouldProtectDiceValue = isMyTurn && (hasActiveDice || recentlyRolledLocally);
                
                if (Array.isArray(payload.players)) {
                    const next = payload.players.map(p => ({
                        ...p,
                        pieces: Array.isArray(p.pieces) ? p.pieces.map(pc => ({ 
                            id: pc.id || pc.id,
                            steps: typeof pc.steps === 'number' ? pc.steps : 0,
                            isHome: typeof pc.isHome === 'boolean' ? pc.isHome : (pc.steps === 0),
                            isInPlay: typeof pc.isInPlay === 'boolean' ? pc.isInPlay : (pc.steps > 0 && pc.steps < maxStepsRef.current)
                        })) : []
                    }));
                    
                    // Invitee-side guard: ensure seat 0 is inviter, and my slot is me
                    try {
                        // Always enforce seat 0 = host (inviter) on invitee devices
                        if (myPlayerIndex !== 0 && next[0] && lastInviter?.id) {
                            next[0].profileId = lastInviter.id;
                            if (lastInviter.name) next[0].name = lastInviter.name;
                            if (lastInviter.avatar) next[0].avatar = lastInviter.avatar;
                            if (lastInviter.cover) next[0].cover = lastInviter.cover;
                        } else if (myPlayerIndex !== 0 && next[0]) {
                            // If inviter not known yet but seat 0 equals me, clear mistaken identity to avoid showing me as host
                            const looksLikeMe = next[0].profileId && myProfile?._id && String(next[0].profileId) === String(myProfile._id);
                            if (looksLikeMe) {
                                next[0].profileId = next[0].profileId || undefined;
                                // keep name/avatar as-is; host snapshot should correct soon
                            }
                        }
                        // Resolve my slot from snapshot by matching my profileId; fall back to current myPlayerIndex
                        let resolvedMyIndex = undefined;
                        const myId = myProfile?._id;
                        if (myId) {
                            const foundIdx = next.findIndex(p => p && p.profileId && String(p.profileId) === String(myId));
                            if (foundIdx >= 0) {
                                resolvedMyIndex = foundIdx;
                                if (foundIdx !== myPlayerIndex) setMyPlayerIndex(foundIdx);
                            }
                        }
                        if (resolvedMyIndex == null && typeof myPlayerIndex === 'number') {
                            resolvedMyIndex = myPlayerIndex;
                        }
                        if (typeof resolvedMyIndex === 'number' && next[resolvedMyIndex]) {
                            next[resolvedMyIndex].profileId = myProfile?._id || next[resolvedMyIndex].profileId;
                            next[resolvedMyIndex].name = myProfile?.fullName || next[resolvedMyIndex].name;
                            next[resolvedMyIndex].avatar = myProfile?.profilePic || next[resolvedMyIndex].avatar;
                            // Prefer an actual cover image over avatar when available
                            const myCover = myProfile?.coverPic || myProfile?.coverPic || myProfile?.coverPic || myProfile?.coverPic;
                            if (myCover) next[resolvedMyIndex].cover = myCover;
                        }
                    } catch (_e) {}
                    // Merge with previous known seats to avoid wiping already joined players if snapshot is momentarily incomplete
                    try {
                        const maxPlayers = Math.max(2, Math.min(4, typeof payload.selectedPlayerCount === 'number' ? payload.selectedPlayerCount : selectedPlayerCountRef.current));
                        const prev = playersRef.current || [];
                        for (let i = 0; i < maxPlayers; i++) {
                            const hasIncomingId = next[i] && next[i].profileId;
                            const prevId = prev[i] && prev[i].profileId;
                            if (!hasIncomingId && prevId) {
                                next[i] = {
                                    id: typeof next[i]?.id === 'number' ? next[i].id : (prev[i]?.id ?? i),
                                    name: next[i]?.name || prev[i]?.name,
                                    color: next[i]?.color || prev[i]?.color,
                                    avatar: next[i]?.avatar || prev[i]?.avatar,
                                    cover: next[i]?.cover || prev[i]?.cover,
                                    profileId: prevId,
                                    isActive: next[i]?.isActive !== undefined ? next[i].isActive : (prev[i]?.isActive !== undefined ? prev[i].isActive : true),
                                    pieces: Array.isArray(next[i]?.pieces) ? next[i].pieces : (Array.isArray(prev[i]?.pieces) ? prev[i].pieces.map(pc => ({ ...pc })) : [])
                                };
                            }
                        }
                    } catch (_e) {}
                    
                    // Protect recent local moves from being overwritten by broadcasts
                    // Check if any pieces were recently moved locally and preserve their positions
                    // CRITICAL: Never allow tokens to move backward
                    const now = Date.now();
                    const isMoveInProgress = isMovingRef.current || moveTimersRef.current.length > 0 || isAutoMovingRef.current;
                    const protectedNext = next.map((player, playerIndex) => {
                        if (!player || !Array.isArray(player.pieces)) return player;
                        const protectedPieces = player.pieces.map((piece, pieceIndex) => {
                            const pieceKey = `${playerIndex}-${pieceIndex}`;
                            const recentMove = recentMovesRef.current.get(pieceKey);
                                const currentPiece = playersRef.current[playerIndex]?.pieces[pieceIndex];
                                const currentSteps = currentPiece?.steps ?? 0;
                                const broadcastSteps = piece?.steps ?? 0;
                                const currentIsHome = currentPiece?.isHome ?? false;
                                const broadcastIsHome = piece?.isHome ?? false;
                                
                            // CRITICAL: Protect captured tokens - if a token was captured (sent home), never restore it
                            if (recentMove && recentMove.isCapture && currentIsHome && currentSteps === 0) {
                                // This token was captured locally, never restore it from broadcast
                                return {
                                    ...piece,
                                    steps: 0,
                                    isHome: true,
                                    isInPlay: false
                                };
                            }
                            
                            // CRITICAL: Never allow backward movement - always protect if current position is ahead
                            if (currentSteps > broadcastSteps) {
                                // Current position is ahead, never go backward
                                return {
                                    ...piece,
                                    steps: currentSteps,
                                    isHome: currentSteps === 0,
                                    isInPlay: currentSteps > 0 && currentSteps < maxStepsRef.current
                                };
                            }
                            
                            // If a move is in progress globally, be extra cautious
                            // If this piece was moved locally within the last 5 seconds, preserve its position
                            if (recentMove && (now - recentMove.timestamp) < 5000) {
                                // Protect if:
                                // 1. Current state matches the recent move target (move completed successfully)
                                // 2. Broadcast is trying to revert to an older position (stale broadcast) - never allow backward
                                // 3. A move is in progress and this piece is part of it
                                // 4. Current position is at or ahead of the target (move completed or in progress)
                                // 5. This is a capture (toSteps = 0, isHome = true)
                                const shouldProtect = recentMove.isCapture || 
                                    currentSteps === recentMove.toSteps || 
                                    (broadcastSteps < recentMove.toSteps && currentSteps >= recentMove.toSteps) ||
                                    (isMoveInProgress && currentSteps >= recentMove.toSteps - 1) ||
                                    (currentSteps >= recentMove.toSteps); // Always protect if we're at or past the target
                                
                                if (shouldProtect) {
                                    // Use the higher of current steps or target steps to prevent backward movement
                                    // For captures, always use 0
                                    const protectedSteps = recentMove.isCapture ? 0 : Math.max(currentSteps, recentMove.toSteps);
                                    return {
                                        ...piece,
                                        steps: protectedSteps,
                                        isHome: protectedSteps === 0 || (recentMove.isCapture ? true : piece.isHome),
                                        isInPlay: protectedSteps > 0 && protectedSteps < maxStepsRef.current && !recentMove.isCapture
                                    };
                                }
                            }
                            
                            // If no recent move but current is ahead, still protect
                            if (currentSteps > broadcastSteps) {
                                return {
                                    ...piece,
                                    steps: currentSteps,
                                    isHome: currentSteps === 0,
                                    isInPlay: currentSteps > 0 && currentSteps < maxStepsRef.current
                                };
                            }
                            
                            // Protect captured tokens: if current state shows token is home (captured), don't restore it
                            if (currentIsHome && currentSteps === 0 && !broadcastIsHome && broadcastSteps > 0) {
                                // Token was captured locally, don't restore from broadcast
                                return {
                                    ...piece,
                                    steps: 0,
                                    isHome: true,
                                    isInPlay: false
                                };
                            }
                            
                            return piece;
                        });
                        return { ...player, pieces: protectedPieces };
                    });
                    
                    setPlayers(protectedNext);
                    
                    // Update waiting state after players state is updated
                    setTimeout(() => {
                        recomputeWaitingState();
                    }, 100);
                }
                if (typeof payload.selectedPlayerCount === 'number') {
                    setSelectedPlayerCount(payload.selectedPlayerCount);
                }
                
                // Check dice value BEFORE updating currentPlayer to avoid race conditions
                // We need to check if it's our turn using BOTH current ref and payload value
                if (typeof payload.diceValue === 'number') {
                    const localDiceValue = diceValueRef.current || 0;
                    const currentTurnFromRef = currentPlayerRef.current === myPlayerIndex;
                    const currentTurnFromPayload = typeof payload.currentPlayer === 'number' && payload.currentPlayer === myPlayerIndex;
                    const isMyTurnFromPayload = currentTurnFromRef || currentTurnFromPayload;
                    
                    // CRITICAL: If a move just completed, never restore dice value from broadcast
                    // A move completion means dice should be 0 (either for next player or for same player to roll again)
                    const moveJustCompleted = isMovingRef.current === false && (moveTimersRef.current.length === 0);
                    const shouldIgnoreDiceBroadcast = moveJustCompleted && localDiceValue === 0;
                    
                    // Preserve local dice value if it's our turn and we have an active dice value
                    // OR if we recently rolled locally (within last 5 seconds)
                    // OR if a move just completed and dice is already 0 (don't restore from broadcast)
                    const shouldPreserve = shouldProtectDiceValue || (isMyTurnFromPayload && localDiceValue > 0) || shouldIgnoreDiceBroadcast;
                    
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
                
                if (typeof payload.currentPlayer === 'number') {
                    // CRITICAL: Protect against overwriting turn advancement after a local move
                    // If a move just completed locally, we may have already advanced the turn
                    // Don't let stale broadcast values revert the turn back
                    const moveJustCompleted = isMovingRef.current === false && (moveTimersRef.current.length === 0);
                    const localCurrentPlayer = currentPlayerRef.current;
                    const payloadCurrentPlayer = payload.currentPlayer;
                    const timeSinceTurnAdvance = Date.now() - lastTurnAdvanceTimeRef.current;
                    
                    // If we recently advanced the turn locally (within last 2 seconds) and the payload
                    // has a different (older) value, ignore it to prevent reverting the turn
                    const recentlyAdvancedTurn = timeSinceTurnAdvance < 2000 && lastTurnAdvanceTimeRef.current > 0;
                    const shouldIgnoreCurrentPlayerBroadcast = (moveJustCompleted || recentlyAdvancedTurn) && 
                        localCurrentPlayer !== payloadCurrentPlayer &&
                        localCurrentPlayer !== undefined;
                    
                    if (!shouldIgnoreCurrentPlayerBroadcast) {
                        // Only update if the payload value is different from local
                        if (payloadCurrentPlayer !== localCurrentPlayer) {
                            setCurrentPlayer(payloadCurrentPlayer);
                        }
                    } else {
                        // Log for debugging - we're ignoring a stale broadcast
                        if (__DEV__) {
                        }
                    }
                }
                if (payload.gameStarted !== undefined) {
                    setGameStarted(payload.gameStarted);
                    // If game started, clear waiting state
                    if (payload.gameStarted) {
                        setWaitingForPlayers(false);
                        setCanRollDice(true);
                    }
                }
                if (payload.gameEnded !== undefined) {
                    setGameEnded(payload.gameEnded);
                }
                if (Array.isArray(payload.winners)) {
                    setWinners(payload.winners);
                }
            } catch (_e) { }
        };

        const onMove = (payload) => {
            if (!payload || payload.gameId !== gameId) return;
            if (payload.by && myProfile?._id && String(payload.by) === String(myProfile._id)) return;
            const { playerIndex, pieceIndex, toSteps, fromSteps } = payload;
            const mover = typeof playerIndex === 'number' ? playerIndex : currentPlayerRef.current;
            const oldSteps = typeof fromSteps === 'number' ? fromSteps : 0;
            const oldPosition = oldSteps > 0 && oldSteps < maxStepsRef.current ? getPositionOnPath(mover, oldSteps) : null;
            
            // Track this remote move to protect it from being overwritten
            const pieceKey = `${mover}-${pieceIndex}`;
            recentMovesRef.current.set(pieceKey, { toSteps, timestamp: Date.now() });
            
            animateTokenMovement(mover, pieceIndex, toSteps, oldSteps, () => {
                setPlayers(prev => {
                    const updatedPlayers = prev.map(p => ({ ...p, pieces: p.pieces.map(pc => ({ ...pc })) }));
                    updatedPlayers[mover].pieces[pieceIndex].steps = toSteps;
                    updatedPlayers[mover].pieces[pieceIndex].isHome = false;
                    updatedPlayers[mover].pieces[pieceIndex].isInPlay = toSteps > 0 && toSteps < maxStepsRef.current;
                    return updatedPlayers;
                });
                
                // Keep move protected for 2 seconds after completion
                setTimeout(() => {
                    recentMovesRef.current.delete(pieceKey);
                }, 2000);

                let didCapture = false;
                if (toSteps < maxStepsRef.current) {
                    const newPosition = getPositionOnPath(mover, toSteps);
                    
                    // Check for captures at the new position
                    // Pass toSteps to ensure the moving piece is counted correctly
                    const capturedPieces = checkForCapture(mover, newPosition, toSteps);
                    didCapture = Array.isArray(capturedPieces) && capturedPieces.length > 0;
                    capturedPieces.forEach(({ playerIndex: pi, pieceIndex: pj }) => {
                        // Track capture for remote moves too
                        const captureKey = `${pi}-${pj}`;
                        recentMovesRef.current.set(captureKey, { toSteps: 0, timestamp: Date.now(), isCapture: true });
                        captureToken(pi, pj);
                    });
                    
                    // Check for captures at the old position (when token moves away)
                    // This handles the case where friend has double tokens and moves one away,
                    // leaving a single token that should be captured
                    if (oldPosition && oldSteps > 0 && oldSteps < maxStepsRef.current) {
                        const capturedAfterMoveAway = checkForCaptureAfterMoveAway(mover, oldPosition);
                        if (capturedAfterMoveAway.length > 0) {
                            didCapture = true;
                            capturedAfterMoveAway.forEach(({ playerIndex: pi, pieceIndex: pj }) => {
                                // Track capture for remote moves too
                                const captureKey = `${pi}-${pj}`;
                                recentMovesRef.current.set(captureKey, { toSteps: 0, timestamp: Date.now(), isCapture: true });
                                captureToken(pi, pj);
                            });
                        }
                    }
                }

                if (toSteps === maxStepsRef.current) {
                    setPlayers(prev => {
                        const updatedPlayers = prev.map(p => ({ ...p, pieces: p.pieces.map(pc => ({ ...pc })) }));
                        const finishedCount = updatedPlayers[mover].pieces.filter(p => p.steps === maxStepsRef.current).length;
                        if (finishedCount === 4) {
                            const winnerPlayer = updatedPlayers[mover];
                            const newWinners = [...winnersRef.current, winnerPlayer];
                            setWinners(newWinners);
                            setWinner(winnerPlayer);
                            setShowWinnerModal(true);
                            const remainingPlayers = updatedPlayers.filter((_, idx) => idx < selectedPlayerCountRef.current);
                            if (newWinners.length >= remainingPlayers.length - 1) {
                                setGameEnded(true);
                            }
                        }
                        return updatedPlayers;
                    });
                }

                setDiceValueImmediate(0);
                lastLocalDiceRollTimeRef.current = 0; // Reset timestamp after move completes
                const rolled = Number(payload?.rolled);
                const keepTurn = rolled === 6 || didCapture;
                if (!keepTurn) {
                    setTimeout(() => {
                        const nextPlayer = getNextActivePlayer(mover);
                        setCurrentPlayer(nextPlayer);
                        currentPlayerRef.current = nextPlayer;
                        lastTurnAdvanceTimeRef.current = Date.now();
                        setCanRollDice(true);
                    }, 200);
                } else {
                    setCanRollDice(true);
                }
            });
        };

        const onPlayerOffline = (payload) => {
            try {
                if (!payload || payload.gameId !== gameId) return;
                const pid = String(payload.profileId || '');
                if (!pid) return;
                // Update player status
                setPlayers(prev => prev.map(p => {
                    if (p.profileId && String(p.profileId) === pid) {
                        return { ...p, isActive: false, isOffline: true, offlineSince: payload.timestamp };
                    }
                    return p;
                }));
            } catch (_e) {}
        };

        const onPlayerOnline = (payload) => {
            try {
                if (!payload || payload.gameId !== gameId) return;
                const pid = String(payload.profileId || '');
                if (!pid) return;
                // Update player status
                setPlayers(prev => prev.map(p => {
                    if (p.profileId && String(p.profileId) === pid) {
                        return { ...p, isActive: true, isOffline: false, offlineSince: undefined };
                    }
                    return p;
                }));
            } catch (_e) {}
        };

        s.on('ludo:roll', onRoll);
        s.on('ludo:accepted', onAccepted);
        s.on('ludo:players', onPlayers);
        s.on('ludo:move', onMove);
        s.on('ludo:player:offline', onPlayerOffline);
        s.on('ludo:player:online', onPlayerOnline);
        const onJoined = (payload) => { };
        s.on('ludo:joined', onJoined);
        return () => {
            s.off('ludo:roll', onRoll);
            s.off('ludo:accepted', onAccepted);
            s.off('ludo:players', onPlayers);
            s.off('ludo:move', onMove);
            s.off('ludo:player:offline', onPlayerOffline);
            s.off('ludo:player:online', onPlayerOnline);
            s.off('ludo:joined', onJoined);
        };
    }, [onlineMode, gameId, myProfile?._id]);

    // Recompute waiting state whenever invite statuses or players change
    useEffect(() => {
        recomputeWaitingState();
    }, [invitedStatusByFriendId, players, selectedPlayerCount, onlineMode, myPlayerIndex, recomputeWaitingState]);

    // When waiting ends, allow dice interactions again
    useEffect(() => {
        if (!waitingForPlayers && !gameStarted) {
            // If not waiting and game hasn't started, allow dice roll only if all players joined
            const maxPlayers = Math.max(2, Math.min(4, selectedPlayerCount));
            const joinedSeats = players.slice(1, maxPlayers).filter(p => p && p.profileId).length;
            const allSeatsFilled = joinedSeats >= (maxPlayers - 1);
            if (allSeatsFilled) {
                setCanRollDice(true);
            } else {
                setCanRollDice(false);
            }
        } else if (!waitingForPlayers && gameStarted) {
            setCanRollDice(true);
        } else if (waitingForPlayers) {
            setCanRollDice(false);
        }
    }, [waitingForPlayers, gameStarted, players, selectedPlayerCount]);

    // Invite listeners attached regardless of onlineMode, so users receive invites anytime
    useEffect(() => {
        let retryTimer = null;
        let usedSocket = null;
        const attach = () => {
            const s = socketRef.current;
            if (!s) { retryTimer = setTimeout(attach, 300); return; }
            if (inviteHandlersAttachedRef.current) return;
            const onInvite = (payload) => {
                try {
                    if (!payload) return;
                    if (payload.to && myProfile?._id && String(payload.to) !== String(myProfile._id)) return;
                try {
                    if (payload?.by) setLastInviter({ id: payload.by, name: payload.name, avatar: payload.avatar, cover: payload.cover });
                } catch (_e) {}
                    setPendingInvites(prev => {
                        const exists = prev.find(i => String(i.gameId) === String(payload.gameId) && String(i.from) === String(payload.by));
                        if (exists) return prev;
                        const inv = {
                            from: payload.by,
                            name: payload.name,
                            avatar: payload.avatar,
                            cover: payload.cover,
                            gameId: payload.gameId,
                            slotIndex: payload.slotIndex,
                            playerCount: payload.playerCount,
                            ts: payload.ts || Date.now(),
                        };
                        return [inv, ...prev].slice(0, 20);
                    });
                } catch (_e) { }
            };
            const onInvites = (payload) => {
                try {
                    const arr = Array.isArray(payload?.invites) ? payload.invites : [];
                    const normalized = arr.map(x => ({
                        from: x.by ?? x.from,
                        name: x.name,
                        avatar: x.avatar,
                        cover: x.cover,
                        gameId: x.gameId,
                        slotIndex: x.slotIndex,
                        playerCount: x.playerCount,
                        ts: x.ts || Date.now()
                    }));
                    setPendingInvites(normalized);
                    try {
                        if (normalized[0]?.from) setLastInviter({ id: normalized[0].from, name: normalized[0].name, avatar: normalized[0].avatar });
                    } catch (_e) {}
                } catch (_e) { }
            };
            s.on('ludo:invite', onInvite);
            s.on('ludo:invites', onInvites);
            usedSocket = s;
            inviteHandlersAttachedRef.current = true;
            // store handlers on socket for cleanup
            s.__ludoInviteHandlers = { onInvite, onInvites };
        };
        attach();
        return () => {
            if (retryTimer) clearTimeout(retryTimer);
            try {
                const s = usedSocket || socketRef.current;
                const h = s && s.__ludoInviteHandlers;
                if (s && h) {
                    s.off('ludo:invite', h.onInvite);
                    s.off('ludo:invites', h.onInvites);
                }
            } catch (_e) { }
            inviteHandlersAttachedRef.current = false;
        };
    }, [myProfile?._id]);

    // Cleanup socket on unmount
    useEffect(() => {
        return () => {
            cleanupSocket();
        };
    }, [cleanupSocket]);

    // Request latest players snapshot after joining a game (late join sync)
    useEffect(() => {
        const s = socketRef.current;
        if (!s || !onlineMode || !gameId) return;
        try { s.emit('ludo:players:get', { gameId }); } catch (_e) { }
    }, [onlineMode, gameId]);

    const startGame = () => {
        setShowPlayerSelection(true);
    };

    const confirmPlayerCount = () => {
        setShowPlayerSelection(false);
        
        // Initialize game state (but don't start yet in online mode if players haven't joined)
        setCurrentPlayer(0);
        setDiceValueImmediate(0);
        setWinner(null);
        setDiceRolling(false);
        
        // Preserve any customizations made before starting; only adjust seat count and fill missing seats
        setPlayers(prev => {
            const max = Math.max(2, Math.min(4, selectedPlayerCount));
            const next = [];
            for (let i = 0; i < max; i++) {
                const prevSeat = prev?.[i];
                const baseName = (i === 0 ? (myProfile?.fullName || 'You') : playerNames[i]);
                const baseAvatar = (i === 0 ? myProfile?.profilePic : undefined);
                const baseCover = (i === 0 ? (myProfile?.coverPic || myProfile?.cover || undefined) : undefined);
                const pieces = Array.isArray(prevSeat?.pieces) && prevSeat.pieces.length === 4
                    ? prevSeat.pieces.map((pc, idx) => ({ id: idx, color: colors[i], position: { x: 0, y: 0 }, isHome: pc.isHome, isInPlay: pc.isInPlay, steps: pc.steps }))
                    : Array.from({ length: 4 }).map((_, j) => ({ id: j, color: colors[i], position: { x: 0, y: 0 }, isHome: true, isInPlay: false, steps: 0 }));
                next.push({
                    id: i,
                    name: prevSeat?.name || baseName,
                    color: colors[i],
                    pieces,
                    isActive: i === 0,
                    avatar: prevSeat?.avatar || baseAvatar,
                    cover: prevSeat?.cover || baseCover,
                    profileId: i === 0 ? (myProfile?._id || 'local') : (prevSeat?.profileId || undefined),
                });
            }
            return next;
        });
        // Re-apply any reserved invited slots to the fresh players list
        if (onlineMode && invitedSlotByFriendId && Object.keys(invitedSlotByFriendId).length > 0) {
            setPlayers(prev => {
                const copy = prev.map(p => ({ ...p, pieces: p.pieces.map(pc => ({ ...pc })) }));
                Object.entries(invitedSlotByFriendId).forEach(([fid, slotStr]) => {
                    const slot = Number(slotStr);
                    const friend = [...selectedFriends, ...friendList, ...searchResults].find(f => String(f?._id) === String(fid));
                    if (copy[slot] && friend) {
                        copy[slot].name = friend.fullName || copy[slot].name;
                        copy[slot].avatar = friend.profilePic || copy[slot].avatar;
                        copy[slot].cover = friend.coverPic || copy[slot].cover;
                        copy[slot].profileId = friend._id;
                    }
                });
                return copy;
            });
        }
        
        // Setup online room/socket and check if we should wait for players
        if (onlineMode && myProfile?._id) {
            const gid = gameId || generateGameId();
            setGameId(gid);
            ensureSocketConnected();
            // Wait for socket to be ready before emitting
            const waitAndEmit = () => {
                if (socketRef.current && socketRef.current.connected) {
                    try {
                try { console.log('[LUDO][client] emit ludo:join (host)', { gid }); } catch (_e) {}
                socketRef.current.emit('ludo:join', { gameId: gid });
                setMyPlayerIndex(0);
                // Broadcast players snapshot so remotes sync
                emitPlayersState(gid);
            } catch (_e) { }
                } else if (socketRef.current) {
                    // Wait for connection
                    socketRef.current.once('connect', () => {
                        try {
                            socketRef.current.emit('ludo:join', { gameId: gid });
                            setMyPlayerIndex(0);
                            // Broadcast players snapshot so remotes sync
                            emitPlayersState(gid);
                        } catch (_e) { }
                    });
                }
            };
            setTimeout(waitAndEmit, 100);
            
            // Check if all players have joined after state updates
            // Use setTimeout to ensure state has updated
            setTimeout(() => {
                const allPlayersJoined = checkAllPlayersJoined();
                
                if (allPlayersJoined) {
                    // All players have joined - start the game
                    setGameStarted(true);
                    gameStartedRef.current = true;
                    autoStartTriggeredRef.current = false;
                    setCanRollDice(true);
                    
                    // Broadcast game start
                    if (socketRef.current && gid) {
                        try {
                            const minimalPlayers = playersRef.current.map(p => ({
                                id: p.id,
                                name: p.name,
                                color: p.color,
                                avatar: p.avatar,
                                cover: p.cover,
                                profileId: p.profileId,
                                isActive: p.isActive !== undefined ? p.isActive : true,
                                pieces: (Array.isArray(p.pieces) ? p.pieces.map(pc => ({ id: pc.id, steps: pc.steps, isHome: pc.isHome, isInPlay: pc.isInPlay })) : [])
                            }));
                            socketRef.current.emit('ludo:players', {
                                gameId: gid,
                                players: minimalPlayers,
                                selectedPlayerCount: selectedPlayerCountRef.current,
                                currentPlayer: 0,
                                diceValue: 0,
                                gameStarted: true,
                                gameEnded: false,
                                winners: []
                            });
                        } catch (_e) {}
                    }
                } else {
                    // Not all players have joined - enter waiting mode
                    setGameStarted(false);
                    gameStartedRef.current = false;
                    autoStartTriggeredRef.current = false;
                    setCanRollDice(false);
                    // recomputeWaitingState will be called by useEffect when players/invitedStatus changes
                }
                
                // Always recompute waiting state to update UI
                recomputeWaitingState();
            }, 200);
        } else {
            // Offline mode - start immediately
            setGameStarted(true);
            gameStartedRef.current = true;
            autoStartTriggeredRef.current = false;
            setCanRollDice(true);
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
        setShowWinnerModal(false);
        setGameEnded(true);
        setWinner(null);
    };

    // Debug: trigger celebration modal
    const triggerDebugCelebration = () => {
        try {
            const winnerPlayer = players[currentPlayer];
            if (!winnerPlayer) return;
            setWinner(winnerPlayer);
            setShowWinnerModal(true);
            setWinners(prev => (prev.some(w => w?.id === winnerPlayer?.id) ? prev : [...prev, winnerPlayer]));
        } catch (_e) { }
    };

    const resetGame = () => {
        // Confirm restart if game is in progress
        if (gameStarted && !gameEnded) {
            const confirmed = window.confirm('Are you sure you want to restart the game? All progress will be lost.');
            if (!confirmed) return;
        }
        
        // Reset moving flag
        isMovingRef.current = false;
        
        // Clear all move timers
        moveTimersRef.current.forEach(t => clearTimeout(t));
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
        setDiceRolling(false);
        setShowPlayerSelection(false);
        setWaitingForPlayers(false);
        
        // Reinitialize game with current player count
        initializeGame(selectedPlayerCount);
        
        // Reset invite tracking
        setInvitedStatusByFriendId({});
        setInvitedSlotByFriendId({});
        
        setIncomingInviteRequest(null);
        
        // If in online mode and host, notify other players and reset game state on server
        // Use setTimeout to ensure state is updated after initializeGame
        setTimeout(() => {
            if (onlineMode && gameId && myPlayerIndex === 0 && socketRef.current) {
                try {
                    // Get fresh players state after initializeGame
                    const resetPlayers = playersRef.current.map(p => ({
                        id: p.id,
                        name: p.name,
                        color: p.color,
                        avatar: p.avatar,
                        cover: p.cover,
                        profileId: p.profileId,
                        isActive: p.isActive !== undefined ? p.isActive : true,
                        pieces: p.pieces.map(pc => ({
                            id: pc.id,
                            steps: 0,
                            isHome: true,
                            isInPlay: false
                        }))
                    }));
                    
                    // Broadcast reset to all players
                    socketRef.current.emit('ludo:players', {
                        gameId,
                        players: resetPlayers,
                        selectedPlayerCount: selectedPlayerCountRef.current,
                        currentPlayer: 0,
                        diceValue: 0,
                        gameStarted: false,
                        gameEnded: false,
                        winners: []
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
    const acceptIncomingInvite = async () => {
        const payload = incomingInviteRequest;
        if (!payload) return;
        try {
                try { setLastInviter({ id: payload.from, name: payload.name, avatar: payload.avatar }); } catch (_e) {}
            setOnlineMode(true);
            setGameId(payload.gameId);
            setSelectedPlayerCount([2, 3, 4].includes(payload.playerCount) ? payload.playerCount : selectedPlayerCount);
            ensureSocketConnected();
            if (socketRef.current) {
                try { socketRef.current.emit('ludo:join', { gameId: payload.gameId }); } catch (_e) { }
            }
            if (typeof payload.slotIndex === 'number') {
                setMyPlayerIndex(payload.slotIndex);
            }
            // Update local players for quick UI before host snapshot arrives
            initializeGame([2, 3, 4].includes(payload.playerCount) ? payload.playerCount : selectedPlayerCount);
            setPlayers(prev => {
                const copy = prev.map(p => ({ ...p, pieces: p.pieces.map(pc => ({ ...pc })) }));
                const slot = payload.slotIndex;
                // Place invitee (me) into the reserved slot
                if (copy[slot]) {
                    copy[slot].name = myProfile?.fullName || copy[slot].name;
                    copy[slot].avatar = myProfile?.profilePic || copy[slot].profilePic;
                    // Use cover fields if available; do not override with avatar
                    copy[slot].cover = myProfile?.coverPic || myProfile?.coverPic || myProfile?.coverPic || myProfile?.coverPic || copy[slot].cover;
                    copy[slot].profileId = myProfile?._id || copy[slot].profileId;
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
                return copy;
            });
            // Broadcast a request for latest snapshot to ensure we get host identities
            try { socketRef.current && socketRef.current.emit('ludo:players:get', { gameId: payload.gameId }); } catch (_e) {}
            // Notify host we accepted
            try {
                socketRef.current && socketRef.current.emit('ludo:accept', {
                    gameId: payload.gameId,
                    slotIndex: payload.slotIndex,
                    friend: { _id: myProfile?._id, fullName: myProfile?.fullName, profilePic: myProfile?.profilePic },
                    from: payload.from
                });
            } catch (_e) { }
        } finally {
            setIncomingInviteRequest(null);
            // Set game started view; host will sync board via ludo:players
            setGameStarted(true);
            // Remove invite from list locally
            setPendingInvites(prev => prev.filter(i => !(String(i.gameId) === String(payload.gameId) && String(i.from) === String(payload.from))));
        }
    };

    const declineIncomingInvite = () => {
        const payload = incomingInviteRequest;
        setIncomingInviteRequest(null);
        if (payload && socketRef.current) {
            try { socketRef.current.emit('ludo:invites:dismiss', { gameId: payload.gameId, by: payload.from }); } catch (_e) { }
        }
    };

    const acceptInvite = (inv) => {
        if (!inv) return;
        setIncomingInviteRequest(inv);
        setTimeout(() => acceptIncomingInvite(), 0);
    };

    const dismissInvite = (inv) => {
        if (!inv) return;
        setPendingInvites(prev => prev.filter(i => !(String(i.gameId) === String(inv.gameId) && String(i.from) === String(inv.from))));
        try { socketRef.current && socketRef.current.emit('ludo:invites:dismiss', { gameId: inv.gameId, by: inv.from }); } catch (_e) { }
    };

    // Player editor helpers
    const openPlayerEditor = (index) => {
        if (index == null || !players[index]) return;
        setEditingPlayerIndex(index);
        setEditName(players[index]?.name || '');
        setEditAvatarUrl(players[index]?.avatar || '');
        setShowPlayerEditor(true);
    };

    const closePlayerEditor = () => {
        setShowPlayerEditor(false);
        setEditingPlayerIndex(null);
    };

    const onPickAvatarFile = (e) => {
        try {
            const f = e?.target?.files?.[0];
            if (!f) return;
            const url = URL.createObjectURL(f);
            setEditAvatarUrl(url);
        } catch (_e) { }
    };

    const savePlayerEditor = () => {
        if (editingPlayerIndex == null) return closePlayerEditor();
        setPlayers(prev => {
            const updated = prev.map(p => ({ ...p, pieces: p.pieces.map(pc => ({ ...pc })) }));
            const target = updated[editingPlayerIndex];
            if (!target) return prev;
            target.name = (editName && editName.trim().length > 0) ? editName.trim() : target.name;
            target.avatar = (editAvatarUrl && editAvatarUrl.trim().length > 0) ? editAvatarUrl.trim() : undefined;
            return updated;
        });
        closePlayerEditor();
    };

    // Rendering helpers - memoized for performance
    const homePositions = useMemo(() => [
        [{ x: 2, y: 2 }, { x: 3, y: 2 }, { x: 2, y: 3 }, { x: 3, y: 3 }],
        [{ x: 11, y: 2 }, { x: 12, y: 2 }, { x: 11, y: 3 }, { x: 12, y: 3 }],
        [{ x: 2, y: 11 }, { x: 3, y: 11 }, { x: 2, y: 12 }, { x: 3, y: 12 }],
        [{ x: 11, y: 11 }, { x: 12, y: 11 }, { x: 11, y: 12 }, { x: 12, y: 12 }],
    ], []);

    // Compute overlapping tokens in the same board cell for better visibility
    // Optimized: only recalculate when players actually change
    const cellOccupancy = useMemo(() => {
        const map = new Map();
        players.forEach((player, playerIndex) => {
            if (!player || !Array.isArray(player.pieces)) return;
            player.pieces.forEach((piece, pieceIndex) => {
                if (piece && piece.isInPlay && typeof piece.steps === 'number') {
                    const pos = getPositionOnPath(playerIndex, piece.steps);
                    const key = `${pos.x},${pos.y}`;
                    if (!map.has(key)) map.set(key, []);
                    map.get(key).push({ playerIndex, pieceIndex });
                }
            });
        });
        return map;
    }, [players, getPositionOnPath]);

    const getOverlapOffset = (count, index) => {
        // Keep overlapping tokens within the same cell
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
                dy: Math.round(pos.dy) 
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
            dy: Math.round(pos.dy) 
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
                        fill={'#FFFFFF'}
                        stroke={'#000000'}
                        strokeWidth={1}
                    />
                );
            }
        }
        return rects;
    };

    const renderStaticRects = () => {
        const elems = [];
        // Corner home areas (colored border with inner white)
        const drawHome = (x0, y0, color, idx) => {
            elems.push(<rect key={`home-outer-${x0}-${y0}`} x={x0 * CELL_SIZE} y={y0 * CELL_SIZE} width={CELL_SIZE * 6} height={CELL_SIZE * 6} fill={color} stroke="#000" strokeWidth={2} />);
            const innerX = (x0 + 1) * CELL_SIZE;
            const innerY = (y0 + 1) * CELL_SIZE;
            const innerW = CELL_SIZE * 4;
            const innerH = CELL_SIZE * 4;
            // Background cover image
            const coverUrl = players[idx]?.cover || players[idx]?.cover;
            if (coverUrl && idx < selectedPlayerCount) {
                elems.push((
                    <image key={`home-cover-${x0}-${y0}`} href={coverUrl} x={innerX} y={innerY} width={innerW} height={innerH} preserveAspectRatio="xMidYMid slice" />
                ));
                // Dark overlay over background image for contrast
                elems.push(
                    <rect key={`home-cover-overlay-${x0}-${y0}`} x={innerX} y={innerY} width={innerW} height={innerH} fill="rgba(0,0,0,0.5)" />
                );
                // Border frame over the image
                elems.push(<rect key={`home-inner-border-${x0}-${y0}`} x={innerX} y={innerY} width={innerW} height={innerH} fill="none" stroke="#000" strokeWidth={2} />);
            } else {
                // Fallback white background
                elems.push(<rect key={`home-inner-${x0}-${y0}`} x={innerX} y={innerY} width={innerW} height={innerH} fill="#FFFFFF" stroke="#000" strokeWidth={2} />);
            }
            // four pips
            const cx = (x0 + 1) * CELL_SIZE + CELL_SIZE * 2;
            const cy = (y0 + 1) * CELL_SIZE + CELL_SIZE * 2;
            const pipRadius = CELL_SIZE * 0.30;
            const gap = CELL_SIZE * 0.45; // increase spacing between home placeholders
            const offsets = [[-gap, -gap], [gap, -gap], [-gap, gap], [gap, gap]];
            offsets.forEach((o, i) => {
                elems.push(<circle key={`pip-${x0}-${y0}-${i}`} cx={cx + o[0]} cy={cy + o[1]} r={pipRadius} fill={color} stroke="#000" strokeWidth={2} />);
            });
        };
        drawHome(0, 0, colors[0], 0); // red
        drawHome(9, 0, colors[1], 1); // green
        drawHome(0, 9, colors[2], 2); // blue
        drawHome(9, 9, colors[3], 3); // yellow

        // Cross paths - single width
        for (let c = 0; c < 15; c++) {
            elems.push(<rect key={`hpath-${c}`} x={c * CELL_SIZE} y={7 * CELL_SIZE} width={CELL_SIZE} height={CELL_SIZE} fill="#FFFFFF" stroke="#000" strokeWidth={1} />);
        }
        for (let r = 0; r < 15; r++) {
            elems.push(<rect key={`vpath-${r}`} x={7 * CELL_SIZE} y={r * CELL_SIZE} width={CELL_SIZE} height={CELL_SIZE} fill="#FFFFFF" stroke="#000" strokeWidth={1} />);
        }

        const homeLineColor = "gray"

        // Colored home columns (five squares towards center)
        for (let r = 1; r <= 5; r++) elems.push(<rect key={`green-col-${r}`} x={7 * CELL_SIZE} y={r * CELL_SIZE} width={CELL_SIZE} height={CELL_SIZE} fill={colors[1]} stroke="#000" strokeWidth={1} />);
        for (let c = 9; c <= 13; c++) elems.push(<rect key={`yellow-row-${c}`} x={c * CELL_SIZE} y={7 * CELL_SIZE} width={CELL_SIZE} height={CELL_SIZE} fill={colors[3]} stroke="#000" strokeWidth={1} />);
        for (let r = 9; r <= 12; r++) elems.push(<rect key={`blue-col-${r}`} x={7 * CELL_SIZE} y={r * CELL_SIZE} width={CELL_SIZE} height={CELL_SIZE} fill={colors[2]} stroke="#000" strokeWidth={1} />);
        for (let c = 1; c <= 5; c++) elems.push(<rect key={`red-row-${c}`} x={c * CELL_SIZE} y={7 * CELL_SIZE} width={CELL_SIZE} height={CELL_SIZE} fill={colors[0]} stroke="#000" strokeWidth={1} />);

        // Center pinwheel across the full 3x3 center (cells 6..8,6..8)
        // Coordinates of the 3x3 center square
        const cx = (7.5) * CELL_SIZE; // center point
        const cy = (7.5) * CELL_SIZE;
        const xLeft = 6 * CELL_SIZE;
        const xRight = 9 * CELL_SIZE;
        const yTop = 6 * CELL_SIZE;
        const yBottom = 9 * CELL_SIZE;
        // Top (green)
        elems.push(<path key="center-tri-green" d={`M ${xLeft} ${yTop} L ${xRight} ${yTop} L ${cx} ${cy} Z`} fill={colors[1]} stroke="#000" strokeWidth={1} />);
        // Right (yellow)
        elems.push(<path key="center-tri-yellow" d={`M ${xRight} ${yTop} L ${xRight} ${yBottom} L ${cx} ${cy} Z`} fill={colors[3]} stroke="#000" strokeWidth={1} />);
        // Bottom (blue)
        elems.push(<path key="center-tri-blue" d={`M ${xLeft} ${yBottom} L ${xRight} ${yBottom} L ${cx} ${cy} Z`} fill={colors[2]} stroke="#000" strokeWidth={1} />);
        // Left (red)
        elems.push(<path key="center-tri-red" d={`M ${xLeft} ${yTop} L ${xLeft} ${yBottom} L ${cx} ${cy} Z`} fill={colors[0]} stroke="#000" strokeWidth={1} />);

        // Highlight entry cells for all players
        elems.push(<rect key="highlight-1-6" x={1 * CELL_SIZE} y={6 * CELL_SIZE} width={CELL_SIZE} height={CELL_SIZE} fill={colors[0]} stroke="#000" strokeWidth={1} />);   // Red entry
        elems.push(<rect key="highlight-8-1" x={8 * CELL_SIZE} y={1 * CELL_SIZE} width={CELL_SIZE} height={CELL_SIZE} fill={colors[1]} stroke="#000" strokeWidth={1} />);   // Green entry
        elems.push(<rect key="highlight-6-13" x={6 * CELL_SIZE} y={13 * CELL_SIZE} width={CELL_SIZE} height={CELL_SIZE} fill={colors[2]} stroke="#000" strokeWidth={1} />); // Blue entry
        elems.push(<rect key="highlight-13-8" x={13 * CELL_SIZE} y={8 * CELL_SIZE} width={CELL_SIZE} height={CELL_SIZE} fill={colors[3]} stroke="#000" strokeWidth={1} />); // Yellow entry

        // Ensure cell (7,12) is blue
        elems.push(<rect key="force-blue-7-12" x={7 * CELL_SIZE} y={13 * CELL_SIZE} width={CELL_SIZE} height={CELL_SIZE} fill={colors[2]} stroke="#000" strokeWidth={1} />);

        return (<>{elems}</>);
    };

    // Calculate token size - round to whole pixels for precise rendering
    // Ensure minimum token size of 10px for very small screens to maintain visibility
    const tokenSize = Math.max(10, Math.round(CELL_SIZE * 0.9));
    const boardStyle = {
        position: 'relative',
        width: `${BOARD_SIZE}px`,
        height: `${BOARD_SIZE}px`,
        maxWidth: '100%',
        maxHeight: '100%',
        borderRadius: '15px',
        overflow: 'hidden',
        background: '#fff',
        boxShadow: '0 6px 12px rgba(0,0,0,0.4)',
        // Ensure proper scaling on mobile devices
        transform: 'translateZ(0)', // Hardware acceleration
        willChange: 'transform',
        // Prevent board from overflowing on very small screens
        boxSizing: 'border-box'
    };

    const tokenNode = (playerIndex, pieceIndex, piece) => {
        let x = 0;
        let y = 0;
        if (piece.isHome) {
            const pos = homePositions[playerIndex][pieceIndex];
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
        } else if (piece.isInPlay) {
            const pos = getPositionOnPath(playerIndex, piece.steps);
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
            const idxInGroup = group.findIndex(g => g.playerIndex === playerIndex && g.pieceIndex === pieceIndex);
            const { dx, dy } = getOverlapOffset(group.length, idxInGroup);
            x += dx;
            y += dy;
        }
        // Round to whole pixels to avoid sub-pixel rendering issues
        // Critical for mobile devices like iPhone 12 mini
        x = Math.round(x);
        y = Math.round(y);
        
        // Mobile device detection and adjustment
        const isMobile = winSize.width <= 500 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        if (isMobile) {
            // Add -10px margin top adjustment for mobile devices
            y = y - 8.5;
        }
        
        const isCurrentPlayer = playerIndex === currentPlayer;
        const isActivePlayer = playerIndex < selectedPlayerCount;
        // Always prefer ref value when available for current player (prevents button from being disabled due to state sync issues)
        // The ref is updated immediately, while state updates are async
        // For current player, always use ref if it has a value, otherwise use state
        // For other players, use state (which comes from broadcasts)
        const effectiveDiceValue = isCurrentPlayer 
            ? (diceValueRef.current > 0 ? diceValueRef.current : diceValue)
            : diceValue;
        const canMove = isCurrentPlayer && effectiveDiceValue > 0 && !isMovingRef.current && !isAutoMovingRef.current && (
            (piece.isHome && effectiveDiceValue === 6) || (piece.isInPlay && piece.steps + effectiveDiceValue <= maxSteps)
        );
        
        const avatar = players[playerIndex]?.avatar;
        return (
            <div key={`token-${playerIndex}-${pieceIndex}`} style={{
                position: 'absolute',
                left: `${x}px`,
                top: `${y}px`,
                width: `${tokenSize}px`,
                height: `${tokenSize}px`,
                zIndex: (effectiveDiceValue > 0 && isCurrentPlayer && !isMovingRef.current && !isAutoMovingRef.current) ? 100 : 10,
                pointerEvents: 'auto',
                transition: `left ${stepDurationMs}ms ease, top ${stepDurationMs}ms ease`,
                // Ensure pixel-perfect alignment on mobile devices
                willChange: 'left, top'
            }}>
                <button
                    onClick={(e) => { 
                        e.stopPropagation();
                        e.preventDefault();
                        // Only call movePiece if conditions are met - check both ref and state
                        const currentDiceValue = diceValueRef.current > 0 ? diceValueRef.current : diceValue;
                        if ((!onlineMode || myPlayerIndex === currentPlayer) && isActivePlayer && isCurrentPlayer && currentDiceValue > 0 && !isMovingRef.current && !isAutoMovingRef.current) {
                            movePiece(pieceIndex);
                        }
                    }}
                    disabled={!isActivePlayer || !isCurrentPlayer || effectiveDiceValue === 0 || isMovingRef.current || isAutoMovingRef.current}
                    style={{
                        width: '100%',
                        height: '100%',
                        borderRadius: '50%',
                        background: "black",
                        border: `3px solid ${adjustHexColor(piece.color, -30)}`,
                        boxShadow: isActivePlayer ? `0 6px 8px ${piece.color}66` : 'none',
                        opacity: isActivePlayer ? 1 : 0.3,
                        position: 'relative',
                        overflow: 'hidden',
                        cursor: (isActivePlayer && isCurrentPlayer && effectiveDiceValue > 0 && !isMovingRef.current && !isAutoMovingRef.current) ? 'pointer' : 'default',
                        animation: canMove ? 'tokenPulseScale 900ms ease-in-out infinite, tokenGlow 1200ms ease-in-out infinite' : 'none',
                        // Ensure proper rendering on mobile
                        transform: 'translateZ(0)',
                        backfaceVisibility: 'hidden',
                        // Ensure button can receive clicks
                        pointerEvents: 'auto'
                    }}
                    aria-label={`Piece ${pieceIndex + 1} of ${playerNames[playerIndex]}`}
                >
                    {/* Color ring border inside token matching user color */}
                    <div style={{
                        position: 'absolute',
                        left: 4,
                        top: 4,
                        right: 4,
                        bottom: 4,
                        border: `3px solid ${adjustHexColor(piece.color, -40)}`,
                        borderRadius: (tokenSize / 2) - 4,
                        pointerEvents: 'none'
                    }} />
                    {avatar ? (
                        <img src={avatar} alt={players[playerIndex]?.name || 'avatar'} style={{
                            position: 'absolute',
                            left: '50%',
                            top: '50%',
                            transform: 'translate(-50%, -50%)',
                            width: tokenSize * 0.72,
                            height: tokenSize * 0.72,
                            borderRadius: (tokenSize * 0.72) / 2,
                            objectFit: 'cover',
                            pointerEvents: 'none'
                        }} />
                    ) : null}
                </button>
            </div>
        );
    };

    // Screens
    if (gameEnded) {
        return (
            <div style={{ minHeight: '100vh', background: '#1a1a2e', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
                <div style={{ maxWidth: 600, textAlign: 'center' }}>
                    <div style={{ fontSize: 100, color: '#FFD700', marginBottom: 16 }}>🏆</div>
                    <div style={{ fontSize: 36, fontWeight: 'bold', color: '#FFD700', marginBottom: 8 }}>Game Complete!</div>
                    <div style={{ color: '#B0B0B0', marginBottom: 24 }}>All players have finished!</div>
                    <div>
                        {winners.map((w, i) => (
                            <div key={w.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: w.color, padding: 12, borderRadius: 12, marginBottom: 10 }}>
                                <div style={{ fontWeight: 'bold' }}>#{i + 1}</div>
                                <div style={{ fontWeight: 'bold', flex: 1 }}>{w.name}</div>
                                <div>{playerEmojis[w.id]}</div>
                            </div>
                        ))}
                    </div>
                    <button onClick={resetGame} style={{ marginTop: 16, background: '#00AA00', color: 'white', padding: '12px 24px', borderRadius: 20, border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>
                        Play Again
                    </button>
                </div>
            </div>
        );
    }

    if (showPlayerSelection) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.8)', padding: 20, position: 'fixed', inset: 0, zIndex: 2000, overflowY: 'auto' }}>
                <div style={{ width: '100%', maxWidth: 420, maxHeight: '85vh', overflowY: 'auto', WebkitOverflowScrolling: 'touch', background: 'rgba(26, 35, 50, 0.95)', borderRadius: 24, padding: 28, border: '1px solid rgba(255, 215, 0, 0.3)', color: 'white' }}>
                    <div style={{ textAlign: 'center', marginBottom: 20 }}>
                        <div style={{ fontSize: 32, color: '#FFD700', fontWeight: 'bold' }}>Select Players</div>
                        <div style={{ color: '#B0B0B0' }}>Choose how many players will join the game</div>
                    </div>
                    <div>
                        {[2, 3, 4].map(count => (
                            <button key={count} onClick={() => setSelectedPlayerCount(count)} style={{
                                width: '100%',
                                textAlign: 'left',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 12,
                                padding: 16,
                                marginBottom: 12,
                                background: selectedPlayerCount === count ? 'rgba(42, 26, 58, 0.9)' : 'rgba(42, 42, 42, 0.8)',
                                border: `2px solid ${selectedPlayerCount === count ? '#FFD700' : 'transparent'}`,
                                borderRadius: 16,
                                color: 'white',
                                cursor: 'pointer'
                            }}>
                                <div>
                                    <div style={{ fontWeight: 'bold', color: selectedPlayerCount === count ? '#FFD700' : '#B0B0B0' }}>{count}</div>
                                    <div style={{ color: selectedPlayerCount === count ? 'white' : '#B0B0B0' }}>{count === 2 ? 'Two Players' : count === 3 ? 'Three Players' : 'Four Players'}</div>
                                </div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    {[0, 1, 3, 2].slice(0, count).map((idx) => (
                                        <div key={idx} style={{ width: 20, height: 20, borderRadius: 10, background: colors[idx], border: '2px solid #fff' }} />
                                    ))}
                                </div>
                            </button>
                        ))}
                    </div>
                    {/* Online toggle and friend picker */}
                    <div style={{ marginTop: 8, marginBottom: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                            <div style={{ fontWeight: 700 }}>Play Online with Friends</div>
                            <button onClick={() => setOnlineMode(!onlineMode)} style={{ padding: '6px 12px', borderRadius: 16, background: onlineMode ? '#29B1A9' : 'rgba(255,255,255,0.1)', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 600 }}>{onlineMode ? 'On' : 'Off'}</button>
                        </div>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid rgba(255,255,255,0.2)', borderRadius: 10, padding: '8px 10px' }}>
                                <span role="img" aria-label="search">🔎</span>
                                <input
                                    placeholder="Search friends by name..."
                                    value={friendSearchQuery}
                                    onChange={(e) => onChangeFriendSearch(e.target.value)}
                                    style={{ flex: 1, background: 'transparent', color: 'white', border: 'none', outline: 'none' }}
                                />
                            </div>
                            <div style={{ maxHeight: 220, overflow: 'auto', marginTop: 8 }}>
                                {loadingSearch && <div style={{ color: '#B0B0B0', fontSize: 12, marginTop: 6 }}>Searching...</div>}
                                {(friendSearchQuery ? searchResults : friendList).map((f) => {
                                    const key = f?._id || String(f?.id) || Math.random().toString(36);
                                    const isSelected = selectedFriends.some(sf => sf._id === f._id);
                                    const inviteStatus = invitedStatusByFriendId[f?._id];
                                    const maxPlayers = Math.max(2, Math.min(4, selectedPlayerCount));
                                    const isAssignedOffline = !onlineMode && players.slice(1, maxPlayers).some(p => p?.profileId && String(p.profileId) === String(f?._id));
                                    const canAction = onlineMode ? (!inviteStatus && getNextOpenSlot() != null) : (!isAssignedOffline && getNextOpenSlot() != null);
                                    return (
                                        <div key={key} onClick={() => {
                                            setSelectedFriends(prev => {
                                                if (isSelected) return prev.filter(p => p._id !== f._id);
                                                const next = [...prev, f];
                                                return next.slice(0, Math.max(0, selectedPlayerCount - 1));
                                            });
                                        }} role="button" tabIndex={0} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'transparent', border: 'none', color: 'white', padding: '8px 0', cursor: 'pointer' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                <div style={{ width: 28, height: 28, borderRadius: 14, overflow: 'hidden', background: '#333' }}>
                                                    {f?.profilePic ? <img src={f.profilePic} alt=" " style={{ width: 28, height: 28, objectFit: 'cover' }} /> : null}
                                                </div>
                                                <div style={{ fontSize: 14 }}>{f?.fullName || 'Unknown'}</div>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <span>{isSelected ? '✅' : '⭕'}</span>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); onlineMode ? inviteFriend(f) : assignFriendOffline(f); }}
                                                    disabled={!canAction}
                                                    style={{ padding: '4px 8px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)', background: onlineMode ? (inviteStatus ? 'rgba(255,255,255,0.1)' : '#29B1A9') : (isAssignedOffline ? 'rgba(255,255,255,0.1)' : '#29B1A9'), color: 'white', cursor: canAction ? 'pointer' : 'default', fontSize: 12 }}
                                                >
                                                    {onlineMode ? (inviteStatus === 'joined' ? 'Joined' : inviteStatus === 'invited' ? 'Invited' : 'Invite') : (isAssignedOffline ? 'Assigned' : 'Add')}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                                <div style={{ color: '#B0B0B0', fontSize: 12, marginTop: 6 }}>Selected: {selectedFriends.length} / {Math.max(0, selectedPlayerCount - 1)}</div>
                                {onlineMode && (
                                    <div style={{ marginTop: 10 }}>
                                        <div style={{ fontWeight: 700, marginBottom: 6 }}>Seat status</div>
                                        <div style={{ display: 'grid', gap: 6 }}>
                                            {Array.from({ length: Math.max(2, Math.min(4, selectedPlayerCount)) }).map((_, i) => {
                                                const seat = players[i];
                                                const joined = i === 0 ? Boolean(seat?.profileId || myProfile?._id) : Boolean(seat?.profileId);
                                                const name = seat?.name || (i === 0 ? (myProfile?.fullName || 'You') : `Seat ${i + 1}`);
                                                const invitedName = !joined ? getInvitedNameForSlot(i) : null;
                                                return (
                                                    <div key={`preseat-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.04)', padding: '6px 8px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)' }}>
                                                        <div style={{ width: 20, height: 20, borderRadius: 10, overflow: 'hidden', background: '#333', border: '2px solid #111', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                            {seat?.avatar ? <img src={seat.avatar} alt=" " style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 10 }}>{['R','G','Y','B'][i] || 'P'}</span>}
                                                        </div>
                                                        <div style={{ fontSize: 12, flex: 1, textAlign: 'left' }}>{name}</div>
                                                        <div style={{ fontSize: 11, fontWeight: 700, color: joined ? '#B0FFB0' : '#FFD700' }}>{joined ? 'Joined' : (invitedName ? `Invited: ${invitedName}` : 'Waiting…')}</div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                        </div>
                    </div>
                    {/* Offline/General: quick customize players before starting */}
                    <div style={{ marginTop: 10 }}>
                        <div style={{ fontWeight: 700, marginBottom: 8 }}>Customize Players</div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {[0, 1, 3, 2].slice(0, selectedPlayerCount).map((idx) => (
                                <button key={`preedit-${idx}`} onClick={() => openPlayerEditor(idx)} title={players[idx]?.name || 'Player'} style={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: 18,
                                    background: players[idx]?.color,
                                    border: '2px solid #222',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
                                }} aria-label={`Edit ${players[idx]?.name || 'player'}`}>
                                    {players[idx]?.avatar ? (
                                        <img src={players[idx].avatar} alt=" " style={{ width: 28, height: 28, borderRadius: 14, objectFit: 'cover', border: '2px solid #fff' }} />
                                    ) : (
                                        <span style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>{['R', 'G', 'Y', 'B'][idx] || 'P'}</span>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                    {/* Migrate to another device via invite link */}
                    <div style={{ marginTop: 4, paddingTop: 10, borderTop: '1px dashed rgba(255,255,255,0.2)' }}>
                        <div style={{ marginBottom: 8, fontWeight: 700 }}>Migrate to another device</div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={copyInviteLink} style={{ background: '#4444FF', color: 'white', padding: '10px 12px', border: 'none', borderRadius: 12, cursor: 'pointer', fontWeight: 'bold' }}>Copy Invite Link</button>
                            {inviteCopied && <span style={{ color: '#B0FFB0', alignSelf: 'center' }}>Copied!</span>}
                        </div>
                        {incomingInvite && (
                            <div style={{ marginTop: 8, color: '#B0B0B0', fontSize: 12 }}>Invite detected from {incomingInvite?.name}. Start the game to continue on this device.</div>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
                        <button onClick={() => setShowPlayerSelection(false)} style={{ flex: 1, background: '#FF4444', color: 'white', padding: '12px 0', border: 'none', borderRadius: 20, cursor: 'pointer', fontWeight: 'bold' }}>Cancel</button>
                        <button onClick={confirmPlayerCount} style={{ flex: 1, background: '#00AA00', color: 'white', padding: '12px 0', border: 'none', borderRadius: 20, cursor: 'pointer', fontWeight: 'bold' }}>Start Game</button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh', background: '#1a1a2e', color: 'white', position: 'relative', zIndex: 10 }}>
            <AnimatedBackground />
            <style>{`
                @keyframes tokenPulseScale { 0% { transform: scale(1); } 50% { transform: scale(1.12); } 100% { transform: scale(1); } }
                @keyframes tokenGlow { 0% { box-shadow: 0 0 10px rgba(255,215,0,0.4), 0 0 20px rgba(255,215,0,0.2); } 50% { box-shadow: 0 0 16px rgba(255,215,0,0.9), 0 0 30px rgba(255,215,0,0.6); } 100% { box-shadow: 0 0 10px rgba(255,215,0,0.4), 0 0 20px rgba(255,215,0,0.2); } }
                @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
            `}</style>
            <div style={{ padding: '10px 20px', background: 'rgba(26, 35, 50, 0.9)', borderBottom: '1px solid rgba(255, 215, 0, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'space-around' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ color: '#00D4FF', fontSize: 28, fontWeight: 'bold' }}>Ludo Classic</div>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    {!gameStarted ? (
                        <button onClick={startGame} style={{ background: '#00D4FF', color: 'white', padding: '8px 36px', border: 'none', borderRadius: 20, cursor: 'pointer', fontWeight: 'bold' }}>Start</button>
                    ) : (
                        <>
                            <button 
                                onClick={resetGame} 
                                style={{ 
                                    background: '#FF4444', 
                                    color: 'white', 
                                    padding: '10px 20px', 
                                    border: 'none', 
                                    borderRadius: 20, 
                                    cursor: 'pointer', 
                                    fontWeight: 'bold',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6
                                }}
                                title="Restart the game from beginning"
                            >
                                <span>🔄</span>
                                <span>Restart</span>
                            </button>
                        </>
                    )}
                    {isDebug && (
                        <button onClick={triggerDebugCelebration} title="Debug: Test celebration" style={{ background: 'transparent', color: '#FFD700', padding: '6px 10px', border: '1px solid #FFD700', borderRadius: 12, cursor: 'pointer', fontWeight: 700 }}>Debug Celebrate</button>
                    )}
                </div>
            </div>

            {/* Pending invitations banner/list */}
            {pendingInvites.length > 0 && (
                <div style={{ padding: '10px 20px', background: 'rgba(26, 35, 50, 0.85)', borderBottom: '1px dashed rgba(255, 215, 0, 0.2)' }}>
                    <div style={{ color: '#FFD700', fontWeight: 800, marginBottom: 8 }}>Invitations</div>
                    <div style={{ display: 'grid', gap: 8 }}>
                        {pendingInvites.map((inv, idx) => (
                            <div key={`${inv.gameId}-${inv.from}-${idx}`} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.04)', padding: 8, borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)' }}>
                                <div style={{ width: 28, height: 28, borderRadius: 14, overflow: 'hidden', background: '#333', border: '2px solid #FFD700' }}>
                                    {inv.avatar ? <img src={inv.avatar} alt=" " style={{ width: 28, height: 28, objectFit: 'cover' }} /> : null}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 13, fontWeight: 700 }}>{inv.name || 'Friend'} invited you</div>
                                    <div style={{ color: '#B0B0B0', fontSize: 11 }}>Players: {inv.playerCount} • Slot #{(inv.slotIndex ?? 0) + 1}</div>
                                </div>
                                <div style={{ display: 'flex', gap: 6 }}>
                                    <button onClick={() => dismissInvite(inv)} style={{ background: 'transparent', color: '#ccc', padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', cursor: 'pointer', fontWeight: 600 }}>Dismiss</button>
                                    <button onClick={() => acceptInvite(inv)} style={{ background: '#29B1A9', color: 'white', padding: '6px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 800 }}>Accept</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {(gameStarted || (onlineMode && waitingForPlayers)) && (
                <div style={{ padding: responsivePadding }}>


                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <div style={boardStyle}>
                            <svg 
                                width={BOARD_SIZE} 
                                height={BOARD_SIZE} 
                                viewBox={`0 0 ${BOARD_SIZE} ${BOARD_SIZE}`}
                                preserveAspectRatio="none"
                                style={{ display: 'block', width: `${BOARD_SIZE}px`, height: `${BOARD_SIZE}px` }}
                            >
                                <rect x="0" y="0" width={BOARD_SIZE} height={BOARD_SIZE} fill="#FFFFFF" stroke="#000000" strokeWidth="2" rx="10" ry="10" />
                                {renderBoardGrid()}
                                {renderStaticRects()}
                                {/* Safe zone markers filled with matching piece color */}

                            </svg>
                            {/* Tokens overlay - positioned absolutely to match SVG coordinates exactly */}
                            <div style={{ 
                                position: 'absolute', 
                                left: 0, 
                                top: 0, 
                                width: `${BOARD_SIZE}px`, 
                                height: `${BOARD_SIZE}px`,
                                // Ensure pixel-perfect alignment on mobile devices
                                transform: 'translateZ(0)',
                                willChange: 'contents'
                            }}>
                                {renderPlayerOrder.map((playerIndex) => (
                                    players[playerIndex]?.pieces.map((piece, pieceIndex) => tokenNode(playerIndex, pieceIndex, piece))
                                ))}
                            </div>
                            {/* Waiting lobby overlay for host */}
                            {waitingForPlayers && (
                                <div style={{ position: 'absolute', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <div style={{ background: 'rgba(26, 35, 50, 0.95)', border: '2px solid rgba(255, 215, 0, 0.5)', color: 'white', padding: 16, borderRadius: 16, textAlign: 'center', minWidth: 320 }}>
                                        <div style={{ fontWeight: 800, marginBottom: 6 }}>{myPlayerIndex === 0 ? 'Waiting for players to join…' : 'Waiting for other players…'}</div>
                                        <div style={{ fontSize: 12, color: '#B0B0B0', marginBottom: 10 }}>{myPlayerIndex === 0 ? 'Invites sent. The game will begin once your friends join.' : 'The game will begin once all players have joined.'}</div>
                                        {/* Joined status */}
                                        <div style={{ fontSize: 12, color: '#B0B0B0', marginBottom: 6 }}>
                                            {(() => {
                                                const max = Math.max(2, Math.min(4, selectedPlayerCount));
                                                const joined = Array.from({ length: max }).filter((_, i) => {
                                                    if (i === 0) {
                                                        return Boolean(players[0]?.profileId || myProfile?._id);
                                                    }
                                                    const seat = players[i];
                                                    const hasProfileId = Boolean(seat?.profileId);
                                                    if (!hasProfileId) return false;
                                                    // If they have profileId, check if they actually joined (not just invited)
                                                    // Use String() to handle ObjectId vs string comparisons
                                                    const profileIdStr = seat?.profileId ? String(seat.profileId) : null;
                                                    const inviteStatus = profileIdStr ? (invitedStatusByFriendId[profileIdStr] || invitedStatusByFriendId[seat.profileId]) : null;
                                                    // Check if this slot was reserved for an invited friend (try both string and original key)
                                                    const wasInvitedToThisSlot = profileIdStr && (invitedSlotByFriendId[profileIdStr] === i || invitedSlotByFriendId[seat.profileId] === i);
                                                    console.log(`[JoinedCount] Slot ${i}: profileId=${profileIdStr}, inviteStatus=${inviteStatus}, wasInvitedToThisSlot=${wasInvitedToThisSlot}, invitedStatusByFriendId keys:`, Object.keys(invitedStatusByFriendId), `invitedSlotByFriendId:`, invitedSlotByFriendId);
                                                    // Consider them joined only if:
                                                    // - If they were invited to this slot: only joined if status is explicitly 'joined'
                                                    // - If they were NOT invited to this slot: joined (offline assignment)
                                                    // If status is 'invited' OR they were invited but status is missing/undefined, they haven't joined yet
                                                    const isJoined = wasInvitedToThisSlot 
                                                        ? inviteStatus === 'joined'  // If invited, only joined if status is 'joined'
                                                        : inviteStatus !== 'invited';  // If not invited, joined unless status is 'invited'
                                                    console.log(`[JoinedCount] Slot ${i}: isJoined=${isJoined} (inviteStatus=${inviteStatus}, wasInvitedToThisSlot=${wasInvitedToThisSlot})`);
                                                    console.log(`[JoinedCount] Slot ${i}: isJoined=${isJoined} (inviteStatus=${inviteStatus}, wasInvitedToThisSlot=${wasInvitedToThisSlot})`);
                                                    return isJoined;
                                                }).length;
                                                return `Joined ${joined}/${max}`;
                                            })()}
                                        </div>
                                        <div style={{ display: 'grid', gap: 6 }}>
                                            {Array.from({ length: Math.max(2, Math.min(4, selectedPlayerCount)) }).map((_, i) => {
                                                const seat = players[i];
                                                // Check if player has actually joined - must have profileId AND not just be invited
                                                const hasProfileId = i === 0 ? Boolean(seat?.profileId || myProfile?._id) : Boolean(seat?.profileId);
                                                // If they have profileId, check invited status - if status is 'invited', they haven't joined yet
                                                // Use String() to handle ObjectId vs string comparisons
                                                const profileIdStr = seat?.profileId ? String(seat.profileId) : null;
                                                

                                                const inviteStatus = (i === 0 ? null : (profileIdStr ? (invitedStatusByFriendId[profileIdStr] || invitedStatusByFriendId[seat.profileId]) : null));
                                                // Check if this slot was reserved for an invited friend (even if status lookup failed)
                                                const wasInvitedToThisSlot = profileIdStr && (invitedSlotByFriendId[profileIdStr] === i || invitedSlotByFriendId[seat.profileId] === i);
                                                // Debug logging
                                                if (i > 0 && seat?.profileId) {
                                                    console.log(`[SeatStatus] Slot ${i}: profileId=${profileIdStr}, inviteStatus=${inviteStatus}, wasInvitedToThisSlot=${wasInvitedToThisSlot}, hasProfileId=${hasProfileId}, invitedStatusByFriendId keys:`, Object.keys(invitedStatusByFriendId), `invitedSlotByFriendId:`, invitedSlotByFriendId);
                                                }
                                                // Only consider joined if:
                                                // - Slot 0 is always joined if hasProfileId (host)
                                                // - OR has profileId AND:
                                                //   - If they were invited to this slot: only joined if status is explicitly 'joined'
                                                //   - If they were NOT invited to this slot: joined (offline assignment)
                                                // If status is 'invited' OR they were invited but status is missing/undefined, they haven't joined yet
                                                const joined = hasProfileId && (i === 0 || (
                                                    wasInvitedToThisSlot 
                                                        ? inviteStatus === 'joined'  // If invited, only joined if status is 'joined'
                                                        : inviteStatus !== 'invited'  // If not invited, joined unless status is 'invited' (shouldn't happen)
                                                ));
                                                if (i > 0 && seat?.profileId) {
                                                    console.log(`[SeatStatus] Slot ${i}: joined=${joined} (inviteStatus=${inviteStatus}, wasInvitedToThisSlot=${wasInvitedToThisSlot})`);
                                                }
                                                const name = seat?.name || (i === 0 ? (myProfile?.fullName || 'You') : `Seat ${i + 1}`);
                                                const invitedName = !joined ? getInvitedNameForSlot(i) : null;
                                                return (
                                                    <div key={`seatstat-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.04)', padding: '6px 8px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)' }}>
                                                        <div style={{ width: 20, height: 20, borderRadius: 10, overflow: 'hidden', background: '#333', border: '2px solid #111', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                            {seat?.avatar ? <img src={seat.avatar} alt=" " style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 10 }}>{['R','G','Y','B'][i] || 'P'}</span>}
                                                        </div>
                                                        <div style={{ fontSize: 12, flex: 1, textAlign: 'left' }}>{name}</div>
                                                        <div style={{ fontSize: 11, fontWeight: 700, color: joined ? '#00FF00' : '#FFD700', padding: '2px 8px', borderRadius: 4, background: joined ? 'rgba(0,255,0,0.1)' : 'rgba(255,215,0,0.1)' }}>{joined ? 'Joined' : (invitedName ? `Invited: ${invitedName}` : 'Waiting…')}</div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            )}
                            {/* Center dice overlay - lower z-index and no pointer events when dice is rolled */}
                            {/* Only allow clicks when dice value is 0 and can roll, otherwise let clicks pass through to tokens */}
                            <div style={{ 
                                position: 'absolute', 
                                inset: 0, 
                                zIndex: ((diceValueRef.current > 0 || diceValue > 0) && currentPlayer === myPlayerIndex) ? 5 : 50, 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center', 
                                textAlign: 'center', 
                                pointerEvents: (canRollDice && diceValueRef.current === 0 && diceValue === 0) ? 'auto' : 'none' 
                            }}>
                                <button onClick={rollDice} disabled={!canRollDice || diceRolling} style={{ background: 'transparent', border: 'none', padding: 0, cursor: (canRollDice && !diceRolling) ? 'pointer' : 'default' }}>
                                    {(() => {
                                        // Mobile device detection
                                        const isMobile = winSize.width <= 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
                                        // Reduce dice size for mobile devices
                                        const diceSize = isMobile ? 72 : 108;
                                        const avatarSize = isMobile ? 56 : 80;
                                        return (
                                            <div style={{ width: diceSize, height: diceSize, perspective: '800px' }}>
                                                <div style={{ width: '100%', height: '100%', transformStyle: 'preserve-3d', display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `rotateX(${diceRotateX}deg) rotateY(${diceRotateY}deg)`, transition: 'transform 0.7s ease-in-out' }}>
                                                    {(!diceRolling && canRollDice && diceValue === 0) ? (
                                                        players[currentPlayer]?.avatar ? (
                                                            <img src={players[currentPlayer].avatar} alt="current player" style={{ width: avatarSize, height: avatarSize, borderRadius: "50%", objectFit: 'cover', boxShadow: '0 6px 10px rgba(0,0,0,0.35)', border: `3px solid ${players[currentPlayer]?.color || '#FFD700'}` }} />
                                                        ) : (
                                                            <img src={siteConfig.logo} alt="Connect" style={{ width: avatarSize, height: avatarSize, borderRadius: "50%", objectFit: 'contain', background: 'transparent', boxShadow: '0 6px 10px rgba(0,0,0,0.35)', border: `3px solid ${players[currentPlayer]?.color || '#FFD700'}` }} />
                                                        )
                                                    ) : (
                                                        <DiceSVG value={diceRolling ? null : diceValue} size={diceSize} strokeColor={players[currentPlayer]?.color || '#FFD700'} />
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </button>
                            </div>
                        </div>
                    </div>
                    {/* Current Turn panel moved below the board */}
                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, background: 'rgba(26, 35, 50, 0.8)', padding: 16, borderRadius: 16, border: '1px solid rgba(255, 215, 0, 0.2)', width: BOARD_SIZE }}>
                            <div style={{ fontSize: 12, color: '#B0B0B0' }}>Current Turn</div>
                            <div style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 10, background: players[currentPlayer]?.color, padding: '8px 12px', borderRadius: 24 }}>
                                {players[currentPlayer]?.avatar ? (
                                    <img src={players[currentPlayer].avatar} alt="avatar" style={{ width: 26, height: 26, borderRadius: 13, objectFit: 'cover', border: '2px solid #111', background: '#fff' }} />
                                ) : (
                                    <div style={{ width: 26, height: 26, borderRadius: 13, background: '#fff', border: '2px solid #111' }} />
                                )}
                                <div style={{ fontWeight: 'bold', color: '#fff', flex: 1 }}>{players[currentPlayer]?.name}</div>
                            </div>
                            {/* Player settings buttons */}
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                {renderPlayerOrder.map((idx) => (
                                    <button key={`pbtn-${idx}`} onClick={() => openPlayerEditor(idx)} title={players[idx]?.name || 'Player'} style={{
                                        width: 32,
                                        height: 32,
                                        borderRadius: 16,
                                        background: players[idx]?.color,
                                        border: '2px solid #222',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
                                    }} aria-label={`Edit ${players[idx]?.name || 'player'}`}>
                                        {players[idx]?.avatar ? (
                                            <img src={players[idx].avatar} alt=" " style={{ width: 24, height: 24, borderRadius: 12, objectFit: 'cover', border: '2px solid #fff' }} />
                                        ) : (
                                            <span style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>{['R', 'G', 'Y', 'B'][idx] || 'P'}</span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showWinnerModal && (
                <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 3000 }}>
                    <div style={{ width: '100%', maxWidth: 520, position: 'relative' }}>
                        <WinnerConfetti />
                        <div style={{
                            background: 'linear-gradient(180deg, rgba(26,35,50,0.95), rgba(26,35,50,0.92))',
                            borderRadius: 28,
                            padding: 28,
                            border: '2px solid rgba(255, 215, 0, 0.6)',
                            color: 'white',
                            textAlign: 'center',
                            boxShadow: '0 12px 40px rgba(0,0,0,0.5)'
                        }}>
                            <div style={{ position: 'relative', marginBottom: 10 }}>
                                <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: 160, height: 160, borderRadius: 80, background: winner?.color || '#FFD700', filter: 'blur(32px)', opacity: 0.6, animation: 'winnerGlow 2.2s ease-in-out infinite' }} />
                                <div style={{ fontSize: 74, position: 'relative', animation: 'winnerPop 600ms ease forwards' }}>🏆</div>
                            </div>
                            <div style={{
                                fontSize: 28,
                                fontWeight: 900,
                                marginBottom: 6,
                                background: 'linear-gradient(90deg, #fff, #FFD700, #fff)',
                                WebkitBackgroundClip: 'text',
                                backgroundClip: 'text',
                                color: 'transparent',
                                backgroundSize: '200% 100%',
                                animation: 'textShine 2.8s linear infinite'
                            }}>{winner?.name} Wins!</div>
                            <div style={{ color: '#B0B0B0', marginBottom: 18 }}>Congratulations on your victory!</div>
                            <div style={{ display: 'flex', gap: 12 }}>
                                {!gameEnded && (
                                    <button onClick={continueGame} style={{ flex: 1, background: winner?.color || '#555', color: 'white', padding: '12px 0', border: 'none', borderRadius: 20, cursor: 'pointer', fontWeight: 'bold' }}>Continue Game</button>
                                )}
                                <button onClick={endGame} style={{ flex: 1, background: '#FF4444', color: 'white', padding: '12px 0', border: 'none', borderRadius: 20, cursor: 'pointer', fontWeight: 'bold' }}>End Game</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Incoming Invite Modal */}
            {incomingInviteRequest && (
                <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 3000 }}>
                    <div style={{ width: '100%', maxWidth: 420, background: 'rgba(26, 35, 50, 0.95)', borderRadius: 24, padding: 22, border: '2px solid rgba(255, 215, 0, 0.5)', color: 'white' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                            <div style={{ width: 48, height: 48, borderRadius: 24, overflow: 'hidden', background: '#222', border: '2px solid #FFD700', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {incomingInviteRequest.avatar ? (
                                    <img src={incomingInviteRequest.avatar} alt="inviter" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                    <span>🎲</span>
                                )}
                            </div>
                            <div>
                                <div style={{ fontWeight: 800, fontSize: 16 }}>Game Invite</div>
                                <div style={{ color: '#B0B0B0', fontSize: 13 }}>{incomingInviteRequest.name || 'A friend'} invited you to play Ludo</div>
                            </div>
                        </div>
                        <div style={{ color: '#B0B0B0', fontSize: 12, marginBottom: 12 }}>Players: {incomingInviteRequest.playerCount} • Slot #{(incomingInviteRequest.slotIndex ?? 0) + 1}</div>
                        <div style={{ display: 'flex', gap: 10 }}>
                            <button onClick={declineIncomingInvite} style={{ flex: 1, background: '#555', color: 'white', padding: '10px 0', border: 'none', borderRadius: 12, cursor: 'pointer', fontWeight: 'bold' }}>Decline</button>
                            <button onClick={acceptIncomingInvite} style={{ flex: 1, background: '#29B1A9', color: 'white', padding: '10px 0', border: 'none', borderRadius: 12, cursor: 'pointer', fontWeight: 'bold' }}>Accept</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Connection Status Indicator */}
            {onlineMode && gameStarted && !gameEnded && (
                <div style={{ 
                    position: 'fixed', 
                    top: 10, 
                    right: 10, 
                    zIndex: 1000, 
                    background: socketRef.current?.connected ? 'rgba(0, 200, 0, 0.9)' : 'rgba(255, 0, 0, 0.9)',
                    color: 'white',
                    padding: '6px 12px',
                    borderRadius: 20,
                    fontSize: 12,
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
                }}>
                    <div style={{ 
                        width: 8, 
                        height: 8, 
                        borderRadius: '50%', 
                        background: socketRef.current?.connected ? '#00FF00' : '#FF0000'
                    }} />
                    {socketRef.current?.connected ? 'Connected' : 'Disconnected'}
                </div>
            )}

            {/* Player Editor Modal */}
            {showPlayerEditor && editingPlayerIndex != null && (
                <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 3000 }}>
                    <div style={{ width: '100%', maxWidth: 460, background: 'rgba(26, 35, 50, 0.95)', borderRadius: 24, padding: 22, border: `2px solid ${players[editingPlayerIndex]?.color || 'rgba(255, 215, 0, 0.5)'}`, color: 'white' }}>
                        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Edit Player</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                            <div style={{ width: 56, height: 56, borderRadius: 28, overflow: 'hidden', border: `3px solid ${players[editingPlayerIndex]?.color || '#FFD700'}`, background: '#222', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {editAvatarUrl ? (
                                    <img src={editAvatarUrl} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                    <span style={{ fontSize: 22 }}>{playerEmojis[editingPlayerIndex]}</span>
                                )}
                            </div>
                            <div>
                                <div style={{ fontSize: 12, color: '#B0B0B0' }}>Player #{editingPlayerIndex + 1}</div>
                                <div style={{ fontWeight: 700 }}>{players[editingPlayerIndex]?.name}</div>
                            </div>
                        </div>
                        <div style={{ display: 'grid', gap: 10 }}>
                            <input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Enter name" style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.06)', color: 'white' }} />
                            <input value={editAvatarUrl} onChange={(e) => setEditAvatarUrl(e.target.value)} placeholder="Avatar image URL" style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.06)', color: 'white' }} />
                            <div>
                                <input ref={avatarFileInputRef} type="file" accept="image/*" onChange={onPickAvatarFile} style={{ display: 'none' }} />
                                <button onClick={() => avatarFileInputRef.current && avatarFileInputRef.current.click()} style={{ background: '#4444FF', color: 'white', padding: '10px 12px', border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 'bold' }}>Upload Picture</button>
                            </div>
                        </div>
                        <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px dashed rgba(255,255,255,0.2)' }}>
                            <div style={{ fontWeight: 700, marginBottom: 8 }}>Migrate to another device</div>
                            <button onClick={copyInviteLink} style={{ background: '#29B1A9', color: 'white', padding: '10px 12px', border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 'bold' }}>Copy Invite Link</button>
                            {inviteCopied && <span style={{ color: '#B0FFB0', marginLeft: 10 }}>Copied!</span>}
                        </div>
                        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                            <button onClick={closePlayerEditor} style={{ flex: 1, background: '#555', color: 'white', padding: '10px 0', border: 'none', borderRadius: 12, cursor: 'pointer', fontWeight: 'bold' }}>Cancel</button>
                            <button onClick={savePlayerEditor} style={{ flex: 1, background: players[editingPlayerIndex]?.color || '#00AA00', color: 'white', padding: '10px 0', border: 'none', borderRadius: 12, cursor: 'pointer', fontWeight: 'bold' }}>Save</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LudoGame;