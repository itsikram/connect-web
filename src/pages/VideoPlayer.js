import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { useSelector } from "react-redux";
import { useLocation } from "react-router-dom";
import "./VideoPlayer.css";
import useIsMobile from "../utils/useIsMobile";
import { useWatchPipOptional } from "../contexts/WatchPipContext";
import { buildLibraryPipPayloadFromVideo } from "../utils/watchPipHelpers";
import {
  loadCustomPlaylist,
  saveCustomPlaylist,
  loadWatchPlaylistItems,
  loadSavedPlaylistItems,
  mergePlaylist,
  filterPlaylist,
  sortPlaylist,
  loadPlaylistOrder,
  savePlaylistOrder,
  reorderPlaylistIds,
  syncPlaylistOrder,
  getTypeLabel,
  getSourceLabel,
  normalizePlaylistItem,
  loadPlayQueue,
  savePlayQueue,
  videoToQueueItem,
  clampPlayCount,
  MIN_PLAY_COUNT,
  MAX_PLAY_COUNT,
  FILTER_OPTIONS,
  SORT_OPTIONS,
  watchesToPlaylistItems,
  getCachedSavedPlaylist,
  loadSavedPlaylists,
  saveNamedPlaylist,
  deleteNamedPlaylist,
} from "../utils/videoPlayerLibrary";
import WatchCacheManager, {
  WATCH_CACHE_EVENT,
} from "../utils/watchCacheManager";
import useMediaSession from "../hooks/useMediaSession";
import useBackgroundAudioHandoff from "../hooks/useBackgroundAudioHandoff";
import useSmoothAudio from "../hooks/useSmoothAudio";
import api from "../api/api";
import { getYtDownloadApiUrl, normalizeServerUrl } from "../utils/offlineUtils";
import { showErrorToast, showSuccessToast } from "../utils/toastUtils";

const VideoPlayer = () => {
  const myProfileId = useSelector((state) => state.profile?._id);
  const location = useLocation();
  const watchPip = useWatchPipOptional();
  const isMobile = useIsMobile();
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  useEffect(() => {
    setIsTouchDevice(
      "ontouchstart" in window ||
        navigator.maxTouchPoints > 0 ||
        window.matchMedia("(pointer: coarse)").matches,
    );
  }, []);

  const [customVideos, setCustomVideos] = useState(() => loadCustomPlaylist());
  const playUrlHandledRef = useRef(false);

  useEffect(() => {
    const playUrl = String(location.state?.playUrl || "").trim();
    if (!playUrl || playUrlHandledRef.current) return;
    playUrlHandledRef.current = true;
    const newVideo = normalizePlaylistItem({
      id: `agent-${Date.now()}`,
      url: playUrl,
      title: location.state?.playTitle || "Video",
      type: "url",
      online: true,
    });
    if (!newVideo) return;
    setCustomVideos((prev) => {
      if (prev.some((video) => video.url === playUrl || video.id === newVideo.id)) {
        return prev;
      }
      return [...prev, newVideo];
    });
  }, [location.state]);

  const [watchVideos, setWatchVideos] = useState(() =>
    watchesToPlaylistItems(
      WatchCacheManager.getCachedFeed(myProfileId) || [],
    ),
  );
  const [savedVideos, setSavedVideos] = useState(
    () => getCachedSavedPlaylist() || [],
  );
  const hasHydratedLibrary =
    watchVideos.length > 0 ||
    savedVideos.length > 0 ||
    customVideos.length > 0;
  const [libraryLoading, setLibraryLoading] = useState(!hasHydratedLibrary);
  const [libraryError, setLibraryError] = useState("");

  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [videoUrl, setVideoUrl] = useState("");
  const [videoTitle, setVideoTitle] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLooping, setIsLooping] = useState(false);
  const [filter, setFilter] = useState("all");
  const [sortMode, setSortMode] = useState("custom");
  const [searchQuery, setSearchQuery] = useState("");
  const [youtubeResults, setYoutubeResults] = useState([]);
  const [youtubeSearching, setYoutubeSearching] = useState(false);
  const [youtubeSearchError, setYoutubeSearchError] = useState("");
  const [serverWatchResults, setServerWatchResults] = useState([]);
  const [watchAuthors, setWatchAuthors] = useState({});
  const [watchSearching, setWatchSearching] = useState(false);
  const [watchSearchError, setWatchSearchError] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchScope, setSearchScope] = useState("all");
  const [libraryQuery, setLibraryQuery] = useState("");
  const [activeTab, setActiveTab] = useState("queue");
  const searchBoxRef = useRef(null);
  const [youtubeDownload, setYoutubeDownload] = useState(null);
  const [playlistOrder, setPlaylistOrder] = useState(() => loadPlaylistOrder());
  const [playQueue, setPlayQueue] = useState(() => loadPlayQueue());
  const [queueIndex, setQueueIndex] = useState(0);
  const [playPass, setPlayPass] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [dragIndex, setDragIndex] = useState(null);
  const [queueDragIndex, setQueueDragIndex] = useState(null);
  const [savedPlaylists, setSavedPlaylists] = useState([]);
  const [playlistName, setPlaylistName] = useState("");
  const [savingPlaylist, setSavingPlaylist] = useState(false);

  const videoRef = useRef(null);
  const fileInputRef = useRef(null);
  const blobUrlsRef = useRef(new Set());
  const skipPipOnUnmount = useRef(false);
  const currentVideoRef = useRef(null);
  const playlistPipRef = useRef([]);
  const loopingRef = useRef(false);
  const pipReturnRef = useRef(null);
  const currentPlaybackRef = useRef(null);
  const resumeHandledRef = useRef(false);
  const libraryRefreshRef = useRef(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [mediaReady, setMediaReady] = useState(false);
  const [mediaElement, setMediaElement] = useState(null);
  useSmoothAudio(mediaElement);

  // Search runs against two sources in parallel: Watches stored on our server
  // (all of them, not just the recent feed cached in the library) and YouTube.
  useEffect(() => {
    const query = searchQuery.trim();
    if (!query) {
      setYoutubeResults([]);
      setYoutubeSearchError("");
      setServerWatchResults([]);
      setWatchSearchError("");
      setYoutubeSearching(false);
      setWatchSearching(false);
      return undefined;
    }
    const controller = new AbortController();
    const isAbort = (error) =>
      error?.name === "CanceledError" || error?.name === "AbortError";
    setYoutubeSearching(true);
    setWatchSearching(true);
    const timer = setTimeout(() => {
      setYoutubeSearchError("");
      setWatchSearchError("");
      api
        .get("watch/search", {
          params: { q: query, limit: 12 },
          signal: controller.signal,
        })
        .then((response) => {
          const list = Array.isArray(response.data) ? response.data : [];
          const authors = {};
          list.forEach((w) => {
            const author = w?.author;
            const name =
              author?.displayName ||
              author?.fullName ||
              [author?.user?.firstName, author?.user?.surname].filter(Boolean).join(" ");
            if (w?._id && name) authors[String(w._id)] = name;
          });
          setWatchAuthors((prev) => ({ ...prev, ...authors }));
          setServerWatchResults(watchesToPlaylistItems(list));
        })
        .catch((error) => {
          if (isAbort(error)) return;
          setServerWatchResults([]);
          setWatchSearchError("Could not search Watches on the server.");
        })
        .finally(() => {
          if (!controller.signal.aborted) setWatchSearching(false);
        });
      api
        .get(`${normalizeServerUrl(getYtDownloadApiUrl())}/youtube/search`, {
          params: { q: query, maxResults: 8, _ts: Date.now() },
          signal: controller.signal,
        })
        .then((response) => setYoutubeResults(response.data?.items || []))
        .catch((error) => {
          if (isAbort(error)) return;
          setYoutubeSearchError(error?.response?.data?.error || "YouTube search failed.");
          setYoutubeResults([]);
        })
        .finally(() => {
          if (!controller.signal.aborted) setYoutubeSearching(false);
        });
    }, 350);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [searchQuery]);

  // Close the results dropdown on outside click or Escape.
  useEffect(() => {
    if (!searchOpen) return undefined;
    const onPointerDown = (event) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(event.target)) {
        setSearchOpen(false);
      }
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") setSearchOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [searchOpen]);

  const setVideoElementRef = useCallback((node) => {
    videoRef.current = node;
    setMediaElement(node || null);
  }, []);

  const allVideos = useMemo(
    () => mergePlaylist(watchVideos, savedVideos, customVideos),
    [watchVideos, savedVideos, customVideos],
  );

  const filteredVideos = useMemo(() => {
    let list = filterPlaylist(allVideos, filter);
    const q = libraryQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((v) => v.title.toLowerCase().includes(q));
    }
    return sortPlaylist(list, sortMode, playlistOrder);
  }, [allVideos, filter, libraryQuery, sortMode, playlistOrder]);

  // Watch results = library Watches/saved copies matching the query (instant)
  // followed by server matches, de-duplicated by Watch id.
  const watchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    const seen = new Set();
    const out = [];
    const push = (video) => {
      const key = String(video.sourceId || video.id);
      if (seen.has(key)) return;
      seen.add(key);
      out.push(video);
    };
    allVideos
      .filter(
        (v) =>
          (v.type === "watch" || v.type === "saved") &&
          v.title.toLowerCase().includes(q),
      )
      .forEach(push);
    serverWatchResults.forEach(push);
    return out.slice(0, 15);
  }, [searchQuery, allVideos, serverWatchResults]);

  const showSearchPanel = searchOpen && !!searchQuery.trim();

  const usingQueue = playQueue.length > 0;
  const playbackList = useMemo(() => {
    if (playQueue.length > 0) return playQueue;
    return filteredVideos.map((video) => ({
      queueId: video.id,
      videoId: video.id,
      url: video.url,
      title: video.title,
      thumbnail: video.thumbnail || "",
      type: video.type,
      playCount: MIN_PLAY_COUNT,
    }));
  }, [playQueue, filteredVideos]);

  const playbackIndex = usingQueue ? queueIndex : currentVideoIndex;
  const currentPlayback = playbackList[playbackIndex] || null;

  const currentVideo = useMemo(() => {
    if (!currentPlayback) return null;
    const fromLibrary = allVideos.find(
      (video) => video.id === currentPlayback.videoId,
    );
    if (fromLibrary) {
      return { ...fromLibrary, title: currentPlayback.title };
    }
    return {
      id: currentPlayback.videoId,
      url: currentPlayback.url,
      title: currentPlayback.title,
      thumbnail: currentPlayback.thumbnail,
      type: currentPlayback.type,
    };
  }, [currentPlayback, allVideos]);

  const currentTrackKey = currentPlayback
    ? `${currentPlayback.queueId}:${currentPlayback.url}`
    : "";
  currentVideoRef.current = currentVideo;
  loopingRef.current = isLooping;
  currentPlaybackRef.current = currentPlayback;

  const libraryPipPlaylist = useMemo(
    () =>
      playbackList.map((item) => ({
        id: item.queueId,
        videoId: item.videoId,
        url: item.url,
        title: item.title,
        thumbnail: item.thumbnail || "",
        playCount: clampPlayCount(item.playCount),
      })),
    [playbackList],
  );
  playlistPipRef.current = libraryPipPlaylist;

  const isThisPip = watchPip?.pip?.source === "library" && !!watchPip.pip.videoUrl;
  const backgroundEndedRef = useRef(() => {});
  const backgroundAudio = useBackgroundAudioHandoff(videoRef, {
    src: currentVideo?.url,
    enabled: !!currentVideo?.url && !isThisPip,
    loop: isLooping && playbackList.length <= 1,
    onEndedRef: backgroundEndedRef,
  });
  const bgApiRef = useRef(backgroundAudio);
  bgApiRef.current = backgroundAudio;

  useEffect(() => {
    setPlaylistOrder((prev) => {
      const synced = syncPlaylistOrder(prev, allVideos);
      if (synced.join("|") !== prev.join("|")) {
        savePlaylistOrder(synced);
        return synced;
      }
      return prev;
    });
  }, [allVideos]);

  const refreshLibrary = useCallback(
    async ({ showSpinner = false } = {}) => {
      if (libraryRefreshRef.current) {
        return libraryRefreshRef.current;
      }
      if (showSpinner) setLibraryLoading(true);
      setLibraryError("");
      const refreshPromise = (async () => {
        try {
          const savedPromise = loadSavedPlaylistItems();
          if (!myProfileId) {
            setSavedVideos(await savedPromise);
            return;
          }
          const [watches, saved] = await Promise.all([
            loadWatchPlaylistItems(myProfileId),
            savedPromise,
          ]);
          setWatchVideos(watches);
          setSavedVideos(saved);
        } catch (err) {
          console.error(err);
          setLibraryError("Could not refresh some video sources.");
        } finally {
          setLibraryLoading(false);
          libraryRefreshRef.current = null;
        }
      })();
      libraryRefreshRef.current = refreshPromise;
      return refreshPromise;
    },
    [myProfileId],
  );

  useEffect(() => {
    refreshLibrary();
  }, [refreshLibrary]);

  useEffect(() => {
    if (!myProfileId) {
      setSavedPlaylists([]);
      return;
    }
    loadSavedPlaylists()
      .then(setSavedPlaylists)
      .catch((error) => console.error("Failed to load saved playlists:", error));
  }, [myProfileId]);

  useEffect(() => {
    const onWatchCache = (event) => {
      if (event.detail?.profileId !== myProfileId || event.detail?.list !== "feed") {
        return;
      }
      setWatchVideos(watchesToPlaylistItems(event.detail.items));
    };
    window.addEventListener(WATCH_CACHE_EVENT, onWatchCache);
    return () => window.removeEventListener(WATCH_CACHE_EVENT, onWatchCache);
  }, [myProfileId]);

  useEffect(() => {
    saveCustomPlaylist(customVideos);
  }, [customVideos]);

  useEffect(() => {
    savePlayQueue(playQueue);
  }, [playQueue]);

  useEffect(() => {
    if (currentVideoIndex >= filteredVideos.length) {
      setCurrentVideoIndex(
        filteredVideos.length > 0 ? filteredVideos.length - 1 : 0,
      );
    }
  }, [filteredVideos.length, currentVideoIndex]);

  useEffect(() => {
    if (queueIndex >= playQueue.length) {
      setQueueIndex(playQueue.length > 0 ? playQueue.length - 1 : 0);
    }
  }, [playQueue.length, queueIndex]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !currentVideo?.url || isThisPip) return undefined;
    setMediaReady(false);

    const onCanPlay = () => {
      setMediaReady(true);
      if (document.hidden) {
        try {
          video.muted = true;
          video.pause();
        } catch (_) {}
        bgApiRef.current.wantPlayingRef.current = true;
        bgApiRef.current.playBackgroundAudio().then((ok) => {
          setIsPlaying(!!ok);
        });
        return;
      }
      video
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    };

    video.addEventListener("canplay", onCanPlay, { once: true });

    if (video.getAttribute("src") !== currentVideo.url) {
      try {
        video.pause();
      } catch (_) {}
      video.src = currentVideo.url;
      video.load();
    } else if (video.readyState >= 3) {
      onCanPlay();
    }

    return () => {
      video.removeEventListener("canplay", onCanPlay);
    };
  }, [currentTrackKey, currentVideo?.url, isThisPip]);

  useEffect(() => {
    const video = videoRef.current;
    if (video) video.loop = false;
  }, [currentTrackKey]);

  useEffect(() => {
    const video = mediaElement;
    if (!video || isThisPip) return undefined;

    const syncPlaybackState = () => {
      const nextTime = Number(video.currentTime);
      const nextDuration = Number(video.duration);
      const nextRate = Number(video.playbackRate);

      setCurrentTime(Number.isFinite(nextTime) ? Math.max(0, nextTime) : 0);
      setDuration(
        Number.isFinite(nextDuration) ? Math.max(0, nextDuration) : 0,
      );
      setPlaybackRate(Number.isFinite(nextRate) && nextRate > 0 ? nextRate : 1);
    };

    syncPlaybackState();

    video.addEventListener("timeupdate", syncPlaybackState);
    video.addEventListener("durationchange", syncPlaybackState);
    video.addEventListener("ratechange", syncPlaybackState);
    video.addEventListener("loadedmetadata", syncPlaybackState);

    return () => {
      video.removeEventListener("timeupdate", syncPlaybackState);
      video.removeEventListener("durationchange", syncPlaybackState);
      video.removeEventListener("ratechange", syncPlaybackState);
      video.removeEventListener("loadedmetadata", syncPlaybackState);
    };
  }, [mediaElement, isThisPip, currentTrackKey]);

  useEffect(() => {
    const urls = blobUrlsRef.current;
    return () => {
      urls.forEach((url) => {
        try {
          URL.revokeObjectURL(url);
        } catch (_) {}
      });
      urls.clear();
    };
  }, []);

  useEffect(() => {
    const playUrl = String(location.state?.playUrl || "").trim();
    if (!playUrl || filteredVideos.length === 0) return;
    const idx = filteredVideos.findIndex((video) => video.url === playUrl);
    if (idx >= 0 && idx !== currentVideoIndex) {
      setCurrentVideoIndex(idx);
    }
  }, [location.state, filteredVideos, currentVideoIndex]);

  useEffect(() => {
    const resumeState = location.state;
    if (
      !resumeState?.videoId ||
      resumeHandledRef.current ||
      filteredVideos.length === 0
    )
      return;

    const idx = filteredVideos.findIndex((v) => v.id === resumeState.videoId);
    if (idx >= 0) {
      setCurrentVideoIndex(idx);
    }

    const video = videoRef.current;
    if (video && typeof resumeState.resumeAt === "number") {
      const applyResume = () => {
        try {
          video.currentTime = resumeState.resumeAt;
          if (resumeState.autoplay) {
            video
              .play()
              .then(() => setIsPlaying(true))
              .catch(() => {});
          }
        } catch (_) {}
      };
      if (video.readyState >= 1) applyResume();
      else
        video.addEventListener("loadedmetadata", applyResume, { once: true });
    }

    resumeHandledRef.current = true;
    watchPip?.closePip?.();
  }, [location.state, filteredVideos, watchPip]);

  useEffect(() => {
    if (!isThisPip || !watchPip?.pip?.libraryVideoId) return;
    if (usingQueue) {
      const qIdx = playQueue.findIndex(
        (item) => item.queueId === watchPip.pip.libraryVideoId,
      );
      if (qIdx >= 0 && qIdx !== queueIndex) setQueueIndex(qIdx);
    } else {
      const idx = filteredVideos.findIndex(
        (video) =>
          video.id === watchPip.pip.libraryVideoId ||
          video.id === watchPip.pip.videoId,
      );
      if (idx >= 0 && idx !== currentVideoIndex) {
        setCurrentVideoIndex(idx);
      }
    }
    if (
      typeof watchPip.pip.playPass === "number" &&
      watchPip.pip.playPass !== playPass
    ) {
      setPlayPass(clampPlayCount(watchPip.pip.playPass));
    }
  }, [
    isThisPip,
    watchPip?.pip?.libraryVideoId,
    watchPip?.pip?.videoId,
    watchPip?.pip?.playPass,
    usingQueue,
    playQueue,
    queueIndex,
    filteredVideos,
    currentVideoIndex,
    playPass,
  ]);

  useEffect(() => {
    if (!isThisPip) return;
    watchPip?.updatePip?.({
      playlist: libraryPipPlaylist,
      playPass,
    });
  }, [isThisPip, libraryPipPlaylist, playPass, watchPip?.updatePip]);

  useEffect(() => {
    if (!isThisPip || typeof watchPip?.pip?.looping !== "boolean") return;
    if (watchPip.pip.looping !== isLooping) {
      setIsLooping(watchPip.pip.looping);
    }
  }, [isThisPip, watchPip?.pip?.looping, isLooping]);

  const restoreFromPip = useCallback(() => {
    const pipData = watchPip?.pip;
    if (!pipData) return;

    const qIdx = playQueue.findIndex(
      (item) =>
        item.queueId === pipData.libraryVideoId ||
        item.videoId === pipData.videoId,
    );
    if (qIdx >= 0) setQueueIndex(qIdx);

    const idx = filteredVideos.findIndex(
      (video) =>
        video.id === pipData.videoId || video.id === pipData.libraryVideoId,
    );
    if (idx >= 0) setCurrentVideoIndex(idx);
    if (typeof pipData.looping === "boolean") setIsLooping(pipData.looping);
    if (typeof pipData.playPass === "number") {
      setPlayPass(clampPlayCount(pipData.playPass));
    }

    pipReturnRef.current = {
      resumeAt: Number(pipData.currentTime) || 0,
      autoplay: pipData.playing !== false,
    };
    watchPip.closePip();
  }, [watchPip, filteredVideos, playQueue]);

  useEffect(() => {
    const resume = pipReturnRef.current;
    if (!resume || isThisPip) return;

    const video = videoRef.current;
    if (!video) return;

    const applyResume = () => {
      try {
        video.currentTime = resume.resumeAt || 0;
        if (resume.autoplay) {
          video
            .play()
            .then(() => setIsPlaying(true))
            .catch(() => setIsPlaying(false));
        }
      } catch (_) {}
    };

    pipReturnRef.current = null;
    if (video.readyState >= 1) applyResume();
    else video.addEventListener("loadedmetadata", applyResume, { once: true });
  }, [isThisPip, currentTrackKey]);

  const pipExtras = useCallback(
    () => ({
      looping: loopingRef.current,
      playlist: playlistPipRef.current,
      playPass,
      videoId: currentPlaybackRef.current?.videoId,
    }),
    [playPass],
  );

  const minimizeToPip = useCallback(() => {
    if (!watchPip?.startPip || !currentVideoRef.current) return;
    const video = videoRef.current;
    if (!video) return;
    const playback = currentPlaybackRef.current;

    const payload = buildLibraryPipPayloadFromVideo(video, {
      libraryVideoId: playback?.queueId || currentVideoRef.current.id,
      videoUrl: currentVideoRef.current.url,
      title: currentVideoRef.current.title,
      thumbnail: currentVideoRef.current.thumbnail,
    });
    if (!payload) return;

    skipPipOnUnmount.current = true;
    video.pause();
    setIsPlaying(false);
    watchPip.startPip({
      ...payload,
      playing: true,
      ...pipExtras(),
    });
  }, [watchPip, pipExtras]);

  useEffect(() => {
    return () => {
      if (skipPipOnUnmount.current || !watchPip?.startPip) return;
      const video = videoRef.current;
      const cv = currentVideoRef.current;
      const playback = currentPlaybackRef.current;
      if (!video || !cv) return;

      const payload = buildLibraryPipPayloadFromVideo(video, {
        libraryVideoId: playback?.queueId || cv.id,
        videoUrl: cv.url,
        title: cv.title,
        thumbnail: cv.thumbnail,
      });
      if (payload) {
        watchPip.startPip({
          ...payload,
          looping: loopingRef.current,
          playlist: playlistPipRef.current,
          playPass: 1,
          videoId: playback?.videoId,
        });
      }
    };
  }, [watchPip]);

  const setPlaybackIndex = useCallback(
    (index, resetPass = true) => {
      if (resetPass) setPlayPass(1);
      if (playQueue.length > 0) setQueueIndex(index);
      else setCurrentVideoIndex(index);
    },
    [playQueue.length],
  );

  const replayCurrent = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      try {
        video.currentTime = 0;
      } catch (_) {}
    }
    if (document.hidden) {
      backgroundAudio.wantPlayingRef.current = true;
      backgroundAudio.restartBackgroundAudio();
      setIsPlaying(true);
      return;
    }
    if (!video) return;
    video.play().catch(() => {});
  }, [backgroundAudio]);

  const stopPlayback = useCallback(() => {
    backgroundAudio.wantPlayingRef.current = false;
    backgroundAudio.pauseBackgroundAudio();
    const video = videoRef.current;
    if (video) video.pause();
    setIsPlaying(false);
  }, [backgroundAudio]);

  const toggleFullscreen = useCallback(async () => {
    const frame = videoRef.current?.parentElement;
    if (!frame) return;

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }

      await frame.requestFullscreen();
      try {
        await window.screen?.orientation?.lock?.("landscape");
      } catch (_) {
        // Orientation locking is not supported by every browser.
      }
    } catch (error) {
      console.error("Unable to toggle video fullscreen:", error);
    }
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const active = Boolean(document.fullscreenElement);
      setIsFullscreen(active);
      if (!active) {
        window.screen?.orientation?.unlock?.();
      }
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      window.screen?.orientation?.unlock?.();
    };
  }, []);

  const handleVideoEnd = useCallback(() => {
    const item = currentPlaybackRef.current;
    const times = clampPlayCount(item?.playCount);
    if (playPass < times) {
      setPlayPass((prev) => prev + 1);
      replayCurrent();
      return;
    }

    if (playbackList.length <= 1) {
      if (isLooping) {
        setPlayPass(1);
        replayCurrent();
      } else {
        stopPlayback();
      }
      return;
    }

    const nextIndex = playbackIndex + 1;
    if (nextIndex >= playbackList.length) {
      if (isLooping) {
        setPlayPass(1);
        setPlaybackIndex(0);
        return;
      }
      stopPlayback();
      return;
    }

    setPlaybackIndex(nextIndex);
  }, [
    playPass,
    playbackList.length,
    playbackIndex,
    isLooping,
    replayCurrent,
    stopPlayback,
    setPlaybackIndex,
  ]);
  backgroundEndedRef.current = handleVideoEnd;

  const switchLibraryPipByOffset = useCallback(
    (offset) => {
      const list = watchPip?.pip?.playlist;
      if (!watchPip?.updatePip || !Array.isArray(list) || list.length === 0) {
        return;
      }
      const currentId = watchPip.pip.libraryVideoId;
      const idx = Math.max(
        0,
        list.findIndex((item) => item.id === currentId),
      );
      const next = list[(idx + offset + list.length) % list.length];
      if (!next) return;
      watchPip.updatePip({
        libraryVideoId: next.id,
        videoId: next.videoId,
        videoUrl: next.url,
        title: next.title,
        thumbnail: next.thumbnail || "",
        currentTime: 0,
        playing: true,
        playPass: 1,
      });
    },
    [watchPip],
  );

  const handlePrev = useCallback(() => {
    const livePosition = backgroundAudio.mediaPosition.playing
      ? backgroundAudio.mediaPosition.position
      : currentTime;
    if (livePosition > 3) {
      replayCurrent();
      return;
    }
    if (playbackList.length <= 1) {
      replayCurrent();
      return;
    }
    if (isThisPip) {
      switchLibraryPipByOffset(-1);
      return;
    }
    setPlaybackIndex(
      (playbackIndex - 1 + playbackList.length) % playbackList.length,
    );
  }, [
    playbackList.length,
    playbackIndex,
    isThisPip,
    switchLibraryPipByOffset,
    setPlaybackIndex,
    backgroundAudio,
    currentTime,
    replayCurrent,
  ]);

  const handleNext = useCallback(() => {
    if (playbackList.length <= 1) {
      replayCurrent();
      return;
    }
    if (isThisPip) {
      switchLibraryPipByOffset(1);
      return;
    }
    setPlaybackIndex((playbackIndex + 1) % playbackList.length);
  }, [
    playbackList.length,
    playbackIndex,
    isThisPip,
    switchLibraryPipByOffset,
    setPlaybackIndex,
    replayCurrent,
  ]);

  const addToPlayQueue = useCallback((video, playCount = MIN_PLAY_COUNT) => {
    const item = videoToQueueItem(video, playCount);
    if (!item) return null;
    setPlayQueue((prev) => {
      const wasEmpty = prev.length === 0;
      if (wasEmpty) {
        setQueueIndex(0);
        setPlayPass(1);
      }
      return [...prev, item];
    });
    return item.queueId;
  }, []);

  const updateQueuePlayCount = useCallback((queueId, nextCount) => {
    setPlayQueue((prev) =>
      prev.map((item) =>
        item.queueId === queueId
          ? { ...item, playCount: clampPlayCount(nextCount) }
          : item,
      ),
    );
  }, []);

  const removeFromPlayQueue = useCallback((queueId) => {
    setPlayQueue((prev) => prev.filter((item) => item.queueId !== queueId));
  }, []);

  const clearPlayQueue = useCallback(() => {
    setPlayQueue([]);
    setQueueIndex(0);
    setPlayPass(1);
  }, []);

  const saveCurrentPlaylist = useCallback(async () => {
    const name = playlistName.trim();
    if (!name || playQueue.length === 0 || savingPlaylist) return;
    setSavingPlaylist(true);
    try {
      const saved = await saveNamedPlaylist(name, playQueue);
      if (saved) {
        setSavedPlaylists((prev) => [saved, ...prev.filter((item) => item._id !== saved._id)]);
        setPlaylistName("");
        showSuccessToast(`Playlist "${saved.name}" saved.`);
      }
    } catch (error) {
      showErrorToast(error?.response?.data?.error || "Could not save playlist.");
    } finally {
      setSavingPlaylist(false);
    }
  }, [playlistName, playQueue, savingPlaylist]);

  const loadNamedPlaylist = useCallback((playlist) => {
    const items = Array.isArray(playlist?.items) ? playlist.items : [];
    if (!items.length) return;
    setPlayQueue(items);
    setQueueIndex(0);
    setPlayPass(1);
  }, []);

  const removeNamedPlaylist = useCallback(async (playlist) => {
    if (!playlist?._id || !window.confirm(`Delete playlist "${playlist.name}"?`)) return;
    try {
      await deleteNamedPlaylist(playlist._id);
      setSavedPlaylists((prev) => prev.filter((item) => item._id !== playlist._id));
    } catch (error) {
      showErrorToast(error?.response?.data?.error || "Could not delete playlist.");
    }
  }, []);

  const applyQueueReorder = useCallback((fromIndex, toIndex) => {
    if (fromIndex === toIndex) return;
    setPlayQueue((prev) => {
      if (
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= prev.length ||
        toIndex >= prev.length
      ) {
        return prev;
      }
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
    setQueueIndex((prev) => {
      if (prev === fromIndex) return toIndex;
      if (fromIndex < prev && toIndex >= prev) return prev - 1;
      if (fromIndex > prev && toIndex <= prev) return prev + 1;
      return prev;
    });
  }, []);

  const focusVideoInList = (videoId, nextCustomVideos = customVideos) => {
    const merged = mergePlaylist(watchVideos, savedVideos, nextCustomVideos);
    let list = filterPlaylist(merged, filter);
    const q = libraryQuery.trim().toLowerCase();
    if (q) list = list.filter((v) => v.title.toLowerCase().includes(q));
    list = sortPlaylist(list, sortMode, playlistOrder);
    const idx = list.findIndex((v) => v.id === videoId);
    if (idx >= 0) setCurrentVideoIndex(idx);
  };

  const handleAddVideo = (e) => {
    e.preventDefault();
    const url = videoUrl.trim();
    if (!url) return;

    const newVideo = normalizePlaylistItem({
      id: `custom-${Date.now()}`,
      url,
      title: videoTitle.trim() || `Video ${customVideos.length + 1}`,
      type: "url",
      online: true,
    });

    if (!newVideo) return;

    const nextCustom = [...customVideos, newVideo];
    setCustomVideos(nextCustom);
    setPlaylistOrder((prev) => {
      const next = syncPlaylistOrder(
        [...prev, newVideo.id],
        mergePlaylist(watchVideos, savedVideos, nextCustom),
      );
      savePlaylistOrder(next);
      return next;
    });
    focusVideoInList(newVideo.id, nextCustom);
    addToPlayQueue(newVideo);
    setFilter("all");
    setVideoUrl("");
    setVideoTitle("");
  };

  const playVideoNow = (video) => {
    const existingIndex = playQueue.findIndex((item) => item.videoId === video.id);
    let target = existingIndex >= 0 ? playQueue[existingIndex] : null;
    if (!target) {
      target = videoToQueueItem(video);
      if (!target) return;
      const appended = target;
      setPlayQueue((prev) => [...prev, appended]);
      setQueueIndex(playQueue.length);
    } else {
      setQueueIndex(existingIndex);
    }
    setPlayPass(1);
    if (isThisPip && watchPip?.updatePip) {
      watchPip.updatePip({
        libraryVideoId: target.queueId,
        videoId: target.videoId,
        videoUrl: target.url,
        title: target.title,
        thumbnail: target.thumbnail || "",
        currentTime: 0,
        playing: true,
        playPass: 1,
      });
    }
  };

  const handlePlayWatchResult = (video) => {
    playVideoNow(video);
    setSearchQuery("");
    setSearchOpen(false);
    setActiveTab("queue");
  };

  const handleQueueWatchResult = (video) => {
    addToPlayQueue(video);
    showSuccessToast("Added to Up next");
  };

  const handleSelectYoutubeResult = async (result) => {
    if (!result?.url) return;
    const youtubeId = result.videoId;
    const existingWatch =
      (result.localWatch?.videoUrl &&
        normalizePlaylistItem({
          id: `watch-${result.localWatch._id}`,
          sourceId: result.localWatch._id,
          url: result.localWatch.videoUrl,
          title: result.localWatch.caption || result.title,
          thumbnail: result.localWatch.thumbnail || result.thumbnail,
          type: "watch",
          online: true,
          youtubeId: result.localWatch.youtubeId || youtubeId,
        })) ||
      watchVideos.find((video) => video.youtubeId === youtubeId);
    if (existingWatch) {
      playVideoNow(existingWatch);
      setSearchQuery("");
      setSearchOpen(false);
      setActiveTab("queue");
      return;
    }
    const existing = allVideos.find((video) => video.url === result.url);
    const newVideo = normalizePlaylistItem({
      id: `youtube-${result.videoId || Date.now()}`,
      url: result.url,
      title: result.title || "YouTube video",
      thumbnail: result.thumbnail || "",
      type: "url",
      online: true,
    });
    if (!newVideo) return;
    const selectedVideo = existing || newVideo;
    if (!existing) {
      const nextCustom = [...customVideos, newVideo];
      setCustomVideos(nextCustom);
      setPlaylistOrder((prev) => {
        const next = syncPlaylistOrder(
          [...prev, newVideo.id],
          mergePlaylist(watchVideos, savedVideos, nextCustom),
        );
        savePlaylistOrder(next);
        return next;
      });
    }
    setFilter("all");
    setSearchQuery("");
    setSearchOpen(false);
    setActiveTab("queue");
    const downloadQueueId = addToPlayQueue(selectedVideo);
    focusVideoInList(selectedVideo.id, existing ? customVideos : [...customVideos, newVideo]);
    try {
      if (!downloadQueueId) {
        throw new Error("Could not add the video to the playlist.");
      }
      setYoutubeDownload({ queueId: downloadQueueId, title: result.title || "YouTube video", percent: 2, stage: "Starting download…" });
      const base = normalizeServerUrl(getYtDownloadApiUrl());
      const started = await api.get(`${base}/download`, {
        params: {
          url: result.url,
          ext: "mp4",
          // Request the highest source quality available, up to 4K. The server
          // still falls back to the best format when a video has no 4K stream.
          height: 2160,
          disposition: "inline",
          link_only: true,
          async_job: true,
          post_as_watch: true,
          _ts: Date.now(),
        },
      });
      const progressId = started.data?.progress_id;
      const replaceWithWatch = (data) => {
        if (!data?.file_url) return;
        const watchItem = normalizePlaylistItem({
          id: data.watch_id ? `watch-${data.watch_id}` : selectedVideo.id,
          sourceId: data.watch_id || selectedVideo.sourceId,
          url: data.file_url,
          title: data.title || result.title || "YouTube video",
          thumbnail: result.thumbnail || "",
          type: data.watch_id ? "watch" : selectedVideo.type,
          online: true,
          youtubeId,
        });
        if (!watchItem) return;
        setCustomVideos((prev) => prev.filter((video) => video.id !== newVideo.id));
        setPlayQueue((prev) => prev.map((item) =>
          item.videoId === selectedVideo.id ? { ...item, videoId: watchItem.id, url: watchItem.url, title: watchItem.title, thumbnail: watchItem.thumbnail, type: watchItem.type } : item
        ));
      };
      if (started.data?.status === "completed") {
        replaceWithWatch(started.data);
        setYoutubeDownload((prev) => ({ ...(prev || { queueId: downloadQueueId, title: result.title || "YouTube video" }), percent: 100, stage: "Complete" }));
        await refreshLibrary({ showSpinner: false });
        setTimeout(() => setYoutubeDownload(null), 2500);
        return;
      }
      if (!progressId) throw new Error(started.data?.error || "Could not start download");
      showSuccessToast("Added to playlist; downloading and posting to Watch.");
      const poll = async () => {
        const response = await api.get(`${base}/progress/${progressId}`, {
          params: { _ts: Date.now() },
        });
        const data = response.data || {};
        setYoutubeDownload((prev) => ({
          ...(prev || { queueId: downloadQueueId }),
          title: data.title || prev?.title || result.title || "YouTube video",
          percent: Math.max(Number(prev?.percent) || 0, Math.round(Number(data.pct) || 0)),
          stage: data.stage || "Downloading…",
        }));
        if (data.status === "completed") {
          replaceWithWatch(data);
          setYoutubeDownload((prev) => ({ ...(prev || { queueId: downloadQueueId }), percent: 100, stage: "Complete" }));
          await refreshLibrary({ showSpinner: false });
          setTimeout(() => setYoutubeDownload(null), 2500);
          return;
        }
        if (data.status === "failed" || data.status === "error") {
          throw new Error(data.error || "YouTube download failed");
        }
        setTimeout(poll, 1200);
      };
      poll().catch((error) => {
        setYoutubeDownload((prev) => ({ ...(prev || {}), stage: "Failed", error: error.message }));
        showErrorToast(error.message || "YouTube download failed.");
      });
    } catch (error) {
      setYoutubeDownload({ queueId: downloadQueueId || "", title: result.title || "YouTube video", percent: 0, stage: "Failed", error: error.message });
      showErrorToast(error?.response?.data?.error || error.message || "Could not start YouTube download.");
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("video/")) return;

    const blobUrl = URL.createObjectURL(file);
    blobUrlsRef.current.add(blobUrl);

    const newVideo = normalizePlaylistItem({
      id: `file-${Date.now()}`,
      url: blobUrl,
      title: videoTitle.trim() || file.name,
      type: "file",
      online: false,
    });

    if (!newVideo) return;

    const nextCustom = [...customVideos, newVideo];
    setCustomVideos(nextCustom);
    setPlaylistOrder((prev) => {
      const next = syncPlaylistOrder(
        [...prev, newVideo.id],
        mergePlaylist(watchVideos, savedVideos, nextCustom),
      );
      savePlaylistOrder(next);
      return next;
    });
    focusVideoInList(newVideo.id, nextCustom);
    addToPlayQueue(newVideo);
    setFilter("all");
    setVideoTitle("");

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleRemoveVideo = (video) => {
    if (!video) return;

    if (video.type === "url" || video.type === "file") {
      setCustomVideos((prev) => prev.filter((v) => v.id !== video.id));
      if (video.type === "file" && video.url.startsWith("blob:")) {
        URL.revokeObjectURL(video.url);
        blobUrlsRef.current.delete(video.url);
      }
    }

    setPlaylistOrder((prev) => {
      const next = prev.filter((id) => id !== video.id);
      savePlaylistOrder(next);
      return next;
    });
    setPlayQueue((prev) => prev.filter((item) => item.videoId !== video.id));
    setCurrentVideoIndex((prev) => Math.max(0, prev - 1));
  };

  const handlePlayVideo = (index) => {
    const video = filteredVideos[index];
    if (usingQueue && video) {
      addToPlayQueue(video);
      return;
    }
    if (isThisPip && video && watchPip?.updatePip) {
      watchPip.updatePip({
        libraryVideoId: video.id,
        videoId: video.id,
        videoUrl: video.url,
        title: video.title,
        thumbnail: video.thumbnail || "",
        currentTime: 0,
        playing: true,
        playPass: 1,
      });
    }
    setPlayPass(1);
    setCurrentVideoIndex(index);
  };

  const handlePlayQueueItem = (index) => {
    const item = playQueue[index];
    if (!item) return;
    setQueueIndex(index);
    setPlayPass(1);
    if (isThisPip && watchPip?.updatePip) {
      watchPip.updatePip({
        libraryVideoId: item.queueId,
        videoId: item.videoId,
        videoUrl: item.url,
        title: item.title,
        thumbnail: item.thumbnail || "",
        currentTime: 0,
        playing: true,
        playPass: 1,
      });
    }
  };

  const playCurrent = useCallback(() => {
    backgroundAudio.wantPlayingRef.current = true;
    if (document.hidden) {
      return backgroundAudio
        .playBackgroundAudio()
        .then(() => setIsPlaying(true));
    }
    const video = videoRef.current;
    if (!video) return Promise.resolve();
    return video.play().then(() => setIsPlaying(true));
  }, [backgroundAudio]);

  const pauseCurrent = useCallback(() => {
    backgroundAudio.wantPlayingRef.current = false;
    backgroundAudio.pauseBackgroundAudio();
    const video = videoRef.current;
    if (video) video.pause();
    setIsPlaying(false);
  }, [backgroundAudio]);

  const togglePlayPause = () => {
    if (isThisPip) {
      watchPip?.updatePip?.({ playing: watchPip.pip?.playing === false });
      return;
    }
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      playCurrent().catch(() => {});
    } else {
      pauseCurrent();
    }
  };

  const useTouchReorder = isMobile || isTouchDevice;
  const canDragReorder = sortMode === "custom" && !useTouchReorder;
  const canDragQueue = !useTouchReorder && playQueue.length > 1;

  const applyPlaylistReorder = useCallback(
    (fromIndex, toIndex) => {
      if (sortMode !== "custom" || fromIndex === toIndex) return;
      if (
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= filteredVideos.length ||
        toIndex >= filteredVideos.length
      ) {
        return;
      }

      const visibleIds = filteredVideos.map((v) => v.id);
      const reorderedVisible = reorderPlaylistIds(
        visibleIds,
        fromIndex,
        toIndex,
      );

      setPlaylistOrder((prev) => {
        const base = prev.length ? [...prev] : allVideos.map((v) => v.id);
        const visibleSet = new Set(visibleIds);
        const withoutVisible = base.filter((id) => !visibleSet.has(id));
        const firstVisibleIdx = base.findIndex((id) => visibleSet.has(id));
        const insertAt =
          firstVisibleIdx >= 0 ? firstVisibleIdx : withoutVisible.length;
        const next = [
          ...withoutVisible.slice(0, insertAt),
          ...reorderedVisible,
          ...withoutVisible.slice(insertAt),
        ];
        savePlaylistOrder(next);
        return next;
      });

      if (currentVideoIndex === fromIndex) {
        setCurrentVideoIndex(toIndex);
      } else if (
        fromIndex < currentVideoIndex &&
        toIndex >= currentVideoIndex
      ) {
        setCurrentVideoIndex((prev) => prev - 1);
      } else if (
        fromIndex > currentVideoIndex &&
        toIndex <= currentVideoIndex
      ) {
        setCurrentVideoIndex((prev) => prev + 1);
      }
    },
    [sortMode, filteredVideos, allVideos, currentVideoIndex],
  );

  const handleDragStart = (index) => {
    if (!canDragReorder) return;
    setDragIndex(index);
  };

  const handleDragOver = (e, index) => {
    if (!canDragReorder || dragIndex === null || dragIndex === index) return;
    e.preventDefault();
  };

  const handleDrop = (index) => {
    if (!canDragReorder || dragIndex === null || dragIndex === index) {
      setDragIndex(null);
      return;
    }

    applyPlaylistReorder(dragIndex, index);
    setDragIndex(null);
  };

  const movePlaylistItem = (index, direction, e) => {
    e?.stopPropagation?.();
    e?.preventDefault?.();
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    applyPlaylistReorder(index, targetIndex);
  };

  const handleQueueDragStart = (index) => {
    if (!canDragQueue) return;
    setQueueDragIndex(index);
  };

  const handleQueueDragOver = (e, index) => {
    if (!canDragQueue || queueDragIndex === null || queueDragIndex === index) {
      return;
    }
    e.preventDefault();
  };

  const handleQueueDrop = (index) => {
    if (!canDragQueue || queueDragIndex === null || queueDragIndex === index) {
      setQueueDragIndex(null);
      return;
    }
    applyQueueReorder(queueDragIndex, index);
    setQueueDragIndex(null);
  };

  const moveQueueItem = (index, direction, e) => {
    e?.stopPropagation?.();
    e?.preventDefault?.();
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    applyQueueReorder(index, targetIndex);
  };

  const handleSortChange = (e) => {
    setSortMode(e.target.value);
    setCurrentVideoIndex(0);
  };

  const stats = useMemo(
    () => ({
      watches: watchVideos.length,
      saved: savedVideos.length,
      custom: customVideos.length,
      total: allVideos.length,
    }),
    [
      watchVideos.length,
      savedVideos.length,
      customVideos.length,
      allVideos.length,
    ],
  );

  const mediaArtwork = useMemo(() => {
    const buildAbsoluteArtwork = (src, sizes, type) => {
      if (!src) return null;
      try {
        const image = {
          src: new URL(src, window.location.origin).toString(),
          sizes,
        };
        if (type) image.type = type;
        return image;
      } catch (_) {
        return null;
      }
    };

    const artwork = [];
    const thumb = buildAbsoluteArtwork(currentVideo?.thumbnail, "512x512");
    if (thumb) artwork.push(thumb);

    const logo512 = buildAbsoluteArtwork(
      "/logo512.png",
      "512x512",
      "image/png",
    );
    if (logo512) artwork.push(logo512);

    const logo192 = buildAbsoluteArtwork(
      "/logo192.png",
      "192x192",
      "image/png",
    );
    if (logo192) artwork.push(logo192);

    return artwork;
  }, [currentVideo?.thumbnail]);

  const seekBy = useCallback((delta) => {
    const video = videoRef.current;
    const audio = backgroundAudio.audioRef.current;
    const el = document.hidden && audio ? audio : video;
    if (!el) return;

    const maxDuration = Number(el.duration);
    const base = Number(el.currentTime);
    if (!Number.isFinite(base)) return;

    const next = base + delta;
    const clamped =
      Number.isFinite(maxDuration) && maxDuration > 0
        ? Math.min(maxDuration, Math.max(0, next))
        : Math.max(0, next);
    el.currentTime = clamped;
    if (video && video !== el) {
      try {
        video.currentTime = clamped;
      } catch (_) {}
    }
  }, [backgroundAudio]);

  const seekTo = useCallback((details) => {
    const video = videoRef.current;
    const audio = backgroundAudio.audioRef.current;
    const el = document.hidden && audio ? audio : video;
    if (!el) return;

    const requested = Number(details?.seekTime);
    if (!Number.isFinite(requested) || requested < 0) return;

    const maxDuration = Number(el.duration);
    const target =
      Number.isFinite(maxDuration) && maxDuration > 0
        ? Math.min(maxDuration, requested)
        : requested;

    if (details?.fastSeek && typeof el.fastSeek === "function") {
      try {
        el.fastSeek(target);
        return;
      } catch (_) {}
    }
    el.currentTime = target;
    if (video && video !== el) {
      try {
        video.currentTime = target;
      } catch (_) {}
    }
  }, [backgroundAudio]);

  const playerIsPlaying = isThisPip
    ? watchPip?.pip?.playing !== false
    : isPlaying || backgroundAudio.mediaPosition.playing;

  const sessionDuration =
    backgroundAudio.mediaPosition.playing &&
    backgroundAudio.mediaPosition.duration > 0
      ? backgroundAudio.mediaPosition.duration
      : duration;
  const sessionPosition =
    backgroundAudio.mediaPosition.playing &&
    backgroundAudio.mediaPosition.duration > 0
      ? backgroundAudio.mediaPosition.position
      : currentTime;
  const sessionRate = backgroundAudio.mediaPosition.playing
    ? backgroundAudio.mediaPosition.playbackRate
    : playbackRate;

  const mediaSessionHandlers = useMemo(
    () => ({
      play: () => playCurrent().catch(() => {}),
      pause: () => pauseCurrent(),
      previoustrack: () => handlePrev(),
      nexttrack: () => handleNext(),
      seekbackward: (details) => seekBy(-(Number(details?.seekOffset) || 10)),
      seekforward: (details) => seekBy(Number(details?.seekOffset) || 10),
      seekto: (details) => seekTo(details),
    }),
    [playCurrent, pauseCurrent, handlePrev, handleNext, seekBy, seekTo],
  );

  const getLivePosition = useCallback(() => {
    const audio = backgroundAudio.audioRef.current;
    const video = videoRef.current;
    if (audio && !audio.paused && Number(audio.duration) > 0) {
      return {
        duration: Number(audio.duration),
        position: Number(audio.currentTime) || 0,
        playbackRate: Number(audio.playbackRate) > 0 ? Number(audio.playbackRate) : 1,
      };
    }
    if (video && Number(video.duration) > 0) {
      return {
        duration: Number(video.duration),
        position: Number(video.currentTime) || 0,
        playbackRate: Number(video.playbackRate) > 0 ? Number(video.playbackRate) : 1,
      };
    }
    return {
      duration: sessionDuration,
      position: sessionPosition,
      playbackRate: sessionRate,
    };
  }, [backgroundAudio, sessionDuration, sessionPosition, sessionRate]);

  const getPlaybackState = useCallback(() => {
    const audio = backgroundAudio.audioRef.current;
    if (audio && !audio.paused) return "playing";
    const video = videoRef.current;
    if (video && !video.paused) return "playing";
    if (backgroundAudio.isAudioPlaying()) return "playing";
    return playerIsPlaying ? "playing" : "paused";
  }, [backgroundAudio, playerIsPlaying]);

  useMediaSession({
    enabled: !!currentVideo && !isThisPip,
    bindKey: currentTrackKey,
    metadata: currentVideo
      ? {
          title: currentVideo.title,
          artist: getSourceLabel(currentVideo),
          album: "Connect Watch Library",
          artwork: mediaArtwork,
        }
      : null,
    playbackState: playerIsPlaying ? "playing" : "paused",
    positionState: {
      duration: sessionDuration,
      position: sessionPosition,
      playbackRate: sessionRate,
    },
    getPositionState: getLivePosition,
    getPlaybackState,
    handlers: mediaSessionHandlers,
  });

  const tabCounts = {
    queue: playQueue.length,
    library: stats.total,
    saved: savedPlaylists.length,
  };

  const renderWatchResult = (video) => {
    const author = watchAuthors[video.sourceId];
    return (
      <div
        key={`w-${video.id}`}
        className="vp-result"
        role="button"
        tabIndex={0}
        onClick={() => handlePlayWatchResult(video)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handlePlayWatchResult(video);
        }}
      >
        <div className="vp-result-thumb">
          {video.thumbnail ? <img src={video.thumbnail} alt="" loading="lazy" /> : <i className="fas fa-film" />}
          <span className="vp-result-play"><i className="fas fa-play" /></span>
        </div>
        <div className="vp-result-info">
          <strong>{video.title}</strong>
          <small>{video.type === "saved" ? "Saved on this device" : author || "Watch"}</small>
        </div>
        <button
          type="button"
          className="vp-icon-btn vp-icon-btn-accent"
          onClick={(e) => {
            e.stopPropagation();
            handleQueueWatchResult(video);
          }}
          title="Add to Up next"
          aria-label={`Add ${video.title} to Up next`}
        >
          <i className="fas fa-plus" />
        </button>
      </div>
    );
  };

  const renderYoutubeResult = (result) => (
    <div
      key={`y-${result.videoId}`}
      className="vp-result"
      role="button"
      tabIndex={0}
      onClick={() => handleSelectYoutubeResult(result)}
      onKeyDown={(e) => {
        if (e.key === "Enter") handleSelectYoutubeResult(result);
      }}
      title={result.localWatch ? "Play from Watch" : "Download to Watch and add to Up next"}
    >
      <div className="vp-result-thumb">
        {result.thumbnail ? <img src={result.thumbnail} alt="" loading="lazy" /> : null}
      </div>
      <div className="vp-result-info">
        <strong>{result.title}</strong>
        <small>
          {result.localWatch ? (
            <span className="vp-in-watch"><i className="fas fa-check" /> In Watch</span>
          ) : null}
          {result.channelTitle}
        </small>
      </div>
      <span className="vp-result-action" aria-hidden="true">
        <i className={`fas ${result.localWatch ? "fa-play" : "fa-download"}`} />
      </span>
    </div>
  );

  return (
    <div className="video-player-page">
      <header className="vp-topbar">
        <div className="vp-topbar-title">
          <h1>Media</h1>
          <p>
            {stats.total} in library · {playQueue.length} up next
          </p>
        </div>

        <div className="vp-search" ref={searchBoxRef}>
          <div className={`vp-search-bar ${showSearchPanel ? "open" : ""}`}>
            <i className="fas fa-search" aria-hidden="true" />
            <input
              type="search"
              placeholder="Search Watches & YouTube"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              aria-label="Search Watches and YouTube"
              autoComplete="off"
            />
            {searchQuery ? (
              <button
                type="button"
                className="vp-search-clear"
                onClick={() => setSearchQuery("")}
                aria-label="Clear search"
              >
                <i className="fas fa-times" />
              </button>
            ) : null}
          </div>

          {showSearchPanel ? (
            <div className="vp-search-panel" role="listbox">
              <div className="vp-scope-row">
                {[
                  { id: "all", label: "All", count: watchResults.length + youtubeResults.length, loading: watchSearching || youtubeSearching },
                  { id: "watch", label: "Watches", count: watchResults.length, loading: watchSearching },
                  { id: "youtube", label: "YouTube", count: youtubeResults.length, loading: youtubeSearching },
                ].map((scope) => (
                  <button
                    key={scope.id}
                    type="button"
                    className={`vp-scope ${searchScope === scope.id ? "active" : ""}`}
                    onClick={() => setSearchScope(scope.id)}
                  >
                    {scope.label}
                    <span className="vp-scope-count">
                      {scope.loading ? <i className="fas fa-circle-notch fa-spin" /> : scope.count}
                    </span>
                  </button>
                ))}
              </div>

              <div className="vp-search-scroll">
                {searchScope !== "youtube" ? (
                  <section className="vp-result-section">
                    <div className="vp-section-head">
                      <span className="vp-section-icon vp-section-icon-watch"><i className="fas fa-play-circle" /></span>
                      <strong>Watches</strong>
                      <small>on Connect</small>
                    </div>
                    {watchSearchError && watchResults.length === 0 ? (
                      <p className="vp-result-note error">{watchSearchError}</p>
                    ) : null}
                    {watchResults.map(renderWatchResult)}
                    {!watchSearching && !watchSearchError && watchResults.length === 0 ? (
                      <p className="vp-result-note">No Watches match “{searchQuery.trim()}”</p>
                    ) : null}
                    {watchSearching && watchResults.length === 0 ? <div className="vp-skeleton-rows"><span /><span /></div> : null}
                  </section>
                ) : null}

                {searchScope !== "watch" ? (
                  <section className="vp-result-section">
                    <div className="vp-section-head">
                      <span className="vp-section-icon vp-section-icon-yt"><i className="fab fa-youtube" /></span>
                      <strong>YouTube</strong>
                      <small>downloads to Watch</small>
                    </div>
                    {youtubeSearchError ? (
                      <p className="vp-result-note error">{youtubeSearchError}</p>
                    ) : null}
                    {youtubeResults.map(renderYoutubeResult)}
                    {!youtubeSearching && !youtubeSearchError && youtubeResults.length === 0 ? (
                      <p className="vp-result-note">No YouTube results</p>
                    ) : null}
                    {youtubeSearching && youtubeResults.length === 0 ? <div className="vp-skeleton-rows"><span /><span /></div> : null}
                  </section>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        <button
          type="button"
          className="vp-icon-btn vp-topbar-refresh"
          onClick={() => refreshLibrary({ showSpinner: true })}
          disabled={libraryLoading}
          title="Refresh library"
          aria-label="Refresh library"
        >
          <i className={`fas fa-sync-alt${libraryLoading ? " fa-spin" : ""}`} />
        </button>
      </header>

      <div className="video-player-container">
        <div className="video-player-main">
          {libraryError ? (
            <div className="vp-error-banner">
              <i className="fas fa-exclamation-circle" /> {libraryError}
            </div>
          ) : null}

          {currentVideo ? (
            <div className="video-stage">
              <div className="video-stage-frame">
                {isThisPip ? (
                  <div className="video-pip-inline-placeholder">
                    <i className="fas fa-external-link-alt" />
                    <span>Playing in pop-out mode</span>
                    <button type="button" onClick={restoreFromPip}>
                      Return here
                    </button>
                  </div>
                ) : (
                  <>
                    <video
                      ref={setVideoElementRef}
                      className="main-video"
                      controls={mediaReady}
                      playsInline
                      webkit-playsinline="true"
                      preload="auto"
                      poster={currentVideo.thumbnail || undefined}
                      onEnded={handleVideoEnd}
                      onPlay={() => setIsPlaying(true)}
                      onPause={() => {
                        if (bgApiRef.current.handingOffRef.current) return;
                        setIsPlaying(false);
                      }}
                    />
                    {!mediaReady ? (
                      <div className="video-media-cover" aria-hidden="true">
                        {currentVideo.thumbnail ? (
                          <img src={currentVideo.thumbnail} alt="" />
                        ) : null}
                        <i className="fas fa-circle-notch fa-spin video-media-spinner" />
                      </div>
                    ) : null}
                  </>
                )}
              </div>

              <div className="video-stage-body">
                <div className="video-stage-heading">
                  <div className="video-stage-title-wrap">
                    <h2 className="video-stage-title">{currentVideo.title}</h2>
                    <p className="video-stage-meta">
                      <span className="vp-badge">{getTypeLabel(currentVideo.type)}</span>
                      {getSourceLabel(currentVideo)}
                      {" · "}
                      {usingQueue ? "Up next" : "Library"} {playbackIndex + 1}/{playbackList.length}
                      {currentPlayback?.playCount > 1
                        ? ` · Repeat ${playPass}/${clampPlayCount(currentPlayback.playCount)}`
                        : ""}
                    </p>
                  </div>
                </div>

                <div className="vp-controls">
                  <div className="vp-transport">
                    <button
                      type="button"
                      className={`vp-ctrl ${isLooping ? "active" : ""}`}
                      onClick={() => {
                        setIsLooping((prev) => {
                          const next = !prev;
                          if (isThisPip) watchPip?.updatePip?.({ looping: next });
                          return next;
                        });
                      }}
                      title={isLooping ? "Repeat playlist on" : "Repeat playlist off"}
                      aria-pressed={isLooping}
                    >
                      <i className="fas fa-redo" />
                    </button>
                    <button
                      type="button"
                      className="vp-ctrl vp-ctrl-lg"
                      onClick={handlePrev}
                      disabled={playbackList.length <= 1}
                      title="Previous"
                    >
                      <i className="fas fa-step-backward" />
                    </button>
                    <button
                      type="button"
                      className="vp-play"
                      onClick={togglePlayPause}
                      title={playerIsPlaying ? "Pause" : "Play"}
                    >
                      <i className={`fas ${playerIsPlaying ? "fa-pause" : "fa-play"}`} />
                    </button>
                    <button
                      type="button"
                      className="vp-ctrl vp-ctrl-lg"
                      onClick={handleNext}
                      disabled={playbackList.length <= 1}
                      title="Next"
                    >
                      <i className="fas fa-step-forward" />
                    </button>
                    <button
                      type="button"
                      className="vp-ctrl"
                      onClick={toggleFullscreen}
                      title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                      aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                    >
                      <i className={`fas ${isFullscreen ? "fa-compress" : "fa-expand"}`} />
                    </button>
                  </div>
                  {watchPip && !isThisPip ? (
                    <button type="button" className="vp-chip-btn" onClick={minimizeToPip}>
                      <i className="fas fa-external-link-alt" /> Pop out
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          ) : (
            <div className="no-video-placeholder">
              <div className="placeholder-icon"><i className="fas fa-photo-video" /></div>
              <h3>Nothing playing yet</h3>
              <p>
                Search Watches or YouTube above, pick something from your
                library, or add a video link.
              </p>
              <div className="no-video-actions">
                <button type="button" className="vp-btn vp-btn-primary" onClick={() => setActiveTab("library")}>
                  Browse library
                </button>
                <button
                  type="button"
                  className="vp-btn vp-btn-ghost"
                  onClick={() => refreshLibrary({ showSpinner: true })}
                  disabled={libraryLoading}
                >
                  {libraryLoading ? "Refreshing…" : "Refresh"}
                </button>
              </div>
            </div>
          )}
        </div>

        <aside className="video-player-sidebar-column">
          <div className="vp-tabs" role="tablist">
            {[
              { id: "queue", label: "Up next", icon: "fa-list-ol" },
              { id: "library", label: "Library", icon: "fa-photo-video" },
              { id: "saved", label: "Playlists", icon: "fa-layer-group" },
              { id: "add", label: "Add", icon: "fa-plus" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                className={`vp-tab ${activeTab === tab.id ? "active" : ""}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <i className={`fas ${tab.icon}`} aria-hidden="true" />
                <span>{tab.label}</span>
                {tabCounts[tab.id] ? <em>{tabCounts[tab.id]}</em> : null}
              </button>
            ))}
          </div>

          {activeTab === "queue" ? (
            <div className="vp-panel">
              <div className="vp-panel-head">
                <div>
                  <h2>Up next</h2>
                  <p>Set how many times each video plays before moving on.</p>
                </div>
                {playQueue.length > 0 ? (
                  <button type="button" className="vp-chip-btn" onClick={clearPlayQueue}>
                    <i className="fas fa-broom" /> Clear
                  </button>
                ) : null}
              </div>
              {playQueue.length > 1 ? (
                <p className="vp-hint">
                  {useTouchReorder ? "Use the arrows to reorder" : "Drag items to reorder"}
                </p>
              ) : null}
              {playQueue.length > 0 ? (
                <div className="playlist-items">
                  {playQueue.map((item, index) => {
                    const isCurrent = usingQueue && index === queueIndex;
                    return (
                      <div
                        key={item.queueId}
                        className={`playlist-item ${isCurrent ? "active" : ""} ${queueDragIndex === index ? "dragging" : ""}`}
                        draggable={canDragQueue}
                        onDragStart={() => handleQueueDragStart(index)}
                        onDragOver={(e) => handleQueueDragOver(e, index)}
                        onDrop={() => handleQueueDrop(index)}
                        onDragEnd={() => setQueueDragIndex(null)}
                        onClick={() => handlePlayQueueItem(index)}
                      >
                        {canDragQueue ? (
                          <span className="playlist-drag-handle" title="Drag to reorder">
                            <i className="fas fa-grip-vertical" />
                          </span>
                        ) : null}
                        {useTouchReorder && playQueue.length > 1 ? (
                          <div className="playlist-reorder-btns">
                            <button
                              type="button"
                              className="playlist-reorder-btn"
                              disabled={index === 0}
                              onClick={(e) => moveQueueItem(index, "up", e)}
                              aria-label="Move playlist item up"
                            >
                              <i className="fas fa-chevron-up" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              className="playlist-reorder-btn"
                              disabled={index === playQueue.length - 1}
                              onClick={(e) => moveQueueItem(index, "down", e)}
                              aria-label="Move playlist item down"
                            >
                              <i className="fas fa-chevron-down" aria-hidden="true" />
                            </button>
                          </div>
                        ) : null}
                        <div className="playlist-item-thumbnail">
                          {item.thumbnail ? (
                            <img src={item.thumbnail} alt="" loading="lazy" />
                          ) : (
                            <span className="play-number">{index + 1}</span>
                          )}
                          {isCurrent ? (
                            <span className="playlist-item-now">
                              <i className={`fas ${playerIsPlaying ? "fa-volume-up" : "fa-pause"}`} />
                            </span>
                          ) : null}
                        </div>
                        <div className="playlist-item-info">
                          <div className="playlist-item-title">{item.title}</div>
                          <div className="playlist-item-type">
                            {isCurrent
                              ? `Now playing · ${playPass} of ${clampPlayCount(item.playCount)}`
                              : `${getTypeLabel(item.type)} · plays ${clampPlayCount(item.playCount)}×`}
                          </div>
                          {youtubeDownload?.queueId === item.queueId ? (
                            <div className="video-player-download-progress" role="status">
                              <div className="video-player-download-progress-header">
                                <strong>{youtubeDownload.percent}%</strong>
                                <small className={youtubeDownload.error ? "error" : ""}>
                                  {youtubeDownload.error || youtubeDownload.stage}
                                </small>
                              </div>
                              <div className={`video-player-download-track ${youtubeDownload.error ? "error" : ""}`}>
                                <span style={{ width: `${Math.min(100, Math.max(0, youtubeDownload.percent))}%` }} />
                              </div>
                            </div>
                          ) : null}
                        </div>
                        <div
                          className="playlist-repeat-control"
                          onClick={(e) => e.stopPropagation()}
                          onPointerDown={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            className="playlist-repeat-btn"
                            disabled={item.playCount <= MIN_PLAY_COUNT}
                            onClick={() => updateQueuePlayCount(item.queueId, item.playCount - 1)}
                            aria-label="Play fewer times"
                          >
                            <i className="fas fa-minus" />
                          </button>
                          <input
                            type="number"
                            min={MIN_PLAY_COUNT}
                            max={MAX_PLAY_COUNT}
                            className="playlist-repeat-input"
                            value={item.playCount}
                            aria-label="Times to play this video"
                            onChange={(e) => updateQueuePlayCount(item.queueId, e.target.value)}
                          />
                          <button
                            type="button"
                            className="playlist-repeat-btn"
                            disabled={item.playCount >= MAX_PLAY_COUNT}
                            onClick={() => updateQueuePlayCount(item.queueId, item.playCount + 1)}
                            aria-label="Play more times"
                          >
                            <i className="fas fa-plus" />
                          </button>
                        </div>
                        <button
                          type="button"
                          className="vp-icon-btn vp-icon-btn-quiet"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFromPlayQueue(item.queueId);
                          }}
                          title="Remove from Up next"
                          aria-label="Remove from Up next"
                        >
                          <i className="fas fa-times" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="playlist-empty">
                  <i className="fas fa-stream" />
                  <p>Your queue is empty</p>
                  <p className="playlist-empty-hint">Search above or add videos from your library.</p>
                  <button type="button" className="vp-btn vp-btn-soft" onClick={() => setActiveTab("library")}>
                    Open library
                  </button>
                </div>
              )}
            </div>
          ) : null}

          {activeTab === "saved" ? (
            <div className="vp-panel">
              <div className="vp-panel-head">
                <div>
                  <h2>Saved playlists</h2>
                  <p>Synced across all your devices.</p>
                </div>
              </div>
              {myProfileId ? (
                <>
                  <form
                    className="playlist-save-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      saveCurrentPlaylist();
                    }}
                  >
                    <input
                      type="text"
                      className="vp-input"
                      placeholder={playQueue.length ? "Name this queue…" : "Add videos to Up next first"}
                      value={playlistName}
                      maxLength={120}
                      disabled={playQueue.length === 0}
                      onChange={(e) => setPlaylistName(e.target.value)}
                    />
                    <button
                      type="submit"
                      className="vp-btn vp-btn-primary"
                      disabled={!playlistName.trim() || playQueue.length === 0 || savingPlaylist}
                    >
                      {savingPlaylist ? "Saving…" : "Save"}
                    </button>
                  </form>
                  {savedPlaylists.length > 0 ? (
                    <div className="saved-playlist-list">
                      {savedPlaylists.map((playlist) => (
                        <div className="saved-playlist-row" key={playlist._id}>
                          <button
                            type="button"
                            className="saved-playlist-load"
                            onClick={() => {
                              loadNamedPlaylist(playlist);
                              setActiveTab("queue");
                            }}
                          >
                            <span className="saved-playlist-icon"><i className="fas fa-list" /></span>
                            <span className="saved-playlist-text">
                              <strong>{playlist.name}</strong>
                              <span>{playlist.items?.length || 0} videos · click to load</span>
                            </span>
                          </button>
                          <button
                            type="button"
                            className="vp-icon-btn vp-icon-btn-quiet"
                            onClick={() => removeNamedPlaylist(playlist)}
                            title="Delete saved playlist"
                            aria-label={`Delete ${playlist.name}`}
                          >
                            <i className="far fa-trash-alt" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="playlist-empty">
                      <i className="fas fa-layer-group" />
                      <p className="playlist-empty-hint">No saved playlists yet. Name your current queue to save it.</p>
                    </div>
                  )}
                </>
              ) : (
                <p className="vp-hint">Sign in to save playlists across devices.</p>
              )}
            </div>
          ) : null}

          {activeTab === "library" ? (
            <div className="vp-panel">
              <div className="vp-panel-head">
                <div>
                  <h2>Library</h2>
                  <p>
                    {stats.watches} watches · {stats.saved} saved · {stats.custom} custom
                  </p>
                </div>
                {filteredVideos.length > 0 ? (
                  <button
                    type="button"
                    className="vp-chip-btn accent"
                    onClick={() => filteredVideos.forEach((video) => addToPlayQueue(video))}
                  >
                    <i className="fas fa-plus" /> Add all
                  </button>
                ) : null}
              </div>

              <div className="vp-library-controls">
                <div className="vp-filter-input">
                  <i className="fas fa-filter" aria-hidden="true" />
                  <input
                    type="text"
                    placeholder="Filter your library"
                    value={libraryQuery}
                    onChange={(e) => {
                      setLibraryQuery(e.target.value);
                      setCurrentVideoIndex(0);
                    }}
                    aria-label="Filter library"
                  />
                  {libraryQuery ? (
                    <button type="button" onClick={() => setLibraryQuery("")} aria-label="Clear filter">
                      <i className="fas fa-times" />
                    </button>
                  ) : null}
                </div>
                <select
                  className="vp-select"
                  value={sortMode}
                  onChange={handleSortChange}
                  aria-label="Sort library"
                >
                  {SORT_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="video-player-filters">
                {FILTER_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    className={`video-player-filter-btn ${filter === opt.id ? "active" : ""}`}
                    onClick={() => {
                      setFilter(opt.id);
                      setCurrentVideoIndex(0);
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {sortMode === "custom" && filteredVideos.length > 1 ? (
                <p className="vp-hint">
                  {useTouchReorder ? "Use the arrows to reorder" : "Drag items to reorder"}
                </p>
              ) : null}

              {libraryLoading && filteredVideos.length === 0 ? (
                <div className="vp-skeleton-rows"><span /><span /><span /></div>
              ) : filteredVideos.length > 0 ? (
                <div className="playlist-items">
                  {filteredVideos.map((video, index) => {
                    const isCurrent =
                      (!usingQueue && index === currentVideoIndex) ||
                      (usingQueue && currentPlayback?.videoId === video.id);
                    return (
                      <div
                        key={video.id}
                        className={`playlist-item ${isCurrent ? "active" : ""} ${dragIndex === index ? "dragging" : ""}`}
                        draggable={canDragReorder}
                        onDragStart={() => handleDragStart(index)}
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDrop={() => handleDrop(index)}
                        onDragEnd={() => setDragIndex(null)}
                        onClick={() => handlePlayVideo(index)}
                      >
                        {sortMode === "custom" && canDragReorder ? (
                          <span className="playlist-drag-handle" title="Drag to reorder">
                            <i className="fas fa-grip-vertical" />
                          </span>
                        ) : null}
                        {sortMode === "custom" && useTouchReorder ? (
                          <div className="playlist-reorder-btns">
                            <button
                              type="button"
                              className="playlist-reorder-btn"
                              disabled={index === 0}
                              onClick={(e) => movePlaylistItem(index, "up", e)}
                              aria-label="Move video up"
                            >
                              <i className="fas fa-chevron-up" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              className="playlist-reorder-btn"
                              disabled={index === filteredVideos.length - 1}
                              onClick={(e) => movePlaylistItem(index, "down", e)}
                              aria-label="Move video down"
                            >
                              <i className="fas fa-chevron-down" aria-hidden="true" />
                            </button>
                          </div>
                        ) : null}
                        <div className="playlist-item-thumbnail wide">
                          {video.thumbnail ? (
                            <img src={video.thumbnail} alt="" loading="lazy" />
                          ) : (
                            <i className="fas fa-film" />
                          )}
                          {isCurrent ? (
                            <span className="playlist-item-now">
                              <i className={`fas ${playerIsPlaying ? "fa-volume-up" : "fa-pause"}`} />
                            </span>
                          ) : null}
                        </div>
                        <div className="playlist-item-info">
                          <div className="playlist-item-title">{video.title}</div>
                          <div className="playlist-item-type">
                            <i className={`fas ${video.online === false ? "fa-hdd" : "fa-cloud"}`} />{" "}
                            {getSourceLabel(video)}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="vp-icon-btn vp-icon-btn-accent"
                          onClick={(e) => {
                            e.stopPropagation();
                            addToPlayQueue(video);
                          }}
                          title="Add to Up next"
                          aria-label="Add to Up next"
                        >
                          <i className="fas fa-plus" />
                        </button>
                        {(video.type === "url" || video.type === "file") && (
                          <button
                            type="button"
                            className="vp-icon-btn vp-icon-btn-quiet"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveVideo(video);
                            }}
                            title="Remove video"
                            aria-label="Remove video"
                          >
                            <i className="fas fa-times" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="playlist-empty">
                  <i className="fas fa-search" />
                  <p>No videos match</p>
                  <p className="playlist-empty-hint">
                    Try another filter, or search Watches &amp; YouTube at the top.
                  </p>
                </div>
              )}
            </div>
          ) : null}

          {activeTab === "add" ? (
            <div className="vp-panel">
              <div className="vp-panel-head">
                <div>
                  <h2>Add a video</h2>
                  <p>Paste a direct link or pick a file from this device.</p>
                </div>
              </div>
              <button
                type="button"
                className="vp-upload-tile"
                onClick={() => fileInputRef.current?.click()}
              >
                <span className="vp-upload-icon"><i className="fas fa-file-upload" /></span>
                <span className="vp-upload-text">
                  <strong>Choose from device</strong>
                  <small>MP4, MOV, WEBM and more</small>
                </span>
                <i className="fas fa-chevron-right" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                onChange={(e) => {
                  handleFileUpload(e);
                  setActiveTab("queue");
                }}
                style={{ display: "none" }}
              />
              <div className="vp-divider"><span>or from a link</span></div>
              <form
                className="vp-add-form"
                onSubmit={(e) => {
                  handleAddVideo(e);
                  if (videoUrl.trim()) setActiveTab("queue");
                }}
              >
                <label className="vp-field">
                  <span>Video URL</span>
                  <input
                    type="url"
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    placeholder="https://example.com/video.mp4"
                    className="vp-input"
                  />
                </label>
                <label className="vp-field">
                  <span>Title (optional)</span>
                  <input
                    type="text"
                    value={videoTitle}
                    onChange={(e) => setVideoTitle(e.target.value)}
                    placeholder="Give it a name"
                    className="vp-input"
                  />
                </label>
                <button type="submit" className="vp-btn vp-btn-primary vp-btn-block" disabled={!videoUrl.trim()}>
                  <i className="fas fa-link" /> Add to Up next
                </button>
              </form>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
};

export default VideoPlayer;
