import { motion } from "motion/react";

// ── Transition de navigation entre pages ──────────────────────────────────────
// Léger fondu + glissement vertical, dans le même esprit que les autres
// animations d'entrée de l'app (voir animate-fadeInUp dans styles/animations.css)
// mais piloté par Motion pour s'articuler avec AnimatePresence côté App.jsx
// (animation de SORTIE de l'ancienne page avant l'entrée de la nouvelle,
// impossible à obtenir avec de simples classes CSS puisque React démonte
// l'ancien élément avant que la classe d'exit n'ait eu le temps de jouer).
//
// Le réglage système « Réduire les animations » est géré globalement par
// <MotionConfig reducedMotion="user"> dans App.jsx — inutile de le revérifier
// ici, ni dans aucun autre composant Motion de l'app.
const VARIANTS = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit:    { opacity: 0, y: -6 },
};

const TRANSITION = { duration: 0.22, ease: [0.32, 0.72, 0, 1] };

export function PageTransition({ children }) {
  return (
    <motion.div
      variants={VARIANTS}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={TRANSITION}
    >
      {children}
    </motion.div>
  );
}
