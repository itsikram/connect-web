// MediaPipe Face Mesh based expression detection (mirrors mediapipe_browser_example.html)
// This utility dynamically loads the MediaPipe scripts from CDN and provides
// a simple API to start/stop detection on a given HTMLVideoElement.

const MP_CDN_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe';

function loadScript(src) {
	return new Promise((resolve, reject) => {
		const existing = document.querySelector(`script[src="${src}"]`);
		if (existing) {
			if (existing.getAttribute('data-loaded') === 'true') return resolve();
			existing.addEventListener('load', () => resolve());
			existing.addEventListener('error', reject);
			return;
		}
		const script = document.createElement('script');
		script.src = src;
		script.async = true;
		script.onload = () => {
			script.setAttribute('data-loaded', 'true');
			resolve();
		};
		script.onerror = reject;
		document.head.appendChild(script);
	});
}

async function ensureMediaPipeLoaded() {
    if (window.FaceMesh && window.Camera && window.drawConnectors && window.FACEMESH_TESSELATION) {
        return;
    }
    const customBase = typeof window !== 'undefined' && window.__MP_MEDIAPIPE_BASE ? window.__MP_MEDIAPIPE_BASE : null;
    // Prefer CDN first; fallback to custom base if provided
    const bases = [MP_CDN_BASE, customBase].filter(Boolean);
    let lastErr = null;
    for (const base of bases) {
        try {
            await loadScript(`${base}/camera_utils/camera_utils.js`);
            await loadScript(`${base}/drawing_utils/drawing_utils.js`);
            await loadScript(`${base}/face_mesh/face_mesh.js`);
            // Verify globals actually loaded (avoid HTML fallback responses)
            if (window.FaceMesh && typeof window.FaceMesh === 'function' && window.Camera && window.drawConnectors) {
                return;
            }
        } catch (e) {
            lastErr = e;
        }
    }
    throw lastErr || new Error('Failed to load MediaPipe scripts');
}

// Distance between two landmarks
function distance(p1, p2) {
	const dx = p1.x - p2.x;
	const dy = p1.y - p2.y;
	const dz = p1.z - p2.z;
	return Math.sqrt(dx*dx + dy*dy + dz*dz);
}

// Calculate face clarity score (0-100) — same heuristic as the HTML demo
function calculateFaceClarity(landmarks) {
	const leftEyeOuter = landmarks[33];
	const rightEyeOuter = landmarks[263];
	const faceWidth = distance(leftEyeOuter, rightEyeOuter);

	let sizeScore = 0;
	if (faceWidth >= 0.18 && faceWidth <= 0.38) {
		sizeScore = 100 - Math.abs(faceWidth - 0.28) * 300;
	} else if (faceWidth < 0.18) {
		sizeScore = Math.max(0, (faceWidth / 0.18) * 60);
	} else {
		sizeScore = Math.max(0, 60 - (faceWidth - 0.38) * 300);
	}

	const nose = landmarks[1];
	const leftCheek = landmarks[234];
	const rightCheek = landmarks[454];
	const leftDepth = Math.abs(nose.z - leftCheek.z);
	const rightDepth = Math.abs(nose.z - rightCheek.z);
	const depthDifference = Math.abs(leftDepth - rightDepth);
	const angleScore = Math.max(0, 100 - depthDifference * 1000);

	const faceCenterX = (leftEyeOuter.x + rightEyeOuter.x) / 2;
	const horizontalCenter = Math.abs(faceCenterX - 0.5);
	const centerScore = Math.max(0, 100 - horizontalCenter * 300);

	const faceCenterY = nose.y;
	const verticalScore = (faceCenterY >= 0.3 && faceCenterY <= 0.6) ? 100 : Math.max(0, 100 - Math.abs(faceCenterY - 0.45) * 300);

	const clarityScore = (sizeScore * 0.4 + angleScore * 0.3 + centerScore * 0.2 + verticalScore * 0.1);
	let clarityLevel = 'Poor';
	if (clarityScore >= 80) clarityLevel = 'Excellent';
	else if (clarityScore >= 65) clarityLevel = 'Good';
	else if (clarityScore >= 50) clarityLevel = 'Fair';

	return { score: Math.round(clarityScore), level: clarityLevel };
}

// Exponential moving average helper
function ema(prev, next, alpha) {
	return (prev === undefined || prev === null) ? next : (prev * (1 - alpha) + next * alpha);
}

// Analyze expression — ported from the HTML demo's analyzeExpression
function analyzeExpression(landmarks, clarityScore, canvasWidth, canvasHeight, smoothCtx, calibCtx, avgCtx) {
	const SMOOTH_ALPHA = 0.35;
	// Face size for normalization
	const leftEyeOuter = landmarks[33];
	const rightEyeOuter = landmarks[263];
	const faceWidth = distance(leftEyeOuter, rightEyeOuter);
	const faceWidthPx = Math.hypot(
		(leftEyeOuter.x - rightEyeOuter.x) * canvasWidth,
		(leftEyeOuter.y - rightEyeOuter.y) * canvasHeight
	);

	// Eye aspect ratios
	const leftEyeTop = landmarks[159];
	const leftEyeBottom = landmarks[145];
	const rightEyeTop = landmarks[386];
	const rightEyeBottom = landmarks[374];
	const leftEAR = distance(leftEyeTop, leftEyeBottom) / faceWidth;
	const rightEAR = distance(rightEyeTop, rightEyeBottom) / faceWidth;
	const avgEAR_raw = (leftEAR + rightEAR) / 2;

	// Mouth metrics
	const mouthTop = landmarks[13];
	const mouthBottom = landmarks[14];
	const mouthLeft = landmarks[61];
	const mouthRight = landmarks[291];
	const mouthHeight_raw = distance(mouthTop, mouthBottom) / faceWidth;
	const mouthWidth_raw = distance(mouthLeft, mouthRight) / faceWidth;
	const mar_raw = mouthHeight_raw / mouthWidth_raw;

	// Mouth curve
	const leftCorner = landmarks[61];
	const rightCorner = landmarks[291];
	const mouthCenterY = landmarks[13].y;
	const cornerHeightAvg = (leftCorner.y + rightCorner.y) / 2;
	const mouthCurve_raw = mouthCenterY - cornerHeightAvg;

	// Brows
	const leftEyebrowInner = landmarks[285];
	const rightEyebrowInner = landmarks[55];
	const leftEyebrowCenter = landmarks[282];
	const rightEyebrowCenter = landmarks[52];
	const leftBrowHeight = leftEyebrowCenter.y;
	const rightBrowHeight = rightEyebrowCenter.y;
	const avgBrowY = (leftBrowHeight + rightBrowHeight) / 2;
	const innerBrowDistance_raw = distance(leftEyebrowInner, rightEyebrowInner) / faceWidth;
	const innerBrowDistance_px = Math.hypot(
		(leftEyebrowInner.x - rightEyebrowInner.x) * canvasWidth,
		(leftEyebrowInner.y - rightEyebrowInner.y) * canvasHeight
	);
	const leftBrowToEye = distance(leftEyebrowInner, leftEyeTop) / faceWidth;
	const rightBrowToEye = distance(rightEyebrowInner, rightEyeTop) / faceWidth;
	const avgBrowToEye = (leftBrowToEye + rightBrowToEye) / 2;
	const leftEyeWidth = distance(landmarks[33], landmarks[133]) / faceWidth;
	const rightEyeWidth = distance(landmarks[362], landmarks[263]) / faceWidth;
	const avgEyeWidth = (leftEyeWidth + rightEyeWidth) / 2;
	const browRatio_raw = avgBrowToEye / avgEyeWidth;

	// Lip distance (pucker)
	const upperLip = landmarks[0];
	const lowerLip = landmarks[17];
	const lipDistance_raw = distance(upperLip, lowerLip) / faceWidth;

	// Smooth key features
	smoothCtx.avgEAR = ema(smoothCtx.avgEAR, avgEAR_raw, SMOOTH_ALPHA);
	smoothCtx.mouthWidth = ema(smoothCtx.mouthWidth, mouthWidth_raw, SMOOTH_ALPHA);
	smoothCtx.mar = ema(smoothCtx.mar, mar_raw, SMOOTH_ALPHA);
	smoothCtx.mouthHeight = ema(smoothCtx.mouthHeight, mouthHeight_raw, SMOOTH_ALPHA);
	smoothCtx.mouthCurve = ema(smoothCtx.mouthCurve, mouthCurve_raw, SMOOTH_ALPHA);
	smoothCtx.innerBrowDistance = ema(smoothCtx.innerBrowDistance, innerBrowDistance_raw, SMOOTH_ALPHA);
	smoothCtx.browRatio = ema(smoothCtx.browRatio, browRatio_raw, SMOOTH_ALPHA);
	smoothCtx.lipDistance = ema(smoothCtx.lipDistance, lipDistance_raw, SMOOTH_ALPHA);

	// Calibration collect while clarity is good
	if (calibCtx.isCalibrating && clarityScore >= 65) {
		calibCtx.framesCollected++;
		calibCtx.sums.avgEAR += (smoothCtx.avgEAR || avgEAR_raw);
		calibCtx.sums.mouthWidth += (smoothCtx.mouthWidth || mouthWidth_raw);
		calibCtx.sums.mar += (smoothCtx.mar || mar_raw);
		calibCtx.sums.innerBrowDistance += (smoothCtx.innerBrowDistance || innerBrowDistance_raw);
		calibCtx.sums.browRatio += (smoothCtx.browRatio || browRatio_raw);
		calibCtx.sums.mouthCurve += (smoothCtx.mouthCurve || mouthCurve_raw);
		if (calibCtx.framesCollected >= 45) {
			calibCtx.baseline = {
				avgEAR: calibCtx.sums.avgEAR / calibCtx.framesCollected,
				mouthWidth: calibCtx.sums.mouthWidth / calibCtx.framesCollected,
				mar: calibCtx.sums.mar / calibCtx.framesCollected,
				innerBrowDistance: calibCtx.sums.innerBrowDistance / calibCtx.framesCollected,
				browRatio: calibCtx.sums.browRatio / calibCtx.framesCollected,
				mouthCurve: calibCtx.sums.mouthCurve / calibCtx.framesCollected
			};
			calibCtx.isCalibrating = false;
		}
	}

	// Minimal cues used by custom expression logic
	const mouthOpenArea = (smoothCtx.mar || mar_raw) * (smoothCtx.mouthWidth || mouthWidth_raw);
	const teethVisible = ((smoothCtx.mar || mar_raw) > 0.22 && (smoothCtx.mouthHeight || mouthHeight_raw) > 0.03) || mouthOpenArea > 0.035;

	const metrics = {
		faceWidth: faceWidth.toFixed(4),
		mouthWidth: (smoothCtx.mouthWidth || mouthWidth_raw).toFixed(4),
		mouthHeight: (smoothCtx.mouthHeight || mouthHeight_raw).toFixed(4),
		mar: (smoothCtx.mar || mar_raw).toFixed(4),
		avgEAR: (smoothCtx.avgEAR || avgEAR_raw).toFixed(4),
		innerBrowDistance: (smoothCtx.innerBrowDistance || innerBrowDistance_raw).toFixed(4),
		browRatio: (smoothCtx.browRatio || browRatio_raw).toFixed(4),
		avgBrowToEye: avgBrowToEye.toFixed(4),
		mouthCurve: (smoothCtx.mouthCurve || mouthCurve_raw).toFixed(4),
		lipDistance: (smoothCtx.lipDistance || lipDistance_raw).toFixed(4),
		mouthOpenArea: mouthOpenArea.toFixed(4),
		browDistancePx: innerBrowDistance_px.toFixed(1),
		teethVisible: teethVisible,
		leftEAR: leftEAR.toFixed(4),
		rightEAR: rightEAR.toFixed(4),
		leftEyeWidth: leftEyeWidth.toFixed(4),
		rightEyeWidth: rightEyeWidth.toFixed(4),
		avgEyeWidth: avgEyeWidth.toFixed(4),
		leftBrowToEye: leftBrowToEye.toFixed(4),
		rightBrowToEye: rightBrowToEye.toFixed(4),
		leftEyeOpen: leftEAR > 0.05,
		rightEyeOpen: rightEAR > 0.05,
	};

	const mouthWidthVal = parseFloat(metrics.mouthWidth);
	const mouthOpenAreaVal = parseFloat(metrics.mouthOpenArea);
	const avgEARVal = parseFloat(metrics.avgEAR);
	const browDistanceRatioVal = innerBrowDistance_px / faceWidthPx;
	const innerBrowDistanceVal = parseFloat(metrics.innerBrowDistance);
	const mouthCurveVal = parseFloat(metrics.mouthCurve);
	const leftBrowToEyeVal = parseFloat(metrics.leftBrowToEye);
	const rightBrowToEyeVal = parseFloat(metrics.rightBrowToEye);
    const mouthHeightVal = parseFloat(metrics.mouthHeight);

    let customExpression = (metrics) => {
        // Use prepared numeric values for stability
        if (mouthWidthVal > 0.57 && !metrics.teethVisible) {
            return 'Smiling';
        }
        if (mouthWidthVal > 0.60 && metrics.teethVisible && mouthOpenAreaVal > 0.18) {
            return 'Laughing';
        }
        if (metrics.teethVisible && mouthCurveVal > -0.25 && mouthOpenAreaVal < 0.20) {
            return 'Speaking';
        }
        if (leftEAR < 0.05 && rightEAR > 0.05 && mouthOpenAreaVal < 0.30) {
            return 'Winking';
        }
        if (leftEAR > 0.05 && rightEAR < 0.05 && mouthOpenAreaVal < 0.30) {
            return 'Winking';
        }
        if (mouthOpenAreaVal > 0.40 && avgEARVal < 0.11) {
            return 'Yawning';
        }
        if (browDistanceRatioVal > 0.310 && innerBrowDistanceVal > 0.305) {
            return 'Surprised';
        }
        if (browDistanceRatioVal < 0.305 && innerBrowDistanceVal < 0.290 && mouthOpenAreaVal < 0.30) {
            return 'Angry';
        }
        if (avgEARVal < 0.095 && mouthCurveVal > -0.150 && mouthOpenAreaVal < 0.25 && metrics.leftEyeOpen && metrics.rightEyeOpen) {
            return 'Sleepy';
        }
        if (leftBrowToEyeVal > 0.595 || rightBrowToEyeVal > 0.595) {
            return 'Eyebrow Raise';
        }
        // Kissing: tight, narrow mouth with slight forward shape
        if (mouthHeightVal < 0.045 && mouthWidthVal < 0.43 && mouthCurveVal > 0.0) {
            return 'Kissing';
        }
        return 'Neutral';
    }


	// Basic emotion scoring (same idea as demo)
	function computeEmotionScores(exprLabel) {
		const scores = { happy: 0, sad: 0, surprise: 0, angry: 0 };
		switch (exprLabel) {
			case 'Smiling': scores.happy = 1.0; break;
			case 'Laughing': scores.happy = 1.0; scores.surprise = 0.2; break;
			case 'Winking': scores.happy = 0.4; break;
			case 'Yawning': scores.surprise = 0.8; break;
			case 'Eyebrow Raise': scores.surprise = 0.8; break;
			case 'Sleepy': scores.sad = 0.5; break;
			case 'Speaking': scores.happy = 0.2; scores.surprise = 0.2; break;
			default: scores.happy = 0.25; scores.sad = 0.25; scores.surprise = 0.25; scores.angry = 0.25; break;
		}
		return scores;
	}

	const label = customExpression(metrics);
	const emotions = computeEmotionScores(label);
	let dominantEmotion = 'Neutral';
	let dominantScore = -1;
	for (const k of ['happy','sad','surprise','angry']) {
		if (emotions[k] > dominantScore) { dominantScore = emotions[k]; dominantEmotion = k.charAt(0).toUpperCase() + k.slice(1); }
	}

	return {
		customExpression: label,
		emotions,
		dominantEmotion,
		dominantEmotionScore: dominantScore,
		debug: metrics
	};
}

export async function startMediaPipeEmotionDetection(videoEl, onChange) {
	await ensureMediaPipeLoaded();
	let faceMesh = null;
	let camera = null;
	let lastStableAnalysis = null;
    let isRunning = true;
	const smoothCtx = {};
	const calibCtx = {
		isCalibrating: true,
		framesCollected: 0,
		sums: { avgEAR: 0, mouthWidth: 0, mar: 0, innerBrowDistance: 0, browRatio: 0, mouthCurve: 0 },
		baseline: null
	};

	function initFaceMesh() {
		faceMesh = new window.FaceMesh({
			locateFile: (file) => `${MP_CDN_BASE}/face_mesh/${file}`
		});
		faceMesh.setOptions({
			maxNumFaces: 1,
			refineLandmarks: true,
			minDetectionConfidence: 0.5,
			minTrackingConfidence: 0.5
		});
		faceMesh.onResults(onResults);
	}

    function onResults(results) {
        if (!isRunning) return;
		if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
			const landmarks = results.multiFaceLandmarks[0];
			const clarity = calculateFaceClarity(landmarks);
			const analysis = analyzeExpression(
				landmarks,
				clarity.score,
				videoEl.videoWidth || 640,
				videoEl.videoHeight || 480,
				smoothCtx,
				calibCtx
			);
			let finalAnalysis = analysis;
			if (clarity.score < 60 && lastStableAnalysis) {
				finalAnalysis = lastStableAnalysis;
			} else if (clarity.score >= 60) {
				lastStableAnalysis = analysis;
			}
			try { onChange && onChange({ label: finalAnalysis.customExpression, analysis: finalAnalysis, clarityScore: clarity.score }); } catch (_) {}
		}
	}

	initFaceMesh();
    camera = new window.Camera(videoEl, {
        onFrame: async () => {
            if (!isRunning || !faceMesh) return;
            try {
                await faceMesh.send({ image: videoEl });
            } catch (_) {
                // Ignore if stopping or faceMesh not ready
            }
        },
		width: videoEl.videoWidth || 640,
		height: videoEl.videoHeight || 480
	});
	camera.start();

	return {
		stop: () => {
            isRunning = false;
            try { camera && camera.stop(); } catch (_) {}
			camera = null;
			faceMesh = null;
		}
	};
}


