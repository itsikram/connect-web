import React from 'react';

const PpSkleton = ({ count = 1, style }) => {
    return  Array(count).fill(0).map((_, index) => (
      <div  key={index} className="skeleton-card no-border">
        {/* Main Content */}
        <div style={style} className="skeleton-main" />

      </div>
    ));
  };
  
export default PpSkleton;
