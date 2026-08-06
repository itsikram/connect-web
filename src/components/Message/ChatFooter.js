import React, { useState, useCallback, useEffect, useRef } from 'react';
import AgoraRTC from 'agora-rtc-sdk-ng';
import api from '../../api/api';
import $ from 'jquery'
import { useDispatch, useSelector } from 'react-redux';
import { loadSettings } from '../../services/actions/settingsActions';
import EmojiPicker from 'emoji-picker-react';
import { useParams } from 'react-router-dom';
import LiveVoiceModal from './LiveVoiceModal';

const ChatFooter = ({ chatFooter, room, isReplying, friendId, setIsTyping, chatNewAttachment, messageActionButtonContainer, setIsReplying, userId, messageInput, replyData,messages, setReplyData, isPreview, setIsPreview, msgListRef, friendProfile, sendMessage, scrollToLastMessage: scrollToLastMessageProp }) => {

    const dispatch = useDispatch()
    // Removed unused width state
    const [inputValue, setInputValue] = useState('');
    const [attachmentUrl, setAttachmentUrl] = useState(false)
    const [isImojiContainer, setIsEmojiContainer] = useState(false)
    const [isImojiChangeContainer, setIsEmojiChangeContainer] = useState(false)
    const [actionEmoji, setActionEmoji] = useState('👍')
    const [isAi, setIsAi] = useState(false);
    const [isSendingMessage, setIsSendingMessage] = useState(false)
    const isSendingRef = useRef(false) // Ref to track sending state synchronously
    const [isUploadingFile, setIsUploadingFile] = useState(false)
    const [isUploadingImage, setIsUploadingImage] = useState(false)
    const [showAttachTray, setShowAttachTray] = useState(false)
    const [isLiveVoiceConnecting, setIsLiveVoiceConnecting] = useState(false)
    const [isLiveVoiceActive, setIsLiveVoiceActive] = useState(false)
    const [isLiveVoiceModalOpen, setIsLiveVoiceModalOpen] = useState(false)
    const [liveVoiceDuration, setLiveVoiceDuration] = useState(0)
    const liveVoiceDurationTimerRef = useRef(null)
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
        setActionEmoji(settings?.actionEmoji || '👍')
    }, [settings])
    const scrollToLastMessage = () => {
        if (typeof scrollToLastMessageProp === 'function') {
            scrollToLastMessageProp('smooth');
            return;
        }
        const el = msgListRef?.current || document.getElementById('chatMessageList');
        if (!el) return;
        requestAnimationFrame(() => {
            el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
        });
    }


    const handleSendMessage = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation(); // Prevent event bubbling

        const isDisabled = $(e.target).hasClass('button-disabled') || false
        
        // Use ref for synchronous check to prevent race conditions
        if (isDisabled || isSendingRef.current) {
            console.log('Message send blocked:', { isDisabled, isSending: isSendingRef.current });
            return;
        }

        // Check if message is empty
        if (!inputValue.trim() && !attachmentUrl) {
            return;
        }

        // Set both state and ref immediately
        isSendingRef.current = true;
        setIsSendingMessage(true);

        const roomId = room || [userId, friendId].sort().join('_')

        if (roomId) {
            const messageContent = inputValue.trim();
            
            const messageData = {
                room: roomId,
                senderId: userId,
                receiverId: friendId,
                message: messageContent,
                attachment: attachmentUrl,
                parent: isReplying ? replyData.messageId : false,
                isAi
            };
            
            // Send message via HTTP
            sendMessage(messageData)
                .then(() => {
                    setIsTyping(false);
                    scrollToLastMessage();
                })
                .catch((error) => {
                    console.error('Failed to send message:', error);
                    // Optionally show error to user
                })
                .finally(() => {
                    // Reset sending flag after a short delay
                    setTimeout(() => {
                        isSendingRef.current = false;
                        setIsSendingMessage(false);
                    }, 500);
                });
        }
        
        // Clear input and reset state
        setInputValue('')
        setIsReplying(false)
        setIsPreview(false)
        setAttachmentUrl('')
        setReplyData({ messageId: null, body: null })
    },[messages, inputValue, attachmentUrl, room, userId, friendId, isReplying, replyData, isAi])



    const addTyping = () => {
        // HTTP-based typing indicator could be implemented here
        // For now, we'll skip typing indicators as they require real-time communication
    }

    const removeTyping = () => {
        // HTTP-based typing indicator could be implemented here
        // For now, we'll skip typing indicators as they require real-time communication
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
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault(); // Prevent form submission
            event.stopPropagation(); // Prevent event bubbling
            // Use ref for synchronous check
            if (!isSendingRef.current) {
                handleSendMessage(event)
            }
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

        // Typing indicators removed for HTTP-based implementation
        // Could be implemented with HTTP polling if needed
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

    const getAgoraToken = useCallback(async (channelName, uid) => {
        try {
            const { data } = await api.post('/agora/token', { channelName, uid, role: 'publisher' });
            if (!data || !data.appId || !data.token) {
                throw new Error('Invalid token response from server');
            }
            return data; // { appId, token }
        } catch (error) {
            console.error('Failed to get Agora token:', error);
            throw error;
        }
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
                setIsLiveVoiceActive(false);
                setIsLiveVoiceModalOpen(false);
                setLiveVoiceDuration(0);
                if (liveVoiceDurationTimerRef.current) {
                    clearInterval(liveVoiceDurationTimerRef.current);
                    liveVoiceDurationTimerRef.current = null;
                }
                // Live voice stop - HTTP-based notification could be implemented here
                // For now, we'll just stop the local voice session
                console.log('Stopping live voice session');
                return;
            }

            // Start live voice
            setIsLiveVoiceConnecting(true)
            const channelName = room || [userId, friendId].sort().join('_');
            
            // Live voice start - HTTP-based notification could be implemented here
            // For now, we'll just start the local voice session
            console.log('Starting live voice session for channel:', channelName);
            
            // Small delay to ensure subscriber connection is closed
            await new Promise(resolve => setTimeout(resolve, 300));
            
            // Generate consistent UID from userId hash
            // Add 1 to publisher UID to avoid conflict with subscriber UID in ChatHeader
            const generateUid = (str) => {
                let hash = 0;
                for (let i = 0; i < str.length; i++) {
                    hash = ((hash << 5) - hash) + str.charCodeAt(i);
                    hash |= 0;
                }
                return Math.abs(hash);
            };
            const baseUid = generateUid(userId);
            // Use baseUid + 1 for publisher to avoid conflict with subscriber (baseUid) in ChatHeader
            const uid = baseUid + 1;
            const { appId, token } = await getAgoraToken(channelName, uid);

            // Dispose previous if any
            if (liveVoiceClientRef.current) {
                try { await liveVoiceClientRef.current.leave(); } catch (e) { /* Ignore leave errors */ }
                try { liveVoiceClientRef.current.removeAllListeners(); } catch (e) { /* Ignore listener removal errors */ }
                liveVoiceClientRef.current = null;
            }

            const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
            liveVoiceClientRef.current = client;
            await client.join(appId, channelName, token, uid);
            const mic = await AgoraRTC.createMicrophoneAudioTrack();
            liveVoiceLocalTrackRef.current = mic;
            await client.publish([mic]);
            isLiveVoiceActiveRef.current = true;
            setIsLiveVoiceActive(true);
            setLiveVoiceDuration(0);
            setIsLiveVoiceModalOpen(true);
            // Start duration timer
            if (liveVoiceDurationTimerRef.current) {
                clearInterval(liveVoiceDurationTimerRef.current);
            }
            liveVoiceDurationTimerRef.current = setInterval(() => {
                setLiveVoiceDuration(prev => prev + 1);
            }, 1000);
            // Live voice started - HTTP-based notification could be implemented here
            console.log('Live voice session started');
        } catch (err) {
            console.error('Live voice error:', err);
            setIsLiveVoiceActive(false);
            isLiveVoiceActiveRef.current = false;
            setIsLiveVoiceModalOpen(false);
            setLiveVoiceDuration(0);
            if (liveVoiceDurationTimerRef.current) {
                clearInterval(liveVoiceDurationTimerRef.current);
                liveVoiceDurationTimerRef.current = null;
            }
            // Cleanup on error
            try {
                if (liveVoiceClientRef.current) {
                    await liveVoiceClientRef.current.leave().catch(e => {});
                    liveVoiceClientRef.current.removeAllListeners();
                    liveVoiceClientRef.current = null;
                }
                if (liveVoiceLocalTrackRef.current) {
                    liveVoiceLocalTrackRef.current.close();
                    liveVoiceLocalTrackRef.current = null;
                }
            } catch (cleanupErr) {
                console.error('Error during cleanup:', cleanupErr);
            }
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
                
                // Send voice message via HTTP
                sendMessage(data)
                    .then(() => {
                        scrollToLastMessage();
                    })
                    .catch((error) => {
                        console.error('Failed to send voice message:', error);
                    });
            }
        } catch (e) {
            console.error('Audio upload error:', e)
        } finally {
            setIsUploadingAudio(false)
        }
    }, [room, userId, friendId, isAi, sendMessage])

    useEffect(() => {
        return () => {
            try { recorderRef.current?.stop() } catch (e) {}
            cleanupStream()
            stopWaveform()
            if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)
            
            // Cleanup live voice duration timer
            if (liveVoiceDurationTimerRef.current) {
                clearInterval(liveVoiceDurationTimerRef.current);
                liveVoiceDurationTimerRef.current = null;
            }
            
            // Cleanup live voice
            if (isLiveVoiceActiveRef.current) {
                try {
                    if (liveVoiceClientRef.current && liveVoiceLocalTrackRef.current) {
                        liveVoiceClientRef.current.unpublish([liveVoiceLocalTrackRef.current]).catch(e => {});
                    }
                } catch (e) {}
                try { liveVoiceLocalTrackRef.current?.close(); } catch (e) {}
                try {
                    liveVoiceClientRef.current?.leave().catch(e => {});
                    liveVoiceClientRef.current?.removeAllListeners();
                } catch (e) {}
                liveVoiceLocalTrackRef.current = null;
                liveVoiceClientRef.current = null;
                isLiveVoiceActiveRef.current = false;
            }
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

    },[sendMessage])

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


    const hasComposableContent = Boolean(inputValue.trim() || attachmentUrl);
    const toggleAttachTray = () => {
        setShowAttachTray((prev) => !prev);
        setIsEmojiContainer(false);
        setIsEmojiChangeContainer(false);
    };

    return (
        <>
            <div ref={chatFooter} className={`chat-footer modern-composer ${showAttachTray ? 'tray-open' : ''}`} data-chat-footer="true">

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

                {isRecording && (
                    <div className='composer-recording-bar' aria-live='polite'>
                        <span className='composer-recording-dot'><i className="fas fa-circle"></i></span>
                        <span className='composer-recording-time'>{msToClock(recordingMs)}</span>
                        <canvas ref={waveformCanvasRef} width={140} height={22} className='composer-recording-wave' />
                        <div className='composer-recording-actions'>
                            <div
                                className='composer-icon-btn send'
                                onClick={() => stopRecording(true)}
                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); stopRecording(true) } }}
                                role='button'
                                tabIndex={0}
                                aria-label='Stop and send voice message'
                            >
                                <i className="fas fa-paper-plane"></i>
                            </div>
                            <div
                                className='composer-icon-btn danger'
                                onClick={cancelRecording}
                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); cancelRecording() } }}
                                role='button'
                                tabIndex={0}
                                aria-label='Cancel recording'
                            >
                                <i className="fas fa-trash"></i>
                            </div>
                        </div>
                    </div>
                )}

                <div className="new-message-container composer-main">
                    <div
                        className={`composer-icon-btn attach-toggle ${showAttachTray ? 'active' : ''} ${isUploadingFile || isUploadingImage ? 'disabled' : ''}`}
                        onClick={(isUploadingFile || isUploadingImage) ? null : toggleAttachTray}
                        onKeyDown={(isUploadingFile || isUploadingImage) ? null : (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleAttachTray(); } }}
                        role='button'
                        tabIndex={(isUploadingFile || isUploadingImage) ? -1 : 0}
                        aria-label={showAttachTray ? 'Close attachments' : 'Open attachments'}
                        aria-expanded={showAttachTray}
                    >
                        <i className={showAttachTray ? 'fas fa-times' : 'fas fa-plus'}></i>
                    </div>

                    <div className='new-message-form composer-field-wrap'>
                        <div className='new-message-input-container composer-field'>
                            <input 
                                ref={messageInput} 
                                onChange={handleInputChange} 
                                value={inputValue} 
                                onKeyDown={handleKeyPress} 
                                placeholder='Message' 
                                id='newMessageInput' 
                                className='new-message-input' 
                                onTouchStart={(e) => {
                                    // Focus with preventScroll before iOS does its default focus pan
                                    if (document.body.classList.contains('message-page-mobile')) {
                                        const el = e.currentTarget;
                                        if (document.activeElement !== el) {
                                            e.preventDefault();
                                            el.focus({ preventScroll: true });
                                        }
                                        window.scrollTo(0, 0);
                                    }
                                }}
                                onFocus={() => {
                                    addTyping();
                                    setShowAttachTray(false);
                                    if (document.body.classList.contains('message-page-mobile')) {
                                        window.scrollTo(0, 0);
                                        document.documentElement.scrollTop = 0;
                                        document.body.scrollTop = 0;
                                    }
                                }}
                                onBlur={removeTyping} 
                                disabled={isRecording || isUploadingAudio}
                                style={{ fontSize: '16px' }}
                                enterKeyHint="send"
                                autoComplete="off"
                                autoCorrect="on"
                            />
                            <div
                                onClick={handleEmojiBtnClick.bind(this)}
                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleEmojiBtnClick(); } }}
                                role='button'
                                tabIndex={0}
                                className='composer-emoji-btn message-action-emoji-container'
                                aria-label='Emoji'
                            >
                                <i className="far fa-smile"></i>
                                {isImojiContainer && (
                                    <div ref={emogiListContainer} className='emoji-container'>
                                        <EmojiPicker theme='dark' onEmojiClick={handleEmojiClick} />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div ref={messageActionButtonContainer} className='message-action-button-container composer-end-actions'>
                        {hasComposableContent ? (
                            <div
                                onClick={isSendingMessage ? null : (e) => { setShowAttachTray(false); handleSendMessage(e); }}
                                onKeyDown={isSendingMessage ? null : (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowAttachTray(false); handleSendMessage(e); } }}
                                role='button'
                                tabIndex={isSendingMessage ? -1 : 0}
                                className={`composer-icon-btn send message-action-button send-message ${attachmentUrl == 'https://res.cloudinary.com/dz88yjerw/image/upload/v1743092084/i5lcu63atrbkpcy6oqam.gif' && 'button-disabled'} ${isSendingMessage ? 'disabled' : ''}`}
                                aria-label='Send message'
                                style={{ opacity: isSendingMessage ? 0.6 : 1, cursor: isSendingMessage ? 'not-allowed' : 'pointer' }}
                            >
                                <i className={isSendingMessage ? "fas fa-spinner fa-spin" : "fas fa-paper-plane"}></i>
                            </div>
                        ) : (
                            <>
                                <div
                                    className={`composer-icon-btn mic ${isUploadingAudio || isRecording ? 'disabled' : ''}`}
                                    onClick={isUploadingAudio ? null : (isRecording ? (() => stopRecording(true)) : () => { setShowAttachTray(false); startRecording(); })}
                                    onKeyDown={isUploadingAudio ? null : (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); isRecording ? stopRecording(true) : startRecording(); } }}
                                    role='button'
                                    tabIndex={isUploadingAudio ? -1 : 0}
                                    aria-label={isUploadingAudio ? 'Uploading voice message' : 'Record voice message'}
                                >
                                    <i className={isUploadingAudio ? "fas fa-spinner fa-spin" : (isRecording ? "fas fa-stop-circle" : "fas fa-microphone")}></i>
                                </div>
                                <div
                                    onClick={likeButtonClick}
                                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); likeButtonClick(); } }}
                                    role='button'
                                    tabIndex={0}
                                    className='composer-icon-btn send-like message-action-button composer-like-desktop'
                                    aria-label='Send reaction'
                                    title='Quick reaction'
                                >
                                    <span>{actionEmoji}</span>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {showAttachTray && (
                    <div className='composer-attach-tray' role='toolbar' aria-label='Attachments'>
                        <div className='composer-attach-grid'>
                            <div
                                className={`composer-attach-item ${isUploadingImage ? 'disabled' : ''}`}
                                onClick={isUploadingImage ? null : () => { handleMessageImageButtonClick(); }}
                                onKeyDown={isUploadingImage ? null : (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleMessageImageButtonClick(); } }}
                                role='button'
                                tabIndex={isUploadingImage ? -1 : 0}
                                aria-label='Upload photo'
                            >
                                <span className='composer-attach-icon photo'><i className={isUploadingImage ? "fas fa-spinner fa-spin" : "fas fa-image"}></i></span>
                                <span className='composer-attach-label'>Photo</span>
                            </div>

                            <div
                                className={`composer-attach-item ${isUploadingFile ? 'disabled' : ''}`}
                                onClick={isUploadingFile ? null : () => { handleAttachmentButtonClick(); }}
                                onKeyDown={isUploadingFile ? null : (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleAttachmentButtonClick(); } }}
                                role='button'
                                tabIndex={isUploadingFile ? -1 : 0}
                                aria-label='Upload file'
                            >
                                <span className='composer-attach-icon file'><i className={isUploadingFile ? "fas fa-spinner fa-spin" : "fas fa-paperclip"}></i></span>
                                <span className='composer-attach-label'>File</span>
                            </div>

                            <div
                                className={`composer-attach-item ${isLiveVoiceConnecting || isRecording || isUploadingAudio ? 'disabled' : ''}`}
                                onClick={(isLiveVoiceConnecting || isRecording || isUploadingAudio) ? null : () => { setShowAttachTray(false); handleLiveVoiceButtonClick(); }}
                                onKeyDown={(isLiveVoiceConnecting || isRecording || isUploadingAudio) ? null : (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowAttachTray(false); handleLiveVoiceButtonClick(); } }}
                                role='button'
                                tabIndex={(isLiveVoiceConnecting || isRecording || isUploadingAudio) ? -1 : 0}
                                aria-label={isLiveVoiceActive ? 'Stop live voice' : 'Live voice'}
                            >
                                <span className={`composer-attach-icon live ${isLiveVoiceActive ? 'active' : ''}`}>
                                    <i className={isLiveVoiceConnecting ? "fas fa-spinner fa-spin" : (isLiveVoiceActive ? "fas fa-phone-slash" : "fas fa-headset")}></i>
                                </span>
                                <span className='composer-attach-label'>{isLiveVoiceActive ? 'Stop' : 'Live'}</span>
                            </div>

                            <div
                                className='composer-attach-item'
                                onClick={likeButtonClick}
                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); likeButtonClick(); } }}
                                role='button'
                                tabIndex={0}
                                aria-label='Send quick reaction'
                            >
                                <span className='composer-attach-icon react'><span className='composer-attach-emoji'>{actionEmoji}</span></span>
                                <span className='composer-attach-label'>React</span>
                            </div>

                            <div
                                className='composer-attach-item message-action-emoji-container'
                                onClick={emojiChangeClick.bind(this)}
                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); emojiChangeClick(); } }}
                                role='button'
                                tabIndex={0}
                                aria-label='Change quick reaction'
                            >
                                <span className='composer-attach-icon react-edit'><i className="fas fa-pen"></i></span>
                                <span className='composer-attach-label'>Edit</span>
                                {isImojiChangeContainer && (
                                    <div ref={emogiChangeContainer} className='emoji-container'>
                                        <EmojiPicker theme='dark' onEmojiClick={handleEmojiChangeClick} />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                <div ref={chatNewAttachment} className='chat-new-attachment composer-attach-hidden' aria-hidden='true'>
                    <input type='file' name='uploaded_file' onChange={handleFileChange.bind(this)} ref={uploadFileInput} style={{ display: 'none' }} disabled={isUploadingFile} />
                    <input type='file' accept='image/*' style={{ display: 'none' }} ref={imageInput} onChange={handleMessageImageChange.bind(this)} disabled={isUploadingImage} />
                </div>
            </div>

            <div className="chat-footer-portals" aria-hidden={!isLiveVoiceModalOpen}>
                <LiveVoiceModal
                    isOpen={isLiveVoiceModalOpen}
                    onClose={() => setIsLiveVoiceModalOpen(false)}
                    isActive={isLiveVoiceActive}
                    duration={liveVoiceDuration}
                    isConnecting={isLiveVoiceConnecting}
                    role="sender"
                    friendName={friendProfile?.fullName || friendProfile?.user?.firstName || 'Friend'}
                    onStop={handleLiveVoiceButtonClick}
                />
            </div>
        </>
    );
}

export default ChatFooter;
