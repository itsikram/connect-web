import React, {
  Fragment,
  useEffect,
  useState,
  useRef,
  useCallback,
  lazy,
  Suspense,
} from "react";
import { ToastContainer, Slide } from "react-toastify";
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
  showChessInviteToast,
  dismissToast,
} from "../utils/toastUtils";
import {
  isUserInLudoGame,
  markInviteHandled,
  setActiveLudoGameId,
  shouldShowLudoInviteAlert,
  resolveLudoInviteNotifications,
} from "../utils/ludoInviteUtils";
import {
  isUserInChessGame,
  markChessInviteHandled,
  setActiveChessGameId,
  shouldShowChessInviteAlert,
  resolveChessInviteNotifications,
} from "../utils/chessInviteUtils";
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
import Login from "./Login.js";
import SignUP from "./SignUp.js";
import ForgotPassword from "./ForgotPassword.js";
import ResetPassword from "./ResetPassword.js";
import MinimizedCallBar from "../components/MinimizedCallBar/MinimizedCallBar.js";
import StickyChatBoxContainer from "../components/Message/StickyChatBoxContainer.js";
import config from "../config/config.json";
import audioPreloader from "../utils/audioPreloader";
import { playBumpSound, resumeAudioFromGesture } from "../utils/audioUnlock";
import IosAddToHomeScreen from "../components/IosAddToHomeScreen";
import WatchPipPlayer from "../components/watch/WatchPipPlayer";
import { useDispatch, useSelector } from "react-redux";
import api from "../api/api";
import { fetchChatListCached, fetchProfileCached, primeCachedResource } from "../utils/requestCache";
import {
  getCachedProfile,
  getPorfileReq,
  getProfileFailed,
  getProfileSuccess,
} from "../services/actions/profileActions";
import {
  addNotification,
  addNotifications,
} from "../services/actions/notificationActions.js";
import { addMessages, newMessage } from "../services/actions/messageActions.js";
import { emitChatMessage, idOf } from "../utils/optimisticMessage";
import { setBodyHeight, setLoading } from "../services/actions/optionAction";
import { loadSettings } from "../services/actions/settingsActions.js";
import { applyThemeMode } from "../utils/applyThemeMode";

const Profile = lazy(() => import("./Profile"));
const Friends = lazy(() => import("./Friends"));
const Video = lazy(() => import("./Video.js"));
const Marketplace = lazy(() => import("./Marketplace"));
const Groups = lazy(() => import("./Groups"));
const Menu = lazy(() => import("./Menu"));
const YtDownload = lazy(() => import("./YtDownload.js"));
const Message = lazy(() => import("./Message"));
const Story = lazy(() => import("./Story"));
const StoryReacts = lazy(() => import("../components/story/StoryReacts.js"));
const StoryComments = lazy(() => import("../components/story/StoryComments.js"));
const SingleStory = lazy(() => import("../components/story/SingleStory"));
const SingleWatch = lazy(() => import("../components/watch/SingleWatch.js"));
const ProfileAbout = lazy(() => import("../components/Profile/ProfileAbout"));
const PorfilePosts = lazy(() => import("../components/Profile/PorfilePosts"));
const ProfileFriends = lazy(() => import("../components/Profile/ProfileFriends"));
const ProfileImages = lazy(() => import("../components/Profile/ProfileImages.js"));
const ProfileVideos = lazy(() => import("../components/Profile/ProfileVideos.js"));
const VideoCall = lazy(() => import("../components/VideoCall/VideoCall.js"));
const AudioCall = lazy(() => import("../components/AudioCall/AudioCall.js"));
const LiveVoice = lazy(() => import("../components/LiveVoice/LiveVoice.js"));
const SinglePost = lazy(() => import("../components/post/SinglePost.js"));
const NotificationTest = lazy(() => import("../components/NotificationTest.js"));
const PostComments = lazy(() => import("../components/post/PostComments.js"));
const PostReacts = lazy(() => import("../components/post/PostReacts.js"));
const PortfolioContainer = lazy(() => import("./portfolio/PortfolioContainer.js"));
const PortfolioContact = lazy(() => import("./portfolio/PortfolioContact.js"));
const PortfolioHome = lazy(() => import("./portfolio/PortfolioHome.js"));
const PortfolioAbout = lazy(() => import("./portfolio/PortfolioAbout.js"));
const PortfolioBlog = lazy(() => import("./portfolio/PortfolioBlog.js"));
const PortfolioResume = lazy(() => import("./portfolio/PortfolioResume.js"));
const FriendRequests = lazy(() => import("../components/friend/FriendRequests"));
const FriendSuggest = lazy(() => import("../components/friend/FriendSuggest"));
const FriendHome = lazy(() => import("../components/friend/FriendHome"));
const PlacesNearYou = lazy(() => import("../components/friend/PlacesNearYou"));
const Settings = lazy(() => import("./Settings"));
const ProfileSetting = lazy(() => import("../components/setting/ProfileSetting.js"));
const AccountSetting = lazy(() => import("../components/setting/AccountSetting.js"));
const PrivacySetting = lazy(() => import("../components/setting/PrivacySetting.js"));
const NotificationSetting = lazy(() => import("../components/setting/NotificationSetting.js"));
const MessageSetting = lazy(() => import("../components/setting/MessageSetting.js"));
const PreferenceSetting = lazy(() => import("../components/setting/PreferenceSetting.js"));
const SoundSetting = lazy(() => import("../components/setting/SoundSetting.js"));
const CacheSetting = lazy(() => import("../components/setting/CacheSetting.js"));
const VideoCallPage = lazy(() => import("./VideoCallPage.js"));
const Youtebe = lazy(() => import("./Youtebe.js"));
const SingleVideo = lazy(() => import("../components/downloads/SingleVideo.js"));
const SavedVideos = lazy(() => import("./SavedVideos.js"));
const LudoGame = lazy(() => import("./ludo"));
const ChessGame = lazy(() => import("./ChessGame"));
const VideoPlayer = lazy(() => import("./VideoPlayer.js"));
const Notes = lazy(() => import("./Notes.js"));
const Tasks = lazy(() => import("./Tasks.js"));
const FocusTimer = lazy(() => import("./FocusTimer.js"));
const Flashcards = lazy(() => import("./Flashcards.js"));
const Calendar = lazy(() => import("./Calendar.js"));
const Habits = lazy(() => import("./Habits.js"));
const Health = lazy(() => import("./Health.js"));
const Rehab = lazy(() => import("./Rehab.js"));
const Camera = lazy(() => import("./Camera.js"));
const AIAgentModal = lazy(() =>
  import("../components/modal/AIAgentModal/AIAgentModal"),
);

const RouteFallback = () => (
  <div id="site-loader" className="route-fallback">
    <div className="loader-logo-container">
      <img src={config?.logo} alt="connect" />
    </div>
  </div>
);

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

// Helper function to truncate text to maximum 10 words
const truncateToTenWords = (text) => {
  if (!text) return "";
  const words = String(text).trim().split(/\s+/);
  if (words.length > 10) {
    return words.slice(0, 10).join(" ") + "...";
  }
  return words.join(" ");
};

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
  const rawBodyText =
    (msg?.message && String(msg.message).trim()) ||
    (msg?.text && String(msg.text).trim()) ||
    "You have a new message";
  const bodyText = truncateToTenWords(rawBodyText);

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
  speech.lang = "en-US";
  speech.rate = 1;
  speech.pitch = 1;

  window.speechSynthesis.speak(speech);
};

const isAudioAttachmentUrl = (url) => {
  if (!url || typeof url !== "string") return false;
  const lower = url.toLowerCase();
  return (
    lower.includes(".mp3") ||
    lower.includes(".wav") ||
    lower.includes(".ogg") ||
    lower.includes(".webm") ||
    lower.includes(".m4a") ||
    lower.includes("/audio/") ||
    lower.includes("voice-")
  );
};

// Track message notifications to prevent duplicate toasts across page reloads
// Store message IDs and last notification time for persistence
const DEDUP_STORAGE_KEY = "notifiedMessageIds"; // Store set of notified message IDs
const DEDUP_NOTIFICATIONS_KEY = "notifiedNotificationIds"; // Store set of notified notification IDs
const LAST_NOTIFICATION_FETCH_KEY = "lastNotificationFetchTime"; // Store last fetch timestamp
const DEDUP_WINDOW_MS = 24 * 60 * 60 * 1000; // Keep notified IDs for 24 hours, then auto-cleanup

const getNotifiedMessages = () => {
  try {
    const stored = localStorage.getItem(DEDUP_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Clean up very old entries (more than 24 hours old)
      const now = Date.now();
      const cleaned = Object.fromEntries(
        Object.entries(parsed).filter(
          ([, timestamp]) => now - timestamp < DEDUP_WINDOW_MS,
        ),
      );
      return cleaned;
    }
  } catch (error) {
    console.error("Error loading notified messages:", error);
  }
  return {};
};

const saveNotifiedMessages = (obj) => {
  try {
    localStorage.setItem(DEDUP_STORAGE_KEY, JSON.stringify(obj));
  } catch (error) {
    console.error("Error saving notified messages:", error);
  }
};

const getLastNotificationFetchTime = () => {
  try {
    const stored = localStorage.getItem(LAST_NOTIFICATION_FETCH_KEY);
    return stored ? parseInt(stored, 10) : 0;
  } catch (error) {
    console.error("Error loading last notification fetch time:", error);
    return 0;
  }
};

const saveLastNotificationFetchTime = (timestamp) => {
  try {
    localStorage.setItem(LAST_NOTIFICATION_FETCH_KEY, String(timestamp));
  } catch (error) {
    console.error("Error saving last notification fetch time:", error);
  }
};

const getNotifiedNotifications = () => {
  try {
    const stored = localStorage.getItem(DEDUP_NOTIFICATIONS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Clean up very old entries (more than 24 hours old)
      const now = Date.now();
      const cleaned = Object.fromEntries(
        Object.entries(parsed).filter(
          ([, timestamp]) => now - timestamp < DEDUP_WINDOW_MS,
        ),
      );
      return cleaned;
    }
  } catch (error) {
    console.error("Error loading notified notifications:", error);
  }
  return {};
};

const saveNotifiedNotifications = (obj) => {
  try {
    localStorage.setItem(DEDUP_NOTIFICATIONS_KEY, JSON.stringify(obj));
  } catch (error) {
    console.error("Error saving notified notifications:", error);
  }
};

// Store message IDs that have been notified with their timestamps
// Using object {messageId: timestamp} instead of Set for persistence across reloads
const notifiedMessageIds = getNotifiedMessages();
const notifiedNotificationIds = getNotifiedNotifications();
let lastNotificationFetchTime = getLastNotificationFetchTime(); // Timestamp of last fetch

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
  const speakAudioElement = useRef(null);
  const pendingSpeakPayloadRef = useRef(null);
  const speakPlayPromiseRef = useRef(null);
  const speakPlayGenerationRef = useRef(0);
  const lastSpeakKeyRef = useRef({ key: "", at: 0 });
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

  const getOrCreateSpeakAudioElement = () => {
    if (!speakAudioElement.current) {
      const audio = document.createElement("audio");
      audio.preload = "auto";
      audio.muted = false;
      audio.volume = 1;
      audio.style.display = "none";
      audio.setAttribute("playsinline", "true");
      audio.setAttribute("webkit-playsinline", "true");
      audio.crossOrigin = "anonymous";
      document.body.appendChild(audio);
      speakAudioElement.current = audio;
    }
    return speakAudioElement.current;
  };

  const resolveSpeakSrc = (audioUrl) => {
    try {
      return new URL(audioUrl, window.location.href).href;
    } catch (_e) {
      return audioUrl;
    }
  };

  const playSpokenVoiceMessage = useCallback(async (payload = {}) => {
    const audioUrl = payload?.attachment;
    if (!audioUrl || !isAudioAttachmentUrl(audioUrl)) return false;

    const resolvedSrc = resolveSpeakSrc(audioUrl);
    const now = Date.now();
    const currentEl = speakAudioElement.current;
    if (
      lastSpeakKeyRef.current.key === resolvedSrc &&
      now - lastSpeakKeyRef.current.at < 400 &&
      currentEl &&
      !currentEl.paused
    ) {
      return true;
    }
    lastSpeakKeyRef.current = { key: resolvedSrc, at: now };

    const el = getOrCreateSpeakAudioElement();
    if (!el) return false;

    const generation = ++speakPlayGenerationRef.current;

    try {
      resumeAudioFromGesture();
    } catch (_e) {}

    // Wait for any in-flight play() to settle before pausing. Calling pause()
    // while play() is pending throws AbortError and sounds "blocked".
    const inFlight = speakPlayPromiseRef.current;
    speakPlayPromiseRef.current = null;
    if (inFlight) {
      try {
        await inFlight;
      } catch (_e) {}
    }

    if (generation !== speakPlayGenerationRef.current) return true;

    try {
      if (!el.paused) {
        el.pause();
      }
    } catch (_e) {}

    const currentSrc = el.currentSrc || el.src || "";
    if (currentSrc !== resolvedSrc) {
      el.src = audioUrl;
    } else {
      try {
        el.currentTime = 0;
      } catch (_e) {}
    }

    el.muted = false;
    el.volume = 1;

    try {
      const playPromise = el.play();
      speakPlayPromiseRef.current = playPromise;
      if (playPromise) {
        await playPromise;
      }
      if (speakPlayPromiseRef.current === playPromise) {
        speakPlayPromiseRef.current = null;
      }
      if (generation !== speakPlayGenerationRef.current) return true;
      pendingSpeakPayloadRef.current = null;
      return true;
    } catch (error) {
      if (speakPlayPromiseRef.current) {
        speakPlayPromiseRef.current = null;
      }
      if (generation !== speakPlayGenerationRef.current) return true;
      if (error?.name === "AbortError") {
        return true;
      }
      pendingSpeakPayloadRef.current = payload;
      console.warn(
        "Background voice playback blocked by browser policy:",
        error,
      );
      return false;
    }
  }, []);

  const [isTabActive, setIsTabActive] = useState(!document.hidden);
  const isTabActiveRef = useRef(isTabActive);
  const notificationIntervalRef = useRef(null);
  const [pendingLudoInvites, setPendingLudoInvites] = useState([]);
  // Track shown ludo invite toasts to prevent duplicates
  const shownLudoInviteToastsRef = useRef(new Map()); // inviteKey -> timestamp
  // Track current active ludo invite toast ID (only one toast at a time)
  const currentLudoInviteToastIdRef = useRef(null);
  const [pendingChessInvites, setPendingChessInvites] = useState([]);
  const shownChessInviteToastsRef = useRef(new Map());
  const currentChessInviteToastIdRef = useRef(null);

  const profileId = user?.profile;

  useEffect(() => {
    isTabActiveRef.current = isTabActive;
  }, [isTabActive]);

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

    fetchChatListCached(profileId, { ttlMs: 30000, storageTtlMs: 120000 })
      .then((contacts) => {
        if (!Array.isArray(contacts) || contacts.length === 0) return;
        dispatch(addMessages(contacts, true));
      })
      .catch((err) => {
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

  // Retry pending voice speak-message playback when media becomes unlocked or
  // when the app regains foreground.
  useEffect(() => {
    const retryPendingSpeak = () => {
      if (document.hidden) return;
      if (speakPlayPromiseRef.current) return;
      const el = speakAudioElement.current;
      if (el && !el.paused) return;
      const payload = pendingSpeakPayloadRef.current;
      if (!payload) return;
      playSpokenVoiceMessage(payload);
    };

    if (audioReady) {
      retryPendingSpeak();
    }

    window.addEventListener("focus", retryPendingSpeak);
    document.addEventListener("click", retryPendingSpeak);
    document.addEventListener("touchstart", retryPendingSpeak, {
      passive: true,
    });

    return () => {
      window.removeEventListener("focus", retryPendingSpeak);
      document.removeEventListener("click", retryPendingSpeak);
      document.removeEventListener("touchstart", retryPendingSpeak);
    };
  }, [audioReady, playSpokenVoiceMessage]);

  // HTTP-based notification polling - memoized to prevent recreation on every render
  const fetchNotifications = useCallback(async () => {
    if (!profileId) return;

    // Skip fetch if tab is not active (optimization for background tabs)
    if (!isTabActiveRef.current) return;

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

          const notificationId =
            notification._id?.toString() || notification._id;

          // Skip if this notification was already shown before
          if (notifiedNotificationIds[notificationId]) {
            console.log("⏭️ Skipping duplicate notification:", notificationId);
            return;
          }

          // Skip toast and browser notification for message types
          if (notification.type !== "message") {
            // Mark as notified
            notifiedNotificationIds[notificationId] = Date.now();
            saveNotifiedNotifications(notifiedNotificationIds);

            console.log("📢 Showing notification:", notificationId);
            const notificationLink = getNotificationLink(notification);
            notify(
              notification.text,
              false,
              notification.icon,
              notificationLink,
            );

            // Mark notification as seen on backend (prevent re-showing on reload)
            api
              .post("/notification/view", { notificationId })
              .catch((err) =>
                console.warn("Failed to mark notification as seen:", err),
              );

            // Skip page Notification when Web Push is subscribed (SW already shows it)
            if (
              webNotificationService.isPermissionGranted &&
              !webNotificationService.hasActivePushSubscription()
            ) {
              const browserNotification = new Notification(
                notification.title || "Connect",
                {
                  body: truncateToTenWords(notification.text),
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
    if (typeof document !== "undefined" && document.hidden) return;

    try {
      const response = await api.get("/message/new-messages", {
        params: { profileId },
      });

      if (response.data.messages && response.data.messages.length > 0) {
        const fetchTime = Date.now();

        response.data.messages.forEach((updatedMessage) => {
          // Validate message has required fields (senderId or receiverId)
          if (!updatedMessage.senderId && !updatedMessage.receiverId) {
            console.warn(
              "Skipping invalid message - missing senderId and receiverId:",
              updatedMessage._id,
            );
            return;
          }

          // Always dispatch to update state (for message history/storage)
          dispatch(newMessage(updatedMessage, profileId));

          const messageId =
            updatedMessage._id?.toString() || updatedMessage._id;

          // Only show notification if message has NOT been notified before
          if (notifiedMessageIds[messageId]) {
            // Message was already notified, skip
            console.log(
              "⏭️ Skipping duplicate notification for message:",
              messageId,
            );
            return;
          }

          // Mark this message as notified with timestamp
          notifiedMessageIds[messageId] = Date.now();
          saveNotifiedMessages(notifiedMessageIds);

          console.log(
            "📬 API: Showing notification for message:",
            messageId,
            "from:",
            updatedMessage.senderId,
          );

          // Update sender's online status
          if (updatedMessage.senderId) {
            const friendOnlineEvent = new CustomEvent("friend_online_client", {
              detail: { profileId: updatedMessage.senderId },
            });
            window.dispatchEvent(friendOnlineEvent);
          }

          // Show notification only if message is not empty
          const messageText = String(updatedMessage.message || "").trim();
          if (messageText) {
            const senderName = updatedMessage.senderName || "Friend";
            const senderPP = updatedMessage.senderPP || "/default-avatar.png";
            notify(
              truncateToTenWords(messageText),
              senderName,
              senderPP,
              "/message/" + updatedMessage.senderId,
            );
          }

          // Note: Do NOT open sticky chat here - socket handler will handle it
          // This prevents duplicate sticky chat boxes from API polling
        });

        // Update the last fetch time
        lastNotificationFetchTime = fetchTime;
        saveLastNotificationFetchTime(fetchTime);
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

    fetchNotifications();
    fetchNewMessages();

    notificationIntervalRef.current = setInterval(() => {
      fetchNotifications();
    }, 90000);

    // Listen for new messages via socket instead of polling
    const handleNewMessageToUser = (data) => {
      console.log("Main received new message via socket:", data);
      if (
        data.updatedMessage &&
        idOf(data.updatedMessage.receiverId) === idOf(profileId)
      ) {
        // Process the message for notifications and UI updates
        const updatedMessage = data.updatedMessage;

        // Validate message has required fields
        if (!updatedMessage.senderId) {
          console.warn(
            "Skipping socket message - missing senderId:",
            updatedMessage._id,
          );
          return;
        }

        // Update sender's online status
        if (updatedMessage.senderId) {
          const friendOnlineEvent = new CustomEvent("friend_online_client", {
            detail: { profileId: updatedMessage.senderId },
          });
          window.dispatchEvent(friendOnlineEvent);
        }

        // Client-side deduplication: skip if already notified
        const messageId = updatedMessage._id?.toString() || updatedMessage._id;

        if (notifiedMessageIds[messageId]) {
          // Message was already notified before
          console.log(
            "⏭️ Skipping duplicate socket notification for message:",
            messageId,
          );
          return;
        }

        // Mark this message as notified with timestamp
        notifiedMessageIds[messageId] = Date.now();
        saveNotifiedMessages(notifiedMessageIds);

        console.log(
          "📬 Socket: Showing notification for message:",
          messageId,
          "from:",
          updatedMessage.senderId,
        );

        // Show notification only if message is not empty
        const messageText = String(updatedMessage.message || "").trim();
        if (messageText) {
          const senderName = data.senderName || "Friend";
          const senderPP = data.senderPP || "/default-avatar.png";
          notify(
            truncateToTenWords(messageText),
            senderName,
            senderPP,
            "/message/" + updatedMessage.senderId,
          );
        }

        // Handle sticky chat opening
        const isOnMessagePage = window.location.pathname.startsWith("/message");
        if (!isOnMessagePage && updatedMessage.senderId) {
          let isChatOpen = false;
          try {
            isChatOpen =
              typeof window.isStickyChatOpen === "function"
                ? window.isStickyChatOpen(updatedMessage.senderId)
                : false;
          } catch (error) {
            console.warn("Error checking if chat is open:", error);
            isChatOpen = false;
          }

          if (!isChatOpen) {
            console.log(
              "💬 Dispatching openStickyChat for:",
              updatedMessage.senderId,
            );
            const openChatEvent = new CustomEvent("openStickyChat", {
              detail: { profileId: updatedMessage.senderId },
            });
            window.dispatchEvent(openChatEvent);
          } else {
            console.log("✅ Chat already open for:", updatedMessage.senderId);
          }
        } else {
          console.log(
            "📄 On message page or no senderId, skipping sticky chat",
          );
        }

        // Update last notification fetch time for persistence
        lastNotificationFetchTime = Date.now();
        saveLastNotificationFetchTime(lastNotificationFetchTime);

        // Dispatch message for Redux state
        dispatch(newMessage(updatedMessage, profileId));
        emitChatMessage(updatedMessage);
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
  }, [profileId, fetchNotifications, fetchNewMessages, dispatch]);

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
        notify(
          truncateToTenWords(msg.message),
          senderName,
          senderPP,
          "/message/" + msg.senderId,
        );
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

    const handleSpeakMessage = async (payload = {}) => {
      const isAudioSpeakRequest =
        payload?.messageType === "audio" ||
        isAudioAttachmentUrl(payload?.attachment);

      if (isAudioSpeakRequest) {
        await playSpokenVoiceMessage(payload);
        return;
      }

      speakText(payload);
    };

    socket.on("notification", handleNotification);
    socket.on("speak_message", handleSpeakMessage);

    return () => {
      socket.off("notification", handleNotification);
      socket.off("speak_message", handleSpeakMessage);
    };
  }, [socket, isTabActive, dispatch, playSpokenVoiceMessage]);

  // Incoming bump: play sound even when this tab is unfocused
  useEffect(() => {
    if (!profileId || !isAuthenticated) return;

    const playIncomingBump = async (payload = {}) => {
      const sender = payload.myProfileData || {};
      const senderId = String(
        payload.senderId || sender._id || payload.from || "",
      );
      if (senderId && senderId === String(profileId)) return;

      const dedupeKey = senderId || "unknown";
      const now = Date.now();
      if (now - (playIncomingBump._last?.[dedupeKey] || 0) < 3000) return;
      playIncomingBump._last = playIncomingBump._last || {};
      playIncomingBump._last[dedupeKey] = now;

      playBumpSound();

      const senderName = sender.fullName || payload.senderName || "Someone";
      const senderPic = sender.profilePic || payload.senderPic || false;
      const chatLink = senderId ? `/message/${senderId}` : "/message";

      if (!document.hidden) {
        showMessageToast("bumped you", senderName, senderPic, chatLink, {
          toastId: `bump-${dedupeKey}`,
        });
      } else if (
        Notification.permission === "granted" &&
        !webNotificationService.hasActivePushSubscription?.()
      ) {
        try {
          const notification = new Notification("You were bumped!", {
            body: `${senderName} bumped you`,
            icon: senderPic || config?.logo || "/logo192.png",
            tag: `bump-${senderId || Date.now()}`,
            silent: true,
          });
          notification.onclick = () => {
            window.focus();
            if (senderId) window.location.href = chatLink;
            notification.close();
          };
        } catch (_e) {}
      }
    };

    const handleBumpUser = (payload) => {
      playIncomingBump(payload);
    };

    const handleSwMessage = (event) => {
      const msg = event.data || {};
      if (msg.type === "PLAY_BUMP") {
        playIncomingBump(msg.data || msg);
      }
    };

    socket.on("bumpUser", handleBumpUser);
    navigator.serviceWorker?.addEventListener?.("message", handleSwMessage);

    return () => {
      socket.off("bumpUser", handleBumpUser);
      navigator.serviceWorker?.removeEventListener?.(
        "message",
        handleSwMessage,
      );
    };
  }, [profileId, isAuthenticated]);

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
        notify(
          truncateToTenWords(notification.text),
          false,
          notification.icon,
          notificationLink,
        );
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
        if (exists) {
          return [
            invite,
            ...prev.filter(
              (item) =>
                !(
                  String(item.gameId) === String(invite.gameId) &&
                  String(item.from) === String(invite.from)
                ),
            ),
          ].slice(0, 20);
        }
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
        resolveLudoInviteNotifications(invite.gameId, invite.from);

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
          reinvite: invite.reinvite === true,
          inviteId: invite.inviteId,
          ts: invite.ts || Date.now(),
          autoAccept: true,
          source: "notification-menu",
        };
        localStorage.setItem("ludo_pending_invite", JSON.stringify(inviteData));
        // Notify an already-mounted LudoGame page (e.g. user is currently on
        // /ludo-game) so it picks up the invite immediately. If the page is
        // not mounted yet, the navigate() below will mount it fresh and it
        // will read the invite from localStorage on mount.
        try {
          window.dispatchEvent(
            new CustomEvent("ludo:pendingInviteUpdated", {
              detail: inviteData,
            }),
          );
        } catch (_e) {}
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
        resolveLudoInviteNotifications(invite.gameId, invite.from);
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

        if (!payload.reinvite && isUserInLudoGame(payload.gameId)) {
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

        if (!shouldShowLudoInviteAlert(payload.gameId, payload.by, payload)) {
          return;
        }

        // Create unique key for this invite
        const inviteKey = payload.inviteId || `${payload.gameId}:${payload.by}`;
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
          reinvite: payload.reinvite === true,
          inviteId: payload.inviteId,
          ts: payload.ts || now,
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
          reinvite: x.reinvite === true,
          inviteId: x.inviteId,
          ts: x.ts || Date.now(),
        }));

        // Filter out invites for games the user is already in or already handled
        const filteredNormalized = normalized.filter((inv) => {
          if (!inv.reinvite && isUserInLudoGame(inv.gameId)) {
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
          return shouldShowLudoInviteAlert(inv.gameId, inv.from, inv);
        });

        filteredNormalized.forEach(upsertPendingInvite);

        const now = Date.now();

        // Filter and mark toasts synchronously to prevent duplicates
        const newInvites = filteredNormalized.filter((inv) => {
          const inviteKey = inv.inviteId || `${inv.gameId}:${inv.from}`;
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
            resolveLudoInviteNotifications(payload.gameId, payload.from);
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

  // Global chess game invitation handlers - work throughout the entire app
  useEffect(() => {
    if (!profileId || !myProfile?._id || !isAuthenticated) return;

    const dismissInviteToast = () => {
      if (currentChessInviteToastIdRef.current !== null) {
        try {
          dismissToast(currentChessInviteToastIdRef.current);
        } catch (_e) {}
        currentChessInviteToastIdRef.current = null;
      }
    };

    const removePendingInvite = (gameId, from) => {
      setPendingChessInvites((prev) =>
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
      setPendingChessInvites((prev) => {
        const exists = prev.some(
          (item) =>
            String(item.gameId) === String(invite.gameId) &&
            String(item.from) === String(invite.from),
        );
        if (exists) {
          return [
            invite,
            ...prev.filter(
              (item) =>
                !(
                  String(item.gameId) === String(invite.gameId) &&
                  String(item.from) === String(invite.from)
                ),
            ),
          ].slice(0, 20);
        }
        return [invite, ...prev].slice(0, 20);
      });
    };

    const acceptChessInvite = (invite) => {
      if (!invite?.gameId) return;
      try {
        dismissInviteToast();
        markChessInviteHandled(invite.gameId, invite.from);
        setActiveChessGameId(invite.gameId);
        removePendingInvite(invite.gameId, invite.from);
        resolveChessInviteNotifications(invite.gameId, invite.from);

        try {
          if (socket && socket.connected) {
            socket.emit("chess:invites:dismiss", {
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
          reinvite: invite.reinvite === true,
          inviteId: invite.inviteId,
          ts: invite.ts || Date.now(),
          autoAccept: true,
          source: "notification-menu",
        };
        localStorage.setItem("chess_pending_invite", JSON.stringify(inviteData));
        try {
          window.dispatchEvent(
            new CustomEvent("chess:pendingInviteUpdated", {
              detail: inviteData,
            }),
          );
        } catch (_e) {}
        navigate("/chess-game");
      } catch (error) {
        console.error("[CHESS_INVITE] Error accepting invite:", error);
      }
    };

    const declineChessInvite = (invite) => {
      if (!invite?.gameId) return;
      try {
        markChessInviteHandled(invite.gameId, invite.from);
        removePendingInvite(invite.gameId, invite.from);
        resolveChessInviteNotifications(invite.gameId, invite.from);
        if (socket && socket.connected) {
          socket.emit("chess:invites:dismiss", {
            gameId: invite.gameId,
            by: invite.from,
          });
        }
        if (currentChessInviteToastIdRef.current !== null) {
          dismissInviteToast();
        }
      } catch (_e) {
        console.error("[CHESS_INVITE] Error declining invite:", _e);
      }
    };

    window.acceptChessInviteFromHeader = acceptChessInvite;
    window.declineChessInviteFromHeader = declineChessInvite;

    const onInvite = (payload) => {
      try {
        if (!payload) return;
        if (location.pathname.includes("/chess-game")) {
          try {
            const activeInvite = localStorage.getItem("chess_pending_invite");
            const parsedInvite = activeInvite ? JSON.parse(activeInvite) : null;
            const samePendingGame =
              parsedInvite?.gameId &&
              String(parsedInvite.gameId) === String(payload.gameId);
            if (samePendingGame || isUserInChessGame(payload.gameId)) {
              if (socket && socket.connected) {
                socket.emit("chess:invites:dismiss", {
                  gameId: payload.gameId,
                  by: payload.by,
                });
              }
              return;
            }
          } catch (_e) {}
        }
        if (payload.to && String(payload.to) !== String(myProfile._id)) return;

        if (!payload.reinvite && isUserInChessGame(payload.gameId)) {
          try {
            if (socket && socket.connected) {
              socket.emit("chess:invites:dismiss", {
                gameId: payload.gameId,
                by: payload.by,
              });
            }
          } catch (_e) {}
          return;
        }

        if (!shouldShowChessInviteAlert(payload.gameId, payload.by, payload)) {
          return;
        }

        const inviteKey = payload.inviteId || `${payload.gameId}:${payload.by}`;
        const now = Date.now();
        const lastShownTime = shownChessInviteToastsRef.current.get(inviteKey);
        if (lastShownTime && now - lastShownTime < 30000) {
          return;
        }

        shownChessInviteToastsRef.current.set(inviteKey, now);
        for (const [key, timestamp] of shownChessInviteToastsRef.current.entries()) {
          if (now - timestamp > 60000) {
            shownChessInviteToastsRef.current.delete(key);
          }
        }

        const invite = {
          from: payload.by,
          name: payload.name,
          avatar: payload.avatar,
          cover: payload.cover,
          gameId: payload.gameId,
          reinvite: payload.reinvite === true,
          inviteId: payload.inviteId,
          ts: payload.ts || now,
        };

        upsertPendingInvite(invite);
        dismissInviteToast();

        const toastId = showChessInviteToast(
          payload.name || "A friend",
          payload.avatar,
          () => {
            acceptChessInvite(invite);
          },
          () => {
            declineChessInvite(invite);
            if (currentChessInviteToastIdRef.current === toastId) {
              currentChessInviteToastIdRef.current = null;
            }
          },
        );
        currentChessInviteToastIdRef.current = toastId;
      } catch (error) {
        console.error("[CHESS_INVITE] Error handling invite:", error);
      }
    };

    const onInvites = (payload) => {
      try {
        const arr = Array.isArray(payload?.invites) ? payload.invites : [];
        const normalized = arr.map((x) => ({
          from: x.by ?? x.from,
          name: x.name,
          avatar: x.avatar,
          cover: x.cover,
          gameId: x.gameId,
          reinvite: x.reinvite === true,
          inviteId: x.inviteId,
          ts: x.ts || Date.now(),
        }));

        const filteredNormalized = normalized.filter((inv) => {
          if (!inv.reinvite && isUserInChessGame(inv.gameId)) {
            try {
              if (socket && socket.connected) {
                socket.emit("chess:invites:dismiss", {
                  gameId: inv.gameId,
                  by: inv.from,
                });
              }
            } catch (_e) {}
            return false;
          }
          if (location.pathname.includes("/chess-game")) {
            try {
              const activeInvite = localStorage.getItem("chess_pending_invite");
              const parsedInvite = activeInvite
                ? JSON.parse(activeInvite)
                : null;
              const samePendingGame =
                parsedInvite?.gameId &&
                String(parsedInvite.gameId) === String(inv.gameId);
              if (samePendingGame) {
                if (socket && socket.connected) {
                  socket.emit("chess:invites:dismiss", {
                    gameId: inv.gameId,
                    by: inv.from,
                  });
                }
                return false;
              }
            } catch (_e) {}
          }
          return shouldShowChessInviteAlert(inv.gameId, inv.from, inv);
        });

        filteredNormalized.forEach(upsertPendingInvite);

        const now = Date.now();
        const newInvites = filteredNormalized.filter((inv) => {
          const inviteKey = inv.inviteId || `${inv.gameId}:${inv.from}`;
          const lastShownTime = shownChessInviteToastsRef.current.get(inviteKey);
          if (lastShownTime && now - lastShownTime < 30000) {
            return false;
          }
          shownChessInviteToastsRef.current.set(inviteKey, now);
          return true;
        });

        for (const [key, timestamp] of shownChessInviteToastsRef.current.entries()) {
          if (now - timestamp > 60000) {
            shownChessInviteToastsRef.current.delete(key);
          }
        }

        dismissInviteToast();

        if (newInvites.length > 0) {
          const inv = newInvites[0];
          const toastId = showChessInviteToast(
            inv.name || "A friend",
            inv.avatar,
            () => {
              acceptChessInvite(inv);
            },
            () => {
              declineChessInvite(inv);
              if (currentChessInviteToastIdRef.current === toastId) {
                currentChessInviteToastIdRef.current = null;
              }
            },
          );
          currentChessInviteToastIdRef.current = toastId;
        }
      } catch (error) {
        console.error("[CHESS_INVITES] Error handling invites:", error);
      }
    };

    const onState = (payload) => {
      try {
        if (!payload?.gameId) return;
        const pid = myProfile?._id ? String(myProfile._id) : "";
        const isPlayer =
          (payload.whitePlayer && String(payload.whitePlayer) === pid) ||
          (payload.blackPlayer && String(payload.blackPlayer) === pid);
        if (!isPlayer) return;

        setActiveChessGameId(payload.gameId);
        markChessInviteHandled(payload.gameId, payload.from);
        resolveChessInviteNotifications(payload.gameId, payload.from);
        setPendingChessInvites((prev) =>
          prev.filter((inv) => String(inv.gameId) !== String(payload.gameId)),
        );
        dismissInviteToast();
      } catch (error) {
        console.error("[CHESS_STATE] Error handling state event:", error);
      }
    };

    if (socket) {
      socket.on("chess:invite", onInvite);
      socket.on("chess:invites", onInvites);
      socket.on("chess:state", onState);

      const requestInvites = () => {
        try {
          socket.emit("chess:invites:get", {});
        } catch (_e) {}
      };
      if (socket.connected) {
        requestInvites();
      }
      socket.on("connect", requestInvites);

      return () => {
        delete window.acceptChessInviteFromHeader;
        delete window.declineChessInviteFromHeader;
        socket.off("chess:invite", onInvite);
        socket.off("chess:invites", onInvites);
        socket.off("chess:state", onState);
        socket.off("connect", requestInvites);
      };
    }

    return () => {
      delete window.acceptChessInviteFromHeader;
      delete window.declineChessInviteFromHeader;
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

    const cachedProfile = getCachedProfile();
    if (cachedProfile?._id) {
      dispatch(getProfileSuccess(cachedProfile));
    } else {
      dispatch(getPorfileReq());
    }

    fetchProfileCached(profileId, { ttlMs: 60000, storageTtlMs: 300000 })
      .then((profileData) => {
        if (profileData) {
          dispatch(getProfileSuccess(profileData));
          primeCachedResource(`profile:${profileId}`, profileData);
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

  useEffect(() => {
    if (!isAuthenticated || !profileId) return undefined;
    const timer = window.setTimeout(() => {
      import("../components/VideoCall/VideoCall.js");
      import("../components/AudioCall/AudioCall.js");
      import("../components/LiveVoice/LiveVoice.js");
    }, 400);
    return () => window.clearTimeout(timer);
  }, [isAuthenticated, profileId]);

  // Listen for auth logout events from API interceptor
  useEffect(() => {
    // Clear browser storage, caches, indexedDB and service workers
    const clearAllClientCaches = async () => {
      try {
        // Clear synchronous storages
        try {
          localStorage.clear();
        } catch (e) {
          console.warn("Failed to clear localStorage:", e);
        }
        try {
          sessionStorage.clear();
        } catch (e) {
          console.warn("Failed to clear sessionStorage:", e);
        }

        // Clear CacheStorage (registered service worker caches)
        if (typeof caches !== "undefined" && caches.keys) {
          try {
            const cacheKeys = await caches.keys();
            await Promise.all(cacheKeys.map((key) => caches.delete(key)));
          } catch (e) {
            console.warn("Failed to clear CacheStorage:", e);
          }
        }

        // Delete all IndexedDB databases (when supported)
        if (typeof indexedDB !== "undefined") {
          try {
            if (indexedDB.databases) {
              const dbs = await indexedDB.databases();
              await Promise.all(
                dbs
                  .filter((d) => d && d.name)
                  .map(
                    (d) =>
                      new Promise((res) => {
                        const req = indexedDB.deleteDatabase(d.name);
                        req.onsuccess = () => res();
                        req.onerror = () => res();
                        req.onblocked = () => res();
                      }),
                  ),
              );
            }
          } catch (e) {
            console.warn("Failed to clear IndexedDB databases:", e);
          }
        }

        // Unregister service workers (best-effort)
        if (navigator?.serviceWorker?.getRegistrations) {
          try {
            const regs = await navigator.serviceWorker.getRegistrations();
            await Promise.all(regs.map((r) => r.unregister().catch(() => {})));
          } catch (e) {
            console.warn("Failed to unregister service workers:", e);
          }
        }
      } catch (err) {
        console.warn("Error while clearing client caches:", err);
      }
    };

    const handleAuthLogout = async () => {
      console.log("🔄 Auth logout event received, logging out user...");
      try {
        // Try to disconnect socket to stop realtime events immediately
        try {
          if (socket && typeof socket.disconnect === "function") {
            socket.disconnect();
          }
        } catch (_e) {
          // ignore
        }

        await clearAllClientCaches();

        // Clear in-memory deduplication caches
        try {
          Object.keys(notifiedMessageIds).forEach(
            (k) => delete notifiedMessageIds[k],
          );
        } catch (e) {}
        try {
          Object.keys(notifiedNotificationIds).forEach(
            (k) => delete notifiedNotificationIds[k],
          );
        } catch (e) {}
        try {
          lastNotificationFetchTime = 0;
        } catch (e) {}
      } catch (e) {
        console.warn("Error during logout cleanup:", e);
      }

      if (logout) {
        try {
          logout();
        } catch (e) {
          console.warn("logout() threw an error:", e);
        }
      }

      // Redirect to login page
      try {
        window.location.href = "/login";
      } catch (e) {
        console.warn("Failed to redirect after logout:", e);
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
    location.pathname.startsWith("/youtube") ||
    location.pathname.startsWith("/camera");

  // AI Agent Modal State
  const [isAIAgentModalOpen, setIsAIAgentModalOpen] = useState(false);

  useEffect(() => {
    const openAgent = () => setIsAIAgentModalOpen(true);
    window.addEventListener("openAIAgent", openAgent);
    return () => window.removeEventListener("openAIAgent", openAgent);
  }, []);

  // Cleanup audio elements on unmount
  useEffect(() => {
    return () => {
      if (audioElement.current) {
        audioElement.current.pause();
        if (audioElement.current.parentNode) {
          audioElement.current.parentNode.removeChild(audioElement.current);
        }
        audioElement.current = null;
      }
      if (speakAudioElement.current) {
        speakAudioElement.current.pause();
        if (speakAudioElement.current.parentNode) {
          speakAudioElement.current.parentNode.removeChild(
            speakAudioElement.current,
          );
        }
        speakAudioElement.current = null;
      }
      pendingSpeakPayloadRef.current = null;
      speakPlayPromiseRef.current = null;
      speakPlayGenerationRef.current += 1;
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
        <Header
          pendingLudoInvites={pendingLudoInvites}
          pendingChessInvites={pendingChessInvites}
          onAIAgentOpen={() => setIsAIAgentModalOpen(true)}
        />
      )}

      <div id="main-container" className={isLoading ? "loading" : ""}>
        {/* <Face /> */}

        <Suspense fallback={<RouteFallback />}>
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
              <Route index element={<ProfileAbout />} />
              <Route path="about" element={<ProfileAbout />} />
              <Route path="posts" element={<PorfilePosts />} />
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
              path="/camera"
              element={
                <ProtectedRoute>
                  <Camera />
                </ProtectedRoute>
              }
            >
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
              path="/rehab"
              element={
                <ProtectedRoute>
                  <Rehab />
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
        </Suspense>
      </div>

      {isAuthenticated && profileId ? (
        <Suspense fallback={null}>
          <VideoCall myId={profileId}></VideoCall>
          <AudioCall myId={profileId}></AudioCall>
          <LiveVoice myId={profileId}></LiveVoice>
        </Suspense>
      ) : null}
      <StickyChatBoxContainer />
      {isAIAgentModalOpen && (
        <Suspense fallback={null}>
          <AIAgentModal
            isOpen
            onClose={() => setIsAIAgentModalOpen(false)}
          />
        </Suspense>
      )}
      <ToastContainer
        position="top-center"
        autoClose={5000}
        hideProgressBar={true}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss={false}
        draggable
        draggablePercent={40}
        pauseOnHover={false}
        theme="light"
        className="custom-toast-container"
        icon={false}
        closeButton={false}
        toastClassName="custom-toast-item"
        transition={Slide}
        limit={4}
        style={{ zIndex: 10050 }}
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
