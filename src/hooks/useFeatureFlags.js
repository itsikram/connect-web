import { useEffect, useState } from "react";
import api from "../api/api";

// Admin-controlled feature flags from GET /config/flags. Fetched once per page
// load and shared by every component. Until they arrive, features count as on
// (the server's default for the flags read here), so nothing flickers away.
let cachedFlags = null;
let pending = null;
const listeners = new Set();

const fetchFlags = () => {
  if (!pending) {
    pending = api
      .get("/config/flags")
      .then((response) => {
        cachedFlags = response.data?.featureFlags || {};
        listeners.forEach((listener) => listener(cachedFlags));
        return cachedFlags;
      })
      .catch(() => {
        pending = null;
        return cachedFlags || {};
      });
  }
  return pending;
};

/** True unless an admin has switched the flag off. */
export const isFeatureOn = (flags, name) => !name || flags?.[name] !== false;

/** Drops items whose `flag` is switched off. */
export const filterByFeatureFlags = (items, flags) =>
  items.filter((item) => isFeatureOn(flags, item.flag));

export const getFeatureFlags = () => fetchFlags();

const useFeatureFlags = () => {
  const [flags, setFlags] = useState(cachedFlags || {});

  useEffect(() => {
    listeners.add(setFlags);
    if (cachedFlags) setFlags(cachedFlags);
    else fetchFlags();
    return () => listeners.delete(setFlags);
  }, []);

  return flags;
};

export default useFeatureFlags;
