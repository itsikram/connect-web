import React, { Fragment, useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useSelector } from 'react-redux';
import UserPP from '../../components/UserPP';
import RsMenuItemSkleton from '../../skletons/rs/RsMenuItemSkleton';
import { fetchChatListCached, fetchOnlineStatusesCached } from '../../utils/requestCache';

let RightSidebar = () => {
    let userJson = localStorage.getItem('user') ? localStorage.getItem('user') : '{}'
    let { profile } = JSON.parse(userJson)
    let myProfile = useSelector(state => state.profile)
    let myContacts = useSelector(state => state.message) // Get contacts with messages from Redux
    const [activeFriends, setActiveFriends] = useState([]);
    const [friendProfileStatusMap, setFriendProfileStatusMap] = useState({});
    const [cachedContacts, setCachedContacts] = useState(() => {
        try {
            const userData = JSON.parse(localStorage.getItem('user') || '{}')
            const profileId = userData?.profile
            const cacheKey = profileId ? `contactsData_${profileId}` : 'contactsData'
            const cached = localStorage.getItem(cacheKey) || localStorage.getItem('contactsData')
            if (!cached) return []

            const parsed = JSON.parse(cached)
            return Array.isArray(parsed) ? parsed : []
        } catch (error) {
            console.error('Error reading cached RS contacts:', error)
            return []
        }
    });
    const statusIntervalRef = useRef(null);
    const contactsIntervalRef = useRef(null);
    const effectiveProfileId = myProfile._id || profile;
    const contactsCacheKey = effectiveProfileId ? `contactsData_${effectiveProfileId}` : 'contactsData';

    const persistContactsCache = useCallback((contacts) => {
        try {
            localStorage.setItem('contactsData', JSON.stringify(contacts));
            localStorage.setItem(contactsCacheKey, JSON.stringify(contacts));
        } catch (error) {
            console.error('Error caching RS contacts:', error);
        }
    }, [contactsCacheKey]);

    const getStoredContacts = useCallback(() => {
        try {
            const cached = localStorage.getItem(contactsCacheKey) || localStorage.getItem('contactsData');
            if (!cached) return [];

            const parsed = JSON.parse(cached);
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            console.error('Error reading stored contacts:', error);
            return [];
        }
    }, [contactsCacheKey]);

    const reduxContacts = useMemo(() => (
        Array.isArray(myContacts) ? myContacts.filter(contact => contact?.person?._id) : []
    ), [myContacts]);

    const contactsData = useMemo(() => {
        if (cachedContacts.length > 0) {
            return cachedContacts;
        }

        if (reduxContacts.length > 0) {
            return reduxContacts;
        }

        return getStoredContacts();
    }, [cachedContacts, reduxContacts, getStoredContacts]);

    const sidebarFriends = useMemo(() => {
        if (Array.isArray(myProfile.friends) && myProfile.friends.length > 0) {
            return myProfile.friends;
        }

        return contactsData
            .map(contact => contact?.person)
            .filter(friend => friend?._id);
    }, [myProfile.friends, contactsData]);

    const sidebarFriendIdsKey = useMemo(
        () => sidebarFriends.map((friend) => friend?._id).filter(Boolean).join(','),
        [sidebarFriends]
    );

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
        if (!sidebarFriends || !Array.isArray(sidebarFriends) || sidebarFriends.length === 0) return [];

        // Create a map of contact IDs to their last message timestamp
        const contactMessageMap = new Map();
        contactStatusMap.forEach((status, profileId) => {
            if (status.lastMessageTimestamp) {
                contactMessageMap.set(profileId, status.lastMessageTimestamp);
            }
        });

        // Sort friends: those with messages first (by timestamp), then those without messages
        const sorted = [...sidebarFriends].sort((a, b) => {
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
    }, [sidebarFriends, contactStatusMap]);

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

    const refreshContacts = useCallback(async () => {
        if (!effectiveProfileId) return;

        try {
            const nextContacts = await fetchChatListCached(effectiveProfileId, {
                ttlMs: 30000,
                storageTtlMs: 120000,
            });

            if (Array.isArray(nextContacts) && nextContacts.length > 0) {
                setCachedContacts(nextContacts);
                persistContactsCache(nextContacts);
            }
        } catch (error) {
            console.error('Error refreshing RS contacts:', error);
        }
    }, [effectiveProfileId, persistContactsCache]);

    useEffect(() => {
        if (reduxContacts.length === 0) return;
        setCachedContacts(reduxContacts);
        persistContactsCache(reduxContacts);
    }, [reduxContacts, persistContactsCache]);

    const refreshOnlineStatuses = useCallback(async () => {
        const friends = Array.isArray(sidebarFriends) ? sidebarFriends : [];
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

        const friendIds = friends.map((friend) => friend?._id).filter(Boolean);
        if (typeof document !== 'undefined' && document.hidden) {
            return;
        }
        const statuses = await fetchOnlineStatusesCached(friendIds, { ttlMs: 30000 });
        const nextStatusMap = {};
        const liveOnlineFriends = [];

        friendIds.forEach((profileId) => {
            const isOnline = Boolean(
                statuses[profileId]?.isActive ?? getOnlineStatusFromContacts(profileId)
            );
            nextStatusMap[profileId] = isOnline;
            if (isOnline) {
                liveOnlineFriends.push(profileId);
            }
        });

        setFriendProfileStatusMap(nextStatusMap);
        setActiveFriends(liveOnlineFriends);
    }, [sidebarFriends, getOnlineStatusFromContacts]);

    // On-demand online status checking (only when opening chat)
    const checkOnlineStatusOnDemand = useCallback(async (profileId) => {
        try {
            // First try to get from contacts data
            const statusFromContacts = getOnlineStatusFromContacts(profileId);
            if (statusFromContacts !== undefined) {
                return statusFromContacts;
            }

            const statuses = await fetchOnlineStatusesCached([profileId], { ttlMs: 30000 });
            return Boolean(statuses[profileId]?.isActive);
        } catch (error) {
            console.error('Error checking online status:', error);
            return false;
        }
    }, [getOnlineStatusFromContacts]);

    useEffect(() => {
        if (!effectiveProfileId || !sidebarFriends || !Array.isArray(sidebarFriends) || sidebarFriends.length === 0) {
            if (statusIntervalRef.current) {
                clearInterval(statusIntervalRef.current);
                statusIntervalRef.current = null;
            }
            if (contactsIntervalRef.current) {
                clearInterval(contactsIntervalRef.current);
                contactsIntervalRef.current = null;
            }
            return;
        }

        if (statusIntervalRef.current) {
            clearInterval(statusIntervalRef.current);
            statusIntervalRef.current = null;
        }
        if (contactsIntervalRef.current) {
            clearInterval(contactsIntervalRef.current);
            contactsIntervalRef.current = null;
        }

        if (reduxContacts.length === 0) {
            refreshContacts();
        }
        contactsIntervalRef.current = setInterval(refreshContacts, 300000);

        refreshOnlineStatuses();
        statusIntervalRef.current = setInterval(refreshOnlineStatuses, 90000);

        return () => {
            if (statusIntervalRef.current) {
                clearInterval(statusIntervalRef.current);
                statusIntervalRef.current = null;
            }
            if (contactsIntervalRef.current) {
                clearInterval(contactsIntervalRef.current);
                contactsIntervalRef.current = null;
            }
        };
    }, [effectiveProfileId, sidebarFriendIdsKey, reduxContacts.length, refreshContacts, refreshOnlineStatuses])

    // Remove duplicate message polling since it's already handled above

    const redirectToMessage = useCallback(async (e) => {
        // Prevent event bubbling
        e.stopPropagation();
        
        let profileId = e.currentTarget.dataset.profile
        if (!profileId) return;

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
    }, [activeFriends, checkOnlineStatusOnDemand]);

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
                                <div className='rs-nav-menu-item' data-profile={data._id} onClick={redirectToMessage}>
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
