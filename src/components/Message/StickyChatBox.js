import React, {
  useEffect,
  useState,
  useRef,
  useCallback,
  useLayoutEffect,
} from "react";
import { createPortal } from "react-dom";
import { useSelector, useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import moment from "moment";
import UserPP from "../UserPP";
import api from "../../api/api";
import socket from "../../common/socket";
import { seenMessage } from "../../services/actions/messageActions";
import SingleMessage from "./SingleMessage";
import ChatHeader from "./ChatHeader";
import StickyChatFooter from "./StickyChatFooter";
import SingleMsgSkleton from "../../skletons/message/SingleMsgSkleton";
import ModalContainer from "../modal/ModalContainer";
import LiveVoiceModal from "./LiveVoiceModal";
import useIsMobile from "../../utils/useIsMobile";
import AgoraRTC from "agora-rtc-sdk-ng";
import "./StickyChatBox.css";
import "./UserInfoModal.css";

const NEAR_BOTTOM_PX = 80;

const StickyChatBox = ({
  friendProfile,
  onClose,
  onMinimize,
  isMinimized,
  zIndex,
  isLoading = false,
}) => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const myProfile = useSelector((state) => state.profile);
  const userId = myProfile._id;
  const friendId = friendProfile?._id;

  const [room, setRoom] = useState("");
  const [isActive, setIsActive] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  const [isPreview, setIsPreview] = useState(false);
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isMsgLoading, setIsMsgLoading] = useState(false);
  const [typeMessage, setTypeMessage] = useState("");
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [lastSeen, setLastSeen] = useState(false);
  const [isBlockedMe, setIsBlockedMe] = useState(false);
  const [scrollPercent, setScrollPercent] = useState(0);
  const [replyData, setReplyData] = useState({ messageId: null, body: null });
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, right: 0 });
  const [isUserInfoModalOpen, setIsUserInfoModalOpen] = useState(false);
  const [userInfoData, setUserInfoData] = useState(null);
  const [loadingUserInfo, setLoadingUserInfo] = useState(false);
  const [friendLocation, setFriendLocation] = useState(null);
  const [isLiveVoiceActive, setIsLiveVoiceActive] = useState(false);
  const [isLiveVoiceModalOpen, setIsLiveVoiceModalOpen] = useState(false);
  const [liveVoiceDuration, setLiveVoiceDuration] = useState(0);
  const [emotion, setEmotion] = useState(false);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [unreadWhileScrolled, setUnreadWhileScrolled] = useState(0);
  const [isInitialMsgLoading, setIsInitialMsgLoading] = useState(true);

  const isMobile = useIsMobile();
  const msgListRef = useRef(null);
  const messageInput = useRef(null);
  const chatHeader = useRef(null);
  const chatFooter = useRef(null);
  const optionsMenuRef = useRef(null);
  const optionsButtonRef = useRef(null);
  const hasScrolledOnLoadRef = useRef(false);
  const previousMinimizedStateRef = useRef(isMinimized);
  const isMinimizedRef = useRef(isMinimized);
  const isNearBottomRef = useRef(true);
  const pendingScrollRestoreRef = useRef(null);
  const messagesRef = useRef(messages);
  const loadingOlderRef = useRef(false);
  const liveVoiceClientRef = useRef(null);
  const liveVoiceDurationTimerRef = useRef(null);
  const liveVoiceLocalTrackRef = useRef(null);
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const [map, setMap] = useState(null);
  const [mapLoading, setMapLoading] = useState(false);

  // HTTP-based helper functions
  const fetchMessages = async () => {
    try {
      const response = await api.get("/message/getChatHistory", {
        params: { profileId: userId, friendId },
      });
      return response.data.messages || [];
    } catch (error) {
      console.error("Error fetching messages:", error);
      return [];
    }
  };

  const fetchOldMessages = async (beforeTimestamp) => {
    if (!beforeTimestamp) {
      return { messages: [], hasMore: false };
    }
    try {
      const response = await api.get("/message/getOldMessages", {
        params: {
          profileId: userId,
          friendId: friendId,
          beforeTimestamp,
          limit: 20,
        },
      });
      return response.data;
    } catch (error) {
      console.error("StickyChatBox: Error fetching old messages:", error);
      return { messages: [], hasMore: false };
    }
  };

  const checkOnlineStatus = async (profileId) => {
    try {
      const response = await api.get("/profile/online-status", {
        params: { profileId },
      });
      return response.data.isActive || false;
    } catch (error) {
      console.error("Error checking online status:", error);
      return false;
    }
  };

  // WebSocket-based message sending with optimistic UI
  const sendMessage = async (messageData) => {
    // Create optimistic message object for immediate display
    const optimisticMessage = {
      _id: `temp-${Date.now()}-${Math.random()}`, // Temporary ID
      senderId: userId,
      receiverId: friendId,
      message: messageData.message,
      attachment: messageData.attachment,
      parent: messageData.parent,
      messageType: messageData.messageType || "text",
      timestamp: new Date(),
      isOptimistic: true, // Flag to identify optimistic messages
    };

    console.log("StickyChatBox sending message via WebSocket:", messageData);

    // Add optimistic message to local state immediately
    setMessages((prevMessages) => {
      const existingIds = new Set(
        prevMessages.map((m) => m?._id?.toString()).filter(Boolean),
      );
      if (!existingIds.has(optimisticMessage._id?.toString())) {
        return [...prevMessages, optimisticMessage];
      }
      return prevMessages;
    });

    // Sending a message always brings the sender to the bottom of the thread.
    isNearBottomRef.current = true;
    setShowScrollToBottom(false);
    setUnreadWhileScrolled(0);
    scrollToLastMessage("smooth");

    try {
      // Send via WebSocket instead of HTTP
      socket.emit("sendMessage", messageData);

      // Listen for the server confirmation
      const handleMessageConfirmation = (data) => {
        console.log("StickyChatBox message confirmed by server:", data);

        // Replace optimistic message with real message
        setMessages((prevMessages) => {
          return prevMessages.map((msg) => {
            if (msg._id === optimisticMessage._id) {
              return data.updatedMessage || data.data; // Use the real message from server
            }
            return msg;
          });
        });

        // Clean up listener
        socket.off("newMessage", handleMessageConfirmation);
        socket.off("newMessageToUser", handleMessageConfirmation);
      };

      // Listen for confirmation
      socket.on("newMessage", handleMessageConfirmation);
      socket.on("newMessageToUser", handleMessageConfirmation);

      // Fallback: If no confirmation within 5 seconds, remove optimistic message
      const fallbackTimeout = setTimeout(() => {
        setMessages((prevMessages) =>
          prevMessages.filter((msg) => msg._id !== optimisticMessage._id),
        );
        console.warn(
          "StickyChatBox message not confirmed by server, removed optimistic message",
        );
        socket.off("newMessage", handleMessageConfirmation);
        socket.off("newMessageToUser", handleMessageConfirmation);
      }, 5000);

      // Store timeout ID for cleanup
      optimisticMessage._fallbackTimeout = fallbackTimeout;
    } catch (error) {
      console.error(
        "StickyChatBox error sending message via WebSocket:",
        error,
      );

      // Remove optimistic message on error
      setMessages((prevMessages) =>
        prevMessages.filter((msg) => msg._id !== optimisticMessage._id),
      );

      throw error;
    }
  };

  // Mark only the last message as seen
  const markMessageAsSeen = async (message) => {
    try {
      await api.post("/message/seen", { messageId: message._id });
    } catch (error) {
      console.error("Error marking message as seen:", error);
    }
  };

  // Helper function to deduplicate messages by _id
  const deduplicateMessages = (messagesArray) => {
    if (!Array.isArray(messagesArray)) return [];
    const seen = new Map();
    const unique = [];

    for (const msg of messagesArray) {
      if (msg && msg._id) {
        const id = msg._id.toString();
        if (!seen.has(id)) {
          seen.set(id, true);
          unique.push(msg);
        }
      }
    }

    return unique;
  };

  // Check if user is active - HTTP-based polling
  useEffect(() => {
    if (!friendId || !userId || isLoading) return;

    const checkStatus = async () => {
      const isOnline = await checkOnlineStatus(friendId);
      setIsActive(isOnline);

      if (!isOnline) {
        const now = moment();
        setLastSeen(now.format("hh:mm A"));
      }
    };

    // Initial check
    checkStatus();

    // Poll for online status every 30 seconds
    const interval = setInterval(checkStatus, 30000);

    return () => clearInterval(interval);
  }, [friendId, userId, isLoading]);

  // Check if blocked
  useEffect(() => {
    if (friendProfile && !isLoading) {
      setIsBlockedMe(
        friendProfile.blockedUsers
          ? friendProfile.blockedUsers.includes(userId)
          : false,
      );
    }
  }, [friendProfile, userId, isLoading]);

  // Calculate menu position and handle click outside
  useEffect(() => {
    if (showOptionsMenu && optionsButtonRef.current) {
      // Use requestAnimationFrame to ensure DOM is updated before calculating position
      requestAnimationFrame(() => {
        if (optionsButtonRef.current) {
          const buttonRect = optionsButtonRef.current.getBoundingClientRect();
          setMenuPosition({
            top: buttonRect.bottom + 8,
            right: window.innerWidth - buttonRect.right,
          });
        }
      });
    }

    const handleClickOutside = (event) => {
      if (
        optionsMenuRef.current &&
        !optionsMenuRef.current.contains(event.target) &&
        optionsButtonRef.current &&
        !optionsButtonRef.current.contains(event.target)
      ) {
        setShowOptionsMenu(false);
      }
    };

    if (showOptionsMenu) {
      // Use setTimeout to ensure the menu is rendered before adding listener
      setTimeout(() => {
        document.addEventListener("mousedown", handleClickOutside);
      }, 0);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showOptionsMenu]);

  // Handle chat info click
  const handleChatInfoClick = async () => {
    if (!friendId) return;
    setIsUserInfoModalOpen(true);
    setLoadingUserInfo(true);
    try {
      const res = await api.get("/profile", {
        params: { profileId: friendId },
      });
      if (res.status === 200) {
        setUserInfoData(res.data);
        if (
          res.data?.lastLocation?.latitude &&
          res.data?.lastLocation?.longitude
        ) {
          setFriendLocation({
            latitude: res.data.lastLocation.latitude,
            longitude: res.data.lastLocation.longitude,
            timestamp: res.data.lastLocation.timestamp || Date.now(),
          });
        }
      }
    } catch (error) {
      console.error("Error fetching user info:", error);
      setUserInfoData(friendProfile);
      if (
        friendProfile?.lastLocation?.latitude &&
        friendProfile?.lastLocation?.longitude
      ) {
        setFriendLocation({
          latitude: friendProfile.lastLocation.latitude,
          longitude: friendProfile.lastLocation.longitude,
          timestamp: friendProfile.lastLocation.timestamp || Date.now(),
        });
      }
    } finally {
      setLoadingUserInfo(false);
    }
  };

  // Handle live voice button click
  const handleLiveVoiceButtonClick = async () => {
    if (!friendId || !room) return;

    if (isLiveVoiceActive) {
      // Stop live voice
      try {
        if (liveVoiceClientRef.current && liveVoiceLocalTrackRef.current) {
          await liveVoiceClientRef.current.unpublish([
            liveVoiceLocalTrackRef.current,
          ]);
        }
      } catch (e) {
        console.warn("Error unpublishing live voice:", e);
      }
      try {
        liveVoiceLocalTrackRef.current?.close();
      } catch (e) {
        console.warn("Error closing live voice track:", e);
      }
      liveVoiceLocalTrackRef.current = null;
      try {
        await liveVoiceClientRef.current?.leave();
        liveVoiceClientRef.current?.removeAllListeners();
      } catch (e) {
        console.warn("Error leaving live voice channel:", e);
      }
      liveVoiceClientRef.current = null;
      setIsLiveVoiceActive(false);
      setIsLiveVoiceModalOpen(false);
      setLiveVoiceDuration(0);
      if (liveVoiceDurationTimerRef.current) {
        clearInterval(liveVoiceDurationTimerRef.current);
        liveVoiceDurationTimerRef.current = null;
      }
      // Live voice stop - HTTP-based notification could be implemented here
      console.log("Stopping live voice session for channel:", room);
      return;
    }

    // Start live voice
    try {
      const channelName = room;
      // Live voice start - HTTP-based notification could be implemented here
      // For now, we'll just start the local voice session
      console.log("Starting live voice session for channel:", channelName);

      // Get numeric UID for Agora
      let numericUid = 0;
      if (userId) {
        let hash = 0;
        for (let i = 0; i < userId.length; i++) {
          hash = (hash << 5) - hash + userId.charCodeAt(i);
          hash |= 0;
        }
        numericUid = Math.abs(hash);
      }

      const { data } = await api.post("/agora/token", {
        channelName,
        uid: numericUid,
        role: "publisher",
      });
      const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
      liveVoiceClientRef.current = client;
      await client.join(data.appId, channelName, data.token, numericUid);
      const mic = await AgoraRTC.createMicrophoneAudioTrack();
      liveVoiceLocalTrackRef.current = mic;
      await client.publish([mic]);
      setIsLiveVoiceActive(true);
      setLiveVoiceDuration(0);
      setIsLiveVoiceModalOpen(true);
      if (liveVoiceDurationTimerRef.current) {
        clearInterval(liveVoiceDurationTimerRef.current);
      }
      liveVoiceDurationTimerRef.current = setInterval(() => {
        setLiveVoiceDuration((prev) => prev + 1);
      }, 1000);
      // Live voice started - HTTP-based notification could be implemented here
      console.log("Live voice session started for channel:", channelName);
    } catch (error) {
      console.error("Error starting live voice:", error);
      setIsLiveVoiceActive(false);
      setIsLiveVoiceModalOpen(false);
      setLiveVoiceDuration(0);
      if (liveVoiceDurationTimerRef.current) {
        clearInterval(liveVoiceDurationTimerRef.current);
        liveVoiceDurationTimerRef.current = null;
      }
    }
  };

  // Helper functions for user info modal
  const getUserName = () => {
    const data = userInfoData || friendProfile;
    return (
      data?.fullName ||
      (data?.user?.firstName && data?.user?.surname
        ? `${data.user.firstName} ${data.user.surname}`
        : "Unknown User")
    );
  };

  const getUserProfilePic = () => {
    const data = userInfoData || friendProfile;
    return data?.profilePic || "";
  };

  const formatLastActive = (lastSeenValue) => {
    if (!lastSeenValue) return "Never";
    if (typeof lastSeenValue === "string") {
      if (lastSeenValue.includes("Last Seen:")) {
        return lastSeenValue.replace("Last Seen:", "").trim();
      }
      return lastSeenValue;
    }
    const now = new Date();
    const lastSeenDate = new Date(lastSeenValue);
    const diffMs = now - lastSeenDate;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60)
      return `${diffMins} ${diffMins === 1 ? "minute" : "minutes"} ago`;
    if (diffHours < 24)
      return `${diffHours} ${diffHours === 1 ? "hour" : "hours"} ago`;
    if (diffDays < 7)
      return `${diffDays} ${diffDays === 1 ? "day" : "days"} ago`;
    return lastSeenDate.toLocaleDateString();
  };

  const getUserLocation = () => {
    if (friendLocation) {
      return `${friendLocation.latitude.toFixed(6)}, ${friendLocation.longitude.toFixed(6)}`;
    }
    const data = userInfoData || friendProfile;
    if (data?.lastLocation?.latitude && data?.lastLocation?.longitude) {
      return `${data.lastLocation.latitude.toFixed(6)}, ${data.lastLocation.longitude.toFixed(6)}`;
    }
    if (data?.presentAddress) return data.presentAddress;
    if (data?.permanentAddress) return data.permanentAddress;
    return "Not available";
  };

  const getUserEmotion = () => {
    if (emotion) return emotion;
    const data = userInfoData || friendProfile;
    if (data?.lastEmotion) return data.lastEmotion;
    if (data?.lastEmotionText && data?.lastEmotionEmoji) {
      return `${data.lastEmotionEmoji} ${data.lastEmotionText}`;
    }
    return "No emotion detected";
  };

  const getLastAction = () => {
    const data = userInfoData || friendProfile;
    if (emotion) return "Sharing emotion";
    if (data?.isActive || isActive) return "Currently active";
    if (lastSeen) {
      const lastSeenLower = String(lastSeen).toLowerCase();
      if (
        lastSeenLower.includes("minute") ||
        lastSeenLower.includes("just now")
      ) {
        return "Recently active";
      }
      return "Last seen recently";
    }
    return "Unknown";
  };

  // Initialize chat room and fetch messages - HTTP-based
  useEffect(() => {
    if (!friendId || !userId || isLoading || !friendProfile?._id) return;

    console.log(
      "StickyChatBox: Initializing chat for",
      friendId,
      "isLoading:",
      isLoading,
    );

    const newRoom = [userId, friendId].sort().join("_");
    setRoom(newRoom);

    // Fetch initial messages via HTTP API
    const fetchInitialMessages = async () => {
      setIsInitialMsgLoading(true);
      try {
        console.log("StickyChatBox: Fetching messages for", userId, friendId);
        const response = await api.get("/message/getChatHistory", {
          params: {
            profileId: userId,
            friendId: friendId,
            limit: 20,
          },
        });

        console.log("StickyChatBox: Messages response", response.data);
        if (response.data && response.data.messages) {
          const deduplicated = deduplicateMessages(response.data.messages);
          setMessages(deduplicated);
          setHasMoreMessages(response.data.hasMore);
          isNearBottomRef.current = true;
        } else {
          console.log("StickyChatBox: No messages in response");
          setMessages([]);
          setHasMoreMessages(false);
        }
      } catch (error) {
        console.error("StickyChatBox: Error fetching initial messages:", error);
        setMessages([]);
        setHasMoreMessages(false);
      } finally {
        setIsInitialMsgLoading(false);
      }
    };

    fetchInitialMessages();

    // Real-time socket listeners for new messages
    const roomId = [userId, friendId].sort().join("_");
    socket.emit("joinRoom", roomId);

    const appendIncomingMessage = (updatedMessage) => {
      const isOwnMessage = String(updatedMessage.senderId) === String(userId);
      // Snapshot before the state update — don't yank the user if they're reading history.
      const shouldFollow = isOwnMessage || isNearBottomRef.current;

      setMessages((prevMessages) => {
        const existingIds = new Set(
          prevMessages.map((m) => m?._id?.toString()).filter(Boolean),
        );

        // Check if this is a confirmation of an optimistic message
        const optimisticIndex = prevMessages.findIndex(
          (msg) =>
            msg.isOptimistic &&
            msg.senderId === updatedMessage.senderId &&
            msg.message === updatedMessage.message &&
            Math.abs(
              new Date(msg.timestamp) - new Date(updatedMessage.timestamp),
            ) < 5000, // Within 5 seconds
        );

        if (optimisticIndex !== -1) {
          // Replace optimistic message with real message
          const newMessages = [...prevMessages];
          newMessages[optimisticIndex] = updatedMessage;
          return newMessages;
        } else if (!existingIds.has(updatedMessage._id?.toString())) {
          // Update sender's online status when receiving new messages
          if (updatedMessage.senderId === friendId) {
            setIsActive(true);
          }

          return [...prevMessages, updatedMessage];
        }
        return prevMessages;
      });

      if (shouldFollow) {
        scrollToLastMessage("smooth");
      } else if (!isOwnMessage) {
        // Message arrived while the user is reading older history — surface a
        // "jump to latest" affordance instead of forcing a scroll.
        setUnreadWhileScrolled((count) => count + 1);
        setShowScrollToBottom(true);
      }
    };

    const handleNewMessage = (data) => {
      console.log("StickyChatBox received new message via socket:", data);
      if (
        data.updatedMessage &&
        (data.updatedMessage.senderId === friendId ||
          data.updatedMessage.receiverId === friendId)
      ) {
        appendIncomingMessage(data.updatedMessage);
      }
    };

    const handleNewMessageToUser = (data) => {
      console.log(
        "StickyChatBox received new message to user via socket:",
        data,
      );
      if (
        data.updatedMessage &&
        (data.updatedMessage.senderId === friendId ||
          data.updatedMessage.receiverId === friendId)
      ) {
        appendIncomingMessage(data.updatedMessage);
      }
    };

    const handleMessageSeen = (data) => {
      if (!data?.messageId) return;
      setMessages((prevMessages) =>
        prevMessages.map((msg) => {
          if (String(msg._id) === String(data.messageId)) {
            return { ...msg, isSeen: true };
          }
          return msg;
        }),
      );
    };

    socket.on("newMessage", handleNewMessage);
    socket.on("newMessageToUser", handleNewMessageToUser);
    socket.on("messageSeen", handleMessageSeen);

    return () => {
      socket.off("newMessage", handleNewMessage);
      socket.off("newMessageToUser", handleNewMessageToUser);
      socket.off("messageSeen", handleMessageSeen);
      socket.emit("leaveRoom", roomId);
    };
  }, [friendId, userId, isLoading]);

  // Live voice - HTTP-based notification (simplified)
  useEffect(() => {
    if (!friendId || !userId || isLoading) return;

    const ensureLeaveLiveVoice = async () => {
      try {
        await liveVoiceClientRef.current?.leave();
      } catch (e) {
        // Ignore leave errors
      }
      try {
        liveVoiceClientRef.current?.removeAllListeners();
      } catch (e) {
        // Ignore listener removal errors
      }
      liveVoiceClientRef.current = null;
    };

    // HTTP-based live voice notifications could be implemented here
    // For now, we'll just log the events
    console.log("Live voice functionality converted to HTTP-based polling");

    return () => {
      // Cleanup live voice
      if (liveVoiceDurationTimerRef.current) {
        clearInterval(liveVoiceDurationTimerRef.current);
        liveVoiceDurationTimerRef.current = null;
      }
    };
  }, [friendId, userId, isLoading]);

  // Load Google Maps script
  useEffect(() => {
    const apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
      console.warn("Google Maps API key is not configured.");
      return;
    }

    // Check if script is already loaded
    if (window.google && window.google.maps) {
      return;
    }

    // Check if script tag already exists
    const existingScript = document.querySelector(
      'script[src*="maps.googleapis.com"]',
    );
    if (existingScript) {
      return;
    }

    // Create and load script
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,marker`;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      console.error("Failed to load Google Maps.");
    };
    document.head.appendChild(script);
  }, []);

  // Initialize Google Map when modal opens and location is available
  useEffect(() => {
    if (!isUserInfoModalOpen || !mapRef.current) return;

    const location =
      friendLocation ||
      userInfoData?.lastLocation ||
      friendProfile?.lastLocation;
    if (!location || !location.latitude || !location.longitude) return;

    let checkInterval = null;

    // Wait for Google Maps to be loaded
    checkInterval = setInterval(() => {
      if (window.google && window.google.maps && mapRef.current) {
        clearInterval(checkInterval);
        initializeMap(location);
      }
    }, 100);

    // Timeout after 5 seconds
    const timeoutId = setTimeout(() => {
      if (checkInterval) {
        clearInterval(checkInterval);
      }
    }, 5000);

    return () => {
      if (checkInterval) {
        clearInterval(checkInterval);
      }
      clearTimeout(timeoutId);
      // Clean up map when modal closes
      mapInstanceRef.current = null;
      setMap(null);
    };
  }, [
    isUserInfoModalOpen,
    friendLocation,
    userInfoData?.lastLocation,
    friendProfile?.lastLocation,
  ]);

  const initializeMap = (location) => {
    if (!window.google || !window.google.maps || !mapRef.current || !location) {
      return;
    }

    // If map already exists, just update it
    if (mapInstanceRef.current) {
      const mapLocation = { lat: location.latitude, lng: location.longitude };
      mapInstanceRef.current.setCenter(mapLocation);
      return;
    }

    try {
      setMapLoading(true);
      const mapLocation = { lat: location.latitude, lng: location.longitude };

      const mapOptions = {
        center: mapLocation,
        zoom: 15,
        mapTypeId: window.google.maps.MapTypeId.ROADMAP,
        mapTypeControl: true,
        mapTypeControlOptions: {
          style: window.google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
          position: window.google.maps.ControlPosition.TOP_RIGHT,
          mapTypeIds: [
            window.google.maps.MapTypeId.ROADMAP,
            window.google.maps.MapTypeId.SATELLITE,
            window.google.maps.MapTypeId.HYBRID,
            window.google.maps.MapTypeId.TERRAIN,
          ],
        },
        streetViewControl: true,
        fullscreenControl: true,
        zoomControl: true,
      };

      const mapId = process.env.REACT_APP_GOOGLE_MAPS_MAP_ID;
      if (mapId) {
        mapOptions.mapId = mapId;
      }

      const mapInstance = new window.google.maps.Map(
        mapRef.current,
        mapOptions,
      );
      mapInstanceRef.current = mapInstance;
      setMap(mapInstance);

      // Add marker for friend's location
      const useAdvancedMarker =
        window.google.maps.marker &&
        window.google.maps.marker.AdvancedMarkerElement &&
        mapId;
      const userName = getUserName();

      if (useAdvancedMarker) {
        try {
          new window.google.maps.marker.AdvancedMarkerElement({
            map: mapInstance,
            position: mapLocation,
            title: userName,
          });
        } catch (markerError) {
          console.warn(
            "AdvancedMarkerElement failed, using legacy Marker:",
            markerError,
          );
          new window.google.maps.Marker({
            position: mapLocation,
            map: mapInstance,
            title: userName,
            icon: {
              url: "http://maps.google.com/mapfiles/ms/icons/red-dot.png",
            },
          });
        }
      } else {
        new window.google.maps.Marker({
          position: mapLocation,
          map: mapInstance,
          title: userName,
          icon: {
            url: "http://maps.google.com/mapfiles/ms/icons/red-dot.png",
          },
        });
      }

      setMapLoading(false);
    } catch (error) {
      console.error("Error initializing map:", error);
      setMapLoading(false);
    }
  };

  // Mark the conversation as read the moment it's actually visible (open and
  // not minimized), so the header unread badge updates in real time — mirrors
  // the behavior of the main chat page.
  useEffect(() => {
    if (isMinimized || isLoading || !friendId) return;
    dispatch(seenMessage(friendId));
  }, [friendId, isMinimized, isLoading, dispatch]);

  // Mark messages as seen - HTTP-based. Only runs while the chat is actually
  // visible (not minimized), so we never mark a message as read before the
  // user has had a chance to see it.
  useEffect(() => {
    if (isMinimized) return;
    if (messages.length > 0 && friendId && friendProfile?._id) {
      const timeoutId = setTimeout(() => {
        const lastMessage = messages[messages.length - 1];
        if (
          lastMessage &&
          lastMessage.senderId !== userId &&
          lastMessage.senderId === friendId &&
          !lastMessage.isSeen
        ) {
          markMessageAsSeen(lastMessage);
          dispatch(seenMessage(friendId));
        }
      }, 2000);
      return () => clearTimeout(timeoutId);
    }
  }, [messages, friendId, friendProfile, userId, isMinimized, dispatch]);

  // Keep a live ref of messages so scroll/pagination logic never closes over stale state.
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const getDistanceFromBottom = (el) => {
    if (!el) return 0;
    return el.scrollHeight - el.scrollTop - el.clientHeight;
  };

  const checkIsNearBottom = (el, threshold = NEAR_BOTTOM_PX) => {
    if (!el) return true;
    return getDistanceFromBottom(el) <= threshold;
  };

  // Scroll handling - tracks pagination percentage and whether the user is
  // currently near the bottom of the thread (so we know when it's safe to
  // auto-follow new messages vs. leaving the user's reading position alone).
  useEffect(() => {
    const handleScroll = () => {
      const el = msgListRef.current;
      if (!el) return;
      const scrollTop = el.scrollTop;
      const maxScroll = el.scrollHeight - el.clientHeight;
      const percent = maxScroll > 0 ? (scrollTop / maxScroll) * 100 : 100;
      setScrollPercent(percent);

      const nearBottom = checkIsNearBottom(el);
      isNearBottomRef.current = nearBottom;
      if (nearBottom) {
        setShowScrollToBottom(false);
        setUnreadWhileScrolled(0);
      } else {
        setShowScrollToBottom(true);
      }
    };

    const el = msgListRef.current;
    if (el) {
      el.addEventListener("scroll", handleScroll, { passive: true });
      handleScroll();
    }

    return () => {
      if (el) {
        el.removeEventListener("scroll", handleScroll);
      }
    };
  }, []);

  // Load more messages on scroll - HTTP-based, anchoring the viewport so the
  // list doesn't jump when older messages are prepended.
  useEffect(() => {
    if (!hasMoreMessages || scrollPercent >= 30 || isMsgLoading) return;
    if (loadingOlderRef.current) return;

    const oldestMessage = messagesRef.current[0];
    const beforeTimestamp =
      oldestMessage?.timestamp || oldestMessage?.createdAt;
    if (!beforeTimestamp) return;

    loadingOlderRef.current = true;
    const loadMoreMessages = async () => {
      try {
        setIsMsgLoading(true);
        const response = await fetchOldMessages(beforeTimestamp);
        if (response && response.messages && response.messages.length > 0) {
          const el = msgListRef.current;
          if (el) {
            pendingScrollRestoreRef.current = {
              prevHeight: el.scrollHeight,
              prevTop: el.scrollTop,
            };
          }
          setMessages((prev) => [...response.messages, ...prev]);
          setHasMoreMessages(response.hasMore);
        } else {
          setHasMoreMessages(false);
        }
      } catch (error) {
        pendingScrollRestoreRef.current = null;
        console.error("Error loading more messages:", error);
      } finally {
        setIsMsgLoading(false);
        loadingOlderRef.current = false;
      }
    };

    loadMoreMessages();
  }, [scrollPercent, hasMoreMessages, isMsgLoading]);

  // Restore the scroll anchor right after older messages are prepended, before paint.
  useLayoutEffect(() => {
    const restore = pendingScrollRestoreRef.current;
    const el = msgListRef.current;
    if (!restore || !el) return;
    el.scrollTop = restore.prevTop + (el.scrollHeight - restore.prevHeight);
    pendingScrollRestoreRef.current = null;
    isNearBottomRef.current = checkIsNearBottom(el);
  }, [messages]);

  // Keep a ref in sync so scrollToLastMessage always sees the latest
  // minimized state, even when called from closures created on an earlier render.
  useEffect(() => {
    isMinimizedRef.current = isMinimized;
  }, [isMinimized]);

  // Smoothly (or instantly) scroll the thread to the latest message. Mirrors
  // the behavior used on the full Message page for a consistent feel.
  // Intentionally stable (no deps) so effects that call it don't need to
  // resubscribe whenever isMinimized changes.
  const scrollToLastMessage = useCallback((behavior = "smooth") => {
    if (isMinimizedRef.current) return;

    const doScroll = () => {
      const list = msgListRef.current;
      if (!list) return;
      list.scrollTo({ top: list.scrollHeight, behavior });
      isNearBottomRef.current = true;
      setScrollPercent(100);
      setShowScrollToBottom(false);
      setUnreadWhileScrolled(0);
    };

    // Wait a frame so newly rendered messages are measured first.
    requestAnimationFrame(() => {
      doScroll();
      if (behavior === "auto") {
        requestAnimationFrame(doScroll);
      }
    });
  }, []);

  // Scroll to bottom when chat is restored from minimized state
  useEffect(() => {
    const wasMinimized = previousMinimizedStateRef.current;
    previousMinimizedStateRef.current = isMinimized;

    if (
      !isMinimized &&
      wasMinimized &&
      messages.length > 0 &&
      msgListRef.current
    ) {
      scrollToLastMessage("auto");
    }
  }, [isMinimized, messages.length, scrollToLastMessage]);

  // Scroll to bottom once, right after the first batch of messages renders.
  useLayoutEffect(() => {
    if (hasScrolledOnLoadRef.current) return;
    if (
      isMinimized ||
      isLoading ||
      !friendProfile?._id ||
      messages.length === 0
    )
      return;
    hasScrolledOnLoadRef.current = true;
    scrollToLastMessage("auto");
  }, [
    isMinimized,
    isLoading,
    friendProfile?._id,
    messages.length,
    scrollToLastMessage,
  ]);

  const footerProps = {
    room,
    friendId,
    setIsTyping,
    userId,
    replyData,
    setReplyData,
    messages,
    friendProfile,
    msgListRef,
    isAi: false,
    sendMessage,
  };

  if (isMinimized) {
    return (
      <div className="sticky-chat-box minimized" style={{ zIndex }}>
        <div className="sticky-chat-minimized-header" onClick={onMinimize}>
          <div className="sticky-chat-minimized-avatar">
            {isLoading ? (
              <div className="sticky-chat-skeleton-avatar"></div>
            ) : (
              <UserPP
                profilePic={friendProfile?.profilePic}
                profile={friendId}
                active={isActive}
              />
            )}
          </div>
          <div className="sticky-chat-minimized-info">
            <div className="sticky-chat-minimized-name">
              {isLoading ? (
                <div
                  className="sticky-chat-skeleton-text"
                  style={{ width: "100px", height: "14px" }}
                ></div>
              ) : (
                friendProfile?.fullName ||
                `${friendProfile?.user?.firstName || ""} ${friendProfile?.user?.surname || ""}`.trim() ||
                "Loading..."
              )}
            </div>
            <div className="sticky-chat-minimized-status">
              {isLoading ? (
                <div
                  className="sticky-chat-skeleton-text"
                  style={{ width: "80px", height: "11px", marginTop: "4px" }}
                ></div>
              ) : isActive ? (
                "Active now"
              ) : lastSeen ? (
                `Last seen ${lastSeen}`
              ) : (
                "Offline"
              )}
            </div>
          </div>
          <div className="sticky-chat-minimized-actions">
            <button
              className="sticky-chat-action-btn"
              onClick={(e) => {
                e.stopPropagation();
                onMinimize();
              }}
            >
              <i className="fas fa-window-maximize"></i>
            </button>
            <button
              className="sticky-chat-action-btn"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
            >
              <i className="fas fa-times"></i>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="sticky-chat-box" style={{ zIndex }}>
      <div className="sticky-chat-header" ref={chatHeader}>
        <div className="sticky-chat-header-info">
          <div className="sticky-chat-header-avatar">
            {isLoading ? (
              <div className="sticky-chat-skeleton-avatar"></div>
            ) : (
              <UserPP
                profilePic={friendProfile?.profilePic}
                profile={friendId}
                active={isActive}
              />
            )}
          </div>
          <div className="sticky-chat-header-details">
            <div className="sticky-chat-header-name">
              {isLoading ? (
                <div
                  className="sticky-chat-skeleton-text"
                  style={{ width: "120px", height: "15px" }}
                ></div>
              ) : (
                friendProfile?.fullName ||
                `${friendProfile?.user?.firstName || ""} ${friendProfile?.user?.surname || ""}`.trim() ||
                "Loading..."
              )}
            </div>
            <div className="sticky-chat-header-status">
              {isLoading ? (
                <div
                  className="sticky-chat-skeleton-text"
                  style={{ width: "100px", height: "12px", marginTop: "4px" }}
                ></div>
              ) : isActive ? (
                "Active now"
              ) : lastSeen ? (
                `Last seen ${lastSeen}`
              ) : (
                "Offline"
              )}
            </div>
          </div>
        </div>
        <div className="sticky-chat-header-actions">
          <div className="sticky-chat-options-wrapper">
            <button
              ref={optionsButtonRef}
              className="sticky-chat-action-btn"
              onClick={() => setShowOptionsMenu(!showOptionsMenu)}
              title="More options"
            >
              <i className="fas fa-ellipsis-v"></i>
            </button>
          </div>
          <button
            className="sticky-chat-action-btn"
            onClick={onMinimize}
            title="Minimize"
          >
            <i className="fas fa-minus"></i>
          </button>
          <button
            className="sticky-chat-action-btn"
            onClick={onClose}
            title="Close"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>
      </div>

      <div className="sticky-chat-body">
        <div
          className="sticky-chat-message-list"
          id="chatMessageList"
          ref={msgListRef}
        >
          {isLoading || isInitialMsgLoading ? (
            <SingleMsgSkleton count={8} />
          ) : messages.length > 0 ? (
            messages.map((msg, index) => (
              <SingleMessage
                key={msg._id ? `${msg._id}-${index}` : `msg-${index}`}
                msg={msg}
                friendProfile={friendProfile}
                messages={messages}
                setMessages={setMessages}
                isActive={isActive}
                setIsReplying={setIsReplying}
                setReplyData={setReplyData}
                isPreview={isPreview}
                setIsPreview={setIsPreview}
                msgListRef={msgListRef}
                isMsgLoading={isMsgLoading}
              />
            ))
          ) : (
            <div className="sticky-chat-empty-conversation">
              <div className="sticky-chat-empty-avatar">
                <UserPP
                  profilePic={friendProfile.profilePic}
                  profile={friendId}
                      active={isActive}
                      size="full"
                />
              </div>
              <h4 className="sticky-chat-empty-name">
                {friendProfile?.fullName ||
                  `${friendProfile?.user?.firstName || ""} ${friendProfile?.user?.surname || ""}`.trim() ||
                  "This user"}
              </h4>
              <p className="sticky-chat-empty-subtitle">
                No messages yet. Say hello to start the conversation!
              </p>
            </div>
          )}

          {isTyping && (
            <div
              className={`chat-message-container message-receive message-typing`}
            >
              <div className="chat-message-profilePic">
                <UserPP
                  profilePic={friendProfile.profilePic}
                  profile={friendId}
                  active={isActive}
                />
              </div>
              <div className="chat-message">
                <p className="message-container mb-0">
                  {typeMessage || (
                    <div className="typing-indicator">
                      <span className="typing-dots"></span>
                      <span className="typing-dots"></span>
                      <span className="typing-dots"></span>
                    </div>
                  )}
                </p>
              </div>
            </div>
          )}
        </div>

        {showScrollToBottom && (
          <button
            type="button"
            className="sticky-chat-scroll-to-bottom"
            onClick={() => scrollToLastMessage("smooth")}
            title={
              unreadWhileScrolled > 0
                ? "Jump to latest message"
                : "Scroll to bottom"
            }
          >
            <i className="fas fa-arrow-down"></i>
            {unreadWhileScrolled > 0 && (
              <span className="sticky-chat-scroll-to-bottom-badge">
                {unreadWhileScrolled > 9 ? "9+" : unreadWhileScrolled}
              </span>
            )}
          </button>
        )}
      </div>

      {isLoading ? (
        <div ref={chatFooter} className="sticky-chat-footer">
          <div className="sticky-chat-footer-skeleton">
            <div
              className="sticky-chat-skeleton-text"
              style={{ width: "100%", height: "40px", borderRadius: "20px" }}
            ></div>
          </div>
        </div>
      ) : !isBlockedMe ? (
        <div ref={chatFooter} className="sticky-chat-footer">
          <StickyChatFooter {...footerProps} />
        </div>
      ) : (
        <div ref={chatFooter} className="sticky-chat-footer">
          <div className="sticky-chat-blocked-message">
            <i className="fas fa-ban"></i>
            <span>
              {friendProfile?.fullName ||
                `${friendProfile?.user?.firstName || ""} ${friendProfile?.user?.surname || ""}`}{" "}
              Blocked You
            </span>
          </div>
        </div>
      )}

      {showOptionsMenu &&
        createPortal(
          <div
            ref={optionsMenuRef}
            className="sticky-chat-options-menu"
            style={{
              top: `${menuPosition.top}px`,
              right: `${menuPosition.right}px`,
            }}
          >
            <button
              className="sticky-chat-option-item"
              onClick={() => {
                // Audio Call - dispatch custom event and notify other user
                const channelName = `${userId}-${friendId}`;
                const callData = {
                  to: friendId,
                  channelName,
                  callerName:
                    friendProfile?.fullName ||
                    `${friendProfile?.user?.firstName} ${friendProfile?.user?.surname}` ||
                    "Friend",
                  callerProfilePic: friendProfile?.profilePic,
                };

                // Dispatch custom event for AudioCall component
                window.dispatchEvent(
                  new CustomEvent("startAudioCall", {
                    detail: callData,
                  }),
                );

                // Emit socket event to notify the other user
                socket.emit("audio-call", {
                  to: friendId,
                  channelName,
                  isAudio: true,
                  callerName: callData.callerName,
                  callerProfilePic: callData.callerProfilePic,
                });

                setShowOptionsMenu(false);
              }}
            >
              <i className="fas fa-phone-alt"></i>
              <span>Audio Call</span>
            </button>
            <button
              className="sticky-chat-option-item"
              onClick={() => {
                // Video Call - dispatch custom event and notify other user
                const channelName = `${userId}-${friendId}`;
                const callData = {
                  to: friendId,
                  channelName,
                  callerName:
                    friendProfile?.fullName ||
                    `${friendProfile?.user?.firstName} ${friendProfile?.user?.surname}` ||
                    "Friend",
                  callerProfilePic: friendProfile?.profilePic,
                  isAudio: false,
                };

                // Dispatch custom event for VideoCall component
                window.dispatchEvent(
                  new CustomEvent("startVideoCall", {
                    detail: callData,
                  }),
                );

                // Emit socket event to notify the other user
                socket.emit("video-call", {
                  to: friendId,
                  channelName,
                  isAudio: false,
                  callerName: callData.callerName,
                  callerProfilePic: callData.callerProfilePic,
                });

                setShowOptionsMenu(false);
              }}
            >
              <i className="fas fa-video"></i>
              <span>Video Call</span>
            </button>
            <button
              className="sticky-chat-option-item"
              onClick={() => {
                // Bump - HTTP-based notification could be implemented here
                console.log("Bump sent to:", friendId);
                setShowOptionsMenu(false);
              }}
            >
              <i className="fas fa-record-vinyl"></i>
              <span>Bump</span>
            </button>
            <button
              className="sticky-chat-option-item"
              onClick={() => {
                handleLiveVoiceButtonClick();
                setShowOptionsMenu(false);
              }}
            >
              <i className="fas fa-microphone-alt"></i>
              <span>
                {isLiveVoiceActive ? "Stop Live Voice" : "Start Live Voice"}
              </span>
            </button>
            <div className="sticky-chat-options-divider"></div>
            <button
              className="sticky-chat-option-item"
              onClick={() => {
                handleChatInfoClick();
                setShowOptionsMenu(false);
              }}
            >
              <i className="fas fa-info-circle"></i>
              <span>User Info</span>
            </button>
            <div className="sticky-chat-options-divider"></div>
            <button
              className="sticky-chat-option-item"
              onClick={() => {
                window.location.href = `/profile/${friendId}`;
                setShowOptionsMenu(false);
              }}
            >
              <i className="fas fa-user"></i>
              <span>View Profile</span>
            </button>
            <button
              className="sticky-chat-option-item"
              onClick={() => {
                navigate(`/message/${friendId}`);
                setShowOptionsMenu(false);
              }}
            >
              <i className="fas fa-expand"></i>
              <span>Open in Full Chat</span>
            </button>
            <button
              className="sticky-chat-option-item"
              onClick={() => {
                // TODO: Implement mute functionality
                setShowOptionsMenu(false);
              }}
            >
              <i className="fas fa-bell-slash"></i>
              <span>Mute Notifications</span>
            </button>
            <div className="sticky-chat-options-divider"></div>
            <button
              className="sticky-chat-option-item danger"
              onClick={() => {
                if (
                  window.confirm("Are you sure you want to block this user?")
                ) {
                  // TODO: Implement block functionality
                  setShowOptionsMenu(false);
                }
              }}
            >
              <i className="fas fa-ban"></i>
              <span>Block User</span>
            </button>
            <button
              className="sticky-chat-option-item danger"
              onClick={() => {
                if (
                  window.confirm(
                    "Are you sure you want to delete this conversation?",
                  )
                ) {
                  // TODO: Implement delete conversation functionality
                  setShowOptionsMenu(false);
                }
              }}
            >
              <i className="fas fa-trash"></i>
              <span>Delete Conversation</span>
            </button>
          </div>,
          document.body,
        )}

      {/* User Info Modal */}
      <ModalContainer
        title="User Information"
        style={{
          width: isMobile ? "95%" : "700px",
          maxHeight: "90vh",
          overflow: "auto",
        }}
        isOpen={isUserInfoModalOpen}
        onRequestClose={() => setIsUserInfoModalOpen(false)}
        id="stickyUserInfoModal"
      >
        <div className="user-info-modal-content">
          {loadingUserInfo ? (
            <div className="user-info-loading">
              <div className="loading-spinner"></div>
              <p>Loading user information...</p>
            </div>
          ) : (
            <>
              <div className="user-info-header">
                <div className="user-info-avatar-container">
                  <img
                    src={getUserProfilePic()}
                    alt={getUserName()}
                    className="user-info-avatar"
                    onError={(e) => {
                      e.target.src =
                        "https://via.placeholder.com/120?text=User";
                    }}
                  />
                  {isActive && (
                    <span className="user-info-status-badge active"></span>
                  )}
                </div>
                <h2 className="user-info-name">{getUserName()}</h2>
                {isActive ? (
                  <span className="user-info-status-text active">Online</span>
                ) : (
                  <span className="user-info-status-text">Offline</span>
                )}
              </div>

              <div className="user-info-cards">
                {(friendLocation ||
                  userInfoData?.lastLocation ||
                  friendProfile?.lastLocation) && (
                  <div
                    className="user-info-card"
                    style={{ padding: 0, overflow: "hidden", width: "100%" }}
                  >
                    <div
                      style={{
                        width: "100%",
                        height: "400px",
                        position: "relative",
                        overflow: "hidden",
                      }}
                    >
                      {mapLoading && (
                        <div
                          style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center",
                            backgroundColor: "rgba(0,0,0,0.1)",
                            zIndex: 1,
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              gap: "10px",
                            }}
                          >
                            <div
                              className="spinner-border text-primary"
                              role="status"
                            >
                              <span className="visually-hidden">
                                Loading...
                              </span>
                            </div>
                            <p style={{ color: "#666", margin: 0 }}>
                              Loading map...
                            </p>
                          </div>
                        </div>
                      )}
                      <div
                        ref={mapRef}
                        style={{
                          width: "100%",
                          height: "100%",
                          minHeight: "400px",
                        }}
                      />
                    </div>
                  </div>
                )}

                <div className="user-info-card">
                  <div className="user-info-card-icon active">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="12" cy="12" r="10"></circle>
                      <polyline points="12 6 12 12 16 14"></polyline>
                    </svg>
                  </div>
                  <div className="user-info-card-content">
                    <h3 className="user-info-card-label">Last Active</h3>
                    <p className="user-info-card-value">
                      {formatLastActive(lastSeen)}
                    </p>
                  </div>
                </div>

                <div className="user-info-card">
                  <div className="user-info-card-icon emotion">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="12" cy="12" r="10"></circle>
                      <path d="M8 14s1.5 2 4 2 4-2 4-2"></path>
                      <line x1="9" y1="9" x2="9.01" y2="9"></line>
                      <line x1="15" y1="9" x2="15.01" y2="9"></line>
                    </svg>
                  </div>
                  <div className="user-info-card-content">
                    <h3 className="user-info-card-label">Current Emotion</h3>
                    <p className="user-info-card-value emotion-value">
                      {getUserEmotion()}
                    </p>
                  </div>
                </div>

                <div className="user-info-card">
                  <div className="user-info-card-icon action">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
                    </svg>
                  </div>
                  <div className="user-info-card-content">
                    <h3 className="user-info-card-label">Last Action</h3>
                    <p className="user-info-card-value">{getLastAction()}</p>
                  </div>
                </div>
              </div>

              <div className="user-info-footer">
                <button
                  className="user-info-action-btn primary"
                  onClick={() => {
                    setIsUserInfoModalOpen(false);
                    window.location.href = `/profile/${friendId}`;
                  }}
                >
                  View Full Profile
                </button>
                <button
                  className="user-info-action-btn secondary"
                  onClick={() => setIsUserInfoModalOpen(false)}
                >
                  Close
                </button>
              </div>
            </>
          )}
        </div>
      </ModalContainer>

      {/* Live Voice Modal */}
      <LiveVoiceModal
        isOpen={isLiveVoiceModalOpen}
        onClose={() => setIsLiveVoiceModalOpen(false)}
        isActive={isLiveVoiceActive}
        duration={liveVoiceDuration}
        isConnecting={false}
        role={isLiveVoiceActive ? "publisher" : "receiver"}
        friendName={
          friendProfile?.fullName || friendProfile?.user?.firstName || "Friend"
        }
        onStop={handleLiveVoiceButtonClick}
      />
    </div>
  );
};

export default StickyChatBox;
