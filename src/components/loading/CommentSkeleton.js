import React from 'react';
import './LoadingComponents.css';

/**
 * Professional comment skeleton loader component
 * Displays a placeholder while comments are loading
 */
const CommentSkeleton = ({ count = 1 }) => {
  return (
    <>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="comment-skeleton-container">
          <div className="comment-skeleton-wrapper">
            {/* Profile Picture Skeleton */}
            <div className="skeleton-avatar"></div>
            
            {/* Comment Content Skeleton */}
            <div className="skeleton-content">
              <div className="skeleton-comment-box">
                {/* Author Name */}
                <div className="skeleton-line skeleton-author"></div>
                
                {/* Comment Text Lines */}
                <div className="skeleton-line skeleton-text-long"></div>
                <div className="skeleton-line skeleton-text-medium"></div>
              </div>
              
              {/* Comment Actions */}
              <div className="skeleton-actions">
                <div className="skeleton-line skeleton-action"></div>
                <div className="skeleton-line skeleton-action"></div>
                <div className="skeleton-line skeleton-time"></div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </>
  );
};

/**
 * Reply skeleton loader component
 * Similar to comment skeleton but with indentation
 */
export const ReplySkeleton = ({ count = 1 }) => {
  return (
    <>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="reply-skeleton-container">
          <div className="reply-skeleton-wrapper">
            {/* Profile Picture Skeleton */}
            <div className="skeleton-avatar-small"></div>
            
            {/* Reply Content Skeleton */}
            <div className="skeleton-content">
              <div className="skeleton-reply-box">
                {/* Author Name */}
                <div className="skeleton-line skeleton-author-small"></div>
                
                {/* Reply Text */}
                <div className="skeleton-line skeleton-text-short"></div>
              </div>
              
              {/* Reply Actions */}
              <div className="skeleton-actions">
                <div className="skeleton-line skeleton-action-small"></div>
                <div className="skeleton-line skeleton-action-small"></div>
                <div className="skeleton-line skeleton-time-small"></div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </>
  );
};

export default CommentSkeleton;
