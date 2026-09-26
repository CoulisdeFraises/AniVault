/**
 * Bulles décoratives statiques en haut des pages Calendrier : deux grands
 * halos flous + quelques bulles "verre" de tailles variées. Aucune animation.
 * Fondu vers le bas (masque) pour se raccorder au fond de la page.
 * Décor uniquement : aria-hidden, non cliquable, derrière le contenu (z-0 —
 * le contenu doit être en `relative z-10`).
 */

// [top, left|right, taille px, opacité] — positions volontairement asymétriques.
const BUBBLES = [
  { top: 70,  left:  "8%",  size: 46, o: 0.55 },
  { top: 150, left:  "22%", size: 18, o: 0.45 },
  { top: 44,  right: "24%", size: 26, o: 0.5  },
  { top: 118, right: "9%",  size: 62, o: 0.6  },
  { top: 210, right: "30%", size: 14, o: 0.4  },
];

export function CalendarBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[340px] z-0 overflow-hidden"
      style={{
        WebkitMaskImage: "linear-gradient(to bottom, #000 0%, #000 55%, transparent 100%)",
        maskImage:       "linear-gradient(to bottom, #000 0%, #000 55%, transparent 100%)",
      }}>
      {/* grands halos flous */}
      <div className="absolute -top-24 -left-20 w-72 h-72 rounded-full bg-violet-500/25 blur-3xl" />
      <div className="absolute -top-16 -right-24 w-64 h-64 rounded-full bg-fuchsia-500/15 blur-3xl" />
      <div className="absolute top-40 left-1/3 w-52 h-52 rounded-full bg-indigo-500/15 blur-3xl" />

      {/* bulles "verre" */}
      {BUBBLES.map((b, i) => (
        <span key={i} className="absolute rounded-full border border-white/15 bg-gradient-to-br from-violet-200/25 to-violet-500/5"
          style={{ top: b.top, left: b.left, right: b.right, width: b.size, height: b.size, opacity: b.o,
            boxShadow: "inset 0 0 12px rgba(196,181,253,0.18)" }} />
      ))}
    </div>
  );
}
