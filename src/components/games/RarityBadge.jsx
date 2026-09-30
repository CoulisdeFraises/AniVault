import { RARITY, normalizeTier } from "../../utils/waifinity";

/** Pastille de rareté (dégradé de la couleur du palier). */
export function RarityBadge({ tier, size = "sm" }) {
  const r = RARITY[normalizeTier(tier)];
  const cls = size === "sm"
    ? "text-[8.5px] px-1.5 py-0.5"
    : "text-[10px] px-2 py-0.5";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-mono font-bold uppercase tracking-wide text-white bg-gradient-to-r ${r.grad} ${cls}`}>
      {r.label}
    </span>
  );
}

const DOT = {
  common: "bg-slate-300", uncommon: "bg-emerald-400", rare: "bg-sky-400",
  epic: "bg-fuchsia-400", legendary: "bg-amber-300", secret: "bg-rose-500",
};

/** Pastille pleine à la couleur du palier — remplace les emojis colorés (rendu identique sur tous les appareils). */
export function RarityDot({ tier, size = 8, className = "" }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block flex-shrink-0 rounded-full ${DOT[normalizeTier(tier)]} ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
