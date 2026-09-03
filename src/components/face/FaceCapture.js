import React, { useEffect, useRef, useState } from "react";

const MAX_CAPTURE_ATTEMPTS = 90;
const MIN_CAPTURE_FRAMES = 20;
const FRAME_INTERVAL_MS = 100;

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

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  const startCamera = async () => {
    setStatus("");
    setProgress(0);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "user" },
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) throw new Error("Camera preview is unavailable");
      video.srcObject = stream;
      await video.play();
      await waitForVideoReady(video);
      setCameraStarted(true);
    } catch (error) {
      console.error("Unable to access camera:", error);
      setStatus("Camera access is required. Please allow permission and try again.");
    }
  };

  const capture = async () => {
    if (!videoRef.current || !cameraStarted || capturing) return;
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
    try {
      for (let index = 0; index < MAX_CAPTURE_ATTEMPTS; index += 1) {
        if (videoTrack.readyState !== "live") {
          throw new Error("Camera stream stopped during capture");
        }
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        frames.push(canvas.toDataURL("image/jpeg", 0.7));
        setProgress(Math.min(95, Math.round(((index + 1) / MAX_CAPTURE_ATTEMPTS) * 100)));
        if (frames.length >= MIN_CAPTURE_FRAMES) break;
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
    setStatus(`Sending ${frames.length} live frames for server verification...`);
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
          {capturing ? `Capturing… ${progress}%` : "Start face check"}
        </button>
      )}
    </div>
  );
};

export default FaceCapture;
