import React, { useCallback, useEffect, useRef, useState } from 'react';
import ModalContainer from './ModalContainer';
import { downloadFileWithProgress, formatBytes } from '../../utils/downloadFileWithProgress';
import { showErrorToast, showSuccessToast } from '../../utils/toastUtils';
import './VideoDownloadModal.css';

const VideoDownloadModal = ({ isOpen, onClose, downloadInfo, autoStart = true }) => {
    const [copied, setCopied] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [loadedBytes, setLoadedBytes] = useState(0);
    const [totalBytes, setTotalBytes] = useState(0);
    const [downloadDone, setDownloadDone] = useState(false);
    const [downloadError, setDownloadError] = useState('');
    const abortRef = useRef(null);
    const autoStartedForUrl = useRef('');

    const fileName = downloadInfo?.fileName || 'video.mp4';
    const fileUrl = downloadInfo?.fileUrl || '';
    const title = downloadInfo?.title;
    const watchPosted = downloadInfo?.watchPosted;

    const resetDownloadState = useCallback(() => {
        setIsDownloading(false);
        setProgress(0);
        setLoadedBytes(0);
        setTotalBytes(0);
        setDownloadDone(false);
        setDownloadError('');
    }, []);

    const cancelActiveDownload = useCallback(() => {
        if (abortRef.current) {
            abortRef.current.abort();
            abortRef.current = null;
        }
    }, []);

    const startFileDownload = useCallback(async () => {
        if (!fileUrl) return;
        if (abortRef.current) return;

        const controller = new AbortController();
        abortRef.current = controller;

        setIsDownloading(true);
        setDownloadDone(false);
        setDownloadError('');
        setProgress(0);
        setLoadedBytes(0);
        setTotalBytes(0);

        try {
            await downloadFileWithProgress(fileUrl, fileName, {
                signal: controller.signal,
                onProgress: ({ loaded, total, percent }) => {
                    setLoadedBytes(loaded);
                    setTotalBytes(total);
                    setProgress(percent);
                },
            });
            setProgress(100);
            setDownloadDone(true);
            showSuccessToast('Video saved to your device', { title: 'Download Complete', autoClose: 2500 });
        } catch (err) {
            if (err?.name === 'AbortError') {
                setDownloadError('Download cancelled');
            } else {
                // CORS / network failure — fall back to browser navigation download
                try {
                    const a = document.createElement('a');
                    a.href = fileUrl;
                    a.download = fileName || 'video.mp4';
                    a.target = '_blank';
                    a.rel = 'noopener noreferrer';
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    setProgress(100);
                    setDownloadDone(true);
                    setDownloadError('');
                    showSuccessToast('Download started in your browser', { title: 'Download', autoClose: 2500 });
                } catch (_) {
                    const message = err?.message || 'Failed to download video';
                    setDownloadError(message);
                    showErrorToast(message, { title: 'Download Error' });
                }
            }
        } finally {
            setIsDownloading(false);
            abortRef.current = null;
        }
    }, [fileUrl, fileName]);

    // Auto-start device download as soon as the modal opens with a ready file
    useEffect(() => {
        if (!isOpen || !fileUrl || !autoStart) return;
        if (autoStartedForUrl.current === fileUrl) return;
        autoStartedForUrl.current = fileUrl;
        resetDownloadState();
        const t = setTimeout(() => {
            startFileDownload();
        }, 50);
        return () => clearTimeout(t);
        // intentionally only re-run when modal opens / url changes
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, fileUrl, autoStart]);

    useEffect(() => {
        if (!isOpen) {
            cancelActiveDownload();
            autoStartedForUrl.current = '';
            resetDownloadState();
            setCopied(false);
        }
    }, [isOpen, cancelActiveDownload, resetDownloadState]);

    useEffect(() => {
        return () => cancelActiveDownload();
    }, [cancelActiveDownload]);

    const handleCopyLink = async () => {
        try {
            await navigator.clipboard.writeText(fileUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (_) {
            const input = document.createElement('input');
            input.value = fileUrl;
            document.body.appendChild(input);
            input.select();
            document.execCommand('copy');
            document.body.removeChild(input);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleClose = () => {
        cancelActiveDownload();
        onClose?.();
    };

    if (!downloadInfo) return null;

    const sizeLabel = totalBytes > 0
        ? `${formatBytes(loadedBytes)} / ${formatBytes(totalBytes)}`
        : loadedBytes > 0
            ? formatBytes(loadedBytes)
            : '';

    return (
        <ModalContainer
            isOpen={isOpen}
            onRequestClose={handleClose}
            title="Download Ready"
            id="video-download-modal"
        >
            <div className="video-download-modal">
                <div className="video-download-modal-header">
                    <div className={`video-download-icon ${downloadDone ? 'done' : ''} ${isDownloading ? 'downloading' : ''}`}>
                        <i className={`fas ${isDownloading ? 'fa-spinner fa-spin' : downloadDone ? 'fa-check-circle' : 'fa-cloud-download-alt'}`}></i>
                    </div>
                    <h2 className="video-download-modal-title">
                        {isDownloading ? 'Downloading…' : downloadDone ? 'Download Complete' : 'Video Ready'}
                    </h2>
                    <p className="video-download-modal-subtitle">
                        {title || fileName}
                    </p>
                </div>

                {watchPosted && (
                    <div className="video-download-watch-badge">
                        <i className="fas fa-tv" style={{ marginRight: '8px' }}></i>
                        Posted to Watch successfully
                    </div>
                )}

                {(isDownloading || downloadDone || downloadError) && (
                    <div className="video-download-progress-block">
                        <div className="video-download-progress-info">
                            <span>
                                {isDownloading
                                    ? 'Saving to your device…'
                                    : downloadDone
                                        ? 'Saved to your device'
                                        : downloadError}
                            </span>
                            <span>{Math.round(progress)}%</span>
                        </div>
                        <div className="video-download-progress-track">
                            <div
                                className={`video-download-progress-fill ${downloadDone ? 'complete' : ''} ${downloadError ? 'error' : ''}`}
                                style={{ width: `${Math.max(progress, isDownloading ? 2 : 0)}%` }}
                            />
                        </div>
                        {sizeLabel ? (
                            <div className="video-download-progress-size">{sizeLabel}</div>
                        ) : null}
                    </div>
                )}

                <div className="video-download-actions">
                    <button
                        type="button"
                        className="video-download-btn-primary"
                        onClick={startFileDownload}
                        disabled={isDownloading || !fileUrl}
                    >
                        <i className={`fas ${isDownloading ? 'fa-spinner fa-spin' : 'fa-download'}`} style={{ marginRight: '8px' }}></i>
                        {isDownloading ? `Downloading ${Math.round(progress)}%` : downloadDone ? 'Download Again' : 'Download Video'}
                    </button>

                    {isDownloading && (
                        <button
                            type="button"
                            className="video-download-btn-secondary"
                            onClick={cancelActiveDownload}
                        >
                            <i className="fas fa-times" style={{ marginRight: '8px' }}></i>
                            Cancel Download
                        </button>
                    )}

                    <button
                        type="button"
                        className="video-download-btn-secondary"
                        onClick={handleCopyLink}
                        disabled={!fileUrl}
                    >
                        <i className={`fas ${copied ? 'fa-check' : 'fa-link'}`} style={{ marginRight: '8px' }}></i>
                        {copied ? 'Link Copied!' : 'Copy Download Link'}
                    </button>
                </div>

                <div className="video-download-link-box">
                    <label className="video-download-link-label">Download link</label>
                    <input
                        type="text"
                        className="video-download-link-input"
                        value={fileUrl}
                        readOnly
                        onClick={(e) => e.target.select()}
                    />
                </div>

                <button type="button" className="video-download-close-btn" onClick={handleClose}>
                    Close
                </button>
            </div>
        </ModalContainer>
    );
};

export default VideoDownloadModal;
