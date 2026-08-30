import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const setPlaybackSession = () => {
  try {
    if (typeof navigator !== "undefined" && navigator.audioSession) {
      navigator.audioSession.type = "playback";
    }
  } catch (_) {}
};

const isPageHidden = () =>
  typeof document !== "undefined" &&
  (document.visibilityState === "hidden" || document.hidden);

const mediaSrc = (el) => {
  if (!el) return "";
  return el.currentSrc || el.getAttribute("src") || "";
};

const isTrueTrackEnd = (audio, video) => {
  if (!audio) return false;
  const aTime = Number(audio.currentTime) || 0;
  const aDur = Number(audio.duration);
  const vDur = Number(video?.duration);

  if (Number.isFinite(aDur) && aDur > 1 && aTime >= aDur - 0.75) {
    if (Number.isFinite(vDur) && vDur > 1 && aDur + 1.5 < vDur) {
      return false;
    }
    return true;
  }

  if (Number.isFinite(vDur) && vDur > 1 && aTime >= vDur - 0.75) {
    return true;
  }

  return (
    !!audio.ended &&
    !(Number.isFinite(vDur) && vDur > 2 && aTime < vDur - 1.5)
  );
};

let sharedAudio = null;
let sharedOwners = 0;
let pendingCanPlay = null;

const acquireSharedAudio = () => {
  if (typeof document === "undefined") return null;
  if (!sharedAudio) {
    const audio = document.createElement("audio");
    audio.setAttribute("playsinline", "true");
    audio.setAttribute("webkit-playsinline", "true");
    audio.setAttribute("preload", "auto");
    audio.loop = false;
    audio.style.cssText =
      "position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;z-index:-1;";
    document.body.appendChild(audio);
    sharedAudio = audio;
  }
  sharedOwners += 1;
  return sharedAudio;
};

const releaseSharedAudio = () => {
  sharedOwners = Math.max(0, sharedOwners - 1);
  if (sharedOwners > 0 || !sharedAudio) return;
  try {
    sharedAudio.pause();
    sharedAudio.removeAttribute("src");
    sharedAudio.load();
    sharedAudio.remove();
  } catch (_) {}
  sharedAudio = null;
};

const silenceVideo = (video) => {
  if (!video) return;
  try {
    video.muted = true;
    if (!video.paused) video.pause();
  } catch (_) {}
};

const playElement = (audio) => {
  if (!audio) return Promise.resolve();
  if (pendingCanPlay) {
    audio.removeEventListener("canplay", pendingCanPlay);
    pendingCanPlay = null;
  }

  const start = () => audio.play().catch(() => {});

  if (audio.readyState >= 2) return start();

  return new Promise((resolve) => {
    const onReady = () => {
      if (pendingCanPlay === onReady) pendingCanPlay = null;
      start().then(resolve);
    };
    pendingCanPlay = onReady;
    audio.addEventListener("canplay", onReady, { once: true });
  });
};

/**
 * iOS PWAs pause <video> in the background. One shared <audio> element keeps
 * the file playing. The video must stay muted/paused while that audio is live
 * or the next clip is heard twice.
 */
const useBackgroundAudioHandoff = (
  videoRef,
  { src, enabled = true, loop = false, onEndedRef } = {},
) => {
  const audioRef = useRef(null);
  const wantPlayingRef = useRef(false);
  const handingOffRef = useRef(false);
  const backgroundActiveRef = useRef(false);
  const srcRef = useRef(src);
  srcRef.current = src;
  const [mediaPosition, setMediaPosition] = useState({
    duration: 0,
    position: 0,
    playbackRate: 1,
    playing: false,
  });
  const [sessionBindKey, setSessionBindKey] = useState(0);

  const applyLoop = useCallback(() => {
    const audio = audioRef.current;
    if (audio) audio.loop = !!loop;
  }, [loop]);

  const markHandoff = useCallback((ms = 400) => {
    handingOffRef.current = true;
    window.setTimeout(() => {
      handingOffRef.current = false;
    }, ms);
  }, []);

  useEffect(() => {
    if (!enabled) {
      audioRef.current = null;
      return undefined;
    }
    audioRef.current = acquireSharedAudio();
    setPlaybackSession();
    return () => {
      audioRef.current = null;
      releaseSharedAudio();
    };
  }, [enabled]);

  const ensureSrc = useCallback(
    (nextSrc = srcRef.current) => {
      const audio = audioRef.current;
      if (!audio || !nextSrc) return false;
      applyLoop();
      if (mediaSrc(audio) !== nextSrc) {
        audio.src = nextSrc;
        audio.load();
      }
      return true;
    },
    [applyLoop],
  );

  const playBackgroundAudio = useCallback(
    ({ fromStart = false } = {}) => {
      const audio = audioRef.current;
      const video = videoRef.current;
      const nextSrc = srcRef.current;
      if (!audio || !nextSrc) return Promise.resolve();

      markHandoff();
      const srcChanged = mediaSrc(audio) !== nextSrc;
      ensureSrc(nextSrc);
      setPlaybackSession();
      applyLoop();
      audio.muted = false;
      silenceVideo(video);

      if (!audio.paused && !srcChanged && !fromStart) {
        backgroundActiveRef.current = true;
        return Promise.resolve();
      }

      // Same file already rolling — do not start a second copy.
      if (!audio.paused && !srcChanged && fromStart) {
        backgroundActiveRef.current = true;
        return Promise.resolve();
      }

      if (fromStart || srcChanged) {
        try {
          audio.currentTime = 0;
        } catch (_) {}
      } else if (video && !video.paused && mediaSrc(video) === nextSrc) {
        try {
          audio.currentTime = Number(video.currentTime) || 0;
        } catch (_) {}
      }

      backgroundActiveRef.current = true;
      return playElement(audio).then(() => {
        setSessionBindKey((key) => key + 1);
      });
    },
    [applyLoop, ensureSrc, markHandoff, videoRef],
  );

  const pauseBackgroundAudio = useCallback(() => {
    backgroundActiveRef.current = false;
    try {
      audioRef.current?.pause();
    } catch (_) {}
  }, []);

  const restartBackgroundAudio = useCallback(() => {
    const audio = audioRef.current;
    const video = videoRef.current;
    wantPlayingRef.current = true;
    applyLoop();
    silenceVideo(video);
    try {
      if (video) video.currentTime = 0;
    } catch (_) {}
    if (!audio) return Promise.resolve();
    markHandoff();
    try {
      audio.currentTime = 0;
    } catch (_) {}
    audio.muted = false;
    backgroundActiveRef.current = true;
    return playElement(audio).then(() => {
      setSessionBindKey((key) => key + 1);
    });
  }, [applyLoop, markHandoff, videoRef]);

  const isAudioPlaying = useCallback(
    () => !!(audioRef.current && !audioRef.current.paused),
    [],
  );

  useEffect(() => {
    applyLoop();
  }, [applyLoop]);

  useEffect(() => {
    if (!enabled || !src) return undefined;
    if (!wantPlayingRef.current) {
      ensureSrc(src);
      return undefined;
    }
    const audio = audioRef.current;
    if (!audio) return undefined;
    if (mediaSrc(audio) === src && !audio.paused) return undefined;

    markHandoff();
    ensureSrc(src);
    try {
      audio.currentTime = 0;
    } catch (_) {}
    applyLoop();

    if (isPageHidden() || backgroundActiveRef.current) {
      audio.muted = false;
      backgroundActiveRef.current = true;
      silenceVideo(videoRef.current);
      playElement(audio).then(() => {
        setSessionBindKey((key) => key + 1);
      });
    }
    return undefined;
  }, [src, enabled, applyLoop, ensureSrc, markHandoff, videoRef]);

  useEffect(() => {
    if (!enabled || !src) return undefined;
    const video = videoRef.current;
    const audio = audioRef.current;
    if (!video) return undefined;

    const onPlay = () => {
      wantPlayingRef.current = true;
      setPlaybackSession();
      ensureSrc();
      applyLoop();

      if (isPageHidden() || backgroundActiveRef.current) {
        playBackgroundAudio();
        return;
      }
    };

    const onPause = () => {
      if (handingOffRef.current) return;
      if (isPageHidden() && wantPlayingRef.current) {
        playBackgroundAudio();
        return;
      }
      if (!isPageHidden() && !backgroundActiveRef.current) {
        wantPlayingRef.current = false;
        pauseBackgroundAudio();
      }
    };

    const goBackground = () => {
      if (video && !video.paused) wantPlayingRef.current = true;
      if (!wantPlayingRef.current) return;
      applyLoop();
      playBackgroundAudio();
    };

    const goForeground = () => {
      const currentAudio = audioRef.current;
      const wasBackground = backgroundActiveRef.current;
      backgroundActiveRef.current = false;
      markHandoff();
      try {
        video.muted = false;
      } catch (_) {}

      if (currentAudio && !currentAudio.paused) {
        try {
          video.currentTime = currentAudio.currentTime;
        } catch (_) {}
      }

      if (wantPlayingRef.current) {
        video
          .play()
          .then(() => {
            pauseBackgroundAudio();
          })
          .catch(() => {
            if (wasBackground || isPageHidden()) {
              playBackgroundAudio();
            }
          });
      } else {
        pauseBackgroundAudio();
      }
    };

    const onVisibility = () => {
      if (isPageHidden()) goBackground();
      else goForeground();
    };

    const finishTrack = () => {
      const handler = onEndedRef?.current;
      if (typeof handler === "function") handler();
    };

    const onAudioEnded = () => {
      if (!wantPlayingRef.current) return;
      applyLoop();
      const currentAudio = audioRef.current;
      if (loop) {
        if (currentAudio?.paused) restartBackgroundAudio();
        return;
      }

      if (!isTrueTrackEnd(currentAudio, video)) {
        currentAudio?.play().catch(() => {});
        return;
      }

      if (!isPageHidden() && !backgroundActiveRef.current) return;
      finishTrack();
    };

    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    audio?.addEventListener("ended", onAudioEnded);
    const syncMediaPosition = () => {
      const currentAudio = audioRef.current;
      if (!currentAudio) return;
      const nextDuration = Number(currentAudio.duration);
      const nextPosition = Number(currentAudio.currentTime);
      const nextRate = Number(currentAudio.playbackRate);
      setMediaPosition({
        duration:
          Number.isFinite(nextDuration) && nextDuration > 0 ? nextDuration : 0,
        position:
          Number.isFinite(nextPosition) && nextPosition >= 0 ? nextPosition : 0,
        playbackRate:
          Number.isFinite(nextRate) && nextRate > 0 ? nextRate : 1,
        playing: !currentAudio.paused,
      });
    };
    audio?.addEventListener("timeupdate", syncMediaPosition);
    audio?.addEventListener("durationchange", syncMediaPosition);
    audio?.addEventListener("loadedmetadata", syncMediaPosition);
    audio?.addEventListener("ratechange", syncMediaPosition);
    audio?.addEventListener("play", syncMediaPosition);
    audio?.addEventListener("pause", syncMediaPosition);
    const positionTimer = window.setInterval(syncMediaPosition, 500);
    syncMediaPosition();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", goBackground);
    window.addEventListener("freeze", goBackground);
    window.addEventListener("pageshow", goForeground);

    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      audio?.removeEventListener("ended", onAudioEnded);
      audio?.removeEventListener("timeupdate", syncMediaPosition);
      audio?.removeEventListener("durationchange", syncMediaPosition);
      audio?.removeEventListener("loadedmetadata", syncMediaPosition);
      audio?.removeEventListener("ratechange", syncMediaPosition);
      audio?.removeEventListener("play", syncMediaPosition);
      audio?.removeEventListener("pause", syncMediaPosition);
      window.clearInterval(positionTimer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", goBackground);
      window.removeEventListener("freeze", goBackground);
      window.removeEventListener("pageshow", goForeground);
    };
  }, [
    enabled,
    src,
    videoRef,
    loop,
    onEndedRef,
    playBackgroundAudio,
    pauseBackgroundAudio,
    restartBackgroundAudio,
    ensureSrc,
    applyLoop,
    markHandoff,
  ]);

  return useMemo(
    () => ({
      audioRef,
      wantPlayingRef,
      handingOffRef,
      playBackgroundAudio,
      pauseBackgroundAudio,
      restartBackgroundAudio,
      isAudioPlaying,
      mediaPosition,
      sessionBindKey,
    }),
    [
      playBackgroundAudio,
      pauseBackgroundAudio,
      restartBackgroundAudio,
      isAudioPlaying,
      mediaPosition,
      sessionBindKey,
    ],
  );
};

export default useBackgroundAudioHandoff;
