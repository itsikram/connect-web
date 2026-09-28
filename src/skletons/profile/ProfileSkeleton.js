import React from "react";
import "./ProfileSkeleton.css";

// Placeholder shown on /:profile while the profile data is loading.
// Mirrors the real profile header layout so the page doesn't jump on load.
const ProfileSkeleton = ({ tabs = 5, posts = 2 }) => (
  <div className="profile-skeleton" aria-busy="true" aria-label="Loading profile">
    <div className="profile-skeleton-header">
      <div className="ps-block ps-cover" />
      <div className="ps-info">
        <div className="ps-block ps-avatar" />
        <div className="ps-details">
          <div className="ps-name-group">
            <div className="ps-block ps-line ps-name" />
            <div className="ps-block ps-line ps-meta" />
            <div className="ps-block ps-line ps-meta short" />
          </div>
          <div className="ps-buttons">
            <div className="ps-block ps-button" />
            <div className="ps-block ps-button" />
          </div>
        </div>
      </div>
      <div className="ps-tabs">
        {Array.from({ length: tabs }).map((_, i) => (
          <div key={i} className="ps-block ps-tab" />
        ))}
      </div>
    </div>

    <div className="ps-content">
      <div className="ps-card ps-intro">
        <div className="ps-block ps-line ps-title" />
        <div className="ps-block ps-line" />
        <div className="ps-block ps-line" />
        <div className="ps-block ps-line short" />
      </div>
      <div className="ps-posts">
        {Array.from({ length: posts }).map((_, i) => (
          <div key={i} className="ps-card">
            <div className="ps-post-head">
              <div className="ps-block ps-post-avatar" />
              <div className="ps-post-lines">
                <div className="ps-block ps-line ps-post-name" />
                <div className="ps-block ps-line short" />
              </div>
            </div>
            <div className="ps-block ps-post-media" />
          </div>
        ))}
      </div>
    </div>
  </div>
);

export default ProfileSkeleton;
