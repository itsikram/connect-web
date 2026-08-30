import React, { useEffect, useRef } from "react";
import { IOS_FILTERS } from "../../utils/iosCameraFilters";

const CameraFilterStrip = ({
  activeId,
  intensity,
  thumbs,
  onSelect,
  onIntensity,
  showIntensity = true,
}) => {
  const scrollerRef = useRef(null);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const active = el.querySelector(".camera-filter-item.is-active");
    active?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [activeId]);

  return (
    <div className="camera-filters">
      <div className="camera-filter-strip" ref={scrollerRef}>
        {IOS_FILTERS.map((filter) => (
          <button
            key={filter.id}
            className={`camera-filter-item${activeId === filter.id ? " is-active" : ""}`}
            onClick={() => onSelect(filter.id)}
            aria-label={filter.label}
            aria-pressed={activeId === filter.id}
          >
            {thumbs[filter.id] ? (
              <img
                className="camera-filter-thumb"
                src={thumbs[filter.id]}
                alt=""
              />
            ) : (
              <span className="camera-filter-thumb" />
            )}
            <span>{filter.label}</span>
          </button>
        ))}
      </div>
      {showIntensity && activeId !== "original" && (
        <div className="camera-intensity">
          <input
            type="range"
            min="0"
            max="100"
            value={intensity}
            onChange={(e) => onIntensity(Number(e.target.value))}
            aria-label="Filter intensity"
            style={{
              background: `linear-gradient(to right, #ffd60a ${intensity}%, rgba(255,255,255,0.22) ${intensity}%)`,
            }}
          />
          <span className="camera-intensity-val">{intensity}</span>
        </div>
      )}
    </div>
  );
};

export default CameraFilterStrip;
