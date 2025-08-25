import React, { Fragment, useState, useEffect,useCallback } from "react";
import ModalContainer from "../modal/ModalContainer";
import { useSelector } from "react-redux";
import api from "../../api/api";
import Cropper from 'react-easy-crop';
import getCroppedImg from "../../inc/getCroppedImg";
import CpSkleton from "../../skletons/profile/CpSkleton";
import { useParams } from "react-router-dom";
import { param } from "jquery";

let CoverPic = ({ profileData }) => {

    // Modal visibility functions
    const params = useParams();
    const [isCpModal, setCpModal] = useState(false)
    const [isCpUploading, setIsCpUploading] = useState(false)
    const [isCropping, setIsCropping] = useState(false)
    const [isCPViewModal, setisCPViewModal] = useState(false)
    const [cpLoaded, setCpLoaded] = useState(false);
    const [coverPicUrl, setCoverPicUrl] = useState(profileData.profilePic || '')
    const [coverImage, setCoverImage] = useState(null)
    const [croppedImage, setCroppedImage] = useState(null)
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
    const [zoom, setZoom] = useState(1);
    let myProfileData = useSelector(state => state.profile)

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

    const checkImageStatus = (url) => {
        const img = new Image();
        img.src = url;
        img.onload = () => setCpLoaded(true);
        img.onerror = () => setCpLoaded(false);
    };
    

    useEffect(() => {
        setCoverPicUrl('')
        setCpLoaded(false)

    },[param])

    useEffect(() => {
        if(profileData) {
            setCpLoaded(false)
            checkImageStatus(profileData.coverPic)
            
        }

    }, [profileData, param])

    useEffect(() => {

        if(cpLoaded == true) {
            setCoverPicUrl(profileData.coverPic)

        } 

    }, [cpLoaded])

    const isMobile = useMediaQuery("(max-width: 768px)");

    let closeCpModal = () => {
        setCpModal(false)
    }
    let showCpModal = () => {
        setCpModal(true)
    }

    let hideCpModal = () => {
        setCpModal(false)
    }

    let openCPViewModal = () => {
        setisCPViewModal(true)
    }

    let closeCPViewModal = () => {
        setisCPViewModal(false)
    }


    var CPViewModalTitleStyles = {
        fontSize: isMobile ? '18px' : '30px',
    }

    let handleCpChange = async (e) => {
        setCoverImage(e.target.files[0] || '')
        setIsCropping(true)
    }


    let uploadCoverImage = async () => {
        setIsCropping(false)
        setIsCpUploading(true)
        let coverPicFromData = new FormData();
        coverPicFromData.append('image', coverImage)
        let uploadCoverPicRes = await api.post('/upload', coverPicFromData, {
            headers: {
                'content-type': 'multipart/form-data'
            }
        })

        if (uploadCoverPicRes.status === 200) {
            let coverPicUrl = uploadCoverPicRes.data.secure_url;
            setIsCpUploading(false)
            setCoverPicUrl(coverPicUrl)
            return true;
        }
    }

    // cover photo upload handler
    let cpUploadSubmit = async (e) => {
        e.preventDefault()

        if(!croppedImage,!coverPicUrl) {
            croppedImg() 
            uploadCoverImage()
            return true;
        }

        try {

            if (coverPicUrl) {
                setIsCpUploading(true)
                let cpFormData = new FormData()
                cpFormData.append('coverPicUrl', coverPicUrl)
                cpFormData.append('profile', profileData._id)
                let response = await api.post('/profile/update/coverPic', cpFormData, {
                    headers: {
                        'content-type': 'multipart/form-data'
                    }
                })
                if (response.status === 200) {
                    setCpModal(false)
                    window.location.reload()

                }
            }

        } catch (error) {
            console.log(error)
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


    let isAuth = myProfileData._id === profileData._id


    return (
        <Fragment>
            <div className="cover-photo-container">
            {/* <CpSkleton count={1} /> */}

            {cpLoaded ? (
                <img onClick={openCPViewModal} className="cover-photo" src={coverPicUrl} alt="cover" />
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
                        <img src={coverPicUrl} className="w-100" alt="Cover Pic View" />

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
                            <button type="submit" className="cp-upload-button">{isCpUploading ? 'Uploading...' : isCropping ? 'Crop' : 'Update Cover Picture'}</button>
                        </form>

                    </div>

                </ModalContainer>

            </div>

        </Fragment>
    )
}


export default CoverPic