import React from 'react';


const StoryListSkleton = ({ count = 1 }) => {
  return Array(count).fill(0).map((_, index) => (
    <div key={index} className="nf-story">

      <div className="skeleton-card" style={{ margin: '0px',marginRight: '20px', padding: '5px', maxWidth: '150px', height:'100%', float: 'left' }}>
        {/* Header */}
        <div className="skeleton-header" style={{margin: 0}}>
          <div className="skeleton-avatar" />
          <div className="skeleton-lines mt-2">
            <div className="skeleton-line medium" />
          </div>
        </div>

        {/* Main Content */}
        <div className="skeleton-main" style={{ height: '150px', }} />
      </div>

    </div>
  ));
};

export default StoryListSkleton;
// export default CpSkleton;
