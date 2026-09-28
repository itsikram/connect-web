// Builds profile URLs like "/programmerikram" when a profile has a username,
// falling back to "/<profileId>" otherwise.

// Top-level app routes. A username matching one of these would be shadowed by
// the static route, so such profiles keep using their id in the URL.
const RESERVED_PROFILE_SLUGS = new Set([
  "about", "account", "admin", "api", "assets", "blogs", "cache", "calendar",
  "call", "camera", "chess-game", "comments", "connects", "contact",
  "downloads", "expo", "face", "fitness", "flashcards", "forgot-password",
  "groups", "habits", "health", "home", "images", "login", "logout",
  "ludo-game", "marketplace", "menu", "message", "notes", "notification",
  "notifications", "places", "portfolio", "post", "preference", "privacy",
  "profile", "reacts", "rehab", "requests", "reset-password", "resume",
  "search", "sent", "settings", "signup", "sound", "static", "story",
  "suggestions", "tasks", "test-notifications", "timer", "video-call",
  "video-player", "videos", "wallet", "watch", "youtube", "yt-download",
]);

export const isUsableProfileUsername = (username) => {
  const value = String(username || "").trim();
  if (!value || value.includes("/")) return false;
  return !RESERVED_PROFILE_SLUGS.has(value.toLowerCase());
};

/**
 * Returns the URL segment for a profile: its username when usable, else its id.
 * Accepts a profile object, or a plain id string (optionally with a username).
 */
export const getProfileSlug = (profile, username) => {
  if (!profile && !username) return "";
  if (typeof profile === "string" || typeof profile === "number") {
    return isUsableProfileUsername(username) ? String(username).trim() : String(profile);
  }
  const name = username ?? profile?.username;
  if (isUsableProfileUsername(name)) return String(name).trim();
  return String(profile?._id || profile?.id || profile?.profile || "");
};

/**
 * getProfilePath(profile)            -> "/programmerikram/"
 * getProfilePath(profile, "connects") -> "/programmerikram/connects"
 */
export const getProfilePath = (profile, subPath = "", username) => {
  const slug = getProfileSlug(profile, username);
  if (!slug) return "/";
  const cleanSub = String(subPath || "").replace(/^\/+/, "");
  return cleanSub ? `/${encodeURIComponent(slug)}/${cleanSub}` : `/${encodeURIComponent(slug)}/`;
};

export default getProfilePath;
