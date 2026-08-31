/**
 * Connect AI Agent LLM service.
 * Provider, model, and API keys always come from live AI Agent settings.
 */

import { normalizeAskField } from "../components/modal/AIAgentModal/agentCatalog";
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
} from "./llmClient";
import {
  getResolvedAgentSettings,
  hasConfiguredApiKey,
  parseApiKeys as parseGeminiApiKeys,
} from "./aiAgentSettings";

export { parseGeminiApiKeys, isGeminiQuotaError, extractGeminiText };

const SYSTEM_PROMPT = `Connect companion. English/Bangla/Banglish. 1–2 short sentences. No markdown.`;

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

const AGENT_JSON_PROMPT = `Connect interpreter. JSON only:
{"reply":"short","actions":[{"action":"NAME","targetName":null,"targetRoute":null,"searchQuery":"","messageText":"","queryType":null}],"ask":{"field":null,"question":null}}
1 action or none. Never guess names. him/that/yes continue prior.
NAVIGATE routes: / /message /friends /watch /notes /tasks /settings /ludo-game /yt-download
SEARCH_YOUTUBE/DOWNLOAD_YOUTUBE use searchQuery. INVITE_LUDO needs targetName.`;

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
  const friends = Array.isArray(appContext.friends) ? appContext.friends : [];
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
    friends: friends
      .slice(0, slim ? 8 : 12)
      .map((friend) => friend?.name || friend)
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
    timeoutMs: 8000,
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

export const generateCaptionRoast = async (caption = "") => {
  if (!hasConfiguredApiKey()) {
    return "This caption is doing the most and I respect the confidence.";
  }
  let roast = (
    await completeChat({
      system: `Write one playful roast of this social caption. Keep it kind, never cruel, never about appearance. Max 140 characters. Return ONLY the roast.`,
      messages: [{ role: "user", content: String(caption || "this post").slice(0, 400) }],
      temperature: 0.9,
      maxTokens: 80,
      operationLabel: "Caption roast",
    })
  ).trim();
  roast = roast.replace(/^['"‘’“”]+/, "").replace(/['"‘’“”]+$/, "").trim();
  return roast.slice(0, 280);
};

export const generatePostCaption = async (userRequest = "") => {
  if (!hasConfiguredApiKey()) return "";

  let caption = (
    await completeChat({
      system: `Write one original social-media caption for Connect. Match the user's language. If they asked for funny, make it witty. Return ONLY the caption — no quotes, no preamble, no hashtags unless they fit naturally. Max 180 characters.`,
      messages: [
        {
          role: "user",
          content:
            String(userRequest || "").trim() || "Write a short funny caption.",
        },
      ],
      temperature: 0.85,
      maxTokens: 80,
      operationLabel: "Post caption",
    })
  )
    .replace(/^here(?:'s| is)[^.:\n]*[:\-]\s*/i, "")
    .trim();
  caption = caption.replace(/^['"‘’“”]+/, "").replace(/['"‘’“”]+$/, "").trim();
  return caption.slice(0, 500);
};

export const answerFromAppData = async ({
  question,
  data,
  conversationHistory = [],
} = {}) => {
  const payload = JSON.stringify(data ?? {}, null, 0).slice(0, 12000);
  const response = await completeChat({
    system: `You are Connect's in-app assistant. Answer ONLY from the provided JSON app data. If the data does not contain the answer, say you could not find it. Be concise (2-8 sentences or a short list). Reply in the same language as the question. Do not invent names, counts, dates, or captions.`,
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
  { onDelta, signal, voice = false, userName = "", memory = null } = {},
) => {
  if (!hasConfiguredApiKey()) {
    const missing = missingKeyResult();
    onDelta?.(missing.response);
    return missing;
  }

  const lang = detectAgentLanguage(message);
  const extra = [languageSystemHint(lang)];
  if (userName) extra.push(`User: ${userName}.`);
  if (!voice && memory && typeof memory === "object") {
    const compact = omitEmpty({
      friend: memory.friend,
      yt: memory.yt,
      action: memory.action,
      caption: memory.caption,
    });
    if (compact) extra.push(`Ctx:${JSON.stringify(compact)}`);
  }
  if (voice) extra.push("Live voice. 1–2 short sentences.");

  try {
    const responseText = await streamChat({
      system: `${SYSTEM_PROMPT} ${extra.join(" ")}`,
      messages: toChatMessages(
        conversationHistory,
        message,
        voice ? 3 : 4,
        voice ? 110 : 140,
      ),
      temperature: 0.35,
      maxTokens: voice ? 80 : 120,
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
  sendToGemini,
  sendToGeminiStream,
  translateBanglaToEnglish,
  interpretAgentCommand,
  generatePostCaption,
  generateSmartReplies,
  generateCaptionRoast,
  answerFromAppData,
  getAICapabilities,
  getModelInfo,
};
export default geminiService;
