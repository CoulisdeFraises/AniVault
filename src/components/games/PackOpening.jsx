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

const INTRO_DURATION_MS = 1100;
const BURST_DELAY_MS = 620; // déclenche l'explosion peu avant la fin du suspense
const BURST_COUNT = 8;

/** Suspense avant la révélation : la pochette « charge » puis s'ouvre en deux. Tap pour passer. */
function PackIntro({ onDone }) {
  const [burst, setBurst] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(onDone, INTRO_DURATION_MS);
    const t2 = setTimeout(() => setBurst(true), BURST_DELAY_MS); // explosion peu avant la fin
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [onDone]);

  return (
      <button
        onClick={onDone}
        aria-label="Ouverture du booster — toucher pour passer"
        className="flex-1 w-full flex flex-col items-center justify-center gap-5 text-violet-200"
      >
        <motion.div
          initial={{ scale: 0.5, opacity: 0, rotate: -6 }}
          animate={{ scale: [0.5, 1.1, 0.96, 1.04, 1], opacity: 1, rotate: [-6, 3, -1.5, 0] }}
          transition={{ duration: 0.85, ease: "easeOut" }}
          className="relative w-28 h-36"
        >
          <motion.span
            className="absolute inset-0 rounded-2xl"
            style={{ boxShadow: "0 0 0px 0px rgba(251,191,36,0.6)" }}
            animate={{ boxShadow: ["0 0 10px 2px rgba(251,191,36,0.35)", "0 0 42px 10px rgba(251,191,36,0.65)", "0 0 10px 2px rgba(251,191,36,0.35)"] }}
            transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
          />

          {/* Pochette de booster en deux moitiés, séparées par un bord déchiré
              VERTICAL — au burst, chaque moitié part sur son côté (façon
              Pokémon TCG Pocket), plutôt qu'un déchirement horizontal. */}
          <motion.span
            className="absolute inset-y-0 left-0 w-1/2 rounded-l-2xl bg-gradient-to-br from-amber-400/30 to-fuchsia-500/30 border border-amber-300/50 border-r-0"
            style={{ clipPath: "polygon(0% 0%,100% 0%,84% 12%,97% 24%,80% 36%,95% 50%,81% 64%,96% 78%,85% 90%,100% 100%,0% 100%)" }}
            animate={burst ? { x: "-65%", rotate: -16, opacity: 0 } : { x: 0, rotate: 0, opacity: 1 }}
            transition={{ duration: 0.45, ease: "easeIn" }}
          />
          <motion.span
            className="absolute inset-y-0 right-0 w-1/2 rounded-r-2xl bg-gradient-to-bl from-amber-400/30 to-fuchsia-500/30 border border-amber-300/50 border-l-0"
            style={{ clipPath: "polygon(100% 0%,0% 0%,16% 12%,3% 24%,20% 36%,5% 50%,19% 64%,4% 78%,15% 90%,0% 100%,100% 100%)" }}
            animate={burst ? { x: "65%", rotate: 16, opacity: 0 } : { x: 0, rotate: 0, opacity: 1 }}
            transition={{ duration: 0.45, ease: "easeIn" }}
          />
          {/* Ligne de scellé façon papier alu, avant l'ouverture */}
          {!burst && (
            <span className="absolute left-[10%] right-[10%] top-[42%] h-[2.5px] bg-gradient-to-r from-transparent via-white/70 to-transparent" />
          )}

          <span className="absolute inset-0 flex items-center justify-center">
            <Sparkles size={34} className="text-amber-200" />
          </span>

          {burst && (
            <span
              className="tear-beam absolute inset-y-[-15%] left-1/2 w-3 bg-gradient-to-b from-transparent via-amber-100 to-transparent blur-[2px]"
              aria-hidden="true"
            />
          )}
          {burst && Array.from({ length: BURST_COUNT }).map((_, i) => (
            <Sparkles
              key={i}
              size={12 + (i % 3) * 4}
              className="sparkle-burst text-amber-200"
              style={{ "--angle": `${(360 / BURST_COUNT) * i}deg`, "--dist": `${56 + (i % 2) * 18}px`, animationDelay: `${(i % 4) * 15}ms` }}
              aria-hidden="true"
            />
          ))}
        </motion.div>
        <p className="font-mono text-[11px] uppercase tracking-widest text-violet-300 animate-pulse motion-reduce:animate-none">
          Ouverture du booster…
        </p>
      </button>
  );
}

/**
 * Ouverture d'un booster — page plein écran en trois temps :
 *  1. suspense (la pochette s'ouvre) ;
 *  2. cartes une par une (PackDeck) : tap ou glissé pour révéler puis passer à
 *     la suivante, « Tout révéler » à tout moment ;
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
        {stage === "intro" && <PackIntro onDone={startDeck} />}

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
