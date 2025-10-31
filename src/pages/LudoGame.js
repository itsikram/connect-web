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
    const maxSteps = 59; // 52 main + 7 home stretch

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
    // Online friends selection
    const [onlineMode, setOnlineMode] = useState(false);
    const [selectedFriends, setSelectedFriends] = useState([]); // [{ _id, fullName, profilePic }]
    const [friendSearchQuery, setFriendSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [loadingSearch, setLoadingSearch] = useState(false);
    const [friendList, setFriendList] = useState([]);
    const searchTimeoutRef = useRef(null);
    const [incomingInvite, setIncomingInvite] = useState(null);
    const [inviteCopied, setInviteCopied] = useState(false);
    // Online play socket state
    const socketRef = useRef(null);
    const [gameId, setGameId] = useState(null);
    const [myPlayerIndex, setMyPlayerIndex] = useState(0);
    const socketBaseUrl = useMemo(() => {
        try {
            const url = (siteConfig?.siteUrl && typeof siteConfig.siteUrl === 'string') ? siteConfig.siteUrl : window.location.origin;
            return url.replace(/\/$/, '');
        } catch (_e) {
            return window.location.origin;
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
        const captured = [];
        players.forEach((player, playerIndex) => {
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
        return captured;
    };

    const initializeGame = (playerCount = selectedPlayerCount) => {
        const newPlayers = [];
        const names = [];
        const avatars = [];
        names[0] = myProfile?.fullName || 'You';
        avatars[0] = myProfile?.profilePic;
        for (let i = 1; i < playerCount; i++) {
            const f = selectedFriends[i - 1];
            names[i] = f?.fullName || playerNames[i];
            avatars[i] = f?.profilePic;
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
                profileId: undefined,
            });
        }
        setPlayers(newPlayers);
    };

    useEffect(() => {
        initializeGame();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Parse invite tokens from URL (?ludoInvite=BASE64)
    useEffect(() => {
        try {
            const params = new URLSearchParams(window.location.search);
            const token = params.get('ludoInvite');
            if (!token) return;
            const json = atob(token);
            const payload = JSON.parse(json);
            if (payload && payload.type === 'ludo_invite') {
                setIncomingInvite(payload);
                if (payload.gameId) {
                    setGameId(payload.gameId);
                    setOnlineMode(true);
                    if (payload.playerCount && [2,3,4].includes(payload.playerCount)) {
                        setSelectedPlayerCount(payload.playerCount);
                    }
                }
                // Open start modal if not started yet
                if (!gameStarted) setShowPlayerSelection(true);
            }
        } catch (_e) {}
    }, [gameStarted]);

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
        if (!canRollDice || diceRolling) return;
        setDiceRolling(true);
        setCanRollDice(false);
    // Animate 3D spin
    setDiceRotateX(prev => prev + 360);
    setDiceRotateY(prev => prev + 360);
        // simple spin delay
        setTimeout(() => {
            const value = Math.floor(Math.random() * 6) + 1;
            setDiceValue(value);
            setDiceRolling(false);
            if (onlineMode && socketRef.current && gameId) {
                try { socketRef.current.emit('ludo:roll', { gameId, value, by: myProfile?._id }); } catch (_e) {}
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

  const DiceSVG = ({ value, size = 80 }) => {
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
    const pts = positions[value] || [];
    return (
      <svg width={size} height={size} viewBox="0 0 100 100" style={{ display: 'block', filter: 'drop-shadow(0 6px 10px rgba(0,0,0,0.4))' }}>
        <defs>
          <linearGradient id="diceGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#e9e9e9" />
          </linearGradient>
        </defs>
        <g transform={`translate(50,50) scale(${scaleFactor}) translate(-50,-50)`}>
          <rect x="5" y="5" width="90" height="90" rx="18" ry="18" fill="url(#diceGrad)" stroke="#d0d0d0" strokeWidth="2" />
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

    const captureToken = (playerIndex, pieceIndex) => {
        const updated = players.map(p => ({ ...p, pieces: p.pieces.map(pc => ({ ...pc })) }));
        const capturedPiece = updated[playerIndex].pieces[pieceIndex];
        updated[playerIndex].pieces[pieceIndex] = {
            ...capturedPiece,
            isHome: true,
            isInPlay: false,
            steps: 0,
        };
        setPlayers(updated);
    };

    const animateTokenMovement = (playerIndex, pieceIndex, toSteps, onComplete) => {
        // Web simulation: step through updates to piece.steps to visualize movement
        const updated = players.map(p => ({ ...p, pieces: p.pieces.map(pc => ({ ...pc })) }));
        const piece = updated[playerIndex].pieces[pieceIndex];
        const fromSteps = piece.steps;
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
                    try { socketRef.current.emit('ludo:move', { gameId, by: myProfile?._id, playerIndex: currentPlayer, pieceIndex: pieceId, toSteps: 1, fromSteps: 0 }); } catch (_e) {}
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
                        try { socketRef.current.emit('ludo:move', { gameId, by: myProfile?._id, playerIndex: currentPlayer, pieceIndex: pieceId, toSteps: newSteps, fromSteps: oldSteps }); } catch (_e) {}
                    }
                    animateTokenMovement(currentPlayer, pieceId, newSteps, () => {
                        // After animation, run capture/win checks
                        setPlayers(prev => {
                            const updatedPlayers = prev.map(p => ({ ...p, pieces: p.pieces.map(pc => ({ ...pc })) }));
                            updatedPlayers[currentPlayer].pieces[pieceId].steps = newSteps;
                            return updatedPlayers;
                        });

                        if (newSteps < maxSteps) {
                            const newPosition = getPositionOnPath(currentPlayer, newSteps);
                            const capturedPieces = checkForCapture(currentPlayer, newPosition);
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
                        if (diceValue !== 6) {
                            setTimeout(() => {
                                const nextPlayer = getNextActivePlayer(currentPlayer);
                                setCurrentPlayer(nextPlayer);
                                setCanRollDice(true);
                            }, 300);
                        } else {
                            setCanRollDice(true);
                        }
                    });
                }
            }
        };

        globalMove();
    };

    // Online socket listeners (moved below state/helpers to avoid temporal dead zone)
    useEffect(() => {
        const s = socketRef.current;
        if (!s || !onlineMode) return;

        const onRoll = (payload) => {
            if (!payload || payload.gameId !== gameId) return;
            if (payload.by && myProfile?._id && String(payload.by) === String(myProfile._id)) return;
            const value = payload.value;
            setDiceValue(value);
            setDiceRolling(false);
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
        };

        const onMove = (payload) => {
            if (!payload || payload.gameId !== gameId) return;
            if (payload.by && myProfile?._id && String(payload.by) === String(myProfile._id)) return;
            const { playerIndex, pieceIndex, toSteps } = payload;
            const mover = typeof playerIndex === 'number' ? playerIndex : currentPlayer;
            animateTokenMovement(mover, pieceIndex, toSteps, () => {
                setPlayers(prev => {
                    const updatedPlayers = prev.map(p => ({ ...p, pieces: p.pieces.map(pc => ({ ...pc })) }));
                    updatedPlayers[mover].pieces[pieceIndex].steps = toSteps;
                    return updatedPlayers;
                });

                if (toSteps < maxSteps) {
                    const newPosition = getPositionOnPath(mover, toSteps);
                    const capturedPieces = checkForCapture(mover, newPosition);
                    capturedPieces.forEach(({ playerIndex: pi, pieceIndex: pj }) => captureToken(pi, pj));
                }

                if (toSteps === maxSteps) {
                    setPlayers(prev => {
                        const updatedPlayers = prev.map(p => ({ ...p, pieces: p.pieces.map(pc => ({ ...pc })) }));
                        const finishedCount = updatedPlayers[mover].pieces.filter(p => p.steps === maxSteps).length;
                        if (finishedCount === 4) {
                            const winnerPlayer = updatedPlayers[mover];
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
                setTimeout(() => {
                    const nextPlayer = getNextActivePlayer(mover);
                    setCurrentPlayer(nextPlayer);
                    setCanRollDice(true);
                }, 300);
            });
        };

        s.on('ludo:roll', onRoll);
        s.on('ludo:move', onMove);
        return () => {
            s.off('ludo:roll', onRoll);
            s.off('ludo:move', onMove);
        };
    }, [onlineMode, socketRef.current, gameId, myProfile?._id, players, currentPlayer, maxSteps, selectedPlayerCount, winners]);

    // Cleanup socket on unmount
    useEffect(() => {
        return () => {
            try {
                if (socketRef.current) {
                    socketRef.current.disconnect();
                    socketRef.current = null;
                }
            } catch (_e) {}
        };
    }, []);

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
        initializeGame(selectedPlayerCount);
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
                socketRef.current.emit('ludo:join', { gameId: gid });
                setMyPlayerIndex(0);
            } catch (_e) {}
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
    };

    // Rendering helpers
    const homePositions = [
        [ { x: 2, y: 2 }, { x: 3, y: 2 }, { x: 2, y: 3 }, { x: 3, y: 3 } ],
        [ { x: 11, y: 2 }, { x: 12, y: 2 }, { x: 11, y: 3 }, { x: 12, y: 3 } ],
        [ { x: 2, y: 11 }, { x: 3, y: 11 }, { x: 2, y: 12 }, { x: 3, y: 12 } ],
        [ { x: 11, y: 11 }, { x: 12, y: 11 }, { x: 11, y: 12 }, { x: 12, y: 12 } ],
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
        const delta = CELL_SIZE * 0.28; // spread tokens within the cell
        if (count <= 1) return { dx: 0, dy: 0 };
        if (count === 2) {
            return { dx: index === 0 ? -delta / 2 : delta / 2, dy: 0 };
        }
        if (count === 3) {
            const positions = [
                { dx: -delta / 2, dy: -delta / 2 },
                { dx:  delta / 2, dy: -delta / 2 },
                { dx: 0, dy:  delta / 2 },
            ];
            return positions[index] || { dx: 0, dy: 0 };
        }
        // 4 or more - use 2x2 grid for first 4
        const grid = [
            { dx: -delta / 2, dy: -delta / 2 },
            { dx:  delta / 2, dy: -delta / 2 },
            { dx: -delta / 2, dy:  delta / 2 },
            { dx:  delta / 2, dy:  delta / 2 },
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
        const drawHome = (x0, y0, color) => {
            elems.push(<rect key={`home-outer-${x0}-${y0}`} x={x0 * CELL_SIZE} y={y0 * CELL_SIZE} width={CELL_SIZE * 6} height={CELL_SIZE * 6} fill={color} stroke="#000" strokeWidth={2} />);
            elems.push(<rect key={`home-inner-${x0}-${y0}`} x={(x0 + 1) * CELL_SIZE} y={(y0 + 1) * CELL_SIZE} width={CELL_SIZE * 4} height={CELL_SIZE * 4} fill="#FFFFFF" stroke="#000" strokeWidth={2} />);
            // four pips
            const cx = (x0 + 1) * CELL_SIZE + CELL_SIZE * 2;
            const cy = (y0 + 1) * CELL_SIZE + CELL_SIZE * 2;
            const r = CELL_SIZE * 0.35;
            const offsets = [ [-r, -r], [r, -r], [-r, r], [r, r] ];
            offsets.forEach((o, i) => {
                elems.push(<circle key={`pip-${x0}-${y0}-${i}`} cx={cx + o[0]} cy={cy + o[1]} r={CELL_SIZE * 0.35} fill={color} stroke="#000" strokeWidth={2} />);
            });
        };
        drawHome(0, 0, colors[0]); // red
        drawHome(9, 0, colors[1]); // green
        drawHome(0, 9, colors[2]); // blue
        drawHome(9, 9, colors[3]); // yellow

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
        for (let c = 9; c <= 13; c++) elems.push(<rect key={`yellow-row-${c}`} x={c * CELL_SIZE} y={7 * CELL_SIZE} width={CELL_SIZE} height={CELL_SIZE} fill={colors[2]} stroke="#000" strokeWidth={1} />);
        for (let r = 9; r <= 12; r++) elems.push(<rect key={`blue-col-${r}`} x={7 * CELL_SIZE} y={r * CELL_SIZE} width={CELL_SIZE} height={CELL_SIZE} fill={colors[3]} stroke="#000" strokeWidth={1} />);
        for (let c = 1; c <= 5; c++) elems.push(<rect key={`red-row-${c}`} x={c * CELL_SIZE} y={7 * CELL_SIZE} width={CELL_SIZE} height={CELL_SIZE} fill={colors[0]} stroke="#000" strokeWidth={1} />);

        // Center triangles
        const cx = 7 * CELL_SIZE, cy = 7 * CELL_SIZE, s = CELL_SIZE;
        elems.push(<path key="tri-red" d={`M ${cx} ${cy} L ${cx} ${cy + s} L ${cx - s} ${cy + s/2} Z`} fill={colors[0]} stroke="#000" strokeWidth={1} />);
        elems.push(<path key="tri-yellow" d={`M ${cx} ${cy} L ${cx + s} ${cy} L ${cx + s/2} ${cy + s} Z`} fill={colors[3]} stroke="#000" strokeWidth={1} />);
        elems.push(<path key="tri-blue" d={`M ${cx} ${cy + s} L ${cx + s/2} ${cy} L ${cx - s/2} ${cy} Z`} fill={colors[2]} stroke="#000" strokeWidth={1} />);
        elems.push(<path key="tri-green" d={`M ${cx} ${cy} L ${cx} ${cy - s} L ${cx + s} ${cy - s/2} Z`} fill={colors[1]} stroke="#000" strokeWidth={1} />);

        return (<>{elems}</>);
    };

    const tokenSize = CELL_SIZE * 1.1;
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
                transform: `translate(${x}px, ${y}px)`,
                width: tokenSize,
                height: tokenSize,
                zIndex: 10,
                transition: `transform ${stepDurationMs}ms ease`
            }}>
                <button
                    onClick={() => { if (isActivePlayer && isCurrentPlayer && diceValue > 0) movePiece(pieceIndex); }}
                    disabled={!isActivePlayer || !isCurrentPlayer || diceValue === 0}
                    style={{
                        width: '100%',
                        height: '100%',
                        borderRadius: tokenSize / 2,
                        background: piece.color,
                        border: '4px solid #FFFFFF',
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
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.8)', padding: 20 }}>
                <div style={{ width: '100%', maxWidth: 420, background: 'rgba(26, 35, 50, 0.95)', borderRadius: 24, padding: 28, border: '1px solid rgba(255, 215, 0, 0.3)', color: 'white' }}>
                    <div style={{ textAlign: 'center', marginBottom: 20 }}>
                        <div style={{ fontSize: 32, color: '#FFD700', fontWeight: 'bold' }}>Select Players</div>
                        <div style={{ color: '#B0B0B0' }}>Choose how many players will join the game</div>
                    </div>
                    <div>
                        {[2,3,4].map(count => (
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
                        {onlineMode && (
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
                                        return (
                                            <button key={key} onClick={() => {
                                                setSelectedFriends(prev => {
                                                    if (isSelected) return prev.filter(p => p._id !== f._id);
                                                    const next = [...prev, f];
                                                    return next.slice(0, Math.max(0, selectedPlayerCount - 1));
                                                });
                                            }} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'transparent', border: 'none', color: 'white', padding: '8px 0', cursor: 'pointer' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                    <div style={{ width: 28, height: 28, borderRadius: 14, overflow: 'hidden', background: '#333' }}>
                                                        {f?.profilePic ? <img src={f.profilePic} alt=" " style={{ width: 28, height: 28, objectFit: 'cover' }} /> : null}
                                                    </div>
                                                    <div style={{ fontSize: 14 }}>{f?.fullName || 'Unknown'}</div>
                                                </div>
                                                <div>{isSelected ? '✅' : '⭕'}</div>
                                            </button>
                                        );
                                    })}
                                </div>
                                <div style={{ color: '#B0B0B0', fontSize: 12, marginTop: 6 }}>Selected: {selectedFriends.length} / {Math.max(0, selectedPlayerCount - 1)}</div>
                            </div>
                        )}
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
            <div style={{ padding: '10px 20px', background: 'rgba(26, 35, 50, 0.9)', borderBottom: '1px solid rgba(255, 215, 0, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ color: '#FFD700', fontSize: 28, fontWeight: 'bold' }}>Ludo Classic</div>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                    {!gameStarted ? (
                        <button onClick={startGame} style={{ background: '#00AA00', color: 'white', padding: '10px 16px', border: 'none', borderRadius: 20, cursor: 'pointer', fontWeight: 'bold' }}>Start</button>
                    ) : (
                        <button onClick={resetGame} style={{ background: '#4444FF', color: 'white', padding: '10px 16px', border: 'none', borderRadius: 20, cursor: 'pointer', fontWeight: 'bold' }}>Reset</button>
                    )}
                </div>
            </div>

            {gameStarted && (
                <div style={{ padding: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(26, 35, 50, 0.8)', padding: 16, borderRadius: 16, border: '1px solid rgba(255, 215, 0, 0.2)', width: BOARD_SIZE }}>
                            <div>
                                <div style={{ fontSize: 12, color: '#B0B0B0', marginBottom: 4 }}>Current Turn</div>
                                <div style={{ display: 'flex',width: '100%', alignItems: 'center', gap: 8, background: players[currentPlayer]?.color, padding: '6px 12px', borderRadius: 20 }}>
                                    <div>{playerEmojis[currentPlayer]}</div>
                                    <div style={{ fontWeight: 'bold' }}>{players[currentPlayer]?.name}</div>
                                </div>
                            </div>
                        </div>
                    </div>

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
                            {/* Center dice overlay */}
                            <div style={{ position: 'absolute', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', pointerEvents: canRollDice ? 'auto' : 'none' }}>
                                <button onClick={rollDice} disabled={!canRollDice || diceRolling} style={{ background: 'transparent', border: 'none', padding: 0, cursor: (canRollDice && !diceRolling) ? 'pointer' : 'default' }}>
                                    <div style={{ width: 108, height: 108, perspective: '800px' }}>
                                        <div style={{ width: '100%', height: '100%', transformStyle: 'preserve-3d', display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `rotateX(${diceRotateX}deg) rotateY(${diceRotateY}deg)`, transition: 'transform 0.7s ease-in-out' }}>
                                            {(!diceRolling && canRollDice && diceValue === 0) ? (
                                                <img src={siteConfig.logo} alt="Connect" style={{ width: 80, height: 80, borderRadius: "50%", objectFit: 'contain', background: 'transparent', boxShadow: '0 6px 10px rgba(0,0,0,0.35)' }} />
                                            ) : (
                                                <DiceSVG value={diceValue || 6} size={108} />
                                            )}
                                        </div>
                                    </div>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showWinnerModal && (
                <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
                    <div style={{ width: '100%', maxWidth: 420, background: 'rgba(26, 35, 50, 0.95)', borderRadius: 24, padding: 24, border: '2px solid rgba(255, 215, 0, 0.5)', color: 'white', textAlign: 'center' }}>
                        <div style={{ fontSize: 64, marginBottom: 8 }}>🏆</div>
                        <div style={{ fontSize: 24, fontWeight: 'bold', color: '#FFD700', marginBottom: 8 }}>{winner?.name} Wins!</div>
                        <div style={{ color: '#B0B0B0', marginBottom: 16 }}>Congratulations on your victory!</div>
                        <div style={{ display: 'flex', gap: 12 }}>
                            {!gameEnded && (
                                <button onClick={continueGame} style={{ flex: 1, background: winner?.color || '#555', color: 'white', padding: '12px 0', border: 'none', borderRadius: 20, cursor: 'pointer', fontWeight: 'bold' }}>Continue Game</button>
                            )}
                            <button onClick={endGame} style={{ flex: 1, background: '#FF4444', color: 'white', padding: '12px 0', border: 'none', borderRadius: 20, cursor: 'pointer', fontWeight: 'bold' }}>End Game</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LudoGame;