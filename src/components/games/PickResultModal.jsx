import { Coins, PartyPopper } from "lucide-react";
import { Modal } from "../Modal/Modal";
import { RARITY } from "../../utils/waifinity";
import { RarityBadge } from "./RarityBadge";

export function PickResultModal({ result, onClose }) {
  const { card, isDuplicate, coinsGained } = result;
  const r = RARITY[card.tier] || RARITY.commune;

  return (
    <Modal onClose={onClose} maxWidth="max-w-xs" zIndex="z-50">
      <div className="p-5 text-center">
        <div className="relative w-28 h-36 mx-auto rounded-xl overflow-hidden border-2 mb-4"
          style={{ boxShadow: `0 0 24px -4px ${r.glow}` }}>
          <div className={`absolute inset-0 border-2 rounded-xl pointer-events-none ${r.border}`} />
          {card.image
            ? <img src={card.image} alt="" className="w-full h-full object-cover" />
            : <div className="w-full h-full bg-violet-900 flex items-center justify-center text-violet-600">?</div>}
        </div>

        <div className="flex justify-center mb-1.5"><RarityBadge tier={card.tier} size="md" /></div>
        <p className="text-base font-bold text-white" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>{card.name}</p>
        <p className="text-xs text-violet-400 mb-4">{card.series}</p>

        {isDuplicate ? (
          <div className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-amber-400/10 border border-amber-400/30 text-amber-300 text-sm font-semibold mb-4">
            <Coins size={16} />Déjà dans ta collection · +{coinsGained} Waifu Coins
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-teal-400/10 border border-teal-400/30 text-teal-300 text-sm font-semibold mb-4">
            <PartyPopper size={16} />Nouvelle waifu adoptée !
          </div>
        )}

        <button onClick={onClose} className="w-full py-2.5 rounded-xl bg-amber-400 text-violet-950 text-sm font-semibold active:scale-[0.98]">
          Continuer
        </button>
      </div>
    </Modal>
  );
}
