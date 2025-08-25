import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const Lightbox = ({ images, imageIndex, setIsLightbox, setImageIndex }) => {
    const [currentIndex, setCurrentIndex] = useState(imageIndex);
    let [direction, setDirection] = useState(0);

    const variants = {
        enter: (dir) => ({
            x: dir > 0 ? 300 : -300,
            opacity: 0,
        }),
        center: {
            x: 0,
            opacity: 1,
        },
        exit: (dir) => ({
            x: dir > 0 ? -300 : 300,
            opacity: 0,
        }),
    };

    const closeLightbox = () => setIsLightbox(false);
    const showPrev = () => {
        if (currentIndex > 0) {
            setDirection(-1);
            setImageIndex(prev => prev - 1)
        }
    };
    const showNext = () => {
        setDirection(-1);

        if (currentIndex < images.length - 1) {
            setImageIndex((prev) => prev + 1);
        }
    };

    const handleOverlayClick = (e) => {
        if (e.target.id === 'lightbox-overlay') {
            closeLightbox();
        }
    };



    return (
        <div className="media-lightbox">
            {/* Thumbnails */}
            {/* <div className="grid grid-cols-3 gap-4">
                {images.map((img, index) => (
                    <img
                        key={index}
                        src={img}
                        alt={`Thumbnail ${index}`}
                        className="cursor-pointer rounded shadow"
                        onClick={() => {
                            setDirection(0);
                            setCurrentIndex(index);
                        }}
                    />
                ))} */}


            {/* </div> */}

            {/* Lightbox */}
            {currentIndex !== null && (
                <div
                    id="lightbox-overlay"
                    onClick={handleOverlayClick}
                    className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50"
                >
                    <div className="relative lightbox-content">
                        {/* Close Button */}
                        <button
                            onClick={closeLightbox}
                            className="lightbox-close-button bg-danger"
                        >
                            <i className='fas fa-times'></i>

                        </button>

                        {/* Prev Button */}
                        {imageIndex > 0 && (
                            <button
                                onClick={showPrev}
                                className="lightbox-prev-button"
                            >
                                <i className='fas fa-chevron-left'></i>
                            </button>
                        )}

                        {/* Next Button */}
                        {imageIndex < images.length - 1 && (
                            <button
                                onClick={showNext}
                                className="lightbox-next-button "
                            >
                                <i className='fas fa-chevron-right'></i>

                            </button>
                        )}

                        {/* Animated Image */}
                        <div className="overflow-hidden">
                            <AnimatePresence initial={true} custom={1}>
                                <motion.img
                                    key={images[imageIndex]}
                                    src={images[imageIndex]}
                                    alt="Lightbox"
                                    className="max-h-[80vh] mx-auto rounded w-100"
                                    custom={1}
                                    variants={variants}
                                    initial="enter"
                                    animate="center"
                                    exit="exit"
                                    transition={{ duration: 0.4 }}
                                />
                            </AnimatePresence>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Lightbox;
