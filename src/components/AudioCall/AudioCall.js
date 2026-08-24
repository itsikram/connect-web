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
import { tryFocusCurrentTab } from "../../utils/incomingCallFromPush";

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
    if (process.env.NODE_ENV === "development") {
      console.log("AudioCall mounted with myId:", myId);
    }
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
  const callStartTime = useRef(null);

  const callEndBtn = useRef();
  const ringtoneAudio = useRef();
  const ringtoneBufferSource = useRef(null);
  const isTerminating = useRef(false);
  const isMountedRef = useRef(true);
  const receivingCallRef = useRef(receivingCall);
  const callAcceptedRef = useRef(callAccepted);
  const currentChannelRef = useRef(currentChannel);
  const callerRef = useRef(caller);
  const pendingAutoAcceptRef = useRef(false);
  const answerCallRef = useRef(null);

  // Agora RTC refs for audio (fresh client per call)
  const clientRef = useRef(null);
  const localTracks = useRef([]);
  const isJoiningOrJoined = useRef(false);
  const hasBoundClientEvents = useRef(false);
  const remoteUserCheckInterval = useRef(null);

  const isMobile = useIsMobile();
  const { minimizeCall, endMinimizedCall } = useCallMinimize();

  const stopRingtone = () => {
    try {
      if (ringtoneAudio?.current) {
        const audio = ringtoneAudio.current;
        audio.pause();
        audio.currentTime = 0; // Reset to beginning
        audio.loop = false; // Ensure it won't loop
        audio.muted = false; // Reset mute state for next playback
      }

      // Stop any WebAudio buffer sources if playing
      try {
        const toneSrc = ringtoneAudio?.current?.src || null;
        if (toneSrc) {
          audioPreloader.stopBuffer(toneSrc);
        }
      } catch (_) {}

      // Clear local buffer ref
      if (ringtoneBufferSource.current) {
        try { ringtoneBufferSource.current.stop(); } catch (_) {}
        try { ringtoneBufferSource.current.disconnect(); } catch (_) {}
        ringtoneBufferSource.current = null;
      }
    } catch (err) {
      // ignore
    }

    closeCallNotification(); // Close notification when ringtone stops
  };

  const playRingtone = async () => {
    // Ensure audio is unlocked for playback
    await unlockAudio();

    if (!ringtoneAudio?.current || !receivingCallRef.current || callAcceptedRef.current) return;

    const audio = ringtoneAudio.current;

    // Validate source
    if (!audio.src || audio.src === window.location.href) {
      console.warn('Ringtone audio has no valid source');
      return;
    }

    audio.muted = false;
    audio.volume = 1.0;
    audio.currentTime = 0;
    audio.loop = true;

    const toneSrc = audio.src;

    // Try playback via decoded AudioBuffer first
    try {
      if (audioPreloader.hasBuffer(toneSrc)) {
        const source = audioPreloader.playBuffer(toneSrc, { loop: true });
        if (source) {
          ringtoneBufferSource.current = source;
          console.log('Ringtone playing via AudioBuffer');
          return;
        }
      }
    } catch (err) {
      console.warn('AudioBuffer play attempt failed:', err);
    }

    // Fallback: element playback using WebAudio helper or audio.play()
    const tryElementPlay = async () => {
      try {
        await playAudioWithWebAudio(audio);
        console.log('Ringtone playing successfully (element via WebAudio helper)');
        return true;
      } catch (err) {
        console.warn('playAudioWithWebAudio failed:', err);
      }
      try {
        await audio.play();
        console.log('Ringtone playing with audio.play fallback');
        return true;
      } catch (err) {
        console.warn('audio.play fallback failed:', err);
        return false;
      }
    };

    if (audio.readyState < 2) {
      const onCanPlay = async () => {
        audio.removeEventListener('canplaythrough', onCanPlay);
        if (receivingCallRef.current && !callAcceptedRef.current) {
          await tryElementPlay();
        }
      };
      audio.addEventListener('canplaythrough', onCanPlay);
      if (audio.readyState === 0) audio.load();
    } else {
      if (receivingCallRef.current && !callAcceptedRef.current) {
        await tryElementPlay();
      }
    }
  };

  const closeAudioCall = () => {
    console.log("AudioCall - Closing audio call modal");
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
      hash = (hash << 5) - hash + myId.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }, [myId]);

  // Get Agora token
  const getToken = async (channelName) => {
    const { data } = await api.post("/agora/token", {
      channelName,
      uid: numericUid,
    });
    return data; // { appId, token }
  };

  // Start an audio call (join & publish)
  const startCall = useCallback(
    async (channelName) => {
      try {
        console.log("Starting Agora audio call with channel:", channelName);
        if (isTerminating.current) {
          console.warn("Start skipped: call is terminating");
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
          console.warn("Audio join skipped: client already joining/joined");
          return;
        }
        isJoiningOrJoined.current = true;

        // Small helper: wait until client connectionState is CONNECTED
        const waitForConnected = async (maxMs = 1500, stepMs = 100) => {
          const maxSteps = Math.ceil(maxMs / stepMs);
          for (let i = 0; i < maxSteps; i++) {
            if (
              clientRef.current &&
              clientRef.current.connectionState === "CONNECTED"
            )
              return true;
            await new Promise((r) => setTimeout(r, stepMs));
          }
          return (
            clientRef.current &&
            clientRef.current.connectionState === "CONNECTED"
          );
        };

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
        await client.join(appId, channelName, token, numericUid);
        console.log("Joined Agora audio channel successfully");

        // Ensure fully connected before publishing
        await waitForConnected();

        // Create local audio track only (no video)
        if (!localTracks.current || localTracks.current.length === 0) {
          try {
            // Request microphone permission explicitly
            try {
              const mediaStream = await navigator.mediaDevices.getUserMedia({
                audio: true,
              });
              // Stop the tracks after getting permission (Agora will create its own)
              mediaStream.getTracks().forEach((track) => track.stop());
            } catch (permissionError) {
              if (permissionError.name === "NotAllowedError") {
                console.warn("Microphone permission denied by user");
                // Don't throw - let startCall handle the error
              }
            }

            localTracks.current = [await AgoraRTC.createMicrophoneAudioTrack()];
            console.log("Created local audio track");
          } catch (trackError) {
            console.error("Failed to create microphone track:", trackError);
            if (trackError.name === "NotAllowedError") {
              console.warn("Cannot proceed without microphone permission");
            }
          }
        } else {
          console.log("Using existing audio track");
        }

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
            await waitForConnected(800, 100);
            if (isTerminating.current) {
              console.warn("Publish retry skipped: call is terminating");
              return;
            }
            await client.publish(localTracks.current);
            console.log("Published local audio track on retry");
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

        // Bind client events only once
        if (!hasBoundClientEvents.current) {
          hasBoundClientEvents.current = true;
          client.on("user-published", async (user, mediaType) => {
            console.log("Remote user published:", user.uid, mediaType);
            try {
              await client.subscribe(user, mediaType);
              console.log("Successfully subscribed to", user.uid, mediaType);

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
          });

          // End locally when remote user leaves the channel
          client.on("user-left", async (user) => {
            console.log("AudioCall - Remote user left the channel:", user?.uid);
            try {
              await cleanupAudioCall();
            } catch (e) {
              console.warn(
                "AudioCall - Cleanup after remote user-left failed:",
                e,
              );
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
                "hasAudio:",
                user.hasAudio,
              );

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
                user.audioTrack.play();
              }
            }
          } catch (error) {
            console.error("Error in periodic remote user check:", error);
          }

          checkCount++;
        }, 2000);
      } catch (error) {
        console.error("Failed to start audio call:", error);
        // Only show alert for certain errors
        if (!String(error?.message || error).includes("LEAVE")) {
          alert("Failed to start audio call. Please try again.");
        }
        setIsAudioCall(false);
        setCallAccepted(false);
        isJoiningOrJoined.current = false;
      }
    },
    [myId, getToken],
  );

  useEffect(() => {
    if (ringtoneAudio?.current && receivingCall && incomingCall) {
      // Try to bring the tab into focus before playing ringtone
      try {
        tryFocusCurrentTab();
      } catch (_) {}

      // Use user's ringtone preference or fallback to default
      const ringtoneId = normalizeRingtoneId(mySettings.ringtone);

      // Get preloaded ringtone audio
      const preloadedAudio = audioPreloader.getRingtone(ringtoneId);
      if (preloadedAudio) {
        const audio = ringtoneAudio.current;
        const toneSrc = preloadedAudio.src;

        // Only load if source hasn't been set yet
        if (!audio.src || audio.src !== toneSrc) {
          audio.setAttribute("src", toneSrc);
          audio.load(); // Ensure the audio is loaded

          // Handle loading errors
          const handleError = () => {
            console.error("Failed to load preloaded ringtone:", toneSrc);
          };

          // Handle successful load
          const handleLoadStart = () => {
            console.log("Loading preloaded ringtone:", toneSrc);
          };

          const handleCanPlay = () => {
            console.log("Preloaded ringtone ready");
            audio.removeEventListener("canplaythrough", handleCanPlay);
            audio.removeEventListener("error", handleError);
            audio.removeEventListener("loadstart", handleLoadStart);
          };

          audio.addEventListener("error", handleError);
          audio.addEventListener("loadstart", handleLoadStart);
          audio.addEventListener("canplaythrough", handleCanPlay);
        }
      } else {
        // Fallback to legacy method
        const ringtone = ringtones.find((r) => r.id === ringtoneId);
        const toneSrc = ringtone?.src || config?.callingBeep || "";

        if (toneSrc) {
          const audio = ringtoneAudio.current;
          if (!audio.src || audio.src !== toneSrc) {
            audio.setAttribute("src", toneSrc);
            audio.load();

            const handleError = () => {
              console.error("Failed to load ringtone:", toneSrc);
            };

            const handleLoadStart = () => {
              console.log("Loading ringtone:", toneSrc);
            };

            const handleCanPlay = () => {
              console.log("Ringtone loaded successfully");
              audio.removeEventListener("canplaythrough", handleCanPlay);
              audio.removeEventListener("error", handleError);
              audio.removeEventListener("loadstart", handleLoadStart);
            };

            audio.addEventListener("error", handleError);
            audio.addEventListener("loadstart", handleLoadStart);
            audio.addEventListener("canplaythrough", handleCanPlay);
          }
        }
      }
    }
  }, [mySettings, receivingCall, incomingCall]);

  // Local cleanup without emitting to server
  // IMPORTANT: Define this BEFORE the useEffect that uses it
  const cleanupAudioCall = useCallback(async () => {
    console.log("AudioCall: cleanupAudioCall - doing local cleanup only");

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
      localTracks.current.forEach((track) => {
        try {
          track.close();
        } catch (closeError) {
          console.log("AudioCall: Error closing track:", closeError);
        }
      });
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
    callStartTime.current = null;
    console.log("AudioCall: Cleanup - reset call flags");

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
    setCaller("");
    setCallerName("");
    setCallerProfilePic("");
    setIsMinimized(false);
    setCallDuration(0);
    isTerminating.current = false;
    console.log("AudioCall: Cleanup - reset state variables");
  }, [currentChannel, endMinimizedCall, isTerminating]);

  // Keep receivingCallRef and callAcceptedRef in sync with state
  useEffect(() => {
    receivingCallRef.current = receivingCall;
    console.log("AudioCall: receivingCall state changed to", receivingCall);
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
        receivingCallRef.current
      ) {
        console.warn("AudioCall: Busy — rejecting incoming call", {
          isJoiningOrJoined: isJoiningOrJoined.current,
          callAccepted: callAcceptedRef.current,
          alreadyReceiving: receivingCallRef.current,
        });
        socket.emit("audio-call-reject", { to: String(from), channelName });
        return;
      }
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
      try {
        window.focus();
      } catch (e) {}
      playRingtone();
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
      cleanupAudioCall();
    };
    window.addEventListener("rejectCallFromPush", onRejectFromPush);

    // Listen for audio calls initiated by this user (outgoing calls)
    const handleOutgoingAudioCall = (event) => {
      const { to, channelName, callerName, callerProfilePic } = event.detail;
      console.log(
        "AudioCall - Starting outgoing audio call to",
        to,
        "channel:",
        channelName,
      );
      console.log("AudioCall - Friend info:", { callerName, callerProfilePic });
      // Only allow outgoing call if not already in a call or receiving a call
      if (
        isJoiningOrJoined.current ||
        callAcceptedRef.current ||
        receivingCallRef.current
      ) {
        console.warn("AudioCall: Cannot start outgoing call - already busy");
        return;
      }
      setIsAudioCall(true);
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
      console.log(
        "AudioCall - Outgoing call modal should now be visible, setting status to Calling...",
      );
      setOutgoingCallStatus("Calling...");
    };

    window.addEventListener("startAudioCall", handleOutgoingAudioCall);

    console.log("AudioCall: Mounted and ready for calls");

    const onCallAccepted = ({ channelName, isAudio, callerId }) => {
      // Caller side should join upon acceptance; callee already joined in answerCall
      if (isAudio) {
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
          stopRingtone();
          setOutgoingCallStatus("");
          startCall(channelName);
        } else {
          console.log(
            "AudioCall: Call accepted but we are the receiver (receivingCall=true), already joined",
          );
        }
      }
    };
    socket.on("call-accepted", onCallAccepted);

    const onAudioCallEnded = async () => {
      console.log("AudioCall: Received audio-call-ended event from server");
      stopRingtone();
      await cleanupAudioCall();
    };
    socket.on("audio-call-ended", onAudioCallEnded);

    const onAudioCallCancelled = async () => {
      console.log("AudioCall: Received audio-call-cancelled event from server");
      stopRingtone();
      await cleanupAudioCall();
    };
    socket.on("audio-call-cancelled", onAudioCallCancelled);

    const onAudioCallRejected = async () => {
      console.log("AudioCall: Received audio-call-rejected event from server");
      console.warn("AudioCall: Call was rejected by recipient");
      stopRingtone();
      setOutgoingCallStatus("Call rejected");
      // Wait briefly before cleanup to let user see the rejection status
      setTimeout(() => {
        cleanupAudioCall();
      }, 500);
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
      setOutgoingCallStatus("No answer");
      // Wait briefly before cleanup to let user see the timeout status
      setTimeout(() => {
        cleanupAudioCall();
      }, 500);
    };
    socket.on("call-not-accepted", onCallNotAccepted);

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
      // Only resume if tab is visible, we're receiving a call, and we haven't accepted yet
      if (
        document.visibilityState === "visible" &&
        receivingCallRef.current &&
        !callAcceptedRef.current &&
        ringtoneAudio?.current
      ) {
        const audio = ringtoneAudio.current;
        // Resume playback if it was paused due to tab being hidden
        if (audio.paused && audio.src && audio.src !== window.location.href) {
          console.log("AudioCall: Resuming ringtone on visibility change");
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
        const audio = ringtoneAudio.current;
        if (audio.paused && audio.src && audio.src !== window.location.href) {
          console.log("AudioCall: Resuming ringtone on window focus");
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

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleWindowFocus);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, []);

  // Initialize audio unlock on component mount
  useEffect(() => {
    initializeAudioUnlock();
  }, []);

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      stopRingtone();
    };
  }, []);

  const answerCall = useCallback(async () => {
    stopRingtone(); // This also closes notification
    if (!incomingCall) return;

    console.log("Answering Agora audio call");

    // Start local audio immediately when accepting call
    try {
      console.log("Starting local audio for call answer");

      // Request microphone permission explicitly
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        // Stop the tracks after getting permission (Agora will create its own)
        mediaStream.getTracks().forEach((track) => track.stop());
      } catch (permissionError) {
        if (permissionError.name === "NotAllowedError") {
          console.warn("Microphone permission denied by user");
          throw permissionError;
        }
        // If getUserMedia fails for other reasons, still try Agora
      }

      localTracks.current = [await AgoraRTC.createMicrophoneAudioTrack()];
      console.log("Local audio started immediately");
    } catch (error) {
      console.error("Failed to start local audio immediately:", error);
      if (
        error.name === "NotAllowedError" ||
        error.message?.includes("Permission denied")
      ) {
        console.warn(
          "Microphone access denied - user must grant microphone permission",
        );
      }
    }

    socket.emit("answer-call", {
      to: String(incomingCall.from),
      channelName: incomingCall.channelName,
      isAudio: true,
    });
    await startCall(incomingCall.channelName);
  }, [incomingCall, startCall]);

  useEffect(() => {
    answerCallRef.current = answerCall;
  }, [answerCall]);

  // End call - called when user clicks end button
  const endCall = useCallback(async () => {
    // Explicitly stop ringtone first
    stopRingtone();

    // Determine the friend ID to notify
    // If we have incomingCall, use incomingCall.from (the person who called us)
    // If we don't have incomingCall, we initiated the call, so use caller (the person we called)
    let friendIdToNotify;
    if (incomingCall?.from && incomingCall.from !== myId) {
      // We received this call, so notify the person who called us
      friendIdToNotify = incomingCall.from;
      if (!callAccepted) {
        socket.emit("audio-call-reject", {
          to: String(friendIdToNotify),
          channelName: currentChannel,
        });
        console.log(
          "AudioCall: Emitting audio-call-reject to friend:",
          friendIdToNotify,
        );
        await cleanupAudioCall();
        return;
      }
    } else if (caller && caller !== myId) {
      // We initiated this call, so notify the person we called
      friendIdToNotify = caller;
      if (!callAccepted) {
        socket.emit("audio-call-cancel", {
          to: String(friendIdToNotify),
          channelName: currentChannel,
        });
        console.log(
          "AudioCall: Emitting audio-call-cancel to friend:",
          friendIdToNotify,
        );
        await cleanupAudioCall();
        return;
      }
    }

    if (friendIdToNotify && friendIdToNotify !== myId && currentChannel) {
      socket.emit("audio-call-end", {
        to: String(friendIdToNotify),
        channelName: currentChannel,
      });
      console.log(
        "AudioCall: Successfully emitted audio-call-end to friend:",
        friendIdToNotify,
      );
    } else {
      console.log(
        "AudioCall: No friend ID to notify or trying to notify self, cannot emit audio-call-end",
      );
      console.log(
        "AudioCall: friendIdToNotify:",
        friendIdToNotify,
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
    if (localTracks.current[0]) {
      await localTracks.current[0].setEnabled(!isMicrophone);
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

  return (
    <div>
      <ModalContainer
        title="Audio Call"
        style={{
          width: isMobile ? "95%" : "400px",
          top: "50%",
          height: "auto",
          borderRadius: "10px",
          zIndex: "9999", // Ensure it's on top
        }}
        isOpen={isAudioCall && !isMinimized}
        onRequestClose={closeAudioCall}
        id="audioCallModal"
      >
        <div
          className={`${callAccepted ? "call-accepted" : ""}`}
          style={{ padding: "20px", textAlign: "center" }}
        >
          <h2 className="text-center vc-modal-heading">
            Audio Call
            {callAccepted
              ? ` • ${String(Math.floor(callDuration / 60)).padStart(2, "0")}:${String(callDuration % 60).padStart(2, "0")}`
              : ""}
          </h2>
          <p className="fs-4 text-center">
            {receivingCall && !callAccepted && `${callerName} is calling you`}
            {!receivingCall &&
              !callAccepted &&
              `Calling ${callerName}${outgoingCallStatus ? ` • ${outgoingCallStatus}` : "..."}`}
            {callAccepted && `Connected - ${callerName}`}
          </p>

          <div className="audio-call-avatar" style={{ margin: "30px 0" }}>
            <div
              style={{
                width: "120px",
                height: "120px",
                borderRadius: "50%",
                overflow: "hidden",
                margin: "0 auto",
                border: "3px solid #29B1A9",
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
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    background: "#f0f0f0",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "48px",
                    color: "#666",
                  }}
                >
                  <i className="fas fa-user"></i>
                </div>
              )}
            </div>
          </div>

          <div
            className="call-buttons"
            style={{ display: "flex", justifyContent: "center", gap: "20px" }}
          >
            <button
              onClick={endCall}
              ref={callEndBtn}
              className="call-button-ends call-button bg-danger"
            >
              <i className="fa fa-phone" style={{ color: "white" }}></i>
            </button>

            {callAccepted && (
              <>
                <button
                  onClick={handleMicrophoneClick}
                  className="call-button-microphone call-button"
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
                <button
                  onClick={minimizeAudioCall}
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

            {!callAccepted && receivingCall && (
              <>
                <button
                  onClick={answerCall}
                  className="call-button-receive call-button bg-success"
                >
                  <i
                    className="fa fa-phone-volume"
                    style={{ color: "white" }}
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

export default React.memo(AudioCall);
