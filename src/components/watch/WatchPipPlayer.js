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
import "./WatchPipPlayer.css";

const WatchPipPlayer = () => {
  const { pip, closePip, updatePip } = useWatchPip();
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const dragRef = useRef(null);
  const [paused, setPaused] = useState(false);
  const [pos, setPos] = useState(null);
  const dragState = useRef(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const pipTrackKey = pip
    ? `${pip.source}:${pip.watchId || pip.libraryVideoId}:${pip.videoUrl}`
    : "";
  const initialPlaybackRef = useRef(null);
  const playlist = Array.isArray(pip?.playlist) ? pip.playlist : [];
  const isLibrary = pip?.source === "library";
  const looping = !!pip?.looping;

  if (pip && initialPlaybackRef.current?.trackKey !== pipTrackKey) {
    initialPlaybackRef.current = {
      trackKey: pipTrackKey,
      currentTime: pip.currentTime || 0,
      muted: !!pip.muted,
      playing: pip.playing !== false,
    };
  }

  useEffect(() => {
    if (!pipTrackKey || !videoRef.current) return;
    const video = videoRef.current;
    const initialPlayback = initialPlaybackRef.current;
    const onReady = () => {
      try {
        video.currentTime = initialPlayback?.currentTime || 0;
        video.muted = !!initialPlayback?.muted;
        if (initialPlayback?.playing !== false) {
          video.play().catch(() => setPaused(true));
        } else {
          setPaused(true);
        }
      } catch (_) {
        // ignore seek errors
      }
    };

    if (video.readyState >= 1) onReady();
    else video.addEventListener("loadedmetadata", onReady, { once: true });

    return () => video.removeEventListener("loadedmetadata", onReady);
  }, [pipTrackKey]);

  useEffect(() => {
    const video = videoRef.current;
    if (video) video.loop = looping;
  }, [looping, pipTrackKey]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || pip?.playing === undefined) return;

    if (pip.playing && video.paused) {
      video.play().catch(() => setPaused(true));
    } else if (!pip.playing && !video.paused) {
      video.pause();
    }
  }, [pip?.playing, pipTrackKey]);

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
  }, [pipTrackKey, updatePip]);

  const playCurrent = useCallback(() => {
    const video = videoRef.current;
    if (!video) return Promise.resolve();
    return video.play().then(() => setPaused(false));
  }, []);

  const pauseCurrent = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    setPaused(true);
  }, []);

  const seekBy = useCallback((delta) => {
    const video = videoRef.current;
    if (!video) return;

    const base = Number(video.currentTime);
    const maxDuration = Number(video.duration);
    if (!Number.isFinite(base)) return;

    const next = base + delta;
    if (Number.isFinite(maxDuration) && maxDuration > 0) {
      video.currentTime = Math.min(maxDuration, Math.max(0, next));
      return;
    }
    video.currentTime = Math.max(0, next);
  }, []);

  const seekTo = useCallback((details) => {
    const video = videoRef.current;
    if (!video) return;

    const requested = Number(details?.seekTime);
    if (!Number.isFinite(requested) || requested < 0) return;

    const maxDuration = Number(video.duration);
    const target =
      Number.isFinite(maxDuration) && maxDuration > 0
        ? Math.min(maxDuration, requested)
        : requested;

    if (details?.fastSeek && typeof video.fastSeek === "function") {
      try {
        video.fastSeek(target);
        return;
      } catch (_) {}
    }

    video.currentTime = target;
  }, []);

  const switchPlaylistByOffset = useCallback(
    (offset) => {
      if (playlist.length <= 1) return;
      const currentId = pip?.libraryVideoId;
      const idx = Math.max(
        0,
        playlist.findIndex((item) => item.id === currentId),
      );
      const next = playlist[(idx + offset + playlist.length) % playlist.length];
      if (!next) return;
      updatePip({
        libraryVideoId: next.id,
        videoUrl: next.url,
        title: next.title,
        thumbnail: next.thumbnail || "",
        currentTime: 0,
        playing: true,
      });
    },
    [playlist, pip?.libraryVideoId, updatePip],
  );

  const handlePrev = useCallback(() => {
    switchPlaylistByOffset(-1);
  }, [switchPlaylistByOffset]);

  const handleNext = useCallback(() => {
    if (looping) return;
    switchPlaylistByOffset(1);
  }, [looping, switchPlaylistByOffset]);

  const handleEnded = useCallback(() => {
    if (looping) {
      const video = videoRef.current;
      if (video) {
        video.currentTime = 0;
        video.play().catch(() => {});
      }
      return;
    }
    handleNext();
  }, [looping, handleNext]);

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
    metadata: pip
      ? {
          title: pip.title || "Connect Watch",
          artist:
            pip.source === "library" ? "Video pop-out player" : "Watch feed",
          album: "Connect Watch",
          artwork: mediaArtwork,
        }
      : null,
    playbackState: paused ? "paused" : "playing",
    positionState: {
      duration,
      position: currentTime,
      playbackRate,
    },
    handlers: mediaSessionHandlers,
  });

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

    if (pip.source === "library" && pip.libraryVideoId) {
      navigate("/video-player", {
        state: {
          resumeAt: time,
          videoId: pip.libraryVideoId,
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
    if (!e.target.closest(".watch-pip-drag")) return;
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
    const nextX = Math.max(
      8,
      Math.min(window.innerWidth - width - 8, dragState.current.origX + dx),
    );
    const nextY = Math.max(
      8,
      Math.min(window.innerHeight - height - 8, dragState.current.origY + dy),
    );
    setPos({ x: nextX, y: nextY });
  };

  const onPointerUp = () => {
    dragState.current = null;
  };

  const style = pos
    ? { left: pos.x, top: pos.y, right: "auto", bottom: "auto" }
    : undefined;

  const playlistIndex = playlist.findIndex(
    (item) => item.id === pip.libraryVideoId,
  );
  const canSkip = isLibrary && playlist.length > 1;

  return (
    <div
      ref={dragRef}
      className={`watch-pip-player ${isLibrary ? "is-library" : "is-watch"}`}
      style={style}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      role="dialog"
      aria-label={
        isLibrary ? "Video pop-out player" : "Watch picture in picture"
      }
    >
      <div className="watch-pip-chrome">
        <button
          type="button"
          className="watch-pip-btn watch-pip-drag"
          aria-label="Move player"
          title="Drag to move"
        >
          <i className="fas fa-grip-vertical" />
        </button>
        <span className="watch-pip-chrome-title">{pip.title}</span>
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
      <div className="watch-pip-video-wrap">
        <video
          key={pipTrackKey}
          ref={videoRef}
          className="watch-pip-video"
          src={pip.videoUrl}
          controls
          playsInline
          webkit-playsinline="true"
          preload="auto"
          poster={pip.thumbnail || undefined}
          onEnded={handleEnded}
        />
      </div>
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
          disabled={!canSkip || looping}
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
          title={looping ? "Loop on" : "Loop off"}
          aria-label={looping ? "Loop on" : "Loop off"}
        >
          <i className="fas fa-redo" />
        </button>
        {canSkip ? (
          <span className="watch-pip-index">
            {playlistIndex >= 0 ? playlistIndex + 1 : 1}/{playlist.length}
          </span>
        ) : null}
      </div>
    </div>
  );
};

export default WatchPipPlayer;
