
import React, { Fragment, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import UserPP from '../../components/UserPP';
import { SIDEBAR_MENU_ITEMS } from './sidebarMenuItems';

let LeftSidebar = () => {

    let profileData = useSelector(state => state.profile)
    let navigate = useNavigate();

    let userInfo = JSON.parse((localStorage.getItem('user') || '{}'))
    const profilePath = "/" + userInfo.profile + "/"

    let goToProfilePath = useCallback(e => {
        navigate(profilePath)
    }, [navigate, profilePath])

    const renderMenuItem = (item) => {
        const iconStyle = { color: item.accent || '#29B1A9', fontSize: '18px' };
        const content = (
            <div className='ls-nav-menu-item'>
                <div className='ls-icon' style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundImage: 'none' }}>
                    <i className={`fas ${item.icon}`} style={iconStyle} aria-hidden="true" />
                </div>
                <div className='ls-text'>{item.label}</div>
            </div>
        );

        if (item.disabled || !item.to) {
            return (
                <div className='text-decoration-none' style={{ opacity: 0.55, cursor: 'not-allowed' }} title="Coming soon">
                    {content}
                </div>
            );
        }

        return (
            <Link to={item.to} className='text-decoration-none'>
                {content}
            </Link>
        );
    };

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
                    {SIDEBAR_MENU_ITEMS.map((item) => (
                        <li key={item.id}>
                            {renderMenuItem(item)}
                        </li>
                    ))}
                </ul>
            </div>
        </Fragment>
    )
}

export default LeftSidebar;
