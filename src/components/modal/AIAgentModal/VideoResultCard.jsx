import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import './VideoResultCard.css';

/**
 * VideoResultCard
 * Watch results: Play. YouTube results: Post as Watch + Download.
 */
const VideoResultCard = ({
  video,
  onPlay,
  onDownload,
  source = "watch",
  defaultPostAsWatch = true,
  compact = false,
}) => {
  const [imgError, setImgError] = useState(false);
  const [postAsWatch, setPostAsWatch] = useState(defaultPostAsWatch !== false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    setPostAsWatch(defaultPostAsWatch !== false);
  }, [defaultPostAsWatch]);

  const isYoutube = source === "youtube";
  const title =
    video.title || video.caption || video.name || "Untitled Video";
  const thumb = !imgError && video.thumbnail ? video.thumbnail : null;
  const authorName =
    video.channelTitle ||
    video.author?.fullName ||
    (video.author?.user
      ? `${video.author.user.firstName || ""} ${video.author.user.surname || ""}`.trim()
      : null) ||
    "Unknown";

  const initials = title
    .split(" ")
    .map((w) => w[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  const handleDownload = async () => {
    if (!onDownload || downloading) return;
    setDownloading(true);
    try {
      await onDownload(video, { postAsWatch });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <motion.div
      className={`vrc-card ${compact ? "compact" : ""} ${isYoutube ? "youtube" : ""}`}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.01 }}
    >
      <div className="vrc-thumb">
        {thumb ? (
          <img
            src={thumb}
            alt={title}
            className="vrc-thumb-img"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="vrc-thumb-placeholder">
            <i className="fas fa-film" />
            <span>{initials}</span>
          </div>
        )}
        <div className="vrc-thumb-overlay">
          <i className={`fas ${isYoutube ? "fa-download" : "fa-play-circle"}`} />
        </div>
      </div>

      <div className="vrc-info">
        <p className="vrc-title" title={title}>{title}</p>
        <span className="vrc-author">
          <i
            className={isYoutube ? "fab fa-youtube" : "fas fa-user-circle"}
            style={{ marginRight: 4 }}
          />
          {authorName}
        </span>
      </div>

      {isYoutube ? (
        <div className="vrc-actions">
          <label className="vrc-watch-toggle">
            <input
              type="checkbox"
              checked={postAsWatch}
              onChange={(event) => setPostAsWatch(event.target.checked)}
            />
            Post as Watch
          </label>
          <motion.button
            type="button"
            className="vrc-download-btn"
            onClick={handleDownload}
            disabled={downloading}
            whileHover={{ scale: downloading ? 1 : 1.07 }}
            whileTap={{ scale: downloading ? 1 : 0.95 }}
            aria-label={`Download ${title}`}
          >
            <i className={`fas ${downloading ? "fa-spinner fa-spin" : "fa-download"}`} />
            <span>{downloading ? "Starting…" : "Download"}</span>
          </motion.button>
        </div>
      ) : (
        <motion.button
          className="vrc-play-btn"
          onClick={() => onPlay(video)}
          whileHover={{ scale: 1.07 }}
          whileTap={{ scale: 0.95 }}
          aria-label={`Play ${title}`}
        >
          <i className="fas fa-play" />
          <span>Play</span>
        </motion.button>
      )}
    </motion.div>
  );
};

export default VideoResultCard;
