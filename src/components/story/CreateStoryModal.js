import React, { useState, useEffect, useCallback } from 'react';
import ModalContainer from '../modal/ModalContainer';
import UserPP from '../UserPP';
import api from "../../api/api";
import { fetchProfileHasStoryCached } from "../../utils/requestCache";
import { showErrorToast, showSuccessToast } from '../../utils/toastUtils';

const STORY_INIT = {
    localPreview: '',
    uploadedUrl: '',
    storyBg: '',
    audience: 1,
};

const getAudienceLabel = (audience) => {
    switch (audience) {
        case 1: return 'Public';
        case 2: return 'Friends';
        case 3: return 'Only Me';
        default: return 'Public';
    }
};

const getAudienceIcon = (audience) => {
    switch (audience) {
        case 1: return 'fas fa-globe';
        case 2: return 'fas fa-users';
        case 3: return 'fas fa-lock';
        default: return 'fas fa-globe';
    }
};

const extractStoryGradient = (imageUrl) => new Promise((resolve) => {
    const fallback = 'linear-gradient(135deg, #29B1A9 0%, #6366F1 100%)';
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
        try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
            let r = 0;
            let g = 0;
            let b = 0;
            let count = 0;
            for (let i = 0; i < data.length; i += 4) {
                r += data[i];
                g += data[i + 1];
                b += data[i + 2];
                count += 1;
            }
            r = Math.floor(r / count);
            g = Math.floor(g / count);
            b = Math.floor(b / count);
            resolve(`linear-gradient(135deg, rgb(${r}, ${g}, ${b}) 0%, rgba(${Math.max(0, r - 30)}, ${Math.max(0, g - 30)}, ${Math.max(0, b - 30)}, 0.8) 100%)`);
        } catch (_) {
            resolve(fallback);
        }
    };
    img.onerror = () => resolve(fallback);
    img.src = imageUrl;
});

const CreateStoryModal = ({ isOpen, onRequestClose, profileData, onStoryCreated }) => {
    const [storyData, setStoryData] = useState(STORY_INIT);
    const [isUploading, setIsUploading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showAudienceMenu, setShowAudienceMenu] = useState(false);
    const [uploadError, setUploadError] = useState('');
    const [hasStoryRing, setHasStoryRing] = useState(false);

    const profileId = profileData?._id;
    const profileName = profileData?.user
        ? `${profileData.user.firstName || ''} ${profileData.user.surname || ''}`.trim()
        : profileData?.fullName || 'You';

    const resetModal = useCallback(() => {
        if (storyData.localPreview?.startsWith('blob:')) {
            URL.revokeObjectURL(storyData.localPreview);
        }
        setStoryData(STORY_INIT);
        setShowAudienceMenu(false);
        setUploadError('');
        setIsUploading(false);
        setIsSubmitting(false);
    }, [storyData.localPreview]);

    const handleClose = useCallback(() => {
        resetModal();
        onRequestClose?.();
    }, [onRequestClose, resetModal]);

    useEffect(() => {
        if (!isOpen || !profileId) return;
        fetchProfileHasStoryCached(profileId, { ttlMs: 60000, storageTtlMs: 300000 })
            .then((data) => {
                setHasStoryRing(data?.hasStory === 'yes');
            })
            .catch(() => {});
    }, [isOpen, profileId]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (showAudienceMenu && !event.target.closest('.cpm-audience-selector-wrapper')) {
                setShowAudienceMenu(false);
            }
        };
        if (showAudienceMenu) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showAudienceMenu]);

    const handleAttachmentChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            setUploadError('Please choose an image for your story.');
            return;
        }

        setUploadError('');
        const localPreview = URL.createObjectURL(file);
        setStoryData((prev) => {
            if (prev.localPreview?.startsWith('blob:')) {
                URL.revokeObjectURL(prev.localPreview);
            }
            return { ...prev, localPreview, uploadedUrl: '', storyBg: '' };
        });

        setIsUploading(true);
        try {
            const formData = new FormData();
            formData.append('image', file);
            formData.append('type', file.type || 'image/png');

            const uploadRes = await api.post('/upload/', formData, {
                headers: { 'content-type': 'multipart/form-data' },
            });

            if (uploadRes.status !== 200 || !uploadRes.data?.secure_url) {
                throw new Error('Upload failed');
            }

            const uploadedUrl = uploadRes.data.secure_url;
            const storyBg = await extractStoryGradient(uploadedUrl);

            setStoryData((prev) => ({
                ...prev,
                uploadedUrl,
                storyBg,
            }));
        } catch (err) {
            console.error('Story upload failed:', err);
            setUploadError(err?.response?.data?.message || 'Could not upload image. Please try again.');
            setStoryData((prev) => ({ ...prev, uploadedUrl: '', storyBg: '' }));
        } finally {
            setIsUploading(false);
            e.target.value = '';
        }
    };

    const removeAttachment = () => {
        setStoryData((prev) => {
            if (prev.localPreview?.startsWith('blob:')) {
                URL.revokeObjectURL(prev.localPreview);
            }
            return { ...STORY_INIT, audience: prev.audience };
        });
        setUploadError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!storyData.uploadedUrl || !storyData.storyBg || isUploading || isSubmitting) return;

        setIsSubmitting(true);
        try {
            const res = await api.post('/story/create/', {
                image: storyData.uploadedUrl,
                storyBg: storyData.storyBg,
                audience: storyData.audience,
            });

            if (res.status === 200) {
                showSuccessToast('Story added successfully!', { title: 'Story' });
                window.dispatchEvent(new CustomEvent('story:created'));
                onStoryCreated?.(res.data);
                handleClose();
            }
        } catch (err) {
            console.error('Create story failed:', err);
            showErrorToast(err?.response?.data?.message || 'Could not add story. Please try again.', {
                title: 'Story',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const previewSrc = storyData.localPreview || storyData.uploadedUrl;
    const canSubmit = Boolean(storyData.uploadedUrl && storyData.storyBg) && !isUploading && !isSubmitting;

    return (
        <ModalContainer
            isOpen={isOpen}
            id="create-story-modal"
            onRequestClose={handleClose}
            title="Add to Story"
        >
            <div className="modal-header">
                <div className="modal-title">Add to Story</div>
                <button type="button" onClick={handleClose} className="modal-close-btn" aria-label="Close">
                    <i className="far fa-times" aria-hidden="true" />
                </button>
            </div>
            <div className="modal-body">
                <div className="cp-modal-container">
                    <div className="cpm-header">
                        <div className="cpm-profilePic">
                            <UserPP
                                profilePic={profileData?.profilePic}
                                hasStory={hasStoryRing}
                                profile={profileId}
                            />
                        </div>
                        <div className="cpm-username">
                            <h3>{profileName}</h3>
                        </div>
                        <div className="cpm-audience-selector-wrapper">
                            <button
                                type="button"
                                className="cpm-audience-button"
                                onClick={() => setShowAudienceMenu((prev) => !prev)}
                                aria-expanded={showAudienceMenu}
                                aria-haspopup="true"
                            >
                                <i className={getAudienceIcon(storyData.audience)} aria-hidden="true" />
                                <span>{getAudienceLabel(storyData.audience)}</span>
                                <i className="fas fa-chevron-down" aria-hidden="true" />
                            </button>
                            {showAudienceMenu && (
                                <div className="cpm-audience-menu">
                                    {[
                                        { id: 1, icon: 'fas fa-globe', title: 'Public', desc: 'Anyone can see this story' },
                                        { id: 2, icon: 'fas fa-users', title: 'Friends', desc: 'Only your friends can see this' },
                                        { id: 3, icon: 'fas fa-lock', title: 'Only Me', desc: 'Only you can see this story' },
                                    ].map((opt) => (
                                        <div
                                            key={opt.id}
                                            className={`cpm-audience-option ${storyData.audience === opt.id ? 'active' : ''}`}
                                            onClick={() => {
                                                setStoryData((prev) => ({ ...prev, audience: opt.id }));
                                                setShowAudienceMenu(false);
                                            }}
                                            role="button"
                                            tabIndex={0}
                                        >
                                            <i className={opt.icon} aria-hidden="true" />
                                            <div className="audience-option-content">
                                                <span className="audience-option-title">{opt.title}</span>
                                                <span className="audience-option-desc">{opt.desc}</span>
                                            </div>
                                            {storyData.audience === opt.id && <i className="fas fa-check" aria-hidden="true" />}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <form className="cpm-form" onSubmit={handleSubmit}>
                        <div className="cpm-form-text">
                            <p className="story-modal-hint">
                                Share a photo story. It appears in the story row for 24 hours.
                            </p>
                        </div>

                        <div className="cpm-attachment-control">
                            <div className={`cpm-attachment-preview ${previewSrc ? 'show' : ''}`}>
                                {isUploading && (
                                    <div className="upload-progress">
                                        <div className="upload-spinner" />
                                        <span>Uploading image…</span>
                                    </div>
                                )}
                                {previewSrc && !isUploading && (
                                    <div
                                        className="attachment-preview-wrapper story-preview-wrapper"
                                        style={{ backgroundImage: storyData.storyBg || undefined }}
                                    >
                                        <img src={previewSrc} alt="Story preview" />
                                        <button
                                            type="button"
                                            className="remove-attachment-btn"
                                            onClick={removeAttachment}
                                            aria-label="Remove image"
                                        >
                                            <i className="fas fa-times" aria-hidden="true" />
                                        </button>
                                    </div>
                                )}
                            </div>
                            {!previewSrc && (
                                <div className="cpm-attachment-upload">
                                    <div className="cpm-attachment-upload-overlay">
                                        <span className="plus-icon" />
                                        <span className="overlay-text">Add photo to your story</span>
                                    </div>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleAttachmentChange}
                                        aria-label="Upload story photo"
                                    />
                                </div>
                            )}
                        </div>

                        <div className="cpm-attachment">
                            <span className="cpm-button-text">Add to your story</span>
                            <div className="post-meta-buttons">
                                <label className="attachment-button-file" title="Choose photo">
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleAttachmentChange}
                                        hidden
                                    />
                                </label>
                            </div>
                        </div>

                        {uploadError && (
                            <p className="story-modal-error" role="alert">{uploadError}</p>
                        )}

                        <div className="cpm-submit-section">
                            <div className="cpm-submit-button">
                                <button
                                    type="submit"
                                    className={`cpm-submit-btn ${!canSubmit ? 'disabled' : ''}`}
                                    disabled={!canSubmit}
                                >
                                    {isUploading ? (
                                        <>
                                            <i className="fas fa-spinner fa-spin" aria-hidden="true" />
                                            <span>Uploading…</span>
                                        </>
                                    ) : isSubmitting ? (
                                        <>
                                            <i className="fas fa-spinner fa-spin" aria-hidden="true" />
                                            <span>Sharing…</span>
                                        </>
                                    ) : (
                                        <>
                                            <i className="fas fa-plus-circle" aria-hidden="true" />
                                            <span>Share to story</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        </ModalContainer>
    );
};

export default CreateStoryModal;
