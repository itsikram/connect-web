import { useEffect, useRef } from "react";

const ACTIONS = [
  "play",
  "pause",
  "previoustrack",
  "nexttrack",
  "seekbackward",
  "seekforward",
  "seekto",
];

let sessionOwnerSeq = 0;
let activeSessionOwner = 0;

const isFiniteNumber = (value) =>
  typeof value === "number" && Number.isFinite(value);

const sanitizePositionState = (positionState) => {
  if (!positionState) return null;

  const duration = Number(positionState.duration);
  let position = Number(positionState.position);
  const playbackRateRaw = Number(positionState.playbackRate);
  const playbackRate =
    isFiniteNumber(playbackRateRaw) && playbackRateRaw > 0
      ? playbackRateRaw
      : 1;

  if (!isFiniteNumber(duration) || duration <= 0) return null;
  if (!isFiniteNumber(position) || position < 0) return null;
  position = Math.min(position, duration);

  return { duration, position, playbackRate };
};

const resolveMediaMetadata = (metadata) => {
  if (!metadata) return null;
  const hasData =
    metadata.title ||
    metadata.artist ||
    metadata.album ||
    (Array.isArray(metadata.artwork) && metadata.artwork.length > 0);
  if (!hasData) return null;

  const payload = {
    title: metadata.title || "",
    artist: metadata.artist || "",
    album: metadata.album || "",
    artwork: Array.isArray(metadata.artwork)
      ? metadata.artwork.filter((item) => item?.src)
      : [],
  };

  if (
    typeof window !== "undefined" &&
    typeof window.MediaMetadata === "function"
  ) {
    return new window.MediaMetadata(payload);
  }

  if (typeof MediaMetadata === "function") {
    return new MediaMetadata(payload);
  }

  return payload;
};

const setActionHandlerSafely = (mediaSession, action, handler) => {
  try {
    mediaSession.setActionHandler(action, handler || null);
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.debug(`Media Session action not supported: ${action}`, error);
    }
  }
};

const bindActionHandlers = (mediaSession, handlersRef) => {
  ACTIONS.forEach((action) => {
    const actionHandler = handlersRef.current?.[action];
    setActionHandlerSafely(
      mediaSession,
      action,
      typeof actionHandler === "function"
        ? (details) => {
            const latest = handlersRef.current?.[action];
            if (typeof latest === "function") latest(details);
          }
        : null,
    );
  });
};

const clearSession = (mediaSession) => {
  ACTIONS.forEach((action) => {
    setActionHandlerSafely(mediaSession, action, null);
  });
  try {
    mediaSession.playbackState = "none";
  } catch (_) {}
  try {
    mediaSession.metadata = null;
  } catch (_) {}
};

const useMediaSession = ({
  enabled = true,
  metadata,
  playbackState,
  positionState,
  getPositionState,
  getPlaybackState,
  handlers,
  bindKey,
}) => {
  const handlersRef = useRef(handlers || {});
  const metadataRef = useRef(metadata);
  const playbackStateRef = useRef(playbackState);
  const positionStateRef = useRef(positionState);
  const getPositionStateRef = useRef(getPositionState);
  const getPlaybackStateRef = useRef(getPlaybackState);

  useEffect(() => {
    handlersRef.current = handlers || {};
  }, [handlers]);

  metadataRef.current = metadata;
  playbackStateRef.current = playbackState;
  positionStateRef.current = positionState;
  getPositionStateRef.current = getPositionState;
  getPlaybackStateRef.current = getPlaybackState;

  const mediaSessionAvailable =
    typeof navigator !== "undefined" &&
    "mediaSession" in navigator &&
    !!navigator.mediaSession;

  const supported = enabled && mediaSessionAvailable;

  const metadataTitle = metadata?.title || "";
  const metadataArtist = metadata?.artist || "";
  const artworkSrc = metadata?.artwork?.[0]?.src || "";

  const applySession = () => {
    if (!mediaSessionAvailable || !enabled) return;
    const mediaSession = navigator.mediaSession;
    try {
      mediaSession.metadata = resolveMediaMetadata(metadataRef.current);
    } catch (_) {}
    try {
      let nextState = playbackStateRef.current || "none";
      if (typeof getPlaybackStateRef.current === "function") {
        const liveState = getPlaybackStateRef.current();
        if (liveState) nextState = liveState;
      }
      mediaSession.playbackState = nextState;
    } catch (_) {}
    bindActionHandlers(mediaSession, handlersRef);
    if (typeof mediaSession.setPositionState !== "function") return;
    const live =
      typeof getPositionStateRef.current === "function"
        ? getPositionStateRef.current()
        : positionStateRef.current;
    const safe = sanitizePositionState(live);
    if (!safe) return;
    try {
      mediaSession.setPositionState(safe);
    } catch (_) {}
  };

  useEffect(() => {
    if (!supported) return undefined;

    const mediaSession = navigator.mediaSession;
    const ownerId = (sessionOwnerSeq += 1);
    activeSessionOwner = ownerId;

    applySession();

    const onVis = () => {
      if (activeSessionOwner !== ownerId) return;
      applySession();
    };

    document.addEventListener("visibilitychange", onVis);
    document.addEventListener("freeze", onVis);
    document.addEventListener("resume", onVis);
    window.addEventListener("pageshow", onVis);
    window.addEventListener("pagehide", onVis);
    window.addEventListener("focus", onVis);

    const timer = window.setInterval(() => {
      if (activeSessionOwner !== ownerId) return;
      applySession();
    }, 500);

    return () => {
      document.removeEventListener("visibilitychange", onVis);
      document.removeEventListener("freeze", onVis);
      document.removeEventListener("resume", onVis);
      window.removeEventListener("pageshow", onVis);
      window.removeEventListener("pagehide", onVis);
      window.removeEventListener("focus", onVis);
      window.clearInterval(timer);
      if (activeSessionOwner === ownerId) {
        clearSession(mediaSession);
      }
    };
    // Keep one owner while this player is enabled. Track changes re-apply
    // metadata below without clearing Now Playing (iOS drops the session if we do).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supported]);

  useEffect(() => {
    if (!supported) return;
    applySession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    supported,
    bindKey,
    metadataTitle,
    metadataArtist,
    artworkSrc,
    playbackState,
  ]);
};

export default useMediaSession;
