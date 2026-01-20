import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import socket from '../../common/socket';
import ModalContainer from '../modal/ModalContainer';
import AgoraRTC from 'agora-rtc-sdk-ng';
import { useSelector } from 'react-redux';
import useIsMobile from '../../utils/useIsMobile';
import ringtones from '../../config/ringtones.json';
import api from '../../api/api';
import { useCallMinimize } from '../../contexts/CallMinimizeContext';
import config from '../../config/config.json';
import audioPreloader from '../../utils/audioPreloader';
import { unlockAudio, playAudioWithWebAudio, initializeAudioUnlock } from '../../utils/audioUnlock';
const VideoCall = ({ myId }) => {
    const mySettings = useSelector(state => state.setting);
    const [isVideoCall, setIsVideoCall] = useState(false);
    const [callerName, setCallerName] = useState('');
    const [callerProfilePic, setCallerProfilePic] = useState('');
    const [receivingCall, setReceivingCall] = useState(false);
    const [caller, setCaller] = useState('');
    const [callAccepted, setCallAccepted] = useState(false);
    const [isMicrophone, setIsMicrophone] = useState(true);
    const [isCameraOn, setIsCameraOn] = useState(true);
    const [isBackCamera, setIsBackCamera] = useState(false);
    const [hasVideoInput, setHasVideoInput] = useState(true);
    const [modalHeight] = useState('auto');
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [filterFriendVideo, setFilterFriendVideo] = useState(false);
    const [filterMyVideo, setFilterMyVideo] = useState(false);
    const [currentChannel, setCurrentChannel] = useState(null);
    const [incomingCall, setIncomingCall] = useState(null);
    const [isMinimized, setIsMinimized] = useState(false);
    const [callDuration, setCallDuration] = useState(0);
    const [outgoingCallStatus, setOutgoingCallStatus] = useState('');
    const callStartTime = useRef(null);

    const myVideo = useRef();
    const userVideo = useRef();
    const callEndBtn = useRef();
    const ringtoneAudio = useRef();

    // Keep minimized bar duration in sync while minimized
    const minimizedDurationInterval = useRef(null);

    // Agora RTC refs (fresh client per call)
    const clientRef = useRef(null);
    const localTracks = useRef([]);
    const isJoiningOrJoined = useRef(false);
    const hasBoundClientEvents = useRef(false);
    const localContainer = useRef();
    const remoteContainer = useRef();
    const remoteUserCheckInterval = useRef(null);
    const isCleaningUpRef = useRef(false); // Track if cleanup is in progress

    // Stable numeric UID for Agora (avoids string-UID warning)
    const numericUid = useMemo(() => {
        if (!myId) return 0;
        let hash = 0;
        for (let i = 0; i < myId.length; i++) {
            hash = ((hash << 5) - hash) + myId.charCodeAt(i);
            hash |= 0;
        }
        return Math.abs(hash);
    }, [myId]);

    const isMobile = useIsMobile();
    const { minimizeCall, restoreCall, endMinimizedCall, getMinimizedCall, updateMinimizedCall } = useCallMinimize();

    const stopRingtone = () => {
        if (ringtoneAudio?.current) {
            const audio = ringtoneAudio.current;
            audio.pause();
            audio.currentTime = 0; // Reset to beginning
        }
    };

    const playRingtone = async () => {
        // First, try to unlock audio if not already unlocked
        await unlockAudio();

        setTimeout(async () => {
            if (ringtoneAudio?.current) {
                const audio = ringtoneAudio.current;

                // Check if audio has a valid source
                if (!audio.src || audio.src === window.location.href) {
                    console.warn('Ringtone audio has no valid source');
                    return;
                }

                // Ensure audio is not muted and volume is set
                audio.muted = false;
                audio.volume = 1.0;

                // Wait for audio to be ready if not already loaded
                if (audio.readyState < 2) {
                    const handleCanPlay = async () => {
                        try {
                            // Try Web Audio API first for better background playback
                            await playAudioWithWebAudio(audio);
                            console.log('Ringtone playing successfully');
                        } catch (error) {
                            console.warn('Failed to play ringtone:', error);
                            // Fallback: try regular play
                            try {
                                await audio.play();
                                console.log('Ringtone playing with fallback method');
                            } catch (fallbackError) {
                                console.warn('Fallback play also failed:', fallbackError);
                                // If autoplay is blocked, try again when tab becomes visible
                                if (fallbackError.name === 'NotAllowedError' || fallbackError.name === 'NotSupportedError') {
                                    const handleVisibilityChange = () => {
                                        if (document.visibilityState === 'visible' && receivingCall && incomingCall) {
                                            playAudioWithWebAudio(audio).catch(e => console.warn('Retry play failed:', e));
                                            document.removeEventListener('visibilitychange', handleVisibilityChange);
                                        }
                                    };
                                    document.addEventListener('visibilitychange', handleVisibilityChange);
                                }
                            }
                        }
                        audio.removeEventListener('canplaythrough', handleCanPlay);
                    };
                    audio.addEventListener('canplaythrough', handleCanPlay);

                    // Fallback timeout
                    setTimeout(() => {
                        audio.removeEventListener('canplaythrough', handleCanPlay);
                    }, 3000);
                } else {
                    try {
                        // Try Web Audio API first for better background playback
                        await playAudioWithWebAudio(audio);
                        console.log('Ringtone playing successfully');
                    } catch (error) {
                        console.warn('Failed to play ringtone:', error);
                        // Fallback: try regular play
                        try {
                            await audio.play();
                            console.log('Ringtone playing with fallback method');
                        } catch (fallbackError) {
                            console.warn('Fallback play also failed:', fallbackError);
                            // If autoplay is blocked, try again when tab becomes visible
                            if (fallbackError.name === 'NotAllowedError' || fallbackError.name === 'NotSupportedError') {
                                const handleVisibilityChange = () => {
                                    if (document.visibilityState === 'visible' && receivingCall && incomingCall) {
                                        playAudioWithWebAudio(audio).catch(e => console.warn('Retry play failed:', e));
                                        document.removeEventListener('visibilitychange', handleVisibilityChange);
                                    }
                                };
                                document.addEventListener('visibilitychange', handleVisibilityChange);
                            }
                        }
                    }
                }
            } else {
                // Retry after a short delay if audio element not yet mounted
                setTimeout(async () => {
                    if (ringtoneAudio?.current) {
                        await unlockAudio();
                        try {
                            await playAudioWithWebAudio(ringtoneAudio.current);
                        } catch (error) {
                            ringtoneAudio.current.play().catch(e => console.warn('Failed to play ringtone after retry:', e));
                        }
                    }
                }, 300);
            }
        }, 500);
    };

    const cleanupVideoCall = useCallback(async () => {
        // Prevent multiple simultaneous cleanups
        if (isCleaningUpRef.current) {
            console.log('Cleanup already in progress, skipping');
            return;
        }
        isCleaningUpRef.current = true;

        stopRingtone();

        // Clear any running intervals
        if (remoteUserCheckInterval.current) {
            clearInterval(remoteUserCheckInterval.current);
            remoteUserCheckInterval.current = null;
        }

        // End minimized call if exists
        if (currentChannel) {
            const callId = `video-${currentChannel}`;
            endMinimizedCall(callId);
        }

        // Close local tracks
        localTracks.current.forEach((track) => track.close());
        localTracks.current = [];

        // Unpublish and leave Agora channel if connected, then dispose client
        try {
            if (clientRef.current && localTracks.current.length > 0) {
                await clientRef.current.unpublish(localTracks.current);
            }
        } catch (e) { }
        try {
            await clientRef.current?.leave();
            clientRef.current?.removeAllListeners();
        } catch (error) {
            console.log('Not connected to channel or already left');
        }
        clientRef.current = null;

        isJoiningOrJoined.current = false;
        hasBoundClientEvents.current = false;
        callStartTime.current = null;

        // Clear video elements
        if (myVideo.current) myVideo.current.innerHTML = '';
        if (userVideo.current) userVideo.current.innerHTML = '';

        setCallAccepted(false);
        setIsVideoCall(false);
        setCurrentChannel(null);
        setReceivingCall(false);
        setIncomingCall(null);
        setCaller('');
        setCallerName('');
        setCallerProfilePic('');
        setFilterMyVideo('');
        setFilterFriendVideo('');
        setIsMicrophone(true);
        setIsCameraOn(true);
        setIsBackCamera(false);
        setIsMinimized(false);
        setCallDuration(0);
        setOutgoingCallStatus('');
        if (minimizedDurationInterval.current) {
            clearInterval(minimizedDurationInterval.current);
            minimizedDurationInterval.current = null;
        }
        
        // Reset cleanup flag after a short delay
        setTimeout(() => {
            isCleaningUpRef.current = false;
        }, 1000);
    }, [currentChannel, endMinimizedCall]);

    const endCall = useCallback(async (isCancelled = false) => {
        // Prevent calling endCall multiple times
        if (isCleaningUpRef.current) {
            console.log('Already cleaning up, skipping endCall');
            return;
        }

        stopRingtone();
        const friendIdToNotify = incomingCall?.from || caller;
        const channelName = currentChannel;

        // If no call is active, just cleanup
        if (!isVideoCall && !callAccepted && !receivingCall) {
            await cleanupVideoCall();
            return;
        }

        if (!isCancelled) {
            // Normal call end - emit end event if we have valid data
            if (friendIdToNotify && channelName && callAccepted && friendIdToNotify !== myId) {
                socket.emit('video-call-end', { to: friendIdToNotify, channelName });
                console.log('VideoCall: Emitting video-call-end to friend:', friendIdToNotify);
            }
            await cleanupVideoCall();
            return;
        }

        // Call was cancelled/rejected - only emit if we have valid data and haven't accepted
        if (!callAccepted && friendIdToNotify && channelName && friendIdToNotify !== myId) {
            socket.emit('video-call-reject', { to: friendIdToNotify, friendId: myId, channelName });
            console.log('VideoCall: Emitting video-call-reject to friend:', friendIdToNotify);
        }

        await cleanupVideoCall();
    }, [incomingCall, caller, cleanupVideoCall, callAccepted, currentChannel, myId, isVideoCall, receivingCall]);


    const closeVideoCall = useCallback(() => {
        console.log('VideoCall: Modal close requested');
        endCall();
    }, [endCall]);

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
            const callId = `video-${currentChannel}`;
            minimizedDurationInterval.current = setInterval(() => {
                const elapsed = Math.floor((Date.now() - callStartTime.current) / 1000);
                try { updateMinimizedCall(callId, { duration: elapsed }); } catch (e) { }
            }, 1000);
        }
        return () => {
            if (minimizedDurationInterval.current) {
                clearInterval(minimizedDurationInterval.current);
                minimizedDurationInterval.current = null;
            }
        };
    }, [callAccepted, isMinimized, currentChannel, updateMinimizedCall]);

    // Get Agora token
    const getToken = async (channelName) => {
        const { data } = await api.post("/agora/token", { channelName, uid: numericUid });
        return data; // { appId, token }
    };

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

            const { appId, token } = await getToken(channelName);
            console.log('Got Agora token for channel:', channelName);

            // Ensure previous client is disposed
            if (clientRef.current) {
                try { await clientRef.current.leave(); } catch (e) { }
                try { clientRef.current.removeAllListeners(); } catch (e) { }
                clientRef.current = null;
            }

            // Create new client and join
            clientRef.current = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
            const client = clientRef.current;
            await client.join(appId, channelName, token, numericUid);
            console.log('Joined Agora channel successfully');

            // Immediately check for existing users after joining
            setTimeout(() => {
                const remoteUsers = client.remoteUsers;
                console.log('Immediate check - Remote users in channel:', remoteUsers.length);
                remoteUsers.forEach(user => {
                    console.log('Remote user details:', { uid: user.uid, hasVideo: user.hasVideo, hasAudio: user.hasAudio });
                });
            }, 500);

            // Signal any hidden emotion camera in ChatHeader to stop before grabbing camera
            try { window.dispatchEvent(new Event('stopEmotionCamera')); } catch (e) { }

            // Create local audio/video tracks if they don't exist
            if (!localTracks.current || localTracks.current.length === 0) {
                try {
                    localTracks.current = await AgoraRTC.createMicrophoneAndCameraTracks();
                } catch (trackErr) {
                    console.error('createMicrophoneAndCameraTracks failed, falling back to mic only:', trackErr);
                    // Fallback to microphone-only to keep the call connected
                    localTracks.current = [await AgoraRTC.createMicrophoneAudioTrack()];
                }
                console.log('Created local tracks');

                // Play local video in myVideo ref if exists
                if (myVideo.current && localTracks.current[1]) {
                    localTracks.current[1].play(myVideo.current);
                    console.log('Playing local video');
                }
            } else {
                console.log('Using existing local tracks');
            }

            await client.publish(localTracks.current);
            console.log('Published local tracks');

            // Bind client events only once
            if (!hasBoundClientEvents.current) {
                hasBoundClientEvents.current = true;
                client.on("user-published", async (user, mediaType) => {
                    console.log('Remote user published:', user.uid, mediaType);
                    try {
                        await client.subscribe(user, mediaType);
                        console.log('Successfully subscribed to', user.uid, mediaType);

                        if (mediaType === "video") {
                            if (userVideo.current && user.videoTrack) {
                                // Clear any existing content first
                                userVideo.current.innerHTML = '';
                                user.videoTrack.play(userVideo.current);
                                console.log('Playing remote video from user:', user.uid);
                            } else {
                                console.warn('Cannot play remote video - missing userVideo ref or videoTrack');
                            }
                        }

                        if (mediaType === "audio") {
                            if (user.audioTrack) {
                                user.audioTrack.play();
                                console.log('Playing remote audio from user:', user.uid);
                            } else {
                                console.warn('Cannot play remote audio - missing audioTrack');
                            }
                        }
                    } catch (error) {
                        console.error('Error subscribing to user:', user.uid, mediaType, error);
                    }
                });

                client.on("user-unpublished", (user) => {
                    console.log('Remote user unpublished:', user.uid);
                    if (userVideo.current) {
                        userVideo.current.innerHTML = '';
                    }
                });

                // End locally when remote user leaves the channel
                client.on("user-left", async (user) => {
                    console.log('Remote user left the channel:', user?.uid);
                    try {
                        await cleanupVideoCall();
                    } catch (e) {
                        console.warn('Cleanup after remote user-left failed:', e);
                    }
                });
            }

            // Check for existing remote users who may have already published before we joined
            setTimeout(async () => {
                try {
                    const remoteUsers = client.remoteUsers;
                    console.log('Checking for existing remote users:', remoteUsers.length);

                    for (const user of remoteUsers) {
                        console.log('Found existing remote user:', user.uid, 'hasVideo:', user.hasVideo, 'hasAudio:', user.hasAudio);

                        // Subscribe to video if available
                        if (user.hasVideo && !user.videoTrack) {
                            console.log('Subscribing to existing user video:', user.uid);
                            await client.subscribe(user, "video");
                            if (userVideo.current && user.videoTrack) {
                                user.videoTrack.play(userVideo.current);
                                console.log('Playing existing remote user video');
                            }
                        } else if (user.hasVideo && user.videoTrack && userVideo.current) {
                            // Video track already exists, just play it
                            user.videoTrack.play(userVideo.current);
                            console.log('Playing already subscribed remote video');
                        }

                        // Subscribe to audio if available
                        if (user.hasAudio && !user.audioTrack) {
                            console.log('Subscribing to existing user audio:', user.uid);
                            await client.subscribe(user, "audio");
                            if (user.audioTrack) {
                                user.audioTrack.play();
                                console.log('Playing existing remote user audio');
                            }
                        } else if (user.hasAudio && user.audioTrack) {
                            // Audio track already exists, just play it
                            user.audioTrack.play();
                            console.log('Playing already subscribed remote audio');
                        }
                    }
                } catch (error) {
                    console.error('Error checking for existing remote users:', error);
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
                        console.log(`Periodic check ${checkCount}: Found ${remoteUsers.length} remote users`);

                        for (const user of remoteUsers) {
                            // Check if we have video but it's not playing
                            if (user.hasVideo && user.videoTrack && userVideo.current) {
                                const videoElement = userVideo.current.querySelector('video');
                                if (!videoElement || videoElement.paused || videoElement.readyState === 0) {
                                    console.log(`Periodic check ${checkCount}: Re-attempting to play remote video for user ${user.uid}`);
                                    userVideo.current.innerHTML = '';
                                    user.videoTrack.play(userVideo.current);
                                }
                            }
                        }
                    }

                    if (checkCount >= maxChecks) {
                        clearInterval(remoteUserCheckInterval.current);
                        remoteUserCheckInterval.current = null;
                        console.log('Stopped periodic remote user checks');
                    }
                } catch (error) {
                    console.error(`Error in periodic check ${checkCount}:`, error);
                }
            }, 2000); // Check every 2 seconds
        } catch (error) {
            console.error('Failed to start call:', error);
            alert('Failed to start call. Please try again.');
            setIsVideoCall(false);
            setCallAccepted(false);
            isJoiningOrJoined.current = false;
        }
    }, [myId, getToken]);

    useEffect(() => {
        if (ringtoneAudio?.current && receivingCall && incomingCall) {
            // Use user's ringtone preference or fallback to default
            const ringtoneId = mySettings.ringtone || null;

            // Get preloaded ringtone audio
            const preloadedAudio = audioPreloader.getRingtone(ringtoneId);
            if (preloadedAudio) {
                const audio = ringtoneAudio.current;
                const toneSrc = preloadedAudio.src;

                // Only load if source hasn't been set yet
                if (!audio.src || audio.src !== toneSrc) {
                    audio.setAttribute('src', toneSrc);
                    audio.load(); // Ensure the audio is loaded

                    // Handle loading errors
                    const handleError = () => {
                        console.error('Failed to load preloaded ringtone:', toneSrc);
                    };

                    // Handle successful load
                    const handleLoadStart = () => {
                        console.log('Loading preloaded ringtone:', toneSrc);
                    };

                    const handleCanPlay = () => {
                        console.log('Preloaded ringtone ready');
                        audio.removeEventListener('canplaythrough', handleCanPlay);
                        audio.removeEventListener('error', handleError);
                        audio.removeEventListener('loadstart', handleLoadStart);
                    };

                    audio.addEventListener('error', handleError);
                    audio.addEventListener('loadstart', handleLoadStart);
                    audio.addEventListener('canplaythrough', handleCanPlay);
                }
            } else {
                // Fallback to legacy method
                const ringtone = ringtoneId
                    ? ringtones.find(r => r.id === ringtoneId)
                    : null;
                const toneSrc = ringtone?.src || config?.callingBeep || '';

                if (toneSrc) {
                    const audio = ringtoneAudio.current;
                    if (!audio.src || audio.src !== toneSrc) {
                        audio.setAttribute('src', toneSrc);
                        audio.load();

                        const handleError = () => {
                            console.error('Failed to load ringtone:', toneSrc);
                        };

                        const handleLoadStart = () => {
                            console.log('Loading ringtone:', toneSrc);
                        };

                        const handleCanPlay = () => {
                            console.log('Ringtone loaded successfully');
                            audio.removeEventListener('canplaythrough', handleCanPlay);
                            audio.removeEventListener('error', handleError);
                            audio.removeEventListener('loadstart', handleLoadStart);
                        };

                        audio.addEventListener('error', handleError);
                        audio.addEventListener('loadstart', handleLoadStart);
                        audio.addEventListener('canplaythrough', handleCanPlay);
                    }
                }
            }
        }
    }, [mySettings, receivingCall, incomingCall]);

    useEffect(() => {
        // Listen for video calls initiated by this user (outgoing calls from sticky chat box)
        const handleOutgoingVideoCall = async (event) => {
            // Clean up any previous call state first
            if (isCleaningUpRef.current || isVideoCall || currentChannel) {
                console.log('VideoCall - Cleaning up previous call before starting new one');
                await cleanupVideoCall();
                // Wait a bit for cleanup to complete
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            const { to, channelName, callerName, callerProfilePic } = event.detail;
            console.log('VideoCall - Starting outgoing video call to', to, 'channel:', channelName);
            console.log('VideoCall - Friend info:', { callerName, callerProfilePic });
            setIsVideoCall(true);
            setReceivingCall(false);
            setCaller(to);
            setCallerName(callerName || 'Friend');
            setCallerProfilePic(callerProfilePic || config?.defaultProfile);
            setCurrentChannel(channelName);
            setIncomingCall({ from: myId, to, channelName, name: callerName || 'Friend', profilePic: callerProfilePic });
            setOutgoingCallStatus('Calling...');
            console.log('VideoCall - Outgoing call modal should now be visible');

            // Start local video immediately when initiating call
            try {
                console.log('VideoCall - Starting local video for outgoing call');
                localTracks.current = await AgoraRTC.createMicrophoneAndCameraTracks();

                // Show local video immediately
                if (myVideo.current && localTracks.current[1]) {
                    localTracks.current[1].play(myVideo.current);
                    console.log('VideoCall - Local video started for outgoing call');
                }
            } catch (error) {
                console.error('VideoCall - Failed to start local video for outgoing call:', error);
            }
        };

        window.addEventListener('startVideoCall', handleOutgoingVideoCall);

        socket.on('incoming-video-call', async ({ from, channelName, isAudio, callerName, callerProfilePic }) => {
            socket.emit('update-call-status', { to: from, status: "Ringing..." });

            // Only handle video calls, ignore audio calls
            if (!isAudio) {
                console.log('Incoming Agora video call from', from, 'channel:', channelName);
                console.log('Caller info:', { callerName, callerProfilePic });
                setIsVideoCall(true);
                setReceivingCall(true);
                setCaller(from);
                setIncomingCall({ from, channelName, name: callerName || 'Unknown Caller', profilePic: callerProfilePic });
                setCallerName(callerName || 'Unknown Caller');
                setCallerProfilePic(callerProfilePic || config?.defaultProfile);
                setCurrentChannel(channelName);

                // Start local video immediately when receiving call
                try {
                    console.log('Starting local video for incoming call preview');
                    localTracks.current = await AgoraRTC.createMicrophoneAndCameraTracks();

                    // Show local video immediately
                    if (myVideo.current && localTracks.current[1]) {
                        localTracks.current[1].play(myVideo.current);
                        console.log('Local video preview started for incoming call');
                    }
                } catch (error) {
                    console.error('Failed to start local video preview:', error);
                }

                playRingtone();
            }
        });

        socket.on('call-accepted', ({ channelName, isAudio }) => {
            // Only handle video call acceptance
            if (!isAudio) {
                console.log('Agora video call accepted, joining channel:', channelName);
                stopRingtone();
                setOutgoingCallStatus('');
                startCall(channelName);
            }
        });

        // Outgoing call status updates from callee
        const handleUpdatedCallStatus = ({ from, status }) => {
            // Only update if this status is for the current friend and we're the caller waiting
            if (!callAccepted && !receivingCall && caller && from === caller) {
                setOutgoingCallStatus(status || '');
            }
        };
        socket.on('updated-call-status', handleUpdatedCallStatus);

        socket.on('video-call-ended', async () => {
            console.log('VideoCall: Received video-call-ended event from remote user');
            // IMPORTANT: Do local cleanup ONLY. Do NOT re-emit end to avoid loops.
            stopRingtone();
            setOutgoingCallStatus('');
            endCall();
        });
        socket.on('video-call-cancelled', async () => {
            console.log('VideoCall: Received video-call-cancelled event from remote user');
            // IMPORTANT: Do local cleanup ONLY. Do NOT re-emit end to avoid loops.
            stopRingtone();
            setOutgoingCallStatus('');
            endCall(true);
        });
        socket.on('video-call-rejected', async () => {
            console.log('VideoCall: Received video-call-rejected event from remote user');
            stopRingtone();
            setOutgoingCallStatus('');
            endCall(true);
        });


        socket.on('apply-video-filter', ({ filter }) => {
            if (filter !== '') {
                setFilterFriendVideo(filter);
            } else {
                setFilterFriendVideo('');
            }
        });

        return () => {
            socket.off('incoming-video-call');
            socket.off('call-accepted');
            socket.off('video-call-ended');
            socket.off('video-call-cancelled');
            socket.off('video-call-rejected');
            socket.off('apply-video-filter');
            socket.off('updated-call-status', handleUpdatedCallStatus);
            window.removeEventListener('startVideoCall', handleOutgoingVideoCall);
            stopRingtone(); // Stop ringtone on cleanup
        };
    }, [startCall, cleanupVideoCall, endCall, myId, callAccepted, receivingCall, caller]);

    // Cleanup on component unmount
    useEffect(() => {
        return () => {
            stopRingtone();
        };
    }, []);

    // Initialize audio unlock on component mount
    useEffect(() => {
        initializeAudioUnlock();
    }, []);

    // Check for video input devices
    useEffect(() => {
        const checkVideoDevices = async () => {
            try {
                const devices = await navigator.mediaDevices.enumerateDevices();
                const videoDevices = devices.filter(d => d.kind === 'videoinput');
                setHasVideoInput(videoDevices.length > 0);
            } catch (err) {
                console.error('Error checking video devices:', err);
                setHasVideoInput(false);
            }
        };
        checkVideoDevices();
    }, []);

    const answerCall = useCallback(async () => {
        stopRingtone();
        if (!incomingCall) return;

        console.log('Answering Agora call');

        // Local video should already be showing from when call was received
        // Just proceed to join the channel
        socket.emit('answer-call', { to: incomingCall.from, channelName: incomingCall.channelName });
        await startCall(incomingCall.channelName);
    }, [incomingCall, startCall]);

    const handleMicrophoneClick = useCallback(async () => {
        // Find the audio track specifically using 'kind' property
        const audioTrack = localTracks.current.find(track => track.kind === 'audio');
        if (audioTrack) {
            console.log('VideoCall - Toggling microphone. Current state:', isMicrophone, 'New state:', !isMicrophone);
            console.log('VideoCall - Audio track found:', audioTrack);
            console.log('VideoCall - Audio track kind:', audioTrack.kind);
            await audioTrack.setEnabled(!isMicrophone);
            console.log('VideoCall - Audio track enabled state after toggle:', audioTrack.enabled);
        } else {
            console.log('VideoCall - No audio track found in tracks:', localTracks.current);
            // Fallback to index 0 (should be audio according to Agora docs)
            if (localTracks.current[0]) {
                console.log('VideoCall - Using fallback - index 0 track:', localTracks.current[0]);
                await localTracks.current[0].setEnabled(!isMicrophone);
            }
        }
        setIsMicrophone(prev => !prev);
    }, [isMicrophone]);

    const handleCameraToggle = useCallback(async () => {
        // Find the video track specifically using 'kind' property
        const videoTrack = localTracks.current.find(track => track.kind === 'video');
        if (videoTrack) {
            console.log('VideoCall - Toggling camera. Current state:', isCameraOn, 'New state:', !isCameraOn);
            console.log('VideoCall - Video track found:', videoTrack);
            console.log('VideoCall - Video track kind:', videoTrack.kind);
            await videoTrack.setEnabled(!isCameraOn);
            console.log('VideoCall - Video track enabled state after toggle:', videoTrack.enabled);
        } else {
            console.log('VideoCall - No video track found in tracks:', localTracks.current);
            // Fallback to index 1 (should be video according to Agora docs)
            if (localTracks.current[1]) {
                console.log('VideoCall - Using fallback - index 1 track:', localTracks.current[1]);
                await localTracks.current[1].setEnabled(!isCameraOn);
            }
        }
        setIsCameraOn(prev => !prev);
    }, [isCameraOn]);

    const minimizeVideoCall = useCallback(() => {
        if (!callAccepted || !currentChannel) return;

        const callId = `video-${currentChannel}`;
        const callData = {
            id: callId,
            type: 'video',
            callerName: callerName || 'Unknown Caller',
            callerProfilePic: callerProfilePic,
            callerId: caller,
            status: 'connected',
            duration: callDuration,
            isMuted: !isMicrophone,
            isCameraOn: isCameraOn,
            onRestore: () => {
                setIsMinimized(false);
                setIsVideoCall(true);
            },
            onEnd: () => {
                endCall();
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
        setIsVideoCall(false);
    }, [callAccepted, currentChannel, callerName, callerProfilePic, caller, callDuration, isMicrophone, isCameraOn, minimizeCall, handleMicrophoneClick, handleCameraToggle]);

    const restoreVideoCall = useCallback(() => {
        const callId = `video-${currentChannel}`;
        restoreCall(callId);
        setIsMinimized(false);
        setIsVideoCall(true);
    }, [currentChannel, restoreCall]);

    const handleSwitchClick = useCallback(async () => {
        const videoTrack = localTracks.current.find(track => track.kind === 'video');
        if (videoTrack && callAccepted && clientRef.current) {
            try {
                // Unpublish current video track
                await clientRef.current.unpublish([videoTrack]);

                // Stop current video track
                videoTrack.close();

                // Create new video track with switched camera
                const newVideoTrack = await AgoraRTC.createCameraVideoTrack({
                    facingMode: isBackCamera ? "user" : "environment"
                });

                // Replace the track in the array
                const videoIndex = localTracks.current.findIndex(track => track.kind === 'video');
                if (videoIndex !== -1) {
                    localTracks.current[videoIndex] = newVideoTrack;
                }

                // Publish new track
                await clientRef.current.publish([newVideoTrack]);

                // Play new track in local video element
                if (myVideo.current) {
                    newVideoTrack.play(myVideo.current);
                }

                setIsBackCamera(prev => !prev);
            } catch (error) {
                console.error('Failed to switch camera:', error);
            }
        } else {
            setIsBackCamera(prev => !prev);
        }
    }, [isBackCamera, callAccepted]);

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

    const toggleVideoFilter = useCallback(() => {

        if (incomingCall?.from) {
            const filters = ['video-vivid-filter', 'video-vivid-warm', 'video-vivid-cool', 'video-vivid-dramatic', ''];
            const currentIndex = filters.indexOf(filterMyVideo);
            const nextIndex = (currentIndex + 1) % filters.length;
            const newFilter = filters[nextIndex];
            setFilterMyVideo(newFilter);
            socket.emit('filter-video', { to: incomingCall.from, filter: newFilter });

        }
    }, [filterMyVideo, incomingCall]);

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

    return (
        <div>
            <ModalContainer
                title="Video Call"
                style={isFullscreen ? {} : { width: isMobile ? '95%' : '600px', top: '50%', height: modalHeight }}
                isOpen={isVideoCall && !isMinimized}
                onRequestClose={closeVideoCall}
                id="videoCallModal"
                isFullscreen={isFullscreen}
            >
                <div className={`${callAccepted ? 'call-accepted' : ''} ${isFullscreen ? 'fullscreen-content' : ''}`} style={{ padding: 0 }}>
                    <h2 className='text-center vc-modal-heading'>
                        Video Call - {callerName}
                        {callAccepted ? ` • ${formatDuration(callDuration)}` : ''}
                    </h2>
                    {!isFullscreen && (
                        <p className='fs-4 text-center'>
                            {receivingCall && !callAccepted && `${callerName} Calling you`}
                            {!receivingCall && !callAccepted && `Calling ${callerName}${outgoingCallStatus ? ` • ${outgoingCallStatus}` : '...'}`}
                        </p>
                    )}

                    {/* Caller Profile Section - shown when receiving call but not accepted yet */}
                    {/* {receivingCall && !callAccepted && (
                        <div style={{ 
                            display: 'flex', 
                            flexDirection: 'column', 
                            alignItems: 'center', 
                            marginBottom: '20px',
                            padding: '20px'
                        }}>
                            <div style={{
                                width: '120px',
                                height: '120px',
                                borderRadius: '50%',
                                overflow: 'hidden',
                                marginBottom: '15px',
                                border: '3px solid #29B1A9'
                            }}>
                                {callerProfilePic ? (
                                    <img 
                                        src={callerProfilePic} 
                                        alt={callerName}
                                        style={{
                                            width: '100%',
                                            height: '100%',
                                            objectFit: 'cover'
                                        }}
                                        onError={(e) => {
                                            e.target.src = config?.defaultProfile;
                                        }}
                                    />
                                ) : (
                                    <div style={{
                                        width: '100%',
                                        height: '100%',
                                        backgroundColor: '#666',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: 'white',
                                        fontSize: '48px'
                                    }}>
                                        <i className="fas fa-user"></i>
                                    </div>
                                )}
                            </div>
                            <h3 style={{ margin: '0', color: 'white', textAlign: 'center' }}>{callerName}</h3>
                            <p style={{ margin: '5px 0 0 0', color: '#ccc', textAlign: 'center' }}>Incoming video call...</p>
                        </div>
                    )} */}

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
                                display: (isVideoCall || receivingCall) ? 'block' : 'none',
                                borderRadius: '8px',
                                zIndex: 10,
                                border: '2px solid gray', // Red border to identify local video
                                objectFit: 'contain'
                            }}
                            data-video-type="my-local-video"
                        />
                    </div>

                    <div className='call-buttons' style={isMobile ? { display: 'flex', gap: '10px', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(32,32,32,0.6)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '10px 12px', marginTop: '12px' } : {}}>
                        <button onClick={endCall} ref={callEndBtn} className='call-button-ends call-button bg-danger' style={mobileActionButtonStyle}>
                            <i className="fa fa-phone" style={{ color: 'white' }}></i>
                        </button>

                        {callAccepted && (
                            <>
                                <button onClick={handleMicrophoneClick} className='call-button-microphone call-button' style={mobileActionButtonStyle}>
                                    {isMicrophone ? <i className="fa fa-microphone" style={{ color: 'white' }} /> : <i className="fa fa-microphone-slash" style={{ color: 'white' }} />}
                                </button>
                                {hasVideoInput && (
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
                        )}

                        {!callAccepted && receivingCall && (
                            <>
                                <button onClick={answerCall} className='call-button-receive call-button bg-success' style={mobileActionButtonStyle}>
                                    <i className="fa fa-phone-volume" style={{ color: 'white' }}></i>
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </ModalContainer>
            {/* Always render audio element to avoid autoplay issues when tab is not focused */}
            <audio
                ref={ringtoneAudio}
                loop
                preload="auto"
                playsInline
                crossOrigin="anonymous"
                style={{ display: 'none' }}
            >
                <track kind="captions" />
            </audio>
        </div>
    );
};

export default VideoCall;
