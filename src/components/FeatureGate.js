import React from "react";
import { Link } from "react-router-dom";
import useFeatureFlags, { isFeatureOn } from "../hooks/useFeatureFlags";

/** Renders children only while the admin feature flag is on. */
const FeatureGate = ({ flag, title = "This feature is not available", children }) => {
  const flags = useFeatureFlags();
  if (isFeatureOn(flags, flag)) return children;

  return (
    <div className="container py-5 text-center">
      <h2 className="h4 mb-2">{title}</h2>
      <p className="text-muted mb-3">It has been turned off on Connect.</p>
      <Link to="/" className="btn btn-primary">
        Back to home
      </Link>
    </div>
  );
};

export default FeatureGate;
