import React, { useState, useRef, useEffect } from 'react';
import { showSuccessToast, showErrorToast, showInfoToast } from '../utils/toastUtils';
import axios from 'axios';
import { getYtDownloadApiUrl, isOffline } from '../utils/offlineUtils';
import { useAuth } from '../hooks/useAuth';
import VideoDownloadModal from '../components/modal/VideoDownloadModal';
import './YtDownload.css';

const getYTDownloadAPI = () => getYtDownloadApiUrl();

const QUALITY_OPTIONS = [
    { label: 'Best Quality', value: 1080 },
    { label: '720p', value: 720 },
    { label: '480p', value: 480 },
    { label: '360p', value: 360 },
    { label: '240p', value: 240 },
];

const YtDownload = () => {
    const { isAuthenticated, token } = useAuth();
    const [youtubeUrl, setYoutubeUrl] = useState('');
    const [selectedQuality, setSelectedQuality] = useState(1080);
    const [isDownloading, setIsDownloading] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState(0);
    const [downloadStage, setDownloadStage] = useState('');
    const [downloadStatus, setDownloadStatus] = useState('');
    const [currentDownload, setCurrentDownload] = useState(null);
    const [downloadHistory, setDownloadHistory] = useState([]);
    const [videoTitle, setVideoTitle] = useState('');
    const [postAsWatch, setPostAsWatch] = useState(false);
    const [showDownloadModal, setShowDownloadModal] = useState(false);
    const [completedDownload, setCompletedDownload] = useState(null);

    const progressPollIntervalRef = useRef(null);
    const statusPollIntervalRef = useRef(null);

    useEffect(() => {
        return () => {
            if (progressPollIntervalRef.current) {
                clearInterval(progressPollIntervalRef.current);
            }
            if (statusPollIntervalRef.current) {
                clearInterval(statusPollIntervalRef.current);
            }
        };
    }, []);

    const getAuthHeaders = () => {
        const headers = { Accept: 'application/json' };
        if (token) {
            headers.Authorization = token;
        }
        return headers;
    };

    const buildDownloadUrl = (url, height, shouldPostAsWatch) => {
        try {
            if (isOffline()) {
                showErrorToast('YouTube download is not available offline. Please connect to the internet.', {
                    title: 'Offline Mode',
                });
                return null;
            }

            const normalized = (url || '').replace('m.youtube.com', 'www.youtube.com');
            const encoded = encodeURIComponent(normalized);
            const heightParam = height ? `&height=${height}` : '';
            const watchParam = shouldPostAsWatch ? '&post_as_watch=true' : '';
            const apiUrl = getYTDownloadAPI();
            return `${apiUrl}/download?url=${encoded}&ext=mp4${heightParam}&disposition=inline&link_only=true&async_job=true${watchParam}`;
        } catch (e) {
            console.error('Error building download URL:', e);
            return null;
        }
    };

    const sanitizeFileName = (name) => {
        if (!name || name === 'video') return 'video';
        let cleanName = name.replace(/\.[^/.]+$/, '');
        cleanName = cleanName.replace(/_/g, ' ');
        cleanName = cleanName.replace(/[^a-zA-Z0-9. -]+/g, '-').replace(/^-+|-+$/g, '').replace(/\s+/g, ' ').trim();
        return cleanName.substring(0, 100) || 'video';
    };

    const extractFileNameFromUrl = (url) => {
        try {
            if (!url) return null;
            const urlObj = new URL(url);
            let pathPart = urlObj.pathname || '';
            if (pathPart.endsWith('/')) pathPart = pathPart.replace(/\/+$/, '');
            let filename = pathPart.split('/').pop() || '';
            try {
                filename = decodeURIComponent(filename);
            } catch (_) {}
            filename = filename.replace(/\.mp4$/i, '');
            if (!filename || filename.length < 3) return null;
            return filename;
        } catch (e) {
            console.error('Error extracting filename from URL:', e);
            return null;
        }
    };

    const handleDownloadComplete = (fileUrl, title, watchPosted) => {
        const finalTitle = title || extractFileNameFromUrl(fileUrl) || 'video';
        const fileName = `${sanitizeFileName(finalTitle)}.mp4`;

        const downloadItem = {
            id: Date.now(),
            fileName,
            url: fileUrl,
            timestamp: new Date().toISOString(),
        };
        setDownloadHistory((prev) => [downloadItem, ...prev]);

        setCompletedDownload({
            fileName,
            fileUrl,
            title: finalTitle,
            watchPosted: !!watchPosted,
        });
        setShowDownloadModal(true);

        setIsDownloading(false);
        setDownloadProgress(100);
        setDownloadStage('completed');
        setDownloadStatus('completed');
        setCurrentDownload(null);

        const successMessage = watchPosted
            ? 'Video ready! Posted to Watch and available for download.'
            : 'Video ready! Use the download link in the modal.';
        showSuccessToast(successMessage, { title: 'Download Complete' });

        setTimeout(() => {
            setDownloadProgress(0);
            setDownloadStage('');
            setDownloadStatus('');
        }, 3000);
    };

    const pollProgress = async (progressUrl) => {
        if (progressPollIntervalRef.current) {
            clearInterval(progressPollIntervalRef.current);
        }

        progressPollIntervalRef.current = setInterval(async () => {
            try {
                const response = await axios.get(progressUrl, {
                    headers: getAuthHeaders(),
                    params: { _ts: Date.now() },
                });

                const data = response.data;
                const status = data?.status;
                const stage = data?.stage || '';
                const pct = data?.pct || 0;
                const fileUrl = data?.file_url;
                const title = data?.title || data?.download_title || videoTitle;
                const watchPosted = data?.watch_posted;

                if (title && title !== videoTitle) {
                    setVideoTitle(title);
                }

                setDownloadProgress(Math.round(pct));
                setDownloadStage(stage);
                setDownloadStatus(status);

                if (status === 'completed' && typeof fileUrl === 'string' && /(\.mp4)(\b|\?|$)/i.test(fileUrl)) {
                    if (progressPollIntervalRef.current) {
                        clearInterval(progressPollIntervalRef.current);
                        progressPollIntervalRef.current = null;
                    }
                    handleDownloadComplete(fileUrl, title, watchPosted);
                } else if (status === 'failed' || status === 'error') {
                    if (progressPollIntervalRef.current) {
                        clearInterval(progressPollIntervalRef.current);
                        progressPollIntervalRef.current = null;
                    }
                    setIsDownloading(false);
                    setDownloadStatus('failed');
                    showErrorToast(data?.error || 'Download failed. Please try again.', { title: 'Download Error' });
                }
            } catch (err) {
                console.error('Progress poll error:', err);
            }
        }, 2000);
    };

    const startDownloadJob = async (requestUrl) => {
        try {
            const response = await axios.get(requestUrl, {
                headers: getAuthHeaders(),
                params: { _ts: Date.now() },
            });

            const json = response.data;
            const title = json?.title || json?.download_title;

            if (title) {
                setVideoTitle(title);
            }

            if (json && json.status === 'accepted' && typeof json.progress_url === 'string' && json.progress_url.length > 0) {
                pollProgress(json.progress_url);
                return;
            }

            if (json && json.status === 'completed' && json.file_url) {
                const finalTitle = title || extractFileNameFromUrl(json.file_url) || 'video';
                handleDownloadComplete(json.file_url, finalTitle, json.watch_posted);
                return;
            }

            setIsDownloading(false);
            showErrorToast('Unexpected response from download server', { title: 'Download Error' });
        } catch (err) {
            console.error('Start download error:', err);
            setIsDownloading(false);
            const errMsg = err.response?.data?.error || err.response?.data?.message || 'Failed to start download. Please try again.';
            showErrorToast(errMsg, { title: 'Download Error' });
        }
    };

    const validateYouTubeUrl = (url) => {
        if (!url) return false;
        const patterns = [
            /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\/.+/i,
            /^https?:\/\/m\.youtube\.com\/.+/i,
        ];
        return patterns.some((pattern) => pattern.test(url));
    };

    const handleDownload = async () => {
        if (!youtubeUrl.trim()) {
            showErrorToast('Please enter a YouTube URL', { title: 'Invalid URL' });
            return;
        }

        if (!validateYouTubeUrl(youtubeUrl)) {
            showErrorToast('Please enter a valid YouTube URL', { title: 'Invalid URL' });
            return;
        }

        if (postAsWatch && !isAuthenticated) {
            showErrorToast('Please log in to post videos to Watch', { title: 'Authentication Required' });
            return;
        }

        setIsDownloading(true);
        setDownloadProgress(0);
        setDownloadStage('starting');
        setDownloadStatus('running');
        setVideoTitle('');
        setCompletedDownload(null);
        setCurrentDownload({
            url: youtubeUrl,
            quality: selectedQuality,
            startTime: new Date().toISOString(),
        });

        showInfoToast('Preparing download on server...', { title: 'Download', autoClose: 3000 });

        const requestUrl = buildDownloadUrl(youtubeUrl, selectedQuality, postAsWatch);
        if (!requestUrl) {
            setIsDownloading(false);
            showErrorToast('Failed to build download URL', { title: 'Error' });
            return;
        }

        startDownloadJob(requestUrl);
    };

    const handleCancel = () => {
        if (progressPollIntervalRef.current) {
            clearInterval(progressPollIntervalRef.current);
            progressPollIntervalRef.current = null;
        }
        if (statusPollIntervalRef.current) {
            clearInterval(statusPollIntervalRef.current);
            statusPollIntervalRef.current = null;
        }
        setIsDownloading(false);
        setDownloadProgress(0);
        setDownloadStage('');
        setDownloadStatus('');
        setVideoTitle('');
        setCurrentDownload(null);
        showInfoToast('Download cancelled', { title: 'Cancelled', autoClose: 2000 });
    };

    const getStageLabel = (stage) => {
        const labels = {
            starting: 'Starting...',
            downloading: 'Downloading on server...',
            uploading_watch: 'Uploading to Watch...',
            transcoding: 'Processing...',
            completed: 'Completed',
            failed: 'Failed',
        };
        return labels[stage] || stage || 'Preparing...';
    };

    return (
        <div className='yt-download-page'>
            <VideoDownloadModal
                isOpen={showDownloadModal}
                onClose={() => setShowDownloadModal(false)}
                downloadInfo={completedDownload}
            />

            <div className='container my-4'>
                <div className='row justify-content-center'>
                    <div className='col-12 col-md-10 col-lg-8'>
                        <div className='yt-download-card'>
                            <h1 className='yt-download-title'>
                                <i className='fab fa-youtube' style={{ color: '#FF0000', marginRight: '10px' }}></i>
                                YouTube Video Downloader
                            </h1>
                            <p className='yt-download-subtitle'>Download YouTube videos in your preferred quality</p>

                            <div className='yt-download-form'>
                                <div className='form-group'>
                                    <label htmlFor='youtube-url'>YouTube URL</label>
                                    <input
                                        id='youtube-url'
                                        type='text'
                                        className='form-control yt-url-input'
                                        placeholder='https://www.youtube.com/watch?v=... or https://youtu.be/...'
                                        value={youtubeUrl}
                                        onChange={(e) => setYoutubeUrl(e.target.value)}
                                        disabled={isDownloading}
                                    />
                                </div>

                                <div className='form-group'>
                                    <label htmlFor='quality-select'>Video Quality</label>
                                    <select
                                        id='quality-select'
                                        className='form-control yt-quality-select'
                                        value={selectedQuality || ''}
                                        onChange={(e) => setSelectedQuality(e.target.value ? parseInt(e.target.value, 10) : null)}
                                        disabled={isDownloading}
                                    >
                                        {QUALITY_OPTIONS.map((option) => (
                                            <option key={option.value || 'best'} value={option.value || ''}>
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className='form-group'>
                                    <div className='form-check'>
                                        <input
                                            className='form-check-input'
                                            type='checkbox'
                                            id='post-as-watch'
                                            checked={postAsWatch}
                                            onChange={(e) => {
                                                if (!isAuthenticated) {
                                                    showErrorToast('Please log in to post videos to Watch', {
                                                        title: 'Authentication Required',
                                                        autoClose: 3000,
                                                    });
                                                    return;
                                                }
                                                setPostAsWatch(e.target.checked);
                                            }}
                                            disabled={isDownloading || !isAuthenticated}
                                        />
                                        <label className='form-check-label' htmlFor='post-as-watch' style={{
                                            opacity: !isAuthenticated ? 0.6 : 1,
                                            cursor: !isAuthenticated ? 'not-allowed' : 'pointer',
                                        }}>
                                            <i className='fas fa-video' style={{ marginRight: '8px', color: '#3B82F6' }}></i>
                                            Post as Watch
                                        </label>
                                    </div>
                                    {!isAuthenticated && (
                                        <small className='form-text text-muted' style={{ marginTop: '4px', display: 'block', color: '#ff6b6b' }}>
                                            <i className='fas fa-info-circle' style={{ marginRight: '4px' }}></i>
                                            Please log in to use this feature
                                        </small>
                                    )}
                                    {postAsWatch && isAuthenticated && (
                                        <small className='form-text text-muted' style={{ marginTop: '4px', display: 'block' }}>
                                            When the server finishes downloading, the video will be uploaded to your Watch feed automatically
                                        </small>
                                    )}
                                </div>

                                {isDownloading && (
                                    <div className='download-progress-container'>
                                        <div className='progress-info'>
                                            <span className='progress-stage'>{getStageLabel(downloadStage)}</span>
                                            <span className='progress-percentage'>{downloadProgress}%</span>
                                        </div>
                                        <div className='progress-bar-wrapper'>
                                            <div
                                                className='progress-bar-fill'
                                                style={{ width: `${downloadProgress}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                )}

                                <div className='yt-download-actions'>
                                    {!isDownloading ? (
                                        <button
                                            className='btn btn-primary yt-download-btn'
                                            onClick={handleDownload}
                                            disabled={!youtubeUrl.trim()}
                                        >
                                            <i className='fas fa-download' style={{ marginRight: '8px' }}></i>
                                            Download Video
                                        </button>
                                    ) : (
                                        <button
                                            className='btn btn-secondary yt-cancel-btn'
                                            onClick={handleCancel}
                                        >
                                            <i className='fas fa-times' style={{ marginRight: '8px' }}></i>
                                            Cancel Download
                                        </button>
                                    )}
                                </div>
                            </div>

                            {downloadHistory.length > 0 && (
                                <div className='download-history'>
                                    <h3 className='history-title'>Recent Downloads</h3>
                                    <div className='history-list'>
                                        {downloadHistory.slice(0, 5).map((item) => (
                                            <div key={item.id} className='history-item'>
                                                <div className='history-item-info'>
                                                    <i className='fas fa-video' style={{ marginRight: '10px', color: '#666' }}></i>
                                                    <span className='history-item-name'>{item.fileName}</span>
                                                </div>
                                                <button
                                                    type='button'
                                                    className='btn btn-sm btn-link history-download-link'
                                                    onClick={() => {
                                                        setCompletedDownload({
                                                            fileName: item.fileName,
                                                            fileUrl: item.url,
                                                            title: item.fileName.replace(/\.mp4$/i, ''),
                                                            watchPosted: false,
                                                        });
                                                        setShowDownloadModal(true);
                                                    }}
                                                >
                                                    <i className='fas fa-download'></i>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default YtDownload;
