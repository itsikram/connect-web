import React from 'react';
import { COLORS, PLAYER_LETTERS } from '../constants/gameConstants';

export const PlayerSelectionModal = ({
    show,
    selectedPlayerCount,
    onlineMode,
    playWithComputer,
    friendSearchQuery,
    loadingSearch,
    searchResults,
    friendList,
    selectedFriends,
    invitedStatusByFriendId,
    players,
    myProfile,
    joinedGames,
    inviteCopied,
    incomingInvite,
    socketRef,
    onPlayerCountChange,
    onOnlineModeToggle,
    onPlayWithComputerToggle,
    onFriendSearchChange,
    onFriendSelect,
    onInviteFriend,
    onAssignFriendOffline,
    onGetNextOpenSlot,
    onGetInvitedNameForSlot,
    onOpenPlayerEditor,
    onCopyInviteLink,
    onPlaySound,
    onCancel,
    onConfirmPlayerCount,
    onJoinGame
}) => {
    if (!show) return null;

    const getNextOpenSlot = onGetNextOpenSlot || (() => {
        const max = Math.max(2, Math.min(4, selectedPlayerCount));
        for (let i = 1; i < max; i++) {
            const p = players[i];
            if (!p) return i;
            if (!p.profileId) return i;
        }
        return null;
    });

    const getInvitedNameForSlot = onGetInvitedNameForSlot || (() => null);

    return (
        <div className="ludo-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="ludo-select-title">
            <div className="ludo-modal">
                <div id="ludo-select-title" className="ludo-modal__title">Select Players</div>
                <div className="ludo-modal__subtitle">Choose how many will join this match</div>

                {[2, 3, 4].map(count => (
                    <button
                        key={count}
                        type="button"
                        className={`ludo-choice ${selectedPlayerCount === count ? 'ludo-choice--active' : ''}`}
                        onClick={() => onPlayerCountChange(count)}
                    >
                        <div>
                            <div className="ludo-choice__count">{count}</div>
                            <div className="ludo-choice__label">
                                {count === 2 ? 'Two Players' : count === 3 ? 'Three Players' : 'Four Players'}
                            </div>
                        </div>
                        <div className="ludo-choice__dots">
                            {[0, 1, 3, 2].slice(0, count).map((idx) => (
                                <span key={idx} className="ludo-choice__dot" style={{ background: COLORS[idx] }} />
                            ))}
                        </div>
                    </button>
                ))}

                <div style={{ marginTop: 8, marginBottom: 4 }}>
                    <div className="ludo-toggle-row">
                        <div className="ludo-section-title" style={{ marginBottom: 0 }}>Play with Computer</div>
                        <button
                            type="button"
                            className={`ludo-btn ludo-btn--sm ${playWithComputer ? 'ludo-btn--primary' : 'ludo-btn--ghost'}`}
                            onClick={() => { onPlaySound('buttonClick'); onPlayWithComputerToggle(); }}
                        >
                            {playWithComputer ? 'On' : 'Off'}
                        </button>
                    </div>
                    {playWithComputer && (
                        <div className="ludo-muted" style={{ marginBottom: 8 }}>
                            Empty seats are filled by CPU opponents. You play as the first seat.
                        </div>
                    )}

                    <div className="ludo-toggle-row">
                        <div className="ludo-section-title" style={{ marginBottom: 0 }}>Play Online with Friends</div>
                        <button
                            type="button"
                            className={`ludo-btn ludo-btn--sm ${onlineMode ? 'ludo-btn--primary' : 'ludo-btn--ghost'}`}
                            onClick={onOnlineModeToggle}
                            disabled={playWithComputer}
                        >
                            {onlineMode ? 'On' : 'Off'}
                        </button>
                    </div>

                    <div className="ludo-search">
                        <span aria-hidden="true" style={{ color: 'var(--ludo-muted)', fontSize: 14 }}>⌕</span>
                        <input
                            placeholder="Search friends by name..."
                            value={friendSearchQuery}
                            onChange={(e) => onFriendSearchChange(e.target.value)}
                            aria-label="Search friends"
                        />
                    </div>

                    <div className="ludo-friend-list">
                        {loadingSearch && <div className="ludo-muted" style={{ marginTop: 6 }}>Searching…</div>}
                        {(friendSearchQuery ? searchResults : friendList).map((f) => {
                            const key = f?._id || String(f?.id) || Math.random().toString(36);
                            const isSelected = selectedFriends.some(sf => sf._id === f._id);
                            const inviteStatus = invitedStatusByFriendId[f?._id];
                            const maxPlayers = Math.max(2, Math.min(4, selectedPlayerCount));
                            const isAssignedOffline = !onlineMode && players.slice(1, maxPlayers).some(p => p?.profileId && String(p.profileId) === String(f?._id));
                            const canAction = onlineMode ? (!inviteStatus && getNextOpenSlot() != null) : (!isAssignedOffline && getNextOpenSlot() != null);
                            return (
                                <div
                                    key={key}
                                    className="ludo-friend"
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => onFriendSelect(f, isSelected)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            onFriendSelect(f, isSelected);
                                        }
                                    }}
                                >
                                    <div className="ludo-friend__left">
                                        <div className="ludo-friend__avatar">
                                            {f?.profilePic ? <img src={f.profilePic} alt="" /> : null}
                                        </div>
                                        <div className="ludo-friend__name">{f?.fullName || 'Unknown'}</div>
                                    </div>
                                    <div className="ludo-friend__right">
                                        <span className={`ludo-check ${isSelected ? 'ludo-check--on' : ''}`} aria-hidden="true" />
                                        <button
                                            type="button"
                                            className="ludo-btn ludo-btn--sm ludo-btn--primary"
                                            onClick={(e) => { e.stopPropagation(); onlineMode ? onInviteFriend(f) : onAssignFriendOffline(f); }}
                                            disabled={!canAction}
                                        >
                                            {onlineMode
                                                ? (inviteStatus === 'joined' ? 'Joined' : inviteStatus === 'invited' ? 'Invited' : 'Invite')
                                                : (isAssignedOffline ? 'Assigned' : 'Add')}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <div className="ludo-muted" style={{ marginTop: 6 }}>
                        Selected: {selectedFriends.length} / {Math.max(0, selectedPlayerCount - 1)}
                    </div>

                    {onlineMode && (
                        <div style={{ marginTop: 12 }}>
                            <div className="ludo-section-title">Seat status</div>
                            <div className="ludo-seat-list">
                                {Array.from({ length: Math.max(2, Math.min(4, selectedPlayerCount)) }).map((_, i) => {
                                    const seat = players[i];
                                    const joined = i === 0 ? Boolean(seat?.profileId || myProfile?._id) : Boolean(seat?.profileId);
                                    const name = seat?.name || (i === 0 ? (myProfile?.fullName || 'You') : `Seat ${i + 1}`);
                                    const invitedName = !joined ? getInvitedNameForSlot(i) : null;
                                    return (
                                        <div key={`preseat-${i}`} className="ludo-seat">
                                            <div className="ludo-seat__avatar">
                                                {seat?.avatar
                                                    ? <img src={seat.avatar} alt="" />
                                                    : <span>{PLAYER_LETTERS[i] || 'P'}</span>}
                                            </div>
                                            <div className="ludo-seat__name">{name}</div>
                                            <div className={`ludo-seat__badge ${joined ? 'ludo-seat__badge--joined' : 'ludo-seat__badge--waiting'}`}>
                                                {joined ? 'Joined' : (invitedName ? `Invited: ${invitedName}` : 'Waiting…')}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {onlineMode && joinedGames.length > 0 && (
                    <div style={{ marginTop: 16 }}>
                        <div className="ludo-toggle-row">
                            <div className="ludo-section-title" style={{ marginBottom: 0 }}>Your Active Games</div>
                            <button
                                type="button"
                                className="ludo-btn ludo-btn--sm ludo-btn--ghost"
                                onClick={() => socketRef?.current?.emit('ludo:games:get')}
                            >
                                Refresh
                            </button>
                        </div>
                        <div className="ludo-seat-list" style={{ maxHeight: 200, overflow: 'auto' }}>
                            {joinedGames.map((game) => {
                                const gameStatus = game.lastPlayers?.gameStarted
                                    ? (game.lastPlayers?.winner ? 'Finished' : 'In Progress')
                                    : 'Waiting';
                                return (
                                    <button
                                        key={game.gameId}
                                        type="button"
                                        className="ludo-seat"
                                        onClick={() => onJoinGame(game)}
                                        style={{ cursor: 'pointer', width: '100%', color: 'inherit' }}
                                    >
                                        <div className="ludo-seat__avatar" style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #2ec4b6, #3ec6ff)' }}>
                                            <span style={{ fontSize: 12, fontWeight: 800, color: '#06241f' }}>L</span>
                                        </div>
                                        <div className="ludo-seat__name" style={{ whiteSpace: 'normal' }}>
                                            <div style={{ fontWeight: 700 }}>Game #{game.gameId?.slice(-6) || 'Unknown'}</div>
                                            <div className="ludo-muted">{game.playerCount} Players · {gameStatus}</div>
                                        </div>
                                        <div className={`ludo-seat__badge ${game.isOnline ? 'ludo-seat__badge--joined' : 'ludo-seat__badge--waiting'}`}>
                                            {game.isOnline ? 'Online' : 'Offline'}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                <div style={{ marginTop: 12 }}>
                    <div className="ludo-section-title">Customize Players</div>
                    <div className="ludo-players-row">
                        {[0, 1, 3, 2].slice(0, selectedPlayerCount).map((idx) => (
                            <button
                                key={`preedit-${idx}`}
                                type="button"
                                className="ludo-player-chip"
                                style={{ background: players[idx]?.color }}
                                onClick={() => onOpenPlayerEditor(idx)}
                                title={players[idx]?.name || 'Player'}
                                aria-label={`Edit ${players[idx]?.name || 'player'}`}
                            >
                                {players[idx]?.avatar ? (
                                    <img src={players[idx].avatar} alt="" />
                                ) : (
                                    <span className="ludo-player-chip__letter">{PLAYER_LETTERS[idx] || 'P'}</span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="ludo-divider">
                    <div className="ludo-section-title">Continue on another device</div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <button
                            type="button"
                            className="ludo-btn ludo-btn--accent"
                            onClick={() => { onPlaySound('buttonClick'); onCopyInviteLink(); }}
                        >
                            Copy Invite Link
                        </button>
                        {inviteCopied && <span style={{ color: 'var(--ludo-success)', fontWeight: 700, fontSize: 13 }}>Copied!</span>}
                    </div>
                    {incomingInvite && (
                        <div className="ludo-muted" style={{ marginTop: 8 }}>
                            Invite detected from {incomingInvite?.name}. Start the game to continue on this device.
                        </div>
                    )}
                </div>

                <div className="ludo-modal-actions">
                    <button type="button" className="ludo-btn ludo-btn--danger" onClick={onCancel}>Cancel</button>
                    <button
                        type="button"
                        className="ludo-btn ludo-btn--primary"
                        onClick={() => { onPlaySound('buttonClick'); onConfirmPlayerCount(); }}
                    >
                        Start Game
                    </button>
                </div>
            </div>
        </div>
    );
};
