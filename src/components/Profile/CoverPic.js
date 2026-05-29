import React, { Fragment, useState, useEffect,useCallback } from "react";
import ModalContainer from "../modal/ModalContainer";
import { useSelector, useDispatch } from "react-redux";
import api from "../../api/api";
import Cropper from 'react-easy-crop';
import getCroppedImg from "../../inc/getCroppedImg";
import CpSkleton from "../../skletons/profile/CpSkleton";
import { useParams } from "react-router-dom";
import { getProfileSuccess } from "../../services/actions/profileActions";

const CoverPic = ({ profileData }) => {

    // Modal visibility functions
    const [isCpModal, setCpModal] = useState(false)
    const [isCpUploading, setIsCpUploading] = useState(false)
    const [uploadProgress, setUploadProgress] = useState(0)
    const [isCropping, setIsCropping] = useState(false)
    const [isCPViewModal, setisCPViewModal] = useState(false)
    const [cpLoaded, setCpLoaded] = useState(false);
    const [coverPicUrl, setCoverPicUrl] = useState(profileData.coverPic || '')
    const [displayCoverPicUrl, setDisplayCoverPicUrl] = useState(profileData.coverPic || '')
    const [coverImage, setCoverImage] = useState(null)
    const [croppedImage, setCroppedImage] = useState(null)
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
    const [zoom, setZoom] = useState(1);
    const myProfileData = useSelector(state => state.profile)
    const dispatch = useDispatch();

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

    const getCacheBustedUrl = (url) => {
        if (!url) return url;
        const separator = url.includes('?') ? '&' : '?';
        return `${url}${separator}cb=${Date.now()}`;
    };

    const checkImageStatus = (url) => {
        const img = new Image();
        img.src = url;
        img.onload = () => setCpLoaded(true);
        img.onerror = () => setCpLoaded(false);
    };
    

    useEffect(() => {
        if (profileData) {
            const url = profileData.coverPic || '';
            setCpLoaded(false)
            setCoverPicUrl(url)
            setDisplayCoverPicUrl(getCacheBustedUrl(url))
            checkImageStatus(url)
        }
    }, [profileData])

    useEffect(() => {
        if (coverPicUrl) {
            setCpLoaded(false);
            setDisplayCoverPicUrl(getCacheBustedUrl(coverPicUrl));
            checkImageStatus(coverPicUrl);
        }
    }, [coverPicUrl])

    const isMobile = useMediaQuery("(max-width: 768px)");

    const closeCpModal = () => {
        setCpModal(false)
    }
    const showCpModal = () => {
        setCpModal(true)
    }

    const hideCpModal = () => {
        setCpModal(false)
    }

    const openCPViewModal = () => {
        setisCPViewModal(true)
    }

    const closeCPViewModal = () => {
        setisCPViewModal(false)
    }


    const CPViewModalTitleStyles = {
        fontSize: isMobile ? '18px' : '30px',
    }

    const handleCpChange = async (e) => {
        setCoverImage(e.target.files[0] || '')
        setIsCropping(true)
    }


    const uploadCoverImage = async () => {
        setIsCropping(false)
        setUploadProgress(0)
        setIsCpUploading(true)
        const coverPicFromData = new FormData();
        coverPicFromData.append('image', coverImage)
        const uploadCoverPicRes = await api.post('/upload', coverPicFromData, {
            headers: {
                'content-type': 'multipart/form-data'
            },
            onUploadProgress: (progressEvent) => {
                const percentCompleted = Math.round((progressEvent.loaded * 100) / (progressEvent.total || 1));
                setUploadProgress(percentCompleted)
            }
        })

        setIsCpUploading(false)
        setUploadProgress(0)

        if (uploadCoverPicRes.status === 200) {
            const coverPicUrl = uploadCoverPicRes.data.secure_url;
            setCoverPicUrl(coverPicUrl)
            return coverPicUrl;
        }

        return null;
    }

    // cover photo upload handler
    const cpUploadSubmit = async (e) => {
        e.preventDefault()

        try {
            let uploadUrl = coverPicUrl;

            if (coverImage) {
                uploadUrl = await uploadCoverImage();
            }

            if (!uploadUrl) {
                return;
            }

            setIsCpUploading(true)
            const cpFormData = new FormData()
            cpFormData.append('coverPicUrl', uploadUrl)
            cpFormData.append('profile', profileData._id)
            const response = await api.post('/profile/update/coverPic', cpFormData, {
                headers: {
                    'content-type': 'multipart/form-data'
                }
            })
            if (response.status === 200) {
                setCpModal(false)
                setIsCpUploading(false)
                setCoverPicUrl(uploadUrl)
                setDisplayCoverPicUrl(getCacheBustedUrl(uploadUrl))
                setUploadProgress(0)
                let updatedProfile = response.data?.profile || response.data;

                // If the update endpoint does not return the full profile, re-fetch it.
                if (!updatedProfile || !updatedProfile._id) {
                    const profileRes = await api.post('/profile', { profile: profileData._id });
                    if (profileRes.status === 200) {
                        updatedProfile = profileRes.data;
                    }
                }

                if (updatedProfile && updatedProfile._id) {
                    dispatch(getProfileSuccess(updatedProfile));
                } else if (myProfileData?._id === profileData._id) {
                    dispatch(getProfileSuccess({ ...myProfileData, coverPic: uploadUrl }));
                }
            }
        } catch (error) {
            console.log(error)
            setIsCpUploading(false)
            setUploadProgress(0)
        }
    }


    const onCropComplete = useCallback((_, croppedAreaPixels) => {
        setCroppedAreaPixels(croppedAreaPixels);
      }, []);



      const croppedImg= useCallback(async () => {
        if(coverImage) {
            try {
                const croppedImage = await getCroppedImg(
                  URL.createObjectURL(coverImage),
                  croppedAreaPixels,
                  1430,
                  450
                );
                if(croppedImage) {
                    setCroppedImage(croppedImage)
                    return true;
                }
              } catch (e) {
                console.error(e);
              }
        }


      }, [coverImage && URL.createObjectURL(coverImage), croppedAreaPixels]);


    const isAuth = myProfileData._id === profileData._id


    return (
        <Fragment>
            <div className="cover-photo-container">
            {/* <CpSkleton count={1} /> */}

            {cpLoaded ? (
                <img onClick={openCPViewModal} className="cover-photo" src={displayCoverPicUrl} alt="cover" />
            ) : (<CpSkleton count={1} />)}

                

                {
                    isAuth &&
                    <div className="upload-cover-photo" onClick={showCpModal}>
                        <i className="fa fa-camera-alt"></i>
                        <span>
                            Upload Cover Photo
                        </span>

                    </div>
                }

                <ModalContainer
                    title="View Cover Photo"
                    style={{ width: isMobile ? '95%' : "600px", top: "50%" }}
                    isOpen={isCPViewModal}
                    onRequestClose={closeCPViewModal}
                    id="cp-view-modal"
                >

                    <div className="modal-header">
                        <div className="modal-title" style={CPViewModalTitleStyles}> View
                            Profile Picture</div>
                        <div onClick={closeCPViewModal} className="modal-close-btn">
                            <i className="far fa-times"></i>
                        </div>

                    </div>
                    <div className="modal-body text-center">
                        <img src={displayCoverPicUrl} className="w-100" alt="Cover Pic View" />

                    </div>
                </ModalContainer>

                <ModalContainer
                    title={"Upload Cover Photo"}
                    style={{ width: "500px", top: "20%", top: '50%' }}
                    isOpen={isCpModal}
                    onRequestClose={closeCpModal}
                    id='cp-upload-modal'
                >

                    <div className="modal-header">
                        <div className="modal-title">
                            Upload Cover Photo
                        </div>
                        <div onClick={hideCpModal} className="modal-close-btn">
                            <i className="far fa-times"></i>
                        </div>
                    </div>
                    <div className="modal-body">
                        <div className="modal-upload-preview">
                        {
                                coverImage && <Cropper
                                    image={URL.createObjectURL(coverImage)}
                                    crop={crop}
                                    zoom={zoom}
                                    aspect={1430 / 450}
                                    onCropChange={setCrop}
                                    onZoomChange={setZoom}
                                    onCropComplete={onCropComplete}
                                />
                            }
                        </div>
                        <form onSubmit={cpUploadSubmit}>

                            <input name="cover_pic" onChange={handleCpChange.bind(this)} className="cp-upload-input" type="file"></input>
                            <button type="submit" className="cp-upload-button" disabled={isCpUploading}>{isCpUploading ? `Uploading ${uploadProgress}%` : isCropping ? 'Crop' : 'Update Cover Picture'}</button>
                        </form>
                        {isCpUploading && (
                            <div style={{ marginTop: '12px' }}>
                                <div style={{ width: '100%', height: '6px', background: '#e5e7eb', borderRadius: '4px', overflow: 'hidden' }}>
                                    <div style={{ width: `${uploadProgress}%`, height: '100%', background: '#3B82F6', transition: 'width 0.2s ease' }} />
                                </div>
                                <div style={{ marginTop: '6px', fontSize: '12px', color: '#374151' }}>{uploadProgress}%</div>
                            </div>
                        )}

                    </div>

                </ModalContainer>

            </div>

        </Fragment>
    )
}


export default CoverPic