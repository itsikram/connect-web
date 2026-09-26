import { useEffect, useRef } from "react";

// Shake detection over DeviceMotion: a shake is several sharp acceleration
// spikes inside a short window. iOS 13+ gates motion events behind a
// permission prompt that must come from a user gesture, so the request is
// made on the first tap/keypress after mount.
// Same thresholds as the Expo app (1.6 g jolt, 3 hits within 700 ms).
const SPIKE_THRESHOLD = 1.6 * 9.81; // m/s² change between samples
const SPIKES_REQUIRED = 3;
const SPIKE_WINDOW_MS = 700;
const COOLDOWN_MS = 1500;

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
      window.DeviceMotionEvent.requestPermission()
        .then((state) => {
          if (state === "granted") startListening();
        })
        .catch(() => {});
    }

    if (hasMotionPermissionApi()) {
      window.addEventListener("touchend", requestOnGesture);
      window.addEventListener("click", requestOnGesture);
    } else {
      startListening();
    }

    return () => {
      removeGestureListeners();
      window.removeEventListener("devicemotion", handleMotion);
    };
  }, [enabled]);
}
