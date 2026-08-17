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
} from "../../../services/geminiService";
import {
  parseIntent,
  searchFriendsByName,
  getFriendDisplayName,
  getActionResponseMode,
  FRIEND_REQUIRED_ACTIONS,
  NO_FRIEND_ACTIONS,
} from "./agentIntentParser";
import { executeAction, getActionMeta } from "./agentActions";
import api from "../../../api/api";

const createId = () => Date.now() + Math.random();

const INITIAL_MESSAGE = {
  id: 1,
  type: "agent",
  content:
    'Hi! I\'m your AI Agent 🤖 I can call friends, send messages, open any page, navigate to profiles, create Ludo games, block/unblock users, and much more.\n\nTry: "go to settings", "open my profile", "call John", "where is Sarah?"',
  timestamp: new Date(),
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
  const messagesEndRef = useRef(null);
  const autoRunMessageIdsRef = useRef(new Set());

  // Detect mobile to keep sidebar closed by default
  useEffect(() => {
    if (isOpen) {
      const isMobile = window.innerWidth < 768;
      setIsSidebarOpen(!isMobile);
      setMessages([
        { ...INITIAL_MESSAGE, id: createId(), timestamp: new Date() },
      ]);
      setInputValue("");
    }
  }, [isOpen]);

  // Scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
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

      try {
        const originalText = text.trim();
        const hasBanglaText = /[\u0980-\u09FF]/.test(originalText);
        let agentText = originalText;
        let translatedText = "";
        let intent = parseIntent(originalText);

        if (!intent && hasBanglaText) {
          try {
            translatedText = await translateBanglaToEnglish(originalText);
            agentText = translatedText;
            console.log("[AIAgentModal] Bangla command translated:", {
              original: text,
              translated: translatedText,
            });
            intent = parseIntent(translatedText);
          } catch (translationError) {
            console.warn(
              "[AIAgentModal] Bangla translation failed; using original text:",
              translationError,
            );
          }
        }

        // 1. No-friend navigation / creation / video-search actions
        if (intent && NO_FRIEND_ACTIONS.has(intent.action)) {
          const result = await executeAction({
            action: intent.action,
            friend: null,
            targetRoute: intent.targetRoute,
            subPath: intent.subPath,
            label: intent.label,
            searchQuery: intent.searchQuery,
            myProfile,
            navigate,
            onClose,
          });

          // Video search returns a special result type
          if (result.type === "video-results") {
            addMessage({
              type: "video-results",
              content: result.message,
              videos: result.videos,
              success: result.success,
              onPlay: handlePlayVideo,
            });
          } else {
            addMessage({
              type: "action-result",
              content: result.message,
              success: result.success,
            });
          }

          setIsLoading(false);
          return;
        }

        // 2. Friend-required actions
        if (intent && FRIEND_REQUIRED_ACTIONS.has(intent.action)) {
          const friends = Array.isArray(myProfile?.friends)
            ? myProfile.friends
            : [];

          if (!intent.targetName) {
            const meta = getActionMeta(intent.action);
            addMessage({
              type: "agent",
              content: `Sure! Who would you like to ${meta.label.toLowerCase()}? Type their name.`,
            });
            setIsLoading(false);
            return;
          }

          if (intent.action === "SEND_MESSAGE_TO_USER" && !intent.messageText) {
            addMessage({
              type: "agent",
              content: "What would you like the message to say?",
            });
            setIsLoading(false);
            return;
          }

          let resolvedIntent = intent;
          let matched = searchFriendsByName(friends, resolvedIntent.targetName);
          let searchableFriends = friends;

          // Redux may contain only friend IDs or a stale populated list. Retry
          // against the authoritative populated endpoint before reporting that
          // the friend does not exist.
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
                resolvedIntent.targetName,
              );
            } catch (friendListError) {
              console.warn(
                "[AIAgentModal] Could not refresh friend profiles:",
                friendListError,
              );
            }
          }

          if (matched.length === 0 && hasBanglaText) {
            try {
              if (!translatedText) {
                translatedText = await translateBanglaToEnglish(originalText);
              }
              const translatedIntent = parseIntent(translatedText);
              if (
                translatedIntent?.action === resolvedIntent.action &&
                translatedIntent?.targetName
              ) {
                const translatedMatches = searchFriendsByName(
                  searchableFriends,
                  translatedIntent.targetName,
                );
                if (translatedMatches.length > 0) {
                  matched = translatedMatches;
                  resolvedIntent = {
                    ...resolvedIntent,
                    targetName: translatedIntent.targetName,
                    messageText:
                      resolvedIntent.messageText ||
                      translatedIntent.messageText,
                  };
                }
              }
            } catch (translationRetryError) {
              console.warn(
                "[AIAgentModal] Bangla friend matching fallback failed:",
                translationRetryError,
              );
            }
          }

          if (matched.length === 0) {
            addMessage({
              type: "agent",
              content: `I couldn't find "${intent.targetName}" in your friends list. Check the spelling or try their username.`,
            });
            setIsLoading(false);
            return;
          }

          const responseMode = getActionResponseMode(resolvedIntent.action);
          const shouldAutoExecuteSingleMatch =
            matched.length === 1 && responseMode !== "confirm";

          if (shouldAutoExecuteSingleMatch) {
            await handleFriendAction(
              matched[0],
              resolvedIntent.action,
              resolvedIntent,
            );
            setIsLoading(false);
            return;
          }

          const meta = getActionMeta(resolvedIntent.action);
          const cardLabel =
            resolvedIntent.action === "NAVIGATE_PROFILE"
              ? `Go to ${resolvedIntent.subPath?.replace("/", "") || "profile"}`
              : meta.label;

          const previewText = resolvedIntent.messageText
            ? resolvedIntent.messageText.length > 100
              ? `${resolvedIntent.messageText.slice(0, 100)}…`
              : resolvedIntent.messageText
            : null;

          addMessage({
            type: "friend-picker",
            content:
              resolvedIntent.action === "SEND_MESSAGE_TO_USER"
                ? matched.length === 1
                  ? `Ready to send "${previewText}" to ${getFriendDisplayName(matched[0])}. Click below to send it.`
                  : `Found ${matched.length} people matching "${resolvedIntent.targetName}". Choose who should receive "${previewText}".`
                : matched.length === 1
                  ? `Found ${getFriendDisplayName(matched[0])}! Click below.`
                  : `Found ${matched.length} people named "${resolvedIntent.targetName}". Which one?`,
            friends: matched,
            action: resolvedIntent.action,
            actionLabel: cardLabel,
            intent: resolvedIntent,
            onAction: (f) =>
              handleFriendAction(f, resolvedIntent.action, resolvedIntent),
          });

          setIsLoading(false);
          return;
        }

        // 3. Fall through to Gemini
        const history = messages.map((m) => ({
          role: m.type === "user" ? "user" : "assistant",
          content: typeof m.content === "string" ? m.content : "",
        }));
        const result = await sendToGemini(agentText, history);
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
                />
              </div>
            </div>

            {/* Floating desktop toggle (hidden on mobile — toggle is in header instead) */}
            {!isSidebarOpen && (
              <button
                className="ai-agent-sidebar-toggle"
                onClick={toggleSidebar}
                aria-label="Open quick actions"
              >
                <i className="fas fa-chevron-right" />
              </button>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AIAgentModal;
