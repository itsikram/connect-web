import config from "../config/config.json";

// Caller-side feedback shared by AudioCall and VideoCall: the ringback tone
// you hear while the other phone rings, and the short labels shown on the
// call screen after a call closes (WhatsApp / Messenger behaviour).

// How long the "Call ended" / "Declined" screen stays up before closing.
export const ENDED_SCREEN_MS = 1500;

let ringbackAudio = null;
let ringbackWanted = false;

export const startRingback = () => {
  if (typeof Audio === "undefined") return;
  const src = config?.callingBeep;
  if (!src) return;
  ringbackWanted = true;
  try {
    if (!ringbackAudio) {
      ringbackAudio = new Audio(src);
      ringbackAudio.loop = true;
      ringbackAudio.preload = "auto";
      ringbackAudio.volume = 0.55;
    }
    ringbackAudio.currentTime = 0;
    const result = ringbackAudio.play();
    if (result?.catch) {
      result
        .then(() => {
          // Stopped while play() was pending.
          if (!ringbackWanted) ringbackAudio?.pause();
        })
        .catch(() => {});
    }
  } catch (_) {}
};

export const stopRingback = () => {
  ringbackWanted = false;
  if (!ringbackAudio) return;
  try {
    ringbackAudio.pause();
    ringbackAudio.currentTime = 0;
  } catch (_) {}
};

export const endedLabelFor = (reason) => {
  switch (reason) {
    case "busy":
      return "On another call";
    case "declined":
    case "rejected":
      return "Declined";
    case "timeout":
    case "no_answer":
      return "No answer";
    case "failed":
      return "Call failed";
    default:
      return "Call ended";
  }
};
