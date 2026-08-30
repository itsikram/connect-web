import React from "react";
import "../../components/post/PostCard.css";
import "./PostSkeleton.css";

const MEDIA_VARIANTS = ["tall", "medium", "short"];

const PostSkeleton = ({ count = 1 }) => {
  return Array(count)
    .fill(0)
    .map((_, index) => (
      <div
        key={index}
        className={`nf-post post-skeleton post-skeleton--${MEDIA_VARIANTS[index % MEDIA_VARIANTS.length]}`}
        aria-hidden="true"
      >
        <div className="header">
          <div className="author-info">
            <div className="left">
              <div className="author-pp">
                <span className="post-skeleton-bone post-skeleton-avatar" />
              </div>
              <div className="post-nd-container">
                <span className="post-skeleton-bone post-skeleton-line name" />
                <span className="post-skeleton-bone post-skeleton-line time" />
              </div>
            </div>
            <div className="right">
              <span className="post-skeleton-bone post-skeleton-icon" />
              <span className="post-skeleton-bone post-skeleton-icon" />
            </div>
          </div>
        </div>

        <div className="body">
          <div className="caption">
            <span className="post-skeleton-bone post-skeleton-line caption" />
            <span className="post-skeleton-bone post-skeleton-line caption mid" />
            <span className="post-skeleton-bone post-skeleton-line caption short" />
          </div>
          <div className="attachment">
            <span className="post-skeleton-media" />
          </div>
        </div>

        <div className="footer">
          <div className="react-count">
            <div className="reacts">
              <span className="post-skeleton-bone post-skeleton-react" />
              <span className="post-skeleton-bone post-skeleton-react" />
              <span className="post-skeleton-bone post-skeleton-react" />
            </div>
            <span className="post-skeleton-bone post-skeleton-line count" />
            <div className="comment-share">
              <span className="post-skeleton-bone post-skeleton-line meta" />
              <span className="post-skeleton-bone post-skeleton-line meta" />
            </div>
          </div>

          <div className="like-comment-share">
            <div className="buttons-container post-skeleton-actions">
              <span className="post-skeleton-bone post-skeleton-action" />
              <span className="post-skeleton-bone post-skeleton-action" />
              <span className="post-skeleton-bone post-skeleton-action" />
            </div>
          </div>

          <div className="new-comment">
            <span className="post-skeleton-bone post-skeleton-avatar sm" />
            <span className="post-skeleton-bone post-skeleton-composer" />
          </div>
        </div>
      </div>
    ));
};

export default PostSkeleton;
