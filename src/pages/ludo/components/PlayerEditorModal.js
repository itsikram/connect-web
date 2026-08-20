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
    onSave,
    // New props for searching and assigning users
    friendSearchQuery,
    loadingSearch,
    searchResults,
    friendList,
    onFriendSearchChange,
    onAssignFriendToSlot,
    onPlaySound,
}) => {
    if (!show || editingPlayerIndex == null || !player) return null;

    const visibleFriends = friendSearchQuery ? (searchResults || []) : (friendList || []);

    console.log('friendSearchQuery', friendSearchQuery)

    return (
        <div className="ludo-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="ludo-edit-title" style={{ zIndex: 3201 }}>
            <div className="ludo-modal" style={{ borderColor: player?.color || 'var(--ludo-border-strong)', zIndex: 3202 }}>
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

                {/* New: Search & pick users from app to populate this seat */}
                <div className="ludo-divider">
                    <div className="ludo-section-title">Pick a user from Connect</div>
                    <div className="ludo-search" style={{ marginTop: 8 }}>
                        <span aria-hidden="true" className="ludo-search__icon">⌕</span>
                        <input
                            placeholder="Search users by name..."
                            value={friendSearchQuery || ''}
                            onChange={(e) => {
                                onFriendSearchChange && onFriendSearchChange(e.target.value);
                            }}
                            aria-label="Search users"
                        />
                    </div>

                    <div style={{ marginTop: 10 }}>
                        {loadingSearch && (
                            <div className="ludo-empty">
                                <span className="ludo-empty__spinner" aria-hidden="true" />
                                Searching…
                            </div>
                        )}

                        {!loadingSearch && visibleFriends.length === 0 && (
                            <div className="ludo-empty">{friendSearchQuery ? 'No users match your search' : 'No users to show'}</div>
                        )}

                        <div className="ludo-friend-list" style={{ maxHeight: 200, overflow: 'auto', marginTop: 6 }}>
                            {visibleFriends.map((f) => {
                                const key = f?._id || String(f?.id) || Math.random().toString(36);
                                const initial = (f?.fullName || '?').trim().charAt(0).toUpperCase();
                                return (
                                    <div key={key} className="ludo-friend" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <div className="ludo-friend__avatar" style={{ width: 36, height: 36, borderRadius: 8, overflow: 'hidden' }}>
                                                {f?.profilePic ? <img src={f.profilePic} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#eee' }}>{initial}</div>}
                                            </div>
                                            <div style={{ minWidth: 120 }}>{f?.fullName || 'Unknown'}</div>
                                        </div>
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <button
                                                type="button"
                                                className="ludo-btn ludo-btn--sm ludo-btn--ghost"
                                                onClick={() => {
                                                    // Preview: set name and avatar in editor fields
                                                    onNameChange && onNameChange(f.fullName || '');
                                                    onAvatarUrlChange && onAvatarUrlChange(f.profilePic || '');
                                                    onPlaySound && onPlaySound('buttonClick');
                                                }}
                                            >
                                                Use
                                            </button>
                                            <button
                                                type="button"
                                                className="ludo-btn ludo-btn--sm ludo-btn--primary"
                                                onClick={() => {
                                                    onPlaySound && onPlaySound('buttonClick');
                                                    if (onAssignFriendToSlot) onAssignFriendToSlot(f, editingPlayerIndex);
                                                    // close editor after assign
                                                    onClose && onClose();
                                                }}
                                            >
                                                Assign to seat
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
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
