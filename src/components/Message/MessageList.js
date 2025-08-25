import React, { Fragment, useEffect, useState, useRef, useCallback } from "react";
import UserPP from "../UserPP";
import api from "../../api/api";
import { useSelector } from "react-redux";
import { Link, useParams, useLocation, useNavigate } from "react-router-dom";
import socket from "../../common/socket";
import Moment from "react-moment";
import MsgListSkleton from "../../skletons/message/MsgListSkleton";
let isProfileActive = (id) => {
    return true
    socket.emit('is_active', { profileId: id, myId: profileId })
    socket.on('is_active', (isUserActive) => {
        return () => {
            return isUserActive;
        }
    })


}

function truncateString(str, maxLength) {
    return str.length > maxLength ? str.slice(0, maxLength) + '...' : str
}


let userInfo = JSON.parse((localStorage.getItem('user') || '{}'))
const profileId = userInfo.profile
const MessageList = () => {
    // const [isActive, setIsActive] = useState(false);
    const [activeFriends, setActiveFriends] = useState([]);
    const [contactPerson, setContactPerson] = useState({});
    const [contactMessages, setContactMessages] = useState([])
    const [messageOption, setMessageOption] = useState(false)
    const messageMenuRef = useRef()
    let params = useParams();
    let myProfile = useSelector(state => state.profile)
    let myId = myProfile._id
    let myContacts = useSelector(state => state.message)
    let navigate = useNavigate();
    useEffect(() => {

        if (myContacts.length == 0) return;

        myContacts && myContacts.map((contact, index) => {

            setContactPerson(contact.person)
            setContactMessages(contact.messages)

            // alert(contactPerson._id)
            // alert(contact?.person._id)
            socket.emit('is_active', { profileId: contact?.person._id, myId: profileId })
            socket.on('is_active', (isUserActive, lastLogin, activeProfileId) => {
                if (isUserActive === true) {
                    // alert(activeProfileId)
                    if (!activeFriends.includes(activeProfileId)) {
                        return setActiveFriends([...activeFriends, activeProfileId])
                    }
                }

            })
            // return () => socket.off('is_active');

        })

        return () => socket.off('is_active');

    }, [myContacts])

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (MessageOptionMenu.current && !MessageOptionMenu.current.contains(event.target)) {
                setMessageOption(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    let markAllMsgAsRead = useCallback(async (e) => {
        return;
    }, [])

    let handleMsgOptionClick = useCallback(async (e) => {
        // if (messageOption) {
        //     setMessageOption(false)

        // }
        setMessageOption(!messageOption)
    }, [])

    let goToLink = useCallback(e => {
        navigate(`/message/${e.currentTarget.dataset.id}`)
    }, [])


    let MessageOptionMenu = () => {
        return (
            <div className="header-message-option-menu" style={{ position: 'relative', display: 'inline-block' }} ref={messageMenuRef}>


                {messageOption && (
                    <div style={{
                        position: 'absolute',
                        top: '15px',
                        right: '0',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                        zIndex: 99999999999999999,
                        width: '200px'
                    }}>
                        <ul className="message-option-menu" style={{ listStyle: 'none', margin: 0, padding: '8px 0' }}>
                            <li onClick={markAllMsgAsRead} style={{ padding: '8px 16px', cursor: 'pointer' }}>Mark All As Read</li>
                            {/* <li onClick={handleNotiDelete} style={{ padding: '8px 16px', cursor: 'pointer' }}>Delete All</li> */}
                            <li style={{ padding: '8px 16px', cursor: 'pointer' }}><Link to={'/settings/message'}>Message Settings</Link></li>


                        </ul>
                    </div>
                )}
            </div>
        );
    }


    return (
        <Fragment>
            <div className={"left-sidebar-container"}>
                <div className={"message-leftside-header"}>
                    <h2 className={"message-leftside-title"}>
                        Chats
                    </h2>
                    <div className={"message-sidebar-header-menu"}>
                        <div onClick={handleMsgOptionClick} className={"header-menu-icons"}>
                            <i className={"far fa-ellipsis-h"}></i>
                            {messageOption && <MessageOptionMenu />}
                        </div>
                    </div>
                </div>
                <div className={"message-list-container"}>
                    <ul className={"message-list"}>
                         {/* <div style={{ textDecoration: 'none' }} data-id={'ai-chat'} onClick={goToLink.bind(this)}>
                            <li className={`message-list-item message-seen'} ${'ai-chat' == params.profile ? 'active' : ''}`}>
                                <div className={"user-profilePic"}>
                                    <UserPP profilePic={'https://programmerikram.com/wp-content/uploads/2025/05/ics_logo.png'}  active={true}></UserPP>
                                </div>
                                <div className={'user-data'}>
                                    <h4 className={"message-author-name"}>Ai Chat</h4>
                                    <p className={"last-message-data"}>
                                        <span className={"last-message"}>{truncateString(contactMessages && contactMessages[0]?.message || '', 45)} </span>
                                        {contactMessages && contactMessages.length > 0 ? (<span className={"last-msg-time"}>| <Moment fromNow>{contactMessages && contactMessages[0].timestamp}</Moment></span>) : <></>}
                                    </p>
                                </div>
                            </li>
                        </div> */}
                        {
                            myContacts.length > 0 ? myContacts.map((contactItem, index) => {
                                let contactPerson = (contactItem.person)
                                let contactMessages = (contactItem.messages || [])
                                let authorFullName = contactPerson?.fullName
                                let isMsgSeen = (contactMessages[0] ? (contactMessages[0].isSeen && contactMessages[0].receiverId == myId ? true : contactMessages[0].isSeen) : true)
                                let isFrndActive = activeFriends.includes(contactPerson._id)
                                return <div key={index} style={{ textDecoration: 'none' }} data-id={contactPerson._id} onClick={goToLink.bind(this)}>
                                    <li className={`message-list-item ${isMsgSeen ? 'message-seen' : 'message-unseen'} ${contactPerson._id == params.profile ? 'active' : ''}`}>
                                        <div className={"user-profilePic"}>
                                            <UserPP profilePic={contactPerson.profilePic} profile={contactPerson._id} active={isFrndActive}></UserPP>
                                        </div>
                                        <div className={'user-data'}>
                                            <h4 className={"message-author-name"}>{authorFullName}</h4>
                                            <p className={"last-message-data"}>
                                                <span className={"last-message"}>{truncateString(contactMessages && contactMessages[0]?.message || '', 45)} </span>
                                                {contactMessages && contactMessages.length > 0 ? (<span className={"last-msg-time"}>| <Moment fromNow>{contactMessages && contactMessages[0].timestamp}</Moment></span>) : <></>}
                                            </p>
                                        </div>
                                    </li>
                                </div>

                            }) : <MsgListSkleton count={5} /> // <h4 className={"data-not-found"}>No Message List to Show</h4>
                        }

                    </ul>
                </div>
            </div>

        </Fragment>
    )
}

export default MessageList;