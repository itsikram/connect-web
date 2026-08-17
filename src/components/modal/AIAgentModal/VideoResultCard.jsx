import React, { useState } from 'react';
import { motion } from 'framer-motion';
import './VideoResultCard.css';

/**
 * VideoResultCard
 * Shows a single video search result with a Play button.
 *
 * Props:
 *   video      – Watch object { _id, caption, thumbnail, videoUrl, author }
 *   onPlay     – callback(video) called when the Play button is clicked
 *   compact    – smaller layout when showing many results
 */
const VideoResultCard = ({ video, onPlay, compact = false }) => {
  const [imgError, setImgError] = useState(false);

  const title     = video.caption || 'Untitled Video';
  const thumb     = (!imgError && video.thumbnail) ? video.thumbnail : null;
  const authorName =
    video.author?.fullName ||
    (video.author?.user
      ? `${video.author.user.firstName || ''} ${video.author.user.surname || ''}`.trim()
      : null) ||
    'Unknown';

  const initials = title
    .split(' ')
    .map(w => w[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  return (
    <motion.div
      className={`vrc-card ${compact ? 'compact' : ''}`}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.01 }}
    >
      {/* Thumbnail */}
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
        {/* Overlay play icon */}
        <div className="vrc-thumb-overlay">
          <i className="fas fa-play-circle" />
        </div>
      </div>

      {/* Info */}
      <div className="vrc-info">
        <p className="vrc-title" title={title}>{title}</p>
        <span className="vrc-author">
          <i className="fas fa-user-circle" style={{ marginRight: 4 }} />
          {authorName}
        </span>
      </div>

      {/* Play button */}
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
    </motion.div>
  );
};

export default VideoResultCard;
