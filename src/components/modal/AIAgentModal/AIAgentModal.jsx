import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import "./AIAgentModal.css";
import ChatArea from "./ChatArea";
import ActionPanel from "./ActionPanel";
import ModalHeader from "./ModalHeader";
import { sendToGemini } from "../../../services/geminiService";
import {
  parseIntent,
  searchFriendsByName,
  getFriendDisplayName,
  FRIEND_REQUIRED_ACTIONS,
  NO_FRIEND_ACTIONS,
} from "./agentIntentParser";
import { executeAction, getActionMeta } from "./agentActions";

const createId = () => Date.now() + Math.random();

const INITIAL_MESSAGE = {
  id: 1,
  type: "agent",
  content:
    'Hi! I\'m your AI Agent 🤖 I can call friends, send messages, open any page, navigate to profiles, create Ludo games, block/unblock users, and much more.\n\nTry: "go to settings", "open my profile", "call John", "where is Sarah?"',
  timestamp: new Date(),
};

const AIAgentModal = ({ isOpen, onClose }) => {
  const myProfile = useSelector((state) => state.profile);
  const navigate = useNavigate();

  const [messages, setMessages] = useState([INITIAL_MESSAGE]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // closed by default — especially on mobile
  const messagesEndRef = useRef(null);

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

  // ── Message helpers ─────────────────────────────────────────────────────────
  const addMessage = useCallback((msg) => {
    setMessages((prev) => [
      ...prev,
      { id: createId(), timestamp: new Date(), ...msg },
    ]);
  }, []);

  // ── Execute after friend resolved ───────────────────────────────────────────
  const handleFriendAction = useCallback(
    async (friend, action, intent) => {
      const result = await executeAction({
        action,
        friend,
        targetRoute: intent?.targetRoute ?? null,
        subPath: intent?.subPath ?? null,
        label: intent?.label ?? null,
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
        const intent = parseIntent(text);

        // 1. No-friend navigation / creation actions
        if (intent && NO_FRIEND_ACTIONS.has(intent.action)) {
          const result = await executeAction({
            action: intent.action,
            friend: null,
            targetRoute: intent.targetRoute,
            subPath: intent.subPath,
            label: intent.label,
            myProfile,
            navigate,
            onClose,
          });
          addMessage({
            type: "action-result",
            content: result.message,
            success: result.success,
          });
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

          const matched = searchFriendsByName(friends, intent.targetName);

          if (matched.length === 0) {
            addMessage({
              type: "agent",
              content: `I couldn't find "${intent.targetName}" in your friends list. Check the spelling or try their username.`,
            });
            setIsLoading(false);
            return;
          }

          const meta = getActionMeta(intent.action);
          const cardLabel =
            intent.action === "NAVIGATE_PROFILE"
              ? `Go to ${intent.subPath?.replace("/", "") || "profile"}`
              : meta.label;

          addMessage({
            type: "friend-picker",
            content:
              matched.length === 1
                ? `Found ${getFriendDisplayName(matched[0])}! Click below.`
                : `Found ${matched.length} people named "${intent.targetName}". Which one?`,
            friends: matched,
            action: intent.action,
            actionLabel: cardLabel,
            intent,
            onAction: (f) => handleFriendAction(f, intent.action, intent),
          });

          setIsLoading(false);
          return;
        }

        // 3. Fall through to Gemini
        const history = messages.map((m) => ({
          role: m.type === "user" ? "user" : "assistant",
          content: typeof m.content === "string" ? m.content : "",
        }));
        const result = await sendToGemini(text, history);
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
    ],
  );

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
