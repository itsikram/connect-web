import React from "react";

/**
 * Comic-style pop-ups drawn over the board: a big caption ("BONK!", "SIX!")
 * plus a ring of emoji particles that fly outward. Each burst removes itself
 * via onDone once its animation ends.
 */
const FunFxLayer = ({ bursts, onDone }) => {
  if (!bursts.length) return null;
  return (
    <div className="ludo-fx-layer" aria-hidden="true">
      {bursts.map((burst) => (
        <div
          key={burst.id}
          className={`ludo-fx-burst ludo-fx-${burst.kind}`}
          style={{ "--fx-color": burst.color }}
          onAnimationEnd={(e) => {
            if (e.target === e.currentTarget) onDone(burst.id);
          }}
        >
          <span className="ludo-fx-caption">{burst.text}</span>
          {burst.particles.map((p, i) => (
            <span
              key={i}
              className="ludo-fx-particle"
              style={{
                "--fx-dx": `${p.dx}px`,
                "--fx-dy": `${p.dy}px`,
                "--fx-rot": `${p.rot}deg`,
                animationDelay: `${p.delay}ms`,
              }}
            >
              {p.emoji}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
};

export const FX_PRESETS = {
  capture: {
    texts: ["BONK!", "POW!", "Gotcha!", "Back home! 😂", "WHAM!"],
    emojis: ["💥", "⭐", "😵", "💫", "🤕"],
    color: "#ff4d4f",
  },
  rolledSix: {
    texts: ["SIX! 🎲", "Lucky 6!", "Boom, six!", "Roll again!"],
    emojis: ["✨", "🎲", "⭐", "🔥"],
    color: "#faad14",
  },
  threeSixes: {
    texts: ["Three sixes?! 😵", "Too lucky! Turn over", "Oops! 🙈"],
    emojis: ["😭", "🙈", "💀", "🥲"],
    color: "#8c8c8c",
  },
  pieceOut: {
    texts: ["Let's go! 🚀", "Out it comes!", "Zoom!"],
    emojis: ["🚀", "💨", "✨"],
    color: "#2ec4b6",
  },
  win: {
    texts: ["WINNER! 🏆", "Champion! 👑", "Victory! 🎉"],
    emojis: ["🎉", "🏆", "🎊", "👑", "🥳", "⭐"],
    color: "#52c41a",
  },
};

const pick = (list) => list[Math.floor(Math.random() * list.length)];

export const createBurst = (kind) => {
  const preset = FX_PRESETS[kind];
  if (!preset) return null;
  const count = kind === "win" ? 14 : 8;
  const radius = kind === "win" ? 150 : 95;
  const particles = Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
    const r = radius * (0.7 + Math.random() * 0.5);
    return {
      emoji: pick(preset.emojis),
      dx: Math.round(Math.cos(angle) * r),
      dy: Math.round(Math.sin(angle) * r),
      rot: Math.round((Math.random() - 0.5) * 540),
      delay: Math.round(Math.random() * 120),
    };
  });
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    kind,
    text: pick(preset.texts),
    color: preset.color,
    particles,
  };
};

export default FunFxLayer;
