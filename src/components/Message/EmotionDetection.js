import React, { useRef, useEffect, useState, useCallback } from "react";
import * as faceapi from "@vladmandic/face-api";
import openaiService from '../../services/openaiService';
import { 
  smoothEmotionDetection, 
  detectComplexGestures, 
  calculateEngagementScore,
  formatEmotionDisplay,
  formatActionDisplay,
  EMOTION_THRESHOLDS 
} from '../../utils/emotionUtils';

const EmotionDetection = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [emotion, setEmotion] = useState("");
  const [confidence, setConfidence] = useState(0);
  const [actions, setActions] = useState([]);
  const [faceCount, setFaceCount] = useState(0);
  const [engagementScore, setEngagementScore] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [useOpenAI, setUseOpenAI] = useState(false);
  const [openaiStatus, setOpenaiStatus] = useState({});
  const intervalRef = useRef(null);
  const modelsLoadedRef = useRef(false);
  const previousDetections = useRef([]);
  const actionHistory = useRef([]);
  const emotionHistory = useRef([]);

  const startVideo = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        // Wait for video to be ready
        return new Promise((resolve) => {
          videoRef.current.onloadedmetadata = () => {
            console.log('Video loaded and ready');
            resolve();
          };
        });
      }
    } catch (err) {
      console.error("Error accessing webcam: ", err);
      setError("Failed to access webcam");
      throw err;
    }
  }, []);

  const checkOpenAIStatus = useCallback(() => {
    const status = openaiService.getStatus();
    setOpenaiStatus(status);
    return status.ready;
  }, []);

  const loadModels = useCallback(async () => {
    try {
      console.log('Loading face-api models...');
      
      // Load basic models first
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
        faceapi.nets.faceExpressionNet.loadFromUri("/models")
      ]);
      
      console.log('Basic models loaded successfully');
      
      // Try to load additional models
      try {
        await faceapi.nets.faceLandmark68Net.loadFromUri("/models");
        console.log('Landmark model loaded successfully');
      } catch (landmarkErr) {
        console.warn('Landmark model failed to load, continuing without it:', landmarkErr);
      }
      
      modelsLoadedRef.current = true;
      setIsLoading(false);
      
      return true;
    } catch (err) {
      console.error("Error loading basic models: ", err);
      setError("Failed to load face detection models");
      setIsLoading(false);
      throw err;
    }
  }, []);

  // Function to detect head movements and gestures
  const detectActions = useCallback((landmarks, currentDetection) => {
    if (!landmarks || !landmarks.positions) return [];

    const detectedActions = [];
    try {
      const jawLine = landmarks.getJawOutline();
      const nose = landmarks.getNose();
      const leftEye = landmarks.getLeftEye();
      const rightEye = landmarks.getRightEye();
      const mouth = landmarks.getMouth();

      // Store current detection for comparison
      if (previousDetections.current.length > 10) {
        previousDetections.current.shift(); // Keep only last 10 detections
      }
      previousDetections.current.push({
        jawLine,
        nose,
        leftEye,
        rightEye,
        mouth,
        timestamp: Date.now()
      });

      if (previousDetections.current.length >= 3) {
        const prev = previousDetections.current[previousDetections.current.length - 2];
        const current = { jawLine, nose, leftEye, rightEye, mouth };

        // Head nod detection (vertical movement)
        if (current.nose && prev.nose && current.nose.length > 3 && prev.nose.length > 3) {
          const noseYDiff = current.nose[3].y - prev.nose[3].y;
          if (Math.abs(noseYDiff) > 5) {
            if (noseYDiff > 0) detectedActions.push('nod_down');
            else detectedActions.push('nod_up');
          }
        }

        // Head shake detection (horizontal movement)
        if (current.nose && prev.nose && current.nose.length > 3 && prev.nose.length > 3) {
          const noseXDiff = current.nose[3].x - prev.nose[3].x;
          if (Math.abs(noseXDiff) > 8) {
            if (noseXDiff > 0) detectedActions.push('shake_right');
            else detectedActions.push('shake_left');
          }
        }

        // Eye blink detection
        if (current.leftEye && current.rightEye && 
            current.leftEye.length > 5 && current.rightEye.length > 5) {
          const leftEyeHeight = Math.abs(current.leftEye[1].y - current.leftEye[5].y);
          const rightEyeHeight = Math.abs(current.rightEye[1].y - current.rightEye[5].y);
          const avgEyeHeight = (leftEyeHeight + rightEyeHeight) / 2;
          
          if (avgEyeHeight < 3) {
            detectedActions.push('blink');
          }
        }

        // Mouth open detection
        if (current.mouth && current.mouth.length > 9) {
          const mouthHeight = Math.abs(current.mouth[3].y - current.mouth[9].y);
          const mouthWidth = Math.abs(current.mouth[0].x - current.mouth[6].x);
          const mouthRatio = mouthHeight / mouthWidth;

          if (mouthRatio > 0.5) {
            detectedActions.push('mouth_open');
          } else if (mouthRatio < 0.1) {
            detectedActions.push('mouth_closed');
          }

          // Smile detection (based on mouth corners)
          const leftCorner = current.mouth[0];
          const rightCorner = current.mouth[6];
          const mouthCenter = current.mouth[3];
          
          if (leftCorner.y < mouthCenter.y && rightCorner.y < mouthCenter.y) {
            detectedActions.push('smile');
          }
        }
      }

      return detectedActions;
    } catch (error) {
      console.error('Error in detectActions:', error);
      return [];
    }
  }, []);

  const detectEmotions = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    intervalRef.current = setInterval(async () => {
      console.log('EmotionDetection: Running detection cycle...');
      if (videoRef.current && videoRef.current.readyState === 4) {
        try {
          // Use OpenAI if enabled and available
          if (useOpenAI && checkOpenAIStatus()) {
            console.log('Using OpenAI for emotion detection...');
            const result = await openaiService.analyzeEmotionWithRetry(videoRef.current, 1);
            
            if (result.success && result.data) {
              const data = result.data;
              setEmotion(data.emotion || 'unknown');
              setConfidence(data.confidence || 0);
              setFaceCount(1); // Assume 1 face for OpenAI
              setActions([]); // OpenAI doesn't detect actions
              
              console.log('OpenAI Detection Results:', {
                emotion: data.emotion,
                confidence: data.confidence,
                intensity: data.intensity,
                additionalEmotions: data.additional_emotions
              });
              
              // Simple engagement score for OpenAI
              let currentEngagement = 0;
              if (data.confidence > 0.5) currentEngagement += 30;
              if (data.confidence > 0.7) currentEngagement += 30;
              if (data.intensity === 'high') currentEngagement += 20;
              if (data.intensity === 'medium') currentEngagement += 10;
              setEngagementScore(Math.min(currentEngagement, 100));
              
              return; // Skip face-api detection
            } else {
              console.warn('OpenAI detection failed, falling back to face-api');
            }
          }
          
          // Fallback to face-api detection
          if (!modelsLoadedRef.current) {
            console.log('Face-api models not loaded, skipping detection');
            return;
          }
          
          // Basic detection first
          let detections = await faceapi.detectAllFaces(
            videoRef.current, 
            new faceapi.TinyFaceDetectorOptions({ 
              inputSize: 416, 
              scoreThreshold: 0.5 
            })
          ).withFaceExpressions();
          
          // Try to add landmarks if available
          try {
            detections = await faceapi.detectAllFaces(
              videoRef.current, 
              new faceapi.TinyFaceDetectorOptions({ 
                inputSize: 416, 
                scoreThreshold: 0.5 
              })
            ).withFaceLandmarks().withFaceExpressions();
          } catch (landmarkErr) {
            console.log('Landmarks not available, using basic detection');
          }
          
          setFaceCount(detections.length);

          if (detections.length > 0) {
            const detection = detections[0];
            const emotions = detection.expressions;
            const landmarks = detection.landmarks;

            // Simple emotion detection
            const emotionEntries = Object.entries(emotions);
            const sortedEmotions = emotionEntries.sort((a, b) => b[1] - a[1]);
            const [dominantEmotion, emotionConfidence] = sortedEmotions[0];

            // Update emotion if confidence is above threshold
            if (emotionConfidence > 0.2) {
              setEmotion(dominantEmotion);
              setConfidence(emotionConfidence);
            }

            // Detect basic actions/gestures only if landmarks are available
            let basicActions = [];
            if (landmarks) {
              basicActions = detectActions(landmarks, detection);
            }
            
            if (basicActions.length > 0) {
              setActions(basicActions);
              
              // Add to action history
              actionHistory.current.push({
                actions: basicActions,
                timestamp: Date.now(),
                emotion: dominantEmotion,
                confidence: emotionConfidence
              });

              // Keep only recent actions
              if (actionHistory.current.length > 20) {
                actionHistory.current.shift();
              }
            }
            
            // Simple engagement score calculation
            let currentEngagement = 0;
            if (detections.length > 0) currentEngagement += 20;
            if (emotionConfidence > 0.5) currentEngagement += 30;
            if (basicActions.length > 0) currentEngagement += 20;
            if (emotionConfidence > 0.7) currentEngagement += 30;
            
            setEngagementScore(Math.min(currentEngagement, 100));

            // Enhanced logging
            console.log('Detection Results:', {
              emotion: dominantEmotion,
              confidence: emotionConfidence.toFixed(3),
              actions: basicActions,
              faceCount: detections.length,
              hasLandmarks: !!landmarks,
              allEmotions: Object.fromEntries(
                emotionEntries.map(([emotion, conf]) => [emotion, conf.toFixed(3)])
              )
            });

            // Draw detection results on canvas if available
            if (canvasRef.current) {
              const canvas = canvasRef.current;
              const ctx = canvas.getContext('2d');
              const displaySize = { width: videoRef.current.videoWidth, height: videoRef.current.videoHeight };
              
              // Resize canvas to match video
              canvas.width = displaySize.width;
              canvas.height = displaySize.height;
              
              // Clear previous drawings
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              
              // Draw face detection box
              const box = detection.detection.box;
              ctx.strokeStyle = '#00ff00';
              ctx.lineWidth = 2;
              ctx.strokeRect(box.x, box.y, box.width, box.height);
              
              // Draw landmarks
              if (landmarks) {
                ctx.fillStyle = '#ff0000';
                landmarks.positions.forEach(point => {
                  ctx.beginPath();
                  ctx.arc(point.x, point.y, 1, 0, 2 * Math.PI);
                  ctx.fill();
                });
              }
              
              // Draw emotion label
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(box.x, box.y - 30, 200, 25);
              ctx.fillStyle = '#000000';
              ctx.font = '16px Arial';
              ctx.fillText(`${dominantEmotion} (${(emotionConfidence * 100).toFixed(1)}%)`, box.x + 5, box.y - 10);
            }

          } else {
            console.log('EmotionDetection: No faces detected');
            setActions([]);
          }
        } catch (err) {
          console.error("Error in enhanced emotion detection: ", err);
        }
      } else {
        console.log('EmotionDetection: Conditions not met - video:', !!videoRef.current, 'models:', modelsLoadedRef.current, 'readyState:', videoRef.current?.readyState);
      }
    }, 1000); // Update every second
  }, [detectActions]);

  const initializeEmotionDetection = useCallback(async () => {
    try {
      console.log('Initializing emotion detection...');
      setIsLoading(true);
      setError(null);
      
      // Check OpenAI status
      checkOpenAIStatus();
      
      // Load models first
      console.log('Loading models...');
      await loadModels();
      console.log('Models loaded successfully');
      
      // Then start video
      console.log('Starting video...');
      await startVideo();
      console.log('Video started successfully');
      
      // Wait a bit for video to stabilize, then start detection
      console.log('Starting detection in 2 seconds...');
      setTimeout(() => {
        console.log('Starting emotion detection...');
        detectEmotions();
      }, 2000);
      
    } catch (err) {
      console.error("Failed to initialize emotion detection:", err);
      setError("Failed to initialize emotion detection");
      setIsLoading(false);
    }
  }, [loadModels, startVideo, detectEmotions, checkOpenAIStatus]);

  useEffect(() => {
    initializeEmotionDetection();

    // Cleanup function
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [initializeEmotionDetection]);

  return (
    <div style={{ position: 'relative' }}>
      <video 
        style={{display: 'none'}} 
        ref={videoRef} 
        autoPlay 
        muted 
        width="600" 
        height="400" 
        playsInline
      />
      
      {/* Canvas for drawing detection results - hidden by default */}
      <canvas 
        ref={canvasRef}
        style={{
          display: 'none', // Set to 'block' to show detection visualization
          position: 'absolute',
          top: 0,
          left: 0,
          pointerEvents: 'none'
        }}
      />
      
      {/* Enhanced debug information */}
      {process.env.NODE_ENV === 'development' && (
        <div style={{ 
          position: 'fixed', 
          top: '10px', 
          right: '10px', 
          background: 'rgba(0,0,0,0.9)', 
          color: 'white', 
          padding: '15px',
          borderRadius: '8px',
          fontSize: '12px',
          zIndex: 9999,
          minWidth: '250px',
          fontFamily: 'monospace'
        }}>
          <div style={{ borderBottom: '1px solid #333', paddingBottom: '8px', marginBottom: '8px' }}>
            <strong>🎭 Enhanced Emotion Detection</strong>
            <div style={{ fontSize: '10px', opacity: 0.7, marginTop: '2px' }}>
              ⏱️ Updates every 1 second
            </div>
            <div style={{ marginTop: '8px' }}>
              <label style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <input
                  type="checkbox"
                  checked={useOpenAI}
                  onChange={(e) => setUseOpenAI(e.target.checked)}
                  style={{ margin: 0 }}
                />
                🤖 Use OpenAI (API Key: {openaiStatus.hasApiKey ? '✅' : '❌'})
              </label>
            </div>
          </div>
          
          {isLoading && <div style={{color: '#ffd700'}}>⏳ Loading models...</div>}
          {error && <div style={{color: '#ff6b6b'}}>❌ Error: {error}</div>}
          
          <div>📊 Models: {modelsLoadedRef.current ? '✅ Loaded' : '❌ Not loaded'}</div>
          <div>🤖 Detection: {useOpenAI ? 'OpenAI' : 'Face-API'}</div>
          <div>👥 Faces detected: {faceCount}</div>
          
          {emotion && (
            <div style={{ marginTop: '8px' }}>
              <div>😊 Emotion: <span style={{color: '#4ecdc4'}}>{emotion}</span></div>
              <div>🎯 Confidence: <span style={{color: '#45b7d1'}}>{(confidence * 100).toFixed(1)}%</span></div>
              <div>📊 Engagement: <span style={{
                color: engagementScore > 70 ? '#2ecc71' : 
                       engagementScore > 40 ? '#f39c12' : '#e74c3c'
              }}>
                {engagementScore.toFixed(0)}%
              </span></div>
            </div>
          )}
          
          {actions.length > 0 && (
            <div style={{ marginTop: '8px' }}>
              <div style={{ color: '#f39c12' }}>🎬 Actions detected:</div>
              {formatActionDisplay(actions).map((action, index) => (
                <div key={index} style={{ 
                  marginLeft: '10px', 
                  color: '#e74c3c',
                  fontSize: '11px'
                }}>
                  • {action}
                </div>
              ))}
            </div>
          )}
          
          {emotionHistory.current.length > 3 && (
            <div style={{ marginTop: '8px' }}>
              <div style={{ color: '#9b59b6', fontSize: '11px' }}>
                📈 Emotion History: {emotionHistory.current.length} frames
              </div>
              <div style={{ fontSize: '10px', opacity: 0.8 }}>
                📝 Actions: {actionHistory.current.length} events
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EmotionDetection;
