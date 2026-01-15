import React, { Fragment, useEffect, useState, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import UserPP from '../../components/UserPP';
import socket from '../../common/socket';
import RsMenuItemSkleton from '../../skletons/rs/RsMenuItemSkleton';

let RightSidebar = () => {
    let params = useParams();
    let navigate = useNavigate();
    let userJson = localStorage.getItem('user') ? localStorage.getItem('user') : '{}'
    let { profile } = JSON.parse(userJson)
    let myProfile = useSelector(state => state.profile)
    let myContacts = useSelector(state => state.message) // Get contacts with messages from Redux
    const [activeFriends, setActiveFriends] = useState([]);
    const [triggerUpdate, setTriggerUpdate] = useState(0); // Force re-sort when messages update

    // Sort friends by last message timestamp
    const sortedFriendsData = useMemo(() => {
        if (!myProfile.friends || !Array.isArray(myProfile.friends)) return [];

        // Create a map of contact IDs to their last message timestamp
        const contactMessageMap = new Map();
        myContacts.forEach(contact => {
            if (contact?.person?._id && contact?.messages?.[0]?.timestamp) {
                contactMessageMap.set(
                    contact.person._id, 
                    new Date(contact.messages[0].timestamp).getTime()
                );
            }
        });

        // Sort friends: those with messages first (by timestamp), then those without messages
        const sorted = [...myProfile.friends].sort((a, b) => {
            const aTimestamp = contactMessageMap.get(a._id) || 0;
            const bTimestamp = contactMessageMap.get(b._id) || 0;
            
            // If both have messages, sort by timestamp (most recent first)
            if (aTimestamp > 0 && bTimestamp > 0) {
                return bTimestamp - aTimestamp;
            }
            // If only one has messages, prioritize it
            if (aTimestamp > 0) return -1;
            if (bTimestamp > 0) return 1;
            // If neither has messages, maintain original order
            return 0;
        });

        return sorted;
    }, [myProfile.friends, myContacts, triggerUpdate]);

    useEffect(() => {
        if (!myProfile.friends || !Array.isArray(myProfile.friends)) return;

        // Initial check for all friends
        myProfile.friends.forEach((friendProfile) => {
            socket.emit('is_active', { profileId: friendProfile._id, myId: myProfile._id })
        });

        const handleIsActive = (isUserActive, lastLogin, activeProfileId) => {
            if (!activeProfileId) return;
            
            if (isUserActive === true) {
                setActiveFriends(prev => {
                    if (!prev.includes(activeProfileId)) {
                        return [...prev, activeProfileId]
                    }
                    return prev;
                })
            } else {
                // Remove from active friends when they go offline
                setActiveFriends(prev => prev.filter(id => id !== activeProfileId));
            }
        };

        // Listen for real-time online/offline updates
        const handleFriendOnline = (data) => {
            const friendProfileId = data?.profileId;
            if (friendProfileId) {
                setActiveFriends(prev => {
                    if (!prev.includes(friendProfileId)) {
                        return [...prev, friendProfileId];
                    }
                    return prev;
                });
            }
        };

        const handleFriendOffline = (data) => {
            const friendProfileId = data?.profileId;
            if (friendProfileId) {
                setActiveFriends(prev => prev.filter(id => id !== friendProfileId));
            }
        };

        socket.on('is_active', handleIsActive);
        socket.on('friend_online', handleFriendOnline);
        socket.on('friend_offline', handleFriendOffline);
        
        // Listen for client-side friend_online events (when receiving messages)
        const handleFriendOnlineClient = (event) => {
            const friendProfileId = event.detail?.profileId;
            if (friendProfileId) {
                setActiveFriends(prev => {
                    if (!prev.includes(friendProfileId)) {
                        return [...prev, friendProfileId];
                    }
                    return prev;
                });
            }
        };
        
        window.addEventListener('friend_online_client', handleFriendOnlineClient);

        return () => {
            socket.off('is_active', handleIsActive);
            socket.off('friend_online', handleFriendOnline);
            socket.off('friend_offline', handleFriendOffline);
            window.removeEventListener('friend_online_client', handleFriendOnlineClient);
        };
    }, [myProfile._id, myProfile.friends])

    // Listen for new messages to update sorting in real-time
    useEffect(() => {
        const handleNewMessage = ({ updatedMessage }) => {
            // Trigger re-sort when a new message arrives
            setTriggerUpdate(prev => prev + 1);
        };

        socket.on('newMessage', handleNewMessage);
        socket.on('newMessageToUser', handleNewMessage);

        return () => {
            socket.off('newMessage', handleNewMessage);
            socket.off('newMessageToUser', handleNewMessage);
        };
    }, [])

    let redirectToMessage = (e) => {
        let profileId = e.currentTarget.dataset.profile
        
        // Dispatch custom event to open sticky chat box
        const event = new CustomEvent('openStickyChat', {
            detail: { profileId }
        });
        window.dispatchEvent(event);
    }

    return (
        <Fragment>
            <div id="right-sidebar" className='text-left'>
                <h3 className="rs-nav-title">Contacts</h3>
                <ul className="rs-nav-menu">
                    {
                        sortedFriendsData && sortedFriendsData.length > 0 ? sortedFriendsData.map((data, index) => {

                            let isFrndActive = activeFriends.includes(data._id);

                            return <li key={data._id || index}>
                                <div className='rs-nav-menu-item' data-profile={data._id} onClick={redirectToMessage.bind(this)}>
                                    <div className='rs-profile-img-container'>
                                        <div className='active-icon'></div>
                                        <div className='rs-profile-img'>
                                            <UserPP profilePic={`${data.profilePic}`} profile={data._id} active={isFrndActive}></UserPP>

                                        </div>
                                    </div>

                                    <div className='rs-text user-name'>{data.fullName ? data.fullName : data.user.firstName + ' ' + data.user.surname}</div>
                                </div>
                            </li>
                        }) :
                        <RsMenuItemSkleton count={10} />
                    }

                </ul>
            </div>
        </Fragment>
    )
}

export default RightSidebar;