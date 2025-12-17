import React, { useState, useRef, useEffect } from 'react';
import { showSuccessToast, showErrorToast, showInfoToast } from '../utils/toastUtils';
import axios from 'axios';
import api from '../api/api';
import { getYtDownloadApiUrl, isOffline } from '../utils/offlineUtils';
import { useAuth } from '../hooks/useAuth';
import './YtDownload.css';

// Get YouTube download API URL with offline fallback
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
    const [isPostingWatch, setIsPostingWatch] = useState(false);
    
    const progressPollIntervalRef = useRef(null);
    const statusPollIntervalRef = useRef(null);

    // Cleanup intervals on unmount
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

    const buildDownloadUrl = (url, height) => {
        try {
            // Check if offline and show appropriate message
            if (isOffline()) {
                showErrorToast('YouTube download is not available offline. Please connect to the internet.', {
                    title: 'Offline Mode'
                });
                return null;
            }
            
            const normalized = (url || '').replace('m.youtube.com', 'www.youtube.com');
            const encoded = encodeURIComponent(normalized);
            const heightParam = height ? `&height=${height}` : '';
            const apiUrl = getYTDownloadAPI();
            return `${apiUrl}/download?url=${encoded}&ext=mp4${heightParam}&disposition=inline&link_only=true&async_job=true`;
        } catch (e) {
            console.error('Error building download URL:', e);
            return null;
        }
    };

    const pollProgress = async (progressUrl) => {
        if (progressPollIntervalRef.current) {
            clearInterval(progressPollIntervalRef.current);
        }

        progressPollIntervalRef.current = setInterval(async () => {
            try {
                const response = await axios.get(progressUrl, {
                    headers: { Accept: 'application/json' },
                    params: { _ts: Date.now() } // Prevent caching
                });

                const data = response.data;
                const status = data?.status;
                const stage = data?.stage || '';
                const pct = data?.pct || 0;
                const fileUrl = data?.file_url;
                const title = data?.title || data?.download_title || videoTitle;

                // Store title if available
                if (title && title !== videoTitle) {
                    setVideoTitle(title);
                }

                setDownloadProgress(Math.round(pct));
                setDownloadStage(stage);
                setDownloadStatus(status);

                if (status === 'completed' && typeof fileUrl === 'string' && /(\.mp4)(\b|\?|$)/i.test(fileUrl)) {
                    // Stop polling
                    if (progressPollIntervalRef.current) {
                        clearInterval(progressPollIntervalRef.current);
                        progressPollIntervalRef.current = null;
                    }

                    // Extract filename from URL if title not available
                    const finalTitle = title || extractFileNameFromUrl(fileUrl) || 'video';
                    
                    // Download the file
                    downloadFile(fileUrl, finalTitle);
                } else if (status === 'failed' || status === 'error') {
                    // Stop polling on error
                    if (progressPollIntervalRef.current) {
                        clearInterval(progressPollIntervalRef.current);
                        progressPollIntervalRef.current = null;
                    }
                    setIsDownloading(false);
                    setDownloadStatus('failed');
                    showErrorToast('Download failed. Please try again.', { title: 'Download Error' });
                }
            } catch (err) {
                console.error('Progress poll error:', err);
                // Continue polling on network errors
            }
        }, 2000);
    };

    const pollInitialStatus = async (requestUrl) => {
        if (statusPollIntervalRef.current) {
            clearInterval(statusPollIntervalRef.current);
        }

        let attempts = 0;
        const maxAttempts = 10;

        statusPollIntervalRef.current = setInterval(async () => {
            attempts++;
            try {
                const response = await axios.get(requestUrl, {
                    headers: { Accept: 'application/json' },
                    params: { _ts: Date.now() }
                });

                const json = response.data;
                const title = json?.title || json?.download_title;
                
                // Store title if available
                if (title) {
                    setVideoTitle(title);
                }
                
                if (json && json.status === 'accepted' && typeof json.progress_url === 'string' && json.progress_url.length > 0) {
                    // Stop status polling
                    if (statusPollIntervalRef.current) {
                        clearInterval(statusPollIntervalRef.current);
                        statusPollIntervalRef.current = null;
                    }

                    // Start progress polling
                    pollProgress(json.progress_url);
                } else if (json && json.status === 'completed' && json.file_url) {
                    // Direct completion (synchronous)
                    if (statusPollIntervalRef.current) {
                        clearInterval(statusPollIntervalRef.current);
                        statusPollIntervalRef.current = null;
                    }
                    
                    // Extract filename from URL if title not available
                    const finalTitle = title || extractFileNameFromUrl(json.file_url) || 'video';
                    downloadFile(json.file_url, finalTitle);
                }
            } catch (err) {
                console.error('Status poll error:', err);
                if (attempts >= maxAttempts) {
                    if (statusPollIntervalRef.current) {
                        clearInterval(statusPollIntervalRef.current);
                        statusPollIntervalRef.current = null;
                    }
                    setIsDownloading(false);
                    showErrorToast('Failed to start download. Please try again.', { title: 'Download Error' });
                }
            }
        }, 800);
    };

    const postVideoAsWatch = async (blob, fileName) => {
        try {
            // Check authentication before attempting to post
            if (!token || !isAuthenticated) {
                showErrorToast('Please log in to post videos to Watch. Video will be downloaded only.', { 
                    title: 'Authentication Required',
                    autoClose: 5000
                });
                return false;
            }

            setIsPostingWatch(true);
            showInfoToast('Uploading video to Watch...', { title: 'Posting', autoClose: 3000 });

            // Step 1: Upload video file to /upload/video endpoint
            // Use extended timeout for video uploads (5 minutes = 300000ms)
            const videoFormData = new FormData();
            const videoFile = new File([blob], `${sanitizeFileName(fileName)}.mp4`, { type: 'video/mp4' });
            videoFormData.append('attachment', videoFile);

            // Don't set Content-Type explicitly - axios will set it automatically with boundary for FormData
            // Override timeout to 5 minutes for large video uploads
            const uploadResponse = await api.post('/upload/video', videoFormData, {
                timeout: 300000 // 5 minutes for video upload
            });

            if (uploadResponse.status !== 200 || !uploadResponse.data?.secure_url) {
                throw new Error('Video upload failed');
            }

            // Step 2: Get the secure_url from upload response
            const videoUrl = uploadResponse.data.secure_url;

            // Step 3: Create watch with videoUrl and caption
            const watchFormData = new FormData();
            watchFormData.append('caption', videoTitle || fileName);
            watchFormData.append('videoUrl', videoUrl);

            // Don't set Content-Type explicitly - axios will set it automatically with boundary for FormData
            // Use standard timeout for watch creation (should be quick)
            const createWatchResponse = await api.post('/watch/create', watchFormData, {
                timeout: 30000 // 30 seconds for watch creation
            });

            if (createWatchResponse.status === 200 || createWatchResponse.status === 201) {
                showSuccessToast('Video posted to Watch successfully!', { title: 'Posted to Watch' });
                return true;
            } else {
                throw new Error('Watch creation failed');
            }
        } catch (error) {
            console.error('Error posting video to watch:', error);
            
            // Handle authentication errors specifically
            if (error.response?.status === 401) {
                showErrorToast('Please log in to post videos to Watch. Video downloaded successfully.', { 
                    title: 'Authentication Required',
                    autoClose: 5000
                });
            } else if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
                // Handle timeout errors specifically
                showErrorToast('Video upload timed out. The video file may be too large or your connection is slow. Video downloaded successfully.', { 
                    title: 'Upload Timeout',
                    autoClose: 6000
                });
            } else {
                const errorMessage = error.response?.data?.error || error.response?.data?.message || error.message || 'Unknown error';
                showErrorToast(`Failed to post video to Watch: ${errorMessage}. Video downloaded successfully.`, { 
                    title: 'Watch Post Error',
                    autoClose: 5000
                });
            }
            return false;
        } finally {
            setIsPostingWatch(false);
        }
    };

    const downloadFile = async (fileUrl, fileName) => {
        try {
            showInfoToast('Preparing download...', { title: 'Download', autoClose: 2000 });
            
            // Fetch the file as a blob to ensure automatic download works
            const response = await fetch(fileUrl, {
                method: 'GET',
                headers: {
                    'Accept': 'video/mp4, video/*, */*'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // Get the blob
            const blob = await response.blob();
            
            // Add to download history immediately so it shows up in the history section
            const downloadItem = {
                id: Date.now(),
                fileName: `${sanitizeFileName(fileName)}.mp4`,
                url: fileUrl,
                timestamp: new Date().toISOString(),
            };
            setDownloadHistory(prev => [downloadItem, ...prev]);
            
            // Post to watch if checkbox is checked and user is authenticated
            if (postAsWatch && isAuthenticated) {
                await postVideoAsWatch(blob, fileName);
            } else if (postAsWatch && !isAuthenticated) {
                // User checked the box but is no longer authenticated
                showErrorToast('Please log in to post videos to Watch. Video downloaded successfully.', { 
                    title: 'Authentication Required',
                    autoClose: 3000
                });
                setPostAsWatch(false); // Uncheck the box
            }
            
            // Create a blob URL
            const blobUrl = window.URL.createObjectURL(blob);
            
            // Create a temporary anchor element to trigger automatic download
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = `${sanitizeFileName(fileName)}.mp4`;
            link.style.display = 'none';
            
            // Append to body, click, and remove
            document.body.appendChild(link);
            link.click();
            
            // Clean up
            setTimeout(() => {
                document.body.removeChild(link);
                window.URL.revokeObjectURL(blobUrl);
            }, 100);

            setIsDownloading(false);
            setDownloadProgress(100);
            setDownloadStage('completed');
            setDownloadStatus('completed');
            setCurrentDownload(null);

            const successMessage = postAsWatch 
                ? 'Video downloaded and posted to Watch successfully!' 
                : 'Video downloaded successfully!';
            showSuccessToast(successMessage, { title: 'Download Complete' });

            // Reset after 3 seconds
            setTimeout(() => {
                setDownloadProgress(0);
                setDownloadStage('');
                setDownloadStatus('');
            }, 3000);
        } catch (err) {
            console.error('Download error:', err);
            
            // Fallback: try direct link download if blob method fails
            try {
                const link = document.createElement('a');
                link.href = fileUrl;
                link.download = `${sanitizeFileName(fileName)}.mp4`;
                link.target = '_blank';
                link.style.display = 'none';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                // Still add to history and show success
                const downloadItem = {
                    id: Date.now(),
                    fileName: `${sanitizeFileName(fileName)}.mp4`,
                    url: fileUrl,
                    timestamp: new Date().toISOString(),
                };
                setDownloadHistory(prev => [downloadItem, ...prev]);
                
                setIsDownloading(false);
                setDownloadProgress(100);
                setDownloadStage('completed');
                setDownloadStatus('completed');
                setCurrentDownload(null);
                
                showSuccessToast('Video download started!', { title: 'Download Started' });
            } catch (fallbackErr) {
                console.error('Fallback download error:', fallbackErr);
                setIsDownloading(false);
                setDownloadStatus('failed');
                showErrorToast('Failed to download file. Please try again.', { title: 'Download Error' });
            }
        }
    };

    const extractFileNameFromUrl = (url) => {
        try {
            if (!url) return null;
            const urlObj = new URL(url);
            let path = urlObj.pathname || '';
            if (path.endsWith('/')) path = path.replace(/\/+$/, '');
            let filename = path.split('/').pop() || '';
            try { 
                filename = decodeURIComponent(filename); 
            } catch (_) {}
            
            // Remove .mp4 extension if present (we'll add it back)
            filename = filename.replace(/\.mp4$/i, '');
            
            // If filename is empty or just extension, return null
            if (!filename || filename.length < 3) return null;
            
            return filename;
        } catch (e) {
            console.error('Error extracting filename from URL:', e);
            return null;
        }
    };

    const sanitizeFileName = (name) => {
        if (!name || name === 'video') return 'video';
        // Remove any file extension first
        let cleanName = name.replace(/\.[^/.]+$/, '');
        // Replace underscores with spaces
        cleanName = cleanName.replace(/_/g, ' ');
        // Sanitize and limit length (allow spaces, dots, and hyphens)
        cleanName = cleanName.replace(/[^a-zA-Z0-9. -]+/g, '-').replace(/^-+|-+$/g, '').replace(/\s+/g, ' ').trim();
        // Limit to 100 characters
        return cleanName.substring(0, 100) || 'video';
    };

    const validateYouTubeUrl = (url) => {
        if (!url) return false;
        const patterns = [
            /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\/.+/i,
            /^https?:\/\/m\.youtube\.com\/.+/i,
        ];
        return patterns.some(pattern => pattern.test(url));
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

        setIsDownloading(true);
        setDownloadProgress(0);
        setDownloadStage('starting');
        setDownloadStatus('running');
        setVideoTitle(''); // Reset title for new download
        setCurrentDownload({
            url: youtubeUrl,
            quality: selectedQuality,
            startTime: new Date().toISOString(),
        });

        showInfoToast('Preparing download...', { title: 'Download', autoClose: 3000 });

        const requestUrl = buildDownloadUrl(youtubeUrl, selectedQuality);
        if (!requestUrl) {
            setIsDownloading(false);
            showErrorToast('Failed to build download URL', { title: 'Error' });
            return;
        }

        // Start polling for initial status
        pollInitialStatus(requestUrl);
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
            downloading: 'Downloading...',
            transcoding: 'Processing...',
            completed: 'Completed',
            failed: 'Failed',
        };
        return labels[stage] || stage || 'Preparing...';
    };

    return (
        <div className='yt-download-page'>
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
                                        onChange={(e) => setSelectedQuality(e.target.value ? parseInt(e.target.value) : null)}
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
                                                        autoClose: 3000
                                                    });
                                                    return;
                                                }
                                                setPostAsWatch(e.target.checked);
                                            }}
                                            disabled={isDownloading || isPostingWatch || !isAuthenticated}
                                        />
                                        <label className='form-check-label' htmlFor='post-as-watch' style={{ 
                                            opacity: !isAuthenticated ? 0.6 : 1,
                                            cursor: !isAuthenticated ? 'not-allowed' : 'pointer'
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
                                            The downloaded video will be automatically posted to your Watch feed
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
                                    {!isDownloading && !isPostingWatch ? (
                                        <button
                                            className='btn btn-primary yt-download-btn'
                                            onClick={handleDownload}
                                            disabled={!youtubeUrl.trim()}
                                        >
                                            <i className='fas fa-download' style={{ marginRight: '8px' }}></i>
                                            Download Video
                                        </button>
                                    ) : isPostingWatch ? (
                                        <button
                                            className='btn btn-primary yt-download-btn'
                                            disabled
                                        >
                                            <i className='fas fa-spinner fa-spin' style={{ marginRight: '8px' }}></i>
                                            Posting to Watch...
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
                                                <a
                                                    href={item.url}
                                                    download={item.fileName}
                                                    className='btn btn-sm btn-link history-download-link'
                                                    target='_blank'
                                                    rel='noopener noreferrer'
                                                >
                                                    <i className='fas fa-download'></i>
                                                </a>
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
