import React, { useEffect, useRef } from "react";
import CameraFilterStrip from "./CameraFilterStrip";
import { IconClose } from "./CameraIcons";
import IosFilterRenderer from "../../utils/iosFilterRenderer";
import { getFilterById } from "../../utils/iosCameraFilters";

const CameraReview = ({
  type,
  originalUrl,
  videoUrl,
  filterId,
  intensity,
  thumbs,
  busy,
  onChangeFilter,
  onChangeIntensity,
  onRetake,
  onDownload,
  onPost,
  onUse,
}) => {
  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const rendererRef = useRef(null);
  const settingsRef = useRef({ filterId, intensity });
  settingsRef.current = { filterId, intensity };

  useEffect(() => {
    if (type !== "photo" || !originalUrl) return undefined;
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return undefined;
    let cancelled = false;
    let renderer;

    const draw = () => {
      const img = imageRef.current;
      if (cancelled || !img || !renderer) return;
      const maxW = parent.clientWidth || 1080;
      const maxH = parent.clientHeight || 1440;
      const scale = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight, 1);
      renderer.setSourceSize(img.naturalWidth, img.naturalHeight);
      renderer.resize(
        Math.max(2, img.naturalWidth * scale),
        Math.max(2, img.naturalHeight * scale)
      );
      const settings = settingsRef.current;
      renderer.setFilter(getFilterById(settings.filterId).params, settings.intensity);
      renderer.setMirror(false);
      renderer.draw(img);
    };

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (cancelled) return;
      imageRef.current = img;
      try {
        renderer = new IosFilterRenderer(canvas);
        rendererRef.current = renderer;
        rendererRef.current.redraw = draw;
        draw();
      } catch {
        /* keep last frame */
      }
    };
    img.src = originalUrl;

    const observer = new ResizeObserver(() => draw());
    observer.observe(parent);

    return () => {
      cancelled = true;
      observer.disconnect();
      renderer?.destroy();
      rendererRef.current = null;
    };
  }, [originalUrl, type]);

  useEffect(() => {
    if (type !== "photo") return;
    rendererRef.current?.redraw?.();
  }, [filterId, intensity, type]);

  return (
    <div className="camera-review">
      <div className="camera-review-media">
        <div className="camera-review-top">
          <button className="camera-icon-btn" onClick={onRetake} aria-label="Retake">
            <IconClose />
          </button>
        </div>
        {type === "video" ? (
          <video src={videoUrl} controls playsInline autoPlay />
        ) : (
          <canvas ref={canvasRef} />
        )}
      </div>
      <div className="camera-review-bottom">
        {type === "photo" && (
          <CameraFilterStrip
            activeId={filterId}
            intensity={intensity}
            thumbs={thumbs}
            onSelect={onChangeFilter}
            onIntensity={onChangeIntensity}
          />
        )}
        <div className="camera-review-actions">
          <button className="camera-ghost-btn" onClick={onRetake} disabled={busy}>
            Retake
          </button>
          <button className="camera-use-btn" onClick={onUse} disabled={busy}>
            {busy ? "Saving…" : type === "video" ? "Use Video" : "Use Photo"}
          </button>
        </div>
        <div className="camera-review-tools">
          <button className="camera-ghost-btn" onClick={onDownload} disabled={busy}>
            Download
          </button>
          <button className="camera-ghost-btn" onClick={onPost} disabled={busy}>
            Post
          </button>
        </div>
      </div>
    </div>
  );
};

export default CameraReview;
