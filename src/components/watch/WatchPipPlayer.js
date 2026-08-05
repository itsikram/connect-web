import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWatchPip } from "../../contexts/WatchPipContext";
import "./WatchPipPlayer.css";

const WatchPipPlayer = () => {
  const { pip, closePip, updatePip } = useWatchPip();
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const dragRef = useRef(null);
  const [paused, setPaused] = useState(false);
  const [pos, setPos] = useState(null);
  const dragState = useRef(null);

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
  }, [pip?.watchId, pip?.videoUrl]);

  useEffect(() => {
    if (!pip) return undefined;
    const video = videoRef.current;
    if (!video) return undefined;

    const sync = () => {
      updatePip({
        currentTime: video.currentTime,
        playing: !video.paused,
        muted: video.muted,
      });
    };

    video.addEventListener("timeupdate", sync);
    video.addEventListener("play", () => setPaused(false));
    video.addEventListener("pause", () => setPaused(true));
    return () => {
      video.removeEventListener("timeupdate", sync);
    };
  }, [pip, updatePip]);

  if (!pip) return null;

  const togglePlay = (e) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
      setPaused(false);
    } else {
      video.pause();
      setPaused(true);
    }
  };

  const handleExpand = () => {
    const video = videoRef.current;
    const time = video ? video.currentTime : pip.currentTime;
    updatePip({ currentTime: time, playing: video ? !video.paused : true });
    closePip();
    navigate(`/watch/${pip.watchId}`, {
      state: { resumeAt: time, autoplay: true },
    });
  };

  const handleClose = (e) => {
    e.stopPropagation();
    if (videoRef.current) videoRef.current.pause();
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
      Math.min(window.innerWidth - 180, dragState.current.origX + dx)
    );
    const nextY = Math.max(
      8,
      Math.min(window.innerHeight - 140, dragState.current.origY + dy)
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
      aria-label="Watch picture in picture"
    >
      <video
        ref={videoRef}
        className="watch-pip-video"
        src={pip.videoUrl}
        playsInline
        webkit-playsinline="true"
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
