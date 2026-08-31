import {
  FRIEND_REQUIRED_ACTIONS,
  NO_FRIEND_ACTIONS,
  DIRECTORY_LOOKUP_ACTIONS,
} from "./agentCatalog";
import { normalizeBanglishCommand } from "./banglish";
import { normalizeBanglaCommand } from "./agentFastPath";

export { FRIEND_REQUIRED_ACTIONS, NO_FRIEND_ACTIONS, DIRECTORY_LOOKUP_ACTIONS };

/**
 * How the agent should respond when it confidently understands the user's intent.
 * - reply: answer in text immediately
 * - navigate: perform navigation immediately
 * - confirm: show an action button / confirmation UI first
 */
export const ACTION_RESPONSE_MODE = {
  GET_BIO: "reply",
  GET_LOCATION: "reply",
  GET_MY_DETAILS: "reply",
  QUERY_CONTENT: "reply",
  SEARCH_APP: "reply",
  SEARCH_USERS: "reply",
  SEARCH_POSTS: "reply",
  SEARCH_VIDEO: "reply",
  LIST_NOTES: "reply",
  LIST_TASKS: "reply",
  LIST_NOTIFICATIONS: "reply",
  LIST_HABITS: "reply",
  LIST_EVENTS: "reply",
  LIST_FRIENDS_INFO: "reply",
  VIEW_PROFILE: "navigate",
  NAVIGATE_PROFILE: "navigate",
  NAVIGATE: "navigate",
  OPEN_MESSAGES: "navigate",
  OPEN_FRIENDS: "navigate",
  LIST_FRIENDS: "navigate",
  CREATE_POST: "navigate",
  DELETE_POST: "navigate",
  CREATE_STORY: "navigate",
  DOWNLOAD_YOUTUBE: "navigate",
  OPEN_VIDEO_PLAYER: "navigate",
  UPDATE_SETTINGS: "navigate",
  LOG_HEALTH: "navigate",
  LOG_RECOVERY: "navigate",
  RECOVERY_SUPPORT: "navigate",
  SEND_MESSAGE_TO_USER: "navigate",
  SEND_MESSAGE: "confirm",
  VIDEO_CALL: "confirm",
  AUDIO_CALL: "confirm",
  BUMP: "confirm",
  CREATE_LUDO: "navigate",
  INVITE_LUDO: "confirm",
  INVITE_CHESS: "confirm",
  BLOCK: "confirm",
  UNBLOCK: "confirm",
  ADD_FRIEND: "confirm",
  UNFRIEND: "confirm",
};

export const getActionResponseMode = (action) =>
  ACTION_RESPONSE_MODE[action] || "confirm";

// ── Static route map ─────────────────────────────────────────────────────────
/**
 * Maps keywords (all lowercase) → { route, label }.
 * Longer / more specific phrases should come FIRST in the array
 * because matching iterates in order.
 */
const STATIC_ROUTE_MAP = [
  // ── Auth ──────────────────────────────────────────────────────────────────
  { keys: ["login", "sign in", "signin"], route: "/login", label: "Login" },
  {
    keys: ["signup", "sign up", "register", "create account"],
    route: "/signup",
    label: "Sign Up",
  },

  // ── Home ──────────────────────────────────────────────────────────────────
  {
    keys: ["home", "feed", "news feed", "main feed", "home page"],
    route: "/",
    label: "Home",
  },

  // ── Settings (specific sub-pages first) ──────────────────────────────────
  {
    keys: ["account settings", "account setting"],
    route: "/settings/account",
    label: "Account Settings",
  },
  {
    keys: ["privacy settings", "privacy setting", "privacy"],
    route: "/settings/privacy",
    label: "Privacy Settings",
  },
  {
    keys: [
      "notification settings",
      "notification setting",
      "notifications setting",
    ],
    route: "/settings/notification",
    label: "Notification Settings",
  },
  {
    keys: ["message settings", "message setting"],
    route: "/settings/message",
    label: "Message Settings",
  },
  {
    keys: ["sound settings", "sound setting", "ringtone settings"],
    route: "/settings/sound",
    label: "Sound Settings",
  },
  {
    keys: ["cache settings", "cache setting", "clear cache"],
    route: "/settings/cache",
    label: "Cache Settings",
  },
  {
    keys: ["preference settings", "preference setting", "preferences"],
    route: "/settings/preference",
    label: "Preference Settings",
  },
  {
    keys: ["settings", "setting", "profile settings", "edit profile"],
    route: "/settings",
    label: "Settings",
  },

  // ── My profile ────────────────────────────────────────────────────────────
  {
    keys: [
      "my profile",
      "my page",
      "my account",
      "profile page",
      "own profile",
      "my timeline",
      // Explicit "view/see/check/open my profile" variants so NAV_PATTERNS
      // can resolve them to a static route before profile-sub-nav runs
      "view my profile",
      "see my profile",
      "check my profile",
      "open my profile",
      "show my profile",
      "go to my profile",
      "take me to my profile",
    ],
    route: "MY_PROFILE",
    label: "My Profile",
  },
  {
    keys: ["my friends", "my friend list", "all my friends"],
    route: "MY_PROFILE_FRIENDS",
    label: "My Friends List",
  },
  {
    keys: ["my images", "my photos", "my pictures", "my gallery"],
    route: "MY_PROFILE_IMAGES",
    label: "My Photos",
  },
  {
    keys: ["my videos", "my video uploads"],
    route: "MY_PROFILE_VIDEOS",
    label: "My Videos",
  },
  {
    keys: ["my about", "about me", "my bio"],
    route: "MY_PROFILE_ABOUT",
    label: "My About",
  },

  // ── Friends section ───────────────────────────────────────────────────────
  {
    keys: ["friend requests", "friend request", "pending requests", "requests"],
    route: "/friends/requests",
    label: "Friend Requests",
  },
  {
    keys: ["friend suggestions", "people you may know", "suggestions"],
    route: "/friends/suggestions",
    label: "Friend Suggestions",
  },
  {
    keys: [
      "places near you",
      "places nearby",
      "places near me",
      "nearby places",
    ],
    route: "/friends/places",
    label: "Places Near You",
  },
  {
    keys: ["friends page", "friends section", "friends"],
    route: "/friends/",
    label: "Friends",
  },

  // ── Messages ──────────────────────────────────────────────────────────────
  {
    keys: [
      "messages",
      "message",
      "message page",
      "inbox",
      "chats",
      "chat page",
      "dms",
      "mesej",
      "messege",
    ],
    route: "/message",
    label: "Messages",
  },

  // ── Watch / Videos ────────────────────────────────────────────────────────
  {
    keys: ["watch page", "video page", "videos", "watch videos", "watch"],
    route: "/watch",
    label: "Watch",
  },

  // ── Games ─────────────────────────────────────────────────────────────────
  {
    keys: ["ludo game", "ludo", "play ludo"],
    route: "/ludo-game",
    label: "Ludo Game",
  },
  {
    keys: ["chess game", "chess", "play chess"],
    route: "/chess-game",
    label: "Chess Game",
  },

  // ── Other pages ───────────────────────────────────────────────────────────
  {
    keys: ["marketplace", "market", "buy sell", "shop"],
    route: "/marketplace",
    label: "Marketplace",
  },
  { keys: ["groups", "group page"], route: "/groups", label: "Groups" },
  { keys: ["story", "stories"], route: "/story/", label: "Stories" },
  { keys: ["portfolio"], route: "/portfolio/", label: "Portfolio" },
  {
    keys: ["portfolio about"],
    route: "/portfolio/about",
    label: "Portfolio About",
  },
  {
    keys: ["portfolio resume", "resume"],
    route: "/portfolio/resume",
    label: "Portfolio Resume",
  },
  {
    keys: ["portfolio blogs", "portfolio blog"],
    route: "/portfolio/blogs",
    label: "Portfolio Blogs",
  },
  {
    keys: ["portfolio contact"],
    route: "/portfolio/contact",
    label: "Portfolio Contact",
  },
  {
    keys: [
      "youtube download",
      "yt download",
      "yt-download",
      "download youtube",
    ],
    route: "/yt-download",
    label: "YT Downloader",
  },
  {
    keys: ["saved videos", "downloads", "downloaded videos"],
    route: "/downloads",
    label: "Saved Videos",
  },
  {
    keys: [
      "notes",
      "note",
      "my notes",
      // Action phrases — "create note" should navigate to /notes
      "create note",
      "create a note",
      "new note",
      "add note",
      "add a note",
      "write note",
      "write a note",
      "make note",
      "make a note",
      "open notes",
      "go to notes",
    ],
    route: "/notes",
    label: "Notes",
  },
  {
    keys: [
      "tasks",
      "task",
      "to do",
      "todo",
      "to-do list",
      "my tasks",
      "create task",
      "create a task",
      "new task",
      "add task",
      "add a task",
      "write task",
      "make task",
    ],
    route: "/tasks",
    label: "Tasks",
  },
  {
    keys: ["focus timer", "pomodoro", "timer", "focus"],
    route: "/timer",
    label: "Focus Timer",
  },
  {
    keys: ["flashcards", "flash cards", "flash card", "study cards"],
    route: "/flashcards",
    label: "Flashcards",
  },
  {
    keys: ["calendar", "schedule", "events"],
    route: "/calendar",
    label: "Calendar",
  },
  {
    keys: ["habits", "habit tracker", "habit", "track habits"],
    route: "/habits",
    label: "Habits",
  },
  {
    keys: ["health", "health tracker", "health page"],
    route: "/health",
    label: "Health",
  },
  { keys: ["rehab", "rehabilitation"], route: "/rehab", label: "Rehab" },
  {
    keys: ["video player", "player"],
    route: "/video-player",
    label: "Video Player",
  },
  { keys: ["youtube", "yt"], route: "/youtube", label: "YouTube" },
  { keys: ["menu"], route: "/menu", label: "Menu" },
];

/**
 * Navigation intent patterns.
 * Capture group 1 = destination (what the user wants to navigate to).
 * noCapture = true means the route is embedded in the pattern itself.
 */
const NAV_PATTERNS = [
  /^(?:go|navigate|take me|open|show|switch|jump)\s+(?:to\s+)?(?:the\s+)?(.+)$/i,
  /^(?:open|show|view|see)\s+(?:my\s+)?(.+)(?:\s+page)?$/i,
  /^(?:i\s+want\s+to\s+(?:go\s+to|see|view|open)\s+)(?:the\s+)?(.+)$/i,
  /^take\s+me\s+to\s+(?:the\s+)?(.+)$/i,
  /^(?:where\s+(?:is|are)\s+(?:the\s+)?)(.+)(?:\s+page)?$/i,
  /^(.+)\s+page$/i,
];

/**
 * Words that are definitely NOT friend names.
 * If detectProfileSubNav captures one of these, the match is discarded.
 */
const NON_NAME_WORDS = new Set([
  // Pronouns / determiners
  "my",
  "your",
  "his",
  "her",
  "their",
  "our",
  "its",
  "me",
  "him",
  "them",
  "us",
  // Articles
  "the",
  "a",
  "an",
  // Demonstratives
  "this",
  "that",
  "these",
  "those",
  // Navigation verbs (left over from broad patterns)
  "go",
  "open",
  "show",
  "view",
  "see",
  "check",
  "navigate",
]);

/**
 * Friend profile sub-page patterns.
 * Possessive patterns (John's profile) are tried first.
 * Non-possessive patterns (go to atik profile, open atik friends) follow.
 * ALL captured names pass through detectProfileSubNav's NON_NAME_WORDS guard
 * so pronouns like "my", "your", "the" are always rejected.
 */
const PROFILE_SUB_PATTERNS = [
  // ── Possessive sub-pages (require apostrophe 's) ──────────────────────────
  {
    regex: /(.+?)'s\s+friends(?:\s+list)?/i,
    subPath: "/friends",
    subLabel: "Friends",
  },
  {
    regex: /(.+?)'s\s+(?:images|photos|pictures|gallery)/i,
    subPath: "/images",
    subLabel: "Photos",
  },
  { regex: /(.+?)'s\s+videos?/i, subPath: "/videos", subLabel: "Videos" },
  { regex: /(.+?)'s\s+about/i, subPath: "/about", subLabel: "About" },
  { regex: /(.+?)'s\s+posts?/i, subPath: "", subLabel: "Posts" },
  { regex: /(.+?)'s\s+profile/i, subPath: "", subLabel: "Profile" },
  // "go to X's page" (possessive)
  {
    regex: /(?:go\s+to|view|open|visit)\s+(.+?)'s\s*(?:page|profile)/i,
    subPath: "",
    subLabel: "Profile",
  },

  // ── Non-possessive sub-pages ──────────────────────────────────────────────
  // "go to atik profile", "open atik friends", "view atik photos", etc.
  // These fire AFTER findStaticRoute has already rejected the message, so
  // static routes like /friends/ and /watch are never reached from here.
  {
    regex:
      /(?:go\s+to|visit|open|view|show(?:\s+me)?|take\s+me\s+to)\s+(.+?)\s+profile$/i,
    subPath: "",
    subLabel: "Profile",
  },
  {
    regex:
      /(?:find(?:\s+me)?|search(?:\s+for)?|look\s+up)\s+(.+?)(?:'s)?\s+profile$/i,
    subPath: "",
    subLabel: "Profile",
  },
  {
    regex: /(?:go\s+to|visit|open|view)\s+(.+?)\s+friends(?:\s+list)?$/i,
    subPath: "/friends",
    subLabel: "Friends",
  },
  {
    regex:
      /(?:go\s+to|visit|open|view)\s+(.+?)\s+(?:photos|images|pictures|gallery)$/i,
    subPath: "/images",
    subLabel: "Photos",
  },
  {
    regex: /(?:go\s+to|visit|open|view)\s+(.+?)\s+videos?$/i,
    subPath: "/videos",
    subLabel: "Videos",
  },
  {
    regex: /(?:go\s+to|visit|open|view)\s+(.+?)\s+about$/i,
    subPath: "/about",
    subLabel: "About",
  },

  // Bare "X profile" (no nav verb) — single/double word names only
  {
    regex: /^([\w\u00C0-\u024F]+(?:\s+[\w\u00C0-\u024F]+)?)\s+profile$/i,
    subPath: "",
    subLabel: "Profile",
  },

  // "profile of X" / "profile for X"
  { regex: /profile\s+(?:of|for)\s+(.+)/i, subPath: "", subLabel: "Profile" },
];

// ── Direct send-message parsing ───────────────────────────────────────────────

const GENERIC_MESSAGE_TEXTS = new Set([
  "message",
  "a message",
  "the message",
  "this message",
  "text",
  "a text",
  "the text",
  "this text",
  "msg",
  "mesej",
  "messege",
  "bartha",
  "বার্তা",
  "মেসেজ",
  "এই বার্তা",
  "এই মেসেজ",
]);

const cleanCapturedSegment = (value = "") =>
  String(value)
    .trim()
    .replace(/^["'`“”‘’]+|["'`“”‘’]+$/g, "")
    .replace(/[?.!,;:।]+$/, "")
    .trim();

const toOutgoingChatText = (value = "") => {
  const text = cleanCapturedSegment(value);
  if (!text) return "";
  const lower = text.toLowerCase();
  if (
    /^(where(?:'s|\s+is|\s+are)\s+(?:he|she|they|him|her)(?:\s+at)?|where\s+(?:he|she|they)\s+(?:is|are)(?:\s+at)?)$/i.test(
      lower,
    )
  ) {
    return "Where are you?";
  }
  if (
    /^(where(?:'s|\s+is|\s+are)\s+(?:he|she|they|him|her)(?:\s+at)?|where\s+(?:he|she|they)\s+(?:is|are)(?:\s+at)?)$/i.test(
      lower,
    )
  ) {
    return "Where are you?";
  }
  if (
    /^(how(?:'s|\s+is|\s+are)\s+(?:he|she|they)|how\s+(?:he|she|they)\s+(?:is|are))$/i.test(
      lower,
    )
  ) {
    return "How are you?";
  }
  if (
    /^(what(?:'s|\s+is)\s+(?:he|she|they)\s+doing|what\s+(?:he|she|they)\s+(?:is|are)\s+doing)$/i.test(
      lower,
    )
  ) {
    return "What are you doing?";
  }
  const capped = text.charAt(0).toUpperCase() + text.slice(1);
  if (
    /^(where|what|why|how|when|who|which|is|are|do|did|can|could|would)\b/i.test(
      capped,
    ) &&
    !/[?؟]$/.test(capped)
  ) {
    return `${capped}?`;
  }
  return capped;
};

const buildSendMessageIntent = ({ targetName, messageText }) => ({
  action: "SEND_MESSAGE_TO_USER",
  targetName: cleanCapturedSegment(targetName) || null,
  messageText: toOutgoingChatText(messageText) || null,
  searchQuery: null,
  targetRoute: null,
  subPath: null,
  label: null,
  params: {},
});

const isGenericMessageText = (value = "") =>
  GENERIC_MESSAGE_TEXTS.has(cleanCapturedSegment(value).toLowerCase());

const parseDirectSendMessageIntent = (message) => {
  if (
    /(?:send|make|add)\s+(?:a\s+)?friend\s+request\b/i.test(message) ||
    /\bfriend\s+request\s+to\b/i.test(message)
  ) {
    return null;
  }

  const patterns = [
    {
      regex:
        /^(?:please\s+)?(?:send\s+(?:a\s+)?(?:message|dm|text)\s+to|message|text|dm)\s+(.+?)\s+and\s+(?:then\s+)?(?:ask|tell|say)\s+(?:him|her|them\s+)?(.+)$/i,
      messageIndex: 2,
      targetIndex: 1,
    },
    {
      regex:
        /^(?:please\s+)?(?:send|text)\s+(.+?)\s+a\s+message\s+(?:and\s+)?(?:ask|tell|say)\s+(?:him|her|them\s+)?(.+)$/i,
      messageIndex: 2,
      targetIndex: 1,
    },
    {
      regex:
        /^(?:please\s+)?(?:message|text|dm)\s+(.+?)\s+(?:asking|saying|telling)\s+(?:him|her|them\s+)?(.+)$/i,
      messageIndex: 2,
      targetIndex: 1,
    },
    {
      regex:
        /^(?:please\s+)?(?:message|text|dm)\s+(.+?)\s+(?:to\s+)?(?:ask|tell|say)\s+(?:him|her|them\s+)?(.+)$/i,
      messageIndex: 2,
      targetIndex: 1,
    },
    {
      regex:
        /^(?:send|text|message)\s+(?:a\s+)?message\s+to\s+(.+?)\s+(?:and\s+)?(?:saying|say)\s+["'`“”‘’]?(.+?)["'`“”‘’]?$/i,
      messageIndex: 2,
      targetIndex: 1,
    },
    {
      regex:
        /^(?:send|text|message)\s+(?:a\s+)?message\s+to\s+(.+?)\s*[:,-]\s*["'`“”‘’]?(.+?)["'`“”‘’]?$/i,
      messageIndex: 2,
      targetIndex: 1,
    },
    {
      regex:
        /^["'`“”‘’](.+?)["'`“”‘’]\s+(?:send|text|message)\s+(?:this\s+)?message\s+to\s+(.+)$/i,
      messageIndex: 1,
      targetIndex: 2,
    },
    {
      regex: /^(?:send|text)\s+["'`“”‘’](.+?)["'`“”‘’]\s+to\s+(.+)$/i,
      messageIndex: 1,
      targetIndex: 2,
    },
    {
      regex: /^(?:send|text)\s+(.+?)\s+to\s+(.+)$/i,
      messageIndex: 1,
      targetIndex: 2,
      rejectGenericMessageText: true,
    },
    {
      regex:
        /^["'`“”‘’](.+?)["'`“”‘’]\s+(?:এই\s+)?(?:বার্তা|মেসেজ)(?:টা)?\s+(.+?)\s+কে\s+পাঠ(?:াও|ান)$/,
      messageIndex: 1,
      targetIndex: 2,
    },
    {
      regex:
        /^(.+?)\s*কে\s+["'`“”‘’](.+?)["'`“”‘’]\s+(?:বার্তা|মেসেজ)\s+পাঠ(?:াও|ান)$/,
      messageIndex: 2,
      targetIndex: 1,
    },
    {
      regex:
        /^(.+?)\s*কে\s+(?:বার্তা|মেসেজ)\s+পাঠ(?:াও|ান)\s+["'`“”‘’](.+?)["'`“”‘’]$/,
      messageIndex: 2,
      targetIndex: 1,
    },
    {
      regex:
        /^(.+?)\s*কে\s+(?:বার্তা|মেসেজ)\s+পাঠ(?:িয়ে|িয়ে|াও|ান)\s+(?:বলো|বলুন)\s+(.+)$/,
      messageIndex: 2,
      targetIndex: 1,
    },
    {
      regex:
        /^(?:বার্তা|মেসেজ)\s+পাঠ(?:িয়ে|িয়ে|াও|ান)\s+(.+?)\s*কে\s+(?:বলো|বলুন)\s+(.+)$/,
      messageIndex: 2,
      targetIndex: 1,
    },
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern.regex);
    if (!match) continue;

    const messageText = cleanCapturedSegment(match[pattern.messageIndex]);
    const targetName = cleanCapturedSegment(match[pattern.targetIndex]);

    if (!messageText || !targetName) continue;
    if (pattern.rejectGenericMessageText && isGenericMessageText(messageText)) {
      continue;
    }

    return buildSendMessageIntent({ targetName, messageText });
  }

  return null;
};

// ── Primary intent patterns ───────────────────────────────────────────────────

const INTENT_PATTERNS = [
  // ── Create Post ───────────────────────────────────────────────────────────
  {
    action: "CREATE_POST",
    searchCapture: true,
    patterns: [
      /(?:create|make|write|publish)\s+(?:me\s+)?(?:a\s+|an\s+)?(?:new\s+)?post(?:\s+with\s+(?:a\s+|an\s+)?(?:funny|witty|random|good|nice)\s+caption)?(?:\s*(?:that says|saying|caption(?:ed)?|:)\s+(.+))?(?:\s+(?:please|now|for me))?[.!?]*$/i,
      /(?:create|make|write|publish)\s+(?:me\s+)?(?:a\s+|an\s+)?(?:funny|witty)\s+post(?:\s+(?:about|saying|:)\s*(.+))?$/i,
      /post\s+(?:this|that)\s*(?:to\s+(?:my\s+)?(?:feed|timeline))?\s*[:\-]\s*(.+)/i,
      /(?:new\s+)?post\s*[:\-]\s*(.+)/i,
      /(?:একটা|একটি)?\s*পোস্ট\s+(?:করো|করুন|তৈরি(?:\s+করো)?)(?:\s+(.+))?/,
    ],
  },

  // ── Create Note ───────────────────────────────────────────────────────────
  {
    action: "CREATE_NOTE",
    noCapture: true,
    patterns: [
      /^(?:please\s+)?(?:create|write|add|make)\s+(?:a\s+)?note[.!?]*$/i,
    ],
  },
  {
    action: "CREATE_NOTE",
    searchCapture: true,
    patterns: [
      /(?:create|write|add|make)\s+(?:a\s+)?note(?:\s+about|\s+saying)?\s+(.+)/i,
      /(?:create|write|add)\s+note\s+(?:with|containing)\s+(.+)/i,
      /note\s+(?:down|about)\s+(.+)/i,
      /^note\s+(?:to\s+)?(?:myself|me)\s*:\s+(.+)/i,
      // Bengali patterns
      /(?:নোট|টিপস)\s+(?:তৈরি|লেখ|যোগ)\s+করুন\s+(.+)/,
      /(?:আমার|নিজের)\s+নোট\s+(.+)/,
    ],
  },

  // ── Edit Note ──────────────────────────────────────────────────────────
  {
    action: "EDIT_NOTE",
    searchCapture: true,
    patterns: [
      /(?:edit|update|modify)\s+(?:my\s+)?note(?:\s+(?:called|titled|named|about))?\s+(.+?)\s+to\s+(.+)/i,
      /(?:edit|update|modify)\s+(?:my\s+)?note(?:\s+to|\s+saying)?\s+(.+)/i,
      /(?:change|update)\s+note\s+(?:to|containing)\s+(.+)/i,
      /(?:নোট|টিপস)\s+(?:আপডেট|সম্পাদনা|বদল)\s+করুন\s+(.+)/,
    ],
  },

  // ── Delete Note ────────────────────────────────────────────────────
  {
    action: "DELETE_NOTE",
    patterns: [
      /(?:delete|remove|clear)\s+(?:my\s+)?(?:note|notes)(?:\s+about\s+(.+))?/i,
      // Bengali patterns
      /(?:নোট|টিপস)\s+(?:মুছুন|অপসারণ|ডিলিট)\s+করুন/,
      /আমার\s+(?:নোট|টিপস)\s+মুছে\s+দিন/,
    ],
  },

  // ── Create Task ────────────────────────────────────────────────────
  {
    action: "CREATE_TASK",
    noCapture: true,
    patterns: [
      /^(?:please\s+)?(?:create|add|make)\s+(?:a\s+)?(?:task|todo|to-do)[.!?]*$/i,
    ],
  },
  {
    action: "CREATE_TASK",
    searchCapture: true,
    patterns: [
      /(?:create|add|make|assign)\s+(?:a\s+)?(?:task|todo|to-do)(?:\s+(?:to|about|for))?\s+(.+)/i,
      /(?:create|add)\s+task\s+(?:with|containing)\s+(.+)/i,
      /^task\s+(?:to\s+)?(?:myself|me)\s*:\s+(.+)/i,
      // Bengali patterns
      /(?:কাজ|টাস্ক)\s+(?:তৈরি|যোগ)\s+করুন\s+(.+)/,
      /(?:আমার|নিজের)\s+(?:কাজ|টাস্ক)\s+(.+)/,
    ],
  },

  // ── Edit Task ──────────────────────────────────────────────────────
  {
    action: "EDIT_TASK",
    searchCapture: true,
    patterns: [
      /(?:edit|update|modify)\s+(?:my\s+)?task(?:\s+to|\s+(?:to|saying))?\s+(.+)/i,
      /(?:change|update)\s+task\s+(?:to|containing)\s+(.+)/i,
      // Bengali patterns
      /(?:কাজ|টাস্ক)\s+(?:আপডেট|সম্পাদনা|বদল)\s+করুন\s+(.+)/,
      /(.+)\s+এ\s+(?:কাজ|টাস্ক)\s+পরিবর্তন\s+করুন/,
    ],
  },

  // ── Delete Task ────────────────────────────────────────────────────
  {
    action: "DELETE_TASK",
    patterns: [
      /(?:delete|remove|clear|complete)\s+(?:my\s+)?(?:task|tasks|todo|to-do)(?:\s+about\s+(.+))?/i,
      // Bengali patterns
      /(?:কাজ|টাস্ক)\s+(?:মুছুন|অপসারণ|ডিলিট)\s+করুন/,
      /আমার\s+(?:কাজ|টাস্ক)\s+(?:শেষ|সম্পন্ন)\s+করুন/,
    ],
  },

  // ── Add Recovery Data ──────────────────────────────────────────────
  {
    action: "ADD_RECOVERY_DATA",
    searchCapture: true,
    patterns: [
      /(?:add|save|backup)\s+(?:my\s+)?recovery\s+(?:data|information|code)(?:\s+as)?\s+(.+)/i,
      /recovery\s+(?:data|code)\s*:\s+(.+)/i,
      // Bengali patterns
      /(?:রিকভারি|ব্যাকআপ)\s+(?:কোড|ডেটা)\s+(?:সংরক্ষণ|সেভ)\s+করুন\s+(.+)/,
      /(.+)\s+রিকভারি\s+কোড\s+হিসাবে\s+সংরক্ষণ\s+করুন/,
    ],
  },

  // ── Update Language Settings ──────────────────────────────────────────
  {
    action: "UPDATE_LANGUAGE_SETTINGS",
    searchCapture: true,
    patterns: [
      /(?:change|set|update)\s+(?:my\s+)?(?:language|lang)\s+(?:to|as)\s+(.+)/i,
      /set\s+language\s+preference\s+(?:to|as)\s+(.+)/i,
      /prefer\s+(?:to\s+use\s+)?(.+)(?:\s+language)?/i,
      // Bengali patterns for language settings
      /(?:ভাষা|লাঙ্গুয়েজ)\s+(?:বদল|পরিবর্তন|সেট)\s+করুন\s+(?:থেকে|পর্যন্ত)?\s+(.+)/,
      /(?:আমার\s+)?ভাষা\s+(.+)\s+করুন/,
    ],
  },

  // Original patterns follow
  // ── Video Call ─────────────────────────────────────────────────────────────
  {
    action: "VIDEO_CALL",
    noCapture: true,
    patterns: [
      /^(?:please\s+)?(?:start\s+)?(?:a\s+)?video\s+call(?:\s+please)?[.!?]*$/i,
    ],
  },
  {
    action: "VIDEO_CALL",
    patterns: [
      /video\s+call\s+(.+)/i,
      /call\s+(.+?)\s+(?:via|on|using)\s+video/i,
      /facetime\s+(.+)/i,
      /start\s+(?:a\s+)?video\s+(?:call|chat)\s+(?:with\s+)?(.+)/i,
      /video\s+chat\s+(?:with\s+)?(.+)/i,
    ],
  },

  // ── Audio Call ─────────────────────────────────────────────────────────────
  {
    action: "AUDIO_CALL",
    noCapture: true,
    patterns: [
      /^(?:please\s+)?(?:make\s+)?(?:a\s+)?(?:phone\s+|voice\s+|audio\s+)?call(?:\s+(?:someone|a friend))?[.!?]*$/i,
    ],
  },
  {
    action: "AUDIO_CALL",
    patterns: [
      /(?:voice|audio|phone)\s+call\s+(.+)/i,
      /call\s+(.+?)\s+(?:via|on|using)\s+(?:voice|audio|phone)/i,
      /^ring\s+(.+)/i,
      /(?:make|start|place)\s+(?:a\s+)?call\s+(?:to\s+)?(.+)/i,
      /^call\s+(.+)/i, // anchored: prevents mid-sentence “to call” matches
    ],
  },

  // ── Send Message ─────────────────────────────────────────────────────────────
  {
    action: "SEND_MESSAGE",
    noCapture: true,
    patterns: [
      /^(?:please\s+)?(?:send\s+)?(?:a\s+)?(?:message|dm|text)(?:\s+someone)?[.!?]*$/i,
    ],
  },
  {
    action: "SEND_MESSAGE",
    patterns: [
      /(?:send\s+(?:a\s+)?message|dm|text)\s+(?:to\s+)?(.+)/i,
      /^message\s+(.+)/i, // anchored: “message John” but not “a message about”
      /chat\s+with\s+(.+)/i,
      /open\s+chat\s+with\s+(.+)/i,
      /^talk\s+to\s+(.+)/i,
      /^write\s+to\s+(.+)/i,
      /start\s+(?:a\s+)?(?:chat|conversation)\s+(?:with\s+)?(.+)/i,
    ],
  },

  // ── Bump ──────────────────────────────────────────────────────────────────────────────────
  {
    action: "BUMP",
    patterns: [
      /^bump\s+(.+)/i,
      /^poke\s+(.+)/i,
      /^nudge\s+(.+)/i,
      /send\s+(?:a\s+)?bump\s+(?:to\s+)?(.+)/i,
    ],
  },

  // ── Create Ludo with named friends (before generic invite/create) ──────────
  {
    action: "CREATE_LUDO",
    patterns: [
      /(?:create|start|new|begin|open|launch)\s+(?:a\s+)?ludo(?:\s+game)?\s+(?:with|and\s+invite)\s+(.+)/i,
    ],
  },

  // ── Invite to Ludo ─────────────────────────────────────────────────────────
  {
    action: "INVITE_LUDO",
    patterns: [
      /invite\s+(.+?)\s+to\s+(?:a?\s*)?ludo/i,
      /play\s+ludo\s+with\s+(.+)/i,
      /ludo\s+(?:with|and)\s+(.+)/i,
      /(?:ask|tell)\s+(.+?)\s+to\s+(?:play\s+)?ludo/i,
    ],
  },

  // ── Invite to Chess ────────────────────────────────────────────────────────
  {
    action: "INVITE_CHESS",
    patterns: [
      /invite\s+(.+?)\s+to\s+(?:a?\s*)?chess/i,
      /play\s+chess\s+with\s+(.+)/i,
      /chess\s+(?:with|and)\s+(.+)/i,
      /(?:ask|tell)\s+(.+?)\s+to\s+(?:play\s+)?chess/i,
    ],
  },

  // ── Create Ludo ────────────────────────────────────────────────────────────
  {
    action: "CREATE_LUDO",
    noCapture: true,
    patterns: [
      /(?:create|start|new|begin|open|launch)\s+(?:a\s+)?ludo(?:\s+game)?/i,
      /^ludo\s+game$/i,
      /^play\s+ludo$/i,
      /^open\s+ludo$/i,
    ],
  },

  {
    action: "DELETE_POST",
    searchCapture: true,
    patterns: [
      /(?:delete|remove)\s+(?:my\s+)?(?:latest\s+|last\s+|recent\s+)?post(?:\s+(?:about|saying|with))?\s*(.*)/i,
      /(?:পোস্ট)\s+(?:মুছুন|ডিলিট)/,
    ],
  },
  {
    action: "DOWNLOAD_YOUTUBE",
    searchCapture: true,
    patterns: [
      /download\s+(?:this\s+|that\s+|the\s+)?(?:youtube\s+)?(?:video|audio|mp3)\s*(.*)/i,
      /(?:download|save)\s+(?:from\s+)?youtube\s*(.*)/i,
      /youtube\s+download\s*(.*)/i,
      /(?:download|save)\s+((?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\S*)/i,
      /(?:ডাউনলোড).*(youtu\S*)/i,
    ],
  },
  {
    action: "OPEN_VIDEO_PLAYER",
    searchCapture: true,
    patterns: [
      /(?:open|start|play)\s+(?:the\s+)?video\s+player(?:\s+(?:with|and play))?\s*(.*)/i,
      /^video\s+player$/i,
    ],
  },
  {
    action: "CREATE_EVENT",
    searchCapture: true,
    patterns: [
      /(?:add|create|schedule|make)\s+(?:an?\s+)?(?:event|calendar(?:\s+event)?|appointment|meeting)\s*(?:for|on|at|called)?\s*(.+)/i,
      /(?:calendar)\s+(?:add|event)\s+(.+)/i,
    ],
  },
  {
    action: "EDIT_EVENT",
    searchCapture: true,
    patterns: [
      /(?:edit|update|change)\s+(?:my\s+)?(?:event|calendar event|appointment)(?:\s+(?:called|named))?\s+(.+?)(?:\s+to\s+(.+))?$/i,
    ],
  },
  {
    action: "DELETE_EVENT",
    searchCapture: true,
    patterns: [
      /(?:delete|remove|cancel)\s+(?:my\s+)?(?:event|appointment|meeting)(?:\s+(?:called|named|about))?\s*(.*)/i,
    ],
  },
  {
    action: "UPDATE_SETTINGS",
    searchCapture: true,
    patterns: [
      /(?:set|change|switch|turn(?:\s+on)?|update)\s+(?:to\s+)?(?:dark|light)\s+(?:mode|theme)/i,
      /(?:enable|disable|turn\s+on|turn\s+off|mute)\s+(?:my\s+)?(?:notifications?|location(?:\s+sharing)?)/i,
      /(?:hide|share|stop sharing)\s+(?:my\s+)?location/i,
      /(?:make\s+)?(?:my\s+)?posts?\s+(?:public|private|friends?\s+only)/i,
      /(?:update|change)\s+(?:my\s+)?settings(?:\s+to|\s+for)?\s*(.*)/i,
      /(?:open)\s+(?:my\s+)?settings\s+(?:to|for)\s+(.+)/i,
    ],
  },
  {
    action: "LOG_HEALTH",
    searchCapture: true,
    patterns: [
      /(?:log|record|track|add)\s+(?:my\s+)?(?:weight|meal|calories|workout|exercise)\s*(.*)/i,
      /(?:i\s+weigh|weight\s+is|ate|workout)\s+(.+)/i,
      /(?:health|fitness)\s+(?:log|track)\s*(.*)/i,
    ],
  },
  {
    action: "LOG_RECOVERY",
    searchCapture: true,
    patterns: [
      /(?:log|record)\s+(?:a\s+)?(?:craving|urge|days?\s+clean)\s*(.*)/i,
      /(?:i(?:'m| am)\s+)?(\d+)\s+days?\s+(?:clean|sober)/i,
      /(?:recovery|rehab)\s+(?:log|update)\s*(.*)/i,
    ],
  },
  {
    action: "RECOVERY_SUPPORT",
    noCapture: true,
    patterns: [
      /(?:need|want|give me)\s+(?:recovery\s+)?support/i,
      /(?:help|support)\s+(?:me\s+)?(?:with\s+)?(?:recovery|craving|rehab|relapse)/i,
      /(?:open|go to)\s+(?:rehab|recovery)/i,
    ],
  },

  // ── Search / Play Video ──────────────────────────────────────────────────
  // ALL patterns anchored to ^ so mid-sentence keywords like
  // “create note to play football” never trigger a video search.
  // “play ludo” is caught by CREATE_LUDO earlier, so “play <other>” safely
  // reaches here as a video search.
  {
    action: "SEARCH_VIDEO",
    searchCapture: true,
    patterns: [
      /^play\s+(.+?)\s+(?:from|on|in)\s+(?:watch|video(?:s)?)/i, // "play X from watch"
      /^play\s+(.+)/i, // "play X"
      /^watch\s+(.+?(?:video|movie|film|clip|episode))/i, // "watch X video"
      /^(?:i\s+(?:want|wanna|would\s+like)\s+to\s+(?:play|watch))\s+(.+)/i, // "i want to play X"
      /^find\s+(?:a\s+)?video(?:s)?\s+(?:about|of|for|on)\s+(.+)/i,
      /^search\s+(?:for\s+)?(?:a\s+)?video(?:s)?(?:\s+(?:about|of|for|on))?\s+(.+)/i,
      /^show\s+(?:me\s+)?(?:a\s+)?video(?:s)?\s+(?:about|of|for|on)\s+(.+)/i,
      /^look\s+(?:for|up)\s+(.+?)\s+video(?:s)?/i,
    ],
  },

  // ── Block / Unblock ──────────────────────────────────────────────────────────────────
  { action: "BLOCK", patterns: [/^block\s+(.+)/i] },
  { action: "UNBLOCK", patterns: [/^unblock\s+(.+)/i] },

  // ── View Profile (pure, no sub-page) ──────────────────────────────────────
  // Requires possessive 's so "view my profile" goes to the static route map
  // (MY_PROFILE) instead of treating "my" as a friend name.
  {
    action: "VIEW_PROFILE",
    patterns: [
      /(?:view|see|check|open|show)\s+(.+?)'s\s+profile/i,
      /(?:view|see|open|show)\s+profile\s+(?:of|for)\s+(.+)/i,
      /(?:find(?:\s+me)?|search(?:\s+for)?|look\s+up)\s+(.+?)(?:'s)?\s+profile/i,
    ],
  },

  {
    action: "SEARCH_USERS",
    searchCapture: true,
    patterns: [
      /^(?:search|find|look\s+up)\s+(?:for\s+)?(?:a\s+)?(?:user|people|person|profiles?)\s+(?:named\s+|called\s+)?(.+)/i,
      /^(?:search|find)\s+(?:people|users)\s+named\s+(.+)/i,
    ],
  },

  // ── Get Location ──────────────────────────────────────────────────────────────────
  {
    action: "GET_LOCATION",
    patterns: [
      /where\s+is\s+(.+?)(?:\s+(?:now|right\s+now|located|at))?[?]?$/i,
      /(?:find|get|show|check|see)\s+(.+?)'?s?\s+location/i,
      /(.+?)'?s?\s+location/i,
      // Removed the too-broad /(?:locate|find)\s+(.+)/i — "find a restaurant" would fire
    ],
  },

  // ── Get Bio / VIO ───────────────────────────────────────────────────────────────
  {
    action: "GET_BIO",
    patterns: [
      /what\s+is\s+(?:the\s+)?(?:vio|bio|biography|description)\s+(?:of|for)\s+(.+)/i,
      /(?:vio|bio|biography|description)\s+(?:of|for)\s+(.+)/i,
      /(?:what\s+is|what's|tell\s+me|get|show|see)\s+(.+?)'?s?\s+(?:vio|bio|biography|about|description)/i,
      /tell\s+me\s+about\s+(.+)/i,
    ],
  },

  // ── Add Friend ─────────────────────────────────────────────────────────────
  {
    action: "ADD_FRIEND",
    patterns: [
      /(?:add|send)\s+(?:a\s+)?friend\s+(?:request\s+(?:to\s+)?)?(.+)/i,
      /add\s+(.+?)\s+as\s+(?:a\s+)?friend/i,
      /(?:send|make)\s+(.+?)\s+(?:a\s+)?friend\s+request/i,
      /friend\s+request\s+to\s+(.+)/i,
    ],
  },

  // ── Unfriend ───────────────────────────────────────────────────────────────
  {
    action: "UNFRIEND",
    patterns: [
      /unfriend\s+(.+)/i,
      /remove\s+(.+?)\s+(?:from\s+(?:my\s+)?friends|as\s+(?:a\s+)?friend)/i,
      /(?:delete|remove)\s+friend\s+(.+)/i,
    ],
  },

  // ── List Friends ───────────────────────────────────────────────────────────
  {
    action: "LIST_FRIENDS",
    noCapture: true,
    patterns: [
      /(?:list|show|see|view|display)\s+(?:my\s+)?friends/i,
      /who\s+(?:are\s+)?my\s+friends/i,
    ],
  },

  // ── Open Messages ──────────────────────────────────────────────────────────
  {
    action: "OPEN_MESSAGES",
    noCapture: true,
    patterns: [
      /(?:open|go\s+to|show|navigate\s+to)\s+(?:my\s+)?messages?(?:\s+page)?/i,
      /messages?\s+(?:page|inbox)/i,
      /^inbox$/i,
    ],
  },

  // ── Open Friends ───────────────────────────────────────────────────────────
  {
    action: "OPEN_FRIENDS",
    noCapture: true,
    patterns: [
      /(?:open|go\s+to|show|navigate\s+to)\s+(?:the\s+)?friends?\s+page/i,
      /^friends?\s+page$/i,
    ],
  },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Find a static route by matching against STATIC_ROUTE_MAP keywords.
 * @param {string} query – lowercased destination string from user message
 * @returns {{ route: string, label: string }|null}
 */
export const findStaticRoute = (query) => {
  const q = query.toLowerCase().trim().replace(/\s+/g, " ");
  // Try exact match first, then prefix match (longest key wins)
  let bestMatch = null;
  let bestLength = 0;

  for (const entry of STATIC_ROUTE_MAP) {
    for (const key of entry.keys) {
      if (q === key && key.length > bestLength) {
        bestMatch = entry;
        bestLength = key.length;
      }
    }
  }
  if (bestMatch) return { route: bestMatch.route, label: bestMatch.label };

  // Partial / "contains" pass.
  // The key must cover at least 60 % of the query length to avoid accidental
  // matches like "friends" (7) hitting "atik friends" (12) → 58 % < 60 %.
  for (const entry of STATIC_ROUTE_MAP) {
    for (const key of entry.keys) {
      if (q.includes(key) && key.length > bestLength) {
        const ratio = key.length / q.length;
        if (ratio >= 0.6) {
          bestMatch = entry;
          bestLength = key.length;
        }
      }
    }
  }
  return bestMatch ? { route: bestMatch.route, label: bestMatch.label } : null;
};

/**
 * Try to detect a "go to <X>'s <sub-page>" intent for a friend profile.
 * Returns { targetName, subPath, subLabel } or null.
 */
const detectProfileSubNav = (message) => {
  for (const { regex, subPath, subLabel } of PROFILE_SUB_PATTERNS) {
    const m = message.match(regex);
    if (m && m[1]) {
      const raw = m[1]
        .trim()
        .replace(/[?.!,;:]+$/, "")
        .trim();
      if (!raw) continue;

      // Reject pronouns, articles, and navigation verbs — they're not names
      if (NON_NAME_WORDS.has(raw.toLowerCase())) continue;

      // Reject multi-word phrases that start with a navigation verb
      // e.g. "go to my", "open the", "view the" — static route leaked through
      if (
        /^(?:go\s+(?:to\s+)?|open\s+|show\s+|view\s+|see\s+|navigate\s+(?:to\s+)?|take\s+me\s+(?:to\s+)?)/i.test(
          raw,
        )
      )
        continue;

      return { targetName: raw, subPath, subLabel };
    }
  }
  return null;
};

// ── Main parser ────────────────────────────────────────────────────────────────

/**
 * Parse a user message to detect an actionable intent.
 * @param {string} message
 * @returns {{ action: string, targetName: string|null, targetRoute: string|null,
 *             subPath: string|null, label: string|null, params: object }|null}
 */
const parseIntentOnce = (trimmed) => {
  const directSendMessageIntent = parseDirectSendMessageIntent(trimmed);
  if (directSendMessageIntent) {
    return directSendMessageIntent;
  }

  // ── 1. Try primary action intents ─────────────────────────────────────────
  // ── 1. Try primary action intents ────────────────────────────────────────────────────────────
  for (const {
    action,
    patterns,
    noCapture,
    searchCapture,
  } of INTENT_PATTERNS) {
    for (const pattern of patterns) {
      const match = trimmed.match(pattern);
      if (match) {
        // SEARCH_VIDEO: capture group is a search query, not a friend name
        if (searchCapture && match[1]) {
          const searchQuery = match[1]
            .trim()
            .replace(/[?.!,;:]+$/, "")
            .replace(/\s+(please|for\s+me|now)$/i, "")
            .trim();
          return {
            action,
            targetName: null,
            messageText: match[2]
              ? match[2]
                  .trim()
                  .replace(/[?.!,;:]+$/, "")
                  .trim()
              : null,
            searchQuery: searchQuery || null,
            targetRoute: null,
            subPath: null,
            label: null,
            params: {},
          };
        }

        let targetName = null;
        if (!noCapture && match[1]) {
          targetName = match[1]
            .trim()
            .replace(/[?.!,;:]+$/, "")
            .replace(/\s+(now|please|for\s+me)$/i, "")
            .trim();
          if (action === "ADD_FRIEND" && targetName) {
            targetName = targetName.replace(/^(?:to|for)\s+/i, "").trim();
          }
          if (
            targetName &&
            (action === "VIEW_PROFILE" ||
              action === "NAVIGATE_PROFILE" ||
              action === "ADD_FRIEND" ||
              action === "GET_BIO") &&
            NON_NAME_WORDS.has(targetName.toLowerCase())
          ) {
            targetName = null;
            continue;
          }
          if (!targetName) targetName = null;
        }
        if (
          (action === "INVITE_LUDO" || action === "CREATE_LUDO") &&
          targetName &&
          /^(?:(?:invite\s+)?(?:my\s+)?friends?|everyone|all(?:\s+friends?)?)$/i.test(
            targetName,
          )
        ) {
          return {
            action: "CREATE_LUDO",
            targetName: null,
            messageText: null,
            searchQuery: null,
            targetRoute: null,
            subPath: null,
            label: null,
            params: {},
          };
        }
        if (action === "SEND_MESSAGE" && targetName) {
          const promoted = parseDirectSendMessageIntent(
            `message ${targetName}`,
          );
          if (promoted?.messageText) {
            return promoted;
          }
        }
        return {
          action,
          targetName,
          messageText: null,
          searchQuery: null,
          targetRoute: null,
          subPath: null,
          label: null,
          params: {},
        };
      }
    }
  }

  // ── 2. Try navigation intents (static route matching) — BEFORE profile nav ─
  // This ensures "go to my profile", "go to settings" etc. are never mistaken
  // for friend-profile navigation.
  for (const navPattern of NAV_PATTERNS) {
    const match = trimmed.match(navPattern);
    if (match && match[1]) {
      const destination = match[1]
        .trim()
        .replace(/[?.!,;:]+$/, "")
        .trim();
      const routeEntry = findStaticRoute(destination);
      if (routeEntry) {
        return {
          action: "NAVIGATE",
          targetName: null,
          messageText: null,
          targetRoute: routeEntry.route,
          subPath: null,
          label: routeEntry.label,
          params: {},
        };
      }
    }
  }

  // ── 3. Try bare destination (no "go to" prefix) ───────────────────────────
  const routeEntry = findStaticRoute(trimmed);
  if (routeEntry) {
    return {
      action: "NAVIGATE",
      targetName: null,
      messageText: null,
      targetRoute: routeEntry.route,
      subPath: null,
      label: routeEntry.label,
      params: {},
    };
  }

  // ── 4. Try "[friend]'s [sub-page]" profile navigation — AFTER static routes ─
  // Only reaches here if the message didn't match any known static route.
  const profileSubNav = detectProfileSubNav(trimmed);
  if (profileSubNav && profileSubNav.targetName) {
    return {
      action: "NAVIGATE_PROFILE",
      targetName: profileSubNav.targetName,
      messageText: null,
      targetRoute: null,
      subPath: profileSubNav.subPath,
      label: profileSubNav.subLabel,
      params: {},
    };
  }

  return null;
};

export const stripCommandFiller = (text = "") => {
  let next = String(text || "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim();
  const prefix =
    /^(?:(?:please|kindly|ok(?:ay)?|hey|hi|hello)(?:\s+agent)?[,!]?\s+)+/i;
  const canYou = /^(?:can|could|would|will)\s+you(?:\s+please)?\s+/i;
  const want =
    /^(?:i(?:'d|\s+would)?\s+(?:like|want|need)(?:\s+you)?\s+to)\s+/i;
  for (let i = 0; i < 3; i += 1) {
    const before = next;
    next = next.replace(prefix, "").replace(canYou, "").replace(want, "").trim();
    if (next === before) break;
  }
  return next
    .replace(/\s+(?:please|now|for me|thanks)[.!?]*$/i, "")
    .replace(/[.!?।]+$/g, "")
    .trim();
};

const tryParseIntentText = (text) => {
  if (!text) return null;
  const direct = parseIntentOnce(text);
  if (direct) return direct;
  const banglish = normalizeBanglishCommand(text);
  if (banglish && banglish !== text) {
    const fromBanglish = parseIntentOnce(banglish);
    if (fromBanglish) return fromBanglish;
  }
  const bangla = normalizeBanglaCommand(text);
  if (bangla && bangla !== text) {
    return parseIntentOnce(bangla);
  }
  return null;
};

/**
 * Parse a user message to detect an actionable intent.
 * Tries the original text, then Banglish and Bangla rewrites.
 */
export const parseIntent = (message) => {
  if (!message || typeof message !== "string") return null;
  const trimmed = message.trim();
  if (!trimmed) return null;
  const parsed = tryParseIntentText(trimmed);
  if (parsed) return parsed;
  const stripped = stripCommandFiller(trimmed);
  if (stripped && stripped !== trimmed) {
    return tryParseIntentText(stripped);
  }
  return null;
};

// ── Friend search ──────────────────────────────────────────────────────────────

const FRIEND_NAME_MATCH_THRESHOLD = 0.4; // Lowered to catch more matches (surnames, partial names)
const MIN_FRIEND_NAME_QUERY_LENGTH = 3;

const normalizeFriendName = (value = "") =>
  String(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\u0980-\u09FF]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const levenshteinDistance = (left, right) => {
  if (left === right) return 0;
  if (!left) return right.length;
  if (!right) return left.length;

  let previous = Array.from({ length: right.length + 1 }, (_, i) => i);

  for (let i = 1; i <= left.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= right.length; j += 1) {
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1),
      );
    }
    previous = current;
  }

  return previous[right.length];
};

const getNameSimilarity = (query, candidate) => {
  if (!query || !candidate) return 0;
  if (query === candidate) return 1;

  const queryTokens = query.split(" ").filter(Boolean);
  const candidateTokens = candidate.split(" ").filter(Boolean);
  const candidateTokenSet = new Set(candidateTokens);
  const sharedTokens = queryTokens.filter((token) =>
    candidateTokenSet.has(token),
  ).length;
  const tokenDice =
    (2 * sharedTokens) /
    Math.max(1, queryTokens.length + candidateTokens.length);

  const containsScore =
    candidate.includes(query) || query.includes(candidate)
      ? Math.min(query.length, candidate.length) /
        Math.max(query.length, candidate.length)
      : 0;

  const editScore =
    1 -
    levenshteinDistance(query, candidate) /
      Math.max(query.length, candidate.length);

  const bestTokenEdit = Math.max(
    0,
    ...queryTokens.flatMap((queryToken) =>
      candidateTokens.map(
        (candidateToken) =>
          1 -
          levenshteinDistance(queryToken, candidateToken) /
            Math.max(queryToken.length, candidateToken.length),
      ),
    ),
  );

  return Math.max(tokenDice, containsScore, editScore, bestTokenEdit);
};

/**
 * Split a captured friend phrase into individual names.
 * "Atik and Rahima" → ["Atik", "Rahima"]. Generic "friends" → [].
 */
export const splitFriendNames = (value) => {
  const text = String(value || "")
    .trim()
    .replace(/^(?:invite\s+)?(?:my\s+)?friends?\s*(?:named\s+)?/i, "")
    .replace(/\s+(?:please|now)$/i, "")
    .trim();
  if (
    !text ||
    /^(?:(?:my\s+)?friends?|everyone|all(?:\s+friends?)?)$/i.test(text)
  ) {
    return [];
  }
  return text
    .split(/\s*(?:,|&|\/|\band\b|\bআর\b|\bএবং\b)\s+/i)
    .map((part) => part.replace(/^[\s.]+|[\s.]+$/g, "").trim())
    .filter(
      (part) =>
        part && !/^(?:(?:my\s+)?friends?|everyone|all)$/i.test(part),
    );
};

/**
 * Search a friend list by name (partial / full / nickname).
 * @param {Array} friends  – myProfile.friends array
 * @param {string} query
 * @returns {Array} – sorted: exact matches first, then partial
 */
export const searchFriendsByName = (friends, query) => {
  if (!friends || !Array.isArray(friends) || !query) return [];

  const normalizedQuery = normalizeFriendName(query);
  const queryCharacterCount = normalizedQuery.replace(/\s/g, "").length;
  if (queryCharacterCount < MIN_FRIEND_NAME_QUERY_LENGTH) return [];

  const matches = [];
  const queryTokens = normalizedQuery.split(/\s+/).filter(Boolean);

  for (const friend of friends) {
    if (!friend) continue;

    const firstName = friend.user?.firstName || friend.firstName || "";
    const surname = friend.user?.surname || friend.surname || "";
    const displayName = friend.user?.displayName || friend.displayName || "";
    const nickname = friend.user?.nickname || friend.nickname || "";
    const banglaName = friend.banglaName || "";
    const username = friend.user?.username || friend.username || "";
    const composedFullName = `${firstName} ${surname}`.trim();

    // Primary fields for 3+ character matching: Name, DisplayName, Nickname, BanglaName
    const primaryFields = [
      firstName,
      surname,
      composedFullName,
      displayName,
      nickname,
      banglaName,
      username,
      friend.name,
      friend.user?.name,
      friend.fullName,
      friend.user?.fullName,
    ];

    const candidateNames = primaryFields
      .map(normalizeFriendName)
      .filter(Boolean);

    // Calculate best match score
    let bestScore = 0;

    // Check each candidate name
    for (const candidate of candidateNames) {
      // Exact match: highest priority (full string match)
      if (candidate === normalizedQuery) {
        bestScore = Math.max(bestScore, 1.0);
        continue;
      }

      // For single-word queries, prioritize exact token matches first
      if (queryTokens.length === 1) {
        const queryToken = queryTokens[0];
        const candidateTokens = candidate.split(/\s+/).filter(Boolean);

        // Exact token match - highest priority for single words
        for (const token of candidateTokens) {
          if (token === queryToken) {
            bestScore = Math.max(bestScore, 1.0);
            break;
          }
        }

        // Only if no exact token match, check partial token matches
        if (bestScore < 1.0) {
          for (const token of candidateTokens) {
            // Token starts with query (e.g., "atik" matches "atik*")
            // But prevent "atik" matching "akter" by requiring at least 80% match
            if (token.startsWith(queryToken)) {
              const matchRatio = queryToken.length / token.length;
              if (matchRatio >= 0.8) {
                bestScore = Math.max(bestScore, 0.98);
                break;
              }
            }
            // DO NOT do substring matching if tokens have different lengths by more than 1
            // This prevents "atik" from matching "akter"
            // Only allow substring match if they're almost the same length
            if (
              token.includes(queryToken) &&
              Math.abs(token.length - queryToken.length) <= 1
            ) {
              // Exact match length: high score
              if (token.length === queryToken.length) {
                bestScore = Math.max(bestScore, 0.98);
              } else {
                // Very close match: medium score
                bestScore = Math.max(bestScore, 0.9);
              }
            }
          }
        }
      } else {
        // Multi-word query: check for substring match in full name
        if (candidate.includes(normalizedQuery)) {
          bestScore = Math.max(bestScore, 0.99);
          continue;
        }

        // Check token-by-token matching for multi-word queries
        const candidateTokens = candidate.split(/\s+/).filter(Boolean);
        let tokenMatches = 0;
        for (const queryToken of queryTokens) {
          if (candidateTokens.some((t) => t === queryToken)) {
            tokenMatches++;
          }
        }
        if (tokenMatches > 0) {
          const tokenMatchScore =
            0.85 + (tokenMatches / queryTokens.length) * 0.1;
          bestScore = Math.max(bestScore, tokenMatchScore);
        }
      }

      // Use similarity algorithm only as fallback if no good matches yet
      if (bestScore < 0.85) {
        const similarityScore = getNameSimilarity(normalizedQuery, candidate);
        // Only accept similarity score if it's reasonably high
        if (similarityScore >= 0.6) {
          bestScore = Math.max(bestScore, similarityScore);
        }
      }
    }

    // Lower threshold slightly for better matching
    const threshold = 0.4; // Changed from 0.5 to catch more matches
    if (bestScore >= threshold) {
      matches.push({ friend, score: bestScore });
    }
  }

  return matches.sort((a, b) => b.score - a.score).map(({ friend }) => friend);
};

/**
 * Get a display name for a friend profile object.
 */
export const getFriendDisplayName = (friend) => {
  if (!friend) return "Unknown";
  if (friend.fullName) return friend.fullName;
  if (friend.user?.fullName) return friend.user.fullName;
  const first = friend.user?.firstName || friend.firstName || "";
  const last = friend.user?.surname || friend.surname || "";
  const full = `${first} ${last}`.trim();
  return (
    full ||
    friend.username ||
    friend.displayName ||
    friend.user?.displayName ||
    friend.nickname ||
    friend.user?.nickname ||
    friend.name ||
    friend.user?.name ||
    friend.username ||
    friend.user?.username ||
    "Unknown"
  );
};

const agentIntentParser = {
  parseIntent,
  stripCommandFiller,
  searchFriendsByName,
  getFriendDisplayName,
  FRIEND_REQUIRED_ACTIONS,
  NO_FRIEND_ACTIONS,
  DIRECTORY_LOOKUP_ACTIONS,
};

export default agentIntentParser;
