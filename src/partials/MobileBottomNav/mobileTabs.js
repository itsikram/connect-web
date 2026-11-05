import { MENU_APPS } from "../../constants/menuApps";

// Same tabs as the Connect mobile app's bottom bar. `say`/`sayBn` are what
// "hold to hear" reads out (see utils/voiceHelp.js).
export const MOBILE_TABS = [
  {
    to: "/",
    label: "Home",
    icon: "fa-home-alt",
    end: true,
    say: "Home. Posts from your friends.",
    sayBn: "হোম। বন্ধুদের পোস্ট।",
  },
  {
    to: "/connects",
    label: "Connects",
    icon: "fa-user-friends",
    say: "Connects. Your friends.",
    sayBn: "কানেক্টস। আপনার বন্ধুরা।",
  },
  {
    to: "/watch",
    label: "Videos",
    icon: "fa-play-circle",
    end: true,
    say: "Videos. Watch videos.",
    sayBn: "ভিডিও। ভিডিও দেখুন।",
  },
  {
    to: "/message",
    label: "Message",
    icon: "fa-comment-dots",
    end: true,
    badge: "messages",
    say: "Messages. Chat with people.",
    sayBn: "মেসেজ। মানুষের সাথে কথা বলুন।",
  },
  {
    to: "/menu",
    label: "Menu",
    icon: "fa-bars",
    say: "Menu. All apps and settings.",
    sayBn: "মেনু। সব অ্যাপ আর সেটিংস।",
  },
];

const normalize = (pathname) => String(pathname || "/").replace(/\/+$/, "") || "/";

// Only the top-level browsing screens get the bar; chats, games, calls and
// editors keep the full screen (like the app hides it in a chat thread).
export const isTabRoute = (pathname) => {
  const path = normalize(pathname);
  return (
    path === "/" ||
    path === "/connects" ||
    path.startsWith("/connects/") ||
    path === "/watch" ||
    path === "/message" ||
    path === "/menu"
  );
};

// Pages opened from the Menu go back to it when there is no history to
// return to (a page opened from a link or straight after launch).
const MENU_PAGE_ROOTS = [
  ...MENU_APPS.map((app) => app.href),
  "/wallet",
  "/download-app",
  "/downloads",
  "/marketplace",
];

export const backFallbackFor = (pathname) => {
  const path = normalize(pathname);
  const fromMenu = MENU_PAGE_ROOTS.some(
    (root) => root && (path === root || path.startsWith(`${root}/`)),
  );
  return fromMenu ? "/menu" : "/";
};
