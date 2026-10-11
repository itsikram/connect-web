import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { setLongFormMediaActive } from "../utils/audioUnlock";

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
// Several players can be mounted at once (feed, library page, pop-out) and all
// share one <audio>. Only the player that last started it may mute, pause,
// re-source or read it, otherwise one player silences or re-seeks another's
// track and both end up audible.
let ownerSeq = 0;
let activeOwner = 0;

// iOS only lets an element start or unmute audibly without a fresh gesture
// once it has been played inside one. Bless the shared element on the first
// tap so the lock-screen handoff and Control Center resume are allowed.
const BLESS_EVENTS = ["touchend", "click", "keydown"];
let blessed = false;
let blessBound = false;

const unbindBless = () => {
  BLESS_EVENTS.forEach((name) => {
    document.removeEventListener(name, blessSharedAudio, true);
  });
  blessBound = false;
};

function blessSharedAudio() {
  if (blessed) {
    unbindBless();
    return;
  }
  const audio = ensureSharedAudioElement();
  if (!audio) return;
  if (audio.ended) return;
  const wasPaused = audio.paused;
  const wasMuted = audio.muted;
  try {
    // Muted so the bless never takes the audio session from other apps.
    if (wasPaused) audio.muted = true;
    const attempt = audio.play();
    if (wasPaused) {
      audio.pause();
      audio.muted = wasMuted;
    }
    if (attempt && typeof attempt.then === "function") {
      attempt
        .then(() => {
          blessed = true;
          unbindBless();
        })
        .catch((error) => {
          // AbortError means play() was accepted and our pause() cut it short.
          if (error?.name !== "NotAllowedError") {
            blessed = true;
            unbindBless();
          }
        });
    } else {
      blessed = true;
      unbindBless();
    }
  } catch (_) {}
}

const bindBless = () => {
  if (blessed || blessBound || typeof document === "undefined") return;
  blessBound = true;
  BLESS_EVENTS.forEach((name) => {
    document.addEventListener(name, blessSharedAudio, {
      capture: true,
      passive: true,
    });
  });
};

function ensureSharedAudioElement() {
  if (typeof document === "undefined" || !document.body) return null;
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
  return sharedAudio;
}

if (typeof document !== "undefined") bindBless();

const acquireSharedAudio = () => {
  const audio = ensureSharedAudioElement();
  if (!audio) return null;
  bindBless();
  sharedOwners += 1;
  return audio;
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

// A video paused while the page still reports visible is either the user
// pausing or iOS pausing it just before the lock/home transition. Wait this
// long for visibilitychange before treating it as a user pause.
const SYSTEM_PAUSE_GRACE_MS = 700;
const COMPANION_DRIFT_S = 0.75;
const COMPANION_RESYNC_MS = 3000;

/**
 * iOS PWAs pause <video> in the background. One shared <audio> element keeps
 * the file playing. While the page is visible it runs muted in step with the
 * video so the lock-screen handoff is just an unmute (no play() needed). The
 * video must stay muted/paused while that audio is audible or the track is
 * heard twice, slightly offset, which sounds like noise/echo.
 */
const useBackgroundAudioHandoff = (
  videoRef,
  { src, enabled = true, loop = false, onEndedRef } = {},
) => {
  const ownerIdRef = useRef(0);
  if (!ownerIdRef.current) {
    ownerSeq += 1;
    ownerIdRef.current = ownerSeq;
  }
  const audioRef = useRef(null);
  const wantPlayingRef = useRef(false);
  const handingOffRef = useRef(false);
  const backgroundActiveRef = useRef(false);
  const userPausedRef = useRef(false);
  const savedTimeRef = useRef(0);
  const pendingPauseRef = useRef(0);
  const lastCompanionSyncRef = useRef(0);
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

  const claimAudio = useCallback(() => {
    activeOwner = ownerIdRef.current;
    setLongFormMediaActive(true);
  }, []);

  const clearPendingPause = useCallback(() => {
    if (pendingPauseRef.current) {
      window.clearTimeout(pendingPauseRef.current);
      pendingPauseRef.current = 0;
    }
  }, []);

  const applyLoop = useCallback(() => {
    const audio = audioRef.current;
    if (audio && activeOwner === ownerIdRef.current) {
      audio.loop = !!loopRef.current;
    }
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
    const audio = acquireSharedAudio();
    audioRef.current = audio;
    setPlaybackSession();
    return () => {
      window.clearTimeout(pendingPauseRef.current);
      pendingPauseRef.current = 0;
      audioRef.current = null;
      backgroundActiveRef.current = false;
      // Never leave the shared element running for a player that is gone:
      // an orphaned (possibly unmuted) copy plays over the next video.
      if (activeOwner === ownerIdRef.current) {
        activeOwner = 0;
        setLongFormMediaActive(false);
        try {
          audio.muted = true;
          audio.pause();
        } catch (_) {}
      }
      releaseSharedAudio();
    };
  }, [enabled]);

  const rememberTime = useCallback((value) => {
    const t = Number(value);
    if (Number.isFinite(t) && t > 0.2) savedTimeRef.current = t;
  }, []);

  const lastContentSrcRef = useRef("");

  // Read the position from whichever element is actually playing `nextSrc`,
  // so a new track never resumes at the previous track's time.
  const captureResumeTime = useCallback(
    (nextSrc = srcRef.current) => {
      const target = normalizeSrc(nextSrc);
      const video = videoRef.current;
      const audio = audioRef.current;
      const audioLive =
        !!audio &&
        activeOwner === ownerIdRef.current &&
        !audio.paused &&
        mediaSrc(audio) === target &&
        (backgroundActiveRef.current || !audio.muted);
      if (audioLive) {
        rememberTime(audio.currentTime);
      } else if (video && mediaSrc(video) === target) {
        rememberTime(video.currentTime);
      } else if (lastContentSrcRef.current !== target) {
        return 0;
      }
      return savedTimeRef.current;
    },
    [rememberTime, videoRef],
  );

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

      clearPendingPause();
      userPausedRef.current = false;
      wantPlayingRef.current = true;
      markHandoff();
      const takingOver = activeOwner !== ownerIdRef.current;
      claimAudio();
      const srcChanged = mediaSrc(audio) !== normalizeSrc(nextSrc);
      ensureSrc(nextSrc);
      const resumeAt = fromStart ? 0 : captureResumeTime(nextSrc);
      setPlaybackSession();
      applyLoop();

      if (!audio.paused && !srcChanged && !fromStart && !takingOver) {
        backgroundActiveRef.current = true;
        silenceVideo(video);
        audio.muted = false;
        snapshotAudioPosition(audio, savedTimeRef, publishPosition);
        return Promise.resolve(true);
      }

      savedTimeRef.current = fromStart ? 0 : resumeAt;
      // Silence the video first so the two copies never overlap.
      silenceVideo(video);
      audio.muted = false;
      return playElement(audio, fromStart ? 0 : resumeAt).then((ok) => {
        backgroundActiveRef.current = !!ok;
        snapshotAudioPosition(audio, savedTimeRef, publishPosition);
        return ok;
      });
    },
    [
      applyLoop,
      captureResumeTime,
      claimAudio,
      clearPendingPause,
      ensureSrc,
      markHandoff,
      publishPosition,
      videoRef,
    ],
  );

  const pauseBackgroundAudio = useCallback(() => {
    clearPendingPause();
    userPausedRef.current = true;
    wantPlayingRef.current = false;
    backgroundActiveRef.current = false;
    if (activeOwner !== ownerIdRef.current) return;
    markHandoff();
    captureResumeTime();
    setLongFormMediaActive(false);
    try {
      audioRef.current?.pause();
    } catch (_) {}
  }, [captureResumeTime, clearPendingPause, markHandoff]);

  const isAudioPlaying = useCallback(
    () =>
      !!(
        audioRef.current &&
        activeOwner === ownerIdRef.current &&
        !audioRef.current.paused
      ),
    [],
  );

  const restartBackgroundAudio = useCallback(() => {
    const audio = audioRef.current;
    const video = videoRef.current;
    clearPendingPause();
    userPausedRef.current = false;
    wantPlayingRef.current = true;
    savedTimeRef.current = 0;
    silenceVideo(video);
    try {
      if (video) video.currentTime = 0;
    } catch (_) {}
    if (!audio) return Promise.resolve(false);
    claimAudio();
    ensureSrc();
    applyLoop();
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
  }, [
    applyLoop,
    claimAudio,
    clearPendingPause,
    ensureSrc,
    markHandoff,
    publishPosition,
    videoRef,
  ]);

  useEffect(() => {
    applyLoop();
  }, [loop, applyLoop]);

  useEffect(() => {
    if (!enabled || !src) return undefined;
    const audio = audioRef.current;
    if (!audio) return undefined;
    if (!wantPlayingRef.current || userPausedRef.current) {
      // Only the current owner preloads; other mounted players must not
      // re-source an element someone else is using.
      if (activeOwner === ownerIdRef.current) ensureSrc(src);
      return undefined;
    }
    if (activeOwner && activeOwner !== ownerIdRef.current) return undefined;
    if (mediaSrc(audio) === normalizeSrc(src) && !audio.paused) return undefined;
    const inBackground = isPageHidden() || backgroundActiveRef.current;

    markHandoff();
    if (inBackground) claimAudio();
    ensureSrc(src);

    if (inBackground) {
      const resumeAt = captureResumeTime(src);
      silenceVideo(videoRef.current);
      audio.muted = false;
      playElement(audio, resumeAt).then((ok) => {
        backgroundActiveRef.current = !!ok;
      });
    }
    return undefined;
  }, [
    src,
    enabled,
    captureResumeTime,
    claimAudio,
    ensureSrc,
    markHandoff,
    videoRef,
  ]);

  useEffect(() => {
    if (!enabled || !src) return undefined;
    const video = videoRef.current;
    const audio = audioRef.current;
    if (!video) return undefined;

    const ownsAudio = () => activeOwner === ownerIdRef.current;

    const syncCompanion = (force = false) => {
      if (isPageHidden() || backgroundActiveRef.current || !ownsAudio()) return;
      const currentAudio = audioRef.current;
      if (!currentAudio || currentAudio.paused || !currentAudio.muted) return;
      if (mediaSrc(currentAudio) !== normalizeSrc(srcRef.current)) return;
      try {
        const rate = Number(video.playbackRate) || 1;
        if (currentAudio.playbackRate !== rate) currentAudio.playbackRate = rate;
      } catch (_) {}
      const vt = Number(video.currentTime);
      if (!Number.isFinite(vt)) return;
      const now = Date.now();
      if (!force && now - lastCompanionSyncRef.current < COMPANION_RESYNC_MS) {
        return;
      }
      if (
        force ||
        Math.abs((Number(currentAudio.currentTime) || 0) - vt) > COMPANION_DRIFT_S
      ) {
        lastCompanionSyncRef.current = now;
        try {
          currentAudio.currentTime = vt;
        } catch (_) {}
      }
    };

    const startMutedCompanion = () => {
      if (isPageHidden()) return;
      const currentAudio = audioRef.current;
      if (!currentAudio) return;
      currentAudio.muted = true;
      claimAudio();
      ensureSrc();
      applyLoop();
      const resumeAt = Number(video.currentTime) || 0;
      rememberTime(resumeAt);
      playElement(currentAudio, resumeAt).then((ok) => {
        if (!ok || !ownsAudio()) return;
        syncCompanion(true);
        if (isPageHidden() && wantPlayingRef.current) {
          silenceVideo(video);
          currentAudio.muted = false;
          backgroundActiveRef.current = true;
        }
      });
    };

    const onPlay = () => {
      clearPendingPause();
      userPausedRef.current = false;
      wantPlayingRef.current = true;
      setPlaybackSession();
      if (isPageHidden()) {
        playBackgroundAudio();
        return;
      }
      if (backgroundActiveRef.current) {
        // Stale background state (the foreground event was missed): the
        // video is the audible element again, so the audio goes back to
        // being a muted companion.
        backgroundActiveRef.current = false;
        const currentAudio = audioRef.current;
        if (currentAudio && ownsAudio()) currentAudio.muted = true;
        try {
          video.muted = false;
        } catch (_) {}
      }
      startMutedCompanion();
    };

    const onPause = () => {
      rememberTime(video.currentTime);
      if (handingOffRef.current || userPausedRef.current) return;
      if (isPageHidden()) {
        if (wantPlayingRef.current) playBackgroundAudio();
        return;
      }
      if (backgroundActiveRef.current) return;
      clearPendingPause();
      pendingPauseRef.current = window.setTimeout(() => {
        pendingPauseRef.current = 0;
        if (isPageHidden() || backgroundActiveRef.current) return;
        if (handingOffRef.current || !video.paused) return;
        pauseBackgroundAudio();
      }, SYSTEM_PAUSE_GRACE_MS);
    };

    const goBackground = () => {
      clearPendingPause();
      if (userPausedRef.current) return;
      if (!video.paused) wantPlayingRef.current = true;
      if (!wantPlayingRef.current) return;
      if (activeOwner && !ownsAudio() && video.paused) return;
      applyLoop();
      playBackgroundAudio();
    };

    const goForeground = () => {
      clearPendingPause();
      if (!ownsAudio()) return;
      const currentAudio = audioRef.current;
      const wasBackground = backgroundActiveRef.current;
      backgroundActiveRef.current = false;
      markHandoff();
      try {
        video.muted = false;
      } catch (_) {}

      if (currentAudio && !currentAudio.paused) {
        if (wasBackground) {
          try {
            video.currentTime = currentAudio.currentTime;
          } catch (_) {}
        }
        currentAudio.muted = true;
      }

      if (wantPlayingRef.current && !userPausedRef.current) {
        if (!video.paused) return;
        video.play().catch(() => {
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
      if (!ownsAudio() || !wantPlayingRef.current) return;
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
      if (!ownsAudio()) return;
      const currentAudio = audioRef.current;
      if (!currentAudio) return;
      snapshotAudioPosition(currentAudio, savedTimeRef, publishPosition);
    };

    const onVideoTimeUpdate = () => {
      if (video.paused) return;
      rememberTime(video.currentTime);
      syncCompanion();
    };

    const onVideoSeeked = () => {
      if (!video.paused) rememberTime(video.currentTime);
      syncCompanion(true);
    };

    const onVideoRateChange = () => syncCompanion();

    const onAudioPause = () => {
      const currentAudio = audioRef.current;
      if (currentAudio && ownsAudio() && !currentAudio.muted) {
        rememberTime(currentAudio.currentTime);
      }
      syncMediaPosition();
    };

    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("timeupdate", onVideoTimeUpdate);
    video.addEventListener("seeked", onVideoSeeked);
    video.addEventListener("ratechange", onVideoRateChange);
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
    document.addEventListener("freeze", goBackground);
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
      clearPendingPause();
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("timeupdate", onVideoTimeUpdate);
      video.removeEventListener("seeked", onVideoSeeked);
      video.removeEventListener("ratechange", onVideoRateChange);
      audio?.removeEventListener("ended", onAudioEnded);
      audio?.removeEventListener("timeupdate", syncMediaPosition);
      audio?.removeEventListener("durationchange", syncMediaPosition);
      audio?.removeEventListener("loadedmetadata", syncMediaPosition);
      audio?.removeEventListener("play", syncMediaPosition);
      audio?.removeEventListener("pause", onAudioPause);
      window.clearInterval(positionTimer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", goBackground);
      document.removeEventListener("freeze", goBackground);
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
    claimAudio,
    clearPendingPause,
    markHandoff,
    publishPosition,
    rememberTime,
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
