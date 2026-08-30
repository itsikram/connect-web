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
  CREATE_HABIT: "CREATE_HABIT",
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
  AGENT_ACTIONS.BLOCK,
  AGENT_ACTIONS.UNBLOCK,
  AGENT_ACTIONS.VIEW_PROFILE,
  AGENT_ACTIONS.GET_LOCATION,
  AGENT_ACTIONS.GET_BIO,
  AGENT_ACTIONS.ADD_FRIEND,
  AGENT_ACTIONS.UNFRIEND,
  AGENT_ACTIONS.NAVIGATE_PROFILE,
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
  AGENT_ACTIONS.CREATE_HABIT,
  AGENT_ACTIONS.CREATE_POST,
  AGENT_ACTIONS.CREATE_STORY,
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

