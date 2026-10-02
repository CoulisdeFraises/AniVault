import { RARITY, normalizeTier } from "../../utils/waifinity";
import { resolveCosmetic } from "../../utils/waifinityCosmetics";

const CORNERS = [
  "top-1 left-1 border-t-2 border-l-2 rounded-tl-md",
  "top-1 right-1 border-t-2 border-r-2 rounded-tr-md",
  "bottom-1 left-1 border-b-2 border-l-2 rounded-bl-md",
  "bottom-1 right-1 border-b-2 border-r-2 rounded-br-md",
];

/**
 * Cadre d'une carte de personnage, commun à la collection, l'explorateur et
 * les boosters : fond dégradé à la teinte de la rareté, bordure du palier,
 * puis — selon RARITY[tier].ornate — une seconde bordure fine (Epic) ou
 * seconde bordure + coins ornés (Legendary / Secret).
 *
 * `cosmetic` ({ frame, effect } = ids de cosmétiques équipés, voir
 * utils/waifinityCosmetics.js) personnalise la carte : un cadre remplace la
 * bordure et le halo de la rareté, un effet ajoute un calque animé par-dessus
 * l'illustration. Sans `cosmetic`, rendu strictement identique à avant.
 *
 * `as` permet de rendre un <button> (ou autre). Le positionnement est laissé
 * à l'appelant (`relative` ou `absolute`), car les ornements sont posés en
 * absolu à l'intérieur.
 */
export function CardFrame({ tier, as: Tag = "div", className = "", style, cosmetic, children, ...rest }) {
  const r = RARITY[normalizeTier(tier)];
  const { frame, effect } = resolveCosmetic(cosmetic);

  const frameStyle = frame ? { borderColor: frame.color, boxShadow: `0 0 18px -2px ${frame.glow}` } : null;
  const showRarityOrnament = !frame && r.ornate !== "none";

  return (
    <Tag
      className={`rounded-xl overflow-hidden border-2 ${r.border} bg-gradient-to-b ${r.tint} ${frame?.className || ""} ${className}`}
      style={{ boxShadow: r.shine ? `0 0 14px -3px ${r.glow}` : undefined, ...style, ...frameStyle }}
      {...rest}
    >
      {children}
      {effect && <span aria-hidden="true" className={`cos-fx ${effect.className}`} />}
      {showRarityOrnament && (
        <span aria-hidden="true" className={`pointer-events-none absolute inset-[3px] rounded-[9px] border ${r.accent} opacity-60 z-10`} />
      )}
      {showRarityOrnament && r.ornate === "corners" && CORNERS.map((c) => (
        <span key={c} aria-hidden="true" className={`pointer-events-none absolute w-2.5 h-2.5 ${r.accent} z-10 ${c}`} />
      ))}
      {frame && (
        <span aria-hidden="true" className="pointer-events-none absolute inset-[3px] rounded-[9px] border opacity-70 z-10"
          style={{ borderColor: frame.accent }} />
      )}
      {frame?.corners && CORNERS.map((c) => (
        <span key={c} aria-hidden="true" className={`pointer-events-none absolute w-2.5 h-2.5 z-10 ${c}`}
          style={{ borderColor: frame.accent }} />
      ))}
    </Tag>
  );
}
