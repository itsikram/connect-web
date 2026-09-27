import { useEffect, useState } from "react";

const readOnline = () =>
  typeof navigator === "undefined" || navigator.onLine !== false;

/** Tracks navigator.onLine, updating on the window online/offline events. */
const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = useState(readOnline);

  useEffect(() => {
    const update = () => setIsOnline(readOnline());
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  return isOnline;
};

export default useOnlineStatus;
