import React, { Fragment, useState, useEffect } from "react";
import ModalContainer from "../modal/ModalContainer";
import AvatarEditor from "react-avatar-editor";
import api from "../../api/api";
import { useSelector, useDispatch } from "react-redux";
import { useParams } from "react-router-dom"
import ImageSkleton from "../../skletons/post/ImageSkleton";
import checkImgLoading from "../../utils/checkImgLoading";
import isValidUrl from "../../utils/isValiUrl";
import PpSkleton from "../../skletons/profile/PpSkleton";
import config from "../../config/config.json";
import { getProfileSuccess } from "../../services/actions/profileActions";
import { fetchProfileHasStoryCached } from "../../utils/requestCache";
const defaultPpSrc = config?.defaultProfile;

let ProfilePic = ({ profileData }) => {
    let { profile } = useParams()

    let myProfileData = useSelector(state => state.profile)
    const dispatch = useDispatch();
    // handle profile pic upload

    const [isPPModal, setIsPPModal] = useState(false)
    const [isPPViewModal, setIsPPViewModal] = useState(false)
    const [profileImage, setProfileimage] = useState()
    const [ppUrl, setPpUrl] = useState(profileData.profilePic)
    const [displayPpUrl, setDisplayPpUrl] = useState(profileData.profilePic)
    const [isPpLoaded, setIsPpLoaded] = useState(profileData.profilePic);
    const [isPpUploading, setIsPpUploading] = useState(false)
    const [uploadProgress, setUploadProgress] = useState(0)
    const [hasStory, setHasStory] = useState(false);
    const [ppCaption, setPpCaption] = useState('');
    useEffect(() => {
        if (!profile) return;

        fetchProfileHasStoryCached(profile, { ttlMs: 60000, storageTtlMs: 300000 })
            .then((data) => {
                if (data) {
                    setHasStory(data.hasStory)
                }
            })

    }, [profile])

    const getCacheBustedUrl = (url) => {
        if (!url) return url;
        const separator = url.includes('?') ? '&' : '?';
        return `${url}${separator}cb=${Date.now()}`;
    };

    useEffect(() => {
        if(profileData) {
            const url = isValidUrl(profileData.profilePic) ? profileData.profilePic : '';
            setPpUrl(url)
            setDisplayPpUrl(getCacheBustedUrl(url))
        } else {
            setPpUrl(defaultPpSrc)
            setDisplayPpUrl(defaultPpSrc)
        }
    },[profileData])

    useEffect(() => {
          if (ppUrl) {
              setDisplayPpUrl(getCacheBustedUrl(ppUrl));
              checkImgLoading(ppUrl, setIsPpLoaded)
          }
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
        try {


            profilePicEditor.getImageScaledToCanvas().toBlob(async (Blob) => {
                let profilePicFile = new File([Blob], `${profileData._id}.png`, {
                    type: Blob.type,
                    lastModified: new Date().getTime()

                })
                // return console.log('profilePicFile',profilePicFile)

                let ppFormData = new FormData();
                ppFormData.append('image', profilePicFile)

setUploadProgress(0)
                    setIsPpUploading(true)
                    let uplaodPPRes = await api.post('/upload', ppFormData, {
                        headers: {
                            'Content-Type': 'multipart/form-data'
                        },
                        onUploadProgress: (progressEvent) => {
                            const percentCompleted = Math.round((progressEvent.loaded * 100) / (progressEvent.total || 1));
                            setUploadProgress(percentCompleted)
                        }
                    })
                    setIsPpUploading(false)

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
                        setPpUrl(profilePicUrl)
                        setDisplayPpUrl(getCacheBustedUrl(profilePicUrl))
                        setIsPpLoaded(false)
                        setPpCaption("")
                        setProfileimage(undefined)
                        setIsPPModal(false)
                        setUploadProgress(0)

                        const updatedProfile = res.data?.profile || res.data;
                        if (updatedProfile && updatedProfile._id) {
                            dispatch(getProfileSuccess(updatedProfile));
                        } else if (myProfileData?._id === profileData._id) {
                            dispatch(getProfileSuccess({ ...myProfileData, profilePic: profilePicUrl }));
                        }
                    }

                }

            })



        } catch (error) {
            console.log(error)
            setIsPpUploading(false)
            setUploadProgress(0)
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

    const isMobile = useMediaQuery("(max-width: 768px)");

    const PPViewModalTitleStyles = {
        fontSize: isMobile ? '18px' : '30px',
    }

    return (
        <Fragment>
            <div className="profile-pic">

                {/* <SkeletonCard /> */}


                <div className={`profilePic-container ${hasStory == 'yes' ? 'has-story' : ''}`} onClick={PPContainerClick}>
{ isPpLoaded ? <img src={displayPpUrl} alt="" /> : <ImageSkleton  /> }

                </div>

                {
                    isAuth &&
                    <div onClick={PPuploadBtnClick} className="upload-profile-pic">
                        <i className="fa fa-camera-alt"></i>
                    </div>
                }



                {isPPViewModal && (
                <ModalContainer
                    title="View Profile Picture"
                    isOpen
                    onRequestClose={closePPViewModal}
                    id="pp-view-modal"
                >

                    <div className="modal-header">
                        <div className="modal-title" style={PPViewModalTitleStyles}> View
                            Profile Picture</div>
                        <button type="button" onClick={closePPViewModal} className="modal-close-btn" aria-label="Close">
                            <i className="far fa-times"></i>
                        </button>

                    </div>
                    <div className="modal-body text-center">
                        <img src={displayPpUrl} className="w-100" alt="Profile" />

                    </div>
                </ModalContainer>
                )}

                {isPPModal && (
                <ModalContainer
                    title="Upload Profile Pics"
                    isOpen
                    onRequestClose={closePPModal}
                    id="pp-upload-modal"

                >

                    <div className="modal-header">
                        <div className="modal-title"> Upload
                            Profile Picture</div>
                        <button type="button" onClick={closePPModal} className="modal-close-btn" aria-label="Close">
                            <i className="far fa-times"></i>
                        </button>

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
                            <button className="pp-upload-button" type="submit" disabled={isPpUploading}>{isPpUploading ? `Uploading ${uploadProgress}%` : 'Upload'}</button>
                            {isPpUploading && (
                                <div className="upload-progress-bar" style={{ marginTop: '12px' }}>
                                    <div style={{ background: '#3B82F6', height: '6px', width: `${uploadProgress}%`, borderRadius: '4px', transition: 'width 0.2s ease' }} />
                                    <div style={{ marginTop: '6px', fontSize: '12px', color: '#555' }}>{uploadProgress}%</div>
                                </div>
                            )}
                        </form>
                    </div>
                </ModalContainer>
                )}



            </div>

        </Fragment>
    )
}
export default ProfilePic