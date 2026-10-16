import { useCallback, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { getSocketUrl } from "../../../utils/offlineUtils";
import { getUserFromStorage } from "../../../utils/storageUtils";

// The access token the REST API uses; the server takes the socket's identity
// from it. Read on every (re)connect so a refreshed token is used.
const readStoredToken = () => {
  const token = getUserFromStorage()?.accessToken;
  return token ? String(token) : null;
};

const socketBaseUrl = () => {
  try {
    return getSocketUrl().replace(/\/$/, "");
  } catch (_e) {
    return window.location.origin;
  }
};

/**
 * The Ludo page's own socket. Exposes `request(event, payload)` which resolves
 * with the server's acknowledgement (or a timeout error).
 */
export const useLudoSocket = (profileId) => {
  const socketRef = useRef(null);
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!profileId) return undefined;
    const s = io(socketBaseUrl(), {
      transports: ["websocket", "polling"],
      path: "/socket.io",
      query: { profile: profileId },
      auth: (cb) => cb({ profile: profileId, token: readStoredToken() }),
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      withCredentials: true,
    });
    socketRef.current = s;
    setSocket(s);
    setConnected(s.connected);
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    // The server refused the connection (e.g. an expired token): socket.io
    // doesn't retry that by itself; API calls refresh the token meanwhile.
    let retryTimer = null;
    const onConnectError = (err) => {
      if (!err?.data || err.type === "TransportError") return;
      clearTimeout(retryTimer);
      retryTimer = setTimeout(() => {
        if (!s.connected) s.connect();
      }, 5000);
    };
    s.on("connect", onConnect);
    s.on("disconnect", onDisconnect);
    s.on("connect_error", onConnectError);
    return () => {
      clearTimeout(retryTimer);
      s.off("connect", onConnect);
      s.off("disconnect", onDisconnect);
      s.off("connect_error", onConnectError);
      s.close();
      socketRef.current = null;
      setSocket(null);
      setConnected(false);
    };
  }, [profileId]);

  const request = useCallback(
    (event, payload = {}, timeoutMs = 12000) =>
      new Promise((resolve) => {
        const s = socketRef.current;
        if (!s) {
          resolve({ ok: false, error: "offline", message: "Not connected." });
          return;
        }
        let settled = false;
        const timer = setTimeout(() => {
          if (settled) return;
          settled = true;
          resolve({
            ok: false,
            error: "timeout",
            message: "The game server didn't answer. Check your connection.",
          });
        }, timeoutMs);
        s.emit(event, payload, (result) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve(result || { ok: false, error: "empty" });
        });
      }),
    [],
  );

  return { socket, socketRef, connected, request };
};
