import { PATHS, SAFE_CELLS, DEFAULT_MAX_STEPS, HOME_COLUMN_LENGTH } from '../constants/gameConstants';

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

export const getPieceSteps = (piece) => {
    const steps = Number(piece?.steps);
    return Number.isFinite(steps) && steps > 0 ? steps : 0;
};

// Get playable pieces for a given dice value.
// Trust step counts rather than isHome/isInPlay flags — those can go stale
// after a home-column move and then lock the board on the next roll.
export const getPlayablePieces = (playerIndex, diceVal, players, maxSteps) => {
    const playerData = players[playerIndex];
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

const homeColumnStart = (maxSteps) =>
    Number(maxSteps) - (HOME_COLUMN_LENGTH - 1);

const sameCell = (a, b) =>
    Boolean(a && b && a.x === b.x && a.y === b.y);

const isHomeColumnSteps = (steps, maxSteps) => {
    const value = Number(steps) || 0;
    return value > 0 && value >= homeColumnStart(maxSteps);
};

const destinationSteps = (fromSteps, diceVal, maxSteps) => {
    if (fromSteps <= 0) return diceVal === 6 ? 1 : 0;
    const next = fromSteps + Number(diceVal || 0);
    return next <= maxSteps ? next : -1;
};

const countOwnAtCell = (player, playerIndex, cell, skipPieceIndex, maxSteps) => {
    if (!player || !Array.isArray(player.pieces) || !cell) return 0;
    return player.pieces.reduce((count, piece, pieceIndex) => {
        if (pieceIndex === skipPieceIndex) return count;
        const steps = getPieceSteps(piece);
        if (steps <= 0 || steps >= maxSteps) return count;
        return sameCell(getPositionOnPath(playerIndex, steps), cell)
            ? count + 1
            : count;
    }, 0);
};

const opponentPiecesAtCell = (players, movingPlayerIndex, cell, maxSteps) => {
    const hits = [];
    if (!cell) return hits;
    (players || []).forEach((player, playerIndex) => {
        if (playerIndex === movingPlayerIndex || !Array.isArray(player?.pieces)) {
            return;
        }
        player.pieces.forEach((piece, pieceIndex) => {
            const steps = getPieceSteps(piece);
            if (steps <= 0 || steps >= maxSteps || isHomeColumnSteps(steps, maxSteps)) {
                return;
            }
            if (sameCell(getPositionOnPath(playerIndex, steps), cell)) {
                hits.push({ playerIndex, pieceIndex, steps });
            }
        });
    });
    return hits;
};

const canCaptureAt = (players, movingPlayerIndex, cell, toSteps, maxSteps) => {
    if (!cell || toSteps <= 0 || toSteps >= maxSteps || isHomeColumnSteps(toSteps, maxSteps)) {
        return [];
    }
    if (isSafePosition(movingPlayerIndex, cell)) return [];

    const hits = opponentPiecesAtCell(players, movingPlayerIndex, cell, maxSteps);
    if (hits.length === 0) return [];

    const byPlayer = new Map();
    hits.forEach((hit) => {
        const list = byPlayer.get(hit.playerIndex) || [];
        list.push(hit);
        byPlayer.set(hit.playerIndex, list);
    });

    const captured = [];
    byPlayer.forEach((list) => {
        const ownLandingStack =
            1 + countOwnAtCell(players[movingPlayerIndex], movingPlayerIndex, cell, -1, maxSteps);
        if (list.length >= 2 && ownLandingStack < 2) return;
        captured.push(...list);
    });
    return captured;
};

const isCellThreatened = (players, ownerIndex, cell, skipOwnerPieceIndex, maxSteps) => {
    if (!cell || isSafePosition(ownerIndex, cell)) return false;
    const ownStack = countOwnAtCell(
        players[ownerIndex],
        ownerIndex,
        cell,
        skipOwnerPieceIndex,
        maxSteps,
    );
    if (ownStack >= 1) return false;

    return (players || []).some((player, playerIndex) => {
        if (playerIndex === ownerIndex || !Array.isArray(player?.pieces)) return false;
        return player.pieces.some((piece) => {
            const from = getPieceSteps(piece);
            if (from <= 0 || from >= maxSteps || isHomeColumnSteps(from, maxSteps)) {
                return false;
            }
            for (let roll = 1; roll <= 6; roll += 1) {
                const to = from + roll;
                if (to > maxSteps || isHomeColumnSteps(to, maxSteps)) continue;
                if (sameCell(getPositionOnPath(playerIndex, to), cell)) return true;
            }
            return false;
        });
    });
};

// Choose a bot move that develops several tokens instead of racing one piece home.
export const pickSmartBotPiece = (
    playableIds,
    playerIndex,
    players,
    diceVal,
    maxSteps,
) => {
    const ids = Array.isArray(playableIds) ? playableIds : [];
    if (ids.length === 0) return 0;
    if (ids.length === 1) return ids[0];

    const pieces = players?.[playerIndex]?.pieces || [];
    const max = Number(maxSteps) || getMaxSteps();
    const roll = Number(diceVal) || 0;
    const homeStart = homeColumnStart(max);

    const inPlaySteps = pieces
        .map((piece) => getPieceSteps(piece))
        .filter((steps) => steps > 0 && steps < max);
    const inPlayCount = inPlaySteps.length;
    const yardCount = pieces.filter((piece) => getPieceSteps(piece) <= 0).length;
    const minInPlay = inPlayCount ? Math.min(...inPlaySteps) : 0;
    const maxInPlay = inPlayCount ? Math.max(...inPlaySteps) : 0;

    let bestId = ids[0];
    let bestScore = -Infinity;

    ids.forEach((id) => {
        const from = getPieceSteps(pieces[id]);
        const to = destinationSteps(from, roll, max);
        if (to < 0) return;

        const leavingYard = from <= 0;
        const dest = to > 0 ? getPositionOnPath(playerIndex, to) : null;
        const fromCell = from > 0 ? getPositionOnPath(playerIndex, from) : null;
        let score = 0;

        const captures = leavingYard
            ? []
            : canCaptureAt(players, playerIndex, dest, to, max);
        if (captures.length > 0) {
            score += 1400 + captures.reduce((sum, hit) => sum + hit.steps * 3, 0);
        }

        if (to >= max) {
            score += 1100;
        } else if (to >= homeStart) {
            score += 240;
            if (from < homeStart) score += 180;
            score += (to - homeStart) * 30;
        }

        if (leavingYard && roll === 6) {
            if (inPlayCount === 0) score += 460;
            else if (inPlayCount === 1) score += 420;
            else if (inPlayCount === 2) score += 300;
            else score += 90;
        }

        if (!leavingYard && to < homeStart) {
            if (from === minInPlay) score += 160;
            if (
                from === maxInPlay &&
                inPlayCount >= 2 &&
                maxInPlay - minInPlay > 10
            ) {
                score -= 110;
            }
            if (from === maxInPlay && inPlayCount === 1 && yardCount > 0 && roll === 6) {
                score -= 220;
            }
            score += Math.min(from, 18);
        }

        if (!leavingYard && fromCell && isCellThreatened(players, playerIndex, fromCell, id, max)) {
            score += 240;
            if (to >= homeStart || (dest && isSafePosition(playerIndex, dest))) {
                score += 90;
            }
        }

        if (dest && to > 0 && to < max) {
            if (isSafePosition(playerIndex, dest) || to >= homeStart) score += 85;
            else if (isCellThreatened(players, playerIndex, dest, id, max)) score -= 95;
            if (countOwnAtCell(players[playerIndex], playerIndex, dest, id, max) >= 1) {
                score += 55;
            }
        }

        score += (Number(id) * 5 + roll) % 9;

        if (score > bestScore) {
            bestScore = score;
            bestId = id;
        }
    });

    return bestId;
};

