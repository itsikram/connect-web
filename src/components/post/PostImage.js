import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import ImageSkleton from "../../skletons/post/ImageSkleton";

const PostImage = ({ src, postId }) => {
  const [status, setStatus] = useState("loading");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setStatus("loading");
    setAttempt(0);
  }, [src]);

  if (!src) return null;

  const retry = () => {
    setStatus("loading");
    setAttempt((value) => value + 1);
  };

  return (
    <div className={`attachment post-image post-image--${status}`}>
      {status === "loading" && <ImageSkleton />}
      {status === "error" && (
        <button
          type="button"
          className="post-image-retry"
          onClick={retry}
          aria-label="Reload post image"
          title="Reload image"
        >
          <i className="fas fa-redo" aria-hidden="true" />
        </button>
      )}
      <Link to={`/post/${postId}`} className="post-image-link">
        <img
          key={attempt}
          src={src}
          alt="post"
          onLoad={() => setStatus("loaded")}
          onError={() => setStatus("error")}
        />
      </Link>
    </div>
  );
};

export default PostImage;
