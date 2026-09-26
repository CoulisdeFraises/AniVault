import { useState, useEffect, useMemo } from "react";
import { motion } from "motion/react";
import { Sparkles, Heart } from "lucide-react";
import { BoosterCard } from "./BoosterCard";
import { haptics } from "../../utils/haptics";

const SOURCE_LABEL = {
  free: "Booster gratuit", chance: "Booster Chance+", targeted: "Booster ciblé",
  waifu: "Booster Waifus", husbando: "Booster Husbandos",
};

const INTRO_DURATION_MS = 1100;

/**
 * Ouverture d'un booster de 10 : un court suspense animé (le booster qui
 * "charge") précède la révélation, puis chaque carte se révèle au tap, et un
 * tap sur une carte révélée la sélectionne comme choix final. Les 9 autres
 * sont perdues à la confirmation — donc pas de confirmation "en un clic" pour
 * limiter les erreurs de manipulation.
 *
 * `collection` (état persistant du joueur) sert à repérer les doublons parmi
 * les cartes de CE booster : un personnage déjà possédé, ou qui apparaît
 * deux fois dans le même tirage, reçoit un petit badge sur sa carte révélée.
 */
export function PackOpening({ pack, onConfirm, collection = {} }) {
  const [intro, setIntro] = useState(true);
  const [revealed, setRevealed] = useState(() => new Set());
  const [selected, setSelected] = useState(null);

  // Court suspense avant de révéler la grille — tap pour passer directement.
  useEffect(() => {
    const t = setTimeout(() => setIntro(false), INTRO_DURATION_MS);
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
  const selectedCard = pack.cards.find((c) => c.packSlot === selected) || null;

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
          initial={{ scale: 0.5, opacity: 0, rotate: -10 }}
          animate={{ scale: [0.5, 1.12, 0.95, 1.05, 1], opacity: 1, rotate: [-10, 6, -3, 0] }}
          transition={{ duration: 0.85, ease: "easeOut" }}
          className="relative w-24 h-28"
        >
          <motion.span
            className="absolute inset-0 rounded-2xl"
            style={{ boxShadow: "0 0 0px 0px rgba(251,191,36,0.6)" }}
            animate={{ boxShadow: ["0 0 10px 2px rgba(251,191,36,0.35)", "0 0 42px 10px rgba(251,191,36,0.65)", "0 0 10px 2px rgba(251,191,36,0.35)"] }}
            transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
          />
          <span className="absolute inset-0 rounded-2xl bg-gradient-to-br from-amber-400/30 to-fuchsia-500/30 border border-amber-300/50" />
          <span className="absolute inset-0 flex items-center justify-center">
            <Sparkles size={34} className="text-amber-200" />
          </span>
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
          ? "Choisis la carte que tu veux ajouter à ta collection — les autres seront perdues."
          : "Tape sur chaque carte pour la révéler."}
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {pack.cards.map((card) => (
          <BoosterCard
            key={card.packSlot}
            card={card}
            revealed={revealed.has(card.packSlot)}
            selected={selected === card.packSlot}
            isDuplicate={dupSlots.has(card.packSlot)}
            onReveal={() => setRevealed((s) => new Set(s).add(card.packSlot))}
            onSelect={() => setSelected((cur) => (cur === card.packSlot ? null : card.packSlot))}
          />
        ))}
      </div>

      {/* Barre de confirmation, sticky au-dessus de la BottomNav */}
      {selectedCard && (
        <div className="fixed inset-x-0 bottom-0 z-30 pb-nav animate-fadeIn">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 pb-3">
            <div className="flex items-center gap-3 rounded-2xl bg-violet-900/95 backdrop-blur-xl border border-white/10 shadow-2xl p-3">
              <div className="w-11 h-14 rounded-lg overflow-hidden bg-violet-950 flex-shrink-0">
                {selectedCard.image && <img src={selectedCard.image} alt="" className="w-full h-full object-cover" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white truncate">{selectedCard.name}</p>
                <p className="text-[11px] text-violet-300 truncate">{selectedCard.series}</p>
              </div>
              <button
                onClick={() => { haptics.success(); onConfirm(selectedCard.packSlot); }}
                className="flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-400 text-violet-950 text-sm font-semibold active:scale-95 transition-transform"
              >
                <Heart size={14} fill="currentColor" />Adopter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
