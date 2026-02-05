import React from 'react';
import { PLAYER_EMOJIS } from '../constants/gameConstants';

export const PlayerEditorModal = ({
    show,
    editingPlayerIndex,
    player,
    editName,
    editAvatarUrl,
    inviteCopied,
    avatarFileInputRef,
    onNameChange,
    onAvatarUrlChange,
    onPickAvatarFile,
    onCopyInviteLink,
    onClose,
    onSave
}) => {
    if (!show || editingPlayerIndex == null || !player) return null;

    return (
        <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 3000 }}>
            <div style={{ width: '100%', maxWidth: 460, background: 'rgba(26, 35, 50, 0.95)', borderRadius: 24, padding: 22, border: `2px solid ${player?.color || 'rgba(255, 215, 0, 0.5)'}`, color: 'white' }}>
                <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Edit Player</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                    <div style={{ width: 56, height: 56, borderRadius: 28, overflow: 'hidden', border: `3px solid ${player?.color || '#FFD700'}`, background: '#222', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {editAvatarUrl ? (
                            <img src={editAvatarUrl} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                            <span style={{ fontSize: 22 }}>{PLAYER_EMOJIS[editingPlayerIndex]}</span>
                        )}
                    </div>
                    <div>
                        <div style={{ fontSize: 12, color: '#B0B0B0' }}>Player #{editingPlayerIndex + 1}</div>
                        <div style={{ fontWeight: 700 }}>{player?.name}</div>
                    </div>
                </div>
                <div style={{ display: 'grid', gap: 10 }}>
                    <input value={editName} onChange={(e) => onNameChange(e.target.value)} placeholder="Enter name" style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.06)', color: 'white' }} />
                    <input value={editAvatarUrl} onChange={(e) => onAvatarUrlChange(e.target.value)} placeholder="Avatar image URL" style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.06)', color: 'white' }} />
                    <div>
                        <input ref={avatarFileInputRef} type="file" accept="image/*" onChange={onPickAvatarFile} style={{ display: 'none' }} />
                        <button onClick={() => avatarFileInputRef.current && avatarFileInputRef.current.click()} style={{ background: '#4444FF', color: 'white', padding: '10px 12px', border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 'bold' }}>Upload Picture</button>
                    </div>
                </div>
                <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px dashed rgba(255,255,255,0.2)' }}>
                    <div style={{ fontWeight: 700, marginBottom: 8 }}>Migrate to another device</div>
                    <button onClick={onCopyInviteLink} style={{ background: '#29B1A9', color: 'white', padding: '10px 12px', border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 'bold' }}>Copy Invite Link</button>
                    {inviteCopied && <span style={{ color: '#B0FFB0', marginLeft: 10 }}>Copied!</span>}
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                    <button onClick={onClose} style={{ flex: 1, background: '#555', color: 'white', padding: '10px 0', border: 'none', borderRadius: 12, cursor: 'pointer', fontWeight: 'bold' }}>Cancel</button>
                    <button onClick={onSave} style={{ flex: 1, background: player?.color || '#00AA00', color: 'white', padding: '10px 0', border: 'none', borderRadius: 12, cursor: 'pointer', fontWeight: 'bold' }}>Save</button>
                </div>
            </div>
        </div>
    );
};
