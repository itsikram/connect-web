// Which URLs logged-out visitors get from the lightweight public bundle
// (PublicApp) instead of the full app. Keep RESERVED in sync with the
// top-level routes in pages/Main.js and APP_ROUTES in server.js.
const RESERVED = new Set(
  (
    'menu wallet video-call call youtube expo download-app downloads search login signup ' +
    'forgot-password reset-password story post connects watch message ludo-game chess-game ' +
    'media-player video-player marketplace groups yt-download camera notes tasks timer flashcards calendar ' +
    'habits health rehab settings test-notifications privacy terms about portfolio api static ' +
    'assets privacy-policy terms-of-service face images'
  ).split(' ')
);
const USERNAME_RE = /^[A-Za-z0-9._-]{1,64}$/;

export const isProfileSegment = (segment) =>
  USERNAME_RE.test(segment) && !RESERVED.has(segment.toLowerCase());

export const isPublicPath = (pathname) => {
  const route = pathname.replace(/\/+$/, '') || '/';
  if (route === '/' || route === '/about') return true;
  const m = /^\/([^/]+)$/.exec(route);
  return !!m && isProfileSegment(m[1]);
};

// Same check AuthContext makes on start-up (storageUtils keeps the session
// under "user", in localStorage or sessionStorage as a fallback).
export const hasStoredSession = () => {
  const has = (storage) => {
    try {
      const raw = storage.getItem('user');
      if (!raw || raw === '{}') return false;
      const u = JSON.parse(raw);
      return !!(u && (u.accessToken || u.refreshToken));
    } catch (e) {
      return false;
    }
  };
  try {
    return has(window.localStorage) || has(window.sessionStorage);
  } catch (e) {
    return true; // storage blocked: let the full app decide
  }
};
