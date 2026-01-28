import React, { Fragment, useEffect, useState, useRef } from "react";
import { ToastContainer } from 'react-toastify';
import { Routes, Route, useParams, useLocation } from 'react-router-dom'
import NProgress from 'nprogress';
import { showMessageToast } from '../utils/toastUtils';
import 'react-toastify/dist/ReactToastify.css';
import '../components/Toast/CustomToast.css';
import webNotificationService from '../services/webNotificationService';
import socket from '../common/socket';
import Header from '../partials/header/Header';
import ProtectedRoute from "../components/ProtectedRoute.js";
import { useAuth } from '../hooks/useAuth';
import Home from "./Home";
import Profile from "./Profile";
import Friends from "./Friends";
import Video from "./Video.js";
import Marketplace from './Marketplace'
import Groups from './Groups'
import Menu from './Menu'
import YtDownload from "./YtDownload.js";
import Message from "./Message";
import Story from "./Story";
import StoryReacts from "../components/story/StoryReacts.js";
import StoryComments from "../components/story/StoryComments.js";
import SingleStory from "../components/story/SingleStory";
import SingleWatch from "../components/watch/SingleWatch.js";
import ProfileAbout from "../components/Profile/ProfileAbout";
import PorfilePosts from "../components/Profile/PorfilePosts";
import ProfileFriends from "../components/Profile/ProfileFriends";
import ProfileImages from "../components/Profile/ProfileImages.js";
import ProfileVideos from '../components/Profile/ProfileVideos.js'
import VideoCall from "../components/VideoCall/VideoCall.js";
import AudioCall from "../components/AudioCall/AudioCall.js";
import SinglePost from "../components/post/SinglePost.js";
import NotificationTest from "../components/NotificationTest.js";
import PostComments from "../components/post/PostComments.js";
import PostReacts from "../components/post/PostReacts.js";
import Login from "./Login.js";
import SignUP from "./SignUp.js";
import MinimizedCallBar from "../components/MinimizedCallBar/MinimizedCallBar.js";
import StickyChatBoxContainer from "../components/Message/StickyChatBoxContainer.js";
import config from "../config/config.json";
import audioPreloader from "../utils/audioPreloader";
import IosAddToHomeScreen from "../components/IosAddToHomeScreen";

// portoflio
import PortfolioContainer from "./portfolio/PortfolioContainer.js";
import PortfolioContact from "./portfolio/PortfolioContact.js";
import PortfolioHome from "./portfolio/PortfolioHome.js";
import PortfolioAbout from "./portfolio/PortfolioAbout.js";
import PortfolioBlog from "./portfolio/PortfolioBlog.js";
import PortfolioResume from "./portfolio/PortfolioResume.js";

import FriendRequests from "../components/friend/FriendRequests";
import FriendSuggest from "../components/friend/FriendSuggest"
import FriendHome from "../components/friend/FriendHome";
import PlacesNearYou from "../components/friend/PlacesNearYou";
import { useDispatch, useSelector } from "react-redux";
import api from "../api/api";
import { getPorfileReq, getProfileFailed, getProfileSuccess } from '../services/actions/profileActions'
import { addNotification, addNotifications } from "../services/actions/notificationActions.js";
import { addMessages, newMessage } from "../services/actions/messageActions.js";
import { setBodyHeight, setLoading } from "../services/actions/optionAction";
import Settings from "./Settings";
import { loadSettings } from "../services/actions/settingsActions.js";
import ProfileSetting from "../components/setting/ProfileSetting.js";
import AccountSetting from "../components/setting/AccountSetting.js";
import PrivacySetting from "../components/setting/PrivacySetting.js";
import NotificationSetting from "../components/setting/NotificationSetting.js";
import MessageSetting from "../components/setting/MessageSetting.js";
import PreferenceSetting from "../components/setting/PreferenceSetting.js";
import SoundSetting from "../components/setting/SoundSetting.js";
import CacheSetting from "../components/setting/CacheSetting.js";

import VideoCallPage from "./VideoCallPage.js";

import Youtebe from "./Youtebe.js";

import SingleVideo from "../components/downloads/SingleVideo.js";
import SavedVideos from "./SavedVideos.js";
import LudoGame from "./ludo";
import ChessGame from "./ChessGame";
import VideoPlayer from "./VideoPlayer.js";
import Notes from "./Notes.js";
import Tasks from "./Tasks.js";
import FocusTimer from "./FocusTimer.js";
import Flashcards from "./Flashcards.js";
import Calendar from "./Calendar.js";
import Habits from "./Habits.js";

// import MicRecorder from 'mic-recorder-to-mp3';
// const recorder = new MicRecorder({ bitRate: 128 });
// recorder.start().then(() => {
//   console.log("Recording...");
// });

// // Stop and send to backend
// recorder.stop().getMp3().then(([buffer, blob]) => {
//   const file = new File(buffer, 'voice.mp3');
//   const reader = new FileReader();
//   reader.onload = () => {
//     const audioBase64 = reader.result.split(',')[1];
//     socket.emit('audio', audioBase64); // send base64 audio
//   };
//   reader.readAsDataURL(file);
// });




function showNotification(msg, receiverId) {
    const notification = new Notification("New Message!", {
        body: msg.message,
        icon: config?.logo
    });

    // Handle click event
    notification.onclick = () => {
        window.open(`${process.env.REACT_APP_URL}/message/${receiverId}`);
    };
}

const speakText = (text) => {
    if (!text) return;

    const speech = new SpeechSynthesisUtterance(text);
    speech.lang = "en-US"; // Change language if needed
    speech.rate = 1; // Speed (0.5 - 2)
    speech.pitch = 1; // Pitch (0 - 2)

    window.speechSynthesis.speak(speech);
};

// Track recently processed messages to prevent duplicate toasts (shared across component instances)
const recentMessageToasts = new Map(); // messageId -> timestamp
const TOAST_DEDUP_WINDOW = 3000; // 3 seconds

const Main = () => {
    const dispatch = useDispatch();
    const { token, user, isAuthenticated, logout } = useAuth();
    const isLoading = useSelector(state => state.option.isLoading);
    // const settings = useSelector(state => state.setting)
    const params = useParams();
    const location = useLocation();
    const audioElement = useRef(null)
    const [audioReady, setAudioReady] = useState(false)

    // Create audio element dynamically only when needed
    const getOrCreateAudioElement = () => {
        if (!audioElement.current) {
            const audio = document.createElement('audio');
            audio.preload = 'none';
            audio.muted = true;
            audio.style.display = 'none';
            document.body.appendChild(audio);
            audioElement.current = audio;
        }
        return audioElement.current;
    }

    const [isTabActive, setIsTabActive] = useState(!document.hidden);

    const profileId = user?.profile

    useEffect(() => {
        if (!token || !profileId || !isAuthenticated) return;
        
        const abortController = new AbortController();
        
        api.get('setting', {
            params: {
                profileId
            },
            signal: abortController.signal
        }).then(res => {
            if (res.status == 200) {
                dispatch(loadSettings(res.data))
            }
        }).catch(err => {
            // Don't log aborted requests as errors
            if (err.code !== 'ECONNABORTED' && err.name !== 'CanceledError') {
                console.error('Error fetching settings:', err);
            }
        });
        
        return () => {
            abortController.abort();
        };
    }, [token, profileId, isAuthenticated, dispatch])

    // Initialize web notifications
    useEffect(() => {
        if (profileId && token && isAuthenticated) {
            const initializeNotifications = async () => {
                try {
                    const success = await webNotificationService.initialize(profileId, api);
                    if (success) {
                        console.log('Web notifications initialized successfully');
                        

                    }
                } catch (error) {
                    console.error('Failed to initialize web notifications:', error);
                }
            };

            initializeNotifications();
        }

        // Cleanup on unmount
        return () => {
            if (profileId && isAuthenticated) {
                webNotificationService.cleanup(profileId, api).catch(err => 
                    console.error('Failed to cleanup web notifications:', err)
                );
            }
        };
    }, [profileId, token, isAuthenticated])


    const playSound = async () => {
        try {
            // Use preloaded audio for better performance and background playback
            await audioPreloader.playNotificationSound();
        } catch (e) {
            console.warn('Audio play error, falling back to legacy method:', e);
            // Fallback to legacy method if preloader fails
            try {
                const el = getOrCreateAudioElement();
                const targetSrc = config?.defaultNotificationSound;
                if (!targetSrc) {
                    console.warn('Notification sound URL not configured');
                    return;
                }
                
                const currentSrc = el.src || '';
                if (!currentSrc || currentSrc.includes('data:audio') || currentSrc !== targetSrc) {
                    el.src = targetSrc;
                    el.load();
                }
                
                el.currentTime = 0;
                el.muted = false;
                
                const playPromise = el.play();
                if (playPromise !== undefined) {
                    playPromise.catch(error => {
                        if (!audioReady) {
                            console.warn('Notification sound blocked, attempting to unlock...');
                            const tryUnlock = async () => {
                                try {
                                    const silentAudio = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=');
                                    silentAudio.muted = true;
                                    await silentAudio.play();
                                    silentAudio.pause();
                                    setAudioReady(true);
                                    el.play().catch(err => {
                                        console.warn('Failed to play notification sound after unlock:', err);
                                    });
                                } catch (unlockError) {
                                    console.warn('Failed to unlock audio:', unlockError);
                                }
                            };
                            tryUnlock();
                        } else {
                            console.warn('Failed to play notification sound:', error);
                        }
                    });
                }
            } catch (fallbackError) {
                console.warn('Fallback audio play also failed:', fallbackError);
            }
        }
    }
    const notify = (text, senderName, senderPP, link) => {
        playSound();
        showMessageToast(text, senderName, senderPP, link);
    }

    useEffect(() => {
        // Wait for both profileId AND token to be available
        if (!profileId || !token || !isAuthenticated) {
            console.log('⏳ Waiting for auth...', { profileId: !!profileId, token: !!token, isAuthenticated });
            return;
        }

        console.log('✅ Fetching initial data with auth');

        const abortController = new AbortController();

        api.get('message/chatList', {
            params: {
                profileId
            },
            signal: abortController.signal
        }).then(res => {
            dispatch(addMessages(res.data, true))

            console.log('oldMessages', res.data)
            dispatch(addMessages(res?.data?.reverse(), true))
        }).catch(err => {
            // Don't log aborted requests as errors
            if (err.code !== 'ECONNABORTED' && err.name !== 'CanceledError') {
                console.error('Error fetching messages:', err);
            }
        });

        api.get('notification/', {
            params: {
                profileId
            },
            signal: abortController.signal
        }).then(res => {

            console.log('oldNotifications', res.data)
            dispatch(addNotifications(res?.data))

        }).catch(err => {
            // Don't log aborted requests as errors
            if (err.code !== 'ECONNABORTED' && err.name !== 'CanceledError') {
                console.error('Error fetching notifications:', err);
            }
        });

        return () => {
            abortController.abort();
        };
    }, [profileId, token, isAuthenticated, dispatch])

    // Unlock audio on first user interaction (autoplay policy)
    useEffect(() => {
        const unlock = () => {
            const tryUnlock = async () => {
                try {
                    // Create audio element dynamically only when unlocking
                    const el = getOrCreateAudioElement();
                    // Use silent audio data URL for unlocking (prevents downloading notification sound)
                    // Generate a valid WAV file with proper headers and sample data
                    const sampleRate = 44100;
                    const duration = 0.1; // 100ms
                    const numSamples = Math.floor(sampleRate * duration);
                    const numChannels = 1;
                    const bitsPerSample = 16;
                    const bytesPerSample = bitsPerSample / 8;
                    const dataSize = numSamples * numChannels * bytesPerSample;
                    
                    // WAV file structure
                    const buffer = new ArrayBuffer(44 + dataSize);
                    const view = new DataView(buffer);
                    
                    // RIFF header
                    const writeString = (offset, string) => {
                        for (let i = 0; i < string.length; i++) {
                            view.setUint8(offset + i, string.charCodeAt(i));
                        }
                    };
                    
                    writeString(0, 'RIFF');
                    view.setUint32(4, 36 + dataSize, true); // File size - 8
                    writeString(8, 'WAVE');
                    
                    // fmt chunk
                    writeString(12, 'fmt ');
                    view.setUint32(16, 16, true); // fmt chunk size
                    view.setUint16(20, 1, true); // Audio format (PCM)
                    view.setUint16(22, numChannels, true);
                    view.setUint32(24, sampleRate, true);
                    view.setUint32(28, sampleRate * numChannels * bytesPerSample, true); // Byte rate
                    view.setUint16(32, numChannels * bytesPerSample, true); // Block align
                    view.setUint16(34, bitsPerSample, true);
                    
                    // data chunk
                    writeString(36, 'data');
                    view.setUint32(40, dataSize, true);
                    // Data is already zeros (silence) since ArrayBuffer initializes to 0
                    
                    // Convert to base64
                    const bytes = new Uint8Array(buffer);
                    let binary = '';
                    for (let i = 0; i < bytes.length; i++) {
                        binary += String.fromCharCode(bytes[i]);
                    }
                    const base64 = btoa(binary);
                    const silentAudio = `data:audio/wav;base64,${base64}`;
                    el.src = silentAudio;
                    el.muted = true;
                    el.currentTime = 0;
                    await el.play();
                    el.pause();
                    el.currentTime = 0;
                    el.muted = false;
                    // Clear src after unlock so notification sound can be lazy loaded
                    el.removeAttribute('src');
                    setAudioReady(true);
                    console.log('🔊 Notification audio unlocked');
                } catch (e) {
                    console.warn('Audio unlock attempt failed:', e);
                }
            };
            tryUnlock();
        };
        window.addEventListener('click', unlock, { once: true });
        window.addEventListener('keydown', unlock, { once: true });
        window.addEventListener('touchstart', unlock, { once: true });
        return () => {
            window.removeEventListener('click', unlock);
            window.removeEventListener('keydown', unlock);
            window.removeEventListener('touchstart', unlock);
        };
    }, []);

    // HTTP-based notification polling
    const fetchNotifications = async () => {
        try {
            const response = await api.get('/notification/new', {
                params: { profileId }
            });
            
            if (response.data.notifications && response.data.notifications.length > 0) {
                response.data.notifications.forEach(notification => {
                    dispatch(addNotification(notification));
                    
                    // Skip toast and browser notification for message types
                    if (notification.type !== 'message') {
                        notify(notification.text, false, notification.icon, notification.link);
                        
                        // Show browser notification if permission is granted
                        if (webNotificationService.isPermissionGranted) {
                            const browserNotification = new Notification(notification.title || 'Connect', {
                                body: notification.text,
                                icon: notification.icon || '/logo192.png',
                                tag: `notification_${notification._id || Date.now()}`,
                                data: {
                                    url: notification.link || '/',
                                    notificationId: notification._id
                                }
                            });

                            browserNotification.onclick = () => {
                                window.open(notification.link || '/', '_self');
                                browserNotification.close();
                            };

                            setTimeout(() => {
                                browserNotification.close();
                            }, 5000);
                        }
                    }
                });
            }
        } catch (error) {
            console.error('Error fetching notifications:', error);
        }
    };

    // HTTP-based message polling
    const fetchNewMessages = async () => {
        try {
            const response = await api.get('/message/new-messages', {
                params: { profileId }
            });
            
            if (response.data.messages && response.data.messages.length > 0) {
                response.data.messages.forEach(updatedMessage => {
                    dispatch(newMessage(updatedMessage, profileId));
                    
                    // Update sender's online status
                    if (updatedMessage.senderId) {
                        const friendOnlineEvent = new CustomEvent('friend_online_client', {
                            detail: { profileId: updatedMessage.senderId }
                        });
                        window.dispatchEvent(friendOnlineEvent);
                    }
                    
                    // Client-side deduplication
                    const messageId = updatedMessage._id?.toString() || updatedMessage._id;
                    const now = Date.now();
                    const lastToastTime = recentMessageToasts.get(messageId);
                    
                    if (lastToastTime && (now - lastToastTime) < TOAST_DEDUP_WINDOW) {
                        return;
                    }
                    
                    recentMessageToasts.set(messageId, now);
                    
                    // Clean up old entries
                    for (const [msgId, timestamp] of recentMessageToasts.entries()) {
                        if (now - timestamp > TOAST_DEDUP_WINDOW) {
                            recentMessageToasts.delete(msgId);
                        }
                    }
                    
                    // Show notification
                    const senderName = updatedMessage.senderName || 'Friend';
                    const senderPP = updatedMessage.senderPP || '/default-avatar.png';
                    notify(updatedMessage.message, senderName, senderPP, '/message/' + updatedMessage.senderId);
                    
                    // Handle sticky chat opening
                    const isOnMessagePage = window.location.pathname.startsWith('/message');
                    if (!isOnMessagePage && updatedMessage.senderId) {
                        const isChatOpen = typeof window.isStickyChatOpen === 'function' 
                            ? window.isStickyChatOpen(updatedMessage.senderId) 
                            : false;
                        
                        if (!isChatOpen) {
                            const openChatEvent = new CustomEvent('openStickyChat', {
                                detail: { profileId: updatedMessage.senderId }
                            });
                            window.dispatchEvent(openChatEvent);
                        }
                    }
                });
            }
        } catch (error) {
            console.error('Error fetching new messages:', error);
        }
    };

    useEffect(() => {
        if (!profileId) return;

        // Initial fetch
        fetchNotifications();
        fetchNewMessages();
        
        // Poll for notifications every 30 seconds (keep this as it's for general notifications)
        const notificationInterval = setInterval(fetchNotifications, 30000);
        
        // Listen for new messages via socket instead of polling
        const handleNewMessageToUser = (data) => {
            console.log('Main received new message via socket:', data);
            if (data.updatedMessage && data.updatedMessage.receiverId === profileId) {
                // Process the message for notifications and UI updates
                const updatedMessage = data.updatedMessage;
                
                // Update sender's online status
                if (updatedMessage.senderId) {
                    const friendOnlineEvent = new CustomEvent('friend_online_client', {
                        detail: { profileId: updatedMessage.senderId }
                    });
                    window.dispatchEvent(friendOnlineEvent);
                }
                
                // Client-side deduplication
                const messageId = updatedMessage._id?.toString() || updatedMessage._id;
                const now = Date.now();
                const lastToastTime = recentMessageToasts.get(messageId);
                
                if (lastToastTime && (now - lastToastTime) < TOAST_DEDUP_WINDOW) {
                    return;
                }
                
                recentMessageToasts.set(messageId, now);
                
                // Clean up old entries
                for (const [msgId, timestamp] of recentMessageToasts.entries()) {
                    if (now - timestamp > TOAST_DEDUP_WINDOW) {
                        recentMessageToasts.delete(msgId);
                    }
                }
                
                // Show notification
                const senderName = data.senderName || 'Friend';
                const senderPP = data.senderPP || '/default-avatar.png';
                notify(updatedMessage.message, senderName, senderPP, '/message/' + updatedMessage.senderId);
                
                // Handle sticky chat opening
                const isOnMessagePage = window.location.pathname.startsWith('/message');
                if (!isOnMessagePage && updatedMessage.senderId) {
                    const isChatOpen = typeof window.isStickyChatOpen === 'function' 
                        ? window.isStickyChatOpen(updatedMessage.senderId) 
                        : false;
                    
                    if (!isChatOpen) {
                        const openChatEvent = new CustomEvent('openStickyChat', {
                            detail: { profileId: updatedMessage.senderId }
                        });
                        window.dispatchEvent(openChatEvent);
                    }
                }
                
                // Dispatch message for Redux state
                dispatch(newMessage(updatedMessage, profileId));
            }
        };

        socket.on('newMessageToUser', handleNewMessageToUser);

        return () => {
            clearInterval(notificationInterval);
            socket.off('newMessageToUser', handleNewMessageToUser);
        };
    }, [profileId]);

    useEffect(() => {
        if (!profileId) return;

        // Listen for notification events (toast notifications)
        socket.on('notification', (msg, senderName, senderPP) => {
            if (isTabActive == true) {
                // Client-side deduplication
                const messageId = msg._id?.toString() || msg._id || `${msg.senderId}_${msg.message?.substring(0, 50)}`;
                const now = Date.now();
                const lastToastTime = recentMessageToasts.get(messageId);
                
                if (lastToastTime && (now - lastToastTime) < TOAST_DEDUP_WINDOW) {
                    return;
                }
                
                recentMessageToasts.set(messageId, now);
                
                for (const [msgId, timestamp] of recentMessageToasts.entries()) {
                    if (now - timestamp > TOAST_DEDUP_WINDOW) {
                        recentMessageToasts.delete(msgId);
                    }
                }
            }
            
            playSound();
            notify(msg.message, senderName, senderPP, '/message/' + msg.senderId)
        })

        socket.on('speak_message', (msg) => {
            speakText(msg)
        });

        return () => {
            socket.off('notification')
            socket.off('speak_message')
        }
    }, [socket, profileId, dispatch])


    useEffect(() => {
        const handleVisibilityChange = () => {
            setIsTabActive(!document.hidden);
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, []);

    useEffect(() => {
        socket.on('notification', (msg, senderName, senderPP) => {
            if (isTabActive == true) {
                // Client-side deduplication: Check if we've already shown a toast for this message
                const messageId = msg._id?.toString() || msg._id || `${msg.senderId}_${msg.message?.substring(0, 50)}`;
                const now = Date.now();
                const lastToastTime = recentMessageToasts.get(messageId);
                
                if (lastToastTime && (now - lastToastTime) < TOAST_DEDUP_WINDOW) {
                    console.log(`Skipping duplicate toast for notification message ${messageId} (shown ${now - lastToastTime}ms ago)`);
                    return; // Skip showing duplicate toast
                }
                
                // Mark this message as having shown a toast
                recentMessageToasts.set(messageId, now);
                
                // Clean up old entries
                for (const [msgId, timestamp] of recentMessageToasts.entries()) {
                    if (now - timestamp > TOAST_DEDUP_WINDOW) {
                        recentMessageToasts.delete(msgId);
                    }
                }
                
                notify(msg.message, senderName, senderPP, '/message/' + msg.senderId)
                dispatch(newMessage(msg))
            } else {
                if (Notification && Notification.permission === "granted") {
                    showNotification(msg);
                } else if (Notification.permission !== "denied") {
                    Notification.requestPermission().then(permission => {
                        if (permission === "granted") {
                            showNotification(msg);
                        }
                    });
                }
            }
        })

        socket.on('speak_message', (msg) => {
            speakText(msg)
        });

        return () => {
            socket.off('notification');
            socket.off('speak_message');
        };
    }, [socket, isTabActive])


    useEffect(() => {
        dispatch(setBodyHeight(window.innerHeight));
        dispatch(setLoading(false))

        if (!token || !profileId || !isAuthenticated) return;

        api.post(`/profile`, { profile: profileId }).then(res => {
            dispatch(getPorfileReq())
            if (res.status === 200) {
                dispatch(getProfileSuccess(res.data));
            }

        }).catch(e => {
            dispatch(getProfileFailed(e))
        })

        if (window.location.pathname !== '/') {
            dispatch(setLoading(false))
        }



    }, [params, token, profileId, isAuthenticated, dispatch])


    // Listen for auth logout events from API interceptor
    useEffect(() => {
        const handleAuthLogout = () => {
            console.log('🔄 Auth logout event received, logging out user...');
            if (logout) {
                logout();
                // Redirect to login page
                window.location.href = '/login';
            }
        };

        window.addEventListener('auth:logout', handleAuthLogout);
        
        return () => {
            window.removeEventListener('auth:logout', handleAuthLogout);
        };
    }, [logout]);

    useEffect(() => {
        NProgress.configure({ showSpinner: false });
    }, []);

    useEffect(() => {
        NProgress.start();
        const timer = setTimeout(() => {
            NProgress.done();
        }, 300);
        return () => clearTimeout(timer);
    }, [location.pathname, location.search, location.hash]);

    // Stop all audio elements on route change to prevent stuck ringtones
    useEffect(() => {
        const stopAllAudio = () => {
            const audioElements = document.querySelectorAll('audio');
            audioElements.forEach(audio => {
                audio.pause();
                audio.currentTime = 0;
            });
        };
        stopAllAudio();
    }, [location.pathname]);

    const isHeaderHiddenRoute = location.pathname.startsWith('/portfolio') || location.pathname.startsWith('/youtube');

    // Cleanup audio element on unmount
    useEffect(() => {
        return () => {
            if (audioElement.current) {
                audioElement.current.pause();
                if (audioElement.current.parentNode) {
                    audioElement.current.parentNode.removeChild(audioElement.current);
                }
                audioElement.current = null;
            }
        };
    }, []);

    return (
        <Fragment>
                {
                    isLoading && (<div id="site-loader">
                        <div className="loader-logo-container">
                            <img src={config?.logo} alt="connect" />
                        </div>
                    </div>)}


                {!isHeaderHiddenRoute && isAuthenticated && <Header />}

                <div id="main-container" className={isLoading ? 'loading' : ''}>
                    {/* <Face /> */}

                    <Routes>
                        <Route path="/">
                            <Route path="menu" element={<Menu />}></Route>
                            <Route path="video-call" element={<VideoCallPage socket={socket} />}></Route>
                            <Route path="youtube" element={<Youtebe />}></Route>
                            <Route path="downloads" element={<SavedVideos />}></Route>
                            <Route path="downloads/:videoId" element={<SingleVideo />}></Route>
                            <Route path="login" element={<Login />}></Route>
                            <Route path="signup" element={<SignUP />}></Route>
                            {/* <Route path="face" element={<ProtectedRoute><Face /></ProtectedRoute>}></Route> */}

                            <Route index element={<ProtectedRoute><Home /></ProtectedRoute>}></Route>

                            <Route path="/portfolio/" element={<PortfolioContainer />}>
                                <Route index element={<PortfolioHome />} />
                                <Route path="about" element={<PortfolioAbout />} />
                                <Route path="resume" element={<PortfolioResume />}></Route>
                                <Route path="blogs" element={<PortfolioBlog />}></Route>
                                <Route path="contact" element={<PortfolioContact />}></Route>
                            </Route>


                            <Route path="/:profile/" element={<ProtectedRoute><Profile /></ProtectedRoute>}>
                                <Route index element={<PorfilePosts />} />
                                <Route path="about" element={<ProfileAbout />} />
                                <Route path="friends" element={<ProfileFriends />}></Route>
                                <Route path="images" element={<ProfileImages />}></Route>
                                <Route path="videos" element={<ProfileVideos />}></Route>
                            </Route>
                            <Route path="/story/" element={<ProtectedRoute><Story /></ProtectedRoute>}> </Route>

                            <Route path="/story/:storyId">

                                <Route index element={<ProtectedRoute><SingleStory /></ProtectedRoute>}></Route>
                                <Route path="comments/" element={<ProtectedRoute><StoryComments /></ProtectedRoute>}></Route>
                                <Route path="reacts/" element={<ProtectedRoute><StoryReacts /></ProtectedRoute>}></Route>

                            </Route>


                            <Route path="/post/" >
                                <Route path=":postId" element={<ProtectedRoute><SinglePost /></ProtectedRoute>} />
                                <Route path=":postId/edit" element={<ProtectedRoute><SinglePost /></ProtectedRoute>} />
                                <Route path=":postId/comments" element={<PostComments />} />
                                <Route path=":postId/reacts" element={<PostReacts />} />
                            </Route>

                            <Route path="/friends/" element={<ProtectedRoute><Friends /></ProtectedRoute>}>
                                <Route index element={<FriendHome />}></Route>
                                <Route path="requests" element={<FriendRequests />}></Route>
                                <Route path="suggestions" element={<FriendSuggest />}></Route>
                                <Route path="places" element={<PlacesNearYou />}></Route>

                            </Route>
                            <Route path="/watch" element={<ProtectedRoute><Video /></ProtectedRoute>}> </Route>

                            <Route path="/watch/:watchId">

                                <Route index element={<ProtectedRoute><SingleWatch /></ProtectedRoute>}></Route>


                            </Route>



                            <Route path="/message" element={<Message />}>
                                <Route path=":profile/" element={<Profile />}></Route>

                            </Route>

                            <Route path="/ludo-game" element={<LudoGame />}> </Route>
                            <Route path="/chess-game" element={<ChessGame />}> </Route>
                            <Route path="/video-player" element={<ProtectedRoute><VideoPlayer /></ProtectedRoute>}> </Route>
                            {/* <Route path="/call" element={<Call />}> </Route> */}
                            <Route path="/marketplace" element={<ProtectedRoute><Marketplace /></ProtectedRoute>}> </Route>

                            <Route path="/groups" element={<Groups />}> </Route>
                            <Route path="/yt-download" element={<YtDownload />}> </Route>
                            <Route path="/notes" element={<ProtectedRoute><Notes /></ProtectedRoute>}> </Route>
                            <Route path="/tasks" element={<ProtectedRoute><Tasks /></ProtectedRoute>}> </Route>
                            <Route path="/timer" element={<ProtectedRoute><FocusTimer /></ProtectedRoute>}> </Route>
                            <Route path="/flashcards" element={<ProtectedRoute><Flashcards /></ProtectedRoute>}> </Route>
                            <Route path="/calendar" element={<ProtectedRoute><Calendar /></ProtectedRoute>}> </Route>
                            <Route path="/habits" element={<ProtectedRoute><Habits /></ProtectedRoute>}> </Route>
                            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>}></Route>

                            <Route path="/settings/" element={<ProtectedRoute><Settings /></ProtectedRoute>}>
                                <Route index element={<ProfileSetting />} />
                                <Route path="account" element={<AccountSetting />} />
                                <Route path="privacy" element={<PrivacySetting />} />
                                <Route path="notification" element={<NotificationSetting />} />
                                <Route path="message" element={<MessageSetting />} />
                                <Route path="preference" element={<PreferenceSetting />} />
                                <Route path="sound" element={<SoundSetting />} />
                                <Route path="cache" element={<CacheSetting />} />
                            </Route>

                            <Route path="/test-notifications" element={<ProtectedRoute><NotificationTest /></ProtectedRoute>} />


                        </Route>
                    </Routes>
                </div>

                <>
                    <VideoCall myId={profileId}></VideoCall>
                    <AudioCall myId={profileId}></AudioCall>
                </>
                <StickyChatBoxContainer />
                <ToastContainer
                    position="top-center"
                    autoClose={5000}
                    hideProgressBar={true}
                    newestOnTop
                    closeOnClick
                    rtl={false}
                    pauseOnFocusLoss={false}
                    draggable
                    pauseOnHover={false}
                    theme="light"
                    className="custom-toast-container"
                    icon={false}
                    closeButton={false}
                    toastClassName="custom-toast-item"
                />
                <MinimizedCallBar />
            

        </Fragment>

    )


}

export default Main