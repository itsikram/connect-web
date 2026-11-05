import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import "./ConfirmLogoutDialog.css";

// Logging out by mistake is costly for someone who cannot type a password
// back in easily, so log out always asks first, with two big clear buttons.
// "No, stay" has the focus so Enter or a stray tap keeps the user signed in.
const ConfirmLogoutDialog = ({ open, onConfirm, onCancel }) => {
  const stayRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    stayRef.current?.focus();
    const onKey = (event) => {
      if (event.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      if (previous && typeof previous.focus === "function") previous.focus();
    };
  }, [open, onCancel]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="logout-confirm-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="logout-confirm"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="logout-confirm-title"
        aria-describedby="logout-confirm-desc"
        onClick={(event) => event.stopPropagation()}
      >
        <span className="logout-confirm-icon" aria-hidden="true">
          <i className="fas fa-sign-out-alt" />
        </span>
        <h2 className="logout-confirm-title" id="logout-confirm-title">
          Log out?
        </h2>
        <p className="logout-confirm-desc" id="logout-confirm-desc">
          You will have to log in again to use Connect.
        </p>
        <div className="logout-confirm-actions">
          <button
            type="button"
            className="logout-confirm-btn is-yes"
            onClick={onConfirm}
            data-speak="Yes, log out"
            data-speak-bn="হ্যাঁ, লগ আউট করুন"
          >
            <i className="fas fa-check" aria-hidden="true" />
            Yes, log out
          </button>
          <button
            type="button"
            className="logout-confirm-btn is-no"
            ref={stayRef}
            onClick={onCancel}
            data-speak="No, stay here"
            data-speak-bn="না, থাকুন"
          >
            <i className="fas fa-times" aria-hidden="true" />
            No, stay
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default ConfirmLogoutDialog;
