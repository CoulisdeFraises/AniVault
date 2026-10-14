import { useState, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronDown, Search, X, HelpCircle, Heart, Sparkles } from "lucide-react";
import { RARITY, normalizeTier, groupPoolBySeries, isRecentlyObtained, SHOP_TARGET_COST } from "../../utils/waifinity";
import { RarityBadge } from "./RarityBadge";
import { GenderBadge } from "./GenderBadge";
import { CardFrame } from "./CardFrame";
import { LoadMore } from "./LoadMore";
import { PillTabs } from "./PillTabs";
import { usePagedList } from "../../hooks/usePagedList";
import { haptics } from "../../utils/haptics";

// Séries affichées d'un coup, et personnages affichés d'un coup dans une
// série dépliée (certaines franchises en comptent plusieurs dizaines).
const PAGE_SERIES = 25;
const PAGE_CHARACTERS = 30;

// Recherche insensible à la casse et aux accents (« frieren » trouve « Frieren », « éva » trouve « Eva »).
const fold = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

// Filtre, tri et recherche conservés quand on change d'onglet puis qu'on revient.
const memo = { filter: "all", sort: "progress", query: "", expanded: null };

const SORTS = [
  { key: "progress", label: "Progression" },
  { key: "almost",   label: "Presque finies" },
  { key: "size",     label: "Plus grandes" },
  { key: "az",       label: "A-Z" },
];

/** Carte d'un personnage dans l'explorateur : art complet si possédé, silhouette sinon. */
function ExplorerCard({ c, owned, entry, isFavorite, cosmetic, onOpen }) {
  const r = RARITY[normalizeTier(c.tier)];
  const count = entry?.count || 0;

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
    <CardFrame as="button" tier={c.tier} cosmetic={cosmetic} onClick={() => onOpen(c.id)}
      className="relative text-left active:scale-95 transition-transform motion-reduce:transition-none">
      <div className="relative aspect-[3/4] bg-violet-900/60">
        <img src={c.image} alt="" loading="lazy" className="w-full h-full object-cover" />
        <div className="absolute top-1 left-1"><RarityBadge tier={c.tier} /></div>
        {count > 1 && (
          <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-black/70 text-white text-[9.5px] font-mono font-bold flex items-center justify-center">×{count}</span>
        )}
        {isRecentlyObtained(entry) && (
          <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded-full bg-amber-400 text-violet-950 text-[8.5px] font-mono font-bold tracking-wide shadow">NEW</span>
        )}
        {isFavorite && (
          <span className="absolute bottom-1 right-1 w-5 h-5 rounded-full bg-black/65 border border-white/20 flex items-center justify-center" aria-label="Favori">
            <Heart size={10.5} className="text-pink-400" fill="currentColor" />
          </span>
        )}
        {r.shine && <div className="card-shine" />}
      </div>
      <div className="px-2 py-1.5 bg-black/30">
        <div className="flex items-center gap-1">
          <p className="text-[11px] font-semibold text-white leading-tight truncate flex-1">{c.name}</p>
          <GenderBadge gender={c.gender} />
        </div>
      </div>
    </CardFrame>
  );
}

/** Ligne d'une série : en-tête (aperçu + progression) + grille dépliable des personnages. */
function SeriesRow({
  group, collection, favorites, equipped, expanded, hint, onToggle, onOpenSheet,
  onBuyTargeted, canAffordTarget, coins, busy,
}) {
  const total = group.characters.length;
  const owned = group.owned;
  const missing = total - owned;
  const complete = total > 0 && owned === total;
  const pct = total ? (owned / total) * 100 : 0;

  const [onlyMissing, setOnlyMissing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const rowRef = useRef(null);

  const list = useMemo(
    () => (onlyMissing ? group.characters.filter((c) => !collection[c.id]) : group.characters),
    [group.characters, collection, onlyMissing]
  );
  // Personnages : on ne monte que la première page, et on repart de zéro à chaque dépliage / filtre.
  const page = usePagedList(list, { pageSize: PAGE_CHARACTERS, resetKey: `${expanded}|${onlyMissing}` });

  // Aperçu : jusqu'à 3 personnages obtenus (les plus rares d'abord) pour reconnaître la série d'un coup d'œil.
  const preview = useMemo(
    () => group.characters.filter((c) => collection[c.id] && c.image).slice(0, 3),
    [group.characters, collection]
  );

  // À l'ouverture, on ramène la série dans l'écran (une fois l'animation d'ouverture lancée).
  useEffect(() => {
    if (!expanded) { setConfirming(false); setOnlyMissing(false); return undefined; }
    const t = setTimeout(() => rowRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }), 240);
    return () => clearTimeout(t);
  }, [expanded]);

  // La confirmation d'achat expire toute seule.
  useEffect(() => {
    if (!confirming) return undefined;
    const t = setTimeout(() => setConfirming(false), 3500);
    return () => clearTimeout(t);
  }, [confirming]);

  const canBuy = !!onBuyTargeted && group.seriesId != null && missing > 0;
  const subtitle = hint?.length ? `Contient : ${hint.join(", ")}`
    : complete ? "Série terminée"
    : owned === 0 ? "Pas encore découverte"
    : `Il en manque ${missing}`;

  return (
    <div ref={rowRef} className="rounded-2xl bg-violet-900/40 border border-white/10 overflow-hidden scroll-mt-4">
      <button onClick={onToggle} aria-expanded={expanded}
        className="w-full flex items-center gap-3 px-4 py-3 text-left active:scale-[0.99] transition-transform motion-reduce:transition-none">
        <div className="flex -space-x-2 flex-shrink-0" aria-hidden="true">
          {preview.length ? preview.map((c) => (
            <img key={c.id} src={c.image} alt="" loading="lazy" draggable={false}
              className="h-9 w-9 rounded-full object-cover object-top border-2 border-violet-900 bg-violet-950" />
          )) : (
            <div className="h-9 w-9 rounded-full border-2 border-violet-900 bg-violet-950/70 flex items-center justify-center">
              <HelpCircle size={16} className="text-violet-600" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-white truncate">{group.series}</p>
            {complete && (
              <span className="flex-shrink-0 text-[9px] font-mono uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-emerald-400/15 text-emerald-300 border border-emerald-400/30">
                Complète
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[10.5px] text-violet-400 truncate">{subtitle}</p>
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
            {((missing > 0 && owned > 0) || canBuy) && (
              <div className="flex flex-wrap items-center gap-2 px-4 pb-3">
                {missing > 0 && owned > 0 && (
                  <button type="button" onClick={() => setOnlyMissing((v) => !v)} aria-pressed={onlyMissing}
                    className={`px-3 py-1.5 rounded-full text-[11px] font-medium border transition-colors motion-reduce:transition-none ${
                      onlyMissing ? "bg-amber-400 text-violet-950 border-amber-400" : "bg-white/5 text-violet-200 border-white/10 hover:text-white"}`}>
                    Manquants seulement
                  </button>
                )}
                {canBuy && (
                  <button type="button" disabled={busy || !canAffordTarget}
                    title="Un booster limité à cette série"
                    onClick={() => {
                      if (!confirming) { setConfirming(true); return; }
                      haptics.success();
                      setConfirming(false);
                      onBuyTargeted(group.seriesId);
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-colors motion-reduce:transition-none disabled:opacity-40 disabled:cursor-not-allowed ${
                      confirming ? "bg-amber-400 text-violet-950 border-amber-400" : "bg-violet-400/15 text-violet-100 border-violet-300/30 hover:bg-violet-400/25"}`}>
                    <Sparkles size={12} aria-hidden="true" />
                    {confirming ? `Confirmer · ${SHOP_TARGET_COST} Anigold` : `Booster ciblé · ${SHOP_TARGET_COST}`}
                  </button>
                )}
                {canBuy && !canAffordTarget && (
                  <span className="text-[10.5px] text-violet-400">Il te manque {Math.max(0, SHOP_TARGET_COST - (coins || 0))} Anigold</span>
                )}
              </div>
            )}
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2.5 px-4 pb-4">
              {page.visible.map((c) => {
                const entry = collection[c.id];
                return <ExplorerCard key={c.id} c={c} owned={!!entry} entry={entry} isFavorite={favorites?.has(c.id)} cosmetic={equipped?.[c.id]} onOpen={onOpenSheet} />;
              })}
            </div>
            <LoadMore hasMore={page.hasMore} onMore={page.more} shown={page.shown} total={page.total} className="pb-4 -mt-1" />
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
 *
 * Pour s'y retrouver : recherche par série OU par personnage (sans tenir compte
 * des accents), filtres « en cours / complètes / à découvrir », tris dont
 * « presque finies », raccourci vers la série la plus proche de la fin, et —
 * dans une série ouverte — filtre « manquants seulement » + booster ciblé.
 */
export function SeriesExplorer({ pool, collection, favorites, equipped, onOpenSheet, onBuyTargeted, canAffordTarget, coins, busy }) {
  const [query, setQueryState] = useState(memo.query);
  const [filter, setFilterState] = useState(memo.filter);
  const [sort, setSortState] = useState(memo.sort);
  const [expandedKey, setExpandedKeyState] = useState(memo.expanded);
  const setQuery = (v) => { memo.query = v; setQueryState(v); };
  const setFilter = (v) => { memo.filter = v; setFilterState(v); };
  const setSort = (v) => { memo.sort = v; setSortState(v); };
  const setExpandedKey = (updater) => setExpandedKeyState((cur) => {
    const next = typeof updater === "function" ? updater(cur) : updater;
    memo.expanded = next;
    return next;
  });

  const groups = useMemo(() => groupPoolBySeries(pool), [pool]);

  // Chaînes de recherche calculées une seule fois par bassin (pas à chaque frappe).
  const searchable = useMemo(
    () => new Map(groups.map((g) => [g.key, { series: fold(g.series), names: g.characters.map((c) => fold(c.name)) }])),
    [groups]
  );

  const enriched = useMemo(
    () => groups.map((g) => ({ ...g, total: g.characters.length, owned: g.characters.filter((c) => collection[c.id]).length })),
    [groups, collection]
  );

  const counts = useMemo(() => ({
    all: enriched.length,
    progress: enriched.filter((g) => g.owned > 0 && g.owned < g.total).length,
    complete: enriched.filter((g) => g.total > 0 && g.owned === g.total).length,
    new: enriched.filter((g) => g.owned === 0).length,
  }), [enriched]);

  const q = fold(query.trim());

  // Pour chaque série trouvée via un personnage (et non via son titre), les noms qui ont matché.
  const hintsOf = (g) => {
    if (!q) return null;
    const s = searchable.get(g.key);
    if (!s || s.series.includes(q)) return null;
    const hits = [];
    s.names.forEach((n, i) => { if (hits.length < 2 && n.includes(q)) hits.push(g.characters[i].name); });
    return hits;
  };

  const filtered = useMemo(() => {
    let list = enriched;
    if (filter === "progress") list = list.filter((g) => g.owned > 0 && g.owned < g.total);
    else if (filter === "complete") list = list.filter((g) => g.total > 0 && g.owned === g.total);
    else if (filter === "new") list = list.filter((g) => g.owned === 0);
    if (q) {
      list = list.filter((g) => {
        const s = searchable.get(g.key);
        return s && (s.series.includes(q) || s.names.some((n) => n.includes(q)));
      });
    }
    const byName = (a, b) => a.series.localeCompare(b.series);
    // « Presque finies » : d'abord les séries entamées (il en manque peu), puis les non commencées, puis les complètes.
    const rank = (g) => (g.total > 0 && g.owned === g.total ? 2 : g.owned === 0 ? 1 : 0);
    const cmp = sort === "az" ? byName
      : sort === "size" ? (a, b) => b.total - a.total || byName(a, b)
      : sort === "almost" ? (a, b) => rank(a) - rank(b) || (a.total - a.owned) - (b.total - b.owned) || byName(a, b)
      : (a, b) => b.owned - a.owned || b.total - a.total || byName(a, b);
    return [...list].sort(cmp);
  }, [enriched, filter, sort, q, searchable]);

  const seriesPage = usePagedList(filtered, { pageSize: PAGE_SERIES, resetKey: `${filter}|${sort}|${q}` });

  const totalOwned = useMemo(() => pool.filter((c) => collection[c.id]).length, [pool, collection]);
  const globalPct = pool.length ? (totalOwned / pool.length) * 100 : 0;

  // La série entamée la plus proche d'être terminée : raccourci pour la compléter.
  const nearest = useMemo(() => {
    let best = null;
    for (const g of enriched) {
      if (g.owned === 0 || g.owned === g.total) continue;
      const m = g.total - g.owned;
      if (!best || m < best.missing || (m === best.missing && g.total > best.total)) best = { key: g.key, series: g.series, missing: m, total: g.total };
    }
    return best;
  }, [enriched]);

  const filterTabs = [
    { key: "all",      label: `Toutes · ${counts.all}` },
    { key: "progress", label: `En cours · ${counts.progress}` },
    { key: "complete", label: `Complètes · ${counts.complete}` },
    { key: "new",      label: `À découvrir · ${counts.new}` },
  ];
  const filtersActive = filter !== "all" || !!q;

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-white/10 bg-violet-900/40 p-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-violet-400">Personnages découverts</p>
            <p className="mt-0.5 text-lg font-bold text-white tabular-nums">
              {totalOwned}<span className="text-sm font-medium text-violet-400"> / {pool.length}</span>
            </p>
          </div>
          <p className="text-right text-[11px] text-violet-300">{counts.complete}/{counts.all} séries complètes</p>
        </div>
        <div className="mt-3 h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-fuchsia-500 transition-[width] duration-500 motion-reduce:transition-none"
            style={{ width: `${Math.max(globalPct, totalOwned ? 2 : 0)}%` }} />
        </div>
        {nearest && (
          <button type="button"
            onClick={() => { setQuery(""); setFilter("all"); setSort("almost"); setExpandedKey(nearest.key); haptics.tap(); }}
            className="mt-3 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-left text-[11px] text-violet-200 hover:bg-white/10 transition-colors motion-reduce:transition-none">
            Plus proche de la fin : <span className="font-semibold text-white">{nearest.series}</span>
            <span className="text-violet-400"> · il en manque {nearest.missing}</span>
          </button>
        )}
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-violet-500 pointer-events-none" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Chercher une série ou un personnage…"
          className="w-full pl-9 pr-9 py-2 rounded-xl bg-violet-900/40 border border-white/10 text-sm text-violet-50 placeholder-violet-500 focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
        {query && (
          <button onClick={() => setQuery("")} aria-label="Effacer la recherche"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-violet-400 hover:bg-white/10">
            <X size={13} />
          </button>
        )}
      </div>

      <div className="space-y-2">
        <PillTabs tabs={filterTabs} value={filter} onChange={setFilter} layoutId="waifinity-series-filter" size="sm" tone="violet" />
        <PillTabs tabs={SORTS} value={sort} onChange={setSort} layoutId="waifinity-series-sort" size="sm" tone="violet" />
      </div>

      {filtered.length ? (
        <div className="space-y-2">
          {seriesPage.visible.map((g) => (
            <SeriesRow key={g.key} group={g} collection={collection} favorites={favorites} equipped={equipped}
              expanded={expandedKey === g.key} hint={hintsOf(g)}
              onToggle={() => setExpandedKey((cur) => (cur === g.key ? null : g.key))}
              onOpenSheet={onOpenSheet} onBuyTargeted={onBuyTargeted} canAffordTarget={canAffordTarget} coins={coins} busy={busy} />
          ))}
          <LoadMore hasMore={seriesPage.hasMore} onMore={seriesPage.more} shown={seriesPage.shown} total={seriesPage.total} className="pt-1" />
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-white/15 bg-violet-900/20 py-8 text-center">
          <p className="text-sm text-violet-300">Aucune série ne correspond.</p>
          {filtersActive && (
            <button type="button" onClick={() => { setQuery(""); setFilter("all"); }}
              className="mt-2 text-xs font-semibold text-amber-300 underline underline-offset-2">
              Réinitialiser la recherche et les filtres
            </button>
          )}
        </div>
      )}
    </div>
  );
}
