import React from 'react';

export const DiceSVG = ({ value, size = 80, strokeColor = '#2ec4b6' }) => {
    const pipR = 7;
    const scaleFactor = 0.78;
    const pip = (cx, cy, key) => (
        <circle key={key} cx={cx} cy={cy} r={pipR} fill="#1a2330" />
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
    const gradId = `diceGrad-${String(strokeColor).replace('#', '')}`;

    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 100 100"
            style={{ display: 'block', filter: 'drop-shadow(0 8px 14px rgba(0,0,0,0.4))' }}
            aria-label={value ? `Dice showing ${value}` : 'Dice'}
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
