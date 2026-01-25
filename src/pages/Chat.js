import React, { useEffect, useState, useRef } from 'react';
import { setLoading } from '../services/actions/optionAction';
import { useDispatch, useSelector } from 'react-redux';
import { useParams } from 'react-router-dom';
import api from '../api/api';
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

    // HTTP-based online status check
    const checkOnlineStatus = async (profileId, friendId) => {
        try {
            const response = await api.get('/profile/online-status', {
                params: { profileId: friendId, myId: profileId }
            });
            return response.data;
        } catch (error) {
            console.error('Error checking online status:', error);
            return { isActive: false, lastSeen: null };
        }
    };

    // HTTP-based message sending
    const sendMessage = async (messageData) => {
        try {
            const response = await api.post('/message/send', messageData);
            return response.data;
        } catch (error) {
            console.error('Error sending message:', error);
            throw error;
        }
    };

    // HTTP-based mark as seen
    const markMessageAsSeen = async (message) => {
        try {
            await api.post('/message/seen', { messageId: message._id });
        } catch (error) {
            console.error('Error marking message as seen:', error);
        }
    };

    // Polling for new messages
    useEffect(() => {
        if (!friendId || !userId) return;

        const pollInterval = setInterval(async () => {
            try {
                const response = await api.get('/message/new-messages', {
                    params: {
                        profileId: userId,
                        friendId,
                        lastMessageId: messages.length > 0 ? messages[0]._id : null
                    }
                });
                
                if (response.data.messages && response.data.messages.length > 0) {
                    setMessages(prev => [...response.data.messages, ...prev]);
                    scrollToLastMessage();
                }
            } catch (error) {
                console.error('Error polling for new messages:', error);
            }
        }, 5000); // Poll every 5 seconds

        return () => clearInterval(pollInterval);
    }, [friendId, userId, messages.length]);

    useEffect(() => {
        if (!friendId || !userId) return;

        // Initial online status check
        const checkStatus = async () => {
            const statusData = await checkOnlineStatus(userId, friendId);
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

        checkStatus();

        // Poll for online status updates
        const statusInterval = setInterval(checkStatus, 30000); // Check every 30 seconds

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
                                    <SingleMessage key={index} msg={msg} friendProfile={friendProfile} messages={messages} isActive={isActive} setIsReplying={setIsReplying} setReplyData={setReplyData} isPreview={isPreview} setIsPreview={setIsPreview} msgListRef={msgListRef} isMsgLoading={isMsgLoading} />
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