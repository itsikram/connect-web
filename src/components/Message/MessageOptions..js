import React, { useEffect, useState, useCallback } from 'react';
import api from '../../api/api';
import Masonry, { ResponsiveMasonry } from 'react-responsive-masonry';
import { useParams } from 'react-router-dom';
import SingleMedia from './SingleMedia';
import Lightbox from './Lightbox';
const MessageOptions = () => {
    let [images, setImages] = useState([])
    let [isLightBox, setIsLightbox] = useState(false);
    let [imageIndex, setImageIndex] = useState(0);

    let params = useParams()
    useEffect(() => {

        setImages([])

        api.get(`message/media/?profileId=${params.profile}`).then((res) => {
            setImages([...res.data.map((media) => media.attachment)])
        })

    }, [params])


    return (
        <div className='text-center pt-2 right-sidebar-container'>
            {isLightBox && <Lightbox setIsLightbox={setIsLightbox} setImageIndex={setImageIndex} imageIndex={imageIndex} images={images} index={imageIndex} /> }

                <h3 className='msg-media-title'>Media</h3>
                <div className='msg-media-container'>
                    <ResponsiveMasonry>
                        <Masonry columnsCount={2} gutter="10px">
                            {images && images.map((image, index) => (

                                <SingleMedia setIsLightbox={setIsLightbox} setImageIndex={setImageIndex} images={images} key={index} index={index} src={image} />

                            ))}
                        </Masonry>
                    </ResponsiveMasonry>
                </div>
            </div>
    );
}

            export default MessageOptions;
