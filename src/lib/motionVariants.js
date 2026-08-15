// ── Variants Motion partagés ─────────────────────────────────────────────────
// Centralise les transitions réutilisées par les différents overlays "panneau"
// de l'app (menu long-press de la Card, panneau swipe note/favori, etc.) pour
// garder une sensation cohérente partout, et pour permettre à AnimatePresence
// de jouer une vraie animation de sortie (impossible avec de simples classes
// CSS puisque React démonte l'élément avant qu'une classe d'exit ait pu jouer).
//
// Le réglage système « Réduire les animations » est géré globalement par
// <MotionConfig reducedMotion="user"> dans App.jsx — inutile de le revérifier
// dans les composants qui consomment ces variants.

// Overlay plein-cadre (fond flouté) qui recouvre une carte : menu long-press,
// panneau de notation rapide, etc. Léger scale pour donner une sensation de
// "pop" plutôt qu'un simple fondu plat.
export const CARD_OVERLAY_VARIANTS = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1 },
  exit:    { opacity: 0, scale: 0.97 },
};

export const CARD_OVERLAY_TRANSITION = { duration: 0.18, ease: [0.32, 0.72, 0, 1] };

// Petit badge/CTA qui apparaît par-dessus une carte (ex: "Reprendre ?" sur un
// titre abandonné). Rebond léger façon spring pour attirer l'œil sans être
// agressif.
export const CARD_BADGE_VARIANTS = {
  initial: { opacity: 0, scale: 0.85 },
  animate: { opacity: 1, scale: 1 },
  exit:    { opacity: 0, scale: 0.9 },
};

export const CARD_BADGE_TRANSITION = { type: "spring", bounce: 0.35, duration: 0.35 };
