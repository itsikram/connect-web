import React, { useEffect, useState, useCallback } from 'react';
import { getAllSavedVideos } from '../utils/useSavedVideos';
import VideoCard from '../components/downloads/VideoCard';
import { subscribeWatchDownloads } from '../utils/watchDownloadProgress';
import { formatBytes } from '../utils/downloadFileWithProgress';
import './SavedVideos.css';

const SavedVideos = () => {
    const [videos, setVideos] = useState([]);
    const [activeDownloads, setActiveDownloads] = useState([]);

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
            // When a download completes, refresh IndexedDB list
            if (list.some((d) => d.status === 'completed')) {
                refreshSaved();
            }
        });
    }, [refreshSaved]);

    const downloading = activeDownloads.filter((d) => d.status === 'downloading' || d.status === 'failed');

    return (
        <div className='download-page container'>
            <h1>Saved Videos</h1>

            {downloading.length > 0 && (
                <section className='watch-download-progress-section'>
                    <h2 className='watch-download-progress-heading'>
                        <i className='fas fa-cloud-download-alt' style={{ marginRight: 8 }} />
                        Downloading
                    </h2>
                    <div className='row'>
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
                                <div className='col-md-4' key={`dl-${item.id}`}>
                                    <div className={`watch-download-progress-card ${failed ? 'failed' : ''}`}>
                                        <div className='watch-download-progress-media'>
                                            {thumb ? (
                                                <img src={thumb} alt='' />
                                            ) : (
                                                <div className='watch-download-progress-placeholder'>
                                                    <i className={`fas ${failed ? 'fa-exclamation-triangle' : 'fa-spinner fa-spin'}`} />
                                                </div>
                                            )}
                                            {!failed && (
                                                <div className='watch-download-progress-overlay'>
                                                    {Math.round(item.percent || 0)}%
                                                </div>
                                            )}
                                        </div>
                                        <div className='watch-download-progress-body'>
                                            <h5 className='watch-download-progress-title'>{title}</h5>
                                            <p className='watch-download-progress-status'>
                                                {failed
                                                    ? (item.error || 'Download failed')
                                                    : 'Downloading to Saved Videos…'}
                                            </p>
                                            <div className='watch-download-progress-track'>
                                                <div
                                                    className={`watch-download-progress-fill ${failed ? 'error' : ''}`}
                                                    style={{ width: `${Math.max(failed ? 100 : (item.percent || 0), failed ? 100 : 2)}%` }}
                                                />
                                            </div>
                                            <div className='watch-download-progress-meta'>
                                                <span>{failed ? 'Failed' : `${Math.round(item.percent || 0)}%`}</span>
                                                {sizeLabel ? <span>{sizeLabel}</span> : null}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>
            )}

            <div className='saved-videos-container'>
                <div className='row'>
                    {videos.length === 0 && downloading.length === 0 ? (
                        <div className='col-12'>
                            <p className='text-muted text-center py-5 mb-0'>
                                No saved videos yet. Tap the download icon on a Watch video to save one here.
                            </p>
                        </div>
                    ) : (
                        videos.map((video) => (
                            <VideoCard
                                key={video.id || video.metadata?._id}
                                videoData={video.metadata}
                                videoUrl={video.videoURL}
                            />
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default SavedVideos;
