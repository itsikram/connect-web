import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import api from "../api/api";
import { loadSettings } from "../services/actions/settingsActions";
import {
  DEFAULT_CONNECT_CHAT_SETTINGS,
  getChatTheme,
  normalizeConnectChatSettings,
  resolveChatWallpaper,
} from "../utils/chatThemes";
import defaultChatBackground from "../assets/images/default-chat-bg.svg";
import {
  CONNECT_CHAT_SETTINGS_EVENT,
  getConnectChatSettings,
  mergeServerConnectChatMap,
  readConnectChatSettingsMap,
  setConnectChatSettingsLocal,
} from "../utils/connectChatSettings";

const useConnectChatSettings = (connectId) => {
  const dispatch = useDispatch();
  const userId = useSelector((state) => state.profile?._id);
  const globalSettings = useSelector((state) => state.setting);
  const persistTimer = useRef(null);

  const [settings, setSettings] = useState(() =>
    getConnectChatSettings(userId, connectId, globalSettings?.connectChatSettings),
  );

  useEffect(() => {
    if (!userId || !connectId) {
      setSettings({ ...DEFAULT_CONNECT_CHAT_SETTINGS });
      return;
    }
    setSettings(
      getConnectChatSettings(userId, connectId, globalSettings?.connectChatSettings),
    );
  }, [userId, connectId, globalSettings?.connectChatSettings]);

  useEffect(() => {
    if (!userId || !globalSettings?.connectChatSettings) return;
    mergeServerConnectChatMap(userId, globalSettings.connectChatSettings);
  }, [userId, globalSettings?.connectChatSettings]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const handleUpdate = (event) => {
      const detail = event.detail || {};
      if (
        String(detail.userId) !== String(userId) ||
        String(detail.connectId) !== String(connectId)
      ) {
        return;
      }
      setSettings(normalizeConnectChatSettings(detail.settings));
    };

    window.addEventListener(CONNECT_CHAT_SETTINGS_EVENT, handleUpdate);
    return () =>
      window.removeEventListener(CONNECT_CHAT_SETTINGS_EVENT, handleUpdate);
  }, [userId, connectId]);

  const persistToServer = useCallback(
    (next) => {
      if (!userId || !connectId) return;
      if (persistTimer.current) window.clearTimeout(persistTimer.current);
      persistTimer.current = window.setTimeout(async () => {
        try {
          const serverMap =
            globalSettings?.connectChatSettings &&
            typeof globalSettings.connectChatSettings === "object"
              ? globalSettings.connectChatSettings
              : {};
          const localMap = readConnectChatSettingsMap(userId);
          const merged = { ...serverMap, ...localMap, [connectId]: next };
          const res = await api.post("setting/update", {
            connectChatSettings: merged,
          });
          if (res.status === 200) {
            dispatch(loadSettings(res.data));
          }
        } catch (error) {
          console.error("Failed to persist chat appearance:", error);
        }
      }, 280);
    },
    [userId, connectId, dispatch, globalSettings?.connectChatSettings],
  );

  useEffect(
    () => () => {
      if (persistTimer.current) window.clearTimeout(persistTimer.current);
    },
    [],
  );

  const updateSettings = useCallback(
    (patch) => {
      const next = normalizeConnectChatSettings({ ...settings, ...patch });
      setSettings(next);
      setConnectChatSettingsLocal(userId, connectId, next);
      persistToServer(next);
      return next;
    },
    [userId, connectId, settings, persistToServer],
  );

  const resetSettings = useCallback(() => {
    return updateSettings({ ...DEFAULT_CONNECT_CHAT_SETTINGS });
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
    globalActionEmoji: globalSettings?.actionEmoji || DEFAULT_CONNECT_CHAT_SETTINGS.actionEmoji,
  };
};

export default useConnectChatSettings;
