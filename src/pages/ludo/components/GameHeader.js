import React from "react";

export const GameHeader = ({
  gameStarted,
  playWithComputer,
  gameId,
  savedGameStateRef,
  isDebug,
  isSpecialUser,
  controlMode,
  onStartGame,
  onResetGame,
  onExitGame,
  onTriggerDebugCelebration,
  onToggleControlMode,
  onPlaySound,
}) => {
  const showExit = Boolean(gameId);

  return (
    <header className="ludo-header">
      <div className="ludo-header__brand">
        <div className="ludo-header__mark" aria-hidden="true">
          <div className="ludo-header__mark-grid">
            <span />
            <span />
            <span />
            <span />
          </div>
        </div>
        <div>
          <div className="ludo-header__title">Ludo Classic</div>
          <div className="ludo-header__subtitle">
            {gameStarted
              ? gameId
                ? "Online match"
                : playWithComputer
                  ? "Vs computer"
                  : "Local match"
              : "Ready to play"}
          </div>
        </div>
      </div>
      <div className="ludo-header__actions">
        {!gameStarted ? (
          <>
            <button
              type="button"
              className="ludo-btn ludo-btn--primary"
              onClick={onStartGame}
            >
              <span className="ludo-btn__label">Start</span>
              <span aria-hidden="true">▶</span>
            </button>
            {showExit && (
              <button
                type="button"
                className="ludo-btn ludo-btn--ghost"
                onClick={onExitGame}
                title="Leave the board and resume later"
              >
                <span className="ludo-btn__label">Leave</span>
              </button>
            )}
          </>
        ) : (
          <>
            <button
              type="button"
              className="ludo-btn ludo-btn--danger"
              onClick={onResetGame}
              title="Restart from the beginning"
            >
              <span className="ludo-btn__label">Restart</span>
            </button>
            <button
              type="button"
              className="ludo-btn ludo-btn--ghost"
              onClick={onExitGame}
              title="Leave the board and resume later"
            >
              <span className="ludo-btn__label">Leave</span>
            </button>
          </>
        )}
        {isDebug && (
          <button
            type="button"
            className="ludo-btn ludo-btn--sm ludo-btn--accent"
            onClick={onTriggerDebugCelebration}
            title="Debug: Test celebration"
          >
            Debug
          </button>
        )}
        {(isSpecialUser || isDebug) && (
          <button
            type="button"
            className={`ludo-btn ludo-btn--sm ${controlMode ? "ludo-btn--primary" : "ludo-btn--accent"}`}
            onClick={() => {
              onToggleControlMode();
              onPlaySound("buttonClick");
            }}
            title={
              controlMode
                ? "Disable control mode"
                : "Enable control mode (dice prompts)"
            }
          >
            {controlMode ? "Control On" : "Control"}
          </button>
        )}
      </div>
    </header>
  );
};
