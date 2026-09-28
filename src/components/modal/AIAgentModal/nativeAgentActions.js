/**
 * The Connect app's AI agent action catalog, shared with the web agent.
 *
 * The model gets the exact same action list (and system prompt) as the
 * Expo app. Its planned actions are then translated into the web agent's
 * own intents (agentActions.js), so one request behaves the same on both.
 * Actions the website cannot run (camera roll, VPN browser, ...) are left
 * out of the list the model sees.
 */

import { resolveCatalogRoute } from "./agentCatalog";

// [name, label, sensitive?, destructive?, parameter hint for the model]
const ACTIONS = [
  ["NAVIGATE", "Navigate", false, false, "route (screen name), params?"],
  ["SEARCH_USERS", "Find users", false, false, "query"],
  ["VIEW_PROFILE", "View profile", false, false, 'userName | userId ("me" = own profile)'],
  ["OPEN_CHAT", "Open chat", false, false, "userName | userId"],
  ["SEND_MESSAGE", "Send message", true, false, "userName | userId, message"],
  ["START_AUDIO_CALL", "Start audio call", true, false, "userName | userId"],
  ["START_VIDEO_CALL", "Start video call", true, false, "userName | userId"],
  ["SEARCH_VIDEO", "Search videos", false, false, "query (Connect videos)"],
  ["PLAY_VIDEO", "Play video", false, false, "videoId"],
  ["SEARCH_YOUTUBE", "Search YouTube", false, false, "query"],
  ["DOWNLOAD_YOUTUBE", "Download YouTube video", true, false, "query | url | videoId, audioOnly?, quality?"],
  ["BLOCK_USER", "Block user", true, true, "userName | userId"],
  ["UNBLOCK_USER", "Unblock user", true, false, "userName | userId"],
  ["ADD_CONNECT", "Send connect request", true, false, "userName | userId"],
  ["REMOVE_CONNECT", "Remove connect", true, true, "userName | userId"],
  ["ACCEPT_CONNECT_REQUEST", "Accept connect request", true, false, "userName? (omit = newest request)"],
  ["DECLINE_CONNECT_REQUEST", "Decline connect request", true, false, "userName? (omit = newest request)"],
  ["OPEN_SETTINGS", "Open settings"],
  ["CHANGE_SETTING", "Change setting", false, false, "setting (key from SETTINGS), value; or settings: {key: value}"],
  ["SET_RELATIONSHIP", "Set connection relationship", false, false, 'userName | userId, relationTypes (e.g. ["Parent"]), mode? set|add|remove'],
  ["CREATE_TASK", "Create task", true, false, "text"],
  ["VIEW_TASKS", "View tasks"],
  ["UPDATE_TASK", "Edit task", true, false, "taskQuery | taskId, text?, completed?"],
  ["DELETE_TASK", "Delete task", true, true, "taskQuery | taskId"],
  ["CREATE_NOTE", "Create note", true, false, "content, title?"],
  ["CREATE_EVENT", "Add calendar event", true, false, "title, date (YYYY-MM-DD), time? (HH:mm)"],
  ["CREATE_HABIT", "Create habit", true, false, "name"],
  ["CREATE_POST", "Publish post", true, false, "caption, publish? (false = open composer draft)"],
  ["QUERY_APP_DATA", "Look up my data", false, false, "dataType: tasks|notes|notifications|connects|requests|events|habits|profile, query?"],
  // Fitness
  ["FITNESS_SUMMARY", "Today's fitness summary"],
  ["LOG_MEAL", "Log meal", true, false, "name, mealType? breakfast|lunch|dinner|snack, calories, proteinG, carbsG, fatG, estimated?"],
  ["LOG_WEIGHT", "Log weight", true, false, "weightKg | weightLb"],
  ["LOG_WATER", "Log water", true, false, "amountMl | glasses (1 glass = 250 ml)"],
  ["LOG_STEPS", "Log steps", true, false, "steps"],
  ["LOG_SLEEP", "Log sleep", true, false, "hours"],
  ["LOG_WORKOUT", "Log workout", true, false, "name, type walking|running|cycling|strength|hiit|yoga|swimming|sports|cardio|other, durationMin, intensity? light|moderate|vigorous"],
  ["FITNESS_REMINDER", "Set fitness reminder", true, false, "title, time (HH:mm), type? meal|water|workout|weight|custom"],
  ["ASK_FITNESS_COACH", "Ask fitness coach", false, false, "question"],
  ["FOOD_RECOMMENDATIONS", "Food suggestions"],
  ["FITNESS_PROGRESS", "Fitness progress"],
  // Recovery (addiction recovery program)
  ["RECOVERY_SUMMARY", "Recovery progress summary"],
  ["RECOVERY_CHECKIN", "Recovery check-in", true, false, "mood 1-5, craving 0-10, stress? 1-5, sleepHours?, triggers? [stress|boredom|loneliness|friends|tea_stall|after_meals|late_night|money|family_conflict|work_study|celebration|anger|sadness|cant_sleep|places|social_media], note?"],
  ["LOG_CRAVING", "Log craving", true, false, "intensity 1-10, outcome resisted|used|unsure, trigger?"],
  ["LOG_LAPSE", "Record a slip"],
  ["ASK_RECOVERY_COACH", "Talk to recovery coach", false, false, "message, mode? coach|sos|lapse"],
  ["RECOVERY_SOS", "Recovery SOS (urge right now)"],
  ["RECOVERY_HELP", "Crisis help & helplines"],
  ["OPEN_LUDO", "Open Ludo"],
  ["INVITE_LUDO_PLAYER", "Invite Ludo player", true, false, "userName | userId"],
  ["navigate_home", "Open Home"],
  ["navigate_connects", "Open Connects"],
  ["navigate_videos", "Open Videos"],
  ["navigate_message", "Open Messages"],
  ["navigate_menu", "Open Menu"],
  ["navigate_profile", "Open profile"],
  ["navigate_settings", "Open Settings"],
  ["navigate_tasks", "Open Tasks"],
  ["navigate_notes", "Open Notes"],
  ["navigate_fitness", "Open Fitness"],
  ["navigate_wallet", "Open Wallet"],
  ["navigate_calendar", "Open Calendar"],
  ["navigate_fitness_meal", "Open meal logging"],
  ["navigate_fitness_weight", "Open weight tracking"],
  ["navigate_fitness_workout", "Open workouts"],
  ["navigate_fitness_reminders", "Open fitness reminders"],
  ["navigate_fitness_coach", "Open fitness coach"],
  ["navigate_fitness_food", "Open food suggestions"],
  ["navigate_recovery", "Open Recovery"],
  ["navigate_recovery_checkin", "Open recovery check-in"],
  ["navigate_recovery_coach", "Open recovery coach"],
  ["navigate_recovery_plan", "Open recovery plan"],
  ["navigate_recovery_progress", "Open recovery progress"],
  ["navigate_recovery_settings", "Open recovery settings"],
  ["navigate_camera", "Open Camera"],
  ["navigate_video_library", "Open Video Library"],
  ["navigate_downloads", "Open Downloads"],
  ["navigate_media_player", "Open Media Player"],
  ["navigate_youtube", "Open YouTube"],
  ["start_ludo", "Start Ludo"],
  ["start_chess", "Start Chess"],
  ["speak_text", "Read text aloud", false, false, "messageText"],
  ["logout", "Log out", true, true],
  ["clear_agent_chat", "Clear agent chat", true, true],
];

export const NATIVE_AGENT_ACTIONS = ACTIONS.map(
  ([name, label, sensitive, destructive, params]) => ({
    name,
    label,
    sensitive: Boolean(sensitive),
    destructive: Boolean(destructive),
    params,
  }),
);

const definitionByName = new Map(
  NATIVE_AGENT_ACTIONS.map((definition) => [definition.name, definition]),
);

/**
 * Compact, model-facing description of every action, in the same
 * "NAME(params): label" lines the Connect app sends.
 */
export const describeAgentActionsForPrompt = () =>
  NATIVE_AGENT_ACTIONS.map((definition) =>
    definition.params
      ? `${definition.name}(${definition.params}): ${definition.label}`
      : `${definition.name}: ${definition.label}`,
  ).join("\n");

// Same aliases the app accepts for names models sometimes invent.
const ACTION_ALIASES = {
  LUDU: "OPEN_LUDO",
  OPEN_LUDU: "OPEN_LUDO",
  START_LUDU: "start_ludo",
  OPEN_LUDO_GAME: "OPEN_LUDO",
  START_LUDO_GAME: "start_ludo",
  INVITE_LUDU: "INVITE_LUDO_PLAYER",
  INVITE_LUDU_PLAYER: "INVITE_LUDO_PLAYER",
  CALL: "START_AUDIO_CALL",
  AUDIO_CALL: "START_AUDIO_CALL",
  START_AUDIO: "START_AUDIO_CALL",
  START_CALL: "START_AUDIO_CALL",
  MAKE_CALL: "START_AUDIO_CALL",
  CALL_USER: "START_AUDIO_CALL",
  VIDEO_CALL: "START_VIDEO_CALL",
  START_VIDEO_CALLING: "START_VIDEO_CALL",
  START_VIDEO: "START_VIDEO_CALL",
  OPEN_PROFILE: "VIEW_PROFILE",
  PROFILE: "VIEW_PROFILE",
  OPEN_MESSAGES: "navigate_message",
  BLOCK: "BLOCK_USER",
  UNBLOCK: "UNBLOCK_USER",
  ADD_TASK: "CREATE_TASK",
  CREATE_TODO: "CREATE_TASK",
  LIST_TASKS: "VIEW_TASKS",
  SHOW_TASKS: "VIEW_TASKS",
  EDIT_TASK: "UPDATE_TASK",
  COMPLETE_TASK: "UPDATE_TASK",
  SEARCH_YT: "SEARCH_YOUTUBE",
  YOUTUBE_SEARCH: "SEARCH_YOUTUBE",
  DOWNLOAD_YT: "DOWNLOAD_YOUTUBE",
  YOUTUBE_DOWNLOAD: "DOWNLOAD_YOUTUBE",
  INVITE_LUDO: "INVITE_LUDO_PLAYER",
  INVITE_LUDO_FRIEND: "INVITE_LUDO_PLAYER",
  INVITE_FRIEND_TO_LUDO: "INVITE_LUDO_PLAYER",
  ADD_NOTE: "CREATE_NOTE",
  NEW_NOTE: "CREATE_NOTE",
  WRITE_NOTE: "CREATE_NOTE",
  ADD_EVENT: "CREATE_EVENT",
  CREATE_CALENDAR_EVENT: "CREATE_EVENT",
  ADD_HABIT: "CREATE_HABIT",
  NEW_POST: "CREATE_POST",
  WRITE_POST: "CREATE_POST",
  PUBLISH_POST: "CREATE_POST",
  SHARE_POST: "CREATE_POST",
  REMOVE_TASK: "DELETE_TASK",
  SEND_CONNECT_REQUEST: "ADD_CONNECT",
  ADD_FRIEND: "ADD_CONNECT",
  UNFRIEND: "REMOVE_CONNECT",
  DISCONNECT: "REMOVE_CONNECT",
  UPDATE_SETTING: "CHANGE_SETTING",
  SET_SETTING: "CHANGE_SETTING",
  TOGGLE_SETTING: "CHANGE_SETTING",
  CHANGE_THEME: "CHANGE_SETTING",
  UPDATE_SETTINGS: "CHANGE_SETTING",
  UPDATE_RELATIONSHIP: "SET_RELATIONSHIP",
  CHANGE_RELATIONSHIP: "SET_RELATIONSHIP",
  SET_RELATION: "SET_RELATIONSHIP",
  EDIT_CONNECTION: "SET_RELATIONSHIP",
  UPDATE_CONNECTION: "SET_RELATIONSHIP",
  ACCEPT_CONNECT: "ACCEPT_CONNECT_REQUEST",
  ACCEPT_REQUEST: "ACCEPT_CONNECT_REQUEST",
  DECLINE_CONNECT: "DECLINE_CONNECT_REQUEST",
  DECLINE_REQUEST: "DECLINE_CONNECT_REQUEST",
  QUERY_CONTENT: "QUERY_APP_DATA",
  LOOKUP: "QUERY_APP_DATA",
  GET_MY_DETAILS: "QUERY_APP_DATA",
  OPEN_NOTES: "navigate_notes",
  OPEN_FITNESS: "navigate_fitness",
  OPEN_WALLET: "navigate_wallet",
  OPEN_CALENDAR: "navigate_calendar",
  OPEN_CHESS: "start_chess",
  PLAY_CHESS: "start_chess",
  PLAY_LUDO: "start_ludo",
  FITNESS_DASHBOARD: "FITNESS_SUMMARY",
  FITNESS_RECOMMENDATIONS: "FOOD_RECOMMENDATIONS",
  LOG_FITNESS_MEAL: "LOG_MEAL",
  LOG_FITNESS_WEIGHT: "LOG_WEIGHT",
  CREATE_FITNESS_REMINDER: "FITNESS_REMINDER",
  LOG_FOOD: "LOG_MEAL",
  ADD_MEAL: "LOG_MEAL",
  DRINK_WATER: "LOG_WATER",
  ADD_WATER: "LOG_WATER",
  ADD_WORKOUT: "LOG_WORKOUT",
  LOG_EXERCISE: "LOG_WORKOUT",
  LOG_RECOVERY: "RECOVERY_CHECKIN",
  RECOVERY_SUPPORT: "ASK_RECOVERY_COACH",
  RECOVERY_COACH: "ASK_RECOVERY_COACH",
  SOS: "RECOVERY_SOS",
  CRISIS_HELP: "RECOVERY_HELP",
  LOG_SLIP: "LOG_LAPSE",
};

/** Returns the catalog name for a planned action, or null if unknown. */
export const normalizeNativeAction = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (definitionByName.has(raw)) return raw;
  const lower = raw.toLowerCase();
  if (definitionByName.has(lower)) return lower;
  const upper = raw.toUpperCase().replace(/[\s-]+/g, "_");
  if (definitionByName.has(upper)) return upper;
  return ACTION_ALIASES[upper] || null;
};

export const getNativeActionDefinition = (name) =>
  definitionByName.get(normalizeNativeAction(name)) || null;

export const getNativeActionLabel = (name) =>
  getNativeActionDefinition(name)?.label ||
  String(name || "").replace(/_/g, " ").toLowerCase();

const NAVIGATE_ROUTES = {
  navigate_home: { route: "/", label: "Home" },
  navigate_connects: { route: "/connects/", label: "Connects" },
  navigate_videos: { route: "/watch", label: "Videos" },
  navigate_message: { route: "/message", label: "Messages" },
  navigate_menu: { route: "/menu", label: "Menu" },
  navigate_profile: { route: "MY_PROFILE", label: "My profile" },
  navigate_settings: { route: "/settings", label: "Settings" },
  OPEN_SETTINGS: { route: "/settings", label: "Settings" },
  navigate_tasks: { route: "/tasks", label: "Tasks" },
  VIEW_TASKS: { route: "/tasks", label: "Tasks" },
  navigate_notes: { route: "/notes", label: "Notes" },
  navigate_fitness: { route: "/health", label: "Fitness" },
  navigate_wallet: { route: "/wallet", label: "Wallet" },
  navigate_calendar: { route: "/calendar", label: "Calendar" },
  navigate_fitness_meal: { route: "/health", label: "Meal logging" },
  navigate_fitness_weight: { route: "/health", label: "Weight tracking" },
  navigate_fitness_workout: { route: "/health", label: "Workouts" },
  navigate_fitness_reminders: { route: "/health", label: "Fitness reminders" },
  navigate_fitness_coach: { route: "/health", label: "Fitness coach" },
  navigate_fitness_food: { route: "/health", label: "Food suggestions" },
  navigate_recovery: { route: "/rehab", label: "Recovery" },
  navigate_recovery_checkin: { route: "/rehab/checkin", label: "Recovery check-in" },
  navigate_recovery_coach: { route: "/rehab/coach", label: "Recovery coach" },
  navigate_recovery_plan: { route: "/rehab/plan", label: "Recovery plan" },
  navigate_recovery_progress: { route: "/rehab/progress", label: "Recovery progress" },
  navigate_recovery_settings: { route: "/rehab/settings", label: "Recovery settings" },
  navigate_camera: { route: "/camera", label: "Camera" },
  navigate_video_library: { route: "/downloads", label: "Video library" },
  navigate_downloads: { route: "/downloads", label: "Downloads" },
  navigate_media_player: { route: "/video-player", label: "Media player" },
  navigate_youtube: { route: "/youtube", label: "YouTube" },
};

// App screen names the model may pass to NAVIGATE(route).
const SCREEN_ROUTES = {
  home: "/",
  feed: "/",
  message: "/message",
  messages: "/message",
  messagelist: "/message",
  chat: "/message",
  connects: "/connects/",
  friends: "/connects/",
  videos: "/watch",
  watch: "/watch",
  menu: "/menu",
  profile: "MY_PROFILE",
  myprofile: "MY_PROFILE",
  settings: "/settings",
  tasks: "/tasks",
  task: "/tasks",
  notes: "/notes",
  calendar: "/calendar",
  habits: "/habits",
  fitness: "/health",
  fitnessdashboard: "/health",
  health: "/health",
  recovery: "/rehab",
  rehab: "/rehab",
  wallet: "/wallet",
  ludo: "/ludo-game",
  chess: "/chess-game",
  youtube: "/youtube",
  mediaplayer: "/video-player",
  downloads: "/downloads",
  camera: "/camera",
  notifications: "/notification",
  notification: "/notification",
  marketplace: "/marketplace",
  groups: "/groups",
};

const QUERY_TYPE_BY_DATA = {
  task: "tasks",
  tasks: "tasks",
  todo: "tasks",
  note: "notes",
  notes: "notes",
  notification: "notifications",
  notifications: "notifications",
  connect: "connects",
  connects: "connects",
  friend: "connects",
  friends: "connects",
  request: "requests",
  requests: "requests",
  event: "calendar",
  events: "calendar",
  calendar: "calendar",
  habit: "habits",
  habits: "habits",
  profile: "profile",
  me: "profile",
};

const text = (...values) => {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    const next = String(value).trim();
    if (next) return next;
  }
  return "";
};

const resolveRoute = (value) => {
  const raw = text(value);
  if (!raw) return null;
  if (raw.startsWith("/")) return { route: raw, label: raw };
  const key = raw.toLowerCase().replace(/[^a-z]/g, "");
  if (SCREEN_ROUTES[key]) return { route: SCREEN_ROUTES[key], label: raw };
  const found = resolveCatalogRoute(raw);
  return found ? { route: found.route, label: found.label } : null;
};

const intent = (action, fields = {}) => ({
  action,
  targetName: null,
  targetId: null,
  messageText: null,
  searchQuery: null,
  targetRoute: null,
  subPath: "",
  label: null,
  queryType: null,
  params: {},
  ...fields,
});

/**
 * Translates one planned app action ({action, parameters, targetName, ...})
 * into a web agent intent. Returns null for actions the website can't run.
 */
export const nativeActionToWebIntent = (raw = {}) => {
  const name = normalizeNativeAction(raw?.action);
  if (!name) return null;
  // Models sometimes put arguments beside "action" instead of inside
  // "parameters"; both are accepted, "parameters" winning.
  const {
    action: _action,
    id: _id,
    type: _type,
    status: _status,
    parameters: nested,
    ...flat
  } = raw || {};
  const parameters = {
    ...flat,
    ...(nested && typeof nested === "object" ? nested : {}),
  };
  const person = text(parameters.userName, raw.targetName, parameters.name);
  const personId = text(parameters.userId, parameters.profileId) || null;
  const query = text(parameters.query, raw.searchQuery, parameters.text);
  const nativeAction = { nativeAction: name };

  if (NAVIGATE_ROUTES[name]) {
    const { route, label } = NAVIGATE_ROUTES[name];
    return intent("NAVIGATE", { targetRoute: route, label, ...nativeAction });
  }

  switch (name) {
    case "NAVIGATE": {
      const found = resolveRoute(
        text(parameters.route, raw.targetRoute, parameters.screen),
      );
      if (!found) return null;
      return intent("NAVIGATE", {
        targetRoute: found.route,
        label: found.label,
        ...nativeAction,
      });
    }
    case "SEARCH_USERS":
      return intent("SEARCH_USERS", { searchQuery: query || person, ...nativeAction });
    case "VIEW_PROFILE":
      if (/^(me|myself|my profile|আমি|আমার)$/i.test(person)) {
        return intent("NAVIGATE", { targetRoute: "MY_PROFILE", label: "My profile", ...nativeAction });
      }
      return intent("VIEW_PROFILE", { targetName: person, targetId: personId, ...nativeAction });
    case "OPEN_CHAT":
      return intent("SEND_MESSAGE", { targetName: person, targetId: personId, ...nativeAction });
    case "SEND_MESSAGE": {
      const message = text(parameters.message, raw.messageText, parameters.text);
      return intent(message ? "SEND_MESSAGE_TO_USER" : "SEND_MESSAGE", {
        targetName: person,
        targetId: personId,
        messageText: message || null,
        ...nativeAction,
      });
    }
    case "START_AUDIO_CALL":
      return intent("AUDIO_CALL", { targetName: person, targetId: personId, ...nativeAction });
    case "START_VIDEO_CALL":
      return intent("VIDEO_CALL", { targetName: person, targetId: personId, ...nativeAction });
    case "SEARCH_VIDEO":
      return intent("SEARCH_VIDEO", { searchQuery: query, ...nativeAction });
    case "PLAY_VIDEO": {
      const videoId = text(parameters.videoId, parameters.id);
      if (!videoId) return intent("SEARCH_VIDEO", { searchQuery: query, ...nativeAction });
      return intent("NAVIGATE", {
        targetRoute: `/watch/${encodeURIComponent(videoId)}`,
        label: "Video",
        ...nativeAction,
      });
    }
    case "SEARCH_YOUTUBE":
      return intent("SEARCH_YOUTUBE", { searchQuery: query, ...nativeAction });
    case "DOWNLOAD_YOUTUBE": {
      const videoId = text(parameters.videoId);
      const source = text(
        parameters.url,
        videoId ? `https://www.youtube.com/watch?v=${videoId}` : "",
        query,
        parameters.title,
      );
      return intent("DOWNLOAD_YOUTUBE", {
        searchQuery: source,
        audioOnly: parameters.audioOnly === true || parameters.audioOnly === "true",
        quality: Number(parameters.quality) || undefined,
        ...nativeAction,
      });
    }
    case "BLOCK_USER":
      return intent("BLOCK", { targetName: person, targetId: personId, ...nativeAction });
    case "UNBLOCK_USER":
      return intent("UNBLOCK", { targetName: person, targetId: personId, ...nativeAction });
    case "ADD_CONNECT":
      return intent("ADD_CONNECT", { targetName: person, targetId: personId, ...nativeAction });
    case "REMOVE_CONNECT":
      return intent("UNFRIEND", { targetName: person, targetId: personId, ...nativeAction });
    case "ACCEPT_CONNECT_REQUEST":
      return intent("ACCEPT_CONNECT", { searchQuery: person || null, ...nativeAction });
    case "DECLINE_CONNECT_REQUEST":
      return intent("DECLINE_CONNECT", { searchQuery: person || null, ...nativeAction });
    case "CHANGE_SETTING":
      return intent("CHANGE_SETTING", {
        params: {
          setting: parameters.setting ?? parameters.name ?? parameters.key,
          value: parameters.value,
          settings: parameters.settings,
        },
        ...nativeAction,
      });
    case "SET_RELATIONSHIP":
      return intent("SET_RELATIONSHIP", {
        targetName: person,
        targetId: personId,
        params: {
          relationTypes:
            parameters.relationTypes ?? parameters.relationshipTypes ?? parameters.relation,
          mode: parameters.mode,
        },
        ...nativeAction,
      });
    case "CREATE_TASK":
      return intent("CREATE_TASK", {
        searchQuery: text(parameters.text, parameters.title, raw.messageText, query),
        ...nativeAction,
      });
    case "UPDATE_TASK":
      return intent("EDIT_TASK", {
        searchQuery: text(parameters.taskQuery, raw.taskQuery, parameters.taskId),
        messageText: text(parameters.text, raw.taskText) || null,
        params: { completed: parameters.completed, taskId: parameters.taskId },
        ...nativeAction,
      });
    case "DELETE_TASK":
      return intent("DELETE_TASK", {
        searchQuery: text(parameters.taskQuery, raw.taskQuery, parameters.taskId),
        params: { taskId: parameters.taskId },
        ...nativeAction,
      });
    case "CREATE_NOTE": {
      const title = text(parameters.title);
      const content = text(parameters.content, parameters.text, raw.messageText);
      return intent("CREATE_NOTE", {
        searchQuery: title && content && !content.startsWith(title) ? `${title}: ${content}` : content || title,
        params: { title },
        ...nativeAction,
      });
    }
    case "CREATE_EVENT":
      return intent("CREATE_EVENT", {
        searchQuery: text(parameters.title, parameters.name, query),
        params: { date: parameters.date, time: parameters.time },
        ...nativeAction,
      });
    case "CREATE_HABIT":
      return intent("CREATE_HABIT", {
        searchQuery: text(parameters.name, parameters.title, query),
        ...nativeAction,
      });
    case "CREATE_POST":
      return intent("CREATE_POST", {
        searchQuery: text(parameters.caption, parameters.content, parameters.text, query),
        params: { publish: parameters.publish },
        ...nativeAction,
      });
    case "QUERY_APP_DATA": {
      const dataType = text(parameters.dataType, parameters.type, "profile").toLowerCase();
      return intent("QUERY_CONTENT", {
        queryType: QUERY_TYPE_BY_DATA[dataType] || dataType,
        searchQuery: text(parameters.query) || null,
        ...nativeAction,
      });
    }
    case "OPEN_LUDO":
    case "start_ludo":
      return intent("CREATE_LUDO", { ...nativeAction });
    case "INVITE_LUDO_PLAYER":
      return intent("INVITE_LUDO", { targetName: person, targetId: personId, ...nativeAction });
    case "start_chess":
      return intent("CREATE_CHESS", { ...nativeAction });
    case "speak_text":
      return intent("SPEAK_TEXT", {
        messageText: text(parameters.messageText, parameters.text, raw.messageText),
        ...nativeAction,
      });
    case "logout":
      return intent("LOGOUT", { ...nativeAction });
    case "clear_agent_chat":
      return intent("CLEAR_AGENT_CHAT", { ...nativeAction });
    default:
      // Fitness + recovery actions share their names and parameters.
      return intent(name, {
        searchQuery: query || null,
        messageText: text(parameters.message, parameters.question) || null,
        params: { ...parameters },
        ...nativeAction,
      });
  }
};
