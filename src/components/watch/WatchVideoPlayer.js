import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { useWatchPipOptional } from '../../contexts/WatchPipContext';
import useBackgroundAudioHandoff from '../../hooks/useBackgroundAudioHandoff';
import useMediaSession from '../../hooks/useMediaSession';

const buildWatchArtwork = (thumbnail) => {
    const artwork = [];
    const push = (src, sizes, type) => {
        if (!src) return;
        try {
            const image = {
                src: new URL(src, window.location.origin).toString(),
                sizes,
            };
            if (type) image.type = type;
            artwork.push(image);
        } catch (_) {}
    };
    push(thumbnail, '512x512');
    push('/logo512.png', '512x512', 'image/png');
    push('/logo192.png', '192x192', 'image/png');
    return artwork;
};

/** After the user starts a watch, keep playing the next in-view video while scrolling. */
let feedWatchAutoplay = false;

/**
 * Lazy-loads watch video on play, pauses when off-screen, and keeps one feed video playing at a time.
 */
const WatchVideoPlayer = ({
    watchId,
    videoUrl,
    thumbnail,
    title,
    artist,
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
    const pipCtx = useWatchPipOptional();
    const anyPip = !!pipCtx?.isPipActive;
    const backgroundAudio = useBackgroundAudioHandoff(videoRef, {
        src: videoUrl,
        enabled: isPlaying && !!videoUrl && !isPipActive && !anyPip,
    });

    useEffect(() => {
        if (eager) setIsAttached(true);
    }, [eager]);

    useEffect(() => {
        setIsAttached(eager);
        setIsBuffering(false);
        if (!videoUrl) setIsPlaying(false);
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

    const playFromSession = useCallback(async () => {
        const video = videoRef.current;
        backgroundAudio.wantPlayingRef.current = true;
        if (typeof document !== 'undefined' && document.hidden) {
            await backgroundAudio.playBackgroundAudio();
            return;
        }
        if (!video || !videoUrl) return;
        setIsAttached(true);
        try {
            if (!video.src) video.src = videoUrl;
            await video.play();
        } catch (_) {}
    }, [backgroundAudio, videoRef, videoUrl]);

    const pauseFromSession = useCallback(() => {
        backgroundAudio.wantPlayingRef.current = false;
        backgroundAudio.pauseBackgroundAudio();
        const video = videoRef.current;
        if (video) video.pause();
    }, [backgroundAudio, videoRef]);

    const seekBy = useCallback((delta) => {
        const video = videoRef.current;
        const audio = backgroundAudio.audioRef.current;
        const el = audio && !audio.paused ? audio : video;
        if (!el) return;
        const base = Number(el.currentTime);
        const maxDuration = Number(el.duration);
        if (!Number.isFinite(base)) return;
        const next = base + delta;
        const clamped =
            Number.isFinite(maxDuration) && maxDuration > 0
                ? Math.min(maxDuration, Math.max(0, next))
                : Math.max(0, next);
        el.currentTime = clamped;
        if (video && video !== el) {
            try {
                video.currentTime = clamped;
            } catch (_) {}
        }
    }, [backgroundAudio.audioRef, videoRef]);

    const seekTo = useCallback((details) => {
        const video = videoRef.current;
        const audio = backgroundAudio.audioRef.current;
        const el =
            typeof document !== 'undefined' && document.hidden && audio
                ? audio
                : video;
        if (!el) return;
        const requested = Number(details?.seekTime);
        if (!Number.isFinite(requested) || requested < 0) return;
        const maxDuration = Number(el.duration);
        const target =
            Number.isFinite(maxDuration) && maxDuration > 0
                ? Math.min(maxDuration, requested)
                : requested;
        if (details?.fastSeek && typeof el.fastSeek === 'function') {
            try {
                el.fastSeek(target);
                return;
            } catch (_) {}
        }
        el.currentTime = target;
        if (video && video !== el) {
            try {
                video.currentTime = target;
            } catch (_) {}
        }
    }, [backgroundAudio.audioRef, videoRef]);

    const getLivePosition = useCallback(() => {
        const audio = backgroundAudio.audioRef.current;
        const video = videoRef.current;
        if (audio && !audio.paused && Number(audio.duration) > 0) {
            return {
                duration: Number(audio.duration),
                position: Number(audio.currentTime) || 0,
                playbackRate: Number(audio.playbackRate) > 0 ? Number(audio.playbackRate) : 1,
            };
        }
        if (video && Number(video.duration) > 0) {
            return {
                duration: Number(video.duration),
                position: Number(video.currentTime) || 0,
                playbackRate: Number(video.playbackRate) > 0 ? Number(video.playbackRate) : 1,
            };
        }
        return null;
    }, [backgroundAudio.audioRef, videoRef]);

    const getPlaybackState = useCallback(() => {
        const audio = backgroundAudio.audioRef.current;
        if (audio && !audio.paused) return 'playing';
        const video = videoRef.current;
        if (video && !video.paused) return 'playing';
        return isPlaying ? 'playing' : 'paused';
    }, [backgroundAudio.audioRef, videoRef, isPlaying]);

    const mediaArtwork = useMemo(
        () => buildWatchArtwork(thumbnail),
        [thumbnail],
    );

    const mediaSessionHandlers = useMemo(
        () => ({
            play: () => {
                playFromSession().catch(() => {});
            },
            pause: () => pauseFromSession(),
            seekbackward: (details) => seekBy(-(Number(details?.seekOffset) || 10)),
            seekforward: (details) => seekBy(Number(details?.seekOffset) || 10),
            seekto: (details) => seekTo(details),
        }),
        [playFromSession, pauseFromSession, seekBy, seekTo],
    );

    const sessionTitle = title || 'Connect Watch';
    const sessionArtist = artist || 'Connect Watch';
    const sessionPlaying = isPlaying || backgroundAudio.isAudioPlaying();

    useMediaSession({
        enabled: !!videoUrl && !isPipActive && !anyPip && sessionPlaying,
        bindKey: `${watchId || ''}:${videoUrl || ''}`,
        metadata: {
            title: sessionTitle,
            artist: sessionArtist,
            album: 'Connect Watch',
            artwork: mediaArtwork,
        },
        playbackState: sessionPlaying ? 'playing' : 'paused',
        positionState: getLivePosition(),
        getPositionState: getLivePosition,
        getPlaybackState,
        handlers: mediaSessionHandlers,
    });

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
