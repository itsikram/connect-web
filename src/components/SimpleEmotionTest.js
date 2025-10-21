import React, { useState, useRef, useEffect } from 'react';
import * as faceapi from "@vladmandic/face-api";

const SimpleEmotionTest = () => {
  const videoRef = useRef(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [emotion, setEmotion] = useState('');
  const [confidence, setConfidence] = useState(0);
  const [faceCount, setFaceCount] = useState(0);
  const [error, setError] = useState('');
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [lastDetection, setLastDetection] = useState(null);
  const intervalRef = useRef(null);

  const loadModels = async () => {
    try {
      console.log('Loading basic models...');
      await faceapi.nets.tinyFaceDetector.loadFromUri("/models");
      await faceapi.nets.faceExpressionNet.loadFromUri("/models");
      console.log('Models loaded successfully');
      setModelsLoaded(true);
    } catch (err) {
      console.error('Failed to load models:', err);
      setError('Failed to load models: ' + err.message);
    }
  };

  const startVideo = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        console.log('Video started');
      }
    } catch (err) {
      console.error('Failed to start video:', err);
      setError('Failed to start video: ' + err.message);
    }
  };

  const startDetection = () => {
    if (!modelsLoaded) {
      setError('Models not loaded yet');
      return;
    }
    
    setIsDetecting(true);
    setError('');
    
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    
    // Start detection interval
    intervalRef.current = setInterval(async () => {
      setLastDetection(new Date().toLocaleTimeString());
      
      if (videoRef.current && videoRef.current.readyState === 4) {
        try {
          console.log('Running detection...');
          const detections = await faceapi.detectAllFaces(
            videoRef.current,
            new faceapi.TinyFaceDetectorOptions()
          ).withFaceExpressions();
          
          setFaceCount(detections.length);
          
          if (detections.length > 0) {
            const emotions = detections[0].expressions;
            const emotionEntries = Object.entries(emotions);
            const sortedEmotions = emotionEntries.sort((a, b) => b[1] - a[1]);
            const [dominantEmotion, emotionConfidence] = sortedEmotions[0];
            
            setEmotion(dominantEmotion);
            setConfidence(emotionConfidence);
            
            console.log('Detection result:', {
              emotion: dominantEmotion,
              confidence: emotionConfidence,
              allEmotions: emotions
            });
          } else {
            setEmotion('');
            setConfidence(0);
            console.log('No faces detected');
          }
        } catch (err) {
          console.error('Detection error:', err);
          setError('Detection error: ' + err.message);
        }
      } else {
        console.log('Video not ready, skipping detection');
      }
    }, 1000); // Update every second
  };

  const stopDetection = () => {
    setIsDetecting(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  useEffect(() => {
    loadModels();
    startVideo();
    
    // Cleanup interval on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <h2>Simple Emotion Detection Test</h2>
      
      <div style={{ marginBottom: '20px' }}>
        <video
          ref={videoRef}
          autoPlay
          muted
          width="400"
          height="300"
          style={{ border: '2px solid #ccc', borderRadius: '8px' }}
        />
      </div>
      
      <div style={{ marginBottom: '20px' }}>
        <button
          onClick={startDetection}
          disabled={!modelsLoaded || isDetecting}
          style={{
            padding: '10px 20px',
            marginRight: '10px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Start Detection
        </button>
        
        <button
          onClick={stopDetection}
          disabled={!isDetecting}
          style={{
            padding: '10px 20px',
            backgroundColor: '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Stop Detection
        </button>
      </div>
      
      <div style={{ 
        background: '#f8f9fa', 
        padding: '15px', 
        borderRadius: '8px',
        marginBottom: '20px'
      }}>
        <h3>Status</h3>
        <p>Models loaded: {modelsLoaded ? '✅ Yes' : '❌ No'}</p>
        <p>Detection active: {isDetecting ? '✅ Yes' : '❌ No'}</p>
        <p>Update frequency: ⏱️ Every 1 second</p>
        <p>Faces detected: {faceCount}</p>
        <p>Video ready: {videoRef.current?.readyState === 4 ? '✅ Yes' : '❌ No'}</p>
        {lastDetection && (
          <p>Last detection: {lastDetection}</p>
        )}
        {emotion && (
          <p>Emotion: <strong>{emotion}</strong> ({(confidence * 100).toFixed(1)}%)</p>
        )}
        {error && (
          <p style={{ color: 'red' }}>Error: {error}</p>
        )}
      </div>
      
      <div style={{ fontSize: '14px', color: '#666' }}>
        <p>Instructions:</p>
        <ul>
          <li>Make sure to allow camera access</li>
          <li>Look at the camera and make different facial expressions</li>
          <li>Try smiling, frowning, looking surprised, etc.</li>
          <li>Check the browser console for detailed logs</li>
        </ul>
      </div>
    </div>
  );
};

export default SimpleEmotionTest;
