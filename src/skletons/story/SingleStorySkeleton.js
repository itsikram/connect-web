import React from 'react';

const SingleStorySkeleton = () => {
    return (
        <div className="single-story-container single-story-skeleton" aria-hidden="true">
            <div className="single-story">
                <div className="story-top">
                    <div className="story-author-details">
                        <div className="author-pp-container">
                            <span className="ss-skeleton-avatar" />
                        </div>
                        <div className="author-name">
                            <span className="ss-skeleton-line name" />
                        </div>
                    </div>
                    <div className="story-options">
                        <span className="ss-skeleton-icon" />
                        <span className="ss-skeleton-icon" />
                    </div>
                </div>
                <div className="single-story-image-container ss-skeleton-media" />
            </div>

            <div className="single-story-meta-container">
                <div className="single-story-reacts-buttons">
                    <span className="ss-skeleton-react" />
                    <span className="ss-skeleton-react" />
                    <span className="ss-skeleton-react" />
                </div>
            </div>
        </div>
    );
};

export default SingleStorySkeleton;
