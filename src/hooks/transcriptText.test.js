import {
  collapseRepeatedTranscript,
  mergeTranscriptChunk,
  normalizeTranscript,
} from "./transcriptText";

describe("transcript merge", () => {
  test("drops an exact repeated sentence", () => {
    expect(mergeTranscriptChunk("open settings", "open settings")).toBe(
      "open settings",
    );
    expect(
      collapseRepeatedTranscript("open settings open settings"),
    ).toBe("open settings");
  });

  test("does not prepend a combined transcript that already includes the base", () => {
    expect(
      mergeTranscriptChunk("hello", "hello how are you"),
    ).toBe("hello how are you");
    expect(
      mergeTranscriptChunk("সেটিংসে যাও", "সেটিংসে যাও"),
    ).toBe("সেটিংসে যাও");
  });

  test("merges overlapping tails instead of duplicating words", () => {
    expect(mergeTranscriptChunk("go to", "to settings")).toBe("go to settings");
    expect(normalizeTranscript("  open   settings  ")).toBe("open settings");
  });
});
