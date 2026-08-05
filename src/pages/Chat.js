import React, { useCallback, useEffect, useLayoutEffect, useState, useRef } from "react";
import { setLoading } from '../services/actions/optionAction';
import { useDispatch, useSelector } from 'react-redux';
import { useParams } from 'react-router-dom';
import api from '../api/api';
import socket from '../common/socket';
import UserPP from '../components/UserPP';
import moment from "moment";
import SingleMessage from '../components/Message/SingleMessage';
import $ from 'jquery'
import { seenMessage } from "../services/actions/messageActions";
import ChatHeader from '../components/Message/ChatHeader';
import ChatFooter from '../components/Message/ChatFooter';
import SingleMsgSkleton from '../skletons/message/SingleMsgSkleton';

const NEAR_BOTTOM_PX = 100;

const Chat = ({ }) => {
    const dispatch = useDispatch();
    const profile = useSelector(state => state.profile)
    const userId = profile._id
    const [friendProfile, setFriendProfile] = useState({})
    const [isBlockedMe, setIsBlockedMe] = useState(false)
    const [lastSeen, setLastSeen] = useState(false);

    const [room, setRoom] = useState('');
    const [isActive, setIsActive] = useState(false);
    const [isReplying, setIsReplying] = useState(false);
    const [isPreview, setIsPreview] = useState(false);
    const [messages, setMessages] = useState([]);
    const [isTyping, setIsTyping] = useState(false);
    const [isMsgLoading, setIsMsgLoading] = useState(false);
    const [typeMessage, setTypeMessage] = useState('');
    const [hasMoreMessages, setHasMoreMessages] = useState(true);
    // Default as "at bottom" so load-older logic does not run until the user scrolls (real % from handler).
    const [scrollPercent, setScrollPercent] = useState(100);
    const [replyData, setReplyData] = useState({ messageId: null, body: null });
    const msgListRef = useRef(null);
    const messageInput = useRef(null);
    const chatHeader = useRef(null);
    const chatFooter = useRef(null);
    const isNearBottomRef = useRef(true);
    const pendingScrollRestoreRef = useRef(null);
    const hasInitialScrolledRef = useRef(false);

    const chatNewAttachment = useRef(null);
    const messageActionButtonContainer = useRef(null);

    const getDistanceFromBottom = (el) => {
        if (!el) return 0;
        return el.scrollHeight - el.scrollTop - el.clientHeight;
    };

    const checkIsNearBottom = (el, threshold = NEAR_BOTTOM_PX) => {
        if (!el) return true;
        return getDistanceFromBottom(el) <= threshold;
    };

    const scrollToLastMessage = useCallback((behavior = 'smooth') => {
        const el = msgListRef.current;
        if (!el) return;

        const doScroll = () => {
            const list = msgListRef.current;
            if (!list) return;
            list.scrollTo({
                top: list.scrollHeight,
                behavior
            });
            isNearBottomRef.current = true;
            setScrollPercent(100);
        };

        // Wait a frame so newly rendered messages are measured.
        requestAnimationFrame(() => {
            doScroll();
            if (behavior === 'auto') {
                requestAnimationFrame(doScroll);
            }
        });
    }, []);

    const params = useParams()
    const friendId = params.profile;

    const fetchChatHistory = useCallback(async (profileId, friendIdArg, limit = 20) => {
        try {
            const response = await api.get('/message/getChatHistory', {
                params: {
                    profileId,
                    friendId: friendIdArg,
                    limit
                }
            });
            return response.data;
        } catch (error) {
            console.error('Error fetching messages:', error);
            return { messages: [], hasMore: false };
        }
    }, []);

    const fetchOldMessages = useCallback(async (profileId, friendIdArg, beforeTimestamp, limit = 20) => {
        if (!beforeTimestamp) {
            return { messages: [], hasMore: false };
        }
        try {
            const response = await api.get('/message/getOldMessages', {
                params: {
                    profileId,
                    friendId: friendIdArg,
                    beforeTimestamp,
                    limit
                }
            });
            return response.data;
        } catch (error) {
            console.error('Error fetching old messages:', error);
            return { messages: [], hasMore: false };
        }
    }, []);

    useEffect(() => {
        if (friendId) dispatch(seenMessage(friendId))
    }, [friendId, dispatch])

    useEffect(() => {
        const handleScroll = () => {
            const el = msgListRef.current;
            if (!el) return;
            const scrollTop = el.scrollTop;
            const maxScroll = el.scrollHeight - el.clientHeight;
            isNearBottomRef.current = checkIsNearBottom(el);
            if (maxScroll <= 0) {
                setScrollPercent(100);
                return;
            }
            setScrollPercent((scrollTop / maxScroll) * 100);
        };

        const el = msgListRef.current;
        if (el) {
            el.addEventListener("scroll", handleScroll, { passive: true });
            handleScroll();
        }

        return () => {
            if (el) {
                el.removeEventListener("scroll", handleScroll);
            }
        };
    }, [friendId]);

    const messagesRef = useRef(messages);
    useEffect(() => {
        messagesRef.current = messages;
    }, [messages]);

    const loadingOlderRef = useRef(false);

    // Keep viewport anchored when older messages are prepended.
    useLayoutEffect(() => {
        const restore = pendingScrollRestoreRef.current;
        const el = msgListRef.current;
        if (!restore || !el) return;
        el.scrollTop = restore.prevTop + (el.scrollHeight - restore.prevHeight);
        pendingScrollRestoreRef.current = null;
        isNearBottomRef.current = checkIsNearBottom(el);
    }, [messages]);

    useEffect(() => {
        if (!friendId || !userId || !hasMoreMessages) return;
        if (scrollPercent >= 30 || !Number.isFinite(scrollPercent)) return;
        const skip = messagesRef.current.length;
        if (skip === 0) return;
        if (loadingOlderRef.current || isMsgLoading) return;

        const oldestMessage = messagesRef.current[0];
        const beforeTimestamp = oldestMessage?.timestamp || oldestMessage?.createdAt;
        if (!beforeTimestamp) return;

        loadingOlderRef.current = true;
        (async () => {
            setIsMsgLoading(true);
            try {
                const response = await fetchOldMessages(userId, friendId, beforeTimestamp, 20);
                const older = response.messages || [];
                if (older.length === 0) {
                    setHasMoreMessages(false);
                    return;
                }
                // Capture just before prepend so socket updates during fetch cannot corrupt restore.
                const el = msgListRef.current;
                if (el) {
                    pendingScrollRestoreRef.current = {
                        prevHeight: el.scrollHeight,
                        prevTop: el.scrollTop
                    };
                }
                setMessages(prev => [...older, ...prev]);
                setHasMoreMessages(response.hasMore);
            } catch (error) {
                pendingScrollRestoreRef.current = null;
                console.error('Error loading older messages:', error);
            } finally {
                setIsMsgLoading(false);
                loadingOlderRef.current = false;
            }
        })();
        // Intentionally omit isMsgLoading: when it flips false, deps would match again and load every page in one burst.
    }, [scrollPercent, hasMoreMessages, userId, friendId, fetchOldMessages]);

    // Get online status from contacts data (no separate API calls)
    const getOnlineStatusFromContacts = () => {
        // Try to get online status from localStorage or Redux store if available
        try {
            const contactsData = localStorage.getItem('contactsData');
            if (contactsData) {
                const contacts = JSON.parse(contactsData);
                const friendContact = contacts.find(c => c.person?._id === friendId);
                if (friendContact) {
                    return {
                        isActive: friendContact.isOnline || false,
                        lastSeen: friendContact.lastSeen || null
                    };
                }
            }
        } catch (error) {
            console.error('Error getting online status from contacts:', error);
        }
        return { isActive: false, lastSeen: null };
    };

    // WebSocket-based message sending with optimistic UI
    const sendMessage = async (messageData) => {
        // Create optimistic message object for immediate display
        const optimisticMessage = {
            _id: `temp-${Date.now()}-${Math.random()}`, // Temporary ID
            senderId: userId,
            receiverId: friendId,
            message: messageData.message,
            attachment: messageData.attachment,
            parent: messageData.parent,
            messageType: messageData.messageType || 'text',
            timestamp: new Date(),
            isOptimistic: true // Flag to identify optimistic messages
        };

        console.log('Sending message via WebSocket:', messageData);
        
        // Add optimistic message to local state immediately
        setMessages(prev => {
            console.log('Adding optimistic message, previous count:', prev.length);
            const newMessages = [...prev, optimisticMessage];
            console.log('New messages count with optimistic:', newMessages.length);
            return newMessages;
        });

        // Always follow own outgoing messages.
        scrollToLastMessage('smooth');

        try {
            // Send via WebSocket instead of HTTP
            socket.emit('sendMessage', messageData);
            
            // Listen for the server confirmation
            const handleMessageConfirmation = (data) => {
                console.log('Message confirmed by server:', data);
                
                // Replace optimistic message with real message
                setMessages(prev => {
                    return prev.map(msg => {
                        if (msg._id === optimisticMessage._id) {
                            return data.updatedMessage || data.data; // Use the real message from server
                        }
                        return msg;
                    });
                });
                
                // Clean up listener
                socket.off('newMessage', handleMessageConfirmation);
                socket.off('newMessageToUser', handleMessageConfirmation);
            };
            
            // Listen for confirmation
            socket.on('newMessage', handleMessageConfirmation);
            socket.on('newMessageToUser', handleMessageConfirmation);
            
            // Fallback: If no confirmation within 5 seconds, remove optimistic message
            const fallbackTimeout = setTimeout(() => {
                setMessages(prev => prev.filter(msg => msg._id !== optimisticMessage._id));
                console.warn('Message not confirmed by server, removed optimistic message');
                socket.off('newMessage', handleMessageConfirmation);
                socket.off('newMessageToUser', handleMessageConfirmation);
            }, 5000);
            
            // Store timeout ID for cleanup
            optimisticMessage._fallbackTimeout = fallbackTimeout;
            
        } catch (error) {
            console.error('Error sending message via WebSocket:', error);
            
            // Remove optimistic message on error
            setMessages(prev => prev.filter(msg => msg._id !== optimisticMessage._id));
            
            throw error;
        }
    };

    // Mark only the last message as seen
    const markMessageAsSeen = async (message) => {
        try {
            await api.post('/message/seen', { messageId: message._id });
        } catch (error) {
            console.error('Error marking message as seen:', error);
        }
    };

    // Real-time socket listeners for new messages
    useEffect(() => {
        if (!friendId || !userId) return;

        // Join the chat room
        const roomId = [userId, friendId].sort().join('_');
        socket.emit('joinRoom', roomId);

        const appendIncomingMessage = (updatedMessage) => {
            const isOwnMessage = String(updatedMessage.senderId) === String(userId);
            // Capture before state update — don't yank the user if they're reading history.
            const shouldFollow = isOwnMessage || isNearBottomRef.current;

            setMessages(prev => {
                const existingIds = new Set(prev.map(m => m._id?.toString()).filter(Boolean));

                const optimisticIndex = prev.findIndex(msg =>
                    msg.isOptimistic &&
                    msg.senderId === updatedMessage.senderId &&
                    msg.message === updatedMessage.message &&
                    Math.abs(new Date(msg.timestamp) - new Date(updatedMessage.timestamp)) < 5000
                );

                if (optimisticIndex !== -1) {
                    const newMessages = [...prev];
                    newMessages[optimisticIndex] = updatedMessage;
                    return newMessages;
                }

                if (!existingIds.has(updatedMessage._id?.toString())) {
                    return [...prev, updatedMessage];
                }
                return prev;
            });

            if (shouldFollow) {
                scrollToLastMessage('smooth');
            }
        };

        // Listen for new messages in this room
        const handleNewMessage = (data) => {
            console.log('Received new message via socket:', data);
            if (data.updatedMessage &&
                (data.updatedMessage.senderId === friendId || data.updatedMessage.receiverId === friendId)) {
                appendIncomingMessage(data.updatedMessage);
            }
        };

        // Listen for messages sent to this user specifically
        const handleNewMessageToUser = (data) => {
            console.log('Received new message to user via socket:', data);
            if (data.updatedMessage &&
                (data.updatedMessage.senderId === friendId || data.updatedMessage.receiverId === friendId)) {
                appendIncomingMessage(data.updatedMessage);
            }
        };

        const handleMessageSeen = (data) => {
            if (!data?.messageId) return;
            setMessages(prev => prev.map(msg => {
                if (String(msg._id) === String(data.messageId)) {
                    return { ...msg, isSeen: true };
                }
                return msg;
            }));
        };

        socket.on('newMessage', handleNewMessage);
        socket.on('newMessageToUser', handleNewMessageToUser);
        socket.on('messageSeen', handleMessageSeen);

        return () => {
            socket.off('newMessage', handleNewMessage);
            socket.off('newMessageToUser', handleNewMessageToUser);
            socket.off('messageSeen', handleMessageSeen);
            socket.emit('leaveRoom', roomId);
        };
    }, [friendId, userId, scrollToLastMessage]);

    useEffect(() => {
        if (!friendId || !userId) return;

        // Get online status from contacts data (no API calls)
        const setOnlineStatus = () => {
            const statusData = getOnlineStatusFromContacts();
            setIsActive(statusData.isActive);
            
            if (statusData.lastSeen) {
                const lastSeenTimeStamp = moment(statusData.lastSeen);
                const currentTimeStamp = moment(Date.now());
                const diffDays = currentTimeStamp.diff(lastSeenTimeStamp, 'days');
                
                let formattedTime;
                if (diffDays === 0) {
                    formattedTime = lastSeenTimeStamp.format("hh:mm A");
                } else if (diffDays > 365) {
                    formattedTime = lastSeenTimeStamp.format("MM/YY hh:mm A");
                } else {
                    formattedTime = lastSeenTimeStamp.format("DD/MM hh:mm A");
                }
                
                setLastSeen(formattedTime);
            }
        };

        setOnlineStatus();

        // Refresh online status every 2 minutes (aligned with contacts refresh)
        const statusInterval = setInterval(setOnlineStatus, 120000);

        return () => clearInterval(statusInterval);
    }, [friendId, userId]);


    useEffect(() => {
        if (!friendId) return;
        api.get('/profile', {
            params: {
                profileId: friendId
            }
        }).then((res) => {
            setFriendProfile(res.data)
            dispatch(setLoading(false))

        }).catch(e => console.log(e))

    }, [friendId, dispatch])

    useEffect(() => {
        if (friendProfile && profile._id) {
            setIsBlockedMe(friendProfile.blockedUsers ? friendProfile.blockedUsers.includes(profile._id) : false)
        }
    }, [friendProfile, profile._id])

    useEffect(() => {
        if (!friendId || !userId) return;
        setRoom([userId, friendId].sort().join('_'));
        setMessages([]);
        setHasMoreMessages(true);
        setScrollPercent(100);
        loadingOlderRef.current = false;
        hasInitialScrolledRef.current = false;
        pendingScrollRestoreRef.current = null;
        isNearBottomRef.current = true;

        const fetchInitialMessages = async () => {
            setIsMsgLoading(true);
            try {
                const response = await fetchChatHistory(userId, friendId, 20);

                if (response.messages) {
                    setMessages(response.messages);
                    setHasMoreMessages(response.hasMore ?? false);
                } else {
                    setMessages([]);
                    setHasMoreMessages(false);
                }
            } catch (error) {
                console.error('Error fetching initial messages:', error);
                setMessages([]);
                setHasMoreMessages(false);
            } finally {
                setIsMsgLoading(false);
            }
        };

        fetchInitialMessages();
    }, [friendId, userId, fetchChatHistory]);

    // Scroll once after the first batch of messages for a chat is rendered.
    useLayoutEffect(() => {
        if (hasInitialScrolledRef.current) return;
        if (!friendId || messages.length === 0 || isMsgLoading) return;
        hasInitialScrolledRef.current = true;
        scrollToLastMessage('auto');
    }, [friendId, messages.length, isMsgLoading, scrollToLastMessage]);

    useEffect(() => {
        if (messages.length > 0 && friendId && friendProfile?._id) {
            const t = setTimeout(() => {
                const lastMessage = messages[messages.length - 1];
                if (lastMessage && lastMessage.senderId !== userId && lastMessage.senderId === friendId) {
                    markMessageAsSeen(lastMessage);
                    dispatch(seenMessage(friendId));

                    $('#chatMessageList .message-sent.chat-message-container .chat-message-seen-status').css('visibility', 'hidden');
                    $('#chatMessageList .message-sent.chat-message-container.message-id-' + lastMessage._id + ':last-child .chat-message-seen-status').css('visibility', 'visible');
                }
            }, 2000);
            return () => clearTimeout(t);
        }
    }, [messages, friendId, friendProfile?._id, userId, dispatch]);



    const footerProps = { chatFooter, room, friendId, setIsTyping, setIsReplying, isReplying, chatNewAttachment, messageActionButtonContainer, userId, messageInput, replyData, isPreview, setIsPreview, setReplyData, messages, friendProfile, sendMessage, msgListRef, scrollToLastMessage }
    const footerSlotRef = useRef(null);

    // Keep message list padded so the last bubble never sits under the pinned composer.
    useLayoutEffect(() => {
        const slot = footerSlotRef.current;
        const box = slot?.closest('#chatBox') || document.getElementById('chatBox');
        if (!slot || !box) return undefined;

        const syncFooterHeight = () => {
            const footerEl = slot.querySelector('[data-chat-footer="true"]') || slot;
            const height = Math.max(56, Math.ceil(footerEl.getBoundingClientRect().height) || 72);
            box.style.setProperty('--chat-footer-height', `${height}px`);
        };

        syncFooterHeight();
        // Re-measure after fonts/layout settle.
        const raf = requestAnimationFrame(syncFooterHeight);
        const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(syncFooterHeight) : null;
        if (ro) ro.observe(slot);
        window.addEventListener('resize', syncFooterHeight);

        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener('resize', syncFooterHeight);
            if (ro) ro.disconnect();
        };
    }, [isBlockedMe, friendId]);

    return (
        <div className="message-chat-root">
            <div id="chatBox" className="message-chat-box">
                <div ref={chatHeader} className='chat-header'>
                    <ChatHeader friendProfile={friendProfile} friendProfilePic={friendProfile.profilePic} isActive={isActive} lastSeen={lastSeen} room={room} />

                </div>
                <div className='chat-body'>
                    <div className='chat-message-list' id='chatMessageList' ref={msgListRef} >

                        {
                            messages.length > 0 ? messages.map((msg, index) => {

                                return (
                                    <SingleMessage key={msg._id || `msg-${index}`} msg={msg} friendProfile={friendProfile} messages={messages} setMessages={setMessages} isActive={isActive} setIsReplying={setIsReplying} setReplyData={setReplyData} isPreview={isPreview} setIsPreview={setIsPreview} msgListRef={msgListRef} isMsgLoading={isMsgLoading} />
                                )
                            }) : <>
                                {<SingleMsgSkleton count={10} />}
                            </>

                        }



                        {
                            isTyping && (
                                <div className={`chat-message-container message-receive message-typing`}>
                                    <div className='chat-message-profilePic'>
                                        <UserPP profilePic={`${friendProfile.profilePic}`} profile={friendProfile._id} active={friendProfile.isActive}></UserPP>
                                    </div>
                                    <div className='chat-message'>

                                        <p className='message-container mb-0'>

                                            {typeMessage || <div className='typing-indicator'>

                                                <span className='typing-dots'></span>
                                                <span className='typing-dots'></span>
                                                <span className='typing-dots'></span>

                                            </div>}
                                        </p>
                                    </div>

                                </div>
                            )
                        }



                    </div>
                </div>

                <div className="chat-footer-slot" ref={footerSlotRef} data-chat-footer-slot="true">
                    {
                        !isBlockedMe ?

                            <ChatFooter  {...footerProps} />
                            :
                            <div ref={chatFooter} className="chat-footer modern-composer" data-chat-footer="true">
                                <p className='text-center text-danger fs-6 mb-0 py-2'>{friendProfile.fullName} Blocked You</p>
                            </div>

                    }
                </div>
            </div>



        </div>
    );
};

export default Chat;