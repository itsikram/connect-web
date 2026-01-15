import React, { Fragment, useState, useEffect, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import ModalContainer from '../modal/ModalContainer'
import UserPP from "../UserPP";
import $, { post } from 'jquery'
import api from "../../api/api";
import { addPost } from "../../services/actions/postActions";

const loadingImgUrl = 'https://res.cloudinary.com/dz88yjerw/image/upload/v1743092084/i5lcu63atrbkpcy6oqam.gif'

let CreatePost = ({ setPosts = null }) => {
    let profileData = useSelector(state => state.profile)
    let profileId = profileData._id

    let dispatch = useDispatch()


    // setting visibilty state for post modal container
    let [isPostModal, setPostModal] = useState(false)
    let [isUploading, setIsUploading] = useState(false)
    let [isSubmitting, setIsSubmitting] = useState(false)

    let handleCpFieldClick = (e) => {
        setPostModal(true)
    }
    let closeCreatePostModal = () => {
        setPostModal(false)
        setPostData(postDataInit)
        setShowAudienceMenu(false)
    }

    const getAudienceLabel = (audience) => {
        switch(audience) {
            case 1: return 'Public'
            case 2: return 'Friends'
            case 3: return 'Only Me'
            default: return 'Only Me'
        }
    }

    const getAudienceIcon = (audience) => {
        switch(audience) {
            case 1: return 'fas fa-globe'
            case 2: return 'fas fa-users'
            case 3: return 'fas fa-lock'
            default: return 'fas fa-lock'
        }
    }

    const handleAudienceSelect = (audience) => {
        setPostData(state => ({
            ...state,
            audience: parseInt(audience, 10)
        }))
        setShowAudienceMenu(false)
    }

    const postDataInit = {
        caption: '',
        attachments: null,
        urls: null,
        location: '',
        feelings: '',
        audience: 3 // Default: Only Me
    }

    let [postData, setPostData] = useState(postDataInit)
    let [attachmentType, setAttachmentType] = useState(false)
    const [showAudienceMenu, setShowAudienceMenu] = useState(false)

    const [hasStory, setHasStory] = useState(false);

    useEffect(() => {
        api.get('/profile/hasStory', {
            params: {
                profileId
            }
        }).then(res => {
            if (res.status == 200) {
                let storyStatus = res.data.hasStory

                if (storyStatus == 'yes') {
                    setHasStory(true)

                }
                if (storyStatus == 'no') {
                    setHasStory(false)
                }

            }
        })

    }, [postData])

    // Close audience menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (showAudienceMenu && !event.target.closest('.cpm-audience-selector-wrapper')) {
                setShowAudienceMenu(false)
            }
        }

        if (showAudienceMenu) {
            document.addEventListener('mousedown', handleClickOutside)
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [showAudienceMenu])


    const useMediaQuery = (query) => {
        const [matches, setMatches] = useState(window.matchMedia(query).matches);

        useEffect(() => {
            const media = window.matchMedia(query);
            const listener = (e) => setMatches(e.matches);
            media.addEventListener("change", listener);
            return () => media.removeEventListener("change", listener);
        }, [query]);

        return matches;
    };

    var isMobile = useMediaQuery("(max-width: 768px)");


    let profileName = profileData.user && profileData.user.firstName + ' ' + profileData.user.surname || ''


    let textInputPlaceHoder = "What's On Your Mind " + profileName + "?"


    // handling attachment button toggle

    let cpmAttachmentControllerToggle = (e) => {
        let thisButton = e.currentTarget
        $(thisButton).parents('.cpm-attachment').siblings('.cpm-attachment-control').slideToggle()

    }

    // handle caption field change 
    let handleCaptionField = useCallback((e) => {
        let value = e.target.value
        let name = e.target.name

        if (attachmentType == false && name == 'caption') {
            setAttachmentType('caption')
        }

        // Convert audience to number if it's the audience field
        if (name === 'audience') {
            value = parseInt(value, 10)
        }

        setPostData(state => {
            return {
                ...state,
                [name]: value,
            }
        })


    }, [postData])

    // handle photo field update

    let handleAttachmentChange = useCallback((e) => {
        let currentTarget = e.currentTarget
        setPostData({ ...postData, urls: loadingImgUrl })
        $(currentTarget).parents('.cpm-attachment-upload').slideUp()
        $(currentTarget).parents('.cpm-attachment-upload').siblings('.cpm-attachment-preview').addClass('show').slideDown()
        let attachments = e.target.files[0];
        handleUploadAttachment(attachments.type, attachments)

    }, [postData])

    // handling post submit 

    let preventDefault = (e) => {
        e.preventDefault()
    }

    let handleUploadAttachment = async (type, attachment) => {
        setIsUploading(true)
        try {

            let fileType = type.split('/')[0]
            setAttachmentType(fileType)

            switch (fileType) {

                case 'image':
                    let imageFormData = new FormData();

                    imageFormData.append('image', attachment);
                    imageFormData.append('type', 'image/png');

                    let uploadImageRes = await api.post('/upload/', imageFormData, {
                        headers: {
                            'content-type': 'multipart/form-data'
                        }
                    })
                    if (uploadImageRes.status == 200) {
                        setIsUploading(false)
                        var uploadedImageUrl = uploadImageRes.data.secure_url;
                        setPostData(state => {
                            return {
                                ...state,
                                urls: uploadedImageUrl,
                                type: fileType,
                            }
                        })
                        $('.cpm-attachment-preview').addClass('show')
                    }

                    break;
                case 'video':
                    let watchUploadFormData = new FormData();
                    watchUploadFormData.append('attachment', attachment);
                    watchUploadFormData.append('type', 'video/mp4');

                    let uploadWatchRes = await api.post('/upload/video', watchUploadFormData, {
                        headers: {
                            'content-type': 'multipart/form-data'
                        }
                    })

                    if (uploadWatchRes.status == 200) {
                        var uploadedWatchUrl = uploadWatchRes.data.secure_url;
                        setIsUploading(false)
                        setPostData(state => {
                            return {
                                ...state,
                                type: fileType,
                                urls: uploadedWatchUrl
                            }
                        })
                        $('.cpm-attachment-preview').addClass('show')

                    }
                    break;
            }

        } catch (error) {
            console.log('Error uploading attachment:', error)
            setIsUploading(false)
        }

    }

    let handlePostSubmit = useCallback(async (e) => {
        e.preventDefault()
        setIsSubmitting(true)

        try {
            switch (postData.type) {

                case 'image':
                    e.target.classList.add('added')
                    let postFormData = new FormData()
                    postFormData.append('caption', postData.caption)
                    postFormData.append('photos', postData.urls)
                    postFormData.append('feelings', postData.feelings)
                    postFormData.append('location', postData.location)
                    postFormData.append('audience', postData.audience || 3)

                    let res = await api.post('/post/create/', postFormData, {
                        headers: {
                            'content-type': 'multipart/form-data'
                        }
                    })

                    if (res.status === 200) {
                        dispatch(addPost(res.data.post))
                        setPostData(postDataInit)
                        setAttachmentType(false)
                        if (setPosts) {
                            setPosts(posts => [res.data.post, ...posts])
                        }
                        setPostModal(false)
                    }

                    break;
                case 'video':
                    e.target.classList.add('added')
                    let videoPostFormData = new FormData()
                    videoPostFormData.append('caption', postData.caption)
                    videoPostFormData.append('photos', postData.urls)
                    videoPostFormData.append('feelings', postData.feelings)
                    videoPostFormData.append('location', postData.location)
                    videoPostFormData.append('audience', postData.audience || 3)

                    let videoRes = await api.post('/post/create/', videoPostFormData, {
                        headers: {
                            'content-type': 'multipart/form-data'
                        }
                    })

                    if (videoRes.status === 200) {
                        setPostData(postDataInit)
                        setAttachmentType(false)
                        dispatch(addPost(videoRes.data.post))
                        if (setPosts) {
                            setPosts(posts => [videoRes.data.post, ...posts])
                        }
                        setPostModal(false)
                    }
                    break;

                default:

                    let defaultFormData = new FormData()
                    defaultFormData.append('caption', postData.caption)
                    defaultFormData.append('photos', postData.urls)
                    defaultFormData.append('feelings', postData.feelings)
                    defaultFormData.append('location', postData.location)
                    defaultFormData.append('audience', postData.audience || 3)

                    let defaultRes = await api.post('/post/create/', defaultFormData, {
                        headers: {
                            'content-type': 'multipart/form-data'
                        }
                    })

                    if (defaultRes.status === 200) {
                        setPostData(postDataInit)
                        setAttachmentType(false)
                        dispatch(addPost(defaultRes.data.post))
                        if (setPosts) {
                            setPosts(posts => [defaultRes.data.post, ...posts])
                        }
                        setPostModal(false)
                    }

                    break;
            }





        } catch (error) {
            console.log('Error creating post:', error)
            // You might want to show an error message to the user here
        } finally {
            setIsSubmitting(false)
        }

    }, [postData])



    return (
        <Fragment>
            <div className="nf-create-post">
                <div className="top">
                    <div className="profile-pic">
                        <UserPP profilePic={profileData.profilePic} hasStory={hasStory} profile={profileData._id}></UserPP>
                    </div>
                    <div onClick={handleCpFieldClick} className="cp-field">
                        <input readOnly placeholder={textInputPlaceHoder} className="cp-input" />
                    </div>
                </div>
                <div className="bottom">
                    <ul onClick={handleCpFieldClick} className="button-container">
                        <li className="photo-button">
                            <div className="button-icon"></div>
                            <div className="button-text">Photo/video</div>

                        </li>
                        <li className="live-button">
                            <div className="button-icon"></div>
                            <div className="button-text">Live Video</div>

                        </li>
                    </ul>
                </div>
                <ModalContainer
                    isOpen={isPostModal}
                    id="create-post-modal"
                    onRequestClose={closeCreatePostModal}
                    title="Create A Post"
                    style={{ width: isMobile ? '95%' : '600px' }}
                >
                    <div className="modal-header">
                        <div className="modal-title">
                            Create a Post
                        </div>
                        <div onClick={closeCreatePostModal} className="modal-close-btn">
                            <i className="far fa-times"></i>
                        </div>
                    </div>
                    <div className="modal-body">
                        <div className="cp-modal-container">
                            <div className="cpm-header">
                                <div className="cpm-profilePic">
                                    <UserPP profilePic={profileData.profilePic} hasStory={hasStory} profile={profileData._id}></UserPP>
                                </div>
                                <div className="cpm-username">
                                    <h3>{profileName}</h3>
                                </div>
                                <div className="cpm-audience-selector-wrapper">
                                    <button 
                                        type="button"
                                        className="cpm-audience-button"
                                        onClick={() => setShowAudienceMenu(!showAudienceMenu)}
                                    >
                                        <i className={getAudienceIcon(postData.audience || 3)}></i>
                                        <span>{getAudienceLabel(postData.audience || 3)}</span>
                                        <i className="fas fa-chevron-down"></i>
                                    </button>
                                    {showAudienceMenu && (
                                        <div className="cpm-audience-menu">
                                            <div 
                                                className={`cpm-audience-option ${postData.audience === 1 ? 'active' : ''}`}
                                                onClick={() => handleAudienceSelect(1)}
                                            >
                                                <i className="fas fa-globe"></i>
                                                <div className="audience-option-content">
                                                    <span className="audience-option-title">Public</span>
                                                    <span className="audience-option-desc">Anyone can see this post</span>
                                                </div>
                                                {postData.audience === 1 && <i className="fas fa-check"></i>}
                                            </div>
                                            <div 
                                                className={`cpm-audience-option ${postData.audience === 2 ? 'active' : ''}`}
                                                onClick={() => handleAudienceSelect(2)}
                                            >
                                                <i className="fas fa-users"></i>
                                                <div className="audience-option-content">
                                                    <span className="audience-option-title">Friends</span>
                                                    <span className="audience-option-desc">Only your friends can see this</span>
                                                </div>
                                                {postData.audience === 2 && <i className="fas fa-check"></i>}
                                            </div>
                                            <div 
                                                className={`cpm-audience-option ${postData.audience === 3 ? 'active' : ''}`}
                                                onClick={() => handleAudienceSelect(3)}
                                            >
                                                <i className="fas fa-lock"></i>
                                                <div className="audience-option-content">
                                                    <span className="audience-option-title">Only Me</span>
                                                    <span className="audience-option-desc">Only you can see this post</span>
                                                </div>
                                                {postData.audience === 3 && <i className="fas fa-check"></i>}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="cpm-meta-options">
                                <div className="cpm-feelings-container">
                                    <select name="feelings" onChange={handleCaptionField.bind(this)} className="form-control cpm-meta-select">
                                        <option value='0'>Select Feelings</option>
                                        <option value='funny'>Funny</option>
                                        <option value='lovely'>Lovely</option>
                                        <option value='sad'>Sad</option>
                                    </select>
                                </div>
                                <div className="cpm-location-container">
                                    <input 
                                        type="text" 
                                        name="location" 
                                        onChange={handleCaptionField} 
                                        className="form-control cpm-meta-input" 
                                        placeholder="Add location..." 
                                        value={postData.location}
                                    />
                                </div>
                            </div>
                            <form className="cpm-form" onSubmit={preventDefault}>
                                <div className="cpm-form-text">
                                    <textarea 
                                        name="caption" 
                                        onChange={handleCaptionField} 
                                        placeholder={textInputPlaceHoder} 
                                        className="cpm-form-text-input" 
                                        value={postData.caption}
                                        rows="4"
                                    ></textarea>
                                </div>
                                <div className="cpm-attachment-control">
                                    <div className="cpm-attachment-preview">
                                        {isUploading && (
                                            <div className="upload-progress">
                                                <div className="upload-spinner"></div>
                                                <span>Uploading media...</span>
                                            </div>
                                        )}
                                        {postData.type === 'video' && !isUploading && (
                                            <div className="attachment-preview-wrapper">
                                                <video style={{width: '100%', maxHeight: '400px', borderRadius: '8px'}} src={postData.urls} controls></video>
                                                <button 
                                                    type="button" 
                                                    className="remove-attachment-btn"
                                                    onClick={() => {
                                                        setPostData(state => ({ ...state, urls: null, type: null }))
                                                        setAttachmentType(false)
                                                        $('.cpm-attachment-preview').removeClass('show').slideUp()
                                                        $('.cpm-attachment-upload').slideDown()
                                                    }}
                                                >
                                                    <i className="fas fa-times"></i>
                                                </button>
                                            </div>
                                        )}
                                        {postData.type === 'image' && !isUploading && postData.urls && (
                                            <div className="attachment-preview-wrapper">
                                                <img src={postData.urls} alt="attachment preview" />
                                                <button 
                                                    type="button" 
                                                    className="remove-attachment-btn"
                                                    onClick={() => {
                                                        setPostData(state => ({ ...state, urls: null, type: null }))
                                                        setAttachmentType(false)
                                                    }}
                                                >
                                                    <i className="fas fa-times"></i>
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    <div className="cpm-attachment-upload">
                                        <div className="cpm-attachment-upload-overlay">
                                            <span className="plus-icon"></span>
                                            <span className="overlay-text">Add Photos/Videos</span>
                                        </div>
                                        <input 
                                            onChange={handleAttachmentChange} 
                                            name="photos_vidoes" 
                                            type="file" 
                                            accept="image/*,video/*"
                                        ></input>
                                    </div>
                                </div>
                                <div className="cpm-attachment">
                                    <span className="cpm-button-text">Add to your post</span>

                                    <div className="post-meta-buttons">
                                        <div onClick={cpmAttachmentControllerToggle} className="attachment-button-file">

                                        </div>
                                    </div>

                                </div>
                                <div className="cpm-submit-section">
                                    <div className="cpm-submit-button">
                                        <button 
                                            onClick={handlePostSubmit.bind(this)} 
                                            className={`cpm-submit-btn ${isSubmitting || isUploading ? 'disabled' : ''}`} 
                                            disabled={isUploading || isSubmitting} 
                                            type="submit"
                                        >  
                                            {isUploading ? (
                                                <>
                                                    <i className="fas fa-spinner fa-spin"></i>
                                                    <span>Uploading Media...</span>
                                                </>
                                            ) : isSubmitting ? (
                                                <>
                                                    <i className="fas fa-spinner fa-spin"></i>
                                                    <span>Posting...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <i className="fas fa-paper-plane"></i>
                                                    <span>Post</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </form>
                        </div>
                    </div>
                </ModalContainer>
            </div>
        </Fragment>
    )
}

export default CreatePost;