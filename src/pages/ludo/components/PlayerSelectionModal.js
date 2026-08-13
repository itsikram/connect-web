import React from "react";
import { COLORS, PLAYER_LETTERS } from "../constants/gameConstants";

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
  onJoinGame,
  onDeleteLiveGame,
}) => {
  if (!show) return null;

  const getNextOpenSlot =
    onGetNextOpenSlot ||
    (() => {
      const max = Math.max(2, Math.min(4, selectedPlayerCount));
      for (let i = 1; i < max; i++) {
        const p = players[i];
        if (!p) return i;
        if (!p.profileId) return i;
      }
      return null;
    });

  const getInvitedNameForSlot = onGetInvitedNameForSlot || (() => null);

  const maxFriendSlots = Math.max(0, selectedPlayerCount - 1);
  const friendProgressPct =
    maxFriendSlots > 0
      ? Math.min(
          100,
          Math.round((selectedFriends.length / maxFriendSlots) * 100),
        )
      : 0;

  const visibleFriends = friendSearchQuery ? searchResults : friendList;

  const click =
    (fn) =>
    (...args) => {
      onPlaySound("buttonClick");
      fn && fn(...args);
    };

  return (
    <div
      className="ludo-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ludo-select-title"
    >
      <div className="ludo-modal ludo-modal--player-select">
        <button
          type="button"
          className="ludo-modal__close"
          onClick={onCancel}
          aria-label="Close"
        >
          <span aria-hidden="true">&times;</span>
        </button>

        <div className="ludo-modal__header">
          <div className="ludo-modal__icon" aria-hidden="true">
            🎲
          </div>
          <div id="ludo-select-title" className="ludo-modal__title">
            Start New Game
          </div>
          <div className="ludo-modal__subtitle">
            Set up your players and game mode to begin
          </div>
        </div>

        <div className="ludo-modal__body">
          <section className="ludo-modal__section">
            <div className="ludo-section-title">Number of Players</div>
            <div className="ludo-choice-grid">
              {[2, 3, 4].map((count) => {
                const active = selectedPlayerCount === count;
                return (
                  <button
                    key={count}
                    type="button"
                    className={`ludo-choice ${active ? "ludo-choice--active" : ""}`}
                    onClick={click(() => onPlayerCountChange(count))}
                    aria-pressed={active}
                  >
                    {active && (
                      <span className="ludo-choice__check" aria-hidden="true">
                        ✓
                      </span>
                    )}
                    <div className="ludo-choice__dots">
                      {[0, 1, 3, 2].slice(0, count).map((idx) => (
                        <span
                          key={idx}
                          className="ludo-choice__dot"
                          style={{ background: COLORS[idx] }}
                        />
                      ))}
                    </div>
                    <div className="ludo-choice__count">{count}</div>
                    <div className="ludo-choice__label">Players</div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="ludo-modal__section">
            <div className="ludo-section-title">Game Mode</div>
            <div className="ludo-mode-list">
              <div className="ludo-mode-row">
                <div className="ludo-mode-row__info">
                  <span className="ludo-mode-row__icon" aria-hidden="true">
                    🤖
                  </span>
                  <div>
                    <div className="ludo-mode-row__title">
                      Play with Computer
                    </div>
                    <div className="ludo-mode-row__desc">
                      Empty seats are filled by CPU opponents
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={playWithComputer}
                  aria-label="Toggle play with computer"
                  className={`ludo-switch ${playWithComputer ? "ludo-switch--on" : ""}`}
                  onClick={click(onPlayWithComputerToggle)}
                >
                  <span className="ludo-switch__thumb" />
                </button>
              </div>

              <div className="ludo-mode-row">
                <div className="ludo-mode-row__info">
                  <span className="ludo-mode-row__icon" aria-hidden="true">
                    🌐
                  </span>
                  <div>
                    <div className="ludo-mode-row__title">
                      Play Online with Friends
                    </div>
                    <div className="ludo-mode-row__desc">
                      Invite friends to join remotely
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={onlineMode}
                  aria-label="Toggle online mode"
                  className={`ludo-switch ${onlineMode ? "ludo-switch--on" : ""}`}
                  onClick={onOnlineModeToggle}
                  disabled={playWithComputer}
                >
                  <span className="ludo-switch__thumb" />
                </button>
              </div>
            </div>
          </section>

          {onlineMode && (
            <section className="ludo-modal__section">
              <div className="ludo-section-title">Invite Friends</div>

              <div className="ludo-search">
                <span aria-hidden="true" className="ludo-search__icon">
                  ⌕
                </span>
                <input
                  placeholder="Search friends by name..."
                  value={friendSearchQuery}
                  onChange={(e) => onFriendSearchChange(e.target.value)}
                  aria-label="Search friends"
                />
              </div>

              <div className="ludo-friend-list">
                {loadingSearch && (
                  <div className="ludo-empty">
                    <span className="ludo-empty__spinner" aria-hidden="true" />
                    Searching…
                  </div>
                )}
                {!loadingSearch && visibleFriends.length === 0 && (
                  <div className="ludo-empty">
                    {friendSearchQuery
                      ? "No friends match your search"
                      : "No friends to show yet"}
                  </div>
                )}
                {visibleFriends.map((f) => {
                  const key =
                    f?._id || String(f?.id) || Math.random().toString(36);
                  const isSelected = selectedFriends.some(
                    (sf) => sf._id === f._id,
                  );
                  const inviteStatus = invitedStatusByFriendId[f?._id];
                  const maxPlayers = Math.max(
                    2,
                    Math.min(4, selectedPlayerCount),
                  );
                  const isAssignedOffline =
                    !onlineMode &&
                    players
                      .slice(1, maxPlayers)
                      .some(
                        (p) =>
                          p?.profileId &&
                          String(p.profileId) === String(f?._id),
                      );
                  const canAction = onlineMode
                    ? !inviteStatus && getNextOpenSlot() != null
                    : !isAssignedOffline && getNextOpenSlot() != null;
                  const initial = (f?.fullName || "?")
                    .trim()
                    .charAt(0)
                    .toUpperCase();
                  return (
                    <div
                      key={key}
                      className={`ludo-friend ${isSelected ? "ludo-friend--selected" : ""}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => onFriendSelect(f, isSelected)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onFriendSelect(f, isSelected);
                        }
                      }}
                    >
                      <div className="ludo-friend__left">
                        <div className="ludo-friend__avatar">
                          {f?.profilePic ? (
                            <img src={f.profilePic} alt="" />
                          ) : (
                            <span className="ludo-friend__avatar-fallback">
                              {initial}
                            </span>
                          )}
                        </div>
                        <div className="ludo-friend__name">
                          {f?.fullName || "Unknown"}
                        </div>
                      </div>
                      <div className="ludo-friend__right">
                        <span
                          className={`ludo-check ${isSelected ? "ludo-check--on" : ""}`}
                          aria-hidden="true"
                        />
                        <button
                          type="button"
                          className={`ludo-btn ludo-btn--sm ${inviteStatus === "joined" ? "ludo-btn--ghost" : "ludo-btn--primary"}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onPlaySound("buttonClick");
                            onlineMode
                              ? onInviteFriend(f)
                              : onAssignFriendOffline(f);
                          }}
                          disabled={!canAction}
                        >
                          {onlineMode
                            ? inviteStatus === "joined"
                              ? "Joined ✓"
                              : inviteStatus === "invited"
                                ? "Invited"
                                : "Invite"
                            : isAssignedOffline
                              ? "Added ✓"
                              : "Add"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="ludo-progress">
                <div className="ludo-progress__label">
                  <span>Friends selected</span>
                  <span>
                    {selectedFriends.length} / {maxFriendSlots}
                  </span>
                </div>
                <div className="ludo-progress__track">
                  <div
                    className="ludo-progress__fill"
                    style={{ width: `${friendProgressPct}%` }}
                  />
                </div>
              </div>

              <div className="ludo-seat-section">
                <div className="ludo-section-title ludo-section-title--sm">
                  Seat Status
                </div>
                <div className="ludo-seat-list">
                  {Array.from({
                    length: Math.max(2, Math.min(4, selectedPlayerCount)),
                  }).map((_, i) => {
                    const seat = players[i];
                    const joined =
                      i === 0
                        ? Boolean(seat?.profileId || myProfile?._id)
                        : Boolean(seat?.profileId);
                    const name =
                      seat?.name ||
                      (i === 0
                        ? myProfile?.fullName || "You"
                        : `Seat ${i + 1}`);
                    const invitedName = !joined
                      ? getInvitedNameForSlot(i)
                      : null;
                    return (
                      <div key={`preseat-${i}`} className="ludo-seat">
                        <div className="ludo-seat__avatar">
                          {seat?.avatar ? (
                            <img src={seat.avatar} alt="" />
                          ) : (
                            <span>{PLAYER_LETTERS[i] || "P"}</span>
                          )}
                        </div>
                        <div className="ludo-seat__name">{name}</div>
                        <div
                          className={`ludo-seat__badge ${joined ? "ludo-seat__badge--joined" : "ludo-seat__badge--waiting"}`}
                        >
                          {joined
                            ? "Joined"
                            : invitedName
                              ? `Invited: ${invitedName}`
                              : "Waiting…"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          )}

          {onlineMode && joinedGames.length > 0 && (
            <section className="ludo-modal__section">
              <div className="ludo-toggle-row">
                <div className="ludo-section-title" style={{ marginBottom: 0 }}>
                  Your Active Games
                </div>
                <button
                  type="button"
                  className="ludo-btn ludo-btn--sm ludo-btn--ghost"
                  onClick={() => socketRef?.current?.emit("ludo:games:get")}
                >
                  Refresh
                </button>
              </div>
              <div
                className="ludo-seat-list"
                style={{ maxHeight: 200, overflow: "auto" }}
              >
                {joinedGames.map((game) => {
                  const gameStatus = game.lastPlayers?.gameStarted
                    ? game.lastPlayers?.winner
                      ? "Finished"
                      : "In Progress"
                    : "Waiting";
                  const isHost =
                    game?.lastPlayers?.players?.[0]?.profileId &&
                    myProfile?._id &&
                    String(game.lastPlayers.players[0].profileId) ===
                      String(myProfile._id);
                  return (
                    <div
                      key={game.gameId}
                      className="ludo-seat"
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => onJoinGame(game)}
                        style={{
                          cursor: "pointer",
                          width: "100%",
                          color: "inherit",
                          background: "transparent",
                          border: 0,
                          padding: 0,
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          textAlign: "left",
                        }}
                      >
                        <div
                          className="ludo-seat__avatar"
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 10,
                            background:
                              "linear-gradient(135deg, #2ec4b6, #3ec6ff)",
                          }}
                        >
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 800,
                              color: "#06241f",
                            }}
                          >
                            L
                          </span>
                        </div>
                        <div
                          className="ludo-seat__name"
                          style={{ whiteSpace: "normal", flex: 1 }}
                        >
                          <div style={{ fontWeight: 700 }}>
                            Game #{game.gameId?.slice(-6) || "Unknown"}
                          </div>
                          <div className="ludo-muted">
                            {game.playerCount} Players · {gameStatus}
                          </div>
                        </div>
                        <div
                          className={`ludo-seat__badge ${game.isOnline ? "ludo-seat__badge--joined" : "ludo-seat__badge--waiting"}`}
                        >
                          {game.isOnline ? "Online" : "Offline"}
                        </div>
                      </button>
                      {isHost && onDeleteLiveGame ? (
                        <button
                          type="button"
                          className="ludo-btn ludo-btn--sm ludo-btn--ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            onPlaySound("buttonClick");
                            onDeleteLiveGame(game);
                          }}
                          style={{ color: "#ff6b6b", borderColor: "rgba(255,107,107,0.35)" }}
                        >
                          Delete
                        </button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          <section className="ludo-modal__section">
            <div className="ludo-section-title">Customize Players</div>
            <div
              className="ludo-muted"
              style={{ marginTop: -6, marginBottom: 10 }}
            >
              Tap an avatar to edit its name, photo, or color.
            </div>
            <div className="ludo-players-row">
              {[0, 1, 3, 2].slice(0, selectedPlayerCount).map((idx) => (
                <button
                  key={`preedit-${idx}`}
                  type="button"
                  className="ludo-player-chip"
                  style={{ background: players[idx]?.color }}
                  onClick={() => onOpenPlayerEditor(idx)}
                  title={players[idx]?.name || "Player"}
                  aria-label={`Edit ${players[idx]?.name || "player"}`}
                >
                  {players[idx]?.avatar ? (
                    <img src={players[idx].avatar} alt="" />
                  ) : (
                    <span className="ludo-player-chip__letter">
                      {PLAYER_LETTERS[idx] || "P"}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </section>

          <section className="ludo-modal__section ludo-modal__section--last">
            <div className="ludo-invite-card">
              <div className="ludo-invite-card__icon" aria-hidden="true">
                🔗
              </div>
              <div className="ludo-invite-card__body">
                <div className="ludo-invite-card__title">
                  Continue on another device
                </div>
                <div className="ludo-muted">
                  Copy this link and open it on your phone or another browser.
                </div>
              </div>
              <button
                type="button"
                className={`ludo-btn ludo-btn--sm ${inviteCopied ? "ludo-btn--primary" : "ludo-btn--accent"}`}
                onClick={click(onCopyInviteLink)}
              >
                {inviteCopied ? "Copied ✓" : "Copy Link"}
              </button>
            </div>
            {incomingInvite && (
              <div className="ludo-muted" style={{ marginTop: 8 }}>
                Invite detected from {incomingInvite?.name}. Start the game to
                continue on this device.
              </div>
            )}
          </section>
        </div>

        <div className="ludo-modal-actions ludo-modal-actions--sticky">
          <button
            type="button"
            className="ludo-btn ludo-btn--ghost"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="ludo-btn ludo-btn--primary ludo-btn--lg"
            onClick={click(onConfirmPlayerCount)}
          >
            Start Game
          </button>
        </div>
      </div>
    </div>
  );
};
