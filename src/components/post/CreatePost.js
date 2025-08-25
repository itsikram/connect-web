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

    let handleCpFieldClick = (e) => {
        setPostModal(true)
    }
    let closeCreatePostModal = () => {
        setPostModal(false)
    }

    const postDataInit = {
        caption: '',
        attachments: null,
        urls: null,
        location: '',
        feelings: ''
    }

    let [postData, setPostData] = useState(postDataInit)
    let [attachmentType, setAttachmentType] = useState(false)

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
        $(currentTarget).parents('.cpm-attachment-upload').siblings('.cpm-attachment-preview').slideDown()
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

                    }
                    break;
            }

        } catch (error) {
            console.log(error)
        }

    }

    let handlePostSubmit = useCallback(async (e) => {
        e.preventDefault()
        setPostModal(false)

        try {
            switch (postData.type) {

                case 'image':
                    e.target.classList.add('added')
                    let postFormData = new FormData()
                    postFormData.append('caption', postData.caption)
                    postFormData.append('urls', postData.urls)
                    postFormData.append('feelings', postData.feelings)
                    postFormData.append('location', postData.location)

                    let res = await api.post('/post/create/', postFormData, {
                        headers: {
                            'content-type': 'multipart/form-data'
                        }
                    })

                    if (res.status === 200) {

                        dispatch(addPost(res.data.post))
                        setPostData(postDataInit)
                        if (setPosts) {
                            setPosts(posts => [res.data.post, ...posts])
                        }
                        setPostModal(false)
                    }

                    break;
                case 'video':
                    e.target.classList.add('added')

                    let watchRes = await api.post('/watch/create', { caption: postData.caption, videoUrl: postData.urls, location: postData.location, feelings: postData.feelings }, {
                        headers: {
                            'content-type': 'multipart/form-data'
                        }
                    })

                    if (watchRes.status === 200) {
                        setPostData(postDataInit)
                        dispatch(addPost(defaultRes.data.post))

                        setPostModal(false)
                    }
                    break;

                default:

                    let defaultFormData = new FormData()
                    defaultFormData.append('caption', postData.caption)
                    defaultFormData.append('urls', postData.urls)
                    defaultFormData.append('feelings', postData.feelings)
                    defaultFormData.append('location', postData.location)

                    let defaultRes = await api.post('/post/create/', defaultFormData, {
                        headers: {
                            'content-type': 'multipart/form-data'
                        }
                    })

                    if (defaultRes.status === 200) {
                        setPostData(postDataInit)
                        dispatch(addPost(defaultRes.data.post))
                        if (setPosts) {
                            setPosts(posts => [defaultRes.data.post, ...posts])
                        }
                        setPostModal(false)
                    }

                    break;
            }





        } catch (error) {
            console.log(error)
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
                                <div className="cpm-feelings-container ml-2">
                                    <select name="feelings" onChange={handleCaptionField.bind(this)} className="form-control">
                                        <option value='0'>
                                            Select Feelings
                                        </option>
                                        <option value='funny'>
                                            Funny
                                        </option>
                                        <option value='lovely'>
                                            Lovely
                                        </option>
                                        <option value='sad'>
                                            Sad
                                        </option>
                                    </select>
                                </div>
                                <div className="cpm-location-container">
                                    <input type="text" name="location" onChange={handleCaptionField} className="form-control" placeholder="Location...." />
                                </div>
                            </div>
                            <form className="cpm-form" onSubmit={preventDefault}>
                                <div className="cpm-form-text">
                                    <textarea name="caption" onChange={handleCaptionField} placeholder={textInputPlaceHoder} className="cpm-form-text-input" value={postData.caption}>

                                    </textarea>
                                </div>
                                <div className="cpm-attachment-control">
                                    <div className="cpm-attachment-preview">
                                        {
                                            postData.type === 'video' && <video style={{width: '100%'}} src={postData.urls}></video>
                                        }

                                        {postData.type === 'image' && <img src={postData.urls && postData.urls} alt="attachment preview" />
                                        }
                                    </div>
                                    <div className="cpm-attachment-upload">
                                        <div className="cpm-attachment-upload-overlay">
                                            <span className="plus-icon">

                                            </span>
                                            <span className="overlay-text">
                                                Add Photos/Videos
                                            </span>
                                        </div>
                                        <input onChange={handleAttachmentChange} name="photos_vidoes" type="file"></input>
                                    </div>
                                </div>
                                <div className="cpm-attachment">
                                    <span className="cpm-button-text">Add to your post</span>

                                    <div className="post-meta-buttons">
                                        <div onClick={cpmAttachmentControllerToggle} className="attachment-button-file">

                                        </div>
                                    </div>

                                </div>
                                <div className="cpm-submit-button">
                                    <button onClick={handlePostSubmit.bind(this)} className="button" disabled={isUploading} type="submit">  {(isUploading == true ? 'Media Uploading....' : 'Post Now')}  </button>
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