import React, { useEffect, useRef, useState } from "react";
import * as faceapi from "@vladmandic/face-api";

const MAX_CAPTURE_ATTEMPTS = 90;
const MIN_CAPTURE_FRAMES = 20;
const FRAME_INTERVAL_MS = 100;
const BLINK_MIN_CLOSED_FRAMES = 2;
const BLINK_CLOSED_RATIO = 0.72;
const BLINK_OPEN_RATIO = 0.86;
const OPEN_CALIBRATION_FRAMES = 8;
const MODEL_URL = "/models";

let modelsPromise;

const loadBlinkModels = () => {
  if (!modelsPromise) {
    modelsPromise = Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
    ]).catch((error) => {
      modelsPromise = undefined;
      throw error;
    });
  }
  return modelsPromise;
};

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

const eyeAspectRatio = (points) => {
  const vertical = distance(points[1], points[5]) + distance(points[2], points[4]);
  const horizontal = 2 * distance(points[0], points[3]);
  return horizontal ? vertical / horizontal : 0;
};

const getEyeRatio = (landmarks) => {
  const points = landmarks.positions;
  const left = [36, 37, 38, 39, 40, 41].map((index) => points[index]);
  const right = [42, 43, 44, 45, 46, 47].map((index) => points[index]);
  return (eyeAspectRatio(left) + eyeAspectRatio(right)) / 2;
};

const waitForVideoReady = async (video) => {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (
      video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
      video.videoWidth > 0 &&
      video.videoHeight > 0
    ) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Camera video did not provide usable frames");
};

const FaceCapture = ({ onCapture, disabled = false }) => {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [cameraStarted, setCameraStarted] = useState(false);
  const [status, setStatus] = useState("");
  const [capturing, setCapturing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [modelsReady, setModelsReady] = useState(false);

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  const startCamera = async () => {
    setStatus("");
    setProgress(0);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) throw new Error("Camera preview is unavailable");
      video.srcObject = stream;
      await video.play();
      await waitForVideoReady(video);
      setCameraStarted(true);
      try {
        await loadBlinkModels();
        setModelsReady(true);
      } catch (error) {
        console.error("Unable to load face liveness models:", error);
        setStatus("Face liveness could not start. Please refresh and try again.");
      }
    } catch (error) {
      console.error("Unable to access camera:", error);
      setStatus("Camera access is required. Please allow permission and try again.");
    }
  };

  const capture = async () => {
    if (!videoRef.current || !cameraStarted || !modelsReady || capturing) return;
    const stream = videoRef.current.srcObject;
    const videoTrack = stream?.getVideoTracks?.()[0];
    if (!(stream instanceof MediaStream) || !videoTrack || videoTrack.readyState !== "live") {
      setStatus("A live camera is required. Video files and replays are not accepted.");
      setCameraStarted(false);
      return;
    }

    setCapturing(true);
    setProgress(0);
    setStatus("Look at the camera and blink naturally...");
    const video = videoRef.current;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context || canvas.width === 0 || canvas.height === 0) {
      setStatus("Camera is still starting. Please try Capture again in a moment.");
      setCapturing(false);
      return;
    }
    const frames = [];
    const eyeRatios = [];
    const openSamples = [];
    let blinkDetected = false;
    let closedFrames = 0;
    let openBaseline = null;

    try {
      for (let index = 0; index < MAX_CAPTURE_ATTEMPTS; index += 1) {
        if (videoTrack.readyState !== "live") {
          throw new Error("Camera stream stopped during capture");
        }
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const detection = await faceapi
          .detectSingleFace(canvas, new faceapi.TinyFaceDetectorOptions({
            inputSize: 320,
            scoreThreshold: 0.5,
          }))
          .withFaceLandmarks();

        if (!detection || !detection.landmarks) {
          setStatus("Keep one face centered in the live camera.");
          await new Promise((resolve) => setTimeout(resolve, FRAME_INTERVAL_MS));
          continue;
        }

        const ratio = getEyeRatio(detection.landmarks);
        eyeRatios.push(ratio);
        if (openSamples.length < OPEN_CALIBRATION_FRAMES && ratio > 0.15) {
          openSamples.push(ratio);
          const sortedSamples = [...openSamples].sort((a, b) => a - b);
          openBaseline = sortedSamples[Math.floor(sortedSamples.length * 0.75)];
          setStatus(`Hold eyes open, calibrating… ${openSamples.length}/${OPEN_CALIBRATION_FRAMES}`);
        } else if (openSamples.length >= OPEN_CALIBRATION_FRAMES && openBaseline > 0) {
          const closedThreshold = Math.max(0.12, openBaseline * BLINK_CLOSED_RATIO);
          const openThreshold = openBaseline * BLINK_OPEN_RATIO;
          if (ratio < closedThreshold) {
            closedFrames += 1;
            setStatus("Eyes closed detected — open your eyes.");
          } else if (closedFrames >= BLINK_MIN_CLOSED_FRAMES && ratio >= openThreshold) {
            blinkDetected = true;
            closedFrames = 0;
            setStatus("Blink detected. Preparing verification…");
          } else if (ratio >= openThreshold) {
            closedFrames = 0;
            setStatus("Blink once naturally while keeping your face centered.");
          }
        }

        frames.push(canvas.toDataURL("image/jpeg", 0.7));
        setProgress(blinkDetected ? 100 : Math.min(95, Math.round(((index + 1) / MAX_CAPTURE_ATTEMPTS) * 100)));
        if (blinkDetected && frames.length >= MIN_CAPTURE_FRAMES) break;
        await new Promise((resolve) => setTimeout(resolve, FRAME_INTERVAL_MS));
      }
    } catch (error) {
      setStatus("Capture was interrupted. Please try again.");
      setCapturing(false);
      return;
    }

    if (frames.length < MIN_CAPTURE_FRAMES) {
      setStatus("Could not capture enough live camera frames. Please try again.");
      setCapturing(false);
      return;
    }
    if (!blinkDetected) {
      setStatus("No blink detected. Please blink once while the camera is capturing.");
      setCapturing(false);
      return;
    }

    setStatus(`Blink detected. Sending ${frames.length} live frames for verification...`);
    setCapturing(false);
    await onCapture(frames);
  };

  return (
    <div className="face-capture">
      <div className="position-relative">
      <video
        ref={videoRef}
        muted
        playsInline
        width="320"
        height="240"
        style={{ maxWidth: "100%", background: "#111", borderRadius: "8px" }}
      />
      {capturing && <div className="progress mt-2" style={{ height: 6 }}><div className="progress-bar" style={{ width: `${progress}%` }} /></div>}
      </div>
      <p className="small text-muted mb-2">
        {status || "Position one face in the frame, then blink once naturally."}
      </p>
      {!cameraStarted ? (
        <button type="button" className="btn btn-outline-primary" onClick={startCamera} disabled={disabled}>
          Start camera
        </button>
      ) : (
        <button type="button" className="btn btn-primary" onClick={capture} disabled={disabled || capturing}>
          {capturing ? `Watching for blink… ${progress}%` : modelsReady ? "Start face check" : "Loading liveness..."}
        </button>
      )}
    </div>
  );
};

export default FaceCapture;
