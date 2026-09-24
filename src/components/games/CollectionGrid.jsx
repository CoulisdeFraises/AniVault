import { useState, useMemo } from "react";
import { HeartCrack } from "lucide-react";
import { RARITY, RARITY_ORDER } from "../../utils/waifinity";
import { RarityBadge } from "./RarityBadge";

function TierFilterChip({ active, onClick, children }) {
  return (
    <button onClick={onClick}
      className={`flex-shrink-0 h-7 px-2.5 rounded-full text-[11px] font-medium border whitespace-nowrap active:scale-95 transition-all motion-reduce:transition-none ${
        active ? "bg-amber-400 border-amber-400 text-violet-950 font-semibold" : "bg-violet-900/40 border-white/10 text-violet-200 hover:bg-white/10"}`}>
      {children}
    </button>
  );
}

export function CollectionGrid({ collectionList, poolSize }) {
  const [tierFilter, setTierFilter] = useState("all");

  const filtered = useMemo(
    () => tierFilter === "all" ? collectionList : collectionList.filter((c) => c.tier === tierFilter),
    [collectionList, tierFilter]
  );

  if (!collectionList.length) {
    return (
      <div className="rounded-2xl border border-dashed border-white/15 bg-violet-900/20 py-10 text-center">
        <HeartCrack size={26} className="mx-auto text-violet-500 mb-2" />
        <p className="text-sm text-violet-200">Ta collection est vide pour le moment</p>
        <p className="text-[11px] text-violet-400 mt-1">Ouvre un booster pour adopter ta première waifu !</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-violet-300">{collectionList.length} personnage{collectionList.length > 1 ? "s" : ""} sur {poolSize} dans le bassin</p>
      </div>
      <div className="flex gap-1.5 overflow-x-auto scrollbar-none -mx-4 px-4 mb-3">
        <TierFilterChip active={tierFilter === "all"} onClick={() => setTierFilter("all")}>Tout</TierFilterChip>
        {RARITY_ORDER.map((t) => (
          <TierFilterChip key={t} active={tierFilter === t} onClick={() => setTierFilter(t)}>{RARITY[t].label}</TierFilterChip>
        ))}
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5">
        {filtered.map((c) => {
          const r = RARITY[c.tier] || RARITY.commune;
          return (
            <div key={c.id} className={`relative rounded-xl overflow-hidden border-2 ${r.border} bg-violet-950`}>
              <div className="aspect-[3/4] bg-violet-900">
                {c.image
                  ? <img src={c.image} alt="" loading="lazy" className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center text-violet-600">?</div>}
                <div className="absolute top-1 left-1"><RarityBadge tier={c.tier} /></div>
                {c.count > 1 && (
                  <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-black/70 text-white text-[9.5px] font-mono font-bold flex items-center justify-center">×{c.count}</span>
                )}
              </div>
              <div className="px-1.5 py-1 bg-black/40">
                <p className="text-[10px] font-semibold text-white leading-tight truncate">{c.name}</p>
                <p className="text-[8.5px] text-violet-300 truncate">{c.series}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
