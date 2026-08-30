import React from "react";

const iconPaths = {
  play: <path d="M8 5.5v13l10-6.5-10-6.5Z" fill="currentColor" stroke="none" />,
  leave: (
    <>
      <path d="M14 8V5.5A1.5 1.5 0 0 0 12.5 4h-6A1.5 1.5 0 0 0 5 5.5v13A1.5 1.5 0 0 0 6.5 20h6a1.5 1.5 0 0 0 1.5-1.5V16" />
      <path d="M10 12h9m-3-3 3 3-3 3" />
    </>
  ),
  restart: (
    <>
      <path d="M4 7v5h5" />
      <path d="M5.6 16.5A8 8 0 1 0 5 8.5L4 12" />
    </>
  ),
  bug: (
    <>
      <path d="M9 9h6v7a3 3 0 0 1-6 0V9Z" />
      <path d="M10 9V7a2 2 0 0 1 4 0v2M6 11h3m6 0h3M6 15h3m6 0h3M8 6 6.5 4.5M16 6l1.5-1.5" />
    </>
  ),
  controls: (
    <>
      <path d="M4 7h10m4 0h2M4 17h2m4 0h10M4 12h4m4 0h8" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="8" cy="17" r="2" />
      <circle cx="10" cy="12" r="2" />
    </>
  ),
  volume: (
    <>
      <path d="M5 10v4h3l4 3V7L8 10H5Z" />
      <path d="M15 9.5a4 4 0 0 1 0 5M17.5 7a7 7 0 0 1 0 10" />
    </>
  ),
  volumeOff: (
    <>
      <path d="M5 10v4h3l4 3V7L8 10H5Z" />
      <path d="m16 10 4 4m0-4-4 4" />
    </>
  ),
  mic: (
    <>
      <path d="M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3Z" />
      <path d="M19 11a7 7 0 0 1-14 0M12 18v3" />
    </>
  ),
  micOff: (
    <>
      <path d="M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3Z" />
      <path d="M19 11a7 7 0 0 1-14 0M12 18v3" />
      <path d="m5 5 14 14" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 7v5h-5" />
      <path d="M18.4 7.5A8 8 0 1 0 19 15" />
    </>
  ),
  reconnect: (
    <>
      <path d="M9 12V7m6 5V7M7 12h10v2a5 5 0 0 1-10 0v-2Z" />
      <path d="M12 19v2" />
    </>
  ),
  invite: (
    <>
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="m4 8 8 6 8-6" />
      <path d="M17 3v6m-3-3h6" />
    </>
  ),
};

export const LudoIcon = ({ name, size = 18, className = "" }) => (
  <svg
    className={className}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    {iconPaths[name] || null}
  </svg>
);
