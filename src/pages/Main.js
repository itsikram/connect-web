import React, {
  Fragment,
  useEffect,
  useState,
  useRef,
  useCallback,
} from "react";
import { ToastContainer } from "react-toastify";
import {
  Routes,
  Route,
  useParams,
  useLocation,
  useNavigate,
} from "react-router-dom";
import NProgress from "nprogress";
import {
  showMessageToast,
  showLudoInviteToast,
  dismissToast,
} from "../utils/toastUtils";
import {
  isUserInLudoGame,
  markInviteHandled,
  setActiveLudoGameId,
  shouldShowLudoInviteAlert,
} from "../utils/ludoInviteUtils";
import { getNotificationLink } from "../utils/notificationUtils";
import "react-toastify/dist/ReactToastify.css";
import "../components/Toast/CustomToast.css";
import webNotificationService from "../services/webNotificationService";
import EnablePushBanner from "../components/EnablePushBanner";
import { initIncomingCallPushBridge } from "../utils/incomingCallFromPush";
import socket from "../common/socket";
import Header from "../partials/header/Header";
import ProtectedRoute from "../components/ProtectedRoute.js";
import { useAuth } from "../hooks/useAuth";
import Home from "./Home";
import Profile from "./Profile";
import Friends from "./Friends";
import Video from "./Video.js";
import Marketplace from "./Marketplace";
import Groups from "./Groups";
import Menu from "./Menu";
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
import ProfileVideos from "../components/Profile/ProfileVideos.js";
import VideoCall from "../components/VideoCall/VideoCall.js";
import AudioCall from "../components/AudioCall/AudioCall.js";
import SinglePost from "../components/post/SinglePost.js";
import NotificationTest from "../components/NotificationTest.js";
import PostComments from "../components/post/PostComments.js";
import PostReacts from "../components/post/PostReacts.js";
import Login from "./Login.js";
import SignUP from "./SignUp.js";
import ForgotPassword from "./ForgotPassword.js";
import ResetPassword from "./ResetPassword.js";
import MinimizedCallBar from "../components/MinimizedCallBar/MinimizedCallBar.js";
import StickyChatBoxContainer from "../components/Message/StickyChatBoxContainer.js";
import config from "../config/config.json";
import audioPreloader from "../utils/audioPreloader";
import IosAddToHomeScreen from "../components/IosAddToHomeScreen";
import WatchPipPlayer from "../components/watch/WatchPipPlayer";

// portoflio
import PortfolioContainer from "./portfolio/PortfolioContainer.js";
import PortfolioContact from "./portfolio/PortfolioContact.js";
import PortfolioHome from "./portfolio/PortfolioHome.js";
import PortfolioAbout from "./portfolio/PortfolioAbout.js";
import PortfolioBlog from "./portfolio/PortfolioBlog.js";
import PortfolioResume from "./portfolio/PortfolioResume.js";

import FriendRequests from "../components/friend/FriendRequests";
import FriendSuggest from "../components/friend/FriendSuggest";
import FriendHome from "../components/friend/FriendHome";
import PlacesNearYou from "../components/friend/PlacesNearYou";
import { useDispatch, useSelector } from "react-redux";
import api from "../api/api";
import {
  getPorfileReq,
  getProfileFailed,
  getProfileSuccess,
} from "../services/actions/profileActions";
import {
  addNotification,
  addNotifications,
} from "../services/actions/notificationActions.js";
import { addMessages, newMessage } from "../services/actions/messageActions.js";
import { setBodyHeight, setLoading } from "../services/actions/optionAction";
import Settings from "./Settings";
import { loadSettings } from "../services/actions/settingsActions.js";
import { applyThemeMode } from "../utils/applyThemeMode";
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
import Health from "./Health.js";

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
  // If Web Push is active, the service worker already shows the system notification.
  // Showing another page Notification causes duplicates on iOS installed web apps.
  if (webNotificationService.hasActivePushSubscription()) {
    return;
  }

  const titleText =
    (msg?.title && String(msg.title).trim()) ||
    (msg?.senderName && String(msg.senderName).trim()) ||
    "New Message";
  const bodyText =
    (msg?.message && String(msg.message).trim()) ||
    (msg?.text && String(msg.text).trim()) ||
    "You have a new message";

  const notification = new Notification(titleText, {
    body: bodyText,
    icon: config?.logo || undefined,
    tag: `msg-${msg?._id || msg?.messageId || Date.now()}`,
  });

  notification.onclick = () => {
    window.open(`${process.env.REACT_APP_URL}/message/${receiverId}`);
  };
}

const speakText = (textOrMsg) => {
  const text =
    typeof textOrMsg === "string"
      ? textOrMsg
      : typeof textOrMsg?.message === "string"
        ? textOrMsg.message
        : "";

  if (!text || !text.trim()) return;

  const speech = new SpeechSynthesisUtterance(text.trim());
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
  const isLoading = useSelector((state) => state.option.isLoading);
  const myProfile = useSelector((state) => state.profile);
  // const settings = useSelector(state => state.setting)
  const params = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const audioElement = useRef(null);
  const [audioReady, setAudioReady] = useState(false);

  const seoPages = [
    {
      match: /^\/$/,
      title: "Connect App - Social Media Home | Connect by Ikramul",
      description:
        "Connect by Ikramul is a modern social media app for connecting with friends, sharing moments, video calls, and building communities.",
    },
    {
      match: /^\/login$/,
      title: "Login | Connect App by Ikramul",
      description:
        "Sign in to Connect app by Ikramul to chat, share moments, and stay connected with friends and communities.",
    },
    {
      match: /^\/signup$/,
      title: "Sign Up | Connect App by Ikramul",
      description:
        "Create your Connect account today to start building your social media network with the Connect app.",
    },
    {
      match: /^\/forgot-password$/,
      title: "Reset Password | Connect App",
      description:
        "Reset your Connect password and get back to messaging, sharing, and calling your friends on the Connect social media app.",
    },
    // /portfolio/* SEO is owned by PortfolioSEO (name-focused Person schema)
  ];

  useEffect(() => {
    const pathname = location.pathname || "/";
    // Portfolio routes manage their own meta tags for name-search SEO
    if (pathname.startsWith("/portfolio")) return;

    const baseUrl = "https://connect-zfgx.onrender.com";
    const pageMeta =
      seoPages.find((page) => page.match.test(pathname)) || seoPages[0];

    document.title = pageMeta.title;
    document.documentElement.lang = "en";

    const updateMeta = (selector, value) => {
      const element = document.querySelector(selector);
      if (element) {
        element.setAttribute("content", value);
      }
    };

    updateMeta('meta[name="description"]', pageMeta.description);
    updateMeta('meta[property="og:title"]', pageMeta.title);
    updateMeta('meta[property="og:description"]', pageMeta.description);
    updateMeta('meta[name="twitter:title"]', pageMeta.title);
    updateMeta('meta[name="twitter:description"]', pageMeta.description);
    updateMeta('meta[property="og:url"]', `${baseUrl}${pathname}`);

    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) {
      canonical.setAttribute("href", `${baseUrl}${pathname}`);
    }
  }, [location.pathname]);

  // Create audio element dynamically only when needed
  const getOrCreateAudioElement = () => {
    if (!audioElement.current) {
      const audio = document.createElement("audio");
      audio.preload = "none";
      audio.muted = true;
      audio.style.display = "none";
      document.body.appendChild(audio);
      audioElement.current = audio;
    }
    return audioElement.current;
  };

  const [isTabActive, setIsTabActive] = useState(!document.hidden);
  const notificationIntervalRef = useRef(null);
  const [pendingLudoInvites, setPendingLudoInvites] = useState([]);
  // Track shown ludo invite toasts to prevent duplicates
  const shownLudoInviteToastsRef = useRef(new Map()); // inviteKey -> timestamp
  // Track current active ludo invite toast ID (only one toast at a time)
  const currentLudoInviteToastIdRef = useRef(null);

  const profileId = user?.profile;

  useEffect(() => {
    if (!token || !profileId || !isAuthenticated) return;

    const abortController = new AbortController();

    api
      .get("setting", {
        params: {
          profileId,
        },
        signal: abortController.signal,
      })
      .then((res) => {
        if (res.status == 200) {
          dispatch(loadSettings(res.data));
          applyThemeMode(res.data?.themeMode);
        }
      })
      .catch((err) => {
        // Don't log aborted requests as errors
        if (err.code !== "ECONNABORTED" && err.name !== "CanceledError") {
          console.error("Error fetching settings:", err);
        }
      });

    return () => {
      abortController.abort();
    };
  }, [token, profileId, isAuthenticated, dispatch]);

  // Initialize web notifications (keep push subscription across remounts)
  useEffect(() => {
    if (profileId && token && isAuthenticated) {
      const initializeNotifications = async () => {
        try {
          const success = await webNotificationService.initialize(
            profileId,
            api,
          );
          if (success) {
            console.log("Web notifications initialized successfully");
          }
        } catch (error) {
          console.error("Failed to initialize web notifications:", error);
        }
      };

      initializeNotifications();
    }
    // Do NOT unsubscribe on unmount — that kills iOS background push
  }, [profileId, token, isAuthenticated]);

  // Restore incoming call UI when user opens a Web Push call notification (iOS PWA)
  useEffect(() => {
    return initIncomingCallPushBridge();
  }, []);

  const playSound = async () => {
    try {
      // Use preloaded audio for better performance and background playback
      await audioPreloader.playNotificationSound();
    } catch (e) {
      console.warn("Audio play error, falling back to legacy method:", e);
      // Fallback to legacy method if preloader fails
      try {
        const el = getOrCreateAudioElement();
        const targetSrc = config?.defaultNotificationSound;
        if (!targetSrc) {
          console.warn("Notification sound URL not configured");
          return;
        }

        const currentSrc = el.src || "";
        if (
          !currentSrc ||
          currentSrc.includes("data:audio") ||
          currentSrc !== targetSrc
        ) {
          el.src = targetSrc;
          el.load();
        }

        el.currentTime = 0;
        el.muted = false;

        const playPromise = el.play();
        if (playPromise !== undefined) {
          playPromise.catch((error) => {
            if (!audioReady) {
              console.warn(
                "Notification sound blocked, attempting to unlock...",
              );
              const tryUnlock = async () => {
                try {
                  const silentAudio = new Audio(
                    "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=",
                  );
                  silentAudio.muted = true;
                  await silentAudio.play();
                  silentAudio.pause();
                  setAudioReady(true);
                  el.play().catch((err) => {
                    console.warn(
                      "Failed to play notification sound after unlock:",
                      err,
                    );
                  });
                } catch (unlockError) {
                  console.warn("Failed to unlock audio:", unlockError);
                }
              };
              tryUnlock();
            } else {
              console.warn("Failed to play notification sound:", error);
            }
          });
        }
      } catch (fallbackError) {
        console.warn("Fallback audio play also failed:", fallbackError);
      }
    }
  };
  const notify = (text, senderName, senderPP, link) => {
    playSound();
    showMessageToast(text, senderName, senderPP, link);
  };

  useEffect(() => {
    // Wait for both profileId AND token to be available
    if (!profileId || !token || !isAuthenticated) {
      console.log("⏳ Waiting for auth...", {
        profileId: !!profileId,
        token: !!token,
        isAuthenticated,
      });
      return;
    }

    console.log("✅ Fetching initial data with auth");

    const abortController = new AbortController();

    api
      .get("message/chatList", {
        params: {
          profileId,
        },
        signal: abortController.signal,
      })
      .then((res) => {
        dispatch(addMessages(res.data, true));

        console.log("oldMessages", res.data);
        dispatch(addMessages(res?.data?.reverse(), true));
      })
      .catch((err) => {
        // Don't log aborted requests as errors
        if (err.code !== "ECONNABORTED" && err.name !== "CanceledError") {
          console.error("Error fetching messages:", err);
        }
      });

    api
      .get("notification/", {
        params: {
          profileId,
          limit: 50,
        },
        signal: abortController.signal,
      })
      .then((res) => {
        console.log("oldNotifications", res.data);
        dispatch(addNotifications(res?.data, true));
      })
      .catch((err) => {
        // Don't log aborted requests as errors
        if (err.code !== "ECONNABORTED" && err.name !== "CanceledError") {
          console.error("Error fetching notifications:", err);
        }
      });

    return () => {
      abortController.abort();
    };
  }, [profileId, token, isAuthenticated, dispatch]);

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

          writeString(0, "RIFF");
          view.setUint32(4, 36 + dataSize, true); // File size - 8
          writeString(8, "WAVE");

          // fmt chunk
          writeString(12, "fmt ");
          view.setUint32(16, 16, true); // fmt chunk size
          view.setUint16(20, 1, true); // Audio format (PCM)
          view.setUint16(22, numChannels, true);
          view.setUint32(24, sampleRate, true);
          view.setUint32(28, sampleRate * numChannels * bytesPerSample, true); // Byte rate
          view.setUint16(32, numChannels * bytesPerSample, true); // Block align
          view.setUint16(34, bitsPerSample, true);

          // data chunk
          writeString(36, "data");
          view.setUint32(40, dataSize, true);
          // Data is already zeros (silence) since ArrayBuffer initializes to 0

          // Convert to base64
          const bytes = new Uint8Array(buffer);
          let binary = "";
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
          el.removeAttribute("src");
          setAudioReady(true);
          console.log("🔊 Notification audio unlocked");
        } catch (e) {
          console.warn("Audio unlock attempt failed:", e);
        }
      };
      tryUnlock();
    };
    window.addEventListener("click", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    window.addEventListener("touchstart", unlock, { once: true });
    return () => {
      window.removeEventListener("click", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("touchstart", unlock);
    };
  }, []);

  // HTTP-based notification polling - memoized to prevent recreation on every render
  const fetchNotifications = useCallback(async () => {
    if (!profileId) return;

    try {
      const response = await api.get("/notification/new", {
        params: { profileId },
      });

      if (
        response.data.notifications &&
        response.data.notifications.length > 0
      ) {
        response.data.notifications.forEach((notification) => {
          dispatch(addNotification(notification));

          // Skip toast and browser notification for message types
          if (notification.type !== "message") {
            const notificationLink = getNotificationLink(notification);
            notify(
              notification.text,
              false,
              notification.icon,
              notificationLink,
            );

            // Skip page Notification when Web Push is subscribed (SW already shows it)
            if (
              webNotificationService.isPermissionGranted &&
              !webNotificationService.hasActivePushSubscription()
            ) {
              const browserNotification = new Notification(
                notification.title || "Connect",
                {
                  body: notification.text,
                  icon: notification.icon || "/apple-touch-icon.png",
                  tag: `notification_${notification._id || Date.now()}`,
                  data: {
                    url: notificationLink,
                    notificationId: notification._id,
                  },
                },
              );

              browserNotification.onclick = () => {
                window.open(notificationLink, "_self");
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
      console.error("Error fetching notifications:", error);
    }
  }, [profileId, dispatch]);

  // HTTP-based message polling - memoized to prevent recreation on every render
  const fetchNewMessages = useCallback(async () => {
    if (!profileId) return;

    try {
      const response = await api.get("/message/new-messages", {
        params: { profileId },
      });

      if (response.data.messages && response.data.messages.length > 0) {
        response.data.messages.forEach((updatedMessage) => {
          dispatch(newMessage(updatedMessage, profileId));

          // Update sender's online status
          if (updatedMessage.senderId) {
            const friendOnlineEvent = new CustomEvent("friend_online_client", {
              detail: { profileId: updatedMessage.senderId },
            });
            window.dispatchEvent(friendOnlineEvent);
          }

          // Client-side deduplication
          const messageId =
            updatedMessage._id?.toString() || updatedMessage._id;
          const now = Date.now();
          const lastToastTime = recentMessageToasts.get(messageId);

          if (lastToastTime && now - lastToastTime < TOAST_DEDUP_WINDOW) {
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
          const senderName = updatedMessage.senderName || "Friend";
          const senderPP = updatedMessage.senderPP || "/default-avatar.png";
          notify(
            updatedMessage.message,
            senderName,
            senderPP,
            "/message/" + updatedMessage.senderId,
          );

          // Handle sticky chat opening
          const isOnMessagePage =
            window.location.pathname.startsWith("/message");
          if (!isOnMessagePage && updatedMessage.senderId) {
            const isChatOpen =
              typeof window.isStickyChatOpen === "function"
                ? window.isStickyChatOpen(updatedMessage.senderId)
                : false;

            if (!isChatOpen) {
              const openChatEvent = new CustomEvent("openStickyChat", {
                detail: { profileId: updatedMessage.senderId },
              });
              window.dispatchEvent(openChatEvent);
            }
          }
        });
      }
    } catch (error) {
      console.error("Error fetching new messages:", error);
    }
  }, [profileId, dispatch]);

  useEffect(() => {
    if (!profileId) {
      // Clear interval if profileId is not available
      if (notificationIntervalRef.current) {
        clearInterval(notificationIntervalRef.current);
        notificationIntervalRef.current = null;
      }
      return;
    }

    // Clear any existing interval before creating a new one
    if (notificationIntervalRef.current) {
      clearInterval(notificationIntervalRef.current);
      notificationIntervalRef.current = null;
    }

    // Initial fetch
    fetchNotifications();
    // Don't call fetchNewMessages here - messages are handled via socket

    // Poll for notifications every 30 seconds (keep this as it's for general notifications)
    // Use ref to track interval for proper cleanup
    notificationIntervalRef.current = setInterval(() => {
      fetchNotifications();
    }, 30000);

    // Listen for new messages via socket instead of polling
    const handleNewMessageToUser = (data) => {
      console.log("Main received new message via socket:", data);
      if (data.updatedMessage && data.updatedMessage.receiverId === profileId) {
        // Process the message for notifications and UI updates
        const updatedMessage = data.updatedMessage;

        // Update sender's online status
        if (updatedMessage.senderId) {
          const friendOnlineEvent = new CustomEvent("friend_online_client", {
            detail: { profileId: updatedMessage.senderId },
          });
          window.dispatchEvent(friendOnlineEvent);
        }

        // Client-side deduplication
        const messageId = updatedMessage._id?.toString() || updatedMessage._id;
        const now = Date.now();
        const lastToastTime = recentMessageToasts.get(messageId);

        if (lastToastTime && now - lastToastTime < TOAST_DEDUP_WINDOW) {
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
        const senderName = data.senderName || "Friend";
        const senderPP = data.senderPP || "/default-avatar.png";
        notify(
          updatedMessage.message,
          senderName,
          senderPP,
          "/message/" + updatedMessage.senderId,
        );

        // Handle sticky chat opening
        const isOnMessagePage = window.location.pathname.startsWith("/message");
        if (!isOnMessagePage && updatedMessage.senderId) {
          const isChatOpen =
            typeof window.isStickyChatOpen === "function"
              ? window.isStickyChatOpen(updatedMessage.senderId)
              : false;

          if (!isChatOpen) {
            const openChatEvent = new CustomEvent("openStickyChat", {
              detail: { profileId: updatedMessage.senderId },
            });
            window.dispatchEvent(openChatEvent);
          }
        }

        // Dispatch message for Redux state
        dispatch(newMessage(updatedMessage, profileId));
      }
    };

    socket.on("newMessageToUser", handleNewMessageToUser);

    return () => {
      // Clean up interval
      if (notificationIntervalRef.current) {
        clearInterval(notificationIntervalRef.current);
        notificationIntervalRef.current = null;
      }
      socket.off("newMessageToUser", handleNewMessageToUser);
    };
  }, [profileId, fetchNotifications, dispatch]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsTabActive(!document.hidden);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    const handleNotification = (msg, senderName, senderPP) => {
      if (isTabActive == true) {
        // Client-side deduplication: Check if we've already shown a toast for this message
        const messageId =
          msg._id?.toString() ||
          msg._id ||
          `${msg.senderId}_${msg.message?.substring(0, 50)}`;
        const now = Date.now();
        const lastToastTime = recentMessageToasts.get(messageId);

        if (lastToastTime && now - lastToastTime < TOAST_DEDUP_WINDOW) {
          console.log(
            `Skipping duplicate toast for notification message ${messageId} (shown ${now - lastToastTime}ms ago)`,
          );
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

        playSound();
        notify(msg.message, senderName, senderPP, "/message/" + msg.senderId);
        dispatch(newMessage(msg));
      } else {
        if (Notification && Notification.permission === "granted") {
          showNotification(msg);
        } else if (Notification.permission !== "denied") {
          Notification.requestPermission().then((permission) => {
            if (permission === "granted") {
              showNotification(msg);
            }
          });
        }
      }
    };

    const handleSpeakMessage = (msg) => {
      speakText(msg);
    };

    socket.on("notification", handleNotification);
    socket.on("speak_message", handleSpeakMessage);

    return () => {
      socket.off("notification", handleNotification);
      socket.off("speak_message", handleSpeakMessage);
    };
  }, [socket, isTabActive, dispatch]);

  // Realtime in-app notification feed (bell menu)
  useEffect(() => {
    if (!profileId || !isAuthenticated) return;

    const handleNewNotification = (notification) => {
      if (!notification?._id) return;
      dispatch(addNotification(notification));

      // Skip message types — they already toast via the message channel
      if (notification.type === "message") return;

      if (document.visibilityState === "visible") {
        const notificationLink = getNotificationLink(notification);
        notify(notification.text, false, notification.icon, notificationLink);
      }
    };

    socket.on("newNotification", handleNewNotification);
    return () => {
      socket.off("newNotification", handleNewNotification);
    };
  }, [profileId, isAuthenticated, dispatch]);

  // Global ludo game invitation handlers - work throughout the entire app
  useEffect(() => {
    if (!profileId || !myProfile?._id || !isAuthenticated) return;

    const dismissInviteToast = () => {
      if (currentLudoInviteToastIdRef.current !== null) {
        try {
          dismissToast(currentLudoInviteToastIdRef.current);
        } catch (_e) {}
        currentLudoInviteToastIdRef.current = null;
      }
    };

    const removePendingInvite = (gameId, from) => {
      setPendingLudoInvites((prev) =>
        prev.filter(
          (inv) =>
            !(
              String(inv.gameId) === String(gameId) &&
              String(inv.from) === String(from)
            ),
        ),
      );
    };

    const upsertPendingInvite = (invite) => {
      if (!invite?.gameId || !invite?.from) return;
      setPendingLudoInvites((prev) => {
        const exists = prev.some(
          (item) =>
            String(item.gameId) === String(invite.gameId) &&
            String(item.from) === String(invite.from),
        );
        if (exists) return prev;
        return [invite, ...prev].slice(0, 20);
      });
    };

    const acceptLudoInvite = (invite) => {
      if (!invite?.gameId) return;
      try {
        dismissInviteToast();
        markInviteHandled(invite.gameId, invite.from);
        setActiveLudoGameId(invite.gameId);
        removePendingInvite(invite.gameId, invite.from);

        try {
          if (socket && socket.connected) {
            socket.emit("ludo:invites:dismiss", {
              gameId: invite.gameId,
              by: invite.from,
            });
          }
        } catch (_e) {}

        const inviteData = {
          from: invite.from,
          name: invite.name,
          avatar: invite.avatar,
          cover: invite.cover,
          gameId: invite.gameId,
          slotIndex: invite.slotIndex,
          playerCount: invite.playerCount,
          ts: Date.now(),
          autoAccept: true,
        };
        localStorage.setItem("ludo_pending_invite", JSON.stringify(inviteData));
        navigate("/ludo-game");
      } catch (error) {
        console.error("[LUDO_INVITE] Error accepting invite:", error);
      }
    };

    const declineLudoInvite = (invite) => {
      if (!invite?.gameId) return;
      try {
        markInviteHandled(invite.gameId, invite.from);
        removePendingInvite(invite.gameId, invite.from);
        if (socket && socket.connected) {
          socket.emit("ludo:invites:dismiss", {
            gameId: invite.gameId,
            by: invite.from,
          });
        }
        if (currentLudoInviteToastIdRef.current !== null) {
          dismissInviteToast();
        }
      } catch (_e) {
        console.error("[LUDO_INVITE] Error declining invite:", _e);
      }
    };

    window.acceptLudoInviteFromHeader = acceptLudoInvite;
    window.declineLudoInviteFromHeader = declineLudoInvite;

    const onInvite = (payload) => {
      try {
        if (!payload) return;
        // If we're already on the Ludo page for this game, suppress and dismiss.
        if (location.pathname.includes("/ludo-game")) {
          try {
            const activeInvite = localStorage.getItem("ludo_pending_invite");
            const parsedInvite = activeInvite ? JSON.parse(activeInvite) : null;
            const samePendingGame =
              parsedInvite?.gameId &&
              String(parsedInvite.gameId) === String(payload.gameId);
            if (samePendingGame || isUserInLudoGame(payload.gameId)) {
              if (socket && socket.connected) {
                socket.emit("ludo:invites:dismiss", {
                  gameId: payload.gameId,
                  by: payload.by,
                });
              }
              return;
            }
          } catch (_e) {
            return;
          }
          return;
        }
        // Check if invite is for this user
        if (payload.to && String(payload.to) !== String(myProfile._id)) return;

        if (isUserInLudoGame(payload.gameId)) {
          try {
            if (socket && socket.connected) {
              socket.emit("ludo:invites:dismiss", {
                gameId: payload.gameId,
                by: payload.by,
              });
            }
          } catch (_e) {}
          return;
        }

        if (!shouldShowLudoInviteAlert(payload.gameId, payload.by)) {
          return;
        }

        // Create unique key for this invite
        const inviteKey = `${payload.gameId}:${payload.by}`;
        const now = Date.now();

        // Check if we've already shown a toast for this invite recently (30 seconds)
        const lastShownTime = shownLudoInviteToastsRef.current.get(inviteKey);
        if (lastShownTime && now - lastShownTime < 30000) {
          return; // Already shown a toast for this invite recently, skip
        }

        // Mark immediately to prevent duplicate toasts
        shownLudoInviteToastsRef.current.set(inviteKey, now);

        // Clean up old entries (older than 1 minute)
        for (const [
          key,
          timestamp,
        ] of shownLudoInviteToastsRef.current.entries()) {
          if (now - timestamp > 60000) {
            shownLudoInviteToastsRef.current.delete(key);
          }
        }

        const invite = {
          from: payload.by,
          name: payload.name,
          avatar: payload.avatar,
          cover: payload.cover,
          gameId: payload.gameId,
          slotIndex: payload.slotIndex,
          playerCount: payload.playerCount,
          ts: now,
        };

        upsertPendingInvite(invite);

        // Dismiss previous ludo invite toast if one exists (only show one at a time)
        dismissInviteToast();

        // Show toast notification
        const toastId = showLudoInviteToast(
          payload.name || "A friend",
          payload.avatar,
          () => {
            acceptLudoInvite(invite);
          },
          () => {
            declineLudoInvite(invite);
            if (currentLudoInviteToastIdRef.current === toastId) {
              currentLudoInviteToastIdRef.current = null;
            }
          },
        );

        // Store current toast ID
        currentLudoInviteToastIdRef.current = toastId;
      } catch (error) {
        console.error("[LUDO_INVITE] Error handling invite:", error);
      }
    };

    const onInvites = (payload) => {
      try {
        if (location.pathname.includes("/ludo-game")) {
          const arr = Array.isArray(payload?.invites) ? payload.invites : [];
          arr.forEach((inv) => {
            try {
              const gameId = inv?.gameId;
              const from = inv?.by ?? inv?.from;
              if (!gameId) return;
              const activeInvite = localStorage.getItem("ludo_pending_invite");
              const parsedInvite = activeInvite
                ? JSON.parse(activeInvite)
                : null;
              const samePendingGame =
                parsedInvite?.gameId &&
                String(parsedInvite.gameId) === String(gameId);
              if (
                (samePendingGame || isUserInLudoGame(gameId)) &&
                socket &&
                socket.connected
              ) {
                socket.emit("ludo:invites:dismiss", {
                  gameId,
                  by: from,
                });
              }
            } catch (_e) {}
          });
          return;
        }

        const arr = Array.isArray(payload?.invites) ? payload.invites : [];
        const normalized = arr.map((x) => ({
          from: x.by ?? x.from,
          name: x.name,
          avatar: x.avatar,
          cover: x.cover,
          gameId: x.gameId,
          slotIndex: x.slotIndex,
          playerCount: x.playerCount,
          ts: x.ts || Date.now(),
        }));

        // Filter out invites for games the user is already in or already handled
        const filteredNormalized = normalized.filter((inv) => {
          if (isUserInLudoGame(inv.gameId)) {
            try {
              if (socket && socket.connected) {
                socket.emit("ludo:invites:dismiss", {
                  gameId: inv.gameId,
                  by: inv.from,
                });
              }
            } catch (_e) {}
            return false;
          }
          return shouldShowLudoInviteAlert(inv.gameId, inv.from);
        });

        filteredNormalized.forEach(upsertPendingInvite);

        const now = Date.now();

        // Filter and mark toasts synchronously to prevent duplicates
        const newInvites = filteredNormalized.filter((inv) => {
          const inviteKey = `${inv.gameId}:${inv.from}`;
          const lastShownTime = shownLudoInviteToastsRef.current.get(inviteKey);
          if (lastShownTime && now - lastShownTime < 30000) {
            return false; // Already shown a toast for this invite recently, skip
          }

          // Mark immediately to prevent duplicate toasts
          shownLudoInviteToastsRef.current.set(inviteKey, now);
          return true;
        });

        // Clean up old entries (older than 1 minute)
        for (const [
          key,
          timestamp,
        ] of shownLudoInviteToastsRef.current.entries()) {
          if (now - timestamp > 60000) {
            shownLudoInviteToastsRef.current.delete(key);
          }
        }

        // Check if we should dismiss all other invites (when accepting one)
        const shouldDismissOthers =
          localStorage.getItem("ludo_dismiss_all_other_invites") === "true";
        if (shouldDismissOthers) {
          localStorage.removeItem("ludo_dismiss_all_other_invites");
          filteredNormalized.forEach((inv) => {
            try {
              if (socket && socket.connected) {
                socket.emit("ludo:invites:dismiss", {
                  gameId: inv.gameId,
                  by: inv.from,
                });
              }
              markInviteHandled(inv.gameId, inv.from);
              removePendingInvite(inv.gameId, inv.from);
            } catch (_e) {}
          });
          shownLudoInviteToastsRef.current.clear();
          dismissInviteToast();
          return;
        }

        dismissInviteToast();

        // Show toast only for the first new invite (only one toast at a time)
        if (newInvites.length > 0) {
          const inv = newInvites[0]; // Only show the first one
          const toastId = showLudoInviteToast(
            inv.name || "A friend",
            inv.avatar,
            () => {
              acceptLudoInvite(inv);
            },
            () => {
              declineLudoInvite(inv);
              if (currentLudoInviteToastIdRef.current === toastId) {
                currentLudoInviteToastIdRef.current = null;
              }
            },
          );

          // Store current toast ID
          currentLudoInviteToastIdRef.current = toastId;
        }
      } catch (error) {
        console.error("[LUDO_INVITES] Error handling invites:", error);
      }
    };

    // Handle when player successfully joins a game - dismiss all other invites
    const onPlayers = (payload) => {
      try {
        // When players list is received, it means we've successfully joined a game
        // Dismiss all other pending invites
        if (
          payload?.players &&
          Array.isArray(payload.players) &&
          payload.players.length > 0
        ) {
          // Check if current user is in the players list (successfully joined)
          const isUserInPlayers =
            payload.players.some(
              (p) =>
                p.profileId &&
                myProfile?._id &&
                String(p.profileId) === String(myProfile._id),
            ) ||
            payload.players.some(
              (p) =>
                p._id &&
                myProfile?._id &&
                String(p._id) === String(myProfile._id),
            );

          if (isUserInPlayers) {
            setActiveLudoGameId(payload.gameId);
            markInviteHandled(payload.gameId, payload.from);
            setPendingLudoInvites([]);

            dismissInviteToast();
            shownLudoInviteToastsRef.current.clear();

            try {
              if (socket && socket.connected && payload.gameId) {
                socket.emit("ludo:invites:dismiss", {
                  gameId: payload.gameId,
                  by: payload.from,
                });
              }
            } catch (_e) {}
          }
        }
      } catch (error) {
        console.error("[LUDO_PLAYERS] Error handling players event:", error);
      }
    };

    // Attach socket listeners
    if (socket) {
      socket.on("ludo:invite", onInvite);
      socket.on("ludo:invites", onInvites);
      socket.on("ludo:players", onPlayers);

      // Request pending invites on mount
      if (socket.connected) {
        try {
          socket.emit("ludo:invites:get", {});
        } catch (_e) {
          // Ignore errors
        }
      }
    }

    return () => {
      delete window.acceptLudoInviteFromHeader;
      delete window.declineLudoInviteFromHeader;
      if (socket) {
        socket.off("ludo:invite", onInvite);
        socket.off("ludo:invites", onInvites);
        socket.off("ludo:players", onPlayers);
      }
    };
  }, [
    profileId,
    myProfile?._id,
    isAuthenticated,
    navigate,
    socket,
    location.pathname,
  ]);

  useEffect(() => {
    dispatch(setBodyHeight(window.innerHeight));
    dispatch(setLoading(false));

    if (!token || !profileId || !isAuthenticated) return;

    api
      .post(`/profile`, { profile: profileId })
      .then((res) => {
        dispatch(getPorfileReq());
        if (res.status === 200) {
          dispatch(getProfileSuccess(res.data));
        }
      })
      .catch((e) => {
        dispatch(getProfileFailed(e));
      });

    if (window.location.pathname !== "/") {
      dispatch(setLoading(false));
    }

    // Do not depend on `useParams()` object — it is often a new reference each render and would re-POST /profile endlessly.
  }, [token, profileId, isAuthenticated, dispatch]);

  // Listen for auth logout events from API interceptor
  useEffect(() => {
    const handleAuthLogout = () => {
      console.log("🔄 Auth logout event received, logging out user...");
      if (logout) {
        logout();
        // Redirect to login page
        window.location.href = "/login";
      }
    };

    window.addEventListener("auth:logout", handleAuthLogout);

    return () => {
      window.removeEventListener("auth:logout", handleAuthLogout);
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
      const audioElements = document.querySelectorAll("audio");
      audioElements.forEach((audio) => {
        audio.pause();
        audio.currentTime = 0;
      });
    };
    stopAllAudio();
  }, [location.pathname]);

  const isHeaderHiddenRoute =
    location.pathname.startsWith("/portfolio") ||
    location.pathname.startsWith("/youtube");

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
      {isLoading && (
        <div id="site-loader">
          <div className="loader-logo-container">
            <img src={config?.logo} alt="connect" />
          </div>
        </div>
      )}

      {!isHeaderHiddenRoute && isAuthenticated && (
        <Header pendingLudoInvites={pendingLudoInvites} />
      )}

      <div id="main-container" className={isLoading ? "loading" : ""}>
        {/* <Face /> */}

        <Routes>
          <Route path="/">
            <Route path="menu" element={<Menu />}></Route>
            <Route
              path="video-call"
              element={<VideoCallPage socket={socket} />}
            ></Route>
            <Route path="youtube" element={<Youtebe />}></Route>
            <Route path="downloads" element={<SavedVideos />}></Route>
            <Route path="downloads/:videoId" element={<SingleVideo />}></Route>
            <Route path="login" element={<Login />}></Route>
            <Route path="signup" element={<SignUP />}></Route>
            <Route path="forgot-password" element={<ForgotPassword />}></Route>
            <Route
              path="reset-password/:token"
              element={<ResetPassword />}
            ></Route>
            {/* <Route path="face" element={<ProtectedRoute><Face /></ProtectedRoute>}></Route> */}

            <Route
              index
              element={
                <ProtectedRoute>
                  <Home />
                </ProtectedRoute>
              }
            ></Route>

            <Route path="/portfolio/" element={<PortfolioContainer />}>
              <Route index element={<PortfolioHome />} />
              <Route path="about" element={<PortfolioAbout />} />
              <Route path="resume" element={<PortfolioResume />}></Route>
              <Route path="blogs" element={<PortfolioBlog />}></Route>
              <Route path="contact" element={<PortfolioContact />}></Route>
            </Route>

            <Route
              path="/:profile/"
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }
            >
              <Route index element={<PorfilePosts />} />
              <Route path="about" element={<ProfileAbout />} />
              <Route path="friends" element={<ProfileFriends />}></Route>
              <Route path="images" element={<ProfileImages />}></Route>
              <Route path="videos" element={<ProfileVideos />}></Route>
            </Route>
            <Route
              path="/story/"
              element={
                <ProtectedRoute>
                  <Story />
                </ProtectedRoute>
              }
            >
              {" "}
            </Route>

            <Route path="/story/:storyId">
              <Route
                index
                element={
                  <ProtectedRoute>
                    <SingleStory />
                  </ProtectedRoute>
                }
              ></Route>
              <Route
                path="comments/"
                element={
                  <ProtectedRoute>
                    <StoryComments />
                  </ProtectedRoute>
                }
              ></Route>
              <Route
                path="reacts/"
                element={
                  <ProtectedRoute>
                    <StoryReacts />
                  </ProtectedRoute>
                }
              ></Route>
            </Route>

            <Route path="/post/">
              <Route
                path=":postId"
                element={
                  <ProtectedRoute>
                    <SinglePost />
                  </ProtectedRoute>
                }
              />
              <Route
                path=":postId/edit"
                element={
                  <ProtectedRoute>
                    <SinglePost />
                  </ProtectedRoute>
                }
              />
              <Route path=":postId/comments" element={<PostComments />} />
              <Route path=":postId/reacts" element={<PostReacts />} />
            </Route>

            <Route
              path="/friends/"
              element={
                <ProtectedRoute>
                  <Friends />
                </ProtectedRoute>
              }
            >
              <Route index element={<FriendHome />}></Route>
              <Route path="requests" element={<FriendRequests />}></Route>
              <Route path="suggestions" element={<FriendSuggest />}></Route>
              <Route path="places" element={<PlacesNearYou />}></Route>
            </Route>
            <Route
              path="/watch"
              element={
                <ProtectedRoute>
                  <Video />
                </ProtectedRoute>
              }
            >
              {" "}
            </Route>

            <Route path="/watch/:watchId">
              <Route
                index
                element={
                  <ProtectedRoute>
                    <SingleWatch />
                  </ProtectedRoute>
                }
              ></Route>
            </Route>

            <Route path="/message" element={<Message />}>
              <Route path=":profile/" element={<Profile />}></Route>
            </Route>

            <Route path="/ludo-game" element={<LudoGame />}>
              {" "}
            </Route>
            <Route path="/chess-game" element={<ChessGame />}>
              {" "}
            </Route>
            <Route
              path="/video-player"
              element={
                <ProtectedRoute>
                  <VideoPlayer />
                </ProtectedRoute>
              }
            >
              {" "}
            </Route>
            {/* <Route path="/call" element={<Call />}> </Route> */}
            <Route
              path="/marketplace"
              element={
                <ProtectedRoute>
                  <Marketplace />
                </ProtectedRoute>
              }
            >
              {" "}
            </Route>

            <Route path="/groups" element={<Groups />}>
              {" "}
            </Route>
            <Route path="/yt-download" element={<YtDownload />}>
              {" "}
            </Route>
            <Route
              path="/notes"
              element={
                <ProtectedRoute>
                  <Notes />
                </ProtectedRoute>
              }
            >
              {" "}
            </Route>
            <Route
              path="/tasks"
              element={
                <ProtectedRoute>
                  <Tasks />
                </ProtectedRoute>
              }
            >
              {" "}
            </Route>
            <Route
              path="/timer"
              element={
                <ProtectedRoute>
                  <FocusTimer />
                </ProtectedRoute>
              }
            >
              {" "}
            </Route>
            <Route
              path="/flashcards"
              element={
                <ProtectedRoute>
                  <Flashcards />
                </ProtectedRoute>
              }
            >
              {" "}
            </Route>
            <Route
              path="/calendar"
              element={
                <ProtectedRoute>
                  <Calendar />
                </ProtectedRoute>
              }
            >
              {" "}
            </Route>
            <Route
              path="/habits"
              element={
                <ProtectedRoute>
                  <Habits />
                </ProtectedRoute>
              }
            >
              {" "}
            </Route>
            <Route
              path="/health"
              element={
                <ProtectedRoute>
                  <Health />
                </ProtectedRoute>
              }
            >
              {" "}
            </Route>
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              }
            >
              <Route index element={<ProfileSetting />} />
              <Route path="account" element={<AccountSetting />} />
              <Route path="privacy" element={<PrivacySetting />} />
              <Route path="notification" element={<NotificationSetting />} />
              <Route path="message" element={<MessageSetting />} />
              <Route path="preference" element={<PreferenceSetting />} />
              <Route path="sound" element={<SoundSetting />} />
              <Route path="cache" element={<CacheSetting />} />
            </Route>

            <Route
              path="/test-notifications"
              element={
                <ProtectedRoute>
                  <NotificationTest />
                </ProtectedRoute>
              }
            />
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
      <WatchPipPlayer />
      <IosAddToHomeScreen />
      {isAuthenticated && profileId ? (
        <EnablePushBanner profileId={profileId} api={api} />
      ) : null}
    </Fragment>
  );
};

export default Main;
