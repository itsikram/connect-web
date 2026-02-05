import React from 'react';

export const PendingInvitesBanner = ({ pendingInvites, onDismissInvite, onAcceptInvite }) => {
    if (pendingInvites.length === 0) return null;

    return (
        <div style={{ padding: '10px 20px', background: 'rgba(26, 35, 50, 0.85)', borderBottom: '1px dashed rgba(255, 215, 0, 0.2)' }}>
            <div style={{ color: '#FFD700', fontWeight: 800, marginBottom: 8 }}>Invitations</div>
            <div style={{ display: 'grid', gap: 8 }}>
                {pendingInvites.map((inv, idx) => (
                    <div key={`${inv.gameId}-${inv.from}-${idx}`} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.04)', padding: 8, borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)' }}>
                        <div style={{ width: 28, height: 28, borderRadius: 14, overflow: 'hidden', background: '#333', border: '2px solid #FFD700' }}>
                            {inv.avatar ? <img src={inv.avatar} alt=" " style={{ width: 28, height: 28, objectFit: 'cover' }} /> : null}
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 700 }}>{inv.name || 'Friend'} invited you</div>
                            <div style={{ color: '#B0B0B0', fontSize: 11 }}>Players: {inv.playerCount} • Slot #{(inv.slotIndex ?? 0) + 1}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={() => onDismissInvite(inv)} style={{ background: 'transparent', color: '#ccc', padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', cursor: 'pointer', fontWeight: 600 }}>Dismiss</button>
                            <button onClick={() => onAcceptInvite(inv)} style={{ background: '#29B1A9', color: 'white', padding: '6px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 800 }}>Accept</button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
