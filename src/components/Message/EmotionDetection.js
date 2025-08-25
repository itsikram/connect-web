import React, { useRef, useEffect, useState } from "react";
import * as faceapi from "face-api.js";

const EmotionDetection = () => {
  const videoRef = useRef(null);
  const [emotion, setEmotion] = useState("");

  useEffect(() => {
    startVideo();
    loadModels();
  }, []);

  const startVideo = () => {
    navigator.mediaDevices.getUserMedia({ video: true })
      .then((stream) => {
        videoRef.current.srcObject = stream;
      })
      .catch((err) => console.error("Error accessing webcam: ", err));
  };

  const loadModels = async () => {
    await faceapi.nets.tinyFaceDetector.loadFromUri("/models");
    await faceapi.nets.faceExpressionNet.loadFromUri("/models");
    detectEmotions();
  };

  const detectEmotions = () => {
    setInterval(async () => {
      if (videoRef.current) {
        const detections = await faceapi.detectAllFaces(videoRef.current, new faceapi.TinyFaceDetectorOptions())
          .withFaceExpressions();
        
        if (detections.length > 0) {
          const emotions = detections[0].expressions;
          const maxEmotion = Object.keys(emotions).reduce((a, b) => emotions[a] > emotions[b] ? a : b);
          setEmotion(maxEmotion);
        }

      }
    }, 500);
  };
  return (
    <div>
      <video style={{display: 'none'}} ref={videoRef} autoPlay muted width="600" height="400" />
    </div>
  );
};


export default EmotionDetection;
