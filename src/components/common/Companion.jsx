import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useCompanion } from "../../context/CompanionContext";
import { resolveCompanion } from "./Rating";

// ── Companion — overlay façon visual novel ──────────────────────────────
//
// Semi-bloquant : un fond assombri couvre l'écran, mais un tap n'importe où
// (backdrop ou bulle) fait avancer — un premier tap termine le texte en
// cours de frappe, un second fait passer à la réplique suivante / ferme.
//
// Mise en scène :
//   - le portrait du compagnon actif (voir utils/companions.js) arrive en
//     glissade rapide depuis le bord gauche de l'écran ;
//   - la bulle (/companion-bubble.png) apparaît en fondu rapide PAR-DESSUS
//     le portrait, légèrement décalée vers la droite ;
//   - le texte s'écrit progressivement à l'intérieur de la bulle, comme
//     dans un jeu (effet machine à écrire).
//
// Si le compagnon actif n'a pas de jeu d'images (ex. "Classique" / émojis),
// on n'affiche que la bulle, centrée, sans portrait — rien ne casse
// visuellement en attendant que ce compagnon ait ses propres illustrations.

// Vitesse de la machine à écrire, en ms par caractère.
const TYPE_SPEED_MS = 26;

// Bande d'illustration (0 → 5, même échelle que les images de note) piochée
// selon la catégorie de la réplique, pour que l'expression du compagnon
// corresponde grossièrement à la tonalité du message.
const MOOD_BAND = {
  achievement:  5,
  streakRecord: 5,
  comeback:     4,
  finished:     4,
  newEntry:     3,
  idle:         3,
  streakDanger: 1,
  streakLost:   0,
};

function getCompanionPortrait(category) {
  const companion = resolveCompanion();
  if (!companion?.imageFolder) return null;
  const band = MOOD_BAND[category] ?? 3;
  return `${companion.imageFolder}/rating-${band}.png`;
}

export function Companion() {
  const { current, dismissCompanion } = useCompanion();

  const [shownLength, setShownLength] = useState(0);
  const [isTyping, setIsTyping] = useState(true);

  // Nouvelle réplique → on relance la machine à écrire depuis le début.
  useEffect(() => {
    setShownLength(0);
    setIsTyping(true);
  }, [current?.id]);

  // Fait avancer l'affichage caractère par caractère.
  useEffect(() => {
    if (!current || !isTyping) return;
    if (shownLength >= current.text.length) {
      setIsTyping(false);
      return;
    }
    const t = setTimeout(() => setShownLength((n) => n + 1), TYPE_SPEED_MS);
    return () => clearTimeout(t);
  }, [current, isTyping, shownLength]);

  const portraitSrc = current ? getCompanionPortrait(current.category) : null;

  // Premier tap : termine la frappe en cours. Second tap : ferme / suivant.
  const handleAdvance = () => {
    if (!current) return;
    if (isTyping) {
      setShownLength(current.text.length);
      setIsTyping(false);
    } else {
      dismissCompanion();
    }
  };

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
          onClick={handleAdvance}
          role="button"
          aria-label="Message du compagnon — toucher pour continuer"
        >
          {/* Fond assombri semi-bloquant */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />

          {/* Scène : portrait (derrière) + bulle (devant) */}
          <div
            className={`relative z-10 mb-6 sm:mb-0 w-full max-w-xl sm:max-w-2xl px-5 flex ${
              portraitSrc ? "items-end justify-start" : "items-center justify-center"
            }`}
          >
            {portraitSrc && (
              <motion.img
                src={portraitSrc}
                alt=""
                aria-hidden="true"
                className="relative z-10 w-24 sm:w-36 h-auto shrink-0 pointer-events-none select-none drop-shadow-2xl rounded-xl"
                initial={{ x: "-120%", opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: "-40%", opacity: 0 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                onError={(e) => { e.currentTarget.style.display = "none"; }}
              />
            )}

            {/* Bulle de texte, par-dessus le portrait */}
            <motion.div
              className={`relative z-20 min-w-0 flex-1 ${portraitSrc ? "-ml-6 sm:-ml-10 max-w-md sm:max-w-lg" : "max-w-md sm:max-w-lg"}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12, delay: portraitSrc ? 0.08 : 0 }}
            >
              <div className="relative w-full">
                <img
                  src="/companion-bubble.png"
                  alt=""
                  aria-hidden="true"
                  className="w-full h-auto select-none pointer-events-none drop-shadow-2xl"
                  onError={(e) => { e.currentTarget.style.visibility = "hidden"; }}
                />
                {/* Texte, cadré sur la zone pleine de la bulle */}
                <div
                  className="absolute flex items-center"
                  style={{ left: "23%", right: "20%", top: "33%", bottom: "22%" }}
                >
                  <p
                    className="text-white font-bold text-[11px] sm:text-sm leading-snug"
                    style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                  >
                    {current.text.slice(0, shownLength)}
                    {isTyping && <span className="animate-pulse">▌</span>}
                  </p>
                </div>
              </div>

              <p className="mt-1.5 text-[9px] sm:text-[10px] uppercase tracking-widest text-white/60 text-right pr-1">
                Toucher pour continuer
              </p>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
