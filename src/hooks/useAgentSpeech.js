import { useCallback, useEffect, useRef, useState } from "react";

const hasBangla = (text) => /[\u0980-\u09FF]/.test(String(text || ""));

const SENTENCE_RE = /[.!?।…]+(?:["')\]]+)?(?:\s+|$)/g;

export const stripForSpeech = (text = "") =>
  String(text || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_#`>~]+/g, " ")
    .replace(/[🤖✅❌⚠️ℹ️]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const takeSpeakable = (buffer) => {
  const pieces = [];
  let last = 0;
  const re = new RegExp(SENTENCE_RE.source, "g");
  let match = re.exec(buffer);
  while (match) {
    const end = match.index + match[0].length;
    const piece = buffer.slice(last, end).trim();
    if (piece) pieces.push(piece);
    last = end;
    match = re.exec(buffer);
  }
  let rest = buffer.slice(last);
  if (!pieces.length && rest.trim().split(/\s+/).length >= 12) {
    const cut = rest.lastIndexOf(" ");
    if (cut > 24) {
      pieces.push(rest.slice(0, cut).trim());
      rest = rest.slice(cut);
    }
  }
  return { pieces, rest };
};

const pickVoice = (lang) => {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices() || [];
  const prefix = String(lang || "en")
    .split("-")[0]
    .toLowerCase();
  const ranked = voices
    .filter((voice) => String(voice.lang || "").toLowerCase().startsWith(prefix))
    .sort((a, b) => {
      const score = (voice) => {
        const label = `${voice.name} ${voice.lang}`.toLowerCase();
        if (/natural|neural|premium|enhanced|online|google/.test(label)) return 0;
        if (/microsoft/.test(label)) return 1;
        if (voice.localService) return 3;
        return 2;
      };
      return score(a) - score(b);
    });
  return ranked[0] || null;
};

export default function useAgentSpeech() {
  const [speaking, setSpeaking] = useState(false);
  const [supported] = useState(
    () => typeof window !== "undefined" && "speechSynthesis" in window,
  );
  const generationRef = useRef(0);
  const streamIdRef = useRef(null);
  const spokenLenRef = useRef(0);
  const restRef = useRef("");
  const pendingRef = useRef(0);
  const onIdleRef = useRef(null);

  useEffect(() => {
    if (!supported) return undefined;
    const warm = () => window.speechSynthesis.getVoices();
    warm();
    window.speechSynthesis.addEventListener("voiceschanged", warm);
    const keepAlive = setInterval(() => {
      if (window.speechSynthesis.speaking && window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
    }, 8000);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", warm);
      clearInterval(keepAlive);
      window.speechSynthesis.cancel();
    };
  }, [supported]);

  const markIdleIfDone = useCallback(() => {
    if (pendingRef.current > 0) return;
    setSpeaking(false);
    const onIdle = onIdleRef.current;
    onIdleRef.current = null;
    onIdle?.();
  }, []);

  const enqueue = useCallback(
    (raw, langHint) => {
      if (!supported) return;
      const text = stripForSpeech(raw);
      if (!text) return;
      const lang = hasBangla(text) || String(langHint || "").startsWith("bn")
        ? "bn-BD"
        : "en-US";
      const utterance = new SpeechSynthesisUtterance(text);
      const voice = pickVoice(lang);
      utterance.lang = voice ? voice.lang || lang : "en-US";
      utterance.rate = 1.06;
      utterance.pitch = 1;
      utterance.volume = 1;
      if (voice) utterance.voice = voice;
      const generation = generationRef.current;
      pendingRef.current += 1;
      setSpeaking(true);
      utterance.onend = () => {
        if (generation !== generationRef.current) return;
        pendingRef.current = Math.max(0, pendingRef.current - 1);
        markIdleIfDone();
      };
      utterance.onerror = () => {
        if (generation !== generationRef.current) return;
        pendingRef.current = Math.max(0, pendingRef.current - 1);
        markIdleIfDone();
      };
      window.speechSynthesis.resume();
      window.speechSynthesis.speak(utterance);
    },
    [markIdleIfDone, supported],
  );

  const cancel = useCallback(() => {
    generationRef.current += 1;
    streamIdRef.current = null;
    spokenLenRef.current = 0;
    restRef.current = "";
    pendingRef.current = 0;
    onIdleRef.current = null;
    if (supported) window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [supported]);

  const feed = useCallback(
    (id, fullText, langHint) => {
      if (!supported) return;
      if (streamIdRef.current !== id) {
        streamIdRef.current = id;
        spokenLenRef.current = 0;
        restRef.current = "";
      }
      const clean = stripForSpeech(fullText);
      if (clean.length <= spokenLenRef.current) return;
      const unread = `${restRef.current}${clean.slice(spokenLenRef.current)}`;
      const { pieces, rest } = takeSpeakable(unread);
      pieces.forEach((piece) => enqueue(piece, langHint));
      restRef.current = rest;
      spokenLenRef.current = clean.length;
    },
    [enqueue, supported],
  );

  const flush = useCallback(
    (id, fullText, langHint) => {
      if (!supported) return;
      if (id && streamIdRef.current !== id) {
        feed(id, fullText, langHint);
      } else if (fullText) {
        feed(id || streamIdRef.current, fullText, langHint);
      }
      const leftover = restRef.current.trim();
      restRef.current = "";
      streamIdRef.current = null;
      spokenLenRef.current = 0;
      if (leftover) enqueue(leftover, langHint);
    },
    [enqueue, feed, supported],
  );

  const speak = useCallback(
    (text, { lang, onEnd } = {}) => {
      cancel();
      if (typeof onEnd === "function") onIdleRef.current = onEnd;
      enqueue(text, lang);
    },
    [cancel, enqueue],
  );

  return { supported, speaking, speak, feed, flush, cancel };
}
