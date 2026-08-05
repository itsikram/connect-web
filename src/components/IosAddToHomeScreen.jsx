import { useEffect, useState } from "react";
import "./iosA2hs.css";

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
  // iOS Chrome/Firefox/Edge still include "safari" in the UA
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
          <span>Add to your Home Screen for an app-like experience</span>
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
            <h3 id="ios-a2hs-title">Install Connect like an app</h3>
            <ol className="ios-a2hs-steps">
              <li>
                Tap the <b>Share</b> button{" "}
                <svg
                  className="ios-a2hs-share-icon"
                  viewBox="0 0 24 24"
                  width="18"
                  height="18"
                  aria-hidden="true"
                >
                  <path
                    fill="currentColor"
                    d="M12 3l4 4h-3v8h-2V7H8l4-4zm-7 10v6a2 2 0 002 2h10a2 2 0 002-2v-6h-2v6H7v-6H5z"
                  />
                </svg>{" "}
                at the bottom of Safari
              </li>
              <li>
                Scroll and tap <b>Add to Home Screen</b>
              </li>
              <li>
                Tap <b>Add</b> — Connect opens full-screen like an app
              </li>
            </ol>
            <p className="ios-a2hs-note">
              Must use Safari. Open this site at{" "}
              <b>connect-zfgx.onrender.com</b> (not localhost).
            </p>
            <button type="button" className="ios-a2hs-gotit" onClick={() => setShowModal(false)}>
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default IosAddToHomeScreen;
