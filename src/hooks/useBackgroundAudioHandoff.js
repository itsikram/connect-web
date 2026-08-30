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

const normalizeSrc = (value) => {
  if (!value) return "";
  try {
    return new URL(value, window.location.href).href;
  } catch (_) {
    return String(value);
  }
};

const mediaSrc = (el) => {
  if (!el) return "";
  return normalizeSrc(el.currentSrc || el.getAttribute("src") || "");
};

const isTrueTrackEnd = (audio, video) => {
  if (!audio) return false;
  const aTime = Number(audio.currentTime) || 0;
  const aDur = Number(audio.duration);
  const vDur = Number(video?.duration);

  if (Number.isFinite(vDur) && vDur > 2 && Number.isFinite(aDur) && aDur + 1.5 < vDur) {
    return false;
  }
  if (Number.isFinite(aDur) && aDur > 1 && aTime >= aDur - 0.75) return true;
  if (Number.isFinite(vDur) && vDur > 1 && aTime >= vDur - 0.75) return true;
  return false;
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
};

const silenceVideo = (video) => {
  if (!video) return;
  try {
    video.muted = true;
    if (!video.paused) video.pause();
  } catch (_) {}
};

const snapshotAudioPosition = (audio, savedTimeRef, publishPosition) => {
  if (!audio) return;
  const nextDuration = Number(audio.duration);
  const nextPosition = Number(audio.currentTime);
  const nextRate = Number(audio.playbackRate);
  if (Number.isFinite(nextPosition) && nextPosition > 0.2 && !audio.paused) {
    savedTimeRef.current = nextPosition;
  }
  publishPosition({
    duration:
      Number.isFinite(nextDuration) && nextDuration > 0 ? nextDuration : 0,
    position:
      Number.isFinite(nextPosition) && nextPosition >= 0 ? nextPosition : 0,
    playbackRate: Number.isFinite(nextRate) && nextRate > 0 ? nextRate : 1,
    playing: !audio.paused && !audio.muted,
  });
};

const waitForAudioReady = (audio) => {
  if (!audio) return Promise.resolve();
  if (audio.readyState >= 1) return Promise.resolve();
  return new Promise((resolve) => {
    const onReady = () => {
      audio.removeEventListener("loadedmetadata", onReady);
      audio.removeEventListener("canplay", onReady);
      resolve();
    };
    audio.addEventListener("loadedmetadata", onReady, { once: true });
    audio.addEventListener("canplay", onReady, { once: true });
  });
};

const playElement = (audio, resumeAt = 0) => {
  if (!audio) return Promise.resolve(false);
  if (pendingCanPlay) {
    audio.removeEventListener("canplay", pendingCanPlay);
    pendingCanPlay = null;
  }

  const start = () => {
    if (resumeAt > 0.15) {
      try {
        if (Math.abs((Number(audio.currentTime) || 0) - resumeAt) > 0.35) {
          audio.currentTime = resumeAt;
        }
      } catch (_) {}
    }
    return audio
      .play()
      .then(() => !audio.paused)
      .catch(() => false);
  };

  if (audio.readyState >= 1) return start();

  return waitForAudioReady(audio).then(start);
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
  const userPausedRef = useRef(false);
  const savedTimeRef = useRef(0);
  const dualPlayUnsafeRef = useRef(false);
  const srcRef = useRef(src);
  srcRef.current = src;
  const loopRef = useRef(loop);
  loopRef.current = loop;
  const positionRef = useRef({
    duration: 0,
    position: 0,
    playbackRate: 1,
    playing: false,
  });
  const [mediaPosition, setMediaPosition] = useState(positionRef.current);
  const [sessionBindKey, setSessionBindKey] = useState(0);

  const applyLoop = useCallback(() => {
    const audio = audioRef.current;
    if (audio) audio.loop = !!loopRef.current;
  }, []);

  const markHandoff = useCallback((ms = 500) => {
    handingOffRef.current = true;
    window.setTimeout(() => {
      handingOffRef.current = false;
    }, ms);
  }, []);

  const publishPosition = useCallback((next) => {
    const prev = positionRef.current;
    const roundedPos = Math.round((next.position || 0) * 2) / 2;
    const roundedPrev = Math.round((prev.position || 0) * 2) / 2;
    if (
      prev.playing === next.playing &&
      prev.duration === next.duration &&
      prev.playbackRate === next.playbackRate &&
      roundedPrev === roundedPos
    ) {
      positionRef.current = next;
      return;
    }
    positionRef.current = next;
    setMediaPosition(next);
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

  const rememberTime = useCallback((value) => {
    const t = Number(value);
    if (Number.isFinite(t) && t > 0.2) {
      savedTimeRef.current = Math.max(savedTimeRef.current, t);
    }
  }, []);

  const captureResumeTime = useCallback(() => {
    const video = videoRef.current;
    const audio = audioRef.current;
    rememberTime(video?.currentTime);
    rememberTime(audio?.currentTime);
    return savedTimeRef.current;
  }, [rememberTime, videoRef]);

  const lastContentSrcRef = useRef("");

  const ensureSrc = useCallback((nextSrc = srcRef.current) => {
    const audio = audioRef.current;
    if (!audio || !nextSrc) return false;
    applyLoop();
    const normalized = normalizeSrc(nextSrc);
    if (lastContentSrcRef.current && lastContentSrcRef.current !== normalized) {
      savedTimeRef.current = 0;
    }
    lastContentSrcRef.current = normalized;
    if (mediaSrc(audio) !== normalized) {
      audio.src = nextSrc;
      audio.load();
      setSessionBindKey((key) => key + 1);
    }
    return true;
  }, [applyLoop]);

  const playBackgroundAudio = useCallback(
    ({ fromStart = false } = {}) => {
      const audio = audioRef.current;
      const video = videoRef.current;
      const nextSrc = srcRef.current;
      if (!audio || !nextSrc) return Promise.resolve(false);

      userPausedRef.current = false;
      wantPlayingRef.current = true;
      const resumeAt = fromStart ? 0 : captureResumeTime();
      markHandoff();
      const srcChanged = mediaSrc(audio) !== normalizeSrc(nextSrc);
      ensureSrc(nextSrc);
      setPlaybackSession();
      applyLoop();
      audio.muted = false;

      if (!audio.paused && !srcChanged && !fromStart) {
        backgroundActiveRef.current = true;
        silenceVideo(video);
        snapshotAudioPosition(audio, savedTimeRef, publishPosition);
        return Promise.resolve(true);
      }

      if (fromStart) {
        savedTimeRef.current = 0;
      } else if (resumeAt > 0.2) {
        savedTimeRef.current = resumeAt;
      }

      return playElement(audio, fromStart ? 0 : resumeAt).then((ok) => {
        backgroundActiveRef.current = !!ok;
        if (ok) silenceVideo(video);
        snapshotAudioPosition(audio, savedTimeRef, publishPosition);
        return ok;
      });
    },
    [
      applyLoop,
      captureResumeTime,
      ensureSrc,
      markHandoff,
      publishPosition,
      videoRef,
    ],
  );

  const pauseBackgroundAudio = useCallback(() => {
    userPausedRef.current = true;
    wantPlayingRef.current = false;
    backgroundActiveRef.current = false;
    markHandoff();
    captureResumeTime();
    const audio = audioRef.current;
    if (audio) {
      rememberTime(audio.currentTime);
    }
    try {
      audio?.pause();
    } catch (_) {}
  }, [markHandoff, captureResumeTime, rememberTime]);

  const isAudioPlaying = useCallback(
    () => !!(audioRef.current && !audioRef.current.paused),
    [],
  );

  const restartBackgroundAudio = useCallback(() => {
    const audio = audioRef.current;
    const video = videoRef.current;
    userPausedRef.current = false;
    wantPlayingRef.current = true;
    savedTimeRef.current = 0;
    applyLoop();
    silenceVideo(video);
    try {
      if (video) video.currentTime = 0;
    } catch (_) {}
    if (!audio) return Promise.resolve(false);
    markHandoff();
    try {
      audio.currentTime = 0;
    } catch (_) {}
    audio.muted = false;
    return playElement(audio).then((ok) => {
      backgroundActiveRef.current = !!ok;
      snapshotAudioPosition(audio, savedTimeRef, publishPosition);
      return ok;
    });
  }, [applyLoop, markHandoff, publishPosition, videoRef]);

  useEffect(() => {
    applyLoop();
  }, [loop, applyLoop]);

  useEffect(() => {
    if (!enabled || !src) return undefined;
    if (!wantPlayingRef.current || userPausedRef.current) {
      ensureSrc(src);
      return undefined;
    }
    const audio = audioRef.current;
    if (!audio) return undefined;
    if (mediaSrc(audio) === normalizeSrc(src) && !audio.paused) return undefined;

    markHandoff();
    ensureSrc(src);
    const resumeAt = captureResumeTime();
    applyLoop();

    if (isPageHidden() || backgroundActiveRef.current) {
      audio.muted = false;
      playElement(audio, resumeAt).then((ok) => {
        backgroundActiveRef.current = !!ok;
        if (ok) silenceVideo(videoRef.current);
      });
    }
    return undefined;
  }, [src, enabled, applyLoop, captureResumeTime, ensureSrc, markHandoff, videoRef]);

  useEffect(() => {
    if (!enabled || !src) return undefined;
    const video = videoRef.current;
    const audio = audioRef.current;
    if (!video) return undefined;

    const startMutedCompanion = () => {
      if (dualPlayUnsafeRef.current || isPageHidden()) return;
      const currentAudio = audioRef.current;
      if (!currentAudio) return;
      currentAudio.muted = true;
      applyLoop();
      ensureSrc();
      const resumeAt =
        Number(video.currentTime) || savedTimeRef.current || 0;
      rememberTime(resumeAt);
      markHandoff(600);
      playElement(currentAudio, resumeAt).then((ok) => {
        if (!ok) return;
        if (isPageHidden()) {
          currentAudio.muted = false;
          backgroundActiveRef.current = true;
        }
      });
    };

    const onPlay = () => {
      userPausedRef.current = false;
      wantPlayingRef.current = true;
      setPlaybackSession();
      if (isPageHidden() || backgroundActiveRef.current) {
        playBackgroundAudio();
        return;
      }
      startMutedCompanion();
    };

    const onPause = () => {
      rememberTime(video.currentTime);
      if (handingOffRef.current) return;
      if (userPausedRef.current) return;
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
      if (userPausedRef.current) return;
      captureResumeTime();
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
        currentAudio.muted = true;
      }

      if (wantPlayingRef.current) {
        video
          .play()
          .then(() => {
            if (dualPlayUnsafeRef.current) pauseBackgroundAudio();
          })
          .catch(() => {
            if (wasBackground || isPageHidden()) playBackgroundAudio();
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
      applyLoop();
      const currentAudio = audioRef.current;
      if (loopRef.current) {
        if (currentAudio?.paused) restartBackgroundAudio();
        return;
      }
      if (!isTrueTrackEnd(currentAudio, video)) return;
      if (!isPageHidden() && !backgroundActiveRef.current) return;
      const handler = onEndedRef?.current;
      if (typeof handler === "function") handler();
    };

    const syncMediaPosition = () => {
      const currentAudio = audioRef.current;
      if (!currentAudio) return;
      const nextDuration = Number(currentAudio.duration);
      const nextPosition = Number(currentAudio.currentTime);
      const nextRate = Number(currentAudio.playbackRate);
      if (Number.isFinite(nextPosition) && nextPosition > 0.2 && !currentAudio.paused) {
        savedTimeRef.current = nextPosition;
      }
      publishPosition({
        duration:
          Number.isFinite(nextDuration) && nextDuration > 0 ? nextDuration : 0,
        position:
          Number.isFinite(nextPosition) && nextPosition >= 0 ? nextPosition : 0,
        playbackRate:
          Number.isFinite(nextRate) && nextRate > 0 ? nextRate : 1,
        playing: !currentAudio.paused && !currentAudio.muted,
      });
    };

    const onVideoTimeUpdate = () => {
      if (!video.paused) rememberTime(video.currentTime);
    };

    const onAudioPause = () => {
      const currentAudio = audioRef.current;
      if (currentAudio) rememberTime(currentAudio.currentTime);
      syncMediaPosition();
    };

    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("timeupdate", onVideoTimeUpdate);
    audio?.addEventListener("ended", onAudioEnded);
    audio?.addEventListener("timeupdate", syncMediaPosition);
    audio?.addEventListener("durationchange", syncMediaPosition);
    audio?.addEventListener("loadedmetadata", syncMediaPosition);
    audio?.addEventListener("play", syncMediaPosition);
    audio?.addEventListener("pause", onAudioPause);
    const positionTimer = window.setInterval(syncMediaPosition, 1000);
    syncMediaPosition();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", goBackground);
    window.addEventListener("freeze", goBackground);
    window.addEventListener("pageshow", goForeground);

    if (!video.paused) {
      wantPlayingRef.current = true;
      if (isPageHidden() || backgroundActiveRef.current) {
        playBackgroundAudio();
      } else {
        startMutedCompanion();
      }
    }

    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("timeupdate", onVideoTimeUpdate);
      audio?.removeEventListener("ended", onAudioEnded);
      audio?.removeEventListener("timeupdate", syncMediaPosition);
      audio?.removeEventListener("durationchange", syncMediaPosition);
      audio?.removeEventListener("loadedmetadata", syncMediaPosition);
      audio?.removeEventListener("play", syncMediaPosition);
      audio?.removeEventListener("pause", onAudioPause);
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
    onEndedRef,
    playBackgroundAudio,
    pauseBackgroundAudio,
    restartBackgroundAudio,
    ensureSrc,
    applyLoop,
    markHandoff,
    publishPosition,
    rememberTime,
    captureResumeTime,
  ]);

  const controls = useMemo(
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

  return {
    ...controls,
    mediaPosition,
    sessionBindKey,
  };
};

export default useBackgroundAudioHandoff;
