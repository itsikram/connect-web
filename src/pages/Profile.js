import React, { Fragment, useEffect, useState } from "react";
import { NavLink, Outlet, useParams, Link } from "react-router-dom";
import $ from 'jquery'
import api from "../api/api";
import { useSelector, useDispatch } from "react-redux";
import ProfileButtons from "../components/Profile/ProfileButtons";
import CoverPic from "../components/Profile/CoverPic";
import ProfilePic from "../components/Profile/ProfilePic";
import { setLoading } from "../services/actions/optionAction";



let Profile = (props) => {
    let params = useParams()
    let dispatch = useDispatch()
    let myProfileData = useSelector(state => state.profile) || {}
    let myProfileId = myProfileData._id
    let [isAuth, setIsAuth] = useState(params.profile === myProfileId || params.profile == myProfileData.username? true : false)
    let [profileData, setProfileData] = useState(isAuth ? {  ...myProfileData  }: {})

    useEffect(() => {
        setIsAuth(params.profile === myProfileId? true : false)
        
        myProfileData.friends && myProfileData.friends.filter(friendData => {
            if (friendData._id === params.profile) {
                setIsFriend(true)
            }
        })
    },[myProfileData])

    let [isFriend, setIsFriend] = useState(false)

    // setting effects
    useEffect(() => {
        if(isAuth) return;
        dispatch(setLoading(true))

        try {

            api.post('/profile', { profile: params.profile }).then(res => {
                if (res.status === 200) {
                    setProfileData(res.data)
                    dispatch(setLoading(false))
                }

            }).catch(e => {
                console.log(e)
            })

        } catch (error) {
            console(error)
        }

    }, [params])


    let profilePath = "/" + profileData._id + "/"

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

                <div className="profile-header">
                    {profileData ? (<CoverPic profileData={profileData}></CoverPic>
                    ) :
                        (<SkeletonLoader />)
                    }
                    <div className="profile-info-container">

                        <ProfilePic profileData={profileData}></ProfilePic>
                        <div className="profile-info">
                            <div className="profile-name">
                                <h3 className="full-name">{profileData.user && profileData.user.firstName} {profileData.user && profileData.user.surname} {profileData?.nickname && (<span className="nickname">({ profileData.nickname})</span>)}</h3>
                                <div className="friends-count">
                                    <Link className='text-decoration-none' to={`/${profileData._id}/friends`}>
                                        {
                                            profileData.friends && profileData.friends.length
                                        } Friends
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
                                {/* <NavLink to="/profile/likes" onClick={profileTabItemClick} className="header-nav-menu-item">Likes</NavLink>
                                <NavLink to="/profile/events" onClick={profileTabItemClick} className="header-nav-menu-item">Events</NavLink> */}
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
            </div>


        </Fragment>
    )
}

export default Profile
