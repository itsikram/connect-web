import React from "react";

const ImageSkleton = ({
  count = 1,
  compact = false,
  className = "",
}) => {
  return Array.from({ length: count }).map((_, index) => (
    <div
      key={index}
      className={`msg-media-skeleton ${compact ? "is-compact" : ""} ${className}`.trim()}
      aria-hidden="true"
    >
      <span className="msg-media-skeleton-shimmer" />
    </div>
  ));
};

export default ImageSkleton;
