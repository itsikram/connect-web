import { PATHS, SAFE_CELLS, DEFAULT_MAX_STEPS } from '../constants/gameConstants';

// Get position on path for a given player and steps
export const getPositionOnPath = (playerIndex, steps) => {
    const path = PATHS[playerIndex];
    if (!path || steps <= 0 || steps > path.length) {
        return { x: 7, y: 7 };
    }
    return path[steps - 1];
};

// Check if position is safe (cannot capture)
export const isSafePosition = (playerIndex, position) => {
    return SAFE_CELLS.has(`${position.x},${position.y}`);
};

// Get max steps from path length
export const getMaxSteps = () => {
    try {
        const len0 = Array.isArray(PATHS?.[0]) ? PATHS[0].length : undefined;
        return (typeof len0 === 'number' && len0 > 0) ? len0 : DEFAULT_MAX_STEPS;
    } catch (_e) {
        return DEFAULT_MAX_STEPS;
    }
};

// Check for captures when a token moves to a new position
export const checkForCapture = (movingPlayerIndex, newPosition, movingPieceNewSteps, players, maxSteps) => {
    const captured = [];
    
    // Count tokens per player at the target position (including the moving player)
    const tokensAtPosition = new Map(); // playerIndex -> count
    
    players.forEach((player, playerIndex) => {
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
    if (typeof movingPieceNewSteps === 'number' && movingPieceNewSteps > 0 && movingPieceNewSteps < maxSteps) {
        const movingPiecePosition = getPositionOnPath(movingPlayerIndex, movingPieceNewSteps);
        if (movingPiecePosition.x === newPosition.x && movingPiecePosition.y === newPosition.y) {
            const movingPlayer = players[movingPlayerIndex];
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
        
        const player = players[playerIndex];
        
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
            player.pieces.forEach((piece, pieceIndex) => {
                if (piece.isInPlay && piece.steps < maxSteps) {
                    const piecePosition = getPositionOnPath(playerIndex, piece.steps);
                    if (piecePosition.x === newPosition.x && piecePosition.y === newPosition.y) {
                        captured.push({ playerIndex, pieceIndex });
                    }
                }
            });
        }
    });
    
    return captured;
};

// Check for captures when a token moves AWAY from a position
export const checkForCaptureAfterMoveAway = (movingPlayerIndex, oldPosition, players, maxSteps) => {
    const captured = [];
    
    // Count tokens per player at the old position (after the move)
    const tokensAtPosition = new Map(); // playerIndex -> count
    
    players.forEach((player, playerIndex) => {
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
        if (movingPlayerIndex === playerIndex) {
            // Check if moving player left behind tokens that can capture others
            if (count >= 2) {
                players.forEach((opponent, opponentIndex) => {
                    if (opponentIndex === playerIndex) return;
                    const opponentCount = tokensAtPosition.get(opponentIndex) || 0;
                    if (opponentCount === 1) {
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
                    const player = players[playerIndex];
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

// Get playable pieces for a given dice value
export const getPlayablePieces = (playerIndex, diceVal, players, maxSteps) => {
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
};

// Get next active player
export const getNextActivePlayer = (fromIndex, selectedPlayerCount, players, winners) => {
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
};
