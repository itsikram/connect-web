const YOUTUBE_URL_RE =
  /(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/|live\/)|youtu\.be\/)[\w-]{6,}[^\s"'<>]*/i;

const MEDIA_URL_RE =
  /https?:\/\/[^\s"'<>]+?\.(?:mp4|webm|m4v|mov|mkv|mp3|m4a|ogg)(?:\?[^\s"'<>]*)?/i;

const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

export const emitConnectEvent = (name, detail = {}) => {
  try {
    window.dispatchEvent(new CustomEvent(name, { detail }));
  } catch (_) {
    /* ignore */
  }
};

export const readJsonStorage = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (_) {
    return fallback;
  }
};

export const writeJsonStorage = (key, value) => {
  localStorage.setItem(key, JSON.stringify(value));
};

export const extractYouTubeUrl = (...parts) => {
  const text = parts
    .map((part) => String(part || ""))
    .join(" ")
    .replace("m.youtube.com", "www.youtube.com");
  const match = text.match(YOUTUBE_URL_RE);
  if (!match) return "";
  let url = match[0].replace(/[),.]+$/, "");
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  return url;
};

export const isVagueYoutubeRef = (value) => {
  const text = String(value || "").trim();
  if (!text) return true;
  return /^(?:(?:this|that|it|the|same)(?:\s+(?:video|link|one|url|youtube(?:\s+video)?))?|the\s+same(?:\s+one)?)$/i.test(
    text,
  );
};

export const stripYoutubeSearchNoise = (text = "") =>
  String(text || "")
    .replace(YOUTUBE_URL_RE, " ")
    .replace(
      /\b(please|kindly|can you|could you|would you|download|save|search(?:ing)?|find|look(?:ing)?(?:\s+up)?|show(?:\s+me)?|youtube|yt|videos?|audio|mp3|from|on|for me|now)\b/gi,
      " ",
    )
    .replace(/[?.!,;:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const pickBestYoutubeMatch = (videos, query) => {
  if (!Array.isArray(videos) || videos.length === 0) return null;
  const terms = String(query || "")
    .toLowerCase()
    .split(/[^a-z0-9\u0980-\u09ff]+/i)
    .filter((word) => word.length > 1);
  if (!terms.length) return videos[0];
  let best = videos[0];
  let bestScore = -1;
  videos.forEach((video, index) => {
    const hay = `${video.title || video.caption || ""} ${
      video.channelTitle || ""
    }`.toLowerCase();
    const overlap = terms.reduce(
      (count, term) => count + (hay.includes(term) ? 1 : 0),
      0,
    );
    const score = overlap * 10 - index;
    if (score > bestScore) {
      bestScore = score;
      best = video;
    }
  });
  return best;
};

export const extractMediaUrl = (...parts) => {
  const youtube = extractYouTubeUrl(...parts);
  if (youtube) return youtube;
  const text = parts.map((part) => String(part || "")).join(" ");
  const match = text.match(MEDIA_URL_RE);
  return match ? match[0].replace(/[),.]+$/, "") : "";
};

export const looksLikeAudioDownload = (text = "") =>
  /\b(audio|mp3|music only|sound only|audio only)\b/i.test(String(text || ""));

export const shouldSkipWatchPost = (text = "") =>
  /\b(don'?t|do not|without)\s+(post|share|watch)\b|\bno watch\b/i.test(
    String(text || ""),
  );

export const parseQualityFromText = (text = "") => {
  const match = String(text || "").match(/\b(2160|1440|1080|720|480|360|240)p?\b/i);
  return match ? Number(match[1]) : 2160;
};

const pad = (value) => String(value).padStart(2, "0");

const toDateKey = (date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const nextWeekday = (from, weekdayIndex) => {
  const date = new Date(from);
  date.setHours(0, 0, 0, 0);
  const delta = (weekdayIndex - date.getDay() + 7) % 7 || 7;
  date.setDate(date.getDate() + delta);
  return date;
};

export const parseCalendarWhen = (text = "") => {
  const source = String(text || "").trim();
  const now = new Date();
  let date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let time = "";
  let foundDate = false;

  if (/\b(today|আজ)\b/i.test(source)) {
    foundDate = true;
  } else if (/\b(tomorrow|কাল|আগামীকাল)\b/i.test(source)) {
    date.setDate(date.getDate() + 1);
    foundDate = true;
  } else if (/\b(yesterday|গতকাল)\b/i.test(source)) {
    date.setDate(date.getDate() - 1);
    foundDate = true;
  }

  const iso = source.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (iso) {
    const parsed = new Date(`${iso[1]}T00:00:00`);
    if (!Number.isNaN(parsed.getTime())) {
      date = parsed;
      foundDate = true;
    }
  }

  const weekdayMatch = source.match(
    /\b(?:next\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i,
  );
  if (weekdayMatch) {
    date = nextWeekday(now, WEEKDAYS.indexOf(weekdayMatch[1].toLowerCase()));
    foundDate = true;
  }

  const timeMatch = source.match(
    /\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i,
  );
  if (timeMatch) {
    let hours = Number(timeMatch[1]);
    const minutes = Number(timeMatch[2] || 0);
    const meridiem = String(timeMatch[3] || "").toLowerCase();
    if (meridiem === "pm" && hours < 12) hours += 12;
    if (meridiem === "am" && hours === 12) hours = 0;
    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      time = `${pad(hours)}:${pad(minutes)}`;
    }
  }

  return {
    dateKey: toDateKey(date),
    iso: date.toISOString(),
    time,
    foundDate,
  };
};

export const stripDatePhrases = (text = "") =>
  String(text || "")
    .replace(/\b(today|tomorrow|yesterday|আজ|কাল|আগামীকাল|গতকাল)\b/gi, " ")
    .replace(/\b(?:next\s+)?(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/gi, " ")
    .replace(/\b20\d{2}-\d{2}-\d{2}\b/g, " ")
    .replace(/\b(?:at\s+)?\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

export const matchByText = (items = [], query = "", getText) => {
  const list = Array.isArray(items) ? items : [];
  if (!list.length) return null;
  const needle = String(query || "")
    .trim()
    .toLowerCase();
  if (!needle) return list[0];

  const scored = list
    .map((item) => {
      const haystack = String(getText(item) || "")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();
      let score = 0;
      if (haystack === needle) score = 4;
      else if (haystack.includes(needle)) score = 3;
      else if (needle.includes(haystack) && haystack.length > 2) score = 2;
      else if (haystack.split(/\s+/).some((token) => needle.includes(token) && token.length > 3)) {
        score = 1;
      }
      return { item, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored[0]?.item || list[0];
};

const VISIBILITY_LABELS = {
  om: "only you",
  fof: "friends of friends",
  public: "everyone",
};

const parseVisibilityValue = (source = "") => {
  if (/\b(only\s*me|onlyme|private|nobody|just me|hidden)\b/i.test(source)) {
    return "om";
  }
  if (/\b(friends?\s+of\s+friends|friend of friends|fof)\b/i.test(source)) {
    return "fof";
  }
  if (/\bfriends?\s+only\b/i.test(source)) return "fof";
  if (/\bpublic\b/i.test(source)) return "public";
  return null;
};

const PUSH_NOTIFICATION_KEYS = [
  "friendRequestReceived",
  "friendRequestAccepted",
  "newMessageReceived",
  "newFriendPost",
  "newFriendStory",
  "newFriendWatch",
];

const NOTIFICATION_TYPE_PATTERNS = [
  { keys: ["friendRequestAccepted"], re: /\bfriend request(?:s)?\s+accepted\b/i },
  { keys: ["friendRequestReceived"], re: /\bfriend request/i },
  { keys: ["newMessageReceived"], re: /\bmessages?\b/i },
  { keys: ["newFriendStory"], re: /\bstor(?:y|ies)\b/i },
  { keys: ["newFriendWatch"], re: /\bwatch\b/i },
  { keys: ["newFriendPost"], re: /\bposts?\b/i },
];

const RINGTONE_ALIASES = [
  { id: 5, names: ["office"] },
  { id: 4, names: ["telephone 2", "telephone two"] },
  { id: 2, names: ["bells", "bell"] },
  { id: 3, names: ["old telephone", "telephone"] },
  { id: 1, names: ["default", "original"] },
];

const matchRingtone = (source = "") => {
  const numbered = source.match(
    /\bringtones?\s*(?:to\s*|number\s*|id\s*)?(\d+)\b/i,
  );
  if (numbered) {
    const id = Number(numbered[1]);
    if (id >= 1 && id <= 5) return id;
  }
  const named = RINGTONE_ALIASES.find(({ names }) =>
    names.some((name) => source.includes(name)),
  );
  return named?.id || null;
};

const trimCapturedValue = (value = "") =>
  String(value || "")
    .replace(/[?.!,;]+$/g, "")
    .replace(/\s+(please|now|for me)$/i, "")
    .replace(/^['"“”‘’]+|['"“”‘’]+$/g, "")
    .trim()
    .slice(0, 160);

export const parseSettingsPatch = (text = "") => {
  const source = String(text || "").toLowerCase();
  const patch = {};
  const notes = [];
  const routes = new Set();

  if (/\b(dark mode|dark theme|night mode)\b/.test(source)) {
    patch.themeMode = "dark";
    notes.push("theme set to dark");
    routes.add("/settings/preference");
  } else if (/\b(light mode|light theme|day mode)\b/.test(source)) {
    patch.themeMode = "light";
    notes.push("theme set to light");
    routes.add("/settings/preference");
  } else if (/\b(default theme|system theme|default mode)\b/.test(source)) {
    patch.themeMode = "default";
    notes.push("theme set to default");
    routes.add("/settings/preference");
  }

  if (
    /\b(hide|stop sharing|don't share|dont share|turn off|disable)\b.+\blocation\b|\blocation\b.+\b(off|hide|private)\b/.test(
      source,
    )
  ) {
    patch.isShareLocation = false;
    notes.push("location sharing off");
    routes.add("/settings/privacy");
  } else if (
    /\b(share|show|enable|turn on)\b.+\blocation\b|\blocation\b.+\b(on|public)\b/.test(
      source,
    )
  ) {
    patch.isShareLocation = true;
    notes.push("location sharing on");
    routes.add("/settings/privacy");
  }

  const wantsNotifOff =
    /\b(mute|disable|turn off|switch off|stop)\b/.test(source) ||
    /\bno notifications?\b/.test(source);
  const wantsNotifOn = /\b(enable|unmute|turn on|switch on)\b/.test(source);
  const mentionsNotifications = /\bnotifications?\b/.test(source);
  const isEmailNotif = /\bemail\b/.test(source);
  const matchedNotifTypes = NOTIFICATION_TYPE_PATTERNS.filter(({ re }) =>
    re.test(source),
  ).flatMap(({ keys }) => keys);

  if (
    (wantsNotifOff || wantsNotifOn) &&
    (mentionsNotifications || (matchedNotifTypes.length && isEmailNotif))
  ) {
    const enabled = Boolean(wantsNotifOn && !wantsNotifOff);
    const baseKeys = matchedNotifTypes.length
      ? [...new Set(matchedNotifTypes)]
      : PUSH_NOTIFICATION_KEYS;
    baseKeys.forEach((key) => {
      patch[isEmailNotif ? `${key}Email` : key] = enabled;
    });
    notes.push(
      `${isEmailNotif ? "email " : ""}${
        matchedNotifTypes.length ? "selected " : ""
      }notifications ${enabled ? "enabled" : "muted"}`,
    );
    routes.add("/settings/notification");
  }

  const visibility = parseVisibilityValue(source);
  const mentionsPosts =
    /\b(who can see my posts|post visibility|my posts?|posts? (?:to|are|should)|make (?:my )?posts?)\b/.test(
      source,
    );
  const mentionsFriendRequests =
    /\b(who can send (?:me )?(?:a )?friend request|friend request visibility)\b/.test(
      source,
    );
  const mentionsTimeline =
    /\b(who can post on my timeline|timeline(?:\s+post)? visibility)\b/.test(
      source,
    );

  if (
    visibility &&
    (mentionsPosts ||
      mentionsFriendRequests ||
      mentionsTimeline ||
      /\b(privacy|visibility|only me|friends?\s+only|private|public)\b/.test(
        source,
      ))
  ) {
    const label = VISIBILITY_LABELS[visibility] || visibility;
    if (mentionsFriendRequests && !mentionsPosts && !mentionsTimeline) {
      patch.friendRequestVisibility = visibility;
      notes.push(`friend requests visible to ${label}`);
    } else if (mentionsTimeline && !mentionsPosts && !mentionsFriendRequests) {
      patch.timelinePostVisibility = visibility;
      notes.push(`timeline posts visible to ${label}`);
    } else if (mentionsPosts && !mentionsFriendRequests && !mentionsTimeline) {
      patch.postVisibility = visibility;
      notes.push(`posts visible to ${label}`);
    } else {
      patch.postVisibility = visibility;
      patch.timelinePostVisibility = visibility;
      if (mentionsFriendRequests) patch.friendRequestVisibility = visibility;
      notes.push(`posts visible to ${label}`);
    }
    routes.add("/settings/privacy");
  }

  if (
    /\b(hide|disable|turn off|stop showing|don't show|dont show)\b.+\btyping|\btyping(?:\s+indicator)?\b.+\b(off|hide|disable)\b/.test(
      source,
    )
  ) {
    patch.showIsTyping = false;
    notes.push("typing indicator hidden");
    routes.add("/settings/message");
  } else if (
    /\b(show|enable|turn on)\b.+\btyping|\btyping(?:\s+indicator)?\b.+\b(on|show)\b/.test(
      source,
    )
  ) {
    patch.showIsTyping = true;
    notes.push("typing indicator shown");
    routes.add("/settings/message");
  }

  if (
    /\b(hide|disable|turn off|stop sharing|don't share|dont share)\b.+\b(emotion|feelings|face mode)|\b(emotion|feelings|face mode)\b.+\b(off|hide|disable)\b/.test(
      source,
    )
  ) {
    patch.isShareEmotion = false;
    notes.push("emotion sharing off");
    routes.add("/settings/message");
  } else if (
    /\b(share|show|enable|turn on)\b.+\b(emotion|feelings|face mode)|\b(face mode|emotion sharing)\b.+\b(on|enable)\b/.test(
      source,
    )
  ) {
    patch.isShareEmotion = true;
    notes.push("emotion sharing on");
    routes.add("/settings/message");
  }

  if (/\bringtones?\b/.test(source)) {
    const ringtone = matchRingtone(source);
    if (ringtone) {
      patch.ringtone = ringtone;
      notes.push(`ringtone set to ${ringtone}`);
      routes.add("/settings/sound");
    }
  }

  const language = [
    ["english", "english"],
    ["bengali", "bengali"],
    ["bangla", "bengali"],
    ["বাংলা", "bengali"],
    ["spanish", "spanish"],
    ["french", "french"],
    ["hindi", "hindi"],
  ].find(([token]) => source.includes(token));
  if (language && /\b(language|lang|ভাষা)\b/.test(source)) {
    patch.preferredLanguage = language[1];
    notes.push(`language ${language[1]}`);
  }

  const route =
    routes.size === 1 ? [...routes][0] : routes.size > 1 ? "/settings" : "";

  return { patch, notes, route };
};

const PROFILE_FIELD_PATTERNS = [
  {
    key: "nickname",
    label: "nickname",
    patterns: [
      /(?:set|change|update|edit)\s+(?:my\s+)?nick\s*name\s+(?:to|as|:)\s+(.+?)(?:\s+and\s+(?:set|change|update)|$)/i,
      /(?:my\s+)?nick\s*name\s+(?:is|to|:)\s+(.+?)(?:\s+and\s+(?:set|change|update)|$)/i,
    ],
  },
  {
    key: "displayName",
    label: "display name",
    patterns: [
      /(?:set|change|update|edit)\s+(?:my\s+)?display\s*name\s+(?:to|as|:)\s+(.+?)(?:\s+and\s+(?:set|change|update)|$)/i,
      /(?:my\s+)?display\s*name\s+(?:is|to|:)\s+(.+?)(?:\s+and\s+(?:set|change|update)|$)/i,
    ],
  },
  {
    key: "banglaName",
    label: "Bangla name",
    patterns: [
      /(?:set|change|update|edit)\s+(?:my\s+)?(?:bangla|bengali)\s*name\s+(?:to|as|:)\s+(.+?)(?:\s+and\s+(?:set|change|update)|$)/i,
      /(?:my\s+)?(?:bangla|bengali)\s*name\s+(?:is|to|:)\s+(.+?)(?:\s+and\s+(?:set|change|update)|$)/i,
    ],
  },
  {
    key: "username",
    label: "username",
    patterns: [
      /(?:set|change|update|edit)\s+(?:my\s+)?user\s*name\s+(?:to|as|:)\s+(\S+)/i,
      /(?:my\s+)?user\s*name\s+(?:is|to|:)\s+(\S+)/i,
    ],
  },
  {
    key: "firstName",
    label: "first name",
    patterns: [
      /(?:set|change|update|edit)\s+(?:my\s+)?first\s*name\s+(?:to|as|:)\s+(.+?)(?:\s+and\s+(?:set|change|update)|$)/i,
      /(?:my\s+)?first\s*name\s+(?:is|to|:)\s+(.+?)(?:\s+and\s+(?:set|change|update)|$)/i,
    ],
  },
  {
    key: "surname",
    label: "surname",
    patterns: [
      /(?:set|change|update|edit)\s+(?:my\s+)?(?:surname|last\s*name)\s+(?:to|as|:)\s+(.+?)(?:\s+and\s+(?:set|change|update)|$)/i,
      /(?:my\s+)?(?:surname|last\s*name)\s+(?:is|to|:)\s+(.+?)(?:\s+and\s+(?:set|change|update)|$)/i,
    ],
  },
  {
    key: "presentAddress",
    label: "present address",
    patterns: [
      /(?:set|change|update|edit)\s+(?:my\s+)?present\s+address\s+(?:to|as|:)\s+(.+?)(?:\s+and\s+(?:set|change|update)|$)/i,
    ],
  },
  {
    key: "permanentAddress",
    label: "permanent address",
    patterns: [
      /(?:set|change|update|edit)\s+(?:my\s+)?permanent\s+address\s+(?:to|as|:)\s+(.+?)(?:\s+and\s+(?:set|change|update)|$)/i,
    ],
  },
];

export const parseProfilePatch = (text = "") => {
  const source = String(text || "").trim();
  const patch = {};
  const notes = [];

  PROFILE_FIELD_PATTERNS.forEach(({ key, label, patterns }) => {
    for (const pattern of patterns) {
      const match = source.match(pattern);
      if (match?.[1]) {
        const value = trimCapturedValue(match[1]);
        if (value) {
          patch[key] = value;
          notes.push(`${label} set to ${value}`);
        }
        break;
      }
    }
  });

  return { patch, notes, route: Object.keys(patch).length ? "/settings" : "" };
};

export const parseHealthLog = (text = "") => {
  const source = String(text || "").trim();
  const weightMatch = source.match(
    /\b(?:weight|weigh(?:ed|s)?|kg|কিলো)\b[^\d]{0,12}(\d{2,3}(?:\.\d+)?)/i,
  ) || source.match(/(\d{2,3}(?:\.\d+)?)\s*(?:kg|kgs|কিলো)/i);
  const calorieMatch = source.match(/(\d{2,5})\s*(?:cal(?:ories)?|kcal)/i);
  const mealMatch = source.match(
    /\b(?:ate|eat|log meal|meal|lunch|dinner|breakfast|snack)\b[:\s]+(.+?)(?:\s+\d|$)/i,
  );

  if (weightMatch) {
    return { kind: "weight", weight: Number(weightMatch[1]) };
  }
  if (mealMatch || calorieMatch) {
    const name = String(mealMatch?.[1] || "Meal")
      .replace(/\b\d{2,5}\s*(?:cal(?:ories)?|kcal).*$/i, "")
      .trim()
      .slice(0, 80);
    return {
      kind: "meal",
      name: name || "Meal",
      calories: calorieMatch ? Number(calorieMatch[1]) : 0,
    };
  }
  if (/\b(workout|exercise|gym|run|walk)\b/i.test(source)) {
    return { kind: "workout", name: source.slice(0, 80) };
  }
  return { kind: "open", detail: source };
};

export const parseRecoveryLog = (text = "") => {
  const source = String(text || "").trim();
  const cravingMatch = source.match(
    /\b(?:craving|urge)\b[^\d]{0,12}(\d{1,2})\b/i,
  );
  const daysMatch = source.match(
    /\b(\d{1,4})\s+days?\s+(?:clean|sober|free)\b/i,
  );
  const moodMatch = source.match(
    /\b(?:mood|feeling)\b[:\s]+([a-zA-Z\u0980-\u09FF]+)/i,
  );
  if (cravingMatch || /\b(craving|urge|relapse|trigger)\b/i.test(source)) {
    return {
      kind: "craving",
      intensity: cravingMatch ? Math.min(10, Number(cravingMatch[1])) : 5,
      trigger: source.slice(0, 140),
      mood: moodMatch?.[1] || "stressed",
    };
  }
  if (daysMatch || /\b(days clean|sobriety|recovery streak)\b/i.test(source)) {
    return {
      kind: "days",
      days: daysMatch ? Number(daysMatch[1]) : null,
    };
  }
  return { kind: "support", message: source };
};

export const todayKey = () => new Date().toISOString().split("T")[0];
