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
} from "../utils/videoPlayerLibrary";
import useMediaSession from "../hooks/useMediaSession";
import useBackgroundAudioHandoff from "../hooks/useBackgroundAudioHandoff";

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
  const [watchVideos, setWatchVideos] = useState([]);
  const [savedVideos, setSavedVideos] = useState([]);
  const [libraryLoading, setLibraryLoading] = useState(true);
  const [libraryError, setLibraryError] = useState("");

  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [videoUrl, setVideoUrl] = useState("");
  const [videoTitle, setVideoTitle] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLooping, setIsLooping] = useState(false);
  const [filter, setFilter] = useState("all");
  const [sortMode, setSortMode] = useState("custom");
  const [searchQuery, setSearchQuery] = useState("");
  const [playlistOrder, setPlaylistOrder] = useState(() => loadPlaylistOrder());
  const [playQueue, setPlayQueue] = useState(() => loadPlayQueue());
  const [queueIndex, setQueueIndex] = useState(0);
  const [playPass, setPlayPass] = useState(1);
  const [dragIndex, setDragIndex] = useState(null);
  const [queueDragIndex, setQueueDragIndex] = useState(null);

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
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [mediaReady, setMediaReady] = useState(false);
  const [mediaElement, setMediaElement] = useState(null);

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
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((v) => v.title.toLowerCase().includes(q));
    }
    return sortPlaylist(list, sortMode, playlistOrder);
  }, [allVideos, filter, searchQuery, sortMode, playlistOrder]);

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
  const backgroundAudio = useBackgroundAudioHandoff(videoRef, {
    src: currentVideo?.url,
    enabled: !!currentVideo?.url && !isThisPip,
  });

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

  const refreshLibrary = useCallback(async () => {
    setLibraryLoading(true);
    setLibraryError("");
    try {
      const [watches, saved] = await Promise.all([
        loadWatchPlaylistItems(myProfileId),
        loadSavedPlaylistItems(),
      ]);
      setWatchVideos(watches);
      setSavedVideos(saved);
    } catch (err) {
      console.error(err);
      setLibraryError("Could not refresh some video sources.");
    } finally {
      setLibraryLoading(false);
    }
  }, [myProfileId]);

  useEffect(() => {
    refreshLibrary();
  }, [refreshLibrary]);

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
    if (!video) return;
    video.currentTime = 0;
    video.play().catch(() => {});
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
      setIsPlaying(false);
      return;
    }

    setPlaybackIndex(nextIndex);
  }, [
    playPass,
    playbackList.length,
    playbackIndex,
    isLooping,
    replayCurrent,
    setPlaybackIndex,
  ]);

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
    if (playbackList.length <= 1) return;
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
  ]);

  const handleNext = useCallback(() => {
    if (playbackList.length <= 1) return;
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
  ]);

  const addToPlayQueue = useCallback((video, playCount = MIN_PLAY_COUNT) => {
    const item = videoToQueueItem(video, playCount);
    if (!item) return;
    setPlayQueue((prev) => {
      const wasEmpty = prev.length === 0;
      if (wasEmpty) {
        setQueueIndex(0);
        setPlayPass(1);
      }
      return [...prev, item];
    });
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
    const q = searchQuery.trim().toLowerCase();
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
        .playBackgroundAudio({ unmuted: true })
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
    : isPlaying;

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

  useMediaSession({
    enabled: !!currentVideo && !isThisPip,
    metadata: currentVideo
      ? {
          title: currentVideo.title,
          artist: getSourceLabel(currentVideo),
          album: "Connect Watch Library",
          artwork: mediaArtwork,
        }
      : null,
    playbackState: isPlaying ? "playing" : "paused",
    positionState: {
      duration,
      position: currentTime,
      playbackRate,
    },
    handlers: mediaSessionHandlers,
  });

  return (
    <div className="video-player-page">
      <div className="video-player-container">
        <div className="video-player-main">
          <div className="video-player-header">
            <h1>Video Player</h1>

          </div>

          <div className="video-player-stats">
            <span>{stats.total} total</span>
            <span>{stats.watches} watches</span>
            <span>{stats.saved} saved</span>
            <span>{stats.custom} custom</span>
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              onClick={refreshLibrary}
              disabled={libraryLoading}
            >
              {libraryLoading ? "Refreshing…" : "Refresh library"}
            </button>
          </div>

          {libraryError ? (
            <p className="video-player-error">{libraryError}</p>
          ) : null}

          {currentVideo ? (
            <div className="video-stage">
              <div className="video-stage-header">
                <div className="video-stage-title-wrap">
                  <h3 className="video-stage-title">{currentVideo.title}</h3>
                  <p className="video-stage-meta">
                    {getSourceLabel(currentVideo)}
                    {" · "}
                    {usingQueue ? "Playlist" : "Library"} {playbackIndex + 1} of{" "}
                    {playbackList.length}
                    {currentPlayback?.playCount > 1
                      ? ` · Repeat ${playPass}/${clampPlayCount(currentPlayback.playCount)}`
                      : ""}
                  </p>
                </div>
                <span className="video-stage-badge">
                  {getTypeLabel(currentVideo.type)}
                </span>
              </div>

              <div className="video-stage-frame">
                {isThisPip ? (
                  <div className="video-pip-inline-placeholder">
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
                        if (backgroundAudio.handingOffRef.current) return;
                        if (
                          document.hidden &&
                          backgroundAudio.wantPlayingRef.current
                        ) {
                          return;
                        }
                        setIsPlaying(false);
                      }}
                    />
                    {!mediaReady ? (
                      <div className="video-media-cover" aria-hidden="true">
                        {currentVideo.thumbnail ? (
                          <img src={currentVideo.thumbnail} alt="" />
                        ) : (
                          <i className="fas fa-spinner fa-spin" />
                        )}
                      </div>
                    ) : null}
                  </>
                )}
              </div>

              <div className="video-stage-toolbar">
                <button
                  type="button"
                  className="video-tool-btn"
                  onClick={handlePrev}
                  disabled={playbackList.length <= 1}
                  title="Previous"
                >
                  <i className="fas fa-step-backward" />
                </button>
                <button
                  type="button"
                  className="video-tool-btn video-tool-btn-primary"
                  onClick={togglePlayPause}
                  title={playerIsPlaying ? "Pause" : "Play"}
                >
                  <i
                    className={`fas ${playerIsPlaying ? "fa-pause" : "fa-play"}`}
                  />
                </button>
                <button
                  type="button"
                  className="video-tool-btn"
                  onClick={handleNext}
                  disabled={playbackList.length <= 1}
                  title="Next"
                >
                  <i className="fas fa-step-forward" />
                </button>
                <button
                  type="button"
                  className={`video-tool-btn ${isLooping ? "active" : ""}`}
                  onClick={() => {
                    setIsLooping((prev) => {
                      const next = !prev;
                      if (isThisPip) watchPip?.updatePip?.({ looping: next });
                      return next;
                    });
                  }}
                  title={
                    isLooping
                      ? "Repeat playlist on"
                      : "Repeat playlist off"
                  }
                >
                  <i className="fas fa-redo" />
                </button>
                {watchPip && !isThisPip && (
                  <button
                    type="button"
                    className="video-tool-btn"
                    onClick={minimizeToPip}
                    title="Pop out"
                  >
                    <i className="fas fa-external-link-alt" />
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="no-video-placeholder">
              <div className="placeholder-icon">🎬</div>
              <h3>No videos in library</h3>
              <p>
                Add a URL, upload a file, or save/download videos to populate
                your playlist
              </p>
            </div>
          )}
        </div>

        <div className="video-player-sidebar-column">
          <div className="video-playlist-sidebar video-play-queue">
            <div className="playlist-header">
              <h2>Playlist</h2>
              <span className="playlist-count">{playQueue.length} videos</span>
            </div>
            <p className="video-player-sort-hint">
              Add clips, then set how many times each one plays before the next
              video starts.
            </p>
            {playQueue.length > 0 ? (
              <div className="playlist-queue-actions">
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  onClick={clearPlayQueue}
                >
                  Clear playlist
                </button>
              </div>
            ) : null}
            {playQueue.length > 1 ? (
              <p className="video-player-sort-hint">
                {useTouchReorder
                  ? "Use the arrow buttons to reorder the playlist"
                  : "Drag items to reorder"}
              </p>
            ) : null}
            {playQueue.length > 0 ? (
              <div className="playlist-items">
                {playQueue.map((item, index) => (
                  <div
                    key={item.queueId}
                    className={`playlist-item ${usingQueue && index === queueIndex ? "active" : ""} ${queueDragIndex === index ? "dragging" : ""}`}
                    draggable={canDragQueue}
                    onDragStart={() => handleQueueDragStart(index)}
                    onDragOver={(e) => handleQueueDragOver(e, index)}
                    onDrop={() => handleQueueDrop(index)}
                    onDragEnd={() => setQueueDragIndex(null)}
                    onClick={() => handlePlayQueueItem(index)}
                  >
                    {canDragQueue ? (
                      <span
                        className="playlist-drag-handle"
                        title="Drag to reorder"
                      >
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
                          <i
                            className="fas fa-chevron-down"
                            aria-hidden="true"
                          />
                        </button>
                      </div>
                    ) : null}
                    <div className="playlist-item-thumbnail">
                      {item.thumbnail ? (
                        <img src={item.thumbnail} alt="" />
                      ) : usingQueue &&
                        index === queueIndex &&
                        playerIsPlaying ? (
                        <div className="playing-indicator">▶</div>
                      ) : (
                        <div className="play-number">{index + 1}</div>
                      )}
                    </div>
                    <div className="playlist-item-info">
                      <div className="playlist-item-title">{item.title}</div>
                      <div className="playlist-item-type">
                        {usingQueue && index === queueIndex
                          ? `Playing ${playPass} of ${clampPlayCount(item.playCount)}`
                          : `Play ${clampPlayCount(item.playCount)} time${clampPlayCount(item.playCount) === 1 ? "" : "s"}`}
                      </div>
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
                        onClick={() =>
                          updateQueuePlayCount(item.queueId, item.playCount - 1)
                        }
                        aria-label="Play fewer times"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min={MIN_PLAY_COUNT}
                        max={MAX_PLAY_COUNT}
                        className="playlist-repeat-input"
                        value={item.playCount}
                        aria-label="Times to play this video"
                        onChange={(e) =>
                          updateQueuePlayCount(item.queueId, e.target.value)
                        }
                      />
                      <button
                        type="button"
                        className="playlist-repeat-btn"
                        disabled={item.playCount >= MAX_PLAY_COUNT}
                        onClick={() =>
                          updateQueuePlayCount(item.queueId, item.playCount + 1)
                        }
                        aria-label="Play more times"
                      >
                        +
                      </button>
                    </div>
                    <button
                      type="button"
                      className="playlist-item-remove"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFromPlayQueue(item.queueId);
                      }}
                      title="Remove from playlist"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="playlist-empty">
                <p>Playlist is empty</p>
                <p className="playlist-empty-hint">
                  Add videos from the library below, or paste a URL
                </p>
              </div>
            )}
          </div>

          <div className="video-playlist-sidebar">
            <div className="playlist-header">
              <h2>Library</h2>
              <div className="playlist-header-actions">
                <span className="playlist-count">
                  {filteredVideos.length} videos
                </span>
                {filteredVideos.length > 0 ? (
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    onClick={() =>
                      filteredVideos.forEach((video) => addToPlayQueue(video))
                    }
                  >
                    Add all
                  </button>
                ) : null}
              </div>
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

            <div className="video-player-list-controls">
              <input
                type="text"
                className="form-input video-player-search"
                placeholder="Search library…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <label className="video-player-sort-label">
                <span className="video-player-sort-text">Sort by</span>
                <select
                  className="form-input video-player-sort"
                  value={sortMode}
                  onChange={handleSortChange}
                  aria-label="Sort playlist"
                >
                  {SORT_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {sortMode === "custom" && filteredVideos.length > 1 ? (
              <p className="video-player-sort-hint">
                {useTouchReorder
                  ? "Use the arrow buttons to reorder videos"
                  : "Drag items to reorder"}
              </p>
            ) : null}

            {libraryLoading && filteredVideos.length === 0 ? (
              <div className="playlist-empty">
                <p>Loading your videos…</p>
              </div>
            ) : filteredVideos.length > 0 ? (
              <div className="playlist-items">
                {filteredVideos.map((video, index) => (
                  <div
                    key={video.id}
                    className={`playlist-item ${(!usingQueue && index === currentVideoIndex) || (usingQueue && currentPlayback?.videoId === video.id) ? "active" : ""} ${dragIndex === index ? "dragging" : ""}`}
                    draggable={canDragReorder}
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDrop={() => handleDrop(index)}
                    onDragEnd={() => setDragIndex(null)}
                    onClick={() => handlePlayVideo(index)}
                  >
                    {sortMode === "custom" && canDragReorder ? (
                      <span
                        className="playlist-drag-handle"
                        title="Drag to reorder"
                      >
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
                          <i
                            className="fas fa-chevron-down"
                            aria-hidden="true"
                          />
                        </button>
                      </div>
                    ) : null}
                    <div className="playlist-item-thumbnail">
                      {video.thumbnail ? (
                        <img src={video.thumbnail} alt="" />
                      ) : !usingQueue &&
                        index === currentVideoIndex &&
                        playerIsPlaying ? (
                        <div className="playing-indicator">▶</div>
                      ) : (
                        <div className="play-number">{index + 1}</div>
                      )}
                    </div>
                    <div className="playlist-item-info">
                      <div className="playlist-item-title">{video.title}</div>
                      <div className="playlist-item-type">
                        {getSourceLabel(video)}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="playlist-add-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        addToPlayQueue(video);
                      }}
                      title="Add to playlist"
                    >
                      Add
                    </button>
                    {(video.type === "url" || video.type === "file") && (
                      <button
                        type="button"
                        className="playlist-item-remove"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveVideo(video);
                        }}
                        title="Remove video"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="playlist-empty">
                <p>No videos match this filter</p>
                <p className="playlist-empty-hint">
                  Try All or Server, or refresh the library
                </p>
              </div>
            )}
          </div>

          <div className="add-video-form">
            <h3>Add custom video</h3>
            <form onSubmit={handleAddVideo}>
              <div className="form-group">
                <label>Video title (optional)</label>
                <input
                  type="text"
                  value={videoTitle}
                  onChange={(e) => setVideoTitle(e.target.value)}
                  placeholder="Enter video title"
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label>Video URL</label>
                <input
                  type="url"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="https://example.com/video.mp4"
                  className="form-input"
                />
              </div>
              <div className="form-actions">
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={!videoUrl.trim()}
                >
                  Add from URL
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="btn btn-secondary"
                >
                  Upload file
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*"
                  onChange={handleFileUpload}
                  style={{ display: "none" }}
                />
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoPlayer;
