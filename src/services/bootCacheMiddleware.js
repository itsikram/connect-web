import { GET_PROFILE_SUCCESS } from "./constants/profileConsts";
import { LOAD_SETTINGS, SET_MODE_SHARE } from "./constants/settingConsts";
import {
  ADD_NOTIFICATION,
  ADD_NOTIFICATIONS,
  DELETE_NOTIFICATION,
  DELETE_NOTIFICATIONS,
  VIEW_NOTIFICATION,
  VIEW_NOTIFICATIONS,
} from "./constants/notificationConsts";
import { CLEAR_ALL_STATE } from "./constants/authConsts";
import ProfileCacheManager from "../utils/profileCacheManager";
import CacheManager from "../utils/cacheManager";
import { BOOT_SLICES, clearBootCache, writeBootCache } from "../utils/bootCache";

// Keeps the first-screen cache (see utils/bootCache.js) in step with Redux:
// whatever the store ends up holding after these actions is what the next
// app start paints before the server answers.

const NOTIFICATIONS_TO_KEEP = 50;
const WRITE_DELAY_MS = 300;

const SETTINGS_ACTIONS = new Set([LOAD_SETTINGS, SET_MODE_SHARE]);
const NOTIFICATION_ACTIONS = new Set([
  ADD_NOTIFICATION,
  ADD_NOTIFICATIONS,
  DELETE_NOTIFICATION,
  DELETE_NOTIFICATIONS,
  VIEW_NOTIFICATION,
  VIEW_NOTIFICATIONS,
]);

const bootCacheMiddleware = (storeApi) => {
  let notificationTimer = null;

  const cancelPendingWrites = () => {
    if (notificationTimer) {
      clearTimeout(notificationTimer);
      notificationTimer = null;
    }
  };

  return (next) => (action) => {
    const result = next(action);
    const type = action && action.type;

    try {
      if (type === CLEAR_ALL_STATE) {
        // Logout or a different account signing in.
        cancelPendingWrites();
        clearBootCache();
        CacheManager.clearCache();
      } else if (type === GET_PROFILE_SUCCESS) {
        // The merged slice, not just the payload: several callers send a
        // partial profile.
        ProfileCacheManager.setCachedProfile(storeApi.getState().profile);
      } else if (SETTINGS_ACTIONS.has(type)) {
        writeBootCache(BOOT_SLICES.SETTINGS, storeApi.getState().setting);
      } else if (NOTIFICATION_ACTIONS.has(type)) {
        // Notifications can arrive in bursts; write once they settle.
        cancelPendingWrites();
        notificationTimer = setTimeout(() => {
          notificationTimer = null;
          const list = storeApi.getState().notification;
          if (Array.isArray(list)) {
            writeBootCache(
              BOOT_SLICES.NOTIFICATIONS,
              list.slice(0, NOTIFICATIONS_TO_KEEP),
            );
          }
        }, WRITE_DELAY_MS);
      }
    } catch (error) {
      // Caching must never break a state update.
    }

    return result;
  };
};

export default bootCacheMiddleware;
