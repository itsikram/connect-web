import React, { useCallback, useEffect, useRef, useState } from "react";
import "./FaceCapture.css";

// Matches the app: 15 frames at up to 640×480, JPEG quality 0.5, spread over
// ~2 seconds so a natural blink is captured for the liveness check. Smaller
// frames upload several times faster than full-resolution captures.
const FRAME_COUNT = 15;
const FRAME_INTERVAL_MS = 130;
const MAX_FRAME_WIDTH = 640;
const JPEG_QUALITY = 0.5;
const CAPTURE_PROMPT_BN =
  "আপনার মুখ ফ্রেমের মাঝখানে রাখুন এবং চোখ পিটপিট করুন।";

const PHASE_TEXT = {
  starting: "Starting camera…",
  ready: "Center your face in the oval, then tap Scan.",
  capturing: "Hold still and blink once naturally…",
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
    const utterance = new SpeechSynthesisUtterance(CAPTURE_PROMPT_BN);
    utterance.lang = "bn-BD";
    utterance.rate = 0.95;
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
 * onCapture(frames) may return { success, error }; the panel then shows the
 * result and a retry button. Callers that return nothing are treated as done.
 */
const FaceCapture = ({
  onCapture,
  disabled = false,
  actionLabel = "Scan my face",
  autoStart = true,
}) => {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(null);
  const mountedRef = useRef(true);
  const [phase, setPhase] = useState("starting");
  const [message, setMessage] = useState("");
  const [progress, setProgress] = useState(0);

  const setSafe = useCallback((fn) => {
    if (mountedRef.current) fn();
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const startCamera = useCallback(async () => {
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

  const capture = useCallback(async () => {
    const video = videoRef.current;
    const track = streamRef.current?.getVideoTracks?.()[0];
    if (!video || phase !== "ready" && phase !== "error") return;
    if (!track || track.readyState !== "live") {
      setMessage("A live camera is required. Video files and replays are not accepted.");
      startCamera();
      return;
    }

    const scale = Math.min(1, MAX_FRAME_WIDTH / video.videoWidth);
    const canvas = canvasRef.current || document.createElement("canvas");
    canvasRef.current = canvas;
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const context = canvas.getContext("2d");
    if (!context || !canvas.width || !canvas.height) {
      setMessage("Camera is still starting. Please try again in a moment.");
      return;
    }

    setPhase("capturing");
    setMessage("");
    setProgress(0);
    speakPrompt();

    const frames = [];
    try {
      for (let index = 0; index < FRAME_COUNT; index += 1) {
        if (track.readyState !== "live") {
          throw new Error("Camera stream stopped during capture");
        }
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        frames.push(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
        setSafe(() => setProgress(Math.round(((index + 1) / FRAME_COUNT) * 100)));
        if (index < FRAME_COUNT - 1) await sleep(FRAME_INTERVAL_MS);
      }
    } catch (error) {
      setSafe(() => {
        setPhase("error");
        setMessage("Capture was interrupted. Please try again.");
      });
      return;
    }

    setSafe(() => setPhase("verifying"));
    let result;
    try {
      result = await onCapture(frames);
    } catch (error) {
      result = {
        success: false,
        error: error?.message || "Face verification failed. Please try again.",
      };
    }
    if (!mountedRef.current) return;
    if (result && result.success === false) {
      setPhase("error");
      setMessage(
        result.error ||
          "We couldn't verify your face. Face the light, blink naturally and try again.",
      );
      return;
    }
    setPhase("success");
    stopCamera();
  }, [onCapture, phase, setSafe, startCamera, stopCamera]);

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
