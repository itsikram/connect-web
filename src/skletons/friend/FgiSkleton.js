import React from 'react';
import ImageSkleton from '../ImageSkleton';

const FgiSkleton = ({ count = 1 }) => {
    return Array(count).fill(0).map((_, index) => (
        <div className="friend-grid-item" key={index} style={{minHeight: 'unset'}}>

            <div className="skeleton-card" style={{marginBottom: '0px'}}>
                {/* Header */}
                {/* <div className="skeleton-header">
            <div className="skeleton-avatar" />
            <div className="skeleton-lines">
              <div className="skeleton-line short" />
              <div className="skeleton-line medium" />
            </div>
          </div> */}

                {/* Main Content */}
                <div className="skeleton-main" style={{marginBottom: '0', height: '270px'}}>
                    {/* <ImageSkleton /> */}
                </div>

                {/* Footer */}
                <div className="skeleton-footer" style={{flexDirection: 'column', marginTop: '10px'}} >
                    <div style={{display: 'block'}} className="skeleton-line small w-100 py-2 d-block button mb-1" /> 
                    <br/>
                    <div className="skeleton-line small w-100 py-2 d-block button mb-1" />
                </div>
            </div>
        </div>
    ));
}

export default FgiSkleton;
