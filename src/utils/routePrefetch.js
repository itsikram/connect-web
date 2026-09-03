const routeLoaders = [
  { matches: (path) => path === "/menu" || path === "/menu/", load: () => import("../pages/Menu") },
  { matches: (path) => path === "/friends" || path.startsWith("/friends/"), load: () => import("../pages/Friends") },
  { matches: (path) => path === "/watch" || path.startsWith("/watch/"), load: () => import("../pages/Video.js") },
  { matches: (path) => path === "/message" || path.startsWith("/message/"), load: () => import("../pages/Message") },
  { matches: (path) => path === "/settings" || path.startsWith("/settings/"), load: () => import("../pages/Settings") },
  { matches: (path) => path === "/portfolio" || path.startsWith("/portfolio/"), load: () => import("../pages/portfolio/PortfolioContainer.js") },
  { matches: (path) => path === "/downloads" || path.startsWith("/downloads/"), load: () => import("../pages/SavedVideos.js") },
  { matches: (path) => path === "/camera", load: () => import("../pages/Camera.js") },
  { matches: (path) => path === "/ludo-game", load: () => import("../pages/ludo") },
  { matches: (path) => path === "/chess-game", load: () => import("../pages/ChessGame") },
  { matches: (path) => path === "/notes", load: () => import("../pages/Notes.js") },
  { matches: (path) => path === "/tasks", load: () => import("../pages/Tasks.js") },
  { matches: (path) => path === "/timer", load: () => import("../pages/FocusTimer.js") },
  { matches: (path) => path === "/flashcards", load: () => import("../pages/Flashcards.js") },
  { matches: (path) => path === "/calendar", load: () => import("../pages/Calendar.js") },
  { matches: (path) => path === "/habits", load: () => import("../pages/Habits.js") },
  { matches: (path) => path === "/health", load: () => import("../pages/Health.js") },
  { matches: (path) => path === "/rehab", load: () => import("../pages/Rehab.js") },
];

const prefetchedRoutes = new Set();

export const prefetchRoute = (href) => {
  if (!href || typeof window === "undefined") return;

  let pathname;
  try {
    pathname = new URL(href, window.location.origin).pathname;
  } catch (_error) {
    return;
  }

  const route = routeLoaders.find(({ matches }) => matches(pathname));
  if (!route || prefetchedRoutes.has(route.load)) return;

  prefetchedRoutes.add(route.load);
  route.load().catch(() => {
    // A failed prefetch must not interfere with normal navigation.
    prefetchedRoutes.delete(route.load);
  });
};

export const prefetchNavigationTarget = (event) => {
  const anchor = event.target?.closest?.("a[href]");
  if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
  prefetchRoute(anchor.href);
};
