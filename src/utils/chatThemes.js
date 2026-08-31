export const DEFAULT_CHAT_THEME_ID = "classic";

export const DEFAULT_ACTION_EMOJI = "👍";

export const QUICK_REACTION_PRESETS = [
  "👍",
  "❤️",
  "🥰",
  "😘",
  "😂",
  "🔥",
  "😍",
  "💋",
  "👋",
  "✨",
];

export const ROMANTIC_EMOJI_TRIGGERS = [
  "❤️",
  "❤",
  "💕",
  "💖",
  "💗",
  "💓",
  "💞",
  "💘",
  "💝",
  "💟",
  "❣️",
  "❣",
  "😍",
  "🥰",
  "😘",
  "😗",
  "😙",
  "😚",
  "💋",
  "😻",
  "💑",
  "💏",
  "🫶",
  "🌹",
  "🥀",
  "💐",
  "💌",
  "💍",
  "💒",
  "🧡",
  "💛",
  "💚",
  "💙",
  "💜",
  "🤍",
  "🤎",
  "🖤",
  "🫀",
  "❤️‍🔥",
  "❤️‍🩹",
];

export const LOVE_FALL_EMOJIS = [
  "❤️",
  "🥰",
  "😘",
  "💋",
  "💕",
  "😍",
  "🫶",
  "🌹",
];

const ROMANTIC_WORDS = [
  "love",
  "loves",
  "loved",
  "loving",
  "lovely",
  "lover",
  "beloved",
  "luv",
  "ily",
  "ilu",
  "ilysm",
  "sweetheart",
  "sweetie",
  "darling",
  "honey",
  "babe",
  "bae",
  "baby",
  "cutie",
  "gorgeous",
  "handsome",
  "kiss",
  "kisses",
  "kissing",
  "hug",
  "hugs",
  "hugging",
  "crush",
  "soulmate",
  "wifey",
  "hubby",
  "xoxo",
  "muah",
  "mwah",
  "adore",
  "adores",
  "adored",
  "adorable",
  "romance",
  "romantic",
  "heart",
  "hearts",
  "forever",
  "angel",
  "precious",
  "dear",
  "cuddle",
  "cuddles",
  "cuddling",
  "smooch",
];

const ROMANTIC_PHRASES = [
  "love you",
  "love u",
  "love ya",
  "luv you",
  "luv u",
  "miss you",
  "miss u",
  "i miss you",
  "thinking of you",
  "thinking about you",
  "crazy about you",
  "mad about you",
  "my love",
  "my heart",
  "kiss me",
  "hug me",
  "want you",
  "need you",
  "you are beautiful",
  "you are cute",
  "you're beautiful",
  "you're cute",
  "date night",
  "can't wait to see you",
  "cant wait to see you",
];

const BANGLA_ROMANTIC = [
  "ভালোবাসি",
  "ভালবাসি",
  "ভালোবাসা",
  "ভালবাসা",
  "প্রেম",
  "জানু",
  "সোনা",
  "আদর",
  "চুমু",
  "প্রিয়",
  "প্রিয়",
  "valobashi",
  "valobasha",
  "valobasi",
  "bhalobashi",
  "bhalobasha",
  "jaanu",
  "jaan",
  "shona",
  "chumu",
  "priyo",
  "priya",
];

const escapeRegExp = (value) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const ROMANTIC_WORD_PATTERN = new RegExp(
  `\\b(?:${ROMANTIC_WORDS.map(escapeRegExp).join("|")})\\b|${ROMANTIC_PHRASES.map(
    (phrase) => escapeRegExp(phrase).replace(/ /g, "\\s+"),
  ).join("|")}`,
  "i",
);

const ROMANTIC_CODE_POINTS = new Set([
  0x2764, // ❤ heavy black heart
  0x2665, // ♥ black heart suit
  0x2661, // ♡ white heart suit
  0x22c6, // star operator sometimes used as sparkle
  0x1f495, // 💕
  0x1f496, // 💖
  0x1f497, // 💗
  0x1f493, // 💓
  0x1f49e, // 💞
  0x1f498, // 💘
  0x1f49d, // 💝
  0x1f49f, // 💟
  0x2763, // ❣️
  0x1f60d, // 😍
  0x1f970, // 🥰
  0x1f618, // 😘
  0x1f617, // 😗
  0x1f619, // 😙
  0x1f61a, // 😚
  0x1f48b, // 💋
  0x1f63b, // 😻
  0x1f491, // 💑
  0x1f48f, // 💏
  0x1fac6, // 🫶
  0x1f339, // 🌹
  0x1f940, // 🥀
  0x1f490, // 💐
  0x1f48c, // 💌
  0x1f48d, // 💍
  0x1f492, // 💒
  0x1f9e1, // 🧡
  0x1f49b, // 💛
  0x1f49a, // 💚
  0x1f499, // 💙
  0x1f49c, // 💜
  0x1f90d, // 🤍
  0x1f90e, // 🤎
  0x1f5a4, // 🖤
  0x1fac0, // 🫀
]);

const stripEmojiModifiers = (value) =>
  value.replace(/[\uFE0E\uFE0F\u200D\u20E3]/g, "");

export const isRomanticMessage = (text) => {
  if (text == null) return false;
  const raw = String(text).normalize("NFC");
  if (!raw) return false;
  if (ROMANTIC_EMOJI_TRIGGERS.some((emoji) => raw.includes(emoji))) return true;

  const stripped = stripEmojiModifiers(raw);
  if (
    ROMANTIC_EMOJI_TRIGGERS.some((emoji) =>
      stripped.includes(stripEmojiModifiers(emoji)),
    )
  ) {
    return true;
  }

  for (const char of stripped) {
    const codePoint = char.codePointAt(0);
    if (codePoint && ROMANTIC_CODE_POINTS.has(codePoint)) return true;
  }

  const normalized = raw.toLowerCase().replace(/\s+/g, " ").trim();
  if (ROMANTIC_WORD_PATTERN.test(normalized)) return true;
  if (BANGLA_ROMANTIC.some((word) => normalized.includes(word.toLowerCase()))) {
    return true;
  }
  return false;
};

export const DEFAULT_FRIEND_CHAT_SETTINGS = {
  themeId: DEFAULT_CHAT_THEME_ID,
  wallpaperSource: "global",
  customBackground: null,
  actionEmoji: DEFAULT_ACTION_EMOJI,
  showBackgroundOverlay: true,
};

export const CHAT_THEMES = [
  {
    id: "classic",
    name: "Classic Cyan",
    description: "The original Connect look",
    isDark: true,
    wallpaperCss:
      "radial-gradient(1200px 620px at 12% -10%, rgba(0, 212, 255, 0.16), transparent 58%), radial-gradient(900px 480px at 108% 110%, rgba(0, 153, 204, 0.14), transparent 52%), linear-gradient(165deg, #071018 0%, #0c1820 48%, #08141c 100%)",
    preview: {
      sent: "#00d4ff",
      recv: "#3a4148",
      wallpaper: "#0b1a21",
    },
    vars: {
      "--chat-accent": "#00d4ff",
      "--chat-accent-strong": "#33e0ff",
      "--chat-sent-bg":
        "linear-gradient(135deg, rgba(0, 212, 255, 0.2) 0%, rgba(0, 153, 204, 0.18) 100%)",
      "--chat-sent-border": "rgba(0, 212, 255, 0.28)",
      "--chat-sent-text": "#ffffff",
      "--chat-sent-shadow": "0 8px 24px rgba(0, 212, 255, 0.14)",
      "--chat-sent-hover":
        "linear-gradient(135deg, rgba(30, 220, 255, 0.42) 0%, rgba(0, 184, 255, 0.38) 100%)",
      "--chat-recv-bg": "rgba(255, 255, 255, 0.08)",
      "--chat-recv-border": "rgba(255, 255, 255, 0.12)",
      "--chat-recv-text": "#ffffff",
      "--chat-recv-hover": "rgba(255, 255, 255, 0.12)",
      "--chat-overlay": "rgba(4, 10, 16, 0.42)",
      "--chat-meta": "rgba(255, 255, 255, 0.62)",
    },
  },
  {
    id: "ocean",
    name: "Midnight Ocean",
    description: "Deep navy with electric blue",
    isDark: true,
    wallpaperCss:
      "radial-gradient(900px 520px at 8% 0%, rgba(56, 189, 248, 0.18), transparent 55%), radial-gradient(700px 420px at 100% 100%, rgba(37, 99, 235, 0.22), transparent 50%), linear-gradient(168deg, #06101f 0%, #0b1b33 46%, #071526 100%)",
    preview: {
      sent: "#38bdf8",
      recv: "#243044",
      wallpaper: "#0a1730",
    },
    vars: {
      "--chat-accent": "#38bdf8",
      "--chat-accent-strong": "#7dd3fc",
      "--chat-sent-bg":
        "linear-gradient(135deg, rgba(56, 189, 248, 0.28) 0%, rgba(37, 99, 235, 0.26) 100%)",
      "--chat-sent-border": "rgba(56, 189, 248, 0.38)",
      "--chat-sent-text": "#f0f9ff",
      "--chat-sent-shadow": "0 8px 24px rgba(14, 165, 233, 0.18)",
      "--chat-sent-hover":
        "linear-gradient(135deg, rgba(56, 189, 248, 0.46) 0%, rgba(59, 130, 246, 0.42) 100%)",
      "--chat-recv-bg": "rgba(148, 163, 184, 0.14)",
      "--chat-recv-border": "rgba(148, 163, 184, 0.18)",
      "--chat-recv-text": "#e8f1ff",
      "--chat-recv-hover": "rgba(148, 163, 184, 0.2)",
      "--chat-overlay": "rgba(3, 12, 28, 0.46)",
      "--chat-meta": "rgba(226, 232, 240, 0.62)",
    },
  },
  {
    id: "ember",
    name: "Sunset Ember",
    description: "Warm dusk with amber highlights",
    isDark: true,
    wallpaperCss:
      "radial-gradient(900px 480px at 0% 8%, rgba(251, 146, 60, 0.18), transparent 55%), radial-gradient(780px 520px at 100% 100%, rgba(244, 63, 94, 0.16), transparent 52%), linear-gradient(170deg, #170b0a 0%, #1c0f10 50%, #14090b 100%)",
    preview: {
      sent: "#fb923c",
      recv: "#3a2a28",
      wallpaper: "#1a0e0d",
    },
    vars: {
      "--chat-accent": "#fb923c",
      "--chat-accent-strong": "#fdba74",
      "--chat-sent-bg":
        "linear-gradient(135deg, rgba(251, 146, 60, 0.3) 0%, rgba(244, 63, 94, 0.22) 100%)",
      "--chat-sent-border": "rgba(251, 146, 60, 0.36)",
      "--chat-sent-text": "#fff7ed",
      "--chat-sent-shadow": "0 8px 24px rgba(251, 146, 60, 0.16)",
      "--chat-sent-hover":
        "linear-gradient(135deg, rgba(251, 146, 60, 0.48) 0%, rgba(244, 63, 94, 0.36) 100%)",
      "--chat-recv-bg": "rgba(255, 237, 213, 0.08)",
      "--chat-recv-border": "rgba(253, 186, 116, 0.14)",
      "--chat-recv-text": "#fff7ed",
      "--chat-recv-hover": "rgba(255, 237, 213, 0.14)",
      "--chat-overlay": "rgba(16, 6, 6, 0.48)",
      "--chat-meta": "rgba(254, 215, 170, 0.62)",
    },
  },
  {
    id: "aurora",
    name: "Aurora",
    description: "Soft mint over forest night",
    isDark: true,
    wallpaperCss:
      "radial-gradient(880px 500px at 6% -8%, rgba(52, 211, 153, 0.18), transparent 56%), radial-gradient(720px 460px at 100% 108%, rgba(16, 185, 129, 0.16), transparent 50%), linear-gradient(168deg, #07140f 0%, #0c1c16 48%, #081410 100%)",
    preview: {
      sent: "#34d399",
      recv: "#274037",
      wallpaper: "#0c1c16",
    },
    vars: {
      "--chat-accent": "#34d399",
      "--chat-accent-strong": "#6ee7b7",
      "--chat-sent-bg":
        "linear-gradient(135deg, rgba(52, 211, 153, 0.26) 0%, rgba(16, 185, 129, 0.22) 100%)",
      "--chat-sent-border": "rgba(52, 211, 153, 0.34)",
      "--chat-sent-text": "#ecfdf5",
      "--chat-sent-shadow": "0 8px 24px rgba(16, 185, 129, 0.16)",
      "--chat-sent-hover":
        "linear-gradient(135deg, rgba(52, 211, 153, 0.42) 0%, rgba(16, 185, 129, 0.36) 100%)",
      "--chat-recv-bg": "rgba(167, 243, 208, 0.08)",
      "--chat-recv-border": "rgba(167, 243, 208, 0.14)",
      "--chat-recv-text": "#ecfdf5",
      "--chat-recv-hover": "rgba(167, 243, 208, 0.14)",
      "--chat-overlay": "rgba(4, 16, 12, 0.46)",
      "--chat-meta": "rgba(167, 243, 208, 0.6)",
    },
  },
  {
    id: "velvet",
    name: "Velvet",
    description: "Plum night with rose gold",
    isDark: true,
    wallpaperCss:
      "radial-gradient(860px 480px at 0% 0%, rgba(232, 121, 249, 0.16), transparent 55%), radial-gradient(760px 500px at 100% 100%, rgba(192, 132, 252, 0.18), transparent 52%), linear-gradient(168deg, #140816 0%, #1a0d1f 48%, #120814 100%)",
    preview: {
      sent: "#e879f9",
      recv: "#3b2a44",
      wallpaper: "#160a1a",
    },
    vars: {
      "--chat-accent": "#e879f9",
      "--chat-accent-strong": "#f0abfc",
      "--chat-sent-bg":
        "linear-gradient(135deg, rgba(232, 121, 249, 0.26) 0%, rgba(168, 85, 247, 0.24) 100%)",
      "--chat-sent-border": "rgba(232, 121, 249, 0.34)",
      "--chat-sent-text": "#fdf4ff",
      "--chat-sent-shadow": "0 8px 24px rgba(192, 132, 252, 0.16)",
      "--chat-sent-hover":
        "linear-gradient(135deg, rgba(232, 121, 249, 0.44) 0%, rgba(168, 85, 247, 0.38) 100%)",
      "--chat-recv-bg": "rgba(244, 232, 255, 0.08)",
      "--chat-recv-border": "rgba(216, 180, 254, 0.16)",
      "--chat-recv-text": "#fae8ff",
      "--chat-recv-hover": "rgba(244, 232, 255, 0.14)",
      "--chat-overlay": "rgba(14, 6, 18, 0.48)",
      "--chat-meta": "rgba(233, 213, 255, 0.62)",
    },
  },
  {
    id: "graphite",
    name: "Graphite",
    description: "Quiet, professional slate",
    isDark: true,
    wallpaperCss:
      "radial-gradient(900px 500px at 12% -6%, rgba(148, 163, 184, 0.12), transparent 55%), linear-gradient(168deg, #101114 0%, #16181c 50%, #0e1215 100%)",
    preview: {
      sent: "#94a3b8",
      recv: "#2b3238",
      wallpaper: "#14181c",
    },
    vars: {
      "--chat-accent": "#cbd5e1",
      "--chat-accent-strong": "#e2e8f0",
      "--chat-sent-bg":
        "linear-gradient(135deg, rgba(148, 163, 184, 0.28) 0%, rgba(100, 116, 139, 0.24) 100%)",
      "--chat-sent-border": "rgba(203, 213, 225, 0.28)",
      "--chat-sent-text": "#f8fafc",
      "--chat-sent-shadow": "0 8px 24px rgba(15, 23, 42, 0.28)",
      "--chat-sent-hover":
        "linear-gradient(135deg, rgba(148, 163, 184, 0.42) 0%, rgba(100, 116, 139, 0.36) 100%)",
      "--chat-recv-bg": "rgba(255, 255, 255, 0.07)",
      "--chat-recv-border": "rgba(255, 255, 255, 0.1)",
      "--chat-recv-text": "#f1f5f9",
      "--chat-recv-hover": "rgba(255, 255, 255, 0.12)",
      "--chat-overlay": "rgba(8, 10, 12, 0.4)",
      "--chat-meta": "rgba(226, 232, 240, 0.58)",
    },
  },
  {
    id: "love",
    name: "Sweetheart",
    description: "Made for couples — hearts rain on love notes",
    couple: true,
    loveRain: true,
    isDark: true,
    wallpaperCss:
      "radial-gradient(820px 460px at 8% -6%, rgba(251, 113, 133, 0.28), transparent 56%), radial-gradient(720px 500px at 100% 108%, rgba(244, 63, 94, 0.2), transparent 52%), radial-gradient(420px 280px at 50% 40%, rgba(253, 164, 175, 0.12), transparent 60%), linear-gradient(168deg, #1a0710 0%, #2a0c18 48%, #14060d 100%)",
    preview: {
      sent: "#fb7185",
      recv: "#4a2432",
      wallpaper: "#1a0710",
    },
    vars: {
      "--chat-accent": "#fb7185",
      "--chat-accent-strong": "#fda4af",
      "--chat-sent-bg":
        "linear-gradient(135deg, rgba(251, 113, 133, 0.38) 0%, rgba(244, 63, 94, 0.28) 100%)",
      "--chat-sent-border": "rgba(251, 113, 133, 0.42)",
      "--chat-sent-text": "#fff1f2",
      "--chat-sent-shadow": "0 8px 24px rgba(244, 63, 94, 0.2)",
      "--chat-sent-hover":
        "linear-gradient(135deg, rgba(251, 113, 133, 0.52) 0%, rgba(244, 63, 94, 0.4) 100%)",
      "--chat-recv-bg": "rgba(255, 228, 230, 0.1)",
      "--chat-recv-border": "rgba(253, 164, 175, 0.18)",
      "--chat-recv-text": "#fff1f2",
      "--chat-recv-hover": "rgba(255, 228, 230, 0.16)",
      "--chat-overlay": "rgba(18, 4, 10, 0.38)",
      "--chat-meta": "rgba(254, 205, 211, 0.7)",
    },
  },
];

export const getChatTheme = (themeId) =>
  CHAT_THEMES.find((theme) => theme.id === themeId) || CHAT_THEMES[0];

export const normalizeFriendChatSettings = (raw = {}) => {
  const themeId = CHAT_THEMES.some((theme) => theme.id === raw.themeId)
    ? raw.themeId
    : DEFAULT_CHAT_THEME_ID;
  const wallpaperSource = ["theme", "global", "custom"].includes(
    raw.wallpaperSource,
  )
    ? raw.wallpaperSource
    : raw.customBackground
      ? "custom"
      : DEFAULT_FRIEND_CHAT_SETTINGS.wallpaperSource;

  return {
    themeId,
    wallpaperSource,
    customBackground: raw.customBackground || null,
    actionEmoji:
      typeof raw.actionEmoji === "string" && raw.actionEmoji.trim()
        ? raw.actionEmoji
        : DEFAULT_ACTION_EMOJI,
    showBackgroundOverlay:
      raw.showBackgroundOverlay === false ||
      raw.showBackgroundOverlay === "false"
        ? false
        : true,
  };
};

export const resolveChatWallpaper = (
  friendSettings,
  theme,
  globalBackground,
  fallbackImage,
) => {
  const settings = normalizeFriendChatSettings(friendSettings);

  if (settings.wallpaperSource === "custom" && settings.customBackground) {
    return {
      type: "image",
      value: settings.customBackground,
      isDark: true,
    };
  }

  if (settings.wallpaperSource === "global") {
    return {
      type: "image",
      value: globalBackground || fallbackImage,
      isDark: null,
    };
  }

  return {
    type: "css",
    value: theme.wallpaperCss,
    isDark: theme.isDark,
  };
};
