import React, { Fragment, useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import UserPP from '../../components/UserPP';
import api from '../../api/api';
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
    const messageIntervalRef = useRef(null);
    const statusIntervalRef = useRef(null);

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

    // Get online status from contacts data (no separate API calls)
    const getOnlineStatusFromContacts = (profileId) => {
        try {
            const contactsData = localStorage.getItem('contactsData');
            if (contactsData) {
                const contacts = JSON.parse(contactsData);
                const friendContact = contacts.find(c => c.person?._id === profileId);
                if (friendContact) {
                    return friendContact.isOnline || false;
                }
            }
        } catch (error) {
            console.error('Error getting online status from contacts:', error);
        }
        return false;
    };

    // On-demand online status checking (only when opening chat)
    const checkOnlineStatusOnDemand = async (profileId) => {
        try {
            // First try to get from contacts data
            const statusFromContacts = getOnlineStatusFromContacts(profileId);
            if (statusFromContacts !== undefined) {
                return statusFromContacts;
            }
            
            // Fallback to API call only if not found in contacts
            const response = await api.get('/profile/online-status', {
                params: { profileId }
            });
            return response.data.isActive || false;
        } catch (error) {
            console.error('Error checking online status:', error);
            return false;
        }
    };

    // HTTP-based message checking for sorting - memoized to prevent recreation
    const checkForNewMessages = useCallback(async () => {
        if (!myProfile._id) return;
        try {
            const response = await api.get('/message/new-messages-count', {
                params: { profileId: myProfile._id }
            });
            if (response.data.hasNewMessages) {
                setTriggerUpdate(prev => prev + 1);
            }
        } catch (error) {
            console.error('Error checking for new messages:', error);
        }
    }, [myProfile._id]);

    useEffect(() => {
        if (!myProfile._id || !myProfile.friends || !Array.isArray(myProfile.friends)) {
            // Clear intervals if profile is not available
            if (messageIntervalRef.current) {
                clearInterval(messageIntervalRef.current);
                messageIntervalRef.current = null;
            }
            if (statusIntervalRef.current) {
                clearInterval(statusIntervalRef.current);
                statusIntervalRef.current = null;
            }
            return;
        }

        // Clear any existing intervals before creating new ones
        if (messageIntervalRef.current) {
            clearInterval(messageIntervalRef.current);
            messageIntervalRef.current = null;
        }
        if (statusIntervalRef.current) {
            clearInterval(statusIntervalRef.current);
            statusIntervalRef.current = null;
        }

        // Get online status from contacts data (no API calls)
        const setOnlineStatusFromContacts = () => {
            try {
                const contactsData = localStorage.getItem('contactsData');
                if (contactsData) {
                    const contacts = JSON.parse(contactsData);
                    const onlineFriends = contacts
                        .filter(contact => contact.isOnline && contact.person?._id)
                        .map(contact => contact.person._id);
                    setActiveFriends(onlineFriends);
                }
            } catch (error) {
                console.error('Error setting online status from contacts:', error);
            }
        };

        setOnlineStatusFromContacts();

        // Refresh online status every 2 minutes (aligned with contacts refresh)
        statusIntervalRef.current = setInterval(setOnlineStatusFromContacts, 120000);

        // Poll for new messages every 30 seconds (reduced frequency to prevent loops)
        messageIntervalRef.current = setInterval(checkForNewMessages, 30000);

        return () => {
            if (statusIntervalRef.current) {
                clearInterval(statusIntervalRef.current);
                statusIntervalRef.current = null;
            }
            if (messageIntervalRef.current) {
                clearInterval(messageIntervalRef.current);
                messageIntervalRef.current = null;
            }
        };
    }, [myProfile._id, checkForNewMessages])

    // Remove duplicate message polling since it's already handled above

    let redirectToMessage = async (e) => {
        let profileId = e.currentTarget.dataset.profile

        // Check online status on-demand when opening chat
        const isOnline = await checkOnlineStatusOnDemand(profileId);
        
        // Update active friends state with fresh status
        if (isOnline && !activeFriends.includes(profileId)) {
            setActiveFriends(prev => [...prev, profileId]);
        } else if (!isOnline && activeFriends.includes(profileId)) {
            setActiveFriends(prev => prev.filter(id => id !== profileId));
        }

        // Dispatch custom event to open sticky chat box
        const event = new CustomEvent('openStickyChat', {
            detail: { profileId, isOnline }
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