import { PATHS, HOME_POSITIONS } from "../constants/gameConstants";

// In 2-player games the second player sits in the opposite corner (Yellow).
export const boardSeatOf = (playerIndex, playerCount) =>
  Number(playerCount) === 2 && Number(playerIndex) === 1 ? 3 : Number(playerIndex);

export const playerIndexForBoardSeat = (boardSeat, playerCount) => {
  if (Number(playerCount) === 2) {
    if (Number(boardSeat) === 0) return 0;
    if (Number(boardSeat) === 3) return 1;
    return null;
  }
  return Number(boardSeat) < Number(playerCount) ? Number(boardSeat) : null;
};

// Turn (and drawing) order: Red, Green, Yellow, Blue with four players.
export const renderOrderFor = (playerCount) =>
  Number(playerCount) === 4 ? [0, 1, 3, 2] : [0, 1, 2].slice(0, Number(playerCount) || 0);

// The server tells clients how long the paths are (tests shorten them; the
// end of each path, including the home column, is always the same).
const pathFor = (playerIndex, playerCount, pathLength) => {
  const full = PATHS[boardSeatOf(playerIndex, playerCount)] || PATHS[0];
  const length = Number(pathLength) || full.length;
  return length < full.length ? full.slice(-length) : full;
};

export const cellFor = (playerIndex, steps, playerCount, pathLength) => {
  const path = pathFor(playerIndex, playerCount, pathLength);
  if (steps <= 0 || steps > path.length) return { x: 7, y: 7 };
  return path[steps - 1];
};

export const yardCellFor = (playerIndex, pieceIndex, playerCount) =>
  HOME_POSITIONS[boardSeatOf(playerIndex, playerCount)][pieceIndex];

// Spreads tokens that share a square so each stays visible and tappable.
export const tokenOffset = (index, count, cellSize) => {
  const delta = Math.round(cellSize * 0.35);
  if (count <= 1) return { dx: 0, dy: 0 };
  if (count === 2) return { dx: Math.round(index === 0 ? -delta / 2 : delta / 2), dy: 0 };
  const layout =
    count === 3
      ? [
          { dx: -delta / 2, dy: -delta / 2 },
          { dx: delta / 2, dy: -delta / 2 },
          { dx: 0, dy: delta / 2 },
        ]
      : [
          { dx: -delta / 2, dy: -delta / 2 },
          { dx: delta / 2, dy: -delta / 2 },
          { dx: -delta / 2, dy: delta / 2 },
          { dx: delta / 2, dy: delta / 2 },
        ];
  const pos = layout[index % layout.length] || { dx: 0, dy: 0 };
  return { dx: Math.round(pos.dx), dy: Math.round(pos.dy) };
};

// Photo shown in a player's starting yard: their cover photo, otherwise
// their profile picture (or the invited player's while they are invited).
export const yardImageFor = (player) =>
  player?.cover ||
  player?.coverPic ||
  player?.avatar ||
  player?.invited?.avatar ||
  null;
