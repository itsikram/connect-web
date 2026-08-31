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
import { fetchOnlineStatusesCached, fetchProfileCached } from "../../utils/requestCache";
import socket from "../../common/socket";
import { sendBumpToFriend } from "../../utils/sendBump";
import { newMessage, seenMessage } from "../../services/actions/messageActions";
import SingleMessage from "./SingleMessage";
import ChatHeader from "./ChatHeader";
import StickyChatFooter from "./StickyChatFooter";
import SingleMsgSkleton from "../../skletons/message/SingleMsgSkleton";
import ModalContainer from "../modal/ModalContainer";
import useIsMobile from "../../utils/useIsMobile";
import "./StickyChatBox.css";
import "../../pages/Message.css";
import "./UserInfoModal.css";
import {
  emitChatMessage,
  idOf,
  isConversationMessage,
  mergeHistoryWithLive,
  upsertConfirmedMessage,
} from "../../utils/optimisticMessage";

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
  const [emotion, setEmotion] = useState(false);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [unreadWhileScrolled, setUnreadWhileScrolled] = useState(0);
  const [isInitialMsgLoading, setIsInitialMsgLoading] = useState(true);
  const [isWindowFocused, setIsWindowFocused] = useState(() => {
    if (typeof document === "undefined") return true;
    return document.visibilityState === "visible" && document.hasFocus();
  });
  const [isChatFocused, setIsChatFocused] = useState(false);

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
  const pendingFollowLatestRef = useRef(false);
  const messagesRef = useRef(messages);
  const loadingOlderRef = useRef(false);
  const typingTimeoutRef = useRef(null);
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const stickyRootRef = useRef(null);
  const [map, setMap] = useState(null);
  const [mapLoading, setMapLoading] = useState(false);

  const canMarkAsSeen = !isMinimized && isChatFocused && isWindowFocused;
  const hasUnseenMessages = unreadWhileScrolled > 0;

  // Track browser window/tab focus so read receipts only fire when the user can
  // actually view the conversation.
  useEffect(() => {
    if (typeof document === "undefined") return undefined;

    const syncWindowFocus = () => {
      setIsWindowFocused(
        document.visibilityState === "visible" && document.hasFocus(),
      );
    };

    syncWindowFocus();
    window.addEventListener("focus", syncWindowFocus);
    window.addEventListener("blur", syncWindowFocus);
    document.addEventListener("visibilitychange", syncWindowFocus);

    return () => {
      window.removeEventListener("focus", syncWindowFocus);
      window.removeEventListener("blur", syncWindowFocus);
      document.removeEventListener("visibilitychange", syncWindowFocus);
    };
  }, []);

  // Sticky chat becomes "focused" only after an explicit click/tap on the box.
  useEffect(() => {
    if (isMinimized) {
      setIsChatFocused(false);
      return undefined;
    }

    const handlePointerDown = (event) => {
      const root = stickyRootRef.current;
      if (!root) return;
      const clickedInsideRoot = root.contains(event.target);
      const clickedInsideMenu = !!optionsMenuRef.current?.contains(
        event.target,
      );
      setIsChatFocused(clickedInsideRoot || clickedInsideMenu);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown, {
      passive: true,
    });

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [isMinimized]);

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
      const statuses = await fetchOnlineStatusesCached([profileId], { ttlMs: 30000 });
      return Boolean(statuses[profileId]?.isActive);
    } catch (error) {
      console.error("Error checking online status:", error);
      return false;
    }
  };

  // WebSocket-based message sending with optimistic UI
  const sendMessage = async (messageData) => {
    const tempId = `temp-${Date.now()}-${Math.random()}`;
    const optimisticMessage = {
      _id: tempId,
      tempId,
      senderId: userId,
      receiverId: friendId,
      message: messageData.message,
      attachment: messageData.attachment,
      parent: messageData.parent,
      messageType: messageData.messageType || "text",
      timestamp: new Date(),
      isOptimistic: true,
    };

    const payload = { ...messageData, tempId };

    setMessages((prevMessages) => {
      const existingIds = new Set(
        prevMessages.map((m) => m?._id?.toString()).filter(Boolean),
      );
      if (!existingIds.has(optimisticMessage._id?.toString())) {
        return [...prevMessages.filter(Boolean), optimisticMessage];
      }
      return prevMessages;
    });

    emitChatMessage(optimisticMessage);
    dispatch(newMessage(optimisticMessage, userId));

    isNearBottomRef.current = true;
    setShowScrollToBottom(false);
    setUnreadWhileScrolled(0);
    scrollToLastMessage("smooth");

    return new Promise((resolve, reject) => {
      let settled = false;

      const fallbackTimeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        setMessages((prev) =>
          prev.map((msg) =>
            msg && (msg._id === tempId || msg.tempId === tempId) && msg.isOptimistic
              ? { ...msg, sendFailed: true }
              : msg,
          ),
        );
        console.warn("StickyChatBox message not confirmed by server within timeout");
        resolve(null);
      }, 10000);

      const finish = (err, updatedMessage) => {
        if (settled) return;
        settled = true;
        clearTimeout(fallbackTimeout);
        if (err) {
          setMessages((prev) =>
            prev.filter(
              (msg) => msg && msg._id !== tempId && msg.tempId !== tempId,
            ),
          );
          reject(err);
          return;
        }
        if (updatedMessage?._id) {
          setMessages((prev) =>
            upsertConfirmedMessage(prev, updatedMessage, tempId),
          );
          emitChatMessage(updatedMessage);
          dispatch(newMessage(updatedMessage, userId));
        }
        resolve(updatedMessage);
      };

      try {
        socket.emit("sendMessage", payload, (response) => {
          if (!response) return;
          if (response.ok === false || response.blocked) {
            finish(
              new Error(response.reason || response.error || "Message blocked"),
            );
            return;
          }
          if (response.updatedMessage) {
            finish(null, response.updatedMessage);
          }
        });
      } catch (error) {
        console.error(
          "StickyChatBox error sending message via WebSocket:",
          error,
        );
        finish(error);
      }
    });
  };

  // Mark only the last message as seen
  const markMessageAsSeen = async (message) => {
    try {
      if (!message || !message._id) {
        console.warn(
          "Cannot mark message as seen - message or _id is missing:",
          message,
        );
        return;
      }

      console.log("📤 Marking message as seen:", { messageId: message._id });
      const response = await api.post("/message/seen", {
        messageId: message._id,
      });
      console.log("✅ Message marked as seen:", response.data);
    } catch (error) {
      console.error(
        "Error marking message as seen:",
        error?.response?.data || error?.message || error,
      );
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

    if (friendProfile?.isActive) {
      setIsActive(true);
    }

    const checkStatus = async () => {
      const isOnline = await checkOnlineStatus(friendId);
      setIsActive(isOnline);

      if (!isOnline) {
        const now = moment();
        setLastSeen(now.format("hh:mm A"));
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 90000);

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
    setShowOptionsMenu(false);
    if (isUserInfoModalOpen) {
      setIsUserInfoModalOpen(false);
      return;
    }
    setIsUserInfoModalOpen(true);
    setLoadingUserInfo(true);
    try {
      const profileData = await fetchProfileCached(friendId, {
        ttlMs: 60000,
        storageTtlMs: 300000,
      });
      if (profileData) {
        setUserInfoData(profileData);
        if (
          profileData?.lastLocation?.latitude &&
          profileData?.lastLocation?.longitude
        ) {
          setFriendLocation({
            latitude: profileData.lastLocation.latitude,
            longitude: profileData.lastLocation.longitude,
            timestamp: profileData.lastLocation.timestamp || Date.now(),
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

  useEffect(() => {
    const onLiveVoiceStatus = (event) => {
      const { active, peerId } = event.detail || {};
      const isThisChat =
        !peerId || !friendId || String(peerId) === String(friendId);
      if (!isThisChat) {
        setIsLiveVoiceActive(false);
        return;
      }
      setIsLiveVoiceActive(!!active);
    };

    window.addEventListener("liveVoiceStatus", onLiveVoiceStatus);
    return () => {
      window.removeEventListener("liveVoiceStatus", onLiveVoiceStatus);
    };
  }, [friendId]);

  const handleLiveVoiceButtonClick = () => {
    if (!friendId || !room) return;

    if (isLiveVoiceActive) {
      window.dispatchEvent(new CustomEvent("stopLiveVoice"));
      return;
    }

    const friendName =
      friendProfile?.fullName || friendProfile?.user?.firstName || "Friend";

    window.dispatchEvent(
      new CustomEvent("startLiveVoice", {
        detail: {
          to: String(friendId),
          channelName: room,
          friendName,
        },
      }),
    );
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
          setMessages((prev) =>
            mergeHistoryWithLive(deduplicated, prev),
          );
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
      if (!updatedMessage?._id) return;

      pendingFollowLatestRef.current = true;
      isNearBottomRef.current = true;

      setMessages((prevMessages) =>
        upsertConfirmedMessage(
          prevMessages,
          updatedMessage,
          updatedMessage.tempId,
        ),
      );
      emitChatMessage(updatedMessage);
      dispatch(newMessage(updatedMessage, userId));

      if (idOf(updatedMessage.senderId) === idOf(friendId)) {
        setIsActive(true);
      }
    };

    const handleNewMessage = (data) => {
      if (
        data?.updatedMessage &&
        isConversationMessage(data.updatedMessage, userId, friendId)
      ) {
        appendIncomingMessage(data.updatedMessage);
      }
    };

    const handleNewMessageToUser = (data) => {
      if (
        data?.updatedMessage &&
        isConversationMessage(data.updatedMessage, userId, friendId)
      ) {
        appendIncomingMessage(data.updatedMessage);
      }
    };

    const handleMessageSent = (data) => {
      if (
        data?.updatedMessage &&
        isConversationMessage(data.updatedMessage, userId, friendId)
      ) {
        appendIncomingMessage(data.updatedMessage);
      }
    };

    const handleTyping = (data = {}) => {
      if (String(data?.receiverId) !== String(userId)) return;

      if (data?.isTyping) {
        setIsTyping(true);
        setTypeMessage(typeof data?.type === "string" ? data.type : "");

        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
        typingTimeoutRef.current = setTimeout(() => {
          setIsTyping(false);
          setTypeMessage("");
        }, 1800);
      } else {
        setIsTyping(false);
        setTypeMessage("");
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = null;
        }
      }
    };

    const handleMessageSeen = (data) => {
      const seenId = data?.messageId || data?._id;
      if (!seenId) return;
      setMessages((prevMessages) =>
        prevMessages.map((msg) => {
          if (!msg) return msg;
          if (idOf(msg._id) === idOf(seenId)) {
            return { ...msg, isSeen: true };
          }
          if (idOf(msg.senderId) === idOf(userId) && msg.isSeen !== true) {
            return { ...msg, isSeen: true };
          }
          return msg;
        }),
      );
    };

    socket.on("newMessage", handleNewMessage);
    socket.on("newMessageToUser", handleNewMessageToUser);
    socket.on("messageSent", handleMessageSent);
    socket.on("typing", handleTyping);
    socket.on("messageSeen", handleMessageSeen);
    socket.on("seenMessage", handleMessageSeen);

    const rejoinRoom = () => {
      socket.emit("joinRoom", roomId);
    };
    socket.on("connect", rejoinRoom);

    return () => {
      socket.off("newMessage", handleNewMessage);
      socket.off("newMessageToUser", handleNewMessageToUser);
      socket.off("messageSent", handleMessageSent);
      socket.off("typing", handleTyping);
      socket.off("messageSeen", handleMessageSeen);
      socket.off("seenMessage", handleMessageSeen);
      socket.off("connect", rejoinRoom);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      socket.emit("leaveRoom", roomId);
    };
  }, [
    friendId,
    userId,
    isLoading,
  ]);

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
    if (!canMarkAsSeen || isLoading || !friendId) return;
    dispatch(seenMessage(friendId));
  }, [friendId, canMarkAsSeen, isLoading, dispatch]);

  // Mark messages as seen - HTTP-based. Only runs while the chat is actually
  // visible (not minimized), so we never mark a message as read before the
  // user has had a chance to see it.
  useEffect(() => {
    if (!canMarkAsSeen) return;
    if (messages.length > 0 && friendId && friendProfile?._id) {
      const timeoutId = setTimeout(() => {
        const lastMessage = messages[messages.length - 1];
        if (
          lastMessage &&
          String(lastMessage.senderId) !== String(userId) &&
          String(lastMessage.senderId) === String(friendId) &&
          !lastMessage.isSeen
        ) {
          console.log("⏱️ Auto-marking last message as seen:", {
            lastMessage: lastMessage._id,
            sender: lastMessage.senderId,
          });
          markMessageAsSeen(lastMessage);
          dispatch(seenMessage(friendId));
        } else if (lastMessage) {
          console.log("⏭️ Skipping mark as seen:", {
            hasSender: !!lastMessage.senderId,
            senderIsUser: String(lastMessage.senderId) === String(userId),
            isSeen: lastMessage.isSeen,
          });
        }
      }, 300);
      return () => clearTimeout(timeoutId);
    }
  }, [messages, friendId, friendProfile, userId, canMarkAsSeen, dispatch]);

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

    requestAnimationFrame(() => {
      doScroll();
      requestAnimationFrame(doScroll);
    });
  }, []);

  useLayoutEffect(() => {
    if (pendingScrollRestoreRef.current) return;
    if (!pendingFollowLatestRef.current) return;
    pendingFollowLatestRef.current = false;
    scrollToLastMessage("smooth");
  }, [messages, scrollToLastMessage]);

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

  // Keep typing indicator visible while friend is typing.
  useEffect(() => {
    if (isMinimized || isLoading || !isTyping) return;
    scrollToLastMessage("smooth");
  }, [isTyping, typeMessage, isMinimized, isLoading, scrollToLastMessage]);

  const footerProps = {
    room,
    friendId,
    setIsTyping,
    userId,
    replyData,
    setReplyData,
    setIsReplying,
    messages,
    friendProfile,
    msgListRef,
    isAi: false,
    sendMessage,
  };

  if (isMinimized) {
    return (
      <div
        className="sticky-chat-box minimized"
        style={{
          zIndex,
          border: hasUnseenMessages ? "1px solid #00D4FF" : undefined,
          boxShadow: hasUnseenMessages
            ? "0 0 0 1px rgba(0, 212, 255, 0.35), 0 10px 24px rgba(0, 212, 255, 0.25)"
            : undefined,
        }}
      >
        <div
          className="sticky-chat-minimized-header"
          onClick={() => {
            setIsChatFocused(true);
            onMinimize();
          }}
        >
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
                setIsChatFocused(true);
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
    <div
      ref={stickyRootRef}
      className="sticky-chat-box"
      style={{
        zIndex,
        border: hasUnseenMessages ? "1px solid #00D4FF" : undefined,
        boxShadow: hasUnseenMessages
          ? "0 0 0 1px rgba(0, 212, 255, 0.35), 0 10px 24px rgba(0, 212, 255, 0.25)"
          : undefined,
      }}
    >
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
              type="button"
              className="sticky-chat-action-btn"
              onClick={() => setShowOptionsMenu((prev) => !prev)}
              title="More options"
              aria-label="More options"
              aria-expanded={showOptionsMenu}
              aria-haspopup="true"
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
              type="button"
              onClick={async () => {
                try {
                  await sendBumpToFriend(friendId, userId);
                } catch (error) {
                  console.error("Error sending bump:", error);
                }
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
      {isUserInfoModalOpen && (
      <ModalContainer
        title="User Information"
        isOpen
        onRequestClose={() => setIsUserInfoModalOpen(false)}
        id="stickyUserInfoModal"
        className="is-flush"
      >
        <div className="modal-header">
          <h3 className="modal-title">User Information</h3>
          <button
            type="button"
            className="modal-close-btn"
            onClick={() => setIsUserInfoModalOpen(false)}
            aria-label="Close"
          >
            <i className="far fa-times" aria-hidden="true" />
          </button>
        </div>
        <div className="modal-body">
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
                  <div className="user-info-card user-info-card--map">
                    <div
                      ref={mapRef}
                      className="user-info-map"
                    />
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
            </>
          )}
        </div>
        </div>
        {!loadingUserInfo && (
          <div className="user-info-footer">
            <button
              type="button"
              className="user-info-action-btn primary"
              onClick={() => {
                setIsUserInfoModalOpen(false);
                window.location.href = `/profile/${friendId}`;
              }}
            >
              View Full Profile
            </button>
            <button
              type="button"
              className="user-info-action-btn secondary"
              onClick={() => setIsUserInfoModalOpen(false)}
            >
              Close
            </button>
          </div>
        )}
      </ModalContainer>
      )}

    </div>
  );
};

export default StickyChatBox;
