import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AgoraRTC from "agora-rtc-sdk-ng";
import api from "../../../api/api";
import {
  unlockAudio,
  resumeAudioFromGesture,
} from "../../../utils/audioUnlock";

const hashUid = (id) => {
  if (!id) return 1;
  let hash = 0;
  const value = String(id);
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) || 1;
};

const channelFromGameId = (gameId) => {
  const raw = String(gameId || "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 48);
  return `ludo${raw || "voice"}`;
};

export const useLudoVoice = ({
  enabled = false,
  gameId,
  profileId,
}) => {
  const [micOn, setMicOn] = useState(true);
  const [voiceReady, setVoiceReady] = useState(false);
  const [voiceConnecting, setVoiceConnecting] = useState(false);
  const [voiceError, setVoiceError] = useState(null);
  const [speakingUids, setSpeakingUids] = useState(() => new Set());

  const clientRef = useRef(null);
  const localTrackRef = useRef(null);
  const joinGenRef = useRef(0);
  const micOnRef = useRef(true);
  const enabledRef = useRef(enabled);

  const numericUid = useMemo(() => hashUid(profileId), [profileId]);
  const channelName = useMemo(() => channelFromGameId(gameId), [gameId]);

  useEffect(() => {
    micOnRef.current = micOn;
  }, [micOn]);
  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  const teardownClient = useCallback(async () => {
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
      clientRef.current?.removeAllListeners();
      await clientRef.current?.leave();
    } catch (_e) {}
    clientRef.current = null;
  }, []);

  const leaveVoice = useCallback(async () => {
    joinGenRef.current += 1;
    setVoiceReady(false);
    setVoiceConnecting(false);
    setSpeakingUids(new Set());
    await teardownClient();
  }, [teardownClient]);

  const playRemoteUser = useCallback(async (user) => {
    if (!user?.audioTrack) return;
    try {
      resumeAudioFromGesture();
      await unlockAudio();
      user.audioTrack.play();
    } catch (error) {
      console.warn("[LUDO_VOICE] Failed to play remote audio", error);
    }
  }, []);

  const joinVoice = useCallback(async () => {
    if (!enabledRef.current || !gameId || !profileId) return;

    const session = ++joinGenRef.current;
    setVoiceConnecting(true);
    setVoiceError(null);

    try {
      resumeAudioFromGesture();
      await unlockAudio();

      const { data } = await api.post("/agora/token", {
        channelName,
        uid: numericUid,
        role: "publisher",
      });
      if (!data?.appId || !data?.token) {
        throw new Error(data?.error || "Could not get voice token");
      }
      if (session !== joinGenRef.current || !enabledRef.current) return;

      await teardownClient();
      if (session !== joinGenRef.current || !enabledRef.current) return;

      const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
      clientRef.current = client;

      client.on("user-published", async (user, mediaType) => {
        if (mediaType !== "audio") return;
        try {
          await client.subscribe(user, "audio");
          await playRemoteUser(user);
        } catch (error) {
          console.warn("[LUDO_VOICE] subscribe failed", error);
        }
      });

      client.on("user-unpublished", (user, mediaType) => {
        if (mediaType !== "audio") return;
        try {
          user.audioTrack?.stop();
        } catch (_e) {}
      });

      client.on("user-left", (user) => {
        try {
          user.audioTrack?.stop();
        } catch (_e) {}
      });

      client.enableAudioVolumeIndicator();
      client.on("volume-indicator", (volumes) => {
        const next = new Set();
        (volumes || []).forEach((entry) => {
          if (Number(entry?.level) >= 8) {
            next.add(Number(entry.uid));
          }
        });
        setSpeakingUids(next);
      });

      await client.join(data.appId, channelName, data.token, numericUid);
      if (session !== joinGenRef.current) {
        await teardownClient();
        return;
      }

      try {
        const mic = await AgoraRTC.createMicrophoneAudioTrack({
          AEC: true,
          ANS: true,
          AGC: true,
        });
        if (session !== joinGenRef.current) {
          mic.close();
          return;
        }
        localTrackRef.current = mic;
        if (!micOnRef.current) {
          await mic.setMuted(true);
        }
        await client.publish([mic]);
      } catch (micErr) {
        console.warn("[LUDO_VOICE] microphone unavailable", micErr);
        setVoiceError("Microphone permission is required to talk");
        setMicOn(false);
        micOnRef.current = false;
      }

      for (const user of client.remoteUsers || []) {
        if (!user?.hasAudio) continue;
        try {
          await client.subscribe(user, "audio");
          await playRemoteUser(user);
        } catch (_e) {}
      }

      if (session !== joinGenRef.current) return;
      setVoiceConnecting(false);
      setVoiceReady(true);
    } catch (error) {
      console.error("[LUDO_VOICE] join failed", error);
      if (session === joinGenRef.current) {
        await teardownClient();
        setVoiceError(
          error?.response?.data?.error ||
            error?.message ||
            "Voice chat unavailable",
        );
        setVoiceConnecting(false);
        setVoiceReady(false);
      }
    }
  }, [
    channelName,
    gameId,
    numericUid,
    playRemoteUser,
    profileId,
    teardownClient,
  ]);

  useEffect(() => {
    if (!enabled || !gameId || !profileId) {
      leaveVoice();
      return undefined;
    }
    joinVoice();
    return () => {
      leaveVoice();
    };
  }, [enabled, gameId, profileId, joinVoice, leaveVoice]);

  const toggleMic = useCallback(async () => {
    resumeAudioFromGesture();
    const next = !micOnRef.current;
    micOnRef.current = next;
    setMicOn(next);
    setVoiceError(null);

    if (!clientRef.current) {
      await joinVoice();
      return;
    }

    try {
      if (!localTrackRef.current) {
        const mic = await AgoraRTC.createMicrophoneAudioTrack({
          AEC: true,
          ANS: true,
          AGC: true,
        });
        localTrackRef.current = mic;
        await mic.setMuted(!next);
        await clientRef.current.publish([mic]);
        return;
      }
      await localTrackRef.current.setMuted(!next);
    } catch (error) {
      console.warn("[LUDO_VOICE] toggle mic failed", error);
      setMicOn(false);
      micOnRef.current = false;
      setVoiceError("Could not access the microphone");
    }
  }, [joinVoice]);

  const isSpeakingUid = useCallback(
    (playerProfileId) => speakingUids.has(hashUid(playerProfileId)),
    [speakingUids],
  );

  return {
    micOn,
    voiceReady,
    voiceConnecting,
    voiceError,
    toggleMic,
    isSpeakingUid,
  };
};
