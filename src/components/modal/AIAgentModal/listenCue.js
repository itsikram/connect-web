// The "your turn" chime the Connect app plays before its microphone opens.
// Loaded once and replayed, so it starts at once; played to the end before
// listening starts, so it is never transcribed.
const LISTEN_CUE_URL = `${process.env.PUBLIC_URL || ""}/sounds/agent-listen-start.wav`;
// The chime is ~340 ms; never hold the mic longer than this.
const MAX_CUE_MS = 700;

let cue = null;

const getCue = () => {
  if (typeof Audio === "undefined") return null;
  if (!cue) {
    cue = new Audio(LISTEN_CUE_URL);
    cue.preload = "auto";
    cue.volume = 1;
  }
  return cue;
};

/** Starts loading the chime (call when the agent opens). */
export const preloadListenCue = () => {
  try {
    getCue()?.load();
  } catch (_) {}
};

/** Vibrates briefly and plays the chime; resolves when it has finished. */
export const playListenCue = () => {
  try {
    navigator.vibrate?.(30);
  } catch (_) {}
  const sound = getCue();
  if (!sound) return Promise.resolve();
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      sound.removeEventListener("ended", finish);
      resolve();
    };
    const timer = setTimeout(finish, MAX_CUE_MS);
    sound.addEventListener("ended", finish);
    try {
      sound.currentTime = 0;
      const playing = sound.play();
      if (playing?.catch) playing.catch(finish);
    } catch (_) {
      finish();
    }
  });
};
