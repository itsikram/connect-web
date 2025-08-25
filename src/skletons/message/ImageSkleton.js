import React from 'react';

const ImageSkleton = ({ count = 1, style }) => {
  return Array(count).fill(0).map((_, index) => (
    <div  key={index} className='msg-media-item'>
     
      <div className='pp-skleton-container' style={{ backgroundColor: 'gray', }}>
        <div style={{ padding: 0,margin: 0, width: '300px' }}  className="skeleton-card no-border">
          {/* Main Content */}
          <div style={{ padding: 0,margin: 0, height: '200px' }} className="skeleton-main" />

        </div>
      </div>
    </div>


  ));
};
export default ImageSkleton;
