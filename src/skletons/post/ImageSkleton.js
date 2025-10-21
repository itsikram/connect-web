import React from 'react';

const ImageSkleton = ({ count = 1, style }) => {
  return Array(count).fill(0).map((_, index) => (
    <div className='pp-skleton-container' key={index} style={{backgroundColor: 'gray'}}>
      <div style={{ padding: 0 }} className="skeleton-card no-border">
        {/* Main Content */}
        <div style={{ padding: 0 }} className="skeleton-main" />

      </div>
    </div>

  ));
};
export default ImageSkleton;
