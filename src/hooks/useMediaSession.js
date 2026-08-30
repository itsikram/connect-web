import { useEffect, useMemo, useRef } from "react";

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

const useMediaSession = ({
  enabled = true,
  metadata,
  playbackState,
  positionState,
  handlers,
  bindKey,
}) => {
  const handlersRef = useRef(handlers || {});

  useEffect(() => {
    handlersRef.current = handlers || {};
  }, [handlers]);

  const mediaSessionAvailable =
    typeof navigator !== "undefined" &&
    "mediaSession" in navigator &&
    !!navigator.mediaSession;

  const supported = enabled && mediaSessionAvailable;

  const safePositionState = useMemo(
    () => sanitizePositionState(positionState),
    [positionState],
  );

  const metadataTitle = metadata?.title || "";
  const metadataArtist = metadata?.artist || "";

  useEffect(() => {
    if (!supported) return undefined;

    const mediaSession = navigator.mediaSession;
    const ownerId = (sessionOwnerSeq += 1);
    activeSessionOwner = ownerId;

    bindActionHandlers(mediaSession, handlersRef);

    return () => {
      if (activeSessionOwner !== ownerId) return;
      ACTIONS.forEach((action) => {
        setActionHandlerSafely(mediaSession, action, null);
      });
    };
  }, [supported, bindKey, metadataTitle, metadataArtist]);

  useEffect(() => {
    if (!mediaSessionAvailable || !enabled) return;

    try {
      navigator.mediaSession.metadata = resolveMediaMetadata(metadata);
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.debug("Failed to set Media Session metadata", error);
      }
    }
  }, [mediaSessionAvailable, enabled, metadata]);

  useEffect(() => {
    if (!mediaSessionAvailable || !enabled) return;

    try {
      navigator.mediaSession.playbackState = playbackState || "none";
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.debug("Failed to set Media Session playbackState", error);
      }
    }
  }, [mediaSessionAvailable, enabled, playbackState]);

  useEffect(() => {
    if (!supported) return undefined;
    if (typeof navigator.mediaSession.setPositionState !== "function") {
      return undefined;
    }
    if (!safePositionState) return undefined;

    const apply = () => {
      try {
        navigator.mediaSession.setPositionState(safePositionState);
      } catch (error) {
        if (process.env.NODE_ENV !== "production") {
          console.debug("Failed to set Media Session position state", error);
        }
      }
    };

    apply();
    if (playbackState !== "playing") return undefined;
    const timer = window.setInterval(apply, 1000);
    return () => window.clearInterval(timer);
  }, [supported, safePositionState, playbackState]);
};

export default useMediaSession;
