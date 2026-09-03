const BENGALI_CHAR = /[\u0980-\u09FF]/;

const getPreferredVoice = (language) => {
  const voices = window.speechSynthesis.getVoices() || [];
  const prefix = language.split("-")[0].toLowerCase();
  return voices
    .filter((voice) => String(voice.lang || "").toLowerCase().startsWith(prefix))
    .sort((a, b) => {
      const score = (voice) => {
        const label = `${voice.name} ${voice.lang}`.toLowerCase();
        if (/natural|neural|premium|enhanced|online|google/.test(label)) return 0;
        if (/microsoft/.test(label)) return 1;
        return voice.localService ? 3 : 2;
      };
      return score(a) - score(b);
    })[0];
};

export const speakMessageText = (value) => {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;

  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return false;

  const language = BENGALI_CHAR.test(text) ? "bn-BD" : "en-US";
  const utterance = new window.SpeechSynthesisUtterance(text);
  const voice = getPreferredVoice(language);
  utterance.lang = voice?.lang || language;
  utterance.voice = voice || null;
  utterance.rate = 1;
  utterance.pitch = 1;
  utterance.volume = 1;

  window.speechSynthesis.cancel();
  window.speechSynthesis.resume();
  window.speechSynthesis.speak(utterance);
  return true;
};

export default speakMessageText;
