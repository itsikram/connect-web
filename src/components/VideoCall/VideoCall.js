import React, {
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
} from "react";
import socket from "../../common/socket";
import ModalContainer from "../modal/ModalContainer";
import AgoraRTC from "agora-rtc-sdk-ng";
import { useSelector } from "react-redux";
import useIsMobile from "../../utils/useIsMobile";
import ringtones from "../../config/ringtones.json";
import { normalizeRingtoneId } from "../../utils/normalizeRingtoneId";
import api from "../../api/api";
import { useCallMinimize } from "../../contexts/CallMinimizeContext";
import config from "../../config/config.json";
import audioPreloader from "../../utils/audioPreloader";
import {
  unlockAudio,
  playAudioWithWebAudio,
  initializeAudioUnlock,
} from "../../utils/audioUnlock";
import {
  showCallNotification,
  closeCallNotification,
} from "../../utils/callNotification";

const RINGTONE_DB_NAME = "connect-audio-cache";
const RINGTONE_DB_VERSION = 1;
const RINGTONE_STORE_NAME = "ringtones";

/** Keep full camera frame visible (no crop) */
const VIDEO_FIT = { fit: "contain" };

const stopMediaTracks = (mediaContainer) => {
  if (!mediaContainer) return;
  const mediaElements = [
    mediaContainer,
    ...Array.from(mediaContainer.querySelectorAll?.("video, audio") || []),
  ];
  mediaElements.forEach((mediaElement) => {
    const stream = mediaElement.srcObject;
    if (stream?.getTracks) {
      stream.getTracks().forEach((track) => track.stop());
      mediaElement.srcObject = null;
    }
  });
};

const closeAgoraTrack = (track) => {
  try {
    track.getMediaStreamTrack?.()?.stop();
  } catch (error) {
    console.warn("VideoCall: Error stopping browser media track:", error);
  }
  try {
    track.close();
  } catch (error) {
    console.warn("VideoCall: Error closing Agora track:", error);
  }
};

const readTrackAspectRatio = (videoTrack) => {
  try {
    const settings = videoTrack?.getMediaStreamTrack?.()?.getSettings?.() || {};
    if (settings.width > 0 && settings.height > 0) {
      return settings.width / settings.height;
    }
  } catch (_) {}
  return null;
};

const readElementAspectRatio = (containerEl) => {
  try {
    const media = containerEl?.querySelector?.("video, canvas");
    if (media?.videoWidth > 0 && media?.videoHeight > 0) {
      return media.videoWidth / media.videoHeight;
    }
    if (media?.width > 0 && media?.height > 0) {
      return media.width / media.height;
    }
  } catch (_) {}
  return null;
};

const VideoCall = ({ myId }) => {
  const mySettings = useSelector((state) => state.setting);
  const [isVideoCall, setIsVideoCall] = useState(false);
  const [callerName, setCallerName] = useState("");
  const [callerProfilePic, setCallerProfilePic] = useState("");
  const [receivingCall, setReceivingCall] = useState(false);
  const [caller, setCaller] = useState("");
  const [callAccepted, setCallAccepted] = useState(false);
  const [isMicrophone, setIsMicrophone] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isBackCamera, setIsBackCamera] = useState(false);
  const [hasVideoInput, setHasVideoInput] = useState(true);
  const [modalHeight] = useState("auto");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [filterFriendVideo, setFilterFriendVideo] = useState(false);
  const [filterMyVideo, setFilterMyVideo] = useState(false);
  const [currentChannel, setCurrentChannel] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [outgoingCallStatus, setOutgoingCallStatus] = useState("");
  const [remoteAspectRatio, setRemoteAspectRatio] = useState(null);
  const [localAspectRatio, setLocalAspectRatio] = useState(null);
  const callStartTime = useRef(null);
  const receivingCallRef = useRef(false);
  const callAcceptedRef = useRef(callAccepted);
  const currentChannelRef = useRef(currentChannel);
  const callerRef = useRef(caller);
  const callSeenStatusSentRef = useRef(false);
  const callIgnoredStatusSentRef = useRef(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    receivingCallRef.current = receivingCall;
  }, [receivingCall]);

  useEffect(() => {
    callAcceptedRef.current = callAccepted;
  }, [callAccepted]);

  useEffect(() => {
    currentChannelRef.current = currentChannel;
  }, [currentChannel]);

  useEffect(() => {
    callerRef.current = caller;
  }, [caller]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const myVideo = useRef();
  const userVideo = useRef();
  const callEndBtn = useRef();
  const ringtoneAudio = useRef();
  const ringtoneBufferSource = useRef(null);
  const ringtoneObjectUrlRef = useRef(null);
  const ringtoneObjectUrlSourceRef = useRef("");
  const originalTitleRef = useRef(document?.title || "");
  const titleFlashIntervalRef = useRef(null);
  const pendingAutoAcceptRef = useRef(false);
  const answerCallRef = useRef(null);

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
  const cleanupVideoCallRef = useRef(null);

  // Stable numeric UID for Agora (avoids string-UID warning)
  const numericUid = useMemo(() => {
    if (!myId) return 0;
    let hash = 0;
    for (let i = 0; i < myId.length; i++) {
      hash = (hash << 5) - hash + myId.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }, [myId]);

  const isMobile = useIsMobile();
  const {
    minimizeCall,
    restoreCall,
    endMinimizedCall,
    getMinimizedCall,
    updateMinimizedCall,
  } = useCallMinimize();
  const normalizeAudioSrc = (src) => {
    try {
      return new URL(src, window.location.href).href;
    } catch (error) {
      return src;
    }
  };

  const openRingtoneDb = useCallback(
    () =>
      new Promise((resolve) => {
        if (typeof window === "undefined" || !window.indexedDB) {
          resolve(null);
          return;
        }

        try {
          const request = window.indexedDB.open(
            RINGTONE_DB_NAME,
            RINGTONE_DB_VERSION,
          );

          request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(RINGTONE_STORE_NAME)) {
              db.createObjectStore(RINGTONE_STORE_NAME);
            }
          };

          request.onsuccess = () => resolve(request.result);
          request.onerror = () => {
            console.warn(
              "VideoCall: Failed to open ringtone IndexedDB",
              request.error,
            );
            resolve(null);
          };
        } catch (error) {
          console.warn(
            "VideoCall: IndexedDB unavailable for ringtone cache",
            error,
          );
          resolve(null);
        }
      }),
    [],
  );

  const getCachedRingtoneBlob = useCallback(
    async (src) => {
      const normalizedSrc = normalizeAudioSrc(src);
      const db = await openRingtoneDb();
      if (!db) return null;

      return new Promise((resolve) => {
        try {
          const tx = db.transaction(RINGTONE_STORE_NAME, "readonly");
          const store = tx.objectStore(RINGTONE_STORE_NAME);
          const request = store.get(normalizedSrc);

          request.onsuccess = () => resolve(request.result || null);
          request.onerror = () => resolve(null);
        } catch (error) {
          resolve(null);
        }
      });
    },
    [openRingtoneDb],
  );

  const saveRingtoneBlob = useCallback(
    async (src, blob) => {
      const normalizedSrc = normalizeAudioSrc(src);
      const db = await openRingtoneDb();
      if (!db) return false;

      return new Promise((resolve) => {
        try {
          const tx = db.transaction(RINGTONE_STORE_NAME, "readwrite");
          const store = tx.objectStore(RINGTONE_STORE_NAME);
          store.put(blob, normalizedSrc);

          tx.oncomplete = () => resolve(true);
          tx.onerror = () => resolve(false);
          tx.onabort = () => resolve(false);
        } catch (error) {
          resolve(false);
        }
      });
    },
    [openRingtoneDb],
  );

  const cacheRingtoneInIndexedDb = useCallback(
    async (src) => {
      if (!src) return false;

      const normalizedSrc = normalizeAudioSrc(src);
      const existing = await getCachedRingtoneBlob(normalizedSrc);
      if (existing) return true;

      try {
        const response = await fetch(normalizedSrc, { cache: "force-cache" });
        if (!response.ok) return false;
        const blob = await response.blob();
        if (!blob) return false;
        return saveRingtoneBlob(normalizedSrc, blob);
      } catch (error) {
        console.warn("VideoCall: Failed to cache ringtone in IndexedDB", error);
        return false;
      }
    },
    [getCachedRingtoneBlob, saveRingtoneBlob],
  );

  const resolveIncomingRingtoneSrc = useCallback(() => {
    const ringtoneId = normalizeRingtoneId(mySettings?.ringtone);
    const ringtone = ringtones.find((r) => r.id === ringtoneId);
    return (
      ringtone?.src || config?.defaultRingtone || config?.callingBeep || ""
    );
  }, [mySettings?.ringtone]);

  const ensureRingtoneSourceReady = useCallback(async () => {
    if (!ringtoneAudio?.current) return "";

    const sourceSrc = resolveIncomingRingtoneSrc();
    if (!sourceSrc) return "";

    const normalizedSourceSrc = normalizeAudioSrc(sourceSrc);
    const audio = ringtoneAudio.current;

    let playbackSrc = normalizedSourceSrc;

    try {
      const cachedBlob = await getCachedRingtoneBlob(normalizedSourceSrc);
      if (cachedBlob) {
        if (
          !ringtoneObjectUrlRef.current ||
          ringtoneObjectUrlSourceRef.current !== normalizedSourceSrc
        ) {
          if (ringtoneObjectUrlRef.current) {
            URL.revokeObjectURL(ringtoneObjectUrlRef.current);
          }
          ringtoneObjectUrlRef.current = URL.createObjectURL(cachedBlob);
          ringtoneObjectUrlSourceRef.current = normalizedSourceSrc;
        }
        playbackSrc = ringtoneObjectUrlRef.current;
      } else {
        cacheRingtoneInIndexedDb(normalizedSourceSrc).catch(() => {});
      }
    } catch (_) {
      cacheRingtoneInIndexedDb(normalizedSourceSrc).catch(() => {});
    }

    if (!audio.src || audio.src !== playbackSrc) {
      audio.setAttribute("src", playbackSrc);
      audio.load();
    }

    return playbackSrc;
  }, [
    cacheRingtoneInIndexedDb,
    getCachedRingtoneBlob,
    resolveIncomingRingtoneSrc,
  ]);

  const stopRingtone = () => {
    try {
      if (ringtoneAudio?.current) {
        const audio = ringtoneAudio.current;
        audio.pause();
        audio.currentTime = 0;
        audio.loop = false;
        audio.muted = false;
      }

      try {
        const toneSrc = ringtoneAudio?.current?.src || null;
        if (toneSrc) {
          audioPreloader.stopBuffer(toneSrc);
        }
      } catch (_) {}

      if (ringtoneBufferSource.current) {
        try {
          ringtoneBufferSource.current.stop();
        } catch (_) {}
        try {
          ringtoneBufferSource.current.disconnect();
        } catch (_) {}
        ringtoneBufferSource.current = null;
      }
    } catch (err) {
      // ignore
    }
    closeCallNotification();
  };

  const markCallSeenIfNeeded = useCallback(() => {
    if (
      callSeenStatusSentRef.current ||
      !receivingCallRef.current ||
      callAcceptedRef.current
    ) {
      return;
    }

    const to = callerRef.current;
    if (!to) return;

    callSeenStatusSentRef.current = true;
    socket.emit("update-call-status", {
      to: String(to),
      status: "Call seen",
    });
  }, []);

  const markCallIgnoredIfNeeded = useCallback(() => {
    if (
      callIgnoredStatusSentRef.current ||
      !callSeenStatusSentRef.current ||
      !receivingCallRef.current ||
      callAcceptedRef.current
    ) {
      return;
    }

    const to = callerRef.current;
    if (!to) return;

    callIgnoredStatusSentRef.current = true;
    socket.emit("update-call-status", {
      to: String(to),
      status: "Call ignored",
    });
  }, []);

  const startFlashingTitle = useCallback((name = "Someone") => {
    try {
      if (titleFlashIntervalRef.current) return;
      originalTitleRef.current =
        document.title || originalTitleRef.current || "Connect";
      let tick = false;
      titleFlashIntervalRef.current = setInterval(() => {
        tick = !tick;
        document.title = tick
          ? `📞 Incoming video call — ${name}`
          : originalTitleRef.current;
      }, 1000);
    } catch (e) {
      // ignore
    }
  }, []);

  const stopFlashingTitle = useCallback(() => {
    try {
      if (titleFlashIntervalRef.current) {
        clearInterval(titleFlashIntervalRef.current);
        titleFlashIntervalRef.current = null;
      }
      if (originalTitleRef.current) {
        document.title = originalTitleRef.current;
      }
    } catch (e) {
      // ignore
    }
  }, []);

  const playRingtone = useCallback(async () => {
    await unlockAudio();

    if (
      !ringtoneAudio?.current ||
      !receivingCallRef.current ||
      callAcceptedRef.current
    )
      return;

    const audio = ringtoneAudio.current;

    if (!audio.src || audio.src === window.location.href) {
      await ensureRingtoneSourceReady();
    }

    if (!audio.src || audio.src === window.location.href) {
      console.warn("Ringtone audio has no valid source");
      return;
    }

    audio.muted = false;
    audio.volume = 1.0;
    audio.currentTime = 0;
    audio.loop = true;

    const toneSrc = audio.src;

    try {
      if (audioPreloader.hasBuffer(toneSrc)) {
        const srcNode = audioPreloader.playBuffer(toneSrc, { loop: true });
        if (srcNode) {
          ringtoneBufferSource.current = srcNode;
          console.log("Ringtone playing via AudioBuffer");
          return;
        }
      }
    } catch (err) {
      console.warn("AudioBuffer play attempt failed:", err);
    }

    const tryElementPlay = async () => {
      try {
        await playAudioWithWebAudio(audio);
        console.log(
          "Ringtone playing successfully (element via WebAudio helper)",
        );
        return true;
      } catch (error) {
        console.warn("Failed to play ringtone via WebAudio helper:", error);
      }

      try {
        await audio.play();
        console.log("Ringtone playing with fallback method");
        return true;
      } catch (fallbackError) {
        console.warn("Fallback play also failed:", fallbackError);
        return false;
      }
    };

    if (audio.readyState < 2) {
      const handleCanPlay = async () => {
        audio.removeEventListener("canplaythrough", handleCanPlay);
        if (receivingCallRef.current && !callAcceptedRef.current) {
          await tryElementPlay();
        }
      };
      audio.addEventListener("canplaythrough", handleCanPlay);
      if (audio.readyState === 0) audio.load();
    } else if (receivingCallRef.current && !callAcceptedRef.current) {
      await tryElementPlay();
    }
  }, [ensureRingtoneSourceReady]);

  const cleanupVideoCall = useCallback(async () => {
    // Prevent multiple simultaneous cleanups
    if (isCleaningUpRef.current) {
      console.log("Cleanup already in progress, skipping");
      return;
    }
    isCleaningUpRef.current = true;

    stopRingtone();
    stopFlashingTitle();

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

    // Unpublish and leave Agora channel if connected, then dispose client
    try {
      if (clientRef.current && localTracks.current.length > 0) {
        try {
          console.log("VideoCall: Unpublishing local tracks...");
          await clientRef.current.unpublish(localTracks.current);
          console.log("VideoCall: Successfully unpublished tracks");
        } catch (unpubError) {
          console.log(
            "VideoCall: Error unpublishing:",
            unpubError?.message || unpubError,
          );
        }
      }
    } catch (e) {
      console.log("VideoCall: Unpublish outer error:", e);
    }

    try {
      if (clientRef.current) {
        const connectionState = clientRef.current?.connectionState;
        console.log(
          "VideoCall: Client connection state before leave:",
          connectionState,
        );

        // Only try to leave if we're actually connected
        if (
          connectionState === "CONNECTED" ||
          connectionState === "CONNECTING"
        ) {
          try {
            console.log("VideoCall: Attempting to leave channel...");
            await clientRef.current.leave();
            console.log("VideoCall: Successfully left channel");
          } catch (leaveError) {
            console.log(
              "VideoCall: Error leaving channel:",
              leaveError?.message || leaveError,
            );
          }
        } else {
          console.log("VideoCall: Client not connected, skipping leave()");
        }

        try {
          clientRef.current.removeAllListeners();
        } catch (e) {
          console.log("VideoCall: Error removing listeners:", e);
        }
      }
    } catch (error) {
      console.log("VideoCall: Cleanup error:", error?.message || error);
    }
    clientRef.current = null;

    // Close local tracks AFTER unpublishing
    try {
      localTracks.current.forEach(closeAgoraTrack);
    } catch (e) {
      console.log("VideoCall: Error closing tracks:", e);
    }
    localTracks.current = [];

    isJoiningOrJoined.current = false;
    hasBoundClientEvents.current = false;
    callStartTime.current = null;
    console.log("VideoCall: Cleanup - reset call flags");

    // Clear video elements and stop all media streams
    if (myVideo.current) {
      // Stop any media tracks playing in the video element
      const videoElement = myVideo.current;
      if (videoElement.srcObject) {
        const tracks = videoElement.srcObject.getTracks();
        tracks.forEach((track) => {
          track.stop();
          console.log("Stopped video track:", track.kind);
        });
        videoElement.srcObject = null;
      }
      stopMediaTracks(myVideo.current);
      myVideo.current.replaceChildren();
    }
    if (userVideo.current) {
      const videoElement = userVideo.current;
      if (videoElement.srcObject) {
        const tracks = videoElement.srcObject.getTracks();
        tracks.forEach((track) => {
          track.stop();
          console.log("Stopped remote video track:", track.kind);
        });
        videoElement.srcObject = null;
      }
      stopMediaTracks(userVideo.current);
      userVideo.current.replaceChildren();
    }

    setCallAccepted(false);
    setIsVideoCall(false);
    setCurrentChannel(null);
    setReceivingCall(false);
    setIncomingCall(null);
    setCaller("");
    setCallerName("");
    setCallerProfilePic("");
    setFilterMyVideo("");
    setFilterFriendVideo("");
    setIsMicrophone(true);
    setIsCameraOn(true);
    setIsBackCamera(false);
    setIsMinimized(false);
    setCallDuration(0);
    setOutgoingCallStatus("");
    callSeenStatusSentRef.current = false;
    callIgnoredStatusSentRef.current = false;
    if (minimizedDurationInterval.current) {
      clearInterval(minimizedDurationInterval.current);
      minimizedDurationInterval.current = null;
    }

    // Reset cleanup flag after a short delay
    setTimeout(() => {
      isCleaningUpRef.current = false;
    }, 1000);
  }, [currentChannel, endMinimizedCall]);

  useEffect(() => {
    cleanupVideoCallRef.current = cleanupVideoCall;
  }, [cleanupVideoCall]);

  useEffect(() => {
    return () => {
      cleanupVideoCallRef.current?.();
    };
  }, []);

  const endCall = useCallback(
    async (isCancelled = false) => {
      // Prevent calling endCall multiple times
      if (isCleaningUpRef.current) {
        console.log("Already cleaning up, skipping endCall");
        return;
      }

      stopRingtone();
      stopFlashingTitle();
      const friendIdToNotify =
        incomingCall?.from && incomingCall.from !== myId
          ? incomingCall.from
          : incomingCall?.to || caller;
      const channelName = currentChannel;

      // If no call is active, just cleanup
      if (!isVideoCall && !callAccepted && !receivingCall) {
        await cleanupVideoCall();
        return;
      }

      if (callAccepted) {
        if (friendIdToNotify && channelName && friendIdToNotify !== myId) {
          socket.emit("video-call-end", {
            to: String(friendIdToNotify),
            channelName,
          });
          console.log(
            "VideoCall: Emitting video-call-end to friend:",
            friendIdToNotify,
          );
        }
        await cleanupVideoCall();
        return;
      }

      // Not yet accepted — cancel (caller) or reject (callee)
      if (friendIdToNotify && channelName && friendIdToNotify !== myId) {
        if (receivingCall) {
          socket.emit("video-call-reject", {
            to: String(friendIdToNotify),
            channelName,
          });
          console.log(
            "VideoCall: Emitting video-call-reject to friend:",
            friendIdToNotify,
          );
        } else {
          socket.emit("video-call-cancel", {
            to: String(friendIdToNotify),
            channelName,
          });
          console.log(
            "VideoCall: Emitting video-call-cancel to friend:",
            friendIdToNotify,
          );
        }
      }

      await cleanupVideoCall();
    },
    [
      incomingCall,
      caller,
      cleanupVideoCall,
      callAccepted,
      currentChannel,
      myId,
      receivingCall,
    ],
  );
  // Note: isVideoCall removed from deps to prevent unnecessary re-creation; endCall uses current state via refs

  const closeVideoCall = useCallback(() => {
    console.log("VideoCall: Modal close requested");
    endCall();
  }, [endCall]);

  // Consistent mobile button styling (perfect circles)
  const mobileActionButtonStyle = isMobile
    ? {
        width: 56,
        height: 56,
        borderRadius: "50%",
        padding: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 6px 16px rgba(0,0,0,0.35)",
        border: "1px solid rgba(255,255,255,0.08)",
        boxSizing: "border-box",
        overflow: "hidden",
        flexShrink: 0,
        flexBasis: 56,
      }
    : {};

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
    if (
      callAccepted &&
      isMinimized &&
      currentChannel &&
      callStartTime.current
    ) {
      const callId = `video-${currentChannel}`;
      minimizedDurationInterval.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - callStartTime.current) / 1000);
        try {
          updateMinimizedCall(callId, { duration: elapsed });
        } catch (e) {}
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
    const { data } = await api.post("/agora/token", {
      channelName,
      uid: numericUid,
    });
    return data; // { appId, token }
  };

  // Start a call (join & publish)
  const startCall = useCallback(
    async (channelName) => {
      try {
        console.log("Starting Agora call with channel:", channelName);
        setCallAccepted(true);
        setCurrentChannel(channelName);

        // Set call start time for duration tracking
        if (!callStartTime.current) {
          callStartTime.current = Date.now();
        }

        // Prevent double join attempts (race-safe)
        if (isJoiningOrJoined.current) {
          console.warn("Join skipped: client already joining/joined");
          return;
        }
        isJoiningOrJoined.current = true;

        const { appId, token } = await getToken(channelName);
        console.log("Got Agora token for channel:", channelName);

        // Ensure previous client is disposed
        if (clientRef.current) {
          try {
            await clientRef.current.leave();
          } catch (e) {}
          try {
            clientRef.current.removeAllListeners();
          } catch (e) {}
          clientRef.current = null;
        }

        // Create new client and join
        clientRef.current = AgoraRTC.createClient({
          mode: "rtc",
          codec: "vp8",
        });
        const client = clientRef.current;
        await client.join(appId, channelName, token, numericUid);
        console.log("Joined Agora channel successfully");

        // Immediately check for existing users after joining
        setTimeout(() => {
          const remoteUsers = client.remoteUsers;
          console.log(
            "Immediate check - Remote users in channel:",
            remoteUsers.length,
          );
          remoteUsers.forEach((user) => {
            console.log("Remote user details:", {
              uid: user.uid,
              hasVideo: user.hasVideo,
              hasAudio: user.hasAudio,
            });
          });
        }, 500);

        // Signal any hidden emotion camera in ChatHeader to stop before grabbing camera
        try {
          window.dispatchEvent(new Event("stopEmotionCamera"));
        } catch (e) {}

        // Create local audio/video tracks if they don't exist
        if (!localTracks.current || localTracks.current.length === 0) {
          try {
            localTracks.current =
              await AgoraRTC.createMicrophoneAndCameraTracks();
          } catch (trackErr) {
            console.error(
              "createMicrophoneAndCameraTracks failed, falling back to mic only:",
              trackErr,
            );
            // Fallback to microphone-only to keep the call connected
            localTracks.current = [await AgoraRTC.createMicrophoneAudioTrack()];
            setHasVideoInput(false);
            setIsCameraOn(false);
          }
          console.log("Created local tracks");

          // Play local video in myVideo ref if exists (full frame, no crop)
          if (myVideo.current && localTracks.current[1]) {
            localTracks.current[1].play(myVideo.current, VIDEO_FIT);
            const ar = readTrackAspectRatio(localTracks.current[1]);
            if (ar) setLocalAspectRatio(ar);
            console.log("Playing local video");
          }
        } else {
          console.log("Using existing local tracks");
        }

        await client.publish(localTracks.current);
        console.log("Published local tracks");

        // Bind client events only once
        if (!hasBoundClientEvents.current) {
          hasBoundClientEvents.current = true;
          client.on("user-published", async (user, mediaType) => {
            console.log("Remote user published:", user.uid, mediaType);
            try {
              await client.subscribe(user, mediaType);
              console.log("Successfully subscribed to", user.uid, mediaType);

              if (mediaType === "video") {
                if (userVideo.current && user.videoTrack) {
                  // Clear any existing content first
                  userVideo.current.innerHTML = "";
                  user.videoTrack.play(userVideo.current, VIDEO_FIT);
                  const ar =
                    readTrackAspectRatio(user.videoTrack) ||
                    readElementAspectRatio(userVideo.current);
                  if (ar) setRemoteAspectRatio(ar);
                  // Retry aspect after decoder fills videoWidth/videoHeight
                  setTimeout(() => {
                    const next = readElementAspectRatio(userVideo.current);
                    if (next) setRemoteAspectRatio(next);
                  }, 400);
                  console.log("Playing remote video from user:", user.uid);
                } else {
                  console.warn(
                    "Cannot play remote video - missing userVideo ref or videoTrack",
                  );
                }
              }

              if (mediaType === "audio") {
                if (user.audioTrack) {
                  user.audioTrack.play();
                  console.log("Playing remote audio from user:", user.uid);
                } else {
                  console.warn("Cannot play remote audio - missing audioTrack");
                }
              }
            } catch (error) {
              console.error(
                "Error subscribing to user:",
                user.uid,
                mediaType,
                error,
              );
            }
          });

          client.on("user-unpublished", (user) => {
            console.log("Remote user unpublished:", user.uid);
            if (userVideo.current) {
              userVideo.current.innerHTML = "";
            }
          });

          // End locally when remote user leaves the channel
          client.on("user-left", async (user) => {
            console.log("Remote user left the channel:", user?.uid);
            try {
              await cleanupVideoCall();
            } catch (e) {
              console.warn("Cleanup after remote user-left failed:", e);
            }
          });
        }

        // Check for existing remote users who may have already published before we joined
        setTimeout(async () => {
          try {
            const remoteUsers = client.remoteUsers;
            console.log(
              "Checking for existing remote users:",
              remoteUsers.length,
            );

            for (const user of remoteUsers) {
              console.log(
                "Found existing remote user:",
                user.uid,
                "hasVideo:",
                user.hasVideo,
                "hasAudio:",
                user.hasAudio,
              );

              // Subscribe to video if available
              if (user.hasVideo && !user.videoTrack) {
                console.log("Subscribing to existing user video:", user.uid);
                await client.subscribe(user, "video");
                if (userVideo.current && user.videoTrack) {
                  user.videoTrack.play(userVideo.current, VIDEO_FIT);
                  const ar = readTrackAspectRatio(user.videoTrack);
                  if (ar) setRemoteAspectRatio(ar);
                  console.log("Playing existing remote user video");
                }
              } else if (
                user.hasVideo &&
                user.videoTrack &&
                userVideo.current
              ) {
                // Video track already exists, just play it
                user.videoTrack.play(userVideo.current, VIDEO_FIT);
                const ar = readTrackAspectRatio(user.videoTrack);
                if (ar) setRemoteAspectRatio(ar);
                console.log("Playing already subscribed remote video");
              }

              // Subscribe to audio if available
              if (user.hasAudio && !user.audioTrack) {
                console.log("Subscribing to existing user audio:", user.uid);
                await client.subscribe(user, "audio");
                if (user.audioTrack) {
                  user.audioTrack.play();
                  console.log("Playing existing remote user audio");
                }
              } else if (user.hasAudio && user.audioTrack) {
                // Audio track already exists, just play it
                user.audioTrack.play();
                console.log("Playing already subscribed remote audio");
              }
            }
          } catch (error) {
            console.error("Error checking for existing remote users:", error);
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
              console.log(
                `Periodic check ${checkCount}: Found ${remoteUsers.length} remote users`,
              );

              for (const user of remoteUsers) {
                // Check if we have video but it's not playing
                if (user.hasVideo && user.videoTrack && userVideo.current) {
                  const videoElement = userVideo.current.querySelector("video");
                  if (
                    !videoElement ||
                    videoElement.paused ||
                    videoElement.readyState === 0
                  ) {
                    console.log(
                      `Periodic check ${checkCount}: Re-attempting to play remote video for user ${user.uid}`,
                    );
                    userVideo.current.innerHTML = "";
                    user.videoTrack.play(userVideo.current, VIDEO_FIT);
                    const ar = readTrackAspectRatio(user.videoTrack);
                    if (ar) setRemoteAspectRatio(ar);
                  }
                }
              }
            }

            if (checkCount >= maxChecks) {
              clearInterval(remoteUserCheckInterval.current);
              remoteUserCheckInterval.current = null;
              console.log("Stopped periodic remote user checks");
            }
          } catch (error) {
            console.error(`Error in periodic check ${checkCount}:`, error);
          }
        }, 2000); // Check every 2 seconds
      } catch (error) {
        console.error("Failed to start call:", error);
        alert("Failed to start call. Please try again.");
        setIsVideoCall(false);
        setCallAccepted(false);
        isJoiningOrJoined.current = false;
      }
    },
    [myId, getToken],
  );

  useEffect(() => {
    const defaultRingtoneSrc =
      config?.defaultRingtone || ringtones.find((r) => r.id === 1)?.src;
    if (defaultRingtoneSrc) {
      cacheRingtoneInIndexedDb(defaultRingtoneSrc).catch(() => {});
    }
  }, [cacheRingtoneInIndexedDb]);

  useEffect(() => {
    const selectedRingtoneSrc = resolveIncomingRingtoneSrc();
    if (selectedRingtoneSrc) {
      cacheRingtoneInIndexedDb(selectedRingtoneSrc).catch(() => {});
    }
  }, [cacheRingtoneInIndexedDb, resolveIncomingRingtoneSrc]);

  useEffect(() => {
    if (!ringtoneAudio?.current || !receivingCall || !incomingCall) return;

    let isCancelled = false;

    const prepareAndPlay = async () => {
      try {
        await ensureRingtoneSourceReady();

        if (
          !isCancelled &&
          receivingCallRef.current &&
          !callAcceptedRef.current
        ) {
          await playRingtone();
        }
      } catch (error) {
        console.warn("VideoCall: Failed to prepare/play ringtone", error);
      }
    };

    prepareAndPlay();

    return () => {
      isCancelled = true;
    };
  }, [receivingCall, incomingCall, ensureRingtoneSourceReady, playRingtone]);

  useEffect(() => {
    // Listen for video calls initiated by this user (outgoing calls from sticky chat box)
    const handleOutgoingVideoCall = async (event) => {
      // Clean up any previous call state first
      if (isCleaningUpRef.current || isVideoCall || currentChannel) {
        console.log(
          "VideoCall - Cleaning up previous call before starting new one",
        );
        await cleanupVideoCall();
        // Wait a bit for cleanup to complete
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      const { to, channelName, callerName, callerProfilePic } = event.detail;
      console.log(
        "VideoCall - Starting outgoing video call to",
        to,
        "channel:",
        channelName,
      );
      console.log("VideoCall - Friend info:", { callerName, callerProfilePic });
      callSeenStatusSentRef.current = false;
      callIgnoredStatusSentRef.current = false;
      setIsVideoCall(true);
      setReceivingCall(false);
      setCaller(to);
      setCallerName(callerName || "Friend");
      setCallerProfilePic(callerProfilePic || config?.defaultProfile);
      setCurrentChannel(channelName);
      setIncomingCall({
        from: myId,
        to,
        channelName,
        name: callerName || "Friend",
        profilePic: callerProfilePic,
      });
      setOutgoingCallStatus("Calling...");
      console.log("VideoCall - Outgoing call modal should now be visible");

      // Start local video immediately when initiating call
      try {
        console.log("VideoCall - Starting local video for outgoing call");
        localTracks.current = await AgoraRTC.createMicrophoneAndCameraTracks();

        // Show local video immediately
        if (myVideo.current && localTracks.current[1]) {
          localTracks.current[1].play(myVideo.current, VIDEO_FIT);
          const ar = readTrackAspectRatio(localTracks.current[1]);
          if (ar) setLocalAspectRatio(ar);
          console.log("VideoCall - Local video started for outgoing call");
        }
      } catch (error) {
        console.error(
          "VideoCall - Failed to start local video for outgoing call:",
          error,
        );
      }
    };

    window.addEventListener("startVideoCall", handleOutgoingVideoCall);

    const applyIncomingVideoCall = async ({
      from,
      channelName,
      callerName,
      callerProfilePic,
    }) => {
      if (!from || !channelName) return;
      // Don't process incoming calls if component is unmounting
      if (!isMountedRef.current) {
        console.log("VideoCall: Component unmounting, ignoring incoming call");
        return;
      }
      // Don't process if already handling this same call (prevents duplicate from socket + push)
      if (
        receivingCallRef.current &&
        currentChannelRef.current === channelName
      ) {
        console.log(
          "VideoCall: Already handling this call (from socket), ignoring duplicate from push",
        );
        return;
      }
      // Already in a call — auto-reject so we don't corrupt the active Agora session
      // Only reject if: currently joined to a channel, accepted a call, or already receiving another incoming call
      if (
        isJoiningOrJoined.current ||
        callAcceptedRef.current ||
        receivingCallRef.current
      ) {
        console.warn("VideoCall: Busy — rejecting incoming call", {
          isJoiningOrJoined: isJoiningOrJoined.current,
          callAccepted: callAcceptedRef.current,
          alreadyReceiving: receivingCallRef.current,
        });
        socket.emit("video-call-reject", { to: String(from), channelName });
        return;
      }
      socket.emit("update-call-status", {
        to: String(from),
        status: "Ringing...",
      });
      console.log(
        "Incoming Agora video call from",
        from,
        "channel:",
        channelName,
      );
      receivingCallRef.current = true;
      callAcceptedRef.current = false;
      currentChannelRef.current = channelName;
      callSeenStatusSentRef.current = false;
      callIgnoredStatusSentRef.current = false;

      setIsVideoCall(true);
      setReceivingCall(true);
      setCaller(from);
      setIncomingCall({
        from,
        channelName,
        name: callerName || "Unknown Caller",
        profilePic: callerProfilePic,
      });
      setCallerName(callerName || "Unknown Caller");
      setCallerProfilePic(callerProfilePic || config?.defaultProfile);
      setCurrentChannel(channelName);

      (async () => {
        try {
          await ensureRingtoneSourceReady();
          await playRingtone();
        } catch (error) {
          console.warn("VideoCall: Failed immediate ringtone playback", error);
        }
      })();

      startFlashingTitle(callerName || "Unknown Caller");

      try {
        // Request permissions explicitly
        const constraints = {
          audio: true,
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            frameRate: { ideal: 15 },
          },
        };

        // First, get user permission for media
        const mediaStream =
          await navigator.mediaDevices.getUserMedia(constraints);
        // Stop the tracks after getting permission (Agora will create its own)
        mediaStream.getTracks().forEach((track) => track.stop());

        // Now create Agora tracks with permission granted
        localTracks.current = await AgoraRTC.createMicrophoneAndCameraTracks();
        if (myVideo.current && localTracks.current[1]) {
          localTracks.current[1].play(myVideo.current, VIDEO_FIT);
          const ar = readTrackAspectRatio(localTracks.current[1]);
          if (ar) setLocalAspectRatio(ar);
          setHasVideoInput(true);
        }
      } catch (error) {
        console.error("Failed to start local video preview:", error);

        // Check if it's a permission denied error
        if (
          error.name === "NotAllowedError" ||
          error.message?.includes("Permission denied")
        ) {
          console.warn("Camera/Microphone permission denied by user");
          // Don't show error - user denied, just fall back to audio only
        }

        // Fallback to audio only
        try {
          localTracks.current = [await AgoraRTC.createMicrophoneAudioTrack()];
          setHasVideoInput(false);
          console.log("Fallback to audio-only mode");
        } catch (micErr) {
          console.error("Mic fallback also failed:", micErr);
          // Even audio failed - might want to show alert to user
          if (
            micErr.name === "NotAllowedError" ||
            micErr.message?.includes("Permission denied")
          ) {
            console.warn(
              "Microphone permission denied - user must grant permissions to participate",
            );
          }
        }
      }

      showCallNotification({
        callerName: callerName || "Unknown Caller",
        callerProfilePic: callerProfilePic || config?.defaultProfile,
        callType: "video",
        callData: { from, channelName },
        onClick: () => {
          window.focus();
        },
      });
    };

    const onIncomingVideoCall = async ({
      from,
      channelName,
      isAudio,
      callerName,
      callerProfilePic,
    }) => {
      // Only handle video calls, ignore audio calls
      if (!isAudio) {
        try {
          await applyIncomingVideoCall({
            from,
            channelName,
            callerName,
            callerProfilePic,
          });
        } catch (error) {
          console.error("Error handling incoming video call:", error);
        }
      }
    };
    socket.on("incoming-video-call", onIncomingVideoCall);

    // Web Push → open app while backgrounded (iOS Home Screen)
    const onPushIncoming = (event) => {
      const detail = event.detail || {};
      if (!detail.isVideo) return;
      console.log(
        "VideoCall: Push notification received for incoming call:",
        detail.channelName,
      );
      if (detail.autoAccept) pendingAutoAcceptRef.current = true;
      applyIncomingVideoCall({
        from: detail.from,
        channelName: detail.channelName,
        callerName: detail.callerName,
        callerProfilePic: detail.callerProfilePic,
      });
    };
    window.addEventListener("incomingCallFromPush", onPushIncoming);

    const onRejectFromPush = (event) => {
      const detail = event.detail || {};
      if (detail.isAudio) return;
      stopRingtone();
      stopFlashingTitle();
      const to = detail.from;
      const channelName = detail.channelName;
      if (to && channelName) {
        socket.emit("video-call-reject", { to: String(to), channelName });
      }
      cleanupVideoCall();
    };
    window.addEventListener("rejectCallFromPush", onRejectFromPush);

    const onCallAccepted = ({ channelName, isAudio }) => {
      // Caller joins here; callee already joined in answerCall — skip echo
      if (!isAudio && !receivingCallRef.current) {
        console.log("Agora video call accepted, joining channel:", channelName);
        stopRingtone();
        stopFlashingTitle();
        setOutgoingCallStatus("");
        startCall(channelName);
      } else if (!isAudio && receivingCallRef.current) {
        console.log(
          "VideoCall: Ignoring call-accepted echo (callee already joined)",
        );
        stopRingtone();
        stopFlashingTitle();
        setOutgoingCallStatus("");
      }
    };
    socket.on("call-accepted", onCallAccepted);

    // Outgoing call status updates from callee
    const handleUpdatedCallStatus = ({ from, status }) => {
      // Only for outgoing (caller) side: receivingCall is false
      if (
        !receivingCallRef.current &&
        !callAcceptedRef.current &&
        callerRef.current &&
        from === callerRef.current
      ) {
        setOutgoingCallStatus(status || "");
      }
    };
    socket.on("updated-call-status", handleUpdatedCallStatus);

    const onVideoCallEnded = async () => {
      console.log(
        "VideoCall: Received video-call-ended event from remote user",
      );
      stopRingtone();
      stopFlashingTitle();
      setOutgoingCallStatus("");
      // Local cleanup ONLY — do not re-emit end
      await cleanupVideoCall();
    };
    socket.on("video-call-ended", onVideoCallEnded);

    const onVideoCallCancelled = async () => {
      console.log(
        "VideoCall: Received video-call-cancelled event from remote user",
      );
      stopRingtone();
      stopFlashingTitle();
      setOutgoingCallStatus("");
      await cleanupVideoCall();
    };
    socket.on("video-call-cancelled", onVideoCallCancelled);

    const onVideoCallRejected = async () => {
      console.log(
        "VideoCall: Received video-call-rejected event from remote user",
      );
      stopRingtone();
      stopFlashingTitle();
      setOutgoingCallStatus("");
      await cleanupVideoCall();
    };
    socket.on("video-call-rejected", onVideoCallRejected);

    const onCallNotAccepted = async ({ isAudio, channelName }) => {
      if (isAudio) return;
      if (!currentChannel && !channelName) return;
      if (channelName && currentChannel && channelName !== currentChannel)
        return;
      console.log("VideoCall: Call not accepted (timeout)");
      stopRingtone();
      stopFlashingTitle();
      setOutgoingCallStatus("No answer");
      await cleanupVideoCall();
    };
    socket.on("call-not-accepted", onCallNotAccepted);

    const onApplyVideoFilter = ({ filter }) => {
      if (filter !== "") {
        setFilterFriendVideo(filter);
      } else {
        setFilterFriendVideo("");
      }
    };
    socket.on("apply-video-filter", onApplyVideoFilter);

    return () => {
      socket.off("incoming-video-call", onIncomingVideoCall);
      socket.off("call-accepted", onCallAccepted);
      socket.off("video-call-ended", onVideoCallEnded);
      socket.off("video-call-cancelled", onVideoCallCancelled);
      socket.off("video-call-rejected", onVideoCallRejected);
      socket.off("call-not-accepted", onCallNotAccepted);
      socket.off("apply-video-filter", onApplyVideoFilter);
      isMountedRef.current = false;
      socket.off("updated-call-status", handleUpdatedCallStatus);
      window.removeEventListener("startVideoCall", handleOutgoingVideoCall);
      window.removeEventListener("incomingCallFromPush", onPushIncoming);
      window.removeEventListener("rejectCallFromPush", onRejectFromPush);
      stopRingtone(); // Stop ringtone on cleanup
      stopFlashingTitle();
    };
  }, []); // No dependencies - setup listeners once on mount only

  // Auto-answer when user pressed Accept on the system notification
  useEffect(() => {
    if (
      pendingAutoAcceptRef.current &&
      receivingCall &&
      incomingCall &&
      !callAccepted
    ) {
      pendingAutoAcceptRef.current = false;
      const t = setTimeout(() => {
        answerCallRef.current?.();
      }, 250);
      return () => clearTimeout(t);
    }
  }, [receivingCall, incomingCall, callAccepted]);

  // Resume ringtone playback when tab becomes visible
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === "hidden") {
        markCallIgnoredIfNeeded();
        return;
      }

      // Only resume if tab is visible, we're receiving a call, and we haven't accepted yet
      if (
        document.visibilityState === "visible" &&
        receivingCallRef.current &&
        !callAcceptedRef.current &&
        ringtoneAudio?.current
      ) {
        markCallSeenIfNeeded();
        const audio = ringtoneAudio.current;
        // Resume playback if it was paused due to tab being hidden
        if (audio.paused && audio.src && audio.src !== window.location.href) {
          console.log("VideoCall: Resuming ringtone on visibility change");
          await unlockAudio();
          audio.muted = false;
          audio.volume = 1.0;
          try {
            await playAudioWithWebAudio(audio);
          } catch (error) {
            audio.play().catch((e) => {
              console.warn(
                "Failed to resume ringtone on visibility change:",
                e,
              );
            });
          }
        }
      }
    };

    const handleWindowFocus = async () => {
      // Also try to resume ringtone on window focus - only if receiving and not accepted
      if (
        receivingCallRef.current &&
        !callAcceptedRef.current &&
        ringtoneAudio?.current
      ) {
        markCallSeenIfNeeded();
        const audio = ringtoneAudio.current;
        if (audio.paused && audio.src && audio.src !== window.location.href) {
          console.log("VideoCall: Resuming ringtone on window focus");
          await unlockAudio();
          audio.muted = false;
          audio.volume = 1.0;
          try {
            await playAudioWithWebAudio(audio);
          } catch (error) {
            audio.play().catch((e) => {
              console.warn("Failed to resume ringtone on window focus:", e);
            });
          }
        }
      }
    };

    const handleWindowBlur = () => {
      markCallIgnoredIfNeeded();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleWindowFocus);
    window.addEventListener("blur", handleWindowBlur);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleWindowFocus);
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, [markCallIgnoredIfNeeded, markCallSeenIfNeeded]); // Handlers use refs; include status callbacks

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      stopRingtone();
      stopFlashingTitle();
      if (ringtoneObjectUrlRef.current) {
        URL.revokeObjectURL(ringtoneObjectUrlRef.current);
        ringtoneObjectUrlRef.current = null;
      }
      ringtoneObjectUrlSourceRef.current = "";
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
        const videoDevices = devices.filter((d) => d.kind === "videoinput");
        setHasVideoInput(videoDevices.length > 0);
      } catch (err) {
        console.error("Error checking video devices:", err);
        setHasVideoInput(false);
      }
    };
    checkVideoDevices();
  }, []);

  const answerCall = useCallback(async () => {
    stopRingtone();
    if (!incomingCall) return;

    console.log("Answering Agora call");

    // Local video should already be showing from when call was received
    // Just proceed to join the channel
    socket.emit("answer-call", {
      to: String(incomingCall.from),
      channelName: incomingCall.channelName,
    });
    await startCall(incomingCall.channelName);
  }, [incomingCall, startCall]);

  useEffect(() => {
    answerCallRef.current = answerCall;
  }, [answerCall]);

  const handleMicrophoneClick = useCallback(async () => {
    // Find the audio track specifically using 'kind' property
    const audioTrack = localTracks.current.find(
      (track) => track.kind === "audio",
    );
    if (audioTrack) {
      console.log(
        "VideoCall - Toggling microphone. Current state:",
        isMicrophone,
        "New state:",
        !isMicrophone,
      );
      console.log("VideoCall - Audio track found:", audioTrack);
      console.log("VideoCall - Audio track kind:", audioTrack.kind);
      await audioTrack.setEnabled(!isMicrophone);
      console.log(
        "VideoCall - Audio track enabled state after toggle:",
        audioTrack.enabled,
      );
    } else {
      console.log(
        "VideoCall - No audio track found in tracks:",
        localTracks.current,
      );
      // Fallback to index 0 (should be audio according to Agora docs)
      if (localTracks.current[0]) {
        console.log(
          "VideoCall - Using fallback - index 0 track:",
          localTracks.current[0],
        );
        await localTracks.current[0].setEnabled(!isMicrophone);
      }
    }
    setIsMicrophone((prev) => !prev);
  }, [isMicrophone]);

  const handleCameraToggle = useCallback(async () => {
    // Find the video track specifically using 'kind' property
    const videoTrack = localTracks.current.find(
      (track) => track.kind === "video",
    );
    if (videoTrack) {
      console.log(
        "VideoCall - Toggling camera. Current state:",
        isCameraOn,
        "New state:",
        !isCameraOn,
      );
      console.log("VideoCall - Video track found:", videoTrack);
      console.log("VideoCall - Video track kind:", videoTrack.kind);
      await videoTrack.setEnabled(!isCameraOn);
      console.log(
        "VideoCall - Video track enabled state after toggle:",
        videoTrack.enabled,
      );
    } else {
      console.log(
        "VideoCall - No video track found in tracks:",
        localTracks.current,
      );
      // Fallback to index 1 (should be video according to Agora docs)
      if (localTracks.current[1]) {
        console.log(
          "VideoCall - Using fallback - index 1 track:",
          localTracks.current[1],
        );
        await localTracks.current[1].setEnabled(!isCameraOn);
      }
    }
    setIsCameraOn((prev) => !prev);
  }, [isCameraOn]);

  const minimizeVideoCall = useCallback(() => {
    if (!callAccepted || !currentChannel) return;

    const callId = `video-${currentChannel}`;
    const callData = {
      id: callId,
      type: "video",
      callerName: callerName || "Unknown Caller",
      callerProfilePic: callerProfilePic,
      callerId: caller,
      status: "connected",
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
      },
    };

    minimizeCall(callData);
    setIsMinimized(true);
    setIsVideoCall(false);
  }, [
    callAccepted,
    currentChannel,
    callerName,
    callerProfilePic,
    caller,
    callDuration,
    isMicrophone,
    isCameraOn,
    minimizeCall,
    handleMicrophoneClick,
    handleCameraToggle,
  ]);

  const restoreVideoCall = useCallback(() => {
    const callId = `video-${currentChannel}`;
    restoreCall(callId);
    setIsMinimized(false);
    setIsVideoCall(true);
  }, [currentChannel, restoreCall]);

  const handleSwitchClick = useCallback(async () => {
    const videoTrack = localTracks.current.find(
      (track) => track.kind === "video",
    );
    if (videoTrack && callAccepted && clientRef.current) {
      try {
        // Unpublish current video track
        await clientRef.current.unpublish([videoTrack]);

        // Stop current video track
        videoTrack.close();

        // Create new video track with switched camera
        const newVideoTrack = await AgoraRTC.createCameraVideoTrack({
          facingMode: isBackCamera ? "user" : "environment",
        });

        // Replace the track in the array
        const videoIndex = localTracks.current.findIndex(
          (track) => track.kind === "video",
        );
        if (videoIndex !== -1) {
          localTracks.current[videoIndex] = newVideoTrack;
        }

        // Publish new track
        await clientRef.current.publish([newVideoTrack]);

        // Play new track in local video element
        if (myVideo.current) {
          newVideoTrack.play(myVideo.current, VIDEO_FIT);
          const ar = readTrackAspectRatio(newVideoTrack);
          if (ar) setLocalAspectRatio(ar);
        }

        setIsBackCamera((prev) => !prev);
      } catch (error) {
        console.error("Failed to switch camera:", error);
      }
    } else {
      setIsBackCamera((prev) => !prev);
    }
  }, [isBackCamera, callAccepted]);

  const toggleFullscreen = useCallback(async () => {
    if (!isFullscreen) {
      // Enter fullscreen
      try {
        const modalElement = document.getElementById("videoCallModal");
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
        console.error("Failed to enter fullscreen:", err);
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
        console.error("Failed to exit fullscreen:", err);
        // Fallback to CSS fullscreen
        setIsFullscreen(false);
      }
    }
  }, [isFullscreen]);

  const toggleVideoFilter = useCallback(() => {
    if (incomingCall?.from && callAccepted) {
      const filters = [
        "video-vivid-filter",
        "video-vivid-warm",
        "video-vivid-cool",
        "video-vivid-dramatic",
        "",
      ];
      const currentIndex = filters.indexOf(filterMyVideo);
      const nextIndex = (currentIndex + 1) % filters.length;
      const newFilter = filters[nextIndex];
      setFilterMyVideo(newFilter);
      socket.emit("filter-video", {
        to: String(incomingCall.from),
        filter: newFilter,
      });
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

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    document.addEventListener("mozfullscreenchange", handleFullscreenChange);
    document.addEventListener("MSFullscreenChange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener(
        "webkitfullscreenchange",
        handleFullscreenChange,
      );
      document.removeEventListener(
        "mozfullscreenchange",
        handleFullscreenChange,
      );
      document.removeEventListener(
        "MSFullscreenChange",
        handleFullscreenChange,
      );
    };
  }, []);

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div>
      <ModalContainer
        title="Video Call"
        style={
          isFullscreen
            ? {}
            : {
                height: modalHeight,
                maxHeight: "min(92dvh, 100svh)",
              }
        }
        isOpen={isVideoCall && !isMinimized}
        onRequestClose={closeVideoCall}
        id="videoCallModal"
        isFullscreen={isFullscreen}
      >
        <div
          className={`${callAccepted ? "call-accepted" : ""} ${isFullscreen ? "fullscreen-content" : ""}`}
          style={{
            padding: 0,
            ["--call-ar"]: String(
              (callAccepted && remoteAspectRatio) ||
                localAspectRatio ||
                (isMobile ? 0.75 : 1.777),
            ),
            ["--local-ar"]: String(localAspectRatio || 0.75),
            display: "flex",
            flexDirection: "column",
            height: "100%",
          }}
        >
          {/* Professional Header */}
          <div
            style={{
              padding: "16px 20px",
              background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
              borderBottom: "1px solid rgba(41, 177, 169, 0.15)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              backdropFilter: "blur(10px)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                flex: 1,
              }}
            >
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  overflow: "hidden",
                  border: "2px solid #29B1A9",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background:
                    "linear-gradient(135deg, #29B1A9 0%, #1a8078 100%)",
                  flexShrink: 0,
                }}
              >
                {callerProfilePic ? (
                  <img
                    src={callerProfilePic}
                    alt={callerName}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                    onError={(e) => {
                      e.target.src = config?.defaultProfile;
                    }}
                  />
                ) : (
                  <i
                    className="fas fa-user"
                    style={{ color: "white", fontSize: "18px" }}
                  ></i>
                )}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <h3
                  style={{
                    margin: "0 0 4px 0",
                    fontSize: isMobile ? "16px" : "18px",
                    fontWeight: "600",
                    color: "#fff",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {callerName}
                </h3>
                <p style={{ margin: 0, fontSize: "12px", color: "#29B1A9" }}>
                  {callAccepted
                    ? `Duration: ${formatDuration(callDuration)}`
                    : receivingCall
                      ? "Incoming call"
                      : "Calling..."}
                </p>
              </div>
            </div>
          </div>

          {/* Video Container Section */}
          {!callAccepted && !receivingCall && (
            <div
              style={{
                // flex: 1,
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                background: "linear-gradient(135deg, #0b0f17 0%, #1a1a2e 100%)",
                padding: "40px 20px",
                gap: "24px",
              }}
            >
              <div
                style={{
                  width: isMobile ? "80px" : "120px",
                  height: isMobile ? "80px" : "120px",
                  borderRadius: "50%",
                  background:
                    "linear-gradient(135deg, #29B1A9 0%, #1a8078 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  animation: "pulse 2s infinite",
                  boxShadow: "0 0 40px rgba(41, 177, 169, 0.3)",
                }}
              >
                <i
                  className="fas fa-phone"
                  style={{
                    color: "white",
                    fontSize: isMobile ? "32px" : "48px",
                  }}
                ></i>
              </div>
              <div style={{ textAlign: "center" }}>
                <p
                  style={{
                    margin: "0 0 8px 0",
                    color: "#29B1A9",
                    fontSize: "12px",
                    fontWeight: "600",
                    textTransform: "uppercase",
                    letterSpacing: "1px",
                  }}
                >
                  Calling
                </p>
                <h2
                  style={{
                    margin: 0,
                    color: "#fff",
                    fontSize: isMobile ? "20px" : "24px",
                    fontWeight: "600",
                  }}
                >
                  {callerName}
                </h2>
                {outgoingCallStatus && (
                  <p
                    style={{
                      margin: "8px 0 0 0",
                      color: "#888",
                      fontSize: "14px",
                    }}
                  >
                    {outgoingCallStatus}
                  </p>
                )}
              </div>
            </div>
          )}

          <div
            className={`video-call-container ${isMobile ? "mobile" : ""} fit-camera`}
            style={{
              width: "100%",
              flex: callAccepted ? 1 : 0,
              aspectRatio: callAccepted
                ? String(
                    (callAccepted && remoteAspectRatio) ||
                      localAspectRatio ||
                      (isMobile ? 3 / 4 : 16 / 9),
                  )
                : "auto",
              maxHeight: isFullscreen ? "100vh"  : '600', 
            // callAccepted  ? "650px" : "200px",
              minHeight: callAccepted ? "200px" : "0",
              position: "relative",
              overflow: "hidden",
              background: "#0b0f17",
              display: callAccepted ? "block" : "none",
            }}
          >
            <div
              ref={userVideo}
              className={`receive-friends-video ${filterFriendVideo || ""}`}
              style={{
                width: "100%",
                height: "100%",
                display: callAccepted ? "block" : "none",
                background: "#0b0f17",
                border: filterFriendVideo ? "3px solid #29B1A9" : "none",
              }}
              data-video-type="friend-remote-video"
            />
            <div
              ref={myVideo}
              className={`receive-my-video ${filterMyVideo || ""}`}
              style={{
                width: isMobile ? 112 : 160,
                aspectRatio: String(localAspectRatio || 3 / 4),
                height: "auto",
                position: "absolute",
                bottom: 10,
                right: 10,
                background: "#222",
                display: isVideoCall || receivingCall ? "block" : "none",
                borderRadius: 8,
                zIndex: 10,
                border: "2px solid rgba(255,255,255,0.35)",
                overflow: "hidden",
              }}
              data-video-type="my-local-video"
            />
          </div>

          <div
            className="call-buttons"
            style={{
              display: "flex",
              gap: isMobile ? "8px" : "12px",
              justifyContent: "center",
              alignItems: "center",
              flexWrap: "wrap",
              background:
                "linear-gradient(180deg, transparent 0%, rgba(0, 0, 0, 0.6) 100%)",
              backdropFilter: "blur(12px)",
              padding: isMobile ? "16px 12px 20px" : "20px 16px",
              marginTop: callAccepted ? "auto" : "12px",
              borderTop: callAccepted
                ? "1px solid rgba(41, 177, 169, 0.1)"
                : "none",
            }}
          >
            <button
              onClick={endCall}
              ref={callEndBtn}
              className="call-button-ends call-button bg-danger"
              style={mobileActionButtonStyle}
            >
              <i className="fa fa-phone" style={{ color: "white" }}></i>
            </button>

            {callAccepted && (
              <>
                <button
                  onClick={handleMicrophoneClick}
                  className="call-button-microphone call-button"
                  style={mobileActionButtonStyle}
                >
                  {isMicrophone ? (
                    <i
                      className="fa fa-microphone"
                      style={{ color: "white" }}
                    />
                  ) : (
                    <i
                      className="fa fa-microphone-slash"
                      style={{ color: "white" }}
                    />
                  )}
                </button>
                {hasVideoInput && (
                  <button
                    onClick={handleCameraToggle}
                    className="call-button-camera call-button"
                    style={mobileActionButtonStyle}
                  >
                    {isCameraOn ? (
                      <i className="fa fa-video" style={{ color: "white" }} />
                    ) : (
                      <i
                        className="fa fa-video-slash"
                        style={{ color: "white" }}
                      />
                    )}
                  </button>
                )}

                <button
                  onClick={toggleVideoFilter}
                  className={`call-button-filter call-button ${filterMyVideo ? "active" : ""}`}
                  title={
                    filterMyVideo
                      ? `Filter: ${filterMyVideo.replace("video-vivid-", "").replace("filter", "vivid")}`
                      : "No filter"
                  }
                  style={mobileActionButtonStyle}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    fill="none"
                    stroke="white"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    viewBox="0 0 24 24"
                  >
                    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                  </svg>
                </button>
                {!isMobile && (
                  <>
                    <button
                      onClick={toggleFullscreen}
                      className="call-button-fullscreen call-button"
                    >
                      {isFullscreen ? (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="24"
                          height="24"
                          fill="none"
                          stroke="white"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          viewBox="0 0 24 24"
                        >
                          <path d="M8 3v3a2 2 0 0 1-2 2H3" />
                          <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
                          <path d="M3 16h3a2 2 0 0 1 2 2v3" />
                          <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
                        </svg>
                      ) : (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="24"
                          height="24"
                          fill="none"
                          stroke="white"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          viewBox="0 0 24 24"
                        >
                          <path d="M3 7V3a2 2 0 0 1 2-2h4" />
                          <path d="M17 3h4a2 2 0 0 1 2 2v4" />
                          <path d="M21 17v4a2 2 0 0 1-2 2h-4" />
                          <path d="M7 21H3a2 2 0 0 1-2-2v-4" />
                        </svg>
                      )}
                    </button>
                    <button
                      onClick={minimizeVideoCall}
                      className="call-button-minimize call-button"
                      title="Minimize"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        fill="none"
                        stroke="white"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        viewBox="0 0 24 24"
                      >
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </button>
                  </>
                )}
              </>
            )}

            {!callAccepted && receivingCall && (
              <>
                <button
                  onClick={answerCall}
                  className="call-button-receive call-button bg-success"
                  style={{
                    ...mobileActionButtonStyle,
                    background:
                      "linear-gradient(135deg, #29B1A9 0%, #1a8078 100%)",
                    boxShadow: "0 0 20px rgba(41, 177, 169, 0.4)",
                    transform: "scale(1)",
                    transition: "all 0.3s ease",
                    "&:hover": {
                      transform: "scale(1.1)",
                      boxShadow: "0 0 30px rgba(41, 177, 169, 0.6)",
                    },
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.transform = "scale(1.1)";
                    e.target.style.boxShadow =
                      "0 0 30px rgba(41, 177, 169, 0.6)";
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.transform = "scale(1)";
                    e.target.style.boxShadow =
                      "0 0 20px rgba(41, 177, 169, 0.4)";
                  }}
                >
                  <i
                    className="fa fa-phone-volume"
                    style={{
                      color: "white",
                      fontSize: isMobile ? "18px" : "20px",
                    }}
                  ></i>
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
        style={{ display: "none" }}
      >
        <track kind="captions" />
      </audio>
    </div>
  );
};

export default VideoCall;
