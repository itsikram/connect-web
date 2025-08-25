import React, { useState, useCallback, useEffect, useRef } from 'react';
import socket from '../../common/socket';
import $ from 'jquery'
import { useDispatch, useSelector } from 'react-redux';
import api from '../../api/api';
import { loadSettings } from '../../services/actions/settingsActions';
import { sendMessage } from '../../services/actions/messageActions';
import EmojiPicker from 'emoji-picker-react';
import { useParams } from 'react-router-dom';

const ChatFooter = ({ chatFooter, room, isReplying, friendId, setIsTyping, chatNewAttachment, messageActionButtonContainer, setIsReplying, userId, messageInput, replyData,messages, setReplyData, isPreview, setIsPreview, msgListRef }) => {

    const dispatch = useDispatch()
    const [mInputWith, setmInputWith] = useState(true);
    const [inputValue, setInputValue] = useState('');
    const [attachmentUrl, setAttachmentUrl] = useState(false)
    const [isImojiContainer, setIsEmojiContainer] = useState(false)
    const [isImojiChangeContainer, setIsEmojiChangeContainer] = useState(false)
    const [actionEmoji, setActionEmoji] = useState('👍')
    const [isAi, setIsAi] = useState(false);
    const imageInput = useRef(null);
    const uploadFileInput = useRef(null);
    const settings = useSelector(state => state.setting)
    const {profile} = useParams();

    useEffect(() => {
        if(profile === 'ai-chat') setIsAi(true)
    },[profile])


    useEffect(() => {
        setActionEmoji(settings.actionEmoji || '👍')
    }, [settings])
    const scrollToLastMessage = e => {
        if (msgListRef?.current != null || msgListRef?.current != undefined) {
            let isLastMsg = setInterval(() => {
                let lastMsg = document.querySelector('#chatMessageList .chat-message-container:last-child')
                lastMsg?.scrollIntoView({ behavior: "smooth" });
            }, 500)

            msgListRef?.current.addEventListener('scroll', e => {
                let scrollBottom = e.target.scrollHeight - e.target.scrollTop - e.target.clientHeight;

                if (scrollBottom <= 5) {
                    clearInterval(isLastMsg)

                }

            })

        }


    }


    const handleSendMessage = useCallback((e) => {
        e.preventDefault();

        let isDisabled = $(e.target).hasClass('button-disabled') || false
        if (isDisabled) return;

        if (room) {

            if (isReplying) {
                let data = { room, senderId: userId, receiverId: friendId, message: inputValue, attachment: attachmentUrl, parent: replyData.messageId, isAi }
                socket.emit('sendMessage', data);
                setIsTyping(false)
                dispatch(sendMessage(data))
                scrollToLastMessage();
            } else {
                let data = { room, senderId: userId, receiverId: friendId, message: inputValue, attachment: attachmentUrl, parent: false, isAi }
                socket.emit('sendMessage', data);
                setIsTyping(false)
                dispatch(sendMessage(data))
                scrollToLastMessage();

            }

        }
        setInputValue('')

        setIsReplying(false)
        setIsPreview(false)
        setAttachmentUrl('')
        setReplyData({ messageId: null, body: null })
        setIsPreview(false)
    },[messages,inputValue,attachmentUrl])



    let addTyping = (e) => {
        socket.emit('typing', { receiverId: userId, room, isTyping: true, type: inputValue })
    }

    let removeTyping = () => {
        socket.emit('typing', { receiverId: userId, room, isTyping: false, type: inputValue })
    }

    // let updateTyping = (e) => {
    //     let value = e.target.value;
    //     if(settings.showIsTyping) {
    //         socket.emit('update_type', { room, type: value })
    //     }
    // }
    const enterEvent = new KeyboardEvent("keydown", {
        key: "Enter",
        keyCode: 13,
        code: "Enter",
        which: 13,
        bubbles: true
    });

    const handleKeyPress = (event) => {
        if (event.key === "Enter") {
            handleSendMessage(event)
            setInputValue(""); // Clear input after action
        }
    };

    let likeButtonClick = (e) => {
        setInputValue(actionEmoji)
        setTimeout(() => {
            messageInput.current.dispatchEvent(enterEvent);
        }, 200)
    }

    let handleInputChange = (e) => {
        setInputValue(e.target.value)

        if (settings.showIsTyping) {
            socket.emit('update_type', { room, type: e.target.value })
        }
    }

    let handlePreviewCloseBtn = (e) => {
        setIsPreview(false)
        setIsReplying(false)
    }


    let handleMessageImageButtonClick = useCallback(async (e) => {
        let clickEvent = new MouseEvent('click', { bubbles: true, cancelable: false })
        let attachmentInput = document.createElement('input')
        attachmentInput.type = 'file'

        attachmentInput.addEventListener('change', (async (e) => {
            let attachmentFile = e.target.files[0]
            if (attachmentFile) {
                let attachmentFormData = new FormData();
                attachmentFormData.append('image', attachmentFile)
                setAttachmentUrl('https://res.cloudinary.com/dz88yjerw/image/upload/v1743092084/i5lcu63atrbkpcy6oqam.gif')
                setIsPreview(true)

                let uploadAttachmentRes = await api.post('/upload', attachmentFormData, {
                    headers: {
                        'Content-Type': 'multipart/form-data'
                    }
                })

                if (uploadAttachmentRes.status === 200) {
                    let attachmentUrl = uploadAttachmentRes.data.secure_url;
                    if (attachmentUrl) {
                        setAttachmentUrl(attachmentUrl)
                    }
                }

            }
        }))

        if (attachmentInput) {
            attachmentInput.dispatchEvent(clickEvent)
        }

    },[attachmentUrl,isPreview])

    let handleMessageImageChange = async (e) => {

    }

    let handleEmojiBtnClick = useCallback(() => {
        setIsEmojiContainer(true)
    },[isImojiContainer])

    let emojiChangeClick = useCallback(() => {
        setIsEmojiChangeContainer(true)
    },[isImojiChangeContainer])

    let handleEmojiClick = useCallback(emojiObj => {

        setInputValue(inputValue + emojiObj.emoji)
    },[inputValue])

    let handleEmojiChangeClick = useCallback(emojiObj => {

        setActionEmoji(emojiObj.emoji)
        setIsEmojiChangeContainer(false)
        setIsEmojiContainer(false)
        updateActionEmojiChange(emojiObj.emoji)
        // setInputValue(inputValue + emojiObj.emoji)
    },[])


    let handleAttachmentButtonClick = useCallback(e => {
        uploadFileInput.current.dispatchEvent(new MouseEvent('click', {
            bubbles: true
        }))
    }, [attachmentUrl])

    let handleFileChange = useCallback(async (e) => {

        let rawFile = e.target.files[0]
        if (rawFile) {
            let rawFile = new FormData();
            rawFile.append('file', rawFile)
            setAttachmentUrl('https://res.cloudinary.com/dz88yjerw/image/upload/v1743092084/i5lcu63atrbkpcy6oqam.gif')
            // setIsPreview(true)

            let uploadAttachmentRes = await api.post('/upload/file', rawFile, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            })


            if (uploadAttachmentRes.status === 200) {
                let attachmentUrl = uploadAttachmentRes.data.secure_url;
                if (attachmentUrl) {
                    setAttachmentUrl(attachmentUrl)
                }
            }

        }

    },[socket])

    let emogiListContainer = useRef(null)
    let emogiChangeContainer = useRef(null)
    useEffect(() => {
        let handleClickOutside = (event) => {
            if (emogiListContainer.current && !emogiListContainer.current.contains(event.target)) {
                setIsEmojiContainer(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);


    useEffect(() => {
        let handleClickOutside = (event) => {
            if (emogiChangeContainer.current && !emogiChangeContainer.current.contains(event.target)) {
                setIsEmojiChangeContainer(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);


    let updateActionEmojiChange = useCallback(async (emoji) => {
        let updateSetting = await api.post('setting/update', { actionEmoji: emoji })
        if (updateSetting.status == 200) {
            dispatch(loadSettings(updateSetting.data))
        }
    },[settings])


    return (
        <>
            <div ref={chatFooter} className="chat-footer">

                {
                    isPreview && (<div className='new-message-preview-container'>
                        {
                            isReplying && (
                                <div className='reply-message-preview-form'>
                                    <p className='text-small'>
                                        {replyData.body}
                                    </p>
                                </div>
                            )
                        }
                        {
                            attachmentUrl && (
                                <div className='attachment-preview-container'>
                                    <img className='attachment-preview' src={attachmentUrl} alt='Message Attachment' />
                                </div>
                            )
                        }

                        <span onClick={handlePreviewCloseBtn} className='preview-close-button bg-danger'>
                            <i className='fa fa-times'></i>
                        </span>
                    </div>)
                }


                <div className="new-message-container">
                    <div ref={chatNewAttachment} className='chat-new-attachment'>
                        <div className='chat-atachment-button-container'>

                            <div className='chat-attachment-button' onClick={handleAttachmentButtonClick.bind(this)}>
                                <i className="fas fa-plus-circle"></i>
                                <input type='file' name='uploaded_file' onChange={handleFileChange.bind(this)} ref={uploadFileInput} style={{ display: 'none' }} />
                            </div>

                            <div className='chat-attachment-button' onClick={handleMessageImageButtonClick.bind(this)}>
                                <i className="fas fa-images"></i>
                                <input type='file' style={{ display: 'none' }} ref={imageInput} onChange={handleMessageImageChange.bind(this)} />
                            </div>

                            {/* <div className='chat-attachment-button'>
                                <i className="fas fa-microphone"></i>
                            </div> */}

                            <div onClick={handleEmojiBtnClick.bind(this)} className='message-action-emoji-container chat-attachment-button'>
                                <i style={{ color: '#F4D52F' }} className="fas fa-smile-beam"></i>

                                {
                                    isImojiContainer && <>
                                        <div ref={emogiListContainer} className='emoji-container'>
                                            <EmojiPicker theme='dark' onEmojiClick={handleEmojiClick} />

                                        </div>
                                    </>
                                }

                            </div>
                        </div>
                    </div>
                    <div className='new-message-form'>
                        <div className='new-message-input-container'>
                            <input ref={messageInput} style={{ width: mInputWith + 'px' }} onChange={handleInputChange} value={inputValue} onKeyDown={handleKeyPress} placeholder='Send Message....' id='newMessageInput' className='new-message-input' onFocus={addTyping} onBlur={removeTyping} />
                        </div>
                        <div ref={messageActionButtonContainer} className='message-action-button-container'>

                            {
                                inputValue.length > 0 || attachmentUrl ? <div onClick={handleSendMessage} className={`message-action-button send-message ${attachmentUrl == 'https://res.cloudinary.com/dz88yjerw/image/upload/v1743092084/i5lcu63atrbkpcy6oqam.gif' && 'button-disabled'}`}>
                                    <i className="fas fa-paper-plane"></i>
                                </div>

                                    : <>
                                        <div onClick={likeButtonClick} className='message-action-button send-like'>
                                            <span className="">{actionEmoji}</span>
                                        </div>


                                        <div onClick={emojiChangeClick.bind(this)} className='message-action-emoji-container chat-attachment-button'>
                                            <i className="fas fa-chevron-up"></i>

                                            {
                                                isImojiChangeContainer && <>
                                                    <div ref={emogiChangeContainer} className='emoji-container'>
                                                        <EmojiPicker theme='dark' onEmojiClick={handleEmojiChangeClick} />

                                                    </div>
                                                </>
                                            }

                                        </div>
                                    </>
                            }

                        </div>
                    </div>

                </div>

            </div>
        </>
    );
}

export default ChatFooter;
