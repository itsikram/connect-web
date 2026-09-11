/**
 * URL + opener for the iOS Web Clip configuration profile.
 * Must open as a normal Safari navigation (no download= attribute),
 * with Content-Type application/x-apple-aspen-config.
 */
const CANONICAL_WEB_URL = "https://connect-bd.online";

export const getIosProfileUrl = () => {
  if (process.env.NODE_ENV === "production") {
    // Keep profile downloads on the web host. The API host does not serve this
    // route in every deployment, while the canonical web host serves the file.
    return `${CANONICAL_WEB_URL}/connect.mobileconfig`;
  }

  if (typeof window !== "undefined" && window.location.origin) {
    return `${window.location.origin}/connect.mobileconfig`;
  }

  return `${process.env.PUBLIC_URL || ""}/connect.mobileconfig`;
};

/** Open profile so Safari offers Settings → Profile Downloaded */
export const openIosProfile = () => {
  const url = getIosProfileUrl();
  // Same-tab navigation is required on iOS Safari
  window.location.assign(url);
};
