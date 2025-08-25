import React, { Fragment, useEffect, useState, useRef } from "react";
import { ToastContainer, toast } from 'react-toastify';
import { BrowserRouter as BR, Routes, Route, Link, useParams, useLocation } from 'react-router-dom'
import Header from '../partials/header/Header';
import ProtectedRoute from "../components/ProtectedRoute.js";
import Home from "./Home";
import Profile from "./Profile";
import Friends from "./Friends";
import Video from "./Video.js";
import Marketplace from './Marketplace'
import Groups from './Groups'
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
import SinglePost from "../components/post/SinglePost.js";
import PostComments from "../components/post/PostComments.js";
import PostReacts from "../components/post/PostReacts.js";
import Login from "./Login.js";
import SignUP from "./SignUp.js";


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
import { addMessage, addMessages, newMessage } from "../services/actions/messageActions.js";
import { setBodyHeight, setHeaderHeight, setLoading } from "../services/actions/optionAction";
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

import MicRecorder from 'mic-recorder-to-mp3';
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
        icon: "https://programmerikram.com/wp-content/uploads/2025/03/ics_logo.png"
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

const Main = () => {
    const dispatch = useDispatch();
    let { token } = useSelector(state => state.auth)
    const isLoading = useSelector(state => state.option.isLoading);
    // const settings = useSelector(state => state.setting)
    const params = useParams();
    const audioElement = useRef(null)

    const [isTabActive, setIsTabActive] = useState(!document.hidden);

    const userInfo = JSON.parse((localStorage.getItem('user') || '{}'))
    const profileId = userInfo.profile

    useEffect(() => {
        if (!token) return
        api.get('setting', {
            params: {
                profileId
            }
        }).then(res => {
            if (res.status == 200) {
                dispatch(loadSettings(res.data))
            }
        })
    }, [token])


    const playSound = (data) => {
        audioElement?.current.play();

    }
    const notify = (text, senderName, senderPP, link) => {
        playSound();
        toast(
            <Link className="text-decoration-none text-secondary" to={`${link}`}>
                <div style={{ color: "blue", fontWeight: "bold" }}>
                    <div className="row d-flex align-items-center">
                        <div className="col-3">
                            <img className="rounded-circle w-100" src={senderPP} alt="connect" />
                        </div>

                        <div className="col-9">
                            {senderName && (<h3 className="text-success mb-0">{senderName}</h3>)}
                            <p className="text-small text-secondary text-muted mb-0">{text}</p>
                        </div>
                    </div>
                </div>
            </Link>

        );
    }

    useEffect(() => {
        socket.emit('fetchNotifications', profileId)

        socket.on('oldNotifications', data => {
            dispatch(addNotifications(data.reverse(), true))
        })
        socket.on('newNotification', data => {
            dispatch(addNotification(data))
            notify(data.text, false, data.icon, data.link)
        })


        socket.emit('fetchMessages', profileId)


        socket.on('oldMessages', data => {
            dispatch(addMessages(data.reverse(), true))
        })

        socket.on('newMessage', ({ updatedMessage, senderName, senderPP }) => {
            dispatch(newMessage(updatedMessage))
            notify(updatedMessage.message, senderName, senderPP, '/message/' + updatedMessage.senderId)

        })

        socket.on('bumpUser', ((friend, profile) => {

            notify(`${profile.fullName} Bumped you`, friend.fullName, profile.profilePic, '/message/' + profile._id)

        }))



        return () => {
            socket.off('oldNotifications')
            socket.off('newNotification')
            socket.off('oldMessages')
            socket.off('newMessage')
            socket.off('bumpUser')
        }
    }, [socket])


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

        if (!token) return

        api.post(`/profile`, { profile: profileId }).then(res => {
            dispatch(getPorfileReq())
            if (res.status === 200) {
                dispatch(getProfileSuccess(res.data));
            }

        }).catch(e => {
            dispatch(getProfileFailed(e))
        })

        if (window.location.pathname == '/') {
        } else {
            dispatch(setLoading(false))
        }



    }, [params, token, dispatch])

    useEffect(() => {

        if (!isTabActive) return
        if (userInfo.user_id) {
            socket.emit('update_last_login', userInfo.user_id)

        }

        setInterval(() => {
            // alert('called')
            if (userInfo.user_id) {
                socket.emit('update_last_login', userInfo.user_id)

            }
        }, 3 * 60 * 1000)

        return () => {
            socket.off('update_last_login')
        }
    }, [isTabActive])



    return (
        <Fragment>
            <audio ref={audioElement} src="https://programmerikram.com/wp-content/uploads/2025/05/connect-message-sound.wav"></audio>
            <BR>
                {
                    isLoading && (<div id="site-loader">
                        <div className="loader-logo-container">
                            <img src="https://programmerikram.com/wp-content/uploads/2025/05/ics_logo_out_transparent.png" alt="connect" />
                        </div>
                    </div>)}


                <Header />

                <div id="main-container" className={isLoading ? 'loading' : ''}>
                    {/* <Face /> */}

                    <Routes>
                        <Route path="/">
                            <Route path="video-call" element={<VideoCallPage />}></Route>
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


                        </Route>
                    </Routes>
                </div>

                {
                    <VideoCall myId={profileId}></VideoCall>
                    //<AudioCall></AudioCall> 
                }
                <ToastContainer />
            </BR>

        </Fragment>

    )


}

export default Main