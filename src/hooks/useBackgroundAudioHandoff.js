import { useCallback, useEffect, useRef } from "react";

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

/**
 * iOS locks and Home Screen PWAs pause <video>. Keep a hidden <audio>
 * element playing (muted in the foreground) so lock-screen audio is already
 * in a playing session and does not need a new gesture.
 */
const useBackgroundAudioHandoff = (videoRef, { src, enabled = true } = {}) => {
  const audioRef = useRef(null);
  const wantPlayingRef = useRef(false);
  const handingOffRef = useRef(false);

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

  const syncAudioFromVideo = useCallback(() => {
    const video = videoRef.current;
    const audio = audioRef.current;
    if (!audio || !src) return;

    if (audio.getAttribute("src") !== src) {
      audio.src = src;
      audio.load();
    }

    if (video) {
      try {
        audio.loop = !!video.loop;
      } catch (_) {}
      try {
        const videoTime = Number(video.currentTime) || 0;
        if (Math.abs((Number(audio.currentTime) || 0) - videoTime) > 0.35) {
          audio.currentTime = videoTime;
        }
      } catch (_) {}
    }
  }, [src, videoRef]);

  const playBackgroundAudio = useCallback(
    ({ unmuted = isPageHidden() } = {}) => {
      const audio = audioRef.current;
      if (!audio || !src) return Promise.resolve();

      handingOffRef.current = true;
      syncAudioFromVideo();
      setPlaybackSession();
      audio.muted = !unmuted;

      const start = () =>
        audio.play().catch(() => {}).finally(() => {
          window.setTimeout(() => {
            handingOffRef.current = false;
          }, 400);
        });

      if (audio.readyState >= 2) return start();

      return new Promise((resolve) => {
        const onReady = () => {
          start().then(resolve);
        };
        audio.addEventListener("canplay", onReady, { once: true });
      });
    },
    [src, syncAudioFromVideo],
  );

  const pauseBackgroundAudio = useCallback(() => {
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

    const onPlay = () => {
      wantPlayingRef.current = true;
      setPlaybackSession();
      syncAudioFromVideo();

      if (isPageHidden()) {
        playBackgroundAudio({ unmuted: true });
        return;
      }

      // Unlock <audio> in the same user-gesture window as <video>, then
      // pause it so iOS does not stop the visible video. Later lock/hide
      // can call play() on this already-unlocked element.
      const currentAudio = audioRef.current;
      if (!currentAudio) return;
      currentAudio.muted = true;
      currentAudio.play()
        .then(() => {
          if (!isPageHidden()) {
            try {
              currentAudio.pause();
            } catch (_) {}
          } else {
            currentAudio.muted = false;
          }
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
        pauseBackgroundAudio();
      }
    };

    const onTimeUpdate = () => {
      if (isPageHidden()) return;
      if (!audio || audio.paused) return;
      try {
        const vt = Number(video.currentTime) || 0;
        if (Math.abs((Number(audio.currentTime) || 0) - vt) > 0.45) {
          audio.currentTime = vt;
        }
      } catch (_) {}
    };

    const goBackground = () => {
      if (video && !video.paused) wantPlayingRef.current = true;
      if (!wantPlayingRef.current) return;
      setPlaybackSession();
      playBackgroundAudio({ unmuted: true });
      handingOffRef.current = true;
      try {
        video.muted = true;
        video.pause();
      } catch (_) {}
      window.setTimeout(() => {
        handingOffRef.current = false;
      }, 400);
    };

    const goForeground = () => {
      const currentAudio = audioRef.current;
      handingOffRef.current = true;
      try {
        video.muted = false;
      } catch (_) {}

      if (currentAudio && !currentAudio.paused) {
        try {
          video.currentTime = currentAudio.currentTime;
        } catch (_) {}
        currentAudio.muted = true;
      }

      if (wantPlayingRef.current) {
        video.play().catch(() => {
          playBackgroundAudio({ unmuted: true });
        });
      } else {
        pauseBackgroundAudio();
      }

      window.setTimeout(() => {
        handingOffRef.current = false;
      }, 400);
    };

    const onVisibility = () => {
      if (isPageHidden()) goBackground();
      else goForeground();
    };

    const onAudioEnded = () => {
      if (!wantPlayingRef.current) return;
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
    syncAudioFromVideo,
  ]);

  return {
    audioRef,
    wantPlayingRef,
    handingOffRef,
    playBackgroundAudio,
    pauseBackgroundAudio,
    isAudioPlaying,
  };
};

export default useBackgroundAudioHandoff;
