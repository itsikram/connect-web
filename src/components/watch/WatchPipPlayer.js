import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import { useWatchPip } from "../../contexts/WatchPipContext";
import useMediaSession from "../../hooks/useMediaSession";
import useBackgroundAudioHandoff from "../../hooks/useBackgroundAudioHandoff";
import { clampPlayCount } from "../../utils/videoPlayerLibrary";
import { getPipPlaylistIndex } from "../../utils/watchPipHelpers";
import "./WatchPipPlayer.css";

const EDGE_PAD = 8;

const clampPos = (x, y, width, height) => {
  const maxX = Math.max(EDGE_PAD, window.innerWidth - width - EDGE_PAD);
  const maxY = Math.max(EDGE_PAD, window.innerHeight - height - EDGE_PAD);
  return {
    x: Math.min(maxX, Math.max(EDGE_PAD, x)),
    y: Math.min(maxY, Math.max(EDGE_PAD, y)),
  };
};

const nearestDock = (x, y, width, height) => {
  const cx = x + width / 2;
  const cy = y + height / 2;
  const distances = {
    left: cx,
    right: window.innerWidth - cx,
    top: cy,
    bottom: window.innerHeight - cy,
  };
  return Object.keys(distances).reduce((best, side) =>
    distances[side] < distances[best] ? side : best,
  );
};

const snapToDock = (dock, width, height, currentY, currentX) => {
  const maxX = Math.max(EDGE_PAD, window.innerWidth - width - EDGE_PAD);
  const maxY = Math.max(EDGE_PAD, window.innerHeight - height - EDGE_PAD);
  const x = Math.min(
    maxX,
    Math.max(EDGE_PAD, currentX ?? (window.innerWidth - width) / 2),
  );
  const y = Math.min(
    maxY,
    Math.max(EDGE_PAD, currentY ?? (window.innerHeight - height) / 2),
  );

  if (dock === "left") return { x: EDGE_PAD, y };
  if (dock === "right") return { x: maxX, y };
  if (dock === "top") return { x, y: EDGE_PAD };
  return { x, y: maxY };
};

const isPipInteractiveTarget = (target) =>
  !!target?.closest?.(
    "button, video, input, select, textarea, a, .watch-pip-index",
  );

const WatchPipPlayer = () => {
  const { pip, closePip, updatePip } = useWatchPip();
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const dragRef = useRef(null);
  const [paused, setPaused] = useState(false);
  const [pos, setPos] = useState(null);
  const [minimized, setMinimized] = useState(false);
  const [dock, setDock] = useState("right");
  const dragState = useRef(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [mediaReady, setMediaReady] = useState(false);
  const pipTrackKey = pip
    ? `${pip.source}:${pip.watchId || pip.libraryVideoId}:${pip.videoUrl}`
    : "";
  const initialPlaybackRef = useRef(null);
  const playlist = Array.isArray(pip?.playlist) ? pip.playlist : [];
  const isLibrary = pip?.source === "library";
  const looping = !!pip?.looping;
  const backgroundEndedRef = useRef(() => {});
  const backgroundAudio = useBackgroundAudioHandoff(videoRef, {
    src: pip?.videoUrl,
    enabled: !!pip,
    loop: looping && playlist.length <= 1,
    onEndedRef: backgroundEndedRef,
  });

  if (pip && initialPlaybackRef.current?.trackKey !== pipTrackKey) {
    initialPlaybackRef.current = {
      trackKey: pipTrackKey,
      currentTime: pip.currentTime || 0,
      muted: !!pip.muted,
      playing: pip.playing !== false,
    };
  }

  useEffect(() => {
    const url = pip?.videoUrl;
    if (!pipTrackKey || !url) return undefined;
    const video = videoRef.current;
    if (!video) return undefined;

    let cancelled = false;
    setMediaReady(false);

    const playWhenReady = () => {
      if (cancelled) return;
      setMediaReady(true);
      const initialPlayback = initialPlaybackRef.current;
      try {
        const resumeAt = Number(initialPlayback?.currentTime) || 0;
        if (resumeAt > 0.2 && Number.isFinite(video.duration)) {
          video.currentTime = Math.min(resumeAt, video.duration);
        }
        video.muted = !!initialPlayback?.muted;
        if (initialPlayback?.playing !== false) {
          if (document.hidden) {
            try {
              video.muted = true;
              video.pause();
            } catch (_) {}
            backgroundAudio.wantPlayingRef.current = true;
            backgroundAudio.playBackgroundAudio({ fromStart: true });
            setPaused(false);
          } else {
            video.play().catch(() => setPaused(true));
          }
        } else {
          setPaused(true);
        }
      } catch (_) {}
    };

    video.addEventListener("canplay", playWhenReady, { once: true });

    if (video.getAttribute("src") !== url) {
      try {
        video.pause();
      } catch (_) {}
      video.src = url;
      video.load();
    } else if (video.readyState >= 3) {
      playWhenReady();
    }

    return () => {
      cancelled = true;
      video.removeEventListener("canplay", playWhenReady);
    };
  }, [pipTrackKey, pip?.videoUrl, backgroundAudio]);

  useEffect(() => {
    const video = videoRef.current;
    if (video) video.loop = false;
  }, [pipTrackKey]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || pip?.playing === undefined) return;

    if (pip.playing && video.paused && video.readyState >= 2) {
      if (document.hidden) {
        if (!backgroundAudio.isAudioPlaying()) {
          backgroundAudio.playBackgroundAudio();
        }
      } else if (!backgroundAudio.handingOffRef.current) {
        video.play().catch(() => setPaused(true));
      }
    } else if (
      !pip.playing &&
      !video.paused &&
      !backgroundAudio.handingOffRef.current
    ) {
      video.pause();
      backgroundAudio.pauseBackgroundAudio();
    }
  }, [pip?.playing, pipTrackKey, mediaReady, backgroundAudio]);

  useEffect(() => {
    if (!pipTrackKey) return undefined;
    const video = videoRef.current;
    if (!video) return undefined;

    const sync = () => {
      const nextTime = Number(video.currentTime);
      const nextDuration = Number(video.duration);
      const nextRate = Number(video.playbackRate);

      setCurrentTime(Number.isFinite(nextTime) ? Math.max(0, nextTime) : 0);
      setDuration(
        Number.isFinite(nextDuration) ? Math.max(0, nextDuration) : 0,
      );
      setPlaybackRate(Number.isFinite(nextRate) && nextRate > 0 ? nextRate : 1);
    };

    const persistProgress = () => {
      const audio = backgroundAudio.audioRef.current;
      const usingAudio =
        document.hidden && !!(audio && !audio.paused);
      if (usingAudio) {
        updatePip({
          currentTime: audio.currentTime,
          playing: true,
          muted: false,
        });
        return;
      }
      if (document.hidden && backgroundAudio.wantPlayingRef.current) {
        return;
      }
      updatePip({
        currentTime: video.currentTime,
        playing: !video.paused,
        muted: video.muted,
      });
    };

    const onPlay = () => {
      setPaused(false);
      sync();
      updatePip({ playing: true, muted: video.muted });
    };

    const onPause = () => {
      if (backgroundAudio.handingOffRef.current) return;
      if (document.hidden && backgroundAudio.wantPlayingRef.current) return;
      setPaused(true);
      sync();
      persistProgress();
    };

    sync();

    video.addEventListener("timeupdate", sync);
    video.addEventListener("durationchange", sync);
    video.addEventListener("ratechange", sync);
    video.addEventListener("loadedmetadata", sync);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);

    const progressTimer = window.setInterval(persistProgress, 1000);

    return () => {
      video.removeEventListener("timeupdate", sync);
      video.removeEventListener("durationchange", sync);
      video.removeEventListener("ratechange", sync);
      video.removeEventListener("loadedmetadata", sync);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      window.clearInterval(progressTimer);
    };
  }, [pipTrackKey, updatePip, backgroundAudio]);

  const playCurrent = useCallback(() => {
    backgroundAudio.wantPlayingRef.current = true;
    if (document.hidden) {
      return backgroundAudio
        .playBackgroundAudio()
        .then(() => setPaused(false));
    }
    const video = videoRef.current;
    if (!video) return Promise.resolve();
    return video.play().then(() => setPaused(false));
  }, [backgroundAudio]);

  const pauseCurrent = useCallback(() => {
    backgroundAudio.wantPlayingRef.current = false;
    backgroundAudio.pauseBackgroundAudio();
    const video = videoRef.current;
    if (video) video.pause();
    setPaused(true);
  }, [backgroundAudio]);

  const seekBy = useCallback((delta) => {
    const video = videoRef.current;
    const audio = backgroundAudio.audioRef.current;
    const el = audio && !audio.paused ? audio : video;
    if (!el) return;

    const base = Number(el.currentTime);
    const maxDuration = Number(el.duration);
    if (!Number.isFinite(base)) return;

    const next = base + delta;
    const clamped =
      Number.isFinite(maxDuration) && maxDuration > 0
        ? Math.min(maxDuration, Math.max(0, next))
        : Math.max(0, next);
    el.currentTime = clamped;
    if (video && video !== el) {
      try {
        video.currentTime = clamped;
      } catch (_) {}
    }
  }, [backgroundAudio]);

  const seekTo = useCallback((details) => {
    const video = videoRef.current;
    const audio = backgroundAudio.audioRef.current;
    const el = document.hidden && audio ? audio : video;
    if (!el) return;

    const requested = Number(details?.seekTime);
    if (!Number.isFinite(requested) || requested < 0) return;

    const maxDuration = Number(el.duration);
    const target =
      Number.isFinite(maxDuration) && maxDuration > 0
        ? Math.min(maxDuration, requested)
        : requested;

    if (details?.fastSeek && typeof el.fastSeek === "function") {
      try {
        el.fastSeek(target);
        return;
      } catch (_) {}
    }

    el.currentTime = target;
    if (video && video !== el) {
      try {
        video.currentTime = target;
      } catch (_) {}
    }
  }, [backgroundAudio]);

  const switchPlaylistByOffset = useCallback(
    (offset) => {
      if (playlist.length <= 1) return;
      const idx = Math.max(0, getPipPlaylistIndex(playlist, pip));
      let next = null;
      for (let step = 1; step <= playlist.length; step += 1) {
        const candidate =
          playlist[(idx + offset * step + playlist.length * step) % playlist.length];
        if (candidate?.url && candidate.url !== pip?.videoUrl) {
          next = candidate;
          break;
        }
        if (candidate?.url) next = candidate;
      }
      if (!next?.url) return;
      const nextWatchId = next.watchId || (pip?.source === "watch" ? next.id : null);
      updatePip({
        watchId: nextWatchId || pip?.watchId || null,
        libraryVideoId: next.videoId || next.id,
        videoId: next.videoId || next.id,
        videoUrl: next.url,
        title: next.title,
        thumbnail: next.thumbnail || "",
        currentTime: 0,
        playing: true,
        playPass: 1,
        source: nextWatchId ? "watch" : pip?.source || "library",
        expandPath: pip?.expandPath || "",
      });
    },
    [playlist, pip, updatePip],
  );

  const replayCurrent = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      try {
        video.currentTime = 0;
      } catch (_) {}
    }
    if (document.hidden) {
      backgroundAudio.wantPlayingRef.current = true;
      backgroundAudio.restartBackgroundAudio();
      setPaused(false);
      updatePip({ playing: true, currentTime: 0 });
      return;
    }
    if (!video) return;
    video.play().catch(() => {});
  }, [backgroundAudio, updatePip]);

  const handlePrev = useCallback(() => {
    const livePosition = backgroundAudio.mediaPosition.playing
      ? backgroundAudio.mediaPosition.position
      : currentTime;
    if (livePosition > 3 || playlist.length <= 1) {
      replayCurrent();
      return;
    }
    switchPlaylistByOffset(-1);
  }, [
    backgroundAudio,
    currentTime,
    playlist.length,
    replayCurrent,
    switchPlaylistByOffset,
  ]);

  const handleNext = useCallback(() => {
    if (playlist.length <= 1) {
      replayCurrent();
      return;
    }
    switchPlaylistByOffset(1);
  }, [playlist.length, replayCurrent, switchPlaylistByOffset]);

  const handleEnded = useCallback(() => {
    const idx = getPipPlaylistIndex(playlist, pip);
    const item = (idx >= 0 ? playlist[idx] : null) || {};
    const times = clampPlayCount(item.playCount || 1);
    const pass = Math.max(1, Number(pip?.playPass) || 1);

    if (pass < times) {
      updatePip({ playPass: pass + 1, currentTime: 0, playing: true });
      replayCurrent();
      return;
    }

    if (playlist.length <= 1) {
      if (looping) {
        updatePip({ playPass: 1, currentTime: 0, playing: true });
        replayCurrent();
      } else {
        backgroundAudio.wantPlayingRef.current = false;
        backgroundAudio.pauseBackgroundAudio();
        updatePip({ playing: false });
        setPaused(true);
      }
      return;
    }

    const atLast = idx >= playlist.length - 1;
    if (atLast && !looping) {
      backgroundAudio.wantPlayingRef.current = false;
      backgroundAudio.pauseBackgroundAudio();
      updatePip({ playing: false });
      setPaused(true);
      return;
    }

    switchPlaylistByOffset(1);
  }, [
    playlist,
    pip,
    looping,
    updatePip,
    switchPlaylistByOffset,
    replayCurrent,
    backgroundAudio,
  ]);
  backgroundEndedRef.current = handleEnded;

  const mediaSessionHandlers = useMemo(
    () => ({
      play: () => playCurrent().catch(() => {}),
      pause: () => pauseCurrent(),
      previoustrack: () => handlePrev(),
      nexttrack: () => handleNext(),
      seekbackward: (details) => seekBy(-(Number(details?.seekOffset) || 10)),
      seekforward: (details) => seekBy(Number(details?.seekOffset) || 10),
      seekto: (details) => seekTo(details),
    }),
    [playCurrent, pauseCurrent, handlePrev, handleNext, seekBy, seekTo],
  );

  const mediaArtwork = useMemo(() => {
    const buildAbsoluteArtwork = (src, sizes, type) => {
      if (!src) return null;
      try {
        const image = {
          src: new URL(src, window.location.origin).toString(),
          sizes,
        };
        if (type) image.type = type;
        return image;
      } catch (_) {
        return null;
      }
    };

    const artwork = [];
    const thumb = buildAbsoluteArtwork(pip?.thumbnail, "512x512");
    if (thumb) artwork.push(thumb);

    const logo512 = buildAbsoluteArtwork(
      "/logo512.png",
      "512x512",
      "image/png",
    );
    if (logo512) artwork.push(logo512);

    const logo192 = buildAbsoluteArtwork(
      "/logo192.png",
      "192x192",
      "image/png",
    );
    if (logo192) artwork.push(logo192);

    return artwork;
  }, [pip?.thumbnail]);

  useMediaSession({
    enabled: !!pip,
    bindKey: `${pipTrackKey}:${backgroundAudio.sessionBindKey}`,
    metadata: pip
      ? {
          title: pip.title || "Connect Watch",
          artist:
            pip.source === "library" ? "Video pop-out player" : "Watch feed",
          album: "Connect Watch",
          artwork: mediaArtwork,
        }
      : null,
    playbackState:
      paused && !backgroundAudio.mediaPosition.playing ? "paused" : "playing",
    positionState: {
      duration:
        backgroundAudio.mediaPosition.playing &&
        backgroundAudio.mediaPosition.duration > 0
          ? backgroundAudio.mediaPosition.duration
          : duration,
      position:
        backgroundAudio.mediaPosition.playing &&
        backgroundAudio.mediaPosition.duration > 0
          ? backgroundAudio.mediaPosition.position
          : currentTime,
      playbackRate: backgroundAudio.mediaPosition.playing
        ? backgroundAudio.mediaPosition.playbackRate
        : playbackRate,
    },
    handlers: mediaSessionHandlers,
  });

  useEffect(() => {
    const onResize = () => {
      const el = dragRef.current;
      if (!el || !pos) return;
      const rect = el.getBoundingClientRect();
      setPos(clampPos(pos.x, pos.y, rect.width, rect.height));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [pos]);

  if (!pip) return null;

  const togglePlay = (e) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      playCurrent().catch(() => {});
    } else {
      pauseCurrent();
    }
  };

  const persistNow = () => {
    const video = videoRef.current;
    if (!video) return pip.currentTime;
    updatePip({
      currentTime: video.currentTime,
      playing: !video.paused,
      muted: video.muted,
    });
    return video.currentTime;
  };

  const handleExpand = () => {
    const time = persistNow();
    closePip();

    if (pip.expandPath) {
      navigate(pip.expandPath, {
        state: { resumeAt: time, autoplay: true },
      });
      return;
    }

    if (pip.source === "library" && pip.libraryVideoId) {
      const savedId = String(pip.libraryVideoId).startsWith("saved-")
        ? String(pip.libraryVideoId).replace(/^saved-/, "")
        : "";
      if (savedId && !window.location.pathname.startsWith("/video-player")) {
        navigate(`/downloads/${savedId}`, {
          state: { resumeAt: time, autoplay: true },
        });
        return;
      }
      navigate("/video-player", {
        state: {
          resumeAt: time,
          videoId: pip.videoId || pip.libraryVideoId,
          autoplay: true,
        },
      });
      return;
    }

    navigate(`/watch/${pip.watchId}`, {
      state: { resumeAt: time, autoplay: true },
    });
  };

  const handleClose = (e) => {
    e.stopPropagation();
    pauseCurrent();
    closePip();
  };

  const onPointerDown = (e) => {
    if (isPipInteractiveTarget(e.target)) return;
    const el = dragRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    dragState.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: pos ? pos.x : rect.left,
      origY: pos ? pos.y : rect.top,
      width: rect.width,
      height: rect.height,
      moved: false,
    };
    el.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e) => {
    if (!dragState.current) return;
    const dx = e.clientX - dragState.current.startX;
    const dy = e.clientY - dragState.current.startY;
    if (Math.abs(dx) + Math.abs(dy) > 6) dragState.current.moved = true;
    const width = dragState.current.width || 220;
    const height = dragState.current.height || 180;
    setPos(
      clampPos(
        dragState.current.origX + dx,
        dragState.current.origY + dy,
        width,
        height,
      ),
    );
  };

  const onPointerUp = () => {
    const el = dragRef.current;
    const wasDrag = dragState.current?.moved;
    dragState.current = null;
    if (!wasDrag || !el) return;

    const rect = el.getBoundingClientRect();
    const nextDock = nearestDock(rect.left, rect.top, rect.width, rect.height);
    if (minimized) {
      setDock(nextDock);
      setPos(
        snapToDock(nextDock, rect.width, rect.height, rect.top, rect.left),
      );
    }
  };

  const handleMinimize = (e) => {
    e.stopPropagation();
    const el = dragRef.current;
    const rect = el?.getBoundingClientRect();
    const nextDock = rect
      ? nearestDock(rect.left, rect.top, rect.width, rect.height)
      : "right";
    setDock(nextDock);
    setMinimized(true);
    if (rect) {
      const vertical = nextDock === "left" || nextDock === "right";
      setPos(
        snapToDock(
          nextDock,
          vertical ? 64 : 220,
          vertical ? 220 : 56,
          rect.top,
          rect.left,
        ),
      );
    }
  };

  const handleRestore = (e) => {
    e?.stopPropagation?.();
    setMinimized(false);
  };

  const style = pos
    ? { left: pos.x, top: pos.y, right: "auto", bottom: "auto" }
    : undefined;

  const playlistIndex = getPipPlaylistIndex(playlist, pip);
  const canSkip = playlist.length > 1;

  return (
    <div
      ref={dragRef}
      className={`watch-pip-player ${isLibrary ? "is-library" : "is-watch"} ${minimized ? `is-minimized dock-${dock}` : ""}`}
      style={style}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      role="dialog"
      aria-label={
        isLibrary ? "Video pop-out player" : "Watch picture in picture"
      }
    >
      {minimized ? (
        <div className="watch-pip-mini">
          <div className="watch-pip-mini-thumb watch-pip-drag" title={pip.title}>
            {pip.thumbnail ? (
              <img src={pip.thumbnail} alt="" />
            ) : (
              <i className="fas fa-film" aria-hidden="true" />
            )}
          </div>
          <button
            type="button"
            className="watch-pip-btn"
            onClick={(e) => {
              e.stopPropagation();
              handlePrev();
            }}
            disabled={!canSkip}
            title="Previous"
            aria-label="Previous"
          >
            <i className="fas fa-step-backward" />
          </button>
          <button
            type="button"
            className="watch-pip-btn watch-pip-btn-primary"
            onClick={togglePlay}
            title={paused ? "Play" : "Pause"}
            aria-label={paused ? "Play" : "Pause"}
          >
            <i className={`fas ${paused ? "fa-play" : "fa-pause"}`} />
          </button>
          <button
            type="button"
            className="watch-pip-btn"
            onClick={(e) => {
              e.stopPropagation();
              handleNext();
            }}
            disabled={!canSkip}
            title="Next"
            aria-label="Next"
          >
            <i className="fas fa-step-forward" />
          </button>
          <button
            type="button"
            className="watch-pip-btn"
            onClick={handleRestore}
            aria-label="Maximize player"
            title="Maximize"
          >
            <i className="fas fa-window-maximize" />
          </button>
        </div>
      ) : (
        <>
          <div className="watch-pip-chrome watch-pip-drag">
            <span className="watch-pip-chrome-title">{pip.title}</span>
            <button
              type="button"
              className="watch-pip-btn"
              onClick={handleMinimize}
              aria-label="Minimize player"
              title="Minimize to nearest side"
            >
              <i className="fas fa-minus" />
            </button>
            <button
              type="button"
              className="watch-pip-btn"
              onClick={(e) => {
                e.stopPropagation();
                handleExpand();
              }}
              aria-label="Expand"
            >
              <i className="fas fa-expand" />
            </button>
            <button
              type="button"
              className="watch-pip-btn watch-pip-close"
              onClick={handleClose}
              aria-label="Close"
            >
              <i className="fas fa-times" />
            </button>
          </div>
        </>
      )}
      <div className={`watch-pip-video-wrap${minimized ? " is-audio-only" : ""}${mediaReady ? "" : " is-loading"}`}>
        <video
          ref={videoRef}
          className="watch-pip-video"
          controls={!minimized && mediaReady}
          playsInline
          webkit-playsinline="true"
          preload="auto"
          poster={pip.thumbnail || undefined}
          onEnded={handleEnded}
        />
        {!minimized && !mediaReady ? (
          <div className="watch-pip-media-cover" aria-hidden="true">
            {pip.thumbnail ? (
              <img src={pip.thumbnail} alt="" />
            ) : (
              <i className="fas fa-spinner fa-spin" />
            )}
          </div>
        ) : null}
      </div>
      {!minimized ? (
          <div className="watch-pip-toolbar">
            <button
              type="button"
              className="watch-pip-btn"
              onClick={(e) => {
                e.stopPropagation();
                handlePrev();
              }}
              disabled={!canSkip}
              title="Previous"
              aria-label="Previous"
            >
              <i className="fas fa-step-backward" />
            </button>
            <button
              type="button"
              className="watch-pip-btn watch-pip-btn-primary"
              onClick={togglePlay}
              title={paused ? "Play" : "Pause"}
              aria-label={paused ? "Play" : "Pause"}
            >
              <i className={`fas ${paused ? "fa-play" : "fa-pause"}`} />
            </button>
            <button
              type="button"
              className="watch-pip-btn"
              onClick={(e) => {
                e.stopPropagation();
                handleNext();
              }}
              disabled={!canSkip}
              title="Next"
              aria-label="Next"
            >
              <i className="fas fa-step-forward" />
            </button>
            <button
              type="button"
              className={`watch-pip-btn ${looping ? "is-active" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                updatePip({ looping: !looping });
              }}
              title={looping ? "Repeat playlist on" : "Repeat playlist off"}
              aria-label={looping ? "Repeat playlist on" : "Repeat playlist off"}
            >
              <i className="fas fa-redo" />
            </button>
            {canSkip ? (
              <span className="watch-pip-index">
                {playlistIndex >= 0 ? playlistIndex + 1 : 1}/{playlist.length}
                {clampPlayCount(playlist[playlistIndex]?.playCount || 1) > 1
                  ? ` · ${Math.max(1, Number(pip.playPass) || 1)}/${clampPlayCount(playlist[playlistIndex].playCount)}`
                  : ""}
              </span>
            ) : null}
          </div>
      ) : null}
    </div>
  );
};

export default WatchPipPlayer;
