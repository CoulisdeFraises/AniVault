/**
 * Bannière du haut de l'accueil : illustration nocturne (lune, pagode,
 * cerisiers) fondue dans le fond de l'app — masque vertical + dégradé de la
 * couleur de fond (#220c4c = violet-950), donc aucune limite visible.
 * Décor uniquement : ignoré par les lecteurs d'écran et non cliquable.
 */
export function HomeBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[250px] overflow-hidden"
      style={{
        WebkitMaskImage: "linear-gradient(to bottom, #000 0%, #000 40%, transparent 100%)",
        maskImage:       "linear-gradient(to bottom, #000 0%, #000 40%, transparent 100%)",
      }}>
      <img src="/img/home-header.webp" alt="" decoding="async" fetchpriority="high"
        className="w-full h-full object-cover" style={{ objectPosition: "76% 30%" }} />
      {/* assombrit légèrement le haut (lisibilité du logo) puis raccorde au fond */}
      <div className="absolute inset-0"
        style={{ background: "linear-gradient(to bottom, rgba(20,8,50,0.38) 0%, rgba(34,12,76,0) 38%, rgba(34,12,76,0.85) 92%, #220c4c 100%)" }} />
    </div>
  );
}
