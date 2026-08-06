import React, { useState, useRef, useEffect } from 'react';
import { showSuccessToast, showErrorToast, showInfoToast } from '../utils/toastUtils';
import axios from 'axios';
import { getYtDownloadApiUrl, isOffline, normalizeServerUrl } from '../utils/offlineUtils';
import { saveVideoFromUrl } from '../utils/useSavedVideos';
import { useAuth } from '../hooks/useAuth';
import VideoDownloadModal from '../components/modal/VideoDownloadModal';
import './YtDownload.css';

const getYTDownloadAPI = () => normalizeServerUrl(getYtDownloadApiUrl());

const toSecureProgressUrl = (url) => normalizeServerUrl(String(url || '').split('?')[0]);

const resolveProgressUrl = (json) => {
    const apiBase = getYTDownloadAPI();
    if (json?.progress_id) {
        return `${apiBase}/progress/${json.progress_id}`;
    }
    if (typeof json?.progress_url === 'string' && json.progress_url.length > 0) {
        return toSecureProgressUrl(json.progress_url);
    }
    return null;
};

const QUALITY_OPTIONS = [
    { label: 'Best — up to 4K + HQ audio', value: 2160 },
    { label: '1440p + HQ audio', value: 1440 },
    { label: '1080p Full HD + HQ audio', value: 1080 },
    { label: '720p', value: 720 },
    { label: '480p', value: 480 },
    { label: '360p', value: 360 },
    { label: '240p', value: 240 },
];

const YtDownload = () => {
    const { isAuthenticated, token } = useAuth();
    const [youtubeUrl, setYoutubeUrl] = useState('');
    const [selectedQuality, setSelectedQuality] = useState(2160);
    const [postAsWatch, setPostAsWatch] = useState(true);
    const [isDownloading, setIsDownloading] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState(0);
    const [downloadStage, setDownloadStage] = useState('');
    const [downloadStatus, setDownloadStatus] = useState('');
    const [currentDownload, setCurrentDownload] = useState(null);
    const [downloadHistory, setDownloadHistory] = useState([]);
    const [videoTitle, setVideoTitle] = useState('');
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

    const buildDownloadUrl = (url, height, shouldPostAsWatch = true) => {
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
            const watchParam = `&post_as_watch=${shouldPostAsWatch ? 'true' : 'false'}`;
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

    const extractYouTubeVideoId = (url) => {
        try {
            const normalized = String(url || '').replace('m.youtube.com', 'www.youtube.com');
            const u = new URL(normalized);
            if (u.hostname.includes('youtu.be')) {
                return u.pathname.replace(/^\//, '').split('/')[0] || null;
            }
            const fromQuery = u.searchParams.get('v');
            if (fromQuery) return fromQuery;
            const shortsMatch = u.pathname.match(/\/shorts\/([^/?]+)/);
            return shortsMatch ? shortsMatch[1] : null;
        } catch (_) {
            return null;
        }
    };

    const handleDownloadComplete = (fileUrl, title, watchPosted, watchId) => {
        const finalTitle = title || extractFileNameFromUrl(fileUrl) || 'video';
        const fileName = `${sanitizeFileName(finalTitle)}.mp4`;
        const sourceUrl = currentDownload?.url || youtubeUrl;
        const ytVideoId = extractYouTubeVideoId(sourceUrl);
        const saveId = watchId || (ytVideoId ? `yt-${ytVideoId}` : `yt-${Date.now()}`);

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

        const savedMetadata = {
            _id: saveId,
            caption: finalTitle,
            thumbnail: ytVideoId ? `https://i.ytimg.com/vi/${ytVideoId}/hqdefault.jpg` : '',
            source: 'youtube',
            youtubeUrl: sourceUrl,
        };

        saveVideoFromUrl(saveId, fileUrl, savedMetadata).catch((err) => {
            console.error('Failed to save to Saved Videos:', err);
        });

        if (watchPosted) {
            showSuccessToast('Video posted to your Watch feed with HQ audio.', {
                title: 'Posted to Watch',
                autoClose: 5000,
            });
        } else {
            showSuccessToast('Video downloaded and saved to Saved Videos.', {
                title: 'Download complete',
                autoClose: 4000,
            });
        }

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

        const secureProgressUrl = toSecureProgressUrl(progressUrl);
        let pollFailures = 0;

        const fetchProgressOnce = async () => {
            try {
                const response = await fetch(`${secureProgressUrl}?_ts=${Date.now()}`, {
                    method: 'GET',
                    headers: getAuthHeaders(),
                    cache: 'no-store',
                    mode: 'cors',
                    credentials: 'omit',
                });

                if (!response.ok) {
                    throw new Error(`Progress HTTP ${response.status}`);
                }

                pollFailures = 0;

                const data = await response.json();
                const status = data?.status;
                const stage = data?.stage || '';
                const pct = Number(data?.pct) || 0;
                const fileUrl = data?.file_url;
                const title = data?.title || data?.download_title || videoTitle;
                const watchPosted = data?.watch_posted;
                const watchId = data?.watch_id;

                if (title && title !== videoTitle) {
                    setVideoTitle(title);
                }

                setDownloadProgress((prev) => Math.max(prev, Math.round(pct)));
                setDownloadStage(stage || 'downloading');
                setDownloadStatus(status);

                if (status === 'completed' && typeof fileUrl === 'string' && fileUrl.length > 0) {
                    if (progressPollIntervalRef.current) {
                        clearInterval(progressPollIntervalRef.current);
                        progressPollIntervalRef.current = null;
                    }
                    handleDownloadComplete(fileUrl, title, watchPosted, watchId);
                    return true;
                }

                if (status === 'failed' || status === 'error') {
                    if (progressPollIntervalRef.current) {
                        clearInterval(progressPollIntervalRef.current);
                        progressPollIntervalRef.current = null;
                    }
                    setIsDownloading(false);
                    setDownloadStatus('failed');
                    const raw = data?.error || 'Download failed. Please try again.';
                    const friendly = /format is not available|no video formats/i.test(raw)
                        ? 'Download failed. Please try again in a moment.'
                        : raw;
                    showErrorToast(friendly, { title: 'Download Error' });
                    return true;
                }
            } catch (err) {
                pollFailures += 1;
                const errLabel = err?.message || String(err);
                console.error('Progress poll error:', errLabel);

                if (pollFailures === 8) {
                    showInfoToast('Still preparing your video on the server…', {
                        title: 'Download in progress',
                        autoClose: 4000,
                    });
                }

                if (pollFailures >= 120) {
                    if (progressPollIntervalRef.current) {
                        clearInterval(progressPollIntervalRef.current);
                        progressPollIntervalRef.current = null;
                    }
                    setIsDownloading(false);
                    setDownloadStatus('failed');
                    showErrorToast(
                        'Lost connection to download progress. The video may still finish — check Watch or try again.',
                        { title: 'Progress unavailable' }
                    );
                    return true;
                }
            }
            return false;
        };

        // Immediate first poll so progress shows right away
        fetchProgressOnce();
        progressPollIntervalRef.current = setInterval(fetchProgressOnce, 800);
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

            if (json && json.status === 'accepted') {
                const progressUrl = resolveProgressUrl(json);
                if (progressUrl) {
                    setDownloadProgress(5);
                    setDownloadStage('starting');
                    pollProgress(progressUrl);
                    return;
                }
            }

            if (json && json.status === 'completed' && json.file_url) {
                const finalTitle = title || extractFileNameFromUrl(json.file_url) || 'video';
                handleDownloadComplete(json.file_url, finalTitle, json.watch_posted, json.watch_id);
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

        if (!isAuthenticated) {
            showErrorToast('Please log in to download and post videos to Watch', { title: 'Authentication Required' });
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

        showInfoToast(
            postAsWatch ? 'Downloading and posting to Watch...' : 'Downloading video...',
            { title: 'Download', autoClose: 3000 }
        );

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
            preparing: 'Preparing video on home server...',
            downloading: 'Downloading on server...',
            uploading: 'Uploading to Cloudinary...',
            uploading_watch: 'Posting to Watch...',
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
                            <p className='yt-download-subtitle'>
                                Download merged high-quality video with HQ audio, or post directly to Watch
                            </p>

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
                                    <div className='form-check' style={{ opacity: 0.95 }}>
                                        <input
                                            className='form-check-input'
                                            type='checkbox'
                                            id='post-as-watch'
                                            checked={postAsWatch}
                                            disabled={isDownloading || !isAuthenticated}
                                            onChange={(e) => setPostAsWatch(e.target.checked)}
                                        />
                                        <label className='form-check-label' htmlFor='post-as-watch'>
                                            <i className='fas fa-video' style={{ marginRight: '8px', color: '#3B82F6' }}></i>
                                            Post as Watch
                                        </label>
                                    </div>
                                    <small className='form-text text-muted' style={{ marginTop: '4px', display: 'block' }}>
                                        {!isAuthenticated
                                            ? 'Please log in to download and post to Watch.'
                                            : postAsWatch
                                                ? 'HQ video + audio is uploaded to Cloudinary and posted to Watch. Caption = YouTube title.'
                                                : 'HQ video is saved to Saved Videos only (not posted to Watch).'}
                                    </small>
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
                                            {postAsWatch ? 'Download & Post to Watch' : 'Download Video'}
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
