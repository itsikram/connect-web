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

const nearTime = (a, b, slack = 0.4) =>
  Math.abs((Number(a) || 0) - (Number(b) || 0)) <= slack;

/**
 * iOS PWAs pause <video> when the app is sent away. A hidden <audio> element
 * continues the same file. Never seek that audio back to a frozen video clock
 * or it will replay the last buffered couple of seconds on a loop.
 */
const useBackgroundAudioHandoff = (videoRef, { src, enabled = true } = {}) => {
  const audioRef = useRef(null);
  const wantPlayingRef = useRef(false);
  const handingOffRef = useRef(false);
  const backgroundActiveRef = useRef(false);
  const dualPlayUnsafeRef = useRef(false);

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

  const ensureSrc = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !src) return false;
    audio.loop = false;
    if (audio.getAttribute("src") !== src) {
      audio.src = src;
      audio.load();
    }
    return true;
  }, [src]);

  const playBackgroundAudio = useCallback(
    ({ unmuted = isPageHidden() } = {}) => {
      const audio = audioRef.current;
      const video = videoRef.current;
      if (!audio || !src) return Promise.resolve();

      handingOffRef.current = true;
      ensureSrc();
      setPlaybackSession();
      audio.loop = false;
      audio.muted = !unmuted;

      // If audio is already rolling, do not seek — that is what caused the
      // 2-second loop when the PWA was closed (video clock is frozen).
      if (!audio.paused) {
        backgroundActiveRef.current = unmuted;
        window.setTimeout(() => {
          handingOffRef.current = false;
        }, 300);
        return Promise.resolve();
      }

      if (
        video &&
        audio.paused &&
        !nearTime(audio.currentTime, video.currentTime)
      ) {
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
            window.setTimeout(() => {
              handingOffRef.current = false;
            }, 300);
          });

      if (audio.readyState >= 2) return start();

      return new Promise((resolve) => {
        const onReady = () => {
          start().then(resolve);
        };
        audio.addEventListener("canplay", onReady, { once: true });
      });
    },
    [src, ensureSrc, videoRef],
  );

  const pauseBackgroundAudio = useCallback(() => {
    backgroundActiveRef.current = false;
    try {
      audioRef.current?.pause();
    } catch (_) {}
  }, []);

  const isAudioPlaying = useCallback(
    () => !!(audioRef.current && !audioRef.current.paused),
    [],
  );

  useEffect(() => {
    if (!enabled || !src) return undefined;
    const video = videoRef.current;
    const audio = audioRef.current;
    if (!video) return undefined;

    const markHandoff = (ms = 300) => {
      handingOffRef.current = true;
      window.setTimeout(() => {
        handingOffRef.current = false;
      }, ms);
    };

    const onPlay = () => {
      wantPlayingRef.current = true;
      setPlaybackSession();
      ensureSrc();

      if (isPageHidden()) {
        playBackgroundAudio({ unmuted: true });
        return;
      }

      if (dualPlayUnsafeRef.current) return;

      const currentAudio = audioRef.current;
      if (!currentAudio) return;
      currentAudio.loop = false;
      currentAudio.muted = true;
      if (
        currentAudio.paused &&
        !nearTime(currentAudio.currentTime, video.currentTime)
      ) {
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
          // Keep muted audio playing so the buffer fills before the PWA is
          // closed. If iOS pauses the video because of this, fall back.
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
      const vt = Number(video.currentTime) || 0;
      const at = Number(currentAudio.currentTime) || 0;
      // Only catch audio up if it drifted behind. Never rewind it.
      if (vt - at > 0.8) {
        try {
          currentAudio.currentTime = vt;
        } catch (_) {}
      }
    };

    const goBackground = () => {
      if (video && !video.paused) wantPlayingRef.current = true;
      if (!wantPlayingRef.current) return;
      if (backgroundActiveRef.current && audio && !audio.paused) {
        audio.muted = false;
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

    const onAudioEnded = () => {
      if (!wantPlayingRef.current) return;
      const currentAudio = audioRef.current;
      const vDur = Number(video.duration);
      const aTime = Number(currentAudio?.currentTime) || 0;
      const aDur = Number(currentAudio?.duration);

      const videoNotFinished =
        Number.isFinite(vDur) && vDur > 2 && aTime < vDur - 1.25;
      const audioDurationLooksShort =
        Number.isFinite(aDur) &&
        Number.isFinite(vDur) &&
        aDur > 0 &&
        vDur - aDur > 1.5;

      if (videoNotFinished || audioDurationLooksShort) {
        try {
          if (Number.isFinite(aTime)) {
            currentAudio.currentTime = aTime;
          }
        } catch (_) {}
        currentAudio?.play().catch(() => {});
        return;
      }

      try {
        video.dispatchEvent(new Event("ended"));
      } catch (_) {}
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
    playBackgroundAudio,
    pauseBackgroundAudio,
    ensureSrc,
  ]);

  return useMemo(
    () => ({
      audioRef,
      wantPlayingRef,
      handingOffRef,
      playBackgroundAudio,
      pauseBackgroundAudio,
      isAudioPlaying,
    }),
    [playBackgroundAudio, pauseBackgroundAudio, isAudioPlaying],
  );
};

export default useBackgroundAudioHandoff;
