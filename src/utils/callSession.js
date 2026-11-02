import { showInfoToast } from "./toastUtils";

// One call at a time across the separate AudioCall and VideoCall components:
// each marks itself active while a call rings or runs, so the other one
// rejects an incoming call as busy and refuses to start a second call.
const activeCalls = { audio: null, video: null };

// While a call rings or runs it owns the microphone (and the camera for
// video). Everything else that records (voice typing, voice messages, the AI
// assistant, live voice, Ludo voice, the emotion camera...) listens here,
// stops when a call starts and refuses to start until it ends, like the Expo
// app's callSession / "communication-session-active". Otherwise a second
// capture can silence the call's microphone (iPhone, many Android phones) or
// take the camera away from a video call.
const busyListeners = new Set();

export const isCallBusy = () =>
  Object.keys(activeCalls).some((k) => activeCalls[k]);

export const getActiveCallKind = () =>
  Object.keys(activeCalls).find((k) => activeCalls[k]) || null;

const notifyBusyChange = (busy) => {
  busyListeners.forEach((listener) => {
    try {
      listener(busy);
    } catch (error) {
      console.warn("callSession: busy listener failed", error);
    }
  });
};

export const markCallActive = (kind, channelName) => {
  const wasBusy = isCallBusy();
  activeCalls[kind] = channelName || true;
  if (!wasBusy) notifyBusyChange(true);
};

export const markCallIdle = (kind) => {
  if (!activeCalls[kind]) return;
  activeCalls[kind] = null;
  if (!isCallBusy()) notifyBusyChange(false);
};

export const isOtherCallActive = (kind) =>
  Object.keys(activeCalls).some((k) => k !== kind && activeCalls[k]);

/** Calls `listener(busy)` whenever a call starts or the last one ends. */
export const onCallBusyChange = (listener) => {
  busyListeners.add(listener);
  return () => busyListeners.delete(listener);
};

export const CALL_BUSY_MESSAGE =
  "You're in a call. The microphone is reserved for the call until it ends.";

/**
 * For anything about to open the microphone or camera: returns true (and
 * tells the user why) when a call holds them, so the caller can bail out.
 */
export const refuseIfCallBusy = (message = CALL_BUSY_MESSAGE) => {
  if (!isCallBusy()) return false;
  try {
    showInfoToast(message, { toastId: "call-busy-microphone" });
  } catch (_) {
    /* toast container not mounted */
  }
  return true;
};

// A new Agora channel for every call (the app does the same). Reusing
// `${caller}-${callee}` for every call between two people let a late event of
// an earlier call (an end sent after a reconnect, a ring timeout) end the
// next one. 24-char ids keep this under Agora's 64-byte channel limit.
export const newCallChannelName = (myId, peerId) =>
  `${myId}-${peerId}-${Date.now().toString(36)}`;
