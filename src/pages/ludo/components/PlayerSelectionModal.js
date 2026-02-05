import React from 'react';
import { COLORS } from '../constants/gameConstants';

export const PlayerSelectionModal = ({
    show,
    selectedPlayerCount,
    onlineMode,
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
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.8)', padding: 20, position: 'fixed', inset: 0, zIndex: 2000, overflowY: 'auto' }}>
            <div style={{ width: '100%', maxWidth: 420, maxHeight: '85vh', overflowY: 'auto', WebkitOverflowScrolling: 'touch', background: 'rgba(26, 35, 50, 0.95)', borderRadius: 24, padding: 28, border: '1px solid rgba(255, 215, 0, 0.3)', color: 'white' }}>
                <div style={{ textAlign: 'center', marginBottom: 20 }}>
                    <div style={{ fontSize: 32, color: '#FFD700', fontWeight: 'bold' }}>Select Players</div>
                    <div style={{ color: '#B0B0B0' }}>Choose how many players will join the game</div>
                </div>
                <div>
                    {[2, 3, 4].map(count => (
                        <button key={count} onClick={() => onPlayerCountChange(count)} style={{
                            width: '100%',
                            textAlign: 'left',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 12,
                            padding: 16,
                            marginBottom: 12,
                            background: selectedPlayerCount === count ? 'rgba(42, 26, 58, 0.9)' : 'rgba(42, 42, 42, 0.8)',
                            border: `2px solid ${selectedPlayerCount === count ? '#FFD700' : 'transparent'}`,
                            borderRadius: 16,
                            color: 'white',
                            cursor: 'pointer'
                        }}>
                            <div>
                                <div style={{ fontWeight: 'bold', color: selectedPlayerCount === count ? '#FFD700' : '#B0B0B0' }}>{count}</div>
                                <div style={{ color: selectedPlayerCount === count ? 'white' : '#B0B0B0' }}>{count === 2 ? 'Two Players' : count === 3 ? 'Three Players' : 'Four Players'}</div>
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                                {[0, 1, 3, 2].slice(0, count).map((idx) => (
                                    <div key={idx} style={{ width: 20, height: 20, borderRadius: 10, background: COLORS[idx], border: '2px solid #fff' }} />
                                ))}
                            </div>
                        </button>
                    ))}
                </div>
                {/* Online toggle and friend picker */}
                <div style={{ marginTop: 8, marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <div style={{ fontWeight: 700 }}>Play Online with Friends</div>
                        <button onClick={onOnlineModeToggle} style={{ padding: '6px 12px', borderRadius: 16, background: onlineMode ? '#29B1A9' : 'rgba(255,255,255,0.1)', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 600 }}>{onlineMode ? 'On' : 'Off'}</button>
                    </div>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid rgba(255,255,255,0.2)', borderRadius: 10, padding: '8px 10px' }}>
                            <span role="img" aria-label="search">🔎</span>
                            <input
                                placeholder="Search friends by name..."
                                value={friendSearchQuery}
                                onChange={(e) => onFriendSearchChange(e.target.value)}
                                style={{ flex: 1, background: 'transparent', color: 'white', border: 'none', outline: 'none' }}
                            />
                        </div>
                        <div style={{ maxHeight: 220, overflow: 'auto', marginTop: 8 }}>
                            {loadingSearch && <div style={{ color: '#B0B0B0', fontSize: 12, marginTop: 6 }}>Searching...</div>}
                            {(friendSearchQuery ? searchResults : friendList).map((f) => {
                                const key = f?._id || String(f?.id) || Math.random().toString(36);
                                const isSelected = selectedFriends.some(sf => sf._id === f._id);
                                const inviteStatus = invitedStatusByFriendId[f?._id];
                                const maxPlayers = Math.max(2, Math.min(4, selectedPlayerCount));
                                const isAssignedOffline = !onlineMode && players.slice(1, maxPlayers).some(p => p?.profileId && String(p.profileId) === String(f?._id));
                                const canAction = onlineMode ? (!inviteStatus && getNextOpenSlot() != null) : (!isAssignedOffline && getNextOpenSlot() != null);
                                return (
                                    <div key={key} onClick={() => {
                                        onFriendSelect(f, isSelected);
                                    }} role="button" tabIndex={0} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'transparent', border: 'none', color: 'white', padding: '8px 0', cursor: 'pointer' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <div style={{ width: 28, height: 28, borderRadius: 14, overflow: 'hidden', background: '#333' }}>
                                                {f?.profilePic ? <img src={f.profilePic} alt=" " style={{ width: 28, height: 28, objectFit: 'cover' }} /> : null}
                                            </div>
                                            <div style={{ fontSize: 14 }}>{f?.fullName || 'Unknown'}</div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <span>{isSelected ? '✅' : '⭕'}</span>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onlineMode ? onInviteFriend(f) : onAssignFriendOffline(f); }}
                                                disabled={!canAction}
                                                style={{ padding: '4px 8px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)', background: onlineMode ? (inviteStatus ? 'rgba(255,255,255,0.1)' : '#29B1A9') : (isAssignedOffline ? 'rgba(255,255,255,0.1)' : '#29B1A9'), color: 'white', cursor: canAction ? 'pointer' : 'default', fontSize: 12 }}
                                            >
                                                {onlineMode ? (inviteStatus === 'joined' ? 'Joined' : inviteStatus === 'invited' ? 'Invited' : 'Invite') : (isAssignedOffline ? 'Assigned' : 'Add')}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <div style={{ color: '#B0B0B0', fontSize: 12, marginTop: 6 }}>Selected: {selectedFriends.length} / {Math.max(0, selectedPlayerCount - 1)}</div>
                        {onlineMode && (
                            <div style={{ marginTop: 10 }}>
                                <div style={{ fontWeight: 700, marginBottom: 6 }}>Seat status</div>
                                <div style={{ display: 'grid', gap: 6 }}>
                                    {Array.from({ length: Math.max(2, Math.min(4, selectedPlayerCount)) }).map((_, i) => {
                                        const seat = players[i];
                                        const joined = i === 0 ? Boolean(seat?.profileId || myProfile?._id) : Boolean(seat?.profileId);
                                        const name = seat?.name || (i === 0 ? (myProfile?.fullName || 'You') : `Seat ${i + 1}`);
                                        const invitedName = !joined ? getInvitedNameForSlot(i) : null;
                                        return (
                                            <div key={`preseat-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.04)', padding: '6px 8px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)' }}>
                                                <div style={{ width: 20, height: 20, borderRadius: 10, overflow: 'hidden', background: '#333', border: '2px solid #111', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    {seat?.avatar ? <img src={seat.avatar} alt=" " style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 10 }}>{['R', 'G', 'Y', 'B'][i] || 'P'}</span>}
                                                </div>
                                                <div style={{ fontSize: 12, flex: 1, textAlign: 'left' }}>{name}</div>
                                                <div style={{ fontSize: 11, fontWeight: 700, color: joined ? '#B0FFB0' : '#FFD700' }}>{joined ? 'Joined' : (invitedName ? `Invited: ${invitedName}` : 'Waiting…')}</div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Joined Games Section */}
                {onlineMode && joinedGames.length > 0 && (
                    <div style={{ marginTop: 16, marginBottom: 12 }}>
                        <div style={{ fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span>Your Active Games</span>
                            <button 
                                onClick={() => socketRef?.current?.emit('ludo:games:get')}
                                style={{ 
                                    padding: '4px 8px', 
                                    borderRadius: 8, 
                                    background: 'rgba(255,255,255,0.1)', 
                                    color: 'white', 
                                    border: '1px solid rgba(255,255,255,0.2)', 
                                    cursor: 'pointer',
                                    fontSize: 12
                                }}
                            >
                                Refresh
                            </button>
                        </div>
                        <div style={{ display: 'grid', gap: 8, maxHeight: 200, overflow: 'auto' }}>
                            {joinedGames.map((game) => {
                                const gamePlayers = game.lastPlayers?.players || [];
                                const myPlayerData = gamePlayers.find(p => p.profileId === myProfile?._id);
                                const gameStatus = game.lastPlayers?.gameStarted ? (game.lastPlayers?.winner ? 'Finished' : 'In Progress') : 'Waiting';
                                const statusColor = gameStatus === 'Finished' ? '#FFD700' : gameStatus === 'In Progress' ? '#B0FFB0' : '#FFB0B0';
                                
                                return (
                                    <div 
                                        key={game.gameId}
                                        onClick={() => onJoinGame(game)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 10,
                                            padding: '10px',
                                            background: 'rgba(255,255,255,0.05)',
                                            border: '1px solid rgba(255,255,255,0.1)',
                                            borderRadius: 8,
                                            cursor: 'pointer',
                                            transition: 'all 0.2s ease'
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                                            e.currentTarget.style.transform = 'translateY(-1px)';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                                            e.currentTarget.style.transform = 'translateY(0)';
                                        }}
                                    >
                                        <div style={{
                                            width: 40,
                                            height: 40,
                                            borderRadius: 8,
                                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: 20
                                        }}>
                                            🎲
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>
                                                Game #{game.gameId?.slice(-6) || 'Unknown'}
                                            </div>
                                            <div style={{ fontSize: 12, color: '#B0B0B0', marginBottom: 2 }}>
                                                {game.playerCount} Players • {gameStatus}
                                            </div>
                                            <div style={{ fontSize: 11, color: statusColor, fontWeight: 600 }}>
                                                {game.isOnline ? '🟢 Online' : '⚫ Offline'}
                                            </div>
                                        </div>
                                        <div style={{
                                            width: 8,
                                            height: 8,
                                            borderRadius: '50%',
                                            background: game.isOnline ? '#00FF00' : '#666666'
                                        }} />
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Offline/General: quick customize players before starting */}
                <div style={{ marginTop: 10 }}>
                    <div style={{ fontWeight: 700, marginBottom: 8 }}>Customize Players</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {[0, 1, 3, 2].slice(0, selectedPlayerCount).map((idx) => (
                            <button key={`preedit-${idx}`} onClick={() => onOpenPlayerEditor(idx)} title={players[idx]?.name || 'Player'} style={{
                                width: 36,
                                height: 36,
                                borderRadius: 18,
                                background: players[idx]?.color,
                                border: '2px solid #222',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
                            }} aria-label={`Edit ${players[idx]?.name || 'player'}`}>
                                {players[idx]?.avatar ? (
                                    <img src={players[idx].avatar} alt=" " style={{ width: 28, height: 28, borderRadius: 14, objectFit: 'cover', border: '2px solid #fff' }} />
                                ) : (
                                    <span style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>{['R', 'G', 'Y', 'B'][idx] || 'P'}</span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
                {/* Migrate to another device via invite link */}
                <div style={{ marginTop: 4, paddingTop: 10, borderTop: '1px dashed rgba(255,255,255,0.2)' }}>
                    <div style={{ marginBottom: 8, fontWeight: 700 }}>Migrate to another device</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => { onPlaySound('buttonClick'); onCopyInviteLink(); }} style={{ background: '#4444FF', color: 'white', padding: '10px 12px', border: 'none', borderRadius: 12, cursor: 'pointer', fontWeight: 'bold' }}>Copy Invite Link</button>
                        {inviteCopied && <span style={{ color: '#B0FFB0', alignSelf: 'center' }}>Copied!</span>}
                    </div>
                    {incomingInvite && (
                        <div style={{ marginTop: 8, color: '#B0B0B0', fontSize: 12 }}>Invite detected from {incomingInvite?.name}. Start the game to continue on this device.</div>
                    )}
                </div>
                <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
                    <button onClick={onCancel} style={{ flex: 1, background: '#FF4444', color: 'white', padding: '12px 0', border: 'none', borderRadius: 20, cursor: 'pointer', fontWeight: 'bold' }}>Cancel</button>
                    <button onClick={() => { onPlaySound('buttonClick'); onConfirmPlayerCount(); }} style={{ flex: 1, background: '#00AA00', color: 'white', padding: '12px 0', border: 'none', borderRadius: 20, cursor: 'pointer', fontWeight: 'bold' }}>Start Game</button>
                </div>
            </div>
        </div>
    );
};
