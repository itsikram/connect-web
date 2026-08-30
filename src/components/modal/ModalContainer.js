import React, { useEffect, useState } from "react";
import Modal from "react-modal";
import "./ModalContainer.css";

const CLOSE_MS = 180;

const POSITION_KEYS = new Set([
  "top",
  "left",
  "right",
  "bottom",
  "inset",
  "marginRight",
  "transform",
]);

if (typeof document !== "undefined" && document.getElementById("root")) {
  Modal.setAppElement("#root");
}

const resetOverlayStyle = {
  position: "fixed",
  inset: 0,
  backgroundColor: "transparent",
};

const resetContentStyle = {
  position: "relative",
  top: "auto",
  left: "auto",
  right: "auto",
  bottom: "auto",
  border: "none",
  background: "transparent",
  overflow: "auto",
  borderRadius: 0,
  padding: 0,
  inset: "auto",
};

const pickContentStyle = (style) => {
  if (!style) return resetContentStyle;
  const next = { ...resetContentStyle };
  Object.keys(style).forEach((key) => {
    if (!POSITION_KEYS.has(key)) {
      next[key] = style[key];
    }
  });
  return next;
};

const ModalContainer = ({
  children,
  title,
  style,
  isOpen,
  onRequestClose,
  id,
  isFullscreen,
  size,
  className = "",
}) => {
  const [mounted, setMounted] = useState(!!isOpen);

  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      return undefined;
    }
    const timer = setTimeout(() => setMounted(false), CLOSE_MS);
    return () => clearTimeout(timer);
  }, [isOpen]);

  if (!isOpen && !mounted) {
    return null;
  }

  const contentClass = [
    "app-modal-content",
    isFullscreen ? "is-fullscreen" : "",
    size === "sm" ? "is-sm" : "",
    size === "lg" ? "is-lg" : "",
    style?.padding === 0 || style?.padding === "0" ? "is-flush" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Modal
      isOpen={!!isOpen}
      onRequestClose={onRequestClose}
      shouldCloseOnOverlayClick
      shouldCloseOnEsc
      closeTimeoutMS={CLOSE_MS}
      contentLabel={title || "Dialog"}
      id={id}
      className={{
        base: contentClass,
        afterOpen: "app-modal-content--open",
        beforeClose: "app-modal-content--close",
      }}
      overlayClassName={{
        base: "app-modal-overlay",
        afterOpen: "app-modal-overlay--open",
        beforeClose: "app-modal-overlay--close",
      }}
      bodyOpenClassName="app-modal-open"
      htmlOpenClassName="app-modal-open-html"
      style={{
        overlay: resetOverlayStyle,
        content: pickContentStyle(style),
      }}
    >
      {children}
    </Modal>
  );
};

export default ModalContainer;
