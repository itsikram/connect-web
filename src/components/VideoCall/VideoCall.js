import React, {
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
} from "react";
import socket from "../../common/socket";
import CallScreen, { formatCallDuration } from "../CallScreen/CallScreen";
import AgoraRTC from "agora-rtc-sdk-ng";
import { useSelector } from "react-redux";
import useIsMobile from "../../utils/useIsMobile";
import ringtones from "../../config/ringtones.json";
import { normalizeRingtoneId } from "../../utils/normalizeRingtoneId";
import api from "../../api/api";
import { useCallMinimize } from "../../contexts/CallMinimizeContext";
import config from "../../config/config.json";
import audioPreloader from "../../utils/audioPreloader";
import { CALL_RING_DURATION_MS } from "../../utils/callRingtone";
import CallTranscript from "../CallTranscript/CallTranscript";
import {
  startRingback,
  stopRingback,
  endedLabelFor,
  ENDED_SCREEN_MS,
} from "../../utils/callFeedback";
import {
  markCallActive,
  markCallIdle,
  isOtherCallActive,
} from "../../utils/callSession";
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

/** Fill the screen like WhatsApp / Messenger video calls. */
const VIDEO_FIT = { fit: "cover" };

const isPermissionError = (error) =>
  error?.name === "NotAllowedError" ||
  /PERMISSION_DENIED|NotAllowed|Permission denied/i.test(
    String(error?.code || error?.message || ""),
  );

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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [filterConnectVideo, setFilterConnectVideo] = useState(false);
  const [filterMyVideo, setFilterMyVideo] = useState(false);
  const [currentChannel, setCurrentChannel] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [outgoingCallStatus, setOutgoingCallStatus] = useState("");
  const [remoteAspectRatio, setRemoteAspectRatio] = useState(null);
  const [localAspectRatio, setLocalAspectRatio] = useState(null);
  // The other person is in the media channel (timer starts here).
  const [mediaConnected, setMediaConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [remoteVideoOn, setRemoteVideoOn] = useState(false);
  const [localPreviewOn, setLocalPreviewOn] = useState(false);
  const [endedInfo, setEndedInfo] = useState(null);
  const endedTimerRef = useRef(null);
  const tokenRequestRef = useRef(null);
  const startCallRef = useRef(null);
  // Pending camera/mic start while ringing; startCall waits for it instead of
  // opening a second camera.
  const previewPromiseRef = useRef(null);
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
  const ringtoneAudio = useRef();
  const ringtoneBufferSource = useRef(null);
  // Bumped by every play/stop so async ringtone work started earlier can tell
  // it has been superseded and must not (re)start audio.
  const ringtonePlaybackToken = useRef(0);
  // True only between an incoming call arriving and the ringtone being
  // stopped (accept, decline, end, cancel, failure, timeout).
  const ringtoneAllowedRef = useRef(false);
  const ringtoneCanPlayHandlerRef = useRef(null);
  const ringtoneStopTimer = useRef(null);
  const ringtoneStartedAt = useRef(null);
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
  const remoteUserCheckInterval = useRef(null);
  const isCleaningUpRef = useRef(false); // Track if cleanup is in progress
  const callAttemptRef = useRef(0);
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
  const { minimizeCall, endMinimizedCall, updateMinimizedCall } =
    useCallMinimize();
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
    ringtonePlaybackToken.current += 1;
    ringtoneAllowedRef.current = false;
    if (ringtoneStopTimer.current) {
      clearTimeout(ringtoneStopTimer.current);
      ringtoneStopTimer.current = null;
    }
    ringtoneStartedAt.current = null;
    try {
      if (ringtoneAudio?.current) {
        const audio = ringtoneAudio.current;
        if (ringtoneCanPlayHandlerRef.current) {
          audio.removeEventListener(
            "canplaythrough",
            ringtoneCanPlayHandlerRef.current,
          );
          ringtoneCanPlayHandlerRef.current = null;
        }
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

  const isRingtoneCurrent = (token) =>
    token === ringtonePlaybackToken.current &&
    ringtoneAllowedRef.current &&
    receivingCallRef.current &&
    !callAcceptedRef.current;

  // Resume the element ringtone after the tab was hidden. Never restarts a
  // ringtone that was stopped, and never doubles one playing via AudioBuffer.
  const resumeRingtoneIfNeeded = async (reason) => {
    const audio = ringtoneAudio?.current;
    if (!audio || ringtoneBufferSource.current) return;
    if (!audio.paused || !audio.src || audio.src === window.location.href) {
      return;
    }
    const token = ringtonePlaybackToken.current;
    if (!isRingtoneCurrent(token)) return;
    console.log(`VideoCall: Resuming ringtone on ${reason}`);
    await unlockAudio();
    if (!isRingtoneCurrent(token)) return;
    audio.muted = false;
    audio.volume = 1.0;
    try {
      await playAudioWithWebAudio(audio);
    } catch (error) {
      try {
        await audio.play();
      } catch (e) {
        console.warn(`Failed to resume ringtone on ${reason}:`, e);
      }
    }
    if (!isRingtoneCurrent(token)) audio.pause();
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
    if (!ringtoneAllowedRef.current) return;
    // Supersede any earlier in-flight playRingtone call.
    const token = ++ringtonePlaybackToken.current;
    await unlockAudio();

    if (!ringtoneAudio?.current || !isRingtoneCurrent(token)) return;

    if (ringtoneStartedAt.current === null) {
      ringtoneStartedAt.current = Date.now();
    }
    const remainingMs =
      CALL_RING_DURATION_MS - (Date.now() - ringtoneStartedAt.current);
    if (remainingMs <= 0) {
      stopRingtone();
      return;
    }
    if (!ringtoneStopTimer.current) {
      ringtoneStopTimer.current = setTimeout(() => {
        ringtoneStopTimer.current = null;
        stopRingtone();
      }, remainingMs);
    }

    const audio = ringtoneAudio.current;

    if (!audio.src || audio.src === window.location.href) {
      await ensureRingtoneSourceReady();
    }

    if (!isRingtoneCurrent(token)) return;

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
        // Never stack a second looping buffer on top of an earlier one.
        audioPreloader.stopBuffer(toneSrc);
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
      let played = false;
      try {
        await playAudioWithWebAudio(audio);
        console.log(
          "Ringtone playing successfully (element via WebAudio helper)",
        );
        played = true;
      } catch (error) {
        console.warn("Failed to play ringtone via WebAudio helper:", error);
      }

      if (!played && isRingtoneCurrent(token)) {
        try {
          await audio.play();
          console.log("Ringtone playing with fallback method");
          played = true;
        } catch (fallbackError) {
          console.warn("Fallback play also failed:", fallbackError);
        }
      }

      // The call may have been answered/declined/ended while play() was
      // pending; don't leave the ringtone running.
      if (!isRingtoneCurrent(token)) {
        audio.pause();
        return false;
      }
      return played;
    };

    if (audio.readyState < 2) {
      if (ringtoneCanPlayHandlerRef.current) {
        audio.removeEventListener(
          "canplaythrough",
          ringtoneCanPlayHandlerRef.current,
        );
      }
      const handleCanPlay = async () => {
        audio.removeEventListener("canplaythrough", handleCanPlay);
        if (ringtoneCanPlayHandlerRef.current === handleCanPlay) {
          ringtoneCanPlayHandlerRef.current = null;
        }
        if (isRingtoneCurrent(token)) {
          await tryElementPlay();
        }
      };
      ringtoneCanPlayHandlerRef.current = handleCanPlay;
      audio.addEventListener("canplaythrough", handleCanPlay);
      if (audio.readyState === 0) audio.load();
    } else if (isRingtoneCurrent(token)) {
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
    // Invalidate any in-flight join/publish sequence. A remote rejection can
    // arrive while Agora is still connecting and cancel that sequence.
    callAttemptRef.current += 1;

    stopRingtone();
    stopFlashingTitle();

    // Clear any running intervals
    if (remoteUserCheckInterval.current) {
      clearInterval(remoteUserCheckInterval.current);
      remoteUserCheckInterval.current = null;
    }

    stopRingback();
    markCallIdle("video");

    // End minimized call if exists. Socket listeners reach this through a
    // ref, so read the channel from the ref rather than a stale closure.
    const activeChannel = currentChannelRef.current || currentChannel;
    if (activeChannel) {
      endMinimizedCall(`video-${activeChannel}`);
    }

    // Unpublish and leave Agora channel if connected, then dispose client
    try {
      if (
        clientRef.current &&
        clientRef.current.connectionState === "CONNECTED" &&
        localTracks.current.length > 0
      ) {
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
    setFilterConnectVideo("");
    setIsMicrophone(true);
    setIsCameraOn(true);
    setIsBackCamera(false);
    setIsMinimized(false);
    setCallDuration(0);
    setOutgoingCallStatus("");
    setMediaConnected(false);
    setIsReconnecting(false);
    setRemoteVideoOn(false);
    setLocalPreviewOn(false);
    setRemoteAspectRatio(null);
    receivingCallRef.current = false;
    callAcceptedRef.current = false;
    currentChannelRef.current = null;
    callerRef.current = "";
    tokenRequestRef.current = null;
    previewPromiseRef.current = null;
    callSeenStatusSentRef.current = false;
    callIgnoredStatusSentRef.current = false;
    if (minimizedDurationInterval.current) {
      clearInterval(minimizedDurationInterval.current);
      minimizedDurationInterval.current = null;
    }

    // Reset cleanup flag after a short delay
    setTimeout(() => {
      isCleaningUpRef.current = false;
    }, 300);
  }, [currentChannel, endMinimizedCall]);

  useEffect(() => {
    cleanupVideoCallRef.current = cleanupVideoCall;
  }, [cleanupVideoCall]);

  const callerNameRef = useRef("");
  const callerPicRef = useRef("");
  callerNameRef.current = callerName;
  callerPicRef.current = callerProfilePic;
  const showEndedRef = useRef(null);
  // Keep the call screen up for a moment with the outcome, like WhatsApp.
  showEndedRef.current = (label) => {
    if (endedTimerRef.current) clearTimeout(endedTimerRef.current);
    setEndedInfo({
      label,
      name: callerNameRef.current,
      pic: callerPicRef.current,
    });
    endedTimerRef.current = setTimeout(() => {
      endedTimerRef.current = null;
      setEndedInfo(null);
    }, ENDED_SCREEN_MS);
  };
  const clearEnded = () => {
    if (endedTimerRef.current) clearTimeout(endedTimerRef.current);
    endedTimerRef.current = null;
    setEndedInfo(null);
  };

  useEffect(
    () => () => {
      if (endedTimerRef.current) clearTimeout(endedTimerRef.current);
      stopRingback();
    },
    [],
  );

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
      const connectIdToNotify =
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
        if (connectIdToNotify && channelName && connectIdToNotify !== myId) {
          socket.emit("video-call-end", {
            to: String(connectIdToNotify),
            channelName,
          });
          console.log(
            "VideoCall: Emitting video-call-end to connect:",
            connectIdToNotify,
          );
        }
        showEndedRef.current?.("Call ended");
        await cleanupVideoCall();
        return;
      }

      // Not yet accepted — cancel (caller) or reject (callee)
      if (connectIdToNotify && channelName && connectIdToNotify !== myId) {
        if (receivingCall) {
          socket.emit("video-call-reject", {
            to: String(connectIdToNotify),
            channelName,
          });
          console.log(
            "VideoCall: Emitting video-call-reject to connect:",
            connectIdToNotify,
          );
        } else {
          socket.emit("video-call-cancel", {
            to: String(connectIdToNotify),
            channelName,
          });
          console.log(
            "VideoCall: Emitting video-call-cancel to connect:",
            connectIdToNotify,
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


  // Call duration tracking
  useEffect(() => {
    let interval = null;
    if (callAccepted && mediaConnected && !isMinimized) {
      if (!callStartTime.current) {
        callStartTime.current = Date.now();
      }
      setCallDuration(
        Math.floor((Date.now() - callStartTime.current) / 1000),
      );
      interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - callStartTime.current) / 1000);
        setCallDuration(elapsed);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [callAccepted, mediaConnected, isMinimized]);

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

  // Get Agora token. Requests are shared per channel so the token fetched
  // while the call is ringing is reused the moment it is answered.
  const getToken = (channelName, { fresh = false } = {}) => {
    const cached = tokenRequestRef.current;
    if (
      !fresh &&
      cached &&
      cached.channelName === channelName &&
      cached.uid === numericUid &&
      Date.now() - cached.at < 10 * 60 * 1000
    ) {
      return cached.promise;
    }
    const promise = api
      .post("/agora/token", {
        channelName,
        uid: numericUid,
      })
      .then(({ data }) => data) // { appId, token }
      .catch((error) => {
        if (tokenRequestRef.current?.promise === promise) {
          tokenRequestRef.current = null;
        }
        throw error;
      });
    tokenRequestRef.current = {
      channelName,
      uid: numericUid,
      at: Date.now(),
      promise,
    };
    return promise;
  };
  const prefetchToken = (channelName) => {
    getToken(channelName).catch(() => {});
  };

  const playLocalPreview = (videoTrack) => {
    if (!videoTrack || !myVideo.current) return;
    try {
      myVideo.current.replaceChildren();
      videoTrack.play(myVideo.current, VIDEO_FIT);
      const ar = readTrackAspectRatio(videoTrack);
      if (ar) setLocalAspectRatio(ar);
      setLocalPreviewOn(true);
    } catch (error) {
      console.warn("VideoCall: local preview failed", error);
    }
  };

  // Open camera + microphone while the call rings (WhatsApp shows your own
  // camera on the ringing screen) so media is ready the moment it connects.
  // Falls back to microphone only when there is no usable camera.
  const startLocalPreview = (channelName) => {
    if (previewPromiseRef.current) return previewPromiseRef.current;
    const stillCurrent = () =>
      currentChannelRef.current === channelName && !isCleaningUpRef.current;
    const promise = (async () => {
      let tracks = null;
      try {
        tracks = await AgoraRTC.createMicrophoneAndCameraTracks(
          { AEC: true, ANS: true, AGC: true },
          {
            encoderConfig: isMobile ? "480p_2" : "720p_1",
            optimizationMode: "motion",
          },
        );
        setHasVideoInput(true);
      } catch (error) {
        console.warn("VideoCall: camera unavailable, using microphone only", error);
        if (isPermissionError(error) && !stillCurrent()) return;
        try {
          tracks = [
            await AgoraRTC.createMicrophoneAudioTrack({
              AEC: true,
              ANS: true,
              AGC: true,
            }),
          ];
          setHasVideoInput(false);
          setIsCameraOn(false);
        } catch (micError) {
          console.error("VideoCall: microphone unavailable", micError);
          throw micError;
        }
      }
      if (!stillCurrent() || (localTracks.current && localTracks.current.length)) {
        tracks.forEach(closeAgoraTrack);
        return;
      }
      localTracks.current = tracks;
      playLocalPreview(tracks.find((t) => t.trackMediaType === "video"));
    })();
    previewPromiseRef.current = promise;
    promise.catch(() => {});
    return promise;
  };

  // Start a call (join & publish)
  const startCall = useCallback(
    async (channelName) => {
      const callAttempt = ++callAttemptRef.current;
      const isStaleAttempt = () =>
        callAttempt !== callAttemptRef.current || isCleaningUpRef.current;

      try {
        console.log("Starting Agora call with channel:", channelName);
        stopRingback();
        await unlockAudio();
        setCallAccepted(true);
        setCurrentChannel(channelName);
        callAcceptedRef.current = true;
        currentChannelRef.current = channelName;

        // Prevent double join attempts (race-safe)
        if (isJoiningOrJoined.current) {
          console.warn("Join skipped: client already joining/joined");
          return;
        }
        isJoiningOrJoined.current = true;

        // Signal any hidden emotion camera in ChatHeader to stop before grabbing camera
        try {
          window.dispatchEvent(new Event("stopEmotionCamera"));
        } catch (e) {}

        // Token, camera/mic and the channel join are independent: run them
        // in parallel so the call connects as fast as possible.
        const tracksReady = (async () => {
          if (previewPromiseRef.current) {
            await previewPromiseRef.current.catch(() => {});
          }
          if (!localTracks.current || localTracks.current.length === 0) {
            previewPromiseRef.current = null;
            await startLocalPreview(channelName);
          }
          return localTracks.current;
        })();
        const { appId, token } = await getToken(channelName);
        if (isStaleAttempt()) return;

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

        const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
        clientRef.current = client;
        hasBoundClientEvents.current = true;

        const playRemoteVideo = (user) => {
          if (!userVideo.current || !user?.videoTrack) return;
          userVideo.current.replaceChildren();
          user.videoTrack.play(userVideo.current, VIDEO_FIT);
          setRemoteVideoOn(true);
          const ar =
            readTrackAspectRatio(user.videoTrack) ||
            readElementAspectRatio(userVideo.current);
          if (ar) setRemoteAspectRatio(ar);
        };
        const playRemoteAudio = (user) => {
          try {
            const result = user?.audioTrack?.play();
            if (result?.catch) result.catch(() => {});
          } catch (error) {
            console.warn("VideoCall: remote audio play failed", error);
          }
        };
        AgoraRTC.onAudioAutoplayFailed = () => {
          (client.remoteUsers || []).forEach(playRemoteAudio);
        };

        // Bind before joining so a fast publisher is never missed.
        client.on("user-joined", () => {
          setMediaConnected(true);
        });
        client.on("user-published", async (user, mediaType) => {
          try {
            await client.subscribe(user, mediaType);
            setMediaConnected(true);
            if (mediaType === "video") playRemoteVideo(user);
            if (mediaType === "audio") playRemoteAudio(user);
          } catch (error) {
            console.error("Error subscribing to user:", user.uid, mediaType, error);
          }
        });
        client.on("user-unpublished", (user, mediaType) => {
          // Only a video unpublish removes the picture (camera turned off);
          // the other side muting its microphone must not blank it.
          if (mediaType === "video") {
            setRemoteVideoOn(false);
            userVideo.current?.replaceChildren();
          }
        });
        client.on("user-left", async (user) => {
          console.log("Remote user left the channel:", user?.uid);
          try {
            // Peer dropped out of the media channel (app killed, network
            // lost, tab closed): close the call on the server too so every
            // device and the call log are updated.
            const peer = callerRef.current;
            if (callAcceptedRef.current && peer) {
              socket.emit("video-call-end", { to: String(peer), channelName });
              showEndedRef.current?.("Call ended");
            }
            await cleanupVideoCallRef.current?.();
          } catch (e) {
            console.warn("Cleanup after remote user-left failed:", e);
          }
        });
        client.on("connection-state-change", (curState) => {
          setIsReconnecting(curState === "RECONNECTING");
        });
        client.on("token-privilege-will-expire", async () => {
          try {
            const { token: nextToken } = await getToken(channelName, {
              fresh: true,
            });
            await client.renewToken(nextToken);
          } catch (error) {
            console.warn("VideoCall: token renewal failed", error);
          }
        });
        const [, tracks] = await Promise.all([
          client.join(appId, channelName, token, numericUid),
          tracksReady,
        ]);
        if (isStaleAttempt()) return;
        console.log("Joined Agora channel successfully");

        if (tracks && tracks.length) {
          await client.publish(tracks);
          if (isStaleAttempt()) return;
          console.log("Published local tracks");
        }

        // Anyone already in the channel published before we joined.
        for (const user of client.remoteUsers || []) {
          setMediaConnected(true);
          try {
            if (user.hasVideo) {
              if (!user.videoTrack) await client.subscribe(user, "video");
              playRemoteVideo(user);
            }
            if (user.hasAudio) {
              if (!user.audioTrack) await client.subscribe(user, "audio");
              playRemoteAudio(user);
            }
          } catch (error) {
            console.error("Error subscribing to existing remote user:", error);
          }
        }

        // Safety net for a few seconds: replay remote media a browser paused.
        let checkCount = 0;
        remoteUserCheckInterval.current = setInterval(() => {
          checkCount++;
          try {
            for (const user of client.remoteUsers || []) {
              if (user.videoTrack && userVideo.current) {
                const videoElement = userVideo.current.querySelector("video");
                if (!videoElement || videoElement.paused) playRemoteVideo(user);
              }
              if (user.audioTrack && !user.audioTrack.isPlaying) {
                playRemoteAudio(user);
              }
            }
          } catch (error) {
            console.error("Error in periodic remote check:", error);
          }
          if (checkCount >= 5 && remoteUserCheckInterval.current) {
            clearInterval(remoteUserCheckInterval.current);
            remoteUserCheckInterval.current = null;
          }
        }, 2000);
      } catch (error) {
        const message = String(error?.message || error || "");
        if (
          isStaleAttempt() ||
          message.includes("OPERATION_ABORTED") ||
          message.includes("cancel token canceled")
        ) {
          console.log("Agora call startup cancelled during call cleanup");
          return;
        }
        console.error("Failed to start call:", error);
        stopRingtone();
        alert(
          isPermissionError(error)
            ? "Connect needs camera and microphone access for video calls. Allow them in your browser settings and try again."
            : "Failed to start call. Please try again.",
        );
        // The other side is already waiting in the channel; end the call for
        // them instead of leaving them connected to nobody.
        const peer = callerRef.current;
        if (peer) {
          socket.emit("video-call-end", { to: String(peer), channelName });
        }
        setIsVideoCall(false);
        setCallAccepted(false);
        isJoiningOrJoined.current = false;
        cleanupVideoCallRef.current?.();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [myId, numericUid],
  );

  useEffect(() => {
    startCallRef.current = startCall;
  }, [startCall]);

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
    // Listen for video calls initiated by this user (chat header, sticky
    // chat box, AI agent).
    const handleOutgoingVideoCall = (event) => {
      const { to, channelName, callerName, callerProfilePic } =
        event.detail || {};
      if (!to || !channelName) return;
      // Never start a second call on top of one in progress.
      if (
        isCleaningUpRef.current ||
        isJoiningOrJoined.current ||
        callAcceptedRef.current ||
        receivingCallRef.current ||
        currentChannelRef.current ||
        isOtherCallActive("video")
      ) {
        console.warn("VideoCall: Cannot start outgoing call - already busy");
        return;
      }
      markCallActive("video", channelName);
      console.log(
        "VideoCall - Starting outgoing video call to",
        to,
        "channel:",
        channelName,
      );
      clearEnded();
      // Place the call from here so the other side never rings for a call
      // this tab refused to start.
      socket.emit("video-call", { to: String(to), channelName, isAudio: false });
      startRingback();
      prefetchToken(channelName);
      currentChannelRef.current = channelName;
      callerRef.current = String(to);
      receivingCallRef.current = false;
      callAcceptedRef.current = false;
      callSeenStatusSentRef.current = false;
      callIgnoredStatusSentRef.current = false;
      setIsVideoCall(true);
      setReceivingCall(false);
      setCaller(to);
      setCallerName(callerName || "Connect");
      setCallerProfilePic(callerProfilePic || config?.defaultProfile);
      setCurrentChannel(channelName);
      setIncomingCall({
        from: myId,
        to,
        channelName,
        name: callerName || "Connect",
        profilePic: callerProfilePic,
      });
      setOutgoingCallStatus("Calling…");

      // Show my camera while it rings.
      startLocalPreview(channelName).catch((error) => {
        if (currentChannelRef.current !== channelName) return;
        socket.emit("video-call-cancel", { to: String(to), channelName });
        alert(
          isPermissionError(error)
            ? "Connect needs camera and microphone access for video calls. Allow them in your browser settings and try again."
            : "Could not start your camera or microphone.",
        );
        cleanupVideoCallRef.current?.();
      });
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
        receivingCallRef.current ||
        // Placing a call of my own right now.
        (currentChannelRef.current && currentChannelRef.current !== channelName) ||
        isOtherCallActive("video")
      ) {
        console.warn("VideoCall: Busy — rejecting incoming call", {
          isJoiningOrJoined: isJoiningOrJoined.current,
          callAccepted: callAcceptedRef.current,
          alreadyReceiving: receivingCallRef.current,
        });
        socket.emit("video-call-reject", {
          to: String(from),
          channelName,
          reason: "busy",
        });
        return;
      }
      clearEnded();
      markCallActive("video", channelName);
      prefetchToken(channelName);
      callerRef.current = String(from);
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
      ringtoneAllowedRef.current = true;
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

      // Show my camera behind the incoming-call screen, like WhatsApp.
      startLocalPreview(channelName).catch(() => {});

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
      cleanupVideoCallRef.current?.();
    };
    window.addEventListener("rejectCallFromPush", onRejectFromPush);

    const onCallAccepted = ({ channelName, isAudio }) => {
      if (isAudio) return;
      // Only the tab that placed THIS call may join. Without this, an idle
      // tab (or a stale event for another channel) auto-joined the channel.
      if (
        !currentChannelRef.current ||
        (channelName && String(channelName) !== String(currentChannelRef.current))
      ) {
        return;
      }
      // Caller joins here; callee already joined in answerCall — skip echo
      if (!isAudio && !receivingCallRef.current) {
        console.log("Agora video call accepted, joining channel:", channelName);
        stopRingtone();
        stopRingback();
        stopFlashingTitle();
        setOutgoingCallStatus("");
        startCallRef.current?.(channelName);
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
    const handleUpdatedCallStatus = ({ from, status, channelName }) => {
      // Only for outgoing (caller) side: receivingCall is false
      if (
        !receivingCallRef.current &&
        !callAcceptedRef.current &&
        callerRef.current &&
        String(from) === String(callerRef.current) &&
        (!channelName ||
          !currentChannelRef.current ||
          String(channelName) === String(currentChannelRef.current))
      ) {
        setOutgoingCallStatus(status || "");
      }
    };
    socket.on("updated-call-status", handleUpdatedCallStatus);

    // Ignore end/cancel/reject events that belong to a different call than
    // the one on screen.
    const isForActiveCall = (channelName) =>
      !channelName ||
      !currentChannelRef.current ||
      String(channelName) === String(currentChannelRef.current);

    const onVideoCallEnded = async ({ channelName } = {}) => {
      if (!isForActiveCall(channelName)) return;
      console.log(
        "VideoCall: Received video-call-ended event from remote user",
      );
      stopRingtone();
      stopFlashingTitle();
      setOutgoingCallStatus("");
      if (callAcceptedRef.current) showEndedRef.current?.("Call ended");
      // Local cleanup ONLY — do not re-emit end
      await cleanupVideoCallRef.current?.();
    };
    socket.on("video-call-ended", onVideoCallEnded);

    const onVideoCallCancelled = async ({ channelName } = {}) => {
      if (!isForActiveCall(channelName)) return;
      console.log(
        "VideoCall: Received video-call-cancelled event from remote user",
      );
      stopRingtone();
      stopFlashingTitle();
      setOutgoingCallStatus("");
      await cleanupVideoCallRef.current?.();
    };
    socket.on("video-call-cancelled", onVideoCallCancelled);

    const onVideoCallRejected = async ({ channelName, reason } = {}) => {
      if (!isForActiveCall(channelName)) return;
      // A late duplicate reject must never tear down an answered call.
      if (callAcceptedRef.current || isJoiningOrJoined.current) return;
      console.log(
        "VideoCall: Received video-call-rejected event from remote user",
      );
      stopRingtone();
      stopRingback();
      stopFlashingTitle();
      setOutgoingCallStatus("");
      showEndedRef.current?.(endedLabelFor(reason || "declined"));
      await cleanupVideoCallRef.current?.();
    };
    socket.on("video-call-rejected", onVideoCallRejected);

    const onCallNotAccepted = async ({ isAudio, channelName }) => {
      if (isAudio) return;
      // Read the ref: this listener is registered once, so the `currentChannel`
      // state captured in its closure is stale.
      const activeChannel = currentChannelRef.current;
      if (!activeChannel && !channelName) return;
      if (channelName && activeChannel && channelName !== activeChannel)
        return;
      console.log("VideoCall: Call not accepted (timeout)");
      stopRingtone();
      stopRingback();
      stopFlashingTitle();
      if (!receivingCallRef.current) showEndedRef.current?.("No answer");
      await cleanupVideoCallRef.current?.();
    };
    socket.on("call-not-accepted", onCallNotAccepted);

    const onApplyVideoFilter = ({ filter }) => {
      if (filter !== "") {
        setFilterConnectVideo(filter);
      } else {
        setFilterConnectVideo("");
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
        // Resume playback if it was paused due to tab being hidden
        await resumeRingtoneIfNeeded("visibility change");
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
        await resumeRingtoneIfNeeded("window focus");
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

    // Tell the caller first so both sides join the channel in parallel.
    socket.emit("answer-call", {
      to: String(incomingCall.from),
      channelName: incomingCall.channelName,
      isAudio: false,
    });
    await startCall(incomingCall.channelName);
  }, [incomingCall, startCall]);

  useEffect(() => {
    answerCallRef.current = answerCall;
  }, [answerCall]);

  const findLocalTrack = (kind) =>
    localTracks.current.find(
      (track) => track.trackMediaType === kind || track.kind === kind,
    );

  const handleMicrophoneClick = useCallback(async () => {
    const audioTrack = findLocalTrack("audio");
    if (audioTrack) {
      // setMuted keeps the track published, so unmuting is instant.
      if (typeof audioTrack.setMuted === "function") {
        await audioTrack.setMuted(isMicrophone);
      } else {
        await audioTrack.setEnabled(!isMicrophone);
      }
    }
    setIsMicrophone((prev) => !prev);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMicrophone]);

  const handleCameraToggle = useCallback(async () => {
    const videoTrack = findLocalTrack("video");
    if (videoTrack) {
      // Disabling releases the camera (light goes off) and the other side
      // sees your profile picture instead, like WhatsApp.
      await videoTrack.setEnabled(!isCameraOn);
    }
    setIsCameraOn((prev) => !prev);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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


  const handleSwitchClick = useCallback(async () => {
    const videoTrack = findLocalTrack("video");
    if (!videoTrack) return;
    const nextFacing = isBackCamera ? "user" : "environment";
    try {
      // Swap the camera in place: no unpublish/republish, so the other side
      // never loses the picture.
      const cameras = await AgoraRTC.getCameras().catch(() => []);
      if (cameras.length > 1) {
        const currentLabel = videoTrack.getTrackLabel?.() || "";
        const index = cameras.findIndex((c) => c.label === currentLabel);
        const next = cameras[(index + 1) % cameras.length];
        await videoTrack.setDevice(next.deviceId);
      } else {
        await videoTrack.setDevice({ facingMode: nextFacing });
      }
      setIsBackCamera((prev) => !prev);
    } catch (error) {
      console.error("Failed to switch camera:", error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBackCamera]);

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

  let phase = "outgoing";
  if (callAccepted) phase = mediaConnected ? "connected" : "connecting";
  else if (receivingCall) phase = "incoming";

  let statusText = outgoingCallStatus || "Calling…";
  if (phase === "incoming") statusText = "Incoming video call";
  else if (phase === "connecting") statusText = "Connecting…";
  else if (phase === "connected") statusText = formatCallDuration(callDuration);

  const showEnded = !!endedInfo && !isVideoCall;
  const screenOpen = (isVideoCall && !isMinimized) || showEnded;

  return (
    <div id="videoCallModal">
      <CallScreen
        open={screenOpen}
        type="video"
        phase={showEnded ? "ended" : phase}
        name={showEnded ? endedInfo.name : callerName}
        avatar={showEnded ? endedInfo.pic : callerProfilePic}
        statusText={showEnded ? endedInfo.label : statusText}
        reconnecting={!showEnded && isReconnecting}
        muted={!isMicrophone}
        cameraOn={isCameraOn}
        hasCamera={hasVideoInput}
        remoteVideoOn={remoteVideoOn}
        remoteVideoRef={userVideo}
        localVideoRef={myVideo}
        remoteVideoClassName={filterConnectVideo || ""}
        localVideoClassName={filterMyVideo || ""}
        localPreviewVisible={localPreviewOn && !showEnded}
        onAccept={answerCall}
        onDecline={closeVideoCall}
        onEnd={closeVideoCall}
        onToggleMute={handleMicrophoneClick}
        onToggleCamera={hasVideoInput ? handleCameraToggle : undefined}
        onSwitchCamera={hasVideoInput ? handleSwitchClick : undefined}
        onToggleFilter={toggleVideoFilter}
        filterActive={!!filterMyVideo}
        onMinimize={minimizeVideoCall}
        onToggleFullscreen={isMobile ? undefined : toggleFullscreen}
      >
        {callAccepted && !showEnded && (
          <CallTranscript
            enabled
            channelName={currentChannel}
            peerId={caller}
            myId={myId}
          />
        )}
      </CallScreen>
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
