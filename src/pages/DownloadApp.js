import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { getServerAddress } from "../utils/offlineUtils";
import { openIosProfile } from "../utils/iosProfile";
import "./Menu.css";
import "./DownloadApp.css";

const EXPO_GO_IOS = "https://apps.apple.com/app/expo-go/id982107779";
const EXPO_GO_ANDROID = "https://play.google.com/store/apps/details?id=host.exp.exponent";

const detectPlatform = () => {
  const ua = window.navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) {
    return "ios";
  }
  if (/android/.test(ua)) return "android";
  return "other";
};

const DownloadCard = ({ accent, icon, name, desc, badge, disabled, href, to, onClick }) => {
  const body = (
    <>
      <span className="apps-menu-icon" aria-hidden="true">
        <i className={icon} />
      </span>
      <span className="apps-menu-text">
        <span className="apps-menu-name">
          {name}
          {badge && <span className="download-app-badge">{badge}</span>}
        </span>
        <span className="apps-menu-desc">{desc}</span>
      </span>
      <i
        className={`fas ${disabled ? "fa-clock" : to ? "fa-chevron-right" : "fa-download"} apps-menu-chevron`}
        aria-hidden="true"
      />
    </>
  );
  const props = {
    className: `apps-menu-card download-app-card${disabled ? " is-disabled" : ""}`,
    style: { "--app-accent": accent },
  };

  if (disabled) {
    return (
      <div {...props} aria-disabled="true">
        {body}
      </div>
    );
  }
  if (to) {
    return (
      <Link {...props} to={to}>
        {body}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" {...props} onClick={onClick}>
        {body}
      </button>
    );
  }
  return (
    <a {...props} href={href} target="_blank" rel="noreferrer">
      {body}
    </a>
  );
};

/** /download-app — Android, iOS and Expo Go install options. */
const DownloadApp = () => {
  const [links, setLinks] = useState({ apkUrl: "", ipaUrl: "", appVersion: "" });
  const [loaded, setLoaded] = useState(false);
  const platform = detectPlatform();

  useEffect(() => {
    let cancelled = false;
    // APK / IPA links are set in the admin panel (Settings → General).
    axios
      .get(`${getServerAddress()}/api/connect`)
      .then((res) => {
        if (!cancelled && res.data) setLinks((prev) => ({ ...prev, ...res.data }));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const recommended = (p) => (platform === p ? "For this device" : null);

  return (
    <div className="apps-menu-page">
      <div className="apps-menu-container download-app-container">
        <Link to="/menu" className="download-app-back">
          <i className="fas fa-arrow-left" aria-hidden="true" /> Apps
        </Link>
        <header className="apps-menu-header">
          <h1>Download App</h1>
          <p>
            Get Connect on your phone for notifications, calls and offline access.
            {links.appVersion ? ` Latest version ${links.appVersion}.` : ""}
          </p>
        </header>

        <nav className="download-app-list" aria-label="Download options">
          <DownloadCard
            accent="#3DDC84"
            icon="fab fa-android"
            name="Android"
            badge={recommended("android")}
            desc={
              links.apkUrl
                ? "Download the APK, then open it to install."
                : loaded
                  ? "The Android download is not available yet."
                  : "Loading download link…"
            }
            disabled={!links.apkUrl}
            href={links.apkUrl}
          />

          {links.ipaUrl ? (
            <DownloadCard
              accent="#E5E7EB"
              icon="fab fa-apple"
              name="iOS"
              badge={recommended("ios")}
              desc="Download the iPhone and iPad app."
              href={links.ipaUrl}
            />
          ) : (
            <DownloadCard
              accent="#E5E7EB"
              icon="fab fa-apple"
              name="iOS"
              badge={recommended("ios")}
              desc={
                platform === "ios"
                  ? "Install from Safari: allow the profile, then open Settings → Profile Downloaded."
                  : "Open this page in Safari on your iPhone or iPad to install."
              }
              disabled={platform !== "ios"}
              onClick={openIosProfile}
            />
          )}

          <DownloadCard
            accent="#00D4FF"
            icon="fas fa-mobile-alt"
            name="Expo Go"
            desc="Run the latest development build in the Expo Go app."
            to="/expo"
          />
        </nav>

        <p className="download-app-note">
          New to Expo Go? Install it from the{" "}
          <a href={EXPO_GO_IOS} target="_blank" rel="noreferrer">
            App Store
          </a>{" "}
          or{" "}
          <a href={EXPO_GO_ANDROID} target="_blank" rel="noreferrer">
            Google Play
          </a>{" "}
          first.
        </p>
      </div>
    </div>
  );
};

export default DownloadApp;
