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
