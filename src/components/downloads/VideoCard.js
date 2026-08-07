
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { deleteVideoById } from '../../utils/useSavedVideos';

const VideoCard = ({ videoData, videoUrl, onDelete }) => {
    const navigate = useNavigate();

    if (!videoData) return null;

    const title = videoData.caption || 'Saved video';
    const thumb = videoData.thumbnail || videoData.author?.profilePic || '';
    const authorName = videoData.author?.fullName || videoData.author?.name || '';

    const gotoSingleVideo = () => {
        navigate(`/downloads/${videoData._id}`);
    };

    const handleDelete = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const confirmed = window.confirm(`Delete "${title}" from saved videos?`);
        if (!confirmed) return;

        deleteVideoById(videoData._id, (ok) => {
            if (ok && onDelete) onDelete();
        });
    };

    const handleView = (e) => {
        e.preventDefault();
        e.stopPropagation();
        gotoSingleVideo();
    };

    return (
        <article className="sv-card" onClick={gotoSingleVideo} role="button" tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); gotoSingleVideo(); } }}>
            <div className="sv-card-media">
                {thumb ? (
                    <img src={thumb} alt="" className="sv-card-poster" loading="lazy" />
                ) : (
                    <video
                        className="sv-card-video"
                        src={videoUrl}
                        preload="metadata"
                        muted
                        playsInline
                        aria-hidden="true"
                    />
                )}
                <div className="sv-card-play" aria-hidden="true">
                    <i className="fas fa-play" />
                </div>
            </div>

            <div className="sv-card-body">
                <h3 className="sv-card-title">{title}</h3>
                {authorName ? <p className="sv-card-author">{authorName}</p> : null}

                <div className="sv-card-actions">
                    <Link
                        to={`/downloads/${videoData._id}`}
                        className="sv-btn sv-btn--primary"
                        onClick={handleView}
                    >
                        <i className="fas fa-play-circle" aria-hidden="true" />
                        Play
                    </Link>
                    <button type="button" className="sv-btn sv-btn--danger" onClick={handleDelete}>
                        <i className="fas fa-trash-alt" aria-hidden="true" />
                        Delete
                    </button>
                </div>
            </div>
        </article>
    );
};

export default VideoCard;
