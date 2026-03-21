import React, { Fragment, useEffect, useState, useRef, useCallback, useMemo } from "react";
import UserPP from "../UserPP";
import { useSelector } from "react-redux";
import { Link, useParams, useNavigate } from "react-router-dom";
import api from "../../api/api";
import moment from "moment";
import MsgListSkleton from "../../skletons/message/MsgListSkleton";
// const isProfileActive = (id) => {
//     return true
//     socket.emit('is_active', { profileId: id, myId: profileId })
//     socket.on('is_active', (isUserActive) => {
//         return () => {
//             return isUserActive;
//         }
//     })
// }



function truncateString(str, maxLength) {
    return str.length > maxLength ? str.slice(0, maxLength) + '...' : str
}

function getShortTimeAgo(timestamp) {
    if (!timestamp) return '';
    
    const now = moment();
    const time = moment(timestamp);
    const diff = now.diff(time);
    
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const weeks = Math.floor(days / 7);
    const months = Math.floor(days / 30);
    const years = Math.floor(days / 365);
    
    if (seconds < 60) return 'now';
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}d`;
    if (weeks < 4) return `${weeks}w`;
    if (months < 12) return `${months}mo`;
    return `${years}y`;
}


const userInfo = JSON.parse((localStorage.getItem('user') || '{}'))
const profileId = userInfo.profile
const MessageList = React.memo(({ onChatSelect, compact, menuStyle }) => {
    const [messageOption, setMessageOption] = useState(false)
    const [searchQuery, setSearchQuery] = useState("")
    const [focusedIndex, setFocusedIndex] = useState(-1)
    const messageMenuRef = useRef()
    const searchInputRef = useRef(null)
    const listRef = useRef(null)
    const itemRefs = useRef([])
    const params = useParams();
    const myProfile = useSelector(state => state.profile)
    const myId = myProfile._id
    const navigate = useNavigate();
    const effectiveProfileId = myId || profileId;

    const cachedContacts = useMemo(() => {
        if (!effectiveProfileId) return [];
        try {
            const cacheKey = `contactsData_${effectiveProfileId}`;
            const cached = localStorage.getItem(cacheKey) || localStorage.getItem('contactsData');
            if (!cached) return [];
            const data = JSON.parse(cached);
            return Array.isArray(data) ? data : [];
        } catch (e) {
            return [];
        }
    }, [effectiveProfileId]);

    const [contacts, setContacts] = useState(() => cachedContacts);
    const [activeFriends, setActiveFriends] = useState(() => {
        return cachedContacts
            .filter(contact => contact?.isOnline && contact.person?._id)
            .map(contact => contact.person._id);
    });
    const [loading, setLoading] = useState(() => cachedContacts.length === 0);

    // HTTP-based contacts fetching (now includes online status)
    const fetchContacts = useCallback(async (showLoading = true) => {
        if (!effectiveProfileId) return;
        try {
            if (showLoading) setLoading(true);
            const response = await api.get('/message/chatList', {
                params: { profileId: effectiveProfileId }
            });
            console.log('fetch contacts', response.data)
            // API returns array directly, not nested under contacts
            const contactsData = Array.isArray(response.data) ? response.data : [];
            setContacts(contactsData);

            // Extract online friends from the response (no separate API calls needed)
            const onlineFriends = contactsData
                .filter(contact => contact.isOnline && contact.person?._id)
                .map(contact => contact.person._id);
            setActiveFriends(onlineFriends);

            // Store contacts data in localStorage for Chat.js and cache (skeleton only on first load)
            const cacheKey = `contactsData_${effectiveProfileId}`;
            localStorage.setItem('contactsData', JSON.stringify(contactsData));
            localStorage.setItem(cacheKey, JSON.stringify(contactsData));
        } catch (error) {
            console.error('Error fetching contacts:', error);
            setContacts([]);
            setActiveFriends([]);
        } finally {
            setLoading(false);
        }
    }, [effectiveProfileId]);

    useEffect(() => {
        if (!effectiveProfileId) return;
        if (cachedContacts.length > 0) {
            setContacts(cachedContacts);
            setActiveFriends(
                cachedContacts
                    .filter(contact => contact?.isOnline && contact.person?._id)
                    .map(contact => contact.person._id)
            );
            setLoading(false);
            return;
        }
        setContacts([]);
        setActiveFriends([]);
        setLoading(true);
    }, [effectiveProfileId, cachedContacts]);

    // Fetch contacts on component mount: use cache to skip skeleton on revisit
    useEffect(() => {
        if (!effectiveProfileId) return;
        fetchContacts(cachedContacts.length === 0); // show loading only when no cache
        const interval = setInterval(() => fetchContacts(false), 120000);
        return () => clearInterval(interval);
    }, [effectiveProfileId, cachedContacts.length, fetchContacts]);


    useEffect(() => {
        const handleClickOutside = (event) => {
            if (messageMenuRef.current && !messageMenuRef.current.contains(event.target)) {
                setMessageOption(false);
            }
        };
        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                setMessageOption(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    const markAllMsgAsRead = useCallback(async () => {
        return;
    }, [])

    const handleMsgOptionClick = useCallback(async () => {
        // if (messageOption) {
        //     setMessageOption(false)

        // }
        setMessageOption(!messageOption)
    }, [])

    const goToLink = useCallback(e => {
        navigate(`/message/${e.currentTarget.dataset.id}`)
        onChatSelect && onChatSelect()
    }, [navigate, onChatSelect])

    const filteredContacts = useMemo(() => {
        const query = (searchQuery || '').toLowerCase();
        const filtered = (contacts || [])
            .filter((contactItem) => contactItem && contactItem.person && contactItem.person._id)
            .filter((contactItem) => {
                if (!query) return true;
                const person = contactItem.person || {};
                const nameFromFull = (person.fullName || '').toLowerCase();
                const nameFromUser = ((person.user?.firstName || '') + ' ' + (person.user?.surname || '')).trim().toLowerCase();
                const lastMessage = (contactItem.messages?.[0]?.message || '').toLowerCase();
                return nameFromFull.includes(query) || nameFromUser.includes(query) || lastMessage.includes(query);
            })
            // Sort by last message timestamp (most recent first)
            .sort((a, b) => {
                const aLastMessage = a.messages?.[0];
                const bLastMessage = b.messages?.[0];
                
                // If both have messages, sort by timestamp (most recent first)
                if (aLastMessage?.timestamp && bLastMessage?.timestamp) {
                    const aTimestamp = new Date(aLastMessage.timestamp).getTime();
                    const bTimestamp = new Date(bLastMessage.timestamp).getTime();
                    return bTimestamp - aTimestamp;
                }
                
                // If only one has messages, prioritize it
                if (aLastMessage?.timestamp) return -1;
                if (bLastMessage?.timestamp) return 1;
                
                // If neither has messages, maintain original order
                return 0;
            });
        
        return filtered;
    }, [contacts, searchQuery])

    useEffect(() => {
        if (focusedIndex < 0) return;
        const el = itemRefs.current[focusedIndex];
        if (el && typeof el.focus === 'function') {
            el.focus();
        }
    }, [focusedIndex])


    const MessageOptionMenu = () => {
        return (
            <div className="header-message-option-menu" style={{ position: 'relative', display: 'inline-block' }} ref={messageMenuRef}>


                {messageOption && (
                    <div style={{
                        position: 'absolute',
                        top: '15px',
                        right: '0',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                        zIndex: 1002,
                        width: '200px'
                    }}>
                        <ul className="message-option-menu" style={{ listStyle: 'none', margin: 0, padding: '8px 0' }}>
                            <li 
                                onClick={markAllMsgAsRead} 
                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); markAllMsgAsRead(); } }}
                                tabIndex={0}
                                style={{ padding: '8px 16px', cursor: 'pointer' }}
                            >Mark All As Read</li>
                            {/* <li onClick={handleNotiDelete} style={{ padding: '8px 16px', cursor: 'pointer' }}>Delete All</li> */}
                            <li style={{ padding: '8px 16px', cursor: 'pointer' }}><Link to={'/settings/message'}>Message Settings</Link></li>


                        </ul>
                    </div>
                )}
            </div>
        );
    }

    // Compact dropdown mode - message page contact list style
    if (compact) {
        const compactGoToLink = (e) => {
            navigate(`/message/${e.currentTarget.dataset.id}`);
            onChatSelect && onChatSelect();
        };
        return (
            <div className="modern-message-list-container" style={{ padding: '0 10px 10px', minHeight: 0 }}>
                {/* Search */}
                <div className="search-section" style={{ padding: '8px 0' }}>
                    <div className="search-container">
                        <i className="fas fa-search search-icon"></i>
                        <input
                            ref={searchInputRef}
                            type="text"
                            placeholder="Search conversations..."
                            className="search-input"
                            value={searchQuery}
                            onChange={(e) => { setSearchQuery(e.target.value); setFocusedIndex(-1); }}
                            aria-label="Search conversations"
                            role="searchbox"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                className="clear-search-btn"
                                aria-label="Clear search"
                                onClick={() => { setSearchQuery(""); searchInputRef.current?.focus(); }}
                            >
                                <i className="fas fa-times"></i>
                            </button>
                        )}
                    </div>
                </div>
                {/* Contact list - same as message page */}
                <div className="modern-chat-list-container" style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
                    <div className="chat-list-header">
                        <span className="list-title">All Contacts</span>
                        <span className="chat-count">{searchQuery ? `${filteredContacts.length}/${contacts?.length || 0}` : (contacts?.length || 0)}</span>
                    </div>
                    <ul
                        className="modern-chat-list"
                        role="listbox"
                        aria-label="Conversation list"
                        style={{ ...(menuStyle || {}), overflowY: 'auto', overflowX: 'hidden' }}
                    >
                        {loading ? (
                            <div className="empty-state">
                                <MsgListSkleton count={5} />
                            </div>
                        ) : filteredContacts.length > 0 ? (
                            filteredContacts.map((contactItem, index) => {
                                const contactPerson = contactItem.person;
                                const contactMessages = contactItem.messages || [];
                                const authorFullName = contactPerson?.fullName ||
                                    (contactPerson?.user ?
                                        `${contactPerson?.user?.firstName || ''} ${contactPerson?.user?.surname || ''}`.trim() :
                                        'Unknown User');
                                const isMsgSeen = contactMessages[0] ?
                                    (contactMessages[0].isSeen && contactMessages[0].receiverId === myId ?
                                        true : contactMessages[0].isSeen) : true;
                                const isActive = contactPerson._id === params.profile;
                                const isOnline = contactItem.isOnline || activeFriends.includes(contactPerson._id);
                                const unreadCount = (contactMessages || []).reduce((count, m) => {
                                    return count + ((m && m.receiverId === myId && !m.isSeen) ? 1 : 0);
                                }, 0);
                                const lastMessage = contactMessages[0] || {};
                                const isOutgoing = lastMessage && lastMessage.senderId === myId;
                                const statusTitle = isOutgoing ? (lastMessage.isSeen ? 'Seen' : 'Delivered') : '';
                                return (
                                    <li
                                        key={contactPerson._id || index}
                                        className={`modern-chat-item ${isActive ? 'active' : ''} ${!isMsgSeen ? 'unread' : ''}`}
                                        data-id={contactPerson._id}
                                        onClick={compactGoToLink}
                                        style={{ '--animation-delay': `${index * 0.05}s` }}
                                    >
                                        <div className="chat-item-content chat-card">
                                            <div className="avatar-section">
                                                <div className="avatar-container">
                                                    <UserPP
                                                        profilePic={contactPerson.profilePic}
                                                        profile={contactPerson._id}
                                                        active={isOnline}
                                                    />
                                                </div>
                                            </div>
                                            <div className="chat-info">
                                                <div className="chat-header">
                                                    <h3 className="contact-name">{authorFullName}</h3>
                                                    <div className="message-meta">
                                                        {unreadCount > 0 && (
                                                            <span className="unread-count" aria-label={`${unreadCount} unread messages`}>{unreadCount}</span>
                                                        )}
                                                        {contactMessages.length > 0 && (
                                                            <span className="message-time" title={moment(lastMessage.timestamp).format('LT, ll')}>
                                                                {getShortTimeAgo(lastMessage.timestamp)}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="last-message-preview">
                                                    {isOutgoing && (
                                                        <i
                                                            className={`message-status-icon ${lastMessage.isSeen ? 'fas fa-check-double seen' : 'fas fa-check delivered'}`}
                                                            title={statusTitle}
                                                            aria-hidden="true"
                                                        ></i>
                                                    )}
                                                    <span className="message-text">
                                                        {lastMessage?.message ?
                                                            truncateString(lastMessage.message, 64) :
                                                            'Start a conversation...'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </li>
                                );
                            })
                        ) : (
                            <li className="empty-state no-results" role="note">
                                <div>
                                    <i className="fas fa-inbox"></i>
                                    <p>{searchQuery ? `No conversations match "${searchQuery}"` : 'No Messages Found'}</p>
                                    {searchQuery && (
                                        <button
                                            type="button"
                                            className="clear-search-secondary"
                                            onClick={() => { setSearchQuery(""); searchInputRef.current?.focus(); }}
                                        >Clear search</button>
                                    )}
                                </div>
                            </li>
                        )}
                    </ul>
                </div>
                {/* Footer */}
                <div className="chat-list-footer">
                    <button className="footer-action-btn" onClick={() => { navigate('/friends/suggestions'); onChatSelect && onChatSelect(); }}>
                        <i className="fas fa-plus"></i>
                        <span>New Chat</span>
                    </button>
                </div>
            </div>
        );
    }

    return (
        <Fragment>
            <div className="modern-message-list-container">
                {/* Header Section */}
                <div className="modern-message-header">
                    <div className="header-content">
                        <div className="header-title-section">
                            <h1 className="modern-title">Messages</h1>
                            <div className="online-indicator" aria-live="polite">
                                <span className="indicator-dot"></span>
                                <span className="indicator-text">Online • {activeFriends.length}</span>
                            </div>
                        </div>
                        <div className="header-actions">
                            <button 
                                onClick={handleMsgOptionClick} 
                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleMsgOptionClick(); } }}
                                className="action-button"
                                aria-label="Message options"
                            >
                                <i className="fas fa-ellipsis-h"></i>
                            </button>
                            {messageOption && <MessageOptionMenu />}
                        </div>
                    </div>
                </div>

                {/* Search Section */}
                <div className="search-section">
                    <div className="search-container">
                        <i className="fas fa-search search-icon"></i>
                        <input 
                            ref={searchInputRef}
                            type="text" 
                            placeholder="Search conversations..." 
                            className="search-input"
                            value={searchQuery}
                            onChange={(e) => { setSearchQuery(e.target.value); setFocusedIndex(-1); }}
                            onKeyDown={(e) => {
                                if (e.key === 'ArrowDown' && filteredContacts.length > 0) {
                                    e.preventDefault();
                                    setFocusedIndex(0);
                                }
                                if (e.key === 'Escape' && searchQuery) {
                                    setSearchQuery("");
                                }
                            }}
                            aria-label="Search conversations"
                            role="searchbox"
                        />
                        {searchQuery && (
                            <button 
                                type="button"
                                className="clear-search-btn"
                                aria-label="Clear search"
                                onClick={() => { setSearchQuery(""); searchInputRef.current && searchInputRef.current.focus(); }}
                            >
                                <i className="fas fa-times"></i>
                            </button>
                        )}
                    </div>
                </div>

                {/* Chat List Section */}
                <div className="modern-chat-list-container">
                    <div className="chat-list-header">
                        <span className="list-title">All Contacts</span>
                        <span className="chat-count">{searchQuery ? `${filteredContacts.length}/${contacts?.length || 0}` : (contacts?.length || 0)}</span>
                    </div>
                    
                    <ul 
                        className="modern-chat-list"
                        role="listbox"
                        aria-label="Conversation list"
                        ref={listRef}
                        onKeyDown={(e) => {
                            if (filteredContacts.length === 0) return;
                            if (["ArrowDown","ArrowUp","Home","End","Enter"].includes(e.key)) {
                                e.preventDefault();
                            }
                            if (e.key === 'ArrowDown') {
                                setFocusedIndex(prev => Math.min((prev < 0 ? -1 : prev) + 1, filteredContacts.length - 1));
                            } else if (e.key === 'ArrowUp') {
                                setFocusedIndex(prev => Math.max((prev < 0 ? 0 : prev) - 1, 0));
                            } else if (e.key === 'Home') {
                                setFocusedIndex(0);
                            } else if (e.key === 'End') {
                                setFocusedIndex(filteredContacts.length - 1);
                            } else if (e.key === 'Enter') {
                                const el = itemRefs.current[focusedIndex];
                                if (el) {
                                    el.click();
                                }
                            }
                        }}
                    >
                        {contacts.length > 0 ? (
                            filteredContacts.length > 0 ? filteredContacts
                            .map((contactItem, index) => {
                                const contactPerson = contactItem.person;
                                const contactMessages = contactItem.messages || [];
                                const authorFullName = contactPerson?.fullName || 
                                    (contactPerson?.user ? 
                                        `${contactPerson?.user?.firstName || ''} ${contactPerson?.user?.surname || ''}`.trim() : 
                                        'Unknown User');
                                const isMsgSeen = contactMessages[0] ? 
                                    (contactMessages[0].isSeen && contactMessages[0].receiverId === myId ? 
                                        true : contactMessages[0].isSeen) : true;
                                const isActive = contactPerson._id === params.profile;
                                const isOnline = contactItem.isOnline || activeFriends.includes(contactPerson._id);
                                const unreadCount = (contactMessages || []).reduce((count, m) => {
                                    return count + ((m && m.receiverId === myId && !m.isSeen) ? 1 : 0);
                                }, 0);
                                const lastMessage = contactMessages[0] || {};
                                const isOutgoing = lastMessage && lastMessage.senderId === myId;
                                const statusTitle = isOutgoing ? (lastMessage.isSeen ? 'Seen' : 'Delivered') : '';
                                
                                return (
                                    <li 
                                        key={contactPerson._id || index}
                                        className={`modern-chat-item ${isActive ? 'active' : ''} ${!isMsgSeen ? 'unread' : ''} ${focusedIndex === index ? 'focused' : ''}`}
                                        data-id={contactPerson._id} 
                                        onClick={goToLink}
                                        onKeyDown={(e) => { 
                                            if (e.key === 'Enter' || e.key === ' ') { 
                                                e.preventDefault(); 
                                                goToLink(e); 
                                            } 
                                        }}
                                        role="option"
                                        aria-selected={focusedIndex === index}
                                        tabIndex={focusedIndex === index ? 0 : -1}
                                        ref={(el) => { itemRefs.current[index] = el; }}
                                        style={{ '--animation-delay': `${index * 0.05}s` }}
                                    >
                                        <div className="chat-item-content chat-card">
                                            <div className="avatar-section">
                                                <div className="avatar-container">
                                                    <UserPP 
                                                        profilePic={contactPerson.profilePic} 
                                                        profile={contactPerson._id} 
                                                        active={isOnline}
                                                    />
                                                </div>
                                            </div>
                                            <div className="chat-info">
                                                <div className="chat-header">
                                                    <h3 className="contact-name">{authorFullName}</h3>
                                                    <div className="message-meta">
                                                        {unreadCount > 0 && (
                                                            <span className="unread-count" aria-label={`${unreadCount} unread messages`}>{unreadCount}</span>
                                                        )}
                                                        {contactMessages.length > 0 && (
                                                            <span className="message-time" title={moment(lastMessage.timestamp).format('LT, ll')}>
                                                                {getShortTimeAgo(lastMessage.timestamp)}
                                                            </span>
                                                        )}

                                                    </div>
                                                </div>
                                                                                                                                                        <div className="last-message-preview" style={{display:'block'}}>
                                                    {isOutgoing && (
                                                        <i 
                                                            className={`message-status-icon ${lastMessage.isSeen ? 'fas fa-check-double seen' : 'fas fa-check delivered'}`}
                                                            title={statusTitle}
                                                            aria-hidden="true"
                                                        ></i>
                                                    )}
                                                    <span className="message-text">
                                                        {lastMessage?.message ? 
                                                            truncateString(lastMessage.message, 64) : 
                                                            'Start a conversation...'}
                                                    </span>
                                                </div>

                                            </div>
                                        </div>
                                        
                                        <div className="hover-actions">
                                            <button className="action-btn mute-btn" title="Mute">
                                                <i className="fas fa-bell-slash"></i>
                                            </button>
                                            <button className="action-btn archive-btn" title="Archive">
                                                <i className="fas fa-archive"></i>
                                            </button>
                                        </div>
                                    </li>
                                );
                            }) : (
                                <li className="empty-state no-results" role="note">
                                    <div>
                                        <i className="fas fa-inbox"></i>
                                        <p>No conversations match "{searchQuery}"</p>
                                        <button 
                                            type="button" 
                                            className="clear-search-secondary"
                                            onClick={() => { setSearchQuery(""); searchInputRef.current && searchInputRef.current.focus(); }}
                                        >Clear search</button>
                                    </div>
                                </li>
                            )) : (
                                <div className="empty-state">
                                    <MsgListSkleton count={5} />
                                </div>
                            )}
                        
                    </ul>
                </div>

                {/* Footer Actions */}
                <div className="chat-list-footer">
                    <button className="footer-action-btn" onClick={() => navigate('/friends/suggestions')}>
                        <i className="fas fa-plus"></i>
                        <span>New Chat</span>
                    </button>
                </div>
            </div>
        </Fragment>
    )
})

MessageList.displayName = 'MessageList';

export default MessageList;