import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import './EmotionDetector.css';

export default function EmotionDetector() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [detectionData, setDetectionData] = useState(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [error, setError] = useState(null);
  const sessionIdRef = useRef(`session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);

  useEffect(() => {
    // Request access to webcam
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480 },
        });
        videoRef.current.srcObject = stream;
        setError(null);
      } catch (err) {
        console.error('Error accessing webcam:', err);
        setError('Camera access denied. Please allow camera access.');
      }
    };

    startCamera();

    // Capture 5 images every 1.5 seconds for batch analysis
    const interval = setInterval(() => {
      captureMultipleFrames();
    }, 1500);

    return () => {
      clearInterval(interval);
      // Stop camera when component unmounts
      if (videoRef.current && videoRef.current.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const captureMultipleFrames = async () => {
    if (!videoRef.current || !videoRef.current.videoWidth) return;

    setIsDetecting(true);
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    // Set canvas size same as video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const images = [];

    try {
      // Capture 5 images with small intervals for variations
      for (let i = 0; i < 5; i++) {
        // Wait a bit between captures (except first one)
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 100)); // 100ms between frames
        }

        // Draw current video frame to canvas
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Convert to base64 with slight quality variation for diversity
        const quality = 0.8 + (i * 0.05); // 0.8, 0.85, 0.9, 0.95, 1.0
        const base64 = canvas.toDataURL('image/jpeg', quality);
        images.push(base64);
      }

      // Send batch to backend
      const res = await axios.post('http://localhost:5000/emotion', {
        images: images,
        session_id: sessionIdRef.current
      });

      setDetectionData(res.data);
      setError(null);
    } catch (err) {
      console.error('Error detecting emotion:', err);
      setError('Server error. Make sure the emotion detection server is running on port 5000.');
    } finally {
      setIsDetecting(false);
    }
  };

  // Keep single frame function for testing/fallback
  const captureSingleFrame = async () => {
    if (!videoRef.current || !videoRef.current.videoWidth) return;

    setIsDetecting(true);
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const base64 = canvas.toDataURL('image/jpeg');

    try {
      const res = await axios.post('http://localhost:5000/emotion', {
        image: base64,
        session_id: sessionIdRef.current
      });

      setDetectionData(res.data);
      setError(null);
    } catch (err) {
      console.error('Error detecting emotion:', err);
      setError('Server error. Make sure the emotion detection server is running on port 5000.');
    } finally {
      setIsDetecting(false);
    }
  };

  const getEmotionEmoji = (emotion) => {
    const emojiMap = {
      happy: '😊',
      sad: '😢',
      angry: '😠',
      surprise: '😲',
      fear: '😨',
      disgust: '🤢',
      neutral: '😐',
    };
    return emojiMap[emotion] || '😐';
  };

  const getStateEmoji = (state) => {
    const emojiMap = {
      speaking: '🗣️',
      smiling: '😄',
      crying: '😭',
      sleepy: '😴',
      winking: '😉',
    };
    return emojiMap[state] || '👤';
  };

  const getConfidenceColor = (confidence) => {
    if (confidence >= 0.7) return '#4caf50'; // Green
    if (confidence >= 0.4) return '#ff9800'; // Orange
    return '#f44336'; // Red
  };

  return (
    <div className="emotion-detector-container">
      <h1 className="title">🎭 Real-Time Emotion & Facial State Detection</h1>
      
      <div className="main-content">
        <div className="video-section">
          <div className="video-wrapper">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="video-feed"
            />
            {isDetecting && (
              <div className="detecting-overlay">
                <div className="spinner"></div>
                <p>Analyzing...</p>
              </div>
            )}
            {detectionData && detectionData.states?.speaking?.detected && (
              <div className="speaking-indicator">
                <div className="speaking-pulse"></div>
                <span>🗣️ Speaking ({(detectionData.states.speaking.confidence * 100).toFixed(0)}%)</span>
              </div>
            )}
            {detectionData && (
              <div className="video-info">
                <span className="info-badge">
                  {detectionData.batch_analysis ? 
                    `📸 Batch Analysis: ${detectionData.images_processed || 5} images` :
                    detectionData.speaking_analysis ? 
                      `🎥 Motion: ${detectionData.speaking_analysis.motion_score > 0 ? 
                        `${(detectionData.speaking_analysis.motion_score * 100).toFixed(1)}%` : 
                        'Tracking...'}` :
                      '🔄 Processing...'
                  }
                </span>
              </div>
            )}
          </div>
          <canvas ref={canvasRef} style={{ display: 'none' }} />
        </div>

        <div className="results-section">
          {error ? (
            <div className="error-message">
              <span className="error-icon">⚠️</span>
              <p>{error}</p>
            </div>
          ) : detectionData ? (
            <>
              {/* Basic Emotion */}
              <div className="result-card emotion-card">
                <h2>Primary Emotion
                  {detectionData.batch_analysis && (
                    <span className="batch-info"> (Best of {detectionData.images_processed})</span>
                  )}
                </h2>
                <div className="emotion-display">
                  <span className="emotion-emoji">{getEmotionEmoji(detectionData.emotion)}</span>
                  <span className="emotion-name">{detectionData.emotion || 'Unknown'}</span>
                  {detectionData.batch_analysis && detectionData.emotion_confidence && (
                    <span className="emotion-confidence">
                      {detectionData.emotion_confidence.toFixed(1)}% confident
                    </span>
                  )}
                </div>
                {detectionData.batch_analysis && detectionData.emotion_source_image !== undefined && (
                  <div className="source-info">
                    <span className="source-badge">
                      📷 From image #{detectionData.emotion_source_image + 1}
                    </span>
                  </div>
                )}
                {detectionData.emotion_scores && (
                  <div className="emotion-scores">
                    <h3>All Emotions:</h3>
                    {Object.entries(detectionData.emotion_scores)
                      .sort((a, b) => b[1] - a[1])
                      .map(([emotion, score]) => (
                        <div key={emotion} className="score-bar-container">
                          <span className="score-label">
                            {getEmotionEmoji(emotion)} {emotion}
                          </span>
                          <div className="score-bar-bg">
                            <div
                              className="score-bar-fill"
                              style={{
                                width: `${score}%`,
                                backgroundColor: getConfidenceColor(score / 100),
                              }}
                            />
                          </div>
                          <span className="score-value">{score.toFixed(1)}%</span>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* Facial States */}
              <div className="result-card states-card">
                <h2>Facial States 
                  {detectionData.detected_states_count !== undefined && (
                    <span className="states-count"> ({detectionData.detected_states_count} active)</span>
                  )}
                </h2>
                
                {detectionData.dominant_state && (
                  <div className="dominant-state">
                    <span className="state-emoji">{getStateEmoji(detectionData.dominant_state)}</span>
                    <div>
                      <p className="dominant-label">Dominant State</p>
                      <p className="dominant-name">{detectionData.dominant_state}</p>
                      <p className="dominant-confidence">
                        {(detectionData.confidence * 100).toFixed(1)}% confidence
                      </p>
                    </div>
                  </div>
                )}
                
                <div className="states-grid">
                  {detectionData.states && Object.entries(detectionData.states).map(([stateName, stateData]) => (
                    <div
                      key={stateName}
                      className={`state-item ${stateData.detected ? 'detected' : 'not-detected'}`}
                    >
                      <span className="state-emoji">{getStateEmoji(stateName)}</span>
                      <div className="state-info">
                        <p className="state-name">{stateName}</p>
                        {stateData.detected ? (
                          <>
                            <p className="state-confidence" style={{ color: getConfidenceColor(stateData.confidence) }}>
                              {(stateData.confidence * 100).toFixed(1)}% confident
                            </p>
                            {stateName === 'winking' && stateData.eye && (
                              <p className="state-extra">({stateData.eye} eye)</p>
                            )}
                            {stateName === 'speaking' && stateData.method === 'video_motion' && (
                              <p className="state-extra">
                                (Motion: {(stateData.motion_score * 100).toFixed(1)}%)
                              </p>
                            )}
                            {detectionData.batch_analysis && stateData.source_image !== undefined && (
                              <p className="state-extra">
                                📷 Image #{stateData.source_image + 1}
                              </p>
                            )}
                          </>
                        ) : (
                          <p className="state-not-detected">Not detected</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                
                {detectionData.states_error && (
                  <div className="detection-error">
                    <p>⚠️ State detection error: {detectionData.states_error}</p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="waiting-message">
              <div className="spinner"></div>
              <p>Waiting for detection...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
