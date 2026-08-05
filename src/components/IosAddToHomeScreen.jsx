import { useEffect, useState } from "react";
import "./iosA2hs.css";
import { openIosProfile } from "../utils/iosProfile";

const DISMISS_KEY = "ios_a2hs_dismissed";

const isIosDevice = () => {
  const ua = window.navigator.userAgent.toLowerCase();
  const iPhoneLike = /iphone|ipad|ipod/.test(ua);
  const iPadDesktopMode =
    navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return iPhoneLike || iPadDesktopMode;
};

const isSafariBrowser = () => {
  const ua = window.navigator.userAgent.toLowerCase();
  return (
    /safari/.test(ua) &&
    !/crios|fxios|edgios|opt\/|opios|edg\//.test(ua)
  );
};

const isStandaloneMode = () =>
  window.navigator.standalone === true ||
  window.matchMedia("(display-mode: standalone)").matches;

const IosAddToHomeScreen = () => {
  const [showBanner, setShowBanner] = useState(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(DISMISS_KEY) === "true") return;
    } catch (_) {
      // ignore
    }

    if (isIosDevice() && isSafariBrowser() && !isStandaloneMode()) {
      setShowBanner(true);
    }
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, "true");
    } catch (_) {
      // ignore
    }
    setShowBanner(false);
    setShowModal(false);
  };

  if (!showBanner) return null;

  return (
    <>
      <div className="ios-a2hs-banner" role="dialog" aria-label="Install Connect">
        <button
          type="button"
          className="ios-a2hs-close"
          aria-label="Dismiss"
          onClick={dismiss}
        >
          ×
        </button>
        <img
          className="ios-a2hs-icon"
          src={`${process.env.PUBLIC_URL}/apple-touch-icon.png`}
          alt="Connect"
          width="40"
          height="40"
        />
        <div className="ios-a2hs-copy">
          <strong>Install Connect</strong>
          <span>Download profile, then install from Settings</span>
        </div>
        <button
          type="button"
          className="ios-a2hs-install"
          onClick={() => setShowModal(true)}
        >
          Install
        </button>
      </div>

      {showModal && (
        <div
          className="ios-a2hs-modal"
          onClick={() => setShowModal(false)}
          role="presentation"
        >
          <div
            className="ios-a2hs-modal-content"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="ios-a2hs-title"
          >
            <img
              className="ios-a2hs-modal-icon"
              src={`${process.env.PUBLIC_URL}/apple-touch-icon.png`}
              alt=""
              width="64"
              height="64"
            />
            <h3 id="ios-a2hs-title">Install Connect via Settings</h3>
            <ol className="ios-a2hs-steps">
              <li>
                Tap <b>Install Profile</b> below (Safari only)
              </li>
              <li>
                Tap <b>Allow</b> when Safari asks to download a configuration profile
              </li>
              <li>
                Open <b>Settings</b> — tap <b>Profile Downloaded</b> at the top
                (or General → VPN &amp; Device Management)
              </li>
              <li>
                Tap <b>Install</b>, then open <b>Connect</b> from Home Screen
              </li>
            </ol>
            <button
              type="button"
              className="ios-a2hs-gotit"
              onClick={openIosProfile}
            >
              Install Profile
            </button>
            <p className="ios-a2hs-note">
              Or use Safari Share → <b>Add to Home Screen</b> instead.
            </p>
            <button
              type="button"
              className="ios-a2hs-secondary"
              onClick={() => setShowModal(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default IosAddToHomeScreen;
