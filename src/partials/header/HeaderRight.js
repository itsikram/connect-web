import React, { Fragment, useEffect, useState, useRef, useCallback } from "react";
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Moment from "react-moment";
import MegaMC from "../../components/MegaMC";
import UserPP from "../../components/UserPP";
import { logOut } from "../../services/actions/authActions";
import MessageList from "../../components/Message/MessageList";
import api from "../../api/api";
import { addNotification, addNotifications, viewNotification, viewNotifications, deleteNotifications } from "../../services/actions/notificationActions";
let userInfo = JSON.parse((localStorage.getItem('user') || '{}'))
const profilePath = "/" + userInfo.profile + "/"

let HeaderRight = ({ dispatch, useSelector }) => {
    let profileData = useSelector(state => state.profile)
    let optionData = useSelector(state => state.option)
    let notificaitonData = useSelector(state => state.notification)
    let messageData = useSelector(state => state.message)
    let [isMsgMenu, setIsMsgMenu] = useState(false);
    let [isProfileMenu, setIsProfileMenu] = useState(false);
    let [isNotificationMenu, setIsNotificationMenu] = useState(false);
    let [totalNotifications, setTotalNotifications] = useState(0)
    let [totalMessages, setTotalMessages] = useState(0)
    let location = useLocation();
    let [ppUrl, setPpUrl] = useState('https://programmerikram.com/wp-content/uploads/2025/03/default-profilePic.png')
    let navigate = useNavigate()

    const [notificationOption, setNotificationOption] = useState(false);
    const notficationOptionMenuRef = useRef(null);


    let notificationMenuHeight = optionData.bodyHeight - optionData.headerHeight - 100
    let notificationMenuStyle = { maxHeight: notificationMenuHeight + 'px', overflowY: 'scroll' }


    useEffect(() => {

        if (profileData?.profilePic) {
            setPpUrl(profileData.profilePic)
        }
    }, [profileData])

    useEffect(() => {
        setIsMsgMenu(false)
        setIsProfileMenu(false)
        setIsNotificationMenu(false)
    }, [location])

    useEffect(() => {
        let unseenNotifications = notificaitonData.filter(data => data.isSeen === false)
        setTotalNotifications(unseenNotifications.length)
    }, [notificaitonData])
    useEffect(() => {
        let unseenMessages = messageData.filter(data => {
            if (data.messages.length > 0) {

                if(  data.messages[0].isSeen == false) {
                    if(data.messages[0].receiverId == profileData._id) {
                        return true
                    }
                }
            }
            return;
        })
        setTotalMessages(unseenMessages.length)
    }, [messageData])

    let showMsgList = (e) => {
        setIsMsgMenu(!isMsgMenu)
        setIsProfileMenu(false)
        setIsNotificationMenu(false)
    }

    let clickProfileBtn = () => {
        setIsProfileMenu(!isProfileMenu)
        setIsMsgMenu(false)
        setIsNotificationMenu(false)
    }

    let showNotificationList = () => {
        setIsNotificationMenu(!isNotificationMenu)
        setIsProfileMenu(false)
        setIsMsgMenu(false)
    }

    let handleNotificationClick = useCallback(async (e) => {
        let notificationId = e.currentTarget.dataset.id
        let updatedNotification = await api.post('/notification/view', { notificationId })
        if (updatedNotification.status == 200) {
            dispatch(viewNotification(notificationId))
        }
    },[notificaitonData])

    let handleNotificationToggleClick = useCallback(async () => {
        if (notificationOption == true) {
            setNotificationOption(false)

        } else {
            setNotificationOption(true)

        }
    },[notificationOption])

    let markAllAsRead = useCallback(async (e) => {

        let unseenNotifications = notificaitonData.filter(noti => noti.isSeen == false);

        console.log(unseenNotifications)

        unseenNotifications.map(async (notification, index) => {

            let updatedNotification = await api.post('/notification/viewall', { profile: profileData._id })
            if (updatedNotification.status == 200) {
                dispatch(viewNotifications(notification))
            }
        })


    },[notificaitonData])

    let handleNotiDelete = useCallback(async (e) => {
        let deletedNotification = await api.post('/notification/deleteall', { profile: profileData._id })
        if (deletedNotification.status == 200) {
            dispatch(addNotifications([], true))
            setIsNotificationMenu(false)
        }

    },[notificaitonData])


    useEffect(() => {
        const handleClickOutside = (event) => {
            if (notficationOptionMenuRef.current && !notficationOptionMenuRef.current.contains(event.target)) {
                setNotificationOption(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    let goToProfilePath = useCallback(e => {
        navigate(profilePath)
    },[])


    let NoficationOptionMenu = () => {
        return (
            <div className="header-notification-option-menu" style={{ position: 'relative', display: 'inline-block' }} ref={notficationOptionMenuRef}>

                {notificationOption && (
                    <div style={{
                        position: 'absolute',
                        top: '20px',
                        right: '0',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                        zIndex: 99999999999999999,
                        width: '200px'
                    }}>
                        <ul className="notification-option-menu" style={{ listStyle: 'none', margin: 0, padding: '8px 0' }}>
                            <li onClick={markAllAsRead} style={{ padding: '8px 16px', cursor: 'pointer' }}>Mark All As Read</li>
                            <li onClick={handleNotiDelete} style={{ padding: '8px 16px', cursor: 'pointer' }}>Delete All</li>
                            <li style={{ padding: '8px 16px', cursor: 'pointer' }}><Link to={'/settings/notification'}>Notification Setting</Link></li>

                        </ul>
                    </div>
                )}
            </div>
        );
    }




    let logOutBtn = (e) => {
        // navigate('/login')
        localStorage.removeItem('user')
        // dispatch(logOut())
        window.location.reload();
    }
    return (
        <Fragment>
            <div className="header-quick-menu-container">
                <ul className="header-quick-menu">
                    <li onClick={showMsgList} className={`header-quick-menu-item ${isMsgMenu ? 'active' : ''}`} title="Message">
                        <div className="header-quick-menu-icon">
                            <i className="far fa-comment-alt-lines"></i>
                            {totalMessages > 0 && (<span className="hr-counter-badge"><span className="counter">{totalMessages}</span></span>)}
                        </div>
                    </li>
                    {
                        isMsgMenu && (
                            <MegaMC style={{ right: '50%', zIndex: 9999999999999, transform: 'translateX(50%)', top: '101%', width: '300px', backgroundColor: '#242526', borderRadius: '5px', display: 'block', boxShadow: '0px 0px 2px 0px rgba(255,255,255,0.3)' }} className="hr-mega-menu">
                                <MessageList />
                            </MegaMC>
                        )
                    }
                    <li onClick={showNotificationList} className={`header-quick-menu-item ${isNotificationMenu ? 'active' : ''}`} title="">
                        <div className="header-quick-menu-icon">
                            <i className="far fa-bell"></i>
                            {totalNotifications > 0 && (<span className="hr-counter-badge"><span className="counter">{totalNotifications}</span></span>)}
                        </div>
                    </li>
                    {isNotificationMenu && (
                        <MegaMC style={{ right: '50%', zIndex: 999999999999, transform: 'translateX(50%)', top: '101%', width: '300px', backgroundColor: '#242526', borderRadius: '5px', display: 'block', boxShadow: '0px 0px 2px 0px rgba(255,255,255,0.3)' }} className="hr-mega-menu">
                            <div className="hr-mm-container">
                                {
                                    notificaitonData.length > 0 ? (
                                        <div className="hr-notification-menu-container">
                                            <div className={"notification-leftside-header"}>
                                                <h2 className={"notification-leftside-title"}>
                                                    Notifications
                                                </h2>
                                                <div className={"notification-sidebar-header-menu"}>
                                                    <div onClick={handleNotificationToggleClick} className={"header-menu-icons"}>
                                                        <i className={"far fa-ellipsis-h"}></i>
                                                        {notificationOption && <NoficationOptionMenu />}
                                                    </div>
                                                </div>
                                            </div>
                                            <ul className="hr-notification-menu" style={notificationMenuStyle}>

                                                {
                                                    notificaitonData.map((notification, index) => {
                                                        return (<li className={`hr-notification-item ${notification.isSeen == false && 'unseen'}`} data-id={notification._id} onClick={handleNotificationClick.bind(this)} key={index}>
                                                            <Link to={notification.link || ''}>
                                                                <div className="hr-notification-row align-items-center">
                                                                    <div className="hr-notification-col-2">
                                                                        <div className="hr-notification-icon-continaer">
                                                                            <img className="hr-notification-icon" src={notification.icon} alt="Notification Icon" />
                                                                        </div>
                                                                    </div>
                                                                    <div className="hr-notification-col-10"> <p className="hr-notification-text">{notification.text} . <Moment fromNow>{notification.timestamp}</Moment></p></div>
                                                                </div>
                                                            </Link>
                                                        </li>)
                                                    })
                                                }


                                            </ul>
                                        </div>
                                    ) : (<p className="text-muted text-center mb-0">No Notification Found</p>)}

                            </div>
                        </MegaMC>
                    )}
                    <li onClick={clickProfileBtn} className="header-quick-menu-item item-profile" title="">
                        <div className="profile-pic">
                            <img src={ppUrl} alt="" />

                        </div>

                    </li>
                    {isProfileMenu && (
                        <MegaMC style={{ right: '50%', transform: 'translateX(50%)', top: '101%', width: '300px', backgroundColor: '#242526', borderRadius: '5px', display: 'block', boxShadow: '0px 0px 2px 0px rgba(255,255,255,0.3)' }} className="hr-mega-menu">
                            <div className="hr-mm-container">
                                <div onClick={goToProfilePath}>

                                    <div className="all-profiles">
                                        {
                                            profileData && <UserPP profilePic={ppUrl} />

                                        }
                                        <span className="text-capitalize"> {profileData.fullName ? profileData.fullName : profileData.user && profileData.user.firstName + ' ' + profileData.user.surname} </span>
                                    </div>
                                </div>
                                <div className="profile-menus">
                                    <Link to="/settings" className="profile-menu-item">
                                        <div className="menu-item-icon">
                                            <i className="fa fa-cog"></i>
                                        </div>
                                        <span className="menu-item-name">Settings</span>
                                    </Link>
                                    <Link onClick={logOutBtn} to={'#'} className="profile-menu-item">
                                        <div className="menu-item-icon">
                                            <i className="fa fa-sign-out-alt"></i>

                                        </div>
                                        <span className="menu-item-name">LogOut</span>
                                    </Link>

                                </div>

                            </div>
                        </MegaMC>
                    )}
                </ul>
            </div>
        </Fragment>
    )
}

export default HeaderRight