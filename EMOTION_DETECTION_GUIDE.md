# Web Live Video Emotion Detection Guide

This guide explains how to use the real-time emotion detection feature in your web application.

## 🚀 Quick Start

### 1. Start the Emotion Detection Server

First, make sure the Python server is running:

```bash
cd emotion-detection
python server.py
```

You should see:
```
 * Running on http://0.0.0.0:5000
```

### 2. Start Your Web Application

In a new terminal:

```bash
cd web
npm start
```

### 3. Navigate to the Emotion Detector

Open your browser and go to the Marketplace page (or wherever `EmotionDetector` component is routed).

### 4. Allow Camera Access

When prompted, click "Allow" to give the browser access to your webcam.

### 5. Watch the Magic! ✨

The application will now:
- Capture frames from your webcam every 2 seconds
- Send them to the emotion detection server
- Display detected emotions and facial states in real-time

## 📊 What Gets Detected

### Basic Emotions
- **Happy** 😊
- **Sad** 😢
- **Angry** 😠
- **Surprise** 😲
- **Fear** 😨
- **Disgust** 🤢
- **Neutral** 😐

### Facial States (NEW!)
- **Speaking** 🗣️ - When you're talking
- **Smiling** 😄 - When you're smiling
- **Crying** 😭 - When you're very sad
- **Sleepy** 😴 - When your eyes are droopy/closed
- **Winking** 😉 - When you wink (shows which eye!)

## 🎨 Features

### Live Video Feed
- Real-time webcam display
- Analyzing indicator when processing

### Emotion Scores
- Shows all 7 emotions with percentages
- Color-coded confidence bars:
  - 🟢 Green (70%+): High confidence
  - 🟠 Orange (40-70%): Medium confidence
  - 🔴 Red (<40%): Low confidence

### Dominant State
- Highlights the most confident facial state
- Shows confidence percentage

### All States Grid
- Visual grid showing all 5 facial states
- Detected states are highlighted in green
- Non-detected states are grayed out
- Winking shows which eye is winking

## ⚙️ Configuration

### Change Detection Frequency

In `Marketplace.js`, line 30:

```javascript
const interval = setInterval(() => {
  captureFrame();
}, 2000); // Change this value (in milliseconds)
```

Options:
- `1000` = 1 second (very frequent, may slow down)
- `2000` = 2 seconds (default, good balance)
- `3000` = 3 seconds (less frequent, better performance)

### Change Video Resolution

In `Marketplace.js`, line 16:

```javascript
const stream = await navigator.mediaDevices.getUserMedia({
  video: { width: 640, height: 480 }, // Change these values
});
```

Options:
- `{ width: 320, height: 240 }` - Low quality, fast
- `{ width: 640, height: 480 }` - Medium quality (default)
- `{ width: 1280, height: 720 }` - High quality, slower

### Change Server URL

If your emotion detection server is running on a different port or machine:

In `Marketplace.js`, line 63:

```javascript
const res = await axios.post('http://localhost:5000/emotion', {
  image: base64,
});
```

Change `localhost:5000` to your server address.

## 🔧 Troubleshooting

### "Camera access denied"
**Solution**: Check your browser settings and allow camera access for this site.

### "Server error. Make sure the emotion detection server is running"
**Solution**: 
1. Check if the Python server is running on port 5000
2. Run `python emotion-detection/server.py`
3. Check the terminal for any errors

### Detection is slow
**Solutions**:
1. Increase detection interval to 3000ms or 5000ms
2. Lower video resolution
3. Ensure your Python server has all dependencies installed

### No face detected
**Solutions**:
1. Ensure good lighting
2. Face the camera directly
3. Move closer to the camera
4. Make sure your face is clearly visible

### States not detecting accurately
**Solutions**:
1. Ensure good lighting conditions
2. Face the camera straight on
3. Make clear facial expressions
4. Wait a few seconds for the model to analyze

## 📱 Browser Compatibility

Tested and working on:
- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

## 🎯 Tips for Best Results

1. **Lighting**: Use good front lighting, avoid backlighting
2. **Distance**: Sit 1-2 feet from the camera
3. **Angle**: Face the camera straight on
4. **Expressions**: Make clear, distinct expressions
5. **Wait**: Give the system 2-3 seconds to analyze

## 🔐 Privacy

- All processing happens locally
- No data is stored or sent to external servers
- Camera feed is only used for detection
- You can stop the camera anytime by closing the page

## 🎨 Customization

### Change Colors

Edit `EmotionDetector.css`:

```css
/* Main gradient background */
.emotion-detector-container {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

/* Detected state color */
.state-item.detected {
  border: 2px solid #4caf50; /* Change this color */
}
```

### Change Layout

The component uses CSS Grid and Flexbox, making it easy to customize:

- `.main-content` - Controls overall layout
- `.states-grid` - Controls the states grid layout
- `.score-bar-container` - Controls emotion scores layout

## 📊 API Response Format

The server returns this format:

```json
{
  "emotion": "happy",
  "emotion_scores": {
    "happy": 85.7,
    "neutral": 10.2,
    "surprise": 2.1,
    ...
  },
  "states": {
    "speaking": {"detected": false, "confidence": 0.0},
    "smiling": {"detected": true, "confidence": 0.85},
    "crying": {"detected": false, "confidence": 0.0},
    "sleepy": {"detected": false, "confidence": 0.0},
    "winking": {"detected": false, "confidence": 0.0, "eye": null}
  },
  "dominant_state": "smiling",
  "confidence": 0.85
}
```

## 🚀 Next Steps

- Integrate into video calls
- Add emotion history tracking
- Create emotion-based reactions
- Build mood analytics dashboard
- Add custom facial state alerts

## 💡 Use Cases

1. **Video Conferencing**: Auto-detect mood during calls
2. **E-Learning**: Track student engagement
3. **Healthcare**: Monitor patient emotional state
4. **Gaming**: Create emotion-responsive games
5. **Accessibility**: Help non-verbal communication

## 📞 Support

If you encounter issues:
1. Check the browser console (F12) for errors
2. Check the Python server terminal for errors
3. Verify all dependencies are installed
4. Try restarting both servers

Happy Detecting! 🎉

