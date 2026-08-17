/**
 * Gemini AI Service
 * Handles communication with Google Gemini 1.5 Flash API (free tier)
 */

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
  getAICapabilities,
  getModelInfo,
};
export default geminiService;
