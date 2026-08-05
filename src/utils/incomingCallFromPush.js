/**
 * Bridge Web Push → in-app incoming call UI for iOS Home Screen / PWA.
 * Dispatches window event `incomingCallFromPush` with call payload.
 */

const RECENT_KEY = "__connect_recent_call_push";
const DEDUPE_MS = 8000;

function normalizePayload(raw = {}) {
  const isAudio =
    raw.isAudio === true ||
    raw.isAudio === "true" ||
    raw.isAudio === 1 ||
    raw.isAudio === "1";
  return {
    type: "incoming_call",
    isAudio,
    from: String(raw.callerId || raw.from || ""),
    channelName: raw.channelName || "",
    callerName: raw.callerName || "Someone",
    callerProfilePic: raw.callerProfilePic || "",
  };
}

function shouldAccept(payload) {
  if (!payload.from || !payload.channelName) return false;
  const key = `${payload.from}:${payload.channelName}:${payload.isAudio ? "a" : "v"}`;
  const now = Date.now();
  try {
    const prev = JSON.parse(sessionStorage.getItem(RECENT_KEY) || "{}");
    if (prev.key === key && now - (prev.at || 0) < DEDUPE_MS) return false;
    sessionStorage.setItem(RECENT_KEY, JSON.stringify({ key, at: now }));
  } catch (_) {}
  return true;
}

export function dispatchIncomingCallFromPush(raw) {
  const payload = normalizePayload(raw);
  if (!shouldAccept(payload)) return false;
  window.dispatchEvent(new CustomEvent("incomingCallFromPush", { detail: payload }));
  return true;
}

export function initIncomingCallPushBridge() {
  if (typeof window === "undefined") return () => {};

  const onSwMessage = (event) => {
    const msg = event.data || {};
    if (msg.type === "INCOMING_CALL_PUSH" && msg.data) {
      dispatchIncomingCallFromPush(msg.data);
    }
  };

  if (navigator.serviceWorker) {
    navigator.serviceWorker.addEventListener("message", onSwMessage);
  }

  // Cold start from notification click (?incoming_call=1&...)
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("incoming_call") === "1") {
      dispatchIncomingCallFromPush({
        callerId: params.get("callerId"),
        channelName: params.get("channelName"),
        isAudio: params.get("isAudio"),
        callerName: params.get("callerName"),
      });
      // Clean query without reload
      params.delete("incoming_call");
      params.delete("channelName");
      params.delete("isAudio");
      params.delete("callerId");
      params.delete("callerName");
      const qs = params.toString();
      const next = `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash || ""}`;
      window.history.replaceState({}, "", next);
    }
  } catch (_) {}

  return () => {
    if (navigator.serviceWorker) {
      navigator.serviceWorker.removeEventListener("message", onSwMessage);
    }
  };
}
