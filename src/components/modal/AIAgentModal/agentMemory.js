import { extractYouTubeUrl, isVagueYoutubeRef } from "./agentActionHelpers";

const memoryKey = (profileId) =>
  `connect_ai_agent_memory_${profileId || "anon"}`;

const emptyMemory = () => ({
  updatedAt: null,
  lastUserText: "",
  lastAgentText: "",
  lastAction: "",
  lastFriendName: "",
  lastYoutubeUrl: "",
  lastCaption: "",
  lastNote: null,
  lastTask: null,
  lastEvent: null,
  lastPost: null,
  lastHabit: null,
  lastVideoUrl: "",
  facts: [],
});

export const loadAgentMemory = (profileId) => {
  try {
    const parsed = JSON.parse(localStorage.getItem(memoryKey(profileId)) || "null");
    if (!parsed || typeof parsed !== "object") return emptyMemory();
    return { ...emptyMemory(), ...parsed };
  } catch (_) {
    return emptyMemory();
  }
};

export const saveAgentMemory = (profileId, memory) => {
  try {
    localStorage.setItem(
      memoryKey(profileId),
      JSON.stringify({ ...emptyMemory(), ...memory, updatedAt: new Date().toISOString() }),
    );
  } catch (_) {
    /* ignore quota */
  }
};

const pushFact = (memory, fact) => {
  const text = String(fact || "").trim();
  if (!text) return;
  const facts = [text, ...(memory.facts || []).filter((item) => item !== text)];
  memory.facts = facts.slice(0, 16);
};

export const rememberUserText = (profileId, text) => {
  const memory = loadAgentMemory(profileId);
  const value = String(text || "").trim();
  memory.lastUserText = value.slice(0, 500);
  const youtube = extractYouTubeUrl(value, memory.lastYoutubeUrl);
  if (youtube) memory.lastYoutubeUrl = youtube;
  saveAgentMemory(profileId, memory);
  return memory;
};

export const rememberActionResult = (
  profileId,
  { action, friendName, result, userText } = {},
) => {
  const memory = loadAgentMemory(profileId);
  if (action) memory.lastAction = action;
  if (friendName) memory.lastFriendName = friendName;
  if (userText) memory.lastUserText = String(userText).slice(0, 500);
  if (result?.message) memory.lastAgentText = String(result.message).slice(0, 500);
  if (result?.memory && typeof result.memory === "object") {
    Object.assign(memory, result.memory);
  }
  const youtube = extractYouTubeUrl(
    userText,
    result?.memory?.lastYoutubeUrl,
    memory.lastYoutubeUrl,
  );
  if (youtube) memory.lastYoutubeUrl = youtube;
  if (action && result?.success) {
    pushFact(memory, `${action}${friendName ? ` with ${friendName}` : ""}`);
  }
  saveAgentMemory(profileId, memory);
  return memory;
};

export const getMemoryPromptBlock = (profileId) => {
  const memory = loadAgentMemory(profileId);
  const compact = {};
  const assign = (key, value) => {
    if (value == null || value === "") return;
    if (Array.isArray(value) && value.length === 0) return;
    compact[key] = value;
  };
  assign("friend", memory.lastFriendName);
  assign("yt", memory.lastYoutubeUrl);
  assign("caption", memory.lastCaption);
  assign("note", memory.lastNote);
  assign("task", memory.lastTask);
  assign("event", memory.lastEvent);
  assign("post", memory.lastPost);
  assign("habit", memory.lastHabit);
  assign("video", memory.lastVideoUrl);
  assign("action", memory.lastAction);
  assign(
    "lastUser",
    String(memory.lastUserText || "").trim().slice(0, 160) || undefined,
  );
  assign(
    "lastAgent",
    String(memory.lastAgentText || "").trim().slice(0, 160) || undefined,
  );
  assign("facts", (memory.facts || []).slice(0, 8));
  return Object.keys(compact).length ? compact : null;
};

const isPronounName = (value) =>
  /^(him|her|them|that|it|this|the same|same person|the friend)$/i.test(
    String(value || "").trim(),
  );

export const applyMemoryToIntent = (intent, profileId) => {
  if (!intent?.action) return intent;
  const memory = loadAgentMemory(profileId);
  const next = { ...intent };

  if ((!next.targetName || isPronounName(next.targetName)) && memory.lastFriendName) {
    next.targetName = memory.lastFriendName;
  }

  if (
    (next.action === "DOWNLOAD_YOUTUBE" || next.action === "OPEN_VIDEO_PLAYER") &&
    !extractYouTubeUrl(next.searchQuery, next.label, next.messageText) &&
    isVagueYoutubeRef(next.searchQuery) &&
    isVagueYoutubeRef(next.label) &&
    isVagueYoutubeRef(next.messageText) &&
    (memory.lastYoutubeUrl || memory.lastVideoUrl)
  ) {
    next.searchQuery = memory.lastYoutubeUrl || memory.lastVideoUrl;
  }

  if (
    ["EDIT_NOTE", "DELETE_NOTE"].includes(next.action) &&
    !String(next.searchQuery || "").trim() &&
    memory.lastNote?.title
  ) {
    next.searchQuery = memory.lastNote.title;
  }

  if (
    ["EDIT_TASK", "DELETE_TASK"].includes(next.action) &&
    !String(next.searchQuery || "").trim() &&
    memory.lastTask?.text
  ) {
    next.searchQuery = memory.lastTask.text;
  }

  if (
    ["EDIT_EVENT", "DELETE_EVENT"].includes(next.action) &&
    !String(next.searchQuery || "").trim() &&
    memory.lastEvent?.title
  ) {
    next.searchQuery = memory.lastEvent.title;
  }

  if (
    next.action === "DELETE_POST" &&
    !String(next.searchQuery || "").trim() &&
    memory.lastCaption
  ) {
    next.searchQuery = memory.lastCaption;
  }

  return next;
};

export const clearAgentMemory = (profileId) => {
  try {
    localStorage.removeItem(memoryKey(profileId));
  } catch (_) {
    /* ignore */
  }
};
