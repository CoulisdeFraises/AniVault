import { useState } from "react";
import { Sparkles, Heart } from "lucide-react";
import { BoosterCard } from "./BoosterCard";
import { haptics } from "../../utils/haptics";

const SOURCE_LABEL = { free: "Booster gratuit", chance: "Booster Chance+", targeted: "Booster ciblé" };

/**
 * Ouverture d'un booster de 10 : chaque carte se révèle au tap, puis un tap
 * sur une carte révélée la sélectionne comme choix final. Les 9 autres sont
 * perdues à la confirmation — donc pas de confirmation "en un clic" pour
 * limiter les erreurs de manipulation.
 */
export function PackOpening({ pack, onConfirm }) {
  const [revealed, setRevealed] = useState(() => new Set());
  const [selected, setSelected] = useState(null);

  const allRevealed = revealed.size === pack.cards.length;
  const selectedCard = pack.cards.find((c) => c.packSlot === selected) || null;

  function revealAll() {
    haptics.tap();
    setRevealed(new Set(pack.cards.map((c) => c.packSlot)));
  }

  return (
    <div className="pb-28">
      <div className="flex items-center justify-between mb-3">
        <p className="font-mono text-[11px] uppercase tracking-widest text-violet-400">{SOURCE_LABEL[pack.source] || "Booster"}</p>
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
            onReveal={() => setRevealed((s) => new Set(s).add(card.packSlot))}
            onSelect={() => setSelected((cur) => (cur === card.packSlot ? null : card.packSlot))}
          />
        ))}
      </div>

      {/* Barre de confirmation, sticky au-dessus de la BottomNav */}
      {selectedCard && (
        <div className="fixed inset-x-0 bottom-0 z-30 pb-nav animate-fadeIn">
          <div className="max-w-3xl mx-auto px-4 pb-3">
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
