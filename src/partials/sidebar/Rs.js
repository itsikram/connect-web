import React, { Fragment, useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useSelector } from 'react-redux';
import UserPP from '../../components/UserPP';
import api from '../../api/api';
import RsMenuItemSkleton from '../../skletons/rs/RsMenuItemSkleton';

let RightSidebar = () => {
    let userJson = localStorage.getItem('user') ? localStorage.getItem('user') : '{}'
    let { profile } = JSON.parse(userJson)
    let myProfile = useSelector(state => state.profile)
    let myContacts = useSelector(state => state.message) // Get contacts with messages from Redux
    const [activeFriends, setActiveFriends] = useState([]);
    const [friendProfileStatusMap, setFriendProfileStatusMap] = useState({});
    const [triggerUpdate, setTriggerUpdate] = useState(0); // Force re-sort when messages update
    const messageIntervalRef = useRef(null);
    const statusIntervalRef = useRef(null);
    const effectiveProfileId = myProfile._id || profile;

    const getStoredContacts = useCallback(() => {
        if (!effectiveProfileId) return [];

        try {
            const cacheKey = `contactsData_${effectiveProfileId}`;
            const cached = localStorage.getItem(cacheKey) || localStorage.getItem('contactsData');
            if (!cached) return [];

            const parsed = JSON.parse(cached);
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            console.error('Error reading stored contacts:', error);
            return [];
        }
    }, [effectiveProfileId]);

    const contactsData = useMemo(() => {
        const reduxContacts = Array.isArray(myContacts) ? myContacts.filter(contact => contact?.person?._id) : [];
        if (reduxContacts.length > 0) {
            return reduxContacts;
        }

        return getStoredContacts();
    }, [myContacts, getStoredContacts]);

    const contactStatusMap = useMemo(() => {
        const statusMap = new Map();

        contactsData.forEach(contact => {
            if (contact?.person?._id) {
                statusMap.set(contact.person._id, {
                    isOnline: Boolean(contact.isOnline),
                    lastMessageTimestamp: contact?.messages?.[0]?.timestamp
                        ? new Date(contact.messages[0].timestamp).getTime()
                        : 0,
                });
            }
        });

        return statusMap;
    }, [contactsData]);

    // Sort friends by last message timestamp
    const sortedFriendsData = useMemo(() => {
        if (!myProfile.friends || !Array.isArray(myProfile.friends)) return [];

        // Create a map of contact IDs to their last message timestamp
        const contactMessageMap = new Map();
        contactStatusMap.forEach((status, profileId) => {
            if (status.lastMessageTimestamp) {
                contactMessageMap.set(profileId, status.lastMessageTimestamp);
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
    }, [myProfile.friends, contactStatusMap]);

    // Get online status from contacts data (same source used by message UI)
    const getOnlineStatusFromContacts = useCallback((profileId) => {
        const contactStatus = contactStatusMap.get(profileId);
        if (contactStatus) {
            return contactStatus.isOnline;
        }

        const storedContacts = getStoredContacts();
        const friendContact = storedContacts.find(contact => contact?.person?._id === profileId);
        if (friendContact) {
            return Boolean(friendContact.isOnline);
        }

        return undefined;
    }, [contactStatusMap, getStoredContacts]);

    const refreshOnlineStatuses = useCallback(async () => {
        const friends = Array.isArray(myProfile.friends) ? myProfile.friends : [];
        if (friends.length === 0) {
            setActiveFriends([]);
            setFriendProfileStatusMap({});
            return;
        }

        const cachedOnlineFriends = friends
            .map(friend => friend?._id)
            .filter(friendId => getOnlineStatusFromContacts(friendId) === true);

        if (cachedOnlineFriends.length > 0) {
            setActiveFriends(prev => {
                const merged = new Set([...(Array.isArray(prev) ? prev : []), ...cachedOnlineFriends]);
                return Array.from(merged);
            });
        }

        const statusResults = await Promise.allSettled(
            friends
                .filter(friend => friend?._id)
                .map(async (friend) => {
                    const response = await api.get('/profile', {
                        params: { profileId: friend._id }
                    });

                    return {
                        profileId: friend._id,
                        isOnline: Boolean(response?.data?.isActive),
                    };
                })
        );

        const nextStatusMap = {};
        const liveOnlineFriends = [];

        statusResults.forEach(result => {
            if (result.status === 'fulfilled' && result.value?.profileId) {
                nextStatusMap[result.value.profileId] = result.value.isOnline;
                if (result.value.isOnline) {
                    liveOnlineFriends.push(result.value.profileId);
                }
            }
        });

        setFriendProfileStatusMap(nextStatusMap);
        setActiveFriends(liveOnlineFriends);
    }, [myProfile.friends, getOnlineStatusFromContacts]);

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

        refreshOnlineStatuses();

        // Refresh online status regularly using live checks so RS matches chat header behavior
        statusIntervalRef.current = setInterval(refreshOnlineStatuses, 30000);

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
    }, [myProfile._id, myProfile.friends, refreshOnlineStatuses, checkForNewMessages])

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

                            const profileIsActive = friendProfileStatusMap[data._id];
                            let isFrndActive = Boolean(
                                profileIsActive !== undefined
                                    ? profileIsActive
                                    : data?.isActive !== undefined
                                        ? data.isActive
                                        : activeFriends.includes(data._id)
                            );
                            let displayName = data.fullName || [data.user?.firstName, data.user?.surname].filter(Boolean).join(' ');
                            if (!displayName) displayName = 'Unknown User';

                            return <li key={data._id || index}>
                                <div className='rs-nav-menu-item' data-profile={data._id} onClick={redirectToMessage.bind(this)}>
                                    <div className='rs-profile-img-container'>
                                        <div className='rs-profile-img'>
                                            <UserPP profilePic={`${data.profilePic}`} profile={data._id} size="full" active={isFrndActive}></UserPP>
                                        </div>
                                    </div>

                                    <div className='rs-text user-name'>{displayName}</div>
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
