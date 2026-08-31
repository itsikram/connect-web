import {
  looksLikeBanglish,
  detectAgentLanguage,
  normalizeBanglishChatText,
  normalizeBanglishCommand,
} from "./banglish";

describe("banglish normalization", () => {
  test("detects banglish command words", () => {
    expect(looksLikeBanglish("atik ke bolo kothay")).toBe(true);
    expect(looksLikeBanglish("call Atik now")).toBe(false);
  });

  test("rewrites common banglish commands to english", () => {
    expect(normalizeBanglishCommand("atik ke message pathao tumi kothay")).toBe(
      "send message to atik say tumi kothay",
    );
    expect(normalizeBanglishCommand("atik ke call koro")).toBe("call atik");
    expect(normalizeBanglishCommand("ludo khela shuru koro")).toBe(
      "create ludo game",
    );
    expect(normalizeBanglishCommand("settings e jao")).toBe("go to settings");
  });

  test("recognizes banglish chat questions", () => {
    expect(normalizeBanglishChatText("tumi kothay")).toBe("Where are you?");
    expect(normalizeBanglishChatText("ki khobor")).toBe("How are you?");
    expect(normalizeBanglishChatText("ki korbo")).toBe("What should I do?");
    expect(normalizeBanglishChatText("ami kharap")).toBe("I feel sad");
  });

  test("detects reply language", () => {
    expect(detectAgentLanguage("সেটিংসে যাও")).toBe("bn");
    expect(detectAgentLanguage("ami valo nai")).toBe("banglish");
    expect(detectAgentLanguage("open settings")).toBe("en");
  });
});
