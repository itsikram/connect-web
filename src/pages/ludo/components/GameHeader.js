import React from "react";
import { LudoIcon } from "./LudoIcon";

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
  gameEnded,
  gamePaused,
  pauseDisabled,
  onPauseGame,
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
              title="Start a new game"
              aria-label="Start a new game"
            >
              <LudoIcon name="play" className="ludo-btn__icon" />
              <span className="ludo-btn__label">Start</span>
            </button>
            {showExit && (
              <button
                type="button"
                className="ludo-btn ludo-btn--ghost"
                onClick={onExitGame}
                title="Leave this game"
                aria-label="Leave this game"
              >
                <LudoIcon name="leave" className="ludo-btn__icon" />
                <span className="ludo-btn__label">Leave</span>
              </button>
            )}
          </>
        ) : (
          <>
            {onPauseGame && !gameEnded && !gamePaused && (
              <button
                type="button"
                className="ludo-btn ludo-btn--accent"
                onClick={onPauseGame}
                disabled={pauseDisabled}
                title="Pause and save this game to finish later"
                aria-label="Pause and save this game"
                data-testid="ludo-pause"
              >
                <LudoIcon name="pause" className="ludo-btn__icon" />
                <span className="ludo-btn__label">Pause</span>
              </button>
            )}
            <button
              type="button"
              className="ludo-btn ludo-btn--danger"
              onClick={onResetGame}
              title="Restart from the beginning"
              aria-label="Restart from the beginning"
            >
              <LudoIcon name="restart" className="ludo-btn__icon" />
              <span className="ludo-btn__label">Restart</span>
            </button>
            <button
              type="button"
              className="ludo-btn ludo-btn--ghost"
              onClick={onExitGame}
              title="Leave this game"
              aria-label="Leave this game"
            >
              <LudoIcon name="leave" className="ludo-btn__icon" />
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
            aria-label="Test celebration"
          >
            <LudoIcon name="bug" className="ludo-btn__icon" />
            <span className="ludo-btn__label">Debug</span>
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
            aria-label={
              controlMode ? "Disable control mode" : "Enable control mode"
            }
          >
            <LudoIcon name="controls" className="ludo-btn__icon" />
            <span className="ludo-btn__label">
              {controlMode ? "Control On" : "Control"}
            </span>
          </button>
        )}
      </div>
    </header>
  );
};
