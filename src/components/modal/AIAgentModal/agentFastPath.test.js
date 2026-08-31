import {
  getInstantAgentReply,
  looksLikeAppCommand,
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

  test("rewrites bangla script commands to english", () => {
    expect(normalizeBanglaCommand("আতিককে কল করো")).toBe("call আতিক");
    expect(normalizeBanglaCommand("সেটিংসে যাও")).toBe("go to settings");
    expect(normalizeBanglaCommand("লুডো খেলা শুরু করো")).toBe("create ludo game");
  });
});
