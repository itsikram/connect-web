import {
  describeUpcomingAction,
  getInstantAgentReply,
  isVoiceFiller,
  looksLikeAppCommand,
  looksLikeConnectCommand,
  looksLikePersonalChat,
  normalizeBanglaCommand,
} from "./agentFastPath";

describe("agent fast path", () => {
  test("answers greetings instantly in english, banglish, and bangla", () => {
    expect(getInstantAgentReply("hi")).toMatch(/hi/i);
    expect(getInstantAgentReply("how are you")).toMatch(/well/i);
    expect(getInstantAgentReply("kemon acho")).toMatch(/bhalo/i);
    expect(getInstantAgentReply("tumi kemon acho")).toMatch(/bhalo/i);
    expect(getInstantAgentReply("কেমন আছো")).toMatch(/ভালো/);
    expect(getInstantAgentReply("invite atik to ludo")).toBeNull();
  });

  test("detects app commands across languages", () => {
    expect(looksLikeAppCommand("open settings")).toBe(true);
    expect(looksLikeAppCommand("atik ke call koro")).toBe(true);
    expect(looksLikeAppCommand("সেটিংসে যাও")).toBe(true);
    expect(looksLikeAppCommand("kemon acho")).toBe(false);
    expect(looksLikeAppCommand("কেমন আছো")).toBe(false);
  });

  test("routes personal chat away from app commands", () => {
    expect(looksLikePersonalChat("I feel sad today")).toBe(true);
    expect(looksLikePersonalChat("what should I do about my job")).toBe(true);
    expect(looksLikePersonalChat("tell me a joke")).toBe(true);
    expect(looksLikePersonalChat("ami kharap lagche")).toBe(true);
    expect(looksLikePersonalChat("ki korbo")).toBe(true);
    expect(looksLikePersonalChat("invite atik to ludo")).toBe(false);
    expect(looksLikeConnectCommand("open settings")).toBe(true);
    expect(looksLikeConnectCommand("call John")).toBe(true);
    expect(looksLikeConnectCommand("find a chicken recipe")).toBe(false);
    expect(looksLikeConnectCommand("how do I handle stress")).toBe(false);
    expect(isVoiceFiller("um")).toBe(true);
    expect(isVoiceFiller("open settings")).toBe(false);
  });

  test("rewrites bangla script commands to english", () => {
    expect(normalizeBanglaCommand("আতিককে কল করো")).toBe("call আতিক");
    expect(normalizeBanglaCommand("সেটিংসে যাও")).toBe("go to settings");
    expect(normalizeBanglaCommand("লুডো খেলা শুরু করো")).toBe("create ludo game");
  });

  test("describes upcoming actions in the user's language", () => {
    expect(
      describeUpcomingAction(
        { action: "NAVIGATE", label: "Settings" },
        { lang: "en" },
      ),
    ).toMatch(/Opening Settings/i);
    expect(
      describeUpcomingAction(
        { action: "AUDIO_CALL", targetName: "Atik" },
        { friendName: "Atik", lang: "bn" },
      ),
    ).toMatch(/কল/);
    expect(
      describeUpcomingAction(
        { action: "CREATE_LUDO" },
        { lang: "banglish" },
      ),
    ).toMatch(/Ludo/i);
    expect(
      describeUpcomingAction(
        { action: "PLAY_VIDEO", searchQuery: "music" },
        { lang: "en" },
      ),
    ).toMatch(/Playing music/i);
    expect(
      describeUpcomingAction(
        { action: "SEARCH_YOUTUBE", searchQuery: "lo-fi" },
        { lang: "en" },
      ),
    ).toMatch(/Searching.*lo-fi/i);
  });
});
