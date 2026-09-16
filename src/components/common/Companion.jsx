import { AnimatePresence, motion } from "motion/react";
import { useCompanion } from "../../context/CompanionContext";

// ── Companion — overlay façon visual novel ──────────────────────────────
//
// Semi-bloquant : un fond assombri couvre l'écran, mais un tap n'importe où
// (backdrop ou bulle) fait avancer/fermer la réplique — pas de piège modal,
// pas de bouton "fermer" obligatoire à chercher.
//
// Le sprite du compagnon (/companion-character.png) et le cadre de la bulle
// (/companion-bubble.png) sont des placeholders : dépose les vrais fichiers
// dans /public à ces noms, ou change les chemins ci-dessous. Tant que les
// images n'existent pas, la bulle retombe sur un style CSS uni (voir
// onError plus bas) — rien ne casse visuellement en attendant.

export function Companion() {
  const { current, dismissCompanion } = useCompanion();

  return (
    <AnimatePresence>
      {current && (
        <motion.div
          key={current.id}
          className="fixed inset-0 z-[300] flex flex-col items-center justify-end sm:justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={dismissCompanion}
          role="button"
          aria-label="Fermer le message du compagnon"
        >
          {/* Fond assombri semi-bloquant */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />

          {/* Sprite du compagnon */}
          <motion.img
            src="/companion-character.png"
            alt=""
            className="relative z-10 w-40 sm:w-56 h-auto mb-[-8px] pointer-events-none select-none drop-shadow-2xl"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
            onError={(e) => { e.currentTarget.style.display = "none"; }}
          />

          {/* Bulle de texte */}
          <motion.div
            className="
              relative z-10 mb-6 sm:mb-10 mx-6 max-w-sm sm:max-w-md
              rounded-2xl border border-violet-400/30 bg-violet-900/95
              shadow-2xl shadow-violet-950/60 px-5 py-4
            "
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 24, delay: 0.05 }}
          >
            <p
              className="text-sm sm:text-base text-violet-50 leading-snug"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              {current.text}
            </p>
            <p className="mt-2 text-[10px] uppercase tracking-widest text-violet-400/70 text-right">
              Toucher pour continuer
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
