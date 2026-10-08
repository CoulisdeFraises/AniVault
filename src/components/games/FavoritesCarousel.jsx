import { useCallback, useEffect, useRef, useState } from "react";
import { animate, motion, useMotionValue, useMotionValueEvent, useReducedMotion, useTransform } from "motion/react";
import { Heart, ChevronLeft, ChevronRight } from "lucide-react";
import { RARITY, normalizeTier } from "../../utils/waifinity";
import { haptics } from "../../utils/haptics";
import { resolveCosmetic } from "../../utils/waifinityCosmetics";
import { RarityBadge } from "./RarityBadge";
import { CardFrame } from "./CardFrame";

// ── FavoritesCarousel — coverflow serré, cartes qui se retournent ──────────
//
// La carte du milieu est de face. De chaque côté, les voisines sont de DOS,
// inclinées vers le centre et serrées les unes contre les autres (la plus proche
// passe un peu sous la carte centrale). En glissant — ou en touchant une voisine,
// avec les flèches, les points, le clavier — la carte qui arrive au centre SE
// RETOURNE pour montrer sa face, pendant que l'ancienne se retourne de dos et
// part de l'autre côté.
//
// Tout est piloté par une seule valeur continue `p` (position fractionnaire dans
// la liste) : chaque carte déduit sa place, son angle et son ombre de
// `d = index − p`, donc le geste suit le doigt, et au relâchement la pile se cale
// en ressort sur la carte la plus proche en tenant compte de l'élan.
//
// Props :
//  • `items`    favoris dans l'ordre d'affichage ;
//  • `equipped` ({ [id]: { frame, effect } }) cosmétiques équipés ;
//  • `onOpen(id)`  toucher la carte centrale ; sans lui, lecture seule
//    (vitrine d'un autre joueur) ;
//  • `onLongPress(id)`  appui long (~0,45 s, sans bouger) ou clic droit sur la
//    carte centrale — menu de réorganisation ;
//  • `focusId` + `focusToken`  à chaque changement du token, se centre sur `focusId`.
//
// « Réduire les animations » : plus d'inclinaison ni de retournement, les cartes
// restent de face et seule la position change.

const CARD_W = 176;          // largeur de la carte, px (ratio 3/4)
const CARD_H = (CARD_W * 4) / 3;
const PAN_PX = 85;           // px de glissé pour avancer d'une carte
const SIDE = 3;              // nombre de cartes visibles de chaque côté
const TILT = 45;             // inclinaison des voisines, degrés
const LONG_PRESS_MS = 450;
const LONG_PRESS_SLOP = 10;  // px tolérés avant d'annuler l'appui long
const SPRING = { type: "spring", stiffness: 190, damping: 24, mass: 0.85 };

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Courbes d'espacement : un grand saut entre le centre et la 1re voisine, puis
// les suivantes très serrées.
const D_KEYS  = [-3, -2, -1, 0, 1, 2, 3];
const X_KEYS  = [-182, -150, -112, 0, 112, 150, 182];
const S_KEYS  = [0.74, 0.8, 0.88, 1, 0.88, 0.8, 0.74];

/** Dos de carte, avec un fin liseré à la couleur de la rareté (indice discret). */
function CardBack({ glow }) {
  return (
    <div
      className="absolute inset-0 rounded-xl overflow-hidden bg-gradient-to-br from-violet-700 via-violet-900 to-violet-950 border"
      style={{ borderColor: glow, boxShadow: `inset 0 1px 0 rgba(255,255,255,0.14), 0 10px 24px -12px ${glow}` }}
    >
      <div className="absolute inset-0 opacity-25" style={{ backgroundImage: "radial-gradient(circle at 28% 18%, white, transparent 45%)" }} />
      <div className="absolute inset-2 rounded-lg border border-amber-300/25" />
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full border border-pink-300/30 bg-gradient-to-b from-pink-400/20 to-fuchsia-500/10">
          <Heart size={22} className="text-pink-300/70" fill="currentColor" />
        </span>
      </div>
    </div>
  );
}

/** Une carte. Toute son apparence découle de `p` (position fractionnaire dans la liste). */
function Leaf({ item, i, p, reduce, equipped, isActive, onTap }) {
  const r = RARITY[normalizeTier(item.tier)];
  const d = useTransform(p, (v) => i - v); // 0 = au centre ; < 0 = à gauche ; > 0 = à droite

  // Enveloppe externe : empilement, fondu en bout de pile, assombrissement.
  // (L'opacité et le filtre restent ici pour ne pas aplatir la 3D de la carte interne.)
  const zIndex  = useTransform(d, (v) => 100 - Math.round(Math.abs(v) * 10));
  const opacity = useTransform(d, [-SIDE - 0.6, -SIDE, SIDE, SIDE + 0.6], [0, 1, 1, 0]);
  const filter  = useTransform(d, [-SIDE, -1, 0, 1, SIDE],
    reduce ? Array(5).fill("brightness(1)")
           : ["brightness(0.45)", "brightness(0.66)", "brightness(1)", "brightness(0.66)", "brightness(0.45)"]);

  // Carte interne. Angle total = inclinaison + retournement : à d = ±1 la carte est
  // de dos (|angle| > 90°) et penchée de TILT° vers le centre ; elle passe de face à
  // dos en traversant 90°, donc la face change à mi-chemin du déplacement.
  const rotateY = useTransform(d, [-1, 0, 1], reduce ? [0, 0, 0] : [180 + TILT, 0, -(180 + TILT)]);
  const x       = useTransform(d, D_KEYS, reduce ? D_KEYS.map((k) => k * 70) : X_KEYS);
  const scale   = useTransform(d, D_KEYS, reduce ? Array(7).fill(1) : S_KEYS);
  // Reflet qui balaie la face pendant le retournement.
  const sheen   = useTransform(d, [-0.6, -0.3, 0, 0.3, 0.6], reduce ? Array(5).fill(0) : [0, 0.4, 0, 0.4, 0]);

  const frameGlow = resolveCosmetic(equipped?.[item.id]).frame?.glow || r.glow;

  return (
    <motion.div
      data-leaf={i}
      className="absolute inset-0 [perspective:1100px]"
      style={{ zIndex, opacity, filter }}
    >
      <motion.div
        className="relative h-full w-full [transform-style:preserve-3d] will-change-transform"
        style={{ rotateY, x, scale }}
      >
        {/* ── Face ── */}
        <div className="absolute inset-0 [backface-visibility:hidden]">
          <CardFrame
            as="button"
            tier={item.tier}
            type="button"
            tabIndex={isActive ? 0 : -1}
            aria-label={isActive ? `Ouvrir la fiche de ${item.name}` : `Afficher ${item.name}`}
            onClick={onTap}
            cosmetic={equipped?.[item.id]}
            className="relative block h-full w-full text-left active:brightness-110 transition-[filter] motion-reduce:transition-none"
            style={{ boxShadow: `0 14px 34px -10px ${frameGlow}` }}
          >
            <div className="relative h-full bg-violet-900/60">
              {item.image
                ? <img src={item.image} alt="" loading="lazy" draggable="false" className="h-full w-full object-cover select-none" />
                : <div className="flex h-full w-full items-center justify-center text-violet-600">?</div>}

              <div className="absolute top-2 left-2"><RarityBadge tier={item.tier} /></div>
              <span className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full border border-white/20 bg-black/60" aria-hidden="true">
                <Heart size={12} className="text-pink-400" fill="currentColor" />
              </span>
              {r.shine && <div className="card-shine" />}

              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/50 to-transparent px-3 pb-2.5 pt-10">
                <p className="truncate text-sm font-bold leading-tight text-white" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>{item.name}</p>
                <p className="truncate text-[11px] text-violet-200/90">{item.series}</p>
              </div>

              <motion.div
                className="pointer-events-none absolute inset-0"
                style={{ opacity: sheen, background: "linear-gradient(100deg, transparent 30%, rgba(255,255,255,0.7) 50%, transparent 70%)" }}
              />
            </div>
          </CardFrame>
        </div>

        {/* ── Dos (visible quand la carte est retournée) ── */}
        <button
          type="button"
          tabIndex={-1}
          aria-label={`Afficher ${item.name}`}
          onClick={onTap}
          className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)]"
        >
          <CardBack glow={frameGlow} />
        </button>
      </motion.div>
    </motion.div>
  );
}

export function FavoritesCarousel({ items, onOpen, equipped, onLongPress, focusId, focusToken }) {
  const reduce = useReducedMotion();
  const n = items.length;
  const p = useMotionValue(0);            // position fractionnaire dans la liste
  const anim = useRef(null);
  const [active, setActive] = useState(0);

  // L'index « actif » (carte du milieu) ne change qu'en passant un entier.
  useMotionValueEvent(p, "change", (v) => {
    const a = clamp(Math.round(v), 0, Math.max(n - 1, 0));
    setActive((prev) => (prev === a ? prev : a));
  });

  const goTo = useCallback((target, { silent = false } = {}) => {
    const t = clamp(Math.round(target), 0, Math.max(n - 1, 0));
    anim.current?.stop();
    anim.current = animate(p, t, reduce ? { duration: 0 } : SPRING);
    if (!silent && t !== Math.round(p.get())) haptics.tap();
  }, [n, p, reduce]);

  // Un favori retiré : on garde une position valide.
  useEffect(() => {
    if (p.get() > n - 1) { p.set(Math.max(n - 1, 0)); setActive(Math.max(n - 1, 0)); }
  }, [n, p]);

  // Recentrage après un déplacement dans la liste.
  const itemsRef = useRef(items);
  itemsRef.current = items;
  useEffect(() => {
    if (!focusToken) return;
    const raf = requestAnimationFrame(() => {
      const i = itemsRef.current.findIndex((c) => c.id === focusId);
      if (i >= 0) goTo(i, { silent: true });
    });
    return () => cancelAnimationFrame(raf);
  }, [focusToken]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Appui long (carte du milieu uniquement) ──
  const lpRef = useRef({ timer: 0, x: 0, y: 0, fired: false });
  const cancelLongPress = useCallback(() => clearTimeout(lpRef.current.timer), []);
  useEffect(() => cancelLongPress, [cancelLongPress]);

  /** Index de la carte sous le doigt / le curseur (undefined si hors carte). */
  const leafIndexOf = (e) => {
    const el = e.target?.closest?.("[data-leaf]");
    return el ? Number(el.dataset.leaf) : undefined;
  };

  const startLongPress = (e) => {
    if (!onLongPress || (e.pointerType === "mouse" && e.button !== 0)) return;
    if (leafIndexOf(e) !== active) return; // les voisines : un tap les centre, pas de menu
    const id = items[active]?.id;
    if (id == null) return;
    clearTimeout(lpRef.current.timer);
    lpRef.current = {
      x: e.clientX, y: e.clientY, fired: false,
      timer: setTimeout(() => { lpRef.current.fired = true; haptics.longPress(); onLongPress(id); }, LONG_PRESS_MS),
    };
  };
  const moveLongPress = (e) => {
    if (Math.hypot(e.clientX - lpRef.current.x, e.clientY - lpRef.current.y) > LONG_PRESS_SLOP) cancelLongPress();
  };

  // ── Glissé : les cartes suivent le doigt, puis se calent avec l'élan ──
  const startP = useRef(0);
  const panned = useRef(false);

  function onPanStart() {
    anim.current?.stop();
    startP.current = p.get();
    panned.current = false;
  }
  function onPan(_, info) {
    if (Math.abs(info.offset.x) > 6) { panned.current = true; cancelLongPress(); }
    // Légère résistance aux extrémités (on ne peut pas aller dans le vide).
    p.set(clamp(startP.current - info.offset.x / PAN_PX, -0.2, n - 1 + 0.2));
  }
  function onPanEnd(_, info) {
    const momentum = (-info.velocity.x / PAN_PX) * 0.2;
    goTo(p.get() + momentum);
  }

  function onKeyDown(e) {
    if (e.key === "ArrowRight") { e.preventDefault(); goTo(active + 1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); goTo(active - 1); }
  }

  const many = n > 1;
  const current = items[active] || items[0];
  const glow = resolveCosmetic(equipped?.[current?.id]).frame?.glow || RARITY[normalizeTier(current?.tier)].glow;

  // Seules les cartes proches de la position courante sont montées.
  const from = Math.max(active - SIDE - 1, 0);
  const to = Math.min(active + SIDE + 1, n - 1);
  const visible = [];
  for (let i = from; i <= to; i++) visible.push(i);

  return (
    <div className="relative">
      {/* Halo doux derrière la carte du milieu, à la couleur de sa rareté */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-8 h-44 blur-3xl opacity-40 transition-colors duration-500 motion-reduce:transition-none"
        style={{ background: `radial-gradient(ellipse at center, ${glow}, transparent 70%)` }}
      />

      {/* Zone de glisse sur toute la largeur ; les cartes sont centrées dedans. */}
      <motion.div
        role="region"
        aria-roledescription="carousel"
        aria-label="Mes personnages favoris"
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPanStart={onPanStart}
        onPan={onPan}
        onPanEnd={onPanEnd}
        onPointerDown={(e) => { panned.current = false; startLongPress(e); }}
        onPointerMove={onLongPress ? moveLongPress : undefined}
        onPointerUp={onLongPress ? cancelLongPress : undefined}
        onPointerLeave={onLongPress ? cancelLongPress : undefined}
        onPointerCancel={onLongPress ? cancelLongPress : undefined}
        onContextMenu={onLongPress ? (e) => {
          e.preventDefault();
          // Appui long tactile : déjà géré par le minuteur. Clic droit souris : on ouvre ici.
          if (!lpRef.current.fired && leafIndexOf(e) === active && current) onLongPress(current.id);
        } : undefined}
        className={`relative my-3 w-full select-none overflow-x-clip rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/60 ${
          onLongPress ? "[-webkit-touch-callout:none]" : ""}`}
        // pan-y : le défilement vertical de la page reste possible ; l'horizontal est à nous.
        style={{ height: CARD_H + 24, touchAction: "pan-y" }}
      >
        {/* Les cartes se superposent : on les centre dans un cadre de la taille d'une carte. */}
        <div className="absolute left-1/2 top-3 -translate-x-1/2" style={{ width: CARD_W, height: CARD_H }}>
          {visible.map((i) => (
            <Leaf
              key={items[i].id}
              item={items[i]}
              i={i}
              p={p}
              reduce={reduce}
              equipped={equipped}
              isActive={i === active}
              onTap={() => {
                // Un glissé ou un appui long ne doivent rien déclencher.
                if (panned.current) { panned.current = false; return; }
                if (lpRef.current.fired) { lpRef.current.fired = false; return; }
                if (i === active) onOpen?.(items[i].id); // carte centrale : fiche
                else goTo(i);                              // voisine : elle vient au centre
              }}
            />
          ))}
        </div>
      </motion.div>

      {many && (
        <>
          {/* Flèches : utiles à la souris, masquées sur mobile (glissé / tap sur une voisine) */}
          <button
            onClick={() => goTo(active - 1)}
            disabled={active === 0}
            aria-label="Favori précédent"
            className="hidden sm:flex absolute left-1 top-1/2 -translate-y-1/2 z-[120] w-8 h-8 items-center justify-center rounded-full bg-black/50 border border-white/15 text-white disabled:opacity-0 transition-opacity motion-reduce:transition-none hover:bg-black/70"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => goTo(active + 1)}
            disabled={active === n - 1}
            aria-label="Favori suivant"
            className="hidden sm:flex absolute right-1 top-1/2 -translate-y-1/2 z-[120] w-8 h-8 items-center justify-center rounded-full bg-black/50 border border-white/15 text-white disabled:opacity-0 transition-opacity motion-reduce:transition-none hover:bg-black/70"
          >
            <ChevronRight size={16} />
          </button>

          {/* Points de pagination */}
          <div className="flex justify-center flex-wrap gap-1.5 mt-1 px-4" role="tablist" aria-label="Choisir un favori">
            {items.map((c, i) => (
              <button
                key={c.id}
                role="tab"
                aria-selected={i === active}
                aria-label={`Aller à ${c.name}`}
                onClick={() => goTo(i)}
                className={`h-1.5 rounded-full transition-all duration-300 motion-reduce:transition-none ${
                  i === active ? "w-5 bg-amber-300" : "w-1.5 bg-white/25 hover:bg-white/40"}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
