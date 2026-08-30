import React from 'react';
import { useNavigate } from 'react-router-dom';
import { WinnerConfetti } from './WinnerConfetti';
import { openCreatePost } from '../../../utils/openComposer';

export const WinnerModal = ({ winner, gameEnded, onContinueGame, onEndGame }) => {
    const navigate = useNavigate();
    if (!winner) return null;

    return (
        <div className="ludo-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="ludo-winner-title">
            <div className="ludo-winner-modal">
                <WinnerConfetti />
                <div className="ludo-winner-card">
                    <div style={{ position: 'relative', marginBottom: 8 }}>
                        <div
                            className="ludo-winner-glow"
                            style={{ background: winner?.color || 'var(--ludo-accent)' }}
                        />
                        <div className="ludo-winner-trophy" aria-hidden="true">🏆</div>
                    </div>
                    <div id="ludo-winner-title" className="ludo-winner-title">{winner?.name} Wins!</div>
                    <div className="ludo-muted" style={{ marginBottom: 18, fontSize: '0.9rem' }}>
                        Congratulations on your victory!
                    </div>
                    <div className="ludo-modal-actions" style={{ marginTop: 0 }}>
                        {!gameEnded && (
                            <button
                                type="button"
                                className="ludo-btn ludo-btn--primary"
                                style={{ background: winner?.color || undefined, color: '#06241f' }}
                                onClick={onContinueGame}
                            >
                                Continue Game
                            </button>
                        )}
                        <button type="button" className="ludo-btn ludo-btn--danger" onClick={onEndGame}>
                            End Game
                        </button>
                        <button
                            type="button"
                            className="ludo-btn ludo-btn--primary"
                            onClick={() =>
                                openCreatePost({
                                    caption: `${winner?.name || 'I'} just won a Ludo match on Connect!`,
                                    audience: 1,
                                    navigate,
                                })
                            }
                        >
                            Share win
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
