import React, { useEffect, useRef, useState } from "react";
import AgoraRTC from "agora-rtc-sdk-ng";
import api from "../api/api";
import { useSelector } from "react-redux";

const VideoCallPage = () => {
  const myProfile = useSelector((state) => state.profile);

  const [myId, setMyId] = useState("");
  const [friendId, setFriendId] = useState("");
  const [inCall, setInCall] = useState(false);
  const [currentChannel, setCurrentChannel] = useState(null);

  const client = useRef(AgoraRTC.createClient({ mode: "rtc", codec: "vp8" })).current;
  const localContainer = useRef();
  const remoteContainer = useRef();
  const localTracks = useRef([]);
  
  // Set myId from Redux profile
  useEffect(() => {
    if (myProfile?._id) setMyId(myProfile._id);
  }, [myProfile]);

  // HTTP-based call signaling
  useEffect(() => {
    // Poll for incoming calls
    const checkIncomingCalls = async () => {
      try {
        const response = await api.get('/call/incoming', {
          params: { profileId: myId }
        });
        
        if (response.data.call) {
          const { from, channelName } = response.data.call;
          console.log('Incoming call from', from, channelName);
          
          if (window.confirm('Incoming call. Accept?')) {
            // Accept call via HTTP
            await api.post('/call/answer', { to: from, channelName });
            startCall(channelName);
          } else {
            // Reject call via HTTP
            await api.post('/call/reject', { to: from, channelName });
          }
        }
      } catch (error) {
        console.error('Error checking incoming calls:', error);
      }
    };

    // Poll for call acceptance
    const checkCallAccepted = async () => {
      if (!currentChannel) return;
      
      try {
        const response = await api.get('/call/status', {
          params: { channelName: currentChannel }
        });
        
        if (response.data.accepted) {
          startCall(currentChannel);
        }
      } catch (error) {
        console.error('Error checking call status:', error);
      }
    };

    const callPollInterval = setInterval(checkIncomingCalls, 3000);
    const statusPollInterval = setInterval(checkCallAccepted, 2000);

    return () => {
      clearInterval(callPollInterval);
      clearInterval(statusPollInterval);
    };
  }, [myId, currentChannel]);

  // Get Agora token
  const getToken = async (channelName) => {
    const { data } = await api.post("/agora/token", { channelName });
    return data; // { appId, token }
  };

  // Start a call (join & publish)
  const startCall = async (channelName) => {
    setInCall(true);
    setCurrentChannel(channelName);

    const { appId, token } = await getToken(channelName);

    // Join the channel with myId as UID
    await client.join(appId, channelName, token, myId);

    // Create local audio/video tracks
    localTracks.current = await AgoraRTC.createMicrophoneAndCameraTracks();
    localTracks.current[1].play(localContainer.current);

    await client.publish(localTracks.current);

    // Listen for remote users
    client.on("user-published", async (user, mediaType) => {
      await client.subscribe(user, mediaType);

      if (mediaType === "video") {
        let remoteDiv = document.getElementById(user.uid);
        if (!remoteDiv) {
          remoteDiv = document.createElement("div");
          remoteDiv.id = user.uid;
          remoteDiv.style.width = "400px";
          remoteDiv.style.height = "300px";
          remoteContainer.current.appendChild(remoteDiv);
        }
        user.videoTrack.play(remoteDiv);
      }

      if (mediaType === "audio") {
        user.audioTrack.play();
      }
    });

    client.on("user-unpublished", (user) => {
      const remoteDiv = document.getElementById(user.uid);
      if (remoteDiv) remoteDiv.remove();
    });
  };

  // Call a friend
  const callFriend = async () => {
    if (!friendId) return alert("Enter friend's ID");
    const channelName = `${myId}-${friendId}`;
    setCurrentChannel(channelName);
    
    try {
      // Initiate call via HTTP
      await api.post('/call/initiate', { to: friendId, channelName });
      console.log('Call initiated to:', friendId);
    } catch (error) {
      console.error('Error initiating call:', error);
      alert('Failed to initiate call');
    }
  };

  // End call
  const endCall = async () => {
    localTracks.current.forEach((track) => {
      track.getMediaStreamTrack?.()?.stop();
      track.close();
    });
    localTracks.current = [];
    if (client.connectionState === "CONNECTED" || client.connectionState === "CONNECTING") {
      await client.leave();
    }
    localContainer.current?.replaceChildren();
    setInCall(false);
    setCurrentChannel(null);
    if (remoteContainer.current) remoteContainer.current.innerHTML = "";
  };

  return (
    <div>
      <h1>Video Call</h1>
      <h2>Ikram ID: 67bf1e4009395add03e1e234</h2> <h2>Atik ID: 67e431d61e4463f7adfa544e</h2>
      {!inCall ? (
        <>
          <input
            type="text"
            placeholder="Friend ID"
            value={friendId}
            onChange={(e) => setFriendId(e.target.value)}
          />
          <button onClick={callFriend}>Call {friendId}</button>
        </>
      ) : (
        <div className="flex gap-4">
          <div>
            <h3>Me</h3>
            <div
              ref={localContainer}
              style={{ width: "400px", height: "300px", background: "#000" }}
            />
          </div>
          <div>
            <h3>Friend</h3>
            <div
              ref={remoteContainer}
              style={{ width: "400px", height: "300px", background: "#222" }}
            />
          </div>
          <button onClick={endCall}>End Call</button>
        </div>
      )}
    </div>
  );
};

export default VideoCallPage;
