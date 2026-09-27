import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronDown, Search, X, HelpCircle } from "lucide-react";
import { RARITY, normalizeTier, groupPoolBySeries } from "../../utils/waifinity";
import { RarityBadge } from "./RarityBadge";
import { GenderBadge } from "./GenderBadge";

/** Carte d'un personnage dans l'explorateur : art complet si possédé, silhouette sinon. */
function ExplorerCard({ c, owned, count, onOpen }) {
  const r = RARITY[normalizeTier(c.tier)];

  if (!owned) {
    return (
      <button onClick={() => onOpen(c.id)}
        className="relative rounded-xl overflow-hidden border-2 border-white/10 bg-violet-950/50 text-left active:scale-95 transition-transform motion-reduce:transition-none">
        <div className="relative aspect-[3/4] bg-violet-900/30 flex items-center justify-center">
          <HelpCircle size={22} className="text-violet-700" />
          <div className="absolute top-1 left-1 opacity-35"><RarityBadge tier={c.tier} /></div>
        </div>
        <div className="px-2 py-1.5 bg-black/35">
          <p className="text-[11px] font-semibold text-violet-500 leading-tight truncate">{c.name}</p>
        </div>
      </button>
    );
  }

  return (
    <button onClick={() => onOpen(c.id)}
      className={`relative rounded-xl overflow-hidden border-2 ${r.border} bg-violet-950 text-left active:scale-95 transition-transform motion-reduce:transition-none`}
      style={r.shine ? { boxShadow: `0 0 14px -3px ${r.glow}` } : undefined}>
      <div className="relative aspect-[3/4] bg-violet-900">
        <img src={c.image} alt="" loading="lazy" className="w-full h-full object-cover" />
        <div className="absolute top-1 left-1"><RarityBadge tier={c.tier} /></div>
        {count > 1 && (
          <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-black/70 text-white text-[9.5px] font-mono font-bold flex items-center justify-center">×{count}</span>
        )}
        {r.shine && <div className="card-shine" />}
      </div>
      <div className="px-2 py-1.5 bg-black/50">
        <div className="flex items-center gap-1">
          <p className="text-[11px] font-semibold text-white leading-tight truncate flex-1">{c.name}</p>
          <GenderBadge gender={c.gender} />
        </div>
      </div>
    </button>
  );
}

/** Ligne d'une série : en-tête (progression) + grille dépliable des personnages. */
function SeriesRow({ group, collection, expanded, onToggle, onOpenSheet }) {
  const total = group.characters.length;
  const owned = group.characters.filter((c) => collection[c.id]).length;
  const complete = total > 0 && owned === total;
  const pct = total ? (owned / total) * 100 : 0;

  return (
    <div className="rounded-2xl bg-violet-900/40 border border-white/10 overflow-hidden">
      <button onClick={onToggle} aria-expanded={expanded}
        className="w-full flex items-center gap-3 px-4 py-3 text-left active:scale-[0.99] transition-transform motion-reduce:transition-none">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-white truncate">{group.series}</p>
            {complete && (
              <span className="flex-shrink-0 text-[9px] font-mono uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-emerald-400/15 text-emerald-300 border border-emerald-400/30">
                Complète
              </span>
            )}
          </div>
          <div className="h-1 rounded-full bg-white/10 overflow-hidden mt-1.5">
            <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-fuchsia-500 transition-[width] duration-500 motion-reduce:transition-none"
              style={{ width: `${Math.max(pct, owned ? 3 : 0)}%` }} />
          </div>
        </div>
        <span className="flex-shrink-0 font-mono text-[11px] text-violet-300">{owned}/{total}</span>
        <ChevronDown size={15} className={`flex-shrink-0 text-violet-400 transition-transform motion-reduce:transition-none ${expanded ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div key="body" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22, ease: "easeOut" }} className="overflow-hidden">
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2.5 px-4 pb-4">
              {group.characters.map((c) => {
                const entry = collection[c.id];
                return <ExplorerCard key={c.id} c={c} owned={!!entry} count={entry?.count || 0} onOpen={onOpenSheet} />;
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Explorateur du bassin complet, groupé par série : chaque personnage non
 * obtenu apparaît en silhouette (nom visible, rareté estompée, pas d'image).
 * Avec 3000 personnages, tout afficher à plat ne serait pas lisible — le
 * regroupement par série + un seul groupe déplié à la fois garde l'affichage
 * léger et la navigation compréhensible.
 */
export function SeriesExplorer({ pool, collection, onOpenSheet }) {
  const [query, setQuery] = useState("");
  const [expandedKey, setExpandedKey] = useState(null);

  const groups = useMemo(() => groupPoolBySeries(pool), [pool]);

  const enriched = useMemo(
    () => groups.map((g) => ({ ...g, total: g.characters.length, owned: g.characters.filter((c) => collection[c.id]).length })),
    [groups, collection]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? enriched.filter((g) => g.series.toLowerCase().includes(q)) : enriched;
    return [...list].sort((a, b) => b.owned - a.owned || b.total - a.total || a.series.localeCompare(b.series));
  }, [enriched, query]);

  const totalOwned = useMemo(() => pool.filter((c) => collection[c.id]).length, [pool, collection]);
  const completeSeries = useMemo(() => enriched.filter((g) => g.total > 0 && g.owned === g.total).length, [enriched]);

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-violet-400">
        {totalOwned}/{pool.length} personnages · {completeSeries}/{enriched.length} séries complètes
      </p>

      <div className="relative">
        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-violet-500 pointer-events-none" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Chercher une série…"
          className="w-full pl-9 pr-9 py-2 rounded-xl bg-violet-900/40 border border-white/10 text-sm text-violet-50 placeholder-violet-500 focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
        {query && (
          <button onClick={() => setQuery("")} aria-label="Effacer la recherche"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-violet-400 hover:bg-white/10">
            <X size={13} />
          </button>
        )}
      </div>

      {filtered.length ? (
        <div className="space-y-2">
          {filtered.map((g) => (
            <SeriesRow key={g.key} group={g} collection={collection}
              expanded={expandedKey === g.key}
              onToggle={() => setExpandedKey((cur) => (cur === g.key ? null : g.key))}
              onOpenSheet={onOpenSheet} />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-white/15 bg-violet-900/20 py-8 text-center">
          <p className="text-sm text-violet-300">Aucune série ne correspond.</p>
        </div>
      )}
    </div>
  );
}
