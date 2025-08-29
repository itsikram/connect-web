import React, { useState, useEffect, useCallback, useRef } from 'react';
import socket from '../../common/socket';
import UserPP from '../UserPP';
import { useSelector } from 'react-redux';
import * as faceapi from "face-api.js";
import { useLocation, useNavigate } from 'react-router-dom';
import Peer from 'simple-peer';
import ModalContainer from '../modal/ModalContainer';
import useIsMobile from '../../utils/useIsMobile';
import api from '../../api/api';
import checkImgLoading from '../../utils/checkImgLoading';
import isValidUrl from '../../utils/isValiUrl';
// Removed react-webcam to directly control local preview video element

const ChatHeader = ({ friendProfile, isActive, room, lastSeen, friendProfilePic }) => {
    const [emotion, setEmotion] = useState(false);
    const [myEmotion, setMyEmotion] = useState(false);
    const [friendId, setFriendId] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);
    const [friendPP, setFriendPP] = useState(friendProfilePic);
    const [isMicrophone, setIsMicrophone] = useState(true);
    const [isBackCamera, setIsBackCamera] = useState(false);
    const [isCameraOn, setIsCameraOn] = useState(true);
    const [stream, setStream] = useState();
    const [callAccepted, setCallAccepted] = useState(false);
    const [me, setMe] = useState('');
    const [isChatOptionMenu, setIsChatOptionMenu] = useState(false);
    const [receiverId, setReceiverId] = useState();
    const [isVideoCalling, setIsVideoCalling] = useState(false);
    const [incomingCall, setIncomingCall] = useState(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [videoFilter, setVideoFilter] = useState('');

    const cameraVideoRef = useRef(null);
    const location = useLocation();
    const myVideo = useRef();
    const userVideo = useRef();
    const connectionRef = useRef();
    const callEndBtn = useRef();
    const callingBeepAudio = useRef();
    const isMobile = useIsMobile();
    const navigate = useNavigate();
    const settings = useSelector(state => state.setting);
    const profile = useSelector(state => state.profile);
    const profileId = profile._id;

    // Media capability helpers
    const isSecure = (typeof window !== 'undefined' && (window.isSecureContext || ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname)));
    const hasMediaDevices = typeof navigator !== 'undefined' && !!(navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function');
    const canEnumerateDevices = typeof navigator !== 'undefined' && !!(navigator.mediaDevices && typeof navigator.mediaDevices.enumerateDevices === 'function');

    const pickPreferredVideoDeviceId = useCallback(async () => {
        if (!canEnumerateDevices) return undefined;
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter(d => d.kind === 'videoinput');
            const backCamera = videoDevices.find(d => /back|environment/i.test(d.label));
            return (isBackCamera && backCamera?.deviceId) || videoDevices[0]?.deviceId;
        } catch (err) {
            console.warn('enumerateDevices failed; falling back to default camera', err);
            return undefined;
        }
    }, [canEnumerateDevices, isBackCamera]);

    const getLocalStream = useCallback(async (withVideo = true, withAudio = true) => {
        if (!hasMediaDevices || !isSecure) {
            console.error('Media devices unavailable or insecure context. Use HTTPS or localhost.');
            throw new Error('insecure_or_unsupported_context');
        }
        const deviceId = withVideo ? await pickPreferredVideoDeviceId() : undefined;
        const videoConstraint = withVideo ? (deviceId ? { deviceId: { exact: deviceId } } : true) : false;
        const constraints = { video: videoConstraint, audio: !!withAudio };
        return navigator.mediaDevices.getUserMedia(constraints);
    }, [hasMediaDevices, isSecure, pickPreferredVideoDeviceId]);

    const handleMicrophoneClick = useCallback(() => {
        setIsMicrophone(prev => !prev);
    }, []);

    const handleCameraToggle = useCallback(() => {
        if (stream) {
            stream.getVideoTracks().forEach(track => track.stop());
        }
        setIsCameraOn(prev => !prev);
    }, [stream]);

    const closeVideoCall = () => { };

    const playCallingBeep = () => {
        callingBeepAudio?.current.play();
    };

    const stopCallingBeep = () => {
        callingBeepAudio?.current.pause();
    };

    const callUser = useCallback((id) => {
        // if (!stream) return;
        const peerA = new Peer({
            initiator: true,
            trickle: false,
            stream
        });

        peerA.on('signal', (data) => {
            socket.emit('call-user', {
                userToCall: id,
                signalData: data,
                from: me,
                name: profile.fullName || '',
                isVideoCall: true
            });
        });

        peerA.on('stream', (currentStream) => {
            userVideo.current.srcObject = currentStream;
        });

        connectionRef.current = peerA;
    }, [stream, me, profile.fullName]);

    const answerCall = useCallback((data) => {
        setCallAccepted(true);
        stopCallingBeep();
        const peerB = new Peer({
            initiator: false,
            trickle: false,
            stream
        });

        peerB.on('signal', signal => {
            socket.emit('answer-call', { signal, to: data.from });
        });

        peerB.on('stream', currentStream => {
            userVideo.current.srcObject = currentStream;
        });

        peerB.signal(data.signal);
        connectionRef.current = peerB;
    }, [stream]);

    useEffect(() => {
        socket.on('call-accepted', ({ signal }) => {
            setCallAccepted(true);
            stopCallingBeep();
            if (connectionRef.current && !connectionRef.current.destroyed) {
                try {
                    connectionRef.current.signal(signal);
                } catch (err) {
                    console.error("Error signaling accepted call:", err);
                }
            }
        });

        socket.on('receive-call', data => {
            // Do not auto-answer. Show incoming modal and wait for user action.
            setIncomingCall(data);
            setIsVideoCalling(true);
            playCallingBeep();
        });

        socket.on('videoCallEnd', () => {
            callEndBtn.current?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: false }));
        });

        callingBeepAudio?.current.setAttribute('src', 'https://programmerikram.com/wp-content/uploads/2025/05/calling-beep.mp3');

        return () => {
            socket.off('call-accepted');
            socket.off('receive-call');
            socket.off('videoCallEnd');
        };
    }, [answerCall]);

    useEffect(() => {
        // Only auto-initiate peer when this user is the caller
        if (stream && receiverId && !incomingCall && !connectionRef.current) {
            callUser(receiverId);
        }
    }, [stream, receiverId, callUser, incomingCall]);

    useEffect(() => {
        if (!isVideoCalling) return;
        (async () => {
            try {
                const mediaStream = await getLocalStream(true, isMicrophone);
                setStream(mediaStream);
                if (myVideo.current) {
                    myVideo.current.srcObject = mediaStream;
                }
            } catch (err) {
                console.error('Failed to get local media stream (video+audio). Retrying audio-only...', err);
                try {
                    const audioOnlyStream = await getLocalStream(false, isMicrophone);
                    setStream(audioOnlyStream);
                    if (myVideo.current) {
                        myVideo.current.srcObject = audioOnlyStream;
                    }
                } catch (err2) {
                    console.error('Failed to get any media stream', err2);
                    alert('Camera/Microphone unavailable. Please use HTTPS or localhost and grant permissions.');
                    setIsVideoCalling(false);
                }
            }
        })();
    }, [isVideoCalling, isMicrophone, isBackCamera, getLocalStream]);

    const handleVideoCallBtn = useCallback(e => {
        const id = e.currentTarget.dataset.id;
        setReceiverId(id);
        setIncomingCall(null);
        setIsVideoCalling(true);
        playCallingBeep();
    }, []);

    const handleLeaveCall = useCallback(() => {
        stopCallingBeep();
        socket.emit('leaveVideoCall', friendId);

        stream?.getTracks().forEach(t => t.stop());
        if (myVideo.current) myVideo.current.srcObject = null;
        if (userVideo.current) userVideo.current.srcObject = null;

        setStream(null);
        setCallAccepted(false);
        setIsVideoCalling(false);

        if (connectionRef.current) {
            connectionRef.current.destroy();
            connectionRef.current = null;
        }
    }, [friendId, stream]);

    const startVideo = useCallback(() => {
        if (!cameraVideoRef.current) return;
        getLocalStream(true, isMicrophone)
            .then(localStream => { cameraVideoRef.current.srcObject = localStream; })
            .catch(err => console.error('Failed to start hidden camera for emotion', err));
    }, [getLocalStream, isMicrophone]);

    const stopCamera = () => {
        if (!cameraVideoRef.current) return

        const stream = cameraVideoRef.current?.srcObject;
        stream?.getTracks().forEach(track => track.stop());
        cameraVideoRef.current.srcObject = null;
    };

    const detectEmotions = () => {
        setTimeout(() => {
            setInterval(async () => {
                if (cameraVideoRef?.current) {
                    const detections = await faceapi.detectAllFaces(cameraVideoRef.current, new faceapi.TinyFaceDetectorOptions()).withFaceExpressions();
                    if (detections.length > 0) {
                        const emotions = detections[0].expressions;
                        const maxEmotion = Object.entries(emotions).reduce((a, b) => a[1] > b[1] ? a : b)[0];
                        if (room && myEmotion !== maxEmotion) setMyEmotion(maxEmotion);
                    }
                }
            }, 100);
        }, 3000);
    };

    const loadModels = useCallback(async () => {
        await faceapi.nets.tinyFaceDetector.loadFromUri("/models");
        await faceapi.nets.faceExpressionNet.loadFromUri("/models");
        detectEmotions();
    }, []);

    useEffect(() => { setMe(profile._id); }, [profile]);

    const handleBumpBtnClick = useCallback(() => {
        socket.emit('bump', { friendProfile: friendProfile._id, myProfile: profile._id });
    }, [friendProfile, profile]);

    useEffect(() => {
        if (room && settings.isShareEmotion) {
            startVideo();
            loadModels();
        }
    }, [room, settings, startVideo, loadModels]);

    useEffect(() => { stopCamera(); }, [location]);

    useEffect(() => {
        setFriendId(friendProfile._id);
        setIsLoaded(!!friendProfile._id);
        setFriendPP(friendProfile.profilePic);
        socket.emit('last_emotion', { friendId: friendProfile._id, profileId });
    }, [friendProfile, profileId]);

    useEffect(() => {
        if (isValidUrl(friendPP)) checkImgLoading(friendPP, () => {}); // Removed unused setIsPpLoaded
        else setFriendPP('');
    }, [friendPP]);

    useEffect(() => {
        if (myEmotion && friendId) {
            socket.emit('emotion_change', { profileId, emotion: myEmotion, friendId });
        }
    }, [myEmotion, friendId, profileId]);

    useEffect(() => {
        const handleEmotion = (emotion) => setEmotion(emotion);
        const handleLastEmotion = (data) => setEmotion(data.lastEmotion && ` L: ${data.lastEmotion}`);
        socket.on('emotion_change', handleEmotion);
        socket.on('last_emotion', handleLastEmotion);
        return () => {
            socket.off('emotion_change', handleEmotion);
            socket.off('last_emotion', handleLastEmotion);
        };
    }, []);

    const handleSwitchClick = useCallback(() => {
        setIsBackCamera(prev => !prev);
    }, []);

    const toggleVideoFilter = useCallback(() => {
        const filters = ['', 'video-vivid-filter', 'video-vivid-warm', 'video-vivid-cool', 'video-vivid-dramatic'];
        const currentIndex = filters.indexOf(videoFilter);
        const nextIndex = (currentIndex + 1) % filters.length;
        setVideoFilter(filters[nextIndex]);
    }, [videoFilter]);

    const toggleFullscreen = useCallback(async () => {
        if (!isFullscreen) {
            // Enter fullscreen
            try {
                const modalElement = document.getElementById('videoCallModal');
                if (modalElement && modalElement.requestFullscreen) {
                    await modalElement.requestFullscreen();
                } else if (modalElement && modalElement.webkitRequestFullscreen) {
                    await modalElement.webkitRequestFullscreen();
                } else if (modalElement && modalElement.mozRequestFullScreen) {
                    await modalElement.mozRequestFullScreen();
                } else if (modalElement && modalElement.msRequestFullscreen) {
                    await modalElement.msRequestFullscreen();
                }
                setIsFullscreen(true);
            } catch (err) {
                console.error('Failed to enter fullscreen:', err);
                // Fallback to CSS fullscreen
                setIsFullscreen(true);
            }
        } else {
            // Exit fullscreen
            try {
                if (document.fullscreenElement) {
                    await document.exitFullscreen();
                } else if (document.webkitFullscreenElement) {
                    await document.webkitExitFullscreen();
                } else if (document.mozFullScreenElement) {
                    await document.mozCancelFullScreen();
                } else if (document.msFullscreenElement) {
                    await document.msExitFullscreen();
                }
                setIsFullscreen(false);
            } catch (err) {
                console.error('Failed to exit fullscreen:', err);
                // Fallback to CSS fullscreen
                setIsFullscreen(false);
            }
        }
    }, [isFullscreen]);

    // Handle fullscreen change events (e.g., when user presses ESC)
    useEffect(() => {
        const handleFullscreenChange = () => {
            const isCurrentlyFullscreen = !!(
                document.fullscreenElement ||
                document.webkitFullscreenElement ||
                document.mozFullScreenElement ||
                document.msFullscreenElement
            );
            setIsFullscreen(isCurrentlyFullscreen);
        };

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
        document.addEventListener('mozfullscreenchange', handleFullscreenChange);
        document.addEventListener('MSFullscreenChange', handleFullscreenChange);

        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
            document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
            document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
            document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
        };
    }, []);

    const chatOptionMenu = useRef(null);
    useEffect(() => {
        const handleClickOutside = e => {
            if (chatOptionMenu.current && !chatOptionMenu.current.contains(e.target)) {
                setIsChatOptionMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleChatOptionClick = useCallback(() => setIsChatOptionMenu(prev => !prev), []);
    const handleBlockUser = useCallback(async () => {
        const res = await api.post('friend/block', { friendId });
        if (res.status === 200) alert('User Blocked');
    }, [friendId]);

    const handleUnBlockUser = useCallback(async () => {
        const res = await api.post('friend/unblock', { friendId });
        if (res.status === 200) alert('User unblocked');
    }, [friendId]);

    const handleViewProfile = useCallback(() => navigate(`/${friendId}`), [navigate, friendId]);
    return (
        <>

            <div className={`chat-header-user ${'skleton-card'}`}>
                <div className='chat-header-profilePic'>

                    {

                        !isLoaded ? <div className="skeleton-header">
                            <div className="skeleton-avatar" />

                        </div>
                            : <UserPP profilePic={`${friendPP}`} hasStory={false} profile={friendProfile._id} active={isActive ? true : false}></UserPP>
                    }
                </div>

                {
                    isLoaded === true ?
                        <>
                            <div className='chat-header-user-info'>
                                <h4 className='chat-header-username'> {`${friendProfile === true ? (friendProfile?.fullName || '') : friendProfile.user && friendProfile.user.firstName + ' ' + friendProfile.user.surname}`}</h4>

                                {

                                    isMobile ?
                                        <>

                                            {
                                                emotion ? (<span className='chat-header-active-status text-capitalized'>{emotion}</span>)



                                                    :

                                                    (<>
                                                        {lastSeen && <span className='chat-header-active-status text-capitalized'>Last Seen: {lastSeen}</span>}

                                                    </>)


                                            }


                                        </>


                                        : (
                                            <>

                                                {
                                                    emotion && (<span className='chat-header-active-status text-capitalized'>{emotion} |</span>)

                                                }{lastSeen && <span className='chat-header-active-status text-capitalized'> Last Seen: {lastSeen}</span>}


                                            </>
                                        )

                                } </div>
                        </>
                        :
                        <>
                            <div className='chat-header-user-info'>
                                <div className="skeleton-lines">
                                    <div className="skeleton-line short" />
                                    <div className="skeleton-line medium" />
                                </div>

                            </div>
                        </>
                }

            </div>

            <div className='chat-header-action'>
                <div className='chat-header-action-btn-container'>
                    <div onClick={handleBumpBtnClick} className='bump-button action-button' title='bump'>
                        <i className="fas fa-record-vinyl"></i>
                    </div>
                    <div className='call-button action-button'>
                        <i className="fas fa-phone-alt"></i>
                    </div>
                    <div onClick={handleVideoCallBtn} data-id={friendId} className='video-call-button action-button'>
                        <i className="fas fa-video"></i>
                    </div>
                    <div onClick={handleChatOptionClick.bind(this)} className='info-button action-button'>
                        <i className="fas fa-info-circle"></i>
                    </div>

                    {isChatOptionMenu && (
                        <div className="chat-option-menu" ref={chatOptionMenu} >
                            <ul>
                                <li onClick={handleViewProfile.bind(this)}>View Profile</li>
                                {
                                    profile?.blockedUsers.includes(friendId) ? <><li onClick={handleUnBlockUser.bind(this)}>Unblock {friendProfile.user.firstName}</li></> : <><li onClick={handleBlockUser.bind(this)}>Block {friendProfile.user.firstName}</li></>
                                }

                                <li>Report {friendProfile.user.firstName}</li>
                            </ul>
                        </div>
                    )}
                </div>

                <ModalContainer
                    title="Video Call"
                    style={isFullscreen ? {} : { width: isMobile ? '95%' : "600px", top: "50%", borderRadius: '10px', height: 'auto' }}
                    isOpen={isVideoCalling || callAccepted}
                    onRequestClose={closeVideoCall}
                    id="videoCallModal"
                    isFullscreen={isFullscreen}
                >
                    <div className={`${callAccepted ? 'call-accepted' : ''} ${isFullscreen ? 'fullscreen-content' : ''}`} style={{ padding: 0 }}>
                        {<h2 className='text-center vc-modal-heading'>Video Call - {friendProfile && friendProfile.fullName}</h2>}
                        {!isFullscreen && (
                            <p className='fs-3 text-center'>
                                {!callAccepted && (
                                    incomingCall ? <>
                                        {(incomingCall.name || 'Someone')} is calling you
                                    </> : <>
                                        Calling {friendProfile && friendProfile.fullName}
                                    </>
                                )}
                            </p>
                        )}
                        <div className={`video-call-container ${isMobile ? 'mobile' : ''}`}>
                            {<video playsInline ref={userVideo} className={`friends-video ${videoFilter}`} autoPlay style={{ width: '100%', display: callAccepted ? 'block' : 'none' }} />}
                            <video playsInline muted ref={myVideo} autoPlay className={`my-video ${videoFilter}`} style={{ width: '150px' }} />
                        </div>
                        <div className='call-buttons'>

                            <button onClick={handleLeaveCall.bind(this)} ref={callEndBtn} className='call-button-ends call-button bg-danger'>
                                <i className="fa fa-phone"></i>
                            </button>
                            {
                                !callAccepted && incomingCall && (
                                    <button onClick={() => answerCall(incomingCall)} className='call-button-receive call-button bg-success'>
                                        <i className="fa fa-phone-volume"></i>
                                    </button>
                                )
                            }
                            {
                                callAccepted && <>
                                    <button onClick={handleMicrophoneClick.bind(this)} className='call-button-microphone call-button'>
                                        {
                                            isMicrophone ? <i className="fa fa-microphone"></i> : <i className="fa fa-microphone-slash"></i>
                                        }
                                    </button>
                                    {(
                                        <button onClick={handleCameraToggle} className='call-button-camera call-button'>
                                            {isCameraOn ? <i className="fa fa-video" /> : <i className="fa fa-video-slash" />}
                                        </button>
                                    )}
                                    <button onClick={handleSwitchClick.bind(this)} className='call-button-switch call-button'>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2"
                                            strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                                            <path d="M11 7H5a2 2 0 0 0-2 2v4" />
                                            <path d="M13 17h6a2 2 0 0 0 2-2v-4" />
                                            <polyline points="16 3 21 3 21 8" />
                                            <polyline points="8 21 3 21 3 16" />
                                            <path d="M21 3l-6.5 6.5" />
                                            <path d="M3 21l6.5-6.5" />
                                        </svg>
                                    </button>
                                    <button onClick={toggleVideoFilter} className={`call-button-filter call-button ${videoFilter ? 'active' : ''}`} title={videoFilter ? `Filter: ${videoFilter.replace('video-vivid-', '').replace('filter', 'vivid')}` : 'No filter'}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                                            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                                        </svg>
                                    </button>
                                    <button onClick={toggleFullscreen} className='call-button-fullscreen call-button'>
                                        {isFullscreen ? (
                                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2"
                                                strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                                                <path d="M8 3v3a2 2 0 0 1-2 2H3" />
                                                <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
                                                <path d="M3 16h3a2 2 0 0 1 2 2v3" />
                                                <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
                                            </svg>
                                        ) : (
                                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2"
                                                strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                                                <path d="M3 7V3a2 2 0 0 1 2-2h4" />
                                                <path d="M17 3h4a2 2 0 0 1 2 2v4" />
                                                <path d="M21 17v4a2 2 0 0 1-2 2h-4" />
                                                <path d="M7 21H3a2 2 0 0 1-2-2v-4" />
                                            </svg>
                                        )}
                                    </button>


                                </>
                            }

                        </div>

                    </div>
                </ModalContainer >



            </div >
            {
                settings.isShareEmotion === true && (
                    <video style={{ display: 'none' }} ref={cameraVideoRef} autoPlay muted width="600" height="400" />
                )
            }

            <audio ref={callingBeepAudio} src='' loop />

        </>
    );
}

export default ChatHeader;
