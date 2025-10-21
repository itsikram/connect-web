import React from 'react';

const MsgListSkleton = ({ count = 1 }) => {
    return Array(count).fill(0).map((_, index) => (
        <li key={index} className='modern-chat-item skeleton-item' style={{ '--animation-delay': `${index * 0.1}s` }}>
            <div className="chat-item-content">
                {/* Avatar Skeleton */}
                <div className="avatar-section">
                    <div className="skeleton-avatar-circle skeleton"></div>
                </div>
                
                {/* Chat Info Skeleton */}
                <div className="chat-info">
                    <div className="chat-header">
                        <div className="skeleton-contact-name skeleton"></div>
                        <div className="skeleton-time skeleton"></div>
                    </div>
                    <div className="last-message-preview">
                        <div className="skeleton-message-text skeleton"></div>
                    </div>
                </div>
            </div>
        </li>
    ));
};

export default MsgListSkleton;
