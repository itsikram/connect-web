import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { deleteVideoById, loadVideoById } from '../../utils/useSavedVideos';
import '../../pages/SavedVideos.css';

const SingleVideo = () => {
    const { videoId } = useParams();
    const [videoData, setVideoData] = useState({});
    const [videoUrl, setVideoUrl] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        if (!videoId) return;

        loadVideoById(videoId, (url, data) => {
            setVideoData(data || {});
            setVideoUrl(url || '');
        });
    }, [videoId]);

    const deleteVideo = () => {
        const title = videoData.caption || 'this video';
        if (!window.confirm(`Delete "${title}" from saved videos?`)) return;

        deleteVideoById(videoId, (ok) => {
            if (ok) navigate('/downloads');
        });
    };

    const title = videoData.caption || 'Saved video';
    const authorName = videoData.author?.fullName || videoData.author?.name || '';

    return (
        <div className="sv-page sv-single-page">
            <div className="sv-page-inner sv-single-inner">
                <div className="sv-single-topbar">
                    <Link to="/downloads" className="sv-back-link">
                        <i className="fas fa-arrow-left" aria-hidden="true" />
                        Saved Videos
                    </Link>
                </div>

                <article className="sv-single-card">
                    <div className="sv-single-player-wrap">
                        {videoUrl ? (
                            <video
                                className="sv-single-player"
                                controls
                                playsInline
                                preload="metadata"
                                src={videoUrl}
                            />
                        ) : (
                            <div className="sv-single-loading">
                                <i className="fas fa-spinner fa-spin" aria-hidden="true" />
                                <span>Loading video…</span>
                            </div>
                        )}
                    </div>

                    <div className="sv-single-body">
                        <h1 className="sv-single-title">{title}</h1>
                        {authorName ? <p className="sv-single-author">{authorName}</p> : null}

                        <div className="sv-single-actions">
                            <button type="button" className="sv-btn sv-btn--danger" onClick={deleteVideo}>
                                <i className="fas fa-trash-alt" aria-hidden="true" />
                                Delete
                            </button>
                        </div>
                    </div>
                </article>
            </div>
        </div>
    );
};

export default SingleVideo;
