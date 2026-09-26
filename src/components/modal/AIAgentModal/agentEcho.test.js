import {
  agentQuietForMs,
  agentSpeechEnded,
  agentSpeechStarted,
  isAgentSpeaking,
  isLikelyAgentEcho,
  resetAgentEcho,
} from "./agentEcho";

describe("agent echo guard", () => {
  beforeEach(() => resetAgentEcho());

  it("drops a transcript that repeats what the agent just said", () => {
    agentSpeechStarted("রহিমকে ভিডিও কল দিচ্ছি, একটু অপেক্ষা করুন।");
    agentSpeechEnded();
    expect(isLikelyAgentEcho("রহিমকে ভিডিও কল দিচ্ছি")).toBe(true);
    agentSpeechStarted("Opening your messages now.");
    agentSpeechEnded();
    expect(isLikelyAgentEcho("opening your messages")).toBe(true);
  });

  it("keeps short answers and genuinely new requests", () => {
    agentSpeechStarted("Should I delete it? Say yes or tap below.");
    agentSpeechEnded();
    expect(isLikelyAgentEcho("yes")).toBe(false);
    expect(isLikelyAgentEcho("হ্যাঁ")).toBe(false);
    agentSpeechStarted("রহিমকে ভিডিও কল দিচ্ছি।");
    agentSpeechEnded();
    expect(isLikelyAgentEcho("করিমকে একটা ভিডিও কল দাও")).toBe(false);
  });

  it("reports silence only after the agent stops talking", () => {
    agentSpeechStarted("hello there friend");
    expect(isAgentSpeaking()).toBe(true);
    expect(agentQuietForMs()).toBe(0);
    agentSpeechEnded();
    expect(isAgentSpeaking()).toBe(false);
    expect(isLikelyAgentEcho("hello there friend", Date.now() + 60000)).toBe(false);
  });
});
