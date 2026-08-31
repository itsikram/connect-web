import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  showSuccessToast,
  showErrorToast,
  showInfoToast,
} from "../utils/toastUtils";
import axios from "axios";
import {
  getYtDownloadApiUrl,
  isOffline,
  normalizeServerUrl,
} from "../utils/offlineUtils";
import { saveVideoFromUrl } from "../utils/useSavedVideos";
import { useAuth } from "../hooks/useAuth";
import { useLocation } from "react-router-dom";
import VideoDownloadModal from "../components/modal/VideoDownloadModal";
import "./YtDownload.css";

const getYTDownloadAPI = () => normalizeServerUrl(getYtDownloadApiUrl());

const toSecureProgressUrl = (url) =>
  normalizeServerUrl(String(url || "").split("?")[0]);

const resolveProgressUrl = (json) => {
  const apiBase = getYTDownloadAPI();
  if (json?.progress_id) {
    return `${apiBase}/progress/${json.progress_id}`;
  }
  if (typeof json?.progress_url === "string" && json.progress_url.length > 0) {
    return toSecureProgressUrl(json.progress_url);
  }
  return null;
};

const QUALITY_OPTIONS = [
  { label: "Best — up to 4K + HQ audio", value: 2160 },
  { label: "1440p + HQ audio", value: 1440 },
  { label: "1080p Full HD + HQ audio", value: 1080 },
  { label: "720p", value: 720 },
  { label: "480p", value: 480 },
  { label: "360p", value: 360 },
  { label: "240p", value: 240 },
];

const createClientJobId = () =>
  `job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const parseYoutubeUrls = (text) =>
  String(text || "")
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);

const YOUTUBE_CLIENT_API_KEY = String(
  process.env.REACT_APP_YOUTUBE_API_KEY || "",
).trim();

const decodeYoutubeHtml = (value) => {
  if (!value) return "";
  const el = document.createElement("textarea");
  el.innerHTML = value;
  return el.value.trim();
};

const mapYoutubeSearchItems = (items) =>
  (items || [])
    .filter((item) => item?.id?.videoId)
    .map((item) => {
      const videoId = item.id.videoId;
      const snippet = item.snippet || {};
      const thumbs = snippet.thumbnails || {};
      return {
        videoId,
        title: decodeYoutubeHtml(snippet.title) || "Untitled",
        channelTitle: decodeYoutubeHtml(snippet.channelTitle),
        thumbnail:
          thumbs.medium?.url ||
          thumbs.high?.url ||
          thumbs.default?.url ||
          `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        url: `https://www.youtube.com/watch?v=${videoId}`,
      };
    });

const searchYouTubeFromClient = async (query, signal) => {
  const params = new URLSearchParams({
    part: "snippet",
    type: "video",
    maxResults: "12",
    q: query,
    key: YOUTUBE_CLIENT_API_KEY,
  });
  const response = await fetch(
    `https://www.googleapis.com/youtube/v3/search?${params.toString()}`,
    { signal },
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      data?.error?.message || `YouTube search failed (${response.status})`,
    );
  }
  return mapYoutubeSearchItems(data.items);
};

const YtDownload = () => {
  const { isAuthenticated, token } = useAuth();
  const location = useLocation();
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [selectedQuality, setSelectedQuality] = useState(2160);
  const [postAsWatch, setPostAsWatch] = useState(true);
  const [audioOnly, setAudioOnly] = useState(false);
  const [activeJobs, setActiveJobs] = useState([]);
  const [downloadHistory, setDownloadHistory] = useState([]);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [completedDownload, setCompletedDownload] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [selectedSearchVideoId, setSelectedSearchVideoId] = useState(null);

  const pollersRef = useRef(new Map());
  const completedRef = useRef(new Set());
  const slowNotifyRef = useRef(new Set());
  const pollInFlightRef = useRef(new Set());
  const searchAbortRef = useRef(null);

  useEffect(() => {
    return () => {
      pollersRef.current.forEach((intervalId) => clearInterval(intervalId));
      pollersRef.current.clear();
      searchAbortRef.current?.abort();
    };
  }, []);

  const getAuthHeaders = useCallback(() => {
    const headers = { Accept: "application/json" };
    if (token) {
      headers.Authorization = token;
    }
    return headers;
  }, [token]);

  const buildDownloadUrl = (
    url,
    height,
    shouldPostAsWatch = true,
    isAudioOnly = false,
  ) => {
    try {
      if (isOffline()) {
        showErrorToast(
          "YouTube download is not available offline. Please connect to the internet.",
          {
            title: "Offline Mode",
          },
        );
        return null;
      }

      const normalized = (url || "").replace(
        "m.youtube.com",
        "www.youtube.com",
      );
      const encoded = encodeURIComponent(normalized);
      const heightParam = !isAudioOnly && height ? `&height=${height}` : "";
      const watchParam = `&post_as_watch=${shouldPostAsWatch && !isAudioOnly ? "true" : "false"}`;
      const audioParam = isAudioOnly ? "&audio_only=true" : "";
      const ext = isAudioOnly ? "mp3" : "mp4";
      const apiUrl = getYTDownloadAPI();
      return `${apiUrl}/download?url=${encoded}&ext=${ext}${heightParam}&disposition=inline&link_only=true&async_job=true${watchParam}${audioParam}`;
    } catch (e) {
      console.error("Error building download URL:", e);
      return null;
    }
  };

  const sanitizeFileName = (name) => {
    if (!name || name === "video") return "video";
    let cleanName = name.replace(/\.[^/.]+$/, "");
    cleanName = cleanName.replace(/_/g, " ");
    cleanName = cleanName
      .replace(/[^a-zA-Z0-9. -]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .replace(/\s+/g, " ")
      .trim();
    return cleanName.substring(0, 100) || "video";
  };

  const extractFileNameFromUrl = (url) => {
    try {
      if (!url) return null;
      const urlObj = new URL(url);
      let pathPart = urlObj.pathname || "";
      if (pathPart.endsWith("/")) pathPart = pathPart.replace(/\/+$/, "");
      let filename = pathPart.split("/").pop() || "";
      try {
        filename = decodeURIComponent(filename);
      } catch (_) {}
      filename = filename.replace(/\.(mp4|mp3|m4a|webm|mkv|opus)$/i, "");
      if (!filename || filename.length < 3) return null;
      return filename;
    } catch (e) {
      console.error("Error extracting filename from URL:", e);
      return null;
    }
  };

  const extractYouTubeVideoId = (url) => {
    try {
      const normalized = String(url || "").replace(
        "m.youtube.com",
        "www.youtube.com",
      );
      const u = new URL(normalized);
      if (u.hostname.includes("youtu.be")) {
        return u.pathname.replace(/^\//, "").split("/")[0] || null;
      }
      const fromQuery = u.searchParams.get("v");
      if (fromQuery) return fromQuery;
      const shortsMatch = u.pathname.match(/\/shorts\/([^/?]+)/);
      return shortsMatch ? shortsMatch[1] : null;
    } catch (_) {
      return null;
    }
  };

  const validateYouTubeUrl = (url) => {
    if (!url) return false;
    const patterns = [
      /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\/.+/i,
      /^https?:\/\/m\.youtube\.com\/.+/i,
    ];
    return patterns.some((pattern) => pattern.test(url));
  };

  const updateJob = useCallback((clientId, patch) => {
    setActiveJobs((prev) =>
      prev.map((job) =>
        job.clientId === clientId ? { ...job, ...patch } : job,
      ),
    );
  }, []);

  const stopPolling = useCallback((clientId) => {
    const intervalId = pollersRef.current.get(clientId);
    if (intervalId) {
      clearInterval(intervalId);
      pollersRef.current.delete(clientId);
    }
  }, []);

  const removeJob = useCallback(
    (clientId) => {
      stopPolling(clientId);
      slowNotifyRef.current.delete(clientId);
      pollInFlightRef.current.delete(clientId);
      setActiveJobs((prev) => prev.filter((job) => job.clientId !== clientId));
    },
    [stopPolling],
  );

  const handleDownloadComplete = useCallback(
    (job, fileUrl, title, watchPosted, watchId, openModal) => {
      const completionKey = job.progressId || job.clientId;
      if (completedRef.current.has(completionKey)) return;
      completedRef.current.add(completionKey);

      const finalTitle = title || extractFileNameFromUrl(fileUrl) || "video";
      const fileName = `${sanitizeFileName(finalTitle)}.${job.audioOnly ? "mp3" : "mp4"}`;
      const sourceUrl = job.url;
      const ytVideoId = extractYouTubeVideoId(sourceUrl);
      const saveId =
        watchId || (ytVideoId ? `yt-${ytVideoId}` : `yt-${Date.now()}`);

      setDownloadHistory((prev) => [
        {
          id: Date.now(),
          fileName,
          url: fileUrl,
          timestamp: new Date().toISOString(),
          audioOnly: !!job.audioOnly,
        },
        ...prev,
      ]);

      if (openModal) {
        setCompletedDownload({
          fileName,
          fileUrl,
          title: finalTitle,
          watchPosted: !!watchPosted,
        });
        setShowDownloadModal(true);
      }

      const savedMetadata = {
        _id: saveId,
        caption: finalTitle,
        thumbnail: ytVideoId
          ? `https://i.ytimg.com/vi/${ytVideoId}/hqdefault.jpg`
          : "",
        source: "youtube",
        youtubeUrl: sourceUrl,
      };

      saveVideoFromUrl(saveId, fileUrl, savedMetadata, { silent: true }).catch(
        (err) => {
          console.error("Failed to save to Saved Videos:", err);
        },
      );

      const toastTitle =
        finalTitle.length > 48 ? `${finalTitle.slice(0, 45)}…` : finalTitle;
      if (watchPosted) {
        showSuccessToast(`Posted to Watch: ${toastTitle}`, {
          title: "Download complete",
          autoClose: 4000,
          toastId: `yt-complete-${saveId}`,
        });
      } else {
        showSuccessToast(`Saved: ${toastTitle}`, {
          title: "Download complete",
          autoClose: 3500,
          toastId: `yt-complete-${saveId}`,
        });
      }

      removeJob(job.clientId);
    },
    [removeJob],
  );

  const pollProgress = useCallback(
    (job, progressUrl, openModalOnComplete) => {
      stopPolling(job.clientId);

      const secureProgressUrl = toSecureProgressUrl(progressUrl);
      let pollFailures = 0;

      const fetchProgressOnce = async () => {
        if (pollInFlightRef.current.has(job.clientId)) return false;
        pollInFlightRef.current.add(job.clientId);

        try {
          const response = await fetch(
            `${secureProgressUrl}?_ts=${Date.now()}`,
            {
              method: "GET",
              headers: getAuthHeaders(),
              cache: "no-store",
              mode: "cors",
              credentials: "omit",
            },
          );

          if (!response.ok) {
            throw new Error(`Progress HTTP ${response.status}`);
          }

          pollFailures = 0;

          const data = await response.json();
          const status = data?.status;
          const stage = data?.stage || "";
          const pct = Number(data?.pct) || 0;
          const fileUrl = data?.file_url;
          const title = data?.title || data?.download_title || job.title;
          const watchPosted = data?.watch_posted;
          const watchId = data?.watch_id;
          const progressId = data?.progress_id || job.progressId;

          setActiveJobs((prev) =>
            prev.map((j) => {
              if (j.clientId !== job.clientId) return j;
              return {
                ...j,
                progress: Math.max(j.progress || 0, Math.round(pct)),
                stage: stage || "downloading",
                status,
                title: title || j.title,
                progressId: progressId || j.progressId,
              };
            }),
          );

          if (
            status === "completed" &&
            typeof fileUrl === "string" &&
            fileUrl.length > 0
          ) {
            stopPolling(job.clientId);
            handleDownloadComplete(
              { ...job, progressId },
              fileUrl,
              title,
              watchPosted,
              watchId,
              openModalOnComplete,
            );
            return true;
          }

          if (status === "failed" || status === "error") {
            stopPolling(job.clientId);
            const completionKey = progressId || job.clientId;
            if (!completedRef.current.has(completionKey)) {
              completedRef.current.add(completionKey);
              const raw = data?.error || "Download failed. Please try again.";
              const friendly = /format is not available|no video formats/i.test(
                raw,
              )
                ? "Download failed. Please try again in a moment."
                : raw;
              showErrorToast(friendly, {
                title: job.title
                  ? `Failed: ${job.title.slice(0, 40)}`
                  : "Download Error",
              });
            }
            removeJob(job.clientId);
            return true;
          }
        } catch (err) {
          pollFailures += 1;
          console.error("Progress poll error:", err?.message || err);

          if (pollFailures === 8 && !slowNotifyRef.current.has(job.clientId)) {
            slowNotifyRef.current.add(job.clientId);
            showInfoToast("Still preparing on the server…", {
              title: job.title || "Download in progress",
              autoClose: 3500,
            });
          }

          if (pollFailures >= 120) {
            stopPolling(job.clientId);
            if (!completedRef.current.has(job.clientId)) {
              completedRef.current.add(job.clientId);
              showErrorToast(
                "Lost connection to download progress. The video may still finish — check Watch or try again.",
                { title: "Progress unavailable" },
              );
            }
            removeJob(job.clientId);
            return true;
          }
        } finally {
          pollInFlightRef.current.delete(job.clientId);
        }

        return false;
      };

      fetchProgressOnce();
      const intervalId = setInterval(fetchProgressOnce, 1000);
      pollersRef.current.set(job.clientId, intervalId);
    },
    [getAuthHeaders, handleDownloadComplete, removeJob, stopPolling, updateJob],
  );

  const startDownloadJob = useCallback(
    async (job, openModalOnComplete) => {
      const requestUrl = buildDownloadUrl(
        job.url,
        job.quality,
        job.postAsWatch,
        job.audioOnly,
      );
      if (!requestUrl) {
        removeJob(job.clientId);
        return;
      }

      try {
        const response = await axios.get(requestUrl, {
          headers: getAuthHeaders(),
          params: { _ts: Date.now() },
        });

        const json = response.data;
        const title = json?.title || json?.download_title;

        if (title) {
          updateJob(job.clientId, { title });
        }

        if (json?.progress_id) {
          updateJob(job.clientId, {
            progressId: json.progress_id,
            progress: 5,
            stage: "starting",
            status: "running",
          });
        }

        if (json && json.status === "accepted") {
          const progressUrl = resolveProgressUrl(json);
          if (progressUrl) {
            pollProgress(
              {
                ...job,
                title: title || job.title,
                progressId: json.progress_id,
              },
              progressUrl,
              openModalOnComplete,
            );
            return;
          }
        }

        if (json && json.status === "completed" && json.file_url) {
          const finalTitle =
            title || extractFileNameFromUrl(json.file_url) || "video";
          handleDownloadComplete(
            { ...job, progressId: json.progress_id },
            json.file_url,
            finalTitle,
            json.watch_posted,
            json.watch_id,
            openModalOnComplete,
          );
          return;
        }

        showErrorToast("Unexpected response from download server", {
          title: "Download Error",
        });
        removeJob(job.clientId);
      } catch (err) {
        console.error("Start download error:", err);
        const errMsg =
          err.response?.data?.error ||
          err.response?.data?.message ||
          "Failed to start download. Please try again.";
        showErrorToast(errMsg, { title: "Download Error" });
        removeJob(job.clientId);
      }
    },
    [
      getAuthHeaders,
      handleDownloadComplete,
      pollProgress,
      removeJob,
      updateJob,
    ],
  );

  const agentJobHandledRef = useRef(false);

  const attachAgentJob = useCallback(
    (agentJob) => {
      if (!agentJob?.url) return;
      if (agentJob.waitForUser) {
        setYoutubeUrl(agentJob.url);
        return;
      }
      const clientId = createClientJobId();
      const job = {
        clientId,
        url: agentJob.url,
        quality: agentJob.quality || selectedQuality,
        postAsWatch: agentJob.postAsWatch !== false,
        audioOnly: !!agentJob.audioOnly,
        title: agentJob.title || "YouTube download",
        progress: agentJob.progressId ? 5 : 0,
        stage: agentJob.progressId ? "downloading" : "starting",
        status: "running",
        progressId: agentJob.progressId || null,
      };
      setActiveJobs((prev) => {
        if (
          prev.some(
            (item) =>
              (item.progressId && item.progressId === job.progressId) ||
              item.url === job.url,
          )
        ) {
          return prev;
        }
        return [job, ...prev];
      });
      if (agentJob.progressId) {
        const progressUrl =
          agentJob.progressUrl ||
          `${getYTDownloadAPI()}/progress/${agentJob.progressId}`;
        pollProgress(job, toSecureProgressUrl(progressUrl), true);
        return;
      }
      startDownloadJob(job, true);
    },
    [pollProgress, selectedQuality, startDownloadJob],
  );

  useEffect(() => {
    const fromState = location.state?.agentJob;
    if (fromState && !agentJobHandledRef.current) {
      agentJobHandledRef.current = true;
      attachAgentJob(fromState);
    }
    const onAgentJob = (event) => attachAgentJob(event.detail);
    window.addEventListener("connect:yt-download-job", onAgentJob);
    return () => window.removeEventListener("connect:yt-download-job", onAgentJob);
  }, [attachAgentJob, location.state]);

  const handleSearch = async (event) => {
    event?.preventDefault?.();
    const query = searchQuery.trim();
    if (!query) {
      showErrorToast("Enter a video title or keywords to search", {
        title: "Search",
      });
      return;
    }

    if (isOffline()) {
      showErrorToast(
        "YouTube search is not available offline. Please connect to the internet.",
        { title: "Offline Mode" },
      );
      return;
    }

    searchAbortRef.current?.abort();
    const controller = new AbortController();
    searchAbortRef.current = controller;

    setSearching(true);
    setSearchError("");

    try {
      const response = await axios.get(`${getYTDownloadAPI()}/youtube/search`, {
        params: { q: query, maxResults: 12 },
        headers: getAuthHeaders(),
        signal: controller.signal,
      });
      const items = Array.isArray(response.data?.items)
        ? response.data.items
        : [];
      setSearchResults(items);
      if (items.length === 0) {
        setSearchError("No videos found. Try a different search.");
      }
    } catch (err) {
      if (
        axios.isCancel?.(err) ||
        err.code === "ERR_CANCELED" ||
        err.name === "CanceledError" ||
        err.name === "AbortError"
      ) {
        return;
      }

      const code = err.response?.data?.code;
      const shouldTryClient =
        Boolean(YOUTUBE_CLIENT_API_KEY) &&
        (code === "YOUTUBE_API_KEY_MISSING" ||
          err.response?.status === 404 ||
          err.code === "ERR_NETWORK" ||
          !err.response);
      if (shouldTryClient) {
        try {
          const items = await searchYouTubeFromClient(query, controller.signal);
          setSearchResults(items);
          if (items.length === 0) {
            setSearchError("No videos found. Try a different search.");
          }
          return;
        } catch (clientErr) {
          if (clientErr.name === "AbortError") return;
          const clientMsg = clientErr.message || "YouTube search failed";
          setSearchResults([]);
          setSearchError(clientMsg);
          showErrorToast(clientMsg, { title: "Search failed" });
          return;
        }
      }

      const missingKey = code === "YOUTUBE_API_KEY_MISSING";
      const msg = missingKey
        ? "Add YOUTUBE_API_KEY on the server, or REACT_APP_YOUTUBE_API_KEY in the web app."
        : err.response?.data?.error || err.message || "YouTube search failed";
      setSearchResults([]);
      setSearchError(msg);
      showErrorToast(
        missingKey ? "YouTube API key is not configured" : msg,
        { title: "Search failed" },
      );
    } finally {
      if (searchAbortRef.current === controller) {
        setSearching(false);
      }
    }
  };

  const selectSearchResult = (video, { append = false } = {}) => {
    if (!video?.url) return;
    setYoutubeUrl((prev) => {
      const nextUrl = video.url;
      if (!append) return nextUrl;
      const existing = parseYoutubeUrls(prev);
      if (existing.includes(nextUrl)) return prev.trim() ? prev : nextUrl;
      return prev.trim() ? `${prev.trim()}\n${nextUrl}` : nextUrl;
    });
    setSelectedSearchVideoId(video.videoId);
    showInfoToast(video.title, {
      title: append ? "Added to URL list" : "Video selected",
      autoClose: 2000,
    });
  };

  const copySearchUrl = async (url, event) => {
    event?.stopPropagation?.();
    event?.preventDefault?.();
    try {
      await navigator.clipboard.writeText(url);
      showSuccessToast("Video URL copied", {
        title: "Copied",
        autoClose: 2000,
      });
    } catch (_) {
      showErrorToast("Could not copy URL", { title: "Copy failed" });
    }
  };

  const queueDownloads = (rawUrls, { clearInput = true } = {}) => {
    if (!rawUrls || rawUrls.length === 0) {
      showErrorToast("Please enter at least one YouTube URL", {
        title: "Invalid URL",
      });
      return;
    }

    if (!isAuthenticated) {
      showErrorToast("Please log in to download and post videos to Watch", {
        title: "Authentication Required",
      });
      return;
    }

    const invalid = rawUrls.filter((url) => !validateYouTubeUrl(url));
    if (invalid.length > 0) {
      showErrorToast("One or more URLs are not valid YouTube links", {
        title: "Invalid URL",
      });
      return;
    }

    const runningIds = new Set(
      activeJobs
        .filter((job) => job.status === "running")
        .map((job) => extractYouTubeVideoId(job.url))
        .filter(Boolean),
    );

    const urlsToStart = [];
    const skipped = [];
    rawUrls.forEach((url) => {
      const vid = extractYouTubeVideoId(url);
      if (vid && runningIds.has(vid)) {
        skipped.push(url);
        return;
      }
      if (vid) runningIds.add(vid);
      urlsToStart.push(url);
    });

    if (urlsToStart.length === 0) {
      showErrorToast("These videos are already downloading", {
        title: "Already in queue",
      });
      return;
    }

    if (skipped.length > 0) {
      showInfoToast(
        `Skipped ${skipped.length} duplicate URL(s) already downloading`,
        {
          title: "Queue updated",
          autoClose: 3000,
        },
      );
    }

    const openModalOnComplete =
      urlsToStart.length === 1 && activeJobs.length === 0;

    if (urlsToStart.length === 1) {
      showInfoToast(
        audioOnly
          ? "Downloading high-quality audio…"
          : postAsWatch
            ? "Downloading and posting to Watch…"
            : "Downloading video…",
        { title: "Download started", autoClose: 2500, toastId: "yt-download-start" },
      );
    } else {
      showInfoToast(`Started ${urlsToStart.length} downloads`, {
        title: "Batch download",
        autoClose: 3000,
        toastId: "yt-download-start",
      });
    }

    const newJobs = urlsToStart.map((url) => ({
      clientId: createClientJobId(),
      url,
      quality: selectedQuality,
      postAsWatch: audioOnly ? false : postAsWatch,
      audioOnly,
      title: extractYouTubeVideoId(url)
        ? `YouTube ${extractYouTubeVideoId(url)}`
        : url.slice(0, 40),
      progress: 0,
      stage: "starting",
      status: "running",
      progressId: null,
    }));

    setActiveJobs((prev) => [...newJobs, ...prev]);
    if (clearInput) setYoutubeUrl("");

    newJobs.forEach((job) => {
      startDownloadJob(job, openModalOnComplete);
    });
  };

  const handleDownload = () => {
    queueDownloads(parseYoutubeUrls(youtubeUrl), { clearInput: true });
  };

  const appendSearchUrl = (video, event) => {
    event?.stopPropagation?.();
    event?.preventDefault?.();
    selectSearchResult(video, { append: true });
  };

  const downloadSearchResult = (video, event) => {
    event?.stopPropagation?.();
    event?.preventDefault?.();
    if (!video?.url) return;
    setSelectedSearchVideoId(video.videoId);
    queueDownloads([video.url], { clearInput: false });
  };

  const handleCancelJob = (clientId) => {
    removeJob(clientId);
    showInfoToast("Removed from queue (server may still finish)", {
      title: "Cancelled",
      autoClose: 2500,
    });
  };

  const handleCancelAll = () => {
    activeJobs.forEach((job) => stopPolling(job.clientId));
    pollersRef.current.clear();
    setActiveJobs([]);
    showInfoToast("All downloads removed from queue", {
      title: "Cancelled",
      autoClose: 2500,
    });
  };

  const getStageLabel = (stage) => {
    const labels = {
      starting: "Starting...",
      preparing: "Preparing on home server...",
      downloading: "Downloading on server...",
      uploading: "Uploading to Cloudinary...",
      uploading_watch: "Posting to Watch...",
      transcoding: "Processing...",
      completed: "Completed",
      failed: "Failed",
    };
    return labels[stage] || stage || "Preparing...";
  };

  const runningCount = activeJobs.filter(
    (job) => job.status === "running",
  ).length;

  return (
    <div className="yt-download-page">
      {showDownloadModal && (
        <VideoDownloadModal
          isOpen
          onClose={() => setShowDownloadModal(false)}
          downloadInfo={completedDownload}
        />
      )}

      <div className="container my-4">
        <div className="row justify-content-center">
          <div className="col-12 col-md-10 col-lg-8">
            <div className="yt-download-card">
              <h1 className="yt-download-title">
                <i
                  className="fab fa-youtube"
                  style={{ color: "#FF0000", marginRight: "10px" }}
                ></i>
                YouTube Video Downloader
              </h1>
              <p className="yt-download-subtitle">
                Search YouTube for a video, or paste URL(s). Download merged
                high-quality video with HQ audio, extract audio-only MP3, or
                post directly to Watch. Paste multiple URLs (one per line) to
                download in parallel.
              </p>

              <div className="yt-download-form">
                <form className="form-group yt-search-form" onSubmit={handleSearch}>
                  <label htmlFor="youtube-search">Search YouTube</label>
                  <div className="yt-search-row">
                    <input
                      id="youtube-search"
                      type="search"
                      className="form-control yt-url-input yt-search-input"
                      placeholder="Search by title, artist, or keywords…"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      autoComplete="off"
                    />
                    <button
                      type="submit"
                      className="btn btn-primary yt-search-btn"
                      disabled={searching || !searchQuery.trim()}
                    >
                      <i
                        className={`fas ${searching ? "fa-spinner fa-spin" : "fa-search"}`}
                        style={{ marginRight: "8px" }}
                      ></i>
                      {searching ? "Searching" : "Search"}
                    </button>
                  </div>
                </form>

                {searchError && searchResults.length === 0 && (
                  <p className="yt-search-status yt-search-status-error">
                    {searchError}
                  </p>
                )}

                {searchResults.length > 0 && (
                  <div className="yt-search-results">
                    <div className="yt-search-results-header">
                      <h3>Search results</h3>
                      <span>{searchResults.length} videos</span>
                    </div>
                    <div className="yt-search-results-list">
                      {searchResults.map((video) => (
                        <div
                          key={video.videoId}
                          className={`yt-search-result${
                            selectedSearchVideoId === video.videoId
                              ? " is-selected"
                              : ""
                          }`}
                        >
                          <button
                            type="button"
                            className="yt-search-result-main"
                            onClick={() => selectSearchResult(video)}
                          >
                            <img
                              className="yt-search-thumb"
                              src={video.thumbnail}
                              alt={video.title}
                              loading="lazy"
                            />
                            <div className="yt-search-result-meta">
                              <span className="yt-search-result-title">
                                {video.title}
                              </span>
                              {video.channelTitle ? (
                                <span className="yt-search-result-channel">
                                  {video.channelTitle}
                                </span>
                              ) : null}
                            </div>
                          </button>
                          <div className="yt-search-result-actions">
                            <button
                              type="button"
                              className="btn btn-sm btn-link"
                              onClick={(event) => appendSearchUrl(video, event)}
                            >
                              Use URL
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-link yt-search-download-btn"
                              onClick={(event) =>
                                downloadSearchResult(video, event)
                              }
                            >
                              Download
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-link"
                              onClick={(event) => copySearchUrl(video.url, event)}
                            >
                              Copy
                            </button>
                          </div>

                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="form-group">
                  <label htmlFor="youtube-url">YouTube URL(s)</label>
                  <textarea
                    id="youtube-url"
                    className="form-control yt-url-input yt-url-textarea"
                    placeholder={
                      "https://www.youtube.com/watch?v=...\nhttps://youtu.be/...\n(one URL per line)"
                    }
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="quality-select">Video Quality</label>
                  <select
                    id="quality-select"
                    className="form-control yt-quality-select"
                    value={selectedQuality || ""}
                    disabled={audioOnly}
                    onChange={(e) =>
                      setSelectedQuality(
                        e.target.value ? parseInt(e.target.value, 10) : null,
                      )
                    }
                  >
                    {QUALITY_OPTIONS.map((option) => (
                      <option
                        key={option.value || "best"}
                        value={option.value || ""}
                      >
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <div className="form-check" style={{ opacity: 0.95 }}>
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="audio-only"
                      checked={audioOnly}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setAudioOnly(checked);
                        if (checked) setPostAsWatch(false);
                      }}
                    />
                    <label className="form-check-label" htmlFor="audio-only">
                      <i
                        className="fas fa-music"
                        style={{ marginRight: "8px", color: "#F59E0B" }}
                      ></i>
                      Audio only (high quality MP3)
                    </label>
                  </div>
                  <small
                    className="form-text text-muted"
                    style={{ marginTop: "4px", display: "block" }}
                  >
                    Extracts just the audio track at the best available quality.
                    Video quality and Post as Watch are disabled in this mode.
                  </small>
                </div>

                <div className="form-group">
                  <div
                    className="form-check"
                    style={{ opacity: audioOnly ? 0.5 : 0.95 }}
                  >
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="post-as-watch"
                      checked={postAsWatch && !audioOnly}
                      disabled={!isAuthenticated || audioOnly}
                      onChange={(e) => setPostAsWatch(e.target.checked)}
                    />
                    <label className="form-check-label" htmlFor="post-as-watch">
                      <i
                        className="fas fa-video"
                        style={{ marginRight: "8px", color: "#3B82F6" }}
                      ></i>
                      Post as Watch
                    </label>
                  </div>
                  <small
                    className="form-text text-muted"
                    style={{ marginTop: "4px", display: "block" }}
                  >
                    {!isAuthenticated
                      ? "Please log in to download and post to Watch."
                      : audioOnly
                        ? "Audio-only downloads are saved to Saved Videos and are not posted to Watch."
                        : postAsWatch
                          ? "HQ video + audio is uploaded to Cloudinary and posted to Watch. Caption = YouTube title."
                          : "HQ video is saved to Saved Videos only (not posted to Watch)."}
                  </small>
                </div>

                {activeJobs.length > 0 && (
                  <div className="yt-active-downloads">
                    <div className="yt-active-downloads-header">
                      <h3>Active downloads ({runningCount})</h3>
                      {activeJobs.length > 1 && (
                        <button
                          type="button"
                          className="btn btn-sm btn-link yt-cancel-all"
                          onClick={handleCancelAll}
                        >
                          Cancel all
                        </button>
                      )}
                    </div>
                    <div className="yt-active-downloads-list">
                      {activeJobs.map((job) => (
                        <div
                          key={job.clientId}
                          className="download-progress-container yt-job-progress"
                        >
                          <div className="progress-info">
                            <span className="progress-stage">
                              {job.title ? `${job.title.slice(0, 50)} · ` : ""}
                              {getStageLabel(job.stage)}
                            </span>
                            <span className="progress-percentage">
                              {job.progress || 0}%
                            </span>
                          </div>
                          <div className="progress-bar-wrapper">
                            <div
                              className="progress-bar-fill"
                              style={{ width: `${job.progress || 0}%` }}
                            ></div>
                          </div>
                          <button
                            type="button"
                            className="btn btn-sm btn-link yt-job-cancel"
                            onClick={() => handleCancelJob(job.clientId)}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="yt-download-actions">
                  <button
                    className="btn btn-primary yt-download-btn"
                    onClick={handleDownload}
                    disabled={!youtubeUrl.trim()}
                  >
                    <i
                      className={`fas ${audioOnly ? "fa-music" : "fa-download"}`}
                      style={{ marginRight: "8px" }}
                    ></i>
                    {audioOnly
                      ? "Download Audio"
                      : postAsWatch
                        ? "Download & Post to Watch"
                        : "Download Video"}
                    {parseYoutubeUrls(youtubeUrl).length > 1
                      ? ` (${parseYoutubeUrls(youtubeUrl).length})`
                      : ""}
                  </button>
                </div>
              </div>

              {downloadHistory.length > 0 && (
                <div className="download-history">
                  <h3 className="history-title">Recent Downloads</h3>
                  <div className="history-list">
                    {downloadHistory.slice(0, 5).map((item) => (
                      <div key={item.id} className="history-item">
                        <div className="history-item-info">
                          <i
                            className={`fas ${item.audioOnly ? "fa-music" : "fa-video"}`}
                            style={{ marginRight: "10px", color: "#94a3b8" }}
                          ></i>
                          <span className="history-item-name">
                            {item.fileName}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="btn btn-sm btn-link history-download-link"
                          onClick={() => {
                            setCompletedDownload({
                              fileName: item.fileName,
                              fileUrl: item.url,
                              title: item.fileName.replace(
                                /\.(mp4|mp3|m4a|webm)$/i,
                                "",
                              ),
                              watchPosted: false,
                            });
                            setShowDownloadModal(true);
                          }}
                        >
                          <i className="fas fa-download"></i>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default YtDownload;
