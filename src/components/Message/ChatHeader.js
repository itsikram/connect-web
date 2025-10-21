import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import socket from '../../common/socket';
import UserPP from '../UserPP';
import { useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import AgoraRTC from 'agora-rtc-sdk-ng';
import ModalContainer from '../modal/ModalContainer';
import useIsMobile from '../../utils/useIsMobile';
import api from '../../api/api';
import checkImgLoading from '../../utils/checkImgLoading';
import isValidUrl from '../../utils/isValiUrl';
import { useCallMinimize } from '../../contexts/CallMinimizeContext';
import { 
    emotionEmojiMap 
} from '../../utils/emotionDetection';
import { startMediaPipeEmotionDetection } from '../../utils/mediapipeExpressions';
import  config  from '../../config/config.json';
// Using Agora RTC SDK instead of simple-peer

const ChatHeader = ({ friendProfile, room, lastSeen, friendProfilePic }) => {
    const [emotion, setEmotion] = useState(false);
    const [myEmotion, setMyEmotion] = useState('');
    const [friendId, setFriendId] = useState(null);
    const [isLoaded, setIsLoaded] = useState(false);
    const [friendPP, setFriendPP] = useState(friendProfilePic);
    const [isMicrophone, setIsMicrophone] = useState(true);
    // const [isBackCamera, setIsBackCamera] = useState(false); // Commented out as it's unused
    const [isCameraOn, setIsCameraOn] = useState(true);
    const [callAccepted, setCallAccepted] = useState(false);
    const [isChatOptionMenu, setIsChatOptionMenu] = useState(false);
    const [isVideoCalling, setIsVideoCalling] = useState(false);
    const [incomingCall, setIncomingCall] = useState(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [currentChannel, setCurrentChannel] = useState(null);
    const [filterFriendVideo, setFilterFriendVideo] = useState(false);
    const [filterMyVideo, setFilterMyVideo] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [callDuration, setCallDuration] = useState(0);
    const callStartTime = useRef(null);

    const cameraVideoRef = useRef(null);
    const location = useLocation();
    const myVideo = useRef();
    const userVideo = useRef();
    const callEndBtn = useRef();
    const callingBeepAudio = useRef();

    // Agora RTC refs (create a fresh client per call)
    const clientRef = useRef(null);
    const localTracks = useRef([]);
    const isJoiningOrJoined = useRef(false);
    const hasBoundClientEvents = useRef(false);
    const remoteUserCheckInterval = useRef(null);
    const emotionIntervalRef = useRef(null);
    const actionLockRef = useRef({ label: null, until: 0 });
    const mediaPipeCtlRef = useRef(null);
    // Keep minimized bar duration in sync while minimized
    const minimizedDurationInterval = useRef(null);
    // Majority emotion tracking (rolling window)
    const labelHistoryRef = useRef([]);
    const lastMajorityLabelRef = useRef(null);
    const MAJORITY_WINDOW_MS = 1500;

    const isMobile = useIsMobile();
    const navigate = useNavigate();
    const settings = useSelector(state => state.setting);
    const profile = useSelector(state => state.profile);
    const profileId = profile._id;

    // Stable numeric UID for Agora (avoids string-UID warnings)
    const numericUid = useMemo(() => {
        if (!profileId) return 0;
        let hash = 0;
        for (let i = 0; i < profileId.length; i++) {
            hash = ((hash << 5) - hash) + profileId.charCodeAt(i);
            hash |= 0;
        }
        return Math.abs(hash);
    }, [profileId]);


    const { minimizeCall, endMinimizedCall, updateMinimizedCall } = useCallMinimize();

    // Consistent mobile button styling (perfect circles)
    const mobileActionButtonStyle = isMobile ? {
        width: 56,
        height: 56,
        borderRadius: '50%',
        padding: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 6px 16px rgba(0,0,0,0.35)',
        border: '1px solid rgba(255,255,255,0.08)',
        boxSizing: 'border-box',
        overflow: 'hidden',
        flexShrink: 0,
        flexBasis: 56
    } : {};

    // Get Agora token
    const getToken = async (channelName) => {
        const { data } = await api.post("/agora/token", { channelName, uid: numericUid });
        return data; // { appId, token }
    };

    const handleMicrophoneClick = useCallback(async () => {
        // Find the audio track specifically using 'kind' property
        const audioTrack = localTracks.current.find(track => track.kind === 'audio');
        if (audioTrack) {
            console.log('Toggling microphone. Current state:', isMicrophone, 'New state:', !isMicrophone);
            console.log('Audio track found:', audioTrack);
            console.log('Audio track kind:', audioTrack.kind);
            await audioTrack.setEnabled(!isMicrophone);
            console.log('Audio track enabled state after toggle:', audioTrack.enabled);
        } else {
            console.log('No audio track found in tracks:', localTracks.current);
            // Fallback to index 0 (should be audio according to Agora docs)
            if (localTracks.current[0]) {
                console.log('Using fallback - index 0 track:', localTracks.current[0]);
                await localTracks.current[0].setEnabled(!isMicrophone);
            }
        }
        setIsMicrophone(prev => !prev);
    }, [isMicrophone]);

    const handleCameraToggle = useCallback(async () => {
        // Find the video track specifically using 'kind' property
        const videoTrack = localTracks.current.find(track => track.kind === 'video');
        if (videoTrack) {
            console.log('Toggling camera. Current state:', isCameraOn, 'New state:', !isCameraOn);
            console.log('Video track found:', videoTrack);
            console.log('Video track kind:', videoTrack.kind);
            await videoTrack.setEnabled(!isCameraOn);
            console.log('Video track enabled state after toggle:', videoTrack.enabled);
        } else {
            console.log('No video track found in tracks:', localTracks.current);
            // Fallback to index 1 (should be video according to Agora docs)
            if (localTracks.current[1]) {
                console.log('Using fallback - index 1 track:', localTracks.current[1]);
                await localTracks.current[1].setEnabled(!isCameraOn);
            }
        }
        setIsCameraOn(prev => !prev);
    }, [isCameraOn]);

    const closeVideoCall = () => { };

    const playCallingBeep = () => {
        callingBeepAudio?.current.play();
    };

    const stopCallingBeep = () => {
        callingBeepAudio?.current.pause();
    };

    // Stop hidden emotion camera when a call starts or is accepted
    useEffect(() => {
        if (isVideoCalling || callAccepted) {
            try { stopCamera(); } catch (e) { /* Ignore camera stop errors */ }
        }
    }, [isVideoCalling, callAccepted]);

    // Call duration tracking
    useEffect(() => {
        let interval = null;
        if (callAccepted && !isMinimized) {
            if (!callStartTime.current) {
                callStartTime.current = Date.now();
            }
            interval = setInterval(() => {
                const elapsed = Math.floor((Date.now() - callStartTime.current) / 1000);
                setCallDuration(elapsed);
            }, 1000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [callAccepted, isMinimized]);

    // While minimized, push duration into minimized call bar
    useEffect(() => {
        if (callAccepted && isMinimized && currentChannel && callStartTime.current) {
            const callId = `chatheader-video-${currentChannel}`;
            minimizedDurationInterval.current = setInterval(() => {
                const elapsed = Math.floor((Date.now() - callStartTime.current) / 1000);
                try { updateMinimizedCall(callId, { duration: elapsed }); } catch (e) { /* Ignore update errors */ }
            }, 1000);
        }
        return () => {
            if (minimizedDurationInterval.current) {
                clearInterval(minimizedDurationInterval.current);
                minimizedDurationInterval.current = null;
            }
        };
    }, [callAccepted, isMinimized, currentChannel]);

    // Listen for global event to stop hidden camera (from other components)
    useEffect(() => {
        const handler = () => { try { stopCamera(); } catch (e) { /* Ignore camera stop errors */ } };
        window.addEventListener('stopEmotionCamera', handler);
        return () => window.removeEventListener('stopEmotionCamera', handler);
    }, []);

    // Start a call (join & publish)
    const startCall = useCallback(async (channelName) => {
        try {
            console.log('Starting Agora call with channel:', channelName);
            setCallAccepted(true);
            setCurrentChannel(channelName);

            // Set call start time for duration tracking
            if (!callStartTime.current) {
                callStartTime.current = Date.now();
            }

            // Prevent double join attempts (race-safe)
            if (isJoiningOrJoined.current) {
                console.warn('Join skipped: client already joining/joined');
                return;
            }
            isJoiningOrJoined.current = true;

            // Ensure any previous client is fully cleaned up before creating a new one
            if (clientRef.current) {
                try {
                    await clientRef.current.leave();
                } catch (e) {
                    // Ignore errors
                }
                try {
                    clientRef.current.removeAllListeners();
                } catch (e) {
                    // Ignore errors
                }
                clientRef.current = null;
            }

            // Create a fresh client instance for this call
            clientRef.current = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
            const client = clientRef.current;

            const { appId, token } = await getToken(channelName);
            console.log('Got Agora token for channel:', channelName);

            // Join the channel with numeric UID
            await client.join(appId, channelName, token, numericUid);
            console.log('Joined Agora channel successfully');

            // Immediately check for existing users after joining
            setTimeout(() => {
                const remoteUsers = client.remoteUsers;
                console.log('ChatHeader - Immediate check - Remote users in channel:', remoteUsers.length);
                remoteUsers.forEach(user => {
                    console.log('ChatHeader - Remote user details:', { uid: user.uid, hasVideo: user.hasVideo, hasAudio: user.hasAudio });
                });
            }, 500);

            // Ensure hidden camera is stopped before acquiring camera for Agora
            try { stopCamera(); } catch (e) { /* Ignore camera stop errors */ }

            // Create local audio/video tracks if they don't exist
            if (!localTracks.current || localTracks.current.length === 0) {
                try {
                    localTracks.current = await AgoraRTC.createMicrophoneAndCameraTracks();
                } catch (trackErr) {
                    console.error('createMicrophoneAndCameraTracks failed, falling back to mic only:', trackErr);
                    // Fallback to microphone-only to keep the call going
                    localTracks.current = [await AgoraRTC.createMicrophoneAudioTrack()];
                }


                // Play local video in myVideo ref
                if (myVideo.current) {
                    localTracks.current[1].play(myVideo.current);
                    console.log('Playing local video');
                }
            } else {
                console.log('Using existing local tracks');
            }

            await client.publish(localTracks.current);
            console.log('Published local tracks');

            // Bind client events only once per component lifecycle
            if (!hasBoundClientEvents.current) {
                hasBoundClientEvents.current = true;
                client.on("user-published", async (user, mediaType) => {
                    console.log('ChatHeader - Remote user published:', user.uid, mediaType);
                    try {
                        await client.subscribe(user, mediaType);
                        console.log('ChatHeader - Successfully subscribed to', user.uid, mediaType);

                        if (mediaType === "video") {
                            if (userVideo.current && user.videoTrack) {
                                // Clear any existing content first
                                userVideo.current.innerHTML = '';
                                user.videoTrack.play(userVideo.current);
                                console.log('ChatHeader - Playing remote video from user:', user.uid);
                            } else {
                                console.warn('ChatHeader - Cannot play remote video - missing userVideo ref or videoTrack');
                            }
                        }

                        if (mediaType === "audio") {
                            if (user.audioTrack) {
                                user.audioTrack.play();
                                console.log('ChatHeader - Playing remote audio from user:', user.uid);
                            } else {
                                console.warn('ChatHeader - Cannot play remote audio - missing audioTrack');
                            }
                        }
                    } catch (error) {
                        console.error('ChatHeader - Error subscribing to user:', user.uid, mediaType, error);
                    }
                });

                client.on("user-unpublished", (user) => {
                    console.log('ChatHeader - Remote user unpublished:', user.uid);
                    if (userVideo.current) {
                        userVideo.current.innerHTML = '';
                    }
                });

                // End locally when remote user leaves the channel
                client.on("user-left", async (user) => {
                    console.log('ChatHeader - Remote user left the channel:', user?.uid);
                    try {
                        await cleanupVideoCall();
                    } catch (e) {
                        console.warn('ChatHeader - Cleanup after remote user-left failed:', e);
                    }
                });
            }

            // Check for existing remote users who may have already published before we joined
            setTimeout(async () => {
                try {
                    const remoteUsers = client.remoteUsers;
                    console.log('ChatHeader - Checking for existing remote users:', remoteUsers.length);

                    for (const user of remoteUsers) {
                        console.log('ChatHeader - Found existing remote user:', user.uid, 'hasVideo:', user.hasVideo, 'hasAudio:', user.hasAudio);

                        // Subscribe to video if available
                        if (user.hasVideo && !user.videoTrack) {
                            console.log('ChatHeader - Subscribing to existing user video:', user.uid);
                            await client.subscribe(user, "video");
                            if (userVideo.current && user.videoTrack) {
                                user.videoTrack.play(userVideo.current);
                                console.log('ChatHeader - Playing existing remote user video');
                            }
                        } else if (user.hasVideo && user.videoTrack && userVideo.current) {
                            // Video track already exists, just play it
                            user.videoTrack.play(userVideo.current);
                            console.log('ChatHeader - Playing already subscribed remote video');
                        }

                        // Subscribe to audio if available
                        if (user.hasAudio && !user.audioTrack) {
                            console.log('ChatHeader - Subscribing to existing user audio:', user.uid);
                            await client.subscribe(user, "audio");
                            if (user.audioTrack) {
                                user.audioTrack.play();
                                console.log('ChatHeader - Playing existing remote user audio');
                            }
                        } else if (user.hasAudio && user.audioTrack) {
                            // Audio track already exists, just play it
                            user.audioTrack.play();
                            console.log('ChatHeader - Playing already subscribed remote audio');
                        }
                    }
                } catch (error) {
                    console.error('ChatHeader - Error checking for existing remote users:', error);
                }
            }, 1000); // Small delay to ensure everything is properly initialized

            // Additional periodic check for the first few seconds to catch any missed remote users
            let checkCount = 0;
            const maxChecks = 5;
            remoteUserCheckInterval.current = setInterval(async () => {
                checkCount++;
                try {
                    const remoteUsers = client.remoteUsers;
                    if (remoteUsers.length > 0) {
                        console.log(`ChatHeader - Periodic check ${checkCount}: Found ${remoteUsers.length} remote users`);

                        for (const user of remoteUsers) {
                            // Check if we have video but it's not playing
                            if (user.hasVideo && user.videoTrack && userVideo.current) {
                                const videoElement = userVideo.current.querySelector('video');
                                if (!videoElement || videoElement.paused || videoElement.readyState === 0) {
                                    console.log(`ChatHeader - Periodic check ${checkCount}: Re-attempting to play remote video for user ${user.uid}`);
                                    userVideo.current.innerHTML = '';
                                    user.videoTrack.play(userVideo.current);
                                }
                            }
                        }
                    }

                    if (checkCount >= maxChecks) {
                        clearInterval(remoteUserCheckInterval.current);
                        remoteUserCheckInterval.current = null;
                        console.log('ChatHeader - Stopped periodic remote user checks');
                    }
                } catch (error) {
                    console.error(`ChatHeader - Error in periodic check ${checkCount}:`, error);
                }
            }, 2000); // Check every 2 seconds
        } catch (error) {
            console.error('Failed to start call:', error);
            alert('Failed to start call. Please try again.');
            setIsVideoCalling(false);
            setCallAccepted(false);
            isJoiningOrJoined.current = false;
        }
    }, [profileId, getToken]);


    const answerCall = useCallback(async (data) => {
        stopCallingBeep();

        // Start local video immediately when accepting call
        try {
            console.log('Starting local video for call answer');
            localTracks.current = await AgoraRTC.createMicrophoneAndCameraTracks();

            // Show local video immediately
            if (myVideo.current && localTracks.current[1]) {
                localTracks.current[1].play(myVideo.current);
                console.log('Local video started immediately');
            }
        } catch (error) {
            console.error('Failed to start local video immediately:', error);
        }

        socket.emit('agora-answer-call', { to: data.from, channelName: data.channelName });
        await startCall(data.channelName);
    }, [startCall]);

    // Local cleanup without emitting to server
    const cleanupVideoCall = useCallback(async () => {
        console.log('ChatHeader: cleanupVideoCall - doing local cleanup only');
        stopCallingBeep();

        // Clear any running intervals
        if (remoteUserCheckInterval.current) {
            clearInterval(remoteUserCheckInterval.current);
            remoteUserCheckInterval.current = null;
        }

        // End minimized call if exists
        if (currentChannel) {
            const callId = `chatheader-video-${currentChannel}`;
            endMinimizedCall(callId);
        }

        // Unpublish and close local tracks
        try {
            if (clientRef.current && localTracks.current.length > 0) {
                await clientRef.current.unpublish(localTracks.current);
            }
        } catch (e) {
            // Ignore errors
        }
        localTracks.current.forEach((track) => track.close());
        localTracks.current = [];

        // Leave Agora channel and dispose client
        try {
            await clientRef.current?.leave();
            clientRef.current?.removeAllListeners();
        } catch (e) {
            console.log('Leave skipped or already left');
        }
        clientRef.current = null;

        isJoiningOrJoined.current = false;
        hasBoundClientEvents.current = false;
        callStartTime.current = null;

        // Clear video elements
        if (myVideo.current) myVideo.current.innerHTML = '';
        if (userVideo.current) userVideo.current.innerHTML = '';

        setCallAccepted(false);
        setIsVideoCalling(false);
        setCurrentChannel(null);
        setIsMinimized(false);
        setCallDuration(0);
        setFilterMyVideo('');
        setFilterFriendVideo('');
        setIsMicrophone(true);
        setIsCameraOn(true);
        if (minimizedDurationInterval.current) {
            clearInterval(minimizedDurationInterval.current);
            minimizedDurationInterval.current = null;
        }
        // Stop hidden camera used for emotion detection
        try { stopCamera(); } catch (e) { /* Ignore camera stop errors */ }
    }, [currentChannel, endMinimizedCall]);

    // Handle leave call - called when user clicks end button
    const handleLeaveCall = useCallback(async () => {
        console.log('ChatHeader: handleLeaveCall - emitting to server and cleaning up');
        // Emit to server (server will broadcast to both users)
        socket.emit('leaveVideoCall', friendId);
        // Do local cleanup
        await cleanupVideoCall();
    }, [friendId, cleanupVideoCall]);

    useEffect(() => {
        socket.on('agora-incoming-video-call', ({ from, channelName, isAudio, callerName, callerProfilePic }) => {
            // Only handle video calls in ChatHeader, audio calls handled by AudioCall component
            if (!isAudio) {
                console.log('Incoming Agora video call from', from, 'channel:', channelName);
                console.log('Caller info:', { callerName, callerProfilePic });
                setIncomingCall({ from, channelName, name: callerName || 'Unknown Caller', profilePic: callerProfilePic });
                setIsVideoCalling(true);
                playCallingBeep();
            }
        });


        socket.on('agora-apply-video-filter', ({ filter }) => {

            if (filter !== '') {
                setFilterFriendVideo(filter);
            } else {
                setFilterFriendVideo('');
            }
        });

        socket.on('agora-call-accepted', ({ channelName, isAudio }) => {
            // Only handle video call acceptance
            if (!isAudio && isVideoCalling) { // caller-side only
                stopCallingBeep();
                startCall(channelName);
            }
        });

        socket.on('videoCallEnd', () => {
            console.log('ChatHeader: Received videoCallEnd event from server');
            // IMPORTANT: Only do local cleanup, do NOT call handleLeaveCall which would re-emit
            cleanupVideoCall();
        });

        callingBeepAudio?.current.setAttribute('src', config?.callingBeep);

        // Live voice: when friend starts/stops, we join/leave and play their audio
        const liveVoiceClientRef = { current: null };
        const ensureLeaveLiveVoice = async () => {
            try { await liveVoiceClientRef.current?.leave(); } catch (e) {
                // Ignore leave errors
            }
            try { liveVoiceClientRef.current?.removeAllListeners(); } catch (e) {
                // Ignore listener removal errors
            }
            liveVoiceClientRef.current = null;
        };

        socket.on('agora-live-voice-start', async ({ channelName }) => {
            try {
                // Create a new lightweight client for voice-only playback
                await ensureLeaveLiveVoice();
                const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
                liveVoiceClientRef.current = client;
                const { data } = await api.post('/agora/token', { channelName, uid: Math.floor(Math.random() * 1e6) });
                await client.join(data.appId, channelName, data.token, null);
                client.on('user-published', async (user, mediaType) => {
                    if (mediaType === 'audio') {
                        await client.subscribe(user, 'audio');
                        user.audioTrack?.play();
                    }
                });
                // Also subscribe existing remote users if already in channel
                for (const user of client.remoteUsers) {
                    if (user.hasAudio) {
                        await client.subscribe(user, 'audio');
                        user.audioTrack?.play();
                    }
                }
            } catch (e) {
                console.error('Live voice subscribe failed:', e);
            }
        });

        socket.on('agora-live-voice-stop', async () => {
            await ensureLeaveLiveVoice();
        });

        return () => {
            socket.off('agora-incoming-video-call');
            socket.off('agora-call-accepted');
            socket.off('videoCallEnd');
            socket.off('agora-apply-video-filter');
            socket.off('agora-live-voice-start');
            socket.off('agora-live-voice-stop');
        };
    }, [startCall, isVideoCalling, cleanupVideoCall]);

    // Call a friend using Agora
    const callFriend = useCallback(async (friendId) => {
        if (!friendId) return;
        const channelName = `${profileId}-${friendId}`;
        setCurrentChannel(channelName);
        console.log('Initiating Agora call to:', friendId, 'with channel:', channelName);

        // Start local video immediately when initiating call
        try {
            console.log('Starting local video for outgoing call');
            localTracks.current = await AgoraRTC.createMicrophoneAndCameraTracks();

            // Show local video immediately
            if (myVideo.current && localTracks.current[1]) {
                localTracks.current[1].play(myVideo.current);
                console.log('Local video started for outgoing call');
            }
        } catch (error) {
            console.error('Failed to start local video for outgoing call:', error);
        }

        socket.emit('agora-video-call', { to: friendId, channelName });
        playCallingBeep();
    }, [profileId]);

        const handleVideoCallBtn = useCallback(e => {
        const id = e.currentTarget.dataset.id;
        // setReceiverId(id); // Function not defined, commenting out
        setIncomingCall(null);
        setIsVideoCalling(true);
        callFriend(id);
    }, [callFriend]);

    const handleAudioCallBtn = useCallback(e => {
        const id = e.currentTarget.dataset.id;
        // setReceiverId(id); // Function not defined, commenting out
        setIncomingCall(null);
        setIsVideoCalling(false);

        // Dispatch custom event to AudioCall component
        const channelName = `${profileId}-${id}`;
        window.dispatchEvent(new CustomEvent('startAudioCall', {
            detail: {
                to: id,
                channelName,
                callerName: friendProfile.fullName || `${friendProfile.user?.firstName} ${friendProfile.user?.surname}` || 'Friend',
                callerProfilePic: friendProfile.profilePic
            }
        }));

        socket.emit('agora-audio-call', { to: id, channelName, isAudio: true });
    }, [profileId, friendProfile]);

    const minimizeVideoCall = useCallback(() => {
        if (!callAccepted || !currentChannel) return;

        const callId = `chatheader-video-${currentChannel}`;
        const callData = {
            id: callId,
            type: 'video',
            callerName: friendProfile?.fullName || `${friendProfile?.user?.firstName} ${friendProfile?.user?.surname}` || 'Unknown Caller',
            callerProfilePic: friendProfile?.profilePic,
            callerId: friendId,
            status: 'connected',
            duration: callDuration,
            isMuted: !isMicrophone,
            isCameraOn: isCameraOn,
            onRestore: () => {
                setIsMinimized(false);
                setIsVideoCalling(true);
            },
            onEnd: () => {
                handleLeaveCall();
            },
            onToggleMute: () => {
                handleMicrophoneClick();
            },
            onToggleCamera: () => {
                handleCameraToggle();
            }
        };

        minimizeCall(callData);
        setIsMinimized(true);
        setIsVideoCalling(false);
    }, [callAccepted, currentChannel, friendProfile, friendId, callDuration, isMicrophone, isCameraOn, minimizeCall, handleMicrophoneClick, handleCameraToggle]);

    const startVideo = useCallback(async () => {
        if (!cameraVideoRef.current) return;
        try {
            const emotionStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user', width: { ideal: 320 }, height: { ideal: 240 } },
                audio: false
            });
            const videoEl = cameraVideoRef.current;
            videoEl.srcObject = emotionStream;
            await new Promise(resolve => {
                const onLoaded = () => {
                    try { videoEl.play?.(); } catch (_) {
                        // Ignore play errors
                    }
                    videoEl.removeEventListener('loadedmetadata', onLoaded);
                    resolve();
                };
                if (videoEl.readyState >= 2) {
                    try { videoEl.play?.(); } catch (_) {
                        // Ignore play errors
                    }
                    resolve();
                } else {
                    videoEl.addEventListener('loadedmetadata', onLoaded);
                }
            });
        } catch (err) {
            console.error('Failed to start hidden camera for emotion', err);
        }
    }, []);

    const stopCamera = () => {
        if (!cameraVideoRef.current) return

        const stream = cameraVideoRef.current?.srcObject;
        stream?.getTracks().forEach(track => track.stop());
        cameraVideoRef.current.srcObject = null;
        if (emotionIntervalRef.current) {
            clearInterval(emotionIntervalRef.current);
            emotionIntervalRef.current = null;
        }
        try { mediaPipeCtlRef.current?.stop(); } catch (_) { }
        mediaPipeCtlRef.current = null;
        // Reset rolling majority buffers
        labelHistoryRef.current = [];
        lastMajorityLabelRef.current = null;
    };

    // Enhanced emotion detection state management
    const emotionHistoryRef = useRef([]);
    const baselineExpressionsRef = useRef({});
    const lastStableEmotionRef = useRef(null);
    const emotionStabilityCountRef = useRef(0);
    const detectionQualityRef = useRef(0);
    const consecutiveEmotionCountRef = useRef({});
    const lastEmotionTimestampRef = useRef(Date.now());

    const detectEmotions = () => {
        // Clear any existing interval before starting a new one
        if (emotionIntervalRef.current) {
            clearInterval(emotionIntervalRef.current);
            emotionIntervalRef.current = null;
        }
        
        // Optimized adaptive detection frequency
        let detectionInterval = 900; // Faster base interval
        let lastActivityTime = Date.now();
        let frameSkipCounter = 0;
        
        emotionIntervalRef.current = setInterval(async () => {
            // Guard check: stop detection if profileId or friendId become unavailable
            // Ensure both are valid strings with content
            if (!profileId || typeof profileId !== 'string' || profileId.length === 0 ||
                !friendId || typeof friendId !== 'string' || friendId.length === 0) {
                console.warn('⚠️ Stopping emotion detection - invalid IDs:', { 
                    profileId: profileId || 'missing', 
                    profileIdType: typeof profileId,
                    friendId: friendId || 'missing',
                    friendIdType: typeof friendId
                });
                if (emotionIntervalRef.current) {
                    clearInterval(emotionIntervalRef.current);
                    emotionIntervalRef.current = null;
                }
                return;
            }
            // Adaptive frame skipping for performance
            const timeSinceLastChange = Date.now() - lastEmotionTimestampRef.current;
            
            // Skip frames intelligently based on recent activity
            if (timeSinceLastChange > 10000) { // No change for 10 seconds
                frameSkipCounter++;
                if (frameSkipCounter % 2 !== 0) return; // Skip every other frame
            } else if (timeSinceLastChange > 5000) { // No change for 5 seconds
                frameSkipCounter++;
                if (frameSkipCounter % 3 === 0) return; // Skip every third frame
            } else {
                frameSkipCounter = 0; // Reset when active
            }
            if (cameraVideoRef?.current && cameraVideoRef.current.readyState >= 2) {
                try {
                    // old face-api detection removed; no-op
                } catch (error) {
                    console.error('Error in ChatHeader emotion detection:', error);
                }
            }
        }, detectionInterval); // Optimized detection frequency with intelligent frame skipping
    };

    const loadModels = useCallback(async () => {
        // Don't start detection if we don't have required IDs
        // Ensure both are valid strings with content
        if (!profileId || typeof profileId !== 'string' || profileId.length === 0 ||
            !friendId || typeof friendId !== 'string' || friendId.length === 0) {
            console.warn('⚠️ Not loading models - invalid IDs:', { 
                profileId: profileId || 'missing',
                profileIdType: typeof profileId,
                friendId: friendId || 'missing',
                friendIdType: typeof friendId
            });
            return;
        }
        
        const success = await loadFaceModels();
        if (success) {
            detectEmotions();
        }
    }, [profileId, friendId]);

    const handleBumpBtnClick = useCallback(() => {
        socket.emit('bump', { friendProfile: friendProfile._id, myProfile: profile._id });
    }, [friendProfile, profile]);

    useEffect(() => {
        const hasValidIds = profileId && typeof profileId === 'string' && profileId.length > 0 &&
                           friendId && typeof friendId === 'string' && friendId.length > 0;

        if (room && settings.isShareEmotion && hasValidIds) {
            (async () => {
                try {
                    console.log('✅ Starting MediaPipe emotion detection with profileId:', profileId, 'friendId:', friendId);
                    await startVideo();
                    if (cameraVideoRef.current) {
                        // Stop any previous controller
                        try { mediaPipeCtlRef.current?.stop(); } catch (_) {}
                        mediaPipeCtlRef.current = await startMediaPipeEmotionDetection(cameraVideoRef.current, ({ label, analysis, clarityScore }) => {
                            // Update rolling window
                            const now = Date.now();
                            labelHistoryRef.current.push({ t: now, label });
                            const cutoff = now - MAJORITY_WINDOW_MS;
                            while (labelHistoryRef.current.length && labelHistoryRef.current[0].t < cutoff) {
                                labelHistoryRef.current.shift();
                            }
                            // Compute majority in window
                            const counts = {};
                            for (const item of labelHistoryRef.current) {
                                counts[item.label] = (counts[item.label] || 0) + 1;
                            }
                            let majorityLabel = null;
                            let majorityCount = 0;
                            for (const k in counts) {
                                const c = counts[k];
                                if (c > majorityCount) { majorityCount = c; majorityLabel = k; }
                            }
                            if (!majorityLabel) return;
                            // Emit only if changed
                            if (majorityLabel !== lastMajorityLabelRef.current) {
                                lastMajorityLabelRef.current = majorityLabel;
                                const emoji = emotionEmojiMap[majorityLabel] || '😐';
                                setMyEmotion(`${emoji} ${majorityLabel}`);
                                if (profileId && friendId) {
                                    const windowSize = labelHistoryRef.current.length || 1;
                                    const confidenceApprox = Math.max(0, Math.min(1, majorityCount / windowSize));
                                    try {
                                        socket.emit('emotion_change', {
                                            profileId,
                                            emotion: `${emoji} ${majorityLabel}`,
                                            emotionText: majorityLabel,
                                            emoji,
                                            friendId,
                                            confidence: Math.round(confidenceApprox * 100) / 100,
                                            quality: Math.round((Math.max(0, Math.min(100, clarityScore || 0)) / 100) * 100) / 100
                                        });
                                    } catch (_) { }
                                }
                            }
                        });
                    }
                } catch (e) {
                    console.error('Failed to start MediaPipe emotion detection:', e);
                }
            })();
        } else {
            if (room && settings.isShareEmotion && !hasValidIds) {
                console.warn('⚠️ Emotion detection not started - invalid IDs:', {
                    profileId: profileId || 'missing',
                    profileIdType: typeof profileId,
                    friendId: friendId || 'missing',
                    friendIdType: typeof friendId
                });
            }
            stopCamera();
            
        }
        return () => {
            try { mediaPipeCtlRef.current?.stop(); } catch (_) {}
            mediaPipeCtlRef.current = null;
        };
    }, [room, settings.isShareEmotion, profileId, friendId, startVideo]);

    useEffect(() => { stopCamera(); }, [location]);

    // Cleanup on component unmount
    useEffect(() => {
        return () => {
            // Clear any running intervals on unmount
            if (remoteUserCheckInterval.current) {
                clearInterval(remoteUserCheckInterval.current);
                remoteUserCheckInterval.current = null;
            }
            if (emotionIntervalRef.current) {
                clearInterval(emotionIntervalRef.current);
                emotionIntervalRef.current = null;
            }
            try { stopCamera(); } catch (_) {
                // Ignore camera stop errors
            }
        };
    }, []);

    useEffect(() => {
        setFriendId(friendProfile._id);
        setIsLoaded(!!friendProfile._id);
        setFriendPP(friendProfile.profilePic);
        socket.emit('last_emotion', { friendId: friendProfile._id, profileId });
    }, [friendProfile, profileId]);

    useEffect(() => {
        if (isValidUrl(friendPP)) checkImgLoading(friendPP, () => { }); // Removed unused setIsPpLoaded
        else setFriendPP('');
    }, [friendPP]);

    useEffect(() => {
        if (myEmotion && friendId) {
            console.log('my emotion')
            // socket.emit('emotion_change', { profileId, emotion: myEmotion, friendId });
        }
    }, [myEmotion, friendId, profileId]);

    useEffect(() => {
        const handleEmotionChange = (data) => {
            console.log('Received emotion change:', data);
            // Handle the new emotion data format from server
            if (data && data.emotion) {
                setEmotion(data.emotion);
                console.log('em',data)
                // You can use the emotion data here for UI updates
                // For example, updating friend's emotion display
            }
        };
        
        socket.on('emotion_change', handleEmotionChange);
        
        return () => {
            socket.off('emotion_change', handleEmotionChange);
        };
    }, []);

    // const handleSwitchClick = useCallback(async () => {
    //     const videoTrack = localTracks.current.find(track => track.kind === 'video');
    //     if (videoTrack && callAccepted && clientRef.current) {
    //         try {
    //             // Unpublish current video track
    //             await clientRef.current.unpublish([videoTrack]);

    //             // Stop current video track
    //             videoTrack.close();

    //             // Create new video track with switched camera
    //             const newVideoTrack = await AgoraRTC.createCameraVideoTrack({
    //                 facingMode: isBackCamera ? "user" : "environment"
    //             });

    //             // Replace the track in the array
    //             const videoIndex = localTracks.current.findIndex(track => track.kind === 'video');
    //             if (videoIndex !== -1) {
    //                 localTracks.current[videoIndex] = newVideoTrack;
    //             }

    //             // Publish new track
    //             await clientRef.current.publish([newVideoTrack]);

    //             // Play new track in local video element
    //             if (myVideo.current) {
    //                 newVideoTrack.play(myVideo.current);
    //             }

    //             setIsBackCamera(prev => !prev);
    //         } catch (error) {
    //             console.error('Failed to switch camera:', error);
    //         }
    //     } else {
    //         setIsBackCamera(prev => !prev);
    //     }
    // }, [isBackCamera, callAccepted]);

    const toggleVideoFilter = useCallback(() => {

        const filters = ['video-vivid-filter', 'video-vivid-warm', 'video-vivid-cool', 'video-vivid-dramatic', ''];
        const currentIndex = filters.indexOf(filterMyVideo);
        const nextIndex = (currentIndex + 1) % filters.length;
        const newFilter = filters[nextIndex];
        setFilterMyVideo(newFilter);
        socket.emit('agora-filter-video', { to: friendId, filter: newFilter });
    }, [filterMyVideo, friendId]);

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

    const formatDuration = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

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
                            : <UserPP profilePic={`${friendPP}`} hasStory={false} profile={friendProfile._id} active={friendProfile.isActive}></UserPP>
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
                    <div 
                        onClick={handleBumpBtnClick} 
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleBumpBtnClick(); } }}
                        role='button'
                        tabIndex={0}
                        className='bump-button action-button' 
                        title='bump'
                    >
                        <i className="fas fa-record-vinyl"></i>
                    </div>
                    <div 
                        onClick={handleAudioCallBtn} 
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleAudioCallBtn(e); } }}
                        role='button'
                        tabIndex={0}
                        data-id={friendId} 
                        className='call-button action-button'
                    >
                        <i className="fas fa-phone-alt"></i>
                    </div>
                    <div 
                        onClick={handleVideoCallBtn} 
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleVideoCallBtn(e); } }}
                        role='button'
                        tabIndex={0}
                        data-id={friendId} 
                        className='video-call-button action-button'
                    >
                        <i className="fas fa-video"></i>
                    </div>
                    <div 
                        onClick={handleChatOptionClick.bind(this)} 
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleChatOptionClick(); } }}
                        role='button'
                        tabIndex={0}
                        className='info-button action-button'
                    >
                        <i className="fas fa-info-circle"></i>
                    </div>

                    {isChatOptionMenu && (
                        <div className="chat-option-menu" ref={chatOptionMenu} >
                            <ul>
                                <li 
                                    onClick={handleViewProfile.bind(this)} 
                                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleViewProfile(); } }}
                                    tabIndex={0}
                                >View Profile</li>
                                {
                                    profile?.blockedUsers.includes(friendId) ? 
                                        <li 
                                            onClick={handleUnBlockUser.bind(this)} 
                                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleUnBlockUser(); } }}
                                            tabIndex={0}
                                        >Unblock {friendProfile.user.firstName}</li> 
                                        : 
                                        <li 
                                            onClick={handleBlockUser.bind(this)} 
                                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleBlockUser(); } }}
                                            tabIndex={0}
                                        >Block {friendProfile.user.firstName}</li>
                                }

                                <li 
                                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); } }}
                                    tabIndex={0}
                                >Report {friendProfile.user.firstName}</li>
                            </ul>
                        </div>
                    )}
                </div>

                <ModalContainer
                    title="Video Call"
                    style={isFullscreen ? {} : { width: isMobile ? '95%' : '600px', top: '50%', height: 'auto' }}
                    isOpen={(isVideoCalling || callAccepted) && !isMinimized}
                    onRequestClose={closeVideoCall}
                    id="videoCallModal"
                    isFullscreen={isFullscreen}
                >
                    <div className={`${callAccepted ? 'call-accepted' : ''} ${isFullscreen ? 'fullscreen-content' : ''}`} style={{ padding: 0 }}>
                        {<h2 className='text-center vc-modal-heading'>
                            Video Call - {friendProfile && friendProfile.fullName}
                            {callAccepted ? ` • ${formatDuration(callDuration)}` : ''}
                        </h2>}
                        {!isFullscreen && (
                            <p className='fs-4 text-center'>
                                {!callAccepted && (
                                    incomingCall ? <>
                                        {(incomingCall.name || 'Someone')} is calling you
                                    </> : <>
                                        Calling {friendProfile && friendProfile.fullName}
                                    </>
                                )}
                            </p>
                        )}
                        <div className={`video-call-container ${isMobile ? 'mobile' : ''}`} style={{ 
                            width: '100%', 
                            height: '400px', 
                            position: 'relative',
                            overflow: 'hidden'
                        }}>
                            <div
                                ref={userVideo}
                                className={`receive-friends-video ${filterFriendVideo}`}
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    minHeight: '400px',
                                    display: callAccepted ? 'block' : 'none',
                                    background: '#000',
                                    border: filterFriendVideo ? '3px solid #29B1A9' : 'none', // Green border when filter is active
                                    objectFit: 'contain'
                                }}
                                data-video-type="friend-remote-video"
                            />
                            <div
                                ref={myVideo}
                                className={`receive-my-video ${filterMyVideo}`}
                                style={{
                                    width: '150px',
                                    height: '100px',
                                    position: 'absolute',
                                    bottom: '10px',
                                    right: '10px',
                                    background: '#222',
                                    display: (isVideoCalling || incomingCall) ? 'block' : 'none',
                                    borderRadius: '8px',
                                    zIndex: 10,
                                    border: '2px solid gray', // Match VideoCall border style
                                    objectFit: 'contain'
                                }}
                                data-video-type="my-local-video"
                            />
                        </div>
                        <div className='call-buttons' style={isMobile ? { display: 'flex', gap: '10px', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(32,32,32,0.6)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '10px 12px', marginTop: '12px' } : {}}>

                            <button onClick={handleLeaveCall.bind(this)} ref={callEndBtn} className='call-button-ends call-button bg-danger' style={mobileActionButtonStyle}>
                                <i className="fa fa-phone" style={{ color: 'white' }}></i>
                            </button>
                            {
                                !callAccepted && incomingCall && (
                                    <button onClick={() => answerCall(incomingCall)} className='call-button-receive call-button bg-success' style={mobileActionButtonStyle}>
                                        <i className="fa fa-phone-volume" style={{ color: 'white' }}></i>
                                    </button>
                                )
                            }
                            {
                                callAccepted && <>
                                    <button onClick={handleMicrophoneClick.bind(this)} className='call-button-microphone call-button' style={mobileActionButtonStyle}>
                                        {
                                            isMicrophone ? <i className="fa fa-microphone" style={{ color: 'white' }}></i> : <i className="fa fa-microphone-slash" style={{ color: 'white' }}></i>
                                        }
                                    </button>
                                    {(
                                        <button onClick={handleCameraToggle} className='call-button-camera call-button' style={mobileActionButtonStyle}>
                                            {isCameraOn ? <i className="fa fa-video" style={{ color: 'white' }} /> : <i className="fa fa-video-slash" style={{ color: 'white' }} />}
                                        </button>
                                    )}

                                    <button onClick={toggleVideoFilter} className={`call-button-filter call-button ${filterMyVideo ? 'active' : ''}`} title={filterMyVideo ? `Filter: ${filterMyVideo.replace('video-vivid-', '').replace('filter', 'vivid')}` : 'No filter'} style={mobileActionButtonStyle}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                                            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                                        </svg>
                                    </button>
                                    {!isMobile && (
                                        <>
                                            <button onClick={toggleFullscreen} className='call-button-fullscreen call-button'>
                                                {isFullscreen ? (
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="white" strokeWidth="2"
                                                        strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                                                        <path d="M8 3v3a2 2 0 0 1-2 2H3" />
                                                        <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
                                                        <path d="M3 16h3a2 2 0 0 1 2 2v3" />
                                                        <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
                                                    </svg>
                                                ) : (
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="white" strokeWidth="2"
                                                        strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                                                        <path d="M3 7V3a2 2 0 0 1 2-2h4" />
                                                        <path d="M17 3h4a2 2 0 0 1 2 2v4" />
                                                        <path d="M21 17v4a2 2 0 0 1-2 2h-4" />
                                                        <path d="M7 21H3a2 2 0 0 1-2-2v-4" />
                                                    </svg>
                                                )}
                                            </button>
                                            <button onClick={minimizeVideoCall} className='call-button-minimize call-button' title="Minimize">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="white" strokeWidth="2"
                                                    strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                                                    <path d="M6 9l6 6 6-6" />
                                                </svg>
                                            </button>
                                        </>
                                    )}


                                </>
                            }

                        </div>

                    </div>
                </ModalContainer >


            </div >
            {
                settings.isShareEmotion === true && (
                    <video style={{ display: 'none' }} ref={cameraVideoRef} autoPlay muted playsInline width="600" height="400" />
                )
            }

            <audio ref={callingBeepAudio} src='' loop>
                <track kind="captions" />
            </audio>

        </>
    );
}

export default ChatHeader;
