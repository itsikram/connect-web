import React, { useState, useCallback, useEffect, useRef } from 'react';
import socket from '../../common/socket';
import AgoraRTC from 'agora-rtc-sdk-ng';
import api from '../../api/api';
import $ from 'jquery'
import { useDispatch, useSelector } from 'react-redux';
import { loadSettings } from '../../services/actions/settingsActions';
import EmojiPicker from 'emoji-picker-react';
import { useParams } from 'react-router-dom';

const ChatFooter = ({ chatFooter, room, isReplying, friendId, setIsTyping, chatNewAttachment, messageActionButtonContainer, setIsReplying, userId, messageInput, replyData,messages, setReplyData, isPreview, setIsPreview, msgListRef }) => {

    const dispatch = useDispatch()
    // Removed unused width state
    const [inputValue, setInputValue] = useState('');
    const [attachmentUrl, setAttachmentUrl] = useState(false)
    const [isImojiContainer, setIsEmojiContainer] = useState(false)
    const [isImojiChangeContainer, setIsEmojiChangeContainer] = useState(false)
    const [actionEmoji, setActionEmoji] = useState('👍')
    const [isAi, setIsAi] = useState(false);
    const [isSendingMessage, setIsSendingMessage] = useState(false)
    const [isUploadingFile, setIsUploadingFile] = useState(false)
    const [isUploadingImage, setIsUploadingImage] = useState(false)
    const [isLiveVoiceConnecting, setIsLiveVoiceConnecting] = useState(false)
    // Voice message recording
    const [isRecording, setIsRecording] = useState(false)
    const [isUploadingAudio, setIsUploadingAudio] = useState(false)
    const [recordingMs, setRecordingMs] = useState(0)
    const recorderRef = useRef(null)
    const recordingChunksRef = useRef([])
    const mediaStreamRef = useRef(null)
    const recordingTimerRef = useRef(null)
    const waveformCanvasRef = useRef(null)
    const rafIdRef = useRef(null)
    const audioContextRef = useRef(null)
    const analyserRef = useRef(null)
    const audioSourceRef = useRef(null)
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
    const scrollToLastMessage = () => {
        if (msgListRef?.current != null || msgListRef?.current != undefined) {
            const isLastMsg = setInterval(() => {
                const lastMsg = document.querySelector('#chatMessageList .chat-message-container:last-child')
                lastMsg?.scrollIntoView({ behavior: "smooth" });
            }, 500)

            msgListRef?.current.addEventListener('scroll', (event) => {
                const scrollBottom = event.target.scrollHeight - event.target.scrollTop - event.target.clientHeight;

                if (scrollBottom <= 5) {
                    clearInterval(isLastMsg)

                }

            })

        }


    }


    const handleSendMessage = useCallback((e) => {
        e.preventDefault();

        const isDisabled = $(e.target).hasClass('button-disabled') || false
        if (isDisabled || isSendingMessage) return;

        setIsSendingMessage(true)

        const roomId = room || [userId, friendId].sort().join('_')

        if (roomId) {

            if (isReplying) {
                const data = { room: roomId, senderId: userId, receiverId: friendId, message: inputValue, attachment: attachmentUrl, parent: replyData.messageId, isAi }
                socket.emit('sendMessage', data);
                setIsTyping(false)
                // Remove dispatch(sendMessage(data)) to prevent the error
                scrollToLastMessage();
            } else {
                const data = { room: roomId, senderId: userId, receiverId: friendId, message: inputValue, attachment: attachmentUrl, parent: false, isAi }
                socket.emit('sendMessage', data);
                setIsTyping(false)
                // Remove dispatch(sendMessage(data)) to prevent the error
                scrollToLastMessage();

            }

        }
        setInputValue('')

        setIsReplying(false)
        setIsPreview(false)
        setAttachmentUrl('')
        setReplyData({ messageId: null, body: null })
        setIsPreview(false)
        setIsSendingMessage(false)
    },[messages,inputValue,attachmentUrl])



    const addTyping = () => {
        socket.emit('typing', { receiverId: userId, room, isTyping: true, type: inputValue })
    }

    const removeTyping = () => {
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

    const likeButtonClick = () => {
        setInputValue(actionEmoji)
        setTimeout(() => {
            messageInput.current.dispatchEvent(enterEvent);
        }, 200)
    }

    const handleInputChange = (e) => {
        setInputValue(e.target.value)

        if (settings.showIsTyping) {
            socket.emit('update_type', { room, type: e.target.value })
        }
    }

    const handlePreviewCloseBtn = () => {
        setIsPreview(false)
        setIsReplying(false)
    }


    const handleMessageImageButtonClick = useCallback(async () => {
        const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: false })
        const attachmentInput = document.createElement('input')
        attachmentInput.type = 'file'

        attachmentInput.addEventListener('change', (async (e) => {
            const attachmentFile = e.target.files[0]
            if (attachmentFile) {
                setIsUploadingImage(true)
                try {
                    const attachmentFormData = new FormData();
                    attachmentFormData.append('image', attachmentFile)
                    setAttachmentUrl('https://res.cloudinary.com/dz88yjerw/image/upload/v1743092084/i5lcu63atrbkpcy6oqam.gif')
                    setIsPreview(true)

                    const uploadAttachmentRes = await api.post('/upload', attachmentFormData, {
                        headers: {
                            'Content-Type': 'multipart/form-data'
                        }
                    })

                    if (uploadAttachmentRes.status === 200) {
                        const attachmentUrl = uploadAttachmentRes.data.secure_url;
                        if (attachmentUrl) {
                            setAttachmentUrl(attachmentUrl)
                        }
                    }
                } catch (error) {
                    console.log('Error uploading image:', error)
                } finally {
                    setIsUploadingImage(false)
                }

            }
        }))

        if (attachmentInput) {
            attachmentInput.dispatchEvent(clickEvent)
        }

    },[attachmentUrl,isPreview])

    const handleMessageImageChange = async () => {
        // Handle image change
    }

    // Live voice (push-to-talk) via Agora
    const liveVoiceClientRef = useRef(null);
    const liveVoiceLocalTrackRef = useRef(null);
    const isLiveVoiceActiveRef = useRef(false);

    const getAgoraToken = useCallback(async (channelName) => {
        const { data } = await api.post('/agora/token', { channelName, uid: Math.floor(Math.random() * 1e6) });
        return data; // { appId, token }
    }, []);

    const handleLiveVoiceButtonClick = async () => {
        try {
            if (isLiveVoiceActiveRef.current) {
                // Stop live voice
                try {
                    if (liveVoiceClientRef.current && liveVoiceLocalTrackRef.current) {
                        await liveVoiceClientRef.current.unpublish([liveVoiceLocalTrackRef.current]);
                    }
                } catch (e) {
                    // Ignore unpublish errors
                }
                try { liveVoiceLocalTrackRef.current?.close(); } catch (e) {
                    // Ignore close errors
                }
                liveVoiceLocalTrackRef.current = null;
                try {
                    await liveVoiceClientRef.current?.leave();
                    liveVoiceClientRef.current?.removeAllListeners();
                } catch (e) {
                    // Ignore leave/listener errors
                }
                liveVoiceClientRef.current = null;
                isLiveVoiceActiveRef.current = false;
                socket.emit('agora-live-voice-stop', { to: friendId, channelName: room });
                return;
            }

            // Start live voice
            setIsLiveVoiceConnecting(true)
            const channelName = room || `${userId}-${friendId}`;
            const { appId, token } = await getAgoraToken(channelName);

            // Dispose previous if any
            if (liveVoiceClientRef.current) {
                try { await liveVoiceClientRef.current.leave(); } catch (e) { /* Ignore leave errors */ }
                try { liveVoiceClientRef.current.removeAllListeners(); } catch (e) { /* Ignore listener removal errors */ }
                liveVoiceClientRef.current = null;
            }

            const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
            liveVoiceClientRef.current = client;
            await client.join(appId, channelName, token, null);
            const mic = await AgoraRTC.createMicrophoneAudioTrack();
            liveVoiceLocalTrackRef.current = mic;
            await client.publish([mic]);
            isLiveVoiceActiveRef.current = true;
            socket.emit('agora-live-voice-start', { to: friendId, channelName });
        } catch (err) {
            console.error('Live voice error:', err);
        } finally {
            setIsLiveVoiceConnecting(false)
        }
    }

    // ---------------- Voice Message (MediaRecorder) -----------------
    const pickSupportedMimeType = () => {
        const candidates = [
            'audio/webm;codecs=opus',
            'audio/webm',
            'audio/ogg;codecs=opus',
            'audio/ogg',
            'audio/mp4'
        ]
        for (let i = 0; i < candidates.length; i++) {
            const type = candidates[i]
            if (window.MediaRecorder && window.MediaRecorder.isTypeSupported && window.MediaRecorder.isTypeSupported(type)) {
                return type
            }
        }
        return undefined
    }

    const stopWaveform = () => {
        if (rafIdRef.current) {
            cancelAnimationFrame(rafIdRef.current)
            rafIdRef.current = null
        }
        try { audioSourceRef.current?.disconnect() } catch (e) {}
        try { analyserRef.current?.disconnect() } catch (e) {}
        try { audioContextRef.current?.close() } catch (e) {}
        audioSourceRef.current = null
        analyserRef.current = null
        audioContextRef.current = null
    }

    const drawWaveform = () => {
        if (!analyserRef.current || !waveformCanvasRef.current) return
        const analyser = analyserRef.current
        const canvas = waveformCanvasRef.current
        const canvasCtx = canvas.getContext('2d')
        const bufferLength = analyser.frequencyBinCount
        const dataArray = new Uint8Array(bufferLength)

        const render = () => {
            analyser.getByteTimeDomainData(dataArray)
            canvasCtx.clearRect(0, 0, canvas.width, canvas.height)
            canvasCtx.fillStyle = '#111'
            canvasCtx.fillRect(0, 0, canvas.width, canvas.height)
            canvasCtx.lineWidth = 2
            canvasCtx.strokeStyle = '#1DB954'
            canvasCtx.beginPath()
            const sliceWidth = canvas.width * 1.0 / bufferLength
            let x = 0
            for (let i = 0; i < bufferLength; i++) {
                const v = dataArray[i] / 128.0
                const y = v * canvas.height / 2
                if (i === 0) {
                    canvasCtx.moveTo(x, y)
                } else {
                    canvasCtx.lineTo(x, y)
                }
                x += sliceWidth
            }
            canvasCtx.lineTo(canvas.width, canvas.height / 2)
            canvasCtx.stroke()
            rafIdRef.current = requestAnimationFrame(render)
        }
        rafIdRef.current = requestAnimationFrame(render)
    }

    const startRecording = useCallback(async () => {
        if (isRecording || isUploadingAudio) return
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            mediaStreamRef.current = stream

            const mimeType = pickSupportedMimeType()
            const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
            recorderRef.current = recorder
            recordingChunksRef.current = []

            recorder.addEventListener('dataavailable', (ev) => {
                if (ev.data && ev.data.size > 0) recordingChunksRef.current.push(ev.data)
            })

            recorder.addEventListener('stop', async () => {
                // handled in stopRecording
            })

            // Waveform setup
            try {
                const ctx = new (window.AudioContext || window.webkitAudioContext)()
                audioContextRef.current = ctx
                const source = ctx.createMediaStreamSource(stream)
                audioSourceRef.current = source
                const analyser = ctx.createAnalyser()
                analyser.fftSize = 2048
                analyserRef.current = analyser
                source.connect(analyser)
                drawWaveform()
            } catch (e) {
                // Ignore waveform errors; recording still works
            }

            recorder.start(100)
            setIsRecording(true)
            setRecordingMs(0)
            if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)
            const startTs = Date.now()
            recordingTimerRef.current = setInterval(() => {
                setRecordingMs(Date.now() - startTs)
            }, 200)
        } catch (err) {
            console.error('Microphone permission or recording error:', err)
            setIsRecording(false)
        }
    }, [isRecording, isUploadingAudio])

    const cleanupStream = () => {
        try { mediaStreamRef.current?.getTracks()?.forEach(t => t.stop()) } catch (e) {}
        mediaStreamRef.current = null
    }

    const stopRecording = useCallback(async (shouldSend) => {
        if (!recorderRef.current) return
        try {
            recorderRef.current.stop()
        } catch (e) {}
        stopWaveform()
        cleanupStream()
        if (recordingTimerRef.current) {
            clearInterval(recordingTimerRef.current)
            recordingTimerRef.current = null
        }
        setIsRecording(false)
        const mimeType = pickSupportedMimeType() || 'audio/webm'
        const blob = new Blob(recordingChunksRef.current, { type: mimeType })
        recordingChunksRef.current = []
        recorderRef.current = null
        if (shouldSend) {
            await uploadAndSendAudio(blob, mimeType)
        }
    }, [])

    const cancelRecording = useCallback(async () => {
        await stopRecording(false)
    }, [stopRecording])

    const msToClock = (ms) => {
        const totalSeconds = Math.floor(ms / 1000)
        const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0')
        const s = (totalSeconds % 60).toString().padStart(2, '0')
        return `${m}:${s}`
    }

    const uploadAndSendAudio = useCallback(async (blob, mimeType) => {
        setIsUploadingAudio(true)
        try {
            const fileName = `voice-${Date.now()}.${mimeType.includes('ogg') ? 'ogg' : mimeType.includes('mp4') ? 'm4a' : 'webm'}`
            const form = new FormData()
            form.append('file', new File([blob], fileName, { type: mimeType }))
            // Show uploading placeholder spinner on send button via isUploadingAudio
            const res = await api.post('/upload/file', form, { headers: { 'Content-Type': 'multipart/form-data' } })
            if (res.status === 200 && res.data?.secure_url) {
                const voiceUrl = res.data.secure_url
                const roomId = room || [userId, friendId].sort().join('_')
                const data = { room: roomId, senderId: userId, receiverId: friendId, message: '', attachment: voiceUrl, parent: false, isAi, messageType: 'audio' }
                socket.emit('sendMessage', data)
                scrollToLastMessage()
            }
        } catch (e) {
            console.error('Audio upload error:', e)
        } finally {
            setIsUploadingAudio(false)
        }
    }, [room, userId, friendId, isAi])

    useEffect(() => {
        return () => {
            try { recorderRef.current?.stop() } catch (e) {}
            cleanupStream()
            stopWaveform()
            if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)
        }
    }, [])

    const handleEmojiBtnClick = useCallback(() => {
        setIsEmojiContainer(true)
    },[isImojiContainer])

    const emojiChangeClick = useCallback(() => {
        setIsEmojiChangeContainer(true)
    },[isImojiChangeContainer])

    const handleEmojiClick = useCallback(emojiObj => {

        setInputValue(inputValue + emojiObj.emoji)
    },[inputValue])

    const handleEmojiChangeClick = useCallback(emojiObj => {

        setActionEmoji(emojiObj.emoji)
        setIsEmojiChangeContainer(false)
        setIsEmojiContainer(false)
        updateActionEmojiChange(emojiObj.emoji)
        // setInputValue(inputValue + emojiObj.emoji)
    },[])


    const handleAttachmentButtonClick = useCallback(() => {
        uploadFileInput.current.dispatchEvent(new MouseEvent('click', {
            bubbles: true
        }))
    }, [attachmentUrl])

    const handleFileChange = useCallback(async (e) => {

        const rawFile = e.target.files[0]
        if (rawFile) {
            setIsUploadingFile(true)
            try {
                const rawFile = new FormData();
                rawFile.append('file', rawFile)
                setAttachmentUrl('https://res.cloudinary.com/dz88yjerw/image/upload/v1743092084/i5lcu63atrbkpcy6oqam.gif')
                // setIsPreview(true)

                const uploadAttachmentRes = await api.post('/upload/file', rawFile, {
                    headers: {
                        'Content-Type': 'multipart/form-data'
                    }
                })


                if (uploadAttachmentRes.status === 200) {
                    const attachmentUrl = uploadAttachmentRes.data.secure_url;
                    if (attachmentUrl) {
                        setAttachmentUrl(attachmentUrl)
                    }
                }
            } catch (error) {
                console.log('Error uploading file:', error)
            } finally {
                setIsUploadingFile(false)
            }

        }

    },[socket])

    const emogiListContainer = useRef(null)
    const emogiChangeContainer = useRef(null)
    useEffect(() => {
        const handleClickOutside = (event) => {
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
        const handleClickOutside = (event) => {
            if (emogiChangeContainer.current && !emogiChangeContainer.current.contains(event.target)) {
                setIsEmojiChangeContainer(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);


    const updateActionEmojiChange = useCallback(async (emoji) => {
        const updateSetting = await api.post('setting/update', { actionEmoji: emoji })
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

                        <span 
                            onClick={handlePreviewCloseBtn} 
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handlePreviewCloseBtn(); } }}
                            role='button'
                            tabIndex={0}
                            className='preview-close-button bg-danger'
                        >
                            <i className='fa fa-times'></i>
                        </span>
                    </div>)
                }


                <div className="new-message-container">
                    <div ref={chatNewAttachment} className='chat-new-attachment'>
                        <div className='chat-atachment-button-container'>

                            <div 
                                className={`chat-attachment-button ${isUploadingFile ? 'disabled' : ''}`} 
                                onClick={isUploadingFile ? null : handleAttachmentButtonClick.bind(this)}
                                onKeyDown={isUploadingFile ? null : (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleAttachmentButtonClick(); } }}
                                role='button'
                                tabIndex={isUploadingFile ? -1 : 0}
                                style={{ opacity: isUploadingFile ? 0.6 : 1, cursor: isUploadingFile ? 'not-allowed' : 'pointer' }}
                            >
                                <i className={isUploadingFile ? "fas fa-spinner fa-spin" : "fas fa-plus-circle"}></i>
                                <input type='file' name='uploaded_file' onChange={handleFileChange.bind(this)} ref={uploadFileInput} style={{ display: 'none' }} disabled={isUploadingFile} />
                            </div>

                            <div 
                                className={`chat-attachment-button ${isUploadingImage ? 'disabled' : ''}`} 
                                onClick={isUploadingImage ? null : handleMessageImageButtonClick.bind(this)}
                                onKeyDown={isUploadingImage ? null : (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleMessageImageButtonClick(); } }}
                                role='button'
                                tabIndex={isUploadingImage ? -1 : 0}
                                aria-label={isUploadingImage ? 'Uploading image, please wait' : 'Upload image'}
                                aria-disabled={isUploadingImage}
                                style={{ opacity: isUploadingImage ? 0.6 : 1, cursor: isUploadingImage ? 'not-allowed' : 'pointer' }}
                            >
                                <i className={isUploadingImage ? "fas fa-spinner fa-spin" : "fas fa-images"}></i>
                                <input type='file' style={{ display: 'none' }} ref={imageInput} onChange={handleMessageImageChange.bind(this)} disabled={isUploadingImage} />
                            </div>



                            <div 
                                className={`chat-attachment-button ${isUploadingAudio ? 'disabled' : ''}`} 
                                onClick={isUploadingAudio ? null : (isRecording ? (() => stopRecording(true)) : startRecording)}
                                onKeyDown={isUploadingAudio ? null : (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); isRecording ? stopRecording(true) : startRecording(); } }}
                                role='button'
                                tabIndex={isUploadingAudio ? -1 : 0}
                                aria-label={isUploadingAudio ? 'Uploading voice message' : (isRecording ? 'Stop and send voice message' : 'Record voice message')}
                                aria-disabled={isUploadingAudio}
                                style={{ opacity: isUploadingAudio ? 0.6 : 1, cursor: isUploadingAudio ? 'not-allowed' : 'pointer' }}
                            >
                                <i className={isUploadingAudio ? "fas fa-spinner fa-spin" : (isRecording ? "fas fa-stop-circle" : "fas fa-microphone-alt")}></i>
                            </div>

                            {/* <div className='chat-attachment-button'>
                                <i className="fas fa-microphone"></i>
                            </div> */}

                            <div 
                                onClick={handleEmojiBtnClick.bind(this)} 
                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleEmojiBtnClick(); } }}
                                role='button'
                                tabIndex={0}
                                className='message-action-emoji-container chat-attachment-button'
                            >
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
                        {isRecording && (
                            <div className='voice-recording-bar' aria-live='polite' style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: '#1a1a1a', borderRadius: 8, marginBottom: 6 }}>
                                <span style={{ color: '#ff4d4f' }}><i className="fas fa-circle"></i></span>
                                <span style={{ color: '#ddd', minWidth: 48, textAlign: 'center' }}>{msToClock(recordingMs)}</span>
                                <canvas ref={waveformCanvasRef} width={160} height={24} style={{ borderRadius: 4 }} />
                                <div style={{ display: 'flex', marginLeft: 'auto', gap: 8 }}>
                                    <div
                                        className='message-action-button'
                                        onClick={() => stopRecording(true)}
                                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); stopRecording(true) } }}
                                        role='button'
                                        tabIndex={0}
                                        aria-label='Stop and send voice message'
                                        style={{ color: '#1DB954' }}
                                    >
                                        <i className="fas fa-paper-plane"></i>
                                    </div>
                                    <div
                                        className='message-action-button'
                                        onClick={cancelRecording}
                                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); cancelRecording() } }}
                                        role='button'
                                        tabIndex={0}
                                        aria-label='Cancel recording'
                                        style={{ color: '#ff4d4f' }}
                                    >
                                        <i className="fas fa-trash"></i>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div className='new-message-input-container'>
                            <input ref={messageInput} onChange={handleInputChange} value={inputValue} onKeyDown={handleKeyPress} placeholder='Send Message....' id='newMessageInput' className='new-message-input' onFocus={addTyping} onBlur={removeTyping} disabled={isRecording || isUploadingAudio} />
                        </div>
                        <div ref={messageActionButtonContainer} className='message-action-button-container'>

                            {
                                inputValue.length > 0 || attachmentUrl ? <div 
                                    onClick={isSendingMessage ? null : handleSendMessage} 
                                    onKeyDown={isSendingMessage ? null : (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSendMessage(e); } }}
                                    role='button'
                                    tabIndex={isSendingMessage ? -1 : 0}
                                    className={`message-action-button send-message ${attachmentUrl == 'https://res.cloudinary.com/dz88yjerw/image/upload/v1743092084/i5lcu63atrbkpcy6oqam.gif' && 'button-disabled'} ${isSendingMessage ? 'disabled' : ''}`}
                                    style={{ opacity: isSendingMessage ? 0.6 : 1, cursor: isSendingMessage ? 'not-allowed' : 'pointer' }}
                                >
                                    <i className={isSendingMessage ? "fas fa-spinner fa-spin" : "fas fa-paper-plane"}></i>
                                </div>

                                    : <>
                                        <div 
                                            onClick={likeButtonClick} 
                                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); likeButtonClick(); } }}
                                            role='button'
                                            tabIndex={0}
                                            className='message-action-button send-like'
                                        >
                                            <span className="">{actionEmoji}</span>
                                        </div>


                                        <div 
                                            onClick={emojiChangeClick.bind(this)} 
                                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); emojiChangeClick(); } }}
                                            role='button'
                                            tabIndex={0}
                                            className='message-action-emoji-container chat-attachment-button'
                                        >
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
