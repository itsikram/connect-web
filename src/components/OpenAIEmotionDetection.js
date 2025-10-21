import React, { useRef, useEffect, useState, useCallback } from 'react';
import openaiService from '../services/openaiService';

const OpenAIEmotionDetection = () => {
  const videoRef = useRef(null);
  const [emotion, setEmotion] = useState('');
  const [confidence, setConfidence] = useState(0);
  const [intensity, setIntensity] = useState('');
  const [additionalEmotions, setAdditionalEmotions] = useState([]);
  const [facialFeatures, setFacialFeatures] = useState({});
  const [analysis, setAnalysis] = useState('');
  const [isDetecting, setIsDetecting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastDetection, setLastDetection] = useState(null);
  const [detectionCount, setDetectionCount] = useState(0);
  const [serviceStatus, setServiceStatus] = useState({});
  const intervalRef = useRef(null);

  const startVideo = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: 640, 
          height: 480,
          facingMode: 'user'
        } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        return new Promise((resolve) => {
          videoRef.current.onloadedmetadata = () => {
            console.log('Video loaded and ready for OpenAI analysis');
            resolve();
          };
        });
      }
    } catch (err) {
      console.error("Error accessing webcam: ", err);
      setError("Failed to access webcam: " + err.message);
      throw err;
    }
  }, []);

  const checkServiceStatus = useCallback(() => {
    const status = openaiService.getStatus();
    setServiceStatus(status);
    
    if (!status.hasApiKey) {
      setError('OpenAI API key not found. Please set REACT_APP_OPENAI_API_KEY in your environment variables.');
      setIsLoading(false);
      return false;
    }
    
    if (!status.ready) {
      setError('OpenAI service not ready. Please check your API key and try again.');
      setIsLoading(false);
      return false;
    }
    
    return true;
  }, []);

  const analyzeEmotion = useCallback(async () => {
    if (!videoRef.current || videoRef.current.readyState !== 4) {
      console.log('Video not ready for analysis');
      return;
    }

    try {
      console.log('Running OpenAI emotion analysis...');
      const result = await openaiService.analyzeEmotionWithRetry(videoRef.current, 2);
      
      setLastDetection(new Date().toLocaleTimeString());
      setDetectionCount(prev => prev + 1);
      
      if (result.success && result.data) {
        const data = result.data;
        
        setEmotion(data.emotion || 'unknown');
        setConfidence(data.confidence || 0);
        setIntensity(data.intensity || 'medium');
        setAdditionalEmotions(data.additional_emotions || []);
        setFacialFeatures(data.facial_features || {});
        setAnalysis(data.analysis || '');
        
        console.log('OpenAI Analysis Result:', {
          emotion: data.emotion,
          confidence: data.confidence,
          intensity: data.intensity,
          additionalEmotions: data.additional_emotions,
          facialFeatures: data.facial_features
        });
      } else {
        console.error('OpenAI analysis failed:', result.error);
        setError('Analysis failed: ' + (result.error || 'Unknown error'));
      }
    } catch (err) {
      console.error('Error in OpenAI emotion analysis:', err);
      setError('Analysis error: ' + err.message);
    }
  }, []);

  const startDetection = useCallback(() => {
    if (!checkServiceStatus()) {
      return;
    }
    
    setIsDetecting(true);
    setError('');
    
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    
    // Start detection interval
    intervalRef.current = setInterval(analyzeEmotion, 1000); // Analyze every second
  }, [checkServiceStatus, analyzeEmotion]);

  const stopDetection = useCallback(() => {
    setIsDetecting(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const initializeDetection = useCallback(async () => {
    try {
      setIsLoading(true);
      setError('');
      
      // Check service status
      if (!checkServiceStatus()) {
        return;
      }
      
      // Start video
      await startVideo();
      
      // Wait a bit for video to stabilize
      setTimeout(() => {
        setIsLoading(false);
        console.log('OpenAI emotion detection ready');
      }, 2000);
      
    } catch (err) {
      console.error('Failed to initialize OpenAI emotion detection:', err);
      setError('Initialization failed: ' + err.message);
      setIsLoading(false);
    }
  }, [checkServiceStatus, startVideo]);

  useEffect(() => {
    initializeDetection();
    
    // Cleanup on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [initializeDetection]);

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        padding: '20px',
        borderRadius: '10px',
        marginBottom: '20px',
        textAlign: 'center'
      }}>
        <h1 style={{ margin: 0, fontSize: '28px' }}>🤖 OpenAI Emotion Detection</h1>
        <p style={{ margin: '10px 0 0 0', opacity: 0.9 }}>
          Advanced AI-powered facial emotion recognition
        </p>
      </div>

      <div style={{
        background: 'white',
        borderRadius: '10px',
        padding: '20px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        marginBottom: '20px'
      }}>
        <h2 style={{ color: '#333', marginTop: 0 }}>Live Video Analysis</h2>
        
        <div style={{ marginBottom: '20px', textAlign: 'center' }}>
          <video
            ref={videoRef}
            autoPlay
            muted
            width="640"
            height="480"
            style={{ 
              border: '2px solid #ccc', 
              borderRadius: '8px',
              maxWidth: '100%',
              height: 'auto'
            }}
          />
        </div>
        
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <button
            onClick={startDetection}
            disabled={!serviceStatus.ready || isDetecting || isLoading}
            style={{
              padding: '12px 24px',
              marginRight: '10px',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '16px',
              opacity: (!serviceStatus.ready || isDetecting || isLoading) ? 0.6 : 1
            }}
          >
            {isLoading ? '⏳ Initializing...' : isDetecting ? '🔄 Analyzing...' : '▶️ Start Analysis'}
          </button>
          
          <button
            onClick={stopDetection}
            disabled={!isDetecting}
            style={{
              padding: '12px 24px',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '16px',
              opacity: !isDetecting ? 0.6 : 1
            }}
          >
            🛑 Stop Analysis
          </button>
        </div>
      </div>

      <div style={{
        background: '#f8f9fa',
        padding: '20px',
        borderRadius: '10px',
        marginBottom: '20px'
      }}>
        <h3 style={{ color: '#333', marginTop: 0 }}>Analysis Results</h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
          <div style={{ padding: '15px', background: 'white', borderRadius: '8px' }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#495057' }}>Primary Emotion</h4>
            {emotion ? (
              <div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#007bff' }}>
                  {emotion.charAt(0).toUpperCase() + emotion.slice(1)}
                </div>
                <div style={{ fontSize: '14px', color: '#6c757d' }}>
                  Confidence: {(confidence * 100).toFixed(1)}%
                </div>
                <div style={{ fontSize: '14px', color: '#6c757d' }}>
                  Intensity: {intensity}
                </div>
              </div>
            ) : (
              <div style={{ color: '#6c757d' }}>No emotion detected</div>
            )}
          </div>
          
          <div style={{ padding: '15px', background: 'white', borderRadius: '8px' }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#495057' }}>Additional Emotions</h4>
            {additionalEmotions.length > 0 ? (
              <div>
                {additionalEmotions.map((emotion, index) => (
                  <span key={index} style={{
                    display: 'inline-block',
                    background: '#e9ecef',
                    padding: '4px 8px',
                    margin: '2px',
                    borderRadius: '4px',
                    fontSize: '12px'
                  }}>
                    {emotion}
                  </span>
                ))}
              </div>
            ) : (
              <div style={{ color: '#6c757d' }}>None detected</div>
            )}
          </div>
          
          <div style={{ padding: '15px', background: 'white', borderRadius: '8px' }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#495057' }}>Facial Features</h4>
            {Object.keys(facialFeatures).length > 0 ? (
              <div style={{ fontSize: '14px' }}>
                {Object.entries(facialFeatures).map(([key, value]) => (
                  <div key={key} style={{ marginBottom: '4px' }}>
                    <strong>{key}:</strong> {value}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: '#6c757d' }}>No features analyzed</div>
            )}
          </div>
        </div>
        
        {analysis && (
          <div style={{ marginTop: '15px', padding: '15px', background: 'white', borderRadius: '8px' }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#495057' }}>AI Analysis</h4>
            <p style={{ margin: 0, fontSize: '14px', color: '#6c757d' }}>{analysis}</p>
          </div>
        )}
      </div>

      <div style={{
        background: '#f8f9fa',
        padding: '15px',
        borderRadius: '8px',
        fontSize: '14px',
        color: '#6c757d'
      }}>
        <h3 style={{ margin: '0 0 10px 0', color: '#495057' }}>Status</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}>
          <div>Service Ready: {serviceStatus.ready ? '✅ Yes' : '❌ No'}</div>
          <div>API Key: {serviceStatus.hasApiKey ? '✅ Set' : '❌ Missing'}</div>
          <div>Analysis Active: {isDetecting ? '✅ Yes' : '❌ No'}</div>
          <div>Update Frequency: ⏱️ Every 1 second</div>
          <div>Detections Run: {detectionCount}</div>
          {lastDetection && <div>Last Detection: {lastDetection}</div>}
        </div>
        
        {error && (
          <div style={{ 
            marginTop: '15px', 
            padding: '10px', 
            background: '#f8d7da', 
            color: '#721c24', 
            borderRadius: '4px',
            border: '1px solid #f5c6cb'
          }}>
            <strong>Error:</strong> {error}
          </div>
        )}
      </div>

      <div style={{
        background: '#e3f2fd',
        padding: '15px',
        borderRadius: '8px',
        marginTop: '20px',
        fontSize: '14px',
        color: '#1565c0'
      }}>
        <h4 style={{ margin: '0 0 10px 0' }}>🔧 Setup Instructions</h4>
        <p style={{ margin: '0 0 10px 0' }}>
          To use OpenAI emotion detection, you need to set up your API key:
        </p>
        <ol style={{ margin: 0, paddingLeft: '20px' }}>
          <li>Get an OpenAI API key from <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer">OpenAI Platform</a></li>
          <li>Create a <code>.env.local</code> file in your project root</li>
          <li>Add: <code>REACT_APP_OPENAI_API_KEY=your_api_key_here</code></li>
          <li>Restart your development server</li>
        </ol>
      </div>
    </div>
  );
};

export default OpenAIEmotionDetection;
