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
