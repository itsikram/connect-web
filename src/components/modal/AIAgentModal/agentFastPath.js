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

export const getInstantAgentReply = (text = "") => {
  const raw = String(text || "").trim();
  if (!raw || raw.length > 80) return null;

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
