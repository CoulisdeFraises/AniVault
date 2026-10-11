import { useState, useEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import { Sparkles, PackagePlus } from "lucide-react";
import { BoosterCard } from "./BoosterCard";
import { PackDeck } from "./PackDeck";
import { GameButton } from "./ui";
import { haptics } from "../../utils/haptics";
import { normalizeTier } from "../../utils/waifinity";
import { fragmentsForDuplicate } from "../../utils/waifinityCosmetics";

const SOURCE_LABEL = {
  free: "Booster gratuit", standard: "Booster normal", chance: "Booster", targeted: "Booster ciblé",
  waifu: "Booster Waifus", husbando: "Booster Husbandos", wish: "Booster Vœu",
};

const INTRO_DURATION_MS = 1500;
const BURST_DELAY_MS = 950; // déclenche la déchirure peu avant la fin du suspense
const BURST_COUNT = 10;

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

/**
 * Suspense avant la révélation : le sachet arrive, tremble de plus en plus,
 * puis on le déchire d'un trait en haut dans un éclat de lumière. Tap pour passer.
 */
function PackIntro({ source, onDone }) {
  const [burst, setBurst] = useState(false);
  const variant = PACK_VARIANT[source] || PACK_DEFAULT;

  useEffect(() => {
    const t1 = setTimeout(onDone, INTRO_DURATION_MS);
    const t2 = setTimeout(() => setBurst(true), BURST_DELAY_MS);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [onDone]);

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

  return (
    <button
      onClick={onDone}
      aria-label="Ouverture du booster — toucher pour passer"
      className="flex-1 w-full flex flex-col items-center justify-center gap-10 text-violet-200"
    >
      {/* Entrée du sachet */}
      <motion.div
        initial={{ scale: 0.55, opacity: 0, y: 36, rotate: -8 }}
        animate={{ scale: 1, opacity: 1, y: 0, rotate: 0 }}
        transition={{ type: "spring", stiffness: 220, damping: 16 }}
        className="relative aspect-[2/3] w-[min(64vw,15rem)]"
      >
        {/* Halo à la couleur du sachet, qui pulse puis éclate à l'ouverture */}
        <motion.span
          aria-hidden="true"
          className="absolute -inset-14 rounded-full blur-2xl"
          style={{ background: `radial-gradient(circle, ${variant.glow} 0%, transparent 68%)` }}
          animate={burst ? { opacity: 1, scale: 1.5 } : { opacity: [0.3, 0.85, 0.3], scale: [0.95, 1.08, 0.95] }}
          transition={burst ? { duration: 0.4, ease: "easeOut" } : { duration: 0.9, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Tremblement qui s'intensifie avant la déchirure */}
        <motion.div
          className="relative h-full w-full drop-shadow-[0_16px_26px_rgba(0,0,0,0.55)]"
          animate={burst ? { rotate: 0, x: 0 } : { rotate: [0, -2, 2.5, -3.5, 4, -5, 5, 0], x: [0, -1, 1, -2, 2, -3, 3, 0] }}
          transition={burst ? { duration: 0.1 } : { delay: 0.5, duration: 0.45, ease: "linear" }}
        >
          {/* Bas du sachet : reste en place, petit contrecoup à la déchirure */}
          <motion.span
            className="absolute inset-x-0 bottom-0"
            style={{ ...bottomStyle, height: `${100 - TEAR_AT}%` }}
            animate={burst ? { y: [0, 5, 0] } : { y: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          />
          {/* Bande du haut : arrachée, elle s'envole en basculant */}
          <motion.span
            className="absolute inset-x-0 top-0"
            style={{ ...topStyle, height: `${TEAR_AT}%`, transformOrigin: "100% 100%" }}
            animate={burst ? { y: "-260%", x: "28%", rotate: 24, opacity: 0 } : { y: 0, x: 0, rotate: 0, opacity: 1 }}
            transition={{ duration: 0.5, ease: [0.3, 0, 0.8, 0.5] }}
          />

          {/* Trait de lumière le long de la déchirure */}
          {burst && (
            <motion.span
              aria-hidden="true"
              className="absolute -inset-x-[6%] h-[3px] rounded-full bg-gradient-to-r from-transparent via-white to-transparent blur-[1.5px]"
              style={{ top: `${TEAR_AT}%` }}
              initial={{ scaleX: 0, opacity: 1 }}
              animate={{ scaleX: 1.1, opacity: [1, 1, 0] }}
              transition={{ duration: 0.45, ease: "easeOut" }}
            />
          )}
        </motion.div>

        {/* Étincelles : jaillissent de la déchirure */}
        {burst && (
          <div className="absolute inset-x-0 h-0" style={{ top: `${TEAR_AT}%` }} aria-hidden="true">
            {Array.from({ length: BURST_COUNT }).map((_, i) => (
              <Sparkles
                key={i}
                size={12 + (i % 3) * 5}
                className="sparkle-burst text-amber-100"
                style={{ "--angle": `${(360 / BURST_COUNT) * i}deg`, "--dist": `${90 + (i % 2) * 30}px`, animationDelay: `${(i % 4) * 15}ms` }}
              />
            ))}
          </div>
        )}
      </motion.div>

      <p className="font-mono text-[11px] uppercase tracking-widest text-violet-300 animate-pulse motion-reduce:animate-none">
        {SOURCE_LABEL[source] || "Booster"}…
      </p>
    </button>
  );
}

/**
 * Ouverture d'un booster — page plein écran en trois temps :
 *  1. suspense (le sachet, violet / rose / bleu selon le booster, se déchire en haut) ;
 *  2. cartes une par une (PackDeck) : chaque carte se retourne seule, un tap ou un
 *     glissé passe à la suivante, « Tout révéler » à tout moment ;
 *  3. récapitulatif : les cartes en grille, puis un bouton les ajoute TOUTES à
 *     la collection (un doublon est converti en Anigold et en fragments).
 *
 * `collection` (état persistant du joueur) sert à repérer les doublons : un
 * personnage déjà possédé, ou qui apparaît deux fois dans le même tirage,
 * reçoit un badge. Rendu dans un portail sur <body> : plein écran malgré les
 * `transform` de la page (pull-to-refresh, transitions d'onglets).
 */
export function PackOpening({ pack, onConfirm, collection = {} }) {
  const [stage, setStage] = useState("intro"); // intro | deck | summary
  const [revealed, setRevealed] = useState(() => new Set());

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

  const fragmentsFor = useCallback((card) => fragmentsForDuplicate(normalizeTier(card.tier)), []);
  const startDeck = useCallback(() => setStage((st) => (st === "intro" ? "deck" : st)), []);
  const revealCard = useCallback((slot) => setRevealed((s) => new Set(s).add(slot)), []);
  const showSummary = useCallback(() => {
    setRevealed(new Set(pack.cards.map((c) => c.packSlot)));
    setStage("summary");
  }, [pack]);

  const n = pack.cards.length;
  const newCount = n - dupSlots.size;

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
      {/* Halos d'ambiance (même vocabulaire que l'Agenda) */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -left-20 w-72 h-72 rounded-full bg-violet-500/25 blur-3xl" />
        <div className="absolute -bottom-24 -right-16 w-72 h-72 rounded-full bg-fuchsia-500/15 blur-3xl" />
      </div>

      <header className="relative z-10 flex items-center justify-between px-5 pt-1 pb-2">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-white" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>
          <Sparkles size={15} className="text-amber-300" />{SOURCE_LABEL[pack.source] || "Booster"}
        </p>
        {stage === "summary" && (
          <p className="text-xs text-violet-300 tabular-nums">{newCount} nouveau{newCount > 1 ? "x" : ""}{dupSlots.size > 0 && ` · ${dupSlots.size} doublon${dupSlots.size > 1 ? "s" : ""}`}</p>
        )}
      </header>

      <div className="relative z-10 flex flex-1 min-h-0 flex-col">
        {stage === "intro" && <PackIntro source={pack.source} onDone={startDeck} />}

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
          <>
            <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 pb-4">
              <p className="mb-4 text-sm text-violet-200 max-w-md">
                Voici tes {n} cartes. Les doublons seront convertis en Anigold et en fragments.
              </p>
              <div className="mx-auto grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-5">
                {pack.cards.map((card, i) => (
                  <motion.div
                    key={card.packSlot}
                    initial={{ opacity: 0, y: 18, scale: 0.92 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ delay: i * 0.05, type: "spring", stiffness: 300, damping: 24 }}
                  >
                    <BoosterCard
                      card={card}
                      revealed={revealed.has(card.packSlot)}
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
        )}
      </div>
    </div>,
    document.body
  );
}
