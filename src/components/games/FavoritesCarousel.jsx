import { useCallback, useEffect, useRef, useState } from "react";
import { animate, motion, useMotionValue, useMotionValueEvent, useReducedMotion, useTransform } from "motion/react";
import { Heart, ChevronLeft, ChevronRight } from "lucide-react";
import { RARITY, normalizeTier } from "../../utils/waifinity";
import { haptics } from "../../utils/haptics";
import { resolveCosmetic } from "../../utils/waifinityCosmetics";
import { RarityBadge } from "./RarityBadge";
import { CardFrame } from "./CardFrame";

// ── FavoritesCarousel — le feuillet ────────────────────────────────────────
//
// Les favoris sont empilés comme les pages d'un carnet : la carte du dessus est
// à plat, celles d'après dépassent en éventail derrière elle. En glissant le
// doigt (ou avec les flèches / points / clavier), la carte du dessus SE TOURNE
// autour de son bord gauche — son verso apparaît, elle s'assombrit puis
// disparaît — et la suivante prend sa place. Le geste suit le doigt en continu
// (une seule valeur `p` = position fractionnaire dans la pile pilote toutes les
// cartes) et, au relâchement, la pile se cale en ressort sur la carte la plus
// proche en tenant compte de l'élan.
//
// Props (inchangées) :
//  • `items`    favoris dans l'ordre d'affichage ;
//  • `equipped` ({ [id]: { frame, effect } }) cosmétiques équipés ;
//  • `onOpen(id)`  toucher la carte du dessus ; sans lui, lecture seule
//    (vitrine d'un autre joueur) ;
//  • `onLongPress(id)`  appui long (~0,45 s, sans bouger) ou clic droit sur la
//    carte du dessus — menu de réorganisation ;
//  • `focusId` + `focusToken`  à chaque changement du token, tourne jusqu'à `focusId`.
//
// « Réduire les animations » : plus de rotation ni d'éventail, simple fondu.

const CARD_W = 208;          // largeur de la carte, px (ratio 3/4)
const PAN_PX = 150;          // px de glissé pour tourner une page entière
const PEEK = 3;              // nombre de cartes visibles derrière
const LONG_PRESS_MS = 450;
const LONG_PRESS_SLOP = 10;  // px tolérés avant d'annuler l'appui long
const SPRING = { type: "spring", stiffness: 170, damping: 22, mass: 0.9 };

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** Verso : une page de carnet, avec le cœur des favoris en filigrane. */
function PaperBack() {
  return (
    <div className="absolute inset-0 rounded-xl overflow-hidden border border-white/15 bg-gradient-to-br from-violet-800 via-violet-900 to-violet-950">
      <div className="absolute inset-0 opacity-25" style={{ backgroundImage: "repeating-linear-gradient(to bottom, transparent 0 22px, rgba(255,255,255,0.35) 22px 23px)" }} />
      <div className="absolute inset-0 flex items-center justify-center">
        <Heart size={44} className="text-pink-300/25" fill="currentColor" />
      </div>
    </div>
  );
}

/** Une carte de la pile. Toute son apparence découle de `p` (position fractionnaire de la pile). */
function Leaf({ item, i, p, reduce, equipped, isActive, onTap }) {
  const r = RARITY[normalizeTier(item.tier)];
  const d = useTransform(p, (v) => i - v); // 0 = au-dessus ; < 0 = déjà tournée ; > 0 = derrière

  // Enveloppe externe (fondu, empilement) — l'opacité reste ici pour ne pas
  // aplatir la 3D de la carte interne.
  const opacity = useTransform(d, reduce ? [-1, 0, 1] : [-1, -0.8, 0, PEEK - 0.4, PEEK],
                                   reduce ? [0, 1, 0]  : [0, 1, 1, 1, 0]);
  const zIndex = useTransform(d, (v) => (v <= 0 ? 100 : 100 - Math.round(v * 10)));

  // Carte interne : tourne autour de son bord gauche, glisse et rétrécit derrière la pile.
  const rotateY = useTransform(d, [-1, 0, PEEK], reduce ? [0, 0, 0] : [-168, 0, 0]);
  const x       = useTransform(d, [0, 1, 2, PEEK], reduce ? [0, 0, 0, 0] : [0, 17, 31, 42]);
  const y       = useTransform(d, [0, 1, 2, PEEK], reduce ? [0, 0, 0, 0] : [0, -3, -5, -6]);
  const scale   = useTransform(d, [0, 1, 2, PEEK], reduce ? [1, 1, 1, 1] : [1, 0.95, 0.9, 0.86]);
  // Ombre portée : la page qui se tourne s'assombrit, celles du dessous restent dans l'ombre.
  const shade   = useTransform(d, [-1, 0, 1, PEEK], reduce ? [0, 0, 0, 0] : [0.65, 0, 0.3, 0.55]);
  // Reflet qui balaie la carte pendant qu'elle se tourne.
  const sheen   = useTransform(d, [-1, -0.5, 0], reduce ? [0, 0, 0] : [0, 0.45, 0]);

  const frameGlow = resolveCosmetic(equipped?.[item.id]).frame?.glow || r.glow;

  return (
    <motion.div
      className="absolute inset-0 [perspective:1400px]"
      style={{ opacity, zIndex, pointerEvents: isActive ? "auto" : "none" }}
      aria-hidden={!isActive}
    >
      <motion.div
        className="relative h-full w-full [transform-style:preserve-3d] will-change-transform"
        style={{ rotateY, x, y, scale, originX: 0, originY: 0.5 }}
      >
        {/* ── Recto ── */}
        <div className="absolute inset-0 [backface-visibility:hidden]">
          <CardFrame
            as="button"
            tier={item.tier}
            type="button"
            tabIndex={isActive ? 0 : -1}
            onClick={isActive ? onTap : undefined}
            cosmetic={equipped?.[item.id]}
            className="relative block h-full w-full text-left active:brightness-110 transition-[filter] motion-reduce:transition-none"
            style={{ boxShadow: `0 14px 34px -10px ${frameGlow}` }}
          >
            <div className="relative h-full bg-violet-900/60">
              {item.image
                ? <img src={item.image} alt="" loading="lazy" draggable="false" className="h-full w-full object-cover select-none" />
                : <div className="flex h-full w-full items-center justify-center text-violet-600">?</div>}

              <div className="absolute top-2 left-2"><RarityBadge tier={item.tier} /></div>
              <span className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full border border-white/20 bg-black/60" aria-label="Favori">
                <Heart size={12} className="text-pink-400" fill="currentColor" />
              </span>
              {r.shine && <div className="card-shine" />}

              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/50 to-transparent px-3 pb-2.5 pt-10">
                <p className="truncate text-sm font-bold leading-tight text-white" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>{item.name}</p>
                <p className="truncate text-[11px] text-violet-200/90">{item.series}</p>
              </div>

              {/* Ombre et reflet pilotés par la rotation */}
              <motion.div className="pointer-events-none absolute inset-0 bg-black" style={{ opacity: shade }} />
              <motion.div
                className="pointer-events-none absolute inset-0"
                style={{ opacity: sheen, background: "linear-gradient(100deg, transparent 30%, rgba(255,255,255,0.7) 50%, transparent 70%)" }}
              />
            </div>
          </CardFrame>
        </div>

        {/* ── Verso (visible quand la page est retournée) ── */}
        <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)]"><PaperBack /></div>
      </motion.div>
    </motion.div>
  );
}

export function FavoritesCarousel({ items, onOpen, equipped, onLongPress, focusId, focusToken }) {
  const reduce = useReducedMotion();
  const n = items.length;
  const p = useMotionValue(0);            // position fractionnaire dans la pile
  const anim = useRef(null);
  const [active, setActive] = useState(0);

  // L'index « actif » (carte du dessus) ne change qu'en passant un entier.
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

  // ── Appui long (carte du dessus) ──
  const lpRef = useRef({ timer: 0, x: 0, y: 0, fired: false });
  const cancelLongPress = useCallback(() => clearTimeout(lpRef.current.timer), []);
  useEffect(() => cancelLongPress, [cancelLongPress]);

  const startLongPress = (e) => {
    if (!onLongPress || (e.pointerType === "mouse" && e.button !== 0)) return;
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

  // ── Glissé : la page suit le doigt, puis se cale avec l'élan ──
  const startP = useRef(0);
  const panned = useRef(false);

  function onPanStart() {
    anim.current?.stop();
    startP.current = p.get();
    panned.current = false;
  }
  function onPan(_, info) {
    if (Math.abs(info.offset.x) > 6) { panned.current = true; cancelLongPress(); }
    // Légère résistance aux extrémités (on ne peut pas tourner dans le vide).
    p.set(clamp(startP.current - info.offset.x / PAN_PX, -0.18, n - 1 + 0.18));
  }
  function onPanEnd(_, info) {
    const momentum = (-info.velocity.x / PAN_PX) * 0.22;
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
  const from = Math.max(active - 2, 0);
  const to = Math.min(active + PEEK + 1, n - 1);
  const visible = [];
  for (let i = from; i <= to; i++) visible.push(i);

  return (
    <div className="relative">
      {/* Halo doux derrière la carte du dessus, à la couleur de sa rareté */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-6 h-44 blur-3xl opacity-40 transition-colors duration-500 motion-reduce:transition-none"
        style={{ background: `radial-gradient(ellipse at center, ${glow}, transparent 70%)` }}
      />

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
          if (!lpRef.current.fired && current) onLongPress(current.id);
        } : undefined}
        className={`relative mx-auto my-4 select-none rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/60 ${
          onLongPress ? "[-webkit-touch-callout:none]" : ""}`}
        // pan-y : le défilement vertical de la page reste possible ; l'horizontal est à nous.
        style={{ width: CARD_W, height: (CARD_W * 4) / 3, touchAction: "pan-y", x: many && !reduce ? -14 : 0 }}
      >
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
              // Un glissé ou un appui long ne doivent pas ouvrir la fiche.
              if (panned.current) { panned.current = false; return; }
              if (lpRef.current.fired) { lpRef.current.fired = false; return; }
              onOpen?.(items[i].id);
            }}
          />
        ))}
      </motion.div>

      {many && (
        <>
          {/* Flèches : utiles à la souris, masquées sur mobile (glissé) */}
          <button
            onClick={() => goTo(active - 1)}
            disabled={active === 0}
            aria-label="Favori précédent"
            className="hidden sm:flex absolute left-0 top-1/2 -translate-y-1/2 w-8 h-8 items-center justify-center rounded-full bg-black/50 border border-white/15 text-white disabled:opacity-0 transition-opacity motion-reduce:transition-none hover:bg-black/70"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => goTo(active + 1)}
            disabled={active === n - 1}
            aria-label="Favori suivant"
            className="hidden sm:flex absolute right-0 top-1/2 -translate-y-1/2 w-8 h-8 items-center justify-center rounded-full bg-black/50 border border-white/15 text-white disabled:opacity-0 transition-opacity motion-reduce:transition-none hover:bg-black/70"
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
