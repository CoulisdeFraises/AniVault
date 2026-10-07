import { useState, useEffect, useCallback } from "react";
import { AnimatePresence, motion, animate, useMotionValue, useTransform, useReducedMotion } from "motion/react";
import { Sparkles, Copy, Star, Gem } from "lucide-react";
import { RARITY, normalizeTier } from "../../utils/waifinity";
import { RarityBadge, RarityDot } from "./RarityBadge";
import { GenderBadge } from "./GenderBadge";
import { CardFrame } from "./CardFrame";
import { ScreenFlash } from "./ScreenFlash";
import { haptics } from "../../utils/haptics";

// ── Ouverture carte par carte ───────────────────────────────────────────────
//
// Une pile de cartes face cachée. UN geste = UNE étape, au tap comme au glissé :
//   carte cachée → elle se retourne (révélation, effets selon la rareté) ;
//   carte révélée → elle s'envole et la suivante prend sa place.
// Clavier : Entrée / Espace / → font la même chose. Après la dernière carte,
// `onFinish` ; `onRevealAll` saute directement au récapitulatif.

const SWIPE_DISTANCE = 80;   // px parcourus pour valider un glissé
const SWIPE_VELOCITY = 450;  // px/s : un geste court mais vif compte aussi
const BURST = { epic: 8, legendary: 12, secret: 16 }; // particules à la révélation

/** Dos de carte : identique pour toutes (aucune indication sur la rareté). */
function CardBack() {
  return (
    <div className="absolute inset-0 rounded-2xl overflow-hidden border border-white/20 bg-gradient-to-br from-violet-700 via-violet-900 to-violet-950
      shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_20px_40px_-18px_rgba(0,0,0,0.9)]">
      <div className="absolute inset-0 opacity-30" style={{ backgroundImage: "radial-gradient(circle at 28% 18%, white, transparent 42%)" }} />
      <div className="absolute inset-3 rounded-xl border border-amber-300/30" />
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="w-16 h-16 rounded-full bg-gradient-to-b from-amber-300/25 to-fuchsia-500/20 border border-amber-300/40 flex items-center justify-center">
          <Sparkles size={28} className="text-amber-200" />
        </span>
      </div>
    </div>
  );
}

/** Face révélée : grande illustration, rareté, statut (nouveau / doublon). */
function CardFace({ card, isDuplicate, fragments }) {
  const r = RARITY[normalizeTier(card.tier)];
  return (
    <CardFrame
      tier={card.tier}
      className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)] flex flex-col !rounded-2xl"
      style={{ boxShadow: `0 0 34px -2px ${r.glow}, 0 20px 40px -18px rgba(0,0,0,0.9)` }}
    >
      <div className="relative flex-1 min-h-0 bg-violet-900/60">
        {card.image
          ? <img src={card.image} alt="" draggable="false" className="w-full h-full object-cover select-none" />
          : <div className="w-full h-full flex items-center justify-center text-violet-600 text-4xl">?</div>}
        <div className="absolute top-2 left-2"><RarityBadge tier={card.tier} size="md" /></div>
        {!isDuplicate && (
          <span className="absolute top-2 right-2 rounded-full bg-teal-400 px-2 py-0.5 text-[10px] font-bold text-violet-950 shadow-md">Nouveau</span>
        )}
        {isDuplicate && (
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 bg-gradient-to-t from-black/80 to-transparent px-3 pb-2 pt-8">
            <span className="flex items-center gap-1 rounded-full border border-amber-300/60 bg-violet-950/85 px-2.5 py-1 text-[11px] font-bold text-amber-200">
              <Copy size={12} strokeWidth={2.5} />Doublon
            </span>
            {fragments > 0 && (
              <span className="flex items-center gap-1 rounded-full bg-violet-950/85 px-2 py-1 font-mono text-[11px] font-semibold text-violet-100">
                <Gem size={10} className="text-violet-300" />+{fragments}
              </span>
            )}
          </div>
        )}
        {card.wish && (
          <span className="absolute bottom-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-amber-400 text-violet-950 shadow-md" title="Ton vœu">
            <Star size={13} strokeWidth={2.5} fill="currentColor" />
          </span>
        )}
        {r.shine && <div className="card-shine" />}
      </div>
      <div className="bg-black/35 px-3.5 py-2.5 text-left">
        <div className="flex items-center gap-1.5">
          <p className="flex-1 truncate text-base font-bold leading-tight text-white" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>{card.name}</p>
          <GenderBadge gender={card.gender} />
        </div>
        <p className="truncate text-xs text-violet-300">{card.series}</p>
      </div>
    </CardFrame>
  );
}

/** Particules qui jaillissent de la carte à la révélation d'un Epic ou mieux. */
function Burst({ tier }) {
  const count = BURST[normalizeTier(tier)] || 0;
  if (!count) return null;
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <Sparkles
          key={i}
          size={14 + (i % 3) * 5}
          className="sparkle-burst text-amber-200"
          style={{ "--angle": `${(360 / count) * i}deg`, "--dist": `${130 + (i % 2) * 40}px`, animationDelay: `${(i % 4) * 25}ms` }}
        />
      ))}
    </div>
  );
}

// Envol de la carte : dans le sens du glissé, sinon sur le côté en alternance.
const cardVariants = {
  enter: { scale: 0.92, y: 18, opacity: 0.6 },
  center: { scale: 1, y: 0, opacity: 1, x: 0, rotate: 0 },
  exit: (d) => ({
    x: d.x * 520, y: d.y * 520 - 40, rotate: d.x * 18, opacity: 0,
    transition: { duration: 0.32, ease: [0.4, 0, 0.9, 0.6] },
  }),
};

/**
 * Carte du dessus : glissable dans toutes les directions. Elle possède ses
 * propres valeurs x/y (donc remise à zéro à chaque nouvelle carte) ; si le
 * glissé est trop court, elle revient seule, sinon `onStep` reçoit la direction
 * et l'envol est joué par la variante `exit` (voir AnimatePresence plus bas).
 */
function TopCard({ card, flipped, isDuplicate, fragments, reduce, onStep }) {
  const r = RARITY[normalizeTier(card.tier)];
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-220, 220], [-14, 14]);

  function onDragEnd(_, info) {
    const { offset, velocity } = info;
    const dist = Math.hypot(offset.x, offset.y);
    const speed = Math.hypot(velocity.x, velocity.y);
    if (dist < SWIPE_DISTANCE && speed < SWIPE_VELOCITY) {
      // Geste trop court : retour en douceur à la place d'origine.
      animate(x, 0, { type: "spring", stiffness: 420, damping: 30 });
      animate(y, 0, { type: "spring", stiffness: 420, damping: 30 });
      return;
    }
    const len = dist || 1;
    onStep({ x: offset.x / len, y: offset.y / len });
  }

  return (
    <motion.div
      variants={reduce ? reducedVariants : cardVariants}
      initial="enter" animate="center" exit="exit"
      transition={{ type: "spring", stiffness: 300, damping: 26 }}
      drag
      dragElastic={0.9}
      dragMomentum={false}
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      whileDrag={{ scale: 1.03 }}
      onDragEnd={onDragEnd}
      onTap={() => onStep()}
      className="absolute inset-0 touch-none cursor-grab active:cursor-grabbing select-none"
      style={{ x, y, rotate: reduce ? 0 : rotate }}
      role="button"
      tabIndex={0}
      aria-label={flipped ? "Carte suivante" : "Révéler cette carte"}
    >
      {/* Aura pulsante derrière la carte révélée */}
      {flipped && (
        <div
          className="card-aura absolute -inset-3 -z-10 rounded-3xl pointer-events-none"
          style={{ background: `radial-gradient(circle, ${r.glow} 0%, transparent 72%)`, filter: "blur(14px)", animationDuration: `${r.auraDuration}s`, "--aura-peak": r.auraPeak }}
          aria-hidden="true"
        />
      )}

      {/* Retournement 3D */}
      <motion.div
        className="relative h-full w-full [transform-style:preserve-3d]"
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 170, damping: 17, mass: 0.9 }}
      >
        <div className="absolute inset-0 [backface-visibility:hidden]"><CardBack /></div>
        <CardFace card={card} isDuplicate={isDuplicate} fragments={fragments} />
      </motion.div>

      {flipped && <Burst tier={card.tier} />}
    </motion.div>
  );
}

const reducedVariants = { enter: { opacity: 0 }, center: { opacity: 1 }, exit: { opacity: 0, transition: { duration: 0.15 } } };

export function PackDeck({ cards, dupSlots, fragmentsFor, onRevealCard, onFinish, onRevealAll }) {
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [exitDir, setExitDir] = useState({ x: 1, y: 0 });
  const [flash, setFlash] = useState(null);
  const [tiers, setTiers] = useState([]); // paliers des cartes déjà révélées (pastilles de progression)

  const n = cards.length;
  const card = cards[index];
  const r = RARITY[normalizeTier(card.tier)];
  const isDuplicate = dupSlots.has(card.packSlot);

  const reveal = useCallback(() => {
    setFlipped(true);
    setTiers((t) => [...t, card.tier]);
    onRevealCard(card.packSlot);
    if (r.shine) haptics.success(); else haptics.light();
    if (r.flashPeak) setFlash(card.packSlot);
  }, [card, r, onRevealCard]);

  const dismiss = useCallback((dir) => {
    setExitDir(dir || { x: index % 2 ? -1 : 1, y: 0 });
    haptics.tap();
    if (index + 1 >= n) { onFinish(); return; }
    setIndex((i) => i + 1);
    setFlipped(false);
  }, [index, n, onFinish]);

  // Un geste = une étape.
  const step = useCallback((dir) => { if (flipped) dismiss(dir); else reveal(); }, [flipped, dismiss, reveal]);

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowRight") { e.preventDefault(); step(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step]);

  return (
    <div className="relative flex flex-1 min-h-0 flex-col items-center">
      {/* Progression : une pastille par carte, à la couleur de la rareté une fois passée */}
      <div className="flex items-center gap-1.5 pt-1" role="img" aria-label={`Carte ${index + 1} sur ${n}`}>
        {cards.map((c, i) => (
          i === index
            ? <span key={c.packSlot} className="block h-2 w-6 rounded-full bg-amber-300 shadow-[0_0_10px_rgba(251,191,36,0.6)]" />
            : i < index
              ? <RarityDot key={c.packSlot} tier={tiers[i]} size={8} />
              : <span key={c.packSlot} className="block h-2 w-2 rounded-full bg-white/15" />
        ))}
      </div>
      <p className="mt-1.5 font-mono text-xs text-violet-300 tabular-nums">{index + 1} / {n}</p>

      {/* Scène */}
      <div className="relative flex w-full flex-1 min-h-0 items-center justify-center px-6">
        {/* Halo de la rareté, une fois la carte retournée */}
        <AnimatePresence>
          {flipped && (
            <motion.div
              key={`glow-${card.packSlot}`}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}
              className="pointer-events-none absolute inset-0"
              style={{ background: `radial-gradient(circle at 50% 48%, ${r.glow} 0%, transparent 62%)` }}
              aria-hidden="true"
            />
          )}
        </AnimatePresence>

        <div className="relative aspect-[3/4] w-[min(72vw,18rem)] max-h-full [perspective:1100px]">
          {/* Cartes en attente, empilées derrière */}
          {[2, 1].map((k) => (index + k < n) && (
            <motion.div
              key={`stack-${cards[index + k].packSlot}`}
              className="absolute inset-0"
              initial={false}
              animate={{ scale: 1 - 0.055 * k, y: 14 * k, rotate: k % 2 ? -2.5 : 2.5, opacity: 1 - 0.28 * k }}
              transition={{ type: "spring", stiffness: 260, damping: 26 }}
            >
              <CardBack />
            </motion.div>
          ))}

          {/* Carte du dessus : `custom` indique à la carte sortante où s'envoler */}
          <AnimatePresence custom={exitDir}>
            <TopCard
              key={`top-${card.packSlot}`}
              card={card}
              flipped={flipped}
              isDuplicate={isDuplicate}
              fragments={isDuplicate ? fragmentsFor(card) : 0}
              reduce={reduce}
              onStep={step}
            />
          </AnimatePresence>
        </div>
      </div>

      <p className="mt-3 min-h-[1.25rem] text-center text-sm text-violet-200" aria-live="polite">
        {flipped
          ? <><span className={`font-semibold ${r.text}`}>{card.name}</span> · {r.label}{isDuplicate ? " · doublon" : " · nouveau"}</>
          : "Touche ou glisse la carte pour la révéler"}
      </p>
      <p className="mb-1 text-xs text-violet-500">{flipped ? "Touche ou glisse pour passer à la suivante" : "\u00A0"}</p>

      {flash === card.packSlot && <ScreenFlash tier={card.tier} onDone={() => setFlash(null)} />}

      <button
        type="button"
        onClick={() => { haptics.tap(); onRevealAll(); }}
        className="mt-1 flex items-center gap-1.5 rounded-full border border-white/[0.12] bg-white/[0.06] px-4 py-2 text-xs font-medium text-violet-100 hover:bg-white/10 active:scale-95"
      >
        <Sparkles size={13} className="text-amber-300" />Tout révéler
      </button>
    </div>
  );
}
