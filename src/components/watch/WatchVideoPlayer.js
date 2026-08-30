import React, { useRef, useState, useEffect, useCallback } from 'react';
import useBackgroundAudioHandoff from '../../hooks/useBackgroundAudioHandoff';

/** After the user starts a watch, keep playing the next in-view video while scrolling. */
let feedWatchAutoplay = false;

/**
 * Lazy-loads watch video on play, pauses when off-screen, and keeps one feed video playing at a time.
 */
const WatchVideoPlayer = ({
    watchId,
    videoUrl,
    thumbnail,
    isPipActive = false,
    onMinimizePip,
    showPipButton = false,
    onRestorePip,
    eager = false,
    videoRef: externalVideoRef,
}) => {
    const internalVideoRef = useRef(null);
    const videoRef = externalVideoRef || internalVideoRef;
    const wrapRef = useRef(null);
    const inViewRef = useRef(false);
    const [isAttached, setIsAttached] = useState(eager);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isBuffering, setIsBuffering] = useState(false);
    useBackgroundAudioHandoff(videoRef, {
        src: videoUrl,
        enabled: isPlaying && !!videoUrl && !isPipActive,
    });

    useEffect(() => {
        if (eager) setIsAttached(true);
    }, [eager]);

    useEffect(() => {
        setIsAttached(eager);
        setIsPlaying(false);
        setIsBuffering(false);
    }, [videoUrl, eager]);

    const tryPlayInView = useCallback(async () => {
        const video = videoRef.current;
        if (!video || !videoUrl || isPipActive) return;
        if (!inViewRef.current || !feedWatchAutoplay) return;

        setIsAttached(true);
        setIsBuffering(true);
        try {
            if (!video.getAttribute('src') && !video.src) {
                video.src = videoUrl;
            }
            if (video.paused) {
                try {
                    await video.play();
                } catch (error) {
                    if (error?.name === 'NotAllowedError') {
                        video.muted = true;
                        await video.play();
                    } else {
                        throw error;
                    }
                }
            }
        } catch (_) {
            setIsBuffering(false);
        }
    }, [videoUrl, videoRef, isPipActive]);

    useEffect(() => {
        const wrap = wrapRef.current;
        if (!wrap) return undefined;

        const observer = new IntersectionObserver(
            ([entry]) => {
                const video = videoRef.current;
                const ratio = entry.intersectionRatio;
                inViewRef.current = entry.isIntersecting && ratio >= 0.5;

                if (
                    (!entry.isIntersecting || ratio < 0.4) &&
                    video &&
                    !video.paused &&
                    typeof document !== 'undefined' &&
                    !document.hidden
                ) {
                    video.pause();
                    return;
                }

                if (inViewRef.current && feedWatchAutoplay && !isPipActive && videoUrl) {
                    if (!isAttached) {
                        setIsAttached(true);
                    } else {
                        tryPlayInView();
                    }
                }
            },
            { threshold: [0, 0.4, 0.5, 0.75, 1], rootMargin: '0px 0px -8% 0px' }
        );

        observer.observe(wrap);
        return () => observer.disconnect();
    }, [isAttached, isPipActive, videoUrl, tryPlayInView, videoRef]);

    useEffect(() => {
        if (!isAttached || isPipActive || !feedWatchAutoplay) return undefined;
        tryPlayInView();
        return undefined;
    }, [isAttached, isPipActive, tryPlayInView]);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return undefined;

        const pauseOthers = () => {
            document.querySelectorAll('video.watch-video').forEach((el) => {
                if (el !== video && !el.paused) el.pause();
            });
        };

        const onPlay = () => {
            setIsPlaying(true);
            pauseOthers();
            feedWatchAutoplay = true;
        };
        const onPause = () => {
            if (typeof document !== 'undefined' && document.hidden) return;
            setIsPlaying(false);
            if (inViewRef.current) {
                feedWatchAutoplay = false;
            }
        };
        const onWaiting = () => setIsBuffering(true);
        const onPlaying = () => setIsBuffering(false);
        const onCanPlay = () => setIsBuffering(false);

        video.addEventListener('play', onPlay);
        video.addEventListener('pause', onPause);
        video.addEventListener('waiting', onWaiting);
        video.addEventListener('playing', onPlaying);
        video.addEventListener('canplay', onCanPlay);

        return () => {
            video.removeEventListener('play', onPlay);
            video.removeEventListener('pause', onPause);
            video.removeEventListener('waiting', onWaiting);
            video.removeEventListener('playing', onPlaying);
            video.removeEventListener('canplay', onCanPlay);
        };
    }, [isAttached, watchId, videoRef]);

    const handlePlayClick = useCallback(async (e) => {
        e?.preventDefault?.();
        e?.stopPropagation?.();
        const video = videoRef.current;
        if (!video || !videoUrl) return;

        setIsAttached(true);
        setIsBuffering(true);
        feedWatchAutoplay = true;

        try {
            if (!video.src) {
                video.src = videoUrl;
                await new Promise((resolve, reject) => {
                    const onCanPlay = () => {
                        cleanup();
                        resolve();
                    };
                    const onError = () => {
                        cleanup();
                        reject(new Error('load failed'));
                    };
                    const cleanup = () => {
                        video.removeEventListener('canplay', onCanPlay);
                        video.removeEventListener('error', onError);
                    };
                    video.addEventListener('canplay', onCanPlay, { once: true });
                    video.addEventListener('error', onError, { once: true });
                    video.load();
                });
            }
            await video.play();
        } catch (_) {
            setIsBuffering(false);
        }
    }, [videoUrl, videoRef]);

    if (isPipActive) {
        return (
            <div className="attachment watch-video-wrap">
                <div className="watch-pip-inline-placeholder">
                    <span>Playing in picture-in-picture</span>
                    <button type="button" onClick={onRestorePip}>
                        Restore here
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="attachment watch-video-wrap" ref={wrapRef}>
            <video
                id={watchId ? `watch-${watchId}` : undefined}
                ref={videoRef}
                className="w-100 watch-video"
                controls={isAttached}
                playsInline
                webkit-playsinline="true"
                x-webkit-airplay="allow"
                preload={isAttached ? 'auto' : 'none'}
                poster={thumbnail || undefined}
                src={isAttached ? videoUrl : undefined}
            />

            {!isAttached && (
                <button
                    type="button"
                    className="watch-play-button"
                    onClick={handlePlayClick}
                    aria-label="Play video"
                >
                    <i className="fas fa-play" aria-hidden="true" />
                </button>
            )}

            {isBuffering && isAttached && (
                <div className="watch-video-buffer" aria-hidden="true">
                    <i className="fas fa-spinner fa-spin" />
                </div>
            )}

            {showPipButton && isAttached && isPlaying && onMinimizePip && (
                <button
                    type="button"
                    className="watch-pip-trigger"
                    title="Picture in picture"
                    onClick={onMinimizePip}
                >
                    <i className="fas fa-external-link-alt" aria-hidden="true" />
                </button>
            )}
        </div>
    );
};

export default WatchVideoPlayer;
