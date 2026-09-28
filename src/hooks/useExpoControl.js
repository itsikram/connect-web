import { useCallback, useEffect, useRef, useState } from "react";
import api from "../api/api";

/**
 * Realtime connection to the Expo control daemon on the home PC
 * (expo-connect-app/scripts/expo-control).
 *
 * - Local (localhost / LAN page): through the web dev-server proxy, or the
 *   daemon directly on this machine.
 * - Live site: the Connect server hands out the daemon's Cloudflare tunnel URL
 *   (published by home-cobalt, like face login) and every request carries the
 *   access key stored in this browser.
 */

const pageHost = window.location.hostname;
const isLoopbackPage = /^(localhost|127\.\d+\.\d+\.\d+|\[::1\])$/.test(pageHost);
const isLocalPage =
  isLoopbackPage ||
  pageHost.endsWith(".localhost") ||
  /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(pageHost);

const LOCAL_BASES = [
  process.env.REACT_APP_EXPO_CONTROL_URL,
  isLocalPage ? "/__expo-control" : null,
  // Probing loopback from the public site would trigger Chrome's
  // local-network prompt, so only do it from pages served on this machine.
  isLoopbackPage ? "http://127.0.0.1:19010" : null,
].filter(Boolean);

const KEY_STORAGE = "expoControlAccessKey";
const LOG_LIMIT = 2000;
const RETRY_MS = 3000;
const STALL_MS = 45000; // the daemon sends a heartbeat every 15s

function readStoredKey() {
  try {
    return localStorage.getItem(KEY_STORAGE) || "";
  } catch (_) {
    return "";
  }
}

function storeKey(key) {
  try {
    if (key) localStorage.setItem(KEY_STORAGE, key);
    else localStorage.removeItem(KEY_STORAGE);
  } catch (_) {
    // storage unavailable (private mode); the key lasts for this page only
  }
}

async function probe(base) {
  try {
    const res = await fetch(`${base}/api/health`, { cache: "no-store" });
    const type = res.headers.get("content-type") || "";
    if (!type.includes("application/json")) return null;
    const body = await res.json();
    if (body && body.service === "expo-control") return "online";
    if (body && body.code === "CONTROL_STARTING") return "starting";
    if (body && body.code === "CONTROL_OFFLINE") return "offline";
    return null;
  } catch (_) {
    return null;
  }
}

/** Decide how to reach the daemon. Returns { status, mode, base, key, remote }. */
async function resolveTarget(accessKey) {
  let localStatus = null;
  for (const base of LOCAL_BASES) {
    const status = await probe(base);
    if (status === "online") return { status, mode: "local", base, key: "" };
    if (status && !localStatus) localStatus = status;
  }
  if (isLocalPage) return { status: localStatus === "starting" ? "starting" : "offline", mode: "local" };

  let config;
  try {
    const res = await api.get("expo-control-config", { timeout: 15000 });
    config = res.data || {};
  } catch (error) {
    const status = error && error.response && error.response.status;
    return { status: status === 401 ? "signed-out" : "remote-offline", mode: "remote", remote: null };
  }
  const remote = { url: config.url || "", lastSyncAt: config.lastSyncAt || null, online: Boolean(config.online) };
  if (!remote.url || (await probe(remote.url)) !== "online") {
    return { status: "remote-offline", mode: "remote", remote };
  }
  if (!accessKey) return { status: "needs-key", mode: "remote", remote };

  // Validate the key before opening the stream so we can show a clear error.
  try {
    const res = await fetch(`${remote.url}/api/status`, {
      headers: { "X-Expo-Control-Key": accessKey },
      cache: "no-store",
    });
    if (res.status === 401) return { status: "needs-key", mode: "remote", remote, keyRejected: true };
    if (res.status === 503) return { status: "remote-disabled", mode: "remote", remote };
    if (!res.ok) return { status: "remote-offline", mode: "remote", remote };
  } catch (_) {
    return { status: "remote-offline", mode: "remote", remote };
  }
  return { status: "online", mode: "remote", base: remote.url, key: accessKey, remote };
}

/** Minimal Server-Sent Events reader over fetch (EventSource cannot send headers). */
async function readEventStream(url, headers, signal, onEvent) {
  const res = await fetch(url, {
    headers: { ...headers, Accept: "text/event-stream" },
    cache: "no-store",
    signal,
  });
  if (!res.ok || !res.body) {
    const error = new Error(`Event stream failed (${res.status})`);
    error.status = res.status;
    throw error;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) return;
    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
    onEvent("__activity");
    let boundary;
    while ((boundary = buffer.indexOf("\n\n")) !== -1) {
      const block = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      let event = "message";
      const data = [];
      for (const line of block.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""));
      }
      if (data.length) onEvent(event, data.join("\n"));
    }
  }
}

const POLL_VISIBLE_MS = 1500;
const POLL_HIDDEN_MS = 5000;
const POLL_MAX_FAILURES = 3;

const sleep = (ms, signal) =>
  new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      resolve();
    });
  });

/**
 * Polling transport for the live site. Cloudflare quick tunnels hold back
 * event streams until they end, so the browser asks for a snapshot (state +
 * new log lines) every 1.5s instead.
 */
async function pollSnapshots(base, headers, signal, handlers) {
  let since = 0;
  let controllerStartedAt = null;
  let failures = 0;
  while (!signal.aborted) {
    try {
      const res = await fetch(`${base}/api/snapshot?since=${since}`, { headers, cache: "no-store", signal });
      if (res.status === 401) {
        handlers.onUnauthorized();
        return;
      }
      if (!res.ok) throw new Error(`Snapshot failed (${res.status})`);
      const snapshot = await res.json();
      failures = 0;
      const startedAt = snapshot.state.controller.startedAt;
      // First poll, a restarted daemon (ids start over) or cleared logs: replace.
      const replace = controllerStartedAt !== startedAt || snapshot.lastLogId < since;
      controllerStartedAt = startedAt;
      since = snapshot.lastLogId;
      handlers.onSnapshot(snapshot, replace);
    } catch (error) {
      if (signal.aborted) return;
      failures += 1;
      if (failures >= POLL_MAX_FAILURES) return;
    }
    await sleep(document.hidden ? POLL_HIDDEN_MS : POLL_VISIBLE_MS, signal);
  }
}

export default function useExpoControl() {
  // connecting | online | starting | offline | remote-offline | remote-disabled | needs-key | signed-out
  const [connection, setConnection] = useState("connecting");
  const [mode, setMode] = useState(isLocalPage ? "local" : "remote");
  const [remote, setRemote] = useState(null);
  const [keyRejected, setKeyRejected] = useState(false);
  const [state, setState] = useState(null);
  const [logs, setLogs] = useState([]);
  const targetRef = useRef(null);
  const abortRef = useRef(null);
  const retryRef = useRef(null);
  const aliveRef = useRef(true);
  const keyRef = useRef(readStoredKey());

  const stopStream = () => {
    clearTimeout(retryRef.current);
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = null;
  };

  const connect = useCallback(async () => {
    stopStream();
    const target = await resolveTarget(keyRef.current);
    if (!aliveRef.current) return;
    setMode(target.mode);
    setRemote(target.remote || null);
    setKeyRejected(Boolean(target.keyRejected));

    if (target.status !== "online") {
      targetRef.current = null;
      setConnection(target.status);
      // Keep retrying unless the user has to act (enter a key / sign in).
      if (!["needs-key", "signed-out"].includes(target.status)) {
        retryRef.current = setTimeout(connect, target.mode === "remote" ? RETRY_MS * 3 : RETRY_MS);
      }
      return;
    }

    targetRef.current = target;
    const controller = new AbortController();
    abortRef.current = controller;
    const headers = target.key ? { "X-Expo-Control-Key": target.key } : {};

    if (target.mode === "remote") {
      let unauthorized = false;
      await pollSnapshots(target.base, headers, controller.signal, {
        onSnapshot: (snapshot, replace) => {
          setState(snapshot.state);
          setConnection("online");
          if (replace) {
            setLogs(snapshot.logs.slice(-LOG_LIMIT));
          } else if (snapshot.logs.length) {
            setLogs((previous) => {
              const merged = previous.concat(snapshot.logs);
              return merged.length > LOG_LIMIT ? merged.slice(-LOG_LIMIT) : merged;
            });
          }
        },
        onUnauthorized: () => {
          unauthorized = true;
          targetRef.current = null;
          setKeyRejected(true);
          setConnection("needs-key");
        },
      });
      if (!aliveRef.current || abortRef.current !== controller || unauthorized) return;
      // Several polls failed in a row: the PC or tunnel went away. Re-resolve,
      // since the tunnel URL may have changed.
      setConnection("connecting");
      retryRef.current = setTimeout(connect, RETRY_MS);
      return;
    }

    let expectBacklog = true;
    let stallTimer = null;
    const armStallTimer = () => {
      clearTimeout(stallTimer);
      stallTimer = setTimeout(() => controller.abort(), STALL_MS);
    };

    const onEvent = (event, data) => {
      if (event === "__activity") {
        armStallTimer();
        return;
      }
      if (event === "hello") {
        expectBacklog = true;
        setConnection("online");
      } else if (event === "state") {
        setState(JSON.parse(data));
        setConnection("online");
      } else if (event === "logs") {
        const batch = JSON.parse(data);
        // Each (re)connect starts with the server's backlog, which replaces
        // what we had; later batches are appended.
        if (expectBacklog) {
          expectBacklog = false;
          setLogs(batch.slice(-LOG_LIMIT));
        } else if (batch.length) {
          setLogs((previous) => {
            const merged = previous.concat(batch);
            return merged.length > LOG_LIMIT ? merged.slice(-LOG_LIMIT) : merged;
          });
        }
      } else if (event === "logs-cleared") {
        setLogs([]);
      }
    };

    armStallTimer();
    try {
      await readEventStream(`${target.base}/api/events`, headers, controller.signal, onEvent);
    } catch (_) {
      // dropped, aborted by the stall timer, or the daemon went away
    } finally {
      clearTimeout(stallTimer);
    }
    if (!aliveRef.current || abortRef.current !== controller) return;
    setConnection("connecting");
    retryRef.current = setTimeout(connect, RETRY_MS);
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    connect();
    return () => {
      aliveRef.current = false;
      stopStream();
    };
  }, [connect]);

  const setAccessKey = useCallback(
    (key) => {
      keyRef.current = String(key || "").trim();
      storeKey(keyRef.current);
      setConnection("connecting");
      connect();
    },
    [connect]
  );

  const forgetAccessKey = useCallback(() => setAccessKey(""), [setAccessKey]);

  const request = useCallback(async (method, path, body) => {
    const target = targetRef.current;
    if (!target) throw new Error("The Expo control service is not connected.");
    const headers = { "Content-Type": "application/json", "X-Expo-Control": "1" };
    if (target.key) headers["X-Expo-Control-Key"] = target.key;
    const res = await fetch(`${target.base}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const payload = await res.json().catch(() => ({}));
    if (res.status === 401 && target.mode === "remote") {
      setKeyRejected(true);
      setConnection("needs-key");
      stopStream();
    }
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
    // Polling cannot see a clear on the daemon, so empty the view right away.
    clearLogs: () => request("DELETE", "/api/logs").then((result) => {
      setLogs([]);
      return result;
    }),
  };

  return {
    connection,
    mode,
    remote,
    keyRejected,
    state,
    logs,
    actions,
    reconnect: connect,
    setAccessKey,
    forgetAccessKey,
  };
}
