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
import ringtones from "../../config/ringtones.json";
import { normalizeRingtoneId } from "../../utils/normalizeRingtoneId";
import api from "../../api/api";
import { useCallMinimize } from "../../contexts/CallMinimizeContext";
import config from "../../config/config.json";
import {
  unlockAudio,
  playAudioWithWebAudio,
  initializeAudioUnlock,
} from "../../utils/audioUnlock";
import {
  showCallNotification,
  closeCallNotification,
} from "../../utils/callNotification";
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

const RINGTONE_DB_NAME = "connect-audio-cache";
const RINGTONE_DB_VERSION = 1;
const RINGTONE_STORE_NAME = "ringtones";

const closeAgoraTrack = (track) => {
  try {
    track.getMediaStreamTrack?.()?.stop();
  } catch (error) {
    console.warn("AudioCall: Error stopping browser media track:", error);
  }
  try {
    track.close();
  } catch (error) {
    console.warn("AudioCall: Error closing Agora track:", error);
  }
};

const playRemoteAudioTrack = (track) => {
  if (!track) return;
  try {
    const result = track.play();
    if (result?.catch) {
      result.catch((error) => {
        console.warn("AudioCall: Remote audio playback was blocked:", error);
      });
    }
  } catch (error) {
    console.warn("AudioCall: Failed to play remote audio:", error);
  }
};

const AudioCall = ({ myId }) => {
  const mySettings = useSelector((state) => state.setting);
  const [isAudioCall, setIsAudioCall] = useState(false);
  const [callerName, setCallerName] = useState("");
  const [callerProfilePic, setCallerProfilePic] = useState("");
  const [receivingCall, setReceivingCall] = useState(false);

  // Keep receivingCall ref in sync with state (must be after receivingCall declaration)
  useEffect(() => {
    receivingCallRef.current = receivingCall;
  }, [receivingCall]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  const [caller, setCaller] = useState("");
  const [callAccepted, setCallAccepted] = useState(false);
  const [isMicrophone, setIsMicrophone] = useState(true);
  const [incomingCall, setIncomingCall] = useState(null);
  const [currentChannel, setCurrentChannel] = useState(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [outgoingCallStatus, setOutgoingCallStatus] = useState("");
  // True once the other person is actually in the media channel; the call
  // timer starts from here (like WhatsApp), not from the socket "accept".
  const [mediaConnected, setMediaConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  // Snapshot shown for a moment after the call closes ("Call ended",
  // "Declined", "On another call", "No answer").
  const [endedInfo, setEndedInfo] = useState(null);
  const endedTimerRef = useRef(null);
  const tokenRequestRef = useRef(null);
  const startCallRef = useRef(null);
  // Microphone being opened while an outgoing call rings; startCall waits for
  // it instead of opening a second one.
  const micPromiseRef = useRef(null);
  const callStartTime = useRef(null);

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
  const isTerminating = useRef(false);
  const isMountedRef = useRef(true);
  const receivingCallRef = useRef(receivingCall);
  const callAcceptedRef = useRef(callAccepted);
  const currentChannelRef = useRef(currentChannel);
  const callerRef = useRef(caller);
  const callSeenStatusSentRef = useRef(false);
  const callIgnoredStatusSentRef = useRef(false);
  const pendingAutoAcceptRef = useRef(false);
  const answerCallRef = useRef(null);

  // Agora RTC refs for audio (fresh client per call)
  const clientRef = useRef(null);
  const localTracks = useRef([]);
  const isJoiningOrJoined = useRef(false);
  const hasBoundClientEvents = useRef(false);
  const acceptedChannelRef = useRef(null);
  const remoteUserCheckInterval = useRef(null);
  const cleanupAudioCallRef = useRef(null);

  const { minimizeCall, endMinimizedCall } = useCallMinimize();

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
              "AudioCall: Failed to open ringtone IndexedDB",
              request.error,
            );
            resolve(null);
          };
        } catch (error) {
          console.warn(
            "AudioCall: IndexedDB unavailable for ringtone cache",
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
        console.warn("AudioCall: Failed to cache ringtone in IndexedDB", error);
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
    console.log(`AudioCall: Resuming ringtone on ${reason}`);
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

  const playRingtone = useCallback(async () => {
    if (!ringtoneAllowedRef.current) return;
    // Supersede any earlier in-flight playRingtone call.
    const playbackToken = ++ringtonePlaybackToken.current;
    await unlockAudio();

    if (!ringtoneAudio?.current || !isRingtoneCurrent(playbackToken)) return;

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

    if (!isRingtoneCurrent(playbackToken)) return;

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
        const source = audioPreloader.playBuffer(toneSrc, { loop: true });
        if (source) {
          ringtoneBufferSource.current = source;
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
      } catch (err) {
        console.warn("playAudioWithWebAudio failed:", err);
      }
      if (!played && isRingtoneCurrent(playbackToken)) {
        try {
          await audio.play();
          console.log("Ringtone playing with audio.play fallback");
          played = true;
        } catch (err) {
          console.warn("audio.play fallback failed:", err);
        }
      }
      // The call may have been answered/declined/ended while play() was
      // pending; don't leave the ringtone running.
      if (!isRingtoneCurrent(playbackToken)) {
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
      const onCanPlay = async () => {
        audio.removeEventListener("canplaythrough", onCanPlay);
        if (ringtoneCanPlayHandlerRef.current === onCanPlay) {
          ringtoneCanPlayHandlerRef.current = null;
        }
        if (isRingtoneCurrent(playbackToken)) {
          await tryElementPlay();
        }
      };
      ringtoneCanPlayHandlerRef.current = onCanPlay;
      audio.addEventListener("canplaythrough", onCanPlay);
      if (audio.readyState === 0) audio.load();
    } else if (isRingtoneCurrent(playbackToken)) {
      await tryElementPlay();
    }
  }, [ensureRingtoneSourceReady]);


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
        role: "publisher",
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

  // Start an audio call (join & publish)
  const startCall = useCallback(
    async (channelName) => {
      try {
        // Unlock browser audio while the call is still associated with the
        // user's accept/start gesture. Remote tracks arrive asynchronously.
        await unlockAudio();
        console.log("Starting Agora audio call with channel:", channelName);
        if (isTerminating.current) {
          console.warn("Start skipped: call is terminating");
          return;
        }
        setCallAccepted(true);
        setCurrentChannel(channelName);
        // Mark the channel synchronously so a late reject/cancel event cannot
        // tear down a call whose acceptance is already being processed.
        callAcceptedRef.current = true;
        acceptedChannelRef.current = channelName;

        stopRingback();

        // Prevent double join attempts (race-safe)
        if (isJoiningOrJoined.current) {
          console.warn("Audio join skipped: client already joining/joined");
          return;
        }
        isJoiningOrJoined.current = true;

        const { appId, token } = await getToken(channelName);
        console.log("Got Agora token for audio channel:", channelName);

        // Ensure previous client is disposed
        if (clientRef.current) {
          try {
            await clientRef.current.leave();
          } catch (e) {
            // Ignore leave errors
          }
          try {
            clientRef.current.removeAllListeners();
          } catch (e) {
            // Ignore remove listeners errors
          }
          clientRef.current = null;
        }

        // Create a fresh client and join
        clientRef.current = AgoraRTC.createClient({
          mode: "rtc",
          codec: "vp8",
        });
        const client = clientRef.current;
        AgoraRTC.onAudioAutoplayFailed = () => {
          for (const user of client.remoteUsers || []) {
            playRemoteAudioTrack(user.audioTrack);
          }
        };

        // Bind on every fresh client. The client is recreated for each call.
        hasBoundClientEvents.current = true;
        client.on("user-published", async (user, mediaType) => {
          if (mediaType !== "audio") return;
          try {
            await client.subscribe(user, "audio");
            playRemoteAudioTrack(user.audioTrack);
            console.log("Playing remote audio from user:", user.uid);
          } catch (error) {
            console.error("Error subscribing to remote audio:", error);
          }
        });
        client.on("user-joined", () => {
          setMediaConnected(true);
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
            console.warn("AudioCall: token renewal failed", error);
          }
        });
        client.on("user-left", (user) => {
          console.log("AudioCall - Remote user left the channel:", user?.uid);
          if (callAcceptedRef.current) {
            // The peer dropped out of the media channel (app killed, network
            // lost, tab closed) — tell the server so the call is closed on
            // every device and logged, then clean up locally.
            const peer = callerRef.current;
            if (peer) {
              socket.emit("audio-call-end", { to: String(peer), channelName });
            }
            showEndedRef.current?.("Call ended");
            cleanupAudioCallRef.current?.();
          }
        });

        // Open the microphone while joining instead of after it: the two are
        // independent and doing them in parallel connects the call faster.
        const micReady = (async () => {
          if (micPromiseRef.current) {
            await micPromiseRef.current.catch(() => {});
          }
          if (localTracks.current && localTracks.current.length > 0) {
            return localTracks.current;
          }
          const track = await AgoraRTC.createMicrophoneAudioTrack({
            AEC: true,
            ANS: true,
            AGC: true,
          });
          return [track];
        })();
        const [, micTracks] = await Promise.all([
          client.join(appId, channelName, token, numericUid),
          micReady,
        ]);
        localTracks.current = micTracks;
        console.log("Joined Agora audio channel successfully");
        if (client.remoteUsers?.length) setMediaConnected(true);

        // Publish with one retry if needed
        try {
          if (isTerminating.current) {
            console.warn("Publish skipped: call is terminating");
            return;
          }
          await client.publish(localTracks.current);
          console.log("Published local audio track");
        } catch (pubErr) {
          if (
            (pubErr && String(pubErr.message || pubErr)).includes(
              "haven't joined yet",
            )
          ) {
            console.warn(
              "Publish raced join; waiting briefly then retrying...",
            );
            if (!isTerminating.current) {
              await client.publish(localTracks.current);
              console.log("Published local audio track on retry");
            }
          } else {
            if (
              String(pubErr.message || pubErr).includes(
                "PeerConnection already disconnected",
              )
            ) {
              console.warn(
                "Publish failed after disconnect; ignoring during teardown",
              );
              return;
            }
            throw pubErr;
          }
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
                "hasAudio:",
                user.hasAudio,
              );

              // Subscribe to audio if available
              if (user.hasAudio && !user.audioTrack) {
                console.log("Subscribing to existing user audio:", user.uid);
                await client.subscribe(user, "audio");
                if (user.audioTrack) {
                  playRemoteAudioTrack(user.audioTrack);
                  console.log("Playing existing remote user audio");
                }
              } else if (user.hasAudio && user.audioTrack) {
                // Audio track already exists, just play it
                playRemoteAudioTrack(user.audioTrack);
                console.log("Playing already subscribed remote audio");
              }
            }
          } catch (error) {
            console.error("Error checking for existing remote users:", error);
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
              if (
                user.hasAudio &&
                user.audioTrack &&
                !user.audioTrack.isPlaying
              ) {
                console.log(
                  "Found missed remote audio, playing now:",
                  user.uid,
                );
                playRemoteAudioTrack(user.audioTrack);
              }
            }
          } catch (error) {
            console.error("Error in periodic remote user check:", error);
          }

          checkCount++;
        }, 2000);
      } catch (error) {
        console.error("Failed to start audio call:", error);
        const isTeardown =
          isTerminating.current || String(error?.message || error).includes("LEAVE");
        // Only show alert for certain errors
        if (!isTeardown) {
          const denied =
            error?.name === "NotAllowedError" ||
            /permission|NOT_READABLE|NotAllowed/i.test(
              String(error?.code || error?.message || ""),
            );
          alert(
            denied
              ? "Connect needs microphone access for calls. Allow the microphone in your browser settings and try again."
              : "Failed to start audio call. Please try again.",
          );
          // The other side already accepted/placed the call and is waiting in
          // the channel; end it for them instead of leaving them connected
          // to nobody.
          const peer = callerRef.current;
          if (peer) {
            socket.emit("audio-call-end", { to: String(peer), channelName });
          }
        }
        setIsAudioCall(false);
        setCallAccepted(false);
        isJoiningOrJoined.current = false;
        if (!isTeardown) cleanupAudioCallRef.current?.();
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
        console.warn("AudioCall: Failed to prepare/play ringtone", error);
      }
    };

    prepareAndPlay();

    return () => {
      isCancelled = true;
    };
  }, [receivingCall, incomingCall, ensureRingtoneSourceReady, playRingtone]);

  // Local cleanup without emitting to server
  // IMPORTANT: Define this BEFORE the useEffect that uses it
  const cleanupAudioCall = useCallback(async () => {
    console.log("AudioCall: cleanupAudioCall - doing local cleanup only");

    stopRingtone();
    stopRingback();
    markCallIdle("audio");
    isTerminating.current = true;

    // End minimized call if exists. Read the ref: socket listeners call this
    // through a ref, and the channel in an older closure may be stale.
    const activeChannel = currentChannelRef.current || currentChannel;
    if (activeChannel) {
      endMinimizedCall(`audio-${activeChannel}`);
    }

    // Unpublish and close local tracks
    try {
      if (clientRef.current && localTracks.current.length > 0) {
        try {
          console.log("AudioCall: Unpublishing local tracks...");
          await clientRef.current.unpublish(localTracks.current);
          console.log("AudioCall: Successfully unpublished tracks");
        } catch (unpubError) {
          console.log(
            "AudioCall: Error unpublishing:",
            unpubError?.message || unpubError,
          );
        }
      }
    } catch (e) {
      console.log("AudioCall: Unpublish outer error:", e);
    }

    // Close local tracks
    try {
      localTracks.current.forEach(closeAgoraTrack);
    } catch (e) {
      console.log("AudioCall: Error closing tracks:", e);
    }
    localTracks.current = [];

    // Leave Agora channel if connected and dispose client
    try {
      if (clientRef.current) {
        const connectionState = clientRef.current?.connectionState;
        console.log(
          "AudioCall: Client connection state before leave:",
          connectionState,
        );

        // Only try to leave if we're actually connected
        if (
          connectionState === "CONNECTED" ||
          connectionState === "CONNECTING"
        ) {
          try {
            console.log("AudioCall: Attempting to leave channel...");
            await clientRef.current.leave();
            console.log("AudioCall: Successfully left channel");
          } catch (leaveError) {
            console.log(
              "AudioCall: Error leaving channel:",
              leaveError?.message || leaveError,
            );
          }
        } else {
          console.log("AudioCall: Client not connected, skipping leave()");
        }

        try {
          clientRef.current.removeAllListeners();
        } catch (e) {
          console.log("AudioCall: Error removing listeners:", e);
        }
      }
    } catch (error) {
      console.log("AudioCall: Cleanup error:", error?.message || error);
    }
    clientRef.current = null;

    isJoiningOrJoined.current = false;
    hasBoundClientEvents.current = false;
    acceptedChannelRef.current = null;
    callStartTime.current = null;
    console.log("AudioCall: Cleanup - reset call flags");

    // Clear remote user check interval
    if (remoteUserCheckInterval.current) {
      clearInterval(remoteUserCheckInterval.current);
      remoteUserCheckInterval.current = null;
    }

    setCallAccepted(false);
    callAcceptedRef.current = false;
    setIsAudioCall(false);
    setCurrentChannel(null);
    setReceivingCall(false);
    setIncomingCall(null);
    setCaller("");
    setCallerName("");
    setCallerProfilePic("");
    setIsMinimized(false);
    setCallDuration(0);
    setMediaConnected(false);
    setIsReconnecting(false);
    setIsMicrophone(true);
    setOutgoingCallStatus("");
    receivingCallRef.current = false;
    currentChannelRef.current = null;
    callerRef.current = "";
    tokenRequestRef.current = null;
    micPromiseRef.current = null;
    callSeenStatusSentRef.current = false;
    callIgnoredStatusSentRef.current = false;
    isTerminating.current = false;
    console.log("AudioCall: Cleanup - reset state variables");
  }, [currentChannel, endMinimizedCall, isTerminating]);

  useEffect(() => {
    cleanupAudioCallRef.current = cleanupAudioCall;
  }, [cleanupAudioCall]);

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
      cleanupAudioCallRef.current?.();
    };
  }, []);

  // Keep receivingCallRef and callAcceptedRef in sync with state
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
    const applyIncomingAudioCall = ({
      from,
      channelName,
      callerName,
      callerProfilePic,
    }) => {
      if (!from || !channelName) return;
      // Don't process incoming calls if component is unmounting
      if (!isMountedRef.current || isTerminating.current) {
        console.log(
          "AudioCall: Component unmounting or terminating, ignoring incoming call",
        );
        return;
      }
      // Don't process if already handling this same call (prevents duplicate from socket + push)
      if (
        receivingCallRef.current &&
        currentChannelRef.current === channelName
      ) {
        console.log(
          "AudioCall: Already handling this call (from socket), ignoring duplicate from push",
        );
        return;
      }
      // Already in a call — auto-reject
      // Only reject if: currently joined to a channel, accepted a call, or already receiving another incoming call
      if (
        isJoiningOrJoined.current ||
        callAcceptedRef.current ||
        receivingCallRef.current ||
        // Placing a call of my own right now.
        (currentChannelRef.current && currentChannelRef.current !== channelName) ||
        isOtherCallActive("audio")
      ) {
        console.warn("AudioCall: Busy — rejecting incoming call", {
          isJoiningOrJoined: isJoiningOrJoined.current,
          callAccepted: callAcceptedRef.current,
          alreadyReceiving: receivingCallRef.current,
        });
        socket.emit("audio-call-reject", {
          to: String(from),
          channelName,
          reason: "busy",
        });
        return;
      }
      clearEnded();
      markCallActive("audio", channelName);
      prefetchToken(channelName);
      socket.emit("update-call-status", {
        to: String(from),
        status: "Ringing...",
      });
      console.log(
        "AudioCall: Accepting incoming call from",
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

      setIsAudioCall(true);
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
          console.warn("AudioCall: Failed immediate ringtone playback", error);
        }
      })();

      showCallNotification({
        callerName: callerName || "Unknown Caller",
        callerProfilePic: callerProfilePic || config?.defaultProfile,
        callType: "audio",
        callData: { from, channelName },
        onClick: () => {
          window.focus();
        },
      });
    };

    const onIncomingAudioCall = ({
      from,
      channelName,
      isAudio,
      callerName,
      callerProfilePic,
    }) => {
      console.log(
        "AudioCall - Received incoming-audio-call event from socket:",
        { from, channelName, isAudio },
      );
      if (isAudio) {
        applyIncomingAudioCall({
          from,
          channelName,
          callerName,
          callerProfilePic,
        });
      } else {
        console.log("AudioCall - Ignoring video call (isAudio: false)");
      }
    };
    socket.on("incoming-audio-call", onIncomingAudioCall);

    // Web Push → open app while backgrounded (iOS Home Screen)
    const onPushIncoming = (event) => {
      const detail = event.detail || {};
      if (!detail.isAudio) return;
      console.log(
        "AudioCall: Push notification received for incoming call:",
        detail.channelName,
      );
      if (detail.autoAccept) pendingAutoAcceptRef.current = true;
      applyIncomingAudioCall({
        from: detail.from,
        channelName: detail.channelName,
        callerName: detail.callerName,
        callerProfilePic: detail.callerProfilePic,
      });
    };
    window.addEventListener("incomingCallFromPush", onPushIncoming);

    const onRejectFromPush = (event) => {
      const detail = event.detail || {};
      if (!detail.isAudio) return;
      stopRingtone();
      const to = detail.from;
      const channelName = detail.channelName;
      if (to && channelName) {
        socket.emit("audio-call-reject", { to: String(to), channelName });
      }
      cleanupAudioCallRef.current?.();
    };
    window.addEventListener("rejectCallFromPush", onRejectFromPush);

    // Listen for audio calls initiated by this user (outgoing calls)
    const handleOutgoingAudioCall = (event) => {
      const { to, channelName, callerName, callerProfilePic } =
        event.detail || {};
      if (!to || !channelName) return;
      console.log(
        "AudioCall - Starting outgoing audio call to",
        to,
        "channel:",
        channelName,
      );
      console.log("AudioCall - Connect info:", { callerName, callerProfilePic });
      // Only allow outgoing call if not already in a call or receiving a call
      if (
        isJoiningOrJoined.current ||
        callAcceptedRef.current ||
        receivingCallRef.current ||
        currentChannelRef.current ||
        isOtherCallActive("audio")
      ) {
        console.warn("AudioCall: Cannot start outgoing call - already busy");
        return;
      }
      clearEnded();
      markCallActive("audio", channelName);
      // Place the call from here (not from the chat header) so the other
      // side never rings for a call this tab refused to start.
      socket.emit("audio-call", { to: String(to), channelName, isAudio: true });
      startRingback();
      prefetchToken(channelName);
      currentChannelRef.current = channelName;
      callerRef.current = String(to);
      receivingCallRef.current = false;
      // Ask for the microphone as soon as the call is placed (not after the
      // other side answers) and keep it open, so audio flows on connect.
      if (!localTracks.current || localTracks.current.length === 0) {
        micPromiseRef.current = AgoraRTC.createMicrophoneAudioTrack({
          AEC: true,
          ANS: true,
          AGC: true,
        });
        micPromiseRef.current
          .then((track) => {
            const stillCalling =
              currentChannelRef.current === channelName &&
              !isTerminating.current &&
              (!localTracks.current || localTracks.current.length === 0);
            if (stillCalling) {
              localTracks.current = [track];
            } else {
              closeAgoraTrack(track);
            }
          })
          .catch((error) => {
            if (currentChannelRef.current !== channelName) return;
            if (
              error?.name === "NotAllowedError" ||
              /PERMISSION_DENIED|NotAllowed/i.test(
                String(error?.code || error?.message || ""),
              )
            ) {
              socket.emit("audio-call-cancel", { to: String(to), channelName });
              alert(
                "Connect needs microphone access for calls. Allow the microphone in your browser settings and try again.",
              );
              cleanupAudioCallRef.current?.();
            }
          });
      }
      callSeenStatusSentRef.current = false;
      callIgnoredStatusSentRef.current = false;
      callAcceptedRef.current = false;
      acceptedChannelRef.current = null;
      setIsAudioCall(true);
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
      console.log(
        "AudioCall - Outgoing call modal should now be visible, setting status to Calling...",
      );
      setOutgoingCallStatus("Calling...");
    };

    window.addEventListener("startAudioCall", handleOutgoingAudioCall);

    const onCallAccepted = ({ channelName, isAudio, callerId }) => {
      // Caller side should join upon acceptance; callee already joined in answerCall
      if (isAudio) {
        // Only the tab that placed THIS call may join. Without this, an idle
        // tab (or a stale event for another channel) auto-joined the channel.
        if (
          !currentChannelRef.current ||
          (channelName && String(channelName) !== String(currentChannelRef.current))
        ) {
          return;
        }
        stopRingtone();
        if (!receivingCallRef.current) {
          console.log(
            "AudioCall: Call accepted (caller side) - joining channel:",
            channelName,
          );
          console.log("Call accepted data:", {
            channelName,
            isAudio,
            callerId,
          });
          setOutgoingCallStatus("");
          stopRingback();
          callAcceptedRef.current = true;
          acceptedChannelRef.current = channelName;
          startCallRef.current?.(channelName);
        } else {
          console.log(
            "AudioCall: Call accepted but we are the receiver (receivingCall=true), already joined",
          );
        }
      }
    };
    socket.on("call-accepted", onCallAccepted);

    // Ignore end/cancel events that belong to a different call than the one
    // on screen (e.g. an old call's late event, or a busy-rejected caller).
    const isForActiveCall = (channelName) =>
      !channelName ||
      !currentChannelRef.current ||
      String(channelName) === String(currentChannelRef.current);

    const onAudioCallEnded = async ({ channelName } = {}) => {
      if (!isForActiveCall(channelName)) return;
      console.log("AudioCall: Received audio-call-ended event from server");
      stopRingtone();
      if (callAcceptedRef.current) showEndedRef.current?.("Call ended");
      await cleanupAudioCallRef.current?.();
    };
    socket.on("audio-call-ended", onAudioCallEnded);

    const onAudioCallCancelled = async ({ channelName } = {}) => {
      if (!isForActiveCall(channelName)) return;
      console.log("AudioCall: Received audio-call-cancelled event from server");
      stopRingtone();
      await cleanupAudioCallRef.current?.();
    };
    socket.on("audio-call-cancelled", onAudioCallCancelled);

    const onAudioCallRejected = async ({ channelName, reason } = {}) => {
      console.log("AudioCall: Received audio-call-rejected event from server");
      // A reject can arrive from a duplicate socket/push delivery after the
      // callee has already accepted. Never tear down the accepted call.
      if (
        callAcceptedRef.current ||
        isJoiningOrJoined.current ||
        (channelName &&
          currentChannelRef.current &&
          channelName !== currentChannelRef.current)
      ) {
        console.warn("AudioCall: Ignoring stale rejection for active call", {
          channelName,
          activeChannel: currentChannelRef.current,
        });
        return;
      }
      console.warn("AudioCall: Call was rejected by recipient");
      stopRingtone();
      stopRingback();
      showEndedRef.current?.(endedLabelFor(reason || "declined"));
      cleanupAudioCallRef.current?.();
    };
    socket.on("audio-call-rejected", onAudioCallRejected);

    const onCallNotAccepted = async ({ isAudio, channelName }) => {
      if (!isAudio) return;
      const activeChannel = currentChannelRef.current;
      if (channelName && activeChannel && channelName !== activeChannel) return;
      console.log("AudioCall: Call not accepted (timeout)", {
        channelName,
        activeChannel,
      });
      stopRingtone();
      stopRingback();
      if (!receivingCallRef.current) showEndedRef.current?.("No answer");
      cleanupAudioCallRef.current?.();
    };
    socket.on("call-not-accepted", onCallNotAccepted);

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

    return () => {
      isMountedRef.current = false;
      console.log("AudioCall: Cleaning up socket listeners");
      socket.off("incoming-audio-call", onIncomingAudioCall);
      window.removeEventListener("incomingCallFromPush", onPushIncoming);
      window.removeEventListener("rejectCallFromPush", onRejectFromPush);
      socket.off("call-accepted", onCallAccepted);
      socket.off("audio-call-ended", onAudioCallEnded);
      socket.off("audio-call-cancelled", onAudioCallCancelled);
      socket.off("audio-call-rejected", onAudioCallRejected);
      socket.off("call-not-accepted", onCallNotAccepted);
      window.removeEventListener("startAudioCall", handleOutgoingAudioCall);
      console.log("AudioCall: All listeners removed");
      stopRingtone();
      socket.off("updated-call-status", handleUpdatedCallStatus);
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
  }, [markCallIgnoredIfNeeded, markCallSeenIfNeeded]);

  // Initialize audio unlock on component mount
  useEffect(() => {
    initializeAudioUnlock();
  }, []);

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      stopRingtone();
      if (ringtoneObjectUrlRef.current) {
        URL.revokeObjectURL(ringtoneObjectUrlRef.current);
        ringtoneObjectUrlRef.current = null;
      }
      ringtoneObjectUrlSourceRef.current = "";
    };
  }, []);

  const answerCall = useCallback(async () => {
    stopRingtone(); // This also closes notification
    if (!incomingCall) return;

    console.log("Answering Agora audio call");
    // Tell the caller first so both sides join the channel in parallel; the
    // microphone is opened while joining (see startCall).
    socket.emit("answer-call", {
      to: String(incomingCall.from),
      channelName: incomingCall.channelName,
      isAudio: true,
    });
    await startCall(incomingCall.channelName);
  }, [incomingCall, startCall]);

  useEffect(() => {
    startCallRef.current = startCall;
  }, [startCall]);

  useEffect(() => {
    answerCallRef.current = answerCall;
  }, [answerCall]);

  // End call - called when user clicks end button
  const endCall = useCallback(async () => {
    // Explicitly stop ringtone first
    stopRingtone();

    // Determine the connect ID to notify
    // If we have incomingCall, use incomingCall.from (the person who called us)
    // If we don't have incomingCall, we initiated the call, so use caller (the person we called)
    let connectIdToNotify;
    if (incomingCall?.from && incomingCall.from !== myId) {
      // We received this call, so notify the person who called us
      connectIdToNotify = incomingCall.from;
      if (!callAccepted) {
        socket.emit("audio-call-reject", {
          to: String(connectIdToNotify),
          channelName: currentChannel,
        });
        console.log(
          "AudioCall: Emitting audio-call-reject to connect:",
          connectIdToNotify,
        );
        await cleanupAudioCall();
        return;
      }
    } else if (caller && caller !== myId) {
      // We initiated this call, so notify the person we called
      connectIdToNotify = caller;
      if (!callAccepted) {
        socket.emit("audio-call-cancel", {
          to: String(connectIdToNotify),
          channelName: currentChannel,
        });
        console.log(
          "AudioCall: Emitting audio-call-cancel to connect:",
          connectIdToNotify,
        );
        await cleanupAudioCall();
        return;
      }
    }

    if (connectIdToNotify && connectIdToNotify !== myId && currentChannel) {
      socket.emit("audio-call-end", {
        to: String(connectIdToNotify),
        channelName: currentChannel,
      });
      showEndedRef.current?.("Call ended");
      console.log(
        "AudioCall: Successfully emitted audio-call-end to connect:",
        connectIdToNotify,
      );
    } else {
      console.log(
        "AudioCall: No connect ID to notify or trying to notify self, cannot emit audio-call-end",
      );
      console.log(
        "AudioCall: connectIdToNotify:",
        connectIdToNotify,
        "myId:",
        myId,
      );
    }
    // Do local cleanup
    await cleanupAudioCall();
    return;
  }, [
    caller,
    incomingCall,
    myId,
    cleanupAudioCall,
    callAccepted,
    currentChannel,
  ]);

  const handleMicrophoneClick = useCallback(async () => {
    const track = localTracks.current[0];
    if (track) {
      // setMuted keeps the track published, so unmuting is instant.
      if (typeof track.setMuted === "function") {
        await track.setMuted(isMicrophone);
      } else {
        await track.setEnabled(!isMicrophone);
      }
    }
    setIsMicrophone((prev) => !prev);
  }, [isMicrophone]);

  const minimizeAudioCall = useCallback(() => {
    if (!callAccepted || !currentChannel) return;

    const callId = `audio-${currentChannel}`;
    const callData = {
      id: callId,
      type: "audio",
      callerName: callerName || "Unknown Caller",
      callerProfilePic: callerProfilePic,
      callerId: caller,
      status: "connected",
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
      },
    };

    minimizeCall(callData);
    setIsMinimized(true);
    setIsAudioCall(false);
  }, [
    callAccepted,
    currentChannel,
    callerName,
    callerProfilePic,
    caller,
    callDuration,
    isMicrophone,
    minimizeCall,
    handleMicrophoneClick,
    endCall,
  ]);

  let phase = "outgoing";
  if (callAccepted) phase = mediaConnected ? "connected" : "connecting";
  else if (receivingCall) phase = "incoming";

  let statusText = outgoingCallStatus || "Calling…";
  if (phase === "incoming") statusText = "Incoming voice call";
  else if (phase === "connecting") statusText = "Connecting…";
  else if (phase === "connected") statusText = formatCallDuration(callDuration);

  const showEnded = !!endedInfo && !isAudioCall;
  const screenOpen = (isAudioCall && !isMinimized) || showEnded;

  return (
    <div>
      <CallScreen
        open={screenOpen}
        type="audio"
        phase={showEnded ? "ended" : phase}
        name={showEnded ? endedInfo.name : callerName}
        avatar={showEnded ? endedInfo.pic : callerProfilePic}
        statusText={showEnded ? endedInfo.label : statusText}
        reconnecting={!showEnded && isReconnecting}
        muted={!isMicrophone}
        onAccept={answerCall}
        onDecline={endCall}
        onEnd={endCall}
        onToggleMute={callAccepted ? handleMicrophoneClick : undefined}
        onMinimize={minimizeAudioCall}
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

export default React.memo(AudioCall);
