import React from "react";
import { VerifiedBadge } from "./OfficialBadge";

const VerifiedName = ({ profile, children, className = "" }) => (
  <span className={`connect-author-name ${className}`.trim()}>
    {children}
    {profile?.isVerified ? <VerifiedBadge /> : null}
  </span>
);

export default VerifiedName;
