import React, { useState, useEffect, useCallback } from 'react';
import ImageSkleton from '../../skletons/message/ImageSkleton';
import checkImgLoading from '../../utils/checkImgLoading';
const SingleMedia = (props) => {

    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        checkImgLoading(props.src, setIsLoaded);
    }, [props.src]);

    const handleMediaClick = useCallback(() => {
        props.setIsLightbox(true)
        props.setImageIndex(props.index)
        // props.setIsLightbox(true)
        // props.setMediaIndex(props.index)
    }, [props.setIsLightbox, props.setImageIndex, props.index])

    return (
        <>
            {!isLoaded && <ImageSkleton count={1} />}
            {isLoaded && <div 
                onClick={handleMediaClick} 
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleMediaClick(); } }}
                role="button"
                tabIndex={0}
                className='msg-media-item'
            >
                <img src={props.src} className='w-100' alt="" />
            </div>}
        </>
    );
}

export default SingleMedia;
