import React from 'react';
import { PLAYER_EMOJIS, PLAYER_LETTERS } from '../constants/gameConstants';

export const GameEndedScreen = ({ winners, onResetGame }) => {
    return (
        <div className="ludo-ended" style={{ background: 'transparent' }}>
            <div className="ludo-ended__inner">
                <div className="ludo-ended__trophy" aria-hidden="true">🏆</div>
                <div className="ludo-ended__title">Game Complete!</div>
                <div className="ludo-muted" style={{ marginBottom: 22, fontSize: '0.95rem' }}>
                    All players have finished!
                </div>
                <div>
                    {winners.map((w, i) => (
                        <div key={w.id} className="ludo-ended__row" style={{ background: w.color }}>
                            <div>#{i + 1}</div>
                            <div style={{ flex: 1, textAlign: 'left' }}>{w.name}</div>
                            <div aria-hidden="true">{PLAYER_LETTERS[w.id] || PLAYER_EMOJIS[w.id]}</div>
                        </div>
                    ))}
                </div>
                <button
                    type="button"
                    className="ludo-btn ludo-btn--primary"
                    style={{ marginTop: 18, minWidth: 160 }}
                    onClick={onResetGame}
                >
                    Play Again
                </button>
            </div>
        </div>
    );
};
