import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  isHelpSpeechBusy,
  isVoiceHelpEnabled,
  speakHelp,
  whenVoicesReady,
} from "../../utils/voiceHelp";
import "./VoiceHelp.css";

// Press and hold anything marked with data-speak="..." (and optionally
// data-speak-bn="...") to hear its name and see it in a big bubble. A normal
// tap still works as before; only a hold of HOLD_MS speaks, and the click that
// follows a hold is swallowed so holding never opens the page by accident.
const HOLD_MS = 550;
const MOVE_TOLERANCE_PX = 10;
const BUBBLE_MS = 2800;

const labelOf = (el) => ({
  en:
    el.getAttribute("data-speak") ||
    el.getAttribute("aria-label") ||
    (el.textContent || "").replace(/\s+/g, " ").trim(),
  bn: el.getAttribute("data-speak-bn") || "",
});

const speakTarget = (event) =>
  event.target instanceof Element ? event.target.closest("[data-speak]") : null;

const VoiceHelp = () => {
  const [bubble, setBubble] = useState(null);
  const bubbleRef = useRef(null);

  useEffect(() => {
    // Warm the voice list so the first hold already has a voice to use.
    whenVoicesReady();

    let holdTimer = null;
    let hideTimer = null;
    let start = null;
    let target = null;
    let fired = false;
    let started = false;
    let suppressEl = null;
    let suppressUntil = 0;
    let lastPointerType = "";

    const clearHold = () => {
      if (holdTimer) {
        clearTimeout(holdTimer);
        holdTimer = null;
      }
    };

    const reset = () => {
      clearHold();
      target?.classList.remove("voice-help-active");
      target = null;
      start = null;
      fired = false;
      started = false;
    };

    const show = (el, text) => {
      const rect = el.getBoundingClientRect();
      const below = rect.top < 96;
      setBubble({
        key: Date.now(),
        text,
        x: rect.left + rect.width / 2,
        y: below ? rect.bottom + 10 : rect.top - 10,
        below,
      });
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => setBubble(null), BUBBLE_MS);
    };

    const say = (el) => {
      const result = speakHelp(labelOf(el));
      if (result.utterance) {
        result.utterance.onstart = () => {
          started = true;
        };
      }
      return result;
    };

    const onPointerDown = (event) => {
      lastPointerType = event.pointerType;
      // A new touch starts a new gesture: any click still pending from an
      // earlier hold has already happened (or never will), so stop waiting.
      suppressEl = null;
      // Touch and pen only: a mouse has hover titles and a right-click menu,
      // and a slow mouse click must never be swallowed.
      if (event.pointerType === "mouse" || !isVoiceHelpEnabled()) return;
      const el = speakTarget(event);
      if (!el) return;
      reset();
      target = el;
      start = { x: event.clientX, y: event.clientY };
      holdTimer = setTimeout(() => {
        holdTimer = null;
        if (!target) return;
        fired = true;
        target.classList.add("voice-help-active");
        try {
          navigator.vibrate?.(18);
        } catch (_) {
          // vibration is optional
        }
        const result = say(target);
        show(target, result.text);
      }, HOLD_MS);
    };

    const onPointerMove = (event) => {
      if (!holdTimer || !start) return;
      if (
        Math.hypot(event.clientX - start.x, event.clientY - start.y) >
        MOVE_TOLERANCE_PX
      ) {
        reset();
      }
    };

    const onPointerUp = () => {
      if (fired && target) {
        // iPhones only let speech start from a touch. If the hold could not
        // start it, lifting the finger (a real touch event) does.
        if (!started && !isHelpSpeechBusy()) say(target);
        suppressEl = target;
        suppressUntil = Date.now() + 900;
      }
      reset();
    };

    const onClick = (event) => {
      if (!suppressEl) return;
      const el = speakTarget(event);
      const swallow = el === suppressEl && Date.now() <= suppressUntil;
      suppressEl = null;
      if (swallow) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    // Android opens a link menu on long-press; iOS shows a link preview. A
    // mouse right-click keeps the normal menu ("Open in new tab"...).
    const onContextMenu = (event) => {
      if (lastPointerType === "mouse") return;
      if (isVoiceHelpEnabled() && speakTarget(event)) event.preventDefault();
    };

    const onScroll = () => {
      if (holdTimer) reset();
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("pointermove", onPointerMove, true);
    document.addEventListener("pointerup", onPointerUp, true);
    document.addEventListener("pointercancel", reset, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("contextmenu", onContextMenu, true);
    window.addEventListener("scroll", onScroll, true);

    return () => {
      reset();
      clearTimeout(hideTimer);
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("pointermove", onPointerMove, true);
      document.removeEventListener("pointerup", onPointerUp, true);
      document.removeEventListener("pointercancel", reset, true);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("contextmenu", onContextMenu, true);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, []);

  // Keep the bubble inside the screen once its real width is known.
  useLayoutEffect(() => {
    const node = bubbleRef.current;
    if (!node || !bubble) return;
    const margin = 12;
    const width = node.offsetWidth;
    const viewport = document.documentElement.clientWidth || window.innerWidth;
    const left = Math.min(
      Math.max(bubble.x - width / 2, margin),
      Math.max(margin, viewport - width - margin),
    );
    node.style.left = `${left}px`;
    node.style.setProperty("--voice-help-arrow-x", `${bubble.x - left}px`);
  }, [bubble]);

  if (!bubble) return null;

  return (
    <div
      key={bubble.key}
      ref={bubbleRef}
      className={`voice-help-bubble${bubble.below ? " is-below" : ""}`}
      style={{ top: bubble.y }}
      role="status"
      aria-live="polite"
    >
      <span className="voice-help-bubble-icon" aria-hidden="true">
        <i className="fas fa-volume-up" />
      </span>
      <span className="voice-help-bubble-text">{bubble.text}</span>
    </div>
  );
};

export default VoiceHelp;
