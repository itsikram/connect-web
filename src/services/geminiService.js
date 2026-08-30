/**
 * Connect AI Agent LLM service.
 * Provider, model, and API keys always come from live AI Agent settings.
 */

import {
  ALLOWED_ACTIONS,
  CONNECT_ROUTES,
  QUERY_TYPES,
  normalizeAskField,
} from "../components/modal/AIAgentModal/agentCatalog";
import {
  completeChat,
  extractGeminiText,
  isGeminiQuotaError,
} from "./llmClient";
import {
  getResolvedAgentSettings,
  hasConfiguredApiKey,
  parseApiKeys as parseGeminiApiKeys,
} from "./aiAgentSettings";

export { parseGeminiApiKeys, isGeminiQuotaError, extractGeminiText };

const SYSTEM_PROMPT = `You are a smart AI Agent embedded in "Connect", a social media app.

You can help users perform these actions directly in the app:
• VIDEO_CALL / AUDIO_CALL – Call a friend
• SEND_MESSAGE – Open a chat conversation
• BUMP – Send a bump/poke to a friend
• CREATE_LUDO / INVITE_LUDO – Play or invite to a Ludo game
• BLOCK / UNBLOCK – Block or unblock someone
• VIEW_PROFILE – Open someone's profile page
• GET_LOCATION – Get a friend's last known location
• ADD_FRIEND / UNFRIEND – Manage friend connections
• LIST_FRIENDS / OPEN_MESSAGES / OPEN_FRIENDS – Navigate pages

When users ask for information about a friend, such as their bio or location, answer in a short direct text style.

When users ask to open, go to, or view something in the app, respond with a short navigation-style confirmation.

When users ask to send, call, block, invite, or otherwise perform an action on someone, respond with a short friendly action-style confirmation. The action will be handled automatically by the app — you don't need to describe steps or buttons.

For general conversation, content creation, captions, translations, or questions, respond helpfully and concisely (2-4 sentences max).

Always be warm, direct, and helpful. Match the response type to what the user wants: direct answer for information, confirmation for navigation, and concise confirmation for app actions. Never list steps for app actions.`;

const toChatMessages = (conversationHistory = [], message) => {
  const messages = [];
  let foundFirstUser = false;
  for (const msg of conversationHistory) {
    const role = msg.role === "assistant" ? "assistant" : "user";
    if (!foundFirstUser && role !== "user") continue;
    foundFirstUser = true;
    const content = typeof msg.content === "string" ? msg.content : "";
    if (!content.trim()) continue;
    messages.push({ role, content });
  }
  if (message != null) {
    messages.push({ role: "user", content: String(message) });
  }
  return messages;
};

const missingKeyResult = () => ({
  response:
    "No API key is configured for the selected provider. Open AI Agent settings (gear icon) and add a key, or keep Gemini selected to use the app default.",
  suggestedAction: null,
  success: false,
});

export const translateBanglaToEnglish = async (text) => {
  const sourceText = String(text || "").trim();
  if (!sourceText || !/[\u0980-\u09FF]/.test(sourceText)) {
    return sourceText;
  }

  const translation = (
    await completeChat({
      system: `Translate the user's Bangla text into concise, natural English for an app command parser. Preserve people's names by transliterating them into Latin letters. Preserve the user's exact intent, destination, action, and search terms. Return only the English translation with no quotes, labels, notes, or explanation.`,
      messages: [{ role: "user", content: sourceText }],
      temperature: 0,
      maxTokens: 256,
      operationLabel: "Translation",
    })
  )
    .replace(/^English(?: translation)?:\s*/i, "")
    .replace(/^["“]|["”]$/g, "")
    .trim();

  if (!translation) {
    throw new Error("Translation returned an empty result");
  }

  return translation;
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

const AGENT_JSON_PROMPT = `You are the command interpreter for "Connect", a social app.
Read the user's message (Bangla or English) and return ONLY JSON:

{
  "reply": "short user-facing reply in the same language as the user",
  "actions": [
    {
      "action": "ACTION_NAME",
      "targetName": "person name or null",
      "targetRoute": "route token or path or null",
      "subPath": "profile subpath like /friends /images /videos /about or empty",
      "label": "human label",
      "searchQuery": "search or content text",
      "messageText": "message body if sending a chat message",
      "queryType": "search|friends|posts|videos|notes|tasks|notifications|profile|feed|habits|calendar|user|requests|suggestions|watch|null"
    }
  ],
  "ask": {
    "field": "targetName|messageText|searchQuery|targetRoute|null",
    "question": "one short clarifying question or null"
  }
}

Rules:
- actions may be empty for pure conversation.
- If you cannot complete an action because a required field is missing, STILL emit the action with nulls and set ask.field + ask.question. Put that question in reply too. Never guess a person's name.
- If pendingAction is in context, the user is answering you. Fill the missing fields and return the completed action. Do not ask again unless it is still unclear. Only switch to a different action if they clearly asked for something else.
- Use QUERY_CONTENT when the user asks for details, lists, summaries, "what is", "show my", "how many", or any app content.
- Use NAVIGATE (with targetRoute from the route list) to open a page.
- Use friend actions only when a person is involved. Put their name in targetName.
- For "send X to Y" use SEND_MESSAGE_TO_USER with messageText and targetName.
- For posting text use CREATE_POST. Put the EXACT caption in searchQuery. The client opens a draft — the user must tap Post. Never claim it is already published.
- If they ask for a funny/witty/random caption, invent one and put that caption in searchQuery. Never claim you posted without including CREATE_POST.
- Only omit searchQuery when they asked to open the composer and write it themselves.
- Never invent private data. If you need live app data, emit QUERY_CONTENT / SEARCH_* / LIST_* and put a brief reply.
- Prefer one clear action. Use multiple only when the user asked for more than one thing.
- Match Bangla commands to the same action names.
- Never claim you already did something that still needs a clarifying answer.`;

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

  const contextBlock = JSON.stringify(
    {
      currentUser: appContext.user || null,
      friends: appContext.friends || [],
      pendingAction: appContext.pendingIntent || null,
      availableActions: Array.from(ALLOWED_ACTIONS),
      routes: CONNECT_ROUTES,
      queryTypes: QUERY_TYPES,
    },
    null,
    0,
  );

  const rawText = await completeChat({
    system: `${AGENT_JSON_PROMPT}\n\nLive app context:\n${contextBlock}`,
    messages: toChatMessages(conversationHistory, sourceText),
    json: true,
    temperature: 0.15,
    maxTokens: 1024,
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
    maxTokens: 700,
    operationLabel: "App data answer",
  });
  if (!response) {
    throw new Error("The model returned an empty grounded answer");
  }
  return response;
};

export const sendToGemini = async (message, conversationHistory = []) => {
  if (!hasConfiguredApiKey()) {
    return missingKeyResult();
  }

  try {
    const responseText = await completeChat({
      system: SYSTEM_PROMPT,
      messages: toChatMessages(conversationHistory, message),
      temperature: 0.7,
      maxTokens: 1024,
      operationLabel: "Chat request",
    });

    if (!responseText) {
      throw new Error("The model returned an empty response. Please try again.");
    }

    const suggestedAction = extractSuggestedAction(responseText);
    return { response: responseText, suggestedAction, success: true };
  } catch (error) {
    return {
      response: `Sorry, something went wrong: ${error.message}`,
      suggestedAction: null,
      success: false,
    };
  }
};

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
