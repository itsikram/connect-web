import React from "react";
import {
  IconClose,
  IconFlash,
  IconTimer,
  IconFilters,
  IconFlip,
  IconLibrary,
} from "./CameraIcons";

const MODES = [
  { id: "pano", label: "Pano" },
  { id: "square", label: "Square" },
  { id: "photo", label: "Photo" },
  { id: "video", label: "Video" },
  { id: "portrait", label: "Portrait" },
];

const CameraControls = ({
  flash,
  timer,
  showFilters,
  mode,
  zoom,
  isRecording,
  isCapturing,
  lastThumb,
  flipSpin,
  onClose,
  onCycleFlash,
  onCycleTimer,
  onToggleFilters,
  onMode,
  onZoom,
  onShutterDown,
  onShutterUp,
  onShutterClick,
  onFlip,
  onOpenLast,
  filterSlot = null,
}) => {
  const shutterClass = [
    "camera-shutter",
    mode === "video" || isRecording ? "is-video" : "",
    isRecording ? "is-recording" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <div className="camera-chrome-top">
        <div className="camera-top-row">
          <button className="camera-icon-btn" onClick={onClose} aria-label="Close camera">
            <IconClose />
          </button>
          <button
            className={`camera-icon-btn${flash !== "off" ? " is-active" : ""}`}
            onClick={onCycleFlash}
            aria-label={`Flash ${flash}`}
          >
            <IconFlash mode={flash} />
            {flash === "auto" && <span className="camera-flash-letter">A</span>}
          </button>
          <button
            className={`camera-icon-btn${timer ? " is-active" : ""}`}
            onClick={onCycleTimer}
            aria-label={`Timer ${timer || "off"}`}
          >
            <IconTimer />
            {timer > 0 && <span className="camera-timer-badge">{timer}</span>}
          </button>
          <button
            className={`camera-icon-btn${showFilters ? " is-active" : ""}`}
            onClick={onToggleFilters}
            aria-label="Photo filters"
          >
            <IconFilters />
          </button>
        </div>
      </div>

      <div className="camera-chrome-bottom">
        <div className="camera-zoom-row">
          {[1, 2].map((z) => (
            <button
              key={z}
              className={`camera-zoom-pill${zoom === z ? " is-active" : ""}`}
              onClick={() => onZoom(z)}
              aria-label={`${z}x zoom`}
            >
              {z}×
            </button>
          ))}
        </div>

        {filterSlot || (
          <div className="camera-modes" role="tablist" aria-label="Camera modes">
            {MODES.map((item) => (
              <button
                key={item.id}
                className={`camera-mode${mode === item.id ? " is-active" : ""}`}
                onClick={() => onMode(item.id)}
                role="tab"
                aria-selected={mode === item.id}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}

        <div className="camera-capture-row">
          <button className="camera-gallery" onClick={onOpenLast} aria-label="Last capture">
            {lastThumb ? <img src={lastThumb} alt="" /> : <IconLibrary />}
          </button>

          <button
            className={shutterClass}
            disabled={isCapturing}
            aria-label={isRecording ? "Stop recording" : mode === "video" ? "Record video" : "Take photo"}
            onPointerDown={onShutterDown}
            onPointerUp={onShutterUp}
            onPointerCancel={onShutterUp}
            onClick={onShutterClick}
          >
            <span className="camera-shutter-ring" />
            <span className="camera-shutter-core" />
          </button>

          <button
            className={`camera-flip${flipSpin ? " is-spin" : ""}`}
            onClick={onFlip}
            aria-label="Flip camera"
          >
            <IconFlip />
          </button>
        </div>
      </div>
    </>
  );
};

export default CameraControls;
