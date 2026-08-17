# iPhone Media Session Testing (PWA)

## Scope and expectation
This app now uses the browser Media Session API for the existing watch/video
player elements. On iOS, this enables lock screen / Control Center metadata
and controls where Safari/WebKit allows it.

A standalone PWA still does **not** have the same lifecycle guarantees as a
native iOS app. If iOS fully terminates the PWA, playback stops.

## Test matrix
Run each scenario on a real iPhone:

- Safari tab
- Installed Home Screen PWA
- Screen locked
- Switch to another app
- Bluetooth headset / AirPods controls (if available)

## Test steps
1. Open the deployed app on iPhone.
2. Add it to Home Screen.
3. Launch the installed PWA.
4. Open `Video Player` (or start a watch video).
5. Start playback from a direct user interaction.
6. Lock the iPhone.
7. Confirm lock screen shows Now Playing metadata:
   - title
   - source/artist label
   - artwork
8. Open Control Center and verify media controls are visible.
9. Test controls:
   - play/pause
   - previous/next (playlist view)
   - seek backward/forward where iOS exposes them
10. Unlock and return to the app.
11. Verify UI play state and timeline stay synchronized.
12. Repeat while switching to another app.
13. Repeat with Bluetooth/AirPods media buttons.

## Known iOS/WebKit limitation
If iOS suspends or terminates the Safari/PWA process, web playback cannot be
kept alive by service worker or background scripts. This is an iOS platform
constraint for web apps.

## Native requirement for stronger background guarantees
This repository currently has no Capacitor/native iOS target tied to this web
app. For true native-grade background audio guarantees, a native iOS shell is
required with:

- `AVAudioSession` category `.playback`
- iOS Background Modes: `Audio, AirPlay, and Picture in Picture`
