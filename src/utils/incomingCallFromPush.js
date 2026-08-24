/**
 * Bridge Web Push → in-app incoming call UI for iOS Home Screen / PWA.
 * Dispatches:
 *  - `incomingCallFromPush` (optional autoAccept)
 *  - `rejectCallFromPush`
 */

const RECENT_KEY = "__connect_recent_call_push";
const DEDUPE_MS = 8000;

function tryFocusCurrentTab() {
  if (typeof window === "undefined") return false;

  try {
    window.focus?.();
    window.top?.focus?.();
    window.parent?.focus?.();
  } catch (_) {}

  try {
    return (
      document.visibilityState === "visible" || document.hasFocus?.() === true
    );
  } catch (_) {
    return false;
  }
}

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
    autoAccept:
      raw.autoAccept === true ||
      raw.autoAccept === "true" ||
      raw.autoAccept === "1",
  };
}

function shouldAccept(payload) {
  if (!payload.from || !payload.channelName) return false;
  const key = `${payload.from}:${payload.channelName}:${payload.isAudio ? "a" : "v"}:${payload.autoAccept ? "accept" : "ring"}`;
  const now = Date.now();
  try {
    const prev = JSON.parse(sessionStorage.getItem(RECENT_KEY) || "{}");
    if (prev.key === key && now - (prev.at || 0) < DEDUPE_MS) return false;
    sessionStorage.setItem(RECENT_KEY, JSON.stringify({ key, at: now }));
  } catch (_) {}
  return true;
}

async function rejectViaApi(payload) {
  try {
    const { default: api } = await import("../api/api");
    await api.post("/notification/call/reject-push", {
      callerId: payload.from,
      channelName: payload.channelName,
      isAudio: payload.isAudio ? "true" : "false",
    });
  } catch (err) {
    console.warn("rejectViaApi failed:", err?.message || err);
  }
}

export function dispatchIncomingCallFromPush(raw, options = {}) {
  const action = options.action || raw.call_action || raw.callAction || "";
  const payload = normalizePayload(raw);

  if (action === "reject" || action === "reject_call") {
    window.dispatchEvent(
      new CustomEvent("rejectCallFromPush", { detail: payload }),
    );
    // Ensure caller is notified even if call UI is not mounted yet
    rejectViaApi(payload);
    return true;
  }

  if (action === "accept" || action === "accept_call") {
    payload.autoAccept = true;
  }

  if (!shouldAccept(payload)) return false;
  tryFocusCurrentTab();
  window.dispatchEvent(
    new CustomEvent("incomingCallFromPush", { detail: payload }),
  );
  return true;
}

export function initIncomingCallPushBridge() {
  if (typeof window === "undefined") return () => {};

  const onSwMessage = (event) => {
    const msg = event.data || {};
    if (msg.type === "INCOMING_CALL_ACTION" && msg.data) {
      dispatchIncomingCallFromPush(msg.data, { action: msg.action });
      return;
    }
    if (msg.type === "INCOMING_CALL_PUSH" && msg.data) {
      dispatchIncomingCallFromPush(msg.data);
    }
  };

  if (navigator.serviceWorker) {
    navigator.serviceWorker.addEventListener("message", onSwMessage);
  }

  // Cold start from notification click (?incoming_call=1&call_action=accept|reject&...)
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("incoming_call") === "1") {
      dispatchIncomingCallFromPush(
        {
          callerId: params.get("callerId"),
          channelName: params.get("channelName"),
          isAudio: params.get("isAudio"),
          callerName: params.get("callerName"),
        },
        { action: params.get("call_action") || "" },
      );
      params.delete("incoming_call");
      params.delete("channelName");
      params.delete("isAudio");
      params.delete("callerId");
      params.delete("callerName");
      params.delete("call_action");
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
