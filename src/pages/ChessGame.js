import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Chess } from 'chess.js';
import { useSelector } from 'react-redux';
import socket from '../common/socket';
import { pickComputerMove } from '../utils/chessComputer';

const BOARD_SIZE = 8;
const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

// Unicode chess pieces
const unicodeForPiece = (piece, color) => {
  const map = {
    wk: '\u2654', // White King
    wq: '\u2655', // White Queen
    wr: '\u2656', // White Rook
    wb: '\u2657', // White Bishop
    wn: '\u2658', // White Knight
    wp: '\u2659', // White Pawn
    bk: '\u265A', // Black King
    bq: '\u265B', // Black Queen
    br: '\u265C', // Black Rook
    bb: '\u265D', // Black Bishop
    bn: '\u265E', // Black Knight
    bp: '\u265F', // Black Pawn
  };
  return map[`${color}${piece}`] || '';
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
  
  // Multiplayer state
  const [gameMode, setGameMode] = useState(null); // null (not set), 'local', 'online', or 'computer'
  const [gameId, setGameId] = useState(null);
  const [myColor, setMyColor] = useState(null); // 'w' or 'b'
  const [whitePlayer, setWhitePlayer] = useState(null);
  const [blackPlayer, setBlackPlayer] = useState(null);
  const [waitingForOpponent, setWaitingForOpponent] = useState(false);
  const [showGameModeSelect, setShowGameModeSelect] = useState(true);
  const [opponentDisconnected, setOpponentDisconnected] = useState(false);
  const isProcessingRemoteMove = useRef(false);
  const lastLocalMoveRef = useRef(null);
  const computerThinkingRef = useRef(false);
  
  // Check URL params for gameId (from invite)
  useEffect(() => {
    const urlGameId = searchParams.get('gameId');
    if (urlGameId && profileId) {
      console.log('[CHESS] URL gameId detected:', urlGameId);
      setGameId(urlGameId);
      setGameMode('online');
      setShowGameModeSelect(false);
      setWaitingForOpponent(true); // Initially waiting until we get state update
    }
  }, [searchParams, profileId]);

  // Responsive board size and mobile detection
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

  // Socket event handlers for online play
  useEffect(() => {
    if (gameMode !== 'online' || !gameId || !profileId) return;

    const handleJoined = (data) => {
      if (data.gameId !== gameId) return;
      console.log('[CHESS] Joined game room', data);
    };
    

    const handleState = (data) => {
      if (data.gameId !== gameId) return;
      console.log('[CHESS] Received state update', data);
      setWhitePlayer(data.whitePlayer);
      setBlackPlayer(data.blackPlayer);
      
      // Determine my color FIRST (before checking waitingForOpponent)
      if (profileId) {
        const pid = String(profileId);
        if (data.whitePlayer && String(data.whitePlayer) === pid) {
          console.log('[CHESS] I am white player');
          setMyColor('w');
        } else if (data.blackPlayer && String(data.blackPlayer) === pid) {
          console.log('[CHESS] I am black player');
          setMyColor('b');
        } else {
          console.log('[CHESS] Color not assigned yet', { 
            myProfileId: pid, 
            whitePlayer: data.whitePlayer, 
            blackPlayer: data.blackPlayer 
          });
        }
      }
      
      // Check if waiting for opponent
      const isWaiting = !data.whitePlayer || !data.blackPlayer;
      console.log('[CHESS] Waiting for opponent?', isWaiting);
      setWaitingForOpponent(isWaiting);
      
      // If state has FEN and it's different, sync engine
      if (data.fen && data.fen !== engine.fen()) {
        try {
          engine.load(data.fen);
          setFenVersion(v => v + 1);
          console.log('[CHESS] Loaded FEN:', data.fen);
        } catch (e) {
          console.error('Error loading FEN:', e);
        }
      }
    };

    const handleMove = (data) => {
      if (data.gameId !== gameId) return;
      if (!data.move) return;
      
      // Don't process our own moves (they're already applied locally)
      const moveKey = `${data.move.from}-${data.move.to}-${data.move.promotion || ''}`;
      if (lastLocalMoveRef.current === moveKey) {
        lastLocalMoveRef.current = null; // Clear after one use
        return;
      }
      
      // If the FEN matches what we already have, skip (might be our own move)
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

    const handleGameOver = (data) => {
      if (data.gameId !== gameId) return;
      // Game over is already detected by engine, but we can handle additional logic here
    };

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

    socket.on('chess:joined', handleJoined);
    socket.on('chess:state', handleState);
    socket.on('chess:move', handleMove);
    socket.on('chess:reset', handleReset);
    socket.on('chess:gameover', handleGameOver);
    socket.on('chess:player:offline', handlePlayerOffline);
    socket.on('chess:player:online', handlePlayerOnline);

    // Join game room - ensure socket is connected
    const attemptJoin = () => {
      if (socket.connected) {
        socket.emit('chess:join', { gameId });
      } else {
        // If not connected, wait for connection
        socket.once('connect', () => {
          socket.emit('chess:join', { gameId });
        });
      }
    };

    // Attempt join immediately or on connect
    attemptJoin();

    return () => {
      socket.off('chess:joined', handleJoined);
      socket.off('chess:state', handleState);
      socket.off('chess:move', handleMove);
      socket.off('chess:reset', handleReset);
      socket.off('chess:gameover', handleGameOver);
      socket.off('chess:player:offline', handlePlayerOffline);
      socket.off('chess:player:online', handlePlayerOnline);
    };
  }, [gameMode, gameId, profileId, engine]);

  const turnColor = engine.turn();
  const gameOver = engine.isGameOver();
  const inCheck = engine.isCheck();

  // Computer opponent (plays black)
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

    // In online mode, require myColor to be set and only allow moves on your turn
    if (gameMode === 'online') {
      if (!myColor) {
        console.log('[CHESS] Cannot move: myColor not set yet', { myColor, whitePlayer, blackPlayer });
        return;
      }
      if (turnColor !== myColor) {
        console.log('[CHESS] Cannot move: not your turn', { myColor, turnColor });
        return;
      }
    }

    // Vs computer: you play white only
    if (gameMode === 'computer' && turnColor !== 'w') {
      return;
    }

    if (selected === square) {
      setSelected(null);
      setLegalTargets([]);
      return;
    }

    const piece = engine.get(square);
    console.log('[CHESS] Square clicked', { 
      square, 
      piece: piece ? { type: piece.type, color: piece.color } : null, 
      turnColor, 
      myColor, 
      gameMode,
      waitingForOpponent
    });

    // If selecting own piece, show legal moves
    if (piece && piece.color === turnColor) {
      const moves = engine.moves({ square, verbose: true });
      console.log('[CHESS] Legal moves found:', moves.length);
      setSelected(square);
      setLegalTargets(moves.map(m => m.to));
      return;
    } else if (piece) {
      console.log('[CHESS] Cannot select piece - not your turn', {
        pieceColor: piece.color,
        turnColor,
        myColor
      });
    }

    // If clicking a legal target from previously selected
    if (selected && legalTargets.includes(square)) {
      const moves = engine.moves({ square: selected, verbose: true });
      const move = moves.find(m => m.to === square);
      if (!move) return;

      // Handle promotion
      const needsPromotion = move.promotion || (move.piece === 'p' && (square.endsWith('8') || square.endsWith('1')));
      if (needsPromotion) {
        setPromotionFromTo({ from: selected, to: square });
        return;
      }

      const result = engine.move({ from: selected, to: square });
      if (result) {
        console.log('[CHESS] Move executed successfully', { from: selected, to: square });
        const moveKey = `${selected}-${square}-`;
        lastLocalMoveRef.current = moveKey;
        
        setSelected(null);
        setLegalTargets([]);
        setFenVersion(v => v + 1);
        
        // Broadcast move in online mode
        if (gameMode === 'online' && gameId) {
          console.log('[CHESS] Broadcasting move to server');
          socket.emit('chess:move', {
            gameId,
            move: {
              from: selected,
              to: square,
              fen: engine.fen()
            }
          });
          
          // Check if game is over
          if (engine.isGameOver()) {
            let result = 'draw';
            if (engine.isCheckmate()) {
              result = turnColor === 'w' ? 'black_wins' : 'white_wins';
            }
            socket.emit('chess:gameover', { gameId, result });
          }
        }
      } else {
        console.log('[CHESS] Move failed - invalid move', { from: selected, to: square });
      }
      return;
    }

    // Otherwise clear selection
    setSelected(null);
    setLegalTargets([]);
  }, [selected, legalTargets, promotionFromTo, turnColor, gameOver, engine, gameMode, myColor, gameId]);

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
      
      // Broadcast move in online mode
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
        
        // Check if game is over
        if (engine.isGameOver()) {
          let result = 'draw';
          if (engine.isCheckmate()) {
            result = engine.turn() === 'w' ? 'black_wins' : 'white_wins';
          }
          socket.emit('chess:gameover', { gameId, result });
        }
      }
    }
  };

  const undo = () => {
    // Only allow undo in local mode
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
    
    // Broadcast reset in online mode
    if (gameMode === 'online' && gameId) {
      socket.emit('chess:reset', { gameId });
    }
  };

  // Create new online game
  const createOnlineGame = () => {
    if (!profileId) return;
    const newGameId = `chess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    setGameId(newGameId);
    setGameMode('online');
    setShowGameModeSelect(false);
    setWaitingForOpponent(true);
    socket.emit('chess:create', { gameId: newGameId });
    socket.emit('chess:join', { gameId: newGameId });
  };

  // Join existing game by ID
  const joinGameById = (id) => {
    setGameId(id);
    setGameMode('online');
    setShowGameModeSelect(false);
    socket.emit('chess:join', { gameId: id });
  };

  const renderSquare = (row, col) => {
    const isDark = (row + col) % 2 === 1;
    const square = `${FILES[col]}${row + 1}`;
    const piece = engine.get(square);
    const isSelected = selected === square;
    const isTarget = legalTargets.includes(square);

    const squareSize = boardSize / BOARD_SIZE;

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
          cursor: 'pointer',
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
            transform: piece.color !== 'w' ? 'rotate(180deg)' : 'none',
          }}>
            {unicodeForPiece(piece.type, piece.color)}
          </span>
        )}
      </div>
    );
  };

  const renderRow = (row) => {
    return (
      <div
        key={`row-${row}`}
        style={{
          display: 'flex',
          flexDirection: 'row',
        }}
      >
        {new Array(BOARD_SIZE).fill(null).map((_, col) => renderSquare(row, col))}
      </div>
    );
  };

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
        return 'Waiting for opponent...';
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
    
    // Local mode
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
      // The player who just moved won (opposite of current turn)
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

  // Game mode selection modal
  if (showGameModeSelect) {
    return (
      <div style={pageStyle}>
        <div style={containerStyle}>
          <div style={{
            backgroundColor: 'rgba(30, 30, 50, 0.95)',
            borderRadius: '16px',
            padding: '32px',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            minWidth: '320px',
            maxWidth: '400px',
            textAlign: 'center',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
          }}>
            <h2 style={{ ...titleStyle, marginBottom: '24px' }}>Choose Game Mode</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
                onClick={createOnlineGame}
                onMouseEnter={(e) => Object.assign(e.currentTarget.style, buttonHoverStyle)}
                onMouseLeave={(e) => Object.assign(e.currentTarget.style, winnerButtonStyle)}
              >
                Create Online Game
              </button>
              <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                <input
                  type="text"
                  placeholder="Or enter game ID"
                  style={{
                    ...winnerButtonStyle,
                    textAlign: 'left',
                    padding: '8px 16px',
                    marginBottom: '8px',
                  }}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && e.target.value.trim()) {
                      joinGameById(e.target.value.trim());
                    }
                  }}
                />
              </div>
              <button
                style={{ ...winnerButtonStyle, backgroundColor: 'rgba(255, 0, 0, 0.2)' }}
                onClick={() => navigate('/menu')}
                onMouseEnter={(e) => Object.assign(e.currentTarget.style, { backgroundColor: 'rgba(255, 0, 0, 0.3)' })}
                onMouseLeave={(e) => Object.assign(e.currentTarget.style, { backgroundColor: 'rgba(255, 0, 0, 0.2)' })}
              >
                Back to Menu
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={pageStyle} key={`fen-${fenVersion}`}>
      <div style={containerStyle}>
        <div style={topBarStyle}>
          <h1 style={titleStyle}>
            Chess
            {gameMode === 'computer' && <span style={{ fontSize: '12px', opacity: 0.7 }}> (vs Computer)</span>}
            {gameMode === 'online' && gameId && <span style={{ fontSize: '12px', opacity: 0.7 }}>({gameId.substring(0, 8)}...)</span>}
          </h1>
          <div style={{ display: 'flex', gap: '8px' }}>
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
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}?gameId=${gameId}`);
                  alert('Game ID copied to clipboard!');
                }}
                onMouseEnter={(e) => Object.assign(e.currentTarget.style, buttonHoverStyle)}
                onMouseLeave={(e) => Object.assign(e.currentTarget.style, buttonStyle)}
              >
                Copy Game ID
              </button>
            )}
            <button
              style={buttonStyle}
              onClick={() => navigate('/menu')}
              onMouseEnter={(e) => Object.assign(e.currentTarget.style, buttonHoverStyle)}
              onMouseLeave={(e) => Object.assign(e.currentTarget.style, buttonStyle)}
            >
              Close
            </button>
          </div>
        </div>

        <div style={statusStyle}>{getGameStatus()}</div>

        <div style={boardStyle}>
          {new Array(BOARD_SIZE)
            .fill(null)
            .map((_, idx) => BOARD_SIZE - 1 - idx)
            .map(row => renderRow(row))}
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
                  onClick={() => navigate('/menu')}
                  onMouseEnter={(e) => Object.assign(e.currentTarget.style, buttonHoverStyle)}
                  onMouseLeave={(e) => Object.assign(e.currentTarget.style, winnerButtonStyle)}
                >
                  Back to Menu
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

