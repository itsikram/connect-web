import React from 'react';
import { PLAYER_EMOJIS, PLAYER_LETTERS } from '../constants/gameConstants';

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
        <div className="ludo-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="ludo-edit-title">
            <div className="ludo-modal" style={{ borderColor: player?.color || 'var(--ludo-border-strong)' }}>
                <div id="ludo-edit-title" className="ludo-section-title" style={{ fontSize: '1.1rem', marginBottom: 14 }}>
                    Edit Player
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                    <div
                        className="ludo-seat__avatar"
                        style={{
                            width: 56,
                            height: 56,
                            borderColor: player?.color || 'var(--ludo-accent)',
                            borderWidth: 3,
                        }}
                    >
                        {editAvatarUrl ? (
                            <img src={editAvatarUrl} alt="preview" />
                        ) : (
                            <span style={{ fontSize: 20 }}>{PLAYER_LETTERS[editingPlayerIndex] || PLAYER_EMOJIS[editingPlayerIndex]}</span>
                        )}
                    </div>
                    <div>
                        <div className="ludo-muted">Player #{editingPlayerIndex + 1}</div>
                        <div style={{ fontWeight: 700 }}>{player?.name}</div>
                    </div>
                </div>
                <div style={{ display: 'grid', gap: 10 }}>
                    <input
                        className="ludo-field"
                        value={editName}
                        onChange={(e) => onNameChange(e.target.value)}
                        placeholder="Enter name"
                        aria-label="Player name"
                    />
                    <input
                        className="ludo-field"
                        value={editAvatarUrl}
                        onChange={(e) => onAvatarUrlChange(e.target.value)}
                        placeholder="Avatar image URL"
                        aria-label="Avatar URL"
                    />
                    <div>
                        <input
                            ref={avatarFileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={onPickAvatarFile}
                            style={{ display: 'none' }}
                        />
                        <button
                            type="button"
                            className="ludo-btn ludo-btn--accent"
                            onClick={() => avatarFileInputRef.current && avatarFileInputRef.current.click()}
                        >
                            Upload Picture
                        </button>
                    </div>
                </div>
                <div className="ludo-divider">
                    <div className="ludo-section-title">Continue on another device</div>
                    <button type="button" className="ludo-btn ludo-btn--primary" onClick={onCopyInviteLink}>
                        Copy Invite Link
                    </button>
                    {inviteCopied && <span style={{ color: 'var(--ludo-success)', marginLeft: 10, fontWeight: 700 }}>Copied!</span>}
                </div>
                <div className="ludo-modal-actions">
                    <button type="button" className="ludo-btn ludo-btn--ghost" onClick={onClose}>Cancel</button>
                    <button
                        type="button"
                        className="ludo-btn ludo-btn--primary"
                        style={{ background: player?.color || undefined, color: '#06241f' }}
                        onClick={onSave}
                    >
                        Save
                    </button>
                </div>
            </div>
        </div>
    );
};
