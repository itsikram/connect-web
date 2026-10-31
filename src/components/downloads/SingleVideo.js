import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import { deleteVideoById, getAllSavedVideos, loadVideoById } from '../../utils/useSavedVideos';
import { useWatchPipOptional } from '../../contexts/WatchPipContext';
import { buildLibraryPipPayloadFromVideo, savedVideosToPipPlaylist, shouldAutoWatchPip } from '../../utils/watchPipHelpers';
import useBackgroundAudioHandoff from '../../hooks/useBackgroundAudioHandoff';
import useMediaSession from '../../hooks/useMediaSession';
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
    const [videoPlaying, setVideoPlaying] = useState(false);
    const [hasStarted, setHasStarted] = useState(false);
    const isThisPip = watchPip?.pip?.libraryVideoId === `saved-${videoId}`;
    // Keeps the track playing on the iOS lock screen / in the background.
    const backgroundAudio = useBackgroundAudioHandoff(videoRef, {
        src: videoUrl,
        enabled: !!videoUrl && !isThisPip,
    });

    useEffect(() => {
        setVideoPlaying(false);
        setHasStarted(false);
    }, [videoUrl]);

    const setVideoElementRef = useCallback((node) => {
        videoRef.current = node;
    }, []);

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

    const getActiveElement = useCallback(() => {
        const audio = backgroundAudio.audioRef.current;
        if (audio && backgroundAudio.isAudioPlaying() && !audio.muted) return audio;
        return videoRef.current;
    }, [backgroundAudio]);

    const seekTo = useCallback((target) => {
        const el = getActiveElement();
        if (!el || !Number.isFinite(target)) return;
        const maxDuration = Number(el.duration);
        const clamped = Number.isFinite(maxDuration) && maxDuration > 0
            ? Math.min(maxDuration, Math.max(0, target))
            : Math.max(0, target);
        try {
            el.currentTime = clamped;
        } catch (_) {}
        const video = videoRef.current;
        if (video && video !== el) {
            try {
                video.currentTime = clamped;
            } catch (_) {}
        }
    }, [getActiveElement]);

    const mediaSessionHandlers = useMemo(() => ({
        play: () => {
            backgroundAudio.wantPlayingRef.current = true;
            if (document.hidden) {
                backgroundAudio.playBackgroundAudio();
                return;
            }
            videoRef.current?.play()?.catch(() => {});
        },
        pause: () => {
            backgroundAudio.pauseBackgroundAudio();
            videoRef.current?.pause();
        },
        seekbackward: (details) => {
            const el = getActiveElement();
            if (el) seekTo(Number(el.currentTime) - (Number(details?.seekOffset) || 10));
        },
        seekforward: (details) => {
            const el = getActiveElement();
            if (el) seekTo(Number(el.currentTime) + (Number(details?.seekOffset) || 10));
        },
        seekto: (details) => seekTo(Number(details?.seekTime)),
    }), [backgroundAudio, getActiveElement, seekTo]);

    const getLivePosition = useCallback(() => {
        const el = getActiveElement();
        const duration = Number(el?.duration);
        if (!el || !Number.isFinite(duration) || duration <= 0) return null;
        return {
            duration,
            position: Number(el.currentTime) || 0,
            playbackRate: Number(el.playbackRate) > 0 ? Number(el.playbackRate) : 1,
        };
    }, [getActiveElement]);

    const getPlaybackState = useCallback(() => {
        const audio = backgroundAudio.audioRef.current;
        if (audio && backgroundAudio.isAudioPlaying() && !audio.muted) return 'playing';
        const video = videoRef.current;
        return video && !video.paused ? 'playing' : 'paused';
    }, [backgroundAudio]);

    const sessionPlaying = videoPlaying || backgroundAudio.mediaPosition.playing;
    const mediaArtwork = useMemo(() => {
        const artwork = [];
        [[videoData.thumbnail, '512x512'], ['/logo512.png', '512x512', 'image/png']].forEach(([src, sizes, type]) => {
            if (!src) return;
            try {
                const image = { src: new URL(src, window.location.origin).toString(), sizes };
                if (type) image.type = type;
                artwork.push(image);
            } catch (_) {}
        });
        return artwork;
    }, [videoData.thumbnail]);

    useMediaSession({
        // Only after this video has played, so it never steals Now Playing
        // from a pop-out that is still playing something else.
        enabled: !!videoUrl && !isThisPip && hasStarted,
        bindKey: `${videoId || ''}:${videoUrl || ''}`,
        metadata: {
            title: videoData.caption || 'Saved video',
            artist: videoData.author?.fullName || videoData.author?.name || 'Saved Videos',
            album: 'Connect Saved Videos',
            artwork: mediaArtwork,
        },
        playbackState: sessionPlaying ? 'playing' : 'paused',
        positionState: getLivePosition(),
        getPositionState: getLivePosition,
        getPlaybackState,
        handlers: mediaSessionHandlers,
    });

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
                        {isThisPip ? (
                            <div className="sv-single-loading">
                                <span>Playing in pop-out mode</span>
                                <button type="button" className="sv-btn sv-btn--primary" onClick={() => watchPip?.closePip?.()}>
                                    Return here
                                </button>
                            </div>
                        ) : videoUrl ? (
                            <video
                                ref={setVideoElementRef}
                                className="sv-single-player"
                                controls
                                playsInline
                                webkit-playsinline="true"
                                preload="auto"
                                src={videoUrl}
                                onPlay={() => {
                                    setVideoPlaying(true);
                                    setHasStarted(true);
                                }}
                                onPause={() => setVideoPlaying(false)}
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
