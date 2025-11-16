
import React, { Fragment, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import UserPP from '../../components/UserPP';

let LeftSidebar = () => {

    let profileData = useSelector(state => state.profile)
    let navigate = useNavigate();

    let userInfo = JSON.parse((localStorage.getItem('user') || '{}'))
    const profilePath = "/" + userInfo.profile + "/"

    let goToProfilePath = useCallback(e => {
        navigate(profilePath)
    }, [Date.now()])


    return (
        <Fragment>
            <div id="left-sidebar" className='text-left'>
                <ul className="ls-nav-menu">
                    <li>
                        <div onClick={goToProfilePath} className='text-decoration-none'>
                            <div className='ls-nav-menu-item'>
                                <div className='ls-profile-img'>
                                    <UserPP profilePic={profileData.profilePic} profile={profileData._id}></UserPP>
                                </div>

                                <div className='ls-text user-name'>{profileData.user && profileData.user.firstName} {profileData.user && profileData.user.surname}</div>
                            </div>
                        </div>

                    </li>
                    <li>
                        <Link to="/friends/" className='text-decoration-none'>
                            <div className='ls-nav-menu-item'>
                                <div className='ls-icon lsi-friends'>

                                </div>
                                <div className='ls-text'>
                                    Find Friends
                                </div>
                            </div>
                        </Link>
                    </li>
                    <li>
                        <Link to="/yt-download/" className='text-decoration-none'>
                            <div className='ls-nav-menu-item'>
                                <div className='ls-icon lsi-yt-download'>

                                </div>
                                <div className='ls-text'>
                                    YT Download
                                </div>
                            </div>
                        </Link>
                    </li>
                    <li>
                        <Link to="/ludo-game" className='text-decoration-none'>
                            <div className='ls-nav-menu-item'>
                                <div className='ls-icon lsi-ludo' style={{backgroundImage: 'unset'}}>
                                    <svg style={{transform: 'scale(0.7)'}} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
                                        <defs>
                                            <linearGradient id="bgGradient" x1="0" y1="0" x2="1" y2="1">
                                                <stop offset="0%" stopColor="#f9f9f9" />
                                                <stop offset="100%" stopColor="#e0e0e0" />
                                            </linearGradient>
                                            <filter id="shadow" x="-10%" y="-10%" width="130%" height="130%">
                                                <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#000" floodOpacity="0.15" />
                                            </filter>
                                        </defs>

                                        <rect width="512" height="512" rx="80" fill="url(#bgGradient)" />

                                        <rect x="40" y="40" width="190" height="190" rx="28" fill="#ff4d4d" filter="url(#shadow)" />
                                        <rect x="282" y="40" width="190" height="190" rx="28" fill="#4da6ff" filter="url(#shadow)" />
                                        <rect x="40" y="282" width="190" height="190" rx="28" fill="#33cc66" filter="url(#shadow)" />
                                        <rect x="282" y="282" width="190" height="190" rx="28" fill="#ffcc33" filter="url(#shadow)" />

                                        <rect x="206" y="206" width="100" height="100" rx="20" fill="#fff" stroke="#ccc" strokeWidth="3" filter="url(#shadow)" />

                                        <circle cx="256" cy="256" r="30" fill="#555" />

                                        <circle cx="256" cy="256" r="6" fill="#fff" />
                                        <circle cx="236" cy="236" r="6" fill="#fff" />
                                        <circle cx="276" cy="236" r="6" fill="#fff" />
                                        <circle cx="236" cy="276" r="6" fill="#fff" />
                                        <circle cx="276" cy="276" r="6" fill="#fff" />

                                        <rect x="20" y="20" width="472" height="472" rx="80" fill="none" stroke="#ccc" strokeWidth="4" />
                                    </svg>

                                </div>
                                <div className='ls-text'>
                                    Ludo Game
                                </div>
                            </div>
                        </Link>
                    </li>
                    <li>
                        <Link to="/downloads/" className='text-decoration-none'>
                            <div className='ls-nav-menu-item'>
                                <div className='ls-icon lsi-downloads'>

                                </div>
                                <div className='ls-text'>
                                    Saved Videos
                                </div>
                            </div>
                        </Link>
                    </li>
                    <li>
                        <Link to="/downloads/" className='text-decoration-none'>
                            <div className='ls-nav-menu-item'>
                                <div className='ls-icon lsi-group'>

                                </div>
                                <div className='ls-text'>
                                    Group
                                </div>
                            </div>
                        </Link>
                    </li>
                    <li>
                        <Link to="/watch/" className='text-decoration-none'>
                            <div className='ls-nav-menu-item'>
                                <div className='ls-icon lsi-watch'>

                                </div>
                                <div className='ls-text'>
                                    Watch
                                </div>
                            </div>
                        </Link>
                    </li>
                    <li>
                        <Link to="/marketplace/" className='text-decoration-none'>
                            <div className='ls-nav-menu-item'>
                                <div className='ls-icon lsi-mp'>

                                </div>
                                <div className='ls-text'>
                                    Marketplace
                                </div>
                            </div>
                        </Link>
                    </li>
                    <li>
                        <div className='ls-nav-menu-item'>
                            <div className='ls-icon lsi-memo'>

                            </div>
                            <div className='ls-text'>
                                Memories
                            </div>
                        </div>
                    </li>
                    <li>
                        <div className='ls-nav-menu-item'>
                            <div className='lsi-star'>

                            </div>
                            <div className='ls-text'>
                                Favourites
                            </div>
                        </div>
                    </li>
                    <li>
                        <div className='ls-nav-menu-item'>
                            <div className='ls-icon lsi-pages'>

                            </div>
                            <div className='ls-text'>
                                Pages
                            </div>
                        </div>
                    </li>
                    <li>
                        <div className='ls-nav-menu-item'>
                            <div className='ls-icon lsi-saved'>

                            </div>
                            <div className='ls-text'>
                                Saved
                            </div>
                        </div>
                    </li>




                    <li>
                        <div className='ls-nav-menu-item'>
                            <div className='lsi-card'>

                            </div>
                            <div className='ls-text'>
                                Orders & Payments
                            </div>
                        </div>
                    </li>

                </ul>
            </div>
        </Fragment>
    )
}

export default LeftSidebar;