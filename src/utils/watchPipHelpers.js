import { isStandaloneApp } from "../contexts/WatchPipContext";

export const shouldAutoWatchPip = () => {
  if (typeof window === "undefined") return false;
  // Prefer installed iOS/PWA app; also allow small screens in Safari
  if (isStandaloneApp()) return true;
  return window.matchMedia("(max-width: 768px)").matches;
};

export const buildPipPayloadFromVideo = (videoEl, meta = {}) => {
  if (!videoEl || !meta.videoUrl) return null;
  const watchId = meta.watchId || null;
  const libraryVideoId = meta.libraryVideoId || meta.pipId || null;
  if (!watchId && !libraryVideoId) return null;

  const hasProgress = (videoEl.currentTime || 0) > 0.2;
  const playing = !videoEl.paused && !videoEl.ended;
  if (!playing && !hasProgress) return null;

  return {
    watchId,
    libraryVideoId,
    source: meta.source || (watchId ? "watch" : "library"),
    videoUrl: meta.videoUrl,
    currentTime: videoEl.currentTime || 0,
    playing,
    muted: !!videoEl.muted,
    title: meta.title || (watchId ? "Watch" : "Video"),
    thumbnail: meta.thumbnail || "",
  };
};

export const buildLibraryPipPayloadFromVideo = (videoEl, meta = {}) =>
  buildPipPayloadFromVideo(videoEl, {
    ...meta,
    source: "library",
    libraryVideoId: meta.libraryVideoId || meta.pipId,
  });
