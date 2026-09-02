import React, { useEffect, useRef, useState } from "react";

const FRAME_COUNT = 20;
const FRAME_INTERVAL_MS = 100;

const FaceCapture = ({ onCapture, disabled = false }) => {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [cameraStarted, setCameraStarted] = useState(false);
  const [status, setStatus] = useState("");
  const [capturing, setCapturing] = useState(false);

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  const startCamera = async () => {
    setStatus("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setCameraStarted(true);
    } catch (error) {
      console.error("Unable to access camera:", error);
      setStatus("Camera access is required. Please allow permission and try again.");
    }
  };

  const capture = async () => {
    if (!videoRef.current || !cameraStarted || capturing) return;

    setCapturing(true);
    setStatus("Look at the camera and blink naturally...");
    const video = videoRef.current;
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      setStatus("Camera is still starting. Please try Capture again in a moment.");
      setCapturing(false);
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const context = canvas.getContext("2d");
    const frames = [];

    for (let index = 0; index < FRAME_COUNT; index += 1) {
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      frames.push(canvas.toDataURL("image/jpeg", 0.7));
      await new Promise((resolve) => setTimeout(resolve, FRAME_INTERVAL_MS));
    }

    if (frames.length < FRAME_COUNT) {
      setStatus("Could not capture enough camera frames. Please try again.");
      setCapturing(false);
      return;
    }

    setStatus(`Captured ${frames.length} frames. Verifying...`);
    setCapturing(false);
    await onCapture(frames);
  };

  return (
    <div className="face-capture">
      <video
        ref={videoRef}
        muted
        playsInline
        width="320"
        height="240"
        style={{ maxWidth: "100%", background: "#111", borderRadius: "8px" }}
      />
      <p className="small text-muted mb-2">
        {status || "Start the camera, then capture while looking at the camera."}
      </p>
      {!cameraStarted ? (
        <button type="button" className="btn btn-outline-primary" onClick={startCamera} disabled={disabled}>
          Start camera
        </button>
      ) : (
        <button type="button" className="btn btn-primary" onClick={capture} disabled={disabled || capturing}>
          {capturing ? "Capturing..." : "Capture"}
        </button>
      )}
    </div>
  );
};

export default FaceCapture;
