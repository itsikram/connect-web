import React, { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import moment from "moment";
import UserPP from "../UserPP";
import socket from "../../common/socket";
import $ from 'jquery'
import api from "../../api/api";
import checkImgLoading from "../../utils/checkImgLoading";
import isValidUrl from "../../utils/isValiUrl";
import ImageSkleton from "../../skletons/post/ImageSkleton";
let getMessageTime = (timestamp) => {
    const inputDate = moment(timestamp);
    const now = moment();

    // Format based on condition
    const formattedTime = inputDate.format("DD/MM/YY hh:mm A")

    return formattedTime;
}




const SingleMessage = ({ index, msg, friendProfile, isActive, messages, setReplyData, setIsReplying, setIsPreview, isPreview, msgListRef, isMsgLoading }) => {



    let myProfile = useSelector(state => state.profile)
    let myId = myProfile._id
    let friendId = friendProfile._id
    let isReacted = msg.reacts.includes(myId) || msg.reacts.includes(myId)
    let [isReactedByMe, setIsReactedByMe] = useState(msg.reacts.includes(myId))
    let [foundParentMsg, setFoundParentMsg] = useState(false)
    let [isReactedByFriend, setIsReactedByFriend] = useState(msg.reacts.includes(friendId))
    let [imageLoaded, setImageLoaded] = useState(false)
    let [parentImageLoaded, setParentImageLoaded] = useState(false)
    let [hasParentComment, setHasParentComment] = useState((msg && msg?.parent === undefined ? false : true))

    useEffect(() => {
        if (isValidUrl(msg.attachment)) {
            checkImgLoading(msg.attachment, setImageLoaded)
        }
        if (isValidUrl(msg?.parent?.attachment)) {
            checkImgLoading(msg?.parent?.attachment, setParentImageLoaded)
        }
    }, [msg])

    useEffect(() => {
        if (imageLoaded) {

        }
    }, [imageLoaded])


    useEffect(() => {

        socket.on('messageReacted', (messageId) => {

            if (msg._id === messageId) {
                setIsReactedByFriend(true)
            }

        })

        socket.on('messageReactRemoved', (messageId) => {
            if (msg._id === messageId) {
                setIsReactedByFriend(false)

            }
        })



        return () => {
            socket.off('messageReacted')
            socket.off('messageReactRemoved')

        }
    })

    useEffect(() => {
        if (msg?.parent?._id) {
            setHasParentComment(true)
        }
    }, [])


    let handleDeleteMessage = async (e) => {
        let messageId = $(e.currentTarget).data('id');
        socket.emit('deleteMessage', messageId);

    }

    let handleLikeMessage = async (e) => {
        let messageId = $(e.currentTarget).data('id');
        let msgSelector = '#chatMessageList .chat-message-container .message-id-' + messageId

        if (!isReactedByMe) {
            let postReactRes = await api.post('/message/addReact', { messageId, myId })
            if (postReactRes.status == 200) {
                setIsReactedByMe(true)
            }

        } else {
            let removeReactRes = await api.post('/message/removeReact', { messageId, myId })
            if (removeReactRes.status == 200) {
                setIsReactedByMe(false)
            }
        }
    }

    let handleReplyMessage = async (e) => {
        let messageId = $(e.currentTarget).data('id');
        setIsReplying(true)
        setIsPreview(true)
        setReplyData({
            messageId,
            body: msg.message
        })
    }
    let handleSpeakMessage = async (e) => {
        socket.emit('speak_message', $(e.currentTarget).data('id'), friendId);
    }


    let handleParentMsgClick = async (e) => {
        let parentId = e.currentTarget.dataset.parent

        let allMessages = document.querySelectorAll(`#chatMessageList .chat-message-container .chat-message`)
        allMessages.forEach((element, key) => {
            element.style.border = 'unset'
        })

        let selectedMessage = document.querySelector(`#chatMessageList .chat-message-container.message-id-${parentId} .chat-message`)


        if (selectedMessage !== null) {
            selectedMessage.scrollIntoView({ behavior: "smooth" })
            selectedMessage.style.border = '2px solid #29B1A9'
            setFoundParentMsg(true)

        }

        let scrollEvent = new CustomEvent('scroll', { bubbles: true, cancelable: true })

        let msgFoundInterval = setInterval(() => {

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


    return (<>
        {msg.senderId !== myId ?

            (
                <div key={index} className={`chat-message-container message-receive message-id-${msg._id} ${isReactedByMe === true || isReactedByFriend == true ? 'message-reacted' : ''}`} data-toggle="tooltip" title={getMessageTime(msg.timestamp)}>
                    <div className='chat-message-profilePic'>
                        <UserPP profilePic={`${friendProfile.profilePic}`} profile={friendProfile._id} active={isActive ? true : false} ></UserPP>
                    </div>
                    <div className={`chat-message ${isValidUrl(messages.attachment) && 'has-attachment'}`}>
                        <div className='chat-message-options'>
                            <button type='button' data-id={msg._id} className={`chat-message-option like ${isReactedByMe == true ? 'reacted' : ''}`} onClick={handleLikeMessage.bind(this)}><i className="fa fa-thumbs-up"></i></button>
                            <button type='button' data-id={msg._id} className={`chat-message-option reply`} onClick={handleReplyMessage.bind(this)}><i className="fa fa-reply"></i></button>
                            <button type='button' data-id={msg._id} className='chat-message-option share' onClick={handleSpeakMessage.bind(this)}><i className="fa fa-speaker"></i></button>
                            <button type='button' data-id={msg._id} className='chat-message-option delete' onClick={handleDeleteMessage.bind(msg)}><i className="fa fa-trash"></i></button>
                        </div>

                        {msg?.parent === undefined || msg?.parent === null ? (<></>) : (<p onClick={handleParentMsgClick.bind(this)} data-parent={msg?.parent?._id} className={`parent-message-container ${isValidUrl(msg?.parent?.attachment) && 'has-attachment'}`}>
                            <span>{msg?.parent?.message}</span>

                            {
                                parentImageLoaded == true ? (<div className="message-attachment-container">
                                    <img src={msg?.parent?.attachment} alt="Message Attchment" className="message-attachment" />
                                </div>
                                )
                                    :
                                    isValidUrl(msg?.parent?.attachment) && (<ImageSkleton style={{ minWidth: '200px' }} />)

                            }
                        </p>)}

                        <div className='message-container mb-0'>

                            <span>{msg.message}</span>

                        </div>

                        {
                            imageLoaded == true ? (<div className="message-attachment-container">
                                <img src={msg.attachment} alt="" className="message-attachment" />
                            </div>
                            )
                                :
                                isValidUrl(msg.attachment) && (<ImageSkleton style={{ minWidth: '200px' }} />)

                        }

                        <span className='message-react'><i>👍</i></span>
                    </div>
                    <div className='chat-message-seen-status d-none'>
                        Seen
                    </div>
                </div>
            )

            :

            (
                <div key={index} className={`chat-message-container message-sent message-id-${msg._id} ${isReactedByMe === true || isReactedByFriend == true ? 'message-reacted' : ''}`} data-toggle="tooltip" title={getMessageTime(msg.timestamp)}>


                    <div className={`chat-message ${isValidUrl(messages.attachment) && 'has-attachment'}`}>
                        <div className='chat-message-options'>
                            <button type='button' data-id={msg._id} className={`chat-message-option like ${isReactedByMe == true ? 'reacted' : ''}`} onClick={handleLikeMessage.bind(this)}><i className="fa fa-thumbs-up"></i></button>
                            <button type='button' data-id={msg._id} className={`chat-message-option reply`} onClick={handleReplyMessage.bind(this)}><i className="fa fa-reply"></i></button>

                            <button type='button' data-id={msg._id} className='chat-message-option share speaker' onClick={handleSpeakMessage.bind(this)}><i className="fa fa-speaker"></i></button>

                            <button type='button' data-id={msg._id} className='chat-message-option delete' onClick={handleDeleteMessage.bind(this)}><i className="fa fa-trash"></i></button>
                        </div>

                        {msg?.parent === undefined || msg?.parent === null ? (<></>) : (<>
                            <p onClick={handleParentMsgClick.bind(this)} data-parent={msg?.parent?._id} className={`parent-message-container ${isValidUrl(msg?.parent?.attachment) && 'has-attachment'}`}>
                                <span>{msg?.parent?.message}</span>

                                {
                                    parentImageLoaded == true ? (<div className="message-attachment-container">
                                        <img src={msg?.parent?.attachment} alt="" className="message-attachment" />
                                    </div>
                                    )
                                        :
                                        isValidUrl(msg?.parent?.attachment) && (<ImageSkleton style={{ minWidth: '200px' }} />)

                                }
                            </p>

                        </>)}


                        <div className='message-container mb-0'>

                            <span>{msg.message}</span>

                        </div>


                        {
                            imageLoaded == true ? (<div className="message-attachment-container">
                                <img src={msg.attachment} alt="Message Attchment" className="message-attachment" />
                            </div>
                            )
                                :
                                isValidUrl(msg.attachment) && (<ImageSkleton style={{ minWidth: '200px' }} />)

                        }

                        <span className='message-react'><i>👍</i></span>

                    </div>

                    {

                        // <div className={`chat-message-seen-status ${msg.isSeen ? 'seen' : 'unseen'}`} style={{ 'visibility': (messages[messages.length - 1]._id === msg._id && msg.isSeen == true) ? 'visible' : 'hidden' }}>
                        <div className={`chat-message-seen-status ${msg.isSeen ? 'message-seen' : 'message-unseen'}`}>

                            <img src={friendProfile.profilePic} alt='Seen' />
                        </div>
                    }
                </div>
            )
        }
    </>)

    setIsReactedByFriend(false)

}


export default SingleMessage;