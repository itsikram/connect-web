import * as faceapi from "@vladmandic/face-api";

// Emotion to emoji mapping
export const emotionEmojiMap = {
    'Happy': '😊',
    'Smiling': '😄',
    'Laughing': '😂',
    'Excited': '🤩',
    'Surprised': '😲',
    'Fear': '😨',
    'Angry': '😠',
    'Sad': '😢',
    'Crying': '😭',
    'Disgust': '🤢',
    'Confused': '😕',
    'Neutral': '😐',
    'Winking': '😉',
    'Flirting': '😘',
    'Kissing': '💋',
    'Sarcastic': '😏',
    'Eyebrow Raise': '🤨',
    'Eyebrow Furrow': '😤',
    'Yawning': '🥱',
    'Sleepy': '😴',
    'Speaking': '🗣️'
};

// Helper function to extract emotion name from emoji string
export const getEmotionName = (emotionString) => {
    if (!emotionString || typeof emotionString !== 'string') return '';
    return emotionString.replace(/😊|😄|😂|🤩|😲|😨|😠|😢|😭|🤢|😕|😐|😉|😘|💋|😏|🤨|😤|🥱|😴|🗣️/g, '').trim();
};

// Emotion category definitions for stability requirements
export const emotionCategories = {
    'transient': ['Speaking', 'Surprised', 'Eyebrow Raise'],
    'stable': ['Smiling', 'Happy', 'Neutral', 'Sleepy'],
    'significant': ['Sad', 'Angry', 'Disgust', 'Fear', 'Crying', 'Laughing'],
    'suspicious': ['Kissing', 'Winking', 'Flirting', 'Confused', 'Eyebrow Furrow']
};

// Load face detection models
export const loadFaceModels = async () => {
    try {
        console.log('Loading enhanced face-api models...');
        await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
            faceapi.nets.faceExpressionNet.loadFromUri("/models"),
            faceapi.nets.faceLandmark68Net.loadFromUri("/models")
        ]);
        console.log('Enhanced models loaded successfully');
        return true;
    } catch (error) {
        console.error('Failed to load enhanced face-api models:', error);
        // Fallback to basic models
        try {
            console.log('Falling back to basic models...');
            await Promise.all([
                faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
                faceapi.nets.faceExpressionNet.loadFromUri("/models")
            ]);
            console.log('Basic models loaded successfully');
            return true;
        } catch (fallbackError) {
            console.error('Failed to load even basic models:', fallbackError);
            return false;
        }
    }
};

// Calculate expression confidence based on conditions and weights
const calculateExpressionConfidence = (conditions, weights) => {
    const score = conditions.reduce((sum, condition, index) => {
        return sum + (condition ? weights[index] : 0);
    }, 0);
    return Math.min(1, score / weights.reduce((a, b) => a + b, 0));
};

// Validate expression with specific checks
const createExpressionValidator = (emotions, detectionQualityRef, emotionHistoryRef) => {
    return (name, confidence, measurements) => {
        // Minimum thresholds - balanced for accuracy without over-filtering
        if (confidence < 0.30) return false;
        if (detectionQualityRef.current < 0.28) return false;
        
        // Cross-validation with face-api emotions
        const faceApiEmotion = Object.entries(emotions || {})
            .sort((a, b) => b[1] - a[1])[0];
        
        // If face-api strongly disagrees, increase confidence requirement
        if (faceApiEmotion && faceApiEmotion[1] > 0.85) {
            const faceApiName = faceApiEmotion[0];
            if ((faceApiName === 'happy' && ['Sad', 'Angry', 'Disgust'].includes(name)) ||
                (faceApiName === 'sad' && ['Happy', 'Smiling', 'Laughing'].includes(name))) {
                return confidence > 0.75;
            }
        }
        
        // Enhanced specific expression validation
        const validations = measurements.validations || {};
        if (validations[name]) {
            if (!validations[name]()) return false;
        }
        
        // Improved impossible combination checking
        const incompatibleExpressions = {
            'Kissing': ['Speaking', 'Yawning', 'Laughing', 'Surprised'],
            'Yawning': ['Kissing', 'Speaking', 'Smiling', 'Laughing'],
            'Speaking': ['Kissing', 'Yawning', 'Sleeping', 'Sleepy'],
            'Laughing': ['Kissing', 'Yawning', 'Sad', 'Angry', 'Fear'],
            'Smiling': ['Yawning', 'Crying', 'Sleepy'],
            'Sad': ['Laughing', 'Smiling', 'Happy', 'Excited'],
            'Disgust': ['Laughing', 'Smiling', 'Happy', 'Excited'],
            'Sleepy': ['Excited', 'Surprised', 'Laughing', 'Fear'],
            'Crying': ['Happy', 'Laughing', 'Smiling', 'Excited']
        };
        
        if (incompatibleExpressions[name]) {
            const recentHistory = emotionHistoryRef.current.slice(-3);
            for (const impossible of incompatibleExpressions[name]) {
                const recentIncompatible = recentHistory.find(h => 
                    h.emotion === impossible.toLowerCase() && h.confidence > 0.5
                );
                if (recentIncompatible && confidence < 0.65) {
                    return false;
                }
            }
        }
        
        return true;
    };
};

// Detect emotions from video element
export const detectEmotionsFromVideo = async (videoElement, refs, socket, profileId, friendId) => {
    const {
        faceModelsReadyRef,
        emotionHistoryRef,
        baselineExpressionsRef,
        lastStableEmotionRef,
        emotionStabilityCountRef,
        detectionQualityRef,
        consecutiveEmotionCountRef,
        lastEmotionTimestampRef,
        actionLockRef
    } = refs;

    if (!videoElement || videoElement.readyState < 2 || !faceModelsReadyRef.current) {
        return null;
    }

    try {
        const detections = await faceapi.detectAllFaces(
            videoElement,
            new faceapi.TinyFaceDetectorOptions({
                inputSize: 448,
                scoreThreshold: 0.45
            })
        )
        .withFaceLandmarks()
        .withFaceExpressions();

        if (detections.length === 0) {
            return null;
        }

        const detection = detections[0];
        const emotions = detection.expressions;
        const landmarks = detection.landmarks;
        const faceBox = detection.detection?.box;

        // Calculate detection quality
        const faceArea = faceBox ? faceBox.width * faceBox.height : 0;
        const videoArea = videoElement.videoWidth * videoElement.videoHeight;
        const faceSizeRatio = faceArea / videoArea;
        detectionQualityRef.current = Math.min(1, faceSizeRatio * 10);

        const emotionEntries = Object.entries(emotions);
        const sortedEmotions = emotionEntries.sort((a, b) => b[1] - a[1]);
        const [dominantEmotion, confidence] = sortedEmotions[0];

        // Update emotion history
        emotionHistoryRef.current.push({
            emotion: dominantEmotion,
            confidence,
            timestamp: Date.now(),
            landmarks: landmarks
        });
        
        if (emotionHistoryRef.current.length > 50) {
            emotionHistoryRef.current.shift();
        }
        
        // Establish baseline
        if (emotionHistoryRef.current.length === 15 || 
            (emotionHistoryRef.current.length === 30 && !baselineExpressionsRef.current.mouthHeight)) {
            
            const neutralSamples = emotionHistoryRef.current
                .filter(e => e.emotion === 'neutral' && e.confidence > 0.35)
                .slice(-8);
            
            if (neutralSamples.length >= 3 && landmarks) {
                const avgMouthHeight = neutralSamples.reduce((sum, s) => {
                    const mouth = s.landmarks.getMouth();
                    return sum + Math.abs(mouth[3].y - mouth[9].y);
                }, 0) / neutralSamples.length;
                
                const avgEyeHeight = neutralSamples.reduce((sum, s) => {
                    const leftEye = s.landmarks.getLeftEye();
                    const rightEye = s.landmarks.getRightEye();
                    const height = (Math.abs(leftEye[1].y - leftEye[5].y) + Math.abs(rightEye[1].y - rightEye[5].y)) / 2;
                    return sum + height;
                }, 0) / neutralSamples.length;
                
                const avgMouthWidth = neutralSamples.reduce((sum, s) => {
                    const mouth = s.landmarks.getMouth();
                    return sum + Math.abs(mouth[0].x - mouth[6].x);
                }, 0) / neutralSamples.length;

                baselineExpressionsRef.current = {
                    mouthHeight: avgMouthHeight,
                    eyeHeight: avgEyeHeight,
                    mouthWidth: avgMouthWidth,
                    faceWidth: faceBox?.width || 100,
                    established: true
                };
                
                console.log('✅ Baseline established:', {
                    mouthHeight: avgMouthHeight.toFixed(3),
                    eyeHeight: avgEyeHeight.toFixed(3),
                    mouthWidth: avgMouthWidth.toFixed(3),
                    faceWidth: (faceBox?.width || 100).toFixed(1)
                });
            }
        }

        if (!landmarks) {
            return null;
        }

        // Extract facial landmarks
        const mouth = landmarks.getMouth();
        const leftEye = landmarks.getLeftEye();
        const rightEye = landmarks.getRightEye();
        const nose = landmarks.getNose();
        const leftEyebrow = landmarks.getLeftEyeBrow();
        const rightEyebrow = landmarks.getRightEyeBrow();

        const mouthHeight = Math.abs(mouth[3].y - mouth[9].y);
        const mouthWidth = Math.abs(mouth[0].x - mouth[6].x);
        const mouthRatio = mouthHeight / mouthWidth;

        const leftEyeHeight = Math.abs(leftEye[1].y - leftEye[5].y);
        const rightEyeHeight = Math.abs(rightEye[1].y - rightEye[5].y);
        const avgEyeHeight = (leftEyeHeight + rightEyeHeight) / 2;

        const faceWidth = faceBox?.width || Math.max(1, mouthWidth);
        const mouthWidthNorm = mouthWidth / faceWidth;
        const mouthHeightNorm = mouthHeight / faceWidth;
        const avgEyeHeightNorm = avgEyeHeight / faceWidth;

        // Calculate additional measurements
        const mouthCorner = mouth[0];
        const mouthCenter = mouth[3];
        const mouthCornerRaise = (mouthCenter.y - (mouth[0].y + mouth[6].y) / 2) / faceWidth;
        
        const leftEyebrowTop = leftEyebrow[2];
        const rightEyebrowTop = rightEyebrow[2];
        const eyebrowRaise = ((leftEyebrowTop.y + rightEyebrowTop.y) - (leftEyebrow[4].y + rightEyebrow[4].y)) / faceWidth;
        
        const leftCornerRaise = (mouthCenter.y - mouth[0].y) / faceWidth;
        const rightCornerRaise = (mouthCenter.y - mouth[6].y) / faceWidth;
        const mouthAsymmetry = Math.abs(leftCornerRaise - rightCornerRaise);
        
        const leftEyebrowRaise = (leftEyebrowTop.y - leftEyebrow[4].y) / faceWidth;
        const rightEyebrowRaise = (rightEyebrowTop.y - rightEyebrow[4].y) / faceWidth;
        const eyebrowAsymmetry = Math.abs(leftEyebrowRaise - rightEyebrowRaise);
        
        const noseTip = nose[3];
        const noseBottom = nose[6];
        const noseWrinkle = Math.abs(noseTip.y - noseBottom.y) / faceWidth;

        // Get baseline for adaptive thresholds
        const baseline = baselineExpressionsRef.current;
        const hasBaseline = baseline.mouthHeight && baseline.eyeHeight;
        const mouthThresholdMultiplier = hasBaseline ? (baseline.mouthHeight / faceWidth) / 0.04 : 1;
        const eyeThresholdMultiplier = hasBaseline ? (baseline.eyeHeight / faceWidth) / 0.04 : 1;

        // Create validation functions for specific expressions
        const validations = {
            'Smiling': () => {
                return mouthCornerRaise > 0.02 &&
                       Math.abs(leftCornerRaise - rightCornerRaise) < 0.02 &&
                       mouthHeightNorm < 0.09 * mouthThresholdMultiplier;
            },
            'Laughing': () => {
                return mouthHeightNorm > 0.09 * mouthThresholdMultiplier &&
                       mouthCornerRaise > 0.025 &&
                       leftCornerRaise > 0.012 && rightCornerRaise > 0.012;
            },
            'Speaking': () => {
                return mouthHeightNorm > 0.055 * mouthThresholdMultiplier &&
                       mouthHeightNorm < 0.16 * mouthThresholdMultiplier &&
                       Math.abs(mouthCornerRaise) < 0.03 &&
                       mouthWidthNorm > 0.28;
            },
            'Sad': () => {
                const strongDroop = mouthCornerRaise < -0.025;
                const narrowedEyes = avgEyeHeightNorm < 0.035 * eyeThresholdMultiplier;
                const moderateOpening = mouthHeightNorm > 0.025 * mouthThresholdMultiplier && 
                                      mouthHeightNorm < 0.065 * mouthThresholdMultiplier;
                const notSpeaking = !(mouthHeightNorm > 0.055 * mouthThresholdMultiplier && mouthWidthNorm > 0.33);
                const notSmiling = leftCornerRaise < 0 && rightCornerRaise < 0;
                const symmetrical = Math.abs(leftCornerRaise - rightCornerRaise) < 0.015;
                
                return strongDroop && narrowedEyes && moderateOpening && notSpeaking && notSmiling && symmetrical;
            },
            'Disgust': () => {
                const tightMouth = mouthHeightNorm < 0.03 * mouthThresholdMultiplier;
                const narrowMouth = mouthWidthNorm < 0.36;
                const squintedEyes = avgEyeHeightNorm < 0.038 * eyeThresholdMultiplier;
                const notSpeaking = !(mouthHeightNorm > 0.05 * mouthThresholdMultiplier && mouthWidthNorm > 0.3);
                const notSmiling = mouthCornerRaise <= 0.003;
                
                return tightMouth && narrowMouth && squintedEyes && notSpeaking && notSmiling;
            },
            'Surprised': () => {
                return mouthHeightNorm > 0.07 * mouthThresholdMultiplier &&
                       avgEyeHeightNorm > 0.045 * eyeThresholdMultiplier &&
                       eyebrowRaise > 0.012;
            },
            'Yawning': () => {
                return mouthHeightNorm > 0.11 * mouthThresholdMultiplier &&
                       avgEyeHeightNorm < 0.037 * eyeThresholdMultiplier &&
                       Math.abs(mouthCornerRaise) < 0.015;
            }
        };

        // Build expressions array
        const expressions = [
            {
                name: 'Speaking',
                confidence: calculateExpressionConfidence([
                    mouthHeightNorm > 0.08 * mouthThresholdMultiplier,
                    mouthHeightNorm < 0.15 * mouthThresholdMultiplier,
                    mouthWidthNorm > 0.3,
                    mouthWidthNorm < 0.5,
                    Math.abs(mouthCornerRaise) < 0.02,
                    avgEyeHeightNorm > 0.03 * eyeThresholdMultiplier,
                    mouthRatio > 0.2 && mouthRatio < 0.4
                ], [0.25, 0.2, 0.15, 0.15, 0.1, 0.1, 0.05])
            },
            {
                name: 'Smiling',
                confidence: calculateExpressionConfidence([
                    mouthCornerRaise > 0.025,
                    mouthWidthNorm > 0.38,
                    mouthHeightNorm > 0.03 * mouthThresholdMultiplier && mouthHeightNorm < 0.08 * mouthThresholdMultiplier,
                    leftCornerRaise > 0.015 && rightCornerRaise > 0.015,
                    avgEyeHeightNorm > 0.035 * eyeThresholdMultiplier,
                    mouthRatio < 0.3,
                    Math.abs(mouthAsymmetry) < 0.02
                ], [0.25, 0.2, 0.15, 0.15, 0.1, 0.1, 0.05])
            },
            {
                name: 'Laughing',
                confidence: calculateExpressionConfidence([
                    mouthHeightNorm > 0.12 * mouthThresholdMultiplier,
                    mouthWidthNorm > 0.55,
                    mouthCornerRaise > 0.04,
                    avgEyeHeightNorm > 0.045 * eyeThresholdMultiplier,
                    eyebrowRaise > 0.008,
                    mouthRatio > 0.15,
                    leftCornerRaise > 0.02 && rightCornerRaise > 0.02
                ], [0.2, 0.15, 0.2, 0.15, 0.1, 0.1, 0.1])
            },
            {
                name: 'Kissing',
                confidence: calculateExpressionConfidence([
                    mouthHeightNorm < 0.045 * mouthThresholdMultiplier,
                    mouthWidthNorm < 0.40,
                    mouthRatio < 0.22,
                    mouthCornerRaise < 0.008,
                    Math.abs(mouthCornerRaise) < 0.012,
                    avgEyeHeightNorm > 0.032 * eyeThresholdMultiplier
                ], [0.28, 0.24, 0.2, 0.14, 0.08, 0.06])
            },
            {
                name: 'Excited',
                confidence: calculateExpressionConfidence([
                    avgEyeHeightNorm > 0.05 * eyeThresholdMultiplier,
                    mouthCornerRaise > 0.03,
                    eyebrowRaise > 0.015,
                    mouthWidthNorm > 0.4,
                    mouthHeightNorm > 0.05 * mouthThresholdMultiplier
                ], [0.2, 0.25, 0.2, 0.2, 0.15])
            },
            {
                name: 'Sarcastic',
                confidence: calculateExpressionConfidence([
                    mouthAsymmetry > 0.025,
                    (leftCornerRaise > 0.02 || rightCornerRaise > 0.02),
                    mouthWidthNorm > 0.35,
                    avgEyeHeightNorm > 0.035 * eyeThresholdMultiplier,
                    Math.abs(mouthCornerRaise) < 0.02
                ], [0.3, 0.25, 0.15, 0.15, 0.15])
            },
            {
                name: 'Confused',
                confidence: calculateExpressionConfidence([
                    eyebrowAsymmetry > 0.018,
                    (leftEyebrowRaise > 0.012 || rightEyebrowRaise > 0.012),
                    avgEyeHeightNorm > 0.033 * eyeThresholdMultiplier,
                    Math.abs(mouthCornerRaise) < 0.018,
                    mouthHeightNorm < 0.065 * mouthThresholdMultiplier
                ], [0.32, 0.28, 0.18, 0.12, 0.1])
            },
            {
                name: 'Yawning',
                confidence: calculateExpressionConfidence([
                    mouthHeightNorm > 0.12 * mouthThresholdMultiplier,
                    mouthWidthNorm > 0.4,
                    avgEyeHeightNorm < 0.035 * eyeThresholdMultiplier
                ], [0.5, 0.3, 0.2])
            },
            {
                name: 'Sleepy',
                confidence: calculateExpressionConfidence([
                    avgEyeHeightNorm < 0.025 * eyeThresholdMultiplier,
                    mouthHeightNorm < 0.04 * mouthThresholdMultiplier,
                    Math.abs(mouthCornerRaise) < 0.01
                ], [0.5, 0.3, 0.2])
            },
            {
                name: 'Winking',
                confidence: calculateExpressionConfidence([
                    Math.abs(leftEyeHeight - rightEyeHeight) / faceWidth > 0.025,
                    (leftEyeHeight < 0.02 * faceWidth || rightEyeHeight < 0.02 * faceWidth),
                    avgEyeHeightNorm > 0.025 * eyeThresholdMultiplier,
                    Math.abs(mouthCornerRaise) < 0.015
                ], [0.4, 0.35, 0.15, 0.1])
            },
            {
                name: 'Flirting',
                confidence: calculateExpressionConfidence([
                    Math.abs(leftEyeHeight - rightEyeHeight) / faceWidth > 0.025,
                    (leftEyeHeight < 0.02 * faceWidth || rightEyeHeight < 0.02 * faceWidth),
                    mouthCornerRaise > 0.015,
                    mouthWidthNorm > 0.35,
                    eyebrowRaise > 0.005
                ], [0.25, 0.25, 0.25, 0.15, 0.1])
            },
            {
                name: 'Eyebrow Raise',
                confidence: calculateExpressionConfidence([
                    eyebrowRaise > 0.025,
                    avgEyeHeightNorm > 0.04 * eyeThresholdMultiplier
                ], [0.7, 0.3])
            },
            {
                name: 'Eyebrow Furrow',
                confidence: calculateExpressionConfidence([
                    Math.abs(leftEyebrow[2].x - rightEyebrow[2].x) / faceWidth < 0.25,
                    eyebrowRaise < -0.01,
                    avgEyeHeightNorm < 0.04 * eyeThresholdMultiplier
                ], [0.4, 0.4, 0.2])
            },
            {
                name: 'Surprised',
                confidence: calculateExpressionConfidence([
                    mouthHeightNorm > 0.08 * mouthThresholdMultiplier,
                    eyebrowRaise > 0.015,
                    avgEyeHeightNorm > 0.05 * eyeThresholdMultiplier
                ], [0.4, 0.3, 0.3])
            },
            {
                name: 'Fear',
                confidence: calculateExpressionConfidence([
                    eyebrowRaise > 0.02,
                    avgEyeHeightNorm > 0.05 * eyeThresholdMultiplier,
                    mouthHeightNorm > 0.05 * mouthThresholdMultiplier,
                    mouthHeightNorm < 0.08 * mouthThresholdMultiplier
                ], [0.3, 0.3, 0.2, 0.2])
            },
            {
                name: 'Disgust',
                confidence: calculateExpressionConfidence([
                    mouthHeightNorm < 0.03 * mouthThresholdMultiplier,
                    mouthWidthNorm < 0.36,
                    avgEyeHeightNorm < 0.038 * eyeThresholdMultiplier,
                    noseWrinkle > 0.02,
                    mouthCornerRaise <= 0.003,
                    eyebrowRaise < -0.005
                ], [0.25, 0.2, 0.2, 0.15, 0.1, 0.1])
            },
            {
                name: 'Happy',
                confidence: calculateExpressionConfidence([
                    mouthCornerRaise > 0.018,
                    mouthWidthNorm > 0.34,
                    mouthHeightNorm > 0.035 * mouthThresholdMultiplier,
                    avgEyeHeightNorm > 0.038 * eyeThresholdMultiplier,
                    mouthRatio < 0.32
                ], [0.25, 0.2, 0.25, 0.2, 0.1])
            },
            {
                name: 'Angry',
                confidence: calculateExpressionConfidence([
                    avgEyeHeightNorm < 0.03 * eyeThresholdMultiplier,
                    mouthHeightNorm < 0.035 * mouthThresholdMultiplier,
                    mouthWidthNorm > 0.4,
                    mouthRatio < 0.18,
                    eyebrowRaise < -0.008,
                    Math.abs(leftEyebrow[2].x - rightEyebrow[2].x) / faceWidth < 0.3
                ], [0.2, 0.2, 0.15, 0.15, 0.15, 0.15])
            },
            {
                name: 'Sad',
                confidence: calculateExpressionConfidence([
                    mouthCornerRaise < -0.028,
                    avgEyeHeightNorm < 0.033 * eyeThresholdMultiplier,
                    mouthHeightNorm > 0.028 * mouthThresholdMultiplier,
                    mouthHeightNorm < 0.062 * mouthThresholdMultiplier,
                    eyebrowRaise < -0.008,
                    mouthWidthNorm < 0.37,
                    leftCornerRaise < -0.012 && rightCornerRaise < -0.012,
                    Math.abs(mouthAsymmetry) < 0.012
                ], [0.25, 0.2, 0.15, 0.1, 0.1, 0.1, 0.05, 0.05])
            },
            {
                name: 'Crying',
                confidence: calculateExpressionConfidence([
                    avgEyeHeightNorm < 0.03 * eyeThresholdMultiplier,
                    mouthHeightNorm < 0.06 * mouthThresholdMultiplier,
                    mouthRatio < 0.3,
                    mouthCornerRaise < -0.005
                ], [0.3, 0.3, 0.2, 0.2])
            }
        ];

        // Create validator
        const validateExpression = createExpressionValidator(emotions, detectionQualityRef, emotionHistoryRef);

        // Apply quality multiplier and validation
        expressions.forEach(expr => {
            const qualityFactor = Math.max(0.5, detectionQualityRef.current);
            expr.confidence *= qualityFactor;
            
            expr.isValid = validateExpression(expr.name, expr.confidence, { validations });
            
            const consecutiveCount = consecutiveEmotionCountRef.current[expr.name] || 0;
            if (consecutiveCount > 2) {
                expr.confidence *= 1.1;
            }
        });

        const validExpressions = expressions.filter(expr => expr.isValid);
        validExpressions.sort((a, b) => b.confidence - a.confidence);

        // Debug logging (10% of the time)
        if (Math.random() < 0.1 && validExpressions.length > 0) {
            console.log('📊 Detection Status:', {
                validExpressions: validExpressions.length,
                top3: validExpressions.slice(0, 3).map(e => `${e.name}:${e.confidence.toFixed(2)}`),
                quality: detectionQualityRef.current.toFixed(3),
                lastStable: lastStableEmotionRef.current,
                stability: emotionStabilityCountRef.current
            });
        }

        return {
            validExpressions,
            detectionQuality: detectionQualityRef.current,
            faceBox
        };

    } catch (error) {
        console.error('Error in emotion detection:', error);
        return null;
    }
};

