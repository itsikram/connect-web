import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AgoraRTC from "agora-rtc-sdk-ng";
import socket from "../../common/socket";
import api from "../../api/api";
import LiveVoiceModal from "../Message/LiveVoiceModal";

const hashUid = (id) => {
  if (!id) return 0;
  let hash = 0;
  const value = String(id);
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

const mapAgoraQuality = (uplink = 0, downlink = 0) => {
  const worst = Math.max(uplink || 0, downlink || 0);
  if (!worst || worst <= 1) return 4;
  if (worst === 2) return 3;
  if (worst === 3) return 2;
  return 1;
};

const LiveVoice = ({ myId }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [duration, setDuration] = useState(0);
  const [role, setRole] = useState("sender");
  const [friendName, setFriendName] = useState("Friend");
  const [connectionQuality, setConnectionQuality] = useState(4);

  const clientRef = useRef(null);
  const localTrackRef = useRef(null);
  const channelRef = useRef(null);
  const peerIdRef = useRef(null);
  const isJoiningRef = useRef(false);
  const isActiveRef = useRef(false);
  const sessionIdRef = useRef(0);
  const durationTimerRef = useRef(null);
  const roleRef = useRef("sender");
  const stopSessionRef = useRef(async () => {});
  const startSessionRef = useRef(async () => {});
  const recentlyStoppedRef = useRef(new Map());
  const userLeftTimerRef = useRef(null);

  const numericUid = useMemo(() => hashUid(myId), [myId]);

  const clearDurationTimer = useCallback(() => {
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }
  }, []);

  const broadcastStatus = useCallback((overrides = {}) => {
    window.dispatchEvent(
      new CustomEvent("liveVoiceStatus", {
        detail: {
          active: isActiveRef.current,
          connecting: isJoiningRef.current,
          duration: 0,
          peerId: peerIdRef.current,
          channelName: channelRef.current,
          role: roleRef.current,
          ...overrides,
        },
      }),
    );
  }, []);

  const peerFromChannel = useCallback((channelName) => {
    if (!channelName || !myId) return null;
    const parts = String(channelName).split("_");
    if (parts.length < 2) return null;
    return parts.find((id) => String(id) !== String(myId)) || null;
  }, [myId]);

  const ensureLeave = useCallback(async () => {
    try {
      if (clientRef.current && localTrackRef.current) {
        await clientRef.current.unpublish([localTrackRef.current]);
      }
    } catch (_e) {}

    try {
      localTrackRef.current?.close();
    } catch (_e) {}
    localTrackRef.current = null;

    try {
      await clientRef.current?.leave();
      clientRef.current?.removeAllListeners();
    } catch (_e) {}
    clientRef.current = null;
  }, []);

  const stopSession = useCallback(
    async (notifyPeer = true) => {
      const channelName = channelRef.current;
      const peerId = peerIdRef.current || peerFromChannel(channelName);
      const hadSession =
        isActiveRef.current || isJoiningRef.current || !!channelName;

      if (channelName) {
        recentlyStoppedRef.current.set(String(channelName), Date.now());
      }

      sessionIdRef.current += 1;
      if (userLeftTimerRef.current) {
        clearTimeout(userLeftTimerRef.current);
        userLeftTimerRef.current = null;
      }

      if (notifyPeer && hadSession && (peerId || channelName)) {
        socket.emit("live-voice-stop", {
          to: peerId ? String(peerId) : undefined,
          channelName,
        });
      }

      clearDurationTimer();
      await ensureLeave();

      isJoiningRef.current = false;
      isActiveRef.current = false;
      channelRef.current = null;
      peerIdRef.current = null;

      setIsConnecting(false);
      setIsActive(false);
      setIsOpen(false);
      setDuration(0);
      setConnectionQuality(4);

      broadcastStatus({
        active: false,
        connecting: false,
        duration: 0,
        peerId: null,
        channelName: null,
      });
    },
    [broadcastStatus, clearDurationTimer, ensureLeave, peerFromChannel],
  );

  const bindRemoteListeners = useCallback((client) => {
    if (!client) return;

    const clearUserLeftTimer = () => {
      if (userLeftTimerRef.current) {
        clearTimeout(userLeftTimerRef.current);
        userLeftTimerRef.current = null;
      }
    };

    client.on("user-published", async (user, mediaType) => {
      clearUserLeftTimer();
      if (mediaType !== "audio") return;
      try {
        await client.subscribe(user, "audio");
        user.audioTrack?.play();
      } catch (e) {
        console.warn("Live voice subscribe error:", e);
      }
    });

    client.on("network-quality", (stats) => {
      setConnectionQuality(
        mapAgoraQuality(stats?.uplinkNetworkQuality, stats?.downlinkNetworkQuality),
      );
    });

    client.on("user-left", () => {
      // The app WebView can leave+rejoin while spinning up. Hang up only
      // after the peer stays gone, and only once we are actually live.
      if (!isActiveRef.current) return;
      clearUserLeftTimer();
      userLeftTimerRef.current = setTimeout(() => {
        userLeftTimerRef.current = null;
        if (isActiveRef.current) {
          stopSessionRef.current(false);
        }
      }, 2500);
    });
  }, []);

  const subscribeExistingRemotes = useCallback(async (client) => {
    if (!client) return;
    for (const user of client.remoteUsers || []) {
      if (!user?.hasAudio) continue;
      try {
        await client.subscribe(user, "audio");
        user.audioTrack?.play();
      } catch (e) {
        console.warn("Live voice subscribe existing user error:", e);
      }
    }
  }, []);

  const startSession = useCallback(
    async ({
      to,
      channelName,
      friendName: name,
      sessionRole = "sender",
      notifyPeer = true,
    }) => {
      if (!to || !channelName || !myId) return;

      if (
        isActiveRef.current &&
        channelRef.current &&
        String(channelRef.current) === String(channelName)
      ) {
        setIsOpen(true);
        return;
      }

      if (isJoiningRef.current || isActiveRef.current) {
        console.warn("Live voice: already in a session");
        return;
      }

      const sessionId = ++sessionIdRef.current;
      isJoiningRef.current = true;
      peerIdRef.current = String(to);
      channelRef.current = channelName;
      roleRef.current = sessionRole;
      setRole(sessionRole);
      setFriendName(name || "Friend");
      setIsOpen(true);
      setIsConnecting(true);
      setIsActive(false);
      setDuration(0);
      broadcastStatus({
        active: false,
        connecting: true,
        duration: 0,
        peerId: String(to),
        channelName,
        role: sessionRole,
      });

      // Notify the peer immediately so the app can start joining in parallel
      // with our Agora setup. A second emit after join covers a missed first packet.
      if (notifyPeer) {
        socket.emit("live-voice-start", {
          to: String(to),
          channelName,
        });
      }

      try {
        const { data } = await api.post("/agora/token", {
          channelName,
          uid: numericUid,
          role: "publisher",
        });
        if (!data?.appId || !data?.token) {
          throw new Error("Invalid Agora token response");
        }

        if (sessionId !== sessionIdRef.current) return;

        await ensureLeave();

        const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
        clientRef.current = client;

        // Bind remote listeners before join so we never miss user-published
        // from a peer that is already in the channel (typical for app → web).
        bindRemoteListeners(client);

        await client.join(data.appId, channelName, data.token, numericUid);

        try {
          const mic = await AgoraRTC.createMicrophoneAudioTrack();
          localTrackRef.current = mic;
          await client.publish([mic]);
        } catch (micErr) {
          console.warn("Live voice mic publish failed (receive-only):", micErr);
          localTrackRef.current = null;
        }

        await subscribeExistingRemotes(client);

        if (sessionId !== sessionIdRef.current) {
          await ensureLeave();
          return;
        }

        if (notifyPeer) {
          socket.emit("live-voice-start", {
            to: String(to),
            channelName,
          });
        }

        isJoiningRef.current = false;
        isActiveRef.current = true;
        setIsConnecting(false);
        setIsActive(true);
        setIsOpen(true);

        clearDurationTimer();
        durationTimerRef.current = setInterval(() => {
          setDuration((prev) => {
            const next = prev + 1;
            broadcastStatus({
              active: true,
              connecting: false,
              duration: next,
              peerId: String(to),
              channelName,
              role: sessionRole,
            });
            return next;
          });
        }, 1000);

        broadcastStatus({
          active: true,
          connecting: false,
          duration: 0,
          peerId: String(to),
          channelName,
          role: sessionRole,
        });
      } catch (error) {
        console.error("Live voice start failed:", error);
        await stopSession(false);
      }
    },
    [
      broadcastStatus,
      clearDurationTimer,
      ensureLeave,
      myId,
      numericUid,
      stopSession,
      bindRemoteListeners,
      subscribeExistingRemotes,
    ],
  );

  startSessionRef.current = startSession;
  stopSessionRef.current = stopSession;

  useEffect(() => {
    const onIncoming = ({ from, channelName, callerName }) => {
      if (!from || !channelName) return;
      if (String(from) === String(myId)) return;
      const stoppedAt = recentlyStoppedRef.current.get(String(channelName));
      if (stoppedAt && Date.now() - stoppedAt < 1500) return;
      startSessionRef.current({
        to: from,
        channelName,
        friendName: callerName,
        sessionRole: "receiver",
        notifyPeer: false,
      });
    };

    const onPeerStop = ({ from, channelName }) => {
      if (from && String(from) === String(myId)) return;
      if (channelName) {
        recentlyStoppedRef.current.set(String(channelName), Date.now());
      }
      if (
        channelName &&
        channelRef.current &&
        String(channelName) !== String(channelRef.current)
      ) {
        return;
      }
      if (
        from &&
        peerIdRef.current &&
        String(from) !== String(peerIdRef.current) &&
        !channelName
      ) {
        return;
      }
      if (!isActiveRef.current && !isJoiningRef.current && !channelRef.current) {
        return;
      }
      stopSessionRef.current(false);
    };

    const onOutgoing = (event) => {
      const { to, channelName, friendName: name } = event.detail || {};
      startSessionRef.current({
        to,
        channelName,
        friendName: name,
        sessionRole: "sender",
        notifyPeer: true,
      });
    };

    const onStopRequest = () => {
      stopSessionRef.current(true);
    };

    socket.on("live-voice-start", onIncoming);
    socket.on("live-voice-stop", onPeerStop);
    window.addEventListener("startLiveVoice", onOutgoing);
    window.addEventListener("stopLiveVoice", onStopRequest);

    return () => {
      socket.off("live-voice-start", onIncoming);
      socket.off("live-voice-stop", onPeerStop);
      window.removeEventListener("startLiveVoice", onOutgoing);
      window.removeEventListener("stopLiveVoice", onStopRequest);
    };
  }, [myId]);

  useEffect(() => {
    return () => {
      stopSessionRef.current(false);
    };
  }, []);

  return isOpen ? (
    <LiveVoiceModal
      isOpen
      onClose={() => stopSession(true)}
      isActive={isActive}
      duration={duration}
      isConnecting={isConnecting}
      role={role}
      friendName={friendName}
      connectionQuality={connectionQuality}
      onStop={() => stopSession(true)}
    />
  ) : null;
};

export default LiveVoice;
