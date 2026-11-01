import React, { useCallback, useEffect, useRef, useState } from "react";
import useComposerLiveTranscribe from "../hooks/useComposerLiveTranscribe";
import "./VoiceInputEnhancer.css";

// Mirrors the Expo app's VoiceTextInput: every visible text field gets a mic
// icon inside its right edge, vertically centred. Tap toggles listening
// (mic -> red stop); long-press or right-click opens a Bangla/English picker
// that restarts capture in the chosen language. Opt a field out with
// data-voice-input="false".
//
// Like the app, where the mic is an absolutely positioned child of the
// field's own wrapper, each mic is inserted right after its field in the
// field's parent. The browser then lays it out and scrolls it together with
// the field, so it stays put while the page or any inner list scrolls,
// instead of floating in a fixed overlay that is re-positioned after every
// scroll.

// Like the app (voiceEnabled only for the default keyboard), skip email,
// phone, url, number and password fields.
const TEXT_INPUT_TYPES = new Set(["", "text", "search"]);
const LANGUAGE_STORAGE_KEY = "voiceInputLanguage";
const LONG_PRESS_MS = 400;
// 32px circle whose centre sits 20px from the field's right edge, matching
// the app's touch target (right: 2, paddingHorizontal: 8, 20px icon).
const MIC_SIZE = 32;
const MIC_INSET = 4;
const MIN_FIELD_WIDTH = 80;
const MIN_FIELD_HEIGHT = 24;
const RESCAN_INTERVAL_MS = 1000;
const MAX_HOST_DESCENDANTS = 200;
// A neutral custom element, so page rules aimed at buttons never style it.
const MIC_TAG = "voice-input-mic";
const MIC_CLASS = "voice-input-enhancer__mic";
const MEASURING_CLASS = "voice-input-measuring";
const OBSERVED_ATTRIBUTES = [
  "class",
  "style",
  "hidden",
  "disabled",
  "readonly",
  "type",
  "data-voice-input",
];
// Keep the mic's own presses away from handlers on the field's ancestors
// (a clickable card, a wrapper that focuses its field, swipe handlers).
const ISOLATED_EVENTS = [
  "click",
  "dblclick",
  "mousedown",
  "mouseup",
  "pointerdown",
  "pointerup",
  "touchstart",
  "touchend",
  "contextmenu",
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

const isMicElement = (node) =>
  node instanceof Element && node.localName === MIC_TAG && node.classList.contains(MIC_CLASS);

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

const rightRadii = (element) => {
  const style = window.getComputedStyle(element);
  return { top: style.borderTopRightRadius, bottom: style.borderBottomRightRadius };
};

const releaseKeptRadius = (mic) => {
  if (!mic.keptRadius) return;
  mic.field.removeAttribute("data-voice-mic-radius");
  mic.field.style.removeProperty("--voice-mic-radius-top");
  mic.field.style.removeProperty("--voice-mic-radius-bottom");
  mic.keptRadius = false;
};

const SCROLLABLE_OVERFLOW =/(auto|scroll|hidden|overlay)/;

// True when a clipping/scrolling box sits between the field and the mic's
// containing block: the mic would then not scroll (or clip) with the field.
const hasScrollerBetween = (field, containingBlock) => {
  for (let element = field.parentElement; element && element !== containingBlock;
    element = element.parentElement) {
    if (element === document.body || element === document.documentElement) return false;
    const style = window.getComputedStyle(element);
    if (SCROLLABLE_OVERFLOW.test(`${style.overflowX} ${style.overflowY}`)) return true;
  }
  return false;
};

// Making the parent `position: relative` is only safe when it changes nothing
// else: no offsets or z-index waiting to take effect, and no absolutely
// positioned descendant that would be re-anchored to it.
const canAnchorTo = (host) => {
  const style = window.getComputedStyle(host);
  if (style.position !== "static" || style.display === "contents") return false;
  if (style.zIndex !== "auto") return false;
  if (["top", "right", "bottom", "left"].some((side) => style[side] !== "auto")) return false;
  const descendants = host.getElementsByTagName("*");
  if (descendants.length > MAX_HOST_DESCENDANTS) return false;
  for (let index = 0; index < descendants.length; index += 1) {
    const descendant = descendants[index];
    if (isMicElement(descendant)) continue;
    if (window.getComputedStyle(descendant).position === "absolute") return false;
  }
  return true;
};

export default function VoiceInputEnhancer() {
  const [language, setLanguage] = useState(initialLanguage);
  const [activeId, setActiveId] = useState(null);
  const [menu, setMenu] = useState(null);
  const layerRef = useRef(null);
  // field element -> { id, field, el, shown, left, top, padded, ... }
  const micsRef = useRef(new Map());
  const nextIdRef = useRef(1);
  const frameRef = useRef(0);
  const targetRef = useRef(null);
  const baseTextRef = useRef("");
  const applyingTranscriptRef = useRef(false);
  const lastFinalRef = useRef("");
  const longPressTimerRef = useRef(null);
  const longPressedRef = useRef(false);
  const handlersRef = useRef({});
  const viewRef = useRef({ listening: false, activeId: null, language });

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

  const paintMic = useCallback((mic) => {
    const view = viewRef.current;
    const isListening = view.listening && view.activeId === mic.id;
    const languageName = view.language.startsWith("bn") ? "Bangla" : "English";
    const label = isListening ? "Stop voice input" : `Start ${languageName} voice input`;
    mic.el.classList.toggle("is-listening", isListening);
    mic.icon.className = `fas ${isListening ? "fa-stop" : "fa-microphone"}`;
    mic.el.setAttribute("aria-label", label);
    mic.el.setAttribute("title", isListening
      ? label
      : `${label} (long-press to change language)`);
  }, []);

  const createMic = useCallback((field) => {
    const mic = {
      id: nextIdRef.current++,
      field,
      el: document.createElement(MIC_TAG),
      icon: document.createElement("i"),
      shown: false,
      left: 0,
      top: 0,
      padded: false,
      anchoredHost: null,
      keptRadius: false,
    };
    const { el, icon } = mic;
    el.className = MIC_CLASS;
    el.setAttribute("role", "button");
    el.setAttribute("tabindex", "-1");
    el.setAttribute("aria-haspopup", "menu");
    el.setAttribute("data-voice-input", "false");
    el.hidden = true;
    el.style.left = "0px";
    el.style.top = "0px";
    icon.setAttribute("aria-hidden", "true");
    el.appendChild(icon);

    ISOLATED_EVENTS.forEach((name) => el.addEventListener(name, (event) => {
      event.stopPropagation();
      handlersRef.current[name]?.(event, mic);
    }));
    el.addEventListener("pointerleave", () => handlersRef.current.pointerleave?.());
    el.addEventListener("pointercancel", () => handlersRef.current.pointercancel?.());
    el.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      event.stopPropagation();
      handlersRef.current.activate?.(mic);
    });
    paintMic(mic);
    return mic;
  }, [paintMic]);

  // Put the mic directly after its field (React reorders or re-parents
  // fields; the mic follows on the next pass).
  const attachMic = useCallback((mic) => {
    const { field, el } = mic;
    if (el.previousElementSibling === field && el.parentElement === field.parentElement) return;
    const wasLast = !field.nextElementSibling;
    const before = wasLast && !mic.keptRadius ? rightRadii(field) : null;
    field.insertAdjacentElement("afterend", el);
    // Becoming the parent's last child must not change how the field looks
    // (Bootstrap input groups square off the corners of non-last children).
    if (before) {
      const after = rightRadii(field);
      if (after.top !== before.top || after.bottom !== before.bottom) {
        field.style.setProperty("--voice-mic-radius-top", before.top);
        field.style.setProperty("--voice-mic-radius-bottom", before.bottom);
        field.setAttribute("data-voice-mic-radius", "true");
        mic.keptRadius = true;
      }
    }
    // Anchor the mic inside any scroller that also holds the field.
    el.hidden = false;
    const host = field.parentElement;
    if (!mic.anchoredHost && host && hasScrollerBetween(field, el.offsetParent)
      && canAnchorTo(host)) {
      host.setAttribute("data-voice-mic-host", "true");
      mic.anchoredHost = host;
    }
    el.hidden = !mic.shown;
  }, []);

  const removeMic = useCallback((mic) => {
    mic.el.remove();
    if (mic.padded) mic.field.removeAttribute("data-voice-mic");
    releaseKeptRadius(mic);
    const host = mic.anchoredHost;
    if (host) {
      const stillUsed = [...micsRef.current.values()]
        .some((other) => other !== mic && other.anchoredHost === host);
      if (!stillUsed) host.removeAttribute("data-voice-mic-host");
    }
    micsRef.current.delete(mic.field);
  }, []);

  const measure = useCallback(() => {
    frameRef.current = 0;
    const mics = micsRef.current;
    const root = document.documentElement;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Pass 1 (reads): decide which fields show a mic. Our own mics are made
    // transparent to hit-testing while we look.
    root.classList.add(MEASURING_CLASS);
    const eligible = new Map();
    document.querySelectorAll("input, textarea").forEach((field) => {
      if (!isVoiceInput(field) || !field.parentElement) return;
      const rect = field.getBoundingClientRect();
      if (rect.width < MIN_FIELD_WIDTH || rect.height < MIN_FIELD_HEIGHT) return;
      const x = rect.right - MIC_INSET - MIC_SIZE / 2;
      const y = rect.top + rect.height / 2;
      const existing = mics.get(field);
      if (x >= 0 && y >= 0 && x < viewportWidth && y < viewportHeight) {
        // Only show the mic where the field is actually on top: this hides it
        // for fields that are clipped, behind a modal, or that already have
        // their own control at the right edge.
        eligible.set(field, document.elementFromPoint(x, y) === field);
      } else if (existing) {
        // Off screen: keep the last decision so mics don't blink at the edge.
        eligible.set(field, existing.shown);
      }
    });
    root.classList.remove(MEASURING_CLASS);

    // Pass 2 (writes): create, move, show/hide and pad.
    mics.forEach((mic, field) => {
      if (!eligible.has(field)) removeMic(mic);
    });
    eligible.forEach((show, field) => {
      let mic = mics.get(field);
      if (!mic) {
        if (!show) return;
        mic = createMic(field);
        mics.set(field, mic);
      }
      mic.shown = show;
      attachMic(mic);
      if (mic.keptRadius && mic.el.nextElementSibling) releaseKeptRadius(mic);
      if (mic.el.hidden === show) mic.el.hidden = !show;
      // Reserve room for the mic so typed text never runs under it.
      if (show && !mic.padded && mic.needsPadding === undefined) {
        const paddingRight = parseFloat(window.getComputedStyle(field).paddingRight) || 0;
        mic.needsPadding = paddingRight < MIC_SIZE + MIC_INSET;
      }
      const pad = show && !!mic.needsPadding;
      if (pad !== mic.padded) {
        if (pad) field.setAttribute("data-voice-mic", "true");
        else field.removeAttribute("data-voice-mic");
        mic.padded = pad;
      }
    });

    // Pass 3: line each visible mic up with its field's right edge, centred
    // vertically. Done as a correction from where it currently is, so it
    // works whatever its containing block is; once placed, scrolling moves
    // mic and field together and nothing needs rewriting.
    const placements = [];
    mics.forEach((mic) => {
      if (!mic.shown) return;
      const fieldRect = mic.field.getBoundingClientRect();
      const micRect = mic.el.getBoundingClientRect();
      placements.push({ mic, fieldRect, micRect });
    });
    placements.forEach(({ mic, fieldRect, micRect }) => {
      if (!micRect.width) return;
      const scale = micRect.width / MIC_SIZE;
      const wantLeft = fieldRect.right - (MIC_INSET + MIC_SIZE) * scale;
      const wantTop = fieldRect.top + (fieldRect.height - MIC_SIZE * scale) / 2;
      const left = Math.round(mic.left + (wantLeft - micRect.left) / scale);
      const top = Math.round(mic.top + (wantTop - micRect.top) / scale);
      if (left !== mic.left) {
        mic.left = left;
        mic.el.style.left = `${left}px`;
      }
      if (top !== mic.top) {
        mic.top = top;
        mic.el.style.top = `${top}px`;
      }
    });

    if (targetRef.current && !document.contains(targetRef.current)) {
      stop();
      targetRef.current = null;
      setActiveId(null);
    }
  }, [attachMic, createMic, removeMic, stop]);

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
    const isOwnMutation = (record) => {
      const layer = layerRef.current;
      if (isMicElement(record.target) || layer?.contains(record.target)) return true;
      if (record.target instanceof Element && record.target.closest?.(MIC_TAG)) return true;
      if (record.type !== "childList") return false;
      const nodes = [...record.addedNodes, ...record.removedNodes];
      return nodes.length > 0 && nodes.every(isMicElement);
    };
    const observer = new MutationObserver((records) => {
      if (records.some((record) => !isOwnMutation(record))) scheduleMeasure();
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
    // Scrolling no longer moves mics; it can only reveal or cover fields.
    window.addEventListener("scroll", scheduleMeasure, true);
    scheduleMeasure();
    const mics = micsRef.current;
    return () => {
      observer.disconnect();
      window.clearInterval(interval);
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = 0;
      document.removeEventListener("input", handleInput, true);
      layoutEvents.forEach((name) => document.removeEventListener(name, scheduleMeasure, true));
      window.removeEventListener("resize", scheduleMeasure);
      window.removeEventListener("scroll", scheduleMeasure, true);
      [...mics.values()].forEach(removeMic);
    };
  }, [removeMic, scheduleMeasure]);

  // Keep each mic's icon and label in sync with listening state.
  useEffect(() => {
    viewRef.current = { listening, activeId, language };
    micsRef.current.forEach(paintMic);
  }, [listening, activeId, language, paintMic]);

  useEffect(() => {
    if (!menu) return undefined;
    const closeOnOutside = (event) => {
      if (!layerRef.current?.contains(event.target)) setMenu(null);
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setMenu(null);
    };
    // The menu is placed once when it opens, so close it rather than let it
    // drift away from its mic.
    const closeOnMove = (event) => {
      if (!layerRef.current?.contains(event.target)) setMenu(null);
    };
    document.addEventListener("pointerdown", closeOnOutside, true);
    document.addEventListener("keydown", closeOnEscape);
    window.addEventListener("scroll", closeOnMove, true);
    window.addEventListener("resize", closeOnMove);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside, true);
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("scroll", closeOnMove, true);
      window.removeEventListener("resize", closeOnMove);
    };
  }, [menu]);

  useEffect(() => () => window.clearTimeout(longPressTimerRef.current), []);

  const startListening = (mic, nextLanguage) => {
    targetRef.current = mic.field;
    lastFinalRef.current = "";
    baseTextRef.current = mic.field.value;
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
    setMenu(null);
    const isActive = listening && activeId === mic.id;
    if (listening) stop();
    if (isActive) {
      targetRef.current = null;
      setActiveId(null);
      return;
    }
    startListening(mic, language);
  };

  const openMenu = (mic) => {
    const rect = mic.el.getBoundingClientRect();
    const above = rect.bottom + 180 > window.innerHeight;
    setMenu({
      mic,
      above,
      top: above ? rect.top - 4 : rect.bottom + 4,
      left: Math.max(8, rect.right - 200),
    });
  };

  const chooseLanguage = (mic, nextLanguage) => {
    setLanguage(nextLanguage);
    setMenu(null);
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
    } catch {}
    const wasListening = listening;
    if (wasListening) stop();
    // Restart after stop() settles so the new recognizer starts cleanly.
    window.setTimeout(() => startListening(mic, nextLanguage), wasListening ? 150 : 0);
  };

  const cancelPress = () => window.clearTimeout(longPressTimerRef.current);

  // Native listeners on the mics call through this ref so they always see
  // the latest state.
  handlersRef.current = {
    mousedown: (event) => event.preventDefault(), // keep focus in the field
    pointerdown: (event, mic) => {
      longPressedRef.current = false;
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = window.setTimeout(() => {
        longPressedRef.current = true;
        openMenu(mic);
      }, LONG_PRESS_MS);
    },
    pointerup: cancelPress,
    pointerleave: cancelPress,
    pointercancel: cancelPress,
    contextmenu: (event, mic) => {
      event.preventDefault();
      cancelPress();
      openMenu(mic);
    },
    click: (event, mic) => {
      event.preventDefault();
      if (longPressedRef.current) {
        longPressedRef.current = false;
        return;
      }
      toggleVoice(mic);
    },
    activate: (mic) => toggleVoice(mic),
  };

  const menuMic = menu && document.contains(menu.mic.el) ? menu.mic : null;

  return (
    <div ref={layerRef} className="voice-input-enhancer">
      {menuMic ? (
        <div
          className={`voice-input-enhancer__menu${menu.above ? " is-above" : ""}`}
          role="menu"
          style={{ top: menu.top, left: menu.left }}
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
            onClick={() => setMenu(null)}
          >
            Cancel
          </button>
        </div>
      ) : null}
    </div>
  );
}
