import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import api from "../api/api";
import { loadSettings } from "../services/actions/settingsActions";
import {
  DEFAULT_FRIEND_CHAT_SETTINGS,
  getChatTheme,
  normalizeFriendChatSettings,
  resolveChatWallpaper,
} from "../utils/chatThemes";
import defaultChatBackground from "../assets/images/default-chat-bg.svg";
import {
  FRIEND_CHAT_SETTINGS_EVENT,
  getFriendChatSettings,
  mergeServerFriendChatMap,
  readFriendChatSettingsMap,
  setFriendChatSettingsLocal,
} from "../utils/friendChatSettings";

const useFriendChatSettings = (friendId) => {
  const dispatch = useDispatch();
  const userId = useSelector((state) => state.profile?._id);
  const globalSettings = useSelector((state) => state.setting);
  const persistTimer = useRef(null);

  const [settings, setSettings] = useState(() =>
    getFriendChatSettings(userId, friendId, globalSettings?.friendChatSettings),
  );

  useEffect(() => {
    if (!userId || !friendId) {
      setSettings({ ...DEFAULT_FRIEND_CHAT_SETTINGS });
      return;
    }
    setSettings(
      getFriendChatSettings(userId, friendId, globalSettings?.friendChatSettings),
    );
  }, [userId, friendId, globalSettings?.friendChatSettings]);

  useEffect(() => {
    if (!userId || !globalSettings?.friendChatSettings) return;
    mergeServerFriendChatMap(userId, globalSettings.friendChatSettings);
  }, [userId, globalSettings?.friendChatSettings]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const handleUpdate = (event) => {
      const detail = event.detail || {};
      if (
        String(detail.userId) !== String(userId) ||
        String(detail.friendId) !== String(friendId)
      ) {
        return;
      }
      setSettings(normalizeFriendChatSettings(detail.settings));
    };

    window.addEventListener(FRIEND_CHAT_SETTINGS_EVENT, handleUpdate);
    return () =>
      window.removeEventListener(FRIEND_CHAT_SETTINGS_EVENT, handleUpdate);
  }, [userId, friendId]);

  const persistToServer = useCallback(
    (next) => {
      if (!userId || !friendId) return;
      if (persistTimer.current) window.clearTimeout(persistTimer.current);
      persistTimer.current = window.setTimeout(async () => {
        try {
          const serverMap =
            globalSettings?.friendChatSettings &&
            typeof globalSettings.friendChatSettings === "object"
              ? globalSettings.friendChatSettings
              : {};
          const localMap = readFriendChatSettingsMap(userId);
          const merged = { ...serverMap, ...localMap, [friendId]: next };
          const res = await api.post("setting/update", {
            friendChatSettings: merged,
          });
          if (res.status === 200) {
            dispatch(loadSettings(res.data));
          }
        } catch (error) {
          console.error("Failed to persist chat appearance:", error);
        }
      }, 280);
    },
    [userId, friendId, dispatch, globalSettings?.friendChatSettings],
  );

  useEffect(
    () => () => {
      if (persistTimer.current) window.clearTimeout(persistTimer.current);
    },
    [],
  );

  const updateSettings = useCallback(
    (patch) => {
      const next = normalizeFriendChatSettings({ ...settings, ...patch });
      setSettings(next);
      setFriendChatSettingsLocal(userId, friendId, next);
      persistToServer(next);
      return next;
    },
    [userId, friendId, settings, persistToServer],
  );

  const resetSettings = useCallback(() => {
    return updateSettings({ ...DEFAULT_FRIEND_CHAT_SETTINGS });
  }, [updateSettings]);

  const theme = useMemo(() => getChatTheme(settings.themeId), [settings.themeId]);

  const wallpaper = useMemo(
    () =>
      resolveChatWallpaper(
        settings,
        theme,
        globalSettings?.chatBackground,
        defaultChatBackground,
      ),
    [settings, theme, globalSettings?.chatBackground],
  );

  return {
    settings,
    theme,
    wallpaper,
    updateSettings,
    resetSettings,
    globalBackground: globalSettings?.chatBackground || null,
    globalActionEmoji: globalSettings?.actionEmoji || DEFAULT_FRIEND_CHAT_SETTINGS.actionEmoji,
  };
};

export default useFriendChatSettings;
