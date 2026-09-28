import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import "./AIAgentModal.css";
import "./agentExpo.css";
import ChatArea from "./ChatArea";
import ModalHeader from "./ModalHeader";
import {
  sendToGeminiStream,
  looksLikeAgentPlan,
  parseAgentPlan,
  extractStreamingPlanReply,
  answerFromAppData,
  PLANNER_CONFIRM_ACTIONS,
} from "../../../services/geminiService";
import {
  parseIntent,
  searchConnectsByName,
  splitConnectNames,
  getConnectDisplayName,
  getActionResponseMode,
  CONNECT_REQUIRED_ACTIONS,
  NO_CONNECT_ACTIONS,
  findStaticRoute,
  stripCommandFiller,
} from "./agentIntentParser";
import { executeAction, getActionMeta, searchConnectUsers } from "./agentActions";
import {
  matchRelationConnects,
  matchSpokenChoice,
  stripHonorifics,
} from "./agentRelations";
import {
  LOOKUP_ACTIONS,
  DIRECTORY_LOOKUP_ACTIONS,
  resolveCatalogRoute,
  getMissingIntentSlots,
  getSlotQuestion,
  mergeFollowUpIntent,
  isCancelFollowUp,
  isAffirmativeFollowUp,
  looksLikeQuestion,
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
import {
  completeChat,
  fetchAiProviderStatus,
  warmupCursorProvider,
} from "../../../services/llmClient";
import AgentSettingsPanel from "./AgentSettingsPanel";
import {
  describeUpcomingAction,
  getInstantAgentReply,
} from "./agentFastPath";
import { detectAgentLanguage } from "./banglish";
import { pickBestYoutubeMatch } from "./agentActionHelpers";
import useAgentSpeech from "../../../hooks/useAgentSpeech";

const createId = () => Date.now() + Math.random();

// After these the page plays video/audio: hands-free talk pauses so the agent
// does not transcribe the media (or itself) as new commands.
const MEDIA_ACTIONS = new Set(["OPEN_VIDEO_PLAYER", "DOWNLOAD_YOUTUBE"]);
const MEDIA_ROUTES = ["/watch", "/youtube", "/video-player", "/downloads"];
const startsMedia = (intent) =>
  MEDIA_ACTIONS.has(intent?.action) ||
  (intent?.action === "NAVIGATE" &&
    MEDIA_ROUTES.some((route) =>
      String(intent?.targetRoute || "").startsWith(route),
    ));

// Phrases that end a hands-free (live talk) conversation.
const STOP_CONVERSATION =
  /^(stop|stop listening|bye|goodbye|that'?s all|nothing else|থামো|থামুন|থাক|বিদায়|আর কিছু না|আর কিছু লাগবে না|আপাতত এটুকুই|bas|ar kichu na)[.!।\s]*$/i;

const INITIAL_MESSAGE = {
  id: 1,
  type: "agent",
  meta: "welcome",
  content:
    'Hi! I\'m your AI Agent 🤖 Just tell me what you want done in Connect — call or message someone, post, add tasks, notes and events, find videos, change settings, or look up your data. Tap the headset to talk hands-free. Try: "message Atik I\'m running late", "add a meeting tomorrow at 10", or "what are my open tasks?"',
  timestamp: new Date(),
};

const isWelcomeMessage = (message) =>
  message?.meta === "welcome" ||
  (message?.type === "agent" &&
    String(message.content || "").startsWith("Hi! I'm your AI Agent"));

const toLlmHistory = (messages = [], limit = 4) =>
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
        item.content.length > 140 ? `${item.content.slice(0, 139)}…` : item.content,
    }));

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
  if (message?.type === "connect-picker" && message.connects?.length === 1) {
    return () => message.onAction?.(message.connects[0]);
  }

  if (message?.type === "search-results") {
    if (message.users?.length === 1 && typeof message.onOpenUser === "function") {
      return () => message.onOpenUser(message.users[0]);
    }
    if (message.videos?.length === 1 && typeof message.onPlay === "function") {
      return () => message.onPlay(message.videos[0]);
    }
  }

  if (message?.type === "video-results" && message.source === "youtube") {
    if (!message.videos?.length || typeof message.onDownload !== "function") {
      return null;
    }
    return () => {
      const best = pickBestYoutubeMatch(message.videos, message.query);
      if (!best) return undefined;
      return message.onDownload(best, {
        postAsWatch: message.defaultPostAsWatch !== false,
        audioOnly: message.audioOnly,
        quality: message.quality,
      });
    };
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

const AIAgentModal = ({
  isOpen,
  onClose,
  autoStartVoice = false,
  voiceStartRequest = 0,
  expandRequest = 0,
}) => {
  const myProfile = useSelector((state) => state.profile);
  const preferredLanguage = useSelector(
    (state) => state.setting?.language || "eng",
  );
  const navigate = useNavigate();

  const [messages, setMessages] = useState([INITIAL_MESSAGE]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
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
  const connectsCacheRef = useRef([]);
  const messagesRef = useRef(messages);
  const streamAbortRef = useRef(null);
  const streamRafRef = useRef(0);
  const streamPendingRef = useRef(null);
  const [isFetchingHistory, setIsFetchingHistory] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [llmInfo, setLlmInfo] = useState(() => getResolvedAgentSettings());
  const [liveTalkOn, setLiveTalkOn] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  // Speak replies out loud (always on in hands-free talk), like the app's
  // speaker toggle.
  const [speakReplies, setSpeakReplies] = useState(false);
  // Label of the action currently running ("Create note"), for the status.
  const [runningLabel, setRunningLabel] = useState("");
  const {
    supported: speechSupported,
    speaking: isAgentSpeaking,
    speak: speakText,
    feed: feedSpeech,
    flush: flushSpeech,
    cancel: cancelSpeech,
  } = useAgentSpeech();
  const liveTalkOnRef = useRef(false);
  // Set while a plan's own spoken reply already announced the action.
  const skipAnnounceRef = useRef(false);
  const spokenMessageIdsRef = useRef(new Set());

  // Fetch chat history from database
  const fetchChatHistory = useCallback(async () => {
    const openGeneration = sendGenerationRef.current;
    setIsFetchingHistory(true);
    try {
      const chatData = await fetchLatestAIChat();
      if (sendGenerationRef.current !== openGeneration) return;
      if (chatData?.messages && Array.isArray(chatData.messages) && chatData.messages.length > 0) {
        setMessages(chatData.messages);
      } else {
        setMessages([
          { ...INITIAL_MESSAGE, id: createId(), timestamp: new Date() },
        ]);
      }
    } catch (error) {
      console.error("Failed to load chat history:", error);
      if (sendGenerationRef.current !== openGeneration) return;
      setMessages([
        { ...INITIAL_MESSAGE, id: createId(), timestamp: new Date() },
      ]);
    } finally {
      if (sendGenerationRef.current === openGeneration) {
        setIsFetchingHistory(false);
      }
    }
  }, []);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    liveTalkOnRef.current = liveTalkOn;
  }, [liveTalkOn]);

  useEffect(() => {
    return () => {
      streamAbortRef.current?.abort();
      if (streamRafRef.current) {
        cancelAnimationFrame(streamRafRef.current);
        streamRafRef.current = 0;
      }
    };
  }, []);

  // Reset the composer and load chat history whenever the agent opens.
  useEffect(() => {
    if (isOpen) {
      setInputValue("");
      setModalInteractionVersion(0);
      setIsMinimized(autoStartVoice);
      fetchChatHistory();
    }
    // autoStartVoice only decides the state the agent opens in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, fetchChatHistory]);

  useEffect(() => {
    if (!isOpen || isMinimized) {
      document.body.classList.remove("app-modal-open");
      document.documentElement.classList.remove("app-modal-open-html");
      return undefined;
    }
    document.body.classList.add("app-modal-open");
    document.documentElement.classList.add("app-modal-open-html");
    return () => {
      document.body.classList.remove("app-modal-open");
      document.documentElement.classList.remove("app-modal-open-html");
    };
  }, [isOpen, isMinimized]);

  useEffect(() => {
    const local = Array.isArray(myProfile?.connects) ? myProfile.connects : [];
    if (local.length) connectsCacheRef.current = local;
  }, [myProfile?.connects]);

  useEffect(() => {
    if (!isOpen || !myProfile?._id) return undefined;
    let cancelled = false;
    api
      .get("/connects/getConnects", { params: { profile: myProfile._id } })
      .then((response) => {
        if (cancelled || !Array.isArray(response.data)) return;
        connectsCacheRef.current = response.data;
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isOpen, myProfile?._id]);

  // Scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
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
      setIsMinimized(false);
      streamAbortRef.current?.abort();
      setLiveTalkOn(false);
      cancelSpeech();
    }
  }, [isOpen, cancelSpeech]);

  useEffect(() => {
    const expandAgent = () => setIsMinimized(false);
    window.addEventListener("openAIAgent", expandAgent);
    return () => window.removeEventListener("openAIAgent", expandAgent);
  }, []);

  useEffect(() => {
    setLlmInfo(getResolvedAgentSettings());
    fetchAiProviderStatus().then(() => {
      warmupCursorProvider();
    });
    return subscribeAgentSettings(() => {
      setLlmInfo(getResolvedAgentSettings());
    });
  }, []);

  useEffect(() => {
    if (!isOpen) return undefined;
    warmupCursorProvider();
    return undefined;
  }, [isOpen]);



  /** Runs an app action while the header/voice panel shows what it is doing. */
  const runAction = useCallback(async (args) => {
    setRunningLabel(getActionMeta(args?.action)?.label || "");
    try {
      return await executeAction(args);
    } finally {
      setRunningLabel("");
    }
  }, []);

  // ── Message helpers ─────────────────────────────────────────────────────────
  const addMessage = useCallback((msg) => {
    setMessages((prev) => [
      ...prev,
      { id: createId(), timestamp: new Date(), ...msg },
    ]);
  }, []);

  const announceUpcomingAction = useCallback(
    async (intent, connect = null, langHint = "") => {
      if (!liveTalkOnRef.current || skipAnnounceRef.current) return;
      const language = detectAgentLanguage(langHint);
      const line = describeUpcomingAction(intent, {
        connectName: getConnectDisplayName(connect) || intent?.targetName || "",
        lang: language,
      });
      if (!line) return;
      addMessage({
        type: "agent",
        content: line,
        skipSpeech: true,
      });
      speakText(line, { lang: language });
    },
    [addMessage, speakText],
  );

  const handleMinimize = useCallback(() => {
    setSettingsOpen(false);
    setIsMinimized(true);
  }, []);

  const handleExpand = useCallback(() => {
    setIsMinimized(false);
  }, []);

  // A plain open request (header / menu) restores a minimized agent.
  const lastExpandRequestRef = useRef(expandRequest);
  useEffect(() => {
    if (lastExpandRequestRef.current === expandRequest) return;
    lastExpandRequestRef.current = expandRequest;
    if (isOpen) setIsMinimized(false);
  }, [expandRequest, isOpen]);

  const handleClose = useCallback(() => {
    setIsMinimized(false);
    setLiveTalkOn(false);
    streamAbortRef.current?.abort();
    sendGenerationRef.current += 1;
    setIsLoading(false);
    cancelSpeech();
    onClose?.();
  }, [cancelSpeech, onClose]);

  useEffect(() => {
    // Skip saving if still loading or only initial message
    if (
      isFetchingHistory ||
      skipSaveRef.current ||
      messages.length <= 1 ||
      messages.some((item) => item?.streaming)
    ) {
      return;
    }
    
    const timer = setTimeout(async () => {
      try {
        await saveAIChat(messages);
      } catch (error) {
        console.error("Failed to save chat to database:", error);
      }
    }, 1500); // Debounce: save after 1.5 seconds of no changes

    return () => clearTimeout(timer);
  }, [messages, isFetchingHistory]);

  // ── Execute after connect resolved ───────────────────────────────────────────
  const handlePlayVideo = useCallback(
    async (video) => {
      if (!video?._id) return;
      const lastUser = [...(messagesRef.current || [])]
        .reverse()
        .find((item) => item?.type === "user");
      await announceUpcomingAction(
        {
          action: "PLAY_VIDEO",
          searchQuery: video.title || video.name || "",
        },
        null,
        lastUser?.content || "",
      );
      navigate(`/watch/${video._id}`, { state: { autoplay: true } });
      // The video plays with sound now; stop listening until the user asks.
      setLiveTalkOn(false);
      handleMinimize();
    },
    [announceUpcomingAction, handleMinimize, navigate],
  );

  const handleDownloadYoutube = useCallback(
    async (
      video,
      { postAsWatch = true, audioOnly = false, quality } = {},
    ) => {
      const url = video?.url;
      if (!url) return;
      const lastUser = [...(messagesRef.current || [])]
        .reverse()
        .find((item) => item?.type === "user");
      await announceUpcomingAction(
        {
          action: "DOWNLOAD_YOUTUBE",
          searchQuery: url,
        },
        null,
        lastUser?.content || "",
      );
      const result = await runAction({
        action: "DOWNLOAD_YOUTUBE",
        searchQuery: url,
        postAsWatch,
        audioOnly,
        quality,
        sourceText: lastUser?.content || "",
        myProfile,
        preferredLanguage,
        navigate,
        onClose: handleMinimize,
      });
      addMessage({
        type: "action-result",
        content: result.message,
        success: result.success,
        skipSpeech: liveTalkOnRef.current,
      });
      // The downloaded video plays with sound; stop listening until asked.
      if (result.success) setLiveTalkOn(false);
      rememberActionResult(myProfile?._id, {
        action: "DOWNLOAD_YOUTUBE",
        result,
        userText: lastUser?.content,
      });
    },
    [
      runAction,
      addMessage,
      announceUpcomingAction,
      handleMinimize,
      myProfile,
      navigate,
      preferredLanguage,
    ],
  );

  const handleConnectAction = useCallback(
    async (connect, action, intent) => {
      const result = await runAction({
        action,
        connect,
        extraConnects: intent?.extraConnects,
        targetName: intent?.targetName ?? null,
        targetRoute: intent?.targetRoute ?? null,
        subPath: intent?.subPath ?? null,
        label: intent?.label ?? null,
        messageText: intent?.messageText ?? null,
        searchQuery: intent?.searchQuery ?? null,
        queryType: intent?.queryType ?? null,
        sourceText: intent?.sourceText ?? null,
        myProfile,
        preferredLanguage,
        navigate,
        onClose: handleMinimize,
      });
      addMessage({
        type: "action-result",
        content: result.message,
        success: result.success,
        location: result.location || null,
        skipSpeech: liveTalkOnRef.current,
      });
      rememberActionResult(myProfile?._id, {
        action,
        connectName: getConnectDisplayName(connect),
        result,
      });
    },
    [myProfile, preferredLanguage, navigate, handleMinimize, addMessage, runAction],
  );

  // ── Core send handler ───────────────────────────────────────────────────────
  const handleSendMessage = useCallback(
    async (rawMessage) => {
      const text = typeof rawMessage === "string" ? rawMessage : inputValue;
      if (!text || !text.trim()) return;

      streamAbortRef.current?.abort();
      if (streamRafRef.current) {
        cancelAnimationFrame(streamRafRef.current);
        streamRafRef.current = 0;
      }
      streamPendingRef.current = null;
      cancelSpeech();
      setMessages((prev) => [
        ...prev
          .filter((msg) => !(msg.streaming && !String(msg.content || "").trim()))
          .map((msg) =>
            msg.streaming ? { ...msg, streaming: false } : msg,
          ),
        {
          id: createId(),
          timestamp: new Date(),
          type: "user",
          content: text,
        },
      ]);
      setInputValue("");
      setIsLoading(true);
      const generation = ++sendGenerationRef.current;
      const originalText = text.trim();
      rememberUserText(myProfile?._id, originalText);
      const stillCurrent = () => generation === sendGenerationRef.current;

      const history = toLlmHistory(
        messagesRef.current,
        liveTalkOnRef.current ? 3 : 4,
      );

      let streamPrimed = 0;
      const flushStreamMessage = (id, content, streaming) => {
        streamPendingRef.current = { id, content, streaming };
        if (streaming) {
          if (streamPrimed < 8) {
            streamPrimed += 1;
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === id ? { ...msg, content, streaming: true } : msg,
              ),
            );
            return;
          }
          if (streamRafRef.current) return;
          streamRafRef.current = requestAnimationFrame(() => {
            streamRafRef.current = 0;
            const pending = streamPendingRef.current;
            if (!pending || generation !== sendGenerationRef.current) return;
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === pending.id
                  ? {
                      ...msg,
                      content: pending.content,
                      streaming: pending.streaming,
                    }
                  : msg,
              ),
            );
          });
          return;
        }
        if (streamRafRef.current) {
          cancelAnimationFrame(streamRafRef.current);
          streamRafRef.current = 0;
        }
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === id ? { ...msg, content, streaming: false } : msg,
          ),
        );
      };

      const streamAgentReply = async (userText, chatHistory) => {
        const streamId = createId();
        let inserted = false;
        const abort = new AbortController();
        streamAbortRef.current = abort;
        const liveWatchdog = liveTalkOnRef.current
          ? setTimeout(() => {
              if (!stillCurrent()) return;
              abort.abort();
            }, 12000)
          : 0;

        const pushDelta = (next, streaming) => {
          if (!inserted) {
            inserted = true;
            streamPrimed = 1;
            setMessages((prev) => [
              ...prev,
              {
                id: streamId,
                type: "agent",
                content: next,
                streaming,
                timestamp: new Date(),
              },
            ]);
            return;
          }
          flushStreamMessage(streamId, next, streaming);
        };

        try {
          const chat = await sendToGeminiStream(userText, chatHistory, {
            onDelta: (next) => {
              if (!stillCurrent()) {
                abort.abort();
                return;
              }
              if (typeof next !== "string" || !next) return;
              // An action plan streams as JSON: show (and speak) only its
              // "reply" as it arrives, never the raw JSON.
              if (looksLikeAgentPlan(next)) {
                const spoken = extractStreamingPlanReply(next);
                if (spoken) pushDelta(spoken, true);
                return;
              }
              pushDelta(next, true);
            },
            signal: abort.signal,
            voice: liveTalkOnRef.current,
            userName: getConnectDisplayName(myProfile),
            memory: getMemoryPromptBlock(myProfile?._id),
            preferredLanguage,
            allowActions: true,
          });
          if (!stillCurrent()) return;
          const rawFinal = String(chat?.response || "").trim();
          const plan = chat?.success
            ? parseAgentPlan(rawFinal, userText)
            : { reply: rawFinal, intents: [], isPlan: false };
          if (plan.intents.length) {
            const keepReply = inserted && Boolean(plan.reply);
            if (keepReply) flushStreamMessage(streamId, plan.reply, false);
            else if (inserted) {
              setMessages((prev) => prev.filter((msg) => msg.id !== streamId));
            }
            // The streamed reply already told the user what is happening.
            skipAnnounceRef.current = keepReply;
            try {
              await runPlannedIntents(plan);
            } finally {
              skipAnnounceRef.current = false;
            }
            return;
          }
          const finalText = plan.isPlan
            ? plan.reply ||
              "I couldn't turn that into an app action. Could you rephrase it?"
            : rawFinal;
          if (!inserted) {
            pushDelta(
              finalText ||
                "I didn't catch that. Try a short command like “open settings”.",
              false,
            );
            return;
          }
          flushStreamMessage(
            streamId,
            finalText ||
              "I didn't catch that. Try a short command like “open settings”.",
            false,
          );
        } catch (error) {
          if (!stillCurrent()) return;
          if (error?.name === "AbortError") {
            if (inserted) {
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === streamId ? { ...msg, streaming: false } : msg,
                ),
              );
            } else if (liveTalkOnRef.current) {
              addMessage({
                type: "agent",
                content: "I missed that. Say it again.",
              });
            }
            return;
          }
          const errText = error?.message
            ? `Sorry, something went wrong: ${error.message}`
            : "Sorry, something went wrong. Please try again.";
          if (inserted) flushStreamMessage(streamId, errText, false);
          else addMessage({ type: "agent", content: errText });
        } finally {
          if (liveWatchdog) clearTimeout(liveWatchdog);
        }
      };

      // "Stop / bye / থামো" ends a hands-free conversation politely.
      if (liveTalkOnRef.current && STOP_CONVERSATION.test(originalText)) {
        const bangla = detectAgentLanguage(originalText) !== "en";
        const goodbye = bangla
          ? "ঠিক আছে। দরকার হলে আবার ডাকবেন।"
          : "Okay. Call me whenever you need me.";
        setLiveTalkOn(false);
        addMessage({ type: "agent", content: goodbye, skipSpeech: true });
        speakText(goodbye, { lang: bangla ? "bn" : "en" });
        setIsLoading(false);
        return;
      }

      // Answering "which person?" out loud ("দ্বিতীয়জন", "the first one",
      // or a name) picks from the latest person list.
      const lastPicker = messagesRef.current[messagesRef.current.length - 1];
      if (
        lastPicker?.type === "connect-picker" &&
        Array.isArray(lastPicker.connects) &&
        lastPicker.connects.length > 1 &&
        typeof lastPicker.onAction === "function"
      ) {
        const chosen = matchSpokenChoice(
          originalText,
          lastPicker.connects.map((connect) => ({
            name: getConnectDisplayName(connect),
            username: connect?.username,
            raw: connect,
          })),
        );
        if (chosen) {
          try {
            await lastPicker.onAction(chosen.raw);
          } finally {
            if (stillCurrent()) setIsLoading(false);
          }
          return;
        }
      }

      // A spoken/typed "yes"/"no" answers the latest confirmation prompt.
      const latestMessage = messagesRef.current[messagesRef.current.length - 1];
      // Voice transcripts often end with "।" (Bangla full stop).
      const shortAnswer = originalText.replace(/[।.!?\s]+$/u, "");
      if (
        latestMessage?.confirmPrompt &&
        Array.isArray(latestMessage.actions) &&
        (isAffirmativeFollowUp(shortAnswer) || isCancelFollowUp(shortAnswer))
      ) {
        const choice = isAffirmativeFollowUp(shortAnswer)
          ? latestMessage.actions[0]
          : latestMessage.actions[latestMessage.actions.length - 1];
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === latestMessage.id ? { ...msg, confirmPrompt: false } : msg,
          ),
        );
        try {
          await choice?.onClick?.();
        } finally {
          if (stillCurrent()) setIsLoading(false);
        }
        return;
      }

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

      const presentResult = async (result, replyOverride, intent = null) => {
        if (!result || !stillCurrent()) return;
        if (result.success && startsMedia(intent)) setLiveTalkOn(false);
        rememberActionResult(myProfile?._id, {
          action: intent?.action,
          connectName: intent?.targetName,
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
          // Answer like a person, in the user's language, from the real data.
          let answer = "";
          if (result.success && result.data) {
            try {
              answer = await answerFromAppData({
                question: originalText,
                data: result.data,
                conversationHistory: history,
              });
            } catch (_) {
              answer = "";
            }
          }
          if (!stillCurrent()) return;
          addMessage({
            type: "action-result",
            content: answer || replyOverride || result.message,
            success: result.success,
          });
          return;
        }

        if (result.type === "video-results") {
          addMessage({
            type: "video-results",
            content: replyOverride || result.message,
            videos: result.videos,
            query: result.query,
            source: result.source,
            defaultPostAsWatch: result.defaultPostAsWatch !== false,
            audioOnly: result.audioOnly,
            quality: result.quality,
            success: result.success,
            onPlay: handlePlayVideo,
            onDownload: (video, opts) =>
              handleDownloadYoutube(video, {
                ...opts,
                audioOnly: result.audioOnly,
                quality: result.quality,
              }),
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
            onOpenUser: async (user) => {
              await speakUpcomingAction(
                { action: "VIEW_PROFILE" },
                user,
              );
              handleConnectAction(user, "VIEW_PROFILE", {
                action: "VIEW_PROFILE",
              });
            },
            onOpenPost: (post) => {
              if (post?._id) {
                navigate(`/post/${post._id}`);
                handleMinimize();
              }
            },
          });
          return;
        }

        let content = result.success
          ? replyOverride || result.message
          : result.message || replyOverride;
        // Explain failures kindly in Bangla when the user spoke Bangla, like
        // a person reporting back (the technical message stays in English).
        // Fitness/recovery summaries are also read back in Bangla.
        const healthReport = result.success && result.type === "health-report";
        if ((!result.success || healthReport) && detectAgentLanguage(originalText) !== "en") {
          try {
            const explained = await completeChat({
              system: healthReport
                ? "Report these fitness/recovery numbers back to the user in Bangla (Bengali script), warmly, in two or three short spoken sentences with the key numbers. No markdown."
                : "Explain briefly and kindly, in Bangla (Bengali script), what went wrong and what the user can do next. One or two short spoken sentences. No markdown.",
              messages: [
                {
                  role: "user",
                  content: healthReport
                    ? `Request: ${originalText}\nData:\n${result.message}`
                    : `Request: ${originalText}\nProblem: ${result.message}`,
                },
              ],
              temperature: 0.3,
              maxTokens: 120,
              operationLabel: "Failure report",
            });
            if (explained && stillCurrent()) content = String(explained).trim();
          } catch (_) {}
        }
        if (!stillCurrent()) return;
        addMessage({
          type: "action-result",
          content,
          success: result.success,
          location: result.location || null,
        });
      };

      const resolveConnects = async (intent) => {
        const localConnects = Array.isArray(myProfile?.connects)
          ? myProfile.connects
          : [];
        const cached = Array.isArray(connectsCacheRef.current)
          ? connectsCacheRef.current
          : [];
        const connects = cached.length >= localConnects.length ? cached : localConnects;
        // "my mom", "আম্মু", "baba": match the relationship tags on connects
        // (never a name search, which could find a stranger called "Momin").
        const related = matchRelationConnects(
          intent.targetName,
          connects.map((connect) => ({
            id: String(connect?._id || ""),
            name: getConnectDisplayName(connect),
            relationshipTypes: connect?.relationshipTypes,
            gender: connect?.gender || connect?.user?.gender,
            raw: connect,
          })),
        );
        if (related) {
          return {
            matched: related.matches.map((match) => match.raw),
            searchableConnects: connects,
            relation: related.relation,
          };
        }
        const wantedName = stripHonorifics(intent.targetName);
        let matched = searchConnectsByName(connects, wantedName);
        if (matched.length === 0) {
          const names = splitConnectNames(wantedName);
          if (names.length > 1) {
            const seen = new Set();
            matched = [];
            names.forEach((name) => {
              searchConnectsByName(connects, name).forEach((profile) => {
                const id = String(profile?._id || "");
                if (!id || seen.has(id)) return;
                seen.add(id);
                matched.push(profile);
              });
            });
          }
        }
        return { matched, searchableConnects: connects };
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

      const speakUpcomingAction = async (intent, connect = null) => {
        if (!stillCurrent()) return;
        await announceUpcomingAction(intent, connect, originalText);
      };

      const runIntent = async (intent, replyOverride = "", options = {}) => {
        const hadTypedLudoInvitee =
          ["CREATE_LUDO", "INVITE_LUDO"].includes(intent?.action) &&
          splitConnectNames(intent?.targetName).length > 0;
        const nextIntent = applyMemoryToIntent(
          hydrateIntent({
            ...intent,
            sourceText: intent.sourceText || originalText || "",
          }),
          myProfile?._id,
        );
        if (!nextIntent?.action) return false;

        const autoRun = Boolean(
          options.forceExecute ||
            autoRunActionsRef.current ||
            liveTalkOnRef.current,
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
          ? splitConnectNames(nextIntent.targetName)
          : [];

        const needsConnect =
          CONNECT_REQUIRED_ACTIONS.has(nextIntent.action) ||
          (nextIntent.action === "CREATE_LUDO" && hadTypedLudoInvitee) ||
          (nextIntent.action === "QUERY_CONTENT" &&
            String(nextIntent.queryType || "").toLowerCase() === "user");

        if (needsConnect) {
          let { matched, relation } = await resolveConnects(nextIntent);
          const foundInConnects = matched.length > 0;
          const canSearchDirectory = DIRECTORY_LOOKUP_ACTIONS.has(
            nextIntent.action,
          );

          if (relation && !foundInConnects) {
            pauseForInput(
              { ...nextIntent, targetName: null },
              ["targetName"],
              `I couldn't find your ${relation.label} in your connects. Open their profile and set the relationship (for example Parent), or tell me their name.`,
            );
            return true;
          }

          if (!foundInConnects && canSearchDirectory) {
            matched = await searchConnectUsers(nextIntent.targetName, {
              excludeId: myProfile?._id,
            });
          }

          if (matched.length === 0) {
            const askedName = nextIntent.targetName || "that person";
            pauseForInput(
              { ...nextIntent, targetName: null },
              ["targetName"],
              canSearchDirectory
                ? `I couldn't find anyone named "${askedName}" on Connect. Try a username or full name.`
                : `I couldn't find "${askedName}" in your connects list. Who did you mean?`,
            );
            return true;
          }

          if (nextIntent.action === "ADD_CONNECT" && foundInConnects) {
            pendingIntentRef.current = null;
            if (matched.length === 1) {
              addMessage({
                type: "action-result",
                success: true,
                content: `You're already connects with ${getConnectDisplayName(matched[0])}.`,
              });
              return true;
            }
            addMessage({
              type: "connect-picker",
              content: `You're already connects with these people matching "${nextIntent.targetName}". Open a profile?`,
              connects: matched,
              action: "VIEW_PROFILE",
              actionLabel: "View Profile",
              intent: { ...nextIntent, action: "VIEW_PROFILE" },
              onAction: async (connect) => {
                pendingIntentRef.current = null;
                await speakUpcomingAction(
                  { ...nextIntent, action: "VIEW_PROFILE" },
                  connect,
                );
                handleConnectAction(connect, "VIEW_PROFILE", {
                  ...nextIntent,
                  action: "VIEW_PROFILE",
                });
              },
            });
            return true;
          }

          const isMultiLudoInvite =
            ["CREATE_LUDO", "INVITE_LUDO"].includes(nextIntent.action) &&
            ludoInviteNames.length > 1 &&
            matched.length > 1;

          if (isMultiLudoInvite) {
            pendingIntentRef.current = null;
            await speakUpcomingAction(nextIntent, matched[0]);
            const result = await runAction({
              ...nextIntent,
              connect: matched[0],
              extraConnects: matched.slice(1),
              hintText: replyOverride,
              sourceText: originalText,
              myProfile,
              preferredLanguage,
              navigate,
              onClose: handleMinimize,
            });
            await presentResult(result, replyOverride, nextIntent);
            return true;
          }

          const responseMode = getActionResponseMode(nextIntent.action);
          const shouldAutoExecuteSingleMatch =
            matched.length === 1 && (autoRun || responseMode !== "confirm");

          if (shouldAutoExecuteSingleMatch) {
            pendingIntentRef.current = null;
            await speakUpcomingAction(nextIntent, matched[0]);
            if (LOOKUP_ACTIONS.has(nextIntent.action)) {
              const result = await runAction({
                ...nextIntent,
                connect: matched[0],
                hintText: replyOverride,
                sourceText: originalText,
                myProfile,
                preferredLanguage,
                navigate,
                onClose: handleMinimize,
              });
              await presentResult(result, replyOverride, nextIntent);
              return true;
            }
            await handleConnectAction(
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
            type: "connect-picker",
            content:
              replyOverride && looksLikeQuestion(replyOverride)
                ? replyOverride
                : nextIntent.action === "SEND_MESSAGE_TO_USER"
                  ? matched.length === 1
                    ? `Ready to send "${previewText}" to ${getConnectDisplayName(matched[0])}. ${autoRun ? "Running now." : "Click below to send it."}`
                    : `Found ${matched.length} people matching "${nextIntent.targetName}". Which one should receive "${previewText}"?`
                  : matched.length === 1
                    ? `Found ${getConnectDisplayName(matched[0])}! ${autoRun ? "Running now." : "Click below to continue."}`
                    : `Found ${matched.length} people named "${nextIntent.targetName}". Which one?`,
            connects: matched,
            action: nextIntent.action,
            actionLabel: cardLabel,
            intent: nextIntent,
            onAction: async (connect) => {
              pendingIntentRef.current = null;
              await speakUpcomingAction(nextIntent, connect);
              handleConnectAction(connect, nextIntent.action, nextIntent);
            },
          });
          return true;
        }

        if (NO_CONNECT_ACTIONS.has(nextIntent.action)) {
          pendingIntentRef.current = null;
          await speakUpcomingAction(nextIntent);
          const result = await runAction({
            ...nextIntent,
            connect: null,
            hintText: replyOverride,
            sourceText: originalText,
            myProfile,
            preferredLanguage,
            navigate,
            onClose: handleMinimize,
          });
          await presentResult(result, replyOverride, nextIntent);
          return true;
        }

        return false;
      };

      // Runs actions the LLM planned for requests the local parser missed.
      const runPlannedIntents = async ({ reply, intents }) => {
        let handledAny = false;
        for (const intent of intents) {
          if (!stillCurrent()) return;
          if (PLANNER_CONFIRM_ACTIONS.has(intent.action)) {
            const meta = getActionMeta(intent.action);
            const target = intent.searchQuery || intent.label || "";
            addMessage({
              type: "agent",
              confirmPrompt: true,
              content: `${meta.label}${target ? `: "${target}"` : ""}? This can't be undone. Say "yes" or tap below.`,
              // Two buttons on purpose: single-button messages auto-run.
              actions: [
                {
                  label: `Yes, ${meta.label.toLowerCase()}`,
                  onClick: async () => {
                    const result = await runAction({
                      ...intent,
                      connect: null,
                      sourceText: originalText,
                      myProfile,
                      preferredLanguage,
                      navigate,
                      onClose: handleMinimize,
                    });
                    addMessage({
                      type: "action-result",
                      content: result.message,
                      success: result.success,
                    });
                  },
                },
                {
                  label: "Cancel",
                  onClick: () =>
                    addMessage({ type: "agent", content: "Okay, I left it as is." }),
                },
              ],
            });
            handledAny = true;
            continue;
          }
          // Empty replyOverride so real results (not the model's "on it")
          // are shown; a model question is still passed through.
          const handled = await runIntent(
            intent,
            looksLikeQuestion(reply) ? reply : "",
          );
          handledAny = handledAny || handled;
          // Later actions usually depend on a picker/answer for this one.
          if (pendingIntentRef.current) break;
        }
        if (!handledAny && stillCurrent()) {
          addMessage({
            type: "agent",
            content: reply || "I couldn't do that from here. Could you rephrase it?",
          });
        }
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

        const localIntent =
          parseIntent(originalText) ||
          (() => {
            const stripped = stripCommandFiller(originalText);
            const route = findStaticRoute(stripped);
            if (!route?.route) return null;
            return {
              action: "NAVIGATE",
              targetName: null,
              messageText: null,
              searchQuery: null,
              targetRoute: route.route,
              subPath: null,
              label: route.label,
              params: {},
            };
          })();
        if (localIntent && isFastLocalIntent(localIntent, originalText)) {
          const handled = await runIntent(hydrateIntent(localIntent), "", {
            forceExecute: autoRun,
          });
          if (!stillCurrent()) return;
          if (handled) return;
        }

        await streamAgentReply(originalText, history);
        return;
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
      runAction,
      inputValue,
      myProfile,
      navigate,
      handleMinimize,
      addMessage,
      handleConnectAction,
      handlePlayVideo,
      handleDownloadYoutube,
      cancelSpeech,
      announceUpcomingAction,
      preferredLanguage,
      speakText,
    ],
  );

  useEffect(() => {
    if (!isOpen || (!autoRunActions && !liveTalkOn) || messages.length === 0) {
      return;
    }

    const latestMessage = messages[messages.length - 1];
    if (autoRunMessageIdsRef.current.has(latestMessage.id)) return;

    const action = getSingleMessageAction(latestMessage);
    if (!action) return;

    autoRunMessageIdsRef.current.add(latestMessage.id);
    Promise.resolve(action()).catch((error) => {
      console.error("[AIAgentModal] Auto-run action failed:", error);
    });
  }, [messages, autoRunActions, liveTalkOn, isOpen]);

  useEffect(() => {
    if (!isOpen || !(liveTalkOn || speakReplies)) return;
    const latest = messages[messages.length - 1];
    if (!latest || latest.type === "user" || isWelcomeMessage(latest)) return;
    const content = String(latest.content || "").trim();
    if (!content) return;
    const latestUserMessage = [...messages]
      .reverse()
      .find((item) => item?.type === "user");
    const responseLanguage = detectAgentLanguage(latestUserMessage?.content);

    if (latest.skipSpeech) {
      spokenMessageIdsRef.current.add(latest.id);
      return;
    }
    if (latest.streaming) {
      feedSpeech(latest.id, content, responseLanguage);
      return;
    }

    if (spokenMessageIdsRef.current.has(latest.id)) return;
    spokenMessageIdsRef.current.add(latest.id);
    flushSpeech(latest.id, content, responseLanguage);
  }, [messages, liveTalkOn, speakReplies, isOpen, feedSpeech, flushSpeech]);

  const liveTalkStuck =
    Boolean(liveTalkOn) &&
    (isLoading || messages.some((item) => item?.streaming));

  useEffect(() => {
    if (!isOpen || !liveTalkStuck) return undefined;
    const timer = setTimeout(() => {
      streamAbortRef.current?.abort();
      setMessages((prev) =>
        prev.map((msg) =>
          msg.streaming ? { ...msg, streaming: false } : msg,
        ),
      );
      setIsLoading(false);
    }, 14000);
    return () => clearTimeout(timer);
  }, [isOpen, liveTalkStuck]);

  const handleToggleLiveTalk = useCallback(() => {
    setLiveTalkOn((on) => {
      const next = !on;
      if (next) {
        messagesRef.current.forEach((item) => {
          if (item?.id != null) spokenMessageIdsRef.current.add(item.id);
        });
        // Start listening at once: no spoken "I'm listening" to wait for,
        // just a short vibration where supported. Voice in -> voice out.
        try {
          navigator.vibrate?.(30);
        } catch (_) {}
        setSpeakReplies(true);
      } else {
        streamAbortRef.current?.abort();
        sendGenerationRef.current += 1;
        setIsLoading(false);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.streaming ? { ...msg, streaming: false } : msg,
          ),
        );
        cancelSpeech();
      }
      return next;
    });
  }, [cancelSpeech]);

  // Checks the mic, then turns hands-free talk on. Resolves false when the
  // microphone is unavailable.
  const startHandsFreeTalk = useCallback(async () => {
    if (liveTalkOnRef.current) return true;
    // Skip the permission probe (a full mic open/close) once access was
    // already granted, so listening starts without delay.
    let alreadyGranted = false;
    try {
      const status = await navigator.permissions?.query?.({ name: "microphone" });
      alreadyGranted = status?.state === "granted";
    } catch (_) {}
    if (!alreadyGranted && navigator?.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        stream.getTracks().forEach((track) => track.stop());
      } catch (_) {
        addMessage({
          type: "agent",
          content:
            "I couldn't access the microphone. Allow it in your browser, then shake again or tap the mic.",
          skipSpeech: true,
        });
        return false;
      }
    }
    if (!liveTalkOnRef.current) handleToggleLiveTalk();
    return true;
  }, [addMessage, handleToggleLiveTalk]);

  const handleMiniMicToggle = useCallback(() => {
    if (liveTalkOnRef.current) handleToggleLiveTalk();
    else startHandsFreeTalk();
  }, [handleToggleLiveTalk, startHandsFreeTalk]);

  // Shake / long-press: open minimized and start hands-free talk straight
  // away, like the Expo app. Each request number starts voice once.
  const voiceStartKeyRef = useRef(null);
  useEffect(() => {
    if (!isOpen || !autoStartVoice) {
      voiceStartKeyRef.current = null;
      return;
    }
    if (voiceStartKeyRef.current === voiceStartRequest) return;
    voiceStartKeyRef.current = voiceStartRequest;
    setSettingsOpen(false);
    setIsMinimized(true);
    startHandsFreeTalk();
  }, [isOpen, autoStartVoice, voiceStartRequest, startHandsFreeTalk]);

  /**
   * Stop button: cuts off thinking, speaking and the running action. In
   * hands-free talk the mic reopens straight after, like a person who stops
   * talking when interrupted.
   */
  const handleStopAgent = useCallback(() => {
    streamAbortRef.current?.abort();
    sendGenerationRef.current += 1;
    pendingIntentRef.current = null;
    setIsLoading(false);
    setRunningLabel("");
    setMessages((prev) =>
      prev
        .filter((msg) => !(msg.streaming && !String(msg.content || "").trim()))
        .map((msg) => (msg.streaming ? { ...msg, streaming: false } : msg)),
    );
    cancelSpeech();
  }, [cancelSpeech]);

  // Hands-free talk ends after 90 s without speech, with a short goodbye.
  useEffect(() => {
    if (!isOpen || !liveTalkOn || isLoading || isAgentSpeaking) return undefined;
    const timer = setTimeout(() => {
      const lastUser = [...messagesRef.current]
        .reverse()
        .find((item) => item?.type === "user");
      const bangla = detectAgentLanguage(lastUser?.content || "") !== "en";
      const goodbye = bangla
        ? "আমি একটু বিরতি নিচ্ছি। দরকার হলে মাইক চাপুন।"
        : "I'll pause for now. Tap the mic when you need me.";
      setLiveTalkOn(false);
      addMessage({ type: "agent", content: goodbye, skipSpeech: true });
      speakText(goodbye, { lang: bangla ? "bn" : "en" });
    }, 90000);
    return () => clearTimeout(timer);
  }, [isOpen, liveTalkOn, isLoading, isAgentSpeaking, inputValue, messages, addMessage, speakText]);

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
    setLiveTalkOn(false);
    cancelSpeech();
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
  }, [isLoading, messages, myProfile?._id, cancelSpeech]);

  const lastStreaming = Boolean(messages[messages.length - 1]?.streaming);
  const agentBusy = Boolean(
    isLoading || lastStreaming || isAgentSpeaking || runningLabel,
  );
  const bn = preferredLanguage === "bn";
  // Only the welcome message so far: show the start screen instead.
  const isFreshChat = messages.every((item) => isWelcomeMessage(item));
  const statusLabel = runningLabel
    ? `Running · ${runningLabel}`
    : lastStreaming || isLoading
      ? "Thinking…"
      : isAgentSpeaking
        ? "Speaking…"
        : liveTalkOn
          ? "Hands-free voice mode"
          : autoRunActions
            ? "Auto-runs actions"
            : "Asks before acting";
  const statusTone =
    runningLabel || lastStreaming || isLoading
      ? "busy"
      : liveTalkOn || isAgentSpeaking
        ? "live"
        : "ok";
  const miniStatus = runningLabel
    ? `${runningLabel}…`
    : lastStreaming || isLoading
      ? "Thinking…"
      : isAgentSpeaking
        ? "Speaking…"
        : liveTalkOn
          ? inputValue.trim() || "Listening…"
          : "Tap to open";

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className={`ai-agent-modal-backdrop xa-shell${isMinimized ? " is-minimized" : ""}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={isMinimized ? undefined : handleMinimize}
        >
          {isMinimized ? (
            <MiniBubble
              status={miniStatus}
              busy={agentBusy}
              listening={liveTalkOn}
              speakReplies={speakReplies || liveTalkOn}
              onOpen={handleExpand}
              onStop={handleStopAgent}
              onMic={handleMiniMicToggle}
              onSpeaker={() => setSpeakReplies((value) => !value)}
              onClose={handleClose}
            />
          ) : null}
          <motion.div
            className="ai-agent-modal-container xa-panel"
            initial={{ opacity: 0, y: 60, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.97 }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            onClick={(e) => e.stopPropagation()}
            onPointerDownCapture={() =>
              setModalInteractionVersion((value) => value + 1)
            }
          >
            <ModalHeader
              onClose={handleClose}
              onMinimize={handleMinimize}
              autoRunActions={autoRunActions}
              onToggleAutoRun={() => setAutoRunActions((value) => !value)}
              speakReplies={speakReplies || liveTalkOn}
              onToggleSpeak={() => {
                if (speakReplies || liveTalkOn) cancelSpeech();
                setSpeakReplies((value) => !(value || liveTalkOn));
              }}
              onOpenSettings={() => setSettingsOpen((value) => !value)}
              onClearChat={handleClearChat}
              canClearChat={!isLoading && !isFreshChat}
              settingsOpen={settingsOpen}
              providerLabel={llmInfo.meta?.shortLabel || "AI"}
              modelLabel={String(llmInfo.model || "").split("/").pop()}
              statusLabel={statusLabel}
              statusTone={statusTone}
            />

            <div className="ai-agent-modal-body">
              {settingsOpen && (
                <div className="ai-agent-settings-overlay">
                  <AgentSettingsPanel onClose={() => setSettingsOpen(false)} />
                </div>
              )}
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
                  liveTalkOn={liveTalkOn}
                  onToggleLiveTalk={handleToggleLiveTalk}
                  onStartTalk={() => {
                    if (isLoading || lastStreaming || isAgentSpeaking) handleStopAgent();
                    startHandsFreeTalk();
                  }}
                  onInterruptSpeech={cancelSpeech}
                  onStop={handleStopAgent}
                  isSpeaking={isAgentSpeaking}
                  speechSupported={speechSupported}
                  onPlayVideo={handlePlayVideo}
                  onDownloadYoutube={handleDownloadYoutube}
                  isFreshChat={isFreshChat}
                  runningLabel={runningLabel}
                  bn={bn}
                />
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/**
 * Minimized agent: a floating, draggable card like the app's mini bubble,
 * with Stop (while busy), mic and speaker controls.
 */
const MiniBubble = ({
  status,
  busy,
  listening,
  speakReplies,
  onOpen,
  onStop,
  onMic,
  onSpeaker,
  onClose,
}) => {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef(null);
  const onPointerDown = (event) => {
    if (event.target.closest("button")) return;
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      base: offset,
      moved: false,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const onPointerMove = (event) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
    setOffset({ x: drag.base.x + dx, y: drag.base.y + dy });
  };
  const onPointerUp = () => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (drag && !drag.moved) onOpen();
  };
  return (
    <div
      className="xa-mini"
      style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      role="button"
      tabIndex={0}
      aria-label={`AI Agent. ${status}. Tap to open.`}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
    >
      <button
        type="button"
        className="xa-mini-close"
        onClick={onClose}
        aria-label="Close AI Agent"
      >
        <i className="fas fa-times" />
      </button>
      <span className="xa-orb xa-mini-orb" aria-hidden="true">
        {busy ? (
          <i className="fas fa-circle-notch fa-spin" />
        ) : (
          <i className="fas fa-magic" />
        )}
      </span>
      <span className="xa-mini-status">{status}</span>
      <span className="xa-mini-controls">
        {busy ? (
          <button
            type="button"
            className="xa-mini-btn is-stop"
            onClick={onStop}
            aria-label="Stop"
          >
            <i className="fas fa-stop" />
          </button>
        ) : null}
        <button
          type="button"
          className={`xa-mini-btn${listening ? " is-live" : ""}`}
          onClick={onMic}
          aria-label={listening ? "Stop listening" : "Voice input"}
        >
          <i className={`fas ${listening ? "fa-microphone" : "fa-microphone-alt"}`} />
        </button>
        <button
          type="button"
          className={`xa-mini-btn${speakReplies ? " is-on" : ""}`}
          onClick={onSpeaker}
          aria-label={speakReplies ? "Turn speaking off" : "Turn speaking on"}
        >
          <i className={`fas ${speakReplies ? "fa-volume-up" : "fa-volume-mute"}`} />
        </button>
      </span>
    </div>
  );
};

export default AIAgentModal;
