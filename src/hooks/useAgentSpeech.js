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
  const words = rest.trim().split(/\s+/).filter(Boolean);
  const banglaChars = (rest.match(/[\u0980-\u09FF]/g) || []).length;
  const ready = words.length >= 2 || banglaChars >= 4;
  if (!pieces.length && ready) {
    const comma = rest.search(/[,;:،]\s+/);
    if (comma >= 4) {
      pieces.push(rest.slice(0, comma + 1).trim());
      rest = rest.slice(comma + 1);
    } else if (words.length >= 2) {
      const take = Math.min(words.length, 3);
      const head = words.slice(0, take).join(" ");
      const at = rest.indexOf(head);
      pieces.push(head);
      rest = at >= 0 ? rest.slice(at + head.length) : "";
    } else {
      pieces.push(rest.trim());
      rest = "";
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

const utteranceTimeoutMs = (text = "") =>
  Math.min(18000, 900 + String(text).length * 70);

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
  const lastSpeakAtRef = useRef(0);

  const markIdleIfDone = useCallback(() => {
    if (pendingRef.current > 0) return;
    setSpeaking(false);
    const onIdle = onIdleRef.current;
    onIdleRef.current = null;
    onIdle?.();
  }, []);

  const forceIdle = useCallback(() => {
    pendingRef.current = 0;
    onIdleRef.current = null;
    setSpeaking(false);
  }, []);

  useEffect(() => {
    if (!supported) return undefined;
    const warm = () => window.speechSynthesis.getVoices();
    warm();
    window.speechSynthesis.addEventListener("voiceschanged", warm);
    const keepAlive = setInterval(() => {
      const synth = window.speechSynthesis;
      if (synth.speaking && synth.paused) synth.resume();
      if (pendingRef.current <= 0) return;
      const idleFor = Date.now() - lastSpeakAtRef.current;
      if (idleFor < 3000) return;
      const browserIdle = !synth.speaking && !synth.pending;
      if (idleFor > 14000 || browserIdle) {
        pendingRef.current = 0;
        if (idleFor > 14000) {
          try {
            synth.cancel();
          } catch {
            /* ignore */
          }
        }
        markIdleIfDone();
      }
    }, 1200);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", warm);
      clearInterval(keepAlive);
      window.speechSynthesis.cancel();
    };
  }, [markIdleIfDone, supported]);

  const enqueue = useCallback(
    (raw, langHint) => {
      if (!supported) return;
      const text = stripForSpeech(raw).slice(0, 280);
      if (!text) return;
      const lang = hasBangla(text) || String(langHint || "").startsWith("bn")
        ? "bn-BD"
        : "en-US";
      const utterance = new SpeechSynthesisUtterance(text);
      const voice = pickVoice(lang);
      utterance.lang = voice ? voice.lang || lang : "en-US";
      utterance.rate = 1.08;
      utterance.pitch = 1;
      utterance.volume = 1;
      if (voice) utterance.voice = voice;
      const generation = generationRef.current;
      pendingRef.current += 1;
      lastSpeakAtRef.current = Date.now();
      setSpeaking(true);
      let finished = false;
      const finishUtterance = () => {
        if (finished || generation !== generationRef.current) return;
        finished = true;
        clearTimeout(watchdog);
        pendingRef.current = Math.max(0, pendingRef.current - 1);
        markIdleIfDone();
      };
      const watchdog = setTimeout(finishUtterance, utteranceTimeoutMs(text));
      utterance.onend = finishUtterance;
      utterance.onerror = finishUtterance;
      try {
        window.speechSynthesis.resume();
        window.speechSynthesis.speak(utterance);
      } catch {
        finishUtterance();
      }
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
    lastSpeakAtRef.current = 0;
    if (supported) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        /* ignore */
      }
    }
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
    (text, { lang, onEnd } = {}) =>
      new Promise((resolve) => {
        cancel();
        const startGeneration = generationRef.current;
        const cleaned = stripForSpeech(text);
        if (!supported || !cleaned) {
          onEnd?.();
          resolve();
          return;
        }
        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          onEnd?.();
          resolve();
        };
        onIdleRef.current = finish;
        enqueue(text, lang);
        // Do not cancel normal replies on a short fixed timer. Bengali and
        // mixed-language speech can naturally take longer than 2.8 seconds.
        const ms = utteranceTimeoutMs(cleaned) + 1500;
        setTimeout(() => {
          finish();
          if (generationRef.current !== startGeneration) return;
          try {
            window.speechSynthesis.cancel();
          } catch {
            /* ignore */
          }
          forceIdle();
        }, ms);
      }),
    [cancel, enqueue, forceIdle, supported],
  );

  return { supported, speaking, speak, feed, flush, cancel };
}
