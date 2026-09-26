/**
 * Bannière d'ambiance des pages (Accueil, Agenda, Recommandations…) :
 * illustration nocturne (cerisiers en fleurs + lune) posée tout en haut de la
 * page, fondue dans le fond de l'app sans aucune arête visible :
 *  - masque vertical à plusieurs paliers (fondu progressif, pas linéaire) ;
 *  - voile de la couleur de fond (#220c4c = violet-950) qui raccorde les tons ;
 *  - à partir de md, léger voile à gauche pour garder le titre lisible.
 * Un léger boost de saturation garde les couleurs vibrantes.
 *
 * Décor uniquement : aria-hidden, non cliquable. À placer dans un parent
 * `relative`, AVANT le contenu, qui doit lui-même être en `relative z-10`.
 * `position` = object-position de l'image : sur mobile, seule une tranche est
 * visible (cover) ; "92% 25%" garde la lune et cale le ciel sombre à gauche
 * sous le titre.
 */
const MASK =
  "linear-gradient(to bottom, #000 0%, #000 34%, rgba(0,0,0,0.78) 52%, rgba(0,0,0,0.42) 70%, rgba(0,0,0,0.14) 86%, transparent 100%)";

export function PageBanner({ height = "clamp(210px, 30vw, 330px)", position = "92% 25%" }) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 z-0 overflow-hidden"
      style={{ height, WebkitMaskImage: MASK, maskImage: MASK }}>
      <img src="/img/banner.webp" alt="" decoding="async" fetchpriority="high"
        className="w-full h-full object-cover"
        style={{ objectPosition: position, filter: "saturate(1.12) contrast(1.04)" }} />
      {/* raccord des tons avec le fond de page + légère assise en haut (statut iOS, header) */}
      <div className="absolute inset-0"
        style={{ background: "linear-gradient(to bottom, rgba(20,8,60,0.22) 0%, rgba(34,12,76,0) 26%, rgba(34,12,76,0.5) 72%, #220c4c 100%)" }} />
      {/* desktop : la branche rose passe sous le titre → petit voile à gauche */}
      <div className="absolute inset-0 hidden md:block"
        style={{ background: "linear-gradient(90deg, rgba(20,8,60,0.42) 0%, rgba(20,8,60,0) 55%)" }} />
    </div>
  );
}
