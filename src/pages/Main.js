import React, { Fragment, useEffect, useState, useRef } from "react";
import { ToastContainer } from 'react-toastify';
import { Routes, Route, useParams, useLocation } from 'react-router-dom'
import NProgress from 'nprogress';
import { showMessageToast } from '../utils/toastUtils';
import 'react-toastify/dist/ReactToastify.css';
import '../components/Toast/CustomToast.css';
import webNotificationService from '../services/webNotificationService';
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
import config from "../config/config.json";


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
import { useDispatch, useSelector } from "react-redux";
import api from "../api/api";
import { getPorfileReq, getProfileFailed, getProfileSuccess } from '../services/actions/profileActions'
import { addNotification, addNotifications } from "../services/actions/notificationActions.js";
import { addMessages, newMessage } from "../services/actions/messageActions.js";
import { setBodyHeight, setLoading } from "../services/actions/optionAction";
import Settings from "./Settings";
import socket from '../common/socket.js'



import { loadSettings } from "../services/actions/settingsActions.js";
import ProfileSetting from "../components/setting/ProfileSetting.js";
import AccountSetting from "../components/setting/AccountSetting.js";
import PrivacySetting from "../components/setting/PrivacySetting.js";
import NotificationSetting from "../components/setting/NotificationSetting.js";
import MessageSetting from "../components/setting/MessageSetting.js";
import PreferenceSetting from "../components/setting/PreferenceSetting.js";
import SoundSetting from "../components/setting/SoundSetting.js";

import VideoCallPage from "./VideoCallPage.js";

import Youtebe from "./Youtebe.js";

import SingleVideo from "../components/downloads/SingleVideo.js";
import SavedVideos from "./SavedVideos.js";
import LudoGame from "./LudoGame";
import VideoPlayer from "./VideoPlayer.js";

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
    const { token, user, isAuthenticated } = useAuth();
    const isLoading = useSelector(state => state.option.isLoading);
    // const settings = useSelector(state => state.setting)
    const params = useParams();
    const location = useLocation();
    const audioElement = useRef(null)
    const [audioReady, setAudioReady] = useState(false)

    const [isTabActive, setIsTabActive] = useState(!document.hidden);

    const profileId = user?.profile

    useEffect(() => {
        if (!token || !profileId || !isAuthenticated) return;
        
        api.get('setting', {
            params: {
                profileId
            }
        }).then(res => {
            if (res.status == 200) {
                dispatch(loadSettings(res.data))
            }
        }).catch(err => {
            console.error('Error fetching settings:', err);
        });
    }, [token, profileId, isAuthenticated])

    // Initialize web notifications
    useEffect(() => {
        if (profileId && token && socket && isAuthenticated) {
            const initializeNotifications = async () => {
                try {
                    const success = await webNotificationService.initialize(profileId, api, socket);
                    if (success) {
                        console.log('Web notifications initialized successfully');
                        
                        // Send test notification after 3 seconds
                        setTimeout(() => {
                            webNotificationService.sendTestNotification(
                                'Connect App',
                                'Web notifications are now enabled!'
                            ).catch(err => console.log('Test notification failed:', err));
                        }, 3000);
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
    }, [profileId, token, socket, isAuthenticated])


    const playSound = () => {
        const el = audioElement?.current;
        if (!el) return;
        if (!audioReady) {
            console.warn('Notification sound blocked until user interaction');
            return;
        }
        try {
            el.currentTime = 0;
            el.muted = false;
            el.play().catch(error => {
                console.warn('Failed to play notification sound:', error);
            });
        } catch (e) {
            console.warn('Audio play error:', e);
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

        api.get('message/chatList', {
            params: {
                profileId
            }
        }).then(res => {
            dispatch(addMessages(res.data, true))

            console.log('oldMessages', res.data)
            dispatch(addMessages(res?.data?.reverse(), true))
        }).catch(err => {
            console.error('Error fetching messages:', err);
        });

        api.get('notification/', {
            params: {
                profileId
            }
        }).then(res => {

            console.log('oldNotifications', res.data)
            dispatch(addNotifications(res?.data))

        }).catch(err => {
            console.error('Error fetching notifications:', err);
        });



    }, [profileId, token, isAuthenticated])

    // Unlock audio on first user interaction (autoplay policy)
    useEffect(() => {
        const unlock = () => {
            const el = audioElement?.current;
            if (!el) return;
            const tryUnlock = async () => {
                try {
                    el.muted = true;
                    el.currentTime = 0;
                    await el.play();
                    el.pause();
                    el.currentTime = 0;
                    el.muted = false;
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

    useEffect(() => {
        if (!profileId) return;

        // socket.on('oldNotifications', data => {
        //     dispatch(addNotifications(data.reverse(), true))
        // })
        // socket.on('newNotification', data => {
        //     dispatch(addNotification(data))
        //     // Skip toast for message notifications - they're handled by newMessageToUser
        //     if (data.type !== 'message') {
        //         notify(data.text, false, data.icon, data.link)
        //     }
        // })

        // Listen for browser-specific notifications
        socket.on('browserNotification', data => {
            console.log('Browser-specific notification received:', data);
            
            // Show in-app notification
            dispatch(addNotification(data))
            // Skip toast and browser notification for message types - they're handled by newMessageToUser
            if (data.type !== 'message') {
                notify(data.text, false, data.icon, data.link)
                
                // Show browser notification if permission is granted
                if (webNotificationService.isPermissionGranted) {
                    const notification = new Notification(data.title || 'Connect', {
                        body: data.text,
                        icon: data.icon || '/logo192.png',
                        tag: `notification_${data._id || Date.now()}`,
                        data: {
                            url: data.link || '/',
                            notificationId: data._id
                        }
                    });

                    // Handle click event
                    notification.onclick = () => {
                        window.open(data.link || '/', '_self');
                        notification.close();
                    };

                    // Auto close after 5 seconds
                    setTimeout(() => {
                        notification.close();
                    }, 5000);
                }
            }
        })

        // socket.on('oldMessages', data => {
        //     console.log('oldMessages', data)
        //     dispatch(addMessages(data.reverse(), true))
        // })

        socket.on('newMessageToUser', ({ updatedMessage, senderName, senderPP }) => {
            dispatch(newMessage(updatedMessage))
            
            // Client-side deduplication: Check if we've already shown a toast for this message
            const messageId = updatedMessage._id?.toString() || updatedMessage._id;
            const now = Date.now();
            const lastToastTime = recentMessageToasts.get(messageId);
            
            if (lastToastTime && (now - lastToastTime) < TOAST_DEDUP_WINDOW) {
                console.log(`Skipping duplicate toast for message ${messageId} (shown ${now - lastToastTime}ms ago)`);
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
            
            notify(updatedMessage.message, senderName, senderPP, '/message/' + updatedMessage.senderId)

            // Show browser notification for new messages
            if (webNotificationService.isPermissionGranted) {
                const notification = new Notification(senderName || 'New Message', {
                    body: updatedMessage.message,
                    icon: senderPP || '/logo192.png',
                    tag: `message_${updatedMessage._id}`,
                    data: {
                        url: `/message/${updatedMessage.senderId}`,
                        messageId: updatedMessage._id,
                        senderId: updatedMessage.senderId
                    }
                });

                // Handle click event
                notification.onclick = () => {
                    window.open(`/message/${updatedMessage.senderId}`, '_self');
                    notification.close();
                };

                // Auto close after 5 seconds
                setTimeout(() => {
                    notification.close();
                }, 5000);
            }
        })

        socket.on('bumpUser', (({ friendProfileData, myProfileData }) => {

            console.log('bumpUser', friendProfileData, myProfileData)

            notify(`${friendProfileData.fullName} Bumped you`, friendProfileData.fullName, friendProfileData.profilePic, '/message/' + friendProfileData._id)

            // Show browser notification for bump
            if (webNotificationService.isPermissionGranted) {
                const notification = new Notification(`${friendProfileData.fullName} Bumped you`, {
                    body: 'Someone bumped you!',
                    icon: friendProfileData.profilePic || '/logo192.png',
                    tag: `bump_${friendProfileData._id}`,
                    data: {
                        url: `/message/${friendProfileData._id}`,
                        senderId: friendProfileData._id
                    }
                });

                // Handle click event
                notification.onclick = () => {
                    window.open(`/message/${friendProfileData._id}`, '_self');
                    notification.close();
                };

                // Auto close after 5 seconds
                setTimeout(() => {
                    notification.close();
                }, 5000);
            }
        }))

        // Listen for friend request notifications
        socket.on('friendRequestNotification', ({ senderName, senderPP, senderId }) => {
            console.log('Friend request notification:', { senderName, senderPP, senderId });
            
            notify(`${senderName} sent you a friend request`, senderName, senderPP, `/${senderId}`);

            // Show browser notification for friend request
            if (webNotificationService.isPermissionGranted) {
                const notification = new Notification(`${senderName} sent you a friend request`, {
                    body: 'You have a new friend request!',
                    icon: senderPP || '/logo192.png',
                    tag: `friend_request_${senderId}`,
                    data: {
                        url: `/${senderId}`,
                        senderId: senderId
                    }
                });

                // Handle click event
                notification.onclick = () => {
                    window.open(`/${senderId}`, '_self');
                    notification.close();
                };

                // Auto close after 10 seconds
                setTimeout(() => {
                    notification.close();
                }, 10000);
            }
        })

        // Listen for friend request acceptance notifications
        socket.on('friendRequestAcceptNotification', ({ senderName, senderPP, senderId }) => {
            console.log('Friend request accepted notification:', { senderName, senderPP, senderId });
            
            notify(`${senderName} accepted your friend request`, senderName, senderPP, `/${senderId}`);

            // Show browser notification for friend request acceptance
            if (webNotificationService.isPermissionGranted) {
                const notification = new Notification(`${senderName} accepted your friend request`, {
                    body: 'You are now friends!',
                    icon: senderPP || '/logo192.png',
                    tag: `friend_accept_${senderId}`,
                    data: {
                        url: `/${senderId}`,
                        senderId: senderId
                    }
                });

                // Handle click event
                notification.onclick = () => {
                    window.open(`/${senderId}`, '_self');
                    notification.close();
                };

                // Auto close after 8 seconds
                setTimeout(() => {
                    notification.close();
                }, 8000);
            }
        })

        // Listen for post reaction notifications
        socket.on('postReactNotification', ({ senderName, senderPP, postId, reactType }) => {
            console.log('Post reaction notification:', { senderName, senderPP, postId, reactType });
            
            notify(`${senderName} reacted to your post`, senderName, senderPP, `/post/${postId}`);

            // Show browser notification for post reaction
            if (webNotificationService.isPermissionGranted) {
                const notification = new Notification(`${senderName} reacted to your post`, {
                    body: `Reacted with ${reactType || '❤️'}`,
                    icon: senderPP || '/logo192.png',
                    tag: `post_react_${postId}`,
                    data: {
                        url: `/post/${postId}`,
                        postId: postId
                    }
                });

                // Handle click event
                notification.onclick = () => {
                    window.open(`/post/${postId}`, '_self');
                    notification.close();
                };

                // Auto close after 6 seconds
                setTimeout(() => {
                    notification.close();
                }, 6000);
            }
        })

        // Listen for post comment notifications
        socket.on('postCommentNotification', ({ senderName, senderPP, postId, commentBody }) => {
            console.log('Post comment notification:', { senderName, senderPP, postId, commentBody });
            
            notify(`${senderName} commented on your post`, senderName, senderPP, `/post/${postId}`);

            // Show browser notification for post comment
            if (webNotificationService.isPermissionGranted) {
                const notification = new Notification(`${senderName} commented on your post`, {
                    body: commentBody ? commentBody.substring(0, 100) + (commentBody.length > 100 ? '...' : '') : 'New comment',
                    icon: senderPP || '/logo192.png',
                    tag: `post_comment_${postId}`,
                    data: {
                        url: `/post/${postId}`,
                        postId: postId
                    }
                });

                // Handle click event
                notification.onclick = () => {
                    window.open(`/post/${postId}`, '_self');
                    notification.close();
                };

                // Auto close after 8 seconds
                setTimeout(() => {
                    notification.close();
                }, 8000);
            }
        })



        return () => {
            socket.off('oldNotifications')
            socket.off('newNotification')
            socket.off('browserNotification')
            socket.off('oldMessages')
            socket.off('newMessageToUser')
            socket.off('bumpUser')
            socket.off('friendRequestNotification')
            socket.off('friendRequestAcceptNotification')
            socket.off('postReactNotification')
            socket.off('postCommentNotification')
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

    return (
        <Fragment>
            <audio 
                ref={audioElement} 
                src={config?.defaultNotificationSound}
                preload="auto"
                muted
                onError={(e) => {
                    console.warn('Audio file failed to load:', e.target.src);
                }}
            >
                <track kind="captions" />
            </audio>
            
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

                            </Route>
                            <Route path="/watch" element={<ProtectedRoute><Video /></ProtectedRoute>}> </Route>

                            <Route path="/watch/:watchId">

                                <Route index element={<ProtectedRoute><SingleWatch /></ProtectedRoute>}></Route>


                            </Route>



                            <Route path="/message" element={<Message />}>
                                <Route path=":profile/" element={<Profile />}></Route>

                            </Route>

                            <Route path="/ludo-game" element={<LudoGame />}> </Route>
                            <Route path="/video-player" element={<ProtectedRoute><VideoPlayer /></ProtectedRoute>}> </Route>
                            {/* <Route path="/call" element={<Call />}> </Route> */}
                            <Route path="/marketplace" element={<ProtectedRoute><Marketplace /></ProtectedRoute>}> </Route>

                            <Route path="/groups" element={<Groups />}> </Route>
                            <Route path="/yt-download" element={<YtDownload />}> </Route>
                            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>}></Route>

                            <Route path="/settings/" element={<ProtectedRoute><Settings /></ProtectedRoute>}>
                                <Route index element={<ProfileSetting />} />
                                <Route path="account" element={<AccountSetting />} />
                                <Route path="privacy" element={<PrivacySetting />} />
                                <Route path="notification" element={<NotificationSetting />} />
                                <Route path="message" element={<MessageSetting />} />
                                <Route path="preference" element={<PreferenceSetting />} />
                                <Route path="sound" element={<SoundSetting />} />
                            </Route>

                            <Route path="/test-notifications" element={<ProtectedRoute><NotificationTest /></ProtectedRoute>} />


                        </Route>
                    </Routes>
                </div>

                <>
                    <VideoCall myId={profileId}></VideoCall>
                    <AudioCall myId={profileId}></AudioCall>
                </>
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