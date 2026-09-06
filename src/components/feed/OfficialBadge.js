import React from "react";
import "./OfficialBadge.css";

const OfficialBadge = ({ compact = false }) => (
  <span
    className={`connect-official-badge ${compact ? "is-compact" : ""}`}
    title="Official Connect account"
  >
    <i className="fas fa-check" aria-hidden="true" />
    {!compact && <span>Official</span>}
  </span>
);

export const VerifiedBadge = () => (
  <span
    className="connect-verified-badge"
    title="Verified profile"
    aria-label="Verified profile"
  >
    <i className="fas fa-check" aria-hidden="true" />
  </span>
);

export const AuthorDisplayName = ({ author, className = "" }) => {
  if (!author) return null;
  const name = author.fullName || author.displayName || "Connect";
  return (
    <span className={`connect-author-name ${className}`.trim()}>
      {name}
      {author.isVerified ? <VerifiedBadge /> : null}
      {author.isOfficial ? <OfficialBadge compact /> : null}
    </span>
  );
};

export default OfficialBadge;
