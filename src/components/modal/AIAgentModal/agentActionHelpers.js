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

export const parseSettingsPatch = (text = "") => {
  const source = String(text || "").toLowerCase();
  const patch = {};
  const notes = [];

  if (/\b(dark mode|dark theme|night mode)\b/.test(source)) {
    patch.themeMode = "dark";
    notes.push("theme set to dark");
  } else if (/\b(light mode|light theme|day mode)\b/.test(source)) {
    patch.themeMode = "light";
    notes.push("theme set to light");
  }

  if (/\b(hide|stop sharing|don't share|dont share|turn off)\b.+\blocation\b|\blocation\b.+\b(off|hide|private)\b/.test(source)) {
    patch.isShareLocation = false;
    notes.push("location sharing off");
  } else if (/\b(share|show|enable|turn on)\b.+\blocation\b|\blocation\b.+\b(on|public)\b/.test(source)) {
    patch.isShareLocation = true;
    notes.push("location sharing on");
  }

  if (/\b(mute|disable|turn off|stop)\b.+\bnotification|\bno notifications?\b/.test(source)) {
    patch.friendRequestReceived = false;
    patch.friendRequestAccepted = false;
    patch.newMessageReceived = false;
    patch.newFriendPost = false;
    patch.newFriendStory = false;
    patch.newFriendWatch = false;
    notes.push("notifications muted");
  } else if (/\b(enable|unmute|turn on)\b.+\bnotification/.test(source)) {
    patch.friendRequestReceived = true;
    patch.friendRequestAccepted = true;
    patch.newMessageReceived = true;
    patch.newFriendPost = true;
    patch.newFriendStory = true;
    patch.newFriendWatch = true;
    notes.push("notifications enabled");
  }

  if (/\b(only me|private|nobody)\b/.test(source)) {
    patch.postVisibility = "onlyme";
    patch.timelinePostVisibility = "onlyme";
    notes.push("posts visible only to you");
  } else if (/\bfriends?\s+only\b|\bfriends\b.+\b(privacy|visibility|posts?)\b/.test(source)) {
    patch.postVisibility = "friends";
    patch.timelinePostVisibility = "friends";
    notes.push("posts visible to friends");
  } else if (/\bpublic\b.+\b(privacy|posts?|visibility)\b|\b(privacy|posts?)\b.+\bpublic\b/.test(source)) {
    patch.postVisibility = "public";
    patch.timelinePostVisibility = "public";
    notes.push("posts public");
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

  return { patch, notes };
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
