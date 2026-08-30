import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useState,
  useRef,
} from "react";
import { setLoading } from "../services/actions/optionAction";
import { useDispatch, useSelector } from "react-redux";
import { useParams } from "react-router-dom";
import api from "../api/api";
import socket from "../common/socket";
import UserPP from "../components/UserPP";
import { fetchProfileCached } from "../utils/requestCache";
import moment from "moment";
import SingleMessage from "../components/Message/SingleMessage";
import $ from "jquery";
import { newMessage, seenMessage } from "../services/actions/messageActions";
import ChatHeader from "../components/Message/ChatHeader";
import ChatFooter from "../components/Message/ChatFooter";
import SingleMsgSkleton from "../skletons/message/SingleMsgSkleton";
import defaultChatBackground from "../assets/images/default-chat-bg.svg";
import MessageCacheManager from "../utils/messageCacheManager";
import {
  emitChatMessage,
  idOf,
  isConversationMessage,
  mergeHistoryWithLive,
  upsertConfirmedMessage,
} from "../utils/optimisticMessage";

const NEAR_BOTTOM_PX = 100;

// Function to calculate image brightness
const getImageBrightness = async (imageUrl) => {
  return new Promise((resolve) => {
    try {
      if (!imageUrl) {
        resolve(128);
        return;
      }
      const img = new Image();
      img.crossOrigin = "Anonymous";
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          const maxSize = 100;
          const width = Math.min(img.width, maxSize);
          const height = Math.min(img.height, maxSize);
          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(img, 0, 0, width, height);
          const imageData = ctx.getImageData(0, 0, width, height);
          const data = imageData.data;
          let totalBrightness = 0;
          const pixelCount = data.length / 4;
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
            totalBrightness += brightness;
          }
          const averageBrightness = totalBrightness / pixelCount;
          resolve(averageBrightness);
        } catch (error) {
          resolve(128);
        }
      };
      img.onerror = () => resolve(128);
      img.src = imageUrl;
    } catch (error) {
      resolve(128);
    }
  });
};

const Chat = () => {
  const dispatch = useDispatch();
  const profile = useSelector((state) => state.profile);
  const settings = useSelector((state) => state.setting);
  const userId = profile._id;
  const [friendProfile, setFriendProfile] = useState({});
  const [isBlockedMe, setIsBlockedMe] = useState(false);
  const [lastSeen, setLastSeen] = useState(false);
  const [isDarkBackground, setIsDarkBackground] = useState(false);

  const [room, setRoom] = useState("");
  const [isActive, setIsActive] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  const [isPreview, setIsPreview] = useState(false);
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isMsgLoading, setIsMsgLoading] = useState(false);
  const [isLoadingOlderMessages, setIsLoadingOlderMessages] = useState(false);
  const [typeMessage, setTypeMessage] = useState("");
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [isWindowFocused, setIsWindowFocused] = useState(() => {
    if (typeof document === "undefined") return true;
    return document.visibilityState === "visible" && document.hasFocus();
  });
  // Default as "at bottom" so load-older logic does not run until the user scrolls (real % from handler).
  const [scrollPercent, setScrollPercent] = useState(100);
  const [replyData, setReplyData] = useState({ messageId: null, body: null });
  const msgListRef = useRef(null);
  const messageInput = useRef(null);
  const chatHeader = useRef(null);
  const chatFooter = useRef(null);
  const isNearBottomRef = useRef(true);
  const pendingScrollRestoreRef = useRef(null);
  const pendingFollowLatestRef = useRef(false);
  const hasInitialScrolledRef = useRef(false);
  const hasLoadedFreshMessagesRef = useRef(false);
  const isMsgLoadingRef = useRef(false);
  const typingTimeoutRef = useRef(null);

  const chatNewAttachment = useRef(null);
  const messageActionButtonContainer = useRef(null);

  const getDistanceFromBottom = useCallback((el) => {
    if (!el) return 0;
    return el.scrollHeight - el.scrollTop - el.clientHeight;
  }, []);

  const checkIsNearBottom = useCallback(
    (el, threshold = NEAR_BOTTOM_PX) => {
      if (!el) return true;
      return getDistanceFromBottom(el) <= threshold;
    },
    [getDistanceFromBottom],
  );

  const params = useParams();
  const friendId = params.profile;
  const canMarkAsSeen =
    isWindowFocused &&
    (typeof document === "undefined" || document.visibilityState === "visible");

  const scrollToLastMessage = useCallback((behavior = "smooth") => {
    const el = msgListRef.current;
    if (!el) return;

    const doScroll = () => {
      const list = msgListRef.current;
      if (!list) return;
      list.scrollTo({
        top: list.scrollHeight,
        behavior,
      });
      isNearBottomRef.current = true;
      setScrollPercent(100);
    };

    // Wait until the new bubble is laid out before scrolling.
    requestAnimationFrame(() => {
      doScroll();
      requestAnimationFrame(doScroll);
    });
  }, []);

  useEffect(() => {
    isMsgLoadingRef.current = isMsgLoading;
  }, [isMsgLoading]);

  // Keep chat read receipts tied to actual window focus/visibility.
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

  // Persist conversation changes after fresh data has been loaded once.
  useEffect(() => {
    if (!hasLoadedFreshMessagesRef.current || !userId || !friendId) return;
    MessageCacheManager.setCachedMessages(
      userId,
      friendId,
      messages.filter((m) => m && m._id && !m.isOptimistic),
    );
  }, [messages, userId, friendId]);

  const fetchChatHistory = useCallback(
    async (profileId, friendIdArg, limit = 20) => {
      try {
        const response = await api.get("/message/getChatHistory", {
          params: {
            profileId,
            friendId: friendIdArg,
            limit,
          },
        });

        const messages = Array.isArray(response?.data?.messages)
          ? response.data.messages
          : [];
        const hasMore =
          typeof response?.data?.hasMore === "boolean"
            ? response.data.hasMore
            : messages.length >= limit;

        // Cache the fetched messages
        if (messages.length > 0) {
          MessageCacheManager.setCachedMessages(
            profileId,
            friendIdArg,
            messages,
          );
          console.log("📦 Updated message cache for conversation");
        }

        return { messages, hasMore };
      } catch (error) {
        console.error("Error fetching messages:", error);
        return { messages: [], hasMore: false };
      }
    },
    [],
  );

  const fetchOldMessages = useCallback(
    async (profileId, friendIdArg, beforeTimestamp, limit = 20) => {
      if (!beforeTimestamp) {
        return { messages: [], hasMore: false };
      }
      try {
        const response = await api.get("/message/getOldMessages", {
          params: {
            profileId,
            friendId: friendIdArg,
            beforeTimestamp,
            limit,
          },
        });

        const messages = Array.isArray(response?.data?.messages)
          ? response.data.messages
          : [];
        const hasMore =
          typeof response?.data?.hasMore === "boolean"
            ? response.data.hasMore
            : messages.length >= limit;

        return { messages, hasMore };
      } catch (error) {
        console.error("Error fetching old messages:", error);
        return { messages: [], hasMore: false };
      }
    },
    [],
  );

  // Load cached messages on chat open if available
  useEffect(() => {
    if (userId && friendId) {
      const cachedMessages = MessageCacheManager.getCachedMessages(
        userId,
        friendId,
      );
      if (cachedMessages && cachedMessages.length > 0) {
        setMessages(cachedMessages);
        console.log("📦 Loaded messages from cache:", cachedMessages.length);
        setIsMsgLoading(false);
      }
    }
  }, [userId, friendId]);

  useEffect(() => {
    if (!friendId || !canMarkAsSeen) return;
    dispatch(seenMessage(friendId));
  }, [friendId, canMarkAsSeen, dispatch]);

  useEffect(() => {
    const handleScroll = () => {
      const el = msgListRef.current;
      if (!el) return;
      const scrollTop = el.scrollTop;
      const maxScroll = el.scrollHeight - el.clientHeight;
      isNearBottomRef.current = checkIsNearBottom(el);
      if (maxScroll <= 0) {
        setScrollPercent(100);
        return;
      }
      setScrollPercent((scrollTop / maxScroll) * 100);
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
  }, [friendId, checkIsNearBottom]);

  const messagesRef = useRef(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const loadingOlderRef = useRef(false);

  // Keep viewport anchored when older messages are prepended.
  useLayoutEffect(() => {
    const restore = pendingScrollRestoreRef.current;
    const el = msgListRef.current;
    if (!restore || !el) return;
    el.scrollTop = restore.prevTop + (el.scrollHeight - restore.prevHeight);
    pendingScrollRestoreRef.current = null;
    isNearBottomRef.current = checkIsNearBottom(el);
  }, [messages, checkIsNearBottom]);

  // After a realtime message is painted, jump to it.
  useLayoutEffect(() => {
    if (pendingScrollRestoreRef.current) return;
    if (!pendingFollowLatestRef.current) return;
    pendingFollowLatestRef.current = false;
    scrollToLastMessage("smooth");
  }, [messages, scrollToLastMessage]);

  useEffect(() => {
    if (!friendId || !userId || !hasMoreMessages) return;
    if (scrollPercent >= 30 || !Number.isFinite(scrollPercent)) return;
    const skip = messagesRef.current.length;
    if (skip === 0) return;
    if (loadingOlderRef.current || isMsgLoadingRef.current) return;

    const oldestMessage = messagesRef.current[0];
    const beforeTimestamp =
      oldestMessage?.timestamp || oldestMessage?.createdAt;
    if (!beforeTimestamp) return;

    loadingOlderRef.current = true;
    setIsLoadingOlderMessages(true);
    (async () => {
      setIsMsgLoading(true);
      try {
        const response = await fetchOldMessages(
          userId,
          friendId,
          beforeTimestamp,
          20,
        );
        const older = response.messages || [];
        if (older.length === 0) {
          setHasMoreMessages(false);
          return;
        }
        // Capture just before prepend so socket updates during fetch cannot corrupt restore.
        const el = msgListRef.current;
        if (el) {
          pendingScrollRestoreRef.current = {
            prevHeight: el.scrollHeight,
            prevTop: el.scrollTop,
          };
        }
        setMessages((prev) => [...older, ...prev]);
        setHasMoreMessages(response.hasMore);
      } catch (error) {
        pendingScrollRestoreRef.current = null;
        console.error("Error loading older messages:", error);
      } finally {
        loadingOlderRef.current = false;
        setIsLoadingOlderMessages(false);
        setIsMsgLoading(false);
      }
    })();
    // Intentionally omit isMsgLoading: when it flips false, deps would match again and load every page in one burst.
  }, [scrollPercent, hasMoreMessages, userId, friendId, fetchOldMessages]);

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

    setMessages((prev) => [...prev.filter(Boolean), optimisticMessage]);
    emitChatMessage(optimisticMessage);
    dispatch(newMessage(optimisticMessage, userId));
    scrollToLastMessage("smooth");

    const applyConfirmed = (updatedMessage) => {
      if (!updatedMessage?._id) return;
      setMessages((prev) =>
        upsertConfirmedMessage(prev, updatedMessage, tempId),
      );
      emitChatMessage(updatedMessage);
      dispatch(newMessage(updatedMessage, userId));
    };

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
        console.warn("Message not confirmed by server within timeout");
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
        applyConfirmed(updatedMessage);
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
        console.error("Error sending message via WebSocket:", error);
        finish(error);
      }
    });
  };

  // Mark all unseen messages from friend as seen
  const markMessageAsSeen = useCallback(async () => {
    try {
      if (!canMarkAsSeen) return;

      // Get all unseen messages from the friend in this conversation
      const unseenMessageIds = messages
        .filter(
          (msg) =>
            msg && String(msg.senderId) === String(friendId) && !msg.isSeen,
        )
        .map((msg) => msg?._id)
        .filter(Boolean);

      if (unseenMessageIds.length === 0) return;

      // Mark all unseen messages as seen
      await api.post("/message/seen", { messageIds: unseenMessageIds });

      // Update local state to mark them as seen
      const unseenIdSet = new Set(unseenMessageIds.map((id) => String(id)));
      setMessages((prevMessages) =>
        prevMessages.map((msg) =>
          unseenIdSet.has(String(msg?._id)) ? { ...msg, isSeen: true } : msg,
        ),
      );
    } catch (error) {
      console.error("Error marking messages as seen:", error);
    }
  }, [messages, friendId, canMarkAsSeen]);

  // Real-time socket listeners for new messages
  useEffect(() => {
    if (!friendId || !userId) return;

    // Join the chat room
    const roomId = [userId, friendId].sort().join("_");
    socket.emit("joinRoom", roomId);

    const appendIncomingMessage = (updatedMessage) => {
      if (!updatedMessage?._id) return;

      pendingFollowLatestRef.current = true;
      isNearBottomRef.current = true;

      setMessages((prev) =>
        upsertConfirmedMessage(prev, updatedMessage, updatedMessage.tempId),
      );
      emitChatMessage(updatedMessage);
      dispatch(newMessage(updatedMessage, userId));
    };

    // Listen for new messages in this room
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
      setMessages((prev) =>
        prev.map((msg) => {
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

    const handleDeleteMessage = (deletedMessageId) => {
      setMessages((prev) =>
        prev.filter((msg) => String(msg._id) !== String(deletedMessageId)),
      );
    };

    socket.on("newMessage", handleNewMessage);
    socket.on("newMessageToUser", handleNewMessageToUser);
    socket.on("messageSent", handleMessageSent);
    socket.on("typing", handleTyping);
    socket.on("messageSeen", handleMessageSeen);
    socket.on("seenMessage", handleMessageSeen);
    socket.on("deleteMessage", handleDeleteMessage);

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
      socket.off("deleteMessage", handleDeleteMessage);
      socket.off("connect", rejoinRoom);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      socket.emit("leaveRoom", roomId);
    };
  }, [friendId, userId, scrollToLastMessage, dispatch]);

  // Get online status from contacts data (no separate API calls)
  const getOnlineStatusFromContacts = useCallback(
    function () {
      // Try to get online status from localStorage or Redux store if available
      try {
        const scopedContactsKey = userId ? `contactsData_${userId}` : null;
        const contactsData =
          (scopedContactsKey && localStorage.getItem(scopedContactsKey)) ||
          localStorage.getItem("contactsData");

        if (contactsData) {
          const contacts = JSON.parse(contactsData);
          const friendContact = contacts.find(
            (c) => c.person?._id === friendId,
          );
          if (friendContact) {
            return {
              isActive: friendContact.isOnline || false,
              lastSeen: friendContact.lastSeen || null,
            };
          }
        }
      } catch (error) {
        console.error("Error getting online status from contacts:", error);
      }
      return { isActive: false, lastSeen: null };
    },
    [friendId, userId],
  );

  useEffect(
    function () {
      if (!friendId || !userId) return;

      const setOnlineStatus = function () {
        const statusData = getOnlineStatusFromContacts();
        setIsActive(statusData.isActive);

        if (statusData.lastSeen) {
          const lastSeenTimeStamp = moment(statusData.lastSeen);
          const currentTimeStamp = moment(Date.now());
          const diffDays = currentTimeStamp.diff(lastSeenTimeStamp, "days");

          let formattedTime;
          if (diffDays === 0) {
            formattedTime = lastSeenTimeStamp.format("hh:mm A");
          } else if (diffDays > 365) {
            formattedTime = lastSeenTimeStamp.format("MM/YY hh:mm A");
          } else {
            formattedTime = lastSeenTimeStamp.format("DD/MM hh:mm A");
          }

          setLastSeen(formattedTime);
        }
      };

      setOnlineStatus();

      // Refresh online status every 2 minutes (aligned with contacts refresh)
      const statusInterval = setInterval(setOnlineStatus, 120000);

      return function () {
        clearInterval(statusInterval);
      };
    },
    [friendId, userId, getOnlineStatusFromContacts],
  );

  useEffect(
    function () {
      if (!friendId) return;

      let isCancelled = false;
      // Prevent stale header avatar while profile is loading for a new route.
      setFriendProfile({ _id: friendId, profilePic: "" });

      const loadProfile = async () => {
        try {
          let profileData = await fetchProfileCached(friendId, {
            ttlMs: 60000,
            storageTtlMs: 300000,
          });

          // If cached data is partial/missing, force a fresh profile fetch.
          if (!profileData || !profileData._id) {
            profileData = await fetchProfileCached(friendId, {
              ttlMs: 60000,
              storageTtlMs: 300000,
              forceRefresh: true,
            });
          }

          if (isCancelled) return;

          if (profileData && profileData._id) {
            setFriendProfile(profileData);
          } else {
            setFriendProfile((prev) => ({
              ...(prev || {}),
              _id: friendId,
              profilePic: prev?.profilePic || "",
            }));
          }
          dispatch(setLoading(false));
        } catch (e) {
          if (isCancelled) return;
          setFriendProfile((prev) => ({
            ...(prev || {}),
            _id: friendId,
            profilePic: prev?.profilePic || "",
          }));
          console.log(e);
        }
      };

      loadProfile();

      return function () {
        isCancelled = true;
      };
    },
    [friendId, dispatch],
  );

  useEffect(
    function () {
      if (friendProfile && profile._id) {
        setIsBlockedMe(
          friendProfile.blockedUsers
            ? friendProfile.blockedUsers.includes(profile._id)
            : false,
        );
      }
    },
    [friendProfile, profile._id],
  );

  useEffect(
    function () {
      if (!friendId || !userId) return;
      setRoom([userId, friendId].sort().join("_"));
      hasLoadedFreshMessagesRef.current = false;
      setMessages([]);
      setHasMoreMessages(true);
      setScrollPercent(100);
      loadingOlderRef.current = false;
      hasInitialScrolledRef.current = false;
      pendingScrollRestoreRef.current = null;
      isNearBottomRef.current = true;

      const fetchInitialMessages = async function () {
        setIsMsgLoading(true);
        try {
          const response = await fetchChatHistory(userId, friendId, 20);

          if (response.messages) {
            setMessages((prev) =>
              mergeHistoryWithLive(response.messages, prev),
            );
            setHasMoreMessages(response.hasMore ?? false);
            hasLoadedFreshMessagesRef.current = true;
          } else {
            setMessages([]);
            setHasMoreMessages(false);
          }
        } catch (error) {
          console.error("Error fetching initial messages:", error);
          setMessages([]);
          setHasMoreMessages(false);
          hasLoadedFreshMessagesRef.current = true;
        } finally {
          setIsMsgLoading(false);
        }
      };

      fetchInitialMessages();
    },
    [friendId, userId, fetchChatHistory],
  );

  // Scroll once after the first batch of messages for a chat is rendered.
  useLayoutEffect(() => {
    if (hasInitialScrolledRef.current) return;
    if (!friendId || messages.length === 0 || isMsgLoading) return;
    hasInitialScrolledRef.current = true;
    scrollToLastMessage("auto");
  }, [friendId, messages.length, isMsgLoading, scrollToLastMessage]);

  // Keep typing indicator visible while the other person is typing.
  useEffect(() => {
    if (!isTyping) return;
    scrollToLastMessage("smooth");
  }, [isTyping, typeMessage, scrollToLastMessage]);

  useEffect(() => {
    if (!canMarkAsSeen) return;
    if (messages.length > 0 && friendId && friendProfile?._id) {
      const t = setTimeout(() => {
        // Check if there are any unseen messages from the friend
        const hasUnseenFromFriend = messages.some(
          (msg) => String(msg.senderId) === String(friendId) && !msg.isSeen,
        );

        if (hasUnseenFromFriend) {
          markMessageAsSeen();
          dispatch(seenMessage(friendId));

          // Hide all seen status indicators for sent messages
          $(
            "#chatMessageList .message-sent.chat-message-container .chat-message-seen-status",
          ).css("visibility", "hidden");

          // Show seen status for the last sent message
          const lastSentMessage = [...messages]
            .reverse()
            .find((msg) => String(msg.senderId) === String(userId));
          if (lastSentMessage) {
            $(
              "#chatMessageList .message-sent.chat-message-container.message-id-" +
                lastSentMessage._id +
                ":last-child .chat-message-seen-status",
            ).css("visibility", "visible");
          }
        }
      }, 300);
      return () => clearTimeout(t);
    }
  }, [
    messages,
    friendId,
    friendProfile?._id,
    userId,
    dispatch,
    markMessageAsSeen,
    canMarkAsSeen,
  ]);

  const footerProps = {
    chatFooter,
    room,
    friendId,
    setIsTyping,
    setIsReplying,
    isReplying,
    chatNewAttachment,
    messageActionButtonContainer,
    userId,
    messageInput,
    replyData,
    isPreview,
    setIsPreview,
    setReplyData,
    messages,
    friendProfile,
    sendMessage,
    msgListRef,
    scrollToLastMessage,
  };
  const footerSlotRef = useRef(null);

  // Keep message list padded so the last bubble never sits under the pinned composer.
  useLayoutEffect(() => {
    const slot = footerSlotRef.current;
    const box = slot?.closest("#chatBox") || document.getElementById("chatBox");
    if (!slot || !box) return undefined;

    const syncFooterHeight = () => {
      const footerEl = slot.querySelector('[data-chat-footer="true"]') || slot;
      const height = Math.max(
        56,
        Math.ceil(footerEl.getBoundingClientRect().height) || 72,
      );
      box.style.setProperty("--chat-footer-height", `${height}px`);
    };

    syncFooterHeight();
    // Re-measure after fonts/layout settle.
    const raf = requestAnimationFrame(syncFooterHeight);
    const ro =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(syncFooterHeight)
        : null;
    if (ro) ro.observe(slot);
    window.addEventListener("resize", syncFooterHeight);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", syncFooterHeight);
      if (ro) ro.disconnect();
    };
  }, [isBlockedMe, friendId]);

  // Keep the thread anchored at the bottom when the iOS keyboard resizes the chat pane.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return undefined;

    const anchorIfNearBottom = () => {
      if (!document.body.classList.contains("message-page-mobile")) return;
      const el = msgListRef.current;
      if (!el || !isNearBottomRef.current) return;
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight;
      });
    };

    vv.addEventListener("resize", anchorIfNearBottom);
    return () => vv.removeEventListener("resize", anchorIfNearBottom);
  }, [friendId]);

  // Detect if background is dark and apply light text
  useEffect(() => {
    const detectBackgroundBrightness = async () => {
      const backgroundUrl = settings?.chatBackground || defaultChatBackground;
      if (!backgroundUrl) {
        setIsDarkBackground(false);
        return;
      }
      try {
        const brightness = await getImageBrightness(backgroundUrl);
        // If brightness is less than 140 (on a scale of 0-255), consider it dark
        setIsDarkBackground(brightness < 140);
      } catch (error) {
        setIsDarkBackground(false);
      }
    };
    detectBackgroundBrightness();
  }, [settings?.chatBackground]);

  return (
    <div className="message-chat-root">
      <div id="chatBox" className="message-chat-box">
        <div ref={chatHeader} className="chat-header">
          <ChatHeader
            friendProfile={friendProfile}
            friendProfilePic={friendProfile.profilePic}
            friendId={friendId}
            isActive={isActive}
            lastSeen={lastSeen}
            room={room}
          />
        </div>
        <div
          className={`chat-body ${isDarkBackground ? "dark-background" : ""}`}
          style={{
            backgroundImage: `url('${settings?.chatBackground || defaultChatBackground}')`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundAttachment: "fixed",
          }}
        >
          <div
            className="chat-message-list"
            id="chatMessageList"
            ref={msgListRef}
          >
            {messages.length > 0 && isLoadingOlderMessages && (
              <div
                className="chat-load-older-indicator"
                aria-live="polite"
                aria-label="Loading previous messages"
              >
                <div
                  className="spinner-border spinner-border-sm"
                  role="status"
                  aria-hidden="true"
                ></div>
              </div>
            )}

            {messages.length > 0 ? (
              messages.filter(Boolean).map((msg, index) => {
                return (
                  <SingleMessage
                    key={msg._id || `msg-${index}`}
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
                );
              })
            ) : isMsgLoading ? (
              <SingleMsgSkleton count={14} />
            ) : (
              <div className="chat-empty-conversation">
                <div className="chat-empty-avatar">
                  <UserPP
                    profilePic={friendProfile.profilePic}
                    profile={friendProfile._id}
                    active={isActive}
                    size="full"
                  />
                </div>
                <h3 className="chat-empty-name">
                  {friendProfile?.fullName ||
                    `${friendProfile?.user?.firstName || ""} ${friendProfile?.user?.surname || ""}`.trim() ||
                    "This user"}
                </h3>
                <p className="chat-empty-subtitle">
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
                    profilePic={`${friendProfile.profilePic}`}
                    profile={friendProfile._id}
                    active={friendProfile.isActive}
                  ></UserPP>
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
        </div>

        <div
          className="chat-footer-slot"
          ref={footerSlotRef}
          data-chat-footer-slot="true"
        >
          {!isBlockedMe ? (
            <ChatFooter {...footerProps} />
          ) : (
            <div
              ref={chatFooter}
              className="chat-footer modern-composer"
              data-chat-footer="true"
            >
              <p className="text-center text-danger fs-6 mb-0 py-2">
                {friendProfile.fullName} Blocked You
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Chat;
