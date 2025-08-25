import React, { useState, useEffect, useCallback, useRef } from 'react';
import socket from '../../common/socket';
import UserPP from '../UserPP';
import { useSelector } from 'react-redux';
import * as faceapi from "face-api.js";
import { useParams, useLocation, Link, useNavigate } from 'react-router-dom';
import Peer from 'simple-peer';
import ModalContainer from '../modal/ModalContainer';
import useIsMobile from '../../utils/useIsMobile';
import api from '../../api/api';
import checkImgLoading from '../../utils/checkImgLoading';
import isValidUrl from '../../utils/isValiUrl';
import Webcam from 'react-webcam';

const ChatHeader = ({ friendProfile, isActive, room, lastSeen, friendProfilePic }) => {
    const [emotion, setEmotion] = useState(false);
    const [myEmotion, setMyEmotion] = useState(false);
    const [friendId, setFriendId] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);
    const [isPpLoaded, setIsPpLoaded] = useState(false);
    const [friendPP, setFriendPP] = useState(friendProfilePic);
    const [isMicrophone, setIsMicrophone] = useState(true);
    const [isBackCamera, setIsBackCamera] = useState(false);
    const [isCameraOn, setIsCameraOn] = useState(true);
    const [hasVideoInput, setHasVideoInput] = useState(true);
    const [stream, setStream] = useState();
    const [callAccepted, setCallAccepted] = useState(false);
    const [me, setMe] = useState('');
    const [isChatOptionMenu, setIsChatOptionMenu] = useState(false);
    const [receiverId, setReceiverId] = useState();
    const [isVideoCalling, setIsVideoCalling] = useState(false);
    const [modalHeight, setModalHeight] = useState('auto');

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

    const callUser = (id) => {
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
    };

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
        socket.on('call-accepted', signal => {
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
            setReceiverId(data.from);
            setIsVideoCalling(true);
            playCallingBeep();
            answerCall(data);
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
        if (stream && receiverId && !connectionRef.current) callUser(receiverId);
    }, [stream, receiverId]);

    useEffect(() => {
        if (isVideoCalling) {
            navigator.mediaDevices.enumerateDevices().then(devices => {
                const videoDevices = devices.filter(d => d.kind === 'videoinput');
                const backCamera = videoDevices.find(d => /back|environment/i.test(d.label));
                const deviceId = isBackCamera && backCamera?.deviceId || videoDevices[0]?.deviceId;

                navigator.mediaDevices.getUserMedia({
                    video: { deviceId },
                    audio: isMicrophone
                }).then(mediaStream => {
                    setStream(mediaStream);
                    if (myVideo.current) myVideo.current.srcObject = mediaStream;
                });
            });
        }
    }, [isVideoCalling, isMicrophone]);

    const handleVideoCallBtn = useCallback(e => {
        const id = e.currentTarget.dataset.id;
        setReceiverId(id);
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

    const startVideo = () => {
        if (!cameraVideoRef.current) return
        navigator.mediaDevices.enumerateDevices().then(devices => {
            const videoDevices = devices.filter(d => d.kind === 'videoinput');
            const backCamera = videoDevices.find(d => /back|environment/i.test(d.label));
            const deviceId = isBackCamera && backCamera?.deviceId || videoDevices[0]?.deviceId;
            navigator.mediaDevices.getUserMedia({ video: { deviceId }, audio: isMicrophone })
                .then(stream => { cameraVideoRef.current.srcObject = stream; });
        });
    };

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

    const loadModels = async () => {
        await faceapi.nets.tinyFaceDetector.loadFromUri("/models");
        await faceapi.nets.faceExpressionNet.loadFromUri("/models");
        detectEmotions();
    };

    useEffect(() => { setMe(profile._id); }, [profile]);

    const handleBumpBtnClick = useCallback(() => {
        socket.emit('bump', friendProfile, profile);
    }, [friendProfile, profile]);

    useEffect(() => {
        if (room && settings.isShareEmotion) {
            startVideo();
            loadModels();
        }
    }, [room, settings]);

    useEffect(() => { stopCamera(); }, [location]);

    useEffect(() => {
        setFriendId(friendProfile._id);
        setIsLoaded(!!friendProfile._id);
        setFriendPP(friendProfile.profilePic);
        socket.emit('last_emotion', { friendId: friendProfile._id, profileId });
    }, [friendProfile]);

    useEffect(() => {
        if (isValidUrl(friendPP)) checkImgLoading(friendPP, setIsPpLoaded);
        else setFriendPP('');
    }, [friendPP]);

    useEffect(() => {
        if (myEmotion && friendId) {
            socket.emit('emotion_change', { profileId, emotion: myEmotion, friendId });
        }
    }, [myEmotion, friendId]);

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
                    isLoaded == true ?
                        <>
                            <div className='chat-header-user-info'>
                                <h4 className='chat-header-username'> {`${friendProfile == true ? (friendProfile?.fullName || '') : friendProfile.user && friendProfile.user.firstName + ' ' + friendProfile.user.surname}`}</h4>

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
                                                    emotion && (<span className='chat-header-active-status text-capitalized'>{emotion} |</span>)}

                                                {lastSeen && <span className='chat-header-active-status text-capitalized'> Last Seen: {lastSeen}</span>}


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
                    style={{ width: isMobile ? '95%' : "600px", top: "50%", borderRadius: '10px', height: modalHeight }}
                    isOpen={isVideoCalling || callAccepted}
                    onRequestClose={closeVideoCall}
                    id="videoCallModal"
                >
                    <div className={`${callAccepted ? 'call-accepted' : ''}`} style={{ padding: 0 }}>
                        {<h2 className='text-center vc-modal-heading'>Video Call - {friendProfile && friendProfile.fullName}</h2>}
                        <p className='fs-3 text-center'>
                            {!callAccepted && <>Calling {friendProfile && friendProfile.fullName}</>}
                        </p>
                        <div className={`video-call-container ${isMobile ? 'mobile' : ''}`}>
                            {<video playsInline ref={userVideo} className='friends-video' autoPlay style={{ width: '100%', display: callAccepted ? 'block' : 'none' }} />}
                            <Webcam playsInline muted ref={myVideo} autoPlay className='my-video' style={{ width: '150px' }} />
                            {/* <video playsInline muted ref={myVideo} autoPlay className='my-video' style={{ width: '150px' }} /> */}
                        </div>
                        <div className='call-buttons'>

                            <button onClick={handleLeaveCall.bind(this)} ref={callEndBtn} className='call-button-ends call-button bg-danger'>
                                <i className="fa fa-phone"></i>
                            </button>
                            {
                                callAccepted && <>
                                    <button onClick={handleMicrophoneClick.bind(this)} className='call-button-microphone call-button'>
                                        {
                                            isMicrophone ? <i className="fa fa-microphone"></i> : <i className="fa fa-microphone-slash"></i>
                                        }
                                    </button>
                                    {hasVideoInput && (
                                        <button onClick={handleCameraToggle} className='call-button-camera call-button'>
                                            {isCameraOn ? <i className="fa fa-video" /> : <i className="fa fa-video-slash" />}
                                        </button>
                                    )}
                                    <button onClick={handleSwitchClick.bind(this)} className='call-button-switch call-button'>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2"
                                            stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
                                            <path d="M11 7H5a2 2 0 0 0-2 2v4" />
                                            <path d="M13 17h6a2 2 0 0 0 2-2v-4" />
                                            <polyline points="16 3 21 3 21 8" />
                                            <polyline points="8 21 3 21 3 16" />
                                            <path d="M21 3l-6.5 6.5" />
                                            <path d="M3 21l6.5-6.5" />
                                        </svg>

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
