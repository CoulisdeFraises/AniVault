import { RARITY, normalizeTier } from "../../utils/waifinity";

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
 * `as` permet de rendre un <button> (ou autre). Le positionnement est laissé
 * à l'appelant (`relative` ou `absolute`), car les ornements sont posés en
 * absolu à l'intérieur.
 */
export function CardFrame({ tier, as: Tag = "div", className = "", style, children, ...rest }) {
  const r = RARITY[normalizeTier(tier)];
  return (
    <Tag
      className={`rounded-xl overflow-hidden border-2 ${r.border} bg-gradient-to-b ${r.tint} ${className}`}
      style={{ boxShadow: r.shine ? `0 0 14px -3px ${r.glow}` : undefined, ...style }}
      {...rest}
    >
      {children}
      {r.ornate !== "none" && (
        <span aria-hidden="true" className={`pointer-events-none absolute inset-[3px] rounded-[9px] border ${r.accent} opacity-60 z-10`} />
      )}
      {r.ornate === "corners" && CORNERS.map((c) => (
        <span key={c} aria-hidden="true" className={`pointer-events-none absolute w-2.5 h-2.5 ${r.accent} z-10 ${c}`} />
      ))}
    </Tag>
  );
}
