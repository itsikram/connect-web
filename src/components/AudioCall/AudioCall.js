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
import { unlockAudio, playAudioWithWebAudio, initializeAudioUnlock } from '../../utils/audioUnlock';
import { showCallNotification, closeCallNotification } from '../../utils/callNotification';
import audioPreloader from '../../utils/audioPreloader';

const AudioCall = ({ myId }) => {
    useEffect(() => {
        if (process.env.NODE_ENV === 'development') {
            console.log('AudioCall mounted with myId:', myId);
        }
    }, [myId]);
    const mySettings = useSelector(state => state.setting);
    const [isAudioCall, setIsAudioCall] = useState(false);
    const [callerName, setCallerName] = useState('');
    const [callerProfilePic, setCallerProfilePic] = useState('');
    const [receivingCall, setReceivingCall] = useState(false);
    const [caller, setCaller] = useState('');
    const [callAccepted, setCallAccepted] = useState(false);
    const [isMicrophone, setIsMicrophone] = useState(true);
    const [incomingCall, setIncomingCall] = useState(null);
    const [currentChannel, setCurrentChannel] = useState(null);
    const [isMinimized, setIsMinimized] = useState(false);
    const [callDuration, setCallDuration] = useState(0);
    const [outgoingCallStatus, setOutgoingCallStatus] = useState('');
    const callStartTime = useRef(null);

    const callEndBtn = useRef();
    const ringtoneAudio = useRef();
    const isTerminating = useRef(false);
    
    // Agora RTC refs for audio (fresh client per call)
    const clientRef = useRef(null);
    const localTracks = useRef([]);
    const isJoiningOrJoined = useRef(false);
    const hasBoundClientEvents = useRef(false);
    const remoteUserCheckInterval = useRef(null);

    const isMobile = useIsMobile();
    const { minimizeCall, endMinimizedCall } = useCallMinimize();

    const stopRingtone = () => {
        if (ringtoneAudio?.current) {
            const audio = ringtoneAudio.current;
            audio.pause();
            audio.currentTime = 0; // Reset to beginning
        }
        closeCallNotification(); // Close notification when ringtone stops
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

    const closeAudioCall = () => {
        console.log('AudioCall - Closing audio call modal');
        endCall();
    };

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

    // Get Agora token
    const getToken = async (channelName) => {
        const { data } = await api.post("/agora/token", { channelName, uid: numericUid });
        return data; // { appId, token }
    };

    // Start an audio call (join & publish)
    const startCall = useCallback(async (channelName) => {
        try {
            console.log('Starting Agora audio call with channel:', channelName);
            if (isTerminating.current) {
                console.warn('Start skipped: call is terminating');
                return;
            }
            setCallAccepted(true);
            setCurrentChannel(channelName);
            
            // Set call start time for duration tracking
            if (!callStartTime.current) {
                callStartTime.current = Date.now();
            }

            // Prevent double join attempts (race-safe)
            if (isJoiningOrJoined.current) {
                console.warn('Audio join skipped: client already joining/joined');
                return;
            }
            isJoiningOrJoined.current = true;

            // Small helper: wait until client connectionState is CONNECTED
            const waitForConnected = async (maxMs = 1500, stepMs = 100) => {
                const maxSteps = Math.ceil(maxMs / stepMs);
                for (let i = 0; i < maxSteps; i++) {
                    if (clientRef.current && clientRef.current.connectionState === 'CONNECTED') return true;
                    await new Promise(r => setTimeout(r, stepMs));
                }
                return clientRef.current && clientRef.current.connectionState === 'CONNECTED';
            };

            const { appId, token } = await getToken(channelName);
            console.log('Got Agora token for audio channel:', channelName);

            // Ensure previous client is disposed
            if (clientRef.current) {
                try { await clientRef.current.leave(); } catch (e) {
                    // Ignore leave errors
                }
                try { clientRef.current.removeAllListeners(); } catch (e) {
                    // Ignore remove listeners errors
                }
                clientRef.current = null;
            }

            // Create a fresh client and join
            clientRef.current = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
            const client = clientRef.current;
            await client.join(appId, channelName, token, numericUid);
            console.log('Joined Agora audio channel successfully');

            // Ensure fully connected before publishing
            await waitForConnected();

            // Create local audio track only (no video)
            if (!localTracks.current || localTracks.current.length === 0) {
                localTracks.current = [await AgoraRTC.createMicrophoneAudioTrack()];
                console.log('Created local audio track');
            } else {
                console.log('Using existing audio track');
            }

            // Publish with one retry if needed
            try {
                if (isTerminating.current) {
                    console.warn('Publish skipped: call is terminating');
                    return;
                }
                await client.publish(localTracks.current);
                console.log('Published local audio track');
            } catch (pubErr) {
                if ((pubErr && String(pubErr.message || pubErr)).includes("haven't joined yet")) {
                    console.warn('Publish raced join; waiting briefly then retrying...');
                    await waitForConnected(800, 100);
                    if (isTerminating.current) {
                        console.warn('Publish retry skipped: call is terminating');
                        return;
                    }
                    await client.publish(localTracks.current);
                    console.log('Published local audio track on retry');
                } else {
                    if (String(pubErr.message || pubErr).includes('PeerConnection already disconnected')) {
                        console.warn('Publish failed after disconnect; ignoring during teardown');
                        return;
                    }
                    throw pubErr;
                }
            }

            // Bind client events only once
            if (!hasBoundClientEvents.current) {
                hasBoundClientEvents.current = true;
                client.on("user-published", async (user, mediaType) => {
                    console.log('Remote user published:', user.uid, mediaType);
                    try {
                        await client.subscribe(user, mediaType);
                        console.log('Successfully subscribed to', user.uid, mediaType);

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
                });

                // End locally when remote user leaves the channel
                client.on("user-left", async (user) => {
                    console.log('AudioCall - Remote user left the channel:', user?.uid);
                    try {
                        await cleanupAudioCall();
                    } catch (e) {
                        console.warn('AudioCall - Cleanup after remote user-left failed:', e);
                    }
                });
            }

            // Check for existing remote users who may have already published before we joined
            setTimeout(async () => {
                try {
                    const remoteUsers = client.remoteUsers;
                    console.log('Checking for existing remote users:', remoteUsers.length);
                    
                    for (const user of remoteUsers) {
                        console.log('Found existing remote user:', user.uid, 'hasAudio:', user.hasAudio);
                        
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
            const maxChecks = 3;
            remoteUserCheckInterval.current = setInterval(async () => {
                if (checkCount >= maxChecks || isTerminating.current) {
                    clearInterval(remoteUserCheckInterval.current);
                    remoteUserCheckInterval.current = null;
                    return;
                }
                
                try {
                    const remoteUsers = client.remoteUsers;
                    for (const user of remoteUsers) {
                        if (user.hasAudio && user.audioTrack && !user.audioTrack.isPlaying) {
                            console.log('Found missed remote audio, playing now:', user.uid);
                            user.audioTrack.play();
                        }
                    }
                } catch (error) {
                    console.error('Error in periodic remote user check:', error);
                }
                
                checkCount++;
            }, 2000);
        } catch (error) {
            console.error('Failed to start audio call:', error);
            alert('Failed to start audio call. Please try again.');
            setIsAudioCall(false);
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

    // Local cleanup without emitting to server
    // IMPORTANT: Define this BEFORE the useEffect that uses it
    const cleanupAudioCall = useCallback(async () => {
        console.log('AudioCall: cleanupAudioCall - doing local cleanup only');
        
        stopRingtone();
        isTerminating.current = true;

        // End minimized call if exists
        if (currentChannel) {
            const callId = `audio-${currentChannel}`;
            endMinimizedCall(callId);
        }

        // Unpublish and close local tracks
        try {
            if (clientRef.current && localTracks.current.length > 0) {
                await clientRef.current.unpublish(localTracks.current);
            }
        } catch (e) {
            // Ignore unpublish errors
        }
        localTracks.current.forEach((track) => track.close());
        localTracks.current = [];

        // Leave Agora channel if connected and dispose client
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
        
        // Clear remote user check interval
        if (remoteUserCheckInterval.current) {
            clearInterval(remoteUserCheckInterval.current);
            remoteUserCheckInterval.current = null;
        }

        setCallAccepted(false);
        setIsAudioCall(false);
        setCurrentChannel(null);
        setReceivingCall(false);
        setIncomingCall(null);
        setCaller('');
        setCallerName('');
        setCallerProfilePic('');
        setIsMinimized(false);
        setCallDuration(0);
        isTerminating.current = false;
    }, [currentChannel, endMinimizedCall]);

    useEffect(() => {        
        // Test socket connection
        socket.on('connect', () => {
            console.log('AudioCall - Socket connected');
        });
        
        socket.on('disconnect', () => {
            console.log('AudioCall - Socket disconnected');
        });
        
        socket.on('incoming-audio-call', ({ from, channelName, isAudio, callerName, callerProfilePic }) => {
            socket.emit('update-call-status', { to: from, status: "Ringing..." });


            if (isAudio) {
                setIsAudioCall(true);
                setReceivingCall(true);
                setCaller(from);
                setIncomingCall({ from, channelName, name: callerName || 'Unknown Caller', profilePic: callerProfilePic });
                setCallerName(callerName || 'Unknown Caller');
                setCallerProfilePic(callerProfilePic || config?.defaultProfile);
                setCurrentChannel(channelName);
                playRingtone();
                
                // Show browser notification for incoming call
                showCallNotification({
                    callerName: callerName || 'Unknown Caller',
                    callerProfilePic: callerProfilePic || config?.defaultProfile,
                    callType: 'audio',
                    onClick: () => {
                        // Focus the window when notification is clicked
                        window.focus();
                    }
                });
            } else {
                console.log('AudioCall - Ignoring video call (isAudio: false)');
            }
        });

        // Listen for audio calls initiated by this user (outgoing calls)
        const handleOutgoingAudioCall = (event) => {
            const { to, channelName, callerName, callerProfilePic } = event.detail;
            console.log('AudioCall - Starting outgoing audio call to', to, 'channel:', channelName);
            console.log('AudioCall - Friend info:', { callerName, callerProfilePic });
            setIsAudioCall(true);
            setReceivingCall(false);
            setCaller(to);
            setCallerName(callerName || 'Friend');
            setCallerProfilePic(callerProfilePic || config?.defaultProfile);
            setCurrentChannel(channelName);
            setIncomingCall({ from: myId, to, channelName, name: callerName || 'Friend', profilePic: callerProfilePic });
            console.log('AudioCall - Outgoing call modal should now be visible');
            setOutgoingCallStatus('Calling...');
            // playRingtone();
        };

        window.addEventListener('startAudioCall', handleOutgoingAudioCall);

        socket.on('call-accepted', ({ channelName, isAudio }) => {
            // Caller side should join upon acceptance; callee already joined in answerCall
            if (isAudio && !receivingCall) {
                console.log('Agora audio call accepted, joining channel:', channelName);
                stopRingtone();
                // Call startCall directly since it's defined above
                startCall(channelName);
                setOutgoingCallStatus('');
            }
        });

        socket.on('audio-call-ended', async () => {
            console.log('AudioCall: Received audio-call-ended event from server');
            console.log('AudioCall: Current state - callAccepted:', callAccepted, 'isAudioCall:', isAudioCall);
            console.log('AudioCall: Current channel:', currentChannel);
            console.log('AudioCall: Incoming call:', incomingCall);
            // IMPORTANT: Only do local cleanup, do NOT call endCall which would re-emit
            stopRingtone(); // This also closes notification
            await cleanupAudioCall();
        });
        socket.on('audio-call-cancelled', async () => {
            console.log('AudioCall: Received audio-call-cancelled event from server');
            stopRingtone(); // This also closes notification
            await cleanupAudioCall();
        });
        socket.on('audio-call-rejected', async () => {
            console.log('AudioCall: Received audio-call-rejected event from server');
            stopRingtone(); // This also closes notification
            await cleanupAudioCall();
        });

        const handleUpdatedCallStatus = ({ from, status }) => {
            // Only for outgoing (caller) side: receivingCall is false
            if (!receivingCall && !callAccepted && caller && from === caller) {
                setOutgoingCallStatus(status || '');
            }
        };
        socket.on('updated-call-status', handleUpdatedCallStatus);

        return () => {
            socket.off('incoming-audio-call');
            socket.off('call-accepted');
            socket.off('audio-call-ended');
            socket.off('audio-call-cancelled');
            socket.off('audio-call-rejected');
            socket.off('connect');
            socket.off('disconnect');
            window.removeEventListener('startAudioCall', handleOutgoingAudioCall);
            stopRingtone(); // Stop ringtone on cleanup
            socket.off('updated-call-status', handleUpdatedCallStatus);
        };
    }, [startCall, cleanupAudioCall, caller, receivingCall, callAccepted]); // Include deps

    // Resume ringtone playback when tab becomes visible
    useEffect(() => {
        const handleVisibilityChange = async () => {
            if (document.visibilityState === 'visible' && receivingCall && !callAccepted && incomingCall && ringtoneAudio?.current) {
                const audio = ringtoneAudio.current;
                // Resume playback if it was paused due to tab being hidden
                if (audio.paused && audio.src && audio.src !== window.location.href) {
                    await unlockAudio();
                    audio.muted = false;
                    audio.volume = 1.0;
                    try {
                        await playAudioWithWebAudio(audio);
                    } catch (error) {
                        audio.play().catch(e => {
                            console.warn('Failed to resume ringtone on visibility change:', e);
                        });
                    }
                }
            }
        };

        const handleWindowFocus = async () => {
            // Also try to resume ringtone on window focus
            if (receivingCall && !callAccepted && incomingCall && ringtoneAudio?.current) {
                const audio = ringtoneAudio.current;
                if (audio.paused && audio.src && audio.src !== window.location.href) {
                    await unlockAudio();
                    audio.muted = false;
                    audio.volume = 1.0;
                    try {
                        await playAudioWithWebAudio(audio);
                    } catch (error) {
                        audio.play().catch(e => {
                            console.warn('Failed to resume ringtone on window focus:', e);
                        });
                    }
                }
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('focus', handleWindowFocus);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('focus', handleWindowFocus);
        };
    }, [receivingCall, callAccepted, incomingCall]);

    // Initialize audio unlock on component mount
    useEffect(() => {
        initializeAudioUnlock();
    }, []);

    // Cleanup on component unmount
    useEffect(() => {
        return () => {
            stopRingtone();
        };
    }, []);

    const answerCall = useCallback(async () => {
        stopRingtone(); // This also closes notification
        if (!incomingCall) return;

        console.log('Answering Agora audio call');
        
        // Start local audio immediately when accepting call
        try {
            console.log('Starting local audio for call answer');
            localTracks.current = [await AgoraRTC.createMicrophoneAudioTrack()];
            console.log('Local audio started immediately');
        } catch (error) {
            console.error('Failed to start local audio immediately:', error);
        }
        
        socket.emit('answer-call', { to: incomingCall.from, channelName: incomingCall.channelName, isAudio: true });
        await startCall(incomingCall.channelName);
    }, [incomingCall, startCall]);

    // End call - called when user clicks end button
    const endCall = useCallback(async () => {
        console.log('AudioCall: Current state - callAccepted:',incomingCall, caller, callAccepted,myId);
        
        // Explicitly stop ringtone first
        stopRingtone();
        
        // Determine the friend ID to notify
        // If we have incomingCall, use incomingCall.from (the person who called us)
        // If we don't have incomingCall, we initiated the call, so use caller (the person we called)
        let friendIdToNotify;
        if (incomingCall?.from) {
            // We received this call, so notify the person who called us
            friendIdToNotify = incomingCall.from;
            if(!callAccepted && friendIdToNotify !== myId) {
                socket.emit('audio-call-reject', {to:friendIdToNotify, channelName: currentChannel});
                await cleanupAudioCall();
                return;
            }
            if(!callAccepted && friendIdToNotify === myId) {
                socket.emit('audio-call-cancel', {to:caller, channelName: currentChannel});

                await cleanupAudioCall();
                return;
            }
        } else if (caller) {
            // We initiated this call, so notify the person we called
            friendIdToNotify = caller;
            if(!callAccepted) {
                socket.emit('audio-call-cancel', {to:friendIdToNotify, channelName: currentChannel});
                await cleanupAudioCall();
                return;
            }
            await cleanupAudioCall();
            return;
        }

        if (friendIdToNotify && friendIdToNotify !== myId) {
            socket.emit('audio-call-end', {to:friendIdToNotify, channelName: currentChannel});
            console.log('AudioCall: Successfully emitted audio-call-end to friend:', friendIdToNotify);
        } else {
            console.log('AudioCall: No friend ID to notify or trying to notify self, cannot emit audio-call-end');
            console.log('AudioCall: friendIdToNotify:', friendIdToNotify, 'myId:', myId);
        }
        // Do local cleanup
        await cleanupAudioCall();
        return;
    }, [caller, incomingCall, myId, cleanupAudioCall, callAccepted, currentChannel]);

    const handleMicrophoneClick = useCallback(async () => {
        if (localTracks.current[0]) {
            await localTracks.current[0].setEnabled(!isMicrophone);
        }
        setIsMicrophone(prev => !prev);
    }, [isMicrophone]);

    const minimizeAudioCall = useCallback(() => {
        if (!callAccepted || !currentChannel) return;

        const callId = `audio-${currentChannel}`;
        const callData = {
            id: callId,
            type: 'audio',
            callerName: callerName || 'Unknown Caller',
            callerProfilePic: callerProfilePic,
            callerId: caller,
            status: 'connected',
            duration: callDuration,
            isMuted: !isMicrophone,
            isCameraOn: false, // Audio calls don't have camera
            onRestore: () => {
                setIsMinimized(false);
                setIsAudioCall(true);
            },
            onEnd: () => {
                endCall();
            },
            onToggleMute: () => {
                handleMicrophoneClick();
            }
        };

        minimizeCall(callData);
        setIsMinimized(true);
        setIsAudioCall(false);
    }, [callAccepted, currentChannel, callerName, callerProfilePic, caller, callDuration, isMicrophone, minimizeCall, handleMicrophoneClick, endCall]);

    return (
        <div>
            <ModalContainer
                title="Audio Call"
                style={{ 
                    width: isMobile ? '95%' : '400px', 
                    top: '50%', 
                    height: 'auto', 
                    borderRadius: '10px',
                    zIndex: '9999' // Ensure it's on top
                }}
                isOpen={isAudioCall && !isMinimized}
                onRequestClose={closeAudioCall}
                id="audioCallModal"
            >
                <div className={`${callAccepted ? 'call-accepted' : ''}`} style={{ padding: '20px', textAlign: 'center' }}>
                    <h2 className='text-center vc-modal-heading'>
                        Audio Call{callAccepted ? ` • ${String(Math.floor(callDuration / 60)).padStart(2, '0')}:${String(callDuration % 60).padStart(2, '0')}` : ''}
                    </h2>
                    <p className='fs-4 text-center'>
                        {receivingCall && !callAccepted && `${callerName} is calling you`}
                        {!receivingCall && !callAccepted && `Calling ${callerName}${outgoingCallStatus ? ` • ${outgoingCallStatus}` : '...'}`}
                        {callAccepted && `Connected - ${callerName}`}
                    </p>

                    <div className="audio-call-avatar" style={{ margin: '30px 0' }}>
                        <div style={{ 
                            width: '120px', 
                            height: '120px', 
                            borderRadius: '50%', 
                            overflow: 'hidden',
                            margin: '0 auto',
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
                                    background: '#f0f0f0',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '48px',
                                    color: '#666'
                                }}>
                                    <i className="fas fa-user"></i>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className='call-buttons' style={{ display: 'flex', justifyContent: 'center', gap: '20px' }}>
                        <button onClick={endCall} ref={callEndBtn} className='call-button-ends call-button bg-danger'>
                            <i className="fa fa-phone" style={{ color: 'white' }}></i>
                        </button>

                        {callAccepted && (
                            <>
                                <button onClick={handleMicrophoneClick} className='call-button-microphone call-button'>
                                    {isMicrophone ? <i className="fa fa-microphone" style={{ color: 'white' }} /> : <i className="fa fa-microphone-slash" style={{ color: 'white' }} />}
                                </button>
                                <button onClick={minimizeAudioCall} className='call-button-minimize call-button' title="Minimize">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="white" strokeWidth="2"
                                        strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                                        <path d="M6 9l6 6 6-6" />
                                    </svg>
                                </button>
                            </>
                        )}

                        {!callAccepted && receivingCall && (
                            <>
                                <button onClick={answerCall} className='call-button-receive call-button bg-success'>
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

export default React.memo(AudioCall);