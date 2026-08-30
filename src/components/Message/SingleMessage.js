import React, { useEffect, useState, useRef } from "react";
import { useSelector } from "react-redux";
import moment from "moment";
import UserPP from "../UserPP";
import api from "../../api/api";
import $ from 'jquery'
import checkImgLoading from "../../utils/checkImgLoading";
import isValidUrl from "../../utils/isValiUrl";
import ImageSkleton from "../../skletons/post/ImageSkleton";
import socket from '../../common/socket';
const getMessageTime = (timestamp) => {
    const inputDate = moment(timestamp);

    // Format based on condition
    const formattedTime = inputDate.format("DD/MM/YY hh:mm A")

    return formattedTime;
}




const SingleMessage = ({ index, msg, friendProfile, messages, setMessages, setReplyData, setIsReplying, msgListRef, isPreview, setIsPreview }) => {

    const myProfile = useSelector(state => state.profile)
    const myId = myProfile._id
    const friendId = friendProfile._id
    const [isReactedByMe, setIsReactedByMe] = useState((msg.reacts || []).includes(myId))
    const [foundParentMsg, setFoundParentMsg] = useState(false)
    const [isReactedByFriend, setIsReactedByFriend] = useState((msg.reacts || []).includes(friendId))
    const [imageLoaded, setImageLoaded] = useState(false)
    const [parentImageLoaded, setParentImageLoaded] = useState(false)
    const [isPlaying, setIsPlaying] = useState(false)
    const [audioDuration, setAudioDuration] = useState(0)
    const [audioCurrent, setAudioCurrent] = useState(0)
    const [hasParentComment, setHasParentComment] = useState(false)
    const [showOptions, setShowOptions] = useState(true)
    const audioRef = useRef(null)

    useEffect(() => {
        if (isValidUrl(msg.attachment)) {
            // Only try to preload image if it's not an audio attachment
            if (!isAudioMessage()) {
                checkImgLoading(msg.attachment, setImageLoaded)
            }
        }
        if (isValidUrl(msg?.parent?.attachment)) {
            checkImgLoading(msg?.parent?.attachment, setParentImageLoaded)
        }
    }, [msg])

    useEffect(() => {
        if (imageLoaded) {

        }
    }, [imageLoaded])


    // Message reactions are now included with the message data - no separate polling needed
    useEffect(() => {
        // Set initial reaction state from message data
        if (msg.reacts && friendId) {
            const friendReacted = msg.reacts.includes(friendId);
            setIsReactedByFriend(friendReacted);
        }
        // Update my reaction state when message data changes
        if (msg.reacts) {
            const meReacted = msg.reacts.includes(myId);
            setIsReactedByMe(meReacted);
        }
    }, [msg.reacts, friendId, myId]);

    useEffect(() => {
        if (msg?.parent?._id) {
            setHasParentComment(true)
        }
    }, [])


    const hideOptions = () => {
        setShowOptions(false);
        // Reset after a short delay to allow hover to work again
        setTimeout(() => {
            setShowOptions(true);
        }, 100);
    }

    const handleDeleteMessage = async (e) => {
        const messageId = $(e.currentTarget).data('id');
        hideOptions();
        
        try {
            await api.post('/message/delete', { messageId });
            if (setMessages) {
                setMessages(prevMessages => prevMessages.filter(message => message._id !== messageId));
            }
        } catch (error) {
            console.error('Error deleting message:', error);
        }
    }

    const handleLikeMessage = async (e) => {
        const messageId = $(e.currentTarget).data('id');
        hideOptions();

        if (!isReactedByMe) {
            const postReactRes = await api.post('/message/addReact', { messageId, myId })
            if (postReactRes.status == 200) {
                setIsReactedByMe(true)
                // Update parent messages state to reflect new reaction
                if (setMessages) {
                    setMessages(prevMessages => 
                        prevMessages.map(m => 
                            m._id === messageId 
                                ? { ...m, reacts: [...(m.reacts || []), myId] }
                                : m
                        )
                    );
                }
            }

        } else {
            const removeReactRes = await api.post('/message/removeReact', { messageId, myId })
            if (removeReactRes.status == 200) {
                setIsReactedByMe(false)
                // Update parent messages state to reflect removed reaction
                if (setMessages) {
                    setMessages(prevMessages => 
                        prevMessages.map(m => 
                            m._id === messageId 
                                ? { ...m, reacts: (m.reacts || []).filter(id => id !== myId) }
                                : m
                        )
                    );
                }
            }
        }
    }

    const handleReplyMessage = async (e) => {
        const messageId = $(e.currentTarget).data('id');
        hideOptions();
        setIsReplying(true)
        setIsPreview(true)
        setReplyData({
            messageId,
            body: msg.message
        })
    }
    const handleSpeakMessage = async (e) => {
        hideOptions();
        try {
            // Relay speech request to the server.
            // Server will forward to the other user and Android will speak via TTS.
            const msgId = msg?._id || msg?.id;
            const message = msg?.message || '';
            const targetFriendId = friendId;

            if (!targetFriendId || !msgId) {
                console.warn('Speak failed: missing friendId or msgId', { targetFriendId, msgId });
                return;
            }

            socket.emit('speak_message', {
                msgId,
                friendId: targetFriendId,
                message,
            });
        } catch (err) {
            console.error('Speak failed:', err);
        }
    }


    const handleParentMsgClick = async (e) => {
        const parentId = e.currentTarget.dataset.parent

        const allMessages = document.querySelectorAll(`#chatMessageList .chat-message-container .chat-message`)
        allMessages.forEach((element) => {
            element.style.border = 'unset'
        })

        let selectedMessage = document.querySelector(`#chatMessageList .chat-message-container.message-id-${parentId} .chat-message`)


        if (selectedMessage !== null) {
            selectedMessage.scrollIntoView({ behavior: "smooth" })
            selectedMessage.style.border = '2px solid #29B1A9'
            setFoundParentMsg(true)

        }

        new CustomEvent('scroll', { bubbles: true, cancelable: true })

        const msgFoundInterval = setInterval(() => {

            if (foundParentMsg) {
                selectedMessage = document.querySelector(`#chatMessageList .chat-message-container.message-id-${parentId} .chat-message`)
                selectedMessage.scrollIntoView({ behavior: "smooth" })
                selectedMessage.style.border = '2px solid #29B1A9';
                clearInterval(msgFoundInterval)
            }

            if (selectedMessage == null) {
                if (isMsgLoading == false) {
                    msgListRef.current.scrollTop = 10
                    msgListRef.current.dispatchEvent(scrollEvent)
                    selectedMessage = document.querySelector(`#chatMessageList .chat-message-container.message-id-${parentId} .chat-message`)
                }

            } else {

                selectedMessage = document.querySelector(`#chatMessageList .chat-message-container.message-id-${parentId} .chat-message`)
                if (selectedMessage) {
                    setFoundParentMsg(true)
                    clearInterval(msgFoundInterval)
                    selectedMessage.scrollIntoView({ behavior: "smooth" })
                    selectedMessage.style.border = '2px solid #29B1A9'
                }

            }

        }, 1500)

    }


    const isCallMessage = msg.messageType === 'call';
    const isAudioUrl = (url) => {
        if (!url || typeof url !== 'string') return false;
        const lower = url.split('?')[0].toLowerCase();
        return [
            '.mp3', '.m4a', '.aac', '.ogg', '.oga', '.opus', '.wav', '.webm'
        ].some(ext => lower.endsWith(ext));
    }

    const isAudioMessage = () => {
        return msg.messageType === 'audio' || isAudioUrl(msg.attachment);
    }

    const formatTime = (secs) => {
        if (!isFinite(secs)) return '00:00';
        const s = Math.floor(secs % 60).toString().padStart(2, '0')
        const m = Math.floor(secs / 60).toString().padStart(2, '0')
        return `${m}:${s}`
    }

    const onAudioLoaded = () => {
        if (audioRef.current) {
            setAudioDuration(audioRef.current.duration || 0)
        }
    }
    const onAudioTimeUpdate = () => {
        if (audioRef.current) {
            setAudioCurrent(audioRef.current.currentTime || 0)
        }
    }
    const togglePlay = () => {
        if (!audioRef.current) return;
        if (audioRef.current.paused) {
            audioRef.current.play()
            setIsPlaying(true)
        } else {
            audioRef.current.pause()
            setIsPlaying(false)
        }
    }
    const onSeek = (e) => {
        if (!audioRef.current) return;
        const value = Number(e.target.value)
        audioRef.current.currentTime = value
        setAudioCurrent(value)
    }
    const onAudioEnded = () => {
        setIsPlaying(false)
        setAudioCurrent(audioDuration)
    }

    const renderCallContent = () => {
        const isVideo = msg.callType === 'video';
        const event = msg.callEvent || 'ended';
        const iconClass = isVideo ? 'fa-video-camera' : 'fa-phone';
        const color = event === 'missed' ? '#e11d48' : '#64748b';
        const text = msg.message || (event === 'missed' ? (isVideo ? 'Missed video call' : 'Missed audio call') : (isVideo ? 'Video call' : 'Audio call'));
        return (
            <div className='message-container mb-0'>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color }}>
                    <i className={`fa ${iconClass}`}></i>
                    <span className="message-text" style={{ color }}>{text}</span>
                </div>
            </div>
        );
    };

    const renderAudioContent = () => {
        const src = msg.attachment;
        return (
            <div className='message-container mb-0'>
                <div className='voice-message' style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button
                        type='button'
                        onClick={togglePlay}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); togglePlay(); } }}
                        aria-label={isPlaying ? 'Pause voice message' : 'Play voice message'}
                        className='voice-play-btn'
                        style={{ width: 36, height: 36, borderRadius: 18, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: '#1DB954', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                        <i className={`fa ${isPlaying ? 'fa-pause' : 'fa-play'}`}></i>
                    </button>
                    <input
                        type='range'
                        min={0}
                        max={Math.max(1, Math.floor(audioDuration))}
                        value={Math.floor(audioCurrent)}
                        onChange={onSeek}
                        aria-label='Seek voice message'
                        style={{ flex: 1, accentColor: '#1DB954' }}
                    />
                    <span className='voice-time' style={{ color: '#cbd5e1', fontSize: 12, minWidth: 52, textAlign: 'right' }}>{formatTime(audioCurrent)} / {formatTime(audioDuration)}</span>
                    <a href={src} target='_blank' rel='noreferrer' aria-label='Open in new tab' style={{ color: '#94a3b8' }}>
                        <i className='fa fa-external-link'></i>
                    </a>
                    <audio
                        ref={audioRef}
                        src={src}
                        preload='metadata'
                        onLoadedMetadata={onAudioLoaded}
                        onTimeUpdate={onAudioTimeUpdate}
                        onEnded={onAudioEnded}
                        style={{ display: 'none' }}
                    />
                </div>
            </div>
        )
    }

    return (<>
        {msg.senderId !== myId ?

            (
                <div key={index} className={`chat-message-container message-receive message-id-${msg._id} ${isReactedByMe === true || isReactedByFriend == true ? 'message-reacted' : ''} ${msg.isOptimistic ? 'message-optimistic' : ''}`} data-toggle="tooltip" title={getMessageTime(msg.timestamp)}>
                    <div className='chat-message-profilePic'>
                        <UserPP profilePic={`${friendProfile.profilePic}`} profile={friendProfile._id} active={friendProfile.isActive} ></UserPP>
                    </div>
                    <div className={`chat-message ${isValidUrl(messages.attachment) && 'has-attachment'}`}>
                        {!isCallMessage && <div className={`chat-message-options ${!showOptions ? 'options-hidden' : ''}`}>
                            <button type='button' data-id={msg._id} className={`chat-message-option like ${isReactedByMe == true ? 'reacted' : ''}`} onClick={handleLikeMessage.bind(this)}><i className="fa fa-thumbs-up"></i></button>
                            <button type='button' data-id={msg._id} className={`chat-message-option reply`} onClick={handleReplyMessage.bind(this)}><i className="fa fa-reply"></i></button>
                            <button type='button' data-id={msg._id} className='chat-message-option share' onClick={handleSpeakMessage.bind(this)}><i className="fa fa-volume-up"></i></button>
                        </div>}

                        {msg?.parent === undefined || msg?.parent === null || !msg?.parent?._id ? (<></>) : (<div 
                            onClick={handleParentMsgClick} 
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleParentMsgClick(e); } }}
                            role="button"
                            tabIndex={0}
                            data-parent={msg?.parent?._id} 
                            className={`parent-message-container ${isValidUrl(msg?.parent?.attachment) && 'has-attachment'}`}>
                            <span>{msg?.parent?.message}</span>

                            {
                                parentImageLoaded == true ? (<div className="message-attachment-container">
                                    <img src={msg?.parent?.attachment} alt="Message Attchment" className="message-attachment" />
                                </div>
                                )
                                    :
                                    isValidUrl(msg?.parent?.attachment) && (<ImageSkleton style={{ minWidth: '300px' }} />)

                            }
                        </div>)}

                        {isCallMessage ? renderCallContent() : (isAudioMessage() ? renderAudioContent() : (
                            <div className='message-container mb-0'>
                                <span className="message-text">{msg.message}</span>
                            </div>
                        ))}

                        {!isCallMessage && !isAudioMessage() && (
                            imageLoaded == true ? (<div className="message-attachment-container">
                                <img src={msg.attachment} alt="" className="message-attachment" />
                            </div>
                            )
                                :
                                isValidUrl(msg.attachment) && (<ImageSkleton style={{ minWidth: '300px' }} />)
                        )}
                        <div className='message-meta'>
                            <span className='message-time'>{getMessageTime(msg.timestamp)}</span>
                            <span className='message-react'><i>👍</i></span>
                        </div>
                    </div>
                    <div className='chat-message-seen-status d-none'>
                        Seen
                    </div>
                </div>
            )

            :

            (
                <div key={index} className={`chat-message-container message-sent message-id-${msg._id} ${isReactedByMe === true || isReactedByFriend == true ? 'message-reacted' : ''} ${msg.isOptimistic ? 'message-optimistic' : ''}`} data-toggle="tooltip" title={getMessageTime(msg.timestamp)} style={{ position: 'relative' }}>


                    <div className={`chat-message ${isValidUrl(messages.attachment) && 'has-attachment'}`}>
                        {!isCallMessage && <div className={`chat-message-options ${!showOptions ? 'options-hidden' : ''}`}>
                            <button type='button' data-id={msg._id} className={`chat-message-option like ${isReactedByMe == true ? 'reacted' : ''}`} onClick={handleLikeMessage.bind(this)}><i className="fa fa-thumbs-up"></i></button>
                            <button type='button' data-id={msg._id} className={`chat-message-option reply`} onClick={handleReplyMessage.bind(this)}><i className="fa fa-reply"></i></button>

                            <button type='button' data-id={msg._id} className='chat-message-option share speaker' onClick={handleSpeakMessage.bind(this)}><i className="fa fa-volume-up"></i></button>

                            <button type='button' data-id={msg._id} className='chat-message-option delete' onClick={handleDeleteMessage.bind(this)}><i className="fa fa-trash"></i></button>
                        </div>}

                        {msg?.parent === undefined || msg?.parent === null || !msg?.parent?._id ? (<></>) : (<>
                            <div 
                                onClick={handleParentMsgClick} 
                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleParentMsgClick(e); } }}
                                role="button"
                                tabIndex={0}
                                data-parent={msg?.parent?._id} 
                                className={`parent-message-container ${isValidUrl(msg?.parent?.attachment) && 'has-attachment'}`}>
                                <span>{msg?.parent?.message}</span>

                                {
                                    parentImageLoaded == true ? (<div className="message-attachment-container">
                                        <img src={msg?.parent?.attachment} alt="" className="message-attachment" />
                                    </div>
                                    )
                                        :
                                        isValidUrl(msg?.parent?.attachment) && (<ImageSkleton style={{ minWidth: '400px', width: '400px' }} />)

                                }
                            </div>

                        </>)}


                        {isCallMessage ? renderCallContent() : (isAudioMessage() ? renderAudioContent() : (
                            <div className='message-container mb-0'>
                                <span className="message-text">{msg.message}</span>
                            </div>
                        ))}


                        {!isCallMessage && !isAudioMessage() && (
                            imageLoaded == true ? (<div className="message-attachment-container">
                                <img src={msg.attachment} alt="Message Attchment" className="message-attachment" />
                            </div>
                            )
                                :
                                isValidUrl(msg.attachment) && (<ImageSkleton style={{ minWidth: '300px' }} />)
                        )}
                        <div className='message-meta'>
                            <span className='message-time'>{getMessageTime(msg.timestamp)}</span>
                            <span className='message-react'><i>👍</i></span>
                            {msg.isSeen ? (
                                <span className='message-seen-check' title='Seen' aria-label='Seen'>
                                    <i className="fas fa-check-double"></i>
                                </span>
                            ) : null}
                        </div>

                    </div>

                    <div className='chat-message-profilePic'>
                        <UserPP
                            profilePic={`${myProfile.profilePic || ''}`}
                            profile={myId}
                            active={false}
                        />
                    </div>
                </div>
            )
        }
    </>)
}


export default SingleMessage;