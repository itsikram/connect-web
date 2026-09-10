import React from "react";
import { Link } from "react-router-dom";

const PostGallery = ({ photos, postId }) => {
  const images = [
    photos?.primary,
    ...(Array.isArray(photos?.gallery) ? photos.gallery : []),
  ].filter(Boolean);

  if (!images.length) return null;

  return (
    <div className={`post-gallery post-gallery--${Math.min(images.length, 5)}`}>
      {images.slice(0, 5).map((src, index) => (
        <Link
          key={`${src}-${index}`}
          to={`/post/${postId}`}
          className="post-gallery__item"
        >
          <img src={src} alt={`Post image ${index + 1}`} loading={index > 0 ? "lazy" : "eager"} />
          {index === 4 && images.length > 5 ? (
            <span className="post-gallery__more">+{images.length - 5}</span>
          ) : null}
        </Link>
      ))}
    </div>
  );
};

export default PostGallery;
