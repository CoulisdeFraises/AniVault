import { motion } from "motion/react";

/**
 * Onglet d'une barre de filtres segmentée (Tout / Ma liste / …).
 * Pastille active en violet clair (dégradé + halo) — volontairement distincte
 * de l'ambre réservé à la navigation principale (Animes / Séries / Films).
 * `layoutId` doit être unique par barre pour que la pastille glisse d'un
 * onglet à l'autre.
 */
export function FilterTab({ active, onClick, layoutId, children }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`relative flex-1 min-w-0 px-2 py-1.5 rounded-full text-xs font-medium transition-colors active:scale-95 motion-reduce:transition-none whitespace-nowrap ${
        active ? "text-violet-950 font-semibold" : "text-violet-300 hover:bg-white/10"
      }`}
    >
      {active && (
        <motion.span
          layoutId={layoutId}
          className="absolute inset-0 rounded-full bg-gradient-to-b from-violet-200 to-violet-400 shadow-[0_0_14px_rgba(167,139,250,0.5)]"
          transition={{ type: "spring", stiffness: 500, damping: 35 }}
        />
      )}
      <span className="relative z-10">{children}</span>
    </button>
  );
}
