import React, { Fragment, useEffect, useState } from "react";
import { NavLink, Outlet, useParams, Link } from "react-router-dom";
import $ from 'jquery'
import api from "../api/api";
import { useSelector } from "react-redux";
import ProfileButtons from "../components/Profile/ProfileButtons";
import CoverPic from "../components/Profile/CoverPic";
import ProfilePic from "../components/Profile/ProfilePic";



let Profile = (props) => {
    let params = useParams()
    let myProfileData = useSelector(state => state.profile) || {}
    let myProfileId = myProfileData._id
    let [profileData, setProfileData] = useState(null)
    let [profileLoading, setProfileLoading] = useState(true)

    const profileIdentifier = params.profile
    const isAuth = profileData?._id === myProfileId || profileData?.username === myProfileData.username
    const isFriend = Array.isArray(myProfileData.friends) && myProfileData.friends.some(friendData => friendData._id === profileIdentifier)

    useEffect(() => {
        let active = true
        const fetchProfile = async () => {
            setProfileData(null)
            setProfileLoading(true)

            const hasMyProfileData = myProfileData && myProfileData._id
            const authProfile = profileIdentifier === myProfileId || profileIdentifier === myProfileData.username

            if (authProfile && hasMyProfileData) {
                if (active) {
                    setProfileData({ ...myProfileData })
                    setProfileLoading(false)
                }
                return
            }

            try {
                const res = await api.post('/profile', { profile: profileIdentifier })
                if (!active) return

                if (res.status === 200) {
                    const profileResponse = res.data?.profile || res.data
                    setProfileData(profileResponse)
                }
            } catch (e) {
                console.error('Failed to load profile:', e)
            } finally {
                if (active) {
                    setProfileLoading(false)
                }
            }
        }

        if (profileIdentifier) {
            fetchProfile()
        } else {
            setProfileLoading(false)
        }

        return () => {
            active = false
        }
    }, [profileIdentifier, myProfileId, myProfileData._id, myProfileData.username, myProfileData])


    let profilePath = profileData && profileData._id ? "/" + profileData._id + "/" : "/";

    const SkeletonLoader = () => (
        <div className="animate-pulse flex flex-col items-center space-y-4">
            <div className="w-24 h-24 rounded-full bg-gray-300"></div>
            <div className="w-40 h-6 bg-gray-300 rounded"></div>
            <div className="w-60 h-4 bg-gray-300 rounded"></div>
        </div>
    );

    // handle Active classes of profile Tab  menu
    let profileTabItemClick = (e) => {
        let target = $(e.currentTarget);

        target.siblings().removeClass('active')

    }

    return (
        <Fragment>

            <div id="profile">
                {(profileLoading && !profileData) ? (
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
                                    <div className="profile-name">
                                        <h3 className="full-name">{profileData.user && profileData.user.firstName} {profileData.user && profileData.user.surname} {profileData?.nickname && (<span className="nickname">({ profileData.nickname})</span>)}</h3>
                                        <div className="friends-count">
                                            <Link className='text-decoration-none' to={`/${profileData._id}/friends`}>
                                                {profileData.friends && profileData.friends.length} Friends
                                            </Link>
                                        </div>
                                    </div>
                                    <ProfileButtons profileData={profileData} isAuth={isAuth} isFriend={isFriend}></ProfileButtons>
                                </div>
                            </div>
                            <div className="profile-info-tab-navigator">
                                <div className="header-nav-menu">
                                    <div className="header-nav-menu-container">
                                        <NavLink to={profilePath} onClick={profileTabItemClick} className="header-nav-menu-item">Posts</NavLink>
                                        <NavLink to={profilePath + "about"} onClick={profileTabItemClick} className="header-nav-menu-item">About</NavLink>
                                        <NavLink to={profilePath + "friends"} onClick={profileTabItemClick} className="header-nav-menu-item"> Friends</NavLink>
                                        <NavLink to={profilePath + "images"} onClick={profileTabItemClick} className="header-nav-menu-item">Images</NavLink>
                                        <NavLink to={profilePath + "videos"} onClick={profileTabItemClick} className="header-nav-menu-item">Videos</NavLink>
                                    </div>
                                </div>
                                <div className="options-menu">
                                    <i className="fa fa-ellipsis-h"></i>
                                </div>
                            </div>
                        </div>
                        <div className="profile-content-container">
                            <Outlet />
                        </div>
                    </>
                )}
            </div>


        </Fragment>
    )
}

export default Profile
