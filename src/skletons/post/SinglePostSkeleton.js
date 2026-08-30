import React from "react";
import PostSkeleton from "./PostSkeleton";
import "../../components/post/SinglePost.css";

const SinglePostSkeleton = () => {
  return (
    <div
      className="sp-layout sp-page-skeleton"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="visually-hidden">Loading post</span>

      <div className="sp-main-col">
        <section className="sp-panel sp-post-panel" aria-hidden="true">
          <PostSkeleton count={1} />
        </section>
      </div>

      <aside className="sp-side-col" aria-hidden="true">
        <section className="sp-panel sp-comments-panel">
          <div className="sp-panel-head">
            <span className="sp-skel-bone sp-skel-title" />
            <span className="sp-skel-bone sp-skel-count" />
          </div>
          <div className="sp-comment-skeleton-wrap">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div className="sp-comment-skeleton" key={`comment-skel-${idx}`}>
                <span className="sp-comment-skeleton-avatar" />
                <div className="sp-comment-skeleton-body">
                  <span className="sp-comment-skeleton-line name" />
                  <span className="sp-comment-skeleton-line" />
                  <span className="sp-comment-skeleton-line short" />
                </div>
              </div>
            ))}
          </div>
          <div className="sp-skel-composer">
            <span className="sp-comment-skeleton-avatar" />
            <span className="sp-skel-bone sp-skel-input" />
          </div>
        </section>

        <section className="sp-panel sp-views-panel">
          <div className="sp-panel-head">
            <span className="sp-skel-bone sp-skel-title" />
            <div className="sp-panel-head-actions">
              <span className="sp-skel-bone sp-skel-count" />
              <span className="sp-skel-bone sp-skel-filter-btn" />
            </div>
          </div>
          <div className="sp-viewer-skeleton-wrap">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div
                className="sp-viewer-skeleton"
                key={`viewer-skel-${idx}`}
              >
                <span className="sp-viewer-skeleton-avatar" />
                <span className="sp-viewer-skeleton-line" />
              </div>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
};

export default SinglePostSkeleton;
