import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import moment from 'moment';
import UserPP from '../UserPP';
import socket from '../../common/socket';
import api from '../../api/api';
import SingleMessage from './SingleMessage';
import ChatHeader from './ChatHeader';
import StickyChatFooter from './StickyChatFooter';
import SingleMsgSkleton from '../../skletons/message/SingleMsgSkleton';
import './StickyChatBox.css';

const StickyChatBox = ({ friendProfile, onClose, onMinimize, isMinimized, zIndex, isLoading = false }) => {
    const navigate = useNavigate();
    const myProfile = useSelector(state => state.profile);
    const userId = myProfile._id;
    const friendId = friendProfile?._id;
    
    const [room, setRoom] = useState('');
    const [isActive, setIsActive] = useState(false);
    const [isReplying, setIsReplying] = useState(false);
    const [isPreview, setIsPreview] = useState(false);
    const [messages, setMessages] = useState([]);
    const [isTyping, setIsTyping] = useState(false);
    const [isMsgLoading, setIsMsgLoading] = useState(false);
    const [typeMessage, setTypeMessage] = useState('');
    const [hasMoreMessages, setHasMoreMessages] = useState(true);
    const [lastSeen, setLastSeen] = useState(false);
    const [isBlockedMe, setIsBlockedMe] = useState(false);
    const [scrollPercent, setScrollPercent] = useState(0);
    const [replyData, setReplyData] = useState({ messageId: null, body: null });
    const [showOptionsMenu, setShowOptionsMenu] = useState(false);
    const [menuPosition, setMenuPosition] = useState({ top: 0, right: 0 });
    
    const msgListRef = useRef(null);
    const messageInput = useRef(null);
    const chatHeader = useRef(null);
    const chatFooter = useRef(null);
    const optionsMenuRef = useRef(null);
    const optionsButtonRef = useRef(null);
    const hasScrolledOnLoadRef = useRef(false);
    const previousMinimizedStateRef = useRef(isMinimized);

    // Check if user is active
    useEffect(() => {
        if (!friendId || !userId || isLoading) return;
        
        socket.emit('is_active', { profileId: friendId, myId: userId });
        socket.on('is_active', (data, ls) => {
            const lastSeenTimeStamp = moment(ls);
            const currentTimeStamp = moment(Date.now());
            const diffDays = currentTimeStamp.diff(lastSeenTimeStamp, 'days');
            
            setIsActive(data === true);
            
            let formattedTime;
            if (diffDays === 0) {
                formattedTime = moment(ls).format("hh:mm A");
            } else if (diffDays > 365) {
                formattedTime = moment(ls).format("MM/YY hh:mm A");
            } else {
                formattedTime = moment(ls).format("DD/MM hh:mm A");
            }
            setLastSeen(formattedTime);
        });

        return () => {
            socket.off('is_active');
        };
    }, [friendId, userId, isLoading]);

    // Check if blocked
    useEffect(() => {
        if (friendProfile && !isLoading) {
            setIsBlockedMe(friendProfile.blockedUsers ? friendProfile.blockedUsers.includes(userId) : false);
        }
    }, [friendProfile, userId, isLoading]);

    // Calculate menu position and handle click outside
    useEffect(() => {
        if (showOptionsMenu && optionsButtonRef.current) {
            const buttonRect = optionsButtonRef.current.getBoundingClientRect();
            setMenuPosition({
                top: buttonRect.bottom + 8,
                right: window.innerWidth - buttonRect.right
            });
        }

        const handleClickOutside = (event) => {
            if (
                optionsMenuRef.current && 
                !optionsMenuRef.current.contains(event.target) &&
                optionsButtonRef.current &&
                !optionsButtonRef.current.contains(event.target)
            ) {
                setShowOptionsMenu(false);
            }
        };

        if (showOptionsMenu) {
            // Use setTimeout to ensure the menu is rendered before adding listener
            setTimeout(() => {
                document.addEventListener('mousedown', handleClickOutside);
            }, 0);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showOptionsMenu]);

    // Initialize chat room and fetch messages
    useEffect(() => {
        if (!friendId || !userId || isLoading || !friendProfile?._id) return;
        
        console.log('StickyChatBox: Initializing chat for', friendId, 'isLoading:', isLoading);
        
        const newRoom = [userId, friendId].sort().join('_');
        setRoom(newRoom);
        
        // Join the room via socket
        socket.emit('startChat', { user1: userId, user2: friendId });
        socket.on('roomJoined', ({ room }) => {
            console.log(`StickyChatBox: Joined room: ${room}`);
        });

        // Listen for previous messages from socket
        socket.on('previousMessages', (messagesArray) => {
            console.log('StickyChatBox: Received previousMessages', messagesArray);
            if (Array.isArray(messagesArray) && messagesArray.length > 0) {
                setMessages(messagesArray);
                setHasMoreMessages(messagesArray.length >= 20);
                setTimeout(() => scrollToLastMessage(), 100);
            }
        });

        // Fetch initial messages via HTTP API
        const fetchInitialMessages = async () => {
            try {
                console.log('StickyChatBox: Fetching messages for', userId, friendId);
                const response = await api.get('/message/getChatHistory', {
                    params: {
                        profileId: userId,
                        friendId: friendId,
                        limit: 20
                    }
                });
                
                console.log('StickyChatBox: Messages response', response.data);
                if (response.data && response.data.messages) {
                    setMessages(response.data.messages);
                    setHasMoreMessages(response.data.hasMore);
                    setTimeout(() => scrollToLastMessage(), 100);
                } else {
                    console.log('StickyChatBox: No messages in response');
                    setMessages([]);
                    setHasMoreMessages(false);
                }
            } catch (error) {
                console.error('StickyChatBox: Error fetching initial messages:', error);
                setMessages([]);
                setHasMoreMessages(false);
            }
        };

        fetchInitialMessages();

        // Socket listeners
        socket.on('loadMessages', ({ loadedMessages, hasNewMessage }) => {
            console.log('StickyChatBox: Received loadMessages', loadedMessages);
            setHasMoreMessages(hasNewMessage);
            setIsMsgLoading(false);
            setMessages(messages => [...loadedMessages, ...messages]);
        });

        socket.on('newMessage', ({ updatedMessage, senderName, senderPP, chatPage }) => {
            if (chatPage === true) {
                if ((updatedMessage.receiverId === userId && updatedMessage.senderId === friendId) ||
                    (updatedMessage.senderId === userId && updatedMessage.receiverId === friendId)) {
                    console.log('StickyChatBox: Received newMessage', updatedMessage);
                    setMessages((prevMessages) => [...prevMessages, updatedMessage]);
                    setTimeout(() => scrollToLastMessage(), 100);
                }
            }
        });

        socket.on('typing', ({ receiverId, isTyping, type }) => {
            if (receiverId === userId) {
                setIsTyping(isTyping === true);
                setTypeMessage(type || '');
                if (isTyping) {
                    setTimeout(() => scrollToLastMessage(), 100);
                }
            }
        });

        socket.on('deleteMessage', (messageId) => {
            setMessages(prev => prev.filter(msg => msg._id !== messageId));
        });

        return () => {
            socket.off('newMessage');
            socket.off('roomJoined');
            socket.off('deleteMessage');
            socket.off('typing');
            socket.off('loadMessages');
            socket.off('previousMessages');
        };
    }, [friendId, userId, isLoading, friendProfile?._id]);

    // Mark messages as seen
    useEffect(() => {
        if (messages.length > 0 && friendId && friendProfile?._id) {
            setTimeout(() => {
                const lastMessage = messages[messages.length - 1];
                if (lastMessage && lastMessage.senderId !== userId && lastMessage.senderId === friendId) {
                    socket.emit('seenMessage', lastMessage);
                }
            }, 2000);
        }
    }, [messages, friendId, friendProfile, userId]);

    // Scroll handling
    useEffect(() => {
        const handleScroll = () => {
            const el = msgListRef.current;
            if (!el) return;
            const scrollTop = el.scrollTop;
            const scrollHeight = el.scrollHeight - el.clientHeight;
            const percent = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0;
            setScrollPercent(percent);
        };

        const el = msgListRef.current;
        if (el) {
            el.addEventListener("scroll", handleScroll);
        }

        return () => {
            if (el) {
                el.removeEventListener("scroll", handleScroll);
            }
        };
    }, []);

    // Load more messages on scroll
    useEffect(() => {
        if (hasMoreMessages && scrollPercent < 30) {
            socket.emit('loadMessages', { myId: userId, friendId, skip: messages.length });
            setIsMsgLoading(true);
            setHasMoreMessages(false);
        }
    }, [scrollPercent, hasMoreMessages, messages.length, userId, friendId]);

    const scrollToLastMessage = (forceInstant = false) => {
        if (msgListRef.current && !isMinimized) {
            setTimeout(() => {
                const lastMsg = msgListRef.current.querySelector('.chat-message-container:last-child');
                if (lastMsg) {
                    lastMsg.scrollIntoView({ behavior: forceInstant ? "auto" : "smooth", block: "end" });
                } else {
                    // Fallback: scroll to bottom
                    msgListRef.current.scrollTop = msgListRef.current.scrollHeight;
                }
            }, 100);
        }
    };

    // Scroll to bottom when chat is restored from minimized state
    useEffect(() => {
        // Check if chat was just restored from minimized state
        const wasMinimized = previousMinimizedStateRef.current;
        previousMinimizedStateRef.current = isMinimized;

        if (!isMinimized && wasMinimized && messages.length > 0 && msgListRef.current) {
            // Chat was just restored from minimized - scroll to bottom
            setTimeout(() => {
                if (msgListRef.current) {
                    msgListRef.current.scrollTop = msgListRef.current.scrollHeight;
                }
            }, 150);
        }
    }, [isMinimized, messages.length]);

    // Scroll to bottom when messages are first loaded (after loading completes)
    useEffect(() => {
        if (!isMinimized && !isLoading && messages.length > 0 && friendProfile?._id && !hasScrolledOnLoadRef.current && msgListRef.current) {
            // First time messages are loaded - scroll to bottom
            hasScrolledOnLoadRef.current = true;
            setTimeout(() => {
                if (msgListRef.current) {
                    msgListRef.current.scrollTop = msgListRef.current.scrollHeight;
                }
            }, 250);
        }
    }, [isLoading, friendProfile?._id, messages.length, isMinimized]);

    const footerProps = {
        room,
        friendId,
        setIsTyping,
        userId,
        replyData,
        setReplyData,
        messages,
        friendProfile,
        msgListRef,
        isAi: false
    };

    if (isMinimized) {
        return (
            <div className="sticky-chat-box minimized" style={{ zIndex }}>
                <div className="sticky-chat-minimized-header" onClick={onMinimize}>
                    <div className="sticky-chat-minimized-avatar">
                        {isLoading ? (
                            <div className="sticky-chat-skeleton-avatar"></div>
                        ) : (
                            <UserPP profilePic={friendProfile?.profilePic} profile={friendId} active={isActive} />
                        )}
                    </div>
                    <div className="sticky-chat-minimized-info">
                        <div className="sticky-chat-minimized-name">
                            {isLoading ? (
                                <div className="sticky-chat-skeleton-text" style={{ width: '100px', height: '14px' }}></div>
                            ) : (
                                friendProfile?.fullName || `${friendProfile?.user?.firstName || ''} ${friendProfile?.user?.surname || ''}`.trim() || 'Loading...'
                            )}
                        </div>
                        <div className="sticky-chat-minimized-status">
                            {isLoading ? (
                                <div className="sticky-chat-skeleton-text" style={{ width: '80px', height: '11px', marginTop: '4px' }}></div>
                            ) : (
                                isActive ? 'Active now' : lastSeen ? `Last seen ${lastSeen}` : 'Offline'
                            )}
                        </div>
                    </div>
                    <div className="sticky-chat-minimized-actions">
                        <button className="sticky-chat-action-btn" onClick={(e) => { e.stopPropagation(); onMinimize(); }}>
                            <i className="fas fa-window-maximize"></i>
                        </button>
                        <button className="sticky-chat-action-btn" onClick={(e) => { e.stopPropagation(); onClose(); }}>
                            <i className="fas fa-times"></i>
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="sticky-chat-box" style={{ zIndex }}>
            <div className="sticky-chat-header" ref={chatHeader}>
                <div className="sticky-chat-header-info">
                    <div className="sticky-chat-header-avatar">
                        {isLoading ? (
                            <div className="sticky-chat-skeleton-avatar"></div>
                        ) : (
                            <UserPP profilePic={friendProfile?.profilePic} profile={friendId} active={isActive} />
                        )}
                    </div>
                    <div className="sticky-chat-header-details">
                        <div className="sticky-chat-header-name">
                            {isLoading ? (
                                <div className="sticky-chat-skeleton-text" style={{ width: '120px', height: '15px' }}></div>
                            ) : (
                                friendProfile?.fullName || `${friendProfile?.user?.firstName || ''} ${friendProfile?.user?.surname || ''}`.trim() || 'Loading...'
                            )}
                        </div>
                        <div className="sticky-chat-header-status">
                            {isLoading ? (
                                <div className="sticky-chat-skeleton-text" style={{ width: '100px', height: '12px', marginTop: '4px' }}></div>
                            ) : (
                                isActive ? 'Active now' : lastSeen ? `Last seen ${lastSeen}` : 'Offline'
                            )}
                        </div>
                    </div>
                </div>
                <div className="sticky-chat-header-actions">
                    <div className="sticky-chat-options-wrapper">
                        <button 
                            ref={optionsButtonRef}
                            className="sticky-chat-action-btn" 
                            onClick={() => setShowOptionsMenu(!showOptionsMenu)} 
                            title="More options"
                        >
                            <i className="fas fa-ellipsis-v"></i>
                        </button>
                    </div>
                    <button className="sticky-chat-action-btn" onClick={onMinimize} title="Minimize">
                        <i className="fas fa-minus"></i>
                    </button>
                    <button className="sticky-chat-action-btn" onClick={onClose} title="Close">
                        <i className="fas fa-times"></i>
                    </button>
                </div>
            </div>

            <div className="sticky-chat-body">
                <div className="sticky-chat-message-list" id="chatMessageList" ref={msgListRef}>
                    {isLoading || messages.length === 0 ? (
                        <SingleMsgSkleton count={5} />
                    ) : (
                        messages.map((msg, index) => (
                            <SingleMessage
                                key={msg._id || index}
                                msg={msg}
                                friendProfile={friendProfile}
                                messages={messages}
                                isActive={isActive}
                                setIsReplying={setIsReplying}
                                setReplyData={setReplyData}
                                isPreview={isPreview}
                                setIsPreview={setIsPreview}
                                msgListRef={msgListRef}
                                isMsgLoading={isMsgLoading}
                            />
                        ))
                    )}

                    {isTyping && (
                        <div className={`chat-message-container message-receive message-typing`}>
                            <div className="chat-message-profilePic">
                                <UserPP profilePic={friendProfile.profilePic} profile={friendId} active={isActive} />
                            </div>
                            <div className="chat-message">
                                <p className="message-container mb-0">
                                    {typeMessage || (
                                        <div className="typing-indicator">
                                            <span className="typing-dots"></span>
                                            <span className="typing-dots"></span>
                                            <span className="typing-dots"></span>
                                        </div>
                                    )}
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {isLoading ? (
                <div ref={chatFooter} className="sticky-chat-footer">
                    <div className="sticky-chat-footer-skeleton">
                        <div className="sticky-chat-skeleton-text" style={{ width: '100%', height: '40px', borderRadius: '20px' }}></div>
                    </div>
                </div>
            ) : !isBlockedMe ? (
                <div ref={chatFooter} className="sticky-chat-footer">
                    <StickyChatFooter {...footerProps} />
                </div>
            ) : (
                <div ref={chatFooter} className="sticky-chat-footer">
                    <div className="sticky-chat-blocked-message">
                        <i className="fas fa-ban"></i>
                        <span>{friendProfile?.fullName || `${friendProfile?.user?.firstName || ''} ${friendProfile?.user?.surname || ''}`} Blocked You</span>
                    </div>
                </div>
            )}

            {showOptionsMenu && createPortal(
                <div 
                    ref={optionsMenuRef}
                    className="sticky-chat-options-menu"
                    style={{
                        top: `${menuPosition.top}px`,
                        right: `${menuPosition.right}px`
                    }}
                >
                    <button 
                        className="sticky-chat-option-item"
                        onClick={() => {
                            // Audio Call
                            const channelName = `${userId}-${friendId}`;
                            window.dispatchEvent(new CustomEvent('startAudioCall', {
                                detail: {
                                    to: friendId,
                                    channelName,
                                    callerName: friendProfile?.fullName || `${friendProfile?.user?.firstName} ${friendProfile?.user?.surname}` || 'Friend',
                                    callerProfilePic: friendProfile?.profilePic
                                }
                            }));
                            setShowOptionsMenu(false);
                        }}
                    >
                        <i className="fas fa-phone-alt"></i>
                        <span>Audio Call</span>
                    </button>
                    <button 
                        className="sticky-chat-option-item"
                        onClick={() => {
                            // Video Call - dispatch custom event similar to audio calls
                            const channelName = `${userId}-${friendId}`;
                            window.dispatchEvent(new CustomEvent('startVideoCall', {
                                detail: {
                                    to: friendId,
                                    channelName,
                                    callerName: friendProfile?.fullName || `${friendProfile?.user?.firstName} ${friendProfile?.user?.surname}` || 'Friend',
                                    callerProfilePic: friendProfile?.profilePic,
                                    isAudio: false
                                }
                            }));
                            // Also emit socket event for server-side handling
                            socket.emit('video-call', { to: friendId, channelName, isAudio: false });
                            setShowOptionsMenu(false);
                        }}
                    >
                        <i className="fas fa-video"></i>
                        <span>Video Call</span>
                    </button>
                    <button 
                        className="sticky-chat-option-item"
                        onClick={() => {
                            // Bump
                            socket.emit('bump', { friendProfile: friendId, myProfile: userId });
                            setShowOptionsMenu(false);
                        }}
                    >
                        <i className="fas fa-record-vinyl"></i>
                        <span>Bump</span>
                    </button>
                    <div className="sticky-chat-options-divider"></div>
                    <button 
                        className="sticky-chat-option-item"
                        onClick={() => {
                            window.location.href = `/profile/${friendId}`;
                            setShowOptionsMenu(false);
                        }}
                    >
                        <i className="fas fa-user"></i>
                        <span>View Profile</span>
                    </button>
                    <button 
                        className="sticky-chat-option-item"
                        onClick={() => {
                            navigate(`/message/${friendId}`);
                            setShowOptionsMenu(false);
                        }}
                    >
                        <i className="fas fa-expand"></i>
                        <span>Open in Full Chat</span>
                    </button>
                    <button 
                        className="sticky-chat-option-item"
                        onClick={() => {
                            // TODO: Implement mute functionality
                            setShowOptionsMenu(false);
                        }}
                    >
                        <i className="fas fa-bell-slash"></i>
                        <span>Mute Notifications</span>
                    </button>
                    <div className="sticky-chat-options-divider"></div>
                    <button 
                        className="sticky-chat-option-item danger"
                        onClick={() => {
                            if (window.confirm('Are you sure you want to block this user?')) {
                                // TODO: Implement block functionality
                                setShowOptionsMenu(false);
                            }
                        }}
                    >
                        <i className="fas fa-ban"></i>
                        <span>Block User</span>
                    </button>
                    <button 
                        className="sticky-chat-option-item danger"
                        onClick={() => {
                            if (window.confirm('Are you sure you want to delete this conversation?')) {
                                // TODO: Implement delete conversation functionality
                                setShowOptionsMenu(false);
                            }
                        }}
                    >
                        <i className="fas fa-trash"></i>
                        <span>Delete Conversation</span>
                    </button>
                </div>,
                document.body
            )}
        </div>
    );
};

export default StickyChatBox;
