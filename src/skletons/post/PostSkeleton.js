import React from 'react';


const PostSkeleton = ({ count = 1 }) => {
    return Array(count).fill(0).map((_, index) => (
      <div key={index} className="skeleton-card">
        {/* Header */}
        <div className="skeleton-header">
          <div className="skeleton-avatar" />
          <div className="skeleton-lines">
            <div className="skeleton-line short" />
            <div className="skeleton-line medium" />
          </div>
        </div>
  
        {/* Main Content */}
        <div className="skeleton-main" />
  
        {/* Footer */}
        <div className="skeleton-footer">
          <div className="skeleton-line small button" />
          <div className="skeleton-line small button" />
          <div className="skeleton-line small button" />
        </div>
      </div>
    ));
  };
  
  export default PostSkeleton;
// export default CpSkleton;
