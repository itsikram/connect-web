import React, { Fragment, useEffect, useState } from "react";
import { useSelector } from "react-redux";
import Moment from "react-moment";
import { useParams, useOutletContext } from "react-router-dom";
import { fetchProfileCached } from "../../utils/requestCache";
import { ProfileAboutSkeleton } from "../../skletons/profile/ProfilePageSkeleton";

const formatMonthYearFallback = (dateInput) => {
    try {
        const d = dateInput ? new Date(dateInput) : null;
        if (!d || Number.isNaN(d.getTime())) return "Unknown";
        return d.toLocaleString("default", { month: "long" }) + " " + d.getFullYear();
    } catch (_) {
        return "Unknown";
    }
};

const ProfileDetails = () => {
    const myProfile = useSelector((state) => state.profile);
    const outlet = useOutletContext() || {};
    const [friendProfile, setFriendProfile] = useState(outlet.profileData || null);
    const params = useParams();
    const friendId = params.profile;
    const isOwn = friendId === myProfile?._id || friendId === myProfile?.username;
    const profile = isOwn ? myProfile : (outlet.profileData || friendProfile || {});

    useEffect(() => {
        if (outlet.profileData?._id) {
            setFriendProfile(outlet.profileData);
        }
        if (!friendId || isOwn || outlet.profileData?._id) return;

        fetchProfileCached(friendId, { ttlMs: 60000, storageTtlMs: 300000 })
            .then((profileResponse) => {
                setFriendProfile(profileResponse);
            })
            .catch((e) => console.log(e));
    }, [friendId, isOwn, outlet.profileData]);

    const workPlaces = Array.isArray(profile?.workPlaces) ? profile.workPlaces : [];
    const schools = Array.isArray(profile?.schools) ? profile.schools : [];
    const presentAddress = profile?.presentAddress || "";
    const permanentAddress = profile?.permanentAddress || "";
    const bio = profile?.bio || "";
    const joinedAt = profile?.user?.createdAt || profile?.createdAt;

    if (!profile?._id) {
        return <ProfileAboutSkeleton />;
    }

    return (
        <Fragment>
            <div id="profile-details-list" className="details-list profile-details-card">
                {bio ? (
                    <div className="details-list-item">
                        <i className="fas fa-info-circle"></i>
                        <span>
                            <b>{bio}</b>
                        </span>
                    </div>
                ) : null}

                {workPlaces.map((workplace, index) => (
                    <div key={`wp-${index}`} className="details-list-item">
                        <i className="fas fa-briefcase"></i>
                        <span>
                            {workplace?.designation ? `${workplace.designation} at ` : ""}
                            <b>{workplace?.name || "Unknown workplace"}</b>
                        </span>
                    </div>
                ))}

                {schools.map((school, index) => (
                    <div className="details-list-item" key={`sc-${index}`}>
                        <i className="fas fa-graduation-cap"></i>
                        <span>
                            Studied at <b>{school?.name || "Unknown school"}</b>
                            {school?.degree ? (
                                <span className="details-muted"> ({school.degree})</span>
                            ) : null}
                        </span>
                    </div>
                ))}

                {presentAddress ? (
                    <div className="details-list-item">
                        <i className="fas fa-home"></i>
                        <span>
                            Lives in <b>{presentAddress}</b>
                        </span>
                    </div>
                ) : null}

                {permanentAddress ? (
                    <div className="details-list-item">
                        <i className="fas fa-globe"></i>
                        <span>
                            From <b>{permanentAddress}</b>
                        </span>
                    </div>
                ) : null}

                <div className="details-list-item">
                    <i className="fas fa-clock"></i>
                    <span>
                        Joined{" "}
                        <b>
                            {joinedAt ? (
                                <Moment format="MMMM YYYY">{joinedAt}</Moment>
                            ) : (
                                formatMonthYearFallback(joinedAt)
                            )}
                        </b>
                    </span>
                </div>
            </div>
        </Fragment>
    );
};

export default ProfileDetails;
