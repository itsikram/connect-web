import React, { useRef } from "react";

const CameraViewfinder = ({
  videoRef,
  canvasRef,
  mode,
  countdown,
  isRecording,
  recLabel,
  filterLabel,
  showFilterName,
  flashOn,
  focusPt,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onClick,
}) => {
  const startRef = useRef(null);

  const handleDown = (e) => {
    if (e.touches && e.touches.length === 2) {
      const [a, b] = e.touches;
      const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      startRef.current = { type: "pinch", dist, x: 0 };
      onPointerDown?.({ type: "pinch", dist });
      return;
    }
    const point = e.touches ? e.touches[0] : e;
    startRef.current = { type: "pan", x: point.clientX, y: point.clientY };
    onPointerDown?.({ type: "pan", x: point.clientX, y: point.clientY });
  };

  const handleMove = (e) => {
    if (!startRef.current) return;
    if (startRef.current.type === "pinch" && e.touches?.length === 2) {
      const [a, b] = e.touches;
      const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      onPointerMove?.({ type: "pinch", dist });
      return;
    }
    const point = e.touches ? e.touches[0] : e;
    if (!point) return;
    onPointerMove?.({
      type: "pan",
      x: point.clientX,
      y: point.clientY,
      dx: point.clientX - startRef.current.x,
      dy: point.clientY - startRef.current.y,
    });
  };

  const handleUp = (e) => {
    const start = startRef.current;
    startRef.current = null;
    const point = e.changedTouches ? e.changedTouches[0] : e;
    onPointerUp?.({
      type: start?.type || "pan",
      x: point?.clientX,
      y: point?.clientY,
      dx: start ? (point?.clientX || 0) - start.x : 0,
      dy: start ? (point?.clientY || 0) - start.y : 0,
    });
  };

  return (
    <div
      className={`camera-viewfinder${mode === "square" ? " is-square" : ""}${
        mode === "portrait" ? " is-portrait" : ""
      }`}
      onMouseDown={handleDown}
      onMouseMove={handleMove}
      onMouseUp={handleUp}
      onMouseLeave={handleUp}
      onTouchStart={handleDown}
      onTouchMove={handleMove}
      onTouchEnd={handleUp}
      onClick={onClick}
    >
      <video
        ref={videoRef}
        className="camera-video"
        playsInline
        muted
        autoPlay
      />
      <canvas ref={canvasRef} className="camera-canvas" />
      <div className={`camera-flash-overlay${flashOn ? " is-on" : ""}`} />
      {focusPt && (
        <div
          className={`camera-focus${focusPt.adjusting ? " is-adjusting" : ""}`}
          style={{ left: focusPt.x, top: focusPt.y }}
        >
          {focusPt.adjusting && focusPt.brightness != null && (
            <span className="camera-focus-brightness">
              {focusPt.brightness > 0 ? "+" : ""}
              {Math.round(focusPt.brightness)}
            </span>
          )}
        </div>
      )}
      <div className={`camera-filter-name${showFilterName ? " is-on" : ""}`}>
        {filterLabel}
      </div>
      {countdown != null && countdown > 0 && (
        <div className="camera-countdown">{countdown}</div>
      )}
      {isRecording && (
        <div className="camera-rec-pill">
          <span className="camera-rec-dot" />
          {recLabel}
        </div>
      )}
    </div>
  );
};

export default CameraViewfinder;
