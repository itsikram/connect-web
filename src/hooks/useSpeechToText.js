import { useCallback, useEffect, useRef, useState } from "react";

const SpeechRecognitionCtor = () =>
  typeof window !== "undefined"
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null;

export default function useSpeechToText({
  onFinal,
  onInterim,
  lang,
  continuous = false,
} = {}) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [supported, setSupported] = useState(false);
  const recRef = useRef(null);
  const wantListenRef = useRef(false);
  const onFinalRef = useRef(onFinal);
  const onInterimRef = useRef(onInterim);

  onFinalRef.current = onFinal;
  onInterimRef.current = onInterim;

  useEffect(() => {
    setSupported(Boolean(SpeechRecognitionCtor()));
  }, []);

  const stop = useCallback(() => {
    wantListenRef.current = false;
    const rec = recRef.current;
    recRef.current = null;
    try {
      rec?.stop?.();
    } catch (_) {
      /* ignore */
    }
    setListening(false);
    setInterim("");
  }, []);

  const start = useCallback(() => {
    const Ctor = SpeechRecognitionCtor();
    if (!Ctor) return false;

    stop();
    wantListenRef.current = true;
    const rec = new Ctor();
    rec.lang =
      lang ||
      (typeof navigator !== "undefined" && navigator.language?.startsWith("bn")
        ? "bn-BD"
        : "en-US");
    rec.interimResults = true;
    rec.continuous = Boolean(continuous);

    rec.onresult = (event) => {
      let interimText = "";
      let finalText = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const piece = event.results[i][0]?.transcript || "";
        if (event.results[i].isFinal) finalText += piece;
        else interimText += piece;
      }
      if (interimText) {
        setInterim(interimText);
        onInterimRef.current?.(interimText);
      }
      if (finalText) {
        setInterim("");
        onInterimRef.current?.("");
        onFinalRef.current?.(finalText.trim());
      }
    };

    rec.onerror = () => {
      wantListenRef.current = false;
      setListening(false);
    };
    rec.onend = () => {
      if (recRef.current !== rec) return;
      if (wantListenRef.current && continuous) {
        try {
          rec.start();
          setListening(true);
          return;
        } catch (_) {
          /* fall through */
        }
      }
      wantListenRef.current = false;
      setListening(false);
      recRef.current = null;
    };

    recRef.current = rec;
    rec.start();
    setListening(true);
    setInterim("");
    return true;
  }, [lang, continuous, stop]);

  const toggle = useCallback(() => {
    if (listening) stop();
    else start();
  }, [listening, start, stop]);

  useEffect(() => () => stop(), [stop]);

  return { listening, interim, supported, start, stop, toggle };
};
