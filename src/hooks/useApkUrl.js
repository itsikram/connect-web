import { useEffect, useState } from "react";
import axios from "axios";
import { getServerAddress } from "../utils/offlineUtils";

// The Android APK link is set in the admin panel (Settings → General → APK URL)
// and served by the API at /api/connect. One request per page load is shared
// by every component that needs it.
let apkUrlPromise = null;

export const fetchApkUrl = () => {
  if (!apkUrlPromise) {
    apkUrlPromise = axios
      .get(`${getServerAddress()}/api/connect`)
      .then((res) => String(res?.data?.apkUrl || "").trim())
      .catch(() => {
        // Let a later mount try again instead of caching the failure.
        apkUrlPromise = null;
        return "";
      });
  }
  return apkUrlPromise;
};

/**
 * The admin's APK URL, or "" until it has loaded (and when none is set).
 * Starts empty so server-rendered markup and the first client render match.
 */
const useApkUrl = () => {
  const [apkUrl, setApkUrl] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetchApkUrl().then((url) => {
      if (!cancelled) setApkUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return apkUrl;
};

export default useApkUrl;
