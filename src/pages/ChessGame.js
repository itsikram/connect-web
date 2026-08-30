import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Chess } from 'chess.js';
import { useSelector } from 'react-redux';
import socket from '../common/socket';
import api from '../api/api';
import siteConfig from '../config/config.json';
import { pickComputerMove } from '../utils/chessComputer';
import { openCreatePost } from '../utils/openComposer';
import {
  setActiveChessGameId,
  clearActiveChessGameId,
  markChessInviteHandled,
  resolveChessInviteNotifications,
} from '../utils/chessInviteUtils';
import './ChessGame.css';

const BOARD_SIZE = 8;
const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

const unicodeForPiece = (piece, color) => {
  const map = {
    wk: '\u2654',
    wq: '\u2655',
    wr: '\u2656',
    wb: '\u2657',
    wn: '\u2658',
    wp: '\u2659',
    bk: '\u265A',
    bq: '\u265B',
    br: '\u265C',
    bb: '\u265D',
    bn: '\u265E',
    bp: '\u265F',
  };
  return map[`${color}${piece}`] || '';
};

const normalizeUsers = (res) => {
  const body = res && (res.data || res);
  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.users)) return body.users;
  if (Array.isArray(body?.data)) return body.data;
  if (Array.isArray(res?.users)) return res.users;
  return [];
};

const ChessGame = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const profile = useSelector(state => state.profile);
  const profileId = profile?._id;

  const [engine] = useState(() => new Chess());
  const [selected, setSelected] = useState(null);
  const [legalTargets, setLegalTargets] = useState([]);
  const [fenVersion, setFenVersion] = useState(0);
  const [promotionFromTo, setPromotionFromTo] = useState(null);
  const [boardSize, setBoardSize] = useState(600);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);

  const [gameMode, setGameMode] = useState(null);
  const [gameId, setGameId] = useState(null);
  const [myColor, setMyColor] = useState(null);
  const [whitePlayer, setWhitePlayer] = useState(null);
  const [blackPlayer, setBlackPlayer] = useState(null);
  const [whitePlayerInfo, setWhitePlayerInfo] = useState(null);
  const [blackPlayerInfo, setBlackPlayerInfo] = useState(null);
  const [waitingForOpponent, setWaitingForOpponent] = useState(false);
  const [showGameModeSelect, setShowGameModeSelect] = useState(true);
  const [showOnlineSetup, setShowOnlineSetup] = useState(false);
  const [opponentDisconnected, setOpponentDisconnected] = useState(false);
  const [joinGameIdInput, setJoinGameIdInput] = useState('');
  const [inviteCopied, setInviteCopied] = useState(false);
  const [invitedFriend, setInvitedFriend] = useState(null);
  const [inviteStatus, setInviteStatus] = useState('idle');

  const [friendSearchQuery, setFriendSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [friendList, setFriendList] = useState([]);
  const [loadingFriends, setLoadingFriends] = useState(false);

  const isProcessingRemoteMove = useRef(false);
  const lastLocalMoveRef = useRef(null);
  const computerThinkingRef = useRef(false);
  const searchTimeoutRef = useRef(null);
  const pendingInviteProcessedRef = useRef(false);
  const gameIdRef = useRef(null);

  const myIdentity = useCallback(() => ({
    name: profile?.fullName || 'Player',
    avatar: profile?.profilePic || '',
  }), [profile?.fullName, profile?.profilePic]);

  const persistActiveGame = useCallback((id) => {
    if (!id) return;
    setActiveChessGameId(id);
    try {
      localStorage.setItem('chess_game_state', JSON.stringify({ gameId: id }));
    } catch (_e) {}
  }, []);

  const emitWhenReady = useCallback((event, payload) => {
    if (socket.connected) {
      socket.emit(event, payload);
      return;
    }
    socket.once('connect', () => {
      socket.emit(event, payload);
    });
  }, []);

  const emitJoin = useCallback((id) => {
    if (!id) return;
    const identity = myIdentity();
    emitWhenReady('chess:join', { gameId: id, name: identity.name, avatar: identity.avatar });
  }, [myIdentity, emitWhenReady]);

  // URL gameId (shared invite link)
  useEffect(() => {
    const urlGameId = searchParams.get('gameId');
    if (urlGameId && profileId) {
      setGameId(urlGameId);
      gameIdRef.current = urlGameId;
      setGameMode('online');
      setShowGameModeSelect(false);
      setShowOnlineSetup(false);
      setWaitingForOpponent(true);
      persistActiveGame(urlGameId);
    }
  }, [searchParams, profileId, persistActiveGame]);

  const processPendingInvite = useCallback((inviteFromEvent) => {
    if (!profileId) return;
    try {
      let pendingInvite = inviteFromEvent || null;
      if (!pendingInvite) {
        const raw = localStorage.getItem('chess_pending_invite');
        if (!raw) return;
        pendingInvite = JSON.parse(raw);
      }
      if (!pendingInvite?.gameId || !pendingInvite.autoAccept) {
        localStorage.removeItem('chess_pending_invite');
        return;
      }
      localStorage.removeItem('chess_pending_invite');
      if (pendingInviteProcessedRef.current && gameIdRef.current === pendingInvite.gameId) {
        return;
      }
      pendingInviteProcessedRef.current = true;

      const gid = pendingInvite.gameId;
      gameIdRef.current = gid;
      setGameId(gid);
      setGameMode('online');
      setShowGameModeSelect(false);
      setShowOnlineSetup(false);
      setWaitingForOpponent(true);
      persistActiveGame(gid);
      markChessInviteHandled(gid, pendingInvite.from);
      resolveChessInviteNotifications(gid, pendingInvite.from);

      const identity = myIdentity();
      const joinPayload = { gameId: gid, name: identity.name, avatar: identity.avatar };
      const acceptPayload = {
        gameId: gid,
        from: pendingInvite.from,
        name: identity.name,
        avatar: identity.avatar,
      };

      const sendAccept = () => {
        socket.emit('chess:accept', acceptPayload);
        socket.emit('chess:join', joinPayload);
        socket.emit('chess:invites:dismiss', { gameId: gid, by: pendingInvite.from });
      };

      if (socket.connected) {
        sendAccept();
      } else {
        socket.once('connect', sendAccept);
      }
    } catch (error) {
      console.error('[CHESS] Error processing pending invite:', error);
      try {
        localStorage.removeItem('chess_pending_invite');
      } catch (_e) {}
    }
  }, [profileId, persistActiveGame, myIdentity]);

  useEffect(() => {
    processPendingInvite();
  }, [processPendingInvite]);

  useEffect(() => {
    const onPendingInviteUpdated = (e) => {
      processPendingInvite(e?.detail);
    };
    window.addEventListener('chess:pendingInviteUpdated', onPendingInviteUpdated);
    return () => {
      window.removeEventListener('chess:pendingInviteUpdated', onPendingInviteUpdated);
    };
  }, [processPendingInvite]);

  useEffect(() => {
    const updateLayout = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const padding = 40;
      const headerHeight = 120;
      const availableWidth = width - padding * 2;
      const availableHeight = height - headerHeight - padding * 2;
      const size = Math.min(availableWidth, availableHeight, 600);
      setBoardSize(Math.max(300, size));
      setIsMobile(width < 640);
    };

    updateLayout();
    window.addEventListener('resize', updateLayout);
    return () => window.removeEventListener('resize', updateLayout);
  }, []);

  useEffect(() => {
    if (!showOnlineSetup && !waitingForOpponent) return;
    if (!profileId) return;
    let cancelled = false;
    (async () => {
      setLoadingFriends(true);
      try {
        const res = await api.get('/friend/getFriends', { params: { profile: profileId } });
        if (cancelled) return;
        const friends = Array.isArray(res.data) ? res.data : [];
        setFriendList(friends.filter((f) => f && String(f._id) !== String(profileId)));
      } catch (_e) {
        if (!cancelled) setFriendList([]);
      } finally {
        if (!cancelled) setLoadingFriends(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showOnlineSetup, waitingForOpponent, profileId]);

  const onChangeFriendSearch = (text) => {
    setFriendSearchQuery(text);
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = null;
    }
    const q = (text || '').trim();
    if (q.length < 2) {
      setSearchResults([]);
      setLoadingSearch(false);
      return;
    }
    setLoadingSearch(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        let res;
        try {
          res = await api.get(`/search?input=${encodeURIComponent(q)}`);
        } catch (e) {
          res = await api.get('/search', { params: { input: q } });
        }
        setSearchResults(
          normalizeUsers(res).filter((f) => f && String(f._id) !== String(profileId)),
        );
      } catch (_e) {
        setSearchResults([]);
      } finally {
        setLoadingSearch(false);
      }
    }, 300);
  };

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (gameMode !== 'online' || !gameId || !profileId) return;

    const handleJoined = (data) => {
      if (data.gameId !== gameId) return;
    };

    const handleState = (data) => {
      if (data.gameId !== gameId) return;
      setWhitePlayer(data.whitePlayer);
      setBlackPlayer(data.blackPlayer);
      setWhitePlayerInfo(data.whitePlayerInfo || null);
      setBlackPlayerInfo(data.blackPlayerInfo || null);

      if (profileId) {
        const pid = String(profileId);
        if (data.whitePlayer && String(data.whitePlayer) === pid) {
          setMyColor('w');
        } else if (data.blackPlayer && String(data.blackPlayer) === pid) {
          setMyColor('b');
        }
      }

      const isWaiting = !data.whitePlayer || !data.blackPlayer;
      setWaitingForOpponent(isWaiting);
      if (!isWaiting) {
        setInviteStatus('joined');
        persistActiveGame(gameId);
      }

      if (data.fen && data.fen !== engine.fen()) {
        try {
          engine.load(data.fen);
          setFenVersion(v => v + 1);
        } catch (e) {
          console.error('Error loading FEN:', e);
        }
      }
    };

    const handleMove = (data) => {
      if (data.gameId !== gameId) return;
      if (!data.move) return;

      const moveKey = `${data.move.from}-${data.move.to}-${data.move.promotion || ''}`;
      if (lastLocalMoveRef.current === moveKey) {
        lastLocalMoveRef.current = null;
        return;
      }

      if (data.move.fen && data.move.fen === engine.fen()) {
        return;
      }

      isProcessingRemoteMove.current = true;
      try {
        const move = engine.move({
          from: data.move.from,
          to: data.move.to,
          promotion: data.move.promotion
        });

        if (move) {
          setSelected(null);
          setLegalTargets([]);
          setFenVersion(v => v + 1);
        }
      } catch (e) {
        console.error('Error applying remote move:', e);
      } finally {
        isProcessingRemoteMove.current = false;
      }
    };

    const handleReset = (data) => {
      if (data.gameId !== gameId) return;
      engine.reset();
      setSelected(null);
      setLegalTargets([]);
      setFenVersion(v => v + 1);
    };

    const handleGameOver = () => {};

    const handlePlayerOffline = (data) => {
      if (data.gameId === gameId && data.profileId !== profileId) {
        setOpponentDisconnected(true);
      }
    };

    const handlePlayerOnline = (data) => {
      if (data.gameId === gameId && data.profileId !== profileId) {
        setOpponentDisconnected(false);
      }
    };

    const handleAccepted = (data) => {
      if (data.gameId !== gameId) return;
      setInviteStatus('joined');
    };

    socket.on('chess:joined', handleJoined);
    socket.on('chess:state', handleState);
    socket.on('chess:move', handleMove);
    socket.on('chess:reset', handleReset);
    socket.on('chess:gameover', handleGameOver);
    socket.on('chess:player:offline', handlePlayerOffline);
    socket.on('chess:player:online', handlePlayerOnline);
    socket.on('chess:accepted', handleAccepted);

    emitJoin(gameId);

    return () => {
      socket.off('chess:joined', handleJoined);
      socket.off('chess:state', handleState);
      socket.off('chess:move', handleMove);
      socket.off('chess:reset', handleReset);
      socket.off('chess:gameover', handleGameOver);
      socket.off('chess:player:offline', handlePlayerOffline);
      socket.off('chess:player:online', handlePlayerOnline);
      socket.off('chess:accepted', handleAccepted);
    };
  }, [gameMode, gameId, profileId, engine, emitJoin, persistActiveGame]);

  const turnColor = engine.turn();
  const gameOver = engine.isGameOver();
  const inCheck = engine.isCheck();

  useEffect(() => {
    if (gameMode !== 'computer' || gameOver || promotionFromTo) return;
    if (engine.turn() !== 'b') return;

    const timer = setTimeout(() => {
      if (computerThinkingRef.current) return;
      computerThinkingRef.current = true;
      try {
        const move = pickComputerMove(engine);
        if (move) {
          engine.move(move);
          setSelected(null);
          setLegalTargets([]);
          setFenVersion(v => v + 1);
        }
      } finally {
        computerThinkingRef.current = false;
      }
    }, 650);

    return () => clearTimeout(timer);
  }, [fenVersion, gameMode, gameOver, promotionFromTo, engine]);

  const handleSquareClick = useCallback((square) => {
    if (gameOver) return;
    if (promotionFromTo) return;
    if (isProcessingRemoteMove.current) return;
    if (waitingForOpponent) return;

    if (gameMode === 'online') {
      if (!myColor) return;
      if (turnColor !== myColor) return;
    }

    if (gameMode === 'computer' && turnColor !== 'w') {
      return;
    }

    if (selected === square) {
      setSelected(null);
      setLegalTargets([]);
      return;
    }

    const piece = engine.get(square);

    if (piece && piece.color === turnColor) {
      const moves = engine.moves({ square, verbose: true });
      setSelected(square);
      setLegalTargets(moves.map(m => m.to));
      return;
    }

    if (selected && legalTargets.includes(square)) {
      const moves = engine.moves({ square: selected, verbose: true });
      const move = moves.find(m => m.to === square);
      if (!move) return;

      const needsPromotion = move.promotion || (move.piece === 'p' && (square.endsWith('8') || square.endsWith('1')));
      if (needsPromotion) {
        setPromotionFromTo({ from: selected, to: square });
        return;
      }

      const result = engine.move({ from: selected, to: square });
      if (result) {
        const moveKey = `${selected}-${square}-`;
        lastLocalMoveRef.current = moveKey;

        setSelected(null);
        setLegalTargets([]);
        setFenVersion(v => v + 1);

        if (gameMode === 'online' && gameId) {
          socket.emit('chess:move', {
            gameId,
            move: {
              from: selected,
              to: square,
              fen: engine.fen()
            }
          });

          if (engine.isGameOver()) {
            let resultValue = 'draw';
            if (engine.isCheckmate()) {
              resultValue = turnColor === 'w' ? 'black_wins' : 'white_wins';
            }
            socket.emit('chess:gameover', { gameId, result: resultValue });
          }
        }
      }
      return;
    }

    setSelected(null);
    setLegalTargets([]);
  }, [selected, legalTargets, promotionFromTo, turnColor, gameOver, engine, gameMode, myColor, gameId, waitingForOpponent]);

  const doPromote = (piece) => {
    if (!promotionFromTo) return;
    const result = engine.move({ from: promotionFromTo.from, to: promotionFromTo.to, promotion: piece });
    if (result) {
      const moveKey = `${promotionFromTo.from}-${promotionFromTo.to}-${piece}`;
      lastLocalMoveRef.current = moveKey;

      setPromotionFromTo(null);
      setSelected(null);
      setLegalTargets([]);
      setFenVersion(v => v + 1);

      if (gameMode === 'online' && gameId) {
        socket.emit('chess:move', {
          gameId,
          move: {
            from: promotionFromTo.from,
            to: promotionFromTo.to,
            promotion: piece,
            fen: engine.fen()
          }
        });

        if (engine.isGameOver()) {
          let resultValue = 'draw';
          if (engine.isCheckmate()) {
            resultValue = engine.turn() === 'w' ? 'black_wins' : 'white_wins';
          }
          socket.emit('chess:gameover', { gameId, result: resultValue });
        }
      }
    }
  };

  const undo = () => {
    if (gameMode === 'local') {
      engine.undo();
      setSelected(null);
      setLegalTargets([]);
      setFenVersion(v => v + 1);
    }
  };

  const reset = () => {
    engine.reset();
    setSelected(null);
    setLegalTargets([]);
    setFenVersion(v => v + 1);

    if (gameMode === 'online' && gameId) {
      socket.emit('chess:reset', { gameId });
    }
  };

  const makeOnlineGameId = () => `chess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const startOnlineGame = useCallback((existingId) => {
    const newGameId = existingId || makeOnlineGameId();
    gameIdRef.current = newGameId;
    setGameId(newGameId);
    setGameMode('online');
    setShowGameModeSelect(false);
    setShowOnlineSetup(false);
    setWaitingForOpponent(true);
    persistActiveGame(newGameId);
    const identity = myIdentity();
    emitWhenReady('chess:create', { gameId: newGameId, name: identity.name, avatar: identity.avatar });
    emitJoin(newGameId);
    return newGameId;
  }, [emitJoin, emitWhenReady, myIdentity, persistActiveGame]);

  const sendInviteNotificationToFriend = async (friend, gid) => {
    try {
      const notificationData = {
        title: 'Chess Invitation',
        text: `${profile?.fullName || 'A friend'} invited you to play Chess`,
        icon: profile?.profilePic || siteConfig.logo,
        link: `/chess-game?gameId=${encodeURIComponent(gid)}`,
        type: 'chess_invite',
        data: {
          gameId: gid,
          inviterId: profile?._id,
          inviterName: profile?.fullName,
          inviterAvatar: profile?.profilePic,
          inviterCover: profile?.coverPic,
        },
      };
      await api.post('/web-notification/send-to-all-browsers', {
        profileId: friend?._id,
        notificationData,
      });
    } catch (_e) {}
  };

  const inviteFriend = useCallback(async (friend, options = {}) => {
    if (!friend?._id || !profileId) return;
    const gid = gameIdRef.current || startOnlineGame();
    setInvitedFriend(friend);
    setInviteStatus('invited');
    const identity = myIdentity();
    emitWhenReady('chess:invite', {
      to: friend._id,
      by: profileId,
      name: identity.name,
      avatar: identity.avatar,
      cover: profile?.coverPic,
      gameId: gid,
      reinvite: options.reinvite === true,
      ts: Date.now(),
    });
    try {
      await sendInviteNotificationToFriend(friend, gid);
    } catch (_e) {}
  }, [profileId, startOnlineGame, myIdentity, emitWhenReady, profile?.coverPic, profile?.fullName, profile?.profilePic, profile?._id]);

  useEffect(() => {
    if (!profileId) return;
    try {
      const raw = localStorage.getItem('chess_invite_target');
      if (!raw) return;
      localStorage.removeItem('chess_invite_target');
      const target = JSON.parse(raw);
      if (!target?.friendId) return;
      inviteFriend({
        _id: target.friendId,
        fullName: target.friendName,
        profilePic: target.friendAvatar,
      });
    } catch (_e) {}
  }, [profileId, inviteFriend]);

  const joinGameById = (id) => {
    if (!id) return;
    gameIdRef.current = id;
    setGameId(id);
    setGameMode('online');
    setShowGameModeSelect(false);
    setShowOnlineSetup(false);
    persistActiveGame(id);
    emitJoin(id);
  };

  const copyInviteLink = async () => {
    if (!gameId) return;
    const url = `${window.location.origin}/chess-game?gameId=${encodeURIComponent(gameId)}`;
    try {
      await navigator.clipboard.writeText(url);
      setInviteCopied(true);
      setTimeout(() => setInviteCopied(false), 2000);
    } catch (_e) {
      alert(url);
    }
  };

  const leaveGame = () => {
    clearActiveChessGameId();
    try {
      localStorage.removeItem('chess_game_state');
    } catch (_e) {}
    navigate('/menu');
  };

  const visibleFriends = friendSearchQuery.trim().length >= 2 ? searchResults : friendList;

  const renderSquare = (row, col) => {
    const isDark = (row + col) % 2 === 1;
    const square = `${FILES[col]}${row + 1}`;
    const piece = engine.get(square);
    const isSelected = selected === square;
    const isTarget = legalTargets.includes(square);
    const squareSize = boardSize / BOARD_SIZE;
    const rotatePieces = gameMode === 'local';

    return (
      <div
        key={`${row}-${col}`}
        onClick={() => handleSquareClick(square)}
        style={{
          width: squareSize,
          height: squareSize,
          backgroundColor: isSelected
            ? '#BACA2B'
            : isTarget
            ? '#B3C3A8'
            : isDark
            ? '#769656'
            : '#EEEED2',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: waitingForOpponent ? 'default' : 'pointer',
          transition: 'background-color 0.2s',
          fontSize: squareSize * 0.6,
          userSelect: 'none',
        }}
      >
        {piece && (
          <span style={{
            fontSize: squareSize * 0.6,
            color: piece.color === 'w' ? '#2C2C2C' : '#F0F0F0',
            textShadow: piece.color === 'w'
              ? '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000, 0 0 3px rgba(255, 255, 255, 0.8)'
              : '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000, 0 0 3px rgba(0, 0, 0, 0.5)',
            fontWeight: 'bold',
            lineHeight: 1,
            display: 'inline-block',
            transform: rotatePieces && piece.color !== 'w' ? 'rotate(180deg)' : 'none',
          }}>
            {unicodeForPiece(piece.type, piece.color)}
          </span>
        )}
      </div>
    );
  };

  const renderRow = (row, cols) => (
    <div
      key={`row-${row}`}
      style={{
        display: 'flex',
        flexDirection: 'row',
      }}
    >
      {cols.map((col) => renderSquare(row, col))}
    </div>
  );

  const getGameStatus = () => {
    if (gameMode === 'computer') {
      if (gameOver) {
        if (engine.isCheckmate()) return 'Checkmate';
        if (engine.isStalemate()) return 'Stalemate';
        if (engine.isThreefoldRepetition()) return 'Threefold repetition';
        if (engine.isInsufficientMaterial()) return 'Draw by insufficient material';
        return 'Draw';
      }

      if (turnColor === 'b') {
        return `Computer thinking…${inCheck ? ' (you are in check)' : ''}`;
      }

      return `Your turn (White)${inCheck ? ' (check)' : ''}`;
    }

    if (gameMode === 'online') {
      if (waitingForOpponent) {
        return invitedFriend
          ? `Waiting for ${invitedFriend.fullName || invitedFriend.displayName || 'opponent'}...`
          : 'Waiting for opponent...';
      }

      if (!myColor) {
        return 'Assigning your color...';
      }

      if (opponentDisconnected) {
        return 'Opponent disconnected';
      }

      const colorName = myColor === 'w' ? 'White' : 'Black';

      if (gameOver) {
        if (engine.isCheckmate()) return 'Checkmate';
        if (engine.isStalemate()) return 'Stalemate';
        if (engine.isThreefoldRepetition()) return 'Threefold repetition';
        if (engine.isInsufficientMaterial()) return 'Draw by insufficient material';
        return 'Draw';
      }

      if (turnColor !== myColor) {
        return `Opponent's turn... (You are ${colorName})`;
      }

      return `Your turn! (You are ${colorName})${inCheck ? ' (check)' : ''}`;
    }

    if (gameOver) {
      if (engine.isCheckmate()) return 'Checkmate';
      if (engine.isStalemate()) return 'Stalemate';
      if (engine.isThreefoldRepetition()) return 'Threefold repetition';
      if (engine.isInsufficientMaterial()) return 'Draw by insufficient material';
      return 'Draw';
    }

    return `${turnColor === 'w' ? 'White' : 'Black'} to move${inCheck ? ' (check)' : ''}`;
  };

  const getWinnerMessage = () => {
    if (!gameOver) return null;

    if (engine.isCheckmate()) {
      const winner = turnColor === 'w' ? 'Black' : 'White';
      return {
        title: '🎉 Checkmate!',
        message: `${winner} wins!`,
        isDraw: false
      };
    }

    if (engine.isStalemate()) {
      return {
        title: '🤝 Stalemate',
        message: 'The game is a draw',
        isDraw: true
      };
    }

    if (engine.isThreefoldRepetition()) {
      return {
        title: '🔄 Draw',
        message: 'Threefold repetition',
        isDraw: true
      };
    }

    if (engine.isInsufficientMaterial()) {
      return {
        title: '🤝 Draw',
        message: 'Insufficient material',
        isDraw: true
      };
    }

    return {
      title: '🤝 Draw',
      message: 'The game ended in a draw',
      isDraw: true
    };
  };

  const pageStyle = {
    minHeight: '100vh',
    background: 'linear-gradient(180deg, #0B1220 0%, #0F172A 100%)',
    padding: 'clamp(12px, 3vw, 20px)',
    color: '#E5E7EB',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  };

  const containerStyle = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    maxWidth: '100%',
  };

  const topBarStyle = {
    display: 'flex',
    flexDirection: isMobile ? 'column' : 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: boardSize + 40,
    marginBottom: 'clamp(12px, 3vw, 16px)',
    gap: 'clamp(8px, 2vw, 12px)',
  };

  const titleStyle = {
    fontSize: 'clamp(18px, 4vw, 24px)',
    fontWeight: 700,
    color: '#E5E7EB',
    textAlign: isMobile ? 'center' : 'left',
  };

  const buttonStyle = {
    padding: 'clamp(6px, 1.5vw, 8px) clamp(12px, 3vw, 16px)',
    borderRadius: '8px',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    cursor: 'pointer',
    fontSize: 'clamp(12px, 3vw, 14px)',
    fontWeight: 600,
    transition: 'all 0.2s',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    color: '#E5E7EB',
    whiteSpace: 'nowrap',
  };

  const buttonHoverStyle = {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  };

  const statusStyle = {
    textAlign: 'center',
    marginBottom: 'clamp(12px, 3vw, 16px)',
    fontSize: 'clamp(14px, 3.5vw, 18px)',
    fontWeight: 500,
    color: '#E5E7EB',
  };

  const boardStyle = {
    width: boardSize,
    height: boardSize,
    borderRadius: '8px',
    overflow: 'hidden',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
    border: '2px solid rgba(255, 255, 255, 0.1)',
    position: 'relative',
  };

  const modalBackdropStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  };

  const modalCardStyle = {
    backgroundColor: 'rgba(30, 30, 50, 0.95)',
    borderRadius: '12px',
    padding: 'clamp(16px, 4vw, 24px)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    minWidth: 'min(280px, 90vw)',
    maxWidth: '90vw',
  };

  const modalTitleStyle = {
    fontSize: 'clamp(16px, 4vw, 18px)',
    fontWeight: 600,
    marginBottom: 'clamp(12px, 3vw, 16px)',
    textAlign: 'center',
    color: '#E5E7EB',
  };

  const promoButtonContainerStyle = {
    display: 'flex',
    flexDirection: 'row',
    gap: '12px',
    justifyContent: 'space-between',
  };

  const promoButtonStyle = {
    flex: 1,
    padding: 'clamp(8px, 2vw, 12px)',
    borderRadius: '8px',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    color: '#E5E7EB',
    cursor: 'pointer',
    fontSize: 'clamp(14px, 3.5vw, 16px)',
    fontWeight: 600,
    textAlign: 'center',
    transition: 'all 0.2s',
  };

  const winnerModalCardStyle = {
    backgroundColor: 'rgba(30, 30, 50, 0.95)',
    borderRadius: '16px',
    padding: 'clamp(20px, 5vw, 32px)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    minWidth: 'min(280px, 90vw)',
    maxWidth: 'min(400px, 90vw)',
    textAlign: 'center',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
  };

  const winnerTitleStyle = {
    fontSize: 'clamp(20px, 5vw, 28px)',
    fontWeight: 700,
    marginBottom: 'clamp(8px, 2vw, 12px)',
    color: '#E5E7EB',
  };

  const winnerMessageStyle = {
    fontSize: 'clamp(14px, 3.5vw, 18px)',
    fontWeight: 500,
    marginBottom: 'clamp(16px, 4vw, 24px)',
    color: '#E5E7EB',
    opacity: 0.9,
  };

  const winnerButtonContainerStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  };

  const winnerButtonStyle = {
    padding: 'clamp(8px, 2vw, 12px) clamp(16px, 4vw, 24px)',
    borderRadius: '8px',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    color: '#E5E7EB',
    cursor: 'pointer',
    fontSize: 'clamp(14px, 3.5vw, 16px)',
    fontWeight: 600,
    transition: 'all 0.2s',
    width: '100%',
  };

  const inviteBtnStyle = {
    ...buttonStyle,
    padding: '6px 12px',
    fontSize: '12px',
    backgroundColor: '#2E7D32',
    borderColor: 'rgba(255,255,255,0.2)',
  };

  const renderFriendPicker = (allowInvite) => (
    <>
      <div className="chess-section-title">Invite a friend</div>
      <div className="chess-search">
        <span aria-hidden="true">⌕</span>
        <input
          placeholder="Search friends by name..."
          value={friendSearchQuery}
          onChange={(e) => onChangeFriendSearch(e.target.value)}
          aria-label="Search friends"
        />
      </div>
      <div className="chess-friend-list">
        {(loadingSearch || loadingFriends) && (
          <div className="chess-empty">Searching…</div>
        )}
        {!loadingSearch && !loadingFriends && visibleFriends.length === 0 && (
          <div className="chess-empty">
            {friendSearchQuery ? 'No friends match your search' : 'No friends to show yet'}
          </div>
        )}
        {visibleFriends.map((f) => {
          const key = f?._id || String(f?.id);
          const invited = invitedFriend && String(invitedFriend._id) === String(f._id);
          const initial = (f?.fullName || '?').trim().charAt(0).toUpperCase();
          return (
            <div key={key} className="chess-friend">
              <div className="chess-friend__left">
                <div className="chess-friend__avatar">
                  {f?.profilePic ? <img src={f.profilePic} alt="" /> : initial}
                </div>
                <div className="chess-friend__name">{f?.fullName || 'Unknown'}</div>
              </div>
              {allowInvite && (
                <button
                  type="button"
                  style={inviteBtnStyle}
                  onClick={() => inviteFriend(f, { reinvite: invited })}
                >
                  {invited && inviteStatus === 'invited' ? 'Resend' : invited && inviteStatus === 'joined' ? 'Joined' : 'Invite'}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </>
  );

  if (showGameModeSelect) {
    return (
      <div style={pageStyle}>
        <div style={containerStyle}>
          <div className="chess-setup-card">
            <h2 style={{ ...titleStyle, marginBottom: '24px' }}>
              {showOnlineSetup ? 'Play Online' : 'Choose Game Mode'}
            </h2>
            {!showOnlineSetup ? (
              <div className="chess-setup-actions">
                <button
                  style={winnerButtonStyle}
                  onClick={() => {
                    setGameMode('local');
                    setShowGameModeSelect(false);
                  }}
                  onMouseEnter={(e) => Object.assign(e.currentTarget.style, buttonHoverStyle)}
                  onMouseLeave={(e) => Object.assign(e.currentTarget.style, winnerButtonStyle)}
                >
                  Local Game (2 Players)
                </button>
                <button
                  style={winnerButtonStyle}
                  onClick={() => {
                    setGameMode('computer');
                    setMyColor('w');
                    setShowGameModeSelect(false);
                  }}
                  onMouseEnter={(e) => Object.assign(e.currentTarget.style, buttonHoverStyle)}
                  onMouseLeave={(e) => Object.assign(e.currentTarget.style, winnerButtonStyle)}
                >
                  Play vs Computer
                </button>
                <button
                  style={winnerButtonStyle}
                  onClick={() => setShowOnlineSetup(true)}
                  onMouseEnter={(e) => Object.assign(e.currentTarget.style, buttonHoverStyle)}
                  onMouseLeave={(e) => Object.assign(e.currentTarget.style, winnerButtonStyle)}
                >
                  Play Online with Friends
                </button>
                <button
                  style={{ ...winnerButtonStyle, backgroundColor: 'rgba(255, 0, 0, 0.2)' }}
                  onClick={() => navigate('/menu')}
                  onMouseEnter={(e) => Object.assign(e.currentTarget.style, { backgroundColor: 'rgba(255, 0, 0, 0.3)' })}
                  onMouseLeave={(e) => Object.assign(e.currentTarget.style, { backgroundColor: 'rgba(255, 0, 0, 0.2)' })}
                >
                  Back to Menu
                </button>
              </div>
            ) : (
              <div className="chess-setup-actions">
                {renderFriendPicker(true)}
                <button
                  style={{ ...winnerButtonStyle, backgroundColor: '#2E7D32' }}
                  onClick={() => startOnlineGame()}
                >
                  Create room & share link
                </button>
                <div style={{ marginTop: '8px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                  <input
                    type="text"
                    placeholder="Or enter game ID to join"
                    value={joinGameIdInput}
                    onChange={(e) => setJoinGameIdInput(e.target.value)}
                    style={{
                      ...winnerButtonStyle,
                      textAlign: 'left',
                      padding: '8px 16px',
                      marginBottom: '8px',
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && joinGameIdInput.trim()) {
                        joinGameById(joinGameIdInput.trim());
                      }
                    }}
                  />
                  <button
                    style={winnerButtonStyle}
                    onClick={() => {
                      if (joinGameIdInput.trim()) joinGameById(joinGameIdInput.trim());
                    }}
                  >
                    Join Game
                  </button>
                </div>
                <button
                  style={winnerButtonStyle}
                  onClick={() => setShowOnlineSetup(false)}
                >
                  Back
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const viewAsBlack = gameMode === 'online' && myColor === 'b';
  const rows = viewAsBlack
    ? [...Array(BOARD_SIZE).keys()]
    : [...Array(BOARD_SIZE).keys()].map((_, idx) => BOARD_SIZE - 1 - idx);
  const cols = viewAsBlack
    ? [...Array(BOARD_SIZE).keys()].reverse()
    : [...Array(BOARD_SIZE).keys()];

  const opponentInfo = myColor === 'w' ? blackPlayerInfo : whitePlayerInfo;
  const selfInfo = myColor === 'w' ? whitePlayerInfo : blackPlayerInfo;

  const playerChip = (info, label) => {
    const name = info?.name || label;
    const initial = (name || '?').trim().charAt(0).toUpperCase();
    return (
      <div className="chess-player-chip">
        {info?.avatar ? (
          <img src={info.avatar} alt="" />
        ) : (
          <span className="chess-player-chip__fallback">{initial}</span>
        )}
        <span>{name}</span>
      </div>
    );
  };

  return (
    <div style={pageStyle} key={`fen-${fenVersion}`}>
      <div style={containerStyle}>
        <div style={topBarStyle}>
          <h1 style={titleStyle}>
            Chess
            {gameMode === 'computer' && <span style={{ fontSize: '12px', opacity: 0.7 }}> (vs Computer)</span>}
            {gameMode === 'online' && <span style={{ fontSize: '12px', opacity: 0.7 }}> (Online)</span>}
          </h1>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
            {gameMode === 'local' && (
              <button
                style={buttonStyle}
                onClick={undo}
                onMouseEnter={(e) => Object.assign(e.currentTarget.style, buttonHoverStyle)}
                onMouseLeave={(e) => Object.assign(e.currentTarget.style, buttonStyle)}
              >
                Undo
              </button>
            )}
            <button
              style={buttonStyle}
              onClick={reset}
              onMouseEnter={(e) => Object.assign(e.currentTarget.style, buttonHoverStyle)}
              onMouseLeave={(e) => Object.assign(e.currentTarget.style, buttonStyle)}
            >
              Reset
            </button>
            {gameMode === 'online' && gameId && (
              <button
                style={buttonStyle}
                onClick={copyInviteLink}
                onMouseEnter={(e) => Object.assign(e.currentTarget.style, buttonHoverStyle)}
                onMouseLeave={(e) => Object.assign(e.currentTarget.style, buttonStyle)}
              >
                {inviteCopied ? 'Copied!' : 'Copy Invite Link'}
              </button>
            )}
            <button
              style={buttonStyle}
              onClick={leaveGame}
              onMouseEnter={(e) => Object.assign(e.currentTarget.style, buttonHoverStyle)}
              onMouseLeave={(e) => Object.assign(e.currentTarget.style, buttonStyle)}
            >
              Close
            </button>
          </div>
        </div>

        {gameMode === 'online' && waitingForOpponent && (
          <div className="chess-waiting-banner">
            <div className="chess-waiting-banner__text">
              <div className="chess-waiting-banner__title">Waiting for opponent</div>
              <div className="chess-waiting-banner__sub">
                {invitedFriend
                  ? `Invite sent to ${invitedFriend.fullName || 'your friend'}. They’ll join when they accept.`
                  : 'Invite a friend or share the link to start playing.'}
              </div>
            </div>
            <button style={buttonStyle} onClick={copyInviteLink}>
              {inviteCopied ? 'Copied!' : 'Copy link'}
            </button>
          </div>
        )}

        {gameMode === 'online' && waitingForOpponent && (
          <div style={{ width: '100%', maxWidth: boardSize, marginBottom: 12 }}>
            {renderFriendPicker(true)}
          </div>
        )}

        {gameMode === 'online' && !waitingForOpponent && (
          <div className="chess-player-row">
            {playerChip(viewAsBlack ? selfInfo : opponentInfo, viewAsBlack ? 'You' : 'Opponent')}
            {playerChip(viewAsBlack ? opponentInfo : selfInfo, viewAsBlack ? 'Opponent' : 'You')}
          </div>
        )}

        <div style={statusStyle}>{getGameStatus()}</div>

        <div style={boardStyle}>
          {rows.map(row => renderRow(row, cols))}
        </div>

        {promotionFromTo && (
          <div style={modalBackdropStyle} onClick={() => setPromotionFromTo(null)}>
            <div style={modalCardStyle} onClick={(e) => e.stopPropagation()}>
              <div style={modalTitleStyle}>Choose promotion</div>
              <div style={promoButtonContainerStyle}>
                {['q', 'r', 'b', 'n'].map(p => (
                  <button
                    key={p}
                    style={promoButtonStyle}
                    onClick={() => doPromote(p)}
                    onMouseEnter={(e) => Object.assign(e.currentTarget.style, buttonHoverStyle)}
                    onMouseLeave={(e) => Object.assign(e.currentTarget.style, promoButtonStyle)}
                  >
                    {p.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {gameOver && getWinnerMessage() && (
          <div style={modalBackdropStyle}>
            <div style={winnerModalCardStyle}>
              <div style={winnerTitleStyle}>{getWinnerMessage().title}</div>
              <div style={winnerMessageStyle}>{getWinnerMessage().message}</div>
              <div style={winnerButtonContainerStyle}>
                <button
                  style={winnerButtonStyle}
                  onClick={() => {
                    reset();
                  }}
                  onMouseEnter={(e) => Object.assign(e.currentTarget.style, buttonHoverStyle)}
                  onMouseLeave={(e) => Object.assign(e.currentTarget.style, winnerButtonStyle)}
                >
                  Play Again
                </button>
                <button
                  style={winnerButtonStyle}
                  onClick={leaveGame}
                  onMouseEnter={(e) => Object.assign(e.currentTarget.style, buttonHoverStyle)}
                  onMouseLeave={(e) => Object.assign(e.currentTarget.style, winnerButtonStyle)}
                >
                  Back to Menu
                </button>
                <button
                  style={winnerButtonStyle}
                  onClick={() =>
                    openCreatePost({
                      caption: getWinnerMessage()?.isDraw
                        ? 'Chess on Connect ended in a draw.'
                        : `${getWinnerMessage()?.message || 'Chess match finished'} — played on Connect.`,
                      audience: 1,
                      navigate,
                    })
                  }
                  onMouseEnter={(e) => Object.assign(e.currentTarget.style, buttonHoverStyle)}
                  onMouseLeave={(e) => Object.assign(e.currentTarget.style, winnerButtonStyle)}
                >
                  Share recap
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChessGame;
