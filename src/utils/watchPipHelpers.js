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
    looping: !!meta.looping,
    playlist: Array.isArray(meta.playlist) ? meta.playlist : [],
    expandPath: meta.expandPath || "",
  };
};

export const buildLibraryPipPayloadFromVideo = (videoEl, meta = {}) =>
  buildPipPayloadFromVideo(videoEl, {
    ...meta,
    source: "library",
    libraryVideoId: meta.libraryVideoId || meta.pipId,
  });

export const watchesToPipPlaylist = (watches = []) =>
  (Array.isArray(watches) ? watches : [])
    .filter((watch) => watch?._id && watch?.videoUrl)
    .map((watch) => ({
      id: String(watch._id),
      watchId: String(watch._id),
      url: watch.videoUrl,
      title:
        watch.caption ||
        `${watch.author?.user?.firstName || "Watch"} video`,
      thumbnail: watch.thumbnail || "",
      playCount: 1,
    }));

export const savedVideosToPipPlaylist = (videos = []) =>
  (Array.isArray(videos) ? videos : [])
    .filter((video) => video?.id && (video.videoURL || video.url))
    .map((video) => ({
      id: `saved-${video.id}`,
      videoId: `saved-${video.id}`,
      url: video.videoURL || video.url,
      title: video.metadata?.caption || video.caption || "Saved video",
      thumbnail: video.metadata?.thumbnail || video.thumbnail || "",
      playCount: 1,
    }));

export const getPipPlaylistIndex = (playlist, pipState) => {
  if (!Array.isArray(playlist) || !pipState) return -1;
  const ids = [
    pipState.libraryVideoId,
    pipState.watchId,
    pipState.videoId,
  ]
    .filter(Boolean)
    .map(String);

  return playlist.findIndex((item) => {
    const itemIds = [item.id, item.watchId, item.videoId]
      .filter(Boolean)
      .map(String);
    return itemIds.some((id) => ids.includes(id));
  });
};
