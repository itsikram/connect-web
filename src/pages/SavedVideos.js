import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { getAllSavedVideos } from '../utils/useSavedVideos';
import VideoCard from '../components/downloads/VideoCard';
import { subscribeWatchDownloads } from '../utils/watchDownloadProgress';
import { formatBytes } from '../utils/downloadFileWithProgress';
import './SavedVideos.css';

const SavedVideos = () => {
    const [videos, setVideos] = useState([]);
    const [activeDownloads, setActiveDownloads] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');

    const refreshSaved = useCallback(() => {
        getAllSavedVideos((data) => {
            setVideos(Array.isArray(data) ? data : []);
        });
    }, []);

    useEffect(() => {
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

    const isEmpty = videos.length === 0 && downloading.length === 0;
    const noResults = !isEmpty && filteredVideos.length === 0 && searchQuery.trim();

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

                {videos.length > 0 && (
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

                {isEmpty ? (
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
            </div>
        </div>
    );
};

export default SavedVideos;
