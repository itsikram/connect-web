import React from "react";

/**
 * Shown over the board while a match is paused. The server keeps the game
 * (and every seat) saved; any player in it can resume, and everyone can save
 * and exit and pick the game up later from "Your games".
 */
export const PausedOverlay = ({
  pause,
  isMine,
  canResume,
  onlineMode,
  resumeDenied,
  onResume,
  onSaveAndExit,
}) => {
  if (!pause) return null;
  const who = isMine ? "You" : pause.name || "A player";
  const subtitle = onlineMode
    ? canResume
      ? "Everyone's progress is saved. Resume when you're all ready."
      : "Progress is saved. A player resumes the match."
    : "Your progress is saved. Resume any time.";

  return (
    <div
      className="ludo-paused"
      role="dialog"
      aria-modal="false"
      aria-labelledby="ludo-paused-title"
      data-testid="ludo-paused"
    >
      <div className="ludo-paused__card">
        <div className="ludo-paused__icon" aria-hidden="true">
          ⏸
        </div>
        <div id="ludo-paused-title" className="ludo-paused__title">
          Game paused
        </div>
        <div className="ludo-paused__by">
          {pause.pending ? "Pausing…" : `${who} paused the game`}
        </div>
        <div className="ludo-paused__copy">{subtitle}</div>
        {resumeDenied ? (
          <div className="ludo-paused__note">You can't resume this game.</div>
        ) : null}
        <div className="ludo-paused__actions">
          {canResume ? (
            <button
              type="button"
              className="ludo-btn ludo-btn--primary"
              onClick={onResume}
              disabled={Boolean(pause.pending)}
            >
              ▶ Resume
            </button>
          ) : (
            <div className="ludo-paused__waiting">Waiting for a player to resume…</div>
          )}
          <button
            type="button"
            className="ludo-btn ludo-btn--ghost"
            onClick={onSaveAndExit}
          >
            Save & exit
          </button>
        </div>
      </div>
    </div>
  );
};
