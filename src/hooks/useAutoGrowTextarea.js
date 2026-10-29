import { useCallback, useLayoutEffect, useState } from "react";

/**
 * Grows a <textarea> with its content, from one line up to `maxLines`
 * lines, after which it scrolls. Recomputes whenever `value` changes
 * (typing, paste, emoji, voice transcription, clearing after send) and
 * when the textarea's width changes.
 *
 * Returns `isMultiline` so the caller can adjust surrounding layout
 * (e.g. keep buttons on the bottom line) only once the text wraps.
 */
export default function useAutoGrowTextarea(ref, value, maxLines = 5) {
  const [isMultiline, setIsMultiline] = useState(false);

  const resize = useCallback(() => {
    const el = ref?.current;
    if (!el || el.tagName !== "TEXTAREA") return;

    const cs = window.getComputedStyle(el);
    const fontSize = parseFloat(cs.fontSize) || 16;
    let lineHeight = parseFloat(cs.lineHeight);
    if (!Number.isFinite(lineHeight)) lineHeight = fontSize * 1.2; // "normal"

    const padding =
      (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
    const border =
      (parseFloat(cs.borderTopWidth) || 0) +
      (parseFloat(cs.borderBottomWidth) || 0);
    const isBorderBox = cs.boxSizing === "border-box";

    // Hidden or not laid out yet: measuring now would be wrong; the
    // ResizeObserver below re-runs this once the textarea gets a width.
    if (!el.clientWidth) return;

    // Empty composer is always exactly one line. Browsers count a wrapped
    // placeholder in scrollHeight, which would otherwise open it at 2 lines.
    const isEmpty = !String(el.value || "").length;

    // Measure the natural height of the text (scrollHeight includes padding).
    el.style.height = "auto";
    const textHeight = isEmpty
      ? lineHeight
      : Math.max(el.scrollHeight - padding, lineHeight);
    const maxTextHeight = lineHeight * maxLines;
    const shownTextHeight = Math.min(textHeight, maxTextHeight);

    const toBoxHeight = (h) => (isBorderBox ? h + padding + border : h);
    el.style.height = `${Math.ceil(toBoxHeight(shownTextHeight))}px`;
    el.style.maxHeight = `${Math.ceil(toBoxHeight(maxTextHeight))}px`;
    el.style.overflowY = textHeight > maxTextHeight + 1 ? "auto" : "hidden";

    setIsMultiline(textHeight > lineHeight * 1.5);
  }, [ref, maxLines]);

  useLayoutEffect(() => {
    resize();
  }, [value, resize]);

  useLayoutEffect(() => {
    const el = ref?.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    let lastWidth = el.clientWidth;
    const ro = new ResizeObserver(() => {
      if (el.clientWidth !== lastWidth) {
        lastWidth = el.clientWidth;
        resize();
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, resize]);

  return isMultiline;
}
