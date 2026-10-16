import React, { memo } from "react";
import {
  BOARD_GRID_STROKE,
  BOARD_OUTER_STROKE,
  COLORS,
} from "../constants/gameConstants";
import { playerIndexForBoardSeat, yardImageFor } from "../utils/boardGeometry";

const safeStar = (col, row, color, key, cell) => {
  const cx = (col + 0.5) * cell;
  const cy = (row + 0.5) * cell;
  const r = cell * 0.32;
  const points = [];
  for (let i = 0; i < 8; i++) {
    const angle = (Math.PI / 4) * i - Math.PI / 2;
    const radius = i % 2 === 0 ? r : r * 0.42;
    points.push(`${cx + Math.cos(angle) * radius},${cy + Math.sin(angle) * radius}`);
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

const square = (key, x, y, cell, fill) => (
  <rect
    key={key}
    x={x * cell}
    y={y * cell}
    width={cell}
    height={cell}
    fill={fill}
    stroke={BOARD_GRID_STROKE}
    strokeWidth={0.75}
  />
);

/**
 * The static 15x15 board. Each corner yard shows its player's photo (cover
 * photo, or profile picture) for every seat — the host's and remote players'.
 */
export const GameBoard = memo(function GameBoard({ size, cellSize, players, playerCount }) {
  const cell = cellSize;
  const stroke = BOARD_OUTER_STROKE;
  const elems = [];

  for (let row = 0; row < 15; row++) {
    for (let col = 0; col < 15; col++) {
      elems.push(square(`cell-${row}-${col}`, col, row, cell, "#FAFAF8"));
    }
  }

  const drawYard = (x0, y0, boardSeat) => {
    const color = COLORS[boardSeat];
    elems.push(
      <rect
        key={`home-outer-${boardSeat}`}
        x={x0 * cell}
        y={y0 * cell}
        width={cell * 6}
        height={cell * 6}
        fill={color}
        stroke={stroke}
        strokeWidth={1.5}
        rx={cell * 0.15}
      />,
    );
    const innerX = (x0 + 1) * cell;
    const innerY = (y0 + 1) * cell;
    const innerW = cell * 4;
    const playerIndex = playerIndexForBoardSeat(boardSeat, playerCount);
    const image = playerIndex === null ? null : yardImageFor(players?.[playerIndex]);
    if (image) {
      const clipId = `ludo-yard-clip-${boardSeat}`;
      elems.push(
        <clipPath key={`clip-${boardSeat}`} id={clipId}>
          <rect x={innerX} y={innerY} width={innerW} height={innerW} rx={cell * 0.1} />
        </clipPath>,
        <image
          key={`home-photo-${boardSeat}`}
          data-testid={`ludo-yard-photo-${playerIndex}`}
          href={image}
          x={innerX}
          y={innerY}
          width={innerW}
          height={innerW}
          preserveAspectRatio="xMidYMid slice"
          clipPath={`url(#${clipId})`}
        />,
        <rect
          key={`home-photo-shade-${boardSeat}`}
          x={innerX}
          y={innerY}
          width={innerW}
          height={innerW}
          fill="rgba(0,0,0,0.45)"
        />,
        <rect
          key={`home-photo-frame-${boardSeat}`}
          x={innerX}
          y={innerY}
          width={innerW}
          height={innerW}
          fill="none"
          stroke={stroke}
          strokeWidth={1.5}
          rx={cell * 0.1}
        />,
      );
    } else {
      elems.push(
        <rect
          key={`home-inner-${boardSeat}`}
          x={innerX}
          y={innerY}
          width={innerW}
          height={innerW}
          fill="#FFFEFA"
          stroke={stroke}
          strokeWidth={1.5}
          rx={cell * 0.1}
        />,
      );
    }
    const cx = innerX + cell * 2;
    const cy = innerY + cell * 2;
    const gap = cell * 0.45;
    [
      [-gap, -gap],
      [gap, -gap],
      [-gap, gap],
      [gap, gap],
    ].forEach(([dx, dy], i) => {
      elems.push(
        <circle
          key={`pip-${boardSeat}-${i}`}
          cx={cx + dx}
          cy={cy + dy}
          r={cell * 0.3}
          fill={color}
          stroke={stroke}
          strokeWidth={1.5}
        />,
        <circle
          key={`pip-inner-${boardSeat}-${i}`}
          cx={cx + dx}
          cy={cy + dy}
          r={cell * 0.3 * 0.55}
          fill="rgba(255,255,255,0.35)"
        />,
      );
    });
  };
  drawYard(0, 0, 0);
  drawYard(9, 0, 1);
  drawYard(0, 9, 2);
  drawYard(9, 9, 3);

  for (let c = 0; c < 15; c++) elems.push(square(`hpath-${c}`, c, 7, cell, "#FFFEFA"));
  for (let r = 0; r < 15; r++) elems.push(square(`vpath-${r}`, 7, r, cell, "#FFFEFA"));
  for (let r = 1; r <= 5; r++) elems.push(square(`green-col-${r}`, 7, r, cell, COLORS[1]));
  for (let c = 9; c <= 13; c++) elems.push(square(`yellow-row-${c}`, c, 7, cell, COLORS[3]));
  for (let r = 9; r <= 13; r++) elems.push(square(`blue-col-${r}`, 7, r, cell, COLORS[2]));
  for (let c = 1; c <= 5; c++) elems.push(square(`red-row-${c}`, c, 7, cell, COLORS[0]));

  const cx = 7.5 * cell;
  const cy = 7.5 * cell;
  const left = 6 * cell;
  const right = 9 * cell;
  const top = 6 * cell;
  const bottom = 9 * cell;
  [
    ["green", `M ${left} ${top} L ${right} ${top} L ${cx} ${cy} Z`, COLORS[1]],
    ["yellow", `M ${right} ${top} L ${right} ${bottom} L ${cx} ${cy} Z`, COLORS[3]],
    ["blue", `M ${left} ${bottom} L ${right} ${bottom} L ${cx} ${cy} Z`, COLORS[2]],
    ["red", `M ${left} ${top} L ${left} ${bottom} L ${cx} ${cy} Z`, COLORS[0]],
  ].forEach(([name, d, fill]) =>
    elems.push(<path key={`center-${name}`} d={d} fill={fill} stroke={stroke} strokeWidth={1} />),
  );

  // Entry squares
  elems.push(square("entry-red", 1, 6, cell, COLORS[0]));
  elems.push(square("entry-green", 8, 1, cell, COLORS[1]));
  elems.push(square("entry-blue", 6, 13, cell, COLORS[2]));
  elems.push(square("entry-yellow", 13, 8, cell, COLORS[3]));

  elems.push(safeStar(2, 7, "#FFFEFA", "star-2-7", cell));
  elems.push(safeStar(7, 2, "#FFFEFA", "star-7-2", cell));
  elems.push(safeStar(13, 7, "#FFFEFA", "star-13-7", cell));
  elems.push(safeStar(7, 13, "#FFFEFA", "star-7-13", cell));
  elems.push(safeStar(1, 6, "rgba(255,255,255,0.85)", "star-1-6", cell));
  elems.push(safeStar(8, 1, "rgba(255,255,255,0.85)", "star-8-1", cell));
  elems.push(safeStar(6, 13, "rgba(255,255,255,0.85)", "star-6-13", cell));
  elems.push(safeStar(13, 8, "rgba(255,255,255,0.85)", "star-13-8", cell));

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ display: "block", width: `${size}px`, height: `${size}px` }}
    >
      <rect
        x="0"
        y="0"
        width={size}
        height={size}
        fill="#FAFAF8"
        stroke={BOARD_OUTER_STROKE}
        strokeWidth="2"
        rx="12"
        ry="12"
      />
      {elems}
    </svg>
  );
});
