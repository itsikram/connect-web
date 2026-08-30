/**
 * Gemini AI Service
 * Handles communication with Google Gemini 1.5 Flash API (free tier)
 */

import {
  ALLOWED_ACTIONS,
  CONNECT_ROUTES,
  QUERY_TYPES,
  normalizeAskField,
} from "../components/modal/AIAgentModal/agentCatalog";

export const parseGeminiApiKeys = (value = "") => [
  ...new Set(
    String(value)
      .split(",")
      .map((key) => key.trim())
      .filter(Boolean),
  ),
];

const GEMINI_API_KEYS = parseGeminiApiKeys(
  process.env.REACT_APP_GEMINI_API_KEY,
);
let activeGeminiKeyIndex = 0;

// gemini-3.5-flash — free-tier model available as of 2025/2026
const GEMINI_MODEL = "gemini-3.5-flash";
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

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

/**
 * Send a message to Gemini and get a reply.
 *
 * @param {string} message - The current user message.
 * @param {Array<{role: 'user'|'assistant', content: string}>} conversationHistory
 *   All previous messages (including the initial agent greeting, which is skipped
 *   automatically because Gemini requires the first turn to be a user turn).
 * @returns {Promise<{response: string, suggestedAction: string|null, success: boolean}>}
 */
const extractGeminiText = (data) =>
  data?.candidates?.[0]?.content?.parts
    ?.map((part) => part?.text || "")
    .join("")
    .trim() || "";

export const isGeminiQuotaError = (status, data) => {
  const apiStatus = String(data?.error?.status || "").toUpperCase();
  const message = String(data?.error?.message || "").toLowerCase();

  return (
    status === 429 ||
    apiStatus === "RESOURCE_EXHAUSTED" ||
    message.includes("quota") ||
    message.includes("rate limit") ||
    message.includes("resource exhausted")
  );
};

const requestGemini = async (requestBody, operationLabel) => {
  if (GEMINI_API_KEYS.length === 0) {
    throw new Error("Gemini API key is not configured");
  }

  let lastError = null;
  const startingKeyIndex = activeGeminiKeyIndex;

  for (let attempt = 0; attempt < GEMINI_API_KEYS.length; attempt += 1) {
    const keyIndex = (startingKeyIndex + attempt) % GEMINI_API_KEYS.length;
    const apiKey = GEMINI_API_KEYS[keyIndex];
    const response = await fetch(
      `${GEMINI_API_URL}?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      },
    );

    const data = await response.json().catch(() => null);
    if (response.ok) {
      activeGeminiKeyIndex = keyIndex;
      return data;
    }

    const errorMessage =
      data?.error?.message ||
      `${operationLabel} failed with HTTP ${response.status}`;
    lastError = new Error(errorMessage);

    if (!isGeminiQuotaError(response.status, data)) {
      throw lastError;
    }

    activeGeminiKeyIndex = (keyIndex + 1) % GEMINI_API_KEYS.length;
    if (attempt < GEMINI_API_KEYS.length - 1) {
      console.warn(
        `[Gemini] ${operationLabel} quota exceeded; trying API key ${attempt + 2} of ${GEMINI_API_KEYS.length}.`,
      );
    }
  }

  const quotaSummary = `All ${GEMINI_API_KEYS.length} configured Gemini API ${GEMINI_API_KEYS.length === 1 ? "key has" : "keys have"} exceeded quota.`;
  throw new Error(
    lastError?.message
      ? `${quotaSummary} Last error: ${lastError.message}`
      : quotaSummary,
  );
};

export const translateBanglaToEnglish = async (text) => {
  const sourceText = String(text || "").trim();
  if (!sourceText || !/[\u0980-\u09FF]/.test(sourceText)) {
    return sourceText;
  }

  const data = await requestGemini(
    {
      systemInstruction: {
        parts: [
          {
            text: `Translate the user's Bangla text into concise, natural English for an app command parser. Preserve people's names by transliterating them into Latin letters. Preserve the user's exact intent, destination, action, and search terms. Return only the English translation with no quotes, labels, notes, or explanation.`,
          },
        ],
      },
      contents: [{ role: "user", parts: [{ text: sourceText }] }],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 256,
      },
    },
    "Translation",
  );

  const translation = extractGeminiText(data)
    .replace(/^English(?: translation)?:\s*/i, "")
    .replace(/^["“]|["”]$/g, "")
    .trim();

  if (!translation) {
    throw new Error("Gemini returned an empty translation");
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

const buildContents = (message, conversationHistory = []) => {
  const priorContents = [];
  let foundFirstUser = false;

  for (const msg of conversationHistory) {
    const role = msg.role === "assistant" ? "model" : "user";
    if (!foundFirstUser && role !== "user") continue;
    foundFirstUser = true;
    const content = typeof msg.content === "string" ? msg.content : "";
    if (!content.trim()) continue;
    priorContents.push({ role, parts: [{ text: content }] });
  }

  return [...priorContents, { role: "user", parts: [{ text: message }] }];
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

  if (GEMINI_API_KEYS.length === 0) {
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

  const requestBody = {
    systemInstruction: {
      parts: [
        {
          text: `${AGENT_JSON_PROMPT}\n\nLive app context:\n${contextBlock}`,
        },
      ],
    },
    contents: buildContents(sourceText, conversationHistory),
    generationConfig: {
      temperature: 0.15,
      topK: 32,
      topP: 0.9,
      maxOutputTokens: 1024,
      responseMimeType: "application/json",
    },
  };

  let data;
  try {
    data = await requestGemini(requestBody, "Agent interpreter");
  } catch (_jsonModeError) {
    const fallbackBody = {
      ...requestBody,
      generationConfig: {
        temperature: 0.15,
        topK: 32,
        topP: 0.9,
        maxOutputTokens: 1024,
      },
    };
    data = await requestGemini(fallbackBody, "Agent interpreter");
  }

  const parsed = extractJsonObject(extractGeminiText(data));
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
  if (GEMINI_API_KEYS.length === 0) return fallback;

  try {
    const geminiData = await requestGemini(
      {
        systemInstruction: {
          parts: [
            {
              text: `Write 3 short social comment replies (max 6 words each). Match the post's language (Bangla or English). Be warm, specific, not generic spam. Return ONLY a JSON array of 3 strings.`,
            },
          ],
        },
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `Post: ${String(postCaption || "").slice(0, 280)}\nLatest comment: ${String(lastComment || "").slice(0, 160)}`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 120,
        },
      },
      "Smart replies",
    );
    const raw = extractGeminiText(geminiData);
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
  if (GEMINI_API_KEYS.length === 0) {
    return "This caption is doing the most and I respect the confidence.";
  }
  const geminiData = await requestGemini(
    {
      systemInstruction: {
        parts: [
          {
            text: `Write one playful roast of this social caption. Keep it kind, never cruel, never about appearance. Max 140 characters. Return ONLY the roast.`,
          },
        ],
      },
      contents: [
        {
          role: "user",
          parts: [{ text: String(caption || "this post").slice(0, 400) }],
        },
      ],
      generationConfig: {
        temperature: 0.9,
        maxOutputTokens: 80,
      },
    },
    "Caption roast",
  );
  let roast = extractGeminiText(geminiData).trim();
  roast = roast.replace(/^['"‘’“”]+/, "").replace(/['"‘’“”]+$/, "").trim();
  return roast.slice(0, 280);
};

export const generatePostCaption = async (userRequest = "") => {
  if (GEMINI_API_KEYS.length === 0) return "";

  const geminiData = await requestGemini(
    {
      systemInstruction: {
        parts: [
          {
            text: `Write one original social-media caption for Connect. Match the user's language. If they asked for funny, make it witty. Return ONLY the caption — no quotes, no preamble, no hashtags unless they fit naturally. Max 180 characters.`,
          },
        ],
      },
      contents: [
        {
          role: "user",
          parts: [
            {
              text: String(userRequest || "").trim() || "Write a short funny caption.",
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.85,
        maxOutputTokens: 80,
      },
    },
    "Post caption",
  );

  let caption = extractGeminiText(geminiData)
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
  const geminiData = await requestGemini(
    {
      systemInstruction: {
        parts: [
          {
            text: `You are Connect's in-app assistant. Answer ONLY from the provided JSON app data. If the data does not contain the answer, say you could not find it. Be concise (2-8 sentences or a short list). Reply in the same language as the question. Do not invent names, counts, dates, or captions.`,
          },
        ],
      },
      contents: buildContents(
        `Question:\n${question}\n\nApp data JSON:\n${payload}`,
        conversationHistory.slice(-4),
      ),
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 700,
      },
    },
    "App data answer",
  );

  const response = extractGeminiText(geminiData);
  if (!response) {
    throw new Error("Gemini returned an empty grounded answer");
  }
  return response;
};

export const sendToGemini = async (message, conversationHistory = []) => {
  if (GEMINI_API_KEYS.length === 0) {
    return {
      response:
        "API key is not configured. Please add REACT_APP_GEMINI_API_KEY to your .env file and restart the dev server.",
      suggestedAction: null,
      success: false,
    };
  }

  try {
    // Build the contents array for the Gemini API.
    // Rules:
    //   • Must start with a 'user' turn (skip any leading agent/model messages).
    //   • Roles must strictly alternate: user → model → user → model → …
    //   • The current message is appended as the final user turn.
    const priorContents = [];
    let foundFirstUser = false;

    for (const msg of conversationHistory) {
      const role = msg.role === "assistant" ? "model" : "user";
      if (!foundFirstUser && role !== "user") {
        // Skip any leading agent greetings before the first real user message.
        continue;
      }
      foundFirstUser = true;
      priorContents.push({ role, parts: [{ text: msg.content }] });
    }

    const contents = [
      ...priorContents,
      { role: "user", parts: [{ text: message }] },
    ];

    const requestBody = {
      // systemInstruction keeps the system prompt separate from the conversation
      // turns, which is the correct way to send it in the v1beta API.
      systemInstruction: {
        parts: [{ text: SYSTEM_PROMPT }],
      },
      contents,
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 1024,
      },
      safetySettings: [
        {
          category: "HARM_CATEGORY_HARASSMENT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE",
        },
        {
          category: "HARM_CATEGORY_HATE_SPEECH",
          threshold: "BLOCK_MEDIUM_AND_ABOVE",
        },
        {
          category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE",
        },
        {
          category: "HARM_CATEGORY_DANGEROUS_CONTENT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE",
        },
      ],
    };

    const data = await requestGemini(requestBody, "Chat request");

    // A candidate may be blocked by safety filters even on a 200 response.
    const candidate = data.candidates?.[0];
    if (!candidate) {
      throw new Error(
        "No candidates returned. The prompt may have been blocked by safety filters.",
      );
    }

    const responseText =
      extractGeminiText(data) ||
      "Sorry, I couldn't generate a response. Please try again.";

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
export const getModelInfo = () => ({
  name: GEMINI_MODEL,
  version: "3.5",
  type: "Free Tier",
  maxTokens: 1024,
  description: "Fast, intelligent model for conversational AI (free tier)",
});

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
