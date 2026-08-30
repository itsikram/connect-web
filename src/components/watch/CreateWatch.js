import React, { Fragment, useState, useEffect, useCallback, useRef } from "react";
import { useSelector } from "react-redux";
import ModalContainer from '../modal/ModalContainer'
import UserPP from "../UserPP";
import $ from 'jquery'
import api from "../../api/api";
import { fetchProfileHasStoryCached } from "../../utils/requestCache";
import { showSuccessToast } from "../../utils/toastUtils";
import WatchCacheManager from "../../utils/watchCacheManager";

const CreateWatch = ({ setWatches = null }) => {
    const profileData = useSelector(state => state.profile)
    const profileId = profileData._id
    const fileInputRef = useRef(null)
    const localPreviewRef = useRef(null)

    const [isWatchModal, setWatchModal] = useState(false)
    const [isUploading, setIsUploading] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [uploadError, setUploadError] = useState('')
    const [hasStory, setHasStory] = useState(false)
    const [localPreview, setLocalPreview] = useState(null)
    const [showAudienceMenu, setShowAudienceMenu] = useState(false)

    const watchDataInit = {
        caption: '',
        videoUrl: null,
        feeling: '',
        audience: 1,
    }
    const [watchData, setWatchData] = useState(watchDataInit)

    useEffect(() => {
        if (!profileId) return;
        fetchProfileHasStoryCached(profileId, { ttlMs: 60000, storageTtlMs: 300000 })
            .then(data => {
                setHasStory(data?.hasStory === 'yes')
            })
            .catch(console.log)
    }, [profileId])

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (showAudienceMenu && !event.target.closest('.cpm-audience-selector-wrapper')) {
                setShowAudienceMenu(false)
            }
        }
        if (showAudienceMenu) document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [showAudienceMenu])

    useEffect(() => {
        localPreviewRef.current = localPreview
    }, [localPreview])

    useEffect(() => {
        return () => {
            if (localPreviewRef.current) URL.revokeObjectURL(localPreviewRef.current)
        }
    }, [])

    const profileName = profileData.user
        ? `${profileData.user.firstName || ''} ${profileData.user.surname || ''}`.trim()
        : (profileData.fullName || 'Friend')
    const textInputPlaceHoder = `Share a Watch video, ${profileName}`

    const getAudienceLabel = (audience) => {
        switch (audience) {
            case 1: return 'Public'
            case 2: return 'Friends'
            case 3: return 'Only Me'
            default: return 'Public'
        }
    }

    const getAudienceIcon = (audience) => {
        switch (audience) {
            case 1: return 'fas fa-globe'
            case 2: return 'fas fa-users'
            case 3: return 'fas fa-lock'
            default: return 'fas fa-globe'
        }
    }

    const revokePreview = () => {
        if (localPreviewRef.current) {
            URL.revokeObjectURL(localPreviewRef.current)
            localPreviewRef.current = null
        }
        setLocalPreview(null)
    }

    const resetForm = () => {
        revokePreview()
        setWatchData(watchDataInit)
        setUploadError('')
        setIsUploading(false)
        setIsSubmitting(false)
        setShowAudienceMenu(false)
        if (fileInputRef.current) fileInputRef.current.value = ''
    }

    const closeCreateWatchModal = () => {
        setWatchModal(false)
        resetForm()
    }

    const handleWatchFieldClick = () => setWatchModal(true)

    const cpmAttachmentControllerToggle = (e) => {
        const thisButton = e.currentTarget
        $(thisButton).parents('.cpm-attachment').siblings('.cpm-attachment-control').slideToggle()
    }

    const handleCaptionField = (e) => {
        const { name, value } = e.target
        setWatchData(state => ({
            ...state,
            [name]: name === 'audience' ? parseInt(value, 10) : value,
        }))
    }

    const clearVideo = () => {
        revokePreview()
        setWatchData(state => ({ ...state, videoUrl: null }))
        setUploadError('')
        if (fileInputRef.current) fileInputRef.current.value = ''
        $('.cpm-attachment-preview').removeClass('show')
        $('.cpm-attachment-upload').show()
    }

    const handleVideoChange = useCallback(async (e) => {
        const file = e.target.files?.[0]
        if (!file) return

        if (!file.type.startsWith('video/')) {
            setUploadError('Please select a valid video file.')
            return
        }

        if (file.size > 200 * 1024 * 1024) {
            setUploadError('Video is too large. Please choose a file under 200MB.')
            return
        }

        setUploadError('')
        const previewUrl = URL.createObjectURL(file)
        if (localPreviewRef.current) URL.revokeObjectURL(localPreviewRef.current)
        localPreviewRef.current = previewUrl
        setLocalPreview(previewUrl)

        $(e.currentTarget).parents('.cpm-attachment-upload').slideUp()
        $(e.currentTarget).parents('.cpm-attachment-upload').siblings('.cpm-attachment-preview').addClass('show').slideDown()

        setIsUploading(true)
        try {
            const videoFormData = new FormData()
            videoFormData.append('attachment', file)
            videoFormData.append('type', file.type || 'video/mp4')

            const uploadResponse = await api.post('/upload/video', videoFormData, {
                headers: { 'content-type': 'multipart/form-data' },
            })

            if (uploadResponse.status === 200 && uploadResponse.data?.secure_url) {
                setWatchData(state => ({
                    ...state,
                    videoUrl: uploadResponse.data.secure_url,
                }))
            } else {
                setUploadError('Video upload failed. Please try again.')
                if (localPreviewRef.current) {
                    URL.revokeObjectURL(localPreviewRef.current)
                    localPreviewRef.current = null
                }
                setLocalPreview(null)
                setWatchData(state => ({ ...state, videoUrl: null }))
                $('.cpm-attachment-preview').removeClass('show')
                $('.cpm-attachment-upload').show()
                if (fileInputRef.current) fileInputRef.current.value = ''
            }
        } catch (error) {
            console.error('Watch video upload error:', error)
            setUploadError(error?.response?.data?.error || 'Video upload failed. Please try again.')
            if (localPreviewRef.current) {
                URL.revokeObjectURL(localPreviewRef.current)
                localPreviewRef.current = null
            }
            setLocalPreview(null)
            setWatchData(state => ({ ...state, videoUrl: null }))
            $('.cpm-attachment-preview').removeClass('show')
            $('.cpm-attachment-upload').show()
            if (fileInputRef.current) fileInputRef.current.value = ''
        } finally {
            setIsUploading(false)
        }
    }, [])

    const handleWatchSubmit = async (e) => {
        e.preventDefault()
        if (isUploading || isSubmitting) return

        if (!watchData.videoUrl) {
            setUploadError('Please upload a video before posting.')
            return
        }

        setIsSubmitting(true)
        setUploadError('')
        try {
            const res = await api.post('/watch/create', {
                caption: watchData.caption || '',
                videoUrl: watchData.videoUrl,
                feeling: watchData.feeling || '',
                audience: watchData.audience || 1,
            })

            if (res.status === 200 || res.status === 201) {
                const created = res.data?.data
                if (typeof setWatches === 'function' && created) {
                    setWatches((prev) => {
                        const list = Array.isArray(prev) ? prev : [];
                        return [created, ...list.filter((item) => item?._id !== created._id)];
                    });
                } else if (created) {
                    WatchCacheManager.prependWatch(profileId, created);
                }
                showSuccessToast('Your Watch was posted successfully')
                setWatchModal(false)
                resetForm()
            } else {
                setUploadError('Could not create Watch. Please try again.')
            }
        } catch (error) {
            console.error('Create watch error:', error)
            setUploadError(error?.response?.data?.message || 'Could not create Watch. Please try again.')
        } finally {
            setIsSubmitting(false)
        }
    }

    const previewSrc = localPreview || watchData.videoUrl
    const canSubmit = Boolean(watchData.videoUrl) && !isUploading && !isSubmitting

    return (
        <Fragment>
            <div className="nf-create-post">
                <div className="top">
                    <div className="profile-pic">
                        <UserPP profilePic={profileData.profilePic} hasStory={hasStory} profile={profileData._id} />
                    </div>
                    <div onClick={handleWatchFieldClick} className="cp-field">
                        <input readOnly placeholder={textInputPlaceHoder} className="cp-input" />
                    </div>
                </div>
                <div className="bottom">
                    <ul onClick={handleWatchFieldClick} className="button-container">
                        <li className="photo-button">
                            <div className="button-icon"></div>
                            <div className="button-text">Upload Video</div>
                        </li>
                        <li className="live-button">
                            <div className="button-icon"></div>
                            <div className="button-text">Create Watch</div>
                        </li>
                    </ul>
                </div>

                {isWatchModal && (
                <ModalContainer
                    isOpen
                    id="create-post-modal"
                    onRequestClose={closeCreateWatchModal}
                    title="Create A Watch"
                >
                    <div className="modal-header">
                        <div className="modal-title">Create a Watch</div>
                        <div onClick={closeCreateWatchModal} className="modal-close-btn" role="button" tabIndex={0}>
                            <i className="far fa-times"></i>
                        </div>
                    </div>
                    <div className="modal-body">
                        <div className="cp-modal-container">
                            <div className="cpm-header">
                                <div className="cpm-profilePic">
                                    <UserPP profilePic={profileData.profilePic} hasStory={hasStory} profile={profileData._id} />
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
                                        <i className={getAudienceIcon(watchData.audience || 1)}></i>
                                        <span>{getAudienceLabel(watchData.audience || 1)}</span>
                                        <i className="fas fa-chevron-down"></i>
                                    </button>
                                    {showAudienceMenu && (
                                        <div className="cpm-audience-menu">
                                            {[
                                                { id: 1, icon: 'fas fa-globe', title: 'Public', desc: 'Anyone can see this Watch' },
                                                { id: 2, icon: 'fas fa-users', title: 'Friends', desc: 'Only your friends can see this' },
                                                { id: 3, icon: 'fas fa-lock', title: 'Only Me', desc: 'Only you can see this Watch' },
                                            ].map(opt => (
                                                <div
                                                    key={opt.id}
                                                    className={`cpm-audience-option ${watchData.audience === opt.id ? 'active' : ''}`}
                                                    onClick={() => {
                                                        setWatchData(s => ({ ...s, audience: opt.id }))
                                                        setShowAudienceMenu(false)
                                                    }}
                                                >
                                                    <i className={opt.icon}></i>
                                                    <div className="audience-option-content">
                                                        <span className="audience-option-title">{opt.title}</span>
                                                        <span className="audience-option-desc">{opt.desc}</span>
                                                    </div>
                                                    {watchData.audience === opt.id && <i className="fas fa-check"></i>}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="cpm-meta-options">
                                <div className="cpm-feelings-container">
                                    <select
                                        name="feeling"
                                        onChange={handleCaptionField}
                                        className="form-control cpm-meta-select"
                                        value={watchData.feeling || ''}
                                    >
                                        <option value="">Select Feelings</option>
                                        <option value="funny">Funny</option>
                                        <option value="lovely">Lovely</option>
                                        <option value="sad">Sad</option>
                                        <option value="excited">Excited</option>
                                    </select>
                                </div>
                            </div>

                            <form className="cpm-form" onSubmit={handleWatchSubmit}>
                                <div className="cpm-form-text">
                                    <textarea
                                        name="caption"
                                        onChange={handleCaptionField}
                                        placeholder={textInputPlaceHoder}
                                        className="cpm-form-text-input"
                                        value={watchData.caption}
                                        rows="4"
                                    />
                                </div>

                                <div className="cpm-attachment-control">
                                    <div className={`cpm-attachment-preview ${previewSrc || isUploading ? 'show' : ''}`}>
                                        {isUploading && (
                                            <div className="upload-progress">
                                                <div className="upload-spinner"></div>
                                                <span>Uploading video…</span>
                                            </div>
                                        )}
                                        {!isUploading && previewSrc && (
                                            <div className="attachment-preview-wrapper">
                                                <video
                                                    style={{ width: '100%', maxHeight: '400px', borderRadius: '8px' }}
                                                    src={previewSrc}
                                                    controls
                                                />
                                                <button
                                                    type="button"
                                                    className="remove-attachment-btn"
                                                    onClick={clearVideo}
                                                    aria-label="Remove video"
                                                >
                                                    <i className="fas fa-times"></i>
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    <div className="cpm-attachment-upload" style={{ display: previewSrc || isUploading ? 'none' : undefined }}>
                                        <div className="cpm-attachment-upload-overlay">
                                            <span className="plus-icon"></span>
                                            <span className="overlay-text">Add a video</span>
                                        </div>
                                        <input
                                            ref={fileInputRef}
                                            onChange={handleVideoChange}
                                            name="video"
                                            type="file"
                                            accept="video/*"
                                        />
                                    </div>
                                </div>

                                {uploadError && (
                                    <p className="text-danger small mb-2" role="alert">{uploadError}</p>
                                )}

                                <div className="cpm-attachment">
                                    <span className="cpm-button-text">Add to your Watch</span>
                                    <div className="post-meta-buttons">
                                        <div
                                            onClick={cpmAttachmentControllerToggle}
                                            className="attachment-button-file"
                                            role="button"
                                            tabIndex={0}
                                            aria-label="Add video"
                                        />
                                    </div>
                                </div>

                                <div className="cpm-submit-section">
                                    <div className="cpm-submit-button">
                                        <button
                                            className={`cpm-submit-btn ${!canSubmit ? 'disabled' : ''}`}
                                            disabled={!canSubmit}
                                            type="submit"
                                        >
                                            {isUploading ? (
                                                <>
                                                    <i className="fas fa-spinner fa-spin"></i>
                                                    <span>Uploading Video…</span>
                                                </>
                                            ) : isSubmitting ? (
                                                <>
                                                    <i className="fas fa-spinner fa-spin"></i>
                                                    <span>Posting…</span>
                                                </>
                                            ) : (
                                                <>
                                                    <i className="fas fa-paper-plane"></i>
                                                    <span>Post to Watch</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </form>
                        </div>
                    </div>
                </ModalContainer>
                )}
            </div>
        </Fragment>
    )
}

export default CreateWatch;
