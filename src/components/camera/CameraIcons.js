import React from "react";

export const IconClose = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

export const IconFlash = ({ mode }) => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M13 2L4.8 13.2c-.35.48.01 1.15.6 1.15H11l-1 7.8c-.08.62.7 1 1.12.55L19.2 10.8c.35-.48-.01-1.15-.6-1.15H13l1-7.1c.08-.6-.68-.98-1-.55z" />
    {mode === "off" && (
      <path
        d="M4 5l16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    )}
  </svg>
);

export const IconTimer = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="12" cy="13" r="8" />
    <path d="M12 9v4l2.5 1.5M9 3h6" />
  </svg>
);

export const IconFilters = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="7.5" cy="14" r="3.2" />
    <circle cx="14.5" cy="9.5" r="3.2" />
    <circle cx="16.5" cy="16.2" r="2.4" />
  </svg>
);

export const IconFlip = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 8a8 8 0 0 1 13.5-4.5L20 6" />
    <path d="M20 2v4h-4" />
    <path d="M20 16a8 8 0 0 1-13.5 4.5L4 18" />
    <path d="M4 22v-4h4" />
  </svg>
);

export const IconLibrary = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <rect x="4" y="6" width="14" height="14" rx="2.5" />
    <path d="M8 6V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-1" />
  </svg>
);

export const IconCamera = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
    <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h2l1.2-1.6A1.5 1.5 0 0 1 10.9 4h2.2c.46 0 .9.21 1.18.57L15.5 6h2A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-8z" />
    <circle cx="12" cy="12.5" r="3.4" />
  </svg>
);
