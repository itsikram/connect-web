import React, { useState } from 'react';
import EmotionDetection from './Message/EmotionDetection';

const EmotionTest = () => {
  const [showDetection, setShowDetection] = useState(false);

  return (
    <div style={{
      padding: '20px',
      maxWidth: '800px',
      margin: '0 auto',
      fontFamily: 'Arial, sans-serif'
    }}>
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        padding: '20px',
        borderRadius: '10px',
        marginBottom: '20px',
        textAlign: 'center'
      }}>
        <h1 style={{ margin: 0, fontSize: '28px' }}>🎭 Enhanced Emotion & Action Detection</h1>
        <p style={{ margin: '10px 0 0 0', opacity: 0.9 }}>
          Advanced facial emotion recognition with gesture detection
        </p>
      </div>

      <div style={{
        background: 'white',
        borderRadius: '10px',
        padding: '20px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        marginBottom: '20px'
      }}>
        <h2 style={{ color: '#333', marginTop: 0 }}>Features</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px' }}>
          <div style={{ padding: '15px', background: '#f8f9fa', borderRadius: '8px' }}>
            <h3 style={{ color: '#495057', margin: '0 0 10px 0' }}>😊 Emotion Recognition</h3>
            <ul style={{ margin: 0, paddingLeft: '20px', color: '#6c757d' }}>
              <li>7 basic emotions (happy, sad, angry, etc.)</li>
              <li>Confidence scoring</li>
              <li>Smoothed detection to reduce flickering</li>
              <li>Age and gender estimation</li>
            </ul>
          </div>
          
          <div style={{ padding: '15px', background: '#f8f9fa', borderRadius: '8px' }}>
            <h3 style={{ color: '#495057', margin: '0 0 10px 0' }}>🎬 Action Detection</h3>
            <ul style={{ margin: 0, paddingLeft: '20px', color: '#6c757d' }}>
              <li>Head nods and shakes</li>
              <li>Eye blinks</li>
              <li>Mouth movements</li>
              <li>Complex gesture patterns</li>
            </ul>
          </div>
          
          <div style={{ padding: '15px', background: '#f8f9fa', borderRadius: '8px' }}>
            <h3 style={{ color: '#495057', margin: '0 0 10px 0' }}>📊 Analytics</h3>
            <ul style={{ margin: 0, paddingLeft: '20px', color: '#6c757d' }}>
              <li>Engagement scoring</li>
              <li>Action history tracking</li>
              <li>Emotion transitions</li>
              <li>Real-time performance metrics</li>
            </ul>
          </div>
        </div>
      </div>

      <div style={{
        background: 'white',
        borderRadius: '10px',
        padding: '20px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        textAlign: 'center'
      }}>
        <h2 style={{ color: '#333', marginTop: 0 }}>Test Detection</h2>
        <p style={{ color: '#6c757d', marginBottom: '20px' }}>
          Click the button below to start emotion and action detection. 
          Make sure to allow camera access when prompted.
        </p>
        
        <button
          onClick={() => setShowDetection(!showDetection)}
          style={{
            background: showDetection ? '#dc3545' : '#28a745',
            color: 'white',
            border: 'none',
            padding: '12px 24px',
            borderRadius: '6px',
            fontSize: '16px',
            cursor: 'pointer',
            transition: 'background-color 0.3s ease'
          }}
          onMouseOver={(e) => {
            e.target.style.opacity = '0.9';
          }}
          onMouseOut={(e) => {
            e.target.style.opacity = '1';
          }}
        >
          {showDetection ? '🛑 Stop Detection' : '▶️ Start Detection'}
        </button>

        {showDetection && (
          <div style={{ marginTop: '20px' }}>
            <div style={{
              background: '#fff3cd',
              border: '1px solid #ffeaa7',
              borderRadius: '6px',
              padding: '15px',
              marginBottom: '20px'
            }}>
              <strong>📝 Instructions:</strong>
              <ul style={{ textAlign: 'left', marginTop: '10px' }}>
                <li>Look at the camera and try different facial expressions</li>
                <li>Nod your head up and down</li>
                <li>Shake your head left and right</li>
                <li>Blink your eyes</li>
                <li>Open and close your mouth</li>
                <li>Smile and frown</li>
              </ul>
              <p style={{ margin: '10px 0 0 0', fontSize: '14px', color: '#856404' }}>
                Check the debug panel in the top-right corner for real-time results!
              </p>
            </div>
            
            <EmotionDetection />
          </div>
        )}
      </div>

      <div style={{
        background: '#f8f9fa',
        borderRadius: '10px',
        padding: '20px',
        marginTop: '20px',
        fontSize: '14px',
        color: '#6c757d'
      }}>
        <h3 style={{ color: '#495057', marginTop: 0 }}>🔧 Technical Details</h3>
        <p>
          This enhanced emotion detection system uses the <strong>@vladmandic/face-api</strong> library 
          with TensorFlow.js for real-time facial analysis. It includes:
        </p>
        <ul>
          <li><strong>Multiple neural networks:</strong> TinyFaceDetector, FaceExpressionNet, FaceLandmark68Net, AgeGenderNet</li>
          <li><strong>Advanced algorithms:</strong> Emotion smoothing, gesture pattern recognition, engagement scoring</li>
          <li><strong>Optimized performance:</strong> Efficient processing intervals, selective model loading</li>
          <li><strong>Comprehensive tracking:</strong> Action history, emotion transitions, confidence scoring</li>
        </ul>
      </div>
    </div>
  );
};

export default EmotionTest;
