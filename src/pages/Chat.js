import React, { useEffect, useState, useRef } from 'react';
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
import useIsMobile from '../utils/useIsMobile';
import SingleMsgSkleton from '../skletons/message/SingleMsgSkleton';



const Chat = ({ }) => {
    const dispatch = useDispatch();
    const profile = useSelector(state => state.profile)
    const headerHeight = useSelector(state => state.option.headerHeight)
    const bodyHeight = useSelector(state => state.option.bodyHeight)
    const settings = useSelector(state => state.setting)
    const userId = profile._id
    const [friendProfile, setFriendProfile] = useState({})
    const [isBlockedMe, setIsBlockedMe] = useState(true)
    const [lastSeen, setLastSeen] = useState(false);

    const isMobile = useIsMobile()

    const [room, setRoom] = useState('');
    const [isActive, setIsActive] = useState(false);
    const [isReplying, setIsReplying] = useState(false);
    const [isPreview, setIsPreview] = useState(false);
    const [messages, setMessages] = useState([]);
    const [isTyping, setIsTyping] = useState(false);
    const [isMsgLoading, setIsMsgLoading] = useState(false);
    const [typeMessage, setTypeMessage] = useState('');
    const [hasMoreMessages, setHasMoreMessages] = useState(true);
    const [isLoaded, setIsLoaded] = useState(false)
    const [scrollPercent, setScrollPercent] = useState(0);
    const [replyData, setReplyData] = useState({ messageId: null, body: null });
    const msgListRef = useRef(null);
    const messageInput = useRef(null);
    const chatHeader = useRef(null);
    const chatFooter = useRef(null);


    const chatNewAttachment = useRef(null);
    const messageActionButtonContainer = useRef(null);

    const chatHeaderHeight = chatHeader.current?.offsetHeight;
    const chatFooterHeight = chatFooter.current?.offsetHeight;
    const chatFooterWidth = chatFooter.current?.offsetWidth;
    const newAttachmentWidth = chatNewAttachment.current?.offsetWidth;
    const messageActionButtonContainerWidth = messageActionButtonContainer.current?.offsetWidth;
    const messageInputWidth = chatFooterWidth - newAttachmentWidth - messageActionButtonContainerWidth

    const scrollToLastMessage = () => {
        if (msgListRef.current != null) {
            const isLastMsg = setInterval(() => {
                const lastMsg = document.querySelector('#chatMessageList .chat-message-container:last-child')
                lastMsg?.scrollIntoView({ behavior: "smooth" });
            }, 500)

            msgListRef.current.addEventListener('scroll', (e) => {
                const scrollBottom = e.target.scrollHeight - e.target.scrollTop - e.target.clientHeight;
                console.log('scrl', e.target.scrollHeight, e.target.scrollTop, scrollBottom)

                if (scrollBottom <= 5) {
                    clearInterval(isLastMsg)

                }

            })

        }


    }



    if (messageInput.current !== null) {
        messageInput.current.style.width = messageInputWidth + 'px'
    }


    const chatBoxHeight = bodyHeight - headerHeight
    const params = useParams()
    const friendId = params.profile;

    useEffect(() => {
        dispatch(seenMessage(params.profile))
    }, [params])

    const [listContainerHeight, setListContainerHeight] = useState(chatBoxHeight - chatHeaderHeight - chatFooterHeight);
    const [cmlStyles, setCmlStyles] = useState({
        height: `${isMobile ? bodyHeight - headerHeight - chatFooterHeight - chatHeaderHeight + 50 : (chatBoxHeight - chatHeaderHeight )}px`,
        maxHeight: `${isMobile ? listContainerHeight + headerHeight +50 : (chatBoxHeight - chatHeaderHeight - 80)}px`,
        overflowY: 'scroll'
    });



    useEffect(() => {
        const newListHeaderHeight = bodyHeight - headerHeight - chatHeaderHeight - chatFooterHeight
        setListContainerHeight(newListHeaderHeight)

        console.log('listContainerHeight',chatBoxHeight , chatHeaderHeight , chatFooterHeight, listContainerHeight)

        setCmlStyles({
            height: `${isMobile ? bodyHeight - headerHeight - chatFooterHeight - chatHeaderHeight + 50 : (chatBoxHeight - chatHeaderHeight -80)}px`,
            maxHeight: `${isMobile ? listContainerHeight + headerHeight + 50 : (chatBoxHeight - chatHeaderHeight -80)}px`,
            overflowY: 'scroll'
        })
    }, [isReplying, isLoaded])


    useEffect(() => {
        const handleScroll = () => {
            const el = msgListRef.current;
            const scrollTop = el.scrollTop;
            const scrollHeight = el.scrollHeight - el.clientHeight;
            const percent = (scrollTop / scrollHeight) * 100;
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

    useEffect(() => {
        if (hasMoreMessages) {
            if (scrollPercent < 30) {
                const loadMoreMessages = async () => {
                    setIsMsgLoading(true);
                    const response = await fetchMessages(userId, friendId, 20, messages.length);
                    setMessages(prev => [...response.messages, ...prev]);
                    setHasMoreMessages(response.hasMore);
                    setIsMsgLoading(false);
                };
                
                loadMoreMessages();
            }
        }
    }, [scrollPercent, hasMoreMessages, messages.length, userId, friendId]);


    // HTTP-based message fetching
    const fetchMessages = async (profileId, friendId, limit = 20, skip = 0) => {
        try {
            const response = await api.get('/message/getChatHistory', {
                params: {
                    profileId,
                    friendId,
                    limit,
                    skip
                }
            });
            return response.data;
        } catch (error) {
            console.error('Error fetching messages:', error);
            return { messages: [], hasMore: false };
        }
    };

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
        
        scrollToLastMessage();

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

        // Listen for new messages in this room
        const handleNewMessage = (data) => {
            console.log('Received new message via socket:', data);
            if (data.updatedMessage && 
                (data.updatedMessage.senderId === friendId || data.updatedMessage.receiverId === friendId)) {
                setMessages(prev => {
                    const existingIds = new Set(prev.map(m => m._id?.toString()).filter(Boolean));
                    
                    // Check if this is a confirmation of an optimistic message
                    const optimisticIndex = prev.findIndex(msg => 
                        msg.isOptimistic && 
                        msg.senderId === data.updatedMessage.senderId &&
                        msg.message === data.updatedMessage.message &&
                        Math.abs(new Date(msg.timestamp) - new Date(data.updatedMessage.timestamp)) < 5000 // Within 5 seconds
                    );
                    
                    if (optimisticIndex !== -1) {
                        // Replace optimistic message with real message
                        const newMessages = [...prev];
                        newMessages[optimisticIndex] = data.updatedMessage;
                        return newMessages;
                    } else if (!existingIds.has(data.updatedMessage._id?.toString())) {
                        // Add new message from other user
                        return [...prev, data.updatedMessage];
                    }
                    return prev;
                });
                scrollToLastMessage();
            }
        };

        // Listen for messages sent to this user specifically
        const handleNewMessageToUser = (data) => {
            console.log('Received new message to user via socket:', data);
            if (data.updatedMessage && 
                (data.updatedMessage.senderId === friendId || data.updatedMessage.receiverId === friendId)) {
                setMessages(prev => {
                    const existingIds = new Set(prev.map(m => m._id?.toString()).filter(Boolean));
                    
                    // Check if this is a confirmation of an optimistic message
                    const optimisticIndex = prev.findIndex(msg => 
                        msg.isOptimistic && 
                        msg.senderId === data.updatedMessage.senderId &&
                        msg.message === data.updatedMessage.message &&
                        Math.abs(new Date(msg.timestamp) - new Date(data.updatedMessage.timestamp)) < 5000 // Within 5 seconds
                    );
                    
                    if (optimisticIndex !== -1) {
                        // Replace optimistic message with real message
                        const newMessages = [...prev];
                        newMessages[optimisticIndex] = data.updatedMessage;
                        return newMessages;
                    } else if (!existingIds.has(data.updatedMessage._id?.toString())) {
                        // Add new message from other user
                        return [...prev, data.updatedMessage];
                    }
                    return prev;
                });
                scrollToLastMessage();
            }
        };

        socket.on('newMessage', handleNewMessage);
        socket.on('newMessageToUser', handleNewMessageToUser);

        return () => {
            socket.off('newMessage', handleNewMessage);
            socket.off('newMessageToUser', handleNewMessageToUser);
            socket.emit('leaveRoom', roomId);
        };
    }, [friendId, userId]);

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
        setIsLoaded(!isLoaded)
    }, [listContainerHeight])

    useEffect(() => {

        api.get('/profile', {
            params: {
                profileId: friendId
            }
        }).then((res) => {
            setFriendProfile(res.data)
            dispatch(setLoading(false))

        }).catch(e => console.log(e))

    }, [params, friendId])

    useEffect(() => {

        if (friendProfile) {
            setIsBlockedMe(friendProfile.blockedUsers ? friendProfile.blockedUsers.includes(profile._id) : false)
        }

        scrollToLastMessage()


        if (!friendId || !userId) return; // Prevent self-chat
        const newRoom = [userId, friendId].sort().join('_');
        setRoom(newRoom);

        // Fetch initial messages via HTTP API
        const fetchInitialMessages = async () => {
            try {
                const response = await fetchMessages(userId, friendId, 20, 0);
                
                if (response.messages) {
                    setMessages(response.messages);
                    setHasMoreMessages(response.hasMore);
                }
            } catch (error) {
                console.error('Error fetching initial messages:', error);
                setMessages([]);
                setHasMoreMessages(false);
            }
        };

        fetchInitialMessages();
    }, [params, friendProfile]);

    useEffect(() => {
        // Only process seen message if we have messages, friendId, and friend profile is loaded
        if (messages.length > 0 && friendId && friendProfile?._id) {
            setTimeout(() => {
                const lastMessage = messages[messages.length - 1];
                // Only mark as seen if the last message is from the friend (not from current user)
                if (lastMessage && lastMessage.senderId !== userId && lastMessage.senderId === friendId) {
                    markMessageAsSeen(lastMessage);
                    dispatch(seenMessage(friendId));
                    
                    // Update UI to show message as seen
                    $('#chatMessageList .message-sent.chat-message-container .chat-message-seen-status').css('visibility', 'hidden');
                    $('#chatMessageList .message-sent.chat-message-container.message-id-' + lastMessage._id + ':last-child .chat-message-seen-status').css('visibility', 'visible');
                }
            }, 2000);
        }
    }, [params, messages, friendId, friendProfile, userId]);



    const footerProps = { chatFooter, room, friendId, setIsTyping, setIsReplying, isReplying, chatNewAttachment, messageActionButtonContainer, userId, messageInput, replyData, isPreview, setIsPreview, setReplyData, messages, friendProfile, sendMessage }

    return (
        <div>
            <div id="chatBox" style={{ minHeight: `${chatBoxHeight - 15}px` }}>
                <div ref={chatHeader} className='chat-header'>
                    <ChatHeader friendProfile={friendProfile} friendProfilePic={friendProfile.profilePic} isActive={isActive} lastSeen={lastSeen} room={room} />

                </div>
                <div className='chat-body'>
                    <div className='chat-message-list' style={cmlStyles} id='chatMessageList' ref={msgListRef} >

                        {
                            messages.length > 0 ? messages.map((msg, index) => {

                                return (
                                    <SingleMessage key={index} msg={msg} friendProfile={friendProfile} messages={messages} setMessages={setMessages} isActive={isActive} setIsReplying={setIsReplying} setReplyData={setReplyData} isPreview={isPreview} setIsPreview={setIsPreview} msgListRef={msgListRef} isMsgLoading={isMsgLoading} />
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

                {
                    !isBlockedMe ?

                        <ChatFooter  {...footerProps} />
                        :
                        <div ref={chatFooter} className="chat-footer">
                            <p className='text-center text-danger fs-4 mb-0'>{friendProfile.fullName} Blocked You</p>
                        </div>

                }
            </div>



        </div>
    );
};

export default Chat;