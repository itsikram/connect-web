import { useCallback, useEffect, useMemo, useRef } from "react";

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

  return !!audio.ended && !(Number.isFinite(vDur) && vDur > 2 && aTime < vDur - 1.5);
};

/**
 * iOS PWAs pause <video> in the background. A hidden <audio> element keeps
 * the same file playing, then follows the player's next / loop rules.
 */
const useBackgroundAudioHandoff = (
  videoRef,
  { src, enabled = true, loop = false, onEndedRef } = {},
) => {
  const audioRef = useRef(null);
  const wantPlayingRef = useRef(false);
  const handingOffRef = useRef(false);
  const backgroundActiveRef = useRef(false);
  const dualPlayUnsafeRef = useRef(false);
  const srcRef = useRef(src);
  srcRef.current = src;

  const applyLoop = useCallback(() => {
    const audio = audioRef.current;
    if (audio) audio.loop = !!loop;
  }, [loop]);

  const markHandoff = useCallback((ms = 350) => {
    handingOffRef.current = true;
    window.setTimeout(() => {
      handingOffRef.current = false;
    }, ms);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const audio = document.createElement("audio");
    audio.setAttribute("playsinline", "true");
    audio.setAttribute("webkit-playsinline", "true");
    audio.setAttribute("preload", "auto");
    audio.loop = false;
    audio.style.cssText =
      "position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;z-index:-1;";
    document.body.appendChild(audio);
    audioRef.current = audio;
    setPlaybackSession();

    return () => {
      try {
        audio.pause();
        audio.removeAttribute("src");
        audio.load();
        audio.remove();
      } catch (_) {}
      audioRef.current = null;
    };
  }, []);

  const ensureSrc = useCallback((nextSrc = srcRef.current, { forceLoad = false } = {}) => {
    const audio = audioRef.current;
    if (!audio || !nextSrc) return false;
    applyLoop();
    if (forceLoad || mediaSrc(audio) !== nextSrc) {
      audio.src = nextSrc;
      audio.load();
    }
    return true;
  }, [applyLoop]);

  const playBackgroundAudio = useCallback(
    ({ unmuted = isPageHidden(), fromStart = false } = {}) => {
      const audio = audioRef.current;
      const video = videoRef.current;
      const nextSrc = srcRef.current;
      if (!audio || !nextSrc) return Promise.resolve();

      markHandoff();
      const srcChanged = mediaSrc(audio) !== nextSrc;
      ensureSrc(nextSrc, { forceLoad: srcChanged });
      setPlaybackSession();
      applyLoop();
      audio.muted = !unmuted;

      if (!audio.paused && !fromStart && !srcChanged) {
        backgroundActiveRef.current = unmuted;
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

      const start = () =>
        audio
          .play()
          .catch(() => {})
          .finally(() => {
            backgroundActiveRef.current = unmuted && !audio.paused;
          });

      if (audio.readyState >= 2) return start();

      return new Promise((resolve) => {
        const onReady = () => {
          start().then(resolve);
        };
        audio.addEventListener("canplay", onReady, { once: true });
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
    try {
      if (video) video.currentTime = 0;
    } catch (_) {}
    if (!audio) return Promise.resolve();
    markHandoff();
    try {
      audio.currentTime = 0;
    } catch (_) {}
    audio.muted = !isPageHidden() && !backgroundActiveRef.current;
    if (isPageHidden() || backgroundActiveRef.current) {
      audio.muted = false;
      backgroundActiveRef.current = true;
    }
    return audio.play().catch(() => {});
  }, [applyLoop, markHandoff]);

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
    if (mediaSrc(audio) === src) return undefined;

    markHandoff();
    ensureSrc(src, { forceLoad: true });
    try {
      audio.currentTime = 0;
    } catch (_) {}
    applyLoop();

    if (isPageHidden() || backgroundActiveRef.current) {
      audio.muted = false;
      backgroundActiveRef.current = true;
      audio.play().catch(() => {});
    } else if (!dualPlayUnsafeRef.current) {
      audio.muted = true;
      audio.play().catch(() => {});
    }
    return undefined;
  }, [src, enabled, applyLoop, ensureSrc, markHandoff]);

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

      if (isPageHidden()) {
        playBackgroundAudio({ unmuted: true });
        return;
      }

      if (dualPlayUnsafeRef.current) return;

      const currentAudio = audioRef.current;
      if (!currentAudio) return;
      currentAudio.muted = true;
      if (currentAudio.paused && mediaSrc(video) === mediaSrc(currentAudio)) {
        try {
          currentAudio.currentTime = Number(video.currentTime) || 0;
        } catch (_) {}
      }

      markHandoff(250);
      currentAudio
        .play()
        .then(() => {
          if (isPageHidden()) {
            currentAudio.muted = false;
            backgroundActiveRef.current = true;
            return;
          }
          window.setTimeout(() => {
            if (video.paused && wantPlayingRef.current && !isPageHidden()) {
              dualPlayUnsafeRef.current = true;
              try {
                currentAudio.pause();
              } catch (_) {}
              video.play().catch(() => {});
            }
          }, 80);
        })
        .catch(() => {});
    };

    const onPause = () => {
      if (handingOffRef.current) return;
      if (isPageHidden() && wantPlayingRef.current) {
        playBackgroundAudio({ unmuted: true });
        return;
      }
      if (!isPageHidden()) {
        wantPlayingRef.current = false;
        backgroundActiveRef.current = false;
        pauseBackgroundAudio();
      }
    };

    const onTimeUpdate = () => {
      if (isPageHidden() || backgroundActiveRef.current) return;
      const currentAudio = audioRef.current;
      if (!currentAudio || currentAudio.paused || dualPlayUnsafeRef.current) {
        return;
      }
      if (mediaSrc(video) !== mediaSrc(currentAudio)) return;
      const vt = Number(video.currentTime) || 0;
      const at = Number(currentAudio.currentTime) || 0;
      if (vt - at > 0.8) {
        try {
          currentAudio.currentTime = vt;
        } catch (_) {}
      }
    };

    const goBackground = () => {
      if (video && !video.paused) wantPlayingRef.current = true;
      if (!wantPlayingRef.current) return;
      applyLoop();
      if (audio && !audio.paused) {
        audio.muted = false;
        backgroundActiveRef.current = true;
        markHandoff();
        try {
          video.muted = true;
          video.pause();
        } catch (_) {}
        return;
      }
      setPlaybackSession();
      playBackgroundAudio({ unmuted: true });
      markHandoff();
      try {
        video.muted = true;
        video.pause();
      } catch (_) {}
    };

    const goForeground = () => {
      backgroundActiveRef.current = false;
      const currentAudio = audioRef.current;
      markHandoff();
      try {
        video.muted = false;
      } catch (_) {}

      if (currentAudio && !currentAudio.paused) {
        try {
          video.currentTime = currentAudio.currentTime;
        } catch (_) {}
        currentAudio.muted = true;
        if (dualPlayUnsafeRef.current) {
          pauseBackgroundAudio();
        }
      }

      if (wantPlayingRef.current) {
        video.play().catch(() => {
          playBackgroundAudio({ unmuted: true });
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
    video.addEventListener("timeupdate", onTimeUpdate);
    audio?.addEventListener("ended", onAudioEnded);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", goBackground);
    window.addEventListener("freeze", goBackground);
    window.addEventListener("pageshow", goForeground);

    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("timeupdate", onTimeUpdate);
      audio?.removeEventListener("ended", onAudioEnded);
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
    }),
    [
      playBackgroundAudio,
      pauseBackgroundAudio,
      restartBackgroundAudio,
      isAudioPlaying,
    ],
  );
};

export default useBackgroundAudioHandoff;
