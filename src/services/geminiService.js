/**
 * Connect AI Agent LLM service.
 * Provider, model, and API keys always come from live AI Agent settings.
 */

import {
  AGENT_ACTIONS,
  CONNECT_ROUTES,
  QUERY_TYPES,
  normalizeAskField,
  recoverAgentActions,
  toAgentIntent,
} from "../components/modal/AIAgentModal/agentCatalog";
import {
  detectAgentLanguage,
  languageSystemHint,
  normalizeBanglishCommand,
} from "../components/modal/AIAgentModal/banglish";
import { normalizeBanglaCommand } from "../components/modal/AIAgentModal/agentFastPath";
import {
  completeChat,
  streamChat,
  extractGeminiText,
  isGeminiQuotaError,
  fetchAiProviderStatus,
} from "./llmClient";
import {
  getResolvedAgentSettings,
  hasConfiguredApiKey,
  parseApiKeys as parseGeminiApiKeys,
} from "./aiAgentSettings";

export { parseGeminiApiKeys, isGeminiQuotaError, extractGeminiText };

export const SYSTEM_PROMPT = `Connect assistant. Reply in the user's language (English, Bangla, or Banglish). Answer directly in 1–2 short sentences. Never invent app data, names, or results. If unclear, ask one brief question. No markdown.`;

// Argument hints for the action planner. Fields map onto toAgentIntent():
// targetName (person), messageText, searchQuery, targetRoute, subPath, queryType.
const PERSON = "targetName";
const ACTION_PARAM_HINTS = {
  VIDEO_CALL: PERSON,
  AUDIO_CALL: PERSON,
  SEND_MESSAGE: `${PERSON} (opens chat)`,
  SEND_MESSAGE_TO_USER: `${PERSON}, messageText`,
  BUMP: PERSON,
  BLOCK: PERSON,
  UNBLOCK: PERSON,
  ADD_CONNECT: PERSON,
  UNFRIEND: PERSON,
  VIEW_PROFILE: PERSON,
  NAVIGATE_PROFILE: `${PERSON}, subPath (/about|/photos|/videos|/connects)`,
  GET_LOCATION: PERSON,
  GET_BIO: PERSON,
  INVITE_LUDO: `${PERSON} (comma-separate several)`,
  INVITE_CHESS: PERSON,
  ACCEPT_CONNECT: "searchQuery=requester name (optional)",
  DECLINE_CONNECT: "searchQuery=requester name (optional)",
  NAVIGATE: "targetRoute (from ROUTES)",
  CREATE_POST: "searchQuery=caption",
  DELETE_POST: "searchQuery=which post",
  CREATE_NOTE: "searchQuery=note text",
  EDIT_NOTE: "searchQuery=which note, messageText=new text",
  DELETE_NOTE: "searchQuery=which note",
  CREATE_TASK: "searchQuery=task text",
  EDIT_TASK: "searchQuery=which task, messageText=new text",
  DELETE_TASK: "searchQuery=which task",
  CREATE_EVENT: "searchQuery=title plus day/time words",
  EDIT_EVENT: "searchQuery=which event, messageText=new title",
  DELETE_EVENT: "searchQuery=which event",
  CREATE_HABIT: "searchQuery=habit name",
  EDIT_HABIT: "searchQuery=which habit, messageText=new name",
  DELETE_HABIT: "searchQuery=which habit",
  SEARCH_YOUTUBE: "searchQuery",
  DOWNLOAD_YOUTUBE: "searchQuery=video name or URL",
  OPEN_VIDEO_PLAYER: "searchQuery=video URL",
  SEARCH_VIDEO: "searchQuery",
  SEARCH_USERS: "searchQuery",
  SEARCH_POSTS: "searchQuery",
  SEARCH_APP: "searchQuery",
  UPDATE_SETTINGS: 'searchQuery=change, e.g. "dark theme", "private profile"',
  UPDATE_LANGUAGE_SETTINGS: 'searchQuery="bangla"|"english"',
  LOG_HEALTH: "searchQuery=weight/meal/workout details",
  LOG_RECOVERY: "searchQuery=mood/craving details",
  RECOVERY_SUPPORT: "searchQuery",
  QUERY_CONTENT: `queryType (${QUERY_TYPES.join("|")}), searchQuery`,
};

// Actions that need structured params the planner can't provide reliably.
const PLANNER_HIDDEN_ACTIONS = new Set([
  "LOG_FITNESS_MEAL",
  "LOG_FITNESS_WEIGHT",
  "CREATE_FITNESS_REMINDER",
  "ASK_FITNESS_COACH",
  "ADD_RECOVERY_DATA",
]);

// Actions the planner may only propose; the user confirms before they run.
export const PLANNER_CONFIRM_ACTIONS = new Set([
  "DELETE_POST",
  "DELETE_NOTE",
  "DELETE_TASK",
  "DELETE_EVENT",
  "DELETE_HABIT",
  "BLOCK",
  "UNFRIEND",
]);

let cachedActionPrompt = "";
export const buildAgentActionPrompt = () => {
  if (cachedActionPrompt) return cachedActionPrompt;
  const actions = Object.keys(AGENT_ACTIONS)
    .filter((name) => !PLANNER_HIDDEN_ACTIONS.has(name))
    .map((name) =>
      ACTION_PARAM_HINTS[name] ? `${name}(${ACTION_PARAM_HINTS[name]})` : name,
    )
    .join("; ");
  const routes = CONNECT_ROUTES.filter(
    (entry) => !["/login", "/signup"].includes(entry.route),
  )
    .map((entry) => `${entry.route}=${entry.label}`)
    .join(", ");
  cachedActionPrompt = `You can operate the Connect app. If the user asks you to DO something in the app, output ONLY JSON (no prose, no fences): {"reply":"short confirmation in the user's language","actions":[{"action":"NAME",...fields}]}. Use at most 3 actions, exact names from ACTIONS, and only the listed fields. Write targetName as it appears on a profile: transliterate Bangla names to English letters (রহিম -> Rahim) and drop honorifics like ভাই/আপা/আপু/bhai/apu; resolve "him/her/that" from Ctx. For questions about the user's own data use QUERY_CONTENT. If anything required is missing, ask one short question in plain text instead. For normal conversation reply in plain text.\nACTIONS: ${actions}\nROUTES: ${routes}`;
  return cachedActionPrompt;
};

const PLAN_JSON_ESCAPES = { n: " ", t: " ", r: "", '"': '"', "\\": "\\", "/": "/" };

/**
 * Pulls the user-facing "reply" out of a JSON plan while it is still
 * streaming, so the agent can start talking before the plan is complete.
 */
export const extractStreamingPlanReply = (partial = "") => {
  const match = String(partial || "").match(
    /"(?:reply|message)"\s*:\s*"((?:[^"\\]|\\.)*)/,
  );
  if (!match) return "";
  return match[1]
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16)),
    )
    .replace(/\\(.)/g, (_, char) => PLAN_JSON_ESCAPES[char] ?? char)
    .replace(/\\$/, "");
};

/** True while a streamed reply looks like a JSON action plan, not prose. */
export const looksLikeAgentPlan = (text = "") => {
  const trimmed = String(text || "").trimStart();
  return trimmed.startsWith("{") || /^```(?:json)?/i.test(trimmed);
};

/**
 * Turns an LLM reply into { reply, intents }. Plain-text replies return no
 * intents; malformed or unknown actions are dropped.
 */
export const parseAgentPlan = (text = "", userMessage = "") => {
  const raw = String(text || "").trim();
  const parsed = raw.includes("{") ? extractJsonObject(raw) : null;
  if (!parsed || typeof parsed !== "object") {
    return { reply: raw, intents: [], isPlan: false };
  }
  const reply = String(parsed.reply || parsed.message || "").trim();
  let rawActions = parsed.actions;
  if (!Array.isArray(rawActions)) {
    rawActions = rawActions && typeof rawActions === "object"
      ? [rawActions]
      : parsed.action
        ? [parsed]
        : [];
  }
  const intents = recoverAgentActions({
    actions: rawActions,
    reply,
    userMessage,
  })
    .map((item) => {
      const intent = toAgentIntent(item || {});
      if (!intent) return null;
      // Forward the few extra fields toAgentIntent() does not carry.
      if (item?.subPath && !intent.subPath) intent.subPath = item.subPath;
      return intent;
    })
    .filter(Boolean)
    .slice(0, 3);
  return { reply, intents, isPlan: true };
};

const toChatMessages = (conversationHistory = [], message, limit = 3, clip = 140) => {
  const messages = [];
  let foundFirstUser = false;
  const history = conversationHistory.slice(-limit);
  for (const msg of history) {
    const role = msg.role === "assistant" ? "assistant" : "user";
    if (!foundFirstUser && role !== "user") continue;
    foundFirstUser = true;
    const content = typeof msg.content === "string" ? msg.content : "";
    if (!content.trim()) continue;
    messages.push({
      role,
      content: content.length > clip ? `${content.slice(0, clip - 1)}…` : content,
    });
  }
  if (message != null) {
    const content = String(message);
    messages.push({
      role: "user",
      content: content.length > 280 ? `${content.slice(0, 279)}…` : content,
    });
  }
  return messages;
};

const missingKeyResult = () => ({
  response:
    "No API key is configured for the selected provider. Add it in Connect Admin → Settings → AI, or paste a personal key in the agent gear menu.",
  suggestedAction: null,
  success: false,
});

export const translateBanglaToEnglish = async (text) => {
  const sourceText = String(text || "").trim();
  if (!sourceText) return sourceText;
  const banglish = normalizeBanglishCommand(sourceText);
  if (banglish && banglish !== sourceText) return banglish;
  const bangla = normalizeBanglaCommand(sourceText);
  if (bangla && bangla !== sourceText) return bangla;
  return sourceText;
};

const extractJsonObject = (text = "") => {
  const raw = String(text || "").trim();
  if (!raw) return null;

  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] || raw;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;

  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
};

const AGENT_JSON_PROMPT = `Connect command parser. Return JSON only:
{"reply":"","actions":[],"ask":{"field":null,"question":null}}
Use at most 1 action. Never guess names; resolve him/that/yes from context.
NAVIGATE routes: / /message /connects /watch /notes /tasks /settings /ludo-game /yt-download.`;

const omitEmpty = (value) => {
  if (Array.isArray(value)) {
    const items = value.map(omitEmpty).filter((item) => item != null && item !== "");
    return items.length ? items : undefined;
  }
  if (value && typeof value === "object") {
    const out = {};
    for (const [key, nested] of Object.entries(value)) {
      const next = omitEmpty(nested);
      if (next == null || next === "") continue;
      if (Array.isArray(next) && next.length === 0) continue;
      out[key] = next;
    }
    return Object.keys(out).length ? out : undefined;
  }
  return value == null || value === "" ? undefined : value;
};

const compactInterpreterContext = (appContext = {}, slim = false) => {
  const connects = Array.isArray(appContext.connects) ? appContext.connects : [];
  const memory = appContext.memory && typeof appContext.memory === "object"
    ? {
        ...appContext.memory,
        facts: Array.isArray(appContext.memory.facts)
          ? appContext.memory.facts.slice(0, slim ? 6 : 10)
          : undefined,
      }
    : undefined;
  return omitEmpty({
    me: appContext.user?.name || undefined,
    connects: connects
      .slice(0, slim ? 8 : 12)
      .map((connect) => connect?.name || connect)
      .filter(Boolean),
    pending: appContext.pendingIntent || undefined,
    mem: memory,
  }) || {};
};

export const interpretAgentCommand = async ({
  message,
  conversationHistory = [],
  appContext = {},
} = {}) => {
  const sourceText = String(message || "").trim();
  if (!sourceText) {
    return { reply: "", actions: [], success: false };
  }

  if (!hasConfiguredApiKey()) {
    return { reply: "", actions: [], success: false };
  }

  const settings = getResolvedAgentSettings();
  if (settings.provider === "cursor") {
    return { reply: "", actions: [], success: false };
  }

  const context = JSON.stringify(compactInterpreterContext(appContext, true));
  const rawText = await completeChat({
    system: `${AGENT_JSON_PROMPT}\nC:${context}`,
    messages: toChatMessages(conversationHistory, sourceText, 2, 120),
    json: true,
    temperature: 0,
    maxTokens: 128,
    timeoutMs: 20000,
    operationLabel: "Agent interpreter",
  });

  const parsed = extractJsonObject(rawText);
  const reply = String(parsed?.reply || "").trim();
  let rawActions = parsed?.actions;
  if (!Array.isArray(rawActions)) {
    if (rawActions && typeof rawActions === "object") {
      rawActions = [rawActions];
    } else if (parsed?.action) {
      rawActions = [parsed];
    } else {
      rawActions = [];
    }
  }

  const askRaw = parsed?.ask;
  const ask =
    askRaw && typeof askRaw === "object"
      ? {
          field: normalizeAskField(askRaw.field || askRaw.slot),
          question: String(askRaw.question || askRaw.prompt || "").trim(),
        }
      : null;

  return {
    reply,
    actions: rawActions,
    ask: ask?.field || ask?.question ? ask : null,
    success: Boolean(parsed),
    raw: parsed,
  };
};

export const generateSmartReplies = async ({
  postCaption = "",
  lastComment = "",
} = {}) => {
  const fallback = ["Love this", "So true", "Tell me more"];
  if (!hasConfiguredApiKey()) return fallback;

  try {
    const raw = await completeChat({
      system: `Write 3 short social comment replies (max 6 words each). Match the post's language (Bangla or English). Be warm, specific, not generic spam. Return ONLY a JSON array of 3 strings.`,
      messages: [
        {
          role: "user",
          content: `Post: ${String(postCaption || "").slice(0, 280)}\nLatest comment: ${String(lastComment || "").slice(0, 160)}`,
        },
      ],
      json: true,
      temperature: 0.7,
      maxTokens: 120,
      operationLabel: "Smart replies",
    });
    const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
    if (!Array.isArray(parsed)) return fallback;
    return parsed
      .map((item) => String(item || "").trim())
      .filter(Boolean)
      .slice(0, 3);
  } catch (_) {
    return fallback;
  }
};

const fallbackPostCaption = (userRequest = "", preferredLanguage = "eng") => {
  const request = String(userRequest || "").trim().toLowerCase();
  if (preferredLanguage === "bn") {
    if (request.includes("funny") || request.includes("witty")) {
      return "ভালো সময়, দারুণ গল্প আর একটু মজার বিশৃঙ্খলা 😄";
    }
    if (request.includes("video")) return "এই মুহূর্তটি আবার দেখার মতো 🎬";
    if (request.includes("photo") || request.includes("image")) {
      return "কিছু মুহূর্ত ধরে রাখতেই হয় ✨";
    }
    if (request.includes("improve") || request.includes("finish")) {
      return "এই মুহূর্তে একটু বাড়তি ঝলক ✨";
    }
    return "ছোট ছোট মুহূর্ত, বড় বড় স্মৃতি ✨";
  }
  if (request.includes("funny") || request.includes("witty")) {
    return "Good vibes, great stories, and a little chaos 😄";
  }
  if (request.includes("video")) {
    return "Moments like this deserve a replay. 🎬";
  }
  if (request.includes("photo") || request.includes("image")) {
    return "Some moments are just too good not to keep. ✨";
  }
  if (request.includes("improve") || request.includes("finish")) {
    return "A little extra sparkle for this moment ✨";
  }
  return "Little moments, big memories. ✨";
};

export const generatePostCaption = async (
  userRequest = "",
  preferredLanguage = "eng",
) => {
  // Refresh the live provider before checking readiness. The initial web
  // settings default to Ollama, which is considered configured locally and
  // would otherwise prevent the admin Gemini configuration from loading.
  try {
    await fetchAiProviderStatus();
  } catch (_) {
    // Keep the local fallback available when the provider status endpoint is unavailable.
  }

  if (!hasConfiguredApiKey()) {
    return fallbackPostCaption(userRequest, preferredLanguage);
  }

  try {
    let caption = (
      await completeChat({
        system: `Write one original social-media caption for Connect. Use the user's preferred language: ${
          preferredLanguage === "bn" ? "Bangla" : "English"
        }. If the user explicitly writes in another language, follow that language. Treat the request as the user's current caption context: preserve its meaning, tone, and important details, then improve or complete it. Use the attached image as additional context when provided. If they asked for funny, make it witty. Return ONLY the caption — no quotes, no preamble, no hashtags unless they fit naturally. Max 180 characters.`,
        messages: [
          {
            role: "user",
            content:
              String(userRequest || "").trim() || "Write a short funny caption.",
          },
        ],
        temperature: 0.85,
        maxTokens: 80,
        timeoutMs: 30000,
        operationLabel: "Post caption",
      })
    )
      .replace(/^here(?:'s| is)[^.:\n]*[:\-]\s*/i, "")
      .trim();

    caption = caption.replace(/^['"‘’“”]+/, "").replace(/['"‘’“”]+$/, "").trim();
    return caption
      ? caption.slice(0, 500)
      : fallbackPostCaption(userRequest, preferredLanguage);
  } catch (error) {
    console.warn("Caption generation failed, using local fallback:", error);
    return fallbackPostCaption(userRequest, preferredLanguage);
  }
};

export const answerFromAppData = async ({
  question,
  data,
  conversationHistory = [],
} = {}) => {
  const payload = JSON.stringify(data ?? {}, null, 0).slice(0, 8000);
  const response = await completeChat({
    system: `Answer only from the supplied app JSON. If absent, say you could not find it. Be concise and use the question's language. Never invent names, counts, dates, or captions.`,
    messages: toChatMessages(
      conversationHistory.slice(-4),
      `Question:\n${question}\n\nApp data JSON:\n${payload}`,
    ),
    temperature: 0.2,
    maxTokens: 320,
    operationLabel: "App data answer",
  });
  if (!response) {
    throw new Error("The model returned an empty grounded answer");
  }
  return response;
};

export const sendToGeminiStream = async (
  message,
  conversationHistory = [],
  {
    onDelta,
    signal,
    voice = false,
    userName = "",
    memory = null,
    preferredLanguage = "eng",
    allowActions = false,
  } = {},
) => {
  if (!hasConfiguredApiKey()) {
    const missing = missingKeyResult();
    onDelta?.(missing.response);
    return missing;
  }

  const detectedLanguage = detectAgentLanguage(message);
  const lang =
    detectedLanguage === "en" && preferredLanguage === "bn"
      ? "bn"
      : detectedLanguage;
  const extra = [languageSystemHint(lang)];
  if (userName) extra.push(`User: ${userName}.`);
  if (!voice && memory && typeof memory === "object") {
    const compact = omitEmpty({
      connect: memory.connect,
      yt: memory.yt,
      action: memory.action,
      caption: memory.caption,
    });
    if (compact) extra.push(`Ctx:${JSON.stringify(compact)}`);
  }
  if (voice) extra.push("Live voice. 1–2 short sentences.");
  if (allowActions) extra.push(`\n${buildAgentActionPrompt()}`);

  try {
    const responseText = await streamChat({
      system: `${SYSTEM_PROMPT} ${extra.join(" ")}`,
      messages: toChatMessages(
        conversationHistory,
        message,
        voice ? 3 : 4,
        voice ? 110 : 140,
      ),
      temperature: voice ? 0.15 : 0.25,
      // Action plans are JSON and need more room than a one-line reply.
      maxTokens: allowActions ? 220 : voice ? 80 : 120,
      timeoutMs: voice ? 10000 : 12000,
      operationLabel: "Chat request",
      onDelta,
      signal,
    });

    if (!responseText) {
      throw new Error("The model returned an empty response. Please try again.");
    }

    const suggestedAction = extractSuggestedAction(responseText);
    return { response: responseText, suggestedAction, success: true };
  } catch (error) {
    if (error?.name === "AbortError") {
      throw error;
    }
    return {
      response: `Sorry, something went wrong: ${error.message}`,
      suggestedAction: null,
      success: false,
    };
  }
};

export const sendToGemini = async (message, conversationHistory = []) =>
  sendToGeminiStream(message, conversationHistory);

/**
 * Try to pull a short suggested next-action string out of the AI's reply.
 * Returns null when nothing clear is found.
 *
 * @param {string} text
 * @returns {string|null}
 */
function extractSuggestedAction(text) {
  const patterns = [
    /(?:try|consider|maybe|you could|I suggest|recommend):\s*(.+?)(?:\.|$)/i,
    /(?:next step|next action):\s*(.+?)(?:\.|$)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return match[1].trim().substring(0, 100);
    }
  }
  return null;
}

/**
 * Return the list of capability categories shown in the sidebar.
 * @returns {Array}
 */
export const getAICapabilities = () => [
  {
    category: "Search & Discover",
    items: [
      "Find users",
      "Search posts",
      "Discover videos",
      "Find trending content",
    ],
  },
  {
    category: "Create & Share",
    items: [
      "Create new post",
      "Upload video",
      "Start live stream",
      "Create story",
    ],
  },
  {
    category: "Analytics & Insights",
    items: [
      "Summarize content",
      "Get recommendations",
      "Analyze sentiment",
      "View statistics",
    ],
  },
  {
    category: "Assistance",
    items: ["Write caption", "Translate text", "Get help", "Report issue"],
  },
];

/**
 * Return metadata about the model being used.
 * @returns {Object}
 */
export const getModelInfo = () => {
  const settings = getResolvedAgentSettings();
  return {
    name: settings.model,
    provider: settings.meta.shortLabel,
    providerId: settings.provider,
    maxTokens: 1024,
    description: `${settings.meta.label} · ${settings.model}`,
    hasKey: settings.hasKey,
    keySource: settings.keySource,
  };
};

const geminiService = {
  buildAgentActionPrompt,
  parseAgentPlan,
  sendToGemini,
  sendToGeminiStream,
  translateBanglaToEnglish,
  interpretAgentCommand,
  generatePostCaption,
  generateSmartReplies,
  answerFromAppData,
  getAICapabilities,
  getModelInfo,
};
export default geminiService;
