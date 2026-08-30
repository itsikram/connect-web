import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Click-to-open / click-again-to-close menu helper.
 * Attach `rootRef` to a wrapper that includes both the trigger and the panel
 * so document click-outside does not fight the toggle.
 */
export default function useToggleMenu(initialOpen = false) {
  const [open, setOpen] = useState(initialOpen);
  const rootRef = useRef(null);

  const toggle = useCallback((event) => {
    event?.stopPropagation?.();
    setOpen((prev) => !prev);
  }, []);

  const close = useCallback(() => setOpen(false), []);
  const openMenu = useCallback(() => setOpen(true), []);

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return { open, setOpen, toggle, close, openMenu, rootRef };
}
