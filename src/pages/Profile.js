import React, { Fragment, useEffect, useState } from "react";
import { NavLink, Outlet, useParams, Link, useNavigate, useLocation } from "react-router-dom";
import { fetchProfileCached, fetchProfilePostsCached } from "../utils/requestCache";
import { useSelector } from "react-redux";
import api from "../api/api";
import ProfileButtons from "../components/Profile/ProfileButtons";
import CoverPic from "../components/Profile/CoverPic";
import ProfilePic from "../components/Profile/ProfilePic";
import OptionsDropdown from "../components/post/OptionsDropdown";
import ReportModal from "../components/modal/ReportModal";
import ProfilePageSkeleton from "../skletons/profile/ProfilePageSkeleton";
import "./Profile.css";

const formatFriendsCount = (count) => {
    if (!count) return "";
    return `${count} friend${count === 1 ? "" : "s"}`;
};

const Profile = () => {
    const params = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const myProfileData = useSelector((state) => state.profile) || {};
    const myProfileId = myProfileData._id;
    const [profileData, setProfileData] = useState(null);
    const [profileLoading, setProfileLoading] = useState(true);
    const [isProfileOption, setIsProfileOption] = useState(false);
    const [isReportOpen, setIsReportOpen] = useState(false);
    const [showFullBio, setShowFullBio] = useState(false);
    const [tabCounts, setTabCounts] = useState({
        posts: 0,
        friends: 0,
        images: 0,
        videos: 0,
    });

    const profileIdentifier = params.profile;
    const isOwnProfile =
        profileIdentifier === myProfileId || profileIdentifier === myProfileData.username;
    const isAuth = Boolean(
        profileData && (profileData._id === myProfileId || profileData.username === myProfileData.username)
    );
    const isFriend =
        Array.isArray(myProfileData.friends) &&
        myProfileData.friends.some((friendData) => friendData._id === profileData?._id);

    useEffect(() => {
        let active = true;
        const fetchProfile = async () => {
            setShowFullBio(false);

            const hasMyProfileData = myProfileData && myProfileData._id;
            const authProfile =
                profileIdentifier === myProfileId || profileIdentifier === myProfileData.username;

            if (authProfile && hasMyProfileData) {
                if (active) {
                    setProfileData({ ...myProfileData });
                    setProfileLoading(false);
                }
                return;
            }

            setProfileData(null);
            setProfileLoading(true);

            try {
                const profileResponse = await fetchProfileCached(profileIdentifier, {
                    ttlMs: 60000,
                    storageTtlMs: 300000,
                });
                if (!active) return;

                if (profileResponse) {
                    setProfileData(profileResponse);
                }
            } catch (e) {
                console.error("Failed to load profile:", e);
            } finally {
                if (active) {
                    setProfileLoading(false);
                }
            }
        };

        if (profileIdentifier) {
            fetchProfile();
        } else {
            setProfileLoading(false);
        }

        return () => {
            active = false;
        };
    }, [profileIdentifier, myProfileId, myProfileData.username]);

    useEffect(() => {
        if (!isOwnProfile || !myProfileData?._id) return;
        setProfileData({ ...myProfileData });
    }, [isOwnProfile, myProfileData]);

    useEffect(() => {
        if (!profileData?._id) return;
        let active = true;

        const loadTabCounts = async () => {
            try {
                const [posts, friendsRes, imagesRes, videosRes] = await Promise.all([
                    fetchProfilePostsCached(profileData._id, { ttlMs: 60000, storageTtlMs: 180000 }),
                    api.get("/friend/getFriends", { params: { profile: profileData._id } }),
                    api.get("/profile/getImages", { params: { profileId: profileData._id } }),
                    api.get("/watch/profileWatch", { params: { profile: profileData._id, pageNumber: 1 } }),
                ]);

                if (!active) return;

                const friendsList = Array.isArray(friendsRes.data) ? friendsRes.data : [];
                const imageList = Array.isArray(imagesRes.data)
                    ? imagesRes.data.filter((item) => item?.photos)
                    : [];
                const videoPayload = videosRes.data?.watchs || videosRes.data || [];
                const videoList = Array.isArray(videoPayload) ? videoPayload : [];

                setTabCounts({
                    posts: Array.isArray(posts) ? posts.length : 0,
                    friends: friendsList.length || (Array.isArray(profileData.friends) ? profileData.friends.length : 0),
                    images: imageList.length,
                    videos: videoList.length,
                });
            } catch (error) {
                if (!active) return;
                setTabCounts((prev) => ({
                    ...prev,
                    friends: Array.isArray(profileData.friends) ? profileData.friends.length : prev.friends,
                }));
            }
        };

        loadTabCounts();
        return () => {
            active = false;
        };
    }, [profileData?._id]);

    const profilePath = profileData && profileData._id ? `/${profileData._id}/` : "/";
    const friendsCount = Array.isArray(profileData?.friends)
        ? profileData.friends.length
        : tabCounts.friends;
    const displayName =
        profileData?.fullName ||
        [profileData?.user?.firstName, profileData?.user?.surname].filter(Boolean).join(" ").trim() ||
        "Profile";
    const bio = profileData?.bio || "";

    const handleBack = () => {
        if (window.history.length > 1) {
            navigate(-1);
        } else {
            navigate("/");
        }
    };

    const lastPathSegment = (location.pathname || "").replace(/\/+$/, "").split("/").filter(Boolean).pop();
    const isAboutTab =
        lastPathSegment === "about" ||
        lastPathSegment === profileIdentifier ||
        lastPathSegment === profileData?._id;

    const tabClassName = ({ isActive }) =>
        `header-nav-menu-item${isActive ? " active" : ""}`;

    return (
        <Fragment>
            <div id="profile" className={`profile-page${isAuth || isOwnProfile ? "" : " is-friend"}`}>
                {(profileLoading && !profileData) ? (
                    <ProfilePageSkeleton showBackHeader={!isOwnProfile} />
                ) : !profileData ? (
                    <div className="profile-empty-placeholder">
                        <p className="text-center">Profile not found.</p>
                    </div>
                ) : (
                    <div className="profile-shell">
                        {!isAuth && (
                            <div className="profile-page-nav">
                                <button
                                    type="button"
                                    className="profile-back-btn"
                                    onClick={handleBack}
                                    aria-label="Back"
                                >
                                    <i className="fas fa-arrow-left" />
                                </button>
                                <h1 className="profile-page-nav-title">Profile</h1>
                            </div>
                        )}

                        <div className="profile-header">
                            <CoverPic profileData={profileData}></CoverPic>
                            <div className="profile-info-container">
                                <ProfilePic profileData={profileData}></ProfilePic>
                                <div className="profile-info">
                                    <div className="profile-name">
                                        <h3 className="full-name">{displayName}</h3>
                                        {friendsCount > 0 && (
                                            <div className="friends-count">
                                                <Link className="text-decoration-none" to={`${profilePath}friends`}>
                                                    {formatFriendsCount(friendsCount)}
                                                </Link>
                                            </div>
                                        )}
                                    </div>

                                    <div className="profile-bio-section">
                                        {bio ? (
                                            <>
                                                <p className={`bio-text${showFullBio ? "" : " is-clamped"}`}>{bio}</p>
                                                {bio.length > 100 && (
                                                    <button
                                                        type="button"
                                                        className="profile-bio-toggle"
                                                        onClick={() => setShowFullBio((open) => !open)}
                                                    >
                                                        {showFullBio ? "Show Less" : "Show More"}
                                                    </button>
                                                )}
                                            </>
                                        ) : (
                                            <p className="bio-placeholder">
                                                {isAuth
                                                    ? "Add a bio to tell people about yourself"
                                                    : "No bio added yet"}
                                            </p>
                                        )}
                                        {isAuth && (
                                            <button
                                                type="button"
                                                className="profile-edit-bio"
                                                onClick={() => navigate("/settings")}
                                            >
                                                <i className="fas fa-pen" />
                                                Edit Bio
                                            </button>
                                        )}
                                    </div>

                                    <ProfileButtons
                                        key={profileData._id}
                                        profileData={profileData}
                                        isAuth={isAuth}
                                        isFriend={isFriend}
                                    />
                                </div>
                            </div>
                            <div className="profile-info-tab-navigator">
                                <div className="header-nav-menu">
                                    <div className="header-nav-menu-container">
                                        <NavLink
                                            to={profilePath}
                                            end
                                            className={() => `header-nav-menu-item${isAboutTab ? " active" : ""}`}
                                        >
                                            About
                                        </NavLink>
                                        <NavLink to={`${profilePath}posts`} className={tabClassName}>
                                            Posts
                                            {tabCounts.posts > 0 && (
                                                <span className="profile-tab-count">{tabCounts.posts}</span>
                                            )}
                                        </NavLink>
                                        <NavLink to={`${profilePath}friends`} className={tabClassName}>
                                            Friends
                                            {(tabCounts.friends || friendsCount) > 0 && (
                                                <span className="profile-tab-count">
                                                    {tabCounts.friends || friendsCount}
                                                </span>
                                            )}
                                        </NavLink>
                                        <NavLink to={`${profilePath}images`} className={tabClassName}>
                                            Images
                                            {tabCounts.images > 0 && (
                                                <span className="profile-tab-count">{tabCounts.images}</span>
                                            )}
                                        </NavLink>
                                        <NavLink to={`${profilePath}videos`} className={tabClassName}>
                                            Videos
                                            {tabCounts.videos > 0 && (
                                                <span className="profile-tab-count">{tabCounts.videos}</span>
                                            )}
                                        </NavLink>
                                    </div>
                                </div>
                                <div className="options-menu-wrap">
                                    <OptionsDropdown
                                        open={isProfileOption}
                                        onToggle={() => setIsProfileOption((prev) => !prev)}
                                        onClose={() => setIsProfileOption(false)}
                                        ariaLabel="Profile options"
                                        buttonClassName="options-menu"
                                        menuClassName="post-option-menu"
                                        iconClassName="fa fa-ellipsis-h"
                                    >
                                        {!isAuth ? (
                                            <ul>
                                                <li
                                                    onClick={() => {
                                                        setIsProfileOption(false);
                                                        setIsReportOpen(true);
                                                    }}
                                                >
                                                    Report this profile
                                                </li>
                                            </ul>
                                        ) : (
                                            <ul>
                                                <li onClick={() => navigate("/settings")}>Edit profile</li>
                                            </ul>
                                        )}
                                    </OptionsDropdown>
                                </div>
                            </div>
                        </div>
                        <div className="profile-content-container">
                            <Outlet context={{ profileData, isAuth }} />
                        </div>
                    </div>
                )}
            </div>

            {isReportOpen && profileData?._id && (
                <ReportModal
                    isOpen={isReportOpen}
                    onRequestClose={() => setIsReportOpen(false)}
                    type="profile"
                    targetId={profileData._id}
                    targetLabel={
                        [profileData.user?.firstName, profileData.user?.surname].filter(Boolean).join(" ") ||
                        profileData.displayName ||
                        "this profile"
                    }
                />
            )}
        </Fragment>
    );
};

export default Profile;
