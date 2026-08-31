import React from "react";

export const ProfileAboutSkeleton = () => (
    <div className="pf-skel pf-skel-details" aria-hidden="true">
        {[72, 58, 80, 64, 70].map((width, idx) => (
            <div key={idx} className="pf-skel-detail-row">
                <span className="pf-skel-bone pf-skel-icon" />
                <span className="pf-skel-bone pf-skel-line" style={{ width: `${width}%` }} />
            </div>
        ))}
    </div>
);

export const ProfileFriendsSkeleton = ({ count = 4 }) => (
    <div className="pf-skel pf-skel-friends" aria-hidden="true">
        {Array.from({ length: count }).map((_, idx) => (
            <div key={idx} className="pf-skel-friend">
                <span className="pf-skel-bone pf-skel-friend-avatar" />
                <span className="pf-skel-bone pf-skel-friend-name" />
            </div>
        ))}
    </div>
);

export const ProfileMediaSkeleton = ({ count = 2 }) => (
    <div className="pf-skel pf-skel-media" aria-hidden="true">
        {Array.from({ length: count }).map((_, idx) => (
            <div key={idx} className="pf-skel-media-card">
                <span className="pf-skel-bone" />
            </div>
        ))}
    </div>
);

const ProfilePageSkeleton = ({ showBackHeader = false }) => (
    <div className="profile-shell profile-page-skeleton pf-skel" aria-busy="true" aria-label="Loading profile">
        {showBackHeader && (
            <div className="profile-page-nav">
                <span className="pf-skel-bone" style={{ width: 36, height: 36, borderRadius: 10 }} />
                <span className="pf-skel-bone" style={{ width: 90, height: 18 }} />
                <span style={{ width: 36 }} />
            </div>
        )}
        <div className="profile-header">
            <span className="pf-skel-bone pf-skel-cover" />
            <div className="pf-skel-info">
                <span className="pf-skel-bone pf-skel-avatar" />
                <span className="pf-skel-bone pf-skel-name" />
                <span className="pf-skel-bone pf-skel-count" />
                <div className="pf-skel-bio">
                    <span className="pf-skel-bone" />
                    <span className="pf-skel-bone" />
                    <span className="pf-skel-bone" />
                </div>
                <div className="pf-skel-actions">
                    <span className="pf-skel-bone pf-skel-btn" />
                    <span className="pf-skel-bone pf-skel-btn" />
                </div>
            </div>
            <div className="pf-skel-tabs">
                <span className="pf-skel-bone pf-skel-tab" />
                <span className="pf-skel-bone pf-skel-tab" />
                <span className="pf-skel-bone pf-skel-tab" />
                <span className="pf-skel-bone pf-skel-tab" />
                <span className="pf-skel-bone pf-skel-tab" />
            </div>
        </div>
        <div className="pf-skel-content">
            <ProfileAboutSkeleton />
        </div>
    </div>
);

export default ProfilePageSkeleton;
