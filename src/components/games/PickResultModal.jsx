import { Coins, PartyPopper, Heart } from "lucide-react";
import { Modal } from "../Modal/Modal";
import { RARITY, normalizeTier } from "../../utils/waifinity";
import { RarityBadge } from "./RarityBadge";
import { GenderBadge } from "./GenderBadge";

export function PickResultModal({ result, onClose }) {
  const { card, isDuplicate, coinsGained } = result;
  const r = RARITY[normalizeTier(card.tier)];

  return (
    <Modal onClose={onClose} maxWidth="max-w-xs" zIndex="z-50">
      <div className="p-5 text-center">
        <div className={`relative w-32 h-44 mx-auto rounded-xl overflow-hidden border-2 ${r.border} mb-4`}
          style={{ boxShadow: `0 0 26px -4px ${r.glow}` }}>
          {card.image
            ? <img src={card.image} alt="" className="w-full h-full object-cover" />
            : <div className="w-full h-full bg-violet-900 flex items-center justify-center text-violet-600">?</div>}
          {r.shine && <div className="card-shine" />}
        </div>

        <div className="flex justify-center mb-1.5"><RarityBadge tier={card.tier} size="md" /></div>
        <p className={`text-[11px] mb-2 ${r.text}`}>{r.emoji} {r.desc}</p>

        <div className="flex items-center justify-center gap-1.5">
          <p className="text-base font-bold text-white" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>{card.name}</p>
          <GenderBadge gender={card.gender} />
        </div>
        <p className="text-xs text-violet-400">{card.series}</p>
        {card.favourites > 0 && (
          <p className="flex items-center justify-center gap-1 text-[11px] text-violet-400 mt-1 mb-4">
            <Heart size={10} className="text-pink-400" fill="currentColor" />
            {card.favourites.toLocaleString("fr-FR")} favoris sur AniList
          </p>
        )}
        {!(card.favourites > 0) && <div className="mb-4" />}

        {isDuplicate ? (
          <div className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-amber-400/10 border border-amber-400/30 text-amber-300 text-sm font-semibold mb-4">
            <Coins size={16} />Déjà dans ta collection · +{coinsGained} Waifu Coins
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-teal-400/10 border border-teal-400/30 text-teal-300 text-sm font-semibold mb-4">
            <PartyPopper size={16} />Nouveau personnage adopté !
          </div>
        )}

        <button onClick={onClose} className="w-full py-2.5 rounded-xl bg-amber-400 text-violet-950 text-sm font-semibold active:scale-[0.98]">
          Continuer
        </button>
      </div>
    </Modal>
  );
}
