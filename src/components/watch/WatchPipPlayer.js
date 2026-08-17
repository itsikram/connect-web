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

  useEffect(() => {
    if (!pip || !videoRef.current) return;
    const video = videoRef.current;
    const onReady = () => {
      try {
        video.currentTime = pip.currentTime || 0;
        video.muted = !!pip.muted;
        if (pip.playing !== false) {
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
  }, [pip]);

  useEffect(() => {
    if (!pip) return undefined;
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

      updatePip({
        currentTime: video.currentTime,
        playing: !video.paused,
        muted: video.muted,
      });
    };

    const onPlay = () => {
      setPaused(false);
      sync();
    };

    const onPause = () => {
      setPaused(true);
      sync();
    };

    sync();

    video.addEventListener("timeupdate", sync);
    video.addEventListener("durationchange", sync);
    video.addEventListener("ratechange", sync);
    video.addEventListener("loadedmetadata", sync);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);

    return () => {
      video.removeEventListener("timeupdate", sync);
      video.removeEventListener("durationchange", sync);
      video.removeEventListener("ratechange", sync);
      video.removeEventListener("loadedmetadata", sync);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
    };
  }, [pip, updatePip]);

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

  const mediaSessionHandlers = useMemo(
    () => ({
      play: () => playCurrent().catch(() => {}),
      pause: () => pauseCurrent(),
      seekbackward: (details) => seekBy(-(Number(details?.seekOffset) || 10)),
      seekforward: (details) => seekBy(Number(details?.seekOffset) || 10),
      seekto: (details) => seekTo(details),
    }),
    [playCurrent, pauseCurrent, seekBy, seekTo],
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

  const handleExpand = () => {
    const video = videoRef.current;
    const time = video ? video.currentTime : pip.currentTime;
    updatePip({ currentTime: time, playing: video ? !video.paused : true });
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
    if (e.target.closest(".watch-pip-btn")) return;
    const el = dragRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    dragState.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: pos ? pos.x : rect.left,
      origY: pos ? pos.y : rect.top,
      moved: false,
    };
    el.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e) => {
    if (!dragState.current) return;
    const dx = e.clientX - dragState.current.startX;
    const dy = e.clientY - dragState.current.startY;
    if (Math.abs(dx) + Math.abs(dy) > 6) dragState.current.moved = true;
    const nextX = Math.max(
      8,
      Math.min(window.innerWidth - 180, dragState.current.origX + dx),
    );
    const nextY = Math.max(
      8,
      Math.min(window.innerHeight - 140, dragState.current.origY + dy),
    );
    setPos({ x: nextX, y: nextY });
  };

  const onPointerUp = (e) => {
    const wasDrag = dragState.current?.moved;
    dragState.current = null;
    if (!wasDrag && !e.target.closest(".watch-pip-btn")) {
      handleExpand();
    }
  };

  const style = pos
    ? { left: pos.x, top: pos.y, right: "auto", bottom: "auto" }
    : undefined;

  return (
    <div
      ref={dragRef}
      className="watch-pip-player"
      style={style}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      role="dialog"
      aria-label={
        pip.source === "library"
          ? "Video pop-out player"
          : "Watch picture in picture"
      }
    >
      <video
        ref={videoRef}
        className="watch-pip-video"
        src={pip.videoUrl}
        playsInline
        webkit-playsinline="true"
        preload="auto"
        poster={pip.thumbnail || undefined}
      />
      <div className="watch-pip-controls">
        <button
          type="button"
          className="watch-pip-btn"
          onClick={togglePlay}
          aria-label={paused ? "Play" : "Pause"}
        >
          <i className={`fas ${paused ? "fa-play" : "fa-pause"}`} />
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
      <div className="watch-pip-title">{pip.title}</div>
    </div>
  );
};

export default WatchPipPlayer;
