import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { useLocation } from 'react-router-dom';
import './VideoPlayer.css';
import { useWatchPipOptional } from '../contexts/WatchPipContext';
import { buildLibraryPipPayloadFromVideo } from '../utils/watchPipHelpers';
import {
    loadCustomPlaylist,
    saveCustomPlaylist,
    loadWatchPlaylistItems,
    loadSavedPlaylistItems,
    mergePlaylist,
    filterPlaylist,
    sortPlaylist,
    loadPlaylistOrder,
    savePlaylistOrder,
    reorderPlaylistIds,
    syncPlaylistOrder,
    getTypeLabel,
    getSourceLabel,
    normalizePlaylistItem,
    FILTER_OPTIONS,
    SORT_OPTIONS,
} from '../utils/videoPlayerLibrary';

const VideoPlayer = () => {
    const myProfileId = useSelector((state) => state.profile?._id);
    const location = useLocation();
    const watchPip = useWatchPipOptional();

    const [customVideos, setCustomVideos] = useState(() => loadCustomPlaylist());
    const [watchVideos, setWatchVideos] = useState([]);
    const [savedVideos, setSavedVideos] = useState([]);
    const [libraryLoading, setLibraryLoading] = useState(true);
    const [libraryError, setLibraryError] = useState('');

    const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
    const [videoUrl, setVideoUrl] = useState('');
    const [videoTitle, setVideoTitle] = useState('');
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLooping, setIsLooping] = useState(false);
    const [filter, setFilter] = useState('all');
    const [sortMode, setSortMode] = useState('custom');
    const [searchQuery, setSearchQuery] = useState('');
    const [playlistOrder, setPlaylistOrder] = useState(() => loadPlaylistOrder());
    const [dragIndex, setDragIndex] = useState(null);

    const videoRef = useRef(null);
    const fileInputRef = useRef(null);
    const blobUrlsRef = useRef(new Set());
    const skipPipOnUnmount = useRef(false);
    const currentVideoRef = useRef(null);
    const resumeHandledRef = useRef(false);

    const allVideos = useMemo(
        () => mergePlaylist(watchVideos, savedVideos, customVideos),
        [watchVideos, savedVideos, customVideos]
    );

    const filteredVideos = useMemo(() => {
        let list = filterPlaylist(allVideos, filter);
        const q = searchQuery.trim().toLowerCase();
        if (q) {
            list = list.filter((v) => v.title.toLowerCase().includes(q));
        }
        return sortPlaylist(list, sortMode, playlistOrder);
    }, [allVideos, filter, searchQuery, sortMode, playlistOrder]);

    const currentVideo = filteredVideos.length > 0 ? filteredVideos[currentVideoIndex] : null;
    const currentTrackKey = currentVideo ? `${currentVideo.id}:${currentVideo.url}` : '';
    currentVideoRef.current = currentVideo;

    const isThisPip =
        watchPip?.pip?.source === 'library' &&
        currentVideo &&
        watchPip.pip.libraryVideoId === currentVideo.id;

    useEffect(() => {
        setPlaylistOrder((prev) => {
            const synced = syncPlaylistOrder(prev, allVideos);
            if (synced.join('|') !== prev.join('|')) {
                savePlaylistOrder(synced);
                return synced;
            }
            return prev;
        });
    }, [allVideos]);

    const refreshLibrary = useCallback(async () => {
        setLibraryLoading(true);
        setLibraryError('');
        try {
            const [watches, saved] = await Promise.all([
                loadWatchPlaylistItems(myProfileId),
                loadSavedPlaylistItems(),
            ]);
            setWatchVideos(watches);
            setSavedVideos(saved);
        } catch (err) {
            console.error(err);
            setLibraryError('Could not refresh some video sources.');
        } finally {
            setLibraryLoading(false);
        }
    }, [myProfileId]);

    useEffect(() => {
        refreshLibrary();
    }, [refreshLibrary]);

    useEffect(() => {
        saveCustomPlaylist(customVideos);
    }, [customVideos]);

    useEffect(() => {
        if (currentVideoIndex >= filteredVideos.length) {
            setCurrentVideoIndex(filteredVideos.length > 0 ? filteredVideos.length - 1 : 0);
        }
    }, [filteredVideos.length, currentVideoIndex]);

    useEffect(() => {
        const video = videoRef.current;
        if (!video || !currentVideo?.url || isThisPip) return;

        const onCanPlay = () => {
            video.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
        };

        if (video.src !== currentVideo.url) {
            video.src = currentVideo.url;
        }
        video.loop = isLooping;
        video.load();
        video.addEventListener('canplay', onCanPlay, { once: true });

        return () => {
            video.removeEventListener('canplay', onCanPlay);
        };
    }, [currentTrackKey, currentVideo?.url, isLooping, isThisPip]);

    useEffect(() => {
        const video = videoRef.current;
        if (video) video.loop = isLooping;
    }, [isLooping]);

    useEffect(() => {
        return () => {
            blobUrlsRef.current.forEach((url) => {
                try {
                    URL.revokeObjectURL(url);
                } catch (_) {}
            });
            blobUrlsRef.current.clear();
        };
    }, []);

    useEffect(() => {
        const resumeState = location.state;
        if (!resumeState?.videoId || resumeHandledRef.current || filteredVideos.length === 0) return;

        const idx = filteredVideos.findIndex((v) => v.id === resumeState.videoId);
        if (idx >= 0) {
            setCurrentVideoIndex(idx);
        }

        const video = videoRef.current;
        if (video && typeof resumeState.resumeAt === 'number') {
            const applyResume = () => {
                try {
                    video.currentTime = resumeState.resumeAt;
                    if (resumeState.autoplay) {
                        video.play().then(() => setIsPlaying(true)).catch(() => {});
                    }
                } catch (_) {}
            };
            if (video.readyState >= 1) applyResume();
            else video.addEventListener('loadedmetadata', applyResume, { once: true });
        }

        resumeHandledRef.current = true;
        watchPip?.closePip?.();
    }, [location.state, filteredVideos, watchPip]);

    const minimizeToPip = useCallback(() => {
        if (!watchPip?.startPip || !currentVideoRef.current) return;
        const video = videoRef.current;
        if (!video) return;

        const payload = buildLibraryPipPayloadFromVideo(video, {
            libraryVideoId: currentVideoRef.current.id,
            videoUrl: currentVideoRef.current.url,
            title: currentVideoRef.current.title,
            thumbnail: currentVideoRef.current.thumbnail,
        });
        if (!payload) return;

        skipPipOnUnmount.current = true;
        video.pause();
        setIsPlaying(false);
        watchPip.startPip({ ...payload, playing: true });
    }, [watchPip]);

    useEffect(() => {
        return () => {
            if (skipPipOnUnmount.current || !watchPip?.startPip) return;
            const video = videoRef.current;
            const cv = currentVideoRef.current;
            if (!video || !cv) return;

            const payload = buildLibraryPipPayloadFromVideo(video, {
                libraryVideoId: cv.id,
                videoUrl: cv.url,
                title: cv.title,
                thumbnail: cv.thumbnail,
            });
            if (payload) watchPip.startPip(payload);
        };
    }, [watchPip]);

    const handleVideoEnd = useCallback(() => {
        if (isLooping) {
            const video = videoRef.current;
            if (video) {
                video.currentTime = 0;
                video.play().catch(() => {});
            }
            return;
        }
        if (filteredVideos.length <= 1) return;
        setCurrentVideoIndex((prev) => (prev + 1) % filteredVideos.length);
    }, [filteredVideos.length, isLooping]);

    const handlePrev = () => {
        if (filteredVideos.length <= 1) return;
        setCurrentVideoIndex((prev) => (prev - 1 + filteredVideos.length) % filteredVideos.length);
    };

    const focusVideoInList = (videoId, nextCustomVideos = customVideos) => {
        const merged = mergePlaylist(watchVideos, savedVideos, nextCustomVideos);
        let list = filterPlaylist(merged, filter);
        const q = searchQuery.trim().toLowerCase();
        if (q) list = list.filter((v) => v.title.toLowerCase().includes(q));
        list = sortPlaylist(list, sortMode, playlistOrder);
        const idx = list.findIndex((v) => v.id === videoId);
        if (idx >= 0) setCurrentVideoIndex(idx);
    };

    const handleAddVideo = (e) => {
        e.preventDefault();
        const url = videoUrl.trim();
        if (!url) return;

        const newVideo = normalizePlaylistItem({
            id: `custom-${Date.now()}`,
            url,
            title: videoTitle.trim() || `Video ${customVideos.length + 1}`,
            type: 'url',
            online: true,
        });

        if (!newVideo) return;

        const nextCustom = [...customVideos, newVideo];
        setCustomVideos(nextCustom);
        setPlaylistOrder((prev) => {
            const next = syncPlaylistOrder([...prev, newVideo.id], mergePlaylist(watchVideos, savedVideos, nextCustom));
            savePlaylistOrder(next);
            return next;
        });
        focusVideoInList(newVideo.id, nextCustom);
        setFilter('all');
        setVideoUrl('');
        setVideoTitle('');
    };

    const handleFileUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file || !file.type.startsWith('video/')) return;

        const blobUrl = URL.createObjectURL(file);
        blobUrlsRef.current.add(blobUrl);

        const newVideo = normalizePlaylistItem({
            id: `file-${Date.now()}`,
            url: blobUrl,
            title: videoTitle.trim() || file.name,
            type: 'file',
            online: false,
        });

        if (!newVideo) return;

        const nextCustom = [...customVideos, newVideo];
        setCustomVideos(nextCustom);
        setPlaylistOrder((prev) => {
            const next = syncPlaylistOrder([...prev, newVideo.id], mergePlaylist(watchVideos, savedVideos, nextCustom));
            savePlaylistOrder(next);
            return next;
        });
        focusVideoInList(newVideo.id, nextCustom);
        setFilter('all');
        setVideoTitle('');

        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleRemoveVideo = (video) => {
        if (!video) return;

        if (video.type === 'url' || video.type === 'file') {
            setCustomVideos((prev) => prev.filter((v) => v.id !== video.id));
            if (video.type === 'file' && video.url.startsWith('blob:')) {
                URL.revokeObjectURL(video.url);
                blobUrlsRef.current.delete(video.url);
            }
        }

        setPlaylistOrder((prev) => {
            const next = prev.filter((id) => id !== video.id);
            savePlaylistOrder(next);
            return next;
        });
        setCurrentVideoIndex((prev) => Math.max(0, prev - 1));
    };

    const handlePlayVideo = (index) => {
        setCurrentVideoIndex(index);
    };

    const togglePlayPause = () => {
        const video = videoRef.current;
        if (!video) return;
        if (video.paused) {
            video.play().then(() => setIsPlaying(true)).catch(() => {});
        } else {
            video.pause();
            setIsPlaying(false);
        }
    };

    const handleDragStart = (index) => {
        if (sortMode !== 'custom') return;
        setDragIndex(index);
    };

    const handleDragOver = (e, index) => {
        if (sortMode !== 'custom' || dragIndex === null || dragIndex === index) return;
        e.preventDefault();
    };

    const handleDrop = (index) => {
        if (sortMode !== 'custom' || dragIndex === null || dragIndex === index) {
            setDragIndex(null);
            return;
        }

        const ids = filteredVideos.map((v) => v.id);
        const nextIds = reorderPlaylistIds(ids, dragIndex, index);
        setPlaylistOrder(nextIds);
        savePlaylistOrder(nextIds);

        if (currentVideoIndex === dragIndex) {
            setCurrentVideoIndex(index);
        } else if (dragIndex < currentVideoIndex && index >= currentVideoIndex) {
            setCurrentVideoIndex((prev) => prev - 1);
        } else if (dragIndex > currentVideoIndex && index <= currentVideoIndex) {
            setCurrentVideoIndex((prev) => prev + 1);
        }

        setDragIndex(null);
    };

    const stats = useMemo(
        () => ({
            watches: watchVideos.length,
            saved: savedVideos.length,
            custom: customVideos.length,
            total: allVideos.length,
        }),
        [watchVideos.length, savedVideos.length, customVideos.length, allVideos.length]
    );

    return (
        <div className="video-player-page">
            <div className="video-player-container">
                <div className="video-player-main">
                    <div className="video-player-header">
                        <h1>Video Player</h1>
                        <p>Play Watch videos, saved offline videos, and custom URLs in one playlist</p>
                    </div>

                    <div className="video-player-stats">
                        <span>{stats.total} total</span>
                        <span>{stats.watches} watches</span>
                        <span>{stats.saved} saved</span>
                        <span>{stats.custom} custom</span>
                        <button type="button" className="btn btn-sm btn-secondary" onClick={refreshLibrary} disabled={libraryLoading}>
                            {libraryLoading ? 'Refreshing…' : 'Refresh library'}
                        </button>
                    </div>

                    {libraryError ? <p className="video-player-error">{libraryError}</p> : null}

                    {currentVideo ? (
                        <div className="video-stage">
                            <div className="video-stage-header">
                                <div className="video-stage-title-wrap">
                                    <h3 className="video-stage-title">{currentVideo.title}</h3>
                                    <p className="video-stage-meta">
                                        {getSourceLabel(currentVideo)}
                                        {' · '}
                                        Video {currentVideoIndex + 1} of {filteredVideos.length}
                                    </p>
                                </div>
                                <span className="video-stage-badge">{getTypeLabel(currentVideo.type)}</span>
                            </div>

                            <div className="video-stage-frame">
                                {isThisPip ? (
                                    <div className="video-pip-inline-placeholder">
                                        <span>Playing in pop-out mode</span>
                                        <button type="button" onClick={() => watchPip?.closePip?.()}>
                                            Return here
                                        </button>
                                    </div>
                                ) : (
                                    <video
                                        key={currentTrackKey}
                                        ref={videoRef}
                                        className="main-video"
                                        controls
                                        playsInline
                                        preload="metadata"
                                        poster={currentVideo.thumbnail || undefined}
                                        onEnded={handleVideoEnd}
                                        onPlay={() => setIsPlaying(true)}
                                        onPause={() => setIsPlaying(false)}
                                    />
                                )}
                            </div>

                            <div className="video-stage-toolbar">
                                <button type="button" className="video-tool-btn" onClick={handlePrev} disabled={filteredVideos.length <= 1} title="Previous">
                                    <i className="fas fa-step-backward" />
                                </button>
                                <button type="button" className="video-tool-btn video-tool-btn-primary" onClick={togglePlayPause} title={isPlaying ? 'Pause' : 'Play'}>
                                    <i className={`fas ${isPlaying ? 'fa-pause' : 'fa-play'}`} />
                                </button>
                                <button type="button" className="video-tool-btn" onClick={handleVideoEnd} disabled={filteredVideos.length <= 1 || isLooping} title="Next">
                                    <i className="fas fa-step-forward" />
                                </button>
                                <button
                                    type="button"
                                    className={`video-tool-btn ${isLooping ? 'active' : ''}`}
                                    onClick={() => setIsLooping((prev) => !prev)}
                                    title={isLooping ? 'Loop on' : 'Loop off'}
                                >
                                    <i className="fas fa-redo" />
                                </button>
                                {watchPip && !isThisPip && (
                                    <button type="button" className="video-tool-btn" onClick={minimizeToPip} title="Pop out">
                                        <i className="fas fa-external-link-alt" />
                                    </button>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="no-video-placeholder">
                            <div className="placeholder-icon">🎬</div>
                            <h3>No videos in library</h3>
                            <p>Add a URL, upload a file, or save/download videos to populate your playlist</p>
                        </div>
                    )}
                </div>

                <div className="video-player-sidebar-column">
                    <div className="video-playlist-sidebar">
                        <div className="playlist-header">
                            <h2>Library</h2>
                            <span className="playlist-count">{filteredVideos.length} videos</span>
                        </div>

                        <div className="video-player-filters">
                            {FILTER_OPTIONS.map((opt) => (
                                <button
                                    key={opt.id}
                                    type="button"
                                    className={`video-player-filter-btn ${filter === opt.id ? 'active' : ''}`}
                                    onClick={() => {
                                        setFilter(opt.id);
                                        setCurrentVideoIndex(0);
                                    }}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>

                        <div className="video-player-list-controls">
                            <input
                                type="text"
                                className="form-input video-player-search"
                                placeholder="Search playlist…"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                            <select
                                className="form-input video-player-sort"
                                value={sortMode}
                                onChange={(e) => setSortMode(e.target.value)}
                            >
                                {SORT_OPTIONS.map((opt) => (
                                    <option key={opt.id} value={opt.id}>
                                        {opt.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {sortMode === 'custom' && filteredVideos.length > 1 ? (
                            <p className="video-player-sort-hint">Drag items to reorder</p>
                        ) : null}

                        {libraryLoading && filteredVideos.length === 0 ? (
                            <div className="playlist-empty">
                                <p>Loading your videos…</p>
                            </div>
                        ) : filteredVideos.length > 0 ? (
                            <div className="playlist-items">
                                {filteredVideos.map((video, index) => (
                                    <div
                                        key={video.id}
                                        className={`playlist-item ${index === currentVideoIndex ? 'active' : ''} ${dragIndex === index ? 'dragging' : ''}`}
                                        draggable={sortMode === 'custom'}
                                        onDragStart={() => handleDragStart(index)}
                                        onDragOver={(e) => handleDragOver(e, index)}
                                        onDrop={() => handleDrop(index)}
                                        onDragEnd={() => setDragIndex(null)}
                                        onClick={() => handlePlayVideo(index)}
                                    >
                                        {sortMode === 'custom' ? (
                                            <span className="playlist-drag-handle" title="Drag to reorder">
                                                <i className="fas fa-grip-vertical" />
                                            </span>
                                        ) : null}
                                        <div className="playlist-item-thumbnail">
                                            {video.thumbnail ? (
                                                <img src={video.thumbnail} alt="" />
                                            ) : index === currentVideoIndex && isPlaying ? (
                                                <div className="playing-indicator">▶</div>
                                            ) : (
                                                <div className="play-number">{index + 1}</div>
                                            )}
                                        </div>
                                        <div className="playlist-item-info">
                                            <div className="playlist-item-title">{video.title}</div>
                                            <div className="playlist-item-type">{getSourceLabel(video)}</div>
                                        </div>
                                        {(video.type === 'url' || video.type === 'file') && (
                                            <button
                                                type="button"
                                                className="playlist-item-remove"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleRemoveVideo(video);
                                                }}
                                                title="Remove video"
                                            >
                                                ×
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="playlist-empty">
                                <p>No videos match this filter</p>
                                <p className="playlist-empty-hint">Try All or Server, or refresh the library</p>
                            </div>
                        )}
                    </div>

                    <div className="add-video-form">
                        <h3>Add custom video</h3>
                        <form onSubmit={handleAddVideo}>
                            <div className="form-group">
                                <label>Video title (optional)</label>
                                <input
                                    type="text"
                                    value={videoTitle}
                                    onChange={(e) => setVideoTitle(e.target.value)}
                                    placeholder="Enter video title"
                                    className="form-input"
                                />
                            </div>
                            <div className="form-group">
                                <label>Video URL</label>
                                <input
                                    type="url"
                                    value={videoUrl}
                                    onChange={(e) => setVideoUrl(e.target.value)}
                                    placeholder="https://example.com/video.mp4"
                                    className="form-input"
                                />
                            </div>
                            <div className="form-actions">
                                <button type="submit" className="btn btn-primary" disabled={!videoUrl.trim()}>
                                    Add from URL
                                </button>
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="btn btn-secondary"
                                >
                                    Upload file
                                </button>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="video/*"
                                    onChange={handleFileUpload}
                                    style={{ display: 'none' }}
                                />
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VideoPlayer;
