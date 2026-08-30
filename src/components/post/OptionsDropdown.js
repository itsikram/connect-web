import React, { useEffect, useRef } from "react";

const OptionsDropdown = ({
  open,
  onToggle,
  onClose,
  ariaLabel = "Options",
  buttonClassName = "post-three-dot",
  menuClassName = "post-option-menu",
  iconClassName = "far fa-ellipsis-h",
  children,
}) => {
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        onClose?.();
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose?.();
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  return (
    <div
      className={`options-dropdown${open ? " is-open" : ""}`}
      ref={rootRef}
    >
      <button
        type="button"
        className={buttonClassName}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="menu"
        onMouseDown={(event) => {
          event.stopPropagation();
        }}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onToggle?.();
        }}
      >
        <i className={iconClassName} aria-hidden="true"></i>
      </button>
      {open ? (
        <div className={menuClassName} role="menu">
          {children}
        </div>
      ) : null}
    </div>
  );
};

export default OptionsDropdown;
