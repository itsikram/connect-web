const ICEBREAKERS = [
  { en: "What's one good thing that happened today?", bn: "আজকের একটা ভালো খবর কী?" },
  { en: "Drop a photo of what you're eating.", bn: "এখন যা খাচ্ছো তার একটা ছবি দাও।" },
  { en: "What song is stuck in your head?", bn: "মাথায় কোন গান ঘুরছে?" },
  { en: "One thing you're grateful for right now.", bn: "এই মুহূর্তে কিসের জন্য কৃতজ্ঞ?" },
  { en: "Unpopular opinion — go.", bn: "একটা unpopular opinion বলো।" },
  { en: "What are you learning this week?", bn: "এই সপ্তাহে কী শিখছো?" },
  { en: "Who made you smile today?", bn: "আজ কে তোমাকে হাসিয়েছে?" },
  { en: "Caption this: your current mood.", bn: "এখনকার মুডটা ক্যাপশন করো।" },
  { en: "Recommend one place in your city.", bn: "তোমার শহরের একটা জায়গা রেকমেন্ড করো।" },
  { en: "Tea or coffee — and why?", bn: "চা নাকি কফি — কেন?" },
  { en: "What's on your mind that you haven't posted?", bn: "যা ভাবছো কিন্তু পোস্ট করোনি?" },
  { en: "Share a win, even a tiny one.", bn: "একটা জয় শেয়ার করো, ছোট হলেও চলবে।" },
  { en: "Photo of the sky right now.", bn: "এখনকার আকাশের একটা ছবি।" },
  { en: "What would you tell yesterday-you?", bn: "গতকালের নিজেকে কী বলতে?" },
  { en: "One emoji for today. That's the post.", bn: "আজকের জন্য একটা ইমোজি — সেটাই পোস্ট।" },
];

const EVENING_PROMPTS = [
  { en: "Photo of the day — what did you see?", bn: "আজকের ছবি — কী দেখলে?" },
  { en: "Challenge a friend to Ludo tonight.", bn: "আজ রাতে কাউকে লুডুতে চ্যালেঞ্জ করো।" },
  { en: "How did today actually go?", bn: "আজকের দিনটা আসলে কেমন কাটল?" },
  { en: "One thing you'll do better tomorrow.", bn: "কালকে একটা জিনিস ভালো করবে।" },
  { en: "Share a screenshot of something that made you laugh.", bn: "যা তোমাকে হাসিয়েছে তার স্ক্রিনশট দাও।" },
];

const dayIndex = (list) => {
  const start = new Date(new Date().getFullYear(), 0, 0);
  const diff = Date.now() - start.getTime();
  const day = Math.floor(diff / 86400000);
  return list[day % list.length];
};

export const getDailyIcebreaker = () => dayIndex(ICEBREAKERS);

export const getEveningPrompt = () => dayIndex(EVENING_PROMPTS);

export const formatBilingualPrompt = (prompt) =>
  `${prompt.en}\n${prompt.bn}`;

export const isoDateKey = (date = new Date()) =>
  date.toISOString().slice(0, 10);

export const isoWeekKey = (date = new Date()) => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
};
