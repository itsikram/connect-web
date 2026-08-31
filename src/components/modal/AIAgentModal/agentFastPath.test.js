import {
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
    expect(looksLikePersonalChat("আমি খারাপ লাগছে")).toBe(true);
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
});
