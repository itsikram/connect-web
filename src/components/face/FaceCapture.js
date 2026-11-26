import React, { useCallback, useEffect, useRef, useState } from "react";
import "./FaceCapture.css";
import { getActiveCallKind } from "../../utils/callSession";
import { getServerAddress } from "../../utils/offlineUtils";

// ~3.4 s of frames: long enough that a blink lands inside the burst even
// when the user reacts late to the cue (phones sample unevenly). The face
// service stops reading frames as soon as it has seen the blink, so a quick
// blink also means a quick answer. 400 px wide frames keep the upload small
// on mobile data while the face stays well above what the detector needs.
const FRAME_COUNT = 24;
const FRAME_INTERVAL_MS = 140;
const MAX_FRAME_WIDTH = 400;
const JPEG_QUALITY = 0.6;
// The cue appears just after capture starts, so the frames before it show
// the eyes open and the blink comes after them.
const BLINK_CUE_DELAY_MS = 350;
// Camera exposure settles for a moment after the stream starts.
const AUTO_SCAN_DELAY_MS = 700;
// A missed blink (or a face out of frame) is retried once on its own
// before the user has to tap anything.
const AUTO_RETRY_CODES = new Set(["liveness_failed", "no_face"]);
const MAX_AUTO_RETRIES = 1;
const BLINK_PROMPT_BN = "একবার চোখ পিটপিট করুন";

const PHASE_TEXT = {
  starting: "Starting camera…",
  ready: "Center your face in the oval.",
  capturing: "Look at the camera and blink once.",
  verifying: "Verifying your face…",
  success: "Face verified",
  error: "",
  denied: "Camera access is required. Allow the camera and try again.",
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const waitForVideoReady = async (video) => {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (
      video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
      video.videoWidth > 0 &&
      video.videoHeight > 0
    ) {
      return;
    }
    await sleep(50);
  }
  throw new Error("Camera video did not provide usable frames");
};

const speakPrompt = () => {
  try {
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(BLINK_PROMPT_BN);
    utterance.lang = "bn-BD";
    utterance.rate = 1.05;
    const voice = (synth.getVoices() || []).find((v) =>
      String(v.lang || "").toLowerCase().startsWith("bn"),
    );
    if (voice) utterance.voice = voice;
    synth.speak(utterance);
  } catch {
    /* speech is optional */
  }
};

/**
 * Live camera capture for face login / face registration.
 *
 * onCapture(frames) may return { success, error, code }; the panel then
 * shows the result and a retry button. A `liveness_failed` / `no_face` code
 * is retried once automatically. Callers that return nothing are treated as
 * done.
 */
const FaceCapture = ({
  onCapture,
  disabled = false,
  actionLabel = "Scan my face",
  autoStart = true,
  autoScan = true,
}) => {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(null);
  const mountedRef = useRef(true);
  const autoScannedRef = useRef(false);
  const [phase, setPhase] = useState("starting");
  const [message, setMessage] = useState("");
  const [progress, setProgress] = useState(0);
  const [blinkCue, setBlinkCue] = useState(false);

  const setSafe = useCallback((fn) => {
    if (mountedRef.current) fn();
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const startCamera = useCallback(async () => {
    // A video call is using the camera; taking it would freeze the call.
    if (getActiveCallKind() === "video") {
      setPhase("error");
      setMessage("Your camera is in use by the video call. Try again after the call.");
      return;
    }
    setPhase("starting");
    setMessage("");
    setProgress(0);
    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "user" },
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 30 },
        },
      });
      if (!mountedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) throw new Error("Camera preview is unavailable");
      video.srcObject = stream;
      await video.play();
      await waitForVideoReady(video);
      setSafe(() => setPhase("ready"));
    } catch (error) {
      console.error("Unable to access camera:", error);
      setSafe(() => setPhase("denied"));
    }
  }, [setSafe, stopCamera]);

  // Let the face service load its models while the camera starts and the
  // user frames their face, so the scan's answer does not wait on that.
  useEffect(() => {
    try {
      fetch(`${getServerAddress()}/api/auth/face/warmup`, { method: "POST" }).catch(() => {});
    } catch {
      /* warm-up is only an optimisation */
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    // The panel only opens after the user asked for face login, so the
    // camera can start right away instead of needing a second click.
    if (autoStart) startCamera();
    return () => {
      mountedRef.current = false;
      stopCamera();
      try {
        window.speechSynthesis?.cancel();
      } catch {
        /* ignore */
      }
    };
  }, [autoStart, startCamera, stopCamera]);

  /** One burst of frames, or null when the camera stopped mid-way. */
  const recordBurst = useCallback(async (video, track) => {
    const scale = Math.min(1, MAX_FRAME_WIDTH / video.videoWidth);
    const canvas = canvasRef.current || document.createElement("canvas");
    canvasRef.current = canvas;
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const context = canvas.getContext("2d");
    if (!context || !canvas.width || !canvas.height) return null;

    setSafe(() => {
      setPhase("capturing");
      setProgress(0);
      setBlinkCue(false);
    });
    const cueTimer = setTimeout(() => {
      setSafe(() => setBlinkCue(true));
      speakPrompt();
    }, BLINK_CUE_DELAY_MS);

    const frames = [];
    const startedAt = performance.now();
    try {
      for (let index = 0; index < FRAME_COUNT; index += 1) {
        if (track.readyState !== "live") return null;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        frames.push(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
        setSafe(() => setProgress(Math.round(((index + 1) / FRAME_COUNT) * 100)));
        if (index < FRAME_COUNT - 1) {
          // Keep an even pace: JPEG encoding time on slow phones would
          // otherwise stretch the gaps and skip over a quick blink.
          const due = startedAt + (index + 1) * FRAME_INTERVAL_MS;
          await sleep(Math.max(0, due - performance.now()));
        }
      }
    } finally {
      clearTimeout(cueTimer);
      setSafe(() => setBlinkCue(false));
    }
    return frames;
  }, [setSafe]);

  const capture = useCallback(async () => {
    const video = videoRef.current;
    const track = streamRef.current?.getVideoTracks?.()[0];
    if (!video || (phase !== "ready" && phase !== "error")) return;
    if (!track || track.readyState !== "live") {
      setMessage("A live camera is required. Video files and replays are not accepted.");
      startCamera();
      return;
    }
    setMessage("");

    let result;
    for (let attempt = 0; attempt <= MAX_AUTO_RETRIES; attempt += 1) {
      const frames = await recordBurst(video, track);
      if (!mountedRef.current) return;
      if (!frames) {
        setPhase("error");
        setMessage("Capture was interrupted. Please try again.");
        return;
      }
      setPhase("verifying");
      try {
        result = await onCapture(frames);
      } catch (error) {
        result = {
          success: false,
          error: error?.message || "Face verification failed. Please try again.",
        };
      }
      if (!mountedRef.current) return;
      const retry =
        result &&
        result.success === false &&
        AUTO_RETRY_CODES.has(result.code) &&
        attempt < MAX_AUTO_RETRIES &&
        track.readyState === "live";
      if (!retry) break;
      setMessage(
        result.code === "no_face"
          ? "Move your face into the oval…"
          : "Didn't catch a blink — once more, blink when you see the eye.",
      );
    }

    if (result && result.success === false) {
      setPhase("error");
      setMessage(
        result.error ||
          "We couldn't verify your face. Face the light, blink once and try again.",
      );
      return;
    }
    setPhase("success");
    setMessage("");
    stopCamera();
  }, [onCapture, phase, recordBurst, startCamera, stopCamera]);

  // Start the first scan by itself once the camera is ready: the user
  // already asked for face login by opening this panel.
  useEffect(() => {
    if (!autoScan || disabled || phase !== "ready" || autoScannedRef.current) return undefined;
    const timer = setTimeout(() => {
      autoScannedRef.current = true;
      capture();
    }, AUTO_SCAN_DELAY_MS);
    return () => clearTimeout(timer);
  }, [autoScan, capture, disabled, phase]);

  const busy = phase === "capturing" || phase === "verifying";
  const statusText = message || PHASE_TEXT[phase] || "";
  const ringState =
    phase === "success"
      ? "success"
      : phase === "error" || phase === "denied"
        ? "error"
        : busy
          ? "active"
          : "idle";

  return (
    <div className="face-capture-card">
      <div className={`face-capture-stage ring-${ringState}`}>
        <video
          ref={videoRef}
          className="face-capture-video"
          muted
          playsInline
          autoPlay
        />
        <div className="face-capture-mask" aria-hidden="true">
          <div className="face-capture-oval" />
        </div>
        {phase === "capturing" && blinkCue && (
          <div className="face-capture-blink" aria-hidden="true">
            <i className="fas fa-eye" />
            <span>Blink now</span>
          </div>
        )}
        {phase === "starting" && (
          <div className="face-capture-overlay">
            <span className="face-capture-spinner" />
          </div>
        )}
        {phase === "verifying" && (
          <div className="face-capture-overlay">
            <span className="face-capture-spinner" />
            <span>Verifying…</span>
          </div>
        )}
        {phase === "success" && (
          <div className="face-capture-overlay success">
            <i className="fas fa-check-circle" />
            <span>Verified</span>
          </div>
        )}
        {phase === "denied" && (
          <div className="face-capture-overlay error">
            <i className="fas fa-video-slash" />
          </div>
        )}
        {(phase === "capturing" || phase === "verifying") && (
          <div className="face-capture-progress">
            <div
              className="face-capture-progress-bar"
              style={{ width: `${phase === "verifying" ? 100 : progress}%` }}
            />
          </div>
        )}
      </div>

      <p
        className={`face-capture-status ${phase === "error" || phase === "denied" ? "is-error" : ""} ${phase === "success" ? "is-success" : ""}`}
        aria-live="polite"
      >
        {statusText}
      </p>
      <p className="face-capture-note">
        <i className="fas fa-shield-alt" /> Live camera only. Photos, screen
        recordings and video files are rejected.
      </p>

      {phase === "denied" ? (
        <button
          type="button"
          className="btn btn-outline-primary face-capture-btn"
          onClick={startCamera}
          disabled={disabled}
        >
          <i className="fas fa-video me-2" />
          Allow camera
        </button>
      ) : phase !== "success" ? (
        <button
          type="button"
          className="btn btn-primary face-capture-btn"
          onClick={capture}
          disabled={disabled || busy || phase === "starting"}
        >
          {phase === "capturing" ? (
            `Scanning… ${progress}%`
          ) : phase === "verifying" ? (
            "Verifying…"
          ) : phase === "starting" ? (
            "Starting camera…"
          ) : (
            <>
              <i className={`fas ${phase === "error" ? "fa-redo" : "fa-user-check"} me-2`} />
              {phase === "error" ? "Try again" : actionLabel}
            </>
          )}
        </button>
      ) : null}
    </div>
  );
};

export default FaceCapture;
