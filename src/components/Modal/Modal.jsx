import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";

// Sélecteur des éléments focusables standard
const FOCUSABLE = [
  "a[href]", "button:not([disabled])", "textarea:not([disabled])",
  "input:not([disabled])", "select:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(", ");

// ── Animations d'ouverture/fermeture ───────────────────────────────────────
// Le fond s'estompe, le panneau apparaît avec un léger scale + slide-up.
// L'animation de SORTIE (Modal qui se ferme) ne peut pas se faire en CSS pur
// puisque React démonte l'élément instantanément : côté appelant, il faut
// envelopper le rendu conditionnel de <Modal> dans <AnimatePresence> pour que
// ces variantes "exit" aient le temps de jouer avant le démontage réel.
const BACKDROP_VARIANTS = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit:    { opacity: 0 },
};

const PANEL_VARIANTS = {
  initial: { opacity: 0, scale: 0.94, y: 14 },
  animate: { opacity: 1, scale: 1,    y: 0  },
  exit:    { opacity: 0, scale: 0.96, y: 8   },
};

const BACKDROP_TRANSITION = { duration: 0.18, ease: "easeOut" };
const PANEL_TRANSITION    = { type: "spring", bounce: 0.18, duration: 0.32 };

// -----------------------------------------------------------------------------
// Modal — rendu via createPortal directement dans document.body.
//
// Le sticky header utilise backdrop-blur-md qui crée un contexte d'empilement
// CSS indépendant. createPortal place la modale directement sous <body>,
// hors de tout contexte d'empilement parent, et garantit qu'elle recouvre
// toujours l'intégralité de l'écran.
//
// AJOUTS :
//   • Focus trap : Tab/Shift+Tab cyclent dans la modale uniquement.
//   • Escape ferme la modale.
//   • Focus automatique sur le premier élément à l'ouverture.
//   • Restauration du focus à l'élément déclencheur à la fermeture.
// -----------------------------------------------------------------------------
export function Modal({ onClose, maxWidth = "max-w-lg", zIndex = "z-50", children }) {
  const innerRef = useRef(null);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const prevFocus = document.activeElement;
    const el = innerRef.current;

    // Focus automatique sur le premier élément focusable
    const t = setTimeout(() => {
      const first = el?.querySelectorAll(FOCUSABLE)?.[0];
      first?.focus();
    }, 30);

    function handleKeyDown(e) {
      if (e.key === "Escape") { onClose?.(); return; }
      if (e.key !== "Tab" || !el) return;

      const all   = [...el.querySelectorAll(FOCUSABLE)];
      const first = all[0];
      const last  = all[all.length - 1];
      if (!first) return;

      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last?.focus(); }
      } else {
        if (document.activeElement === last)  { e.preventDefault(); first?.focus(); }
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      clearTimeout(t);
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      if (prevFocus && typeof prevFocus.focus === "function") prevFocus.focus();
    };
  }, [onClose]);

  return createPortal(
    <motion.div
      variants={BACKDROP_VARIANTS}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={BACKDROP_TRANSITION}
      className={`fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 ${zIndex}`}
      onClick={onClose}
    >
      <motion.div
        ref={innerRef}
        variants={PANEL_VARIANTS}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={PANEL_TRANSITION}
        onClick={(e) => e.stopPropagation()}
        className={`bg-violet-900 border border-white/10 rounded-2xl w-full ${maxWidth} max-h-[90vh] overflow-y-auto`}
      >
        {children}
      </motion.div>
    </motion.div>,
    document.body
  );
}

export function ConfirmDialog({
  icon, tone = "rose", title, description,
  confirmLabel = "Confirmer", cancelLabel = "Annuler",
  onConfirm, onCancel,
}) {
  const toneClasses = tone === "amber"
    ? { bg: "bg-amber-400/20", btn: "bg-amber-400 text-violet-950 hover:bg-amber-300" }
    : { bg: "bg-rose-500/20",  btn: "bg-rose-500 text-white hover:bg-rose-400" };

  return (
    <Modal onClose={onCancel} maxWidth="max-w-xs" zIndex="z-[70]">
      <div className="p-5">
        <div className="flex items-start gap-3 mb-4">
          <div className={`w-8 h-8 rounded-full ${toneClasses.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
            {icon}
          </div>
          <div>
            <h3 className="font-semibold text-violet-50 mb-1" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              {title}
            </h3>
            <p className="text-sm text-violet-300">{description}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={onCancel}
            className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-white/10 text-violet-200 hover:bg-white/20">
            {cancelLabel}
          </button>
          <button onClick={onConfirm}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium ${toneClasses.btn}`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
