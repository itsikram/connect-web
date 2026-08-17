/**
 * Gemini AI Service
 * Handles communication with Google Gemini 1.5 Flash API (free tier)
 */

const GEMINI_API_KEY = process.env.REACT_APP_GEMINI_API_KEY;
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

When users ask you to perform one of these actions, give a short friendly confirmation response (1-2 sentences). The action will be handled automatically by the app — you don't need to describe steps or buttons.

For general conversation, content creation, captions, translations, or questions, respond helpfully and concisely (2-4 sentences max).

Always be warm, direct, and helpful. Never list steps for app actions — just confirm and encourage.`;

/**
 * Send a message to Gemini and get a reply.
 *
 * @param {string} message - The current user message.
 * @param {Array<{role: 'user'|'assistant', content: string}>} conversationHistory
 *   All previous messages (including the initial agent greeting, which is skipped
 *   automatically because Gemini requires the first turn to be a user turn).
 * @returns {Promise<{response: string, suggestedAction: string|null, success: boolean}>}
 */
export const sendToGemini = async (message, conversationHistory = []) => {
  if (!GEMINI_API_KEY) {
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

    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    // Parse the response body. Even error responses are usually JSON.
    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error(
        `HTTP ${response.status} – could not parse response body.`,
      );
    }

    if (!response.ok) {
      const errMsg =
        data?.error?.message ||
        `HTTP ${response.status}: ${response.statusText}`;
      throw new Error(errMsg);
    }

    // A candidate may be blocked by safety filters even on a 200 response.
    const candidate = data.candidates?.[0];
    if (!candidate) {
      throw new Error(
        "No candidates returned. The prompt may have been blocked by safety filters.",
      );
    }

    const responseText =
      candidate.content?.parts?.[0]?.text ||
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

const geminiService = { sendToGemini, getAICapabilities, getModelInfo };
export default geminiService;
