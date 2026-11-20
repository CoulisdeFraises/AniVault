import { useState, useEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, useReducedMotion } from "motion/react";
import { Sparkles, PackagePlus, Copy, Gem } from "lucide-react";
import { BoosterCard } from "./BoosterCard";
import { PackDeck } from "./PackDeck";
import { Embers, Shockwave } from "./PackFx";
import { RarityBadge, RarityDot } from "./RarityBadge";
import { GameButton, Eyebrow, HEADING } from "./ui";
import { haptics } from "../../utils/haptics";
import { RARITY, RARITY_ORDER, normalizeTier } from "../../utils/waifinity";
import { fragmentsForDuplicate } from "../../utils/waifinityCosmetics";

const SOURCE_LABEL = {
  free: "Booster gratuit", standard: "Booster normal", chance: "Booster", targeted: "Booster ciblé",
  waifu: "Booster Waifus", husbando: "Booster Husbandos", wish: "Booster Vœu",
};

// Chronologie du suspense (ms) : entrée du sachet → charge (il tremble, l'énergie
// converge) → déchirure → passage aux cartes. Un tap sur la scène saute directement à la fin.
const CHARGE_AT_MS = 750;
const BURST_AT_MS = 1900;
const INTRO_END_MS = 2550;
const BURST_COUNT = 18;
const CONVERGE_COUNT = 10;

// Sachet selon le type de booster : rose = Waifus, bleu = Husbandos, violet = tous les autres
// (normal, gratuit, ciblé, vœu, bannière…). Images détourées dans public/boosters/.
const PACK_VARIANT = {
  waifu:    { img: "/boosters/sachet-rose.webp",   glow: "rgba(244,114,182,0.75)" },
  husbando: { img: "/boosters/sachet-bleu.webp",   glow: "rgba(96,165,250,0.75)" },
};
const PACK_DEFAULT = { img: "/boosters/sachet-violet.webp", glow: "rgba(167,139,250,0.75)" };

// Préchargement : les sachets (≈ 40 Ko chacun) sont prêts avant la 1re ouverture.
if (typeof Image !== "undefined") {
  [PACK_DEFAULT, ...Object.values(PACK_VARIANT)].forEach((v) => { new Image().src = v.img; });
}

// Déchirure : un simple trait horizontal à 20 % depuis le haut du sachet. La bande du haut
// (avec la soudure) s'envole, le reste du sachet reste en place.
const TEAR_AT = 20; // % de la hauteur

/** Meilleure rareté du tirage (celle qui colorera la charge et le récapitulatif). */
function bestTierOf(cards) {
  let best = 0;
  for (const c of cards) best = Math.max(best, RARITY_ORDER.indexOf(normalizeTier(c.tier)));
  return RARITY_ORDER[best];
}

/**
 * Suspense avant la révélation, en trois temps :
 *  1. le sachet tombe du haut et se pose, éclat de lumière sur sa silhouette ;
 *  2. il charge : tremble de plus en plus, enfle, l'énergie est aspirée vers lui.
 *     Si le tirage contient un Epic ou mieux, le halo vire à la couleur de cette
 *     rareté pendant la charge (un indice, sans dire laquelle des cartes c'est) ;
 *  3. il se déchire d'un trait en haut : éclair, onde de choc, étincelles.
 * Tap pour passer.
 */
function PackIntro({ source, bestTier, onDone }) {
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState("enter"); // enter | charge | burst
  const variant = PACK_VARIANT[source] || PACK_DEFAULT;
  const tierGlow = RARITY[bestTier].flashPeak ? RARITY[bestTier].glow : null;
  const charging = phase === "charge";
  const burst = phase === "burst";

  useEffect(() => {
    if (reduce) {
      const t = setTimeout(onDone, 500);
      return () => clearTimeout(t);
    }
    const t1 = setTimeout(() => setPhase("charge"), CHARGE_AT_MS);
    const t2 = setTimeout(() => { setPhase("burst"); haptics.success(); }, BURST_AT_MS);
    const t3 = setTimeout(onDone, INTRO_END_MS);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onDone, reduce]);

  // La vibration monte avec la charge (un battement toutes les ~300 ms).
  useEffect(() => {
    if (!charging) return undefined;
    haptics.tap();
    const id = setInterval(() => haptics.tap(), 320);
    return () => clearInterval(id);
  }, [charging]);

  // Les deux morceaux montrent la même image, chacun sa portion (haut 20 % / bas 80 %).
  const topStyle = {
    backgroundImage: `url(${variant.img})`,
    backgroundSize: `100% ${10000 / TEAR_AT}%`,
    backgroundPosition: "0% 0%",
  };
  const bottomStyle = {
    backgroundImage: `url(${variant.img})`,
    backgroundSize: `100% ${10000 / (100 - TEAR_AT)}%`,
    backgroundPosition: "0% 100%",
  };
  // L'éclat de lumière est découpé à la silhouette du sachet.
  const silhouette = {
    WebkitMaskImage: `url(${variant.img})`, maskImage: `url(${variant.img})`,
    WebkitMaskSize: "100% 100%", maskSize: "100% 100%",
    WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat",
  };

  return (
    <button
      onClick={onDone}
      aria-label="Ouverture du booster — toucher pour passer"
      className="relative flex-1 w-full flex flex-col items-center justify-center gap-10 text-violet-200"
    >
      {/* Éclair blanc au moment de la déchirure */}
      {burst && !reduce && (
        <motion.span
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-[5] bg-white"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.5, 0] }}
          transition={{ duration: 0.5, times: [0, 0.2, 1], ease: "easeOut" }}
        />
      )}

      {/* Entrée du sachet : il tombe du haut et se pose */}
      <motion.div
        initial={reduce ? false : { scale: 0.6, opacity: 0, y: -90, rotate: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0, rotate: 0 }}
        transition={{ type: "spring", stiffness: 190, damping: 13 }}
        className="relative aspect-[2/3] w-[min(62vw,15rem)]"
      >
        {/* Halo à la couleur du sachet, qui pulse puis éclate à l'ouverture */}
        <motion.span
          aria-hidden="true"
          className="absolute -inset-14 rounded-full blur-2xl"
          style={{ background: `radial-gradient(circle, ${variant.glow} 0%, transparent 68%)` }}
          animate={
            burst ? { opacity: 1, scale: 1.7 }
              : charging ? { opacity: [0.5, 0.95, 0.5], scale: [1, 1.2, 1] }
              : { opacity: [0.3, 0.7, 0.3], scale: [0.95, 1.06, 0.95] }
          }
          transition={
            burst ? { duration: 0.45, ease: "easeOut" }
              : charging ? { duration: 0.4, repeat: Infinity, ease: "easeInOut" }
              : { duration: 1.1, repeat: Infinity, ease: "easeInOut" }
          }
        />
        {/* Halo de la rareté du tirage (Epic et au-dessus) : monte pendant la charge */}
        {tierGlow && (
          <motion.span
            aria-hidden="true"
            className="absolute -inset-16 rounded-full blur-2xl"
            style={{ background: `radial-gradient(circle, ${tierGlow} 0%, transparent 66%)` }}
            initial={{ opacity: 0 }}
            animate={{ opacity: burst ? 1 : charging ? 0.9 : 0, scale: burst ? 1.8 : 1.1 }}
            transition={{ duration: burst ? 0.4 : 1.1, ease: "easeIn" }}
          />
        )}

        {/* Énergie aspirée vers le sachet pendant la charge */}
        {charging && !reduce && (
          <div className="absolute inset-0" aria-hidden="true">
            {Array.from({ length: CONVERGE_COUNT }).map((_, i) => (
              <Sparkles
                key={i}
                size={10 + (i % 3) * 4}
                className="pack-converge text-amber-100"
                style={{ "--angle": `${(360 / CONVERGE_COUNT) * i}deg`, "--dist": `${150 + (i % 3) * 30}px`, animationDelay: `${(i % 5) * 120}ms` }}
              />
            ))}
          </div>
        )}

        {/* Tremblement + gonflement pendant la charge */}
        <motion.div
          className="relative h-full w-full drop-shadow-[0_16px_26px_rgba(0,0,0,0.55)]"
          animate={
            burst ? { rotate: 0, x: 0, scale: 1 }
              : charging ? { rotate: [0, -3, 3.5, -4.5, 4.5, -3, 0], x: [0, -2, 2, -3, 3, -2, 0], scale: 1.1 }
              : { rotate: 0, x: 0, scale: 1 }
          }
          transition={
            burst ? { duration: 0.1 }
              : charging
                ? { rotate: { duration: 0.3, repeat: Infinity, ease: "linear" }, x: { duration: 0.3, repeat: Infinity, ease: "linear" }, scale: { duration: BURST_AT_MS / 1000 - CHARGE_AT_MS / 1000, ease: "easeIn" } }
                : { duration: 0.2 }
          }
        >
          {/* Bas du sachet : reste en place, contrecoup à la déchirure puis glisse et s'efface vers les cartes */}
          <motion.span
            className="absolute inset-x-0 bottom-0"
            style={{ ...bottomStyle, height: `${100 - TEAR_AT}%` }}
            animate={burst ? { y: [0, 6, 70], scale: [1, 1, 0.9], opacity: [1, 1, 0] } : { y: 0, scale: 1, opacity: 1 }}
            transition={burst ? { duration: 0.65, times: [0, 0.25, 1], ease: "easeOut" } : { duration: 0.2 }}
          />
          {/* Bande du haut : arrachée, elle s'envole en tournoyant */}
          <motion.span
            className="absolute inset-x-0 top-0"
            style={{ ...topStyle, height: `${TEAR_AT}%`, transformOrigin: "100% 100%" }}
            animate={burst ? { y: "-280%", x: "34%", rotate: 38, opacity: 0 } : { y: 0, x: 0, rotate: 0, opacity: 1 }}
            transition={{ duration: 0.55, ease: [0.3, 0, 0.8, 0.5] }}
          />

          {/* Éclat de lumière qui glisse sur le sachet (jusqu'à la déchirure) */}
          {!burst && !reduce && (
            <span aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden" style={silhouette}>
              <span
                className="pack-sheen absolute inset-y-0 left-0 w-[40%]"
                style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.65), transparent)", animationDuration: charging ? "0.7s" : "1.6s" }}
              />
            </span>
          )}

          {/* Trait de lumière le long de la déchirure */}
          {burst && (
            <motion.span
              aria-hidden="true"
              className="absolute -inset-x-[8%] h-[4px] rounded-full bg-gradient-to-r from-transparent via-white to-transparent blur-[1.5px]"
              style={{ top: `${TEAR_AT}%` }}
              initial={{ scaleX: 0, opacity: 1 }}
              animate={{ scaleX: 1.2, opacity: [1, 1, 0] }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          )}
        </motion.div>

        {/* Déchirure : ondes de choc et étincelles jaillissent de la fente */}
        {burst && !reduce && (
          <div className="absolute inset-x-0 h-0" style={{ top: `${TEAR_AT}%` }} aria-hidden="true">
            <Shockwave color={tierGlow || variant.glow} />
            <Shockwave color="rgba(255,255,255,0.7)" delay={0.12} size="14rem" />
            {Array.from({ length: BURST_COUNT }).map((_, i) => (
              <Sparkles
                key={i}
                size={12 + (i % 3) * 5}
                className="sparkle-burst text-amber-100"
                style={{ "--angle": `${(360 / BURST_COUNT) * i}deg`, "--dist": `${100 + (i % 3) * 36}px`, animationDelay: `${(i % 4) * 20}ms` }}
              />
            ))}
          </div>
        )}
      </motion.div>

      <div className="text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-violet-200">
          {SOURCE_LABEL[source] || "Booster"}
        </p>
        <p className="mt-1.5 text-[11px] text-violet-400 animate-pulse motion-reduce:animate-none">
          {burst ? "C'est parti !" : charging ? "Ça vibre…" : "Ouverture en cours…"}
        </p>
      </div>
    </button>
  );
}

/**
 * Récapitulatif : les cartes se retournent en cascade, avec le meilleur
 * tirage et la répartition des raretés en en-tête.
 */
function Summary({ pack, dupSlots, fragmentsFor, bestTier, onConfirm }) {
  const reduce = useReducedMotion();
  const cards = pack.cards;
  const n = cards.length;
  const [shown, setShown] = useState(reduce ? n : 0); // nombre de cartes déjà retournées

  useEffect(() => {
    if (shown >= n) return undefined;
    const t = setTimeout(() => {
      setShown((s) => s + 1);
    }, shown === 0 ? 350 : 110);
    return () => clearTimeout(t);
  }, [shown, n]);

  const newCount = n - dupSlots.size;
  const totalFragments = useMemo(
    () => cards.reduce((sum, c) => sum + (dupSlots.has(c.packSlot) ? fragmentsFor(c) : 0), 0),
    [cards, dupSlots, fragmentsFor],
  );
  const bestCard = useMemo(
    () => cards.find((c) => normalizeTier(c.tier) === bestTier) || cards[0],
    [cards, bestTier],
  );
  const tierCounts = useMemo(() => {
    const m = {};
    for (const c of cards) { const t = normalizeTier(c.tier); m[t] = (m[t] || 0) + 1; }
    return [...RARITY_ORDER].reverse().filter((t) => m[t]).map((t) => ({ tier: t, count: m[t] }));
  }, [cards]);
  const best = RARITY[bestTier];

  return (
    <>
      <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 pb-4">
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="mx-auto max-w-3xl mb-5 text-center"
        >
          <Eyebrow>Booster ouvert</Eyebrow>
          <h2 className="mt-0.5 text-2xl font-bold text-white" style={HEADING}>{n} cartes</h2>

          {/* Meilleur tirage */}
          <div
            className="mx-auto mt-3 inline-flex max-w-full items-center gap-2.5 rounded-2xl border bg-black/25 px-3 py-2 text-left"
            style={{ borderColor: best.glow, boxShadow: `0 0 26px -8px ${best.glow}` }}
          >
            <RarityBadge tier={bestTier} size="md" />
            <span className="min-w-0">
              <span className="block font-mono text-[9.5px] uppercase tracking-widest text-violet-300">Meilleur tirage</span>
              <span className="block truncate text-sm font-semibold text-white">{bestCard.name}</span>
            </span>
          </div>

          {/* Répartition */}
          <ul className="mt-3 flex flex-wrap items-center justify-center gap-1.5" aria-label="Répartition des raretés">
            {tierCounts.map(({ tier, count }) => (
              <li key={tier} className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[11px] font-semibold tabular-nums text-violet-100">
                <RarityDot tier={tier} size={8} />×{count}
              </li>
            ))}
          </ul>

          <p className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-violet-200 tabular-nums">
            <span className="flex items-center gap-1 text-teal-300"><Sparkles size={12} />{newCount} nouveau{newCount > 1 ? "x" : ""}</span>
            {dupSlots.size > 0 && (
              <span className="flex items-center gap-1 text-amber-200"><Copy size={12} />{dupSlots.size} doublon{dupSlots.size > 1 ? "s" : ""}</span>
            )}
            {totalFragments > 0 && (
              <span className="flex items-center gap-1 text-violet-200"><Gem size={12} className="text-violet-300" />+{totalFragments} fragments</span>
            )}
          </p>
        </motion.div>

        {/* Cascade : chaque carte se retourne à son tour */}
        <div className="pointer-events-none mx-auto grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-5">
          {cards.map((card, i) => (
            <motion.div
              key={card.packSlot}
              initial={reduce ? false : { opacity: 0, y: 18, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: i * 0.05, type: "spring", stiffness: 300, damping: 24 }}
            >
              <BoosterCard
                card={card}
                revealed={i < shown}
                isDuplicate={dupSlots.has(card.packSlot)}
                fragments={dupSlots.has(card.packSlot) ? fragmentsFor(card) : 0}
                onReveal={() => {}}
                quiet
              />
            </motion.div>
          ))}
        </div>
      </div>

      <div className="px-4 sm:px-6 pt-2 animate-fadeIn">
        <div className="mx-auto max-w-3xl rounded-2xl border border-white/10 bg-violet-950/80 backdrop-blur-xl p-3 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.8)]">
          <GameButton size="lg" full onClick={() => { haptics.success(); onConfirm(); }}>
            <PackagePlus size={17} />Ajouter les {n} cartes à ma collection
          </GameButton>
        </div>
      </div>
    </>
  );
}

/**
 * Ouverture d'un booster — page plein écran en trois temps :
 *  1. suspense (le sachet, violet / rose / bleu selon le booster, charge puis se déchire) ;
 *  2. cartes une par une (PackDeck) : chaque carte se retourne seule, un tap ou un
 *     glissé passe à la suivante, « Tout révéler » à tout moment ;
 *  3. récapitulatif : meilleur tirage, répartition, cartes retournées en cascade,
 *     puis un bouton les ajoute TOUTES à la collection (un doublon est converti
 *     en Anigold et en fragments).
 *
 * `collection` (état persistant du joueur) sert à repérer les doublons : un
 * personnage déjà possédé, ou qui apparaît deux fois dans le même tirage,
 * reçoit un badge. Rendu dans un portail sur <body> : plein écran malgré les
 * `transform` de la page (pull-to-refresh, transitions d'onglets).
 */
export function PackOpening({ pack, onConfirm, collection = {} }) {
  const [stage, setStage] = useState("intro"); // intro | deck | summary
  const [, setRevealed] = useState(() => new Set());

  // Plein écran : on fige le défilement de la page derrière.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Doublon = déjà dans la collection avant ce booster, OU 2e apparition du
  // même personnage dans ce même tirage (generatePack peut, rarement, tirer
  // deux fois le même id si un palier est très restreint).
  const dupSlots = useMemo(() => {
    const seen = new Set();
    const dup = new Set();
    for (const c of pack.cards) {
      if (collection[c.id] || seen.has(c.id)) dup.add(c.packSlot);
      seen.add(c.id);
    }
    return dup;
  }, [pack, collection]);

  const bestTier = useMemo(() => bestTierOf(pack.cards), [pack]);
  const fragmentsFor = useCallback((card) => fragmentsForDuplicate(normalizeTier(card.tier)), []);
  const startDeck = useCallback(() => setStage((st) => (st === "intro" ? "deck" : st)), []);
  const revealCard = useCallback((slot) => setRevealed((s) => new Set(s).add(slot)), []);
  const showSummary = useCallback(() => {
    setRevealed(new Set(pack.cards.map((c) => c.packSlot)));
    setStage("summary");
  }, [pack]);

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex flex-col text-violet-50"
      style={{
        fontFamily: "'Inter',sans-serif",
        background: "radial-gradient(ellipse at 50% 0%, #4c1d95 0%, #2e1065 38%, #170a35 100%)",
        paddingTop: "max(0.75rem, env(safe-area-inset-top))",
        paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))",
      }}
      role="dialog"
      aria-modal="true"
      aria-label={SOURCE_LABEL[pack.source] || "Booster"}
    >
      {/* Ambiance : halos et braises, les mêmes à tous les temps de l'ouverture */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -left-20 w-72 h-72 rounded-full bg-violet-500/25 blur-3xl" />
        <div className="absolute -bottom-24 -right-16 w-72 h-72 rounded-full bg-fuchsia-500/15 blur-3xl" />
        <Embers count={stage === "intro" ? 22 : 14} />
      </div>

      <header className="relative z-10 flex items-center justify-between px-5 pt-1 pb-2">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-white" style={HEADING}>
          <Sparkles size={15} className="text-amber-300" />{SOURCE_LABEL[pack.source] || "Booster"}
        </p>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-violet-400">
          {stage === "intro" ? "Ouverture" : stage === "deck" ? "Révélation" : "Récapitulatif"}
        </p>
      </header>

      <div className="relative z-10 flex flex-1 min-h-0 flex-col">
        {stage === "intro" && <PackIntro source={pack.source} bestTier={bestTier} onDone={startDeck} />}

        {stage === "deck" && (
          <PackDeck
            cards={pack.cards}
            dupSlots={dupSlots}
            fragmentsFor={fragmentsFor}
            onRevealCard={revealCard}
            onFinish={showSummary}
            onRevealAll={showSummary}
          />
        )}

        {stage === "summary" && (
          <Summary pack={pack} dupSlots={dupSlots} fragmentsFor={fragmentsFor} bestTier={bestTier} onConfirm={onConfirm} />
        )}
      </div>
    </div>,
    document.body
  );
}
