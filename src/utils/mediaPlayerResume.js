// Remembers what the Media Player was playing last (which video, where in it,
// and how long it is) so the next visit reopens that video, paused, at the
// same spot.

export const MEDIA_PLAYER_RESUME_KEY = "connect.mediaPlayer.lastPlayback";

const toSeconds = (value) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

export const loadLastPlayback = () => {
  try {
    const raw = window.localStorage.getItem(MEDIA_PLAYER_RESUME_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || (!data.queueId && !data.videoId && !data.url)) return null;
    return {
      queueId: String(data.queueId || ""),
      videoId: String(data.videoId || ""),
      url: String(data.url || ""),
      title: String(data.title || ""),
      fromQueue: !!data.fromQueue,
      position: toSeconds(data.position),
      duration: toSeconds(data.duration),
      savedAt: Number(data.savedAt) || 0,
    };
  } catch (_) {
    return null;
  }
};

export const saveLastPlayback = (entry) => {
  if (!entry || (!entry.queueId && !entry.videoId && !entry.url)) return;
  try {
    window.localStorage.setItem(
      MEDIA_PLAYER_RESUME_KEY,
      JSON.stringify({
        queueId: entry.queueId || "",
        videoId: entry.videoId || "",
        url: entry.url || "",
        title: entry.title || "",
        fromQueue: !!entry.fromQueue,
        position: toSeconds(entry.position),
        duration: toSeconds(entry.duration),
        savedAt: Date.now(),
      }),
    );
  } catch (_) {
    // Storage full or blocked: resuming is a convenience, never an error.
  }
};

// Local files get a fresh blob: URL every session, so match by id first and
// only fall back to the URL for real (http) links.
const sameItem = (item, saved) => {
  if (!item || !saved) return false;
  if (saved.queueId && item.queueId && item.queueId === saved.queueId) return true;
  const itemVideoId = item.videoId || item.id;
  if (saved.videoId && itemVideoId && itemVideoId === saved.videoId) return true;
  return !!saved.url && !saved.url.startsWith("blob:") && item.url === saved.url;
};

export const isSamePlayback = sameItem;

// Index of the saved video in the list the player is using, or -1.
export const findLastPlaybackIndex = (list, saved) => {
  if (!saved || !Array.isArray(list)) return -1;
  if (saved.queueId) {
    const byQueueId = list.findIndex((item) => item?.queueId === saved.queueId);
    if (byQueueId >= 0) return byQueueId;
  }
  return list.findIndex((item) => sameItem(item, saved));
};

// Position to seek to; the very end is treated as "start over".
export const getResumePosition = (saved, duration) => {
  const position = toSeconds(saved?.position);
  const total = toSeconds(duration) || toSeconds(saved?.duration);
  if (position < 1) return 0;
  if (total && position >= total - 1) return 0;
  return position;
};
