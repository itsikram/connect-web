import { scale } from 'framer-motion';
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import api from '../api/api';
import siteConfig from '../config/config.json';
import { io } from 'socket.io-client';

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

    const BOARD_SIZE = Math.min(winSize.width * 0.85, winSize.height * 0.6);
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
            { x: 0, y: 8 }, { x: 0, y: 7 }, { x: 0, y: 6 },
            { x: 1, y: 7 }, { x: 2, y: 7 }, { x: 3, y: 7 }, { x: 4, y: 7 }, { x: 5, y: 7 }, { x: 6, y: 7 }, { x: 7, y: 7 }
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
            { x: 6, y: 0 }, { x: 7, y: 0 }, { x: 8, y: 0 },
            { x: 7, y: 1 }, { x: 7, y: 2 }, { x: 7, y: 3 }, { x: 7, y: 4 }, { x: 7, y: 5 }, { x: 7, y: 6 }, { x: 7, y: 7 }
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
            { x: 8, y: 14 }, { x: 7, y: 14 }, { x: 6, y: 14 },
            { x: 7, y: 13 }, { x: 7, y: 12 }, { x: 7, y: 11 }, { x: 7, y: 10 }, { x: 7, y: 9 }, { x: 7, y: 8 }, { x: 7, y: 7 }
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
            { x: 14, y: 6 }, { x: 14, y: 7 }, { x: 14, y: 8 },
            { x: 13, y: 7 }, { x: 12, y: 7 }, { x: 11, y: 7 }, { x: 10, y: 7 }, { x: 9, y: 7 }, { x: 8, y: 7 }, { x: 7, y: 7 }
        ]
    }), [winSize.width, winSize.height]);

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
    // Online friends selection
    const [onlineMode, setOnlineMode] = useState(false);
    const [selectedFriends, setSelectedFriends] = useState([]); // [{ _id, fullName, profilePic }]
    const [friendSearchQuery, setFriendSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [loadingSearch, setLoadingSearch] = useState(false);
    const [friendList, setFriendList] = useState([]);
    const [invitedStatusByFriendId, setInvitedStatusByFriendId] = useState({}); // { friendId: 'invited'|'joined'|'declined' }
    const [invitedSlotByFriendId, setInvitedSlotByFriendId] = useState({}); // { friendId: slotIndex }
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
    const [gameId, setGameId] = useState(null);
    const [myPlayerIndex, setMyPlayerIndex] = useState(0);
    const socketBaseUrl = useMemo(() => {
        try {
            const envUrl = (typeof process !== 'undefined' && process?.env?.REACT_APP_SOCKET_URL) ? process.env.REACT_APP_SOCKET_URL : null;
            let url = envUrl || (siteConfig?.siteUrl && typeof siteConfig.siteUrl === 'string' ? siteConfig.siteUrl : window.location.origin);
            // Dev heuristic: CRA at 3000, API at 5000
            try {
                const loc = window.location;
                if (!envUrl && (!siteConfig?.siteUrl || siteConfig.siteUrl === '/') && /localhost|127\.|::1/.test(loc.hostname) && String(loc.port) === '3000') {
                    url = `${loc.protocol}//${loc.hostname}:4000`;
                }
                // If siteConfig.siteUrl explicitly points to :3000 in dev, override to :4000
                if (!envUrl && siteConfig?.siteUrl) {
                    try {
                        const raw = siteConfig.siteUrl;
                        const parsed = new URL(raw, loc.origin);
                        const isLocal = /localhost|127\.|::1/.test(parsed.hostname);
                        const is3000 = parsed.port === '3000' || (!parsed.port && String(loc.port) === '3000');
                        if (isLocal && is3000) {
                            url = `${parsed.protocol}//${parsed.hostname}:4000`;
                        }
                    } catch (_e4) {}
                }
            } catch (_e2) {}
            const normalized = url.replace(/\/$/, '');
            try { console.log('[LUDO][client] socket base URL resolved', { envUrl, siteUrl: siteConfig?.siteUrl, final: normalized }); } catch (_e3) {}
            return normalized;
        } catch (_e) {
            return window.location.origin;
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

    useEffect(() => { playersRef.current = players; }, [players]);
    useEffect(() => { currentPlayerRef.current = currentPlayer; }, [currentPlayer]);
    useEffect(() => { selectedPlayerCountRef.current = selectedPlayerCount; }, [selectedPlayerCount]);
    useEffect(() => { winnersRef.current = winners; }, [winners]);
    useEffect(() => { maxStepsRef.current = maxSteps; }, [maxSteps]);

    // Ensure socket connection (used before game start for invites)
    const ensureSocketConnected = useCallback(() => {
        try {
            if (!myProfile?._id) return;
            if (!socketRef.current) {
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
                    forceNew: true,
                    withCredentials: true
                };
                try { console.log('[LUDO][client] creating socket', { baseUrl: socketBaseUrl, profile: myProfile?._id, opts }); } catch (_e) { }
                socketRef.current = io(socketBaseUrl, opts);
                try {
                    socketRef.current.on('connect', () => {
                        try { console.log('[LUDO][client] socket connected', { id: socketRef.current?.id }); } catch (_e) { }
                        try { console.log('[LUDO][client] emit ludo:invites:get (on connect)'); socketRef.current?.emit('ludo:invites:get'); } catch (_e) { }
                    });
                    socketRef.current.on('connect_error', (err) => {
                        try { console.error('[LUDO][client] connect_error', { message: err?.message, baseUrl: socketBaseUrl, path: socketPath, query: { profile: myProfile?._id } }); } catch (_e) { }
                        // Fallbacks: try window.origin if different; then try :4000 if on :3000
                        try {
                            const origin = window.location.origin.replace(/\/$/, '');
                            const currentBase = (socketBaseUrl || '').replace(/\/$/, '');
                            const isLocal3000 = /localhost|127\.|::1/.test(window.location.hostname) && String(window.location.port) === '3000';
                            const alt4000 = `${window.location.protocol}//${window.location.hostname}:4000`;
                            if (!socketRef.current.__triedFallback) {
                                socketRef.current.__triedFallback = true;
                                if (origin && currentBase && origin !== currentBase) {
                                    console.log('[LUDO][client] attempting socket fallback to window.origin', { origin, currentBase });
                                    try { socketRef.current.off(); socketRef.current.close(); } catch (_e2) {}
                                    socketRef.current = io(origin, opts);
                                    return;
                                }
                            }
                            if (!socketRef.current.__triedDev4000 && isLocal3000) {
                                socketRef.current.__triedDev4000 = true;
                                console.log('[LUDO][client] attempting socket fallback to localhost:4000');
                                try { socketRef.current.off(); socketRef.current.close(); } catch (_e4) {}
                                socketRef.current = io(alt4000, opts);
                            }
                        } catch (_e3) {}
                    });
                    socketRef.current.on('error', (err) => {
                        try { console.error('[LUDO][client] socket error', err); } catch (_e) { }
                    });
                    socketRef.current.on('disconnect', (reason) => {
                        try { console.log('[LUDO][client] socket disconnect', { reason }); } catch (_e) { }
                    });
                } catch (_e) { }
            }
        } catch (_e) { }
    }, [myProfile?._id, socketBaseUrl]);

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
            const playerWon = winners.some(w => w.id === candidate);
            if (!playerWon) return candidate;
            attempts++;
        }
        return fromIndex;
    }, [selectedPlayerCount, winners]);

    // Rendering order to match dice sequence
    const renderPlayerOrder = useMemo(() => {
        return selectedPlayerCount === 4 ? [0, 1, 3, 2] : [0, 1, 2].slice(0, selectedPlayerCount);
    }, [selectedPlayerCount]);

    // Animation timing (web simulation)
    const stepDurationMs = 300;
    const moveTimersRef = useRef([]);
    useEffect(() => () => {
        moveTimersRef.current.forEach(t => clearTimeout(t));
    }, []);

    // Helpers (identical logic)
    const getPositionOnPath = (playerIndex, steps) => {
        const path = PATHS[playerIndex];
        if (!path || steps <= 0 || steps > path.length) {
            return { x: 7, y: 7 };
        }
        return path[steps - 1];
    };

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

    const checkForCapture = (movingPlayerIndex, newPosition) => {
        const srcPlayers = playersRef.current && Array.isArray(playersRef.current) ? playersRef.current : players;
        const captured = [];
        srcPlayers.forEach((player, playerIndex) => {
            if (playerIndex === movingPlayerIndex) return;
            player.pieces.forEach((piece, pieceIndex) => {
                if (piece.isInPlay) {
                    if (piece.steps >= 52) return;
                    const piecePosition = getPositionOnPath(playerIndex, piece.steps);
                    if (piecePosition.x === newPosition.x && piecePosition.y === newPosition.y) {
                        if (!isSafePosition(playerIndex, piecePosition)) {
                            captured.push({ playerIndex, pieceIndex });
                        }
                    }
                }
            });
        });
        try { if (captured.length > 0) console.log('[LUDO][client] capture detected', { movingPlayerIndex, newPosition, captured }); } catch (_e) {}
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
        ensureSocketConnected();
    }, [ensureSocketConnected]);

    // Also connect when profile becomes available (initial load race fix)
    useEffect(() => {
        if (!myProfile?._id) return;
        if (!socketRef.current || socketRef.current.disconnected) {
            ensureSocketConnected();
        }
    }, [myProfile?._id, ensureSocketConnected]);

    // Fetch pending invites on connect/profile available
    useEffect(() => {
        if (!socketRef.current || !myProfile?._id) return;
        try { console.log('[LUDO][client] emit ludo:invites:get'); socketRef.current.emit('ludo:invites:get'); } catch (_e) { }
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
                try { console.log('[LUDO][client][invite-link] token detected', { payload }); } catch (_e) {}
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
                    try { console.log('[LUDO][client][invite-link] acting as invitee, auto-accept', { gid, slotFromLink, playerCountFromLink }); } catch (_e) {}
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
                    try { console.log('[LUDO][client][invite-link] acting as inviter (migration), auto-start host'); } catch (_e) {}
                    setShowPlayerSelection(false);
                    setGameStarted(true);
                    setCurrentPlayer(0);
                    setDiceValue(0);
                    setWinner(null);
                    setCanRollDice(true);
                    setDiceRolling(false);
                    initializeGame(playerCountFromLink || selectedPlayerCount);
                    ensureSocketConnected();
                    try {
                        if (!socketRef.current) {
                            socketRef.current = io(socketBaseUrl, {
                                transports: ['websocket', 'polling'],
                                path: '/socket.io',
                                query: { profile: myProfile?._id }
                            });
                        }
                        socketRef.current.emit('ludo:join', { gameId: gid });
                        setMyPlayerIndex(0);
                        emitPlayersState(gid);
                    } catch (_e) { }
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
                // keep piece steps so remotes can render tokens
                pieces: (Array.isArray(p.pieces) ? p.pieces.map(pc => ({ id: pc.id, steps: pc.steps, isHome: pc.isHome, isInPlay: pc.isInPlay })) : [])
            }));
            try { console.log('[LUDO][client] emit ludo:players snapshot', { gameId: gid, ids: minimalPlayers.map(x => x.profileId) }); } catch (_e) {}
            // Host guard: normalize seat 0 profileId to host
            if (minimalPlayers[0]) {
                minimalPlayers[0].profileId = myProfile?._id || minimalPlayers[0].profileId;
                minimalPlayers[0].name = myProfile?.fullName || minimalPlayers[0].name;
                minimalPlayers[0].avatar = myProfile?.profilePic || minimalPlayers[0].avatar;
                minimalPlayers[0].cover = myProfile?.coverPic || minimalPlayers[0].cover;
            }
            socketRef.current.emit('ludo:players', { gameId: gid, players: minimalPlayers, selectedPlayerCount, currentPlayer });
        } catch (_e) { }
    }, [players, selectedPlayerCount, currentPlayer, onlineMode]);

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
        try { console.log('[LUDO][client] inviteFriend', { targetId: friend?._id, gid, slot, selectedPlayerCount }); } catch (_e) { }
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
        setInvitedStatusByFriendId(prev => ({ ...prev, [friend._id]: 'invited' }));
        setInvitedSlotByFriendId(prev => ({ ...prev, [friend._id]: slot }));
        try {
            const targetId = friend?._id || friend?.id;
            if (!targetId) return;
            // Join/create room for host immediately (do before sending invite)
            try { console.log('[LUDO][client] emit ludo:join', { gid }); emitSocket('ludo:join', { gameId: gid }); } catch (_e) { }
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
            try { console.log('[LUDO][client] emitted ludo:invite', { to: targetId, gid, slot }); } catch (_e) { }
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

    // Determine if host should wait in lobby for invited players
    const recomputeWaitingState = useCallback(() => {
        try {
            // Gate waiting in online games for both host and invitees
            if (!onlineMode || myProfile?._id == null) {
                setWaitingForPlayers(false);
                return;
            }
            const invitedMap = invitedStatusByFriendId || {};
            const reservedMap = invitedSlotByFriendId || {};
            const invitedIds = Object.keys(invitedMap);
            const maxPlayers = Math.max(2, Math.min(4, selectedPlayerCount));
            // Compute actual joined seats (excluding host at 0)
            const joinedIds = new Set(
                players
                    .slice(1, maxPlayers)
                    .map(p => (p && p.profileId ? String(p.profileId) : null))
                    .filter(Boolean)
            );

            // If no invites tracked, rely purely on seat occupancy
            if (invitedIds.length === 0) {
                const allSeatsFilled = joinedIds.size >= (maxPlayers - 1);
                setWaitingForPlayers(!allSeatsFilled);
                if (!allSeatsFilled) setCanRollDice(false);
                return;
            }

            // Wait only if an invited friend hasn't actually joined yet
            const stillInvited = invitedIds.some(fid => invitedMap[fid] === 'invited' && !joinedIds.has(String(fid)));

            // Also consider reserved slots whose intended profile hasn't appeared in any seat yet
            let missingProfiles = false;
            for (const [fid, slotIndexRaw] of Object.entries(reservedMap)) {
                const fidStr = String(fid);
                const slotIndex = Number(slotIndexRaw);
                if (!Number.isFinite(slotIndex)) continue;
                if (!joinedIds.has(fidStr)) { missingProfiles = true; break; }
            }

            // If every non-host seat is filled, do not wait regardless of stale invite map
            const allSeatsFilled = joinedIds.size >= (maxPlayers - 1);
            const shouldWait = allSeatsFilled ? false : Boolean(stillInvited || missingProfiles);

            try {
                console.log('[LUDO][client] recomputeWaitingState', {
                    onlineMode,
                    isHost: myPlayerIndex === 0,
                    invitedStatusByFriendId,
                    invitedSlotByFriendId,
                    selectedPlayerCount,
                    playersProfileIds: players.map(p => p?.profileId || null),
                    joinedIds: Array.from(joinedIds),
                    stillInvited,
                    missingProfiles,
                    allSeatsFilled,
                    shouldWait
                });
            } catch (_e) {}
            setWaitingForPlayers(shouldWait);
            if (shouldWait) {
                setCanRollDice(false);
            } else {
                // Seats are filled; ensure dice can roll and clear stale invite maps to prevent future flicker
                setCanRollDice(true);
                if (allSeatsFilled) {
                    try {
                        setInvitedStatusByFriendId({});
                        setInvitedSlotByFriendId({});
                    } catch (_e) {}
                }
            }
        } catch (_e) {
            setWaitingForPlayers(false);
        }
    }, [onlineMode, myPlayerIndex, invitedStatusByFriendId, invitedSlotByFriendId, players, myProfile?._id, selectedPlayerCount]);

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

    const rollDice = () => {
        if (waitingForPlayers) return;
        if (!canRollDice || diceRolling) return;
        if (onlineMode && myPlayerIndex !== currentPlayer) return; // only active player may roll online
        setDiceRolling(true);
        setCanRollDice(false);
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
        // simple spin delay
        setTimeout(() => {
            const value = (debugChosenValue && debugChosenValue >= 1 && debugChosenValue <= 6)
                ? debugChosenValue
                : (Math.floor(Math.random() * 6) + 1);
            setDiceValue(value);
            lastDiceValueRef.current = value;
            setDiceRolling(false);
            if (onlineMode && socketRef.current && gameId) {
                try { socketRef.current.emit('ludo:roll', { gameId, value, by: myProfile?._id }); } catch (_e) { }
            }

            const currentPlayerData = players[currentPlayer];
            const canMove = currentPlayerData?.pieces?.some(piece => {
                if (piece.isHome && value === 6) return true;
                if (piece.isInPlay && piece.steps + value <= maxSteps) return true;
                return false;
            });

            if (!canMove) {
                setTimeout(() => {
                    const nextPlayer = getNextActivePlayer(currentPlayer);
                    setCurrentPlayer(nextPlayer);
                    setDiceValue(0);
                    setCanRollDice(true);
                }, 600);
            }
        }, 500);
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
            updated[playerIndex].pieces[pieceIndex] = {
                ...capturedPiece,
                isHome: true,
                isInPlay: false,
                steps: 0,
            };
            return updated;
        });
    };

    const animateTokenMovement = (playerIndex, pieceIndex, toSteps, fromStepsOverride, onComplete) => {
        // Web simulation: step through updates to piece.steps to visualize movement
        const currentPlayers = playersRef.current && Array.isArray(playersRef.current) ? playersRef.current : players;
        const safePlayer = currentPlayers[playerIndex];
        const safePiece = safePlayer && Array.isArray(safePlayer.pieces) ? safePlayer.pieces[pieceIndex] : null;
        const fromSteps = (typeof fromStepsOverride === 'number' && Number.isFinite(fromStepsOverride))
            ? fromStepsOverride
            : (safePiece && typeof safePiece.steps === 'number' ? safePiece.steps : 0);
        const stepsToGo = toSteps - fromSteps;
        if (stepsToGo <= 0) {
            onComplete && onComplete();
            return;
        }
        const timers = [];
        for (let s = 1; s <= stepsToGo; s++) {
            const timer = setTimeout(() => {
                setPlayers(prev => {
                    const copy = prev.map(p => ({ ...p, pieces: p.pieces.map(pc => ({ ...pc })) }));
                    copy[playerIndex].pieces[pieceIndex].steps = fromSteps + s;
                    copy[playerIndex].pieces[pieceIndex].isHome = false;
                    copy[playerIndex].pieces[pieceIndex].isInPlay = true;
                    return copy;
                });
                if (s === stepsToGo) {
                    onComplete && onComplete();
                }
            }, s * stepDurationMs);
            timers.push(timer);
        }
        moveTimersRef.current.push(...timers);
    };

    const movePiece = (pieceId) => {
        if (diceValue === 0) return;
        const rolledNow = diceValue;
        const currentPlayerData = players[currentPlayer];
        const piece = currentPlayerData.pieces[pieceId];

        if (piece.isHome && diceValue !== 6) return;
        if (piece.isInPlay && piece.steps + diceValue > maxSteps) return;

        const globalMove = () => {
            if (piece.isHome && diceValue === 6) {
                // Move out
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

                // Capture at start position
                const newPosition = getPositionOnPath(currentPlayer, 1);
                const capturedPieces = checkForCapture(currentPlayer, newPosition);
                capturedPieces.forEach(({ playerIndex, pieceIndex }) => captureToken(playerIndex, pieceIndex));

                setDiceValue(0);
                setCanRollDice(true); // keep turn on 6
            } else if (piece.isInPlay) {
                const oldSteps = piece.steps;
                const newSteps = piece.steps + diceValue;
                if (newSteps <= maxSteps) {
                    if (onlineMode && socketRef.current && gameId) {
                        try { socketRef.current.emit('ludo:move', { gameId, by: myProfile?._id, playerIndex: currentPlayer, pieceIndex: pieceId, toSteps: newSteps, fromSteps: oldSteps, rolled: rolledNow }); } catch (_e) { }
                    }
                    animateTokenMovement(currentPlayer, pieceId, newSteps, undefined, () => {
                        // After animation, run capture/win checks
                        setPlayers(prev => {
                            const updatedPlayers = prev.map(p => ({ ...p, pieces: p.pieces.map(pc => ({ ...pc })) }));
                            updatedPlayers[currentPlayer].pieces[pieceId].steps = newSteps;
                            return updatedPlayers;
                        });

                        let didCapture = false;
                        if (newSteps < maxSteps) {
                            const newPosition = getPositionOnPath(currentPlayer, newSteps);
                            const capturedPieces = checkForCapture(currentPlayer, newPosition);
                            didCapture = Array.isArray(capturedPieces) && capturedPieces.length > 0;
                            capturedPieces.forEach(({ playerIndex, pieceIndex }) => captureToken(playerIndex, pieceIndex));
                        }

                        if (newSteps === maxSteps) {
                            setPlayers(prev => {
                                const updatedPlayers = prev.map(p => ({ ...p, pieces: p.pieces.map(pc => ({ ...pc })) }));
                                const finishedCount = updatedPlayers[currentPlayer].pieces.filter(p => p.steps === maxSteps).length;
                                if (finishedCount === 4) {
                                    const winnerPlayer = updatedPlayers[currentPlayer];
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

                        setDiceValue(0);
                        const keepTurn = (rolledNow === 6) || didCapture;
                        if (keepTurn) {
                            setCanRollDice(true);
                        } else {
                            setTimeout(() => {
                                const nextPlayer = getNextActivePlayer(currentPlayer);
                                setCurrentPlayer(nextPlayer);
                                setCanRollDice(true);
                            }, 300);
                        }
                    });
                }
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
            if (payload.by && myProfile?._id && String(payload.by) === String(myProfile._id)) return;
            const value = payload.value;
            setDiceValue(value);
            setDiceRolling(false);
            lastDiceValueRef.current = value;
            const currentPlayerData = playersRef.current[currentPlayerRef.current];
            const canMove = currentPlayerData?.pieces?.some(piece => {
                if (piece.isHome && value === 6) return true;
                if (piece.isInPlay && piece.steps + value <= maxStepsRef.current) return true;
                return false;
            });
            if (!canMove) {
                setTimeout(() => {
                    const nextPlayer = getNextActivePlayer(currentPlayerRef.current);
                    setCurrentPlayer(nextPlayer);
                    setDiceValue(0);
                    setCanRollDice(true);
                }, 600);
            }
        };

        const onAccepted = (payload) => {
            try {
                if (!payload || payload.gameId !== gameId) return;
                // Host updates: friend joined; update status and broadcast players
                try { console.log('[LUDO][client] on ludo:accepted', payload); } catch (_e) {}
                if (payload.friend && payload.friend._id) {
                    setInvitedStatusByFriendId(prev => ({ ...prev, [payload.friend._id]: 'joined' }));
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
                        }
                        return copy;
                    });
                }
                // Broadcast current players snapshot
                try {
                    const minimalPlayers = playersRef.current.map(p => ({
                        id: p.id,
                        name: p.name,
                        color: p.color,
                        avatar: p.avatar,
                        cover: p.cover,
                        profileId: p.profileId,
                        pieces: (Array.isArray(p.pieces) ? p.pieces.map(pc => ({ id: pc.id, steps: pc.steps, isHome: pc.isHome, isInPlay: pc.isInPlay })) : [])
                    }));
                    s.emit('ludo:players', { gameId: payload.gameId, players: minimalPlayers, selectedPlayerCount: selectedPlayerCountRef.current, currentPlayer: currentPlayerRef.current });
                } catch (_e) { }
                // Update lobby state based on new join
                recomputeWaitingState();
                try { console.log('[LUDO][client] post-accept recompute done'); } catch (_e) {}
            } catch (_e) { }
        };

        const onPlayers = (payload) => {
            try {
                if (!payload || payload.gameId !== gameId) return;
                // Host keeps authoritative local state; ignore snapshots that might be stale
                if (myPlayerIndex === 0) {
                    return;
                }
                if (Array.isArray(payload.players)) {
                    const next = payload.players.map(p => ({
                        ...p,
                        pieces: Array.isArray(p.pieces) ? p.pieces.map(pc => ({ ...pc })) : []
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
                                    pieces: Array.isArray(next[i]?.pieces) ? next[i].pieces : (Array.isArray(prev[i]?.pieces) ? prev[i].pieces.map(pc => ({ ...pc })) : [])
                                };
                            }
                        }
                    } catch (_e) {}
                    setPlayers(next);
                }
                if (typeof payload.selectedPlayerCount === 'number') {
                    setSelectedPlayerCount(payload.selectedPlayerCount);
                }
                if (typeof payload.currentPlayer === 'number') {
                    setCurrentPlayer(payload.currentPlayer);
                }
                if (!gameStarted) setGameStarted(true);
            } catch (_e) { }
        };

        const onMove = (payload) => {
            if (!payload || payload.gameId !== gameId) return;
            if (payload.by && myProfile?._id && String(payload.by) === String(myProfile._id)) return;
            const { playerIndex, pieceIndex, toSteps, fromSteps } = payload;
            const mover = typeof playerIndex === 'number' ? playerIndex : currentPlayerRef.current;
            animateTokenMovement(mover, pieceIndex, toSteps, (typeof fromSteps === 'number' ? fromSteps : undefined), () => {
                setPlayers(prev => {
                    const updatedPlayers = prev.map(p => ({ ...p, pieces: p.pieces.map(pc => ({ ...pc })) }));
                    updatedPlayers[mover].pieces[pieceIndex].steps = toSteps;
                    return updatedPlayers;
                });

                let didCapture = false;
                if (toSteps < maxStepsRef.current) {
                    const newPosition = getPositionOnPath(mover, toSteps);
                    const capturedPieces = checkForCapture(mover, newPosition);
                    didCapture = Array.isArray(capturedPieces) && capturedPieces.length > 0;
                    capturedPieces.forEach(({ playerIndex: pi, pieceIndex: pj }) => captureToken(pi, pj));
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

                setDiceValue(0);
                const rolled = Number(payload?.rolled);
                const keepTurn = rolled === 6 || didCapture;
                if (!keepTurn) {
                    setTimeout(() => {
                        const nextPlayer = getNextActivePlayer(mover);
                        setCurrentPlayer(nextPlayer);
                        setCanRollDice(true);
                    }, 300);
                } else {
                    setCanRollDice(true);
                }
            });
        };

        s.on('ludo:roll', onRoll);
        s.on('ludo:accepted', onAccepted);
        s.on('ludo:players', onPlayers);
        s.on('ludo:move', onMove);
        const onJoined = (payload) => { try { console.log('[LUDO][client] on ludo:joined', payload); } catch (_e) {} };
        s.on('ludo:joined', onJoined);
        return () => {
            s.off('ludo:roll', onRoll);
            s.off('ludo:accepted', onAccepted);
            s.off('ludo:players', onPlayers);
            s.off('ludo:move', onMove);
            s.off('ludo:joined', onJoined);
        };
    }, [onlineMode, gameId, myProfile?._id]);

    // Recompute waiting state whenever invite statuses or players change
    useEffect(() => {
        recomputeWaitingState();
    }, [invitedStatusByFriendId, players, selectedPlayerCount, onlineMode, myPlayerIndex, recomputeWaitingState]);

    // When waiting ends, allow dice interactions again
    useEffect(() => {
        if (!waitingForPlayers && gameStarted) {
            setCanRollDice(true);
        }
    }, [waitingForPlayers, gameStarted]);

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
                try { console.log('[LUDO][client] on ludo:invite', payload); } catch (_e) { }
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
                    try { console.log('[LUDO][client] on ludo:invites', { count: arr.length, invites: arr }); } catch (_e) { }
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
            try {
                if (socketRef.current) {
                    socketRef.current.disconnect();
                    socketRef.current = null;
                }
            } catch (_e) { }
        };
    }, []);

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
        setGameStarted(true);
        setCurrentPlayer(0);
        setDiceValue(0);
        setWinner(null);
        setCanRollDice(true);
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
        // Setup online room/socket
        if (onlineMode && myProfile?._id) {
            const gid = gameId || generateGameId();
            setGameId(gid);
            try {
                if (!socketRef.current) {
                    socketRef.current = io(socketBaseUrl, {
                        transports: ['websocket', 'polling'],
                        path: '/socket.io',
                        query: { profile: myProfile?._id }
                    });
                }
                try { console.log('[LUDO][client] emit ludo:join (host)', { gid }); } catch (_e) {}
                socketRef.current.emit('ludo:join', { gameId: gid });
                setMyPlayerIndex(0);
                // Broadcast players snapshot so remotes sync
                emitPlayersState(gid);
            } catch (_e) { }
            // Enter waiting lobby if invites are pending or slots not yet filled
            recomputeWaitingState();
            setCanRollDice(false);
        }
    };

    const continueGame = () => {
        setShowWinnerModal(false);
        setWinner(null);
        const nextPlayer = getNextActivePlayer(currentPlayer);
        setCurrentPlayer(nextPlayer);
        setDiceValue(0);
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
        moveTimersRef.current.forEach(t => clearTimeout(t));
        moveTimersRef.current = [];
        setGameStarted(false);
        setWinner(null);
        setWinners([]);
        setGameEnded(false);
        setShowWinnerModal(false);
        setDiceValue(0);
        setCurrentPlayer(0);
        setCanRollDice(true);
        setDiceRolling(false);
        setShowPlayerSelection(false);
        initializeGame(selectedPlayerCount);
        setInvitedStatusByFriendId({});
        setInvitedSlotByFriendId({});
        setIncomingInviteRequest(null);
    };

    // Accept / decline an incoming invite
    const acceptIncomingInvite = async () => {
        const payload = incomingInviteRequest;
        if (!payload) return;
        try {
                try { console.log('[LUDO][client] acceptIncomingInvite', payload); } catch (_e) {}
                try { setLastInviter({ id: payload.from, name: payload.name, avatar: payload.avatar }); } catch (_e) {}
            setOnlineMode(true);
            setGameId(payload.gameId);
            setSelectedPlayerCount([2, 3, 4].includes(payload.playerCount) ? payload.playerCount : selectedPlayerCount);
            ensureSocketConnected();
            if (socketRef.current) {
                try { console.log('[LUDO][client] emit ludo:join (invitee)'); socketRef.current.emit('ludo:join', { gameId: payload.gameId }); } catch (_e) { }
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
                console.log('[LUDO][client] emit ludo:accept', { gameId: payload.gameId, slotIndex: payload.slotIndex });
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

    // Rendering helpers
    const homePositions = [
        [{ x: 2, y: 2 }, { x: 3, y: 2 }, { x: 2, y: 3 }, { x: 3, y: 3 }],
        [{ x: 11, y: 2 }, { x: 12, y: 2 }, { x: 11, y: 3 }, { x: 12, y: 3 }],
        [{ x: 2, y: 11 }, { x: 3, y: 11 }, { x: 2, y: 12 }, { x: 3, y: 12 }],
        [{ x: 11, y: 11 }, { x: 12, y: 11 }, { x: 11, y: 12 }, { x: 12, y: 12 }],
    ];

    // Compute overlapping tokens in the same board cell for better visibility
    const cellOccupancy = useMemo(() => {
        const map = new Map();
        players.forEach((player, playerIndex) => {
            player.pieces.forEach((piece, pieceIndex) => {
                if (piece.isInPlay) {
                    const pos = getPositionOnPath(playerIndex, piece.steps);
                    const key = `${pos.x},${pos.y}`;
                    if (!map.has(key)) map.set(key, []);
                    map.get(key).push({ playerIndex, pieceIndex });
                }
            });
        });
        return map;
    }, [players]);

    const getOverlapOffset = (count, index) => {
        // Keep overlapping tokens within the same cell
        const delta = CELL_SIZE * 0.35;
        if (count <= 1) return { dx: 0, dy: 0 };
        if (count === 2) {
            return { dx: index === 0 ? -delta / 2 : delta / 2, dy: 0 };
        }
        if (count === 3) {
            const positions = [
                { dx: -delta / 2, dy: -delta / 2 },
                { dx: delta / 2, dy: -delta / 2 },
                { dx: 0, dy: delta / 2 },
            ];
            return positions[index] || { dx: 0, dy: 0 };
        }
        // 4 or more - use 2x2 grid for first 4
        const grid = [
            { dx: -delta / 2, dy: -delta / 2 },
            { dx: delta / 2, dy: -delta / 2 },
            { dx: -delta / 2, dy: delta / 2 },
            { dx: delta / 2, dy: delta / 2 },
        ];
        return grid[index % 4];
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

    const tokenSize = CELL_SIZE * 0.9;
    const boardStyle = {
        position: 'relative',
        width: BOARD_SIZE + 'px',
        height: BOARD_SIZE + 'px',
        borderRadius: '15px',
        overflow: 'hidden',
        background: '#fff',
        boxShadow: '0 6px 12px rgba(0,0,0,0.4)'
    };

    const tokenNode = (playerIndex, pieceIndex, piece) => {
        let x = 0;
        let y = 0;
        if (piece.isHome) {
            const pos = homePositions[playerIndex][pieceIndex];
            x = pos.x * CELL_SIZE;
            y = pos.y * CELL_SIZE;
        } else if (piece.isInPlay) {
            const pos = getPositionOnPath(playerIndex, piece.steps);
            x = pos.x * CELL_SIZE;
            y = pos.y * CELL_SIZE;
            const key = `${pos.x},${pos.y}`;
            const group = cellOccupancy.get(key) || [];
            const idxInGroup = group.findIndex(g => g.playerIndex === playerIndex && g.pieceIndex === pieceIndex);
            const { dx, dy } = getOverlapOffset(group.length, idxInGroup);
            x += dx;
            y += dy;
        }
        // Center the token inside the target cell to avoid visual drift on small screens
        const centerOffset = (CELL_SIZE - tokenSize) / 2;
        x += centerOffset;
        y += centerOffset;
        const isCurrentPlayer = playerIndex === currentPlayer;
        const isActivePlayer = playerIndex < selectedPlayerCount;
        const canMove = isCurrentPlayer && diceValue > 0 && (
            (piece.isHome && diceValue === 6) || (piece.isInPlay && piece.steps + diceValue <= maxSteps)
        );
        const avatar = players[playerIndex]?.avatar;
        return (
            <div key={`token-${playerIndex}-${pieceIndex}`} style={{
                position: 'absolute',
                left: 0,
                top: 0,
                transform: `translate3d(${x}px, ${y}px, 0)`,
                width: tokenSize,
                height: tokenSize,
                zIndex: 10,
                transition: `transform ${stepDurationMs}ms ease`
            }}>
                <button
                    onClick={() => { if ((!onlineMode || myPlayerIndex === currentPlayer) && isActivePlayer && isCurrentPlayer && diceValue > 0) movePiece(pieceIndex); }}
                    disabled={!isActivePlayer || !isCurrentPlayer || diceValue === 0}
                    style={{
                        width: '100%',
                        height: '100%',
                        borderRadius: tokenSize / 2,
                        background: "black",
                        border: `3px solid ${adjustHexColor(piece.color, -30)}`,
                        boxShadow: isActivePlayer ? `0 6px 8px ${piece.color}66` : 'none',
                        opacity: isActivePlayer ? 1 : 0.3,
                        position: 'relative',
                        overflow: 'hidden',
                        cursor: (isActivePlayer && isCurrentPlayer && diceValue > 0) ? 'pointer' : 'default',
                        animation: canMove ? 'tokenPulseScale 900ms ease-in-out infinite, tokenGlow 1200ms ease-in-out infinite' : 'none'
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
            `}</style>
            <div style={{ padding: '10px 20px', background: 'rgba(26, 35, 50, 0.9)', borderBottom: '1px solid rgba(255, 215, 0, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'space-around' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ color: '#00D4FF', fontSize: 28, fontWeight: 'bold' }}>Ludo Classic</div>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    {!gameStarted ? (
                        <button onClick={startGame} style={{ background: '#00D4FF', color: 'white', padding: '8px 36px', border: 'none', borderRadius: 20, cursor: 'pointer', fontWeight: 'bold' }}>Start</button>
                    ) : (
                        <button onClick={resetGame} style={{ background: '#4444FF', color: 'white', padding: '10px 16px', border: 'none', borderRadius: 20, cursor: 'pointer', fontWeight: 'bold' }}>Reset</button>
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

            {gameStarted && (
                <div style={{ padding: 20 }}>


                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <div style={boardStyle}>
                            <svg width={BOARD_SIZE} height={BOARD_SIZE} viewBox={`0 0 ${BOARD_SIZE} ${BOARD_SIZE}`}>
                                <rect x="0" y="0" width={BOARD_SIZE} height={BOARD_SIZE} fill="#FFFFFF" stroke="#000000" strokeWidth="2" rx="10" ry="10" />
                                {renderBoardGrid()}
                                {renderStaticRects()}
                                {/* Safe zone markers filled with matching piece color */}

                            </svg>
                            {/* Tokens overlay */}
                            <div style={{ position: 'absolute', inset: 0 }}>
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
                                                    if (i === 0) return Boolean(players[0]?.profileId || myProfile?._id);
                                                    return Boolean(players[i]?.profileId);
                                                }).length;
                                                return `Joined ${joined}/${max}`;
                                            })()}
                                        </div>
                                        <div style={{ display: 'grid', gap: 6 }}>
                                            {Array.from({ length: Math.max(2, Math.min(4, selectedPlayerCount)) }).map((_, i) => {
                                                const seat = players[i];
                                                const joined = i === 0 ? Boolean(seat?.profileId || myProfile?._id) : Boolean(seat?.profileId);
                                                const name = seat?.name || (i === 0 ? (myProfile?.fullName || 'You') : `Seat ${i + 1}`);
                                                const invitedName = !joined ? getInvitedNameForSlot(i) : null;
                                                return (
                                                    <div key={`seatstat-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.04)', padding: '6px 8px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)' }}>
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
                                </div>
                            )}
                            {/* Center dice overlay */}
                            <div style={{ position: 'absolute', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', pointerEvents: canRollDice ? 'auto' : 'none' }}>
                                <button onClick={rollDice} disabled={!canRollDice || diceRolling} style={{ background: 'transparent', border: 'none', padding: 0, cursor: (canRollDice && !diceRolling) ? 'pointer' : 'default' }}>
                                    <div style={{ width: 108, height: 108, perspective: '800px' }}>
                                        <div style={{ width: '100%', height: '100%', transformStyle: 'preserve-3d', display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `rotateX(${diceRotateX}deg) rotateY(${diceRotateY}deg)`, transition: 'transform 0.7s ease-in-out' }}>
                                            {(!diceRolling && canRollDice && diceValue === 0) ? (
                                                players[currentPlayer]?.avatar ? (
                                                    <img src={players[currentPlayer].avatar} alt="current player" style={{ width: 80, height: 80, borderRadius: "50%", objectFit: 'cover', boxShadow: '0 6px 10px rgba(0,0,0,0.35)', border: `3px solid ${players[currentPlayer]?.color || '#FFD700'}` }} />
                                                ) : (
                                                    <img src={siteConfig.logo} alt="Connect" style={{ width: 80, height: 80, borderRadius: "50%", objectFit: 'contain', background: 'transparent', boxShadow: '0 6px 10px rgba(0,0,0,0.35)', border: `3px solid ${players[currentPlayer]?.color || '#FFD700'}` }} />
                                                )
                                            ) : (
                                                <DiceSVG value={diceRolling ? null : diceValue} size={108} strokeColor={players[currentPlayer]?.color || '#FFD700'} />
                                            )}
                                        </div>
                                    </div>
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