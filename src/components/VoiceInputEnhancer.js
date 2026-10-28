import React, { useCallback, useEffect, useRef, useState } from "react";
import useComposerLiveTranscribe from "../hooks/useComposerLiveTranscribe";
import "./VoiceInputEnhancer.css";

// Mirrors the Expo app's VoiceTextInput: a plain mic icon inside the focused
// field. Tap toggles listening (mic -> red stop); long-press or right-click
// opens a Bangla/English picker that restarts capture in the chosen language.

const TEXT_INPUT_TYPES = new Set(["", "text", "search", "email", "url", "tel"]);
const LANGUAGE_STORAGE_KEY = "voiceInputLanguage";
const LONG_PRESS_MS = 400;

const isVoiceInput = (element) => {
  if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) {
    return false;
  }
  if (element.disabled || element.readOnly || element.closest("[data-voice-input='false']")) {
    return false;
  }
  return element instanceof HTMLTextAreaElement || TEXT_INPUT_TYPES.has(element.type);
};

const setInputValue = (element, value) => {
  const prototype = element instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
  descriptor?.set?.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
};

const mergeTranscriptText = (base, text) =>
  [String(base || "").trim(), String(text || "").trim()].filter(Boolean).join(" ");

const initialLanguage = () => {
  try {
    const saved = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (saved === "bn-BD" || saved === "en-US") return saved;
  } catch {}
  return document.documentElement.lang?.startsWith("bn") ? "bn-BD" : "en-US";
};

export default function VoiceInputEnhancer() {
  const [target, setTarget] = useState(null);
  const [language, setLanguage] = useState(initialLanguage);
  const [position, setPosition] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const baseTextRef = useRef("");
  const targetRef = useRef(null);
  const applyingTranscriptRef = useRef(false);
  const lastFinalRef = useRef("");
  const longPressTimerRef = useRef(null);
  const longPressedRef = useRef(false);

  const writeToTarget = useCallback((value) => {
    const element = targetRef.current;
    if (!element) return;
    applyingTranscriptRef.current = true;
    setInputValue(element, value);
  }, []);

  const { listening, start, stop } = useComposerLiveTranscribe({
    onFinal: (text) => {
      const normalized = String(text || "").trim().replace(/\s+/g, " ").toLowerCase();
      if (!normalized || normalized === lastFinalRef.current) return;
      lastFinalRef.current = normalized;
      const next = mergeTranscriptText(baseTextRef.current, text);
      baseTextRef.current = next;
      writeToTarget(next);
    },
    onInterim: (text) => {
      if (!text) return;
      writeToTarget(mergeTranscriptText(baseTextRef.current, text));
    },
  });

  const updatePosition = useCallback(() => {
    const element = targetRef.current;
    if (!element || !isVoiceInput(element)) {
      setPosition(null);
      return;
    }
    const rect = element.getBoundingClientRect();
    const size = 32;
    const isMultiline = element instanceof HTMLTextAreaElement && rect.height > 56;
    setPosition({
      top: isMultiline ? rect.top + 6 : rect.top + (rect.height - size) / 2,
      left: rect.right - size - 4,
    });
  }, []);

  useEffect(() => {
    const handleFocus = (event) => {
      if (!isVoiceInput(event.target)) return;
      if (targetRef.current && targetRef.current !== event.target) stop();
      targetRef.current = event.target;
      baseTextRef.current = event.target.value;
      setTarget(event.target);
      setMenuOpen(false);
      updatePosition();
    };
    const handleInput = (event) => {
      if (event.target !== targetRef.current) return;
      if (applyingTranscriptRef.current) {
        applyingTranscriptRef.current = false;
        return;
      }
      baseTextRef.current = event.target.value;
    };
    const handleBlur = () => {
      window.setTimeout(() => {
        const enhancer = document.querySelector(".voice-input-enhancer");
        const focusIsOnEnhancer = enhancer?.contains(document.activeElement);
        if (!targetRef.current?.matches(":focus") && !focusIsOnEnhancer) {
          stop();
          targetRef.current = null;
          setTarget(null);
          setPosition(null);
          setMenuOpen(false);
        }
      }, 0);
    };

    document.addEventListener("focusin", handleFocus);
    document.addEventListener("input", handleInput);
    document.addEventListener("focusout", handleBlur);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      document.removeEventListener("focusin", handleFocus);
      document.removeEventListener("input", handleInput);
      document.removeEventListener("focusout", handleBlur);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [stop, updatePosition]);

  useEffect(() => {
    if (target && !document.body.contains(target)) {
      stop();
      targetRef.current = null;
      setTarget(null);
      setPosition(null);
    }
  }, [target, stop]);

  useEffect(() => () => window.clearTimeout(longPressTimerRef.current), []);

  if (!target || !position) return null;

  const startListening = (nextLanguage) => {
    lastFinalRef.current = "";
    baseTextRef.current = target.value;
    start(nextLanguage).then((started) => {
      if (!started) {
        window.alert("Microphone unavailable. Allow microphone access and try again.");
      }
    }).catch((error) => {
      console.error("Unable to start voice input:", error);
      window.alert("Microphone unavailable. Allow microphone access and try again.");
    });
  };

  const toggleVoice = () => {
    if (longPressedRef.current) {
      longPressedRef.current = false;
      return;
    }
    setMenuOpen(false);
    if (listening) {
      stop();
      return;
    }
    startListening(language);
  };

  const chooseLanguage = (nextLanguage) => {
    setLanguage(nextLanguage);
    setMenuOpen(false);
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
    } catch {}
    if (listening) stop();
    // Restart after stop() settles so the new recognizer starts cleanly.
    window.setTimeout(() => startListening(nextLanguage), listening ? 150 : 0);
  };

  const beginPress = () => {
    longPressedRef.current = false;
    window.clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = window.setTimeout(() => {
      longPressedRef.current = true;
      setMenuOpen(true);
    }, LONG_PRESS_MS);
  };
  const cancelPress = () => window.clearTimeout(longPressTimerRef.current);

  const languageName = language.startsWith("bn") ? "Bangla" : "English";

  return (
    <div
      className="voice-input-enhancer"
      style={{ top: position.top, left: position.left }}
    >
      <button
        type="button"
        onClick={toggleVoice}
        onMouseDown={(event) => event.preventDefault()}
        onPointerDown={beginPress}
        onPointerUp={cancelPress}
        onPointerLeave={cancelPress}
        onContextMenu={(event) => {
          event.preventDefault();
          cancelPress();
          setMenuOpen(true);
        }}
        className={listening ? "is-listening" : ""}
        aria-label={listening ? "Stop voice input" : `Start ${languageName} voice input`}
        aria-haspopup="menu"
        title={listening
          ? "Stop voice input"
          : `Start ${languageName} voice input (long-press to change language)`}
      >
        <i className={`fas ${listening ? "fa-stop" : "fa-microphone"}`} aria-hidden="true" />
      </button>
      {menuOpen ? (
        <div className="voice-input-enhancer__menu" role="menu">
          <div className="voice-input-enhancer__menu-title">Voice input language</div>
          {[["bn-BD", "Bangla"], ["en-US", "English"]].map(([code, label]) => (
            <button
              key={code}
              type="button"
              role="menuitemradio"
              aria-checked={language === code}
              className={language === code ? "is-active" : ""}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => chooseLanguage(code)}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            className="voice-input-enhancer__cancel"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => setMenuOpen(false)}
          >
            Cancel
          </button>
        </div>
      ) : null}
    </div>
  );
}
