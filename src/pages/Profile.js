import React, { Fragment, useEffect, useState } from "react";
import { NavLink, Outlet, useParams, Link } from "react-router-dom";
import $ from "jquery";
import { fetchProfileCached } from "../utils/requestCache";
import api from "../api/api";
import { useSelector } from "react-redux";
import ProfileButtons from "../components/Profile/ProfileButtons";
import CoverPic from "../components/Profile/CoverPic";
import ProfilePic from "../components/Profile/ProfilePic";
import OptionsDropdown from "../components/post/OptionsDropdown";
import ReportModal from "../components/modal/ReportModal";
import VerifiedName from "../components/feed/VerifiedName";

let Profile = (props) => {
  let params = useParams();
  let myProfileData = useSelector((state) => state.profile) || {};
  let myProfileId = myProfileData._id;
  let [profileData, setProfileData] = useState(null);
  let [profileLoading, setProfileLoading] = useState(true);
  let [loadedProfileIdentifier, setLoadedProfileIdentifier] = useState(null);
  let [relationshipTypes, setRelationshipTypes] = useState([]);
  let [isProfileOption, setIsProfileOption] = useState(false);
  let [isReportOpen, setIsReportOpen] = useState(false);

  const profileIdentifier = params.profile;
  const isAuth =
    profileData?._id === myProfileId ||
    profileData?.username === myProfileData.username;
  const isConnect =
    Array.isArray(myProfileData.connects) &&
    myProfileData.connects.some(
      (connectData) => String(connectData?._id || connectData) === String(profileData?._id || profileIdentifier),
    );

  useEffect(() => {
    let active = true;
    const fetchProfile = async () => {
      setProfileData(null);
      setProfileLoading(true);
      setLoadedProfileIdentifier(null);

      const hasMyProfileData = myProfileData && myProfileData._id;
      const authProfile =
        profileIdentifier === myProfileId ||
        profileIdentifier === myProfileData.username;

      if (authProfile && hasMyProfileData) {
        if (active) {
          setProfileData({ ...myProfileData });
          setLoadedProfileIdentifier(profileIdentifier);
          setProfileLoading(false);
        }
        return;
      }

      try {
        const profileResponse = await fetchProfileCached(profileIdentifier, {
          ttlMs: 60000,
          storageTtlMs: 300000,
        });
        if (!active) return;

        if (profileResponse) {
          setProfileData(profileResponse);
        }
        setLoadedProfileIdentifier(profileIdentifier);
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
      setProfileData(null);
      setLoadedProfileIdentifier(null);
      setProfileLoading(false);
    }

    return () => {
      active = false;
    };
  }, [profileIdentifier, myProfileId, myProfileData.username]);

  useEffect(() => {
    let active = true;
    setRelationshipTypes([]);
    if (!profileData?._id || isAuth || !isConnect) return () => { active = false; };

    api.get("/connects/relationships", {
      params: { profileId: profileData._id, _t: Date.now() },
    }).then((response) => {
      if (active) {
        setRelationshipTypes(Array.isArray(response.data?.relationTypes)
          ? response.data.relationTypes
          : []);
      }
    }).catch((error) => {
      if (active) {
        console.error("Failed to load profile relationships:", error);
      }
    });

    return () => { active = false; };
  }, [profileData?._id, isAuth, isConnect]);

  let profilePath =
    profileData && profileData._id ? "/" + profileData._id + "/" : "/";

  const SkeletonLoader = () => (
    <div className="animate-pulse flex flex-col items-center space-y-4">
      <div className="w-24 h-24 rounded-full bg-gray-300"></div>
      <div className="w-40 h-6 bg-gray-300 rounded"></div>
      <div className="w-60 h-4 bg-gray-300 rounded"></div>
    </div>
  );

  const isRequestedProfileLoaded =
    loadedProfileIdentifier === profileIdentifier;

  // handle Active classes of profile Tab  menu
  let profileTabItemClick = (e) => {
    let target = $(e.currentTarget);

    target.siblings().removeClass("active");
  };

  return (
    <Fragment>
      <div id="profile">
        {profileLoading || !isRequestedProfileLoaded ? (
          <div className="profile-loading-placeholder">
            <SkeletonLoader />
          </div>
        ) : !profileData ? (
          <div className="profile-loading-placeholder">
            <p className="text-center">Profile not found.</p>
          </div>
        ) : (
          <>
            <div className="profile-header">
              <CoverPic profileData={profileData}></CoverPic>
              <div className="profile-info-container">
                <ProfilePic profileData={profileData}></ProfilePic>
                <div className="profile-info">
                  <div className="profile-name mt-5">
                    <h3 className="full-name">
                      <VerifiedName profile={profileData}>
                        {profileData.user && profileData.user.firstName}{" "}
                        {profileData.user && profileData.user.surname}
                        {profileData?.nickname && (
                          <span className="nickname">
                            ({profileData.nickname})
                          </span>
                        )}
                      </VerifiedName>
                    </h3>
                    <div className="connects-count">
                      <Link
                        className="text-decoration-none"
                        to={`/${profileData._id}/connects`}
                      >
                        {profileData.connects && profileData.connects.length}{" "}
                        Connects
                      </Link>
                    </div>
                    {relationshipTypes.length > 0 && (
                      <div className="profile-relationship">
                        Relationship: {relationshipTypes.join(", ")}
                      </div>
                    )}
                    <div className="profile-follow-stats">
                      <span>
                        {profileData.followersCount ??
                          profileData.followers?.length ??
                          0}{" "}
                        Followers
                      </span>{" "}
                      <span> | </span>
                      <span>
                        {profileData.followingCount ??
                          profileData.following?.length ??
                          0}{" "}
                        Following
                      </span>
                    </div>
                  </div>
                  <ProfileButtons
                    profileData={profileData}
                    isAuth={isAuth}
                    isConnect={isConnect}
                  ></ProfileButtons>
                </div>
              </div>
              <div className="profile-info-tab-navigator">
                <div className="header-nav-menu">
                  <div className="header-nav-menu-container">
                    <NavLink
                      to={profilePath}
                      onClick={profileTabItemClick}
                      className="header-nav-menu-item"
                    >
                      Posts
                    </NavLink>
                    <NavLink
                      to={profilePath + "about"}
                      onClick={profileTabItemClick}
                      className="header-nav-menu-item"
                    >
                      About
                    </NavLink>
                    <NavLink
                      to={profilePath + "connects"}
                      onClick={profileTabItemClick}
                      className="header-nav-menu-item"
                    >
                      {" "}
                      Connects
                    </NavLink>
                    <NavLink
                      to={profilePath + "images"}
                      onClick={profileTabItemClick}
                      className="header-nav-menu-item"
                    >
                      Images
                    </NavLink>
                    <NavLink
                      to={profilePath + "videos"}
                      onClick={profileTabItemClick}
                      className="header-nav-menu-item"
                    >
                      Videos
                    </NavLink>
                  </div>
                </div>
                <div className="options-menu-wrap">
                  {!isAuth && (
                    <OptionsDropdown
                      open={isProfileOption}
                      onToggle={() => setIsProfileOption((prev) => !prev)}
                      onClose={() => setIsProfileOption(false)}
                      ariaLabel="Profile options"
                      buttonClassName="options-menu"
                      menuClassName="post-option-menu"
                      iconClassName="fa fa-ellipsis-h"
                    >
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
                    </OptionsDropdown>
                  )}
                </div>
              </div>
            </div>
            <div className="profile-content-container">
              <Outlet />
            </div>
          </>
        )}
      </div>

      {isReportOpen && profileData?._id && (
        <ReportModal
          isOpen={isReportOpen}
          onRequestClose={() => setIsReportOpen(false)}
          type="profile"
          targetId={profileData._id}
          targetLabel={
            [profileData.user?.firstName, profileData.user?.surname]
              .filter(Boolean)
              .join(" ") ||
            profileData.displayName ||
            "this profile"
          }
        />
      )}
    </Fragment>
  );
};

export default Profile;
