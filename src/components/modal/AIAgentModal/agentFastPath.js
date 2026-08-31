import { normalizeBanglishChatText } from "./banglish";

const trimName = (value = "") =>
  String(value || "")
    .trim()
    .replace(/^(?:আমার|আমাকে|please)\s+/i, "")
    .replace(/\s+(?:কে|রে|ভাই|আপু)$/u, "")
    .replace(/কে$/u, "")
    .replace(/[?.!,;:।]+$/g, "")
    .trim();

const BANGLA_DESTINATIONS = {
  সেটিংস: "settings",
  সেটিং: "settings",
  মেসেজ: "messages",
  ইনবক্স: "messages",
  চ্যাট: "messages",
  বন্ধু: "friends",
  ফ্রেন্ডস: "friends",
  নোটিফিকেশন: "notifications",
  লুডো: "ludo",
  হোম: "home",
  প্রোফাইল: "profile",
  নোট: "notes",
  নোটস: "notes",
  টাস্ক: "tasks",
  ক্যালেন্ডার: "calendar",
  ওয়াচ: "watch",
};

const BANGLA_COMMAND_REWRITES = [
  [
    /^(.+?)\s*কে\s*(?:একটা\s+|এই\s+)?(?:মেসেজ|বার্তা|ম্যাসেজ|মেসেজটা)\s*পাঠ(?:াও|ান|িয়ে|িয়ে)\s*(?:বলো|বলুন)?\s*(.+)$/u,
    (match) => `send message to ${trimName(match[1])} say ${match[2]}`,
  ],
  [
    /^(.+?)\s*কে\s*(?:বলো|বলুন)\s*(.+)$/u,
    (match) => `send message to ${trimName(match[1])} say ${match[2]}`,
  ],
  [
    /^(.+?)\s*কে\s*ভিডিও\s*কল\s*কর(?:ো|ুন)?$/u,
    (match) => `video call ${trimName(match[1])}`,
  ],
  [
    /^(.+?)\s*কে\s*(?:কল|ফোন)\s*কর(?:ো|ুন)?$/u,
    (match) => `call ${trimName(match[1])}`,
  ],
  [
    /^(.+?)\s*(?:এর|র)\s*প্রোফাইল(?:ে)?\s*(?:যাও|খোল|দেখাও|খুলে দাও)?$/u,
    (match) => `go to ${trimName(match[1])}'s profile`,
  ],
  [
    /^(.+?)\s*কে\s*লুডো(?:\s*খেলা)?(?:তে)?\s*(?:ইনভাইট\s*)?কর(?:ো|ুন)?$/u,
    (match) => `invite ${trimName(match[1])} to ludo`,
  ],
  [
    /^(?:লুডো)(?:\s*খেলা)?\s*(?:শুরু|স্টার্ট|তৈরি)\s*কর(?:ো|ুন)?$/u,
    () => "create ludo game",
  ],
  [
    /^(?:সেটিংস?|সেটিং)(?:ে)?\s*(?:যাও|খোলো|খুলে দাও)$/u,
    () => "go to settings",
  ],
  [
    /^(?:মেসেজ|ইনবক্স|চ্যাট)(?:ে)?\s*(?:যাও|খোলো)$/u,
    () => "go to messages",
  ],
  [
    /^(?:বন্ধু(?:দের)?|ফ্রেন্ডস?)(?:\s*পেজ)?(?:ে)?\s*(?:যাও|খোলো)$/u,
    () => "go to friends",
  ],
];

export const normalizeBanglaCommand = (text = "") => {
  const source = String(text || "").trim();
  if (!source || !/[\u0980-\u09FF]/.test(source)) return source;
  for (let i = 0; i < BANGLA_COMMAND_REWRITES.length; i += 1) {
    const [pattern, build] = BANGLA_COMMAND_REWRITES[i];
    const match = source.match(pattern);
    if (match) return build(match).replace(/\s+/g, " ").trim();
  }
  const destMatch = source.match(/^(.+?)(?:ে|তে)\s*(?:যাও|খোলো)$/u);
  if (destMatch) {
    const dest = String(destMatch[1] || "")
      .trim()
      .replace(/^(?:আমার)\s+/u, "");
    const mapped = BANGLA_DESTINATIONS[dest] || dest;
    return `go to ${mapped}`;
  }
  return source;
};

const CONNECT_NOUNS =
  /\b(settings?|profile|account|privacy|notification|inbox|messages?|friends?|watch|notes?|tasks?|calendar|health|rehab|youtube|ludo|chess|post|story|video player|yt-download)\b/i;

export const looksLikeAppCommand = (text = "") => {
  const source = String(text || "").trim();
  if (!source) return false;
  if (
    /\b(open|go to|navigate|call|message|invite|create|download|play|start|send|post|delete|block|unblock|bump|settings|ludo|chess|note|task|event|profile|search|find|show me|list my)\b/i.test(
      source,
    )
  ) {
    return true;
  }
  if (
    /\b(koro|korun|jao|pathao|pathan|bolo|bolun|dekho|khela|shuru|invite|mesej|messege)\b/i.test(
      source,
    )
  ) {
    return true;
  }
  return (
    /[\u0980-\u09FF]/.test(source) &&
    /(যাও|পাঠাও|খোল|ডাক|কল কর|মেসেজ|বার্তা|প্রোফাইল|সেটিং|লুডো|ইনভাইট|খেল)/.test(
      source,
    )
  );
};

export const looksLikeConnectCommand = (text = "") => {
  const source = String(text || "").trim();
  if (!source || !looksLikeAppCommand(source)) return false;
  if (CONNECT_NOUNS.test(source)) return true;
  if (
    /\b(call|video call|invite|bump|block|unblock|navigate|go to|open|message|send|download|create post|create note|create task|create event)\b/i.test(
      source,
    )
  ) {
    return true;
  }
  if (
    /\b(koro|korun|jao|pathao|pathan|bolo|bolun)\b.+\b(atik|profile|ludo|chess|mesej|settings?)\b/i.test(
      source,
    )
  ) {
    return true;
  }
  return (
    /[\u0980-\u09FF]/.test(source) &&
    /(যাও|পাঠাও|খোল|ডাক|কল কর|মেসেজ|বার্তা|প্রোফাইল|সেটিং|লুডো|ইনভাইট)/.test(source)
  );
};

export const looksLikePersonalChat = (text = "") => {
  const source = String(text || "").trim();
  if (!source) return false;
  if (
    /^(please\s+)?(tell me|talk (to|with) me|chat with me|advise|advice|explain|describe|write(?: me)?|give me|help me (with|think|decide|understand)|can you help me)\b/i.test(
      source,
    )
  ) {
    return true;
  }
  if (
    /\b(i (feel|felt|am|i'?m|think|need advice|need help|don'?t know|do not know|want to talk|want your opinion)|i'?m (sad|happy|anxious|stressed|lonely|tired|confused|angry|depressed|bored)|my (life|day|mood|girlfriend|boyfriend|wife|husband|job|boss|exam|school|family|parents|friend)|why (do|does|is|are|can'?t|did)|how (do i|can i|should i|would you)|what should i|what would you|meaning of|joke|story|opinion|advice)\b/i.test(
      source,
    )
  ) {
    return true;
  }
  if (
    /\b(ami (kharap|valo nai|bhalo nai|lonely|tension e|stress e)|mon kharap|ki (korbo|kora uchit)|help (koro|dao|lagbe)|bujhte parchi na|ekta joke|advice dao|bol to|bolo to|keno ami)\b/i.test(
      source,
    )
  ) {
    return true;
  }
  return /(কেমন লাগে|আমি দুঃখিত|আমি খারাপ|পরামর্শ|কী করব|কি করব|বলো তো|একটা জোক্স|মজার|আমার মন|সাহায্য|বুঝতে পারছি না)/u.test(
    source,
  );
};

export const isVoiceFiller = (text = "") => {
  const source = String(text || "").trim();
  if (!source) return true;
  return /^(u+m+|u+h+|er+|ah+|oh+|hmm+|mm+|হুম|আহ|ওহ|অ্যা)$/i.test(source);
};

export const getInstantAgentReply = (text = "") => {
  const raw = String(text || "").trim();
  if (!raw || raw.length > 80) return null;

  const banglishChat = normalizeBanglishChatText(raw);
  if (/how are you/i.test(banglishChat)) {
    return "Bhalo achi — bolo, kothay help lagbe?";
  }
  if (/what are you doing/i.test(banglishChat)) {
    return "Tumi bolo — ami shuntesi.";
  }

  const lower = raw.toLowerCase();
  if (
    /^(hi+|hello+|hey+|yo|hii+|hlw|hola|bonjour|ciao|namaste|namaskar)(\s+there)?(\s+agent)?[\s!.]*$/i.test(
      lower,
    )
  ) {
    return "Hi! What can I do for you?";
  }
  if (
    /^(salam|assalamu(?:\s*)?(?:alaikum|'alaikum)?)[\s!.]*$/i.test(lower)
  ) {
    return "Walaikum assalam! Bolo, kothay help lagbe?";
  }
  if (
    /^(how are you|how's it going|whats up|what's up|sup)[\s?!]*$/i.test(lower)
  ) {
    return "Doing well — what do you need?";
  }
  if (
    /^(kemon acho|kemon aso|kemon achis|kemon asen|ki khobor|ki khabor|tumi kemon acho|apni kemon asen|ki obostha)[\s?!]*$/i.test(
      lower,
    )
  ) {
    return "Bhalo achi — bolo, kothay help lagbe?";
  }
  if (
    /^(কেমন আছো|কেমন আছেন|কেমন আছিস|কি খবর|তুমি কেমন আছো|আপনি কেমন আছেন|কি অবস্থা)[\s?!।]*$/u.test(
      raw,
    )
  ) {
    return "ভালো আছি — বলো, কী করতে চাও?";
  }
  if (/^(kaise ho|kya haal|kya haal hai)[\s?!]*$/i.test(lower)) {
    return "Theek hoon — bolo, kya help chahiye?";
  }
  if (/^(ok|okay|okey|cool|sure|alright|got it|acha|accha)[\s!.]*$/i.test(lower)) {
    return "Alright — what next?";
  }
  if (/^(আচ্ছা|ঠিক আছে|ওকে)[\s!.।]*$/u.test(raw)) {
    return "ঠিক আছে — এরপর কী করব?";
  }
  if (/^(thanks|thank you|thnx|ty)[\s!.]*$/i.test(lower)) {
    return "You're welcome!";
  }
  if (/^(dhonnobad|শুকরিয়া|ধন্যবাদ)[\s!.]*$/iu.test(raw)) {
    return "অবশ্যই!";
  }
  if (/^(bye|goodbye|see you|later|good night)[\s!.]*$/i.test(lower)) {
    return "See you — ping me anytime.";
  }
  if (
    /^(who are you|what can you do|help|tumi ki korte paro|তুমি কে|তুমি কি করতে পারো)[\s?!।]*$/iu.test(
      raw,
    )
  ) {
    return "I can open pages, message friends, start Ludo, download YouTube, and more. Try “create ludo game” or “atik ke call koro”.";
  }
  return null;
};

export const describeUpcomingAction = (
  intent,
  { friendName = "", lang = "en" } = {},
) => {
  if (!intent?.action) return "";
  const name = String(friendName || intent.targetName || "").trim();
  const place = String(intent.label || intent.targetRoute || "").trim();
  const caption = String(intent.messageText || intent.searchQuery || "").trim();
  const mode = String(lang || "en").toLowerCase();
  const bangla = mode === "bn";
  const banglish = mode === "banglish";

  const line = (en, bn, bng) => (bangla ? bn : banglish ? bng : en);

  switch (intent.action) {
    case "NAVIGATE":
    case "NAVIGATE_PROFILE":
      return line(
        `Opening ${place || "that page"} now.`,
        `এখন ${place || "পেজ"} খুলছি।`,
        `Ekhon ${place || "page"} khulchi.`,
      );
    case "AUDIO_CALL":
      return line(
        `Calling ${name || "them"} now.`,
        `এখন ${name || "তাকে"} কল করছি।`,
        `Ekhon ${name || "taake"} call korchi.`,
      );
    case "VIDEO_CALL":
      return line(
        `Starting a video call with ${name || "them"}.`,
        `${name || "তার"} সাথে ভিডিও কল শুরু করছি।`,
        `${name || "tar"} sathe video call shuru korchi.`,
      );
    case "SEND_MESSAGE":
    case "SEND_MESSAGE_TO_USER":
      return line(
        `Sending your message${name ? ` to ${name}` : ""}.`,
        `${name ? `${name}-কে ` : ""}মেসেজ পাঠাচ্ছি।`,
        `${name ? `${name} ke ` : ""}message pathacchi.`,
      );
    case "INVITE_LUDO":
    case "CREATE_LUDO":
      return line(
        name ? `Starting Ludo and inviting ${name}.` : "Starting a Ludo game.",
        name ? `${name}-কে লুডোতে ইনভাইট করছি।` : "লুডো খেলা শুরু করছি।",
        name ? `${name} ke ludo te invite korchi.` : "Ludo khela shuru korchi.",
      );
    case "INVITE_CHESS":
    case "CREATE_CHESS":
      return line(
        name ? `Inviting ${name} to Chess.` : "Opening Chess.",
        name ? `${name}-কে দাবায় ইনভাইট করছি।` : "দাবা খুলছি।",
        name ? `${name} ke chess e invite korchi.` : "Chess khulchi.",
      );
    case "VIEW_PROFILE":
      return line(
        `Opening ${name || "their"} profile.`,
        `${name || "তার"} প্রোফাইল খুলছি।`,
        `${name || "tar"} profile khulchi.`,
      );
    case "CREATE_POST":
      return line(
        caption ? `Posting: ${caption.slice(0, 80)}.` : "Creating your post.",
        caption ? `পোস্ট করছি: ${caption.slice(0, 80)}।` : "পোস্ট তৈরি করছি।",
        caption ? `Post korchi: ${caption.slice(0, 80)}.` : "Post toiri korchi.",
      );
    case "PLAY_VIDEO":
      return line(
        `Playing ${caption || place || "that video"} now.`,
        `এখন ${caption || place || "ভিডিও"} চালাচ্ছি।`,
        `Ekhon ${caption || place || "video"} chalacchi.`,
      );
    case "DOWNLOAD_YOUTUBE": {
      const query = String(caption || "").trim();
      const lookingUp = query && !/youtu(\.be|be\.com)/i.test(query);
      return line(
        lookingUp
          ? `Searching YouTube for ${query}.`
          : "Starting the YouTube download.",
        lookingUp
          ? `ইউটিউবে "${query}" খুঁজছি।`
          : "ইউটিউব ডাউনলোড শুরু করছি।",
        lookingUp
          ? `YouTube e "${query}" khujchi.`
          : "YouTube download shuru korchi.",
      );
    }
    case "SEARCH_YOUTUBE":
      return line(
        `Searching YouTube${caption ? ` for ${caption}` : ""} now.`,
        caption ? `ইউটিউবে "${caption}" খুঁজছি।` : "ইউটিউবে খুঁজছি।",
        caption ? `YouTube e "${caption}" khujchi.` : "YouTube e khujchi.",
      );
    case "SEARCH_VIDEO":
    case "SEARCH_USERS":
    case "SEARCH_POSTS":
    case "SEARCH_APP":
      return line(
        `Searching${caption ? ` for ${caption}` : ""} now.`,
        caption ? `"${caption}" খুঁজছি।` : "খুঁজছি।",
        caption ? `"${caption}" khujchi.` : "Khujchi.",
      );
    case "BLOCK_USER":
    case "BLOCK":
      return line(
        `Blocking ${name || "them"} now.`,
        `এখন ${name || "তাকে"} ব্লক করছি।`,
        `Ekhon ${name || "taake"} block korchi.`,
      );
    case "UNBLOCK_USER":
    case "UNBLOCK":
      return line(
        `Unblocking ${name || "them"} now.`,
        `এখন ${name || "তাকে"} আনব্লক করছি।`,
        `Ekhon ${name || "taake"} unblock korchi.`,
      );
    case "ADD_FRIEND":
      return line(
        `Sending a friend request to ${name || "them"}.`,
        `${name || "তাকে"} ফ্রেন্ড রিকোয়েস্ট পাঠাচ্ছি।`,
        `${name || "taake"} friend request pathacchi.`,
      );
    case "BUMP":
      return line(
        `Sending a bump to ${name || "them"}.`,
        `${name || "তাকে"} বাম্প পাঠাচ্ছি।`,
        `${name || "taake"} bump pathacchi.`,
      );
    case "OPEN_MESSAGES":
      return line("Opening messages.", "মেসেজ খুলছি।", "Message khulchi.");
    case "OPEN_FRIENDS":
    case "LIST_FRIENDS":
      return line("Opening friends.", "ফ্রেন্ডস খুলছি।", "Friends khulchi.");
    default: {
      const label = String(intent.label || intent.action || "that")
        .replace(/_/g, " ")
        .toLowerCase();
      return line(
        `I'll ${label} now.`,
        `এখন ${label} করছি।`,
        `Ekhon ${label} korchi.`,
      );
    }
  }
};
