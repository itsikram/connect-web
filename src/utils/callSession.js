// One call at a time across the separate AudioCall and VideoCall components:
// each marks itself active while a call rings or runs, so the other one
// rejects an incoming call as busy and refuses to start a second call.
const activeCalls = { audio: null, video: null };

export const markCallActive = (kind, channelName) => {
  activeCalls[kind] = channelName || true;
};

export const markCallIdle = (kind) => {
  activeCalls[kind] = null;
};

export const isOtherCallActive = (kind) =>
  Object.keys(activeCalls).some((k) => k !== kind && activeCalls[k]);

// A new Agora channel for every call (the app does the same). Reusing
// `${caller}-${callee}` for every call between two people let a late event of
// an earlier call (an end sent after a reconnect, a ring timeout) end the
// next one. 24-char ids keep this under Agora's 64-byte channel limit.
export const newCallChannelName = (myId, peerId) =>
  `${myId}-${peerId}-${Date.now().toString(36)}`;
