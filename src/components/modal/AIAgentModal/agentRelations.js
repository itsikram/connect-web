/**
 * Resolves relationship words ("my mom", "আম্মু", "baba", "my wife") to the
 * user's own connects, using the relationship tags people set on a connect
 * (Parent, Sibling, Spouse, ...) plus the connect's gender to tell, e.g.,
 * mom from dad when both are tagged "Parent".
 */

// Connect: { id, name, profilePic, relationshipTypes: [..], gender }
// Relation: { label, words, types (most specific first), gender }
const RELATIONS = [
  {
    label: 'mom',
    words: ['mom', 'mommy', 'mum', 'mother', 'ma', 'maa', 'amma', 'ammu', 'ammi', 'mummy', 'মা', 'আম্মু', 'আম্মা', 'আম্মি', 'মাম্মি', 'মাকে', 'আম্মুকে', 'আম্মাকে'],
    types: ['mother', 'mom', 'parent', 'family'],
    gender: 'female',
  },
  {
    label: 'dad',
    words: ['dad', 'daddy', 'father', 'papa', 'abba', 'abbu', 'baba', 'বাবা', 'আব্বু', 'আব্বা', 'পাপা', 'বাবাকে', 'আব্বুকে', 'আব্বাকে'],
    types: ['father', 'dad', 'parent', 'family'],
    gender: 'male',
  },
  {
    label: 'brother',
    words: ['brother', 'bro', 'bhaiya', 'vaiya', 'ভাইয়া', 'ভাইয়া', 'ভাইকে', 'ভাইয়াকে'],
    types: ['brother', 'sibling', 'family', 'relative'],
    gender: 'male',
  },
  {
    label: 'sister',
    words: ['sister', 'sis', 'bon', 'বোন', 'বোনকে', 'আপুকে'],
    types: ['sister', 'sibling', 'family', 'relative'],
    gender: 'female',
  },
  {
    label: 'wife',
    words: ['wife', 'bou', 'biwi', 'বউ', 'বৌ', 'স্ত্রী', 'বউকে', 'বৌকে'],
    types: ['wife', 'spouse', 'partner'],
    gender: 'female',
  },
  {
    label: 'husband',
    words: ['husband', 'swami', 'jamai', 'স্বামী', 'জামাই', 'স্বামীকে'],
    types: ['husband', 'spouse', 'partner'],
    gender: 'male',
  },
  {
    label: 'son',
    words: ['son', 'chele', 'ছেলে', 'ছেলেকে'],
    types: ['son', 'child', 'family'],
    gender: 'male',
  },
  {
    label: 'daughter',
    words: ['daughter', 'meye', 'মেয়ে', 'মেয়ে', 'মেয়েকে', 'মেয়েকে'],
    types: ['daughter', 'child', 'family'],
    gender: 'female',
  },
  {
    label: 'best friend',
    words: ['best friend', 'bestfriend', 'bff', 'বেস্ট ফ্রেন্ড', 'প্রিয় বন্ধু'],
    types: ['best friend'],
  },
  {
    label: 'partner',
    words: ['partner', 'girlfriend', 'boyfriend', 'gf', 'bf'],
    types: ['partner', 'dating', 'fiance', 'spouse'],
  },
];

const normalize = (value) =>
  String(value || '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/[‌‍]/g, '')
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, ' ')
    // "my mom", "amar ammu", "আমার মা", "mom's"
    .replace(/^(my|amar|আমার)\s+/u, '')
    .replace(/\s+/g, ' ')
    // "mom's" becomes "mom s" once the apostrophe is stripped.
    .replace(/ s$/, '')
    .trim();

/** The relation a spoken name refers to, or null for an ordinary name. */
export const findRelation = (spokenName) => {
  const needle = normalize(spokenName);
  if (!needle) return null;
  return RELATIONS.find(relation => relation.words.includes(needle)) || null;
};

const genderOf = (value) => {
  const text = String(value || '').trim().toLowerCase();
  if (/^(f|female|woman|mohila|মহিলা|নারী)/.test(text)) return 'female';
  if (/^(m|male|man|purush|পুরুষ)/.test(text)) return 'male';
  return '';
};

/**
 * Connects that fit a relationship word, best match first. Returns null when
 * the spoken name is not a relationship word at all.
 */
export const matchRelationConnects = (spokenName, connects = []) => {
  const relation = findRelation(spokenName);
  if (!relation) return null;
  const tagged = (connect) =>
    (connect.relationshipTypes || []).map(type => type.trim().toLowerCase());

  // Most specific tag first: "Mother" beats "Parent" beats "Family".
  for (const type of relation.types) {
    let matches = connects.filter(connect => tagged(connect).includes(type));
    if (!matches.length) continue;
    if (relation.gender && matches.length > 1) {
      const sameGender = matches.filter(
        connect => genderOf(connect.gender) === relation.gender,
      );
      const unknownGender = matches.filter(connect => !genderOf(connect.gender));
      matches = sameGender.length ? sameGender : unknownGender.length ? unknownGender : matches;
    } else if (relation.gender && matches.length === 1) {
      // A single "Parent" tagged as the other gender is not a match.
      const only = genderOf(matches[0].gender);
      if (only && only !== relation.gender) continue;
    }
    if (matches.length) return { relation, matches };
  }
  return { relation, matches: [] };
};

// Spoken names often carry a relation/honorific ("রহিম ভাই", "Rina apu").
const HONORIFICS = new Set([
  "ভাই", "ভাইয়া", "ভাইজান", "আপা", "আপু", "দা", "দাদা", "দিদি", "সাহেব",
  "স্যার", "ম্যাডাম", "মামা", "চাচা", "খালা", "bhai", "vai", "bhaiya",
  "vaiya", "apa", "apu", "da", "dada", "didi", "saheb", "sir", "madam",
  "mama", "chacha", "khala",
]);

/** "রহিম ভাই" -> "রহিম"; a lone honorific is kept as is. */
export const stripHonorifics = (value = "") => {
  const words = String(value || "").trim().split(/\s+/).filter(Boolean);
  const kept = words.filter((word) => !HONORIFICS.has(word.toLowerCase()));
  return (kept.length ? kept : words).join(" ");
};

const SPOKEN_ORDINALS = [
  [/\b(first|1st|number one|prothom|prothomjon)\b|প্রথম|এক নম্বর|১ নম্বর/i, 0],
  [/\b(second|2nd|number two|ditiyo|ditiyojon)\b|দ্বিতীয়|দুই নম্বর|২ নম্বর/i, 1],
  [/\b(third|3rd|number three|tritiyo)\b|তৃতীয়|তিন নম্বর|৩ নম্বর/i, 2],
  [/\b(fourth|4th|number four)\b|চতুর্থ|চার নম্বর|৪ নম্বর/i, 3],
  [/\b(fifth|5th|number five)\b|পঞ্চম|পাঁচ নম্বর|৫ নম্বর/i, 4],
  [/\b(last|shesh)\b|শেষ(?:ের)?(?:জন)?/i, -1],
];

/**
 * Lets a voice user answer "which person?" out loud: by position ("the
 * second one", "দ্বিতীয়জন") or by a name part only one choice has.
 * `choices` are { name, username } objects; returns the chosen one or null.
 */
export const matchSpokenChoice = (text, choices = []) => {
  if (!choices.length) return null;
  for (const [pattern, index] of SPOKEN_ORDINALS) {
    if (pattern.test(text)) {
      return choices[index < 0 ? choices.length - 1 : index] || null;
    }
  }
  const tokensOf = (choice) =>
    normalize(`${choice.name || ""} ${choice.username || ""}`).split(" ");
  const spoken = normalize(text).split(" ").filter(Boolean);
  const hits = choices.filter((choice) =>
    tokensOf(choice).some(
      (token) =>
        token.length >= 3 &&
        spoken.includes(token) &&
        choices.filter((other) => tokensOf(other).includes(token)).length === 1,
    ),
  );
  return hits.length === 1 ? hits[0] : null;
};

/** Relationship tags a connection can carry (same list as the Connect app). */
export const RELATIONSHIP_OPTIONS = [
  "Friend", "Best Friend", "Family", "Parent", "Child", "Sibling", "Relative",
  "Partner", "Spouse", "Fiance", "Dating", "Ex-Partner", "Neighbor",
  "Colleague", "Manager", "Mentor", "Mentee", "Classmate", "Teacher", "Student",
  "Business Partner", "Client", "Customer", "Professional Contact",
  "Teammate", "Club Member", "Community Member", "Roommate", "Healthcare Provider",
  "Caregiver", "Emergency Contact",
];

/** Spoken words that mean one of the relationship tags above. */
const RELATIONSHIP_SYNONYMS = {
  Friend: ["friend", "friends", "bondhu", "বন্ধু", "dost"],
  "Best Friend": ["best friend", "bestfriend", "bff", "বেস্ট ফ্রেন্ড", "প্রিয় বন্ধু"],
  Family: ["family", "poribar", "পরিবার"],
  Parent: ["parent", "parents", "mom", "mother", "mum", "ma", "ammu", "amma", "dad", "father", "papa", "abbu", "abba", "baba", "মা", "আম্মু", "বাবা", "আব্বু"],
  Child: ["child", "children", "kid", "son", "daughter", "chele", "meye", "ছেলে", "মেয়ে", "সন্তান"],
  Sibling: ["sibling", "siblings", "brother", "sister", "bhai", "bhaiya", "bon", "apu", "ভাই", "ভাইয়া", "বোন", "আপু"],
  Relative: ["relative", "relatives", "cousin", "uncle", "aunt", "aunty", "mama", "chacha", "khala", "fufu", "nana", "nani", "dada", "dadi", "আত্মীয়"],
  Partner: ["partner", "girlfriend", "boyfriend", "gf", "bf"],
  Spouse: ["spouse", "wife", "husband", "bou", "biwi", "swami", "বউ", "স্ত্রী", "স্বামী"],
  Fiance: ["fiance", "fiancee", "fiancé", "fiancée", "engaged", "বাগদত্তা"],
  "Ex-Partner": ["ex", "ex partner", "ex-partner", "ex girlfriend", "ex boyfriend"],
  Neighbor: ["neighbor", "neighbour", "protibeshi", "প্রতিবেশী"],
  Colleague: ["colleague", "coworker", "co-worker", "office friend", "সহকর্মী"],
  Manager: ["manager", "boss", "বস"],
  Teacher: ["teacher", "sir", "madam", "shikkhok", "শিক্ষক"],
  Student: ["student", "chatro", "ছাত্র", "ছাত্রী"],
  Classmate: ["classmate", "class mate", "সহপাঠী"],
  Roommate: ["roommate", "room mate", "flatmate"],
  "Emergency Contact": ["emergency contact", "emergency"],
};

const normalizeTag = (value) =>
  String(value || "").normalize("NFC").toLowerCase().replace(/[_\s]+/g, " ").trim();

/**
 * Maps spoken relationship words to the app's relationship tags, keeping any
 * custom tag in Title Case. Duplicates removed.
 */
export const normalizeRelationshipTypes = (values) => {
  const list = Array.isArray(values)
    ? values
    : String(values ?? "")
        .split(/,|\band\b|\/|&|\s(?:এবং|ও)\s/)
        .map((item) => item.trim());
  const result = [];
  for (const item of list) {
    const text = normalizeTag(String(item ?? "")).replace(/^(my|a|an|as|amar|আমার)\s+/, "");
    if (!text) continue;
    const option =
      RELATIONSHIP_OPTIONS.find((candidate) => normalizeTag(candidate) === text) ||
      Object.entries(RELATIONSHIP_SYNONYMS).find(([, words]) =>
        words.some((word) => normalizeTag(word) === text),
      )?.[0] ||
      text.replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
    if (!result.some((existing) => normalizeTag(existing) === normalizeTag(option))) {
      result.push(option);
    }
  }
  return result;
};

/**
 * Applies a relationship change. `mode` "add" keeps existing tags, "remove"
 * drops the named ones and "set" (default) replaces them.
 */
export const applyRelationshipChange = (current = [], requested = [], mode = "set") => {
  const same = (a, b) => normalizeTag(a) === normalizeTag(b);
  if (mode === "remove") {
    return current.filter((tag) => !requested.some((item) => same(item, tag)));
  }
  if (mode === "add") {
    return [...current, ...requested.filter((item) => !current.some((tag) => same(item, tag)))];
  }
  return requested;
};
