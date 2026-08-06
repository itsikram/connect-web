import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useSelector } from 'react-redux';
import './VideoPlayer.css';
import {
    loadCustomPlaylist,
    saveCustomPlaylist,
    loadWatchPlaylistItems,
    loadSavedPlaylistItems,
    mergePlaylist,
    filterPlaylist,
    getTypeLabel,
    normalizePlaylistItem,
} from '../utils/videoPlayerLibrary';

const FILTER_OPTIONS = [
    { id: 'all', label: 'All' },
    { id: 'watch', label: 'Watches' },
    { id: 'saved', label: 'Saved' },
    { id: 'url', label: 'Custom' },
];

const VideoPlayer = () => {
    const myProfileId = useSelector((state) => state.profile?._id);

    const [customVideos, setCustomVideos] = useState(() => loadCustomPlaylist());
    const [watchVideos, setWatchVideos] = useState([]);
    const [savedVideos, setSavedVideos] = useState([]);
    const [libraryLoading, setLibraryLoading] = useState(true);
    const [libraryError, setLibraryError] = useState('');

    const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
    const [videoUrl, setVideoUrl] = useState('');
    const [videoTitle, setVideoTitle] = useState('');
    const [isPlaying, setIsPlaying] = useState(false);
    const [filter, setFilter] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');

    const videoRef = useRef(null);
    const fileInputRef = useRef(null);
    const blobUrlsRef = useRef(new Set());

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
        return list;
    }, [allVideos, filter, searchQuery]);

    const currentVideo = filteredVideos.length > 0 ? filteredVideos[currentVideoIndex] : null;
    const currentTrackKey = currentVideo ? `${currentVideo.id}:${currentVideo.url}` : '';

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
        if (!video || !currentVideo?.url) return;

        const onCanPlay = () => {
            video.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
        };

        if (video.src !== currentVideo.url) {
            video.src = currentVideo.url;
        }
        video.load();
        video.addEventListener('canplay', onCanPlay, { once: true });

        return () => {
            video.removeEventListener('canplay', onCanPlay);
        };
    }, [currentTrackKey, currentVideo?.url]);

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

    const handleVideoEnd = useCallback(() => {
        if (filteredVideos.length <= 1) return;
        setCurrentVideoIndex((prev) => (prev + 1) % filteredVideos.length);
    }, [filteredVideos.length]);

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

        setCustomVideos((prev) => {
            const next = [...prev, newVideo];
            const merged = mergePlaylist(watchVideos, savedVideos, next);
            const idx = merged.findIndex((v) => v.id === newVideo.id);
            if (idx >= 0) setCurrentVideoIndex(idx);
            return next;
        });
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

        setCustomVideos((prev) => {
            const next = [...prev, newVideo];
            const merged = mergePlaylist(watchVideos, savedVideos, next);
            const idx = merged.findIndex((v) => v.id === newVideo.id);
            if (idx >= 0) setCurrentVideoIndex(idx);
            return next;
        });
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
                        <div className="video-wrapper">
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
                            <div className="video-info">
                                <h3>{currentVideo.title}</h3>
                                <p>
                                    {getTypeLabel(currentVideo.type)}
                                    {currentVideo.online === false ? ' · Offline' : ' · Online'}
                                    {' · '}
                                    Video {currentVideoIndex + 1} of {filteredVideos.length}
                                </p>
                            </div>
                            <div className="video-player-controls-row">
                                <button type="button" className="btn btn-secondary btn-sm" onClick={togglePlayPause}>
                                    {isPlaying ? 'Pause' : 'Play'}
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    disabled={filteredVideos.length <= 1}
                                    onClick={handleVideoEnd}
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="no-video-placeholder">
                            <div className="placeholder-icon">🎬</div>
                            <h3>No videos in library</h3>
                            <p>Add a URL, upload a file, or save/download videos to populate your playlist</p>
                        </div>
                    )}

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

                    <input
                        type="text"
                        className="form-input video-player-search"
                        placeholder="Search playlist…"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />

                    {libraryLoading && filteredVideos.length === 0 ? (
                        <div className="playlist-empty">
                            <p>Loading your videos…</p>
                        </div>
                    ) : filteredVideos.length > 0 ? (
                        <div className="playlist-items">
                            {filteredVideos.map((video, index) => (
                                <div
                                    key={video.id}
                                    className={`playlist-item ${index === currentVideoIndex ? 'active' : ''}`}
                                    onClick={() => handlePlayVideo(index)}
                                >
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
                                        <div className="playlist-item-type">
                                            {getTypeLabel(video.type)}
                                            {video.online === false ? ' · Offline' : ''}
                                        </div>
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
                            <p className="playlist-empty-hint">Try All, or refresh the library</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default VideoPlayer;
