import React, { useMemo } from 'react';
import { COLORS, HOME_POSITIONS } from '../constants/gameConstants';
import { getPositionOnPath } from '../utils/gameLogic';

export const GameBoard = ({ 
    BOARD_SIZE, 
    CELL_SIZE, 
    players, 
    selectedPlayerCount,
    renderPlayerOrder,
    tokenNode
}) => {
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
        const drawHome = (x0, y0, color, idx) => {
            elems.push(<rect key={`home-outer-${x0}-${y0}`} x={x0 * CELL_SIZE} y={y0 * CELL_SIZE} width={CELL_SIZE * 6} height={CELL_SIZE * 6} fill={color} stroke="#000" strokeWidth={2} />);
            const innerX = (x0 + 1) * CELL_SIZE;
            const innerY = (y0 + 1) * CELL_SIZE;
            const innerW = CELL_SIZE * 4;
            const innerH = CELL_SIZE * 4;
            // Background cover image
            const coverUrl = players[idx]?.cover || players[idx]?.cover;
            if (coverUrl && idx < selectedPlayerCount) {
                elems.push((
                    <image key={`home-cover-${x0}-${y0}`} href={coverUrl} x={innerX} y={innerY} width={innerW} height={innerH} preserveAspectRatio="xMidYMid slice" />
                ));
                // Dark overlay over background image for contrast
                elems.push(
                    <rect key={`home-cover-overlay-${x0}-${y0}`} x={innerX} y={innerY} width={innerW} height={innerH} fill="rgba(0,0,0,0.5)" />
                );
                // Border frame over the image
                elems.push(<rect key={`home-inner-border-${x0}-${y0}`} x={innerX} y={innerY} width={innerW} height={innerH} fill="none" stroke="#000" strokeWidth={2} />);
            } else {
                // Fallback white background
                elems.push(<rect key={`home-inner-${x0}-${y0}`} x={innerX} y={innerY} width={innerW} height={innerH} fill="#FFFFFF" stroke="#000" strokeWidth={2} />);
            }
            // four pips
            const cx = (x0 + 1) * CELL_SIZE + CELL_SIZE * 2;
            const cy = (y0 + 1) * CELL_SIZE + CELL_SIZE * 2;
            const pipRadius = CELL_SIZE * 0.30;
            const gap = CELL_SIZE * 0.45; // increase spacing between home placeholders
            const offsets = [[-gap, -gap], [gap, -gap], [-gap, gap], [gap, gap]];
            offsets.forEach((o, i) => {
                elems.push(<circle key={`pip-${x0}-${y0}-${i}`} cx={cx + o[0]} cy={cy + o[1]} r={pipRadius} fill={color} stroke="#000" strokeWidth={2} />);
            });
        };
        drawHome(0, 0, COLORS[0], 0); // red
        drawHome(9, 0, COLORS[1], 1); // green
        drawHome(0, 9, COLORS[2], 2); // blue
        drawHome(9, 9, COLORS[3], 3); // yellow

        // Cross paths - single width
        for (let c = 0; c < 15; c++) {
            elems.push(<rect key={`hpath-${c}`} x={c * CELL_SIZE} y={7 * CELL_SIZE} width={CELL_SIZE} height={CELL_SIZE} fill="#FFFFFF" stroke="#000" strokeWidth={1} />);
        }
        for (let r = 0; r < 15; r++) {
            elems.push(<rect key={`vpath-${r}`} x={7 * CELL_SIZE} y={r * CELL_SIZE} width={CELL_SIZE} height={CELL_SIZE} fill="#FFFFFF" stroke="#000" strokeWidth={1} />);
        }

        const homeLineColor = "gray"

        // Colored home columns (five squares towards center)
        for (let r = 1; r <= 5; r++) elems.push(<rect key={`green-col-${r}`} x={7 * CELL_SIZE} y={r * CELL_SIZE} width={CELL_SIZE} height={CELL_SIZE} fill={COLORS[1]} stroke="#000" strokeWidth={1} />);
        for (let c = 9; c <= 13; c++) elems.push(<rect key={`yellow-row-${c}`} x={c * CELL_SIZE} y={7 * CELL_SIZE} width={CELL_SIZE} height={CELL_SIZE} fill={COLORS[3]} stroke="#000" strokeWidth={1} />);
        for (let r = 9; r <= 12; r++) elems.push(<rect key={`blue-col-${r}`} x={7 * CELL_SIZE} y={r * CELL_SIZE} width={CELL_SIZE} height={CELL_SIZE} fill={COLORS[2]} stroke="#000" strokeWidth={1} />);
        for (let c = 1; c <= 5; c++) elems.push(<rect key={`red-row-${c}`} x={c * CELL_SIZE} y={7 * CELL_SIZE} width={CELL_SIZE} height={CELL_SIZE} fill={COLORS[0]} stroke="#000" strokeWidth={1} />);

        // Center pinwheel across the full 3x3 center (cells 6..8,6..8)
        // Coordinates of the 3x3 center square
        const cx = (7.5) * CELL_SIZE; // center point
        const cy = (7.5) * CELL_SIZE;
        const xLeft = 6 * CELL_SIZE;
        const xRight = 9 * CELL_SIZE;
        const yTop = 6 * CELL_SIZE;
        const yBottom = 9 * CELL_SIZE;
        // Top (green)
        elems.push(<path key="center-tri-green" d={`M ${xLeft} ${yTop} L ${xRight} ${yTop} L ${cx} ${cy} Z`} fill={COLORS[1]} stroke="#000" strokeWidth={1} />);
        // Right (yellow)
        elems.push(<path key="center-tri-yellow" d={`M ${xRight} ${yTop} L ${xRight} ${yBottom} L ${cx} ${cy} Z`} fill={COLORS[3]} stroke="#000" strokeWidth={1} />);
        // Bottom (blue)
        elems.push(<path key="center-tri-blue" d={`M ${xLeft} ${yBottom} L ${xRight} ${yBottom} L ${cx} ${cy} Z`} fill={COLORS[2]} stroke="#000" strokeWidth={1} />);
        // Left (red)
        elems.push(<path key="center-tri-red" d={`M ${xLeft} ${yTop} L ${xLeft} ${yBottom} L ${cx} ${cy} Z`} fill={COLORS[0]} stroke="#000" strokeWidth={1} />);

        // Highlight entry cells for all players
        elems.push(<rect key="highlight-1-6" x={1 * CELL_SIZE} y={6 * CELL_SIZE} width={CELL_SIZE} height={CELL_SIZE} fill={COLORS[0]} stroke="#000" strokeWidth={1} />);   // Red entry
        elems.push(<rect key="highlight-8-1" x={8 * CELL_SIZE} y={1 * CELL_SIZE} width={CELL_SIZE} height={CELL_SIZE} fill={COLORS[1]} stroke="#000" strokeWidth={1} />);   // Green entry
        elems.push(<rect key="highlight-6-13" x={6 * CELL_SIZE} y={13 * CELL_SIZE} width={CELL_SIZE} height={CELL_SIZE} fill={COLORS[2]} stroke="#000" strokeWidth={1} />); // Blue entry
        elems.push(<rect key="highlight-13-8" x={13 * CELL_SIZE} y={8 * CELL_SIZE} width={CELL_SIZE} height={CELL_SIZE} fill={COLORS[3]} stroke="#000" strokeWidth={1} />); // Yellow entry

        // Ensure cell (7,12) is blue
        elems.push(<rect key="force-blue-7-12" x={7 * CELL_SIZE} y={13 * CELL_SIZE} width={CELL_SIZE} height={CELL_SIZE} fill={COLORS[2]} stroke="#000" strokeWidth={1} />);

        return (<>{elems}</>);
    };

    const boardStyle = {
        position: 'relative',
        width: `${BOARD_SIZE}px`,
        height: `${BOARD_SIZE}px`,
        maxWidth: '100%',
        maxHeight: '100%',
        borderRadius: '15px',
        overflow: 'hidden',
        background: '#fff',
        boxShadow: '0 6px 12px rgba(0,0,0,0.4)',
        transform: 'translateZ(0)', // Hardware acceleration
        willChange: 'transform',
        boxSizing: 'border-box'
    };

    return (
        <div style={boardStyle}>
            <svg 
                width={BOARD_SIZE} 
                height={BOARD_SIZE} 
                viewBox={`0 0 ${BOARD_SIZE} ${BOARD_SIZE}`}
                preserveAspectRatio="none"
                style={{ display: 'block', width: `${BOARD_SIZE}px`, height: `${BOARD_SIZE}px` }}
            >
                <rect x="0" y="0" width={BOARD_SIZE} height={BOARD_SIZE} fill="#FFFFFF" stroke="#000000" strokeWidth="2" rx="10" ry="10" />
                {renderBoardGrid()}
                {renderStaticRects()}
            </svg>
            {/* Tokens overlay - positioned absolutely to match SVG coordinates exactly */}
            <div style={{ 
                position: 'absolute', 
                left: 0, 
                top: 0, 
                width: `${BOARD_SIZE}px`, 
                height: `${BOARD_SIZE}px`,
                transform: 'translateZ(0)',
                willChange: 'contents'
            }}>
                {renderPlayerOrder.map((playerIndex) => (
                    players[playerIndex]?.pieces.map((piece, pieceIndex) => tokenNode(playerIndex, pieceIndex, piece))
                ))}
            </div>
        </div>
    );
};
