import React from "react";

export const DICE_LAND_ROTATION = {
  1: { x: 0, y: 0 },
  2: { x: -90, y: 0 },
  3: { x: 0, y: -90 },
  4: { x: 0, y: 90 },
  5: { x: 90, y: 0 },
  6: { x: 0, y: 180 },
};

const PIP_CELLS = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

const DiceFace = ({ value, strokeColor }) => (
  <div
    className="ludo-dice3d__face"
    style={{ borderColor: strokeColor }}
    aria-hidden="true"
  >
    {Array.from({ length: 9 }).map((_, idx) => (
      <span
        key={idx}
        className={`ludo-dice3d__pip ${PIP_CELLS[value]?.includes(idx) ? "is-on" : ""}`}
      />
    ))}
  </div>
);

export const DiceSVG = ({ value, size = 80, strokeColor = "#2ec4b6" }) => {
  const pipR = 7;
  const scaleFactor = 0.78;
  const pip = (cx, cy, key) => (
    <circle key={key} cx={cx} cy={cy} r={pipR} fill="#1a2330" />
  );
  const positions = {
    1: [[50, 50]],
    2: [
      [30, 30],
      [70, 70],
    ],
    3: [
      [30, 30],
      [50, 50],
      [70, 70],
    ],
    4: [
      [30, 30],
      [70, 30],
      [30, 70],
      [70, 70],
    ],
    5: [
      [30, 30],
      [70, 30],
      [50, 50],
      [30, 70],
      [70, 70],
    ],
    6: [
      [30, 25],
      [70, 25],
      [30, 50],
      [70, 50],
      [30, 75],
      [70, 75],
    ],
  };
  const pts = value && positions[value] ? positions[value] : [];
  const gradId = `diceGrad-${String(strokeColor).replace("#", "")}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      style={{
        display: "block",
        filter: "drop-shadow(0 8px 14px rgba(0,0,0,0.4))",
      }}
      aria-label={value ? `Dice showing ${value}` : "Dice"}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#e8ecf0" />
        </linearGradient>
      </defs>
      <g transform={`translate(50,50) scale(${scaleFactor}) translate(-50,-50)`}>
        <rect
          x="5"
          y="5"
          width="90"
          height="90"
          rx="18"
          ry="18"
          fill={`url(#${gradId})`}
          stroke={strokeColor}
          strokeWidth="4"
        />
        {pts.map(([x, y], idx) => pip(x, y, idx))}
      </g>
    </svg>
  );
};

export const Dice3D = ({
  value = 1,
  size = 80,
  strokeColor = "#2ec4b6",
  rolling = false,
  rotation = { x: 0, y: 0, z: 0 },
  durationMs = 900,
}) => {
  const half = Math.round(size / 2);
  const faces = [
    { n: 1, transform: `rotateY(0deg) translateZ(${half}px)` },
    { n: 2, transform: `rotateX(90deg) translateZ(${half}px)` },
    { n: 3, transform: `rotateY(90deg) translateZ(${half}px)` },
    { n: 4, transform: `rotateY(-90deg) translateZ(${half}px)` },
    { n: 5, transform: `rotateX(-90deg) translateZ(${half}px)` },
    { n: 6, transform: `rotateY(180deg) translateZ(${half}px)` },
  ];

  return (
    <div
      className={`ludo-dice3d ${rolling ? "is-rolling" : ""}`}
      style={{
        width: size,
        height: size,
        "--dice-size": `${size}px`,
        "--dice-roll-ms": `${durationMs}ms`,
      }}
      aria-label={value ? `Dice showing ${value}` : "Dice"}
    >
      <div className="ludo-dice3d__shadow" />
      <div
        className="ludo-dice3d__tumble"
        style={{
          animationDuration: rolling ? `${durationMs}ms` : "0ms",
        }}
      >
        <div
          className="ludo-dice3d__cube"
          style={{
            transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg) rotateZ(${rotation.z}deg)`,
            transitionDuration: rolling ? `${durationMs}ms` : "180ms",
          }}
        >
          {faces.map((face) => (
            <div
              key={face.n}
              className="ludo-dice3d__side"
              style={{ transform: face.transform }}
            >
              <DiceFace value={face.n} strokeColor={strokeColor} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
