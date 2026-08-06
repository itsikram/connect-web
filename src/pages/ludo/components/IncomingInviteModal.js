import React from 'react';

export const IncomingInviteModal = ({ inviteRequest, onAccept, onDecline }) => {
    if (!inviteRequest) return null;

    return (
        <div className="ludo-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="ludo-invite-title">
            <div className="ludo-modal" style={{ maxWidth: 400 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                    <div className="ludo-seat__avatar" style={{ width: 52, height: 52, borderColor: 'var(--ludo-accent)', borderWidth: 2 }}>
                        {inviteRequest.avatar ? (
                            <img src={inviteRequest.avatar} alt="" />
                        ) : (
                            <span style={{ fontSize: 18, fontWeight: 800 }}>L</span>
                        )}
                    </div>
                    <div>
                        <div id="ludo-invite-title" className="ludo-card__title" style={{ textAlign: 'left', marginBottom: 2 }}>
                            Game Invite
                        </div>
                        <div className="ludo-muted" style={{ textAlign: 'left' }}>
                            {inviteRequest.name || 'A friend'} invited you to play Ludo
                        </div>
                    </div>
                </div>
                <div className="ludo-muted" style={{ marginBottom: 14, textAlign: 'left' }}>
                    Players: {inviteRequest.playerCount} · Slot #{(inviteRequest.slotIndex ?? 0) + 1}
                </div>
                <div className="ludo-modal-actions" style={{ marginTop: 0 }}>
                    <button type="button" className="ludo-btn ludo-btn--ghost" onClick={onDecline}>Decline</button>
                    <button type="button" className="ludo-btn ludo-btn--primary" onClick={onAccept}>Accept</button>
                </div>
            </div>
        </div>
    );
};
