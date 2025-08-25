// utils/isMobile.js
import { useState, useEffect } from "react";

const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(window.matchMedia("(max-width: 768px)").matches);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 768px)");
    const listener = (e) => setIsMobile(e.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, []);

  return isMobile;
};

export default useIsMobile;
