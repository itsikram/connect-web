import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { getAllSavedVideos, getSavedVideosHistory, saveVideoFromUrl, deleteSavedVideoHistoryById } from '../utils/useSavedVideos';
import VideoCard from '../components/downloads/VideoCard';
import { subscribeWatchDownloads } from '../utils/watchDownloadProgress';
import { formatBytes } from '../utils/downloadFileWithProgress';
import './SavedVideos.css';

const getRestorableUrl = (video) => {
    const meta = video?.metadata || {};
    const candidates = [
        video?.sourceUrl,
        meta.videoURL,
        meta.videoUrl,
        meta.url,
        meta.downloadUrl,
        meta.downloadURL,
        meta.mediaUrl,
        meta.mediaURL,
        meta?.video?.url,
    ];

    return String(candidates.find((v) => typeof v === 'string' && v.trim()) || '').trim();
};

const SavedVideos = () => {
    const [videos, setVideos] = useState([]);
    const [previousVideos, setPreviousVideos] = useState([]);
    const [activeDownloads, setActiveDownloads] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isDownloadingAll, setIsDownloadingAll] = useState(false);
    const [isLoadingPrevious, setIsLoadingPrevious] = useState(false);
    const [deletingPreviousId, setDeletingPreviousId] = useState('');

    const refreshSaved = useCallback(() => {
        console.log('[SavedVideos] Refreshing local saved videos...');
        getAllSavedVideos((data) => {
            setVideos(Array.isArray(data) ? data : []);
            console.log('[SavedVideos] Local videos count:', data?.length || 0);
        });
    }, []);

    // Load previous videos from backend - runs once on mount
    useEffect(() => {
        const loadPreviousVideos = async () => {
            setIsLoadingPrevious(true);
            try {
                console.log('[SavedVideos] Loading previous videos from backend...');
                const history = await getSavedVideosHistory();
                console.log('[SavedVideos] Backend response:', history);
                
                if (history && Array.isArray(history) && history.length > 0) {
                    setPreviousVideos(history);
                    console.log(`[SavedVideos] Loaded ${history.length} previous videos`);
                } else {
                    console.log('[SavedVideos] No previous videos found');
                    setPreviousVideos([]);
                }
            } catch (error) {
                console.error('[SavedVideos] Error loading previous videos:', error);
                setPreviousVideos([]);
            } finally {
                setIsLoadingPrevious(false);
            }
        };

        loadPreviousVideos();
    }, []); // Empty dependencies - run once on mount

    useEffect(() => {
        console.log('[SavedVideos] Component mounted, loading saved videos...');
        refreshSaved();
    }, [refreshSaved]);

    useEffect(() => {
        return subscribeWatchDownloads((list) => {
            setActiveDownloads(list);
            if (list.some((d) => d.status === 'completed')) {
                refreshSaved();
            }
        });
    }, [refreshSaved]);

    const downloading = activeDownloads.filter((d) => d.status === 'downloading' || d.status === 'failed');

    const filteredVideos = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return videos;
        return videos.filter((video) => {
            const meta = video.metadata || {};
            const caption = (meta.caption || '').toLowerCase();
            const author = (meta.author?.fullName || meta.author?.name || '').toLowerCase();
            return caption.includes(q) || author.includes(q);
        });
    }, [videos, searchQuery]);

    const filteredPreviousVideos = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return previousVideos;
        return previousVideos.filter((video) => {
            const meta = video.metadata || {};
            const caption = (meta.caption || '').toLowerCase();
            const author = (meta.author?.fullName || meta.author?.name || '').toLowerCase();
            return caption.includes(q) || author.includes(q);
        });
    }, [previousVideos, searchQuery]);

    const handleDownloadAll = async () => {
        if (isDownloadingAll || previousVideos.length === 0) return;
        
        console.log('[SavedVideos] Starting download all for', previousVideos.length, 'videos');
        setIsDownloadingAll(true);
        let successCount = 0;
        let failCount = 0;

        for (const video of previousVideos) {
            try {
                const videoURL = getRestorableUrl(video);
                console.log('[SavedVideos] Downloading video:', {
                    videoId: video.videoId,
                    hasURL: !!videoURL,
                    title: video.metadata?.caption
                });
                
                if (videoURL) {
                    const success = await saveVideoFromUrl(
                        video.videoId,
                        videoURL,
                        video.metadata
                    );
                    if (success) {
                        successCount++;
                        console.log('[SavedVideos] Video downloaded successfully');
                    } else {
                        failCount++;
                        console.warn('[SavedVideos] Video download failed');
                    }
                } else {
                    console.warn('[SavedVideos] No URL for video:', video.videoId);
                    failCount++;
                }
            } catch (error) {
                console.error('[SavedVideos] Error downloading video:', error);
                failCount++;
            }
        }

        setIsDownloadingAll(false);
        console.log(`[SavedVideos] Download all complete - Success: ${successCount}, Failed: ${failCount}`);
    };

    const handleDeletePrevious = async (videoId) => {
        if (!videoId || deletingPreviousId) return;
        setDeletingPreviousId(String(videoId));
        try {
            const ok = await deleteSavedVideoHistoryById(String(videoId));
            if (ok) {
                setPreviousVideos((prev) => prev.filter((v) => String(v.videoId) !== String(videoId)));
            }
        } finally {
            setDeletingPreviousId('');
        }
    };

    const isEmpty = videos.length === 0 && downloading.length === 0;
    const noResults = !isEmpty && filteredVideos.length === 0 && searchQuery.trim();
    const noPreviousResults = !isEmpty && filteredPreviousVideos.length === 0 && searchQuery.trim();

    return (
        <div className="sv-page">
            <div className="sv-page-inner">
                <header className="sv-header">
                    <div className="sv-header-text">
                        <h1 className="sv-title">Saved Videos</h1>
                        <p className="sv-subtitle">
                            {videos.length === 0
                                ? 'Videos saved on this device appear here'
                                : `${videos.length} video${videos.length === 1 ? '' : 's'} saved locally`}
                        </p>
                    </div>
                </header>

                {(videos.length > 0 || previousVideos.length > 0) && (
                    <div className="sv-search-wrap">
                        <i className="fas fa-search sv-search-icon" aria-hidden="true" />
                        <input
                            type="search"
                            className="sv-search-input"
                            placeholder="Search saved videos…"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            aria-label="Search saved videos"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                className="sv-search-clear"
                                onClick={() => setSearchQuery('')}
                                aria-label="Clear search"
                            >
                                <i className="fas fa-times" aria-hidden="true" />
                            </button>
                        )}
                    </div>
                )}

                {downloading.length > 0 && (
                    <section className="sv-section watch-download-progress-section">
                        <h2 className="sv-section-title watch-download-progress-heading">
                            <i className="fas fa-cloud-download-alt" aria-hidden="true" />
                            Downloading
                            <span className="sv-section-badge">{downloading.length}</span>
                        </h2>
                        <div className="sv-download-grid">
                            {downloading.map((item) => {
                                const meta = item.metadata || {};
                                const title = meta.caption || 'Watch video';
                                const thumb = meta.thumbnail || meta.author?.profilePic || '';
                                const failed = item.status === 'failed';
                                const sizeLabel = item.total > 0
                                    ? `${formatBytes(item.loaded)} / ${formatBytes(item.total)}`
                                    : item.loaded > 0
                                        ? formatBytes(item.loaded)
                                        : '';

                                return (
                                    <div className={`watch-download-progress-card ${failed ? 'failed' : ''}`} key={`dl-${item.id}`}>
                                        <div className="watch-download-progress-media">
                                            {thumb ? (
                                                <img src={thumb} alt="" loading="lazy" />
                                            ) : (
                                                <div className="watch-download-progress-placeholder">
                                                    <i className={`fas ${failed ? 'fa-exclamation-triangle' : 'fa-spinner fa-spin'}`} />
                                                </div>
                                            )}
                                            {!failed && (
                                                <div className="watch-download-progress-overlay">
                                                    {Math.round(item.percent || 0)}%
                                                </div>
                                            )}
                                        </div>
                                        <div className="watch-download-progress-body">
                                            <h5 className="watch-download-progress-title">{title}</h5>
                                            <p className="watch-download-progress-status">
                                                {failed
                                                    ? (item.error || 'Download failed')
                                                    : 'Downloading to Saved Videos…'}
                                            </p>
                                            <div className="watch-download-progress-track">
                                                <div
                                                    className={`watch-download-progress-fill ${failed ? 'error' : ''}`}
                                                    style={{ width: `${Math.max(failed ? 100 : (item.percent || 0), failed ? 100 : 2)}%` }}
                                                />
                                            </div>
                                            <div className="watch-download-progress-meta">
                                                <span>{failed ? 'Failed' : `${Math.round(item.percent || 0)}%`}</span>
                                                {sizeLabel ? <span>{sizeLabel}</span> : null}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                )}

                {isEmpty && previousVideos.length === 0 ? (
                    <div className="sv-empty">
                        <div className="sv-empty-icon" aria-hidden="true">
                            <i className="fas fa-film" />
                        </div>
                        <h2>No saved videos yet</h2>
                        <p>Download from YouTube or save a video from Watch to store it on this device.</p>
                        <div className="sv-empty-actions">
                            <Link to="/yt-download" className="sv-btn sv-btn--primary">
                                <i className="fas fa-download" aria-hidden="true" />
                                YouTube Downloader
                            </Link>
                            <Link to="/watch" className="sv-btn sv-btn--ghost">
                                <i className="fas fa-tv" aria-hidden="true" />
                                Browse Watch
                            </Link>
                        </div>
                    </div>
                ) : noResults ? (
                    <div className="sv-empty sv-empty--compact">
                        <p>No videos match &ldquo;{searchQuery.trim()}&rdquo;</p>
                        <button type="button" className="sv-btn sv-btn--ghost" onClick={() => setSearchQuery('')}>
                            Clear search
                        </button>
                    </div>
                ) : (
                    <>
                        {/* Current local saved videos */}
                        {!isEmpty && (
                            <section className="sv-section">
                                {downloading.length > 0 && (
                                    <h2 className="sv-section-title">
                                        <i className="fas fa-folder-open" aria-hidden="true" />
                                        Your library
                                    </h2>
                                )}
                                <div className="sv-grid">
                                    {filteredVideos.map((video) => (
                                        <VideoCard
                                            key={video.id || video.metadata?._id}
                                            videoData={video.metadata}
                                            videoUrl={video.videoURL}
                                            onDelete={refreshSaved}
                                        />
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* Previous downloads section */}
                        {previousVideos.length > 0 && (
                            <section className="sv-section sv-previous-section">
                                <div className="sv-previous-header">
                                    <div>
                                        <h2 className="sv-section-title">
                                            <i className="fas fa-history" aria-hidden="true" />
                                            Previous Downloads
                                            <span className="sv-section-badge">{previousVideos.length}</span>
                                        </h2>
                                        <p className="sv-previous-subtitle">
                                            These videos were previously downloaded. Your browser cache may have been cleared.
                                        </p>
                                    </div>
                                    {previousVideos.length > 0 && (
                                        <button
                                            type="button"
                                            className="sv-btn sv-btn--primary sv-btn--download-all"
                                            onClick={handleDownloadAll}
                                            disabled={isDownloadingAll}
                                            aria-label="Download all previous videos"
                                        >
                                            <i className={`fas ${isDownloadingAll ? 'fa-spinner fa-spin' : 'fa-download'}`} aria-hidden="true" />
                                            {isDownloadingAll ? 'Downloading...' : 'Download All'}
                                        </button>
                                    )}
                                </div>
                                
                                {isLoadingPrevious ? (
                                    <div style={{ textAlign: 'center', padding: '20px', color: '#9ca3af' }}>
                                        <i className="fas fa-spinner fa-spin" style={{ marginRight: '8px' }} />
                                        Loading previous downloads...
                                    </div>
                                ) : noPreviousResults ? (
                                    <div className="sv-empty sv-empty--compact" style={{ marginTop: '12px' }}>
                                        <p>No videos match &ldquo;{searchQuery.trim()}&rdquo;</p>
                                    </div>
                                ) : (
                                    <div className="sv-grid">
                                        {filteredPreviousVideos.map((video) => (
                                            <div className="sv-video-restore-card" key={video._id || video.videoId}>
                                                <div className="sv-video-restore-media">
                                                    {video.metadata?.thumbnail ? (
                                                        <img src={video.metadata.thumbnail} alt={video.metadata?.caption || 'Video'} loading="lazy" />
                                                    ) : (
                                                        <div className="sv-video-restore-placeholder">
                                                            <i className="fas fa-video" />
                                                        </div>
                                                    )}
                                                    <div className="sv-video-restore-overlay">
                                                        <div className="sv-video-restore-actions">
                                                            <button
                                                                type="button"
                                                                className="sv-btn sv-btn--small sv-btn--primary"
                                                                onClick={async () => {
                                                                    const videoURL = getRestorableUrl(video);
                                                                    if (videoURL) {
                                                                        await saveVideoFromUrl(
                                                                            video.videoId,
                                                                            videoURL,
                                                                            video.metadata
                                                                        );
                                                                    }
                                                                }}
                                                                aria-label="Download this video"
                                                            >
                                                                <i className="fas fa-download" aria-hidden="true" />
                                                                Restore
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="sv-btn sv-btn--small sv-btn--danger"
                                                                onClick={() => handleDeletePrevious(video.videoId)}
                                                                disabled={deletingPreviousId === String(video.videoId)}
                                                                aria-label="Delete this previous download"
                                                            >
                                                                <i className={`fas ${deletingPreviousId === String(video.videoId) ? 'fa-spinner fa-spin' : 'fa-trash'}`} aria-hidden="true" />
                                                                {deletingPreviousId === String(video.videoId) ? 'Deleting...' : 'Delete'}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="sv-video-restore-info">
                                                    <h4 className="sv-video-restore-title">{video.metadata?.caption || 'Video'}</h4>
                                                    <p className="sv-video-restore-author">
                                                        {video.metadata?.author?.fullName || video.metadata?.author?.name || 'Unknown'}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </section>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default SavedVideos;
