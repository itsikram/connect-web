import React, { useCallback, useEffect, useRef, useState } from "react";
import useComposerLiveTranscribe from "../hooks/useComposerLiveTranscribe";
import "./VoiceInputEnhancer.css";

const TEXT_INPUT_TYPES = new Set(["", "text", "search", "email", "url", "tel"]);

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

export default function VoiceInputEnhancer() {
  const [target, setTarget] = useState(null);
  const [language, setLanguage] = useState("en-US");
  const [position, setPosition] = useState(null);
  const baseTextRef = useRef("");
  const targetRef = useRef(null);
  const applyingTranscriptRef = useRef(false);

  const applyTranscript = useCallback((text) => {
    const element = targetRef.current;
    if (!element || !text) return;
    const next = [baseTextRef.current.trim(), text.trim()].filter(Boolean).join(" ");
    applyingTranscriptRef.current = true;
    baseTextRef.current = next;
    setInputValue(element, next);
  }, []);

  const { listening, start, stop } = useComposerLiveTranscribe({
    onFinal: applyTranscript,
  });

  const updatePosition = useCallback(() => {
    const element = targetRef.current;
    if (!element || !isVoiceInput(element)) {
      setPosition(null);
      return;
    }
    const rect = element.getBoundingClientRect();
    setPosition({
      top: Math.max(8, rect.top + Math.min(rect.height - 42, 8)),
      right: Math.max(8, window.innerWidth - rect.right + 6),
    });
  }, []);

  useEffect(() => {
    const handleFocus = (event) => {
      if (!isVoiceInput(event.target)) return;
      if (targetRef.current && targetRef.current !== event.target) stop();
      targetRef.current = event.target;
      baseTextRef.current = event.target.value;
      setTarget(event.target);
      updatePosition();
    };
    const handleInput = (event) => {
      if (event.target !== targetRef.current || applyingTranscriptRef.current) {
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

  if (!target || !position) return null;

  const toggleVoice = () => {
    if (listening) {
      stop();
      return;
    }
    baseTextRef.current = target.value;
    start(language).then((started) => {
      if (!started) {
        window.alert(
          "Could not start voice input. Please allow microphone access and try again.",
        );
      }
    });
  };

  return (
    <div
      className="voice-input-enhancer"
      style={{ top: position.top, right: position.right }}
    >
      <select
        value={language}
        onChange={(event) => setLanguage(event.target.value)}
        aria-label="Voice recognition language"
        title="Voice recognition language"
      >
        <option value="en-US">EN</option>
        <option value="bn-BD">বাং</option>
      </select>
      <button
        type="button"
        onClick={toggleVoice}
        onMouseDown={(event) => event.preventDefault()}
        className={listening ? "is-listening" : ""}
        aria-label={listening ? "Stop voice input" : "Start voice input"}
        title={listening ? "Stop voice input" : `Start ${language.startsWith("bn") ? "Bangla" : "English"} voice input`}
      >
        <i className={`fas ${listening ? "fa-stop" : "fa-microphone"}`} aria-hidden="true" />
      </button>
    </div>
  );
}
