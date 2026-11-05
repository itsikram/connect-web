// Start-up cache: the store paints the signed-in account's last known profile,
// settings and notifications, and none of it may reach another account.

// requestCache talks to the server through api.js (axios); these tests only
// exercise its storage rules.
jest.mock("../api/api", () => ({ __esModule: true, default: { get: jest.fn() } }));
jest.mock("./presence", () => ({ getPresence: () => null }));

const A = "aaaaaaaaaaaaaaaaaaaaaaaa";
const B = "bbbbbbbbbbbbbbbbbbbbbbbb";
const DAY = 24 * 60 * 60 * 1000;

const signIn = (profileId) =>
  localStorage.setItem(
    "user",
    JSON.stringify({ accessToken: `token-${profileId}`, profile: profileId }),
  );

const bootEntry = (owner, data, savedAt = Date.now()) =>
  JSON.stringify({ owner, savedAt, data });

// Each test gets fresh modules so reducers re-read the cache like a page load.
const load = (path) => {
  let mod;
  jest.isolateModules(() => {
    mod = require(path);
  });
  return mod;
};

beforeEach(() => {
  localStorage.clear();
  jest.useRealTimers();
  document.documentElement.removeAttribute("data-theme");
});

describe("bootCache", () => {
  test("hands data back only to the account that saved it", () => {
    signIn(A);
    const cache = load("./bootCache");
    expect(cache.writeBootCache("settings", { themeMode: "light" })).toBe(true);
    expect(cache.readBootCache("settings")).toEqual({ themeMode: "light" });

    signIn(B);
    expect(cache.readBootCache("settings")).toBeNull();

    localStorage.removeItem("user");
    expect(cache.readBootCache("settings")).toBeNull();
    expect(cache.writeBootCache("settings", { themeMode: "dark" })).toBe(false);
  });

  test("ignores entries past their max age and corrupt entries", () => {
    signIn(A);
    const cache = load("./bootCache");
    localStorage.setItem(
      "connect.boot.v1:settings",
      bootEntry(A, { themeMode: "light" }, Date.now() - 30 * DAY),
    );
    expect(cache.readBootCache("settings")).toBeNull();
    localStorage.setItem("connect.boot.v1:settings", "{not json");
    expect(cache.readBootCache("settings")).toBeNull();
  });

  test("clearBootCache removes every slice and nothing else", () => {
    signIn(A);
    const cache = load("./bootCache");
    cache.writeBootCache("profile", { _id: A });
    cache.writeBootCache("settings", {});
    localStorage.setItem("connect.motionPermission", "granted");
    cache.clearBootCache();
    expect(localStorage.getItem("connect.boot.v1:profile")).toBeNull();
    expect(localStorage.getItem("connect.boot.v1:settings")).toBeNull();
    expect(localStorage.getItem("connect.motionPermission")).toBe("granted");
    expect(localStorage.getItem("user")).not.toBeNull();
  });
});

describe("ProfileCacheManager", () => {
  test("stores only the signed-in account's own profile", () => {
    signIn(A);
    const { default: ProfileCacheManager } = load("./profileCacheManager");
    expect(ProfileCacheManager.setCachedProfile({ _id: B, fullName: "B" })).toBe(false);
    expect(
      ProfileCacheManager.setCachedProfile({ _id: A, fullName: "A", isLoading: true, error: "x" }),
    ).toBe(true);
    expect(ProfileCacheManager.getCachedProfile()).toEqual({ _id: A, fullName: "A" });
    expect(ProfileCacheManager.getCachedProfile(B)).toBeNull();
  });

  test("drops the old unscoped cache keys", () => {
    localStorage.setItem("cachedProfileData", JSON.stringify({ _id: B }));
    localStorage.setItem("cachedProfileDataTimestamp", String(Date.now()));
    signIn(A);
    const { default: ProfileCacheManager } = load("./profileCacheManager");
    expect(localStorage.getItem("cachedProfileData")).toBeNull();
    expect(ProfileCacheManager.getCachedProfile()).toBeNull();
  });
});

describe("store start-up", () => {
  const seedAccountA = () => {
    localStorage.setItem("connect.boot.v1:profile", bootEntry(A, { _id: A, fullName: "Ann" }));
    localStorage.setItem(
      "connect.boot.v1:settings",
      bootEntry(A, { themeMode: "light", ringtone: 3 }),
    );
    localStorage.setItem(
      "connect.boot.v1:notifications",
      bootEntry(A, [{ _id: "n1", isSeen: false }, { noId: true }]),
    );
  };

  test("starts with the signed-in account's cached data and theme", () => {
    signIn(A);
    seedAccountA();
    const { default: store } = load("../store");
    const state = store.getState();
    expect(state.profile).toMatchObject({ _id: A, fullName: "Ann", error: null });
    expect(state.setting).toMatchObject({ themeMode: "light", ringtone: 3, showIsTyping: true });
    expect(state.notification).toEqual([{ _id: "n1", isSeen: false }]);
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  test("starts empty when the cache belongs to another account", () => {
    signIn(B);
    seedAccountA();
    const { default: store } = load("../store");
    const state = store.getState();
    expect(state.profile._id).toBeUndefined();
    expect(state.setting.themeMode).toBe("dark");
    expect(state.notification).toEqual([]);
    expect(document.documentElement.getAttribute("data-theme")).toBeNull();
  });

  test("keeps the cache in step with the store and clears it on logout", () => {
    jest.useFakeTimers();
    signIn(A);
    const { default: store } = load("../store");
    const { getProfileSuccess } = load("../services/actions/profileActions");
    const { loadSettings } = load("../services/actions/settingsActions");
    const { addNotifications } = load("../services/actions/notificationActions");
    const { clearAllState } = load("../services/actions/authActions");
    const read = (slice) => JSON.parse(localStorage.getItem(`connect.boot.v1:${slice}`))?.data;

    store.dispatch(getProfileSuccess({ _id: A, fullName: "Ann", bio: "hi" }));
    // A partial update: the cache holds the merged profile.
    store.dispatch(getProfileSuccess({ profilePic: "p.jpg" }));
    expect(read("profile")).toEqual({ _id: A, fullName: "Ann", bio: "hi", profilePic: "p.jpg" });

    store.dispatch(loadSettings({ themeMode: "light" }));
    expect(read("settings")).toMatchObject({ themeMode: "light", ringtone: 1 });

    store.dispatch(addNotifications([{ _id: "n1" }, { _id: "n2" }], true));
    expect(localStorage.getItem("connect.boot.v1:notifications")).toBeNull();
    jest.advanceTimersByTime(400);
    expect(read("notifications")).toEqual([{ _id: "n1" }, { _id: "n2" }]);

    localStorage.setItem("cached_home_posts", "[]");
    store.dispatch(addNotifications([{ _id: "n3" }]));
    store.dispatch(clearAllState());
    jest.advanceTimersByTime(400); // the pending notification write is dropped
    ["profile", "settings", "notifications"].forEach((slice) =>
      expect(localStorage.getItem(`connect.boot.v1:${slice}`)).toBeNull(),
    );
    expect(localStorage.getItem("cached_home_posts")).toBeNull();
    // Reset to empty defaults, not back to the cached start-up data.
    expect(store.getState().notification).toEqual([]);
    expect(store.getState().setting.themeMode).toBe("dark");
    expect(store.getState().profile).toEqual({ isLoggedIn: {}, error: null });
  });

  test("a different account's profile replaces the old one outright", () => {
    signIn(A);
    localStorage.setItem(
      "connect.boot.v1:profile",
      bootEntry(A, { _id: A, fullName: "Ann", bio: "A's bio" }),
    );
    const { default: store } = load("../store");
    const { getProfileSuccess } = load("../services/actions/profileActions");
    signIn(B);
    store.dispatch(getProfileSuccess({ _id: B, fullName: "Ben" }));
    expect(store.getState().profile.bio).toBeUndefined();
    expect(store.getState().profile.fullName).toBe("Ben");
    expect(JSON.parse(localStorage.getItem("connect.boot.v1:profile")).owner).toBe(B);
  });
});

describe("home feed cache", () => {
  test("is only read back by the account that saved it", () => {
    signIn(A);
    const { default: CacheManager } = load("./cacheManager");
    CacheManager.setCachedPosts([{ _id: "p1" }]);
    expect(CacheManager.getCachedPosts()).toEqual([{ _id: "p1" }]);
    signIn(B);
    expect(CacheManager.getCachedPosts()).toBeNull();
    // B's own write takes the cache over.
    CacheManager.prependCachedPost({ _id: "p2" });
    expect(CacheManager.getCachedPosts()).toEqual([{ _id: "p2" }]);
  });
});

describe("requestCache stale entries", () => {
  const store = (key, data, age) =>
    localStorage.setItem(key, JSON.stringify({ timestamp: Date.now() - age, data }));

  test("peek returns a stale copy that a fresh read refuses, without deleting it", async () => {
    const { peekCachedResource, fetchChatListCached } = load("./requestCache");
    store(`chatList:${A}`, [{ _id: "c1" }], 10 * 60 * 1000);
    expect(peekCachedResource(`chatList:${A}`, DAY)).toEqual([{ _id: "c1" }]);
    expect(peekCachedResource(`chatList:${A}`, 60 * 1000)).toBeNull();
    expect(localStorage.getItem(`chatList:${A}`)).not.toBeNull();
    // Missing profile id never fetches.
    await expect(fetchChatListCached("")).resolves.toEqual([]);
  });

  test("entries older than a week are removed", () => {
    const { peekCachedResource } = load("./requestCache");
    store(`homeStories:${A}`, [{ _id: "s1" }], 8 * DAY);
    expect(peekCachedResource(`homeStories:${A}`)).toBeNull();
    expect(localStorage.getItem(`homeStories:${A}`)).toBeNull();
  });
});
