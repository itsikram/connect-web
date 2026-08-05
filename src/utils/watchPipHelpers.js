import { isStandaloneApp } from "../contexts/WatchPipContext";

export const shouldAutoWatchPip = () => {
  if (typeof window === "undefined") return false;
  // Prefer installed iOS/PWA app; also allow small screens in Safari
  if (isStandaloneApp()) return true;
  return window.matchMedia("(max-width: 768px)").matches;
};

export const buildPipPayloadFromVideo = (videoEl, meta = {}) => {
  if (!videoEl || !meta.watchId || !meta.videoUrl) return null;
  // Only pip if something was actually playing or has progress
  const hasProgress = (videoEl.currentTime || 0) > 0.2;
  const playing = !videoEl.paused && !videoEl.ended;
  if (!playing && !hasProgress) return null;

  return {
    watchId: meta.watchId,
    videoUrl: meta.videoUrl,
    currentTime: videoEl.currentTime || 0,
    playing,
    muted: !!videoEl.muted,
    title: meta.title || "Watch",
    thumbnail: meta.thumbnail || "",
  };
};
