import React, { Fragment, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../../api/api";
import { ProfileMediaSkeleton } from "../../skletons/profile/ProfilePageSkeleton";

const ProfileVideos = () => {
    const { profile } = useParams();
    const navigate = useNavigate();
    const [watches, setWatches] = useState([]);
    const [videosLoading, setVideosLoading] = useState(true);

    useEffect(() => {
        if (!profile) return;
        let active = true;
        setVideosLoading(true);

        api.get("/watch/profileWatch", {
            params: {
                profile,
                pageNumber: 1,
            },
        })
            .then((res) => {
                if (!active) return;
                const data = res.data?.watchs || res.data || [];
                setWatches(Array.isArray(data) ? data : []);
            })
            .catch(() => {
                if (active) setWatches([]);
            })
            .finally(() => {
                if (active) setVideosLoading(false);
            });

        return () => {
            active = false;
        };
    }, [profile]);

    return (
        <Fragment>
            <div id="profile-videos-container">
                {videosLoading && (
                    <ProfileMediaSkeleton count={2} />
                )}
                {!videosLoading && watches.length === 0 && (
                    <div className="profile-placeholder-card">No videos found.</div>
                )}
                {!videosLoading && watches.length > 0 && (
                    <div className="profile-media-list">
                        {watches.map((video) => {
                            const thumb = video.thumbnail || video.photos || video.videoUrl;
                            return (
                                <button
                                    type="button"
                                    key={video._id}
                                    className="profile-media-card"
                                    onClick={() => {
                                        if (video._id) navigate(`/watch/${video._id}`);
                                    }}
                                >
                                    {thumb ? (
                                        <img className="profile-media-thumb" src={thumb} alt="" />
                                    ) : (
                                        <div className="profile-media-thumb" />
                                    )}
                                    <span className="profile-media-play" aria-hidden="true">
                                        <i className="fas fa-play" />
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        </Fragment>
    );
};

export default ProfileVideos;
