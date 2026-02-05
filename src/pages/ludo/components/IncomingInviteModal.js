import React from 'react';

export const IncomingInviteModal = ({ inviteRequest, onAccept, onDecline }) => {
    if (!inviteRequest) return null;

    return (
        <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 3000 }}>
            <div style={{ width: '100%', maxWidth: 420, background: 'rgba(26, 35, 50, 0.95)', borderRadius: 24, padding: 22, border: '2px solid rgba(255, 215, 0, 0.5)', color: 'white' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                    <div style={{ width: 48, height: 48, borderRadius: 24, overflow: 'hidden', background: '#222', border: '2px solid #FFD700', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {inviteRequest.avatar ? (
                            <img src={inviteRequest.avatar} alt="inviter" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                            <span>🎲</span>
                        )}
                    </div>
                    <div>
                        <div style={{ fontWeight: 800, fontSize: 16 }}>Game Invite</div>
                        <div style={{ color: '#B0B0B0', fontSize: 13 }}>{inviteRequest.name || 'A friend'} invited you to play Ludo</div>
                    </div>
                </div>
                <div style={{ color: '#B0B0B0', fontSize: 12, marginBottom: 12 }}>Players: {inviteRequest.playerCount} • Slot #{(inviteRequest.slotIndex ?? 0) + 1}</div>
                <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={onDecline} style={{ flex: 1, background: '#555', color: 'white', padding: '10px 0', border: 'none', borderRadius: 12, cursor: 'pointer', fontWeight: 'bold' }}>Decline</button>
                    <button onClick={onAccept} style={{ flex: 1, background: '#29B1A9', color: 'white', padding: '10px 0', border: 'none', borderRadius: 12, cursor: 'pointer', fontWeight: 'bold' }}>Accept</button>
                </div>
            </div>
        </div>
    );
};
