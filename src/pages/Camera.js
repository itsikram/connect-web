import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import CameraViewfinder from "../components/camera/CameraViewfinder";
import CameraControls from "../components/camera/CameraControls";
import CameraFilterStrip from "../components/camera/CameraFilterStrip";
import CameraReview from "../components/camera/CameraReview";
import { IconCamera, IconClose } from "../components/camera/CameraIcons";
import IosFilterRenderer from "../utils/iosFilterRenderer";
import {
  DEFAULT_FILTER_ID,
  IOS_FILTERS,
  adjacentFilterId,
  getFilterById,
  pickRecorderMime,
} from "../utils/iosCameraFilters";
import { openCreatePost } from "../utils/openComposer";
import { showErrorToast, showInfoToast, showSuccessToast } from "../utils/toastUtils";
import "./Camera.css";

const IDENTITY_INTENSITY = 0;
const VIVID_FILTER_ID = "vivid";
const VIVID_SELFIE_MS = 2000;
const VIVID_BRIGHTNESS_MIN = -45;
const VIVID_BRIGHTNESS_MAX = 45;

const clampVividBrightness = (value) =>
  Math.min(VIVID_BRIGHTNESS_MAX, Math.max(VIVID_BRIGHTNESS_MIN, value));

const vividBrightnessToShader = (value) => clampVividBrightness(value) / 100;

const getCaptureSize = (srcW, srcH, mode) => {
  const vw = srcW || 1080;
  const vh = srcH || 1440;
  if (mode === "square") {
    const s = Math.min(vw, vh);
    return { w: s, h: s };
  }
  if (mode === "portrait") {
    const target = 4 / 5;
    if (vw / vh > target) return { w: Math.round(vh * target), h: vh };
    return { w: vw, h: Math.round(vw / target) };
  }
  return { w: vw, h: vh };
};

const formatRecTime = (seconds) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

const sourceSize = (source) => ({
  w: source.videoWidth || source.naturalWidth || source.width || 1,
  h: source.videoHeight || source.naturalHeight || source.height || 1,
});

const Camera = () => {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const workCanvasRef = useRef(null);
  const rendererRef = useRef(null);
  const workRendererRef = useRef(null);
  const streamRef = useRef(null);
  const audioStreamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const rafRef = useRef(0);
  const thumbTimerRef = useRef(0);
  const recTimerRef = useRef(0);
  const shutterRef = useRef({ timer: null, long: false, down: false });
  const pinchRef = useRef({ startDist: 0, startZoom: 1 });
  const liveRef = useRef({});
  const objectUrlsRef = useRef([]);
  const workBusyRef = useRef(false);
  const mountedRef = useRef(true);
  const focusTimerRef = useRef(0);
  const focusSessionRef = useRef(null);
  const vividSelfieTimerRef = useRef(0);
  const vividSelfieRestoreRef = useRef("environment");

  const [permission, setPermission] = useState("pending");
  const [error, setError] = useState("");
  const [facing, setFacing] = useState("environment");
  const [flash, setFlash] = useState("off");
  const [timer, setTimer] = useState(0);
  const [countdown, setCountdown] = useState(null);
  const [mode, setMode] = useState("photo");
  const [filterId, setFilterId] = useState(DEFAULT_FILTER_ID);
  const [intensity, setIntensity] = useState(100);
  const [showFilters, setShowFilters] = useState(true);
  const [showFilterName, setShowFilterName] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [hasTorch, setHasTorch] = useState(false);
  const [hasHwZoom, setHasHwZoom] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const [isCapturing, setIsCapturing] = useState(false);
  const [flashOn, setFlashOn] = useState(false);
  const [focusPt, setFocusPt] = useState(null);
  const [vividBrightness, setVividBrightness] = useState(0);
  const [flipSpin, setFlipSpin] = useState(false);
  const [thumbs, setThumbs] = useState({});
  const [lastThumb, setLastThumb] = useState(null);
  const [review, setReview] = useState(null);
  const [busy, setBusy] = useState(false);

  liveRef.current = {
    facing,
    zoom,
    filterId,
    intensity,
    vividBrightness,
    mode,
    hasHwZoom,
    isRecording,
    lastThumb,
  };

  const applyRendererFilter = useCallback((renderer, nextFilterId, nextIntensity, nextVividBrightness) => {
    if (!renderer) return;
    renderer.setFilter(getFilterById(nextFilterId).params, nextIntensity);
    const extra =
      nextFilterId === VIVID_FILTER_ID
        ? vividBrightnessToShader(nextVividBrightness)
        : 0;
    renderer.setExtraBrightness(extra);
  }, []);

  const rememberUrl = (url) => {
    objectUrlsRef.current.push(url);
    return url;
  };

  const stopStream = useCallback((stream) => {
    stream?.getTracks()?.forEach((track) => {
      try {
        track.stop();
      } catch {
        /* ignore */
      }
    });
  }, []);

  const applyTorch = useCallback(async (on) => {
    const track = streamRef.current?.getVideoTracks?.()[0];
    if (!track || !hasTorch) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: Boolean(on) }] });
    } catch {
      /* not supported */
    }
  }, [hasTorch]);

  const applyHwZoom = useCallback(async (value) => {
    const track = streamRef.current?.getVideoTracks?.()[0];
    const caps = track?.getCapabilities?.();
    if (!track || !caps?.zoom) return false;
    const next = Math.min(caps.zoom.max, Math.max(caps.zoom.min, value));
    try {
      await track.applyConstraints({ advanced: [{ zoom: next }] });
      return true;
    } catch {
      return false;
    }
  }, []);

  const startCamera = useCallback(async (facingMode) => {
    if (typeof window !== "undefined" && !window.isSecureContext) {
      setPermission("denied");
      setError("Camera needs HTTPS or localhost.");
      return;
    }
    try {
      window.dispatchEvent(new Event("stopEmotionCamera"));
    } catch {
      /* ignore */
    }
    stopStream(streamRef.current);
    streamRef.current = null;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        video.setAttribute("playsinline", "true");
        video.muted = true;
        await video.play().catch(() => {});
      }
      const track = stream.getVideoTracks()[0];
      const caps = track?.getCapabilities?.() || {};
      setHasTorch(Boolean(caps.torch));
      setHasHwZoom(Boolean(caps.zoom && caps.zoom.max > (caps.zoom.min || 1)));
      setPermission("granted");
      setError("");
    } catch (err) {
      setPermission("denied");
      setError(
        err?.name === "NotAllowedError"
          ? "Camera access is blocked. Enable it in your browser settings."
          : "Could not start the camera."
      );
    }
  }, [stopStream]);

  const generateThumbs = useCallback((source, mirror) => {
    const renderer = workRendererRef.current;
    if (!renderer || !source || workBusyRef.current) return;
    const { w, h } = sourceSize(source);
    if (w < 2 || h < 2) return;
    renderer.resize(96, 96);
    renderer.setSourceSize(w, h);
    renderer.setZoom(1);
    renderer.setMirror(Boolean(mirror));
    const next = {};
    IOS_FILTERS.forEach((filter) => {
      applyRendererFilter(renderer, filter.id, 100, 0);
      renderer.draw(source);
      next[filter.id] = renderer.toDataURL(0.62);
    });
    setThumbs(next);
  }, [applyRendererFilter]);

  const bakeBlob = useCallback(async (source, nextFilterId, nextIntensity, nextMode, nextVividBrightness = 0) => {
    const renderer = workRendererRef.current;
    if (!renderer || !source) return null;
    workBusyRef.current = true;
    try {
      const { w, h } = sourceSize(source);
      const size = getCaptureSize(w, h, nextMode || "photo");
      renderer.resize(size.w, size.h);
      renderer.setSourceSize(w, h);
      renderer.setZoom(1);
      renderer.setMirror(false);
      applyRendererFilter(renderer, nextFilterId, nextIntensity, nextVividBrightness);
      renderer.draw(source);
      return await new Promise((resolve) => {
        workCanvasRef.current.toBlob((blob) => resolve(blob), "image/jpeg", 0.92);
      });
    } finally {
      workBusyRef.current = false;
    }
  }, [applyRendererFilter]);

  const captureOriginal = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return null;
    const blob = await bakeBlob(video, "original", IDENTITY_INTENSITY, liveRef.current.mode);
    return blob;
  }, [bakeBlob]);

  const triggerFlash = useCallback(async () => {
    setFlashOn(true);
    window.setTimeout(() => setFlashOn(false), 180);
    if (flash === "on" || flash === "auto") {
      await applyTorch(true);
      window.setTimeout(() => applyTorch(false), 220);
    }
  }, [applyTorch, flash]);

  const waitCountdown = useCallback(async () => {
    if (!timer) return;
    for (let i = timer; i > 0; i -= 1) {
      setCountdown(i);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    setCountdown(null);
  }, [timer]);

  const openPhotoReview = useCallback(async (originalBlob) => {
    if (!originalBlob) return;
    const originalUrl = rememberUrl(URL.createObjectURL(originalBlob));
    const img = new Image();
    img.src = originalUrl;
    await new Promise((resolve) => {
      img.onload = resolve;
      img.onerror = resolve;
    });
    generateThumbs(img, false);
    setReview({
      type: "photo",
      originalBlob,
      originalUrl,
      filterId: liveRef.current.filterId,
      intensity: liveRef.current.intensity,
      vividBrightness: liveRef.current.vividBrightness,
    });
  }, [generateThumbs]);

  const takePhoto = useCallback(async () => {
    if (isCapturing || isRecording) return;
    setIsCapturing(true);
    try {
      await waitCountdown();
      await triggerFlash();
      const blob = await captureOriginal();
      if (!blob) throw new Error("empty");
      await openPhotoReview(blob);
    } catch {
      showErrorToast("Could not capture photo");
    } finally {
      setIsCapturing(false);
      setCountdown(null);
    }
  }, [captureOriginal, isCapturing, isRecording, openPhotoReview, triggerFlash, waitCountdown]);

  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      try {
        recorder.stop();
      } catch {
        setIsRecording(false);
      }
    }
    if (recTimerRef.current) {
      window.clearInterval(recTimerRef.current);
      recTimerRef.current = 0;
    }
  }, []);

  const startRecording = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas || isRecording) return;
    if (typeof MediaRecorder === "undefined") {
      showErrorToast("Video recording is not supported in this browser");
      return;
    }
    try {
      const canvasStream =
        canvas.captureStream?.(30) || canvas.webkitCaptureStream?.(30);
      if (!canvasStream) throw new Error("no canvas stream");
      let audioStream = null;
      try {
        audioStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false,
        });
        audioStreamRef.current = audioStream;
      } catch {
        audioStream = null;
      }
      const mixed = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...(audioStream ? audioStream.getAudioTracks() : []),
      ]);
      const mime = pickRecorderMime();
      const recorder = mime
        ? new MediaRecorder(mixed, { mimeType: mime })
        : new MediaRecorder(mixed);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const type = recorder.mimeType || mime || "video/webm";
        const blob = new Blob(chunksRef.current, { type });
        stopStream(audioStreamRef.current);
        audioStreamRef.current = null;
        if (!mountedRef.current) return;
        setIsRecording(false);
        setRecSeconds(0);
        if (!blob.size) {
          showErrorToast("Recording was empty");
          return;
        }
        const url = rememberUrl(URL.createObjectURL(blob));
        setLastThumb(liveRef.current.lastThumb || null);
        setReview({ type: "video", videoBlob: blob, videoUrl: url });
      };
      recorderRef.current = recorder;
      recorder.start(200);
      setIsRecording(true);
      setRecSeconds(0);
      recTimerRef.current = window.setInterval(() => {
        setRecSeconds((prev) => {
          if (prev >= 59) {
            stopRecording();
            return 59;
          }
          return prev + 1;
        });
      }, 1000);
    } catch {
      showErrorToast("Could not start recording");
      setIsRecording(false);
    }
  }, [isRecording, stopRecording, stopStream]);

  const onClose = useCallback(() => {
    if (review) {
      setReview(null);
      return;
    }
    if (window.history.length > 1) navigate(-1);
    else navigate("/");
  }, [navigate, review]);

  const startVividSelfiePreview = useCallback(() => {
    window.clearTimeout(vividSelfieTimerRef.current);
    vividSelfieRestoreRef.current = liveRef.current.facing;
    setFacing("user");
    vividSelfieTimerRef.current = window.setTimeout(() => {
      setFacing(vividSelfieRestoreRef.current || "environment");
      vividSelfieTimerRef.current = 0;
    }, VIVID_SELFIE_MS);
  }, []);

  const selectFilter = useCallback((id) => {
    setFilterId(id);
    setShowFilters(true);
    setShowFilterName(true);
    if (id === VIVID_FILTER_ID) {
      startVividSelfiePreview();
    }
    if (navigator.vibrate) navigator.vibrate(10);
  }, [startVividSelfiePreview]);

  const cycleFlash = useCallback(() => {
    setFlash((prev) => {
      if (!hasTorch) return prev === "off" ? "on" : "off";
      if (prev === "off") return "on";
      if (prev === "on") return "auto";
      return "off";
    });
  }, [hasTorch]);

  const cycleTimer = useCallback(() => {
    setTimer((prev) => (prev === 0 ? 3 : prev === 3 ? 10 : 0));
  }, []);

  const onMode = useCallback((next) => {
    if (next === "pano") {
      showInfoToast("Panorama is coming soon");
      return;
    }
    if (isRecording) stopRecording();
    setMode(next);
  }, [isRecording, stopRecording]);

  const onZoom = useCallback(async (value) => {
    setZoom(value);
    await applyHwZoom(value);
  }, [applyHwZoom]);

  const onFlip = useCallback(() => {
    setFlipSpin(true);
    window.setTimeout(() => setFlipSpin(false), 420);
    setFacing((prev) => (prev === "environment" ? "user" : "environment"));
    setZoom(1);
  }, []);

  const onShutterDown = useCallback((event) => {
    if (mode === "video" || mode === "pano" || isRecording || review) return;
    event.preventDefault();
    shutterRef.current.down = true;
    shutterRef.current.long = false;
    shutterRef.current.timer = window.setTimeout(() => {
      shutterRef.current.long = true;
      startRecording();
    }, 380);
  }, [isRecording, mode, review, startRecording]);

  const onShutterUp = useCallback(() => {
    if (!shutterRef.current.down) return;
    shutterRef.current.down = false;
    window.clearTimeout(shutterRef.current.timer);
    if (shutterRef.current.long) {
      stopRecording();
      return;
    }
    if (mode !== "video" && mode !== "pano" && !review) takePhoto();
  }, [mode, review, stopRecording, takePhoto]);

  const onShutterClick = useCallback((event) => {
    if (mode === "pano") {
      event.preventDefault();
      showInfoToast("Panorama is coming soon");
      return;
    }
    if (mode === "video") {
      if (isRecording) stopRecording();
      else startRecording();
    }
  }, [isRecording, mode, startRecording, stopRecording]);

  const panRef = useRef(null);

  const clearFocusLater = useCallback((delay) => {
    window.clearTimeout(focusTimerRef.current);
    focusTimerRef.current = window.setTimeout(() => {
      setFocusPt(null);
      focusSessionRef.current = null;
    }, delay);
  }, []);

  const onViewPointerDown = useCallback((evt) => {
    if (evt.type === "pinch") {
      pinchRef.current = { startDist: evt.dist, startZoom: liveRef.current.zoom };
      return;
    }
    const rect = canvasRef.current?.parentElement?.getBoundingClientRect();
    if (!rect || evt.x == null || evt.y == null) return;
    panRef.current = {
      startX: evt.x,
      startY: evt.y,
      focusX: evt.x - rect.left,
      focusY: evt.y - rect.top,
      startBrightness: liveRef.current.vividBrightness,
      adjusted: false,
    };
  }, []);

  const onViewPointerMove = useCallback((evt) => {
    if (evt.type === "pinch" && evt.dist && pinchRef.current.startDist) {
      const ratio = evt.dist / pinchRef.current.startDist;
      const next = Math.min(5, Math.max(1, pinchRef.current.startZoom * ratio));
      setZoom(next);
      return;
    }
    const pan = panRef.current;
    if (!pan || liveRef.current.filterId !== VIVID_FILTER_ID || evt.y == null) return;
    const dy = evt.y - pan.startY;
    if (Math.abs(dy) < 8) return;
    const next = clampVividBrightness(pan.startBrightness - dy * 0.22);
    pan.adjusted = true;
    setVividBrightness(next);
    setFocusPt({
      x: pan.focusX,
      y: pan.focusY,
      adjusting: true,
      brightness: next,
    });
    focusSessionRef.current = { x: pan.focusX, y: pan.focusY };
    clearFocusLater(3200);
  }, [clearFocusLater]);

  const onViewPointerUp = useCallback((evt) => {
    if (evt.type === "pinch") return;
    const pan = panRef.current;
    panRef.current = null;
    const dx = evt.dx || 0;
    const dy = evt.dy || 0;
    if (Math.abs(dx) > 56 && Math.abs(dy) < 90) {
      selectFilter(adjacentFilterId(liveRef.current.filterId, dx < 0 ? 1 : -1));
      return;
    }
    if (pan?.adjusted) {
      clearFocusLater(2600);
      return;
    }
    if (Math.abs(dx) < 12 && Math.abs(dy) < 12 && pan) {
      const isVivid = liveRef.current.filterId === VIVID_FILTER_ID;
      setFocusPt({
        x: pan.focusX,
        y: pan.focusY,
        adjusting: isVivid,
        brightness: liveRef.current.vividBrightness,
      });
      focusSessionRef.current = { x: pan.focusX, y: pan.focusY };
      clearFocusLater(isVivid ? 3200 : 900);
    }
  }, [clearFocusLater, selectFilter]);

  const bakeReviewPhoto = useCallback(async () => {
    if (!review || review.type !== "photo") return null;
    const img = new Image();
    img.src = review.originalUrl;
    await new Promise((resolve) => {
      img.onload = resolve;
      img.onerror = resolve;
    });
    return bakeBlob(
      img,
      review.filterId,
      review.intensity,
      mode,
      review.vividBrightness ?? 0
    );
  }, [bakeBlob, mode, review]);

  const downloadBlob = useCallback((blob, name) => {
    const url = rememberUrl(URL.createObjectURL(blob));
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }, []);

  const handleDownload = useCallback(async () => {
    if (!review) return;
    setBusy(true);
    try {
      if (review.type === "video") {
        downloadBlob(review.videoBlob, `connect-camera-${Date.now()}.webm`);
      } else {
        const blob = await bakeReviewPhoto();
        if (!blob) throw new Error("bake");
        downloadBlob(blob, `connect-camera-${Date.now()}.jpg`);
      }
      showSuccessToast("Saved to your device");
    } catch {
      showErrorToast("Could not download");
    } finally {
      setBusy(false);
    }
  }, [bakeReviewPhoto, downloadBlob, review]);

  const handleUse = useCallback(async () => {
    if (!review) return;
    setBusy(true);
    try {
      if (review.type === "video") {
        downloadBlob(review.videoBlob, `connect-camera-${Date.now()}.webm`);
        setLastThumb(thumbs[filterId] || lastThumb);
      } else {
        const blob = await bakeReviewPhoto();
        if (!blob) throw new Error("bake");
        downloadBlob(blob, `connect-camera-${Date.now()}.jpg`);
        setLastThumb(rememberUrl(URL.createObjectURL(blob)));
      }
      setReview(null);
      showSuccessToast("Saved");
    } catch {
      showErrorToast("Could not save");
    } finally {
      setBusy(false);
    }
  }, [bakeReviewPhoto, downloadBlob, filterId, lastThumb, review, thumbs]);

  const handlePost = useCallback(async () => {
    if (!review) return;
    setBusy(true);
    try {
      let file;
      if (review.type === "video") {
        const ext = (review.videoBlob.type || "").includes("mp4") ? "mp4" : "webm";
        file = new File(
          [review.videoBlob],
          `connect-camera-${Date.now()}.${ext}`,
          { type: review.videoBlob.type || "video/webm" }
        );
      } else {
        const blob = await bakeReviewPhoto();
        if (!blob) throw new Error("bake");
        file = new File([blob], `connect-camera-${Date.now()}.jpg`, {
          type: "image/jpeg",
        });
        setLastThumb(rememberUrl(URL.createObjectURL(blob)));
      }
      openCreatePost({ file, navigate });
    } catch {
      showErrorToast("Could not open composer");
    } finally {
      setBusy(false);
    }
  }, [bakeReviewPhoto, navigate, review]);

  useEffect(() => {
    mountedRef.current = true;
    document.body.classList.add("camera-page-open");
    document.documentElement.classList.add("camera-page-open");
    return () => {
      mountedRef.current = false;
      document.body.classList.remove("camera-page-open");
      document.documentElement.classList.remove("camera-page-open");
    };
  }, []);

  useEffect(() => {
    startCamera(facing);
  }, [facing, startCamera]);

  useEffect(() => {
    applyTorch(flash === "on");
  }, [applyTorch, flash]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const work = document.createElement("canvas");
    workCanvasRef.current = work;
    try {
      rendererRef.current = canvas ? new IosFilterRenderer(canvas) : null;
      workRendererRef.current = new IosFilterRenderer(work);
    } catch (err) {
      setError(err?.message || "WebGL is required for camera filters");
      setPermission("denied");
    }
    return () => {
      rendererRef.current?.destroy();
      workRendererRef.current?.destroy();
      rendererRef.current = null;
      workRendererRef.current = null;
    };
  }, []);

  useEffect(() => {
    const tick = () => {
      rafRef.current = requestAnimationFrame(tick);
      if (document.hidden || review) return;
      const video = videoRef.current;
      const renderer = rendererRef.current;
      const canvas = canvasRef.current;
      if (!video || !renderer || !canvas || video.readyState < 2) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) return;
      const live = liveRef.current;
      renderer.resize(rect.width * dpr, rect.height * dpr);
      renderer.setSourceSize(video.videoWidth, video.videoHeight);
      renderer.setZoom(live.hasHwZoom ? 1 : live.zoom);
      renderer.setMirror(live.facing === "user");
      applyRendererFilter(renderer, live.filterId, live.intensity, live.vividBrightness);
      renderer.draw(video);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [applyRendererFilter, review]);

  useEffect(() => {
    if (permission !== "granted" || review) return undefined;
    const update = () => {
      const video = videoRef.current;
      if (video && video.readyState >= 2) {
        generateThumbs(video, liveRef.current.facing === "user");
      }
    };
    update();
    thumbTimerRef.current = window.setInterval(update, 1100);
    return () => window.clearInterval(thumbTimerRef.current);
  }, [generateThumbs, permission, review]);

  useEffect(() => {
    if (!showFilterName) return undefined;
    const id = window.setTimeout(() => setShowFilterName(false), 900);
    return () => window.clearTimeout(id);
  }, [showFilterName, filterId]);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") onClose();
      if (event.code === "Space" && !review) {
        event.preventDefault();
        if (mode === "video") {
          if (isRecording) stopRecording();
          else startRecording();
        } else {
          takePhoto();
        }
      }
      if (event.key === "f" && !review) onFlip();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isRecording, mode, onClose, onFlip, review, startRecording, stopRecording, takePhoto]);

  useEffect(() => () => {
    cancelAnimationFrame(rafRef.current);
    window.clearInterval(thumbTimerRef.current);
    window.clearInterval(recTimerRef.current);
    window.clearTimeout(focusTimerRef.current);
    window.clearTimeout(vividSelfieTimerRef.current);
    stopRecording();
    stopStream(streamRef.current);
    stopStream(audioStreamRef.current);
    objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
  }, [stopRecording, stopStream]);

  const filterLabel = getFilterById(review?.filterId || filterId).label;

  return (
    <div className="camera-app">
      <div className="camera-stage">
        <CameraViewfinder
          videoRef={videoRef}
          canvasRef={canvasRef}
          mode={mode}
          countdown={countdown}
          isRecording={isRecording}
          recLabel={formatRecTime(recSeconds)}
          filterLabel={filterLabel}
          showFilterName={showFilterName}
          flashOn={flashOn}
          focusPt={focusPt}
          onPointerDown={onViewPointerDown}
          onPointerMove={onViewPointerMove}
          onPointerUp={onViewPointerUp}
        />

        {permission === "granted" && !review && (
          <>
            <CameraControls
              flash={flash}
              timer={timer}
              showFilters={showFilters}
              mode={mode}
              zoom={zoom >= 1.5 ? 2 : 1}
              isRecording={isRecording}
              isCapturing={isCapturing}
              lastThumb={lastThumb}
              flipSpin={flipSpin}
              onClose={onClose}
              onCycleFlash={cycleFlash}
              onCycleTimer={cycleTimer}
              onToggleFilters={() => setShowFilters((v) => !v)}
              onMode={onMode}
              onZoom={onZoom}
              onShutterDown={onShutterDown}
              onShutterUp={onShutterUp}
              onShutterClick={onShutterClick}
              onFlip={onFlip}
              onOpenLast={() => {
                if (lastThumb) showInfoToast("Capture another photo to edit it");
              }}
              filterSlot={
                showFilters ? (
                  <CameraFilterStrip
                    activeId={filterId}
                    intensity={intensity}
                    thumbs={thumbs}
                    onSelect={selectFilter}
                    onIntensity={setIntensity}
                  />
                ) : null
              }
            />
          </>
        )}

        {permission === "denied" && (
          <div className="camera-permission">
            <button className="camera-icon-btn camera-close-abs" onClick={onClose} aria-label="Close">
              <IconClose />
            </button>
            <IconCamera />
            <h1>Camera Access</h1>
            <p>{error || "Allow camera access to take photos and videos with iOS-style filters."}</p>
            <button className="camera-primary-btn" onClick={() => startCamera(facing)}>
              Enable Camera
            </button>
          </div>
        )}

        {review && (
          <CameraReview
            type={review.type}
            originalUrl={review.originalUrl}
            videoUrl={review.videoUrl}
            filterId={review.filterId || filterId}
            intensity={review.intensity ?? intensity}
            vividBrightness={review.vividBrightness ?? vividBrightness}
            thumbs={thumbs}
            busy={busy}
            onChangeFilter={(id) => setReview((prev) => ({ ...prev, filterId: id }))}
            onChangeIntensity={(value) => setReview((prev) => ({ ...prev, intensity: value }))}
            onRetake={() => setReview(null)}
            onDownload={handleDownload}
            onPost={handlePost}
            onUse={handleUse}
          />
        )}
      </div>
    </div>
  );
};

export default Camera;
