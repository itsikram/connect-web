/**
 * Cartoon sound effects for Ludo.
 *
 * Every effect is rendered into an AudioBuffer from raw samples and played
 * through an AudioBufferSource on the shared context, because oscillator
 * nodes are unreliable in standalone iOS PWAs (see utils/audioUnlock.js).
 * Buffers are cached per variant so a sound is synthesized only once.
 */
import { getAudioContext, resumeAudioFromGesture, playTone } from "../../../utils/audioUnlock";

const TWO_PI = Math.PI * 2;
const VARIANTS = 3;
const bufferCache = new Map();

const clamp = (v) => (v > 1 ? 1 : v < -1 ? -1 : v);
const noteHz = (semitonesFromA4) => 440 * Math.pow(2, semitonesFromA4 / 12);

// Attack/release envelope, t and dur in seconds.
const env = (t, dur, attack = 0.005, release = 0.05) => {
  if (t < 0 || t > dur) return 0;
  if (t < attack) return t / attack;
  if (t > dur - release) return Math.max(0, (dur - t) / release);
  return 1;
};

const wave = (shape, phase) => {
  const p = phase % 1;
  switch (shape) {
    case "square":
      return p < 0.5 ? 0.6 : -0.6;
    case "saw":
      return (2 * p - 1) * 0.7;
    case "triangle":
      return 1 - 4 * Math.abs(p - 0.5);
    default:
      return Math.sin(TWO_PI * p);
  }
};

/**
 * A voice is a tone whose pitch follows freq(t). Phase is integrated so pitch
 * sweeps (slide whistles, boings) stay smooth.
 */
const addVoice = (out, sr, { start = 0, dur, freq, shape = "sine", gain = 0.5, attack, release }) => {
  const s0 = Math.floor(start * sr);
  const n = Math.floor(dur * sr);
  let phase = 0;
  for (let i = 0; i < n && s0 + i < out.length; i++) {
    const t = i / sr;
    phase += freq(t, dur) / sr;
    out[s0 + i] += wave(shape, phase) * gain * env(t, dur, attack, release);
  }
};

// Short burst of low-passed noise: rattles, thuds, crowd hiss.
const addNoise = (out, sr, { start = 0, dur, gain = 0.4, smooth = 0.5, decay = 30 }) => {
  const s0 = Math.floor(start * sr);
  const n = Math.floor(dur * sr);
  let last = 0;
  for (let i = 0; i < n && s0 + i < out.length; i++) {
    const t = i / sr;
    last = last * smooth + (Math.random() * 2 - 1) * (1 - smooth);
    out[s0 + i] += last * gain * Math.exp(-t * decay) * env(t, dur, 0.002, 0.02);
  }
};

const jitter = (amount) => 1 + (Math.random() * 2 - 1) * amount;

const RECIPES = {
  // Dice clattering in a cup, then landing with a clack.
  diceRoll: (out, sr) => {
    let t = 0;
    for (let i = 0; i < 7; i++) {
      addNoise(out, sr, { start: t, dur: 0.05, gain: 0.55, smooth: 0.2, decay: 70 });
      const clickHz = 1800 * jitter(0.25);
      addVoice(out, sr, {
        start: t,
        dur: 0.035,
        freq: () => clickHz,
        shape: "triangle",
        gain: 0.18,
      });
      t += 0.04 + Math.random() * 0.04;
    }
    addNoise(out, sr, { start: t + 0.03, dur: 0.09, gain: 0.7, smooth: 0.45, decay: 45 });
    addVoice(out, sr, { start: t + 0.03, dur: 0.08, freq: () => 900, shape: "triangle", gain: 0.25 });
    return t + 0.15;
  },

  // Springy "boing" as a token hops forward.
  pieceMove: (out, sr) => {
    const base = 260 * jitter(0.08);
    addVoice(out, sr, {
      dur: 0.26,
      freq: (t) => base * (1 + 1.4 * Math.exp(-t * 18)) * (1 + 0.06 * Math.sin(TWO_PI * 28 * t)),
      shape: "triangle",
      gain: 0.45,
      release: 0.12,
    });
    return 0.28;
  },

  // "Pop!" then a rising slide whistle as a token leaves home.
  pieceOut: (out, sr) => {
    addVoice(out, sr, { dur: 0.05, freq: (t) => 900 - t * 8000, gain: 0.5 });
    addVoice(out, sr, {
      start: 0.04,
      dur: 0.34,
      freq: (t, d) => 500 + 1100 * (t / d) + 20 * Math.sin(TWO_PI * 9 * t),
      gain: 0.35,
      release: 0.08,
    });
    return 0.4;
  },

  // Cartoon BONK plus a falling "wheee-ooo" slide whistle.
  capture: (out, sr) => {
    addNoise(out, sr, { dur: 0.12, gain: 0.8, smooth: 0.7, decay: 25 });
    addVoice(out, sr, { dur: 0.16, freq: (t) => 180 - t * 500, shape: "square", gain: 0.45 });
    addVoice(out, sr, {
      start: 0.12,
      dur: 0.6,
      freq: (t, d) => 1500 - 1150 * (t / d) + 25 * Math.sin(TWO_PI * 7 * t),
      gain: 0.32,
      release: 0.15,
    });
    return 0.75;
  },

  // Rising "ta-da" arpeggio with sparkle on top.
  rolledSix: (out, sr) => {
    [3, 7, 10, 15].forEach((semi, i) => {
      addVoice(out, sr, {
        start: i * 0.075,
        dur: i === 3 ? 0.35 : 0.12,
        freq: () => noteHz(semi),
        shape: "square",
        gain: 0.4,
        release: 0.06,
      });
    });
    for (let i = 0; i < 5; i++) {
      const sparkleHz = 2400 + Math.random() * 1600;
      addVoice(out, sr, {
        start: 0.3 + i * 0.045,
        dur: 0.06,
        freq: () => sparkleHz,
        gain: 0.1,
      });
    }
    return 0.65;
  },

  // Sad trombone: wah, wah, wah, waaaah.
  threeSixes: (out, sr) => {
    const notes = [
      { semi: -2, dur: 0.28 },
      { semi: -3, dur: 0.28 },
      { semi: -4, dur: 0.28 },
      { semi: -5, dur: 0.9 },
    ];
    let t = 0;
    notes.forEach(({ semi, dur }, i) => {
      const hz = noteHz(semi - 12);
      const last = i === notes.length - 1;
      addVoice(out, sr, {
        start: t,
        dur,
        freq: (x) => hz * (last ? 1 - 0.04 * x : 1) * (1 + (last ? 0.03 : 0.012) * Math.sin(TWO_PI * 6 * x)),
        shape: "saw",
        gain: 0.6,
        attack: 0.04,
        release: last ? 0.3 : 0.06,
      });
      t += dur + 0.04;
    });
    return t;
  },

  // Friendly "bloop-bleep" when the turn passes.
  turnChange: (out, sr) => {
    addVoice(out, sr, { dur: 0.09, freq: (t) => 420 + t * 900, gain: 0.3 });
    addVoice(out, sr, { start: 0.1, dur: 0.11, freq: (t) => 640 + t * 1300, gain: 0.3 });
    return 0.23;
  },

  // Fanfare arpeggio over a cheering crowd swell.
  win: (out, sr) => {
    const fanfare = [
      { semi: 3, at: 0, dur: 0.14 },
      { semi: 3, at: 0.16, dur: 0.14 },
      { semi: 3, at: 0.32, dur: 0.14 },
      { semi: 7, at: 0.48, dur: 0.3 },
      { semi: 5, at: 0.8, dur: 0.14 },
      { semi: 7, at: 0.96, dur: 0.14 },
      { semi: 15, at: 1.12, dur: 0.6 },
    ];
    fanfare.forEach(({ semi, at, dur }) => {
      addVoice(out, sr, { start: at, dur, freq: () => noteHz(semi), shape: "square", gain: 0.2, release: 0.05 });
      addVoice(out, sr, { start: at, dur, freq: () => noteHz(semi - 12), shape: "triangle", gain: 0.2, release: 0.05 });
    });
    const s0 = Math.floor(0.4 * sr);
    const n = Math.floor(1.5 * sr);
    let last = 0;
    for (let i = 0; i < n && s0 + i < out.length; i++) {
      const t = i / sr;
      last = last * 0.6 + (Math.random() * 2 - 1) * 0.4;
      const swell = Math.sin((Math.PI * t) / 1.5);
      out[s0 + i] += last * 0.22 * swell * (0.7 + 0.3 * Math.sin(TWO_PI * 11 * t));
    }
    return 1.95;
  },

  buttonClick: (out, sr) => {
    addVoice(out, sr, { dur: 0.06, freq: (t) => 700 + t * 6000, gain: 0.3, release: 0.03 });
    return 0.07;
  },
};

const FALLBACK_TONES = {
  diceRoll: { frequency: 400, duration: 0.2 },
  pieceMove: { frequency: 300, duration: 0.15 },
  pieceOut: { frequency: 450, duration: 0.25 },
  capture: { frequency: 200, duration: 0.3, type: "square" },
  rolledSix: { frequency: 600, duration: 0.3 },
  threeSixes: { frequency: 180, duration: 0.5, type: "square" },
  turnChange: { frequency: 350, duration: 0.2 },
  win: { frequency: 600, duration: 0.5 },
  buttonClick: { frequency: 500, duration: 0.1 },
};

const renderBuffer = (context, name) => {
  const recipe = RECIPES[name];
  const sr = context.sampleRate || 44100;
  // Render into a generous scratch buffer, then trim to the recipe's length.
  const scratch = new Float32Array(Math.ceil(sr * 2.2));
  const length = Math.min(scratch.length, Math.ceil(recipe(scratch, sr) * sr));
  const buffer = context.createBuffer(1, length, sr);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = clamp(scratch[i]);
  return buffer;
};

const getBuffer = (context, name) => {
  const key = `${name}:${Math.floor(Math.random() * VARIANTS)}`;
  let buffer = bufferCache.get(key);
  if (!buffer) {
    buffer = renderBuffer(context, name);
    bufferCache.set(key, buffer);
  }
  return buffer;
};

export const FUN_SOUND_NAMES = Object.keys(RECIPES);

export const playFunSound = (name, { volume = 1 } = {}) => {
  if (!RECIPES[name]) name = "buttonClick";
  const context = resumeAudioFromGesture() || getAudioContext();
  if (!context || context.state !== "running") {
    return playTone({ volume: 0.4, ...FALLBACK_TONES[name] }).catch(() => {});
  }
  try {
    const source = context.createBufferSource();
    source.buffer = getBuffer(context, name);
    // Slight random pitch keeps repeated sounds from feeling robotic.
    source.playbackRate.value = name === "win" || name === "threeSixes" ? 1 : jitter(0.05);
    const gainNode = context.createGain();
    gainNode.gain.value = Math.max(0, Math.min(1.5, volume));
    source.connect(gainNode);
    gainNode.connect(context.destination);
    source.start(0);
    return Promise.resolve();
  } catch (_e) {
    return playTone({ volume: 0.4, ...FALLBACK_TONES[name] }).catch(() => {});
  }
};
