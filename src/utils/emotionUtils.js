/**
 * Enhanced emotion and action detection utilities
 * Provides helper functions for better emotion recognition and gesture detection
 */

// Emotion confidence thresholds
export const EMOTION_THRESHOLDS = {
  HIGH_CONFIDENCE: 0.7,
  MEDIUM_CONFIDENCE: 0.4,
  LOW_CONFIDENCE: 0.25
};

// Action detection sensitivity settings
export const ACTION_SENSITIVITY = {
  HEAD_MOVEMENT: 8,
  EYE_BLINK: 3,
  MOUTH_OPEN: 0.4,
  SMILE_DETECTION: 0.15
};

/**
 * Smooths emotion detection results to reduce flickering
 * @param {Array} emotionHistory - Array of recent emotion detections
 * @param {Object} currentEmotions - Current frame emotion scores
 * @param {number} historySize - Number of frames to consider
 */
export const smoothEmotionDetection = (emotionHistory, currentEmotions, historySize = 5) => {
  // Add current detection to history
  emotionHistory.push(currentEmotions);
  
  // Keep only recent detections
  if (emotionHistory.length > historySize) {
    emotionHistory.shift();
  }
  
  // Calculate weighted average (recent frames have more weight)
  const emotionKeys = Object.keys(currentEmotions);
  const smoothedEmotions = {};
  
  emotionKeys.forEach(emotion => {
    let weightedSum = 0;
    let totalWeight = 0;
    
    emotionHistory.forEach((frame, index) => {
      const weight = (index + 1) / emotionHistory.length; // More recent = higher weight
      weightedSum += frame[emotion] * weight;
      totalWeight += weight;
    });
    
    smoothedEmotions[emotion] = weightedSum / totalWeight;
  });
  
  return smoothedEmotions;
};

/**
 * Analyzes emotion patterns to detect transitions
 * @param {Array} emotionHistory - History of emotion detections
 */
export const analyzeEmotionTransitions = (emotionHistory) => {
  if (emotionHistory.length < 3) return null;
  
  const recent = emotionHistory.slice(-3);
  const transitions = [];
  
  for (let i = 1; i < recent.length; i++) {
    const prev = recent[i - 1];
    const curr = recent[i];
    
    // Find dominant emotions
    const prevEmotion = Object.entries(prev).reduce((a, b) => a[1] > b[1] ? a : b)[0];
    const currEmotion = Object.entries(curr).reduce((a, b) => a[1] > b[1] ? a : b)[0];
    
    if (prevEmotion !== currEmotion) {
      transitions.push({
        from: prevEmotion,
        to: currEmotion,
        confidence: curr[currEmotion]
      });
    }
  }
  
  return transitions;
};

/**
 * Detects complex gesture patterns
 * @param {Array} landmarkHistory - History of facial landmark positions
 */
export const detectComplexGestures = (landmarkHistory) => {
  if (landmarkHistory.length < 5) return [];
  
  const gestures = [];
  const recent = landmarkHistory.slice(-5);
  
  // Detect head shake pattern (left-right-left or right-left-right)
  const noseXPositions = recent.map(frame => frame.nose[3].x);
  const xDiffs = [];
  for (let i = 1; i < noseXPositions.length; i++) {
    xDiffs.push(noseXPositions[i] - noseXPositions[i - 1]);
  }
  
  // Check for alternating pattern
  let shakePattern = 0;
  for (let i = 1; i < xDiffs.length; i++) {
    if (Math.sign(xDiffs[i]) !== Math.sign(xDiffs[i - 1]) && Math.abs(xDiffs[i]) > 5) {
      shakePattern++;
    }
  }
  
  if (shakePattern >= 2) {
    gestures.push('head_shake_pattern');
  }
  
  // Detect nod pattern (up-down-up or down-up-down)
  const noseYPositions = recent.map(frame => frame.nose[3].y);
  const yDiffs = [];
  for (let i = 1; i < noseYPositions.length; i++) {
    yDiffs.push(noseYPositions[i] - noseYPositions[i - 1]);
  }
  
  let nodPattern = 0;
  for (let i = 1; i < yDiffs.length; i++) {
    if (Math.sign(yDiffs[i]) !== Math.sign(yDiffs[i - 1]) && Math.abs(yDiffs[i]) > 5) {
      nodPattern++;
    }
  }
  
  if (nodPattern >= 2) {
    gestures.push('head_nod_pattern');
  }
  
  return gestures;
};

/**
 * Calculates engagement score based on various factors
 * @param {Object} detectionData - Current detection data
 * @param {Array} history - Detection history
 */
export const calculateEngagementScore = (detectionData, history) => {
  let score = 0;
  
  const { emotions, actions, faceCount } = detectionData;
  
  // Base score from face detection
  if (faceCount > 0) score += 20;
  
  // Emotion-based scoring
  if (emotions) {
    const positiveEmotions = ['happy', 'surprised'];
    const negativeEmotions = ['sad', 'angry', 'disgusted'];
    const neutralEmotions = ['neutral', 'fearful'];
    
    Object.entries(emotions).forEach(([emotion, confidence]) => {
      if (positiveEmotions.includes(emotion)) {
        score += confidence * 30;
      } else if (negativeEmotions.includes(emotion)) {
        score += confidence * 10; // Still engaged, but negatively
      } else if (neutralEmotions.includes(emotion)) {
        score += confidence * 5;
      }
    });
  }
  
  // Action-based scoring
  if (actions && actions.length > 0) {
    const engagementActions = ['nod_up', 'nod_down', 'smile', 'mouth_open'];
    actions.forEach(action => {
      if (engagementActions.includes(action)) {
        score += 15;
      } else {
        score += 5; // Any action shows some engagement
      }
    });
  }
  
  // Historical consistency bonus
  if (history && history.length > 0) {
    const recentActivity = history.slice(-10);
    const activityLevel = recentActivity.filter(frame => 
      frame.actions && frame.actions.length > 0
    ).length;
    
    score += (activityLevel / recentActivity.length) * 20;
  }
  
  return Math.min(Math.max(score, 0), 100); // Clamp between 0-100
};

/**
 * Formats emotion data for display
 * @param {Object} emotions - Emotion detection results
 * @param {number} threshold - Minimum confidence threshold
 */
export const formatEmotionDisplay = (emotions, threshold = EMOTION_THRESHOLDS.LOW_CONFIDENCE) => {
  if (!emotions) return null;
  
  const filtered = Object.entries(emotions)
    .filter(([_, confidence]) => confidence >= threshold)
    .sort((a, b) => b[1] - a[1])
    .map(([emotion, confidence]) => ({
      emotion: emotion.charAt(0).toUpperCase() + emotion.slice(1),
      confidence: Math.round(confidence * 100),
      level: confidence >= EMOTION_THRESHOLDS.HIGH_CONFIDENCE ? 'high' :
             confidence >= EMOTION_THRESHOLDS.MEDIUM_CONFIDENCE ? 'medium' : 'low'
    }));
  
  return filtered;
};

/**
 * Converts action codes to human-readable descriptions
 * @param {Array} actions - Array of detected actions
 */
export const formatActionDisplay = (actions) => {
  if (!actions || actions.length === 0) return [];
  
  const actionMap = {
    'nod_up': 'Nodding Up',
    'nod_down': 'Nodding Down',
    'shake_left': 'Head Shake Left',
    'shake_right': 'Head Shake Right',
    'blink': 'Blinking',
    'mouth_open': 'Mouth Open',
    'mouth_closed': 'Mouth Closed',
    'smile': 'Smiling',
    'head_shake_pattern': 'Head Shaking',
    'head_nod_pattern': 'Head Nodding'
  };
  
  return actions.map(action => actionMap[action] || action).filter(Boolean);
};

export default {
  EMOTION_THRESHOLDS,
  ACTION_SENSITIVITY,
  smoothEmotionDetection,
  analyzeEmotionTransitions,
  detectComplexGestures,
  calculateEngagementScore,
  formatEmotionDisplay,
  formatActionDisplay
};
