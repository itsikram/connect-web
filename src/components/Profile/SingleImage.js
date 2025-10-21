import React, { useCallback } from 'react';
import { Link } from 'react-router-dom';
import checkImgLoading from '../../utils/checkImgLoading';
import ImageSkleton from '../../skletons/ImageSkleton';
import { useState } from 'react';
import { useEffect } from 'react';
const SingleImage = ({ imageData, setImageIndex, setIsLightbox, imageIndex }) => {
    let [isLoaded, setIsloaded] = useState(false)

    useEffect(() => {
        checkImgLoading(imageData.photos, setIsloaded)
    }, [])

    let handleImageClick = useCallback((e) => {
        setIsLightbox(true)
        setImageIndex(imageIndex)
    },[])

    return (

        <>
            {
                isLoaded ?
                    <>
                        <div className='image-item' onClick={handleImageClick.bind(this)}>
                            <div className='profile-image-container'>
                                <img src={imageData.photos} alt={imageData.caption || ''} />
                            </div>
                            {/* <Link to={`/post/${imageData._id}`}>
                            
                        </Link> */}
                        </div>
                    </>

                    :

                    <>
                        <ImageSkleton />
                    </>
            }

        </>






    );
}

export default SingleImage;
