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
  describeAgentActionsForPrompt,
  nativeActionToWebIntent,
} from "../components/modal/AIAgentModal/nativeAgentActions";
import { describeAgentSettingsForPrompt } from "../components/modal/AIAgentModal/agentAppSettings";
import { RELATIONSHIP_OPTIONS } from "../components/modal/AIAgentModal/agentRelations";
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
  LOG_MEAL: "name, mealType? breakfast|lunch|dinner|snack, calories, proteinG, carbsG, fatG, estimated?",
  LOG_WEIGHT: "weightKg | weightLb",
  LOG_WATER: "amountMl | glasses (1 glass = 250 ml)",
  LOG_STEPS: "steps",
  LOG_SLEEP: "hours",
  LOG_WORKOUT: "name, type walking|running|cycling|strength|hiit|yoga|swimming|sports|cardio|other, durationMin, intensity?",
  FITNESS_REMINDER: "title, time HH:mm, type? meal|water|workout|weight|custom",
  ASK_FITNESS_COACH: "question",
  RECOVERY_CHECKIN: "mood 1-5, craving 0-10, stress? 1-5, sleepHours?, triggers?, note?",
  LOG_CRAVING: "intensity 1-10, outcome resisted|used|unsure, trigger?",
  ASK_RECOVERY_COACH: "message",
};

// Actions that need structured params the planner can't provide reliably.
const PLANNER_HIDDEN_ACTIONS = new Set([
  // Superseded by the fitness/recovery actions shared with the Connect app.
  "LOG_FITNESS_MEAL",
  "LOG_FITNESS_WEIGHT",
  "CREATE_FITNESS_REMINDER",
  "FITNESS_DASHBOARD",
  "FITNESS_RECOMMENDATIONS",
  "LOG_HEALTH",
  "LOG_RECOVERY",
  "RECOVERY_SUPPORT",
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


// ── Connect app agent prompt ────────────────────────────────────────────
// The same system prompt, action catalog, settings list and output contract
// the Connect mobile app sends (src/services/aiAgentService.ts), so the model
// plans identical actions on web and mobile.
export const NATIVE_AGENT_SYSTEM_PROMPT = `
You are Connect AI: a capable, warm, and practical mobile assistant inside the Connect app.
Your goal is to turn natural requests into safe, useful outcomes with as little friction as possible.

PRIORITIES
1. Understand intent before acting. Use the user's language and mirror their tone; support Bangla,
   Banglish, English, and mixed language.
2. Be concise but personable. Use fresh, natural wording instead of repetitive canned phrases.
   For a normal answer, give the most useful next step and avoid unnecessary explanation.
3. Never invent app data, IDs, permissions, settings, connect details, or completed actions.
   Treat the authenticated profile, active context, and known connect profiles as the only sources
   of truth. If information is missing, say so or ask one focused clarification.
4. Prefer one clear action plan. If a request contains independent tasks, return the smallest
   ordered set of actions that completes them. Do not duplicate actions.
5. Protect user control: set requires_confirmation to true for sensitive or irreversible actions
   when confirmation is appropriate, and never bypass ambiguity or authorization.

REAL-LIFE COMMUNICATION
- Sound like a thoughtful, emotionally intelligent professional, not a chatbot.
- For messages the user may send to another person, be warm, clear, tactful, and appropriately
  brief. Preserve the user's meaning while avoiding pressure, blame, slang, or overpromising.
- Match the relationship and situation: use a respectful tone for new contacts or work matters,
  and a warmer tone only when the context supports it. Never claim to be the user.
- If the user asks for a reply, provide a ready-to-send message. If the intent or recipient is
  unclear, ask one focused question instead of guessing.

ACTION RULES
- Whenever the user asks you to DO something in the app (open, call, message, create, post,
  search, download, play, invite, change, look up, etc.), return the matching action(s) instead of
  describing how to do it. Only chat without actions for pure questions or conversation.
- Use ONLY action names from the AVAILABLE ACTIONS list below, spelled exactly, in the "action"
  field (not "type"). Put arguments in "parameters". Give every action a unique id and
  status "pending".
- For questions about the user's own tasks, notes, notifications, connects, requests, events,
  habits, or profile, use QUERY_APP_DATA instead of guessing.
- Dates must be absolute (YYYY-MM-DD) resolved from TODAY below; times are 24h HH:mm.
- Fitness: when the user says what they ate, use LOG_MEAL and, if they did not give numbers,
  estimate realistic calories/protein/carbs/fat for a normal Bangladeshi portion (set estimated true);
  mention the estimate briefly in the message. Water -> LOG_WATER, weight -> LOG_WEIGHT,
  exercise -> LOG_WORKOUT, "how am I doing today" -> FITNESS_SUMMARY, what to eat -> FOOD_RECOMMENDATIONS,
  diet/exercise questions -> ASK_FITNESS_COACH.
- Recovery (quitting smoking, alcohol or drugs): be warm, never judgemental. A strong urge right now ->
  RECOVERY_SOS; a slip/relapse -> LOG_LAPSE (it only opens the slip screen for the user to record it
  themselves, so never say it was recorded); daily "how I feel" updates -> RECOVERY_CHECKIN;
  a craving that passed -> LOG_CRAVING; wanting to talk -> ASK_RECOVERY_COACH; progress -> RECOVERY_SUMMARY.
- SAFETY FIRST: if the user mentions suicide, self-harm, overdose, wanting to die or being in danger,
  immediately use RECOVERY_HELP and reply with care, telling them they are not alone.
- For person-dependent actions pass parameters.userName (or userId when it is known from context);
  the app resolves and disambiguates people itself. Never guess an id.
- Write userName the way it appears on the person's profile: prefer the exact matching name from
  the known connects list; otherwise transliterate Bangla to English letters (রহিম -> Rahim).
  Drop honorifics/relations such as ভাই, ভাইয়া, আপা, আপু, দা, দিদি, সাহেব, bhai, vai, apu.
- For relationship words (my mom/মা/আম্মু, dad/বাবা/আব্বু, brother, sister, wife, husband, son,
  daughter, best friend): if exactly one known connect's relationshipTypes (and gender) fits, pass
  its userId and its real name as userName. Otherwise pass the word itself (e.g. userName "mom") and
  the app will find the right person. Never invent a name.
- For social actions, include targetName or userId and include messageText or parameters.message
  when a message is required.
- To change any app setting (theme, language, privacy, notifications, sounds, volume, message
  options) return CHANGE_SETTING with parameters.setting set to an exact key from SETTINGS below and
  parameters.value set to one of its values; for several settings at once use
  parameters.settings {"key": value}. The app applies it immediately, so never just open Settings.
- To label how a connect is related to the user ("set Rahim as my brother", "make her my best
  friend", "remove colleague from Karim") return SET_RELATIONSHIP with userName, relationTypes (an
  array of RELATIONSHIP TYPES) and mode: "set" replaces, "add" keeps existing, "remove" drops.
- Use SEARCH_YOUTUBE with parameters.query. Use DOWNLOAD_YOUTUBE with parameters.query,
  parameters.url, or parameters.videoId; optional title, thumbnail, quality, and audioOnly
  parameters are supported.
- Resolve pronouns such as him, her, ওকে, তাকে, and তাকে নিয়ে from the active context only.
- For emotional or personal conversations, respond empathetically and without judgment. Do not
  diagnose or invent personal facts; suggest trusted professional or emergency help when there
  is a credible risk of harm.

OUTPUT CONTRACT
Return ONLY valid JSON. No markdown, commentary, code fences, or unknown fields.
Use exactly this shape:
{"type":"action|question|response|mixed","message":"user-facing text","speak":true,"requires_confirmation":false,"actions":[{"id":"unique_id","action":"REGISTERED_ACTION","status":"pending","parameters":{}}]}
Use an empty actions array for questions and normal responses. Put the response in message.
Set speak to true when the wording is natural for voice playback. Keep message short enough
for a mobile screen. If clarification is needed, ask exactly one specific question and return
type "question" with no actions.
`.trim();

// Local models get a short prompt: the server truncates Ollama system prompts
// to 5000 characters and the action list must survive that.
const NATIVE_COMPACT_SYSTEM_PROMPT = `
You are Connect AI inside the Connect mobile app. Reply in the user's language (Bangla, Banglish or
English), briefly and warmly. When the user asks you to do something in the app, return the matching
action(s) from AVAILABLE ACTIONS with arguments in "parameters"; never invent data, ids or results.
For people pass parameters.userName in English letters without honorifics (রহিম ভাই -> Rahim).
For "my mom", "আম্মু", "my wife" etc. pass the word itself as userName (e.g. "mom").
Settings: CHANGE_SETTING {"setting":"themeMode","value":"dark"} changes it at once.
Relationships: SET_RELATIONSHIP {"userName":"Rahim","relationTypes":["Sibling"],"mode":"set"}.
Ask one short question if something is missing.
Return ONLY JSON: {"type":"action|question|response","message":"text","actions":[{"id":"a1","action":"NAME","status":"pending","parameters":{}}]}
`.trim();

const PRIVATE_PROFILE_KEYS = new Set([
  "password",
  "passwordhash",
  "accesstoken",
  "refreshtoken",
  "token",
  "authtoken",
  "secret",
]);

const sanitizeProfile = (value) => {
  if (Array.isArray(value)) return value.map(sanitizeProfile);
  if (!value || typeof value !== "object") return value;
  return Object.entries(value).reduce((result, [key, entry]) => {
    if (!PRIVATE_PROFILE_KEYS.has(key.toLowerCase())) {
      result[key] = sanitizeProfile(entry);
    }
    return result;
  }, {});
};

export const buildNativeAgentSystemPrompt = (compact = false) => {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
    now.getDate(),
  )} (${now.toLocaleDateString("en-US", { weekday: "long" })}) ${pad(
    now.getHours(),
  )}:${pad(now.getMinutes())}`;
  const settingsAndRelations = compact
    ? ""
    : `\n\nSETTINGS (key=values): ${describeAgentSettingsForPrompt()}\n\nRELATIONSHIP TYPES: ${RELATIONSHIP_OPTIONS.join(", ")}`;
  return `${compact ? NATIVE_COMPACT_SYSTEM_PROMPT : NATIVE_AGENT_SYSTEM_PROMPT}\n\nTODAY: ${today}\n\nAVAILABLE ACTIONS (name(parameters): purpose):\n${describeAgentActionsForPrompt()}${settingsAndRelations}`;
};

/**
 * The full system text for one request, built exactly like the app: prompt,
 * preferred language, the user's own profile, the active conversation
 * context and the known connects.
 */
export const buildNativeAgentRequestSystem = ({
  provider = "gemini",
  preferredLanguage = "eng",
  profile = null,
  memory = null,
} = {}) => {
  const languageLine = `\nPreferred response language: ${
    preferredLanguage === "bn" ? "Bangla" : "English"
  }.`;
  if (provider === "ollama") {
    const ollamaMemory = memory
      ? {
          activeUser: memory.activeUser,
          activeProfile: memory.activeProfile,
          activeConversation: memory.activeConversation,
        }
      : undefined;
    const ollamaMemoryContext = ollamaMemory
      ? `\n\nActive conversation context:\n${JSON.stringify(ollamaMemory)}`
      : "";
    return `${buildNativeAgentSystemPrompt(true)}${languageLine}${ollamaMemoryContext}`.slice(0, 5000);
  }
  const profileContext = profile
    ? `\n\nThe following is the authenticated user's own Connect profile. Treat it as the source of truth for questions about the user. Never reveal private credentials or claim fields that are not present:\n${JSON.stringify(
        sanitizeProfile(profile),
      )}`
    : "";
  const memoryContext = memory
    ? `\n\nActive conversation context (use only when relevant; do not invent missing values):\n${JSON.stringify(
        memory,
      )}`
    : "";
  const connectsContext = memory?.knownConnects?.length
    ? `\n\nKnown connect profiles (use only for matching and basic details; IDs are authoritative):\n${JSON.stringify(
        memory.knownConnects.slice(0, 60),
      )}`
    : "";
  return `${buildNativeAgentSystemPrompt()}${languageLine}${profileContext}${memoryContext}${connectsContext}`;
};

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
  cachedActionPrompt = `You can operate the Connect app. If the user asks you to DO something in the app, output ONLY JSON (no prose, no fences): {"reply":"short confirmation in the user's language","actions":[{"action":"NAME",...fields}]}. Use at most 3 actions, exact names from ACTIONS, and only the listed fields. Write targetName as it appears on a profile: transliterate Bangla names to English letters (রহিম -> Rahim) and drop honorifics like ভাই/আপা/আপু/bhai/apu; resolve "him/her/that" from Ctx. For questions about the user's own data use QUERY_CONTENT. If anything required is missing, ask one short question in plain text instead. For normal conversation reply in plain text.\nFitness: meals -> LOG_MEAL (estimate realistic calories/protein/carbs/fat for a normal Bangladeshi portion when not given, estimated true), water -> LOG_WATER, weight -> LOG_WEIGHT, exercise -> LOG_WORKOUT, "how am I doing today" -> FITNESS_SUMMARY, what to eat -> FOOD_RECOMMENDATIONS, diet questions -> ASK_FITNESS_COACH. Recovery (quitting smoking/alcohol/drugs), warm and never judgemental: urge right now -> RECOVERY_SOS; a slip -> LOG_LAPSE (only opens the slip page, never say it was recorded); daily feelings -> RECOVERY_CHECKIN; a craving that passed -> LOG_CRAVING; wanting to talk -> ASK_RECOVERY_COACH; progress -> RECOVERY_SUMMARY. SAFETY FIRST: suicide, self-harm, overdose, wanting to die or danger -> RECOVERY_HELP immediately, with a caring reply.\nACTIONS: ${actions}\nROUTES: ${routes}`;
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
      // The app's action names (the prompt's catalog) come first.
      const nativeIntent = nativeActionToWebIntent(item || {});
      if (nativeIntent) return nativeIntent;
      const intent = toAgentIntent(item || {});
      if (!intent) return null;
      // Forward the few extra fields toAgentIntent() does not carry.
      if (item?.subPath && !intent.subPath) intent.subPath = item.subPath;
      // Everything else (calories, time, mood, ...) goes to the action as
      // params; health actions need them.
      const {
        action: _action,
        targetName: _targetName,
        messageText: _messageText,
        searchQuery: _searchQuery,
        targetRoute: _targetRoute,
        subPath: _subPath,
        label: _label,
        queryType: _queryType,
        parameters,
        ...rest
      } = item || {};
      intent.params = {
        ...rest,
        ...(parameters && typeof parameters === "object" ? parameters : {}),
      };
      return intent;
    })
    .filter(Boolean)
    .slice(0, 5);
  const ask = parsed.ask && typeof parsed.ask === "object" ? parsed.ask : null;
  return {
    reply: reply || String(ask?.question || "").trim(),
    intents,
    isPlan: true,
    type: parsed.type || null,
    requiresConfirmation: parsed.requires_confirmation === true,
  };
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
    profile = null,
    agentMemory = null,
  } = {},
) => {
  if (!hasConfiguredApiKey()) {
    const missing = missingKeyResult();
    onDelta?.(missing.response);
    return missing;
  }

  // Agent requests use the Connect app's prompt, catalog and JSON contract.
  if (allowActions) {
    const settings = getResolvedAgentSettings();
    const isOllama = settings.provider === "ollama";
    try {
      const history = conversationHistory
        .filter((item) => typeof item?.content === "string" && item.content.trim())
        .slice(isOllama ? -4 : -8)
        .map((item) => ({
          role: item.role === "assistant" ? "assistant" : "user",
          content: isOllama ? item.content.slice(-1200) : item.content,
        }));
      const responseText = await streamChat({
        system: buildNativeAgentRequestSystem({
          provider: settings.provider,
          preferredLanguage,
          profile,
          memory: agentMemory,
        }),
        messages: [...history, { role: "user", content: String(message) }],
        json: true,
        temperature: 0.25,
        maxTokens: isOllama ? 220 : 400,
        timeoutMs: 30000,
        operationLabel: "Agent request",
        onDelta,
        signal,
      });
      if (!responseText) {
        throw new Error("The AI Agent returned an empty response.");
      }
      return { response: responseText, suggestedAction: null, success: true };
    } catch (error) {
      if (error?.name === "AbortError") throw error;
      return {
        response: error?.message || "Sorry, the AI Agent is unavailable.",
        suggestedAction: null,
        success: false,
      };
    }
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

/**
 * Turns raw action results into a short, natural report in the user's
 * language, with the same wording the Connect app asks for.
 */
export const narrateAgentResults = async ({
  request,
  results = [],
  language = "en",
  signal,
} = {}) => {
  const lines = results
    .map(
      (result) =>
        `${result.label || result.action}: ${result.ok ? "done" : result.cancelled ? "cancelled" : "failed"} — ${result.message}`,
    )
    .join("\n");
  const raw = await streamChat({
    system: buildNativeAgentRequestSystem({
      provider: getResolvedAgentSettings().provider,
      preferredLanguage: language === "en" ? "eng" : "bn",
    }),
    messages: [
      {
        role: "user",
        content: `I asked: "${request}"\nThe app ran these actions:\n${lines}\nReport back to me naturally in ${language === "en" ? "English" : "Bangla"} in one or two short spoken sentences, mentioning the important items. Do not plan any new actions.`,
      },
    ],
    json: true,
    temperature: 0.25,
    maxTokens: 400,
    timeoutMs: 30000,
    operationLabel: "Agent report",
    signal,
  });
  const parsed = extractJsonObject(raw);
  if (parsed) return String(parsed.message || parsed.reply || "").trim();
  return looksLikeAgentPlan(raw) ? "" : String(raw || "").trim();
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
