import React, { useState, useRef, useEffect } from 'react';
import './VideoPlayer.css';
import { getAllSavedVideos } from '../utils/useSavedVideos';

const VideoPlayer = () => {
    const [videos, setVideos] = useState([]);
    const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
    const [videoUrl, setVideoUrl] = useState('');
    const [videoTitle, setVideoTitle] = useState('');
    const [isPlaying, setIsPlaying] = useState(false);
    const [showSavedVideosModal, setShowSavedVideosModal] = useState(false);
    const [savedVideos, setSavedVideos] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loadingSavedVideos, setLoadingSavedVideos] = useState(false);
    const videoRef = useRef(null);
    const fileInputRef = useRef(null);

    // Load videos from localStorage on mount
    useEffect(() => {
        const savedVideos = localStorage.getItem('videoPlayerPlaylist');
        if (savedVideos) {
            try {
                const parsed = JSON.parse(savedVideos);
                setVideos(parsed);
            } catch (e) {
                console.error('Error loading saved videos:', e);
            }
        }
    }, []);

    // Save videos to localStorage whenever videos change
    useEffect(() => {
        if (videos.length > 0) {
            localStorage.setItem('videoPlayerPlaylist', JSON.stringify(videos));
        }
    }, [videos]);

    // Handle video end - loop to next video
    const handleVideoEnd = () => {
        if (videos.length > 0) {
            const nextIndex = (currentVideoIndex + 1) % videos.length;
            setCurrentVideoIndex(nextIndex);
        }
    };

    // Play current video when index changes
    useEffect(() => {
        if (videoRef.current && videos.length > 0) {
            videoRef.current.load();
            videoRef.current.play().then(() => {
                setIsPlaying(true);
            }).catch((e) => {
                console.error('Error playing video:', e);
                setIsPlaying(false);
            });
        }
    }, [currentVideoIndex, videos]);

    // Add video from URL
    const handleAddVideo = (e) => {
        e.preventDefault();
        if (videoUrl.trim()) {
            const newVideo = {
                id: Date.now(),
                url: videoUrl.trim(),
                title: videoTitle.trim() || `Video ${videos.length + 1}`,
                type: 'url'
            };
            setVideos([...videos, newVideo]);
            setVideoUrl('');
            setVideoTitle('');
            
            // If this is the first video, set it as current
            if (videos.length === 0) {
                setCurrentVideoIndex(0);
            }
        }
    };

    // Add video from file upload
    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (file && file.type.startsWith('video/')) {
            const url = URL.createObjectURL(file);
            const newVideo = {
                id: Date.now(),
                url: url,
                title: videoTitle.trim() || file.name,
                type: 'file',
                file: file
            };
            setVideos([...videos, newVideo]);
            setVideoTitle('');
            
            // If this is the first video, set it as current
            if (videos.length === 0) {
                setCurrentVideoIndex(0);
            }
        } else {
            alert('Please select a valid video file');
        }
        // Reset file input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    // Load saved videos from IndexedDB
    const loadSavedVideos = () => {
        setLoadingSavedVideos(true);
        getAllSavedVideos((data) => {
            setSavedVideos(data);
            setLoadingSavedVideos(false);
        });
    };

    // Open saved videos modal
    const handleOpenSavedVideos = () => {
        setShowSavedVideosModal(true);
        loadSavedVideos();
    };

    // Close saved videos modal
    const handleCloseSavedVideos = () => {
        setShowSavedVideosModal(false);
        setSearchQuery('');
    };

    // Add saved video to playlist
    const handleAddSavedVideo = (savedVideo) => {
        // Check if video already exists in playlist
        const exists = videos.some(v => v.savedVideoId === savedVideo.id);
        if (exists) {
            alert('This video is already in your playlist');
            return;
        }

        const newVideo = {
            id: Date.now(),
            url: savedVideo.videoURL,
            title: savedVideo.metadata?.caption || `Saved Video ${savedVideo.id}`,
            type: 'saved',
            savedVideoId: savedVideo.id
        };
        setVideos([...videos, newVideo]);
        
        // If this is the first video, set it as current
        if (videos.length === 0) {
            setCurrentVideoIndex(0);
        }
    };

    // Filter saved videos based on search query
    const filteredSavedVideos = savedVideos.filter(video => {
        if (!searchQuery.trim()) return true;
        const query = searchQuery.toLowerCase();
        const caption = video.metadata?.caption?.toLowerCase() || '';
        const author = video.metadata?.author?.firstName?.toLowerCase() || '';
        const authorSurname = video.metadata?.author?.surname?.toLowerCase() || '';
        return caption.includes(query) || author.includes(query) || authorSurname.includes(query);
    });

    // Remove video from playlist
    const handleRemoveVideo = (id) => {
        const newVideos = videos.filter(v => v.id !== id);
        setVideos(newVideos);
        
        // Adjust current index if needed
        if (currentVideoIndex >= newVideos.length && newVideos.length > 0) {
            setCurrentVideoIndex(newVideos.length - 1);
        } else if (newVideos.length === 0) {
            setCurrentVideoIndex(0);
        }
    };

    // Play specific video
    const handlePlayVideo = (index) => {
        setCurrentVideoIndex(index);
    };

    // Toggle play/pause
    const togglePlayPause = () => {
        if (videoRef.current) {
            if (isPlaying) {
                videoRef.current.pause();
                setIsPlaying(false);
            } else {
                videoRef.current.play().then(() => {
                    setIsPlaying(true);
                }).catch((e) => {
                    console.error('Error playing video:', e);
                });
            }
        }
    };

    const currentVideo = videos.length > 0 ? videos[currentVideoIndex] : null;

    return (
        <div className="video-player-page">
            <div className="video-player-container">
                {/* Main Video Player Section */}
                <div className="video-player-main">
                    <div className="video-player-header">
                        <h1>Video Player</h1>
                        <p>Add videos and enjoy continuous playback</p>
                    </div>

                    {currentVideo ? (
                        <div className="video-wrapper">
                            <video
                                ref={videoRef}
                                src={currentVideo.url}
                                controls
                                loop={false}
                                onEnded={handleVideoEnd}
                                onPlay={() => setIsPlaying(true)}
                                onPause={() => setIsPlaying(false)}
                                className="main-video"
                            />
                            <div className="video-info">
                                <h3>{currentVideo.title}</h3>
                                <p>Video {currentVideoIndex + 1} of {videos.length}</p>
                            </div>
                        </div>
                    ) : (
                        <div className="no-video-placeholder">
                            <div className="placeholder-icon">🎬</div>
                            <h3>No videos in playlist</h3>
                            <p>Add videos using the form below to get started</p>
                        </div>
                    )}

                    {/* Add Video Form */}
                    <div className="add-video-form">
                        <h3>Add Video</h3>
                        <form onSubmit={handleAddVideo}>
                            <div className="form-group">
                                <label>Video Title (optional)</label>
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
                                    required
                                />
                            </div>
                            <div className="form-actions">
                                <button type="submit" className="btn btn-primary">
                                    Add from URL
                                </button>
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="btn btn-secondary"
                                >
                                    Upload File
                                </button>
                                <button
                                    type="button"
                                    onClick={handleOpenSavedVideos}
                                    className="btn btn-secondary"
                                >
                                    Browse Saved Videos
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

                {/* Playlist Sidebar */}
                <div className="video-playlist-sidebar">
                    <div className="playlist-header">
                        <h2>Playlist</h2>
                        <span className="playlist-count">{videos.length} videos</span>
                    </div>
                    
                    {videos.length > 0 ? (
                        <div className="playlist-items">
                            {videos.map((video, index) => (
                                <div
                                    key={video.id}
                                    className={`playlist-item ${index === currentVideoIndex ? 'active' : ''}`}
                                    onClick={() => handlePlayVideo(index)}
                                >
                                    <div className="playlist-item-thumbnail">
                                        {index === currentVideoIndex && isPlaying ? (
                                            <div className="playing-indicator">▶</div>
                                        ) : (
                                            <div className="play-number">{index + 1}</div>
                                        )}
                                    </div>
                                    <div className="playlist-item-info">
                                        <div className="playlist-item-title">{video.title}</div>
                                        <div className="playlist-item-type">{video.type === 'url' ? 'URL' : 'File'}</div>
                                    </div>
                                    <button
                                        className="playlist-item-remove"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleRemoveVideo(video.id);
                                        }}
                                        title="Remove video"
                                    >
                                        ×
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="playlist-empty">
                            <p>Your playlist is empty</p>
                            <p className="playlist-empty-hint">Add videos to see them here</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Saved Videos Modal */}
            {showSavedVideosModal && (
                <div className="saved-videos-modal-overlay" onClick={handleCloseSavedVideos}>
                    <div className="saved-videos-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="saved-videos-modal-header">
                            <h2>Browse Saved Videos</h2>
                            <button className="modal-close-btn" onClick={handleCloseSavedVideos}>×</button>
                        </div>
                        
                        <div className="saved-videos-modal-search">
                            <input
                                type="text"
                                placeholder="Search saved videos..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="saved-videos-search-input"
                            />
                        </div>

                        <div className="saved-videos-modal-content">
                            {loadingSavedVideos ? (
                                <div className="saved-videos-loading">
                                    <p>Loading saved videos...</p>
                                </div>
                            ) : filteredSavedVideos.length > 0 ? (
                                <div className="saved-videos-grid">
                                    {filteredSavedVideos.map((video) => {
                                        const isInPlaylist = videos.some(v => v.savedVideoId === video.id);
                                        return (
                                            <div key={video.id} className="saved-video-item">
                                                <div className="saved-video-thumbnail">
                                                    <video src={video.videoURL} muted />
                                                    {isInPlaylist && (
                                                        <div className="saved-video-in-playlist-badge">✓ In Playlist</div>
                                                    )}
                                                </div>
                                                <div className="saved-video-info">
                                                    <h4 className="saved-video-title">
                                                        {video.metadata?.caption || 'Untitled Video'}
                                                    </h4>
                                                    {video.metadata?.author && (
                                                        <p className="saved-video-author">
                                                            by {video.metadata.author.firstName} {video.metadata.author.surname}
                                                        </p>
                                                    )}
                                                </div>
                                                <button
                                                    className={`saved-video-add-btn ${isInPlaylist ? 'disabled' : ''}`}
                                                    onClick={() => handleAddSavedVideo(video)}
                                                    disabled={isInPlaylist}
                                                >
                                                    {isInPlaylist ? 'Already Added' : 'Add to Playlist'}
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="saved-videos-empty">
                                    <p>{searchQuery ? 'No videos found matching your search' : 'No saved videos found'}</p>
                                    <p className="saved-videos-empty-hint">
                                        {searchQuery ? 'Try a different search term' : 'Save videos from the app to see them here'}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default VideoPlayer;

