import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Realtime connection to the local Expo control daemon
 * (expo-connect-app/scripts/expo-control).
 *
 * Tries the web dev-server proxy first (same origin, works from phones on the
 * LAN too), then the daemon directly on this machine.
 */
const isLocalPage = /^(localhost|127\.\d+\.\d+\.\d+|\[::1\])$/.test(window.location.hostname);

const CANDIDATE_BASES = [
  process.env.REACT_APP_EXPO_CONTROL_URL,
  "/__expo-control",
  // Direct access only from pages served on this machine; probing loopback
  // from the public site would trigger Chrome's local-network prompt.
  isLocalPage ? "http://127.0.0.1:19010" : null,
].filter(Boolean);

const LOG_LIMIT = 2000;
const RETRY_MS = 3000;

async function probe(base) {
  try {
    const res = await fetch(`${base}/api/health`, { cache: "no-store" });
    const type = res.headers.get("content-type") || "";
    if (!type.includes("application/json")) return null;
    const body = await res.json();
    if (body && body.service === "expo-control") return { base, status: "online" };
    if (body && body.code === "CONTROL_STARTING") return { base, status: "starting" };
    if (body && body.code === "CONTROL_OFFLINE") return { base, status: "offline" };
    return null;
  } catch (_) {
    return null;
  }
}

async function resolveBase() {
  let fallback = null;
  for (const base of CANDIDATE_BASES) {
    const result = await probe(base);
    if (result && result.status === "online") return result;
    if (result && !fallback) fallback = result;
  }
  return fallback || { base: null, status: "offline" };
}

export default function useExpoControl() {
  const [connection, setConnection] = useState("connecting"); // connecting | online | starting | offline
  const [state, setState] = useState(null);
  const [logs, setLogs] = useState([]);
  const baseRef = useRef(null);
  const sourceRef = useRef(null);
  const retryRef = useRef(null);
  const aliveRef = useRef(true);

  const connect = useCallback(async () => {
    clearTimeout(retryRef.current);
    if (sourceRef.current) {
      sourceRef.current.close();
      sourceRef.current = null;
    }

    const resolved = await resolveBase();
    if (!aliveRef.current) return;
    if (resolved.status !== "online") {
      setConnection(resolved.status === "starting" ? "starting" : "offline");
      retryRef.current = setTimeout(connect, RETRY_MS);
      return;
    }

    baseRef.current = resolved.base;
    const source = new EventSource(`${resolved.base}/api/events`);
    sourceRef.current = source;

    // Each (re)connect starts with the server's backlog, which replaces
    // whatever we had; later batches are appended.
    let expectBacklog = true;
    source.addEventListener("hello", () => {
      expectBacklog = true;
      setConnection("online");
    });
    source.addEventListener("state", (event) => {
      setState(JSON.parse(event.data));
      setConnection("online");
    });
    source.addEventListener("logs", (event) => {
      const batch = JSON.parse(event.data);
      const isBacklog = expectBacklog;
      expectBacklog = false;
      if (isBacklog) {
        setLogs(batch.slice(-LOG_LIMIT));
        return;
      }
      if (!batch.length) return;
      setLogs((previous) => {
        const merged = previous.concat(batch);
        return merged.length > LOG_LIMIT ? merged.slice(-LOG_LIMIT) : merged;
      });
    });
    source.addEventListener("logs-cleared", () => setLogs([]));
    source.onerror = () => {
      if (!aliveRef.current) return;
      setConnection("connecting");
      // A non-stream reply (proxy error page) closes the source for good.
      if (source.readyState === EventSource.CLOSED) {
        retryRef.current = setTimeout(connect, RETRY_MS);
      }
    };
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    connect();
    return () => {
      aliveRef.current = false;
      clearTimeout(retryRef.current);
      if (sourceRef.current) sourceRef.current.close();
    };
  }, [connect]);

  const request = useCallback(async (method, path, body) => {
    if (!baseRef.current) throw new Error("The Expo control service is not connected.");
    const res = await fetch(`${baseRef.current}${path}`, {
      method,
      headers: { "Content-Type": "application/json", "X-Expo-Control": "1" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      const error = new Error(payload.error || `Request failed (${res.status})`);
      error.code = payload.code;
      throw error;
    }
    if (payload && payload.status && payload.controller) setState(payload);
    return payload;
  }, []);

  const actions = {
    start: (options) => request("POST", "/api/start", options),
    stop: () => request("POST", "/api/stop"),
    restart: (options) => request("POST", "/api/restart", options),
    updateOptions: (options) => request("POST", "/api/options", options),
    freePort: () => request("POST", "/api/free-port"),
    prewarm: () => request("POST", "/api/prewarm"),
    reloadApps: () => request("POST", "/api/apps/reload"),
    openDevMenu: () => request("POST", "/api/apps/dev-menu"),
    clearLogs: () => request("DELETE", "/api/logs"),
  };

  return { connection, state, logs, actions, reconnect: connect };
}
