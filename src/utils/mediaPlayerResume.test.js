import {
  MEDIA_PLAYER_RESUME_KEY,
  loadLastPlayback,
  saveLastPlayback,
  findLastPlaybackIndex,
  getResumePosition,
  isSamePlayback,
} from "./mediaPlayerResume";

describe("media player resume", () => {
  beforeEach(() => window.localStorage.clear());

  test("saves and loads the last video with position and duration", () => {
    saveLastPlayback({
      queueId: "q1",
      videoId: "v1",
      url: "https://x.test/a.mp4",
      title: "A",
      position: 42.5,
      duration: 180,
    });
    expect(loadLastPlayback()).toMatchObject({
      queueId: "q1",
      videoId: "v1",
      url: "https://x.test/a.mp4",
      position: 42.5,
      duration: 180,
    });
  });

  test("ignores missing or broken data", () => {
    expect(loadLastPlayback()).toBeNull();
    window.localStorage.setItem(MEDIA_PLAYER_RESUME_KEY, "{not json");
    expect(loadLastPlayback()).toBeNull();
  });

  test("finds the saved video by id, not by an old blob url", () => {
    const list = [
      { queueId: "a", videoId: "a", url: "https://x.test/a.mp4" },
      { queueId: "local-1", videoId: "local-1", url: "blob:new" },
    ];
    expect(
      findLastPlaybackIndex(list, { videoId: "local-1", url: "blob:old" }),
    ).toBe(1);
    expect(findLastPlaybackIndex(list, { url: "blob:new" })).toBe(-1);
    expect(findLastPlaybackIndex(list, { url: "https://x.test/a.mp4" })).toBe(0);
    expect(findLastPlaybackIndex(list, { videoId: "zzz" })).toBe(-1);
  });

  test("matches the same item", () => {
    expect(isSamePlayback({ queueId: "q", url: "u" }, { queueId: "q" })).toBe(true);
    expect(isSamePlayback({ queueId: "q", url: "u" }, { queueId: "r" })).toBe(false);
  });

  test("starts over when the saved spot is at the very end", () => {
    expect(getResumePosition({ position: 30 }, 100)).toBe(30);
    expect(getResumePosition({ position: 99.5 }, 100)).toBe(0);
    expect(getResumePosition({ position: 0.4 }, 100)).toBe(0);
    expect(getResumePosition({ position: 30, duration: 31 })).toBe(0);
  });
});
