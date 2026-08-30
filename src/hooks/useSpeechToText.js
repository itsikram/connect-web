import { useCallback, useEffect, useRef, useState } from "react";

const SpeechRecognitionCtor = () =>
  typeof window !== "undefined"
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null;

export default function useSpeechToText({ onFinal, lang } = {}) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [supported, setSupported] = useState(false);
  const recRef = useRef(null);

  useEffect(() => {
    setSupported(Boolean(SpeechRecognitionCtor()));
  }, []);

  const stop = useCallback(() => {
    try {
      recRef.current?.stop?.();
    } catch (_) {
      /* ignore */
    }
    recRef.current = null;
    setListening(false);
  }, []);

  const start = useCallback(() => {
    const Ctor = SpeechRecognitionCtor();
    if (!Ctor) return false;

    stop();
    const rec = new Ctor();
    rec.lang =
      lang ||
      (typeof navigator !== "undefined" && navigator.language?.startsWith("bn")
        ? "bn-BD"
        : "en-US");
    rec.interimResults = true;
    rec.continuous = false;

    rec.onresult = (event) => {
      let interimText = "";
      let finalText = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const piece = event.results[i][0]?.transcript || "";
        if (event.results[i].isFinal) finalText += piece;
        else interimText += piece;
      }
      if (interimText) setInterim(interimText);
      if (finalText) {
        setInterim("");
        if (typeof onFinal === "function") onFinal(finalText.trim());
      }
    };

    rec.onerror = () => {
      setListening(false);
    };
    rec.onend = () => {
      setListening(false);
      recRef.current = null;
    };

    recRef.current = rec;
    rec.start();
    setListening(true);
    setInterim("");
    return true;
  }, [lang, onFinal, stop]);

  const toggle = useCallback(() => {
    if (listening) stop();
    else start();
  }, [listening, start, stop]);

  useEffect(() => () => stop(), [stop]);

  return { listening, interim, supported, start, stop, toggle };
}
