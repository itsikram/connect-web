import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

const WatchPipContext = createContext(null);

export const isStandaloneApp = () =>
  typeof window !== "undefined" &&
  (window.navigator.standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    document.documentElement.classList.contains("standalone-ios") ||
    document.documentElement.classList.contains("standalone-pwa"));

export const useWatchPip = () => {
  const ctx = useContext(WatchPipContext);
  if (!ctx) {
    throw new Error("useWatchPip must be used within WatchPipProvider");
  }
  return ctx;
};

/** Safe hook when provider might be missing during tests */
export const useWatchPipOptional = () => useContext(WatchPipContext);

export const WatchPipProvider = ({ children }) => {
  const [pip, setPip] = useState(null);
  // pip: { watchId, videoUrl, currentTime, playing, title, thumbnail, muted }

  const startPip = useCallback((data) => {
    if (!data?.videoUrl || !data?.watchId) return;
    setPip({
      watchId: data.watchId,
      videoUrl: data.videoUrl,
      currentTime: Number(data.currentTime) || 0,
      playing: data.playing !== false,
      title: data.title || "Watch",
      thumbnail: data.thumbnail || "",
      muted: !!data.muted,
    });
  }, []);

  const updatePip = useCallback((updates) => {
    setPip((prev) => (prev ? { ...prev, ...updates } : prev));
  }, []);

  const closePip = useCallback(() => setPip(null), []);

  const value = useMemo(
    () => ({
      pip,
      isPipActive: !!pip,
      startPip,
      updatePip,
      closePip,
    }),
    [pip, startPip, updatePip, closePip]
  );

  return (
    <WatchPipContext.Provider value={value}>{children}</WatchPipContext.Provider>
  );
};

export default WatchPipContext;
