import { backFallbackFor, isTabRoute } from "./mobileTabs";

describe("isTabRoute", () => {
  test.each(["/", "/connects", "/connects/requests", "/watch", "/message", "/menu", "/menu/"])(
    "%s shows the bottom bar",
    (path) => {
      expect(isTabRoute(path)).toBe(true);
    },
  );

  test.each(["/settings", "/notes", "/watch/abc", "/message/someone", "/post/1", "/ludo-game"])(
    "%s gets the back button instead",
    (path) => {
      expect(isTabRoute(path)).toBe(false);
    },
  );
});

describe("backFallbackFor", () => {
  test("pages opened from the Menu go back to the Menu", () => {
    expect(backFallbackFor("/settings/privacy")).toBe("/menu");
    expect(backFallbackFor("/notes")).toBe("/menu");
    expect(backFallbackFor("/wallet")).toBe("/menu");
    expect(backFallbackFor("/downloads/123")).toBe("/menu");
    expect(backFallbackFor("/ludo-game/abc/")).toBe("/menu");
  });

  test("everything else goes home", () => {
    expect(backFallbackFor("/post/123")).toBe("/");
    expect(backFallbackFor("/someuser")).toBe("/");
    // A prefix of a menu route is not that route.
    expect(backFallbackFor("/notesy")).toBe("/");
  });
});
