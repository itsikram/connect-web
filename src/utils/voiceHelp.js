import { isCallBusy } from "./callSession";

// "Hold to hear": press and hold any button marked with data-speak and the
// app says its name out loud, so people who cannot read can still find their
// way. English by default; Bangla when chosen and the phone has a Bangla voice.

const ENABLED_KEY = "voice_help_enabled";
const LANG_KEY = "voice_help_lang";
const listeners = new Set();

const notify = () => {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch (_) {
      // a broken listener must not stop the others
    }
  });
};

/** Re-render hook support: called whenever the voice settings change. */
export const subscribeVoiceHelp = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const isVoiceHelpSupported = () =>
  typeof window !== "undefined" &&
  "speechSynthesis" in window &&
  typeof window.SpeechSynthesisUtterance === "function";

export const isVoiceHelpEnabled = () => {
  try {
    return localStorage.getItem(ENABLED_KEY) !== "false";
  } catch (_) {
    return true;
  }
};

export const setVoiceHelpEnabled = (enabled) => {
  try {
    localStorage.setItem(ENABLED_KEY, enabled ? "true" : "false");
  } catch (_) {
    // private mode: keep the default
  }
  notify();
};

export const getVoiceHelpLang = () => {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === "bn" || saved === "en") return saved;
  } catch (_) {
    // fall through to the device language
  }
  if (typeof navigator === "undefined") return "en";
  const first = (navigator.languages && navigator.languages[0]) || navigator.language || "";
  return /^bn\b/i.test(first) ? "bn" : "en";
};

export const setVoiceHelpLang = (lang) => {
  try {
    localStorage.setItem(LANG_KEY, lang === "bn" ? "bn" : "en");
  } catch (_) {
    // private mode: keep the default
  }
  notify();
};

const voiceScore = (voice) => {
  const label = `${voice.name} ${voice.lang}`.toLowerCase();
  if (/natural|neural|premium|enhanced|online|google/.test(label)) return 0;
  if (/microsoft/.test(label)) return 1;
  return voice.localService ? 3 : 2;
};

export const findVoice = (lang) => {
  if (!isVoiceHelpSupported()) return null;
  const voices = window.speechSynthesis.getVoices() || [];
  const prefix = lang === "bn" ? "bn" : "en";
  const matching = voices
    .filter((voice) => String(voice.lang || "").toLowerCase().startsWith(prefix))
    .sort((a, b) => voiceScore(a) - voiceScore(b));
  if (prefix === "bn") {
    return matching.find((voice) => /bd/i.test(voice.lang)) || matching[0] || null;
  }
  return matching[0] || null;
};

/** Voices load late on some phones; resolve once they are known. */
export const whenVoicesReady = () =>
  new Promise((resolve) => {
    if (!isVoiceHelpSupported()) {
      resolve([]);
      return;
    }
    const synth = window.speechSynthesis;
    const now = synth.getVoices() || [];
    if (now.length) {
      resolve(now);
      return;
    }
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      synth.removeEventListener?.("voiceschanged", finish);
      resolve(synth.getVoices() || []);
    };
    synth.addEventListener?.("voiceschanged", finish);
    setTimeout(finish, 1500);
  });

export const hasBanglaVoice = () => Boolean(findVoice("bn"));

/**
 * Says a label out loud. Returns the text that was (or would be) spoken so the
 * caller can also show it on screen. Bangla is used only when chosen and a
 * Bangla voice exists; otherwise the English text is spoken.
 */
export const speakHelp = ({ en, bn } = {}) => {
  const english = String(en || "").trim();
  const bangla = String(bn || "").trim();
  const wantsBangla = getVoiceHelpLang() === "bn" && Boolean(bangla);
  const banglaVoice = wantsBangla ? findVoice("bn") : null;
  const useBangla = wantsBangla && Boolean(banglaVoice);
  const text = useBangla ? bangla : english || bangla;
  const shownText = wantsBangla ? bangla : english || bangla;

  if (!text || !isVoiceHelpSupported() || isCallBusy()) {
    return { spoken: false, text: shownText };
  }

  try {
    const synth = window.speechSynthesis;
    const utterance = new window.SpeechSynthesisUtterance(text);
    const voice = useBangla ? banglaVoice : findVoice("en");
    utterance.voice = voice || null;
    utterance.lang = voice?.lang || (useBangla ? "bn-BD" : "en-US");
    utterance.rate = 0.92;
    utterance.pitch = 1;
    utterance.volume = 1;
    synth.cancel();
    synth.resume();
    synth.speak(utterance);
    return { spoken: true, text: shownText, utterance };
  } catch (_) {
    return { spoken: false, text: shownText };
  }
};

/** True while speech is queued or playing (a blocked request is neither). */
export const isHelpSpeechBusy = () => {
  if (!isVoiceHelpSupported()) return false;
  try {
    return Boolean(window.speechSynthesis.speaking || window.speechSynthesis.pending);
  } catch (_) {
    return false;
  }
};

export const stopHelpSpeech = () => {
  if (!isVoiceHelpSupported()) return;
  try {
    window.speechSynthesis.cancel();
  } catch (_) {
    // nothing to stop
  }
};
