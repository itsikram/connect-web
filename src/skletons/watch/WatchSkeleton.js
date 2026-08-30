import React from 'react';

const WatchSkeleton = ({ count = 1, variant = 'feed' }) => {
  if (variant === 'album') {
    return (
      <div className="watch-album-grid watch-album-grid-skeleton">
        {Array(count).fill(0).map((_, index) => (
          <div key={index} className="watch-album-card watch-album-card-skeleton" aria-hidden="true">
            <div className="watch-album-thumb">
              <div className="watch-album-play" />
              <div className="watch-album-overlay watch-album-overlay-skeleton">
                <span className="watch-album-pill" />
                <span className="watch-album-pill" />
              </div>
            </div>
            <div className="watch-album-content">
              <div className="watch-album-title watch-album-line" />
              <div className="watch-album-title watch-album-line short" />
              <div className="watch-album-author-row">
                <div className="watch-album-author" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span className="watch-album-avatar" />
                  <span className="watch-album-author-name watch-album-line author" />
                </div>
                <span className="watch-album-line icon" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return Array(count).fill(0).map((_, index) => (
    <div key={index} className="nf-watch watch watch-feed-skeleton" aria-hidden="true">
      <div className="header">
        <div className="author-info">
          <div className="left">
            <div className="author-pp">
              <div className="watch-feed-skeleton-avatar" />
            </div>
            <div className="watch-nd-container" style={{ width: '100%' }}>
              <div className="watch-feed-skeleton-line name" />
              <div className="watch-feed-skeleton-line time" />
            </div>
          </div>
          <div className="right">
            <div className="watch-feed-skeleton-dot" />
            <div className="watch-feed-skeleton-dot" />
          </div>
        </div>
      </div>

      <div className="body">
        <div className="watch-feed-skeleton-line caption" />
        <div className="watch-feed-skeleton-line caption short" />
        <div className="watch-feed-skeleton-media" />
      </div>

      <div className="footer">
        <div className="watch-feed-skeleton-meta">
          <span className="watch-feed-skeleton-pill" />
          <span className="watch-feed-skeleton-pill" />
        </div>
        <div className="watch-feed-skeleton-actions">
          <span className="watch-feed-skeleton-btn" />
          <span className="watch-feed-skeleton-btn" />
          <span className="watch-feed-skeleton-btn" />
        </div>
      </div>
    </div>
  ));
};

export default WatchSkeleton;
