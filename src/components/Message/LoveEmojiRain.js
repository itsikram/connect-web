import React, { useEffect, useRef, useState } from "react";
import { LOVE_FALL_EMOJIS } from "../../utils/chatThemes";
import "./LoveEmojiRain.css";

const FLAKE_COUNT = 88;
const BURST_MS = 7200;

const buildFlakes = (burstId, height) => {
  const travel = Math.max(height, 280);
  return Array.from({ length: FLAKE_COUNT }, (_, index) => ({
    id: `${burstId}-${index}`,
    emoji: LOVE_FALL_EMOJIS[index % LOVE_FALL_EMOJIS.length],
    left: Math.random() * 100,
    delay: Math.random() * 1.6,
    duration: 2.6 + Math.random() * 2.4,
    size: 18 + Math.random() * 22,
    drift: `${(Math.random() - 0.5) * 90}px`,
    spin: `${(Math.random() > 0.5 ? 1 : -1) * (160 + Math.random() * 280)}deg`,
    fallFrom: `-${28 + Math.random() * 56}px`,
    fallTo: `${travel + 48 + Math.random() * 56}px`,
    fallMid: `${Math.round(travel * 0.48)}px`,
    sway: `${10 + Math.random() * 18}px`,
  }));
};

const LoveEmojiRain = ({ burstId }) => {
  const overlayRef = useRef(null);
  const [flakes, setFlakes] = useState([]);
  const heightRef = useRef(0);

  useEffect(() => {
    const el = overlayRef.current;
    if (!el) return undefined;

    const measure = () => {
      heightRef.current = el.getBoundingClientRect().height || 0;
    };
    measure();

    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(measure)
        : null;
    if (observer) observer.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("resize", measure);
      if (observer) observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!burstId) return undefined;
    const height =
      heightRef.current ||
      overlayRef.current?.getBoundingClientRect().height ||
      520;
    setFlakes(buildFlakes(burstId, height));
    const timer = window.setTimeout(() => setFlakes([]), BURST_MS);
    return () => window.clearTimeout(timer);
  }, [burstId]);

  return (
    <div ref={overlayRef} className="love-emoji-rain" aria-hidden="true">
      {flakes.map((flake) => (
        <span
          key={flake.id}
          className="love-emoji-flake"
          style={{
            left: `${flake.left}%`,
            fontSize: `${flake.size}px`,
            animationDelay: `${flake.delay}s`,
            animationDuration: `${flake.duration}s`,
            "--drift": flake.drift,
            "--spin": flake.spin,
            "--fall-from": flake.fallFrom,
            "--fall-to": flake.fallTo,
            "--fall-mid": flake.fallMid,
            "--sway": flake.sway,
          }}
        >
          {flake.emoji}
        </span>
      ))}
    </div>
  );
};

export default LoveEmojiRain;
