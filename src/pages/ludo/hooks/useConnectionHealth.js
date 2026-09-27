import { useEffect, useRef, useState } from "react";

const PING_INTERVAL_MS = 4000;
const SLOW_AFTER_MS = 3500;
const OFFLINE_GRACE_MS = 800;

/**
 * Whether the online Ludo connection is usable: "offline" once the socket has
 * been down for a moment, "slow" when a ludo:ping round trip takes longer
 * than SLOW_AFTER_MS, otherwise "ok". Latency is only judged once the server
 * has answered a ping, so an older server without the handler never reads as
 * slow.
 */
export const useConnectionHealth = (active, connected, socketRef) => {
  const [health, setHealth] = useState("ok");
  const pendingSinceRef = useRef(null);
  const serverAnswersPingRef = useRef(false);

  useEffect(() => {
    if (!active) {
      setHealth("ok");
      return undefined;
    }
    if (!connected) {
      const timer = setTimeout(() => setHealth("offline"), OFFLINE_GRACE_MS);
      return () => clearTimeout(timer);
    }
    setHealth("ok");
    pendingSinceRef.current = null;
    let disposed = false;
    const ping = () => {
      const socket = socketRef.current;
      if (!socket || !socket.connected || pendingSinceRef.current != null) return;
      const sentAt = Date.now();
      pendingSinceRef.current = sentAt;
      socket.emit("ludo:ping", {}, () => {
        serverAnswersPingRef.current = true;
        if (disposed || pendingSinceRef.current !== sentAt) return;
        pendingSinceRef.current = null;
        setHealth("ok");
      });
    };
    const watch = setInterval(() => {
      const since = pendingSinceRef.current;
      if (serverAnswersPingRef.current && since != null && Date.now() - since > SLOW_AFTER_MS) {
        setHealth("slow");
        if (Date.now() - since > SLOW_AFTER_MS * 2) pendingSinceRef.current = null;
      }
    }, 500);
    ping();
    const pinger = setInterval(ping, PING_INTERVAL_MS);
    return () => {
      disposed = true;
      clearInterval(watch);
      clearInterval(pinger);
    };
  }, [active, connected, socketRef]);

  return health;
};
