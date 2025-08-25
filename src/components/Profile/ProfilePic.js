import React, { Fragment, useState, useEffect } from "react";
import ModalContainer from "../modal/ModalContainer";
import AvatarEditor from "react-avatar-editor";
import api from "../../api/api";
import { useSelector } from "react-redux";
import { useParams } from "react-router-dom"
import ImageSkleton from "../../skletons/post/ImageSkleton";
import checkImgLoading from "../../utils/checkImgLoading";
import isValidUrl from "../../utils/isValiUrl";
import PpSkleton from "../../skletons/profile/PpSkleton";
const defaultPpSrc = 'https://programmerikram.com/wp-content/uploads/2025/03/default-profilePic.png';

let ProfilePic = ({ profileData }) => {
    let { profile } = useParams()

    let myProfileData = useSelector(state => state.profile)
    // handle profile pic upload

    const [isPPModal, setIsPPModal] = useState(false)
    const [isPPViewModal, setIsPPViewModal] = useState(false)
    const [profileImage, setProfileimage] = useState()
    const [ppUrl, setPpUrl] = useState(profileData.profilePic)
    const [isPpLoaded, setIsPpLoaded] = useState(profileData.profilePic);
    const [hasStory, setHasStory] = useState(false);
    const [ppCaption, setPpCaption] = useState('');
    useEffect(() => {
        api.get('/profile/hasStory?profileId=' + profile).then(res => {
            if (res.status == 200) {
                setHasStory(res.data.hasStory)
            }
        })

    }, [profile])

    useEffect(() => {
        if(profileData) {
        setPpUrl(isValidUrl(profileData.profilePic) ? profileData.profilePic : '')

        }else {
            setPpUrl(defaultPpSrc)
        }
    },[profileData])

    useEffect(e => {
          ppUrl && checkImgLoading(ppUrl, setIsPpLoaded)
    }, [ppUrl])


    // handle profile pic editors
    let profilePicEditor = ''

    const setEditorRef = (ed) => {
        profilePicEditor = ed;
    }


    let PPuploadBtnClick = (e) => {
        setIsPPModal(true)

    }

    let closePPModal = () => {
        setIsPPModal(false)
    }


    let PPContainerClick = () => {
        setIsPPViewModal(true)
    }

    let closePPViewModal = (e) => {
        setIsPPViewModal(false);
    }

    let handleppTextareChange = (e) => {
        setPpCaption(e.target.value)
    }


    let handlePPUploadSubmit = async (e) => {
        e.preventDefault()
        setIsPPModal(false)
        try {


            profilePicEditor.getImageScaledToCanvas().toBlob(async (Blob) => {
                let profilePicFile = new File([Blob], `${profileData._id}.png`, {
                    type: Blob.type,
                    lastModified: new Date().getTime()

                })
                // return console.log('profilePicFile',profilePicFile)

                let ppFormData = new FormData();
                ppFormData.append('image', profilePicFile)

                let uplaodPPRes = await api.post('/upload', ppFormData, {
                    headers: {
                        'Content-Type': 'multipart/form-data'
                    }
                })

                if (uplaodPPRes.status === 200) {

                    let profilePicUrl = uplaodPPRes.data.secure_url;
                    let PPostFormData = new FormData()
                    PPostFormData.append('profilePicUrl', profilePicUrl)
                    PPostFormData.append('type', 'profilePic')
                    PPostFormData.append('caption', ppCaption)

                    let res = await api.post('/profile/update/profilePic', PPostFormData, {
                        headers: {
                            'Content-Type': 'multipart/form-data'
                        }
                    })
                    if (res.status === 200) {
                        window.location.reload()
                    }

                }

            })



        } catch (error) {
            console.log(error)
        }



    }

    let ppInputChange = (e) => {
        setProfileimage(e.target.files[0])
    }

    let isAuth = myProfileData._id === profileData._id
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

    var PPViewModalTitleStyles = {
        fontSize: isMobile ? '18px' : '30px',
    }

    return (
        <Fragment>
            <div className="profile-pic">

                {/* <SkeletonCard /> */}


                <div className={`profilePic-container ${hasStory == 'yes' ? 'has-story' : ''}`} onClick={PPContainerClick}>
                { isPpLoaded ? <img src={ppUrl} alt="" /> : <ImageSkleton  /> }

                </div>

                {
                    isAuth &&
                    <div onClick={PPuploadBtnClick} className="upload-profile-pic">
                        <i className="fa fa-camera-alt"></i>
                    </div>
                }



                <ModalContainer
                    title="View Profile Picture"
                    style={{ width: isMobile ? '95%' : "600px", top: "50%" }}
                    isOpen={isPPViewModal}
                    onRequestClose={closePPViewModal}
                    id="pp-view-modal"
                >

                    <div className="modal-header">
                        <div className="modal-title" style={PPViewModalTitleStyles}> View
                            Profile Picture</div>
                        <div onClick={closePPViewModal} className="modal-close-btn">
                            <i className="far fa-times"></i>
                        </div>

                    </div>
                    <div className="modal-body text-center">
                        <img src={profileData.profilePic} className="w-100" alt="Ikram" />

                    </div>
                </ModalContainer>

                <ModalContainer
                    title="Upload Profile Pics"
                    style={{ width: "600px", maxWidth: '95%', top: "50%" }}
                    isOpen={isPPModal}
                    onRequestClose={closePPModal}
                    id="pp-upload-modal"

                >

                    <div className="modal-header">
                        <div className="modal-title"> Upload
                            Profile Picture</div>
                        <div onClick={closePPModal} className="modal-close-btn">
                            <i className="far fa-times"></i>
                        </div>

                    </div>
                    <div className="modal-body">
                        <form onSubmit={handlePPUploadSubmit}>
                            <textarea onChange={handleppTextareChange.bind(this)} placeholder="What's in your Mind?" name='caption' className="post-caption" value={ppCaption}></textarea>

                            {
                                profileImage && <AvatarEditor
                                    ref={setEditorRef}
                                    image={URL.createObjectURL(profileImage)}
                                    width={450}
                                    height={450}
                                    border={50}
                                    borderRadius={300}
                                    color={[0, 0, 0, 0.5]} // RGBA
                                    scale={1.1}
                                    rotate={0}
                                    style={{ margin: 'auto', marginBottom: '20px', maxWidth: '100%', height: '100%', width: '100%' }}
                                />
                            }
                            <input onChange={ppInputChange} name="profilePic" className="pp-upload-input" type='file'></input>
                            <button className="pp-upload-button" type="submit">Upload</button>
                        </form>
                    </div>
                </ModalContainer>



            </div>

        </Fragment>
    )
}
export default ProfilePic