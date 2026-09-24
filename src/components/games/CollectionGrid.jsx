import { useState, useMemo } from "react";
import { HeartCrack, Search, X } from "lucide-react";
import {
  RARITY, RARITY_ORDER, GENDER_FILTER_LABEL, matchesGender, countByTier, normalizeTier,
} from "../../utils/waifinity";
import { RarityBadge } from "./RarityBadge";
import { GenderBadge } from "./GenderBadge";
import { PillTabs } from "./PillTabs";

const SORTS = [
  { key: "recent", label: "Récents" },
  { key: "rarity", label: "Rareté" },
  { key: "name",   label: "Nom" },
];
const GENDER_TABS = Object.entries(GENDER_FILTER_LABEL).map(([key, label]) => ({ key, label }));

function CollectionCard({ c }) {
  const r = RARITY[normalizeTier(c.tier)];
  return (
    <div className={`relative rounded-xl overflow-hidden border-2 ${r.border} bg-violet-950`}
      style={r.shine ? { boxShadow: `0 0 14px -3px ${r.glow}` } : undefined}>
      <div className="relative aspect-[3/4] bg-violet-900">
        {c.image
          ? <img src={c.image} alt="" loading="lazy" className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center text-violet-600">?</div>}
        <div className="absolute top-1 left-1"><RarityBadge tier={c.tier} /></div>
        {c.count > 1 && (
          <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-black/70 text-white text-[9.5px] font-mono font-bold flex items-center justify-center">×{c.count}</span>
        )}
        {r.shine && <div className="card-shine" />}
      </div>
      <div className="px-2 py-1.5 bg-black/50">
        <div className="flex items-center gap-1">
          <p className="text-[11px] font-semibold text-white leading-tight truncate flex-1">{c.name}</p>
          <GenderBadge gender={c.gender} />
        </div>
        <p className="text-[9.5px] text-violet-300 truncate">{c.series}</p>
      </div>
    </div>
  );
}

export function CollectionGrid({ collectionList, pool }) {
  const [tierFilter, setTierFilter]     = useState("all");
  const [genderFilter, setGenderFilter] = useState("all");
  const [sort, setSort]                 = useState("recent");
  const [query, setQuery]               = useState("");

  const poolTotals  = useMemo(() => countByTier(pool), [pool]);
  const ownedTotals = useMemo(() => countByTier(collectionList), [collectionList]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = collectionList.filter((c) =>
      (tierFilter === "all" || normalizeTier(c.tier) === tierFilter) &&
      matchesGender(c, genderFilter) &&
      (!q || c.name.toLowerCase().includes(q) || (c.series || "").toLowerCase().includes(q))
    );
    if (sort === "rarity") {
      list = [...list].sort((a, b) =>
        RARITY_ORDER.indexOf(normalizeTier(b.tier)) - RARITY_ORDER.indexOf(normalizeTier(a.tier)) || a.name.localeCompare(b.name));
    } else if (sort === "name") {
      list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    }
    return list;
  }, [collectionList, tierFilter, genderFilter, sort, query]);

  if (!collectionList.length) {
    return (
      <div className="rounded-2xl border border-dashed border-white/15 bg-violet-900/20 py-10 text-center">
        <HeartCrack size={26} className="mx-auto text-violet-500 mb-2" />
        <p className="text-sm text-violet-200">Ta collection est vide pour le moment</p>
        <p className="text-[11px] text-violet-400 mt-1">Ouvre un booster pour adopter ton premier personnage !</p>
      </div>
    );
  }

  const pct = pool.length ? Math.min(100, (collectionList.length / pool.length) * 100) : 0;
  const hasFilters = tierFilter !== "all" || genderFilter !== "all" || query.trim();

  return (
    <div className="space-y-4">
      {/* Progression globale */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <p className="font-mono text-[10px] uppercase tracking-widest text-violet-500">Progression</p>
          <p className="font-mono text-[11px] text-violet-300">
            {collectionList.length}{pool.length ? ` / ${pool.length}` : ""} personnage{collectionList.length > 1 ? "s" : ""}
          </p>
        </div>
        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-fuchsia-500 transition-[width] duration-500 motion-reduce:transition-none"
            style={{ width: `${Math.max(pct, collectionList.length ? 1.5 : 0)}%` }} />
        </div>
      </div>

      {/* Raretés : progression par palier + filtre */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {RARITY_ORDER.map((t) => {
          const r = RARITY[t];
          const active = tierFilter === t;
          return (
            <button key={t} onClick={() => setTierFilter(active ? "all" : t)}
              aria-pressed={active}
              className={`rounded-xl border px-2.5 py-2 text-left active:scale-95 transition-colors motion-reduce:transition-none ${
                active ? `bg-white/10 ${r.border}` : "bg-violet-900/40 border-white/10 hover:bg-white/5"}`}>
              <div className="flex items-center justify-between">
                <span className="text-sm leading-none">{r.emoji}</span>
                <span className="font-mono text-[10px] text-violet-300">{ownedTotals[t]}{poolTotals[t] ? `/${poolTotals[t]}` : ""}</span>
              </div>
              <p className={`mt-1 text-[11px] font-semibold ${r.text}`}>{r.label}</p>
            </button>
          );
        })}
      </div>

      {/* Recherche */}
      <div className="relative">
        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-violet-500 pointer-events-none" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un personnage ou une série…"
          className="w-full pl-9 pr-9 py-2 rounded-xl bg-violet-900/40 border border-white/10 text-sm text-violet-50 placeholder-violet-500 focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
        {query && (
          <button onClick={() => setQuery("")} aria-label="Effacer la recherche"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-violet-400 hover:bg-white/10">
            <X size={13} />
          </button>
        )}
      </div>

      {/* Genre + tri */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="max-w-full overflow-x-auto scrollbar-none">
          <PillTabs tabs={GENDER_TABS} value={genderFilter} onChange={setGenderFilter} layoutId="waifinity-gender-filter" size="sm" />
        </div>
        <div className="max-w-full overflow-x-auto scrollbar-none">
          <PillTabs tabs={SORTS} value={sort} onChange={setSort} layoutId="waifinity-sort" size="sm" />
        </div>
      </div>

      {filtered.length ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2.5">
          {filtered.map((c) => <CollectionCard key={c.id} c={c} />)}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-white/15 bg-violet-900/20 py-8 text-center">
          <p className="text-sm text-violet-300">Aucun personnage ne correspond.</p>
          {hasFilters && (
            <button onClick={() => { setTierFilter("all"); setGenderFilter("all"); setQuery(""); }}
              className="mt-2 text-xs text-amber-300 hover:text-amber-200">
              Réinitialiser les filtres
            </button>
          )}
        </div>
      )}
    </div>
  );
}
