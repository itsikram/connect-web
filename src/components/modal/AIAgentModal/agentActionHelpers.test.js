import {
  extractYouTubeUrl,
  parseCalendarWhen,
  parseSettingsPatch,
  parseHealthLog,
  stripDatePhrases,
  pickBestYoutubeMatch,
  stripYoutubeSearchNoise,
} from "./agentActionHelpers";
import {
  applyMemoryToIntent,
  rememberUserText,
  loadAgentMemory,
  clearAgentMemory,
  getMemoryPromptBlock,
} from "./agentMemory";

describe("agent action helpers", () => {
  test("extracts youtube urls", () => {
    expect(
      extractYouTubeUrl("please download https://youtu.be/dQw4w9WgXcQ now"),
    ).toContain("youtu.be/dQw4w9WgXcQ");
  });

  test("parses tomorrow and a time", () => {
    const when = parseCalendarWhen("meeting tomorrow at 5pm");
    expect(when.foundDate).toBe(true);
    expect(when.time).toBe("17:00");
    expect(stripDatePhrases("meeting tomorrow at 5pm")).toMatch(/meeting/i);
  });

  test("parses dark mode settings", () => {
    expect(parseSettingsPatch("set dark mode").patch.themeMode).toBe("dark");
    expect(parseSettingsPatch("hide my location").patch.isShareLocation).toBe(
      false,
    );
  });

  test("parses a weight log", () => {
    expect(parseHealthLog("log weight 72 kg")).toMatchObject({
      kind: "weight",
      weight: 72,
    });
  });
});

describe("agent memory", () => {
  const profileId = "test-profile-memory";

  beforeEach(() => {
    localStorage.removeItem(`connect_ai_agent_memory_${profileId}`);
  });

  test("remembers a youtube url from chat and fills download intents", () => {
    rememberUserText(
      profileId,
      "check this https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    );
    expect(loadAgentMemory(profileId).lastYoutubeUrl).toContain("youtube.com");
    const filled = applyMemoryToIntent(
      { action: "DOWNLOAD_YOUTUBE", searchQuery: "that video" },
      profileId,
    );
    expect(filled.searchQuery).toContain("youtube.com");
  });

  test("does not replace a keyword download with the last youtube url", () => {
    rememberUserText(
      profileId,
      "check this https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    );
    const filled = applyMemoryToIntent(
      { action: "DOWNLOAD_YOUTUBE", searchQuery: "despacito" },
      profileId,
    );
    expect(filled.searchQuery).toBe("despacito");
  });

  test("picks the youtube result whose title matches the query", () => {
    const best = pickBestYoutubeMatch(
      [
        { title: "Lo-fi mix 2024", channelTitle: "Various" },
        { title: "Despacito Official Video", channelTitle: "Luis Fonsi" },
        { title: "Summer hits", channelTitle: "VEVO" },
      ],
      "despacito",
    );
    expect(best.title).toMatch(/Despacito/i);
  });

  test("strips download/search filler from youtube keywords", () => {
    expect(stripYoutubeSearchNoise("download youtube despacito")).toBe(
      "despacito",
    );
  });

  test("fills him/her from the last friend", () => {
    rememberUserText(profileId, "invite Atik later");
    const memoryKey = `connect_ai_agent_memory_${profileId}`;
    const current = JSON.parse(localStorage.getItem(memoryKey));
    current.lastFriendName = "Atik";
    localStorage.setItem(memoryKey, JSON.stringify(current));
    const filled = applyMemoryToIntent(
      { action: "INVITE_LUDO", targetName: "him" },
      profileId,
    );
    expect(filled.targetName).toBe("Atik");
  });

  test("clearing memory removes saved facts", () => {
    rememberUserText(
      profileId,
      "check this https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    );
    expect(getMemoryPromptBlock(profileId)?.yt).toContain("youtube.com");
    clearAgentMemory(profileId);
    expect(loadAgentMemory(profileId).lastYoutubeUrl).toBe("");
    expect(getMemoryPromptBlock(profileId)).toBeNull();
  });
});
