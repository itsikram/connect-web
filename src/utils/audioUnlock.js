/**
 * Audio Unlock Utility
 *
 * iOS Safari / Home Screen PWAs start Web Audio suspended and only resume it
 * inside a real user gesture. Creating a new AudioContext per sound (and
 * awaiting before resume) loses that gesture and the beep never plays.
 *
 * Ludo SFX use a shared context (AudioBufferSource) plus an HTMLAudio fallback
 * because oscillator nodes are unreliable in standalone iOS PWAs.
 */

let audioUnlocked = false;
let audioContext = null;
let unlockAudioElement = null;
let unlockInFlight = null;
let gestureListenersBound = false;
let htmlPlayersAttached = false;

const htmlPlayers = [];
const wavCache = new Map();
const HTML_PLAYER_POOL = 6;

const GESTURE_EVENTS = [
  "touchstart",
  "touchend",
  "pointerdown",
  "mousedown",
  "click",
  "keydown",
];

const writeAscii = (view, offset, string) => {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
};

const encodeWavPcm = (samples, sampleRate) => {
  const dataSize = samples.length * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, dataSize, true);
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
  }
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return `data:audio/wav;base64,${btoa(binary)}`;
};

const synthesizeSamples = (frequency, duration, volume, type, sampleRate) => {
  const length = Math.max(1, Math.floor(sampleRate * duration));
  const samples = new Float32Array(length);
  const fade = Math.min(Math.floor(length * 0.1), 400);
  const safeVolume = Math.max(0.05, Math.min(0.9, Number(volume) || 0.35));
  for (let i = 0; i < length; i++) {
    let env = 1;
    if (i < fade) env = i / fade;
    else if (i > length - fade) env = (length - i) / fade;
    const phase = (2 * Math.PI * frequency * i) / sampleRate;
    const wave =
      type === "square"
        ? Math.sin(phase) >= 0
          ? 1
          : -1
        : Math.sin(phase);
    samples[i] = wave * safeVolume * env;
  }
  return samples;
};

const getBeepWav = (frequency, duration, volume, type) => {
  const key = `${frequency}|${duration}|${volume}|${type}`;
  const cached = wavCache.get(key);
  if (cached) return cached;
  const uri = encodeWavPcm(
    synthesizeSamples(frequency, duration, volume, type, 22050),
    22050,
  );
  wavCache.set(key, uri);
  return uri;
};

const attachMediaElement = (audio) => {
  if (typeof document === "undefined" || !audio || audio.isConnected) return;
  audio.setAttribute(
    "style",
    "position:fixed;width:1px;height:1px;opacity:0.01;pointer-events:none;left:0;bottom:0;",
  );
  (document.body || document.documentElement).appendChild(audio);
};

const ensureHtmlUnlockElement = () => {
  if (typeof document === "undefined") return null;
  if (unlockAudioElement) {
    attachMediaElement(unlockAudioElement);
    return unlockAudioElement;
  }
  const audio = document.createElement("audio");
  audio.preload = "auto";
  audio.setAttribute("playsinline", "true");
  audio.setAttribute("webkit-playsinline", "true");
  audio.setAttribute("x-webkit-airplay", "deny");
  audio.playsInline = true;
  audio.muted = false;
  audio.loop = false;
  audio.volume = 0.05;
  audio.src = getBeepWav(880, 0.05, 0.04, "sine");
  unlockAudioElement = audio;
  attachMediaElement(audio);
  return audio;
};

const getHtmlPlayer = () => {
  if (typeof document === "undefined") return null;
  let player = htmlPlayers.find((item) => item.paused || item.ended);
  if (!player) {
    if (htmlPlayers.length >= HTML_PLAYER_POOL) {
      player = htmlPlayers[htmlPlayers.length % HTML_PLAYER_POOL];
    } else {
      player = document.createElement("audio");
      player.preload = "auto";
      player.setAttribute("playsinline", "true");
      player.setAttribute("webkit-playsinline", "true");
      player.playsInline = true;
      player.muted = false;
      htmlPlayers.push(player);
      attachMediaElement(player);
    }
  }
  htmlPlayersAttached = true;
  return player;
};

const playHtmlBeep = (frequency, duration, volume, type) => {
  const player = getHtmlPlayer();
  if (!player) return Promise.resolve();
  try {
    player.pause();
  } catch (_e) {}
  player.muted = false;
  player.volume = 1;
  player.src = getBeepWav(frequency, duration, volume, type);
  try {
    player.currentTime = 0;
  } catch (_e) {}
  const playPromise = player.play();
  if (!playPromise || typeof playPromise.then !== "function") {
    return Promise.resolve();
  }
  return playPromise.catch(() => {});
};

const createSineBuffer = (context, frequency, duration, volume, type) => {
  const sampleRate = context.sampleRate || 22050;
  const samples = synthesizeSamples(frequency, duration, volume, type, sampleRate);
  const buffer = context.createBuffer(1, samples.length, sampleRate);
  try {
    if (typeof buffer.copyToChannel === "function") {
      buffer.copyToChannel(samples, 0);
    } else {
      buffer.getChannelData(0).set(samples);
    }
  } catch (_e) {
    buffer.getChannelData(0).set(samples);
  }
  return buffer;
};

const primeSilentBuffer = (context) => {
  if (!context) return;
  try {
    const buffer = context.createBuffer(1, 1, context.sampleRate || 22050);
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    source.start(0);
  } catch (_e) {}
};

export const getAudioContext = () => {
  if (typeof window === "undefined") return null;
  if (audioContext && audioContext.state === "closed") {
    audioContext = null;
  }
  if (!audioContext) {
    try {
      const AudioContextClass =
        window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return null;
      audioContext = new AudioContextClass();
    } catch (error) {
      console.warn("Web Audio API not available:", error);
      return null;
    }
  }
  return audioContext;
};

export const resumeAudioFromGesture = () => {
  const context = getAudioContext();
  ensureHtmlUnlockElement();
  if (!htmlPlayersAttached) {
    getHtmlPlayer();
  }
  if (!context) return context;
  if (context.state === "suspended" || context.state === "interrupted") {
    context
      .resume()
      .then(() => {
        audioUnlocked = true;
        primeSilentBuffer(context);
      })
      .catch(() => {});
  } else if (context.state === "running") {
    audioUnlocked = true;
  }
  return context;
};

const playHtmlUnlock = () => {
  const audio = ensureHtmlUnlockElement();
  if (!audio) return Promise.resolve();
  audio.muted = false;
  try {
    audio.currentTime = 0;
  } catch (_e) {}
  const playPromise = audio.play();
  if (!playPromise || typeof playPromise.then !== "function") {
    return Promise.resolve();
  }
  return playPromise.catch(() => {});
};

export const unlockAudio = () => {
  resumeAudioFromGesture();
  const context = getAudioContext();
  if (audioUnlocked && context && context.state === "running") {
    return Promise.resolve();
  }
  if (unlockInFlight) return unlockInFlight;

  unlockInFlight = (async () => {
    try {
      const ctx = resumeAudioFromGesture();
      if (ctx && (ctx.state === "suspended" || ctx.state === "interrupted")) {
        await ctx.resume();
      }
      primeSilentBuffer(ctx);
      await playHtmlUnlock();
      if (ctx && ctx.state === "running") {
        audioUnlocked = true;
      }
    } catch (error) {
      console.warn("Audio unlock failed:", error);
    } finally {
      unlockInFlight = null;
    }
  })();

  return unlockInFlight;
};

export const playTone = ({
  frequency = 440,
  duration = 0.15,
  type = "sine",
  volume = 0.35,
} = {}) => {
  const context = resumeAudioFromGesture();
  const htmlPlay = () => playHtmlBeep(frequency, duration, volume, type);

  const startWebAudio = () => {
    if (!context || context.state !== "running") {
      return htmlPlay();
    }
    try {
      const source = context.createBufferSource();
      source.buffer = createSineBuffer(
        context,
        frequency,
        duration,
        volume,
        type === "square" ? "square" : "sine",
      );
      source.connect(context.destination);
      source.start(0);
      return Promise.resolve();
    } catch (_e) {
      return htmlPlay();
    }
  };

  if (context && context.state === "running") {
    return startWebAudio();
  }

  const htmlPromise = htmlPlay();
  if (context) {
    context.resume().catch(() => {});
  }
  return htmlPromise;
};

export const initializeAudioUnlock = () => {
  if (typeof document === "undefined" || gestureListenersBound) return;
  gestureListenersBound = true;

  const unlockOnInteraction = () => {
    resumeAudioFromGesture();
    unlockAudio();
  };

  GESTURE_EVENTS.forEach((eventName) => {
    document.addEventListener(eventName, unlockOnInteraction, {
      capture: true,
      passive: true,
    });
  });

  const resumeIfVisible = () => {
    if (typeof document !== "undefined" && document.visibilityState === "hidden") {
      return;
    }
    resumeAudioFromGesture();
  };

  document.addEventListener("visibilitychange", resumeIfVisible);
  window.addEventListener("pageshow", resumeIfVisible);
  window.addEventListener("focus", resumeIfVisible);
};

export const isAudioUnlocked = () => audioUnlocked;

export const playAudioWithWebAudio = async (audioElement) => {
  const context = getAudioContext();
  if (!context) {
    return audioElement.play();
  }

  try {
    resumeAudioFromGesture();
    if (context.state === "suspended" || context.state === "interrupted") {
      await context.resume();
    }
    return audioElement.play();
  } catch (error) {
    console.warn(
      "Web Audio context resume failed, falling back to regular audio:",
      error,
    );
    return audioElement.play();
  }
};

if (typeof window !== "undefined") {
  initializeAudioUnlock();
}
