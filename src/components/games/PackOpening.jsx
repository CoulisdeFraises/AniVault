import { useState, useEffect, useMemo } from "react";
import { motion } from "motion/react";
import { Sparkles, PackagePlus } from "lucide-react";
import { BoosterCard } from "./BoosterCard";
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

/**
 * Ouverture d'un booster de 10 : un court suspense animé (le booster qui
 * "charge") précède la révélation, puis chaque carte se révèle au tap. Une
 * fois les 10 révélées, un bouton les ajoute TOUTES à la collection (plus de
 * choix d'une seule carte) ; un doublon est converti en Anigold.
 *
 * `collection` (état persistant du joueur) sert à repérer les doublons parmi
 * les cartes de CE booster : un personnage déjà possédé, ou qui apparaît
 * deux fois dans le même tirage, reçoit un petit badge sur sa carte révélée.
 */
export function PackOpening({ pack, onConfirm, collection = {} }) {
  const [intro, setIntro] = useState(true);
  const [burst, setBurst] = useState(false);
  const [revealed, setRevealed] = useState(() => new Set());

  // Court suspense avant de révéler la grille — tap pour passer directement.
  useEffect(() => {
    const t = setTimeout(() => setIntro(false), INTRO_DURATION_MS);
    return () => clearTimeout(t);
  }, []);

  // Petite explosion de sparkles juste avant la fin du suspense.
  useEffect(() => {
    const t = setTimeout(() => setBurst(true), BURST_DELAY_MS);
    return () => clearTimeout(t);
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

  const allRevealed = revealed.size === pack.cards.length;

  function revealAll() {
    haptics.tap();
    setRevealed(new Set(pack.cards.map((c) => c.packSlot)));
  }

  if (intro) {
    return (
      <button
        onClick={() => setIntro(false)}
        aria-label="Ouverture du booster — toucher pour passer"
        className="w-full flex flex-col items-center justify-center gap-5 py-24 text-violet-200"
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

  return (
    <div className="pb-28">
      <div className="flex items-center justify-between mb-3">
        <p className="font-mono text-[10px] uppercase tracking-widest text-violet-500">
          {SOURCE_LABEL[pack.source] || "Booster"} · {revealed.size}/{pack.cards.length}
        </p>
        {!allRevealed && (
          <button onClick={revealAll} className="flex items-center gap-1.5 text-xs text-amber-300 hover:text-amber-200 active:scale-95">
            <Sparkles size={13} />Tout révéler
          </button>
        )}
      </div>

      <p className="text-sm text-violet-200 mb-4">
        {allRevealed
          ? "Les 10 cartes sont à toi ! Les doublons seront convertis en Anigold et en fragments."
          : "Tape sur chaque carte pour la révéler."}
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {pack.cards.map((card) => (
          <BoosterCard
            key={card.packSlot}
            card={card}
            revealed={revealed.has(card.packSlot)}
            isDuplicate={dupSlots.has(card.packSlot)}
            fragments={dupSlots.has(card.packSlot) ? fragmentsForDuplicate(normalizeTier(card.tier)) : 0}
            onReveal={() => setRevealed((s) => new Set(s).add(card.packSlot))}
          />
        ))}
      </div>

      {/* Barre de récupération, sticky au-dessus de la BottomNav — dispo une fois tout révélé */}
      {allRevealed && (
        <div className="fixed inset-x-0 bottom-0 z-30 pb-nav animate-fadeIn">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 pb-3">
            <div className="rounded-2xl bg-violet-900/95 backdrop-blur-xl border border-white/10 shadow-2xl p-3">
              <button
                onClick={() => { haptics.success(); onConfirm(); }}
                className="w-full flex items-center justify-center gap-2 px-3.5 py-3 rounded-xl bg-amber-400 text-violet-950 text-sm font-semibold active:scale-95 transition-transform"
              >
                <PackagePlus size={16} />Ajouter les {pack.cards.length} cartes à ma collection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
