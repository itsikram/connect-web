import React, { useEffect, useState } from 'react';
import api from '../../api/api';
import { useParams } from 'react-router-dom';
import { ProfileMediaSkeleton } from '../../skletons/profile/ProfilePageSkeleton';

const ProfileImages = () => {
    const [images, setImages] = useState([]);
    const [imagesLoading, setImagesLoading] = useState(true);
    const [isLightBox, setIsLightbox] = useState(false);
    const [imageIndex, setImageIndex] = useState(0);
    const { profile } = useParams();

    useEffect(() => {
        if (!profile) return;
        let active = true;
        setImagesLoading(true);

        api.get('profile/getImages', {
            params: { profileId: profile },
        })
            .then((res) => {
                if (!active) return;
                const list = Array.isArray(res.data)
                    ? res.data.map((item) => item?.photos).filter(Boolean)
                    : [];
                setImages(list);
            })
            .catch(() => {
                if (active) setImages([]);
            })
            .finally(() => {
                if (active) setImagesLoading(false);
            });

        return () => {
            active = false;
        };
    }, [profile]);

    const closeViewer = () => setIsLightbox(false);

    return (
        <div id="profile-images-container">
            {imagesLoading && (
                <ProfileMediaSkeleton count={2} />
            )}
            {!imagesLoading && images.length === 0 && (
                <div className="profile-placeholder-card">No images found.</div>
            )}
            {!imagesLoading && images.length > 0 && (
                <div className="profile-media-list">
                    {images.map((uri, index) => (
                        <button
                            type="button"
                            key={`${uri}-${index}`}
                            className="profile-media-card"
                            onClick={() => {
                                setImageIndex(index);
                                setIsLightbox(true);
                            }}
                        >
                            <img src={uri} alt="" />
                        </button>
                    ))}
                </div>
            )}

            {isLightBox && images.length > 0 && (
                <div
                    className="profile-image-viewer"
                    role="dialog"
                    aria-modal="true"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) closeViewer();
                    }}
                >
                    <button type="button" className="viewer-close" onClick={closeViewer} aria-label="Close">
                        <i className="fas fa-times" />
                    </button>
                    <div className="viewer-body">
                        <button
                            type="button"
                            className="viewer-nav"
                            onClick={() => setImageIndex((i) => Math.max(0, i - 1))}
                            aria-label="Previous"
                        >
                            <i className="fas fa-chevron-left" />
                        </button>
                        <img src={images[imageIndex]} alt="" />
                        <button
                            type="button"
                            className="viewer-nav"
                            onClick={() => setImageIndex((i) => Math.min(images.length - 1, i + 1))}
                            aria-label="Next"
                        >
                            <i className="fas fa-chevron-right" />
                        </button>
                    </div>
                    <div className="viewer-counter">
                        {imageIndex + 1} / {images.length}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProfileImages;
