/**
 * Banglish = Bangla written in Latin letters.
 * Rewrites common command phrases into English the local intent parser already understands.
 */

const STRONG_TOKENS = new Set([
  "pathao",
  "pathan",
  "pathai",
  "pathiye",
  "pathiye",
  "koro",
  "korun",
  "bolo",
  "bolun",
  "kothay",
  "kothai",
  "kemon",
  "khobor",
  "khabor",
  "jao",
  "khela",
  "shuru",
  "suru",
  "mesej",
  "messege",
  "mesege",
  "bartha",
  "ache",
  "acho",
  "aso",
  "asen",
  "achis",
  "korcho",
  "korteso",
  "kortacho",
  "sathe",
  "sathei",
  "niye",
  "dosto",
  "bondhu",
  "bondhura",
]);

const WEAK_TOKENS = new Set([
  "ke",
  "te",
  "er",
  "tumi",
  "tmi",
  "apni",
  "apnar",
  "amake",
  "amar",
  "ekta",
  "akta",
  "khelte",
  "dekho",
  "dakho",
]);

const DESTINATION_ALIASES = {
  message: "messages",
  messages: "messages",
  msg: "messages",
  mesej: "messages",
  messege: "messages",
  mesege: "messages",
  inbox: "messages",
  chat: "messages",
  chats: "messages",
  setting: "settings",
  settings: "settings",
  bondhu: "friends",
  bondhura: "friends",
  dosto: "friends",
  dost: "friends",
  notification: "notifications",
  notifications: "notifications",
  notific: "notifications",
  ludu: "ludo",
  luddu: "ludo",
};

const trimName = (value = "") =>
  String(value)
    .trim()
    .replace(/^(?:amar\s+|amake\s+|please\s+)/i, "")
    .replace(/\s+(?:ke|re|bhai|vai|apu|apa|to)$/i, "")
    .replace(/[?.!,;:]+$/g, "")
    .trim();

const aliasDestination = (value = "") => {
  const trimmed = String(value)
    .trim()
    .replace(/^(?:amar\s+|the\s+)/i, "")
    .replace(/\s+(?:page|e)$/i, "")
    .trim()
    .toLowerCase();
  return DESTINATION_ALIASES[trimmed] || trimmed;
};

export const looksLikeBanglish = (text = "") => {
  const source = String(text || "").trim();
  if (!source || /[\u0980-\u09FF]/.test(source)) return false;
  const tokens = source
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  let strong = 0;
  let weak = 0;
  tokens.forEach((token) => {
    if (STRONG_TOKENS.has(token)) strong += 1;
    else if (WEAK_TOKENS.has(token)) weak += 1;
  });
  return strong >= 1 || weak >= 2;
};

export const normalizeBanglishChatText = (value = "") => {
  const lower = String(value || "")
    .trim()
    .replace(/^["'`“”‘’]+|["'`“”‘’]+$/g, "")
    .replace(/[?.!,;:।]+$/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
  if (!lower) return "";

  if (
    /^(tumi\s+|apni\s+)?(kothay|kothai|koi|koy)(\s+(acho|aso|asen|ache|achho|achis|achhen))?$/.test(
      lower,
    ) ||
    /^(koi|koy|kothay|kothai)\s+(ache|aso|acho|asen)$/.test(lower) ||
    /^(se|she|o)\s+(kothay|kothai|koi)(\s+ache)?$/.test(lower)
  ) {
    return "Where are you?";
  }

  if (
    /^(ki\s+khobor|ki\s+khabor|kemon\s+acho|kemon\s+aso|kemon\s+asen|kemon\s+achis)$/.test(
      lower,
    )
  ) {
    return "How are you?";
  }

  if (
    /^(ki\s+korcho|ki\s+korteso|ki\s+kortacho|ki\s+korchen|ki\s+kortesen)$/.test(
      lower,
    )
  ) {
    return "What are you doing?";
  }

  return "";
};

const COMMAND_REWRITES = [
  [
    /^(.+?)\s+ke\s+(?:ekta\s+|akta\s+|ei\s+)?(?:message|msg|messe?ge?|mesej|bartha|sms)\s+patha(?:o|n|i|iye|iye|w)?(?:\s+(?:bole?|bolo|bolun))?\s+(.+)$/i,
    (match) => `send message to ${trimName(match[1])} say ${match[2]}`,
  ],
  [
    /^(?:message|msg|messe?ge?|mesej|bartha)\s+patha(?:o|n)\s+(.+?)\s+ke\s+(?:bolo\s+|bolun\s+)?(.+)$/i,
    (match) => `send message to ${trimName(match[1])} say ${match[2]}`,
  ],
  [
    /^(.+?)\s+ke\s+(?:bolo|bolun|bol|bole\s+de(?:o|w)?|bole\s+dao)\s+(.+)$/i,
    (match) => `send message to ${trimName(match[1])} say ${match[2]}`,
  ],
  [
    /^(.+?)\s+ke\s+(?:message|msg|messe?ge?|mesej)\s+kor(?:o|un)?\s+(.+)$/i,
    (match) => `send message to ${trimName(match[1])} say ${match[2]}`,
  ],
  [
    /^(.+?)\s+ke\s+video\s+call\s+kor(?:o|un)?$/i,
    (match) => `video call ${trimName(match[1])}`,
  ],
  [
    /^(.+?)\s+ke\s+(?:call|phone|phone\s+call|dako|dakho|daken)\s+kor(?:o|un)?$/i,
    (match) => `call ${trimName(match[1])}`,
  ],
  [
    /^(.+?)\s+ke\s+(?:dako|dakho|daken)$/i,
    (match) => `call ${trimName(match[1])}`,
  ],
  [
    /^(.+?)\s+ke\s+(?:bump|poke)\s+kor(?:o|un)?$/i,
    (match) => `bump ${trimName(match[1])}`,
  ],
  [
    /^(.+?)\s+ke\s+ludo(?:\s+khela)?(?:\s+te)?\s+(?:invite\s+)?kor(?:o|un)?$/i,
    (match) => `invite ${trimName(match[1])} to ludo`,
  ],
  [
    /^(.+?)\s+(?:sathe|sathei|niye|nia)\s+ludo(?:\s+khela)?\s+(?:khel(?:o|un)|kor(?:o|un)?)$/i,
    (match) => `play ludo with ${trimName(match[1])}`,
  ],
  [
    /^(?:ludo(?:\s+khela)?|ludu|luddu)\s+(?:khela\s+)?(?:shuru|suru|start|create)\s*kor(?:o|un)?$/i,
    () => "create ludo game",
  ],
  [
    /^(?:ludo(?:\s+khela)?|ludu)\s+kor(?:o|un)?$/i,
    () => "create ludo game",
  ],
  [
    /^(.+?)(?:\s+er|\s+r|'s)\s+profile(?:\s+e)?(?:\s+(?:jao|jan|dekho|dekhen|open|kholo))?$/i,
    (match) => `go to ${trimName(match[1])}'s profile`,
  ],
  [
    /^(.+?)\s+ke\s+(?:message|msg|messe?ge?|mesej)\s+kor(?:o|un)?$/i,
    (match) => `message ${trimName(match[1])}`,
  ],
  [
    /^(.+?)\s+ke\s+(?:bolo|bolun|bol)$/i,
    (match) => `message ${trimName(match[1])}`,
  ],
  [
    /^(?:ami\s+)?(.+?)\s+e\s+(?:jao|jan|ja)$/i,
    (match) => `go to ${aliasDestination(match[1])}`,
  ],
];

export const normalizeBanglishCommand = (text = "") => {
  const source = String(text || "").trim();
  if (!source) return source;

  for (let i = 0; i < COMMAND_REWRITES.length; i += 1) {
    const [pattern, build] = COMMAND_REWRITES[i];
    const match = source.match(pattern);
    if (match) return build(match).replace(/\s+/g, " ").trim();
  }

  return source;
};
