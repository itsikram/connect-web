import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import "./AIAgentModal.css";
import ChatArea from "./ChatArea";
import ActionPanel from "./ActionPanel";
import ModalHeader from "./ModalHeader";
import {
  sendToGemini,
  translateBanglaToEnglish,
  interpretAgentCommand,
  answerFromAppData,
} from "../../../services/geminiService";
import {
  parseIntent,
  searchFriendsByName,
  getFriendDisplayName,
  getActionResponseMode,
  FRIEND_REQUIRED_ACTIONS,
  NO_FRIEND_ACTIONS,
  findStaticRoute,
} from "./agentIntentParser";
import { executeAction, getActionMeta } from "./agentActions";
import {
  LOOKUP_ACTIONS,
  toAgentIntent,
  resolveCatalogRoute,
  recoverAgentActions,
  extractCaptionFromText,
  isPlaceholderCaption,
} from "./agentCatalog";
import api from "../../../api/api";
import { fetchLatestAIChat, saveAIChat } from "../../../services/aiChatService";

const createId = () => Date.now() + Math.random();

const INITIAL_MESSAGE = {
  id: 1,
  type: "agent",
  content:
    'Hi! I\'m your AI Agent 🤖 Speak or type in Bangla or English. I can open any page, call or message friends, search posts and videos, create notes/tasks/posts, and answer questions about your Connect data.\n\nTry: "go to settings", "what are my latest notes?", "call John", "post I am feeling good"',
  timestamp: new Date(),
};

const buildAppContext = (myProfile) => {
  const friendsRaw = Array.isArray(myProfile?.friends) ? myProfile.friends : [];
  const friends = friendsRaw
    .filter((friend) => friend && typeof friend === "object")
    .slice(0, 40)
    .map((friend) => ({
      name: getFriendDisplayName(friend),
      username: friend.username || friend.user?.username || "",
      banglaName: friend.banglaName || "",
    }));

  return {
    user: {
      name: getFriendDisplayName(myProfile),
      username: myProfile?.username || myProfile?.user?.username || "",
      bio: myProfile?.bio || "",
      friendCount: friendsRaw.length,
    },
    friends,
  };
};

const hydrateIntent = (intent) => {
  if (!intent) return null;
  if (intent.action !== "NAVIGATE" || intent.targetRoute) return intent;
  const found =
    findStaticRoute(intent.label || intent.searchQuery || "") ||
    resolveCatalogRoute(intent.label || intent.searchQuery || "");
  if (!found) return intent;
  return {
    ...intent,
    targetRoute: found.route,
    label: intent.label || found.label,
  };
};

const AUTO_RUN_ACTIONS_STORAGE_KEY = "ai_agent_auto_run_actions";

const getInitialAutoRunActions = () => {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(AUTO_RUN_ACTIONS_STORAGE_KEY) === "true";
  } catch (_) {
    return false;
  }
};

const getSingleMessageAction = (message) => {
  if (message?.type === "friend-picker" && message.friends?.length === 1) {
    return () => message.onAction?.(message.friends[0]);
  }

  if (message?.type === "search-results") {
    if (message.users?.length === 1 && typeof message.onOpenUser === "function") {
      return () => message.onOpenUser(message.users[0]);
    }
    if (message.videos?.length === 1 && typeof message.onPlay === "function") {
      return () => message.onPlay(message.videos[0]);
    }
  }

  if (message?.type === "video-results" && message.videos?.length === 1) {
    return () => message.onPlay?.(message.videos[0]);
  }

  if (message?.actions?.length === 1) {
    const [action] = message.actions;
    const handler = action?.onClick || action?.onAction;
    if (typeof handler === "function") return handler;
  }

  return null;
};

const AIAgentModal = ({ isOpen, onClose }) => {
  const myProfile = useSelector((state) => state.profile);
  const navigate = useNavigate();

  const [messages, setMessages] = useState([INITIAL_MESSAGE]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // closed by default — especially on mobile
  const [autoRunActions, setAutoRunActions] = useState(
    getInitialAutoRunActions,
  );
  const [modalInteractionVersion, setModalInteractionVersion] = useState(0);
  const messagesEndRef = useRef(null);
  const autoRunMessageIdsRef = useRef(new Set());
  const [isFetchingHistory, setIsFetchingHistory] = useState(false);

  // Fetch chat history from database
  const fetchChatHistory = useCallback(async () => {
    setIsFetchingHistory(true);
    try {
      const chatData = await fetchLatestAIChat();
      if (chatData?.messages && Array.isArray(chatData.messages) && chatData.messages.length > 0) {
        // Load existing messages
        setMessages(chatData.messages);
      } else {
        // No previous chat, show initial message
        setMessages([
          { ...INITIAL_MESSAGE, id: createId(), timestamp: new Date() },
        ]);
      }
    } catch (error) {
      console.error("Failed to load chat history:", error);
      // Fallback to initial message on error
      setMessages([
        { ...INITIAL_MESSAGE, id: createId(), timestamp: new Date() },
      ]);
    } finally {
      setIsFetchingHistory(false);
    }
  }, []);

  // Detect mobile to keep sidebar closed by default and fetch chat history
  useEffect(() => {
    if (isOpen) {
      const isMobile = window.innerWidth < 768;
      setIsSidebarOpen(!isMobile);
      setInputValue("");
      setModalInteractionVersion(0);
      
      // Fetch chat history from database
      fetchChatHistory();
    }
  }, [isOpen, fetchChatHistory]);

  // Scroll to latest message
  useEffect(() => {
    // Add a small delay to ensure DOM is updated
    const timer = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
    return () => clearTimeout(timer);
  }, [messages]);



  useEffect(() => {
    try {
      window.localStorage.setItem(
        AUTO_RUN_ACTIONS_STORAGE_KEY,
        String(autoRunActions),
      );
    } catch (_) {}
  }, [autoRunActions]);



  // ── Message helpers ─────────────────────────────────────────────────────────
  const addMessage = useCallback((msg) => {
    setMessages((prev) => [
      ...prev,
      { id: createId(), timestamp: new Date(), ...msg },
    ]);
  }, []);

  // Save messages to database whenever messages change (debounced)
  useEffect(() => {
    // Skip saving if still loading or only initial message
    if (isFetchingHistory || messages.length <= 1) return;
    
    const timer = setTimeout(async () => {
      try {
        await saveAIChat(messages);
      } catch (error) {
        console.error("Failed to save chat to database:", error);
      }
    }, 1500); // Debounce: save after 1.5 seconds of no changes

    return () => clearTimeout(timer);
  }, [messages, isFetchingHistory]);

  // ── Execute after friend resolved ───────────────────────────────────────────
  const handlePlayVideo = useCallback(
    (video) => {
      if (!video?._id) return;
      navigate(`/watch/${video._id}`, { state: { autoplay: true } });
      if (onClose) onClose();
    },
    [navigate, onClose],
  );

  const handleFriendAction = useCallback(
    async (friend, action, intent) => {
      const result = await executeAction({
        action,
        friend,
        targetRoute: intent?.targetRoute ?? null,
        subPath: intent?.subPath ?? null,
        label: intent?.label ?? null,
        messageText: intent?.messageText ?? null,
        searchQuery: intent?.searchQuery ?? null,
        queryType: intent?.queryType ?? null,
        myProfile,
        navigate,
        onClose,
      });
      addMessage({
        type: "action-result",
        content: result.message,
        success: result.success,
        location: result.location || null,
      });
    },
    [myProfile, navigate, onClose, addMessage],
  );

  // ── Core send handler ───────────────────────────────────────────────────────
  const handleSendMessage = useCallback(
    async (rawMessage) => {
      const text = typeof rawMessage === "string" ? rawMessage : inputValue;
      if (!text || !text.trim()) return;

      addMessage({ type: "user", content: text });
      setInputValue("");
      setIsLoading(true);

      const originalText = text.trim();
      const hasBanglaText = /[\u0980-\u09FF]/.test(originalText);
      const history = messages.map((m) => ({
        role: m.type === "user" ? "user" : "assistant",
        content: typeof m.content === "string" ? m.content : "",
      }));

      const presentResult = async (result, replyOverride) => {
        if (!result) return;

        if (result.type === "created-post") {
          addMessage({
            type: "action-result",
            content: result.message,
            success: result.success,
          });
          return;
        }

        if (result.type === "query-data") {
          let content = replyOverride || result.message;
          try {
            content = await answerFromAppData({
              question: originalText,
              data: result.data,
              conversationHistory: history,
            });
          } catch (groundingError) {
            console.warn(
              "[AIAgentModal] Grounded answer failed; using summary.",
              groundingError,
            );
          }
          addMessage({
            type: "action-result",
            content,
            success: result.success,
          });
          return;
        }

        if (result.type === "video-results") {
          addMessage({
            type: "video-results",
            content: replyOverride || result.message,
            videos: result.videos,
            success: result.success,
            onPlay: handlePlayVideo,
          });
          return;
        }

        if (result.type === "search-results") {
          addMessage({
            type: "search-results",
            content: replyOverride || result.message,
            users: result.users || [],
            posts: result.posts || [],
            videos: result.videos || [],
            success: result.success,
            onPlay: handlePlayVideo,
            onOpenUser: (user) =>
              handleFriendAction(user, "VIEW_PROFILE", {
                action: "VIEW_PROFILE",
              }),
            onOpenPost: (post) => {
              if (post?._id) {
                navigate(`/post/${post._id}`);
                if (onClose) onClose();
              }
            },
          });
          return;
        }

        addMessage({
          type: "action-result",
          content: result.success
            ? replyOverride || result.message
            : result.message || replyOverride,
          success: result.success,
          location: result.location || null,
        });
      };

      const resolveFriends = async (intent) => {
        const friends = Array.isArray(myProfile?.friends)
          ? myProfile.friends
          : [];
        let matched = searchFriendsByName(friends, intent.targetName);
        let searchableFriends = friends;
        if (matched.length === 0 && myProfile?._id) {
          try {
            const response = await api.get("/friend/getFriends", {
              params: { profile: myProfile._id },
            });
            searchableFriends = Array.isArray(response.data)
              ? response.data
              : [];
            matched = searchFriendsByName(
              searchableFriends,
              intent.targetName,
            );
          } catch (friendListError) {
            console.warn(
              "[AIAgentModal] Could not refresh friend profiles:",
              friendListError,
            );
          }
        }
        return { matched, searchableFriends };
      };

      const runIntent = async (intent, replyOverride = "") => {
        const nextIntent = hydrateIntent(intent);
        if (!nextIntent?.action) return false;

        const needsFriend =
          FRIEND_REQUIRED_ACTIONS.has(nextIntent.action) ||
          (nextIntent.action === "QUERY_CONTENT" &&
            nextIntent.queryType === "user" &&
            nextIntent.targetName);

        if (needsFriend) {
          if (!nextIntent.targetName) {
            const meta = getActionMeta(nextIntent.action);
            addMessage({
              type: "agent",
              content:
                replyOverride ||
                `Sure! Who would you like to ${meta.label.toLowerCase()}? Type their name.`,
            });
            return true;
          }

          if (
            nextIntent.action === "SEND_MESSAGE_TO_USER" &&
            !nextIntent.messageText
          ) {
            addMessage({
              type: "agent",
              content:
                replyOverride || "What would you like the message to say?",
            });
            return true;
          }

          const { matched } = await resolveFriends(nextIntent);
          if (matched.length === 0) {
            addMessage({
              type: "agent",
              content: `I couldn't find "${nextIntent.targetName}" in your friends list. Check the spelling or try their username.`,
            });
            return true;
          }

          const responseMode = getActionResponseMode(nextIntent.action);
          const shouldAutoExecuteSingleMatch =
            matched.length === 1 && responseMode !== "confirm";

          if (shouldAutoExecuteSingleMatch) {
            if (LOOKUP_ACTIONS.has(nextIntent.action)) {
              const result = await executeAction({
                ...nextIntent,
                friend: matched[0],
                hintText: replyOverride,
                sourceText: originalText,
                myProfile,
                navigate,
                onClose,
              });
              await presentResult(result, replyOverride);
              return true;
            }
            await handleFriendAction(
              matched[0],
              nextIntent.action,
              nextIntent,
            );
            return true;
          }

          const meta = getActionMeta(nextIntent.action);
          const cardLabel =
            nextIntent.action === "NAVIGATE_PROFILE"
              ? `Go to ${nextIntent.subPath?.replace("/", "") || "profile"}`
              : meta.label;
          const previewText = nextIntent.messageText
            ? nextIntent.messageText.length > 100
              ? `${nextIntent.messageText.slice(0, 100)}…`
              : nextIntent.messageText
            : null;

          addMessage({
            type: "friend-picker",
            content:
              replyOverride ||
              (nextIntent.action === "SEND_MESSAGE_TO_USER"
                ? matched.length === 1
                  ? `Ready to send "${previewText}" to ${getFriendDisplayName(matched[0])}. Click below to send it.`
                  : `Found ${matched.length} people matching "${nextIntent.targetName}". Choose who should receive "${previewText}".`
                : matched.length === 1
                  ? `Found ${getFriendDisplayName(matched[0])}! Click below.`
                  : `Found ${matched.length} people named "${nextIntent.targetName}". Which one?`),
            friends: matched,
            action: nextIntent.action,
            actionLabel: cardLabel,
            intent: nextIntent,
            onAction: (friend) =>
              handleFriendAction(friend, nextIntent.action, nextIntent),
          });
          return true;
        }

        if (NO_FRIEND_ACTIONS.has(nextIntent.action)) {
          const result = await executeAction({
            ...nextIntent,
            friend: null,
            hintText: replyOverride,
            sourceText: originalText,
            myProfile,
            navigate,
            onClose,
          });
          await presentResult(result, replyOverride);
          return true;
        }

        return false;
      };

      try {
        let geminiPlan = null;
        try {
          geminiPlan = await interpretAgentCommand({
            message: originalText,
            conversationHistory: history,
            appContext: buildAppContext(myProfile),
          });
        } catch (interpreterError) {
          console.warn("[AIAgentModal] Gemini interpreter failed:", interpreterError);
        }

        const geminiIntents = recoverAgentActions({
          actions: geminiPlan?.actions || [],
          reply: geminiPlan?.reply || "",
          userMessage: originalText,
        })
          .map((raw) => hydrateIntent(toAgentIntent(raw)))
          .filter(Boolean);

        if (geminiIntents.length > 0) {
          for (let i = 0; i < geminiIntents.length; i += 1) {
            const replyOverride = i === 0 ? geminiPlan?.reply || "" : "";
            const handled = await runIntent(geminiIntents[i], replyOverride);
            if (!handled && geminiPlan?.reply) {
              addMessage({ type: "agent", content: geminiPlan.reply });
            }
          }
          return;
        }

        let intent = parseIntent(originalText);
        if (!intent && hasBanglaText) {
          try {
            const translatedText = await translateBanglaToEnglish(originalText);
            intent = parseIntent(translatedText);
          } catch (translationError) {
            console.warn(
              "[AIAgentModal] Bangla translation failed:",
              translationError,
            );
          }
        }

        if (intent) {
          if (
            intent.action === "CREATE_POST" &&
            isPlaceholderCaption(intent.searchQuery)
          ) {
            intent = {
              ...intent,
              searchQuery:
                extractCaptionFromText(geminiPlan?.reply) || intent.searchQuery,
            };
          }
          const handled = await runIntent(
            hydrateIntent(intent),
            geminiPlan?.reply || "",
          );
          if (handled) return;
        }

        if (geminiPlan?.reply) {
          addMessage({ type: "agent", content: geminiPlan.reply });
          return;
        }

        const result = await sendToGemini(originalText, history);
        addMessage({
          type: "agent",
          content: result.response,
          action: result.suggestedAction,
        });
      } catch (err) {
        console.error("[AIAgentModal]", err);
        addMessage({
          type: "agent",
          content: "Sorry, something went wrong. Please try again.",
        });
      } finally {
        setIsLoading(false);
      }
    },
    [
      inputValue,
      messages,
      myProfile,
      navigate,
      onClose,
      addMessage,
      handleFriendAction,
      handlePlayVideo,
    ],
  );

  useEffect(() => {
    if (!isOpen || !autoRunActions || messages.length === 0) return;

    const latestMessage = messages[messages.length - 1];
    if (autoRunMessageIdsRef.current.has(latestMessage.id)) return;

    const action = getSingleMessageAction(latestMessage);
    if (!action) return;

    autoRunMessageIdsRef.current.add(latestMessage.id);
    Promise.resolve(action()).catch((error) => {
      console.error("[AIAgentModal] Auto-run action failed:", error);
    });
  }, [messages, autoRunActions, isOpen]);

  // ── Sidebar action panel clicks ─────────────────────────────────────────────
  const handleActionClick = useCallback(
    (action) => {
      if (action.prompt) {
        setInputValue(action.prompt);
        // Auto-close sidebar on mobile after selection
        if (window.innerWidth < 768) setIsSidebarOpen(false);
      } else {
        handleSendMessage(action.label);
      }
    },
    [handleSendMessage],
  );

  const toggleSidebar = () => setIsSidebarOpen((v) => !v);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="ai-agent-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="ai-agent-modal-container"
            initial={{ opacity: 0, y: 60, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.97 }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            onClick={(e) => e.stopPropagation()}
            onPointerDownCapture={() =>
              setModalInteractionVersion((value) => value + 1)
            }
          >
            {/* Header — contains mobile hamburger */}
            <ModalHeader
              onClose={onClose}
              onMenuToggle={toggleSidebar}
              isSidebarOpen={isSidebarOpen}
              autoRunActions={autoRunActions}
              onToggleAutoRun={() => setAutoRunActions((value) => !value)}
            />

            {/* Body */}
            <div className="ai-agent-modal-body">
              {/* Sidebar overlay backdrop — mobile only */}
              {isSidebarOpen && (
                <div
                  className="ai-agent-sidebar-backdrop"
                  onClick={() => setIsSidebarOpen(false)}
                  aria-hidden="true"
                />
              )}

              {/* Sidebar */}
              <AnimatePresence initial={false}>
                {isSidebarOpen && (
                  <motion.div
                    className="ai-agent-sidebar"
                    key="sidebar"
                    initial={{ x: "-100%", opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: "-100%", opacity: 0 }}
                    transition={{ type: "tween", duration: 0.22 }}
                  >
                    <ActionPanel onActionClick={handleActionClick} />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Main chat */}
              <div className="ai-agent-main-content">
                <ChatArea
                  messages={messages}
                  isLoading={isLoading}
                  onSendMessage={handleSendMessage}
                  inputValue={inputValue}
                  onInputChange={setInputValue}
                  messagesEndRef={messagesEndRef}
                  userProfilePic={myProfile?.profilePic}
                  autoRunActions={autoRunActions}
                  modalInteractionVersion={modalInteractionVersion}
                />
              </div>
            </div>

            {/* Floating desktop toggle (hidden on mobile — toggle is in header instead) */}
            {!isSidebarOpen && (
              <button
                className="ai-agent-sidebar-toggle"
                onClick={toggleSidebar}
                aria-label="Open quick actions"
                type="button"
              >
                <span
                  className="ai-agent-sidebar-toggle-icon-wrap"
                  style={{ boxShadow: "inset 0 0 0 1px #7C3AED22" }}
                >
                  <i
                    className="fas fa-robot"
                    style={{ color: "#7C3AED" }}
                    aria-hidden="true"
                  />
                </span>
                <span className="ai-agent-sidebar-toggle-label">AI Agent</span>
              </button>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AIAgentModal;
