import { useMemo } from "react";
import { motion } from "motion/react";

// ── Effets partagés de l'ouverture de booster ───────────────────────────────
// Trois briques, utilisées par PackOpening (suspense, fond) et PackDeck
// (révélation) pour que tout le parcours parle le même langage visuel :
//  • Embers    : braises qui montent doucement, l'ambiance de fond ;
//  • Rays      : rayons tournants, réservés aux paliers Legendary / Secret ;
//  • Shockwave : onde de choc circulaire, au déchirement du sachet et à la
//                révélation d'une carte Epic ou mieux.
// Tout est décoratif (aria-hidden, sans interaction) et désactivé par
// prefers-reduced-motion (règles CSS dans animations.css, ou rien de rendu).

/** Braises : positions déterministes (pas de Math.random, donc pas de saut entre deux rendus). */
export function Embers({ color = "rgba(253,230,138,0.9)", count = 16 }) {
  const items = useMemo(
    () => Array.from({ length: count }, (_, i) => ({
      left: `${(i * 53 + 7) % 100}%`,
      size: 2 + ((i * 7) % 4),
      dur: 7 + ((i * 13) % 6),
      delay: -((i * 37) % 11),
    })),
    [count],
  );
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {items.map((p, i) => (
        <span
          key={i}
          className="pack-ember"
          style={{
            left: p.left, width: p.size, height: p.size, background: color, boxShadow: `0 0 8px ${color}`,
            "--dur": `${p.dur}s`, "--delay": `${p.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

/** Rayons tournants derrière la scène. `delay` : apparition en fondu, calée sur le retournement. */
export function Rays({ color, delay = 0, opacity = 0.28 }) {
  const mask = "radial-gradient(circle, black 0%, transparent 58%)";
  return (
    <motion.div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity }}
      transition={{ delay, duration: 0.9 }}
    >
      <div
        className="rays absolute left-1/2 top-1/2 h-[130vmax] w-[130vmax]"
        style={{
          background: `repeating-conic-gradient(from 0deg, ${color} 0deg 7deg, transparent 7deg 22deg)`,
          WebkitMaskImage: mask,
          maskImage: mask,
        }}
      />
    </motion.div>
  );
}

/** Onde de choc : un anneau lumineux qui s'élargit et s'efface. Centré sur son parent. */
export function Shockwave({ color, delay = 0, size = "20rem" }) {
  return (
    <motion.span
      aria-hidden="true"
      className="pointer-events-none absolute left-1/2 top-1/2 rounded-full border-2"
      style={{ width: size, height: size, x: "-50%", y: "-50%", borderColor: color, boxShadow: `0 0 28px ${color}, inset 0 0 28px ${color}` }}
      initial={{ scale: 0.15, opacity: 0.9 }}
      animate={{ scale: 1.7, opacity: 0 }}
      transition={{ duration: 0.75, delay, ease: "easeOut" }}
    />
  );
}
