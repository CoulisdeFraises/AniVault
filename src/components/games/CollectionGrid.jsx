import { useState, useMemo } from "react";
import { AnimatePresence, motion } from "motion/react";
import { HeartCrack, Heart, Search, X, Layers, ListOrdered, ChevronDown } from "lucide-react";
import {
  RARITY, RARITY_ORDER, GENDER_FILTER_LABEL, matchesGender, countByTier, normalizeTier,
  seriesKeyOf, isRecentlyObtained,
} from "../../utils/waifinity";
import { RarityBadge, RarityDot } from "./RarityBadge";
import { GenderBadge } from "./GenderBadge";
import { PillTabs } from "./PillTabs";
import { CardFrame } from "./CardFrame";
import { SeriesExplorer } from "./SeriesExplorer";
import { FavoritesCarousel } from "./FavoritesCarousel";
import { FavoriteActionSheet, FavoritesReorderModal } from "./FavoritesManager";
import { LoadMore } from "./LoadMore";
import { usePagedList } from "../../hooks/usePagedList";

// Cartes affichées d'un coup (puis « Afficher plus ») : une grosse collection
// ne monte plus des centaines de <img> d'un coup. En vue « Par série », la
// pagination porte sur les séries.
const PAGE_CARDS = 60;
const PAGE_GROUPS = 30; // séries repliées = légères : on peut en monter davantage d'un coup

// Préférences de la vue « Par série » (mémorisées entre deux visites).
const GROUP_PREF_KEY = "anivault:waifinity-group-by-series";
const OPEN_SERIES_KEY = "anivault:waifinity-open-series";

function loadGroupPref() {
  try { return localStorage.getItem(GROUP_PREF_KEY) !== "false"; } catch { return true; } // groupé par défaut
}
function loadOpenSeries() {
  try { return new Set(JSON.parse(localStorage.getItem(OPEN_SERIES_KEY) || "[]")); } catch { return new Set(); }
}
function saveOpenSeries(set) {
  try { localStorage.setItem(OPEN_SERIES_KEY, JSON.stringify([...set].slice(-300))); } catch { /* quota : on perd juste la mémoire */ }
}

const VIEWS = [
  { key: "mine",     label: "Ma collection" },
  { key: "explorer", label: "Explorer" },
];

const SORTS = [
  { key: "recent", label: "Récents" },
  { key: "rarity", label: "Rareté" },
  { key: "name",   label: "Nom" },
];
const GENDER_TABS = Object.entries(GENDER_FILTER_LABEL).map(([key, label]) => ({ key, label }));

function CollectionCard({ c, onOpen, isFavorite, cosmetic }) {
  return (
    <CardFrame as="button" tier={c.tier} cosmetic={cosmetic} onClick={() => onOpen(c.id)}
      className="relative text-left active:scale-95 transition-transform motion-reduce:transition-none">
      <div className="relative aspect-[3/4] bg-violet-900/60">
        {c.image
          ? <img src={c.image} alt="" loading="lazy" className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center text-violet-600">?</div>}
        <div className="absolute top-1 left-1"><RarityBadge tier={c.tier} /></div>
        {c.count > 1 && (
          <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-black/70 text-white text-[9.5px] font-mono font-bold flex items-center justify-center">×{c.count}</span>
        )}
        {isRecentlyObtained(c) && (
          <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded-full bg-amber-400 text-violet-950 text-[8.5px] font-mono font-bold tracking-wide shadow">NEW</span>
        )}
        {isFavorite && (
          <span className="absolute bottom-1 right-1 w-5 h-5 rounded-full bg-black/65 border border-white/20 flex items-center justify-center" aria-label="Favori">
            <Heart size={10.5} className="text-pink-400" fill="currentColor" />
          </span>
        )}
        {RARITY[normalizeTier(c.tier)].shine && <div className="card-shine" />}
      </div>
      <div className="px-2 py-1.5 bg-black/30">
        <div className="flex items-center gap-1">
          <p className="text-[11px] font-semibold text-white leading-tight truncate flex-1">{c.name}</p>
          <GenderBadge gender={c.gender} />
        </div>
        <p className="text-[9.5px] text-violet-300 truncate">{c.series}</p>
      </div>
    </CardFrame>
  );
}

/** Anneau de progression globale (SVG, animé au chargement / à chaque booster). */
function ProgressRing({ pct }) {
  const R = 34;
  const C = 2 * Math.PI * R;
  return (
    <svg viewBox="0 0 84 84" className="w-[84px] h-[84px] -rotate-90" aria-hidden="true">
      <defs>
        <linearGradient id="wf-ring" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#d946ef" />
        </linearGradient>
      </defs>
      <circle cx="42" cy="42" r={R} fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="7" />
      <circle cx="42" cy="42" r={R} fill="none" stroke="url(#wf-ring)" strokeWidth="7" strokeLinecap="round"
        strokeDasharray={C} strokeDashoffset={C * (1 - pct / 100)}
        className="transition-[stroke-dashoffset] duration-700 motion-reduce:transition-none" />
    </svg>
  );
}

export function CollectionGrid({
  collectionList, pool, collection = {}, favorites = [], equipped = {}, onOpenSheet,
  onMoveFavorite, onReorderFavorites, onToggleFavorite,
}) {
  const [view, setView]                 = useState("mine");
  const [tierFilter, setTierFilter]     = useState("all");
  const [genderFilter, setGenderFilter] = useState("all");
  const [sort, setSort]                 = useState("recent");
  const [query, setQuery]               = useState("");
  const [groupBySeries, setGroupBySeriesState] = useState(loadGroupPref);
  // Séries dépliées (les autres sont repliées par défaut) — mémorisées localement.
  const [openSeries, setOpenSeries] = useState(loadOpenSeries);

  const setGroupBySeries = (updater) => setGroupBySeriesState((prev) => {
    const next = typeof updater === "function" ? updater(prev) : updater;
    try { localStorage.setItem(GROUP_PREF_KEY, String(next)); } catch { /* ignoré */ }
    return next;
  });
  const toggleSeries = (key) => setOpenSeries((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    saveOpenSeries(next);
    return next;
  });
  const setAllSeries = (keys) => { const next = new Set(keys); saveOpenSeries(next); setOpenSeries(next); };

  // Ordre des favoris : menu d'appui long (id de la carte) + écran « Réorganiser ».
  const [menuId, setMenuId]           = useState(null);
  const [reorderOpen, setReorderOpen] = useState(false);
  const [focus, setFocus]             = useState({ id: null, token: 0 });
  const canReorder = !!(onMoveFavorite && onReorderFavorites);

  // Ferme le menu puis ouvre une autre modale APRÈS son animation de sortie :
  // deux <Modal> qui se chevauchent laisseraient le body bloqué en overflow:hidden
  // (voir le commentaire dans Modal.jsx).
  const afterMenuClose = (fn) => { setMenuId(null); setTimeout(fn, 280); };

  const favSet = useMemo(() => new Set(favorites), [favorites]);
  const poolTotals  = useMemo(() => countByTier(pool), [pool]);
  const ownedTotals = useMemo(() => countByTier(collectionList), [collectionList]);

  const favItems = useMemo(() => {
    const byId = new Map(collectionList.map((c) => [c.id, c]));
    return favorites.map((id) => byId.get(id)).filter(Boolean);
  }, [favorites, collectionList]);

  // Totaux par série dans le bassin / possédés — pour l'en-tête des groupes.
  const poolSeriesTotals = useMemo(() => {
    const m = new Map();
    for (const c of pool) { const k = seriesKeyOf(c); m.set(k, (m.get(k) || 0) + 1); }
    return m;
  }, [pool]);
  const ownedSeriesTotals = useMemo(() => {
    const m = new Map();
    for (const c of collectionList) { const k = seriesKeyOf(c); m.set(k, (m.get(k) || 0) + 1); }
    return m;
  }, [collectionList]);

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

  const groups = useMemo(() => {
    if (!groupBySeries) return null;
    const m = new Map();
    for (const c of filtered) {
      const key = seriesKeyOf(c);
      if (!m.has(key)) m.set(key, { key, series: c.series || "Série inconnue", items: [] });
      m.get(key).items.push(c);
    }
    // L'ordre des séries suit le tri choisi : récents → séries touchées en dernier,
    // rareté → meilleure carte de la série, nom → ordre alphabétique.
    const list = [...m.values()].map((g) => ({
      ...g,
      newest: Math.max(...g.items.map((c) => c.firstObtainedAt || 0)),
      best: Math.max(...g.items.map((c) => RARITY_ORDER.indexOf(normalizeTier(c.tier)))),
    }));
    const byName = (a, b) => a.series.localeCompare(b.series);
    list.sort(
      sort === "name"   ? byName :
      sort === "rarity" ? (a, b) => b.best - a.best || byName(a, b) :
                          (a, b) => b.newest - a.newest || byName(a, b)
    );
    return list;
  }, [filtered, groupBySeries, sort]);

  // Pagination (hooks avant tout retour anticipé) : remise à la 1re page dès
  // qu'un filtre, le tri ou la recherche change.
  const resetKey = `${tierFilter}|${genderFilter}|${sort}|${query}|${groupBySeries}`;
  const cardsPage  = usePagedList(filtered, { pageSize: PAGE_CARDS, resetKey });
  const groupsPage = usePagedList(groups || [], { pageSize: PAGE_GROUPS, resetKey });

  const viewToggle = (
    <div className="flex justify-center">
      <PillTabs tabs={VIEWS} value={view} onChange={setView} layoutId="waifinity-collection-view" size="sm" />
    </div>
  );

  if (view === "explorer") {
    return (
      <div className="space-y-4">
        {viewToggle}
        <SeriesExplorer pool={pool} collection={collection} favorites={favSet} equipped={equipped} onOpenSheet={onOpenSheet} />
      </div>
    );
  }

  if (!collectionList.length) {
    return (
      <div className="space-y-4">
        {viewToggle}
        <div className="rounded-2xl border border-dashed border-white/15 bg-violet-900/20 py-10 text-center">
          <HeartCrack size={26} className="mx-auto text-violet-500 mb-2" />
          <p className="text-sm text-violet-200">Ta collection est vide pour le moment</p>
          <p className="text-[11px] text-violet-400 mt-1">Ouvre un booster pour obtenir tes premiers personnages !</p>
        </div>
      </div>
    );
  }

  const pct = pool.length ? Math.min(100, (collectionList.length / pool.length) * 100) : 0;
  const pctLabel = `${pct < 10 ? pct.toFixed(1) : Math.round(pct)}%`;
  const topOwned = (ownedTotals.legendary || 0) + (ownedTotals.secret || 0);
  const hasFilters = tierFilter !== "all" || genderFilter !== "all" || query.trim();

  return (
    <div className="space-y-4">
      {viewToggle}

      {/* Progression globale */}
      <div className="flex items-center gap-4 rounded-2xl bg-violet-900/40 border border-white/10 p-4">
        <div className="relative w-[84px] h-[84px] flex-shrink-0">
          <ProgressRing pct={pct} />
          <span className="absolute inset-0 flex items-center justify-center font-mono text-sm font-bold text-white">{pctLabel}</span>
        </div>
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-widest text-violet-500">Progression</p>
          <p className="text-3xl font-bold leading-tight text-white" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>
            {collectionList.length}
            {pool.length > 0 && <span className="text-base font-medium text-violet-400"> / {pool.length}</span>}
          </p>
          <p className="text-[11px] text-violet-300">personnage{collectionList.length > 1 ? "s" : ""}</p>
          {topOwned > 0 && (
            <p className="mt-1 flex items-center gap-1.5 text-[11px] text-amber-300"><RarityDot tier="legendary" size={7} />{topOwned} Legendary &amp; Secret</p>
          )}
        </div>
      </div>

      {/* Favoris épinglés */}
      {!hasFilters && favItems.length > 0 && (
        <section>
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-amber-300">
              <Heart size={11} fill="currentColor" />Mes favoris
              <span className="text-violet-400 normal-case tracking-normal">{favItems.length}</span>
            </p>
            {canReorder && favItems.length > 1 && (
              <button
                type="button"
                onClick={() => setReorderOpen(true)}
                className="flex items-center gap-1.5 rounded-full bg-white/5 border border-white/10 px-2.5 py-1 text-[10.5px] text-violet-200 hover:bg-white/10 active:scale-95"
              >
                <ListOrdered size={12} />Réorganiser
              </button>
            )}
          </div>
          <FavoritesCarousel
            items={favItems}
            onOpen={onOpenSheet}
            equipped={equipped}
            onLongPress={canReorder ? setMenuId : undefined}
            focusId={focus.id}
            focusToken={focus.token}
          />
          {canReorder && favItems.length > 1 && (
            <p className="text-center text-[10px] text-violet-500 mt-1">Appui long sur une carte pour changer sa position</p>
          )}
        </section>
      )}

      <AnimatePresence>
        {canReorder && menuId != null && (
          <FavoriteActionSheet
            key="fav-menu"
            items={favItems}
            characterId={menuId}
            onMove={(id, to) => { onMoveFavorite(id, to); setFocus((f) => ({ id, token: f.token + 1 })); }}
            onOpenSheet={(id) => afterMenuClose(() => onOpenSheet?.(id))}
            onOpenReorder={() => afterMenuClose(() => setReorderOpen(true))}
            onRemove={(id) => onToggleFavorite?.(id)}
            onClose={() => setMenuId(null)}
          />
        )}
        {canReorder && reorderOpen && (
          <FavoritesReorderModal
            key="fav-reorder"
            items={favItems}
            onReorder={onReorderFavorites}
            onMove={onMoveFavorite}
            onClose={() => setReorderOpen(false)}
          />
        )}
      </AnimatePresence>

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
                <RarityDot tier={t} size={9} />
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

      {/* Genre + tri + regroupement */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="max-w-full overflow-x-auto scrollbar-none">
          <PillTabs tabs={GENDER_TABS} value={genderFilter} onChange={setGenderFilter} layoutId="waifinity-gender-filter" size="sm" />
        </div>
        <div className="flex items-center gap-2 max-w-full">
          <PillTabs tabs={SORTS} value={sort} onChange={setSort} layoutId="waifinity-sort" size="sm" />
          <button onClick={() => setGroupBySeries((v) => !v)} aria-pressed={groupBySeries}
            className={`flex flex-shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] active:scale-95 transition-colors motion-reduce:transition-none ${
              groupBySeries ? "bg-amber-400 text-violet-950 border-amber-400 font-semibold" : "bg-white/5 border-white/10 text-violet-300 font-medium"}`}>
            <Layers size={11} />Par série
          </button>
        </div>
      </div>

      {filtered.length ? (
        groups ? (
          <div className="space-y-2.5">
            {/* Barre d'outils : nombre de séries + tout déplier / replier */}
            <div className="flex items-center justify-between gap-2 px-0.5">
              <p className="font-mono text-[10px] uppercase tracking-widest text-violet-400">
                {groups.length} série{groups.length > 1 ? "s" : ""}
                {!hasFilters && <span className="normal-case tracking-normal"> · {groups.filter((g) => openSeries.has(g.key)).length} dépliée{groups.filter((g) => openSeries.has(g.key)).length > 1 ? "s" : ""}</span>}
              </p>
              <div className="flex items-center gap-1.5">
                <button type="button" onClick={() => setAllSeries(groups.map((g) => g.key))} disabled={!!hasFilters}
                  className="rounded-full bg-white/5 border border-white/10 px-2.5 py-1 text-[10.5px] text-violet-200 hover:bg-white/10 active:scale-95 disabled:opacity-40">
                  Tout déplier
                </button>
                <button type="button" onClick={() => setAllSeries([])} disabled={!!hasFilters}
                  className="rounded-full bg-white/5 border border-white/10 px-2.5 py-1 text-[10.5px] text-violet-200 hover:bg-white/10 active:scale-95 disabled:opacity-40">
                  Tout replier
                </button>
              </div>
            </div>

            {groupsPage.visible.map((g) => {
              const owned = ownedSeriesTotals.get(g.key) || g.items.length;
              const total = Math.max(poolSeriesTotals.get(g.key) || 0, owned);
              const complete = owned >= total;
              // Une recherche ou un filtre actif déplie tout, pour ne rien cacher du résultat.
              const open = hasFilters || openSeries.has(g.key);
              const preview = g.items.filter((c) => c.image).slice(0, 4);
              return (
                <section key={g.key} className="rounded-2xl bg-violet-900/40 border border-white/10 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => { if (!hasFilters) toggleSeries(g.key); }}
                    aria-expanded={open}
                    className="w-full flex items-center gap-3 px-3.5 py-2.5 text-left active:scale-[0.99] transition-transform motion-reduce:transition-none"
                  >
                    {/* Aperçu : quelques cartes de la série, visibles même repliée */}
                    <div className="flex -space-x-2.5 flex-shrink-0" aria-hidden="true">
                      {preview.map((c) => (
                        <img key={c.id} src={c.image} alt="" loading="lazy" draggable="false"
                          className="w-7 h-9 rounded-md object-cover border border-violet-950 bg-violet-950" />
                      ))}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-[13px] font-semibold text-white truncate min-w-0">{g.series}</p>
                        {complete && (
                          <span className="flex-shrink-0 text-[9px] font-mono uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-emerald-400/15 text-emerald-300 border border-emerald-400/30">Complète</span>
                        )}
                      </div>
                      <div className="h-1 rounded-full bg-white/10 overflow-hidden mt-1.5">
                        <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-fuchsia-500"
                          style={{ width: `${Math.max(total ? (owned / total) * 100 : 0, 3)}%` }} />
                      </div>
                    </div>
                    <span className="flex-shrink-0 font-mono text-[11px] text-violet-300">{owned}/{total}</span>
                    <ChevronDown size={15} className={`flex-shrink-0 text-violet-400 transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`} />
                  </button>

                  <AnimatePresence initial={false}>
                    {open && (
                      <motion.div key="body" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2, ease: "easeOut" }} className="overflow-hidden">
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2.5 px-3.5 pb-3.5">
                          {g.items.map((c) => <CollectionCard key={c.id} c={c} onOpen={onOpenSheet} isFavorite={favSet.has(c.id)} cosmetic={equipped[c.id]} />)}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </section>
              );
            })}
            <LoadMore hasMore={groupsPage.hasMore} onMore={groupsPage.more} shown={groupsPage.shown} total={groupsPage.total} />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2.5">
              {cardsPage.visible.map((c) => <CollectionCard key={c.id} c={c} onOpen={onOpenSheet} isFavorite={favSet.has(c.id)} cosmetic={equipped[c.id]} />)}
            </div>
            <LoadMore hasMore={cardsPage.hasMore} onMore={cardsPage.more} shown={cardsPage.shown} total={cardsPage.total} />
          </>
        )
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
