import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import "./AIAgentModal.css";
import ChatArea from "./ChatArea";
import ActionPanel from "./ActionPanel";
import ModalHeader from "./ModalHeader";
import {
  interpretAgentCommand,
  sendToGemini,
} from "../../../services/geminiService";
import {
  parseIntent,
  searchFriendsByName,
  splitFriendNames,
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
  getMissingIntentSlots,
  getSlotQuestion,
  mergeFollowUpIntent,
  isCancelFollowUp,
  isAffirmativeFollowUp,
  looksLikeQuestion,
  normalizeAskField,
  isFastLocalIntent,
} from "./agentCatalog";
import {
  rememberUserText,
  rememberActionResult,
  applyMemoryToIntent,
  getMemoryPromptBlock,
  clearAgentMemory,
} from "./agentMemory";
import api from "../../../api/api";
import { fetchLatestAIChat, saveAIChat, deleteAIChat } from "../../../services/aiChatService";
import {
  getResolvedAgentSettings,
  subscribeAgentSettings,
} from "../../../services/aiAgentSettings";
import { fetchAiProviderStatus } from "../../../services/llmClient";
import AgentSettingsPanel from "./AgentSettingsPanel";
import {
  getInstantAgentReply,
  looksLikeAppCommand,
} from "./agentFastPath";

const createId = () => Date.now() + Math.random();

const INITIAL_MESSAGE = {
  id: 1,
  type: "agent",
  meta: "welcome",
  content:
    'Hi! I\'m your AI Agent 🤖 I remember this chat, so you can say "that video" or "invite him". I can download YouTube videos, start Ludo and invite friends, publish or delete posts, manage notes, tasks, and calendar, open the video player, log health and recovery, and update settings.\n\nTry: "download this YouTube link", "invite Atik to Ludo", "post I am feeling good", "add an event tomorrow at 5pm".',
  timestamp: new Date(),
};

const isWelcomeMessage = (message) =>
  message?.meta === "welcome" ||
  (message?.type === "agent" &&
    String(message.content || "").startsWith("Hi! I'm your AI Agent"));

const toLlmHistory = (messages = [], limit = 6) =>
  messages
    .filter((item) => {
      if (isWelcomeMessage(item)) return false;
      if (!["user", "agent", "action-result"].includes(item?.type)) return false;
      return typeof item.content === "string" && item.content.trim();
    })
    .slice(-limit)
    .map((item) => ({
      role: item.type === "user" ? "user" : "assistant",
      content:
        item.content.length > 240 ? `${item.content.slice(0, 239)}…` : item.content,
    }));

const buildAppContext = (myProfile) => {
  const friendsRaw = Array.isArray(myProfile?.friends) ? myProfile.friends : [];
  const friends = friendsRaw
    .filter((friend) => friend && typeof friend === "object")
    .slice(0, 12)
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
  const autoRunActionsRef = useRef(autoRunActions);
  const pendingIntentRef = useRef(null);
  const skipSaveRef = useRef(false);
  const sendGenerationRef = useRef(0);
  const [isFetchingHistory, setIsFetchingHistory] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [llmInfo, setLlmInfo] = useState(() => getResolvedAgentSettings());

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
      document.body.classList.add("app-modal-open");
      document.documentElement.classList.add("app-modal-open-html");
      return () => {
        document.body.classList.remove("app-modal-open");
        document.documentElement.classList.remove("app-modal-open-html");
      };
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
    autoRunActionsRef.current = autoRunActions;
    try {
      window.localStorage.setItem(
        AUTO_RUN_ACTIONS_STORAGE_KEY,
        String(autoRunActions),
      );
    } catch (_) {}
  }, [autoRunActions]);

  useEffect(() => {
    if (!isOpen) {
      pendingIntentRef.current = null;
      setSettingsOpen(false);
    }
  }, [isOpen]);

  useEffect(() => {
    setLlmInfo(getResolvedAgentSettings());
    fetchAiProviderStatus();
    return subscribeAgentSettings(() => {
      setLlmInfo(getResolvedAgentSettings());
    });
  }, []);



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
    if (isFetchingHistory || skipSaveRef.current || messages.length <= 1) return;
    
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
        extraFriends: intent?.extraFriends,
        targetName: intent?.targetName ?? null,
        targetRoute: intent?.targetRoute ?? null,
        subPath: intent?.subPath ?? null,
        label: intent?.label ?? null,
        messageText: intent?.messageText ?? null,
        searchQuery: intent?.searchQuery ?? null,
        queryType: intent?.queryType ?? null,
        sourceText: intent?.sourceText ?? null,
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
      rememberActionResult(myProfile?._id, {
        action,
        friendName: getFriendDisplayName(friend),
        result,
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
      const generation = ++sendGenerationRef.current;
      const originalText = text.trim();
      rememberUserText(myProfile?._id, originalText);
      const stillCurrent = () => generation === sendGenerationRef.current;

      if (pendingIntentRef.current && isCancelFollowUp(originalText)) {
        pendingIntentRef.current = null;
        addMessage({
          type: "agent",
          content: "Okay, I cancelled that.",
        });
        setIsLoading(false);
        return;
      }

      if (!pendingIntentRef.current) {
        const instantReply = getInstantAgentReply(originalText);
        if (instantReply) {
          addMessage({ type: "agent", content: instantReply });
          setIsLoading(false);
          return;
        }
      }

      setIsLoading(true);
      const history = toLlmHistory(messages, 6);

      const presentResult = async (result, replyOverride, intent = null) => {
        if (!result || !stillCurrent()) return;
        rememberActionResult(myProfile?._id, {
          action: intent?.action,
          friendName: intent?.targetName,
          result,
          userText: originalText,
        });

        if (result.type === "created-post") {
          addMessage({
            type: "action-result",
            content: result.message,
            success: result.success,
          });
          return;
        }

        if (result.type === "query-data") {
          addMessage({
            type: "action-result",
            content: replyOverride || result.message,
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
        if (matched.length === 0) {
          const names = splitFriendNames(intent.targetName);
          if (names.length > 1) {
            const seen = new Set();
            matched = [];
            names.forEach((name) => {
              searchFriendsByName(friends, name).forEach((profile) => {
                const id = String(profile?._id || "");
                if (!id || seen.has(id)) return;
                seen.add(id);
                matched.push(profile);
              });
            });
          }
        }
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
            if (matched.length === 0) {
              const names = splitFriendNames(intent.targetName);
              if (names.length > 1) {
                const seen = new Set();
                matched = [];
                names.forEach((name) => {
                  searchFriendsByName(searchableFriends, name).forEach(
                    (profile) => {
                      const id = String(profile?._id || "");
                      if (!id || seen.has(id)) return;
                      seen.add(id);
                      matched.push(profile);
                    },
                  );
                });
              }
            }
          } catch (friendListError) {
            console.warn(
              "[AIAgentModal] Could not refresh friend profiles:",
              friendListError,
            );
          }
        }
        return { matched, searchableFriends };
      };

      const pauseForInput = (intent, slots, question) => {
        if (!stillCurrent()) return;
        pendingIntentRef.current = {
          intent,
          missing: slots,
        };
        addMessage({
          type: "agent",
          content: question,
        });
      };

      const runIntent = async (intent, replyOverride = "", options = {}) => {
        const hadTypedLudoInvitee =
          ["CREATE_LUDO", "INVITE_LUDO"].includes(intent?.action) &&
          splitFriendNames(intent?.targetName).length > 0;
        const nextIntent = applyMemoryToIntent(
          hydrateIntent(intent),
          myProfile?._id,
        );
        if (!nextIntent?.action) return false;

        const autoRun = Boolean(
          options.forceExecute || autoRunActionsRef.current,
        );
        const missingSlots = getMissingIntentSlots(nextIntent);
        if (missingSlots.length > 0) {
          const question = looksLikeQuestion(replyOverride)
            ? replyOverride
            : getSlotQuestion(nextIntent, missingSlots);
          pauseForInput(nextIntent, missingSlots, question);
          return true;
        }

        const ludoInviteNames = ["CREATE_LUDO", "INVITE_LUDO"].includes(
          nextIntent.action,
        )
          ? splitFriendNames(nextIntent.targetName)
          : [];

        const needsFriend =
          FRIEND_REQUIRED_ACTIONS.has(nextIntent.action) ||
          (nextIntent.action === "CREATE_LUDO" && hadTypedLudoInvitee) ||
          (nextIntent.action === "QUERY_CONTENT" &&
            String(nextIntent.queryType || "").toLowerCase() === "user");

        if (needsFriend) {
          const { matched } = await resolveFriends(nextIntent);
          if (matched.length === 0) {
            pauseForInput(
              { ...nextIntent, targetName: null },
              ["targetName"],
              `I couldn't find "${nextIntent.targetName}" in your friends list. Who did you mean?`,
            );
            return true;
          }

          const isMultiLudoInvite =
            ["CREATE_LUDO", "INVITE_LUDO"].includes(nextIntent.action) &&
            ludoInviteNames.length > 1 &&
            matched.length > 1;

          if (isMultiLudoInvite) {
            pendingIntentRef.current = null;
            const result = await executeAction({
              ...nextIntent,
              friend: matched[0],
              extraFriends: matched.slice(1),
              hintText: replyOverride,
              sourceText: originalText,
              myProfile,
              navigate,
              onClose,
            });
            await presentResult(result, replyOverride, nextIntent);
            return true;
          }

          const responseMode = getActionResponseMode(nextIntent.action);
          const shouldAutoExecuteSingleMatch =
            matched.length === 1 && (autoRun || responseMode !== "confirm");

          if (shouldAutoExecuteSingleMatch) {
            pendingIntentRef.current = null;
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
              await presentResult(result, replyOverride, nextIntent);
              return true;
            }
            await handleFriendAction(
              matched[0],
              nextIntent.action,
              nextIntent,
            );
            return true;
          }

          pendingIntentRef.current = {
            intent: nextIntent,
            missing: matched.length > 1 ? ["targetName"] : [],
          };

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
              replyOverride && looksLikeQuestion(replyOverride)
                ? replyOverride
                : nextIntent.action === "SEND_MESSAGE_TO_USER"
                  ? matched.length === 1
                    ? `Ready to send "${previewText}" to ${getFriendDisplayName(matched[0])}. ${autoRun ? "Running now." : "Click below to send it."}`
                    : `Found ${matched.length} people matching "${nextIntent.targetName}". Which one should receive "${previewText}"?`
                  : matched.length === 1
                    ? `Found ${getFriendDisplayName(matched[0])}! ${autoRun ? "Running now." : "Click below to continue."}`
                    : `Found ${matched.length} people named "${nextIntent.targetName}". Which one?`,
            friends: matched,
            action: nextIntent.action,
            actionLabel: cardLabel,
            intent: nextIntent,
            onAction: (friend) => {
              pendingIntentRef.current = null;
              handleFriendAction(friend, nextIntent.action, nextIntent);
            },
          });
          return true;
        }

        if (NO_FRIEND_ACTIONS.has(nextIntent.action)) {
          pendingIntentRef.current = null;
          const result = await executeAction({
            ...nextIntent,
            friend: null,
            hintText: replyOverride,
            sourceText: originalText,
            myProfile,
            navigate,
            onClose,
          });
          await presentResult(result, replyOverride, nextIntent);
          return true;
        }

        return false;
      };

      try {
        const pendingSnapshot = pendingIntentRef.current;
        const autoRun = autoRunActionsRef.current;

        if (pendingSnapshot) {
          const switched = parseIntent(originalText);
          const switchedIntent = switched
            ? applyMemoryToIntent(hydrateIntent(switched), myProfile?._id)
            : null;
          const switchedTopics =
            switchedIntent?.action &&
            switchedIntent.action !== pendingSnapshot.intent?.action &&
            !isAffirmativeFollowUp(originalText) &&
            getMissingIntentSlots(switchedIntent).length === 0;

          if (switchedTopics) {
            pendingIntentRef.current = null;
            const handled = await runIntent(switchedIntent, "", {
              forceExecute: autoRun,
            });
            if (!stillCurrent()) return;
            if (handled) return;
          }

          const merged = mergeFollowUpIntent({
            pending: pendingSnapshot,
            followUpText: originalText,
            geminiIntents: switchedIntent ? [switchedIntent] : [],
          });
          if (merged) {
            const handled = await runIntent(merged, "", {
              forceExecute: autoRun || isAffirmativeFollowUp(originalText),
            });
            if (!stillCurrent()) return;
            if (handled) return;
          }
        }

        const localIntent = parseIntent(originalText);
        if (localIntent && isFastLocalIntent(localIntent, originalText)) {
          const handled = await runIntent(hydrateIntent(localIntent), "", {
            forceExecute: autoRun,
          });
          if (!stillCurrent()) return;
          if (handled) return;
        }

        if (!pendingSnapshot && !looksLikeAppCommand(originalText)) {
          const chat = await sendToGemini(originalText, history);
          if (!stillCurrent()) return;
          addMessage({
            type: "agent",
            content:
              chat?.response ||
              "I didn't catch that. Try a short command like “open settings”.",
          });
          return;
        }

        let geminiPlan = null;
        try {
          geminiPlan = await interpretAgentCommand({
            message: pendingSnapshot
              ? `Pending action ${pendingSnapshot.intent?.action}. Missing: ${(pendingSnapshot.missing || []).join(", ") || "none"}. User answer: ${originalText}`
              : originalText,
            conversationHistory: history,
            appContext: {
              ...buildAppContext(myProfile),
              memory: getMemoryPromptBlock(myProfile?._id),
              pendingIntent: pendingSnapshot
                ? {
                    action: pendingSnapshot.intent?.action,
                    missing: pendingSnapshot.missing,
                  }
                : null,
            },
          });
        } catch (interpreterError) {
          console.warn("[AIAgentModal] Interpreter failed:", interpreterError);
        }
        if (!stillCurrent()) return;

        const geminiIntents = recoverAgentActions({
          actions: geminiPlan?.actions || [],
          reply: geminiPlan?.reply || "",
          userMessage: originalText,
        })
          .map((raw) => hydrateIntent(toAgentIntent(raw)))
          .filter(Boolean);

        if (pendingSnapshot) {
          const merged = mergeFollowUpIntent({
            pending: pendingSnapshot,
            followUpText: originalText,
            geminiIntents,
          });
          if (merged) {
            const handled = await runIntent(merged, geminiPlan?.reply || "", {
              forceExecute: autoRun || isAffirmativeFollowUp(originalText),
            });
            if (!stillCurrent()) return;
            if (handled) return;
          }
        }

        if (geminiIntents.length > 0) {
          for (let i = 0; i < geminiIntents.length; i += 1) {
            if (!stillCurrent()) return;
            const replyOverride = i === 0 ? geminiPlan?.reply || "" : "";
            const handled = await runIntent(geminiIntents[i], replyOverride);
            if (!handled && geminiPlan?.reply && stillCurrent()) {
              addMessage({ type: "agent", content: geminiPlan.reply });
            }
          }
          return;
        }

        if (geminiPlan?.ask?.field || looksLikeQuestion(geminiPlan?.reply)) {
          const stub =
            pendingSnapshot?.intent ||
            localIntent ||
            (geminiPlan?.ask?.field ? { action: null } : null);
          const parsedStub = stub?.action ? hydrateIntent(stub) : null;
          if (parsedStub) {
            const slots = geminiPlan?.ask?.field
              ? [normalizeAskField(geminiPlan.ask.field) || geminiPlan.ask.field]
              : getMissingIntentSlots(parsedStub);
            const question =
              geminiPlan?.ask?.question ||
              geminiPlan?.reply ||
              getSlotQuestion(parsedStub, slots);
            pauseForInput(
              parsedStub,
              slots.filter(Boolean).length ? slots.filter(Boolean) : ["searchQuery"],
              question,
            );
            return;
          }
        }

        if (geminiPlan?.reply) {
          if (!stillCurrent()) return;
          addMessage({ type: "agent", content: geminiPlan.reply });
          return;
        }

        if (!stillCurrent()) return;
        addMessage({
          type: "agent",
          content:
            "I didn't catch a command. Try something like “open settings”, “invite Atik to Ludo”, or ask a question.",
        });
      } catch (err) {
        console.error("[AIAgentModal]", err);
        if (!stillCurrent()) return;
        addMessage({
          type: "agent",
          content: "Sorry, something went wrong. Please try again.",
        });
      } finally {
        if (stillCurrent()) setIsLoading(false);
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

  const handleClearChat = useCallback(async () => {
    if (isLoading) return;
    const hasChat = messages.some(
      (item) => item?.type === "user" || (item?.type === "agent" && !isWelcomeMessage(item)),
    );
    if (!hasChat) return;
    const confirmed =
      typeof window === "undefined" ||
      window.confirm("Clear this AI chat? Saved history on this account will be deleted.");
    if (!confirmed) return;

    skipSaveRef.current = true;
    pendingIntentRef.current = null;
    setSettingsOpen(false);
    setMessages([
      { ...INITIAL_MESSAGE, id: createId(), timestamp: new Date() },
    ]);
    clearAgentMemory(myProfile?._id);
    try {
      await deleteAIChat();
    } catch (error) {
      console.error("Failed to delete saved AI chat:", error);
    } finally {
      skipSaveRef.current = false;
    }
  }, [isLoading, messages, myProfile?._id]);

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
              onOpenSettings={() => setSettingsOpen((value) => !value)}
              onClearChat={handleClearChat}
              canClearChat={
                !isLoading &&
                messages.some(
                  (item) =>
                    item?.type === "user" ||
                    (item?.type === "agent" && !isWelcomeMessage(item)),
                )
              }
              settingsOpen={settingsOpen}
              providerLabel={llmInfo.meta?.shortLabel || "AI"}
              modelLabel={String(llmInfo.model || "").split("/").pop()}
            />

            {/* Body */}
            <div className="ai-agent-modal-body">
              {settingsOpen && (
                <div className="ai-agent-settings-overlay">
                  <AgentSettingsPanel onClose={() => setSettingsOpen(false)} />
                </div>
              )}
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
                  style={{ boxShadow: "inset 0 0 0 1px #00D4FF22" }}
                >
                  <i
                    className="fas fa-robot"
                    style={{ color: "#00D4FF" }}
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
