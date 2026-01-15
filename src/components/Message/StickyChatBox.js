import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import moment from 'moment';
import UserPP from '../UserPP';
import socket from '../../common/socket';
import api from '../../api/api';
import SingleMessage from './SingleMessage';
import ChatHeader from './ChatHeader';
import StickyChatFooter from './StickyChatFooter';
import SingleMsgSkleton from '../../skletons/message/SingleMsgSkleton';
import ModalContainer from '../modal/ModalContainer';
import LiveVoiceModal from './LiveVoiceModal';
import useIsMobile from '../../utils/useIsMobile';
import AgoraRTC from 'agora-rtc-sdk-ng';
import './StickyChatBox.css';
import './UserInfoModal.css';

const StickyChatBox = ({ friendProfile, onClose, onMinimize, isMinimized, zIndex, isLoading = false }) => {
    const navigate = useNavigate();
    const myProfile = useSelector(state => state.profile);
    const userId = myProfile._id;
    const friendId = friendProfile?._id;
    
    const [room, setRoom] = useState('');
    const [isActive, setIsActive] = useState(false);
    const [isReplying, setIsReplying] = useState(false);
    const [isPreview, setIsPreview] = useState(false);
    const [messages, setMessages] = useState([]);
    const [isTyping, setIsTyping] = useState(false);
    const [isMsgLoading, setIsMsgLoading] = useState(false);
    const [typeMessage, setTypeMessage] = useState('');
    const [hasMoreMessages, setHasMoreMessages] = useState(true);
    const [lastSeen, setLastSeen] = useState(false);
    const [isBlockedMe, setIsBlockedMe] = useState(false);
    const [scrollPercent, setScrollPercent] = useState(0);
    const [replyData, setReplyData] = useState({ messageId: null, body: null });
    const [showOptionsMenu, setShowOptionsMenu] = useState(false);
    const [menuPosition, setMenuPosition] = useState({ top: 0, right: 0 });
    const [isUserInfoModalOpen, setIsUserInfoModalOpen] = useState(false);
    const [userInfoData, setUserInfoData] = useState(null);
    const [loadingUserInfo, setLoadingUserInfo] = useState(false);
    const [friendLocation, setFriendLocation] = useState(null);
    const [isLiveVoiceActive, setIsLiveVoiceActive] = useState(false);
    const [isLiveVoiceModalOpen, setIsLiveVoiceModalOpen] = useState(false);
    const [liveVoiceDuration, setLiveVoiceDuration] = useState(0);
    const [emotion, setEmotion] = useState(false);
    
    const isMobile = useIsMobile();
    const msgListRef = useRef(null);
    const messageInput = useRef(null);
    const chatHeader = useRef(null);
    const chatFooter = useRef(null);
    const optionsMenuRef = useRef(null);
    const optionsButtonRef = useRef(null);
    const hasScrolledOnLoadRef = useRef(false);
    const previousMinimizedStateRef = useRef(isMinimized);
    const liveVoiceClientRef = useRef(null);
    const liveVoiceDurationTimerRef = useRef(null);
    const liveVoiceLocalTrackRef = useRef(null);
    const mapRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const [map, setMap] = useState(null);
    const [mapLoading, setMapLoading] = useState(false);

    // Helper function to deduplicate messages by _id
    const deduplicateMessages = (messagesArray) => {
        if (!Array.isArray(messagesArray)) return [];
        const seen = new Map();
        const unique = [];
        
        for (const msg of messagesArray) {
            if (msg && msg._id) {
                const id = msg._id.toString();
                if (!seen.has(id)) {
                    seen.set(id, true);
                    unique.push(msg);
                }
            }
        }
        
        return unique;
    };

    // Check if user is active
    useEffect(() => {
        if (!friendId || !userId || isLoading) return;
        
        // Initial check
        socket.emit('is_active', { profileId: friendId, myId: userId });
        
        const handleIsActive = (data, ls, activeProfileId) => {
            // Only process if this response is for the current friend
            if (activeProfileId && activeProfileId !== friendId) return;
            
            const lastSeenTimeStamp = moment(ls);
            const currentTimeStamp = moment(Date.now());
            const diffDays = currentTimeStamp.diff(lastSeenTimeStamp, 'days');
            
            // Update active status - handle both true and false
            setIsActive(data === true);
            
            let formattedTime;
            if (diffDays === 0) {
                formattedTime = moment(ls).format("hh:mm A");
            } else if (diffDays > 365) {
                formattedTime = moment(ls).format("MM/YY hh:mm A");
            } else {
                formattedTime = moment(ls).format("DD/MM hh:mm A");
            }
            setLastSeen(formattedTime);
        };

        // Listen for real-time online/offline updates
        const handleFriendOnline = (data) => {
            if (data?.profileId === friendId) {
                setIsActive(true);
            }
        };

        const handleFriendOffline = (data) => {
            if (data?.profileId === friendId) {
                setIsActive(false);
                // Update last seen when they go offline
                const now = moment();
                setLastSeen(now.format("hh:mm A"));
            }
        };

        socket.on('is_active', handleIsActive);
        socket.on('friend_online', handleFriendOnline);
        socket.on('friend_offline', handleFriendOffline);

        return () => {
            socket.off('is_active', handleIsActive);
            socket.off('friend_online', handleFriendOnline);
            socket.off('friend_offline', handleFriendOffline);
        };
    }, [friendId, userId, isLoading]);

    // Check if blocked
    useEffect(() => {
        if (friendProfile && !isLoading) {
            setIsBlockedMe(friendProfile.blockedUsers ? friendProfile.blockedUsers.includes(userId) : false);
        }
    }, [friendProfile, userId, isLoading]);

    // Calculate menu position and handle click outside
    useEffect(() => {
        if (showOptionsMenu && optionsButtonRef.current) {
            // Use requestAnimationFrame to ensure DOM is updated before calculating position
            requestAnimationFrame(() => {
                if (optionsButtonRef.current) {
                    const buttonRect = optionsButtonRef.current.getBoundingClientRect();
                    setMenuPosition({
                        top: buttonRect.bottom + 8,
                        right: window.innerWidth - buttonRect.right
                    });
                }
            });
        }

        const handleClickOutside = (event) => {
            if (
                optionsMenuRef.current && 
                !optionsMenuRef.current.contains(event.target) &&
                optionsButtonRef.current &&
                !optionsButtonRef.current.contains(event.target)
            ) {
                setShowOptionsMenu(false);
            }
        };

        if (showOptionsMenu) {
            // Use setTimeout to ensure the menu is rendered before adding listener
            setTimeout(() => {
                document.addEventListener('mousedown', handleClickOutside);
            }, 0);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showOptionsMenu]);

    // Handle chat info click
    const handleChatInfoClick = async () => {
        if (!friendId) return;
        setIsUserInfoModalOpen(true);
        setLoadingUserInfo(true);
        try {
            const res = await api.get('/profile', { params: { profileId: friendId } });
            if (res.status === 200) {
                setUserInfoData(res.data);
                if (res.data?.lastLocation?.latitude && res.data?.lastLocation?.longitude) {
                    setFriendLocation({
                        latitude: res.data.lastLocation.latitude,
                        longitude: res.data.lastLocation.longitude,
                        timestamp: res.data.lastLocation.timestamp || Date.now(),
                    });
                }
            }
        } catch (error) {
            console.error('Error fetching user info:', error);
            setUserInfoData(friendProfile);
            if (friendProfile?.lastLocation?.latitude && friendProfile?.lastLocation?.longitude) {
                setFriendLocation({
                    latitude: friendProfile.lastLocation.latitude,
                    longitude: friendProfile.lastLocation.longitude,
                    timestamp: friendProfile.lastLocation.timestamp || Date.now(),
                });
            }
        } finally {
            setLoadingUserInfo(false);
        }
    };

    // Handle live voice button click
    const handleLiveVoiceButtonClick = async () => {
        if (!friendId || !room) return;
        
        if (isLiveVoiceActive) {
            // Stop live voice
            try {
                if (liveVoiceClientRef.current && liveVoiceLocalTrackRef.current) {
                    await liveVoiceClientRef.current.unpublish([liveVoiceLocalTrackRef.current]);
                }
            } catch (e) {
                console.warn('Error unpublishing live voice:', e);
            }
            try {
                liveVoiceLocalTrackRef.current?.close();
            } catch (e) {
                console.warn('Error closing live voice track:', e);
            }
            liveVoiceLocalTrackRef.current = null;
            try {
                await liveVoiceClientRef.current?.leave();
                liveVoiceClientRef.current?.removeAllListeners();
            } catch (e) {
                console.warn('Error leaving live voice channel:', e);
            }
            liveVoiceClientRef.current = null;
            setIsLiveVoiceActive(false);
            setIsLiveVoiceModalOpen(false);
            setLiveVoiceDuration(0);
            if (liveVoiceDurationTimerRef.current) {
                clearInterval(liveVoiceDurationTimerRef.current);
                liveVoiceDurationTimerRef.current = null;
            }
            socket.emit('live-voice-stop', { to: friendId, channelName: room });
            return;
        }

        // Start live voice
        try {
            const channelName = room;
            // First, leave subscriber mode if we're receiving
            socket.emit('live-voice-leave-subscriber', { channelName });
            
            // Get numeric UID for Agora
            let numericUid = 0;
            if (userId) {
                let hash = 0;
                for (let i = 0; i < userId.length; i++) {
                    hash = ((hash << 5) - hash) + userId.charCodeAt(i);
                    hash |= 0;
                }
                numericUid = Math.abs(hash);
            }
            
            const { data } = await api.post('/agora/token', { channelName, uid: numericUid, role: 'publisher' });
            const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
            liveVoiceClientRef.current = client;
            await client.join(data.appId, channelName, data.token, numericUid);
            const mic = await AgoraRTC.createMicrophoneAudioTrack();
            liveVoiceLocalTrackRef.current = mic;
            await client.publish([mic]);
            setIsLiveVoiceActive(true);
            setLiveVoiceDuration(0);
            setIsLiveVoiceModalOpen(true);
            if (liveVoiceDurationTimerRef.current) {
                clearInterval(liveVoiceDurationTimerRef.current);
            }
            liveVoiceDurationTimerRef.current = setInterval(() => {
                setLiveVoiceDuration(prev => prev + 1);
            }, 1000);
            socket.emit('live-voice-start', { to: friendId, channelName });
        } catch (error) {
            console.error('Error starting live voice:', error);
            setIsLiveVoiceActive(false);
            setIsLiveVoiceModalOpen(false);
            setLiveVoiceDuration(0);
            if (liveVoiceDurationTimerRef.current) {
                clearInterval(liveVoiceDurationTimerRef.current);
                liveVoiceDurationTimerRef.current = null;
            }
        }
    };

    // Helper functions for user info modal
    const getUserName = () => {
        const data = userInfoData || friendProfile;
        return data?.fullName || 
               (data?.user?.firstName && data?.user?.surname 
                   ? `${data.user.firstName} ${data.user.surname}` 
                   : 'Unknown User');
    };

    const getUserProfilePic = () => {
        const data = userInfoData || friendProfile;
        return data?.profilePic || '';
    };

    const formatLastActive = (lastSeenValue) => {
        if (!lastSeenValue) return 'Never';
        if (typeof lastSeenValue === 'string') {
            if (lastSeenValue.includes('Last Seen:')) {
                return lastSeenValue.replace('Last Seen:', '').trim();
            }
            return lastSeenValue;
        }
        const now = new Date();
        const lastSeenDate = new Date(lastSeenValue);
        const diffMs = now - lastSeenDate;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins} ${diffMins === 1 ? 'minute' : 'minutes'} ago`;
        if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
        if (diffDays < 7) return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
        return lastSeenDate.toLocaleDateString();
    };

    const getUserLocation = () => {
        if (friendLocation) {
            return `${friendLocation.latitude.toFixed(6)}, ${friendLocation.longitude.toFixed(6)}`;
        }
        const data = userInfoData || friendProfile;
        if (data?.lastLocation?.latitude && data?.lastLocation?.longitude) {
            return `${data.lastLocation.latitude.toFixed(6)}, ${data.lastLocation.longitude.toFixed(6)}`;
        }
        if (data?.presentAddress) return data.presentAddress;
        if (data?.permanentAddress) return data.permanentAddress;
        return 'Not available';
    };

    const getUserEmotion = () => {
        if (emotion) return emotion;
        const data = userInfoData || friendProfile;
        if (data?.lastEmotion) return data.lastEmotion;
        if (data?.lastEmotionText && data?.lastEmotionEmoji) {
            return `${data.lastEmotionEmoji} ${data.lastEmotionText}`;
        }
        return 'No emotion detected';
    };

    const getLastAction = () => {
        const data = userInfoData || friendProfile;
        if (emotion) return 'Sharing emotion';
        if (data?.isActive || isActive) return 'Currently active';
        if (lastSeen) {
            const lastSeenLower = String(lastSeen).toLowerCase();
            if (lastSeenLower.includes('minute') || lastSeenLower.includes('just now')) {
                return 'Recently active';
            }
            return 'Last seen recently';
        }
        return 'Unknown';
    };

    // Initialize chat room and fetch messages
    useEffect(() => {
        if (!friendId || !userId || isLoading || !friendProfile?._id) return;
        
        console.log('StickyChatBox: Initializing chat for', friendId, 'isLoading:', isLoading);
        
        const newRoom = [userId, friendId].sort().join('_');
        setRoom(newRoom);
        
        // Join the room via socket
        socket.emit('startChat', { user1: userId, user2: friendId });
        socket.on('roomJoined', ({ room }) => {
            console.log(`StickyChatBox: Joined room: ${room}`);
        });

        // Listen for previous messages from socket
        socket.on('previousMessages', (messagesArray) => {
            console.log('StickyChatBox: Received previousMessages', messagesArray);
            if (Array.isArray(messagesArray) && messagesArray.length > 0) {
                setMessages(messagesArray);
                setHasMoreMessages(messagesArray.length >= 20);
                setTimeout(() => scrollToLastMessage(), 100);
            }
        });

        // Fetch initial messages via HTTP API
        const fetchInitialMessages = async () => {
            try {
                console.log('StickyChatBox: Fetching messages for', userId, friendId);
                const response = await api.get('/message/getChatHistory', {
                    params: {
                        profileId: userId,
                        friendId: friendId,
                        limit: 20
                    }
                });
                
                console.log('StickyChatBox: Messages response', response.data);
                if (response.data && response.data.messages) {
                    const deduplicated = deduplicateMessages(response.data.messages);
                    setMessages(deduplicated);
                    setHasMoreMessages(response.data.hasMore);
                    setTimeout(() => scrollToLastMessage(), 100);
                } else {
                    console.log('StickyChatBox: No messages in response');
                    setMessages([]);
                    setHasMoreMessages(false);
                }
            } catch (error) {
                console.error('StickyChatBox: Error fetching initial messages:', error);
                setMessages([]);
                setHasMoreMessages(false);
            }
        };

        fetchInitialMessages();

        // Socket listeners
        socket.on('loadMessages', ({ loadedMessages, hasNewMessage }) => {
            console.log('StickyChatBox: Received loadMessages', loadedMessages);
            setHasMoreMessages(hasNewMessage);
            setIsMsgLoading(false);
            setMessages(messages => [...loadedMessages, ...messages]);
        });

        socket.on('newMessage', ({ updatedMessage, senderName, senderPP, chatPage }) => {
            if (chatPage === true) {
                if ((updatedMessage.receiverId === userId && updatedMessage.senderId === friendId) ||
                    (updatedMessage.senderId === userId && updatedMessage.receiverId === friendId)) {
                    console.log('StickyChatBox: Received newMessage', updatedMessage);
                    
                    // Update sender's online status to true when receiving a new message
                    if (updatedMessage.senderId === friendId) {
                        setIsActive(true);
                    }
                    
                    setMessages((prevMessages) => {
                        // Check if message already exists
                        const existingIds = new Set(prevMessages.map(m => m?._id?.toString()).filter(Boolean));
                        if (updatedMessage?._id && existingIds.has(updatedMessage._id.toString())) {
                            return prevMessages; // Message already exists, don't add duplicate
                        }
                        return deduplicateMessages([...prevMessages, updatedMessage]);
                    });
                    setTimeout(() => scrollToLastMessage(), 100);
                }
            }
        });

        socket.on('typing', ({ receiverId, isTyping, type }) => {
            if (receiverId === userId) {
                setIsTyping(isTyping === true);
                setTypeMessage(type || '');
                if (isTyping) {
                    setTimeout(() => scrollToLastMessage(), 100);
                }
            }
        });

        socket.on('deleteMessage', (messageId) => {
            setMessages(prev => prev.filter(msg => msg._id !== messageId));
        });

        return () => {
            socket.off('newMessage');
            socket.off('roomJoined');
            socket.off('deleteMessage');
            socket.off('typing');
            socket.off('loadMessages');
            socket.off('previousMessages');
        };
    }, [friendId, userId, isLoading, friendProfile?._id]);

    // Live voice socket listeners
    useEffect(() => {
        if (!friendId || !userId || isLoading) return;

        const ensureLeaveLiveVoice = async () => {
            try {
                await liveVoiceClientRef.current?.leave();
            } catch (e) {
                // Ignore leave errors
            }
            try {
                liveVoiceClientRef.current?.removeAllListeners();
            } catch (e) {
                // Ignore listener removal errors
            }
            liveVoiceClientRef.current = null;
        };

        socket.on('live-voice-start', async ({ channelName }) => {
            try {
                await ensureLeaveLiveVoice();
                const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
                liveVoiceClientRef.current = client;
                
                let numericUid = 0;
                if (userId) {
                    let hash = 0;
                    for (let i = 0; i < userId.length; i++) {
                        hash = ((hash << 5) - hash) + userId.charCodeAt(i);
                        hash |= 0;
                    }
                    numericUid = Math.abs(hash);
                }
                
                const { data } = await api.post('/agora/token', { channelName, uid: numericUid, role: 'subscriber' });
                await client.join(data.appId, channelName, data.token, numericUid);
                setIsLiveVoiceActive(true);
                setLiveVoiceDuration(0);
                setIsLiveVoiceModalOpen(true);
                if (liveVoiceDurationTimerRef.current) {
                    clearInterval(liveVoiceDurationTimerRef.current);
                }
                liveVoiceDurationTimerRef.current = setInterval(() => {
                    setLiveVoiceDuration(prev => prev + 1);
                }, 1000);
                client.on('user-published', async (user, mediaType) => {
                    if (mediaType === 'audio') {
                        await client.subscribe(user, 'audio');
                        user.audioTrack?.play();
                    }
                });
                for (const user of client.remoteUsers) {
                    if (user.hasAudio) {
                        await client.subscribe(user, 'audio');
                        user.audioTrack?.play();
                    }
                }
            } catch (e) {
                console.error('Live voice subscribe failed:', e);
                setIsLiveVoiceActive(false);
                setIsLiveVoiceModalOpen(false);
            }
        });

        socket.on('live-voice-stop', async () => {
            await ensureLeaveLiveVoice();
            setIsLiveVoiceActive(false);
            setIsLiveVoiceModalOpen(false);
            setLiveVoiceDuration(0);
            if (liveVoiceDurationTimerRef.current) {
                clearInterval(liveVoiceDurationTimerRef.current);
                liveVoiceDurationTimerRef.current = null;
            }
        });

        socket.on('live-voice-leave-subscriber', async ({ channelName }) => {
            if (liveVoiceClientRef.current && isLiveVoiceActive) {
                await ensureLeaveLiveVoice();
                setIsLiveVoiceActive(false);
                setIsLiveVoiceModalOpen(false);
                setLiveVoiceDuration(0);
                if (liveVoiceDurationTimerRef.current) {
                    clearInterval(liveVoiceDurationTimerRef.current);
                    liveVoiceDurationTimerRef.current = null;
                }
            }
        });

        return () => {
            socket.off('live-voice-start');
            socket.off('live-voice-stop');
            socket.off('live-voice-leave-subscriber');
            if (liveVoiceDurationTimerRef.current) {
                clearInterval(liveVoiceDurationTimerRef.current);
                liveVoiceDurationTimerRef.current = null;
            }
        };
    }, [friendId, userId, isLoading, room, isLiveVoiceActive]);

    // Listen for emotion changes
    useEffect(() => {
        if (!friendId) return;
        const handleEmotionChange = ({ emotion: newEmotion, friendId: emotionFriendId }) => {
            if (emotionFriendId === friendId) {
                setEmotion(newEmotion);
            }
        };
        socket.on('emotion_change', handleEmotionChange);
        return () => {
            socket.off('emotion_change', handleEmotionChange);
        };
    }, [friendId]);

    // Load Google Maps script
    useEffect(() => {
        const apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
        
        if (!apiKey) {
            console.warn('Google Maps API key is not configured.');
            return;
        }

        // Check if script is already loaded
        if (window.google && window.google.maps) {
            return;
        }

        // Check if script tag already exists
        const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
        if (existingScript) {
            return;
        }

        // Create and load script
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,marker`;
        script.async = true;
        script.defer = true;
        script.onerror = () => {
            console.error('Failed to load Google Maps.');
        };
        document.head.appendChild(script);
    }, []);

    // Initialize Google Map when modal opens and location is available
    useEffect(() => {
        if (!isUserInfoModalOpen || !mapRef.current) return;
        
        const location = friendLocation || userInfoData?.lastLocation || friendProfile?.lastLocation;
        if (!location || !location.latitude || !location.longitude) return;

        let checkInterval = null;

        // Wait for Google Maps to be loaded
        checkInterval = setInterval(() => {
            if (window.google && window.google.maps && mapRef.current) {
                clearInterval(checkInterval);
                initializeMap(location);
            }
        }, 100);

        // Timeout after 5 seconds
        const timeoutId = setTimeout(() => {
            if (checkInterval) {
                clearInterval(checkInterval);
            }
        }, 5000);

        return () => {
            if (checkInterval) {
                clearInterval(checkInterval);
            }
            clearTimeout(timeoutId);
            // Clean up map when modal closes
            mapInstanceRef.current = null;
            setMap(null);
        };
    }, [isUserInfoModalOpen, friendLocation, userInfoData?.lastLocation, friendProfile?.lastLocation]);

    const initializeMap = (location) => {
        if (!window.google || !window.google.maps || !mapRef.current || !location) {
            return;
        }

        // If map already exists, just update it
        if (mapInstanceRef.current) {
            const mapLocation = { lat: location.latitude, lng: location.longitude };
            mapInstanceRef.current.setCenter(mapLocation);
            return;
        }

        try {
            setMapLoading(true);
            const mapLocation = { lat: location.latitude, lng: location.longitude };
            
            const mapOptions = {
                center: mapLocation,
                zoom: 15,
                mapTypeId: window.google.maps.MapTypeId.ROADMAP,
                mapTypeControl: true,
                mapTypeControlOptions: {
                    style: window.google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
                    position: window.google.maps.ControlPosition.TOP_RIGHT,
                    mapTypeIds: [
                        window.google.maps.MapTypeId.ROADMAP,
                        window.google.maps.MapTypeId.SATELLITE,
                        window.google.maps.MapTypeId.HYBRID,
                        window.google.maps.MapTypeId.TERRAIN
                    ]
                },
                streetViewControl: true,
                fullscreenControl: true,
                zoomControl: true
            };

            const mapId = process.env.REACT_APP_GOOGLE_MAPS_MAP_ID;
            if (mapId) {
                mapOptions.mapId = mapId;
            }

            const mapInstance = new window.google.maps.Map(mapRef.current, mapOptions);
            mapInstanceRef.current = mapInstance;
            setMap(mapInstance);

            // Add marker for friend's location
            const useAdvancedMarker = window.google.maps.marker && window.google.maps.marker.AdvancedMarkerElement && mapId;
            const userName = getUserName();
            
            if (useAdvancedMarker) {
                try {
                    new window.google.maps.marker.AdvancedMarkerElement({
                        map: mapInstance,
                        position: mapLocation,
                        title: userName
                    });
                } catch (markerError) {
                    console.warn('AdvancedMarkerElement failed, using legacy Marker:', markerError);
                    new window.google.maps.Marker({
                        position: mapLocation,
                        map: mapInstance,
                        title: userName,
                        icon: {
                            url: 'http://maps.google.com/mapfiles/ms/icons/red-dot.png'
                        }
                    });
                }
            } else {
                new window.google.maps.Marker({
                    position: mapLocation,
                    map: mapInstance,
                    title: userName,
                    icon: {
                        url: 'http://maps.google.com/mapfiles/ms/icons/red-dot.png'
                    }
                });
            }

            setMapLoading(false);
        } catch (error) {
            console.error('Error initializing map:', error);
            setMapLoading(false);
        }
    };

    // Mark messages as seen
    useEffect(() => {
        if (messages.length > 0 && friendId && friendProfile?._id) {
            setTimeout(() => {
                const lastMessage = messages[messages.length - 1];
                if (lastMessage && lastMessage.senderId !== userId && lastMessage.senderId === friendId) {
                    socket.emit('seenMessage', lastMessage);
                }
            }, 2000);
        }
    }, [messages, friendId, friendProfile, userId]);

    // Scroll handling
    useEffect(() => {
        const handleScroll = () => {
            const el = msgListRef.current;
            if (!el) return;
            const scrollTop = el.scrollTop;
            const scrollHeight = el.scrollHeight - el.clientHeight;
            const percent = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0;
            setScrollPercent(percent);
        };

        const el = msgListRef.current;
        if (el) {
            el.addEventListener("scroll", handleScroll);
        }

        return () => {
            if (el) {
                el.removeEventListener("scroll", handleScroll);
            }
        };
    }, []);

    // Load more messages on scroll
    useEffect(() => {
        if (hasMoreMessages && scrollPercent < 30) {
            socket.emit('loadMessages', { myId: userId, friendId, skip: messages.length });
            setIsMsgLoading(true);
            setHasMoreMessages(false);
        }
    }, [scrollPercent, hasMoreMessages, messages.length, userId, friendId]);

    const scrollToLastMessage = (forceInstant = false) => {
        if (!msgListRef.current || isMinimized) return;

        const scrollToBottom = () => {
            const el = msgListRef.current;
            if (!el) return;

            const maxScroll = el.scrollHeight - el.clientHeight;
            const currentScroll = el.scrollTop;
            
            // If we're not at the bottom, scroll there
            if (Math.abs(currentScroll - maxScroll) > 1) {
                el.scrollTop = el.scrollHeight;
                
                // Use requestAnimationFrame to keep checking and scrolling until we're at the exact bottom
                requestAnimationFrame(() => {
                    const newMaxScroll = el.scrollHeight - el.clientHeight;
                    const newCurrentScroll = el.scrollTop;
                    
                    // If scrollHeight changed (content loaded) or we're still not at bottom, scroll again
                    if (Math.abs(newCurrentScroll - newMaxScroll) > 1 || newMaxScroll !== maxScroll) {
                        el.scrollTop = el.scrollHeight;
                        // Try one more time after a short delay to catch any late-loading content
                        setTimeout(() => {
                            el.scrollTop = el.scrollHeight;
                        }, 50);
                    }
                });
            }
        };

        if (forceInstant) {
            // For instant scroll, do it immediately
            setTimeout(scrollToBottom, 0);
        } else {
            // For smooth scroll, use scrollIntoView first, then ensure exact bottom
            setTimeout(() => {
                const lastMsg = msgListRef.current?.querySelector('.chat-message-container:last-child');
                if (lastMsg) {
                    lastMsg.scrollIntoView({ behavior: "smooth", block: "end" });
                    // After smooth scroll completes, ensure exact bottom
                    setTimeout(scrollToBottom, 500);
                } else {
                    scrollToBottom();
                }
            }, 100);
        }
    };

    // Scroll to bottom when chat is restored from minimized state
    useEffect(() => {
        // Check if chat was just restored from minimized state
        const wasMinimized = previousMinimizedStateRef.current;
        previousMinimizedStateRef.current = isMinimized;

        if (!isMinimized && wasMinimized && messages.length > 0 && msgListRef.current) {
            // Chat was just restored from minimized - scroll to exact bottom
            setTimeout(() => {
                scrollToLastMessage(true); // Use instant scroll for restoration
            }, 150);
        }
    }, [isMinimized, messages.length]);

    // Scroll to bottom when messages are first loaded (after loading completes)
    useEffect(() => {
        if (!isMinimized && !isLoading && messages.length > 0 && friendProfile?._id && !hasScrolledOnLoadRef.current && msgListRef.current) {
            // First time messages are loaded - scroll to exact bottom
            hasScrolledOnLoadRef.current = true;
            setTimeout(() => {
                scrollToLastMessage(true); // Use instant scroll for initial load
            }, 250);
        }
    }, [isLoading, friendProfile?._id, messages.length, isMinimized]);

    // Scroll to exact bottom when new messages arrive
    useEffect(() => {
        if (!isMinimized && messages.length > 0 && msgListRef.current) {
            // Use a small delay to ensure DOM is updated with new message
            const timeoutId = setTimeout(() => {
                const el = msgListRef.current;
                if (!el) return;

                // Keep scrolling until we're at the exact bottom
                const ensureExactBottom = () => {
                    const maxScroll = el.scrollHeight - el.clientHeight;
                    const currentScroll = el.scrollTop;
                    
                    if (Math.abs(currentScroll - maxScroll) > 1) {
                        el.scrollTop = el.scrollHeight;
                        // Check again after a short delay
                        requestAnimationFrame(() => {
                            setTimeout(() => {
                                const newMaxScroll = el.scrollHeight - el.clientHeight;
                                const newCurrentScroll = el.scrollTop;
                                if (Math.abs(newCurrentScroll - newMaxScroll) > 1) {
                                    el.scrollTop = el.scrollHeight;
                                }
                            }, 50);
                        });
                    }
                };

                ensureExactBottom();
            }, 100);

            return () => clearTimeout(timeoutId);
        }
    }, [messages.length, isMinimized]);

    const footerProps = {
        room,
        friendId,
        setIsTyping,
        userId,
        replyData,
        setReplyData,
        messages,
        friendProfile,
        msgListRef,
        isAi: false
    };

    if (isMinimized) {
        return (
            <div className="sticky-chat-box minimized" style={{ zIndex }}>
                <div className="sticky-chat-minimized-header" onClick={onMinimize}>
                    <div className="sticky-chat-minimized-avatar">
                        {isLoading ? (
                            <div className="sticky-chat-skeleton-avatar"></div>
                        ) : (
                            <UserPP profilePic={friendProfile?.profilePic} profile={friendId} active={isActive} />
                        )}
                    </div>
                    <div className="sticky-chat-minimized-info">
                        <div className="sticky-chat-minimized-name">
                            {isLoading ? (
                                <div className="sticky-chat-skeleton-text" style={{ width: '100px', height: '14px' }}></div>
                            ) : (
                                friendProfile?.fullName || `${friendProfile?.user?.firstName || ''} ${friendProfile?.user?.surname || ''}`.trim() || 'Loading...'
                            )}
                        </div>
                        <div className="sticky-chat-minimized-status">
                            {isLoading ? (
                                <div className="sticky-chat-skeleton-text" style={{ width: '80px', height: '11px', marginTop: '4px' }}></div>
                            ) : (
                                isActive ? 'Active now' : lastSeen ? `Last seen ${lastSeen}` : 'Offline'
                            )}
                        </div>
                    </div>
                    <div className="sticky-chat-minimized-actions">
                        <button className="sticky-chat-action-btn" onClick={(e) => { e.stopPropagation(); onMinimize(); }}>
                            <i className="fas fa-window-maximize"></i>
                        </button>
                        <button className="sticky-chat-action-btn" onClick={(e) => { e.stopPropagation(); onClose(); }}>
                            <i className="fas fa-times"></i>
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="sticky-chat-box" style={{ zIndex }}>
            <div className="sticky-chat-header" ref={chatHeader}>
                <div className="sticky-chat-header-info">
                    <div className="sticky-chat-header-avatar">
                        {isLoading ? (
                            <div className="sticky-chat-skeleton-avatar"></div>
                        ) : (
                            <UserPP profilePic={friendProfile?.profilePic} profile={friendId} active={isActive} />
                        )}
                    </div>
                    <div className="sticky-chat-header-details">
                        <div className="sticky-chat-header-name">
                            {isLoading ? (
                                <div className="sticky-chat-skeleton-text" style={{ width: '120px', height: '15px' }}></div>
                            ) : (
                                friendProfile?.fullName || `${friendProfile?.user?.firstName || ''} ${friendProfile?.user?.surname || ''}`.trim() || 'Loading...'
                            )}
                        </div>
                        <div className="sticky-chat-header-status">
                            {isLoading ? (
                                <div className="sticky-chat-skeleton-text" style={{ width: '100px', height: '12px', marginTop: '4px' }}></div>
                            ) : (
                                isActive ? 'Active now' : lastSeen ? `Last seen ${lastSeen}` : 'Offline'
                            )}
                        </div>
                    </div>
                </div>
                <div className="sticky-chat-header-actions">
                    <div className="sticky-chat-options-wrapper">
                        <button 
                            ref={optionsButtonRef}
                            className="sticky-chat-action-btn" 
                            onClick={() => setShowOptionsMenu(!showOptionsMenu)} 
                            title="More options"
                        >
                            <i className="fas fa-ellipsis-v"></i>
                        </button>
                    </div>
                    <button className="sticky-chat-action-btn" onClick={onMinimize} title="Minimize">
                        <i className="fas fa-minus"></i>
                    </button>
                    <button className="sticky-chat-action-btn" onClick={onClose} title="Close">
                        <i className="fas fa-times"></i>
                    </button>
                </div>
            </div>

            <div className="sticky-chat-body">
                <div className="sticky-chat-message-list" id="chatMessageList" ref={msgListRef}>
                    {isLoading || messages.length === 0 ? (
                        <SingleMsgSkleton count={5} />
                    ) : (
                        messages.map((msg, index) => (
                            <SingleMessage
                                key={msg._id ? `${msg._id}-${index}` : `msg-${index}`}
                                msg={msg}
                                friendProfile={friendProfile}
                                messages={messages}
                                isActive={isActive}
                                setIsReplying={setIsReplying}
                                setReplyData={setReplyData}
                                isPreview={isPreview}
                                setIsPreview={setIsPreview}
                                msgListRef={msgListRef}
                                isMsgLoading={isMsgLoading}
                            />
                        ))
                    )}

                    {isTyping && (
                        <div className={`chat-message-container message-receive message-typing`}>
                            <div className="chat-message-profilePic">
                                <UserPP profilePic={friendProfile.profilePic} profile={friendId} active={isActive} />
                            </div>
                            <div className="chat-message">
                                <p className="message-container mb-0">
                                    {typeMessage || (
                                        <div className="typing-indicator">
                                            <span className="typing-dots"></span>
                                            <span className="typing-dots"></span>
                                            <span className="typing-dots"></span>
                                        </div>
                                    )}
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {isLoading ? (
                <div ref={chatFooter} className="sticky-chat-footer">
                    <div className="sticky-chat-footer-skeleton">
                        <div className="sticky-chat-skeleton-text" style={{ width: '100%', height: '40px', borderRadius: '20px' }}></div>
                    </div>
                </div>
            ) : !isBlockedMe ? (
                <div ref={chatFooter} className="sticky-chat-footer">
                    <StickyChatFooter {...footerProps} />
                </div>
            ) : (
                <div ref={chatFooter} className="sticky-chat-footer">
                    <div className="sticky-chat-blocked-message">
                        <i className="fas fa-ban"></i>
                        <span>{friendProfile?.fullName || `${friendProfile?.user?.firstName || ''} ${friendProfile?.user?.surname || ''}`} Blocked You</span>
                    </div>
                </div>
            )}

            {showOptionsMenu && createPortal(
                <div 
                    ref={optionsMenuRef}
                    className="sticky-chat-options-menu"
                    style={{
                        top: `${menuPosition.top}px`,
                        right: `${menuPosition.right}px`
                    }}
                >
                    <button 
                        className="sticky-chat-option-item"
                        onClick={() => {
                            // Audio Call - dispatch custom event similar to video calls
                            const channelName = `${userId}-${friendId}`;
                            window.dispatchEvent(new CustomEvent('startAudioCall', {
                                detail: {
                                    to: friendId,
                                    channelName,
                                    callerName: friendProfile?.fullName || `${friendProfile?.user?.firstName} ${friendProfile?.user?.surname}` || 'Friend',
                                    callerProfilePic: friendProfile?.profilePic
                                }
                            }));
                            // Also emit socket event for server-side handling
                            socket.emit('audio-call', { to: friendId, channelName, isAudio: true });
                            setShowOptionsMenu(false);
                        }}
                    >
                        <i className="fas fa-phone-alt"></i>
                        <span>Audio Call</span>
                    </button>
                    <button 
                        className="sticky-chat-option-item"
                        onClick={() => {
                            // Video Call - dispatch custom event similar to audio calls
                            const channelName = `${userId}-${friendId}`;
                            window.dispatchEvent(new CustomEvent('startVideoCall', {
                                detail: {
                                    to: friendId,
                                    channelName,
                                    callerName: friendProfile?.fullName || `${friendProfile?.user?.firstName} ${friendProfile?.user?.surname}` || 'Friend',
                                    callerProfilePic: friendProfile?.profilePic,
                                    isAudio: false
                                }
                            }));
                            // Also emit socket event for server-side handling
                            socket.emit('video-call', { to: friendId, channelName, isAudio: false });
                            setShowOptionsMenu(false);
                        }}
                    >
                        <i className="fas fa-video"></i>
                        <span>Video Call</span>
                    </button>
                    <button 
                        className="sticky-chat-option-item"
                        onClick={() => {
                            // Bump
                            socket.emit('bump', { friendProfile: friendId, myProfile: userId });
                            setShowOptionsMenu(false);
                        }}
                    >
                        <i className="fas fa-record-vinyl"></i>
                        <span>Bump</span>
                    </button>
                    <button 
                        className="sticky-chat-option-item"
                        onClick={() => {
                            handleLiveVoiceButtonClick();
                            setShowOptionsMenu(false);
                        }}
                    >
                        <i className="fas fa-microphone-alt"></i>
                        <span>{isLiveVoiceActive ? 'Stop Live Voice' : 'Start Live Voice'}</span>
                    </button>
                    <div className="sticky-chat-options-divider"></div>
                    <button 
                        className="sticky-chat-option-item"
                        onClick={() => {
                            handleChatInfoClick();
                            setShowOptionsMenu(false);
                        }}
                    >
                        <i className="fas fa-info-circle"></i>
                        <span>User Info</span>
                    </button>
                    <div className="sticky-chat-options-divider"></div>
                    <button 
                        className="sticky-chat-option-item"
                        onClick={() => {
                            window.location.href = `/profile/${friendId}`;
                            setShowOptionsMenu(false);
                        }}
                    >
                        <i className="fas fa-user"></i>
                        <span>View Profile</span>
                    </button>
                    <button 
                        className="sticky-chat-option-item"
                        onClick={() => {
                            navigate(`/message/${friendId}`);
                            setShowOptionsMenu(false);
                        }}
                    >
                        <i className="fas fa-expand"></i>
                        <span>Open in Full Chat</span>
                    </button>
                    <button 
                        className="sticky-chat-option-item"
                        onClick={() => {
                            // TODO: Implement mute functionality
                            setShowOptionsMenu(false);
                        }}
                    >
                        <i className="fas fa-bell-slash"></i>
                        <span>Mute Notifications</span>
                    </button>
                    <div className="sticky-chat-options-divider"></div>
                    <button 
                        className="sticky-chat-option-item danger"
                        onClick={() => {
                            if (window.confirm('Are you sure you want to block this user?')) {
                                // TODO: Implement block functionality
                                setShowOptionsMenu(false);
                            }
                        }}
                    >
                        <i className="fas fa-ban"></i>
                        <span>Block User</span>
                    </button>
                    <button 
                        className="sticky-chat-option-item danger"
                        onClick={() => {
                            if (window.confirm('Are you sure you want to delete this conversation?')) {
                                // TODO: Implement delete conversation functionality
                                setShowOptionsMenu(false);
                            }
                        }}
                    >
                        <i className="fas fa-trash"></i>
                        <span>Delete Conversation</span>
                    </button>
                </div>,
                document.body
            )}

            {/* User Info Modal */}
            <ModalContainer
                title="User Information"
                style={{ width: isMobile ? '95%' : '700px', maxHeight: '90vh', overflow: 'auto' }}
                isOpen={isUserInfoModalOpen}
                onRequestClose={() => setIsUserInfoModalOpen(false)}
                id="stickyUserInfoModal"
            >
                <div className="user-info-modal-content">
                    {loadingUserInfo ? (
                        <div className="user-info-loading">
                            <div className="loading-spinner"></div>
                            <p>Loading user information...</p>
                        </div>
                    ) : (
                        <>
                            <div className="user-info-header">
                                <div className="user-info-avatar-container">
                                    <img 
                                        src={getUserProfilePic()} 
                                        alt={getUserName()}
                                        className="user-info-avatar"
                                        onError={(e) => {
                                            e.target.src = 'https://via.placeholder.com/120?text=User';
                                        }}
                                    />
                                    {isActive && (
                                        <span className="user-info-status-badge active"></span>
                                    )}
                                </div>
                                <h2 className="user-info-name">{getUserName()}</h2>
                                {isActive ? (
                                    <span className="user-info-status-text active">Online</span>
                                ) : (
                                    <span className="user-info-status-text">Offline</span>
                                )}
                            </div>

                            <div className="user-info-cards">
                                {(friendLocation || userInfoData?.lastLocation || friendProfile?.lastLocation) && (
                                    <div className="user-info-card" style={{ padding: 0, overflow: 'hidden', width: '100%' }}>
                                        <div style={{
                                            width: '100%',
                                            height: '400px',
                                            position: 'relative',
                                            overflow: 'hidden'
                                        }}>
                                            {mapLoading && (
                                                <div style={{
                                                    position: 'absolute',
                                                    top: 0,
                                                    left: 0,
                                                    right: 0,
                                                    bottom: 0,
                                                    display: 'flex',
                                                    justifyContent: 'center',
                                                    alignItems: 'center',
                                                    backgroundColor: 'rgba(0,0,0,0.1)',
                                                    zIndex: 1
                                                }}>
                                                    <div style={{
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        alignItems: 'center',
                                                        gap: '10px'
                                                    }}>
                                                        <div className="spinner-border text-primary" role="status">
                                                            <span className="visually-hidden">Loading...</span>
                                                        </div>
                                                        <p style={{ color: '#666', margin: 0 }}>Loading map...</p>
                                                    </div>
                                                </div>
                                            )}
                                            <div 
                                                ref={mapRef}
                                                style={{
                                                    width: '100%',
                                                    height: '100%',
                                                    minHeight: '400px'
                                                }}
                                            />
                                        </div>
                                    </div>
                                )}

                                <div className="user-info-card">
                                    <div className="user-info-card-icon active">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <circle cx="12" cy="12" r="10"></circle>
                                            <polyline points="12 6 12 12 16 14"></polyline>
                                        </svg>
                                    </div>
                                    <div className="user-info-card-content">
                                        <h3 className="user-info-card-label">Last Active</h3>
                                        <p className="user-info-card-value">{formatLastActive(lastSeen)}</p>
                                    </div>
                                </div>

                                <div className="user-info-card">
                                    <div className="user-info-card-icon emotion">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <circle cx="12" cy="12" r="10"></circle>
                                            <path d="M8 14s1.5 2 4 2 4-2 4-2"></path>
                                            <line x1="9" y1="9" x2="9.01" y2="9"></line>
                                            <line x1="15" y1="9" x2="15.01" y2="9"></line>
                                        </svg>
                                    </div>
                                    <div className="user-info-card-content">
                                        <h3 className="user-info-card-label">Current Emotion</h3>
                                        <p className="user-info-card-value emotion-value">{getUserEmotion()}</p>
                                    </div>
                                </div>

                                <div className="user-info-card">
                                    <div className="user-info-card-icon action">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
                                        </svg>
                                    </div>
                                    <div className="user-info-card-content">
                                        <h3 className="user-info-card-label">Last Action</h3>
                                        <p className="user-info-card-value">{getLastAction()}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="user-info-footer">
                                <button 
                                    className="user-info-action-btn primary"
                                    onClick={() => {
                                        setIsUserInfoModalOpen(false);
                                        window.location.href = `/profile/${friendId}`;
                                    }}
                                >
                                    View Full Profile
                                </button>
                                <button 
                                    className="user-info-action-btn secondary"
                                    onClick={() => setIsUserInfoModalOpen(false)}
                                >
                                    Close
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </ModalContainer>

            {/* Live Voice Modal */}
            <LiveVoiceModal
                isOpen={isLiveVoiceModalOpen}
                onClose={() => setIsLiveVoiceModalOpen(false)}
                isActive={isLiveVoiceActive}
                duration={liveVoiceDuration}
                isConnecting={false}
                role={isLiveVoiceActive ? "publisher" : "receiver"}
                friendName={friendProfile?.fullName || friendProfile?.user?.firstName || 'Friend'}
                onStop={handleLiveVoiceButtonClick}
            />
        </div>
    );
};

export default StickyChatBox;
