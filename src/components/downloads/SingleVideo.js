import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import { deleteVideoById, getAllSavedVideos, loadVideoById } from '../../utils/useSavedVideos';
import { useWatchPipOptional } from '../../contexts/WatchPipContext';
import { buildLibraryPipPayloadFromVideo, savedVideosToPipPlaylist, shouldAutoWatchPip } from '../../utils/watchPipHelpers';
import '../../pages/SavedVideos.css';

const SingleVideo = () => {
    const { videoId } = useParams();
    const [videoData, setVideoData] = useState({});
    const [videoUrl, setVideoUrl] = useState('');
    const [savedPlaylist, setSavedPlaylist] = useState([]);
    const navigate = useNavigate();
    const location = useLocation();
    const videoRef = useRef(null);
    const skipPipOnUnmount = useRef(false);
    const watchPip = useWatchPipOptional();

    useEffect(() => {
        if (!videoId) return;

        loadVideoById(videoId, (url, data) => {
            setVideoData(data || {});
            setVideoUrl(url || '');
        });
    }, [videoId]);

    useEffect(() => {
        getAllSavedVideos((videos) => {
            setSavedPlaylist(savedVideosToPipPlaylist(videos));
        });
    }, [videoId]);

    useEffect(() => {
        const resumeAt = location.state?.resumeAt;
        const shouldAutoplay = location.state?.autoplay === true;
        const video = videoRef.current;
        if (!video || !videoUrl) return;
        if (resumeAt == null && !shouldAutoplay) return;

        const apply = async () => {
            try {
                if (typeof resumeAt === 'number') video.currentTime = resumeAt;
                if (shouldAutoplay) await video.play().catch(() => {});
            } catch (_) {}
        };

        if (video.readyState >= 1) apply();
        else video.addEventListener('loadedmetadata', apply, { once: true });
        watchPip?.closePip?.();
    }, [videoUrl, location.state, watchPip]);

    const getPipMeta = useCallback(() => {
        const currentId = `saved-${videoId}`;
        const current = videoUrl
            ? {
                id: currentId,
                videoId: currentId,
                url: videoUrl,
                title: videoData.caption || 'Saved video',
                thumbnail: videoData.thumbnail || '',
                playCount: 1,
            }
            : null;
        const playlist = current
            ? savedPlaylist.some((item) => item.id === current.id)
                ? savedPlaylist
                : [current, ...savedPlaylist.filter((item) => item.id !== current.id)]
            : savedPlaylist;

        return {
            libraryVideoId: currentId,
            videoUrl,
            title: videoData.caption || 'Saved video',
            thumbnail: videoData.thumbnail || '',
            source: 'library',
            playlist,
            expandPath: `/downloads/${videoId}`,
        };
    }, [videoId, videoUrl, videoData, savedPlaylist]);

    const minimizeToPip = useCallback(() => {
        if (!watchPip?.startPip || !videoRef.current) return;
        const payload = buildLibraryPipPayloadFromVideo(videoRef.current, getPipMeta());
        if (!payload) return;
        skipPipOnUnmount.current = true;
        videoRef.current.pause();
        watchPip.startPip({ ...payload, playing: true });
    }, [watchPip, getPipMeta]);

    useEffect(() => {
        return () => {
            if (!skipPipOnUnmount.current && shouldAutoWatchPip() && watchPip?.startPip) {
                const video = videoRef.current;
                if (video && !video.paused && !video.ended) {
                    const payload = buildLibraryPipPayloadFromVideo(video, getPipMeta());
                    if (payload) watchPip.startPip(payload);
                }
            }
        };
    }, [watchPip, getPipMeta]);

    const deleteVideo = () => {
        const title = videoData.caption || 'this video';
        if (!window.confirm(`Delete "${title}" from saved videos?`)) return;

        deleteVideoById(videoId, (ok) => {
            if (ok) navigate('/downloads');
        });
    };

    const title = videoData.caption || 'Saved video';
    const authorName = videoData.author?.fullName || videoData.author?.name || '';
    const isThisPip = watchPip?.pip?.libraryVideoId === `saved-${videoId}`;

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
                        {isThisPip ? (
                            <div className="sv-single-loading">
                                <span>Playing in pop-out mode</span>
                                <button type="button" className="sv-btn sv-btn--primary" onClick={() => watchPip?.closePip?.()}>
                                    Return here
                                </button>
                            </div>
                        ) : videoUrl ? (
                            <video
                                ref={videoRef}
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
                        {watchPip && videoUrl && !isThisPip ? (
                            <button
                                type="button"
                                className="sv-btn sv-btn--primary"
                                onClick={minimizeToPip}
                                style={{ marginTop: 12 }}
                            >
                                Pop out
                            </button>
                        ) : null}
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
