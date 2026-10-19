import { useRef, useEffect } from "react";

// ── Texte à défilement automatique ──────────────────────────────────────────
//
// Tant que le texte tient dans son conteneur, il s'affiche normalement. S'il est
// trop long, il se déroule vers la gauche pour qu'on puisse le lire en entier,
// puis revient vite au début.
//
// Conçu pour rester fluide même avec des dizaines de textes à l'écran (grilles
// de cartes) : un SEUL moteur partagé gère tous les composants.
//   • un seul ResizeObserver et un seul IntersectionObserver pour tous les textes ;
//   • aucun état React : pas de re-rendu, la mesure et l'animation passent par le DOM ;
//   • seuls les textes VISIBLES à l'écran s'animent ;
//   • au plus MAX_ACTIVE défilements en même temps : chaque texte fait UN cycle,
//     libère sa place, puis fait la queue pour le suivant (tour de rôle) ;
//   • animation Web Animations sur `transform` seul (composité par le GPU),
//     sans masque ni will-change permanent, qui coûtent cher sur mobile.
//
// Cycle d'un texte : pause courte → défilement à vitesse constante → pause courte → retour rapide.
// Le temps total reste borné, même pour un titre très long (la vitesse augmente un peu).
//
// Avec « réduire les animations » activé : pas de défilement, le texte est coupé par une ellipse.
//
// Usage : <MarqueeText>Titre très long…</MarqueeText>
//   `className`       → classes du conteneur (couleurs, taille de texte, hauteur…).
//                       Pas de padding horizontal ici : il fausserait la mesure et le texte
//                       défilerait dans la marge. Mettre l'espace réservé sur un parent.
//   `innerClassName`  → classes du contenu défilant (ex. « inline-flex gap-1 » pour une rangée de pastilles)

const MAX_ACTIVE = 4;        // défilements simultanés maximum (toute l'app)
const HOLD_START_MS = 1200;  // pause au début, avant de lire
const HOLD_END_MS = 900;     // pause à la fin, pour finir de lire
const BACK_MS = 650;         // retour rapide au début
const BASE_SPEED = 24;       // px/s : lent et confortable pour un texte court…
const MAX_SCROLL_MS = 6500;  // …mais le défilement ne dépasse jamais cette durée (la vitesse s'adapte)
const END_PAD_PX = 6;        // marge à la fin pour que la dernière lettre ne colle pas au bord
const REST_MIN_MS = 1200;    // repos entre deux cycles d'un même texte (aléatoire pour désynchroniser)
const REST_RANGE_MS = 2500;

const entries = new Map();   // box → entry
const waiting = [];          // file d'attente FIFO des textes prêts à défiler
let active = 0;
let ro = null;
let io = null;
let fontsHooked = false;

const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

function removeFromQueue(entry) {
  const i = waiting.indexOf(entry);
  if (i >= 0) waiting.splice(i, 1);
  entry.queued = false;
}

function stop(entry) {
  clearTimeout(entry.timer);
  entry.timer = 0;
  removeFromQueue(entry);
  if (entry.anim) {
    const a = entry.anim;
    entry.anim = null;
    a.onfinish = null;
    a.oncancel = null;
    a.cancel();
    active = Math.max(0, active - 1);
  }
}

function canRun(entry) {
  return entry.overflow && entry.visible && !entry.reduced;
}

/** Met l'entrée en file d'attente après `delay` ms. */
function schedule(entry, delay) {
  clearTimeout(entry.timer);
  entry.timer = setTimeout(() => {
    entry.timer = 0;
    if (!canRun(entry) || entry.anim || entry.queued) return;
    entry.queued = true;
    waiting.push(entry);
    pump();
  }, delay);
}

function start(entry) {
  const { inner, dist } = entry;
  const scrollMs = Math.max(900, Math.min((dist / BASE_SPEED) * 1000, MAX_SCROLL_MS));
  const total = HOLD_START_MS + scrollMs + HOLD_END_MS + BACK_MS;
  const a = HOLD_START_MS / total;
  const b = (HOLD_START_MS + scrollMs) / total;
  const c = (HOLD_START_MS + scrollMs + HOLD_END_MS) / total;
  const home = "translate3d(0,0,0)";
  const far = `translate3d(${-dist}px,0,0)`;

  let anim;
  try {
    anim = inner.animate(
      [
        { transform: home, offset: 0, easing: "linear" },
        { transform: home, offset: a, easing: "linear" },
        { transform: far, offset: b, easing: "linear" },
        { transform: far, offset: c, easing: "ease-in-out" },
        { transform: home, offset: 1 },
      ],
      { duration: total, iterations: 1 }
    );
  } catch {
    return; // navigateur sans Web Animations : le texte reste simplement coupé
  }
  entry.anim = anim;
  active += 1;

  const release = () => {
    if (entry.anim !== anim) return;
    entry.anim = null;
    active = Math.max(0, active - 1);
    if (entries.has(entry.box) && canRun(entry)) schedule(entry, REST_MIN_MS + Math.random() * REST_RANGE_MS);
    pump();
  };
  anim.onfinish = release;
  anim.oncancel = release;
}

function pump() {
  while (active < MAX_ACTIVE && waiting.length) {
    const entry = waiting.shift();
    entry.queued = false;
    if (entries.has(entry.box) && canRun(entry) && !entry.anim) start(entry);
  }
}

function measure(entry) {
  const { box, text } = entry;
  // scrollWidth (et non offsetWidth) : en mode « réduire les animations » le texte passe en
  // display:block coupé par une ellipse, et sa largeur visible ne reflèterait plus son contenu.
  const natural = Math.max(text.scrollWidth, text.offsetWidth);
  const over = natural - box.clientWidth;
  const overflow = over > 1;
  const dist = overflow ? Math.ceil(over) + END_PAD_PX : 0;
  entry.reduced = reducedMotion();

  if (overflow) box.setAttribute("data-overflow", "1"); else box.removeAttribute("data-overflow");
  if (entry.reduced && overflow) box.setAttribute("data-static", "1"); else box.removeAttribute("data-static");

  const changed = overflow !== entry.overflow || Math.abs(dist - entry.dist) > 1;
  entry.overflow = overflow;
  entry.dist = dist;
  if (!changed) return;

  stop(entry); // la distance a changé : on repart proprement
  if (canRun(entry)) schedule(entry, Math.random() * 1200);
}

function ensureObservers() {
  if (!ro && typeof ResizeObserver !== "undefined") {
    ro = new ResizeObserver((records) => {
      const seen = new Set();
      for (const r of records) {
        const e = entries.get(r.target) || entries.get(r.target.parentElement);
        if (e && !seen.has(e)) { seen.add(e); measure(e); }
      }
    });
  }
  if (!io && typeof IntersectionObserver !== "undefined") {
    io = new IntersectionObserver((records) => {
      for (const r of records) {
        const e = entries.get(r.target);
        if (!e) continue;
        e.visible = r.isIntersecting;
        if (!e.visible) stop(e);
        else if (canRun(e) && !e.anim && !e.queued) schedule(e, Math.random() * 1200);
      }
    }, { rootMargin: "40px" });
  }
  // Les polices web arrivent parfois après le premier rendu : on remesure une fois.
  if (!fontsHooked && typeof document !== "undefined" && document.fonts?.ready) {
    fontsHooked = true;
    document.fonts.ready.then(() => entries.forEach(measure));
  }
}

function register(box, text) {
  ensureObservers();
  const entry = {
    box, text, inner: text, dist: 0, overflow: false,
    visible: !io, // sans IntersectionObserver : on considère tout visible
    reduced: reducedMotion(), anim: null, timer: 0, queued: false,
  };
  entries.set(box, entry);
  ro?.observe(box);
  ro?.observe(text);
  io?.observe(box);
  measure(entry);
  return () => {
    stop(entry);
    entries.delete(box);
    ro?.unobserve(box);
    ro?.unobserve(text);
    io?.unobserve(box);
    pump();
  };
}

export function MarqueeText({ children, as: Tag = "span", className = "", innerClassName = "", ...rest }) {
  const boxRef = useRef(null);
  const textRef = useRef(null);

  // Enregistré une seule fois : le ResizeObserver détecte tout changement de contenu.
  useEffect(() => {
    if (!boxRef.current || !textRef.current) return undefined;
    return register(boxRef.current, textRef.current);
  }, []);

  return (
    <Tag
      ref={boxRef}
      data-marquee=""
      className={`block min-w-0 overflow-hidden whitespace-nowrap ${className}`}
      {...rest}
    >
      <span ref={textRef} className={`${innerClassName || "inline-block"} align-top`}>
        {children}
      </span>
    </Tag>
  );
}
