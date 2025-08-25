
import React, {Fragment, useCallback}  from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSelector,useDispatch } from 'react-redux';
import UserPP from '../../components/UserPP';

let LeftSidebar = () => {
    
    let profileData = useSelector(state => state.profile)
    let navigate = useNavigate();

    let userInfo = JSON.parse((localStorage.getItem('user')||'{}'))
    const profilePath = "/"+userInfo.profile+"/"

    let goToProfilePath = useCallback(e => {
        navigate(profilePath)
    },[Date.now()])


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
                                
                                <div className='ls-text user-name'>{profileData.user &&  profileData.user.firstName} {profileData.user && profileData.user.surname}</div>
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