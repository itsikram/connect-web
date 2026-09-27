import React from "react";
import { Link, useLocation } from "react-router-dom";
import "./OfflineBanner.css";

/**
 * Shown while the device has no connection. Saved music and videos live in
 * IndexedDB, so they keep playing; point the user there instead of letting
 * online-only screens look broken.
 */
const OfflineBanner = () => {
  const location = useLocation();
  const onSavedPage = location.pathname.startsWith("/downloads");

  return (
    <div className="offline-banner" role="status" aria-live="polite">
      <i className="fas fa-wifi offline-banner-icon" aria-hidden="true" />
      <span className="offline-banner-text">
        {onSavedPage ? "Offline · saved media still plays" : "You're offline"}
      </span>
      {!onSavedPage && (
        <Link to="/downloads" className="offline-banner-link">
          Saved music
        </Link>
      )}
    </div>
  );
};

export default OfflineBanner;
