import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import socket from '../../common/socket';
import ModalContainer from '../modal/ModalContainer';
import AgoraRTC from 'agora-rtc-sdk-ng';
import { useSelector } from 'react-redux';
import useIsMobile from '../../utils/useIsMobile';
import ringtones from '../../config/ringtones.json';
import api from '../../api/api';
import { useCallMinimize } from '../../contexts/CallMinimizeContext';

const AudioCall = ({ myId }) => {
    console.log('AudioCall - Component mounted/rendered with myId:', myId);
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
            ringtoneAudio.current.pause();
        }
    };
    
    const playRingtone = () => {
        setTimeout(() => {
            if (ringtoneAudio?.current) {
                ringtoneAudio.current.play().catch(error => {
                    console.warn('Failed to play ringtone:', error);
                });
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
        if (mySettings.ringtone && ringtoneAudio?.current) {
            const ringtone = ringtones.find(r => r.id === mySettings.ringtone);
            const toneSrc = ringtone?.src || '';
            if (toneSrc) {
                ringtoneAudio.current.setAttribute('src', toneSrc);
                ringtoneAudio.current.load(); // Ensure the audio is loaded
            }
        }
    }, [mySettings]);

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
        
        socket.on('agora-incoming-audio-call', ({ from, channelName, isAudio, callerName, callerProfilePic }) => {

            if (isAudio) {
                setIsAudioCall(true);
                setReceivingCall(true);
                setCaller(from);
                setIncomingCall({ from, channelName, name: callerName || 'Unknown Caller', profilePic: callerProfilePic });
                setCallerName(callerName || 'Unknown Caller');
                setCallerProfilePic(callerProfilePic || 'https://programmerikram.com/wp-content/uploads/2025/03/default-profilePic.png');
                setCurrentChannel(channelName);
                playRingtone();
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
            setCallerProfilePic(callerProfilePic || 'https://programmerikram.com/wp-content/uploads/2025/03/default-profilePic.png');
            setCurrentChannel(channelName);
            setIncomingCall({ from: myId, to, channelName, name: callerName || 'Friend', profilePic: callerProfilePic });
            console.log('AudioCall - Outgoing call modal should now be visible');
            // playRingtone();
        };

        window.addEventListener('startAudioCall', handleOutgoingAudioCall);

        socket.on('agora-call-accepted', ({ channelName, isAudio }) => {
            // Caller side should join upon acceptance; callee already joined in answerCall
            if (isAudio && !receivingCall) {
                console.log('Agora audio call accepted, joining channel:', channelName);
                stopRingtone();
                // Call startCall directly since it's defined above
                startCall(channelName);
            }
        });

        socket.on('audioCallEnd', () => {
            console.log('AudioCall: Received audioCallEnd event from server');
            console.log('AudioCall: Current state - callAccepted:', callAccepted, 'isAudioCall:', isAudioCall);
            console.log('AudioCall: Current channel:', currentChannel);
            console.log('AudioCall: Incoming call:', incomingCall);
            // IMPORTANT: Only do local cleanup, do NOT call endCall which would re-emit
            cleanupAudioCall();
        });

        return () => {
            socket.off('agora-incoming-audio-call');
            socket.off('agora-call-accepted');
            socket.off('audioCallEnd');
            socket.off('connect');
            socket.off('disconnect');
            window.removeEventListener('startAudioCall', handleOutgoingAudioCall);
        };
    }, [startCall, cleanupAudioCall]); // Include startCall and cleanupAudioCall dependencies

    const answerCall = useCallback(async () => {
        stopRingtone();
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
        
        socket.emit('agora-answer-call', { to: incomingCall.from, channelName: incomingCall.channelName, isAudio: true });
        await startCall(incomingCall.channelName);
    }, [incomingCall, startCall]);

    // End call - called when user clicks end button
    const endCall = useCallback(async () => {
        console.log('AudioCall: endCall - emitting to server and cleaning up');
        console.log('AudioCall: Current state - callAccepted:', callAccepted, 'isAudioCall:', isAudioCall, 'channel:', currentChannel);
        
        // Determine the friend ID to notify
        // If we have incomingCall, use incomingCall.from (the person who called us)
        // If we don't have incomingCall, we initiated the call, so use caller (the person we called)
        let friendIdToNotify;
        if (incomingCall?.from) {
            // We received this call, so notify the person who called us
            friendIdToNotify = incomingCall.from;
        } else if (caller) {
            // We initiated this call, so notify the person we called
            friendIdToNotify = caller;
        }
        
        console.log('AudioCall: Friend ID to notify:', friendIdToNotify);
        console.log('AudioCall: incomingCall:', incomingCall);
        console.log('AudioCall: caller:', caller);
        console.log('AudioCall: Current user ID:', myId);
        if (friendIdToNotify && friendIdToNotify !== myId) {
            console.log('AudioCall: About to emit leaveAudioCall to friend:', friendIdToNotify);
            socket.emit('leaveAudioCall', friendIdToNotify);
            console.log('AudioCall: Successfully emitted leaveAudioCall to friend:', friendIdToNotify);
        } else {
            console.log('AudioCall: No friend ID to notify or trying to notify self, cannot emit leaveAudioCall');
            console.log('AudioCall: friendIdToNotify:', friendIdToNotify, 'myId:', myId);
        }

        // Do local cleanup
        await cleanupAudioCall();
    }, [caller, incomingCall, myId, cleanupAudioCall]);

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
                        {!receivingCall && !callAccepted && `Calling ${callerName}...`}
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
                                        e.target.src = 'https://programmerikram.com/wp-content/uploads/2025/03/default-profilePic.png';
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
                                <button onClick={endCall} className='call-button-decline call-button bg-danger'>
                                    <i className="fa fa-phone-slash" style={{ color: 'white' }}></i>
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </ModalContainer>
            <audio ref={ringtoneAudio} loop>
                <track kind="captions" />
            </audio>
        </div>
    );
};

export default AudioCall;