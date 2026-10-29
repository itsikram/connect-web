import React, { useCallback, useEffect, useRef, useState } from "react";
import useComposerLiveTranscribe from "../hooks/useComposerLiveTranscribe";
import "./VoiceInputEnhancer.css";

// Mirrors the Expo app's VoiceTextInput: every visible text field gets a mic
// icon inside its right edge. Tap toggles listening (mic -> red stop);
// long-press or right-click opens a Bangla/English picker that restarts
// capture in the chosen language. Opt a field out with data-voice-input="false".

// Like the app (voiceEnabled only for the default keyboard), skip email,
// phone, url, number and password fields.
const TEXT_INPUT_TYPES = new Set(["", "text", "search"]);
const LANGUAGE_STORAGE_KEY = "voiceInputLanguage";
const LONG_PRESS_MS = 400;
const MIC_SIZE = 32;
const MIC_INSET = 4;
const MIN_FIELD_WIDTH = 80;
const MIN_FIELD_HEIGHT = 24;
const RESCAN_INTERVAL_MS = 1000;
const OBSERVED_ATTRIBUTES = [
  "class",
  "style",
  "hidden",
  "disabled",
  "readonly",
  "type",
  "data-voice-input",
];

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

const sameMics = (a, b) =>
  a.length === b.length &&
  a.every((mic, index) =>
    mic.id === b[index].id && mic.top === b[index].top && mic.left === b[index].left);

export default function VoiceInputEnhancer() {
  const [mics, setMics] = useState([]);
  const [language, setLanguage] = useState(initialLanguage);
  const [activeId, setActiveId] = useState(null);
  const [menuId, setMenuId] = useState(null);
  const layerRef = useRef(null);
  const micsRef = useRef([]);
  const idsRef = useRef(new WeakMap());
  const nextIdRef = useRef(1);
  const needsPaddingRef = useRef(new WeakMap());
  const paddedRef = useRef(new Set());
  const frameRef = useRef(0);
  const targetRef = useRef(null);
  const baseTextRef = useRef("");
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

  const idFor = useCallback((element) => {
    let id = idsRef.current.get(element);
    if (!id) {
      id = nextIdRef.current++;
      idsRef.current.set(element, id);
    }
    return id;
  }, []);

  const measure = useCallback(() => {
    frameRef.current = 0;
    const layer = layerRef.current;
    // Let hit-testing see through our own buttons and menu.
    layer?.classList.add("is-measuring");
    const next = [];
    document.querySelectorAll("input, textarea").forEach((element) => {
      if (!isVoiceInput(element)) return;
      const rect = element.getBoundingClientRect();
      if (rect.width < MIN_FIELD_WIDTH || rect.height < MIN_FIELD_HEIGHT) return;
      const multiline = element instanceof HTMLTextAreaElement && rect.height > 56;
      const top = Math.round(multiline ? rect.top + 6 : rect.top + (rect.height - MIC_SIZE) / 2);
      const left = Math.round(rect.right - MIC_SIZE - MIC_INSET);
      // Only show the mic where the field is actually on top: this hides it
      // for fields that are scrolled out of view, clipped, behind a modal, or
      // that already have their own control at the right edge.
      const hit = document.elementFromPoint(left + MIC_SIZE / 2, top + MIC_SIZE / 2);
      if (hit !== element) return;
      if (!needsPaddingRef.current.has(element)) {
        const paddingRight = parseFloat(window.getComputedStyle(element).paddingRight) || 0;
        needsPaddingRef.current.set(element, paddingRight < MIC_SIZE + MIC_INSET);
      }
      next.push({ id: idFor(element), element, top, left });
    });
    layer?.classList.remove("is-measuring");

    // Reserve room for the mic so typed text never runs under it.
    const shown = new Set(next.map((mic) => mic.element));
    paddedRef.current.forEach((element) => {
      if (!shown.has(element)) {
        element.removeAttribute("data-voice-mic");
        paddedRef.current.delete(element);
      }
    });
    shown.forEach((element) => {
      if (needsPaddingRef.current.get(element) && !paddedRef.current.has(element)) {
        element.setAttribute("data-voice-mic", "true");
        paddedRef.current.add(element);
      }
    });

    if (targetRef.current && !document.contains(targetRef.current)) {
      stop();
      targetRef.current = null;
      setActiveId(null);
    }
    if (!sameMics(micsRef.current, next)) {
      micsRef.current = next;
      setMics(next);
    }
  }, [idFor, stop]);

  const scheduleMeasure = useCallback(() => {
    if (!frameRef.current) frameRef.current = window.requestAnimationFrame(measure);
  }, [measure]);

  useEffect(() => {
    const handleInput = (event) => {
      if (event.target !== targetRef.current) {
        scheduleMeasure();
        return;
      }
      if (applyingTranscriptRef.current) {
        applyingTranscriptRef.current = false;
        return;
      }
      baseTextRef.current = event.target.value;
    };
    const observer = new MutationObserver((records) => {
      const layer = layerRef.current;
      if (records.some((record) => !layer?.contains(record.target))) scheduleMeasure();
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: OBSERVED_ATTRIBUTES,
    });
    const interval = window.setInterval(scheduleMeasure, RESCAN_INTERVAL_MS);
    const layoutEvents = ["focusin", "focusout", "transitionend", "animationend", "load"];
    document.addEventListener("input", handleInput, true);
    layoutEvents.forEach((name) => document.addEventListener(name, scheduleMeasure, true));
    window.addEventListener("resize", scheduleMeasure);
    window.addEventListener("scroll", scheduleMeasure, true);
    scheduleMeasure();
    const padded = paddedRef.current;
    return () => {
      observer.disconnect();
      window.clearInterval(interval);
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = 0;
      document.removeEventListener("input", handleInput, true);
      layoutEvents.forEach((name) => document.removeEventListener(name, scheduleMeasure, true));
      window.removeEventListener("resize", scheduleMeasure);
      window.removeEventListener("scroll", scheduleMeasure, true);
      padded.forEach((element) => element.removeAttribute("data-voice-mic"));
      padded.clear();
    };
  }, [scheduleMeasure]);

  useEffect(() => {
    if (menuId === null) return undefined;
    const closeOnOutside = (event) => {
      if (!layerRef.current?.contains(event.target)) setMenuId(null);
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setMenuId(null);
    };
    document.addEventListener("pointerdown", closeOnOutside, true);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside, true);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [menuId]);

  useEffect(() => () => window.clearTimeout(longPressTimerRef.current), []);

  const startListening = (mic, nextLanguage) => {
    targetRef.current = mic.element;
    lastFinalRef.current = "";
    baseTextRef.current = mic.element.value;
    setActiveId(mic.id);
    start(nextLanguage).then((started) => {
      if (!started) {
        window.alert("Microphone unavailable. Allow microphone access and try again.");
      }
    }).catch((error) => {
      console.error("Unable to start voice input:", error);
      window.alert("Microphone unavailable. Allow microphone access and try again.");
    });
  };

  const toggleVoice = (mic) => {
    if (longPressedRef.current) {
      longPressedRef.current = false;
      return;
    }
    setMenuId(null);
    const isActive = listening && activeId === mic.id;
    if (listening) stop();
    if (isActive) {
      targetRef.current = null;
      setActiveId(null);
      return;
    }
    startListening(mic, language);
  };

  const chooseLanguage = (mic, nextLanguage) => {
    setLanguage(nextLanguage);
    setMenuId(null);
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
    } catch {}
    const wasListening = listening;
    if (wasListening) stop();
    // Restart after stop() settles so the new recognizer starts cleanly.
    window.setTimeout(() => startListening(mic, nextLanguage), wasListening ? 150 : 0);
  };

  const beginPress = (mic) => {
    longPressedRef.current = false;
    window.clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = window.setTimeout(() => {
      longPressedRef.current = true;
      setMenuId(mic.id);
    }, LONG_PRESS_MS);
  };
  const cancelPress = () => window.clearTimeout(longPressTimerRef.current);

  const languageName = language.startsWith("bn") ? "Bangla" : "English";
  const menuMic = mics.find((mic) => mic.id === menuId);
  const menuAbove = menuMic && menuMic.top + MIC_SIZE + 180 > window.innerHeight;

  return (
    <div ref={layerRef} className="voice-input-enhancer">
      {mics.map((mic) => {
        const isListening = listening && activeId === mic.id;
        return (
          <button
            key={mic.id}
            type="button"
            className={`voice-input-enhancer__mic${isListening ? " is-listening" : ""}`}
            style={{ top: mic.top, left: mic.left }}
            onClick={() => toggleVoice(mic)}
            onMouseDown={(event) => event.preventDefault()}
            onPointerDown={() => beginPress(mic)}
            onPointerUp={cancelPress}
            onPointerLeave={cancelPress}
            onPointerCancel={cancelPress}
            onContextMenu={(event) => {
              event.preventDefault();
              cancelPress();
              setMenuId(mic.id);
            }}
            aria-label={isListening ? "Stop voice input" : `Start ${languageName} voice input`}
            aria-haspopup="menu"
            aria-expanded={menuId === mic.id}
            title={isListening
              ? "Stop voice input"
              : `Start ${languageName} voice input (long-press to change language)`}
          >
            <i className={`fas ${isListening ? "fa-stop" : "fa-microphone"}`} aria-hidden="true" />
          </button>
        );
      })}
      {menuMic ? (
        <div
          className={`voice-input-enhancer__menu${menuAbove ? " is-above" : ""}`}
          role="menu"
          style={{
            top: menuAbove ? menuMic.top - 4 : menuMic.top + MIC_SIZE + 4,
            left: Math.max(8, menuMic.left + MIC_SIZE - 200),
          }}
        >
          <div className="voice-input-enhancer__menu-title">Voice input language</div>
          <div className="voice-input-enhancer__menu-subtitle">
            Choose a language for speech recognition.
          </div>
          {[["bn-BD", "Bangla"], ["en-US", "English"]].map(([code, label]) => (
            <button
              key={code}
              type="button"
              role="menuitemradio"
              aria-checked={language === code}
              className={language === code ? "is-active" : ""}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => chooseLanguage(menuMic, code)}
            >
              {label}
              {language === code ? <i className="fas fa-check" aria-hidden="true" /> : null}
            </button>
          ))}
          <button
            type="button"
            className="voice-input-enhancer__cancel"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => setMenuId(null)}
          >
            Cancel
          </button>
        </div>
      ) : null}
    </div>
  );
}
