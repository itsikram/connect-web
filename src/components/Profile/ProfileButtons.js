import React, { Fragment, useState, useEffect } from 'react';
import api from '../../api/api';
import $ from 'jquery'
import { useSelector } from 'react-redux';
import { useNavigate } from "react-router-dom";
import ModalContainer from "../modal/ModalContainer";
import UserPP from '../UserPP';
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


const ProfileButtons = (props) => {
    const navigate = useNavigate();
    let myProfile = useSelector(state => state.profile)
    let profileData = props.profileData
    let isAuth = props.isAuth
    let isFriend = props.isFriend
    let isReqSent = profileData.friendReqs && profileData.friendReqs.includes(myProfile._id)
    let isReqRecived = myProfile.friendReqs && myProfile.friendReqs.includes(profileData._id)
    let isReq = isReqSent || isReqRecived
    let [isStoryModal, setIsStoryModal] = useState(false);
    let [isStoryUploading, setIsStoryUploading] = useState(false);
    let [storyBgColors, setStoryBgColors] = useState(false);
    let [isDisabled, setDisabled] = useState(true);
    let [storyData, setStoryData] = useState({
        photo: null,
        uploadedUrl: false,
    });
    
    let isMobile = useMediaQuery("(max-width: 768px)");
    let profileName = profileData.user && profileData.user.firstName + ' ' + profileData.user.surname
    let textInputPlaceHoder = "What's On Your Mind " + profileName + " ?"

    useEffect(() =>{
        setDisabled(true);
    },[isDisabled])


    // handle add friend button click 
    let clickAddFriendBtn = (e) => {
        let target = e.currentTarget

        if (!$(target).hasClass('sent')) {
            api.post('/friend/sendRequest/', {
                profile: profileData._id
            }).then(res => {
                $(target).children('span').text('Request Sent')
                $(target).addClass('sent')

            }).catch(e => {
                console.log(e)
            })
        }


    }
    // handle click friend button 
    let clickFriendBtn = (e) => {

        let target = e.currentTarget
        $(target).children('.friend-options-menu').toggleClass('hide')

    }
    // handle click message button 
    let clickMessageBtn = (e) => {
        navigate(`/message/${profileData._id}`)
    }
    // handle cencel friend request
    let handleCencleReq = async (e) => {
        try {

            let target = e.currentTarget

            if (!$(target).hasClass('removed')) {
                let res = await api.post('/friend/removeRequest', { profile: profileData._id })
                $(target).addClass('removed')
                $(target).children('span').text('Request Cenceled')
            }



        } catch (error) {
            console.log(error)
        }
    }
    // handle confirm friend request
    let handleConfirmReq = async (e) => {
        try {
            let target = e.currentTarget
            if (!$(target).hasClass('accepted')) {

                let res = await api.post('/friend/reqAccept', { profile: profileData._id })
                $(target).children('span').text('Accepted')
                $(target).addClass('Friend Accepted')

            }


        } catch (error) {
            console.log(error)
        }
    }
    // handle click unfrind button
    let clickUnFrndBtn = async (e) => {
        try {
            let target = e.currentTarget

            let res = api.post('/friend/removeFriend', { profile: profileData._id })


            $(target).parents('.friend').hide()

        } catch (error) {
            console.log(error)
        }
    }

    let closeAddStoryModal = () => {
        setIsStoryModal(false)
    }
    let handleAddStory = async () => {
        setIsStoryModal(true)

    }
    let handleStorySubmit = async (e) => {
        e.preventDefault()
        setIsStoryModal(false)
        if(e.target.classList.containers('added') ) return;
        if(storyData.uploadedUrl != false && storyBgColors != false) {
            try {
                e.target.classList.add('added')
                let res = await api.post('/story/create/', {image: storyData.uploadedUrl,storyBg: storyBgColors})
                if (res.status === 200) {
                    setIsStoryModal(false)
                }
    
            } catch (error) {
                console.log(error)
            }
        }

    }

    let handlePhotosChange = async (e) => {
        let currentTarget = e.currentTarget
        
        let photos = e.target.files;
        var url = URL.createObjectURL(photos[0])

        setStoryData(state => {
            return {
                ...state,
                photo: photos[0],
                url
            }
        })

        $(currentTarget).parents('.cpm-attachment-upload').slideUp()
        $(currentTarget).parents('.cpm-attachment-upload').siblings('.cpm-attachment-preview').slideDown()

        let uploadImageFormData = new FormData();
        uploadImageFormData.append('image', photos[0]);

        setIsStoryUploading(true)
        let uploadImageRes = await api.post('/upload/', uploadImageFormData, {
            headers: {
                'content-type': 'multipart/form-data'
            }
        })
        if(uploadImageRes.status == 200) {
            let uploadedImageUrl = uploadImageRes.data.secure_url;
            if( uploadedImageUrl) {
                const storyImg = new Image();
                storyImg.crossOrigin = "Anonymous"; // Allow cross-origin image processing
                storyImg.src = uploadedImageUrl;
    
                storyImg.onload = () => {
                    const canvas = document.createElement("canvas");
                    const ctx = canvas.getContext("2d");
    
                    canvas.width = storyImg.width;
                    canvas.height = storyImg.height;
                    ctx.drawImage(storyImg, 0, 0, canvas.width, canvas.height);
    
                    let data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
                    let r = 0, g = 0, b = 0, count = 0;
    
                    for (let i = 0; i < data.length; i += 4) {
                        r += data[i];     // Red
                        g += data[i + 1]; // Green
                        b += data[i + 2]; // Blue
                        count++;
                    }
    
                    r = Math.floor(r / count);
                    g = Math.floor(g / count);
                    b = Math.floor(b / count);
    
                    // Generate linear gradient
                    const gradient = `linear-gradient(135deg, rgb(${r}, ${g}, ${b}) 0%, rgba(${r - 30}, ${g - 30}, ${b - 30}, 0.8) 100%)`;
                    setStoryBgColors(gradient);
                };


                setIsStoryUploading(false)
                setDisabled(false);
                setStoryData(state => {
                    return {
                       ...state,
                        uploadedUrl: uploadedImageUrl,
                        bgColors: storyBgColors
                    }
                })


            }


        }


    }


    let cpmAttachmentControllerToggle = (e) => {
        let thisButton = e.currentTarget
        $(thisButton).parents('.cpm-attachment').siblings('.cpm-attachment-control').slideToggle()
    }
    let preventDefault = (e) => {
        e.preventDefault()
    }

    return (
        <Fragment>
            {
                isAuth ?
                    <div className="profile-buttons">
                        <div className="highligh-btn button add-story" onClick={handleAddStory}>
                            <i className="fas fa-plus-circle"></i>
                            <span>
                                Add to story
                            </span>

                        </div>
                        <ModalContainer
                                isOpen={isStoryModal}
                                id="create-post-modal"
                                onRequestClose={closeAddStoryModal}
                                title="Create A Post"
                                style={{ width: isMobile ? '95%' : '600px' }}
                            >
                                <div className="modal-header">
                                    <div className="modal-title">
                                        Add to Story
                                    </div>
                                    <div onClick={closeAddStoryModal.bind(this)} className="modal-close-btn">
                                        <i className="far fa-times"></i>
                                    </div>
                                </div>
                                <div className="modal-body">
                                    <div className="cp-modal-container">
                                        <div className="cpm-header">
                                            <div className="cpm-profilePic">
                                                <UserPP profilePic={profileData.profilePic} profile={profileData._id}></UserPP>
                                            </div>
                                            <div className="cpm-username">
                                                <h3>{profileName}</h3>
                                            </div>
                                        </div>
                                        <form className="cpm-form" onSubmit={preventDefault}>

                                            <div className="cpm-attachment-control">
                                                <div className="cpm-attachment-preview">
                                                    <img src={storyData.url || ''} alt="attachment preview"/>
                                                </div>
                                                <div className="cpm-attachment-upload">
                                                    <div className="cpm-attachment-upload-overlay">
                                                        <span className="plus-icon">

                                                        </span>
                                                        <span className="overlay-text">
                                                            Add Photos/Videos
                                                        </span>
                                                    </div>
                                                    <input onChange={handlePhotosChange.bind(this)} name="photos" type="file"></input>
                                                </div>
                                            </div>
                                            <div className="cpm-attachment">
                                                <span className="cpm-button-text">Add Image to your story</span>

                                                <div className="post-meta-buttons">
                                                    <div onClick={cpmAttachmentControllerToggle} className="attachment-button-file">

                                                    </div>
                                                </div>

                                            </div>
                                            <div className="cpm-submit-button">
                                            <button className='button' onClick={handleStorySubmit.bind(this)} type="submit" > { isStoryUploading ? "Uploading ... " : "Add to your story" }</button>

                                            </div>
                                        </form>
                                    </div>
                                </div>
                            </ModalContainer>
                        <div onClick={() => navigate('/settings')} className="normal-btn button edit-profile">
                            <i className="fas fa-pen"></i>
                            <span>
                                Edit Profile
                            </span>
                        </div>
                    </div>
                    :
                    isFriend ?
                        <div className="profile-buttons">
                            <div onClick={clickFriendBtn} className="button normal-btn  friend">
                                <i className="fas fa-user-check"></i>
                                <span>
                                    Friend
                                </span>
                                <div className='friend-options-menu hide'>
                                    <div onClick={clickUnFrndBtn} className='friend-options-menu-item'>
                                        <div className='menu-item-icon'>
                                            <i className="fas fa-user-times"></i>
                                        </div>
                                        <div className='menu-item-text'>Remove Friend</div>
                                    </div>
                                </div>
                            </div>
                            <div onClick={clickMessageBtn} className="highligh-btn button message-button">
                                <i className="fas fa-comment-dots"></i>
                                <span>
                                    Message
                                </span>
                            </div>
                        </div>
                        :
                        !isReq ?
                            <div className="profile-buttons">
                                <div onClick={clickAddFriendBtn} className="highligh-btn button add-friend">
                                    <i className="fas fa-user-check"></i>
                                    <span>
                                        Add Friend
                                    </span>
                                </div>
                                <div onClick={clickMessageBtn} className="normal-btn button message-button">
                                    <i className="fas fa-comment-dots"></i>
                                    <span>
                                        Message
                                    </span>
                                </div>
                            </div>

                            : isReqSent ?


                                <div className="profile-buttons">
                                    <div onClick={handleCencleReq} className="normal-btn button cencel-friend">
                                        <i className="fas fa-user-check"></i>
                                        <span>
                                            Cencel Request
                                        </span>
                                    </div>
                                    <div onClick={clickMessageBtn} className="highligh-btn button message-button">
                                        <i className="fas fa-comment-dots"></i>
                                        <span>
                                            Message
                                        </span>
                                    </div>
                                </div>
                                :

                                <div className="profile-buttons">
                                    <div onClick={handleConfirmReq} className="highligh-btn button confirm-friend">
                                        <i className="fas fa-user-check"></i>
                                        <span>
                                            Confirm Request
                                        </span>
                                    </div>
                                    <div onClick={clickMessageBtn} className="normal-btn button message-button">
                                        <i className="fas fa-comment-dots"></i>
                                        <span>
                                            Message
                                        </span>
                                    </div>
                                </div>

            }
        </Fragment>
    );
}

export default ProfileButtons;
