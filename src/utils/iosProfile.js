/**
 * URL + opener for the iOS Web Clip configuration profile.
 * Must open as a normal Safari navigation (no download= attribute),
 * with Content-Type application/x-apple-aspen-config.
 */
import { getServerAddress } from "./offlineUtils";

export const getIosProfileUrl = () => {
  if (process.env.NODE_ENV === "production") {
    // The API endpoint sets Apple's required profile MIME type.
    // Use the same server the app talks to (REACT_APP_SERVER_ADDR).
    const serverAddr = String(getServerAddress() || "").replace(/\/+$/, "");
    return `${serverAddr}/api/connect/ios-profile`;
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
