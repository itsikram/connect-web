import React, { useEffect, useState } from 'react';
import api from '../../api/api';
import { useParams, useLocation } from 'react-router-dom';
import SingleImage from './SingleImage';
import Masonry, { ResponsiveMasonry } from "react-responsive-masonry"
import Lightbox from '../Message/Lightbox';
const ProfileImages = () => {

    let [profileImages, setProfileImages] = useState([])
    let { profile } = useParams()
    let location = useLocation()
    let [images, setImages] = useState([])
    let [isLightBox, setIsLightbox] = useState(false);
    let [imageIndex, setImageIndex] = useState(0);


    useEffect(() => {
        api.get('profile/getImages', {
            params: {
                profileId: profile
            }
        }).then(res => {
            setProfileImages(res.data)
            setImages([...res.data.map((imagedata) => imagedata.photos)])

        })
    }, [location])

    // columnsCountBreakPoints={{350: 1, 750: 2, 900: 3}}
    //                 gutterBreakpoints={{350: "12px", 750: "16px", 900: "24px"}}
    return (
        <div id='profile-images-container'>
            {isLightBox && <Lightbox setIsLightbox={setIsLightbox} setImageIndex={setImageIndex} imageIndex={imageIndex} images={images} index={imageIndex} />}

            <div className='section-title'>
                Profile Images
            </div>
            <div className='image-items-container mt-3'>
                <ResponsiveMasonry >
                    <Masonry columnsCount={2} gutter='10px'>
                        {
                            profileImages && profileImages.length > 1 ?
                                profileImages.map((ImageData, index) => {

                                    return <>
                                        <SingleImage setImageIndex={setImageIndex} setIsLightbox={setIsLightbox} key={index} imageIndex={index} imageData={ImageData} />
                                    </>


                                })

                                :

                                <p>No Images To Show</p>
                        }
                    </Masonry>
                </ResponsiveMasonry>

            </div>
        </div>
    );
}

export default ProfileImages;
