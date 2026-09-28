import { useEffect, useRef } from "react";

// Shake detection over DeviceMotion: a shake is several sharp acceleration
// spikes inside a short window. iOS 13+ gates motion events behind a
// permission prompt that must come from a user gesture. The prompt is shown
// at most once per device (on the first tap after the very first launch);
// the answer is remembered so opening the app never asks again. Later
// launches just listen: if iOS still honours the earlier grant, shaking works.
// Same thresholds as the Expo app (1.6 g jolt, 3 hits within 700 ms).
const SPIKE_THRESHOLD = 1.6 * 9.81; // m/s² change between samples
const SPIKES_REQUIRED = 3;
const SPIKE_WINDOW_MS = 700;
const COOLDOWN_MS = 1500;

const MOTION_PERMISSION_KEY = "connect.motionPermission";

const readMotionDecision = () => {
  try {
    return window.localStorage.getItem(MOTION_PERMISSION_KEY) || "";
  } catch (_) {
    return "";
  }
};

const saveMotionDecision = (value) => {
  try {
    window.localStorage.setItem(MOTION_PERMISSION_KEY, value);
  } catch (_) {}
};

const hasMotionPermissionApi = () =>
  typeof window !== "undefined" &&
  typeof window.DeviceMotionEvent !== "undefined" &&
  typeof window.DeviceMotionEvent.requestPermission === "function";

export default function useShakeDetector(onShake, { enabled = true } = {}) {
  const onShakeRef = useRef(onShake);

  useEffect(() => {
    onShakeRef.current = onShake;
  }, [onShake]);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return undefined;
    if (typeof window.DeviceMotionEvent === "undefined") return undefined;

    let last = null;
    let spikes = [];
    let lastShakeAt = 0;
    let listening = false;

    const handleMotion = (event) => {
      const acc = event.accelerationIncludingGravity || event.acceleration;
      if (!acc || acc.x == null || acc.y == null || acc.z == null) return;

      const now = Date.now();
      if (last) {
        const delta = Math.sqrt(
          (acc.x - last.x) ** 2 + (acc.y - last.y) ** 2 + (acc.z - last.z) ** 2,
        );
        if (delta > SPIKE_THRESHOLD) {
          spikes = spikes.filter((t) => now - t < SPIKE_WINDOW_MS);
          spikes.push(now);
          if (
            spikes.length >= SPIKES_REQUIRED &&
            now - lastShakeAt > COOLDOWN_MS
          ) {
            lastShakeAt = now;
            spikes = [];
            onShakeRef.current?.();
          }
        }
      }
      last = { x: acc.x, y: acc.y, z: acc.z };
    };

    const startListening = () => {
      if (listening) return;
      listening = true;
      window.addEventListener("devicemotion", handleMotion);
    };

    const removeGestureListeners = () => {
      window.removeEventListener("touchend", requestOnGesture);
      window.removeEventListener("click", requestOnGesture);
    };

    function requestOnGesture() {
      removeGestureListeners();
      // Remember that we asked before the prompt even resolves, so a reload
      // mid-prompt never leads to asking again.
      saveMotionDecision("asked");
      window.DeviceMotionEvent.requestPermission()
        .then((state) => {
          saveMotionDecision(state === "granted" ? "granted" : "denied");
        })
        .catch(() => saveMotionDecision("denied"));
    }

    // Listening is harmless without permission (no events arrive), so always
    // listen; only the one-time prompt depends on the stored decision.
    startListening();
    if (hasMotionPermissionApi() && !readMotionDecision()) {
      window.addEventListener("touchend", requestOnGesture);
      window.addEventListener("click", requestOnGesture);
    }

    return () => {
      removeGestureListeners();
      window.removeEventListener("devicemotion", handleMotion);
    };
  }, [enabled]);
}
