import React, { useEffect, useState, useRef, useCallback, useId } from 'react';
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



const Chat = ({ socket }) => {
    let dispatch = useDispatch();
    let profile = useSelector(state => state.profile)
    let headerHeight = useSelector(state => state.option.headerHeight)
    let bodyHeight = useSelector(state => state.option.bodyHeight)
    let settings = useSelector(state => state.setting)
    let userId = profile._id
    let [friendProfile, setFriendProfile] = useState({})
    let [isBlockedMe, setIsBlockedMe] = useState(true)
    const [lastSeen, setLastSeen] = useState(false);

    let isMobile = useIsMobile()

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

    const scrollToLastMessage = e => {
        if (msgListRef.current != null) {
            let isLastMsg = setInterval(() => {
                let lastMsg = document.querySelector('#chatMessageList .chat-message-container:last-child')
                lastMsg?.scrollIntoView({ behavior: "smooth" });
            }, 500)

            msgListRef.current.addEventListener('scroll', e => {
                let scrollBottom = e.target.scrollHeight - e.target.scrollTop - e.target.clientHeight;
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
    let params = useParams()
    let friendId = params.profile;

    useEffect(() => {
        dispatch(seenMessage(params.profile))
    }, [params])

    const [listContainerHeight, setListContainerHeight] = useState(chatBoxHeight - chatHeaderHeight - chatFooterHeight);
    const [cmlStyles, setCmlStyles] = useState({
        height: `${isMobile ? bodyHeight - headerHeight - chatFooterHeight - chatHeaderHeight : listContainerHeight}px`,
        maxHeight: `${isMobile ? listContainerHeight + headerHeight : listContainerHeight}px`,
        overflowY: 'scroll'
    });



    useEffect(() => {
        let newListHeaderHeight = bodyHeight - headerHeight - chatHeaderHeight - chatFooterHeight
        setListContainerHeight(newListHeaderHeight)

        setCmlStyles({
            height: `${isMobile ? bodyHeight - headerHeight - chatFooterHeight - chatHeaderHeight : listContainerHeight}px`,
            maxHeight: `${isMobile ? listContainerHeight + headerHeight : listContainerHeight}px`,
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
                socket.emit('loadMessages', { myId: userId, friendId, skip: messages.length })
                setIsMsgLoading(true)
                setHasMoreMessages(false)
            }
        }

    }, [scrollPercent])


    useEffect(() => {
        socket.emit('is_active', { profileId: friendId, myId: userId });
        socket.on('is_active', (data, ls) => {

            let lastSeenTimeStamp = moment(ls)
            let currentTimeStamp = moment(Date.now())

            let diffDays = currentTimeStamp.diff(lastSeenTimeStamp, 'days')
            let diffYears = currentTimeStamp.diff(lastSeenTimeStamp, 'days')

            setIsActive(data === true ? true : false)

            let lastSeenTime;
            let formattedTime;
            if (diffDays === 0) {
                lastSeenTime = moment(ls)
                formattedTime = lastSeenTime.format("hh:mm A")
            } else if (diffYears > 0) {
                lastSeenTime = moment(ls)
                formattedTime = lastSeenTime.format("MM/YY hh:mm A")
            }

            else {
                lastSeenTime = moment(ls)
                formattedTime = lastSeenTime.format("DD/MM hh:mm A")
            }







            setLastSeen(formattedTime)
        })

        socket.on('messageReacted', (messageId) => {
            let msgSelector = '#chatMessageList .chat-message-container .message-id-' + messageId
            $(msgSelector).addClass('message-reacted')
        })

        socket.on('messageReactRemoved', (messageId) => {
            if (messageId) {
                let msgSelector = '#chatMessageList .chat-message-container .message-id-' + messageId
                $(msgSelector).removeClass('message-reacted')
            }

        })

        return () => {
            socket.off('messageReacted')
            socket.off('messageReactRemoved')
            socket.off('is_active')
        }
    }, [friendProfile, params])


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
        socket.emit('startChat', { user1: userId, user2: friendId });
        setRoom(newRoom);
        socket.on('roomJoined', ({ room }) => {
            console.log(`Joined room: ${room}`);
            localStorage.setItem('roomId', room);
        });


        socket.on('loadMessages', ({ loadedMessages, hasNewMessage }) => {
            setHasMoreMessages(hasNewMessage)
            setIsMsgLoading(false)
            setMessages(messages => [...loadedMessages, ...messages])
            // setPageNumber(currentPage + 1)
        })

        socket.on('previousMessages', (msgs) => {
            setMessages(msgs);
            setHasMoreMessages(true)
        });
        socket.on('newMessage', ({ updatedMessage, senderName, senderPP }) => {
            if (updatedMessage.receiverId == userId && updatedMessage.senderId == friendId) {
                setMessages((prevMessages) => [...prevMessages, updatedMessage]);

                scrollToLastMessage()
            }
            if (updatedMessage.senderId == userId && updatedMessage.receiverId == friendId) {
                setMessages((prevMessages) => [...prevMessages, updatedMessage]);

                scrollToLastMessage()
            }

        });
        socket.on('deleteMessage', (messageId) => {
            if ($(`#chatBox .chat-body .chat-message-list`).has(`.chat-message-container.message-id-${messageId}`)) {
                $(`#chatBox .chat-body .chat-message-list .chat-message-container.message-id-${messageId}`).hide();
            }
        })

        socket.on('typing', ({ receiverId, isTyping, type }) => {

            if (receiverId == friendId) {
                if (isTyping == true) {
                    setIsTyping(true)
                    setTypeMessage(type)
                    scrollToLastMessage()

                } else {
                    setIsTyping(false)
                }
            }

        })

        socket.on('update_type', ({ type }) => {
            setTypeMessage(type)
        })
        return () => {
            socket.off('newMessage');
            socket.off('previousMessages');
            socket.off('deleteMessage')
            socket.off('update_type')
            socket.off('typing')
            socket.off('loadMessages')
        };
    }, [params, friendProfile]);

    useEffect(() => {
        if (messages.length > 0) {
            setTimeout(() => {
                let lastMessage = messages[messages.length - 1];
                if (lastMessage.senderId !== userId) {
                    socket.emit('seenMessage', lastMessage);
                    dispatch(seenMessage(friendId))
                }
            }, 2000);
        }
        socket.on('seenMessage', (msg) => {
            $('#chatMessageList .message-sent.chat-message-container .chat-message-seen-status').css('visibility', 'hidden');
            $('#chatMessageList .message-sent.chat-message-container.message-id-' + msg._id + ':last-child .chat-message-seen-status').css('visibility', 'visible');
        })

        return () => {
            socket.off('seenMessage');
        }
    }, [params, messages])



    let footerProps = { chatFooter, room, friendId, setIsTyping, setIsReplying, isReplying, chatNewAttachment, messageActionButtonContainer, userId, messageInput, replyData, isPreview, setIsPreview, setReplyData, messages }

    return (
        <div>
            <div id="chatBox" style={{ minHeight: `${chatBoxHeight}px` }}>
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
                             {<SingleMsgSkleton count={10} /> } 
                            </>

                        }



                        {
                            isTyping && (
                                <div className={`chat-message-container message-receive message-typing`}>
                                    <div className='chat-message-profilePic'>
                                        <UserPP profilePic={`${friendProfile.profilePic}`} profile={friendProfile._id} active></UserPP>
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