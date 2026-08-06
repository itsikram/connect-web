import React, { useState } from 'react';
import ModalContainer from './ModalContainer';
import './VideoDownloadModal.css';

const VideoDownloadModal = ({ isOpen, onClose, downloadInfo }) => {
    const [copied, setCopied] = useState(false);

    if (!downloadInfo) return null;

    const { fileName, fileUrl, title, watchPosted } = downloadInfo;

    const handleCopyLink = async () => {
        try {
            await navigator.clipboard.writeText(fileUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (_) {
            // Fallback for older browsers
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

    return (
        <ModalContainer
            isOpen={isOpen}
            onRequestClose={onClose}
            title="Download Ready"
            id="video-download-modal"
        >
            <div className="video-download-modal">
                <div className="video-download-modal-header">
                    <div className="video-download-icon">
                        <i className="fas fa-check-circle"></i>
                    </div>
                    <h2 className="video-download-modal-title">Video Ready</h2>
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

                <div className="video-download-actions">
                    <a
                        href={fileUrl}
                        download={fileName}
                        className="video-download-btn-primary"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        <i className="fas fa-download" style={{ marginRight: '8px' }}></i>
                        Download Video
                    </a>

                    <button
                        type="button"
                        className="video-download-btn-secondary"
                        onClick={handleCopyLink}
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

                <button type="button" className="video-download-close-btn" onClick={onClose}>
                    Close
                </button>
            </div>
        </ModalContainer>
    );
};

export default VideoDownloadModal;
