/**
 * AI Agent Intent Parser
 * Client-side regex/keyword parsing to detect user intents before sending to Gemini.
 */

// ── Action sets ───────────────────────────────────────────────────────────────

/** Actions that need a friend's profile resolved from the friends list */
export const FRIEND_REQUIRED_ACTIONS = new Set([
  "VIDEO_CALL",
  "AUDIO_CALL",
  "SEND_MESSAGE",
  "BUMP",
  "INVITE_LUDO",
  "BLOCK",
  "UNBLOCK",
  "VIEW_PROFILE",
  "GET_LOCATION",
  "ADD_FRIEND",
  "UNFRIEND",
  "NAVIGATE_PROFILE", // go to a friend's profile / sub-page
]);

/** Actions that do NOT need a friend target */
export const NO_FRIEND_ACTIONS = new Set([
  "CREATE_LUDO",
  "LIST_FRIENDS",
  "OPEN_MESSAGES",
  "OPEN_FRIENDS",
  "NAVIGATE", // navigate to a static/my-profile route
  "SEARCH_VIDEO", // search for a video to play
]);

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
    keys: ["messages", "message page", "inbox", "chats", "chat page", "dms"],
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

// ── Primary intent patterns ───────────────────────────────────────────────────

const INTENT_PATTERNS = [
  // ── Video Call ─────────────────────────────────────────────────────────────
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

  // ── Add Friend ─────────────────────────────────────────────────────────────
  {
    action: "ADD_FRIEND",
    patterns: [
      /(?:add|send)\s+(?:a\s+)?friend\s+(?:request\s+(?:to\s+)?)?(.+)/i,
      /add\s+(.+?)\s+as\s+(?:a\s+)?friend/i,
      /(?:send|make)\s+(.+?)\s+(?:a\s+)?friend\s+request/i,
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
const findStaticRoute = (query) => {
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
export const parseIntent = (message) => {
  if (!message || typeof message !== "string") return null;

  const trimmed = message.trim();

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
          if (!targetName) targetName = null;
        }
        return {
          action,
          targetName,
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
      targetRoute: null,
      subPath: profileSubNav.subPath,
      label: profileSubNav.subLabel,
      params: {},
    };
  }

  return null;
};

// ── Friend search ──────────────────────────────────────────────────────────────

/**
 * Search a friend list by name (partial / full / nickname).
 * @param {Array} friends  – myProfile.friends array
 * @param {string} query
 * @returns {Array} – sorted: exact matches first, then partial
 */
export const searchFriendsByName = (friends, query) => {
  if (!friends || !Array.isArray(friends) || !query) return [];

  const lower = query.toLowerCase().trim();
  const exact = [];
  const partial = [];

  for (const friend of friends) {
    if (!friend) continue;

    const firstName = (friend.user?.firstName || "").toLowerCase();
    const surname = (friend.user?.surname || "").toLowerCase();
    const fullName = `${firstName} ${surname}`.trim();
    const nickname = (friend.nickname || "").toLowerCase();
    const username = (friend.username || "").toLowerCase();
    const storedFull = (friend.fullName || "").toLowerCase();

    const isExact =
      firstName === lower ||
      surname === lower ||
      fullName === lower ||
      nickname === lower ||
      username === lower ||
      storedFull === lower;

    const isPartial =
      firstName.startsWith(lower) ||
      surname.startsWith(lower) ||
      fullName.includes(lower) ||
      nickname.includes(lower) ||
      username.includes(lower) ||
      storedFull.includes(lower);

    if (isExact) exact.push(friend);
    else if (isPartial) partial.push(friend);
  }

  return [...exact, ...partial];
};

/**
 * Get a display name for a friend profile object.
 */
export const getFriendDisplayName = (friend) => {
  if (!friend) return "Unknown";
  if (friend.fullName) return friend.fullName;
  const first = friend.user?.firstName || "";
  const last = friend.user?.surname || "";
  const full = `${first} ${last}`.trim();
  return full || friend.username || friend.nickname || "Unknown";
};

export default {
  parseIntent,
  searchFriendsByName,
  getFriendDisplayName,
  FRIEND_REQUIRED_ACTIONS,
  NO_FRIEND_ACTIONS,
};
