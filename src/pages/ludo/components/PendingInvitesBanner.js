import React from 'react';

export const PendingInvitesBanner = ({ pendingInvites, onDismissInvite, onAcceptInvite }) => {
    if (pendingInvites.length === 0) return null;

    return (
        <div className="ludo-invites">
            <div className="ludo-invites__title">Invitations</div>
            <div className="ludo-invites__list">
                {pendingInvites.map((inv, idx) => (
                    <div key={`${inv.gameId}-${inv.from}-${idx}`} className="ludo-invite-row">
                        <div className="ludo-invite-row__avatar">
                            {inv.avatar ? <img src={inv.avatar} alt="" /> : null}
                        </div>
                        <div className="ludo-invite-row__meta">
                            <div className="ludo-invite-row__name">{inv.name || 'Friend'} invited you</div>
                            <div className="ludo-invite-row__detail">
                                Players: {inv.playerCount} · Slot #{(inv.slotIndex ?? 0) + 1}
                            </div>
                        </div>
                        <div className="ludo-invite-row__actions">
                            <button
                                type="button"
                                className="ludo-btn ludo-btn--sm ludo-btn--ghost"
                                onClick={() => onDismissInvite(inv)}
                            >
                                Dismiss
                            </button>
                            <button
                                type="button"
                                className="ludo-btn ludo-btn--sm ludo-btn--primary"
                                onClick={() => onAcceptInvite(inv)}
                            >
                                Accept
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
