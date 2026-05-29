import React, { Fragment, useState, useEffect } from "react";
import { useSelector } from "react-redux";
import ModalContainer from '../modal/ModalContainer'
import UserPP from "../UserPP";
import $ from 'jquery'
import api from "../../api/api";

let CreateWatch = ({ setWatches = null }) => {
    let profileData = useSelector(state => state.profile)
    let profileId = profileData._id

    let [isWatchModal, setWatchModal] = useState(false)
    let [isUploading, setIsUploading] = useState(false)
    let [isSubmitting, setIsSubmitting] = useState(false)

    let handleWatchFieldClick = () => {
        setWatchModal(true)
    }
    let closeCreateWatchModal = () => {
        setWatchModal(false)
    }

    let [watchData, setWatchData] = useState({
        caption: '',
        video: null,
        videoUrl: null
    })

    const [hasStory, setHasStory] = useState(false);

    useEffect(() => {
        if (!profileId) return;
        api.get('/profile/hasStory', {
            params: {
                profileId
            }
        }).then(res => {
            if (res.status == 200) {
                let storyStatus = res.data.hasStory
                setHasStory(storyStatus === 'yes')
            }
        }).catch(console.log)
    }, [profileId])


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


    let profileName = profileData.user && profileData.user.firstName + ' ' + profileData.user.surname
    let textInputPlaceHoder = "Share a caption for your Watch video, " + profileName + ""


    // handling attachment button toggle

    let cpmAttachmentControllerToggle = (e) => {
        let thisButton = e.currentTarget
        $(thisButton).parents('.cpm-attachment').siblings('.cpm-attachment-control').slideToggle()

    }

    // handle caption field change 
    let handleCaptionField = (e) => {
        let value = e.target.value
        let name = e.target.name

        setWatchData(state => ({
            ...state,
            [name]: value,
        }))
    }

    let handleVideoChange = (e) => {
        let currentTarget = e.currentTarget
        $(currentTarget).parents('.cpm-attachment-upload').slideUp()
        $(currentTarget).parents('.cpm-attachment-upload').siblings('.cpm-attachment-preview').slideDown()

        let file = e.target.files[0]
        if (!file) return;
        let url = URL.createObjectURL(file)

        setWatchData(state => ({
            ...state,
            video: file,
            videoUrl: url
        }))
    }

    // handling post submit 

    let preventDefault = (e) => {
        e.preventDefault()
    }
    let handleWatchSubmit = async (e) => {
        e.preventDefault()
        setIsSubmitting(true)
        setIsUploading(true)
        try {
            if (!watchData.video) {
                console.warn('No video selected for Watch post')
                return
            }

            const videoFormData = new FormData();
            videoFormData.append('attachment', watchData.video);

            const uploadResponse = await api.post('/upload/video', videoFormData, {
                headers: {
                    'content-type': 'multipart/form-data'
                }
            })

            if (uploadResponse.status === 200 && uploadResponse.data?.secure_url) {
                const watchFormData = new FormData();
                watchFormData.append('caption', watchData.caption)
                watchFormData.append('videoUrl', uploadResponse.data.secure_url)

                const res = await api.post('/watch/create', watchFormData, {
                    headers: {
                        'content-type': 'multipart/form-data'
                    }
                })

                if (res.status === 200 || res.status === 201) {
                    const createdWatch = res.data?.data;
                    if (setWatches && createdWatch) {
                        const normalizedWatch = {
                            ...createdWatch,
                            author: typeof createdWatch.author === 'object' ? createdWatch.author : {
                                _id: profileData._id,
                                user: profileData.user,
                                profilePic: profileData.profilePic,
                                isActive: profileData.isActive,
                            },
                            comments: createdWatch.comments || [],
                            reacts: createdWatch.reacts || [],
                            shares: createdWatch.shares || [],
                        }
                        setWatches(state => [normalizedWatch, ...state])
                    }
                    setWatchModal(false)
                    setWatchData({ caption: '', video: null, videoUrl: null })
                }
            }
        } catch (error) {
            console.log(error)
        } finally {
            setIsSubmitting(false)
            setIsUploading(false)
        }
    }


    return (
        <Fragment>
            <div className="nf-create-post">
                <div className="top">
                    <div className="profile-pic">
                        <UserPP profilePic={profileData.profilePic} hasStory={hasStory} profile={profileData._id}></UserPP>
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
                <ModalContainer
                    isOpen={isWatchModal}
                    id="create-watch-modal"
                    onRequestClose={closeCreateWatchModal}
                    title="Create A Watch"
                    style={{ width: isMobile ? '95%' : '600px' }}
                >
                    <div className="modal-header">
                        <div className="modal-title">
                            Create a Watch
                        </div>
                        <div onClick={closeCreateWatchModal} className="modal-close-btn">
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
                            </div>
                            <form className="cpm-form" onSubmit={preventDefault}>
                                <div className="cpm-form-text">
                                    <textarea name="caption" onChange={handleCaptionField} placeholder={textInputPlaceHoder} className="cpm-form-text-input" value={watchData.caption} rows="4"></textarea>
                                </div>
                                <div className="cpm-attachment-control">
                                    <div className="cpm-attachment-preview">
                                        {watchData.videoUrl ? (
                                            <video controls className="w-100" src={watchData.videoUrl}></video>
                                        ) : (
                                            <div className="attachment-placeholder">Select a video to preview</div>
                                        )}
                                    </div>
                                    <div className="cpm-attachment-upload">
                                        <div className="cpm-attachment-upload-overlay">
                                            <span className="plus-icon"></span>
                                            <span className="overlay-text">Add a video</span>
                                        </div>
                                        <input onChange={handleVideoChange} name="video" type="file" accept="video/*"></input>
                                    </div>
                                </div>
                                <div className="cpm-submit-button">
                                    <button 
                                        onClick={handleWatchSubmit} 
                                        className={`cpm-submit-btn ${isSubmitting ? 'disabled' : ''}`} 
                                        type="submit"
                                        disabled={isUploading || isSubmitting}
                                    > 
                                        {isUploading ? (
                                            <>
                                                <i className="fas fa-spinner fa-spin"></i>
                                                <span>Uploading...</span>
                                            </>
                                        ) : isSubmitting ? (
                                            <>
                                                <i className="fas fa-spinner fa-spin"></i>
                                                <span>Posting...</span>
                                            </>
                                        ) : (
                                            <>
                                                <i className="fas fa-paper-plane"></i>
                                                <span>Post to Watch</span>
                                            </>
                                        )} 
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </ModalContainer>
            </div>
        </Fragment>
    )
}

export default CreateWatch;