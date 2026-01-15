import { useEffect, useState } from "react";
import "./iosA2hs.css";

const IosAddToHomeScreen = () => {
  const [showButton, setShowButton] = useState(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const ua = window.navigator.userAgent.toLowerCase();

    const isIOS =
      /iphone|ipad|ipod/.test(ua);

    const isSafari =
      ua.includes("safari") && !ua.includes("chrome");

    const isStandalone =
      window.navigator.standalone === true;

    if (isIOS && isSafari && !isStandalone) {
      setShowButton(true);
    }
  }, []);

  if (!showButton) return null;

  return (
    <>
      {/* Floating Button */}
      <div
        className="ios-a2hs-btn"
        onClick={() => setShowModal(true)}
      >
        ➕ Add to Home Screen
      </div>

      {/* Modal */}
      {showModal && (
        <div className="ios-a2hs-modal">
          <div className="modal-content">
            <h3>Add to Home Screen</h3>
            <p>
              1️⃣ Tap the <b>Share</b> button <br />
              2️⃣ Select <b>“Add to Home Screen”</b>
            </p>

            <img
              src="https://upload.wikimedia.org/wikipedia/commons/8/8d/Ios-share-icon.png"
              alt="Share Icon"
              width="50"
            />

            <button onClick={() => setShowModal(false)}>
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default IosAddToHomeScreen;
