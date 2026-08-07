const PIECE_VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

/**
 * Pick a reasonable move for the computer (captures/checks preferred).
 */
export const pickComputerMove = (game) => {
    const moves = game.moves({ verbose: true });
    if (!moves.length) return null;

    let bestScore = -Infinity;
    let candidates = [];

    for (const move of moves) {
        let score = Math.random() * 0.05;

        if (move.captured) {
            score += (PIECE_VALUES[move.captured] || 0) * 10;
        }
        if (move.promotion) {
            score += 8;
        }

        game.move(move);
        if (game.isCheckmate()) {
            score += 1000;
        } else if (game.isCheck()) {
            score += 2;
        }
        game.undo();

        if (score > bestScore + 0.001) {
            bestScore = score;
            candidates = [move];
        } else if (Math.abs(score - bestScore) <= 0.001) {
            candidates.push(move);
        }
    }

    return candidates[Math.floor(Math.random() * candidates.length)] || moves[0];
};
