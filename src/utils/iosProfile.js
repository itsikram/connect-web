/**
 * URL + opener for the iOS Web Clip configuration profile.
 * Must open as a normal Safari navigation (no download= attribute),
 * with Content-Type application/x-apple-aspen-config.
 */
export const getIosProfileUrl = () => {
  const server = (process.env.REACT_APP_SERVER_ADDR || "").replace(/\/$/, "");
  if (server) {
    return `${server}/api/connect/ios-profile`;
  }
  return `${process.env.PUBLIC_URL || ""}/connect.mobileconfig`;
};

/** Open profile so Safari offers Settings → Profile Downloaded */
export const openIosProfile = () => {
  const url = getIosProfileUrl();
  // Same-tab navigation is required on iOS Safari
  window.location.assign(url);
};
