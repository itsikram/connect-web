/**
 * Keeps the AI Agent from transcribing its own voice.
 *
 * Every line the agent speaks is recorded here. The microphone is only
 * reopened after the speaker has been quiet for a short tail, and any
 * transcript that is mostly a repeat of something the agent just said is
 * treated as echo and dropped. Short replies ("yes", "হ্যাঁ") are never
 * treated as echo, so the user can still answer the agent's questions.
 */

const RECENT_SPEECH_MS = 25000;
// Speaker output keeps ringing briefly after the browser reports "end".
export const AGENT_ECHO_TAIL_MS = 700;
const MIN_ECHO_WORDS = 3;
const ECHO_WORD_RATIO = 0.7;

let recentSpeech = [];
let activeUtterances = 0;
let lastSpeechEndedAt = 0;

const toWords = (text) =>
  String(text || "")
    .normalize("NFC")
    .toLowerCase()
    .replace(/[‌‍]/g, "")
    // \p{M} keeps Bengali vowel signs (ি, ো, …) attached to their letters.
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);

/** Call when the agent starts speaking a piece of text. */
export const agentSpeechStarted = (text) => {
  activeUtterances += 1;
  const words = toWords(text);
  const now = Date.now();
  recentSpeech = recentSpeech.filter((item) => now - item.at < RECENT_SPEECH_MS);
  if (words.length) recentSpeech.push({ words, at: now });
};

/** Call when a spoken piece finished, was stopped, or failed. */
export const agentSpeechEnded = () => {
  activeUtterances = Math.max(0, activeUtterances - 1);
  lastSpeechEndedAt = Date.now();
};

/** Call when all agent speech is cancelled at once. */
export const agentSpeechCancelled = () => {
  activeUtterances = 0;
  lastSpeechEndedAt = Date.now();
};

export const isAgentSpeaking = () => activeUtterances > 0;

/** Milliseconds since the agent last stopped talking (0 while talking). */
export const agentQuietForMs = () =>
  activeUtterances > 0 ? 0 : Date.now() - lastSpeechEndedAt;

/** True when a transcript is (mostly) the agent's own recent speech. */
export const isLikelyAgentEcho = (transcript, now = Date.now()) => {
  const heard = toWords(transcript);
  if (heard.length < MIN_ECHO_WORDS) return false;
  return recentSpeech.some((item) => {
    if (now - item.at > RECENT_SPEECH_MS) return false;
    const spoken = new Set(item.words);
    const shared = heard.filter((word) => spoken.has(word)).length;
    if (shared / heard.length < ECHO_WORD_RATIO) return false;
    // Require three words in the same order, so a user who merely reuses
    // some of the agent's words is not silenced.
    const spokenText = ` ${item.words.join(" ")} `;
    for (let i = 0; i + MIN_ECHO_WORDS <= heard.length; i += 1) {
      if (spokenText.includes(` ${heard.slice(i, i + MIN_ECHO_WORDS).join(" ")} `)) {
        return true;
      }
    }
    return false;
  });
};

/** Test helper: forget everything. */
export const resetAgentEcho = () => {
  recentSpeech = [];
  activeUtterances = 0;
  lastSpeechEndedAt = 0;
};
