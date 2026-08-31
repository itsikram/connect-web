/**
 * Canonical Connect AI Agent action + route catalog.
 * Gemini is instructed to pick from these action names only.
 */

export const QUERY_TYPES = [
  "search",
  "friends",
  "posts",
  "videos",
  "notes",
  "tasks",
  "notifications",
  "profile",
  "feed",
  "habits",
  "calendar",
  "user",
  "requests",
  "suggestions",
  "watch",
];

export const AGENT_ACTIONS = {
  // Social
  VIDEO_CALL: "VIDEO_CALL",
  AUDIO_CALL: "AUDIO_CALL",
  SEND_MESSAGE: "SEND_MESSAGE",
  SEND_MESSAGE_TO_USER: "SEND_MESSAGE_TO_USER",
  BUMP: "BUMP",
  BLOCK: "BLOCK",
  UNBLOCK: "UNBLOCK",
  ADD_FRIEND: "ADD_FRIEND",
  UNFRIEND: "UNFRIEND",
  ACCEPT_FRIEND: "ACCEPT_FRIEND",
  DECLINE_FRIEND: "DECLINE_FRIEND",
  VIEW_PROFILE: "VIEW_PROFILE",
  NAVIGATE_PROFILE: "NAVIGATE_PROFILE",
  GET_LOCATION: "GET_LOCATION",
  GET_BIO: "GET_BIO",
  INVITE_LUDO: "INVITE_LUDO",
  INVITE_CHESS: "INVITE_CHESS",

  // Navigation / games
  NAVIGATE: "NAVIGATE",
  CREATE_LUDO: "CREATE_LUDO",
  CREATE_CHESS: "CREATE_CHESS",
  LIST_FRIENDS: "LIST_FRIENDS",
  OPEN_FRIENDS: "OPEN_FRIENDS",
  OPEN_MESSAGES: "OPEN_MESSAGES",
  OPEN_NOTIFICATIONS: "OPEN_NOTIFICATIONS",
  OPEN_SEARCH: "OPEN_SEARCH",

  // Create
  CREATE_POST: "CREATE_POST",
  CREATE_STORY: "CREATE_STORY",
  CREATE_NOTE: "CREATE_NOTE",
  EDIT_NOTE: "EDIT_NOTE",
  DELETE_NOTE: "DELETE_NOTE",
  CREATE_TASK: "CREATE_TASK",
  EDIT_TASK: "EDIT_TASK",
  DELETE_TASK: "DELETE_TASK",
  CREATE_EVENT: "CREATE_EVENT",
  EDIT_EVENT: "EDIT_EVENT",
  DELETE_EVENT: "DELETE_EVENT",
  CREATE_HABIT: "CREATE_HABIT",
  EDIT_HABIT: "EDIT_HABIT",
  DELETE_HABIT: "DELETE_HABIT",
  DELETE_POST: "DELETE_POST",
  DOWNLOAD_YOUTUBE: "DOWNLOAD_YOUTUBE",
  SEARCH_YOUTUBE: "SEARCH_YOUTUBE",
  OPEN_VIDEO_PLAYER: "OPEN_VIDEO_PLAYER",
  UPDATE_SETTINGS: "UPDATE_SETTINGS",
  LOG_HEALTH: "LOG_HEALTH",
  LOG_RECOVERY: "LOG_RECOVERY",
  RECOVERY_SUPPORT: "RECOVERY_SUPPORT",
  ADD_RECOVERY_DATA: "ADD_RECOVERY_DATA",
  UPDATE_LANGUAGE_SETTINGS: "UPDATE_LANGUAGE_SETTINGS",

  // Search / lookup
  SEARCH_VIDEO: "SEARCH_VIDEO",
  SEARCH_USERS: "SEARCH_USERS",
  SEARCH_POSTS: "SEARCH_POSTS",
  SEARCH_APP: "SEARCH_APP",
  QUERY_CONTENT: "QUERY_CONTENT",
  LIST_NOTES: "LIST_NOTES",
  LIST_TASKS: "LIST_TASKS",
  LIST_NOTIFICATIONS: "LIST_NOTIFICATIONS",
  LIST_HABITS: "LIST_HABITS",
  LIST_EVENTS: "LIST_EVENTS",
  LIST_FRIENDS_INFO: "LIST_FRIENDS_INFO",
  GET_MY_DETAILS: "GET_MY_DETAILS",
};

export const ALLOWED_ACTIONS = new Set(Object.values(AGENT_ACTIONS));

export const FRIEND_REQUIRED_ACTIONS = new Set([
  AGENT_ACTIONS.VIDEO_CALL,
  AGENT_ACTIONS.AUDIO_CALL,
  AGENT_ACTIONS.SEND_MESSAGE,
  AGENT_ACTIONS.SEND_MESSAGE_TO_USER,
  AGENT_ACTIONS.BUMP,
  AGENT_ACTIONS.INVITE_LUDO,
  AGENT_ACTIONS.INVITE_CHESS,
  AGENT_ACTIONS.BLOCK,
  AGENT_ACTIONS.UNBLOCK,
  AGENT_ACTIONS.VIEW_PROFILE,
  AGENT_ACTIONS.GET_LOCATION,
  AGENT_ACTIONS.GET_BIO,
  AGENT_ACTIONS.ADD_FRIEND,
  AGENT_ACTIONS.UNFRIEND,
  AGENT_ACTIONS.NAVIGATE_PROFILE,
]);

/** People lookups that should search Connect globally, not just friends. */
export const DIRECTORY_LOOKUP_ACTIONS = new Set([
  AGENT_ACTIONS.ADD_FRIEND,
  AGENT_ACTIONS.VIEW_PROFILE,
  AGENT_ACTIONS.NAVIGATE_PROFILE,
  AGENT_ACTIONS.GET_BIO,
  AGENT_ACTIONS.SEARCH_USERS,
]);

export const NO_FRIEND_ACTIONS = new Set([
  AGENT_ACTIONS.CREATE_LUDO,
  AGENT_ACTIONS.CREATE_CHESS,
  AGENT_ACTIONS.LIST_FRIENDS,
  AGENT_ACTIONS.OPEN_MESSAGES,
  AGENT_ACTIONS.OPEN_FRIENDS,
  AGENT_ACTIONS.OPEN_NOTIFICATIONS,
  AGENT_ACTIONS.OPEN_SEARCH,
  AGENT_ACTIONS.NAVIGATE,
  AGENT_ACTIONS.SEARCH_VIDEO,
  AGENT_ACTIONS.SEARCH_USERS,
  AGENT_ACTIONS.SEARCH_POSTS,
  AGENT_ACTIONS.SEARCH_APP,
  AGENT_ACTIONS.QUERY_CONTENT,
  AGENT_ACTIONS.CREATE_NOTE,
  AGENT_ACTIONS.EDIT_NOTE,
  AGENT_ACTIONS.DELETE_NOTE,
  AGENT_ACTIONS.CREATE_TASK,
  AGENT_ACTIONS.EDIT_TASK,
  AGENT_ACTIONS.DELETE_TASK,
  AGENT_ACTIONS.CREATE_EVENT,
  AGENT_ACTIONS.EDIT_EVENT,
  AGENT_ACTIONS.DELETE_EVENT,
  AGENT_ACTIONS.CREATE_HABIT,
  AGENT_ACTIONS.EDIT_HABIT,
  AGENT_ACTIONS.DELETE_HABIT,
  AGENT_ACTIONS.CREATE_POST,
  AGENT_ACTIONS.DELETE_POST,
  AGENT_ACTIONS.CREATE_STORY,
  AGENT_ACTIONS.DOWNLOAD_YOUTUBE,
  AGENT_ACTIONS.SEARCH_YOUTUBE,
  AGENT_ACTIONS.OPEN_VIDEO_PLAYER,
  AGENT_ACTIONS.UPDATE_SETTINGS,
  AGENT_ACTIONS.LOG_HEALTH,
  AGENT_ACTIONS.LOG_RECOVERY,
  AGENT_ACTIONS.RECOVERY_SUPPORT,
  AGENT_ACTIONS.ACCEPT_FRIEND,
  AGENT_ACTIONS.DECLINE_FRIEND,
  AGENT_ACTIONS.ADD_RECOVERY_DATA,
  AGENT_ACTIONS.UPDATE_LANGUAGE_SETTINGS,
  AGENT_ACTIONS.LIST_NOTES,
  AGENT_ACTIONS.LIST_TASKS,
  AGENT_ACTIONS.LIST_NOTIFICATIONS,
  AGENT_ACTIONS.LIST_HABITS,
  AGENT_ACTIONS.LIST_EVENTS,
  AGENT_ACTIONS.LIST_FRIENDS_INFO,
  AGENT_ACTIONS.GET_MY_DETAILS,
]);

export const LOOKUP_ACTIONS = new Set([
  AGENT_ACTIONS.QUERY_CONTENT,
  AGENT_ACTIONS.SEARCH_APP,
  AGENT_ACTIONS.SEARCH_USERS,
  AGENT_ACTIONS.SEARCH_POSTS,
  AGENT_ACTIONS.SEARCH_VIDEO,
  AGENT_ACTIONS.SEARCH_YOUTUBE,
  AGENT_ACTIONS.LIST_NOTES,
  AGENT_ACTIONS.LIST_TASKS,
  AGENT_ACTIONS.LIST_NOTIFICATIONS,
  AGENT_ACTIONS.LIST_HABITS,
  AGENT_ACTIONS.LIST_EVENTS,
  AGENT_ACTIONS.LIST_FRIENDS_INFO,
  AGENT_ACTIONS.GET_MY_DETAILS,
  AGENT_ACTIONS.GET_BIO,
  AGENT_ACTIONS.GET_LOCATION,
]);

export const CONNECT_ROUTES = [
  { route: "/", label: "Home / News feed" },
  { route: "MY_PROFILE", label: "My profile" },
  { route: "MY_PROFILE_FRIENDS", label: "My friends list on profile" },
  { route: "MY_PROFILE_IMAGES", label: "My photos" },
  { route: "MY_PROFILE_VIDEOS", label: "My videos" },
  { route: "MY_PROFILE_ABOUT", label: "My about / bio page" },
  { route: "/message", label: "Messages / inbox" },
  { route: "/friends/", label: "Friends page" },
  { route: "/friends/requests", label: "Friend requests" },
  { route: "/friends/suggestions", label: "Friend suggestions" },
  { route: "/friends/places", label: "Places near you" },
  { route: "/watch", label: "Watch videos" },
  { route: "/story/", label: "Stories" },
  { route: "/ludo-game", label: "Ludo" },
  { route: "/chess-game", label: "Chess" },
  { route: "/marketplace", label: "Marketplace" },
  { route: "/groups", label: "Groups" },
  { route: "/notes", label: "Notes" },
  { route: "/tasks", label: "Tasks" },
  { route: "/calendar", label: "Calendar" },
  { route: "/habits", label: "Habits" },
  { route: "/health", label: "Health" },
  { route: "/timer", label: "Focus timer" },
  { route: "/flashcards", label: "Flashcards" },
  { route: "/rehab", label: "Rehab" },
  { route: "/yt-download", label: "YouTube downloader" },
  { route: "/downloads", label: "Saved videos" },
  { route: "/youtube", label: "YouTube" },
  { route: "/video-player", label: "Video player" },
  { route: "/menu", label: "Menu" },
  { route: "/settings", label: "Profile settings" },
  { route: "/settings/account", label: "Account settings" },
  { route: "/settings/privacy", label: "Privacy settings" },
  { route: "/settings/notification", label: "Notification settings" },
  { route: "/settings/message", label: "Message settings" },
  { route: "/settings/sound", label: "Sound settings" },
  { route: "/settings/cache", label: "Cache settings" },
  { route: "/settings/preference", label: "Preference settings" },
  { route: "/portfolio/", label: "Portfolio" },
  { route: "/login", label: "Login" },
  { route: "/signup", label: "Sign up" },
];

export const normalizeAgentAction = (action) => {
  const value = String(action || "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
  if (ALLOWED_ACTIONS.has(value)) return value;

  const aliases = {
    GO: "NAVIGATE",
    OPEN: "NAVIGATE",
    OPEN_PAGE: "NAVIGATE",
    CALL: "AUDIO_CALL",
    PHONE_CALL: "AUDIO_CALL",
    MESSAGE: "SEND_MESSAGE",
    CHAT: "SEND_MESSAGE",
    PLAY_VIDEO: "SEARCH_VIDEO",
    FIND_VIDEO: "SEARCH_VIDEO",
    YOUTUBE_SEARCH: "SEARCH_YOUTUBE",
    SEARCH_YT: "SEARCH_YOUTUBE",
    FIND_YOUTUBE: "SEARCH_YOUTUBE",
    FIND_YOUTUBE_VIDEO: "SEARCH_YOUTUBE",
    FIND_USER: "SEARCH_USERS",
    FIND_USERS: "SEARCH_USERS",
    SEARCH: "SEARCH_APP",
    LOOKUP: "QUERY_CONTENT",
    ANSWER: "QUERY_CONTENT",
    TELL_ME: "QUERY_CONTENT",
    WHAT_IS: "QUERY_CONTENT",
    MY_PROFILE: "GET_MY_DETAILS",
    PROFILE_INFO: "GET_MY_DETAILS",
    PLAY_CHESS: "CREATE_CHESS",
    PLAY_LUDO: "CREATE_LUDO",
    NEW_POST: "CREATE_POST",
    WRITE_POST: "CREATE_POST",
    CREATEPOST: "CREATE_POST",
    MAKE_POST: "CREATE_POST",
    MAKEPOST: "CREATE_POST",
    PUBLISH_POST: "CREATE_POST",
    PUBLISHPOST: "CREATE_POST",
    ADD_POST: "CREATE_POST",
    STATUS_POST: "CREATE_POST",
    NEW_STORY: "CREATE_STORY",
    ADD_HABIT: "CREATE_HABIT",
    ADD_EVENT: "CREATE_EVENT",
    ADD_CALENDAR: "CREATE_EVENT",
    UPDATE_EVENT: "EDIT_EVENT",
    UPDATE_CALENDAR: "EDIT_EVENT",
    REMOVE_EVENT: "DELETE_EVENT",
    DELETE_CALENDAR: "DELETE_EVENT",
    ADD_HABIT: "CREATE_HABIT",
    UPDATE_HABIT: "EDIT_HABIT",
    REMOVE_HABIT: "DELETE_HABIT",
    REMOVE_POST: "DELETE_POST",
    DELETE_MY_POST: "DELETE_POST",
    DOWNLOAD_YT: "DOWNLOAD_YOUTUBE",
    DOWNLOAD_VIDEO: "DOWNLOAD_YOUTUBE",
    YOUTUBE_DOWNLOAD: "DOWNLOAD_YOUTUBE",
    PLAY_VIDEO_PLAYER: "OPEN_VIDEO_PLAYER",
    OPEN_PLAYER: "OPEN_VIDEO_PLAYER",
    PLAY_IN_PLAYER: "OPEN_VIDEO_PLAYER",
    UPDATE_PRIVACY: "UPDATE_SETTINGS",
    UPDATE_THEME: "UPDATE_SETTINGS",
    CHANGE_THEME: "UPDATE_SETTINGS",
    CHANGE_LANGUAGE: "UPDATE_LANGUAGE_SETTINGS",
    LOG_WEIGHT: "LOG_HEALTH",
    LOG_MEAL: "LOG_HEALTH",
    LOG_WORKOUT: "LOG_HEALTH",
    FITNESS_LOG: "LOG_HEALTH",
    LOG_CRAVING: "LOG_RECOVERY",
    RECOVERY_LOG: "LOG_RECOVERY",
    REHAB_SUPPORT: "RECOVERY_SUPPORT",
    FRIEND_REQUESTS: "LIST_FRIENDS",
  };

  return aliases[value] || null;
};

export const resolveCatalogRoute = (value = "") => {
  const query = String(value || "")
    .trim()
    .toLowerCase();
  if (!query) return null;

  const exact = CONNECT_ROUTES.find(
    (entry) =>
      entry.route.toLowerCase() === query ||
      entry.label.toLowerCase() === query,
  );
  if (exact) return exact;

  const partial = CONNECT_ROUTES.find(
    (entry) =>
      query.includes(entry.label.toLowerCase()) ||
      entry.label.toLowerCase().includes(query) ||
      query.includes(entry.route.toLowerCase()),
  );
  return partial || null;
};

const firstNonEmpty = (...values) => {
  for (let i = 0; i < values.length; i += 1) {
    const text = String(values[i] ?? "").trim();
    if (text) return text;
  }
  return null;
};

const stripWrappingQuotes = (value = "") =>
  String(value || "")
    .trim()
    .replace(/^['"‘’“”]+/, "")
    .replace(/['"‘’“”]+$/, "")
    .trim();

export const isPlaceholderCaption = (value = "") => {
  const text = String(value || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return true;
  return /^(me\s+)?((a|an|some)\s+)?((funny|witty|random|good|nice|cool|humorous)\s+)*(caption|post|status)(\s+for\s+me)?$/i.test(
    text,
  ) || /^(with\s+)?((a|an)\s+)?((funny|witty|random|good|nice)\s+)+caption$/i.test(text);
};

export const extractCaptionFromText = (text = "") => {
  const value = String(text || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!value) return "";

  const labeled = value.match(
    /(?:here is (?:a )?(?:funny )?post(?: for you)?|(?:the )?caption(?: is)?|funny post(?: for you)?)\s*[:\-]\s*(.+?)(?:\s+(?:Creating|I(?:['’]m| am) creating|Posted|Now!)|$)/i,
  );
  if (labeled?.[1]) {
    return stripWrappingQuotes(labeled[1]);
  }

  const doubleQuoted = value.match(/"([^"]{2,500})"/);
  if (doubleQuoted) return doubleQuoted[1].trim();

  const smartQuoted = value.match(/“([^”]{2,500})”/);
  if (smartQuoted) return smartQuoted[1].trim();

  return "";
};

export const userWantsCreatePost = (userMessage = "", reply = "") => {
  const request = String(userMessage || "");
  const assistant = String(reply || "");
  if (
    /(?:create|make|write|publish)\s+(?:me\s+)?(?:a\s+|an\s+)?(?:new\s+)?(?:funny\s+|witty\s+)?post\b/i.test(
      request,
    ) ||
    /\bpost\b.{0,40}\b(caption|status)\b/i.test(request) ||
    /পোস্ট\s*(কর|তৈরি)/.test(request)
  ) {
    return true;
  }
  return /creating your post|here is a (?:funny )?post|i(?:['’]ve| have) posted/i.test(
    assistant,
  );
};

export const recoverAgentActions = ({
  actions = [],
  reply = "",
  userMessage = "",
} = {}) => {
  const list = Array.isArray(actions)
    ? actions.filter(Boolean)
    : actions && typeof actions === "object"
      ? [actions]
      : [];

  const captionFromReply = extractCaptionFromText(reply);
  const mapped = list.map((raw) => {
    if (normalizeAgentAction(raw?.action) !== AGENT_ACTIONS.CREATE_POST) {
      return raw;
    }
    const existing = firstNonEmpty(
      raw.searchQuery,
      raw.caption,
      raw.content,
      raw.text,
      raw.body,
    );
    if (!isPlaceholderCaption(existing)) return raw;
    return {
      ...raw,
      action: AGENT_ACTIONS.CREATE_POST,
      searchQuery: captionFromReply || existing || "",
    };
  });

  const hasCreatePost = mapped.some(
    (raw) => normalizeAgentAction(raw?.action) === AGENT_ACTIONS.CREATE_POST,
  );
  if (!hasCreatePost && userWantsCreatePost(userMessage, reply)) {
    mapped.push({
      action: AGENT_ACTIONS.CREATE_POST,
      searchQuery: captionFromReply || "",
    });
  }
  return mapped;
};

export const toAgentIntent = (raw = {}) => {
  const action = normalizeAgentAction(raw.action);
  if (!action) return null;

  let targetRoute = raw.targetRoute || null;
  let label = raw.label || null;
  if (action === AGENT_ACTIONS.NAVIGATE && !targetRoute) {
    const found = resolveCatalogRoute(
      raw.label || raw.searchQuery || raw.messageText,
    );
    if (found) {
      targetRoute = found.route;
      label = label || found.label;
    }
  }

  const searchQuery = firstNonEmpty(
    raw.searchQuery,
    raw.caption,
    raw.content,
    raw.text,
    raw.body,
    action === AGENT_ACTIONS.CREATE_POST ? null : raw.messageText,
  );

  return {
    action,
    targetName: raw.targetName || null,
    messageText: raw.messageText || null,
    searchQuery,
    targetRoute,
    subPath: raw.subPath || "",
    label,
    queryType: raw.queryType || null,
    params: {},
  };
};

const CONTENT_SLOT_ACTIONS = new Set([
  AGENT_ACTIONS.CREATE_NOTE,
  AGENT_ACTIONS.EDIT_NOTE,
  AGENT_ACTIONS.CREATE_TASK,
  AGENT_ACTIONS.EDIT_TASK,
  AGENT_ACTIONS.CREATE_EVENT,
  AGENT_ACTIONS.EDIT_EVENT,
  AGENT_ACTIONS.CREATE_HABIT,
  AGENT_ACTIONS.EDIT_HABIT,
  AGENT_ACTIONS.SEARCH_VIDEO,
  AGENT_ACTIONS.SEARCH_YOUTUBE,
  AGENT_ACTIONS.SEARCH_USERS,
  AGENT_ACTIONS.SEARCH_POSTS,
  AGENT_ACTIONS.SEARCH_APP,
  AGENT_ACTIONS.ADD_RECOVERY_DATA,
  AGENT_ACTIONS.UPDATE_LANGUAGE_SETTINGS,
  AGENT_ACTIONS.LOG_HEALTH,
  AGENT_ACTIONS.LOG_RECOVERY,
  AGENT_ACTIONS.DOWNLOAD_YOUTUBE,
]);

const ASK_FIELD_ALIASES = {
  name: "targetName",
  person: "targetName",
  friend: "targetName",
  target: "targetName",
  targetname: "targetName",
  who: "targetName",
  message: "messageText",
  messagetext: "messageText",
  text: "messageText",
  body: "messageText",
  caption: "searchQuery",
  content: "searchQuery",
  query: "searchQuery",
  search: "searchQuery",
  searchquery: "searchQuery",
  detail: "searchQuery",
  page: "targetRoute",
  route: "targetRoute",
  destination: "targetRoute",
  targetroute: "targetRoute",
};

export const normalizeAskField = (field) => {
  const raw = String(field || "").trim();
  if (["targetName", "messageText", "searchQuery", "targetRoute"].includes(raw)) {
    return raw;
  }
  const key = raw.toLowerCase().replace(/[\s-]+/g, "");
  return ASK_FIELD_ALIASES[key] || null;
};

export const isCancelFollowUp = (text = "") =>
  /^(cancel|never mind|nevermind|forget it|stop|no|nope|no thanks|don't|dont|not now|na|nah|thak|lagbe na|dorkar nai|থাক|না|বাতিল)(?:\s+[.!?]*)?$/i.test(
    String(text || "").trim(),
  );

export const isAffirmativeFollowUp = (text = "") =>
  /^(yes|yep|yeah|ok|okay|sure|do it|go ahead|please|confirm|ha|haan|hya|ji|thik|thik ache|thikase|হ্যাঁ|হা|ঠিক আছে|করো)(?:\s*[.!?]*)?$/i.test(
    String(text || "").trim(),
  );

export const looksLikeQuestion = (text = "") => {
  const value = String(text || "").trim();
  if (!value) return false;
  return (
    /\?/.test(value) ||
    /^(who|which|what|whom|whose|where|why|how|kothay|kothai|koi|kemon|ki|keno|kobe|koto|tumi kothay|ami ki|কাকে|কার|কি|কোন|কেন|কবে|কত|কোথায়|কোথায়|কেমন)\b/i.test(
      value,
    ) ||
    /\b(who|which|what|kothay|kothai)\b.+\??$/i.test(value)
  );
};

export const isFastLocalIntent = (intent, userText = "") => {
  if (!intent?.action) return false;
  const text = String(userText || "").trim();
  if (text.length > 180 && looksLikeQuestion(text)) return false;
  return true;
};

const hasValue = (value) => {
  const text = String(value ?? "").trim();
  return Boolean(text) && !isPlaceholderCaption(text);
};

export const getMissingIntentSlots = (intent) => {
  if (!intent?.action) return [];
  const missing = [];
  const action = intent.action;

  if (
    (FRIEND_REQUIRED_ACTIONS.has(action) ||
      (action === AGENT_ACTIONS.QUERY_CONTENT &&
        String(intent.queryType || "").toLowerCase() === "user")) &&
    !hasValue(intent.targetName)
  ) {
    missing.push("targetName");
  }

  if (action === AGENT_ACTIONS.SEND_MESSAGE_TO_USER && !hasValue(intent.messageText)) {
    missing.push("messageText");
  }

  if (action === AGENT_ACTIONS.NAVIGATE && !hasValue(intent.targetRoute)) {
    missing.push("targetRoute");
  }

  if (
    CONTENT_SLOT_ACTIONS.has(action) &&
    !hasValue(intent.searchQuery) &&
    !hasValue(intent.label) &&
    !hasValue(intent.messageText)
  ) {
    missing.push("searchQuery");
  }

  return missing;
};

export const getSlotQuestion = (intent, slots = []) => {
  const slot = slots[0];
  const action = intent?.action || "";
  if (slot === "targetName") {
    if (action === "AUDIO_CALL") return "Who should I call?";
    if (action === "VIDEO_CALL") return "Who should I video call?";
    if (action === "SEND_MESSAGE" || action === "SEND_MESSAGE_TO_USER") {
      return "Who should I message?";
    }
    if (action === "BUMP") return "Who should I bump?";
    if (action === "CREATE_LUDO" || action === "INVITE_LUDO") {
      return "Who should I invite to Ludo?";
    }
    if (action === "GET_LOCATION") return "Whose location do you want?";
    if (action === "GET_BIO") return "Whose bio should I look up?";
    if (action === "VIEW_PROFILE" || action === "NAVIGATE_PROFILE") {
      return "Whose profile should I open?";
    }
    if (action === "ADD_FRIEND") {
      return "Who should I send a friend request to?";
    }
    return "Who should I do that with? Type their name.";
  }
  if (slot === "messageText") return "What should the message say?";
  if (slot === "targetRoute") return "Which page should I open?";
  if (slot === "searchQuery") {
    if (action === "CREATE_NOTE") return "What should the note say?";
    if (action === "EDIT_NOTE") return "What should I change the note to?";
    if (action === "CREATE_TASK") return "What task should I add?";
    if (action === "EDIT_TASK") return "What should the task say?";
    if (action === "CREATE_EVENT") return "What event should I add, and for which day?";
    if (action === "EDIT_EVENT") return "Which event should I update, and what should it say?";
    if (action === "CREATE_HABIT") return "What habit should I add?";
    if (action === "EDIT_HABIT") return "Which habit should I update, and what should it be called?";
    if (action === "DOWNLOAD_YOUTUBE") {
      return "Paste a YouTube link, or tell me the video name to search.";
    }
    if (action === "SEARCH_YOUTUBE") {
      return "What YouTube video should I search for?";
    }
    if (action === "UPDATE_SETTINGS") {
      return "What should I change? Theme, privacy, location sharing, or notifications?";
    }
    if (action === "LOG_HEALTH") {
      return "What should I log — weight, a meal with calories, or a workout?";
    }
    if (action === "LOG_RECOVERY" || action === "RECOVERY_SUPPORT") {
      return "Tell me how you're feeling, a craving level (1–10), or how many days clean.";
    }
    if (action === "SEARCH_VIDEO") return "Which video should I search for?";
    if (action === "SEARCH_USERS") return "Who are you looking for?";
    if (action === "SEARCH_POSTS" || action === "SEARCH_APP") {
      return "What should I search for?";
    }
    return "Could you give me a bit more detail?";
  }
  return "I need a little more information to do that. Could you clarify?";
};

const cleanFollowUpValue = (text = "") =>
  String(text || "")
    .trim()
    .replace(/^(it'?s|he is|she is|they are|call|message|text|to|with)\s+/i, "")
    .replace(/\s+(please|now|for me)$/i, "")
    .replace(/[.!?]+$/g, "")
    .trim();

const pickFilled = (...values) => {
  for (let i = 0; i < values.length; i += 1) {
    if (hasValue(values[i])) return values[i];
  }
  return null;
};

export const mergeFollowUpIntent = ({
  pending,
  followUpText = "",
  geminiIntents = [],
} = {}) => {
  if (!pending?.intent?.action) return null;

  const geminiIntent = Array.isArray(geminiIntents) ? geminiIntents[0] : null;
  const geminiComplete =
    geminiIntent?.action && getMissingIntentSlots(geminiIntent).length === 0;

  if (
    geminiComplete &&
    geminiIntent.action !== pending.intent.action &&
    !isAffirmativeFollowUp(followUpText)
  ) {
    return geminiIntent;
  }

  const source = geminiIntent?.action === pending.intent.action ? geminiIntent : null;
  const merged = {
    ...pending.intent,
    ...(source || {}),
    action: pending.intent.action,
  };

  merged.targetName = pickFilled(source?.targetName, pending.intent.targetName);
  merged.messageText = pickFilled(source?.messageText, pending.intent.messageText);
  merged.searchQuery = pickFilled(source?.searchQuery, pending.intent.searchQuery);
  merged.targetRoute = pickFilled(source?.targetRoute, pending.intent.targetRoute);
  merged.subPath = source?.subPath || pending.intent.subPath || "";
  merged.label = pickFilled(source?.label, pending.intent.label);
  merged.queryType = source?.queryType || pending.intent.queryType || null;

  const stillMissing = getMissingIntentSlots(merged);
  const followUp = cleanFollowUpValue(followUpText);
  const slotsToFill = new Set(stillMissing);
  if (
    followUp &&
    !isAffirmativeFollowUp(followUpText) &&
    !isCancelFollowUp(followUpText)
  ) {
    (pending.missing || []).forEach((slot) => slotsToFill.add(slot));
  }

  if (followUp && slotsToFill.size > 0) {
    slotsToFill.forEach((slot) => {
      if (slot === "targetName") merged.targetName = followUp;
      if (slot === "messageText") merged.messageText = String(followUpText).trim();
      if (slot === "searchQuery") merged.searchQuery = String(followUpText).trim();
      if (slot === "targetRoute") {
        const found = resolveCatalogRoute(followUp);
        merged.targetRoute = found?.route || followUp;
        merged.label = found?.label || merged.label || followUp;
      }
    });
  }

  return merged;
};

