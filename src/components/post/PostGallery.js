import React, { useState } from "react";
import { Link } from "react-router-dom";

const PostGallery = ({ photos, postId }) => {
  const [expanded, setExpanded] = useState(false);
  const images = [
    photos?.primary,
    ...(Array.isArray(photos?.gallery) ? photos.gallery : []),
  ].filter(Boolean);

  if (!images.length) return null;

  const visibleImages = expanded ? images : images.slice(0, 4);

  return (
    <div
      className={`post-gallery post-gallery--${Math.min(images.length, 4)}${
        expanded ? " post-gallery--expanded" : ""
      }`}
    >
      {visibleImages.map((src, index) => (
        <Link
          key={`${src}-${index}`}
          to={`/post/${postId}`}
          className="post-gallery__item"
        >
          <img src={src} alt={`Post image ${index + 1}`} loading={index > 0 ? "lazy" : "eager"} />
          {!expanded && index === 3 && images.length > 4 ? (
            <button
              type="button"
              className="post-gallery__more"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setExpanded(true);
              }}
            >
              <span>Show more</span>
              <small>+{images.length - 4}</small>
            </button>
          ) : null}
        </Link>
      ))}
      {expanded ? (
        <button
          type="button"
          className="post-gallery__less"
          onClick={() => setExpanded(false)}
        >
          Show less
        </button>
      ) : null}
    </div>
  );
};

export default PostGallery;
