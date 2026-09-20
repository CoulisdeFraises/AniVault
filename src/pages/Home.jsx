import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useSearchParams, useNavigate }  from "react-router-dom";
import { HomeHeader }       from "../components/home/HomeHeader";
import { HomeBackdrop }     from "../components/home/HomeBackdrop";
import { WeekSummary }      from "../components/home/WeekSummary";
import { SearchTabs }       from "../components/home/SearchTabs";
import { TodaySection }     from "../components/home/TodaySection";
import { ContinueSection }  from "../components/home/ContinueSection";
import { ActivityCard }     from "../components/home/ActivityCard";
import { calcWeekStats, getWeeklyGoal, WEEKLY_GOAL_KEY } from "../utils/weekStats";
import { Card }             from "../components/Card/Card";
import { TitleFormModal }   from "../components/Modal/TitleFormModal";
import { Modal }            from "../components/Modal/Modal";
import { Footer }           from "../components/common/Footer";
import { SkeletonGrid }     from "../components/common/SkeletonCard";
import { PullToRefresh }    from "../components/common/PullToRefresh";
import { useLibrary }       from "../context/LibraryContext";
import { useLists, HIDDEN_LIST_ID } from "../context/ListsContext";
import { useSync }          from "../hooks/useSync";
import {
  Film, Tv, ListPlus, X, Heart, Eye, EyeOff,
  ChevronDown, SlidersHorizontal, WifiOff, CalendarDays,
  LayoutGrid, PlayCircle, MonitorPlay, Clapperboard, LibraryBig,
} from "lucide-react";
import { HeartIcon }        from "../components/common/icons";
import { FilterPanel }      from "../components/common/FilterPanel";
import { AnimatePresence }  from "motion/react";
import { fetchWeeklySchedule } from "../api/anilist";
import { fetchNextAiring } from "../api";
import { getDisplayStatus } from "../utils/status";
import { getCached, setCached, getStaleCached, TTL } from "../lib/cache";
import { haptics } from "../utils/haptics";
import { titleSimilarity } from "../utils/fuzzy";

// ── Modal de choix "Ajouter quoi ?" ──────────────────────────────────────────
function AddChoiceModal({ onAddTitle, onCreateList, onClose }) {
  return (
    <Modal onClose={onClose} maxWidth="max-w-xs" zIndex="z-50">
      <div>
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
          <p className="font-mono text-[11px] uppercase tracking-widest text-violet-400">Ajouter</p>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/10 text-violet-400">
            <X size={14} />
          </button>
        </div>
        <div className="p-3 space-y-2">
          <button onClick={onAddTitle}
            className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl bg-white/[0.04]
              border border-white/5 hover:bg-white/10 active:scale-[0.98] transition-all text-left">
            <div className="w-9 h-9 rounded-xl bg-violet-700/40 flex items-center justify-center flex-shrink-0">
              <Film size={18} className="text-violet-300" />
            </div>
            <div>
              <p className="text-sm font-semibold text-violet-100"
                style={{ fontFamily: "'Space Grotesk',sans-serif" }}>Anime ou Série</p>
              <p className="text-[11px] text-violet-400 mt-0.5">Ajouter un titre à ta bibliothèque</p>
            </div>
          </button>
          <button onClick={onCreateList}
            className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl bg-white/[0.04]
              border border-white/5 hover:bg-white/10 active:scale-[0.98] transition-all text-left">
            <div className="w-9 h-9 rounded-xl bg-amber-400/15 flex items-center justify-center flex-shrink-0">
              <ListPlus size={18} className="text-amber-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-violet-100"
                style={{ fontFamily: "'Space Grotesk',sans-serif" }}>Créer une liste</p>
              <p className="text-[11px] text-violet-400 mt-0.5">Organise tes titres en collections</p>
            </div>
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Puce de filtre rapide (bibliothèque) ─────────────────────────────────────
function QuickChip({ active, onClick, icon: Icon, disabled, children }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className={`flex-shrink-0 flex items-center gap-1 h-7 px-2.5 rounded-full text-[11px] font-medium border whitespace-nowrap
        active:scale-95 transition-all motion-reduce:transition-none disabled:opacity-40 ${active
          ? "bg-amber-400 border-amber-400 text-violet-950 font-semibold shadow-md shadow-amber-500/20"
          : "bg-violet-900/40 border-white/10 text-violet-200 hover:bg-white/10"}`}>
      <Icon size={12} className="flex-shrink-0" />{children}
    </button>
  );
}

// ── Sous-titre de groupe : ANIMES · 265 ──────────────────────────────────────
function GroupLabel({ icon: Icon, label, count }) {
  return (
    <div className="flex items-center gap-2 mb-2 text-violet-300">
      <Icon size={14} className="flex-shrink-0" />
      <p className="text-[11px] font-semibold uppercase tracking-widest">{label}</p>
      <span className="text-violet-500">·</span>
      <span className="text-[11px] font-semibold">{count}</span>
    </div>
  );
}

// ── Options de tri ────────────────────────────────────────────────────────────
const SORT_OPTIONS = [
  { key: "date",        label: "Récents"    },
  { key: "title",       label: "A → Z"      },
  { key: "title-desc",  label: "Z → A"      },
  { key: "rating",      label: "Notes +"    },
  { key: "rating-asc",  label: "Notes -"    },
  { key: "progress",    label: "Progression" },
];

function sortEntries(entries, sortBy) {
  return [...entries].sort((a, b) => {
    if (sortBy === "date")
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    if (sortBy === "title")
      return a.title.localeCompare(b.title, "fr", { sensitivity: "base" });
    if (sortBy === "title-desc")
      return b.title.localeCompare(a.title, "fr", { sensitivity: "base" });
    if (sortBy === "rating")
      return (b.rating || 0) - (a.rating || 0);
    if (sortBy === "rating-asc")
      return (a.rating || 0) - (b.rating || 0);
    if (sortBy === "progress") {
      const pct = (e) => {
        const tot = e.seasons.reduce((s, se) => s + (se.totalEpisodes || 0), 0);
        const wat = e.seasons.reduce((s, se) => s + (se.watchedEpisodes || 0), 0);
        return tot > 0 ? wat / tot : 0;
      };
      return pct(b) - pct(a);
    }
    return 0;
  });
}

// ── Page Home ─────────────────────────────────────────────────────────────────
export function Home() {
  const { entries, loading, saveError, offline } = useLibrary();
  const { lists }  = useLists();
  const { syncAll, syncing, progress } = useSync();
  const navigate   = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [typeFilter, setTypeFilter] = useState(
    () => searchParams.get("type") || localStorage.getItem("pref_defaultFilter") || "all"
  );
  const [selectedStatuses, setSelectedStatuses] = useState(
    () => searchParams.get("status")?.split(",").filter(Boolean) || []
  );
  const [sortBy, setSortBy] = useState(
    () => searchParams.get("sort") || "date"
  );
  const [searchQuery,       setSearchQuery]       = useState("");
  const [showForm,          setShowForm]          = useState(false);
  const [editingEntry,      setEditingEntry]      = useState(null);
  const [showAddChoice,     setShowAddChoice]     = useState(false);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [showCalendarOnly,  setShowCalendarOnly]  = useState(false);
  const [airingIds,         setAiringIds]         = useState(new Set());
  const [todaySchedules,    setTodaySchedules]    = useState([]);
  const [nextAiringByEntry, setNextAiringByEntry] = useState(new Map()); // entryId -> { episode, airingAt } | null — pour dériver le statut "à jour"
  const [cachetteOpen,      setCachetteOpen]      = useState(false);
  const [cachetteRevealed,  setCachetteRevealed]  = useState(false);
  const [cachetteSortBy,    setCachetteSortBy]    = useState("date");
  const [cachetteSortOpen,  setCachetteSortOpen]  = useState(false);
  const [mainListCollapsed, setMainListCollapsed] = useState(false);
  const [showFilterPanel,   setShowFilterPanel]   = useState(false);
  const [weeklyGoal,       setWeeklyGoal]       = useState(getWeeklyGoal);
  const cachetteSortRef = useRef(null);

  useEffect(() => {
    if (!cachetteSortOpen) return;
    function handleOutside(e) {
      if (!cachetteSortRef.current?.contains(e.target)) setCachetteSortOpen(false);
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [cachetteSortOpen]);

  useEffect(() => {
    const p = {};
    if (typeFilter !== "all")    p.type   = typeFilter;
    if (selectedStatuses.length) p.status = selectedStatuses.join(",");
    if (sortBy !== "date")       p.sort   = sortBy;
    setSearchParams(p, { replace: true });
  }, [typeFilter, selectedStatuses, sortBy, setSearchParams]);

  useEffect(() => {
    if (!loading && entries.length > 0) {
      const t = setTimeout(() => syncAll(), 1500);
      return () => clearTimeout(t);
    }
  }, [loading]); // eslint-disable-line

  // ── Titres "dans le calendrier" (diffusés cette semaine) ────────────────────
  // Réutilise la même clé de cache que Calendar.jsx (offset 0) pour éviter un
  // second appel réseau si l'utilisateur a déjà visité le calendrier récemment.
  useEffect(() => {
    let cancelled = false;
    const cacheKey = "calendar_week_0";

    function applySchedules(schedules) {
      if (cancelled) return;
      setAiringIds(new Set((schedules || []).map((s) => String(s.media?.id)).filter(Boolean)));

      // Épisodes qui diffusent aujourd'hui (heure locale), pour le carrousel
      // "Sort aujourd'hui" sur la homepage.
      const now       = new Date();
      const dayStart  = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 1000;
      const dayEnd    = dayStart + 86400;
      setTodaySchedules((schedules || []).filter((s) => s.airingAt >= dayStart && s.airingAt < dayEnd));
    }

    const cached = getCached(cacheKey);
    if (cached) { applySchedules(cached.schedules); return; }

    fetchWeeklySchedule(0)
      .then(({ schedules, monday }) => {
        setCached(cacheKey, { schedules, monday }, TTL.CALENDAR);
        applySchedules(schedules);
      })
      .catch(() => {
        const stale = getStaleCached(cacheKey);
        if (stale) applySchedules(stale.schedules);
      });

    return () => { cancelled = true; };
  }, []);

  // ── Prochaine diffusion connue pour les titres "en-cours" ───────────────────
  // Nécessaire pour dériver le statut d'affichage "à jour" (voir
  // utils/status.js::getDisplayStatus) sur TOUTE la bibliothèque, pas
  // seulement les cartes actuellement montées à l'écran — sinon le filtre
  // "à jour" ne pourrait matcher que ce qui est déjà visible. Repose sur le
  // même cache (clé + TTL) que celui utilisé par Card.jsx pour son propre
  // compte à rebours : ça ne double pas le trafic réseau, ça se contente de
  // lire/amorcer le même cache un peu plus tôt.
  useEffect(() => {
    let cancelled = false;
    const targets = entries.filter((e) =>
      e.status === "en-cours" &&
      ((e.source === "anilist" && e.anilistIds?.length) || (e.source === "tvmaze" && e.tvmazeId))
    );
    if (!targets.length) { setNextAiringByEntry(new Map()); return; }

    // Étalé dans le temps (comme Card.jsx) pour ne pas envoyer une rafale
    // de requêtes simultanées si beaucoup de titres sont "en-cours".
    Promise.all(targets.map((e, i) =>
      new Promise((resolve) => {
        setTimeout(async () => {
          try { resolve([e.id, await fetchNextAiring(e)]); }
          catch { resolve([e.id, null]); }
        }, (i % 12) * 120);
      })
    )).then((pairs) => {
      if (cancelled) return;
      setNextAiringByEntry(new Map(pairs));
    });

    return () => { cancelled = true; };
  }, [entries]);

  const hiddenListEntries = useMemo(() => {
    const hidden = lists.find(l => l.id === HIDDEN_LIST_ID);
    return new Set((hidden?.entries || []).map(e => e.entryId));
  }, [lists]);

  const favoritesEntryIds = useMemo(() => {
    const favList = lists.find(l => l.isFavorites);
    return new Set((favList?.entries || []).map(e => e.entryId));
  }, [lists]);

  const toggleStatus = useCallback((status) => {
    setSelectedStatuses((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]);
  }, []);

  const visibleEntries    = useMemo(() => entries.filter(e => !hiddenListEntries.has(e.id)), [entries, hiddenListEntries]);
  const hiddenFullEntries = useMemo(() => entries.filter(e => hiddenListEntries.has(e.id)),  [entries, hiddenListEntries]);
  const sortedHiddenEntries = useMemo(() => sortEntries(hiddenFullEntries, cachetteSortBy), [hiddenFullEntries, cachetteSortBy]);

  const byType = useMemo(() => {
    if (typeFilter === "all")   return visibleEntries;
    if (typeFilter === "film")  return visibleEntries.filter(e => e.category === "movie");
    if (typeFilter === "serie") return visibleEntries.filter(e => e.type === "serie" && e.category !== "movie");
    return visibleEntries.filter(e => e.type === typeFilter); // "anime"
  }, [visibleEntries, typeFilter]);

  const isAiringThisWeek = useCallback(
    (e) => (e.anilistIds || []).some((id) => airingIds.has(String(id))),
    [airingIds]
  );

  // ── Épisodes du jour (titres visibles uniquement — la cachette reste secrète) ──
  const todayAiringEntries = useMemo(() => {
    if (!todaySchedules.length || !byType.length) return [];
    const byAnilistId = new Map();
    byType.forEach((e) => (e.anilistIds || []).forEach((id) => byAnilistId.set(String(id), e)));

    return todaySchedules
      .map((s) => {
        const entry = byAnilistId.get(String(s.media?.id));
        if (!entry) return null;
        return { entry, episode: s.episode, airingAt: s.airingAt, anilistId: s.media?.id, cover: s.media?.coverImage?.large || entry.coverImage };
      })
      .filter(Boolean)
      .sort((a, b) => a.airingAt - b.airingAt);
  }, [todaySchedules, byType]);

  // ── "Continuer de regarder" : titres en cours, les plus récemment touchés d'abord ──
  const continueEntries = useMemo(
    () => byType.filter((e) => e.status === "en-cours").sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)).slice(0, 3),
    [byType]
  );

  // ── Stats de la semaine (tous titres, comme l'ancien bandeau de stats) ──
  const week = useMemo(() => calcWeekStats(entries), [entries]);
  const saveGoal = (v) => { localStorage.setItem(WEEKLY_GOAL_KEY, String(v)); setWeeklyGoal(v); };

  const filtered = useMemo(() => {
    const q = searchQuery.trim();
    const qLower = q.toLowerCase();
    return byType.filter((e) => {
      const statusOk   = selectedStatuses.length === 0
        || selectedStatuses.includes(getDisplayStatus(e, nextAiringByEntry.get(e.id)));
      const favOk      = !showFavoritesOnly || favoritesEntryIds.has(e.id);
      const calendarOk = !showCalendarOnly  || isAiringThisWeek(e);

      const titleFields = [e.title, e.titleFrench, e.titleEnglish, e.titleRomaji].filter(Boolean);
      const titleSubstringOk = titleFields.some((t) => t.toLowerCase().includes(qLower));
      // Filet fuzzy : tolère fautes de frappe, accents, ordre des mots
      // différent, etc. Ne se déclenche que si le match exact par
      // sous-chaîne a échoué. Seuil volontairement strict (0.72) et à
      // partir de 4 caractères minimum : en dessous, le score par mot de
      // titleSimilarity (basé sur Levenshtein) devient trop généreux — une
      // requête ou un mot court peut atteindre un score élevé avec un seul
      // caractère de différence, ce qui faisait remonter des titres sans
      // rapport réel avec la recherche.
      const titleFuzzyOk = !titleSubstringOk && q.length >= 4
        && titleFields.some((t) => titleSimilarity(q, t) >= 0.72);

      const searchOk = !q
        || titleSubstringOk
        || titleFuzzyOk
        || (e.genres || []).some((g) => g.toLowerCase().includes(qLower))
        || (e.notes || "").toLowerCase().includes(qLower);
      return statusOk && favOk && calendarOk && searchOk;
    });
  }, [byType, selectedStatuses, searchQuery, showFavoritesOnly, favoritesEntryIds, showCalendarOnly, isAiringThisWeek, nextAiringByEntry]);

  const sorted = useMemo(() => sortEntries(filtered, sortBy), [filtered, sortBy]);

  const filteredAnime = useMemo(() => sorted.filter((e) => e.type === "anime"), [sorted]);
  const filteredSerie = useMemo(() => sorted.filter((e) => e.type === "serie" && e.category !== "movie"), [sorted]);
  const filteredFilm = useMemo(() => sorted.filter((e) => e.category === "movie"), [sorted]);

  const openNewForm    = () => { setShowAddChoice(false); setEditingEntry(null); setShowForm(true); };
  const openEditForm   = (entry) => { setEditingEntry(entry); setShowForm(true); };
  const handleCreateList = () => { setShowAddChoice(false); navigate("/lists"); };

  const isSearchActive = searchQuery.trim().length > 0;
  const gridKey = `${typeFilter}-${selectedStatuses.join(",")}-${searchQuery}-${showFavoritesOnly}-${showCalendarOnly}-${sortBy}`;
  const activeFilterCount = selectedStatuses.length + (showFavoritesOnly ? 1 : 0) + (sortBy !== "date" ? 1 : 0);
  const libraryRef = useRef(null);
  const seeAllInProgress = () => {
    haptics.tap();
    setSelectedStatuses(["en-cours"]);
    setMainListCollapsed(false);
    setTimeout(() => libraryRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };
  const hasLibraryFilters = selectedStatuses.length > 0 || showFavoritesOnly || showCalendarOnly;

  return (
    <div className="relative min-h-screen bg-violet-950 text-violet-50 flex flex-col"
      style={{ fontFamily: "'Inter', sans-serif" }}>
      {/*
       * PullToRefresh wrappe TOUT le contenu scrollable.
       * onRefresh déclenche une synchronisation forcée des données.
       * Le composant utilise des listeners natifs (passive: false sur touchmove)
       * pour fonctionner correctement en mode PWA standalone sur Android/iOS.
       */}
      <HomeBackdrop />
      <PullToRefresh onRefresh={() => syncAll(true)}>
        <div className="relative flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 pb-4">
          <HomeHeader syncing={syncing} syncProgress={progress} onSyncClick={() => syncAll(true)} />

          {offline && (
            <div className="relative mb-4 flex items-center gap-2 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30
              rounded-lg px-3 py-2 animate-fadeIn">
              <WifiOff size={14} className="flex-shrink-0" />
              Mode hors-ligne — dernières données synchronisées affichées.
            </div>
          )}

          {saveError && !offline && (
            <div className="relative mb-4 text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30
              rounded-lg px-3 py-2 animate-fadeIn">
              La sauvegarde a échoué. Tes changements restent visibles mais pourraient ne pas persister.
            </div>
          )}

          <div className="relative">
            {!loading && entries.length > 0 && (
              <WeekSummary entries={entries} week={week} goal={weeklyGoal}
                onGoalChange={saveGoal} onOpenHistory={() => navigate("/history")} />
            )}

            <SearchTabs
              searchQuery={searchQuery} onSearchChange={setSearchQuery}
              typeFilter={typeFilter} onTypeFilterChange={setTypeFilter}
              filterCount={activeFilterCount} onOpenFilters={() => { haptics.tap(); setShowFilterPanel(true); }}
            />

            {/* Dashboard masqué pendant une recherche texte : on n'affiche que les résultats */}
            {!loading && !isSearchActive && (
              <>
                <TodaySection items={todayAiringEntries} nextAiringByEntry={nextAiringByEntry} />
                <ContinueSection entries={continueEntries} onSeeAll={seeAllInProgress} />
                {entries.length > 0 && <ActivityCard week={week} goal={weeklyGoal} onOpenHistory={() => navigate("/history")} />}
              </>
            )}

          </div>

          {/* ── En-tête bibliothèque + filtres rapides ── */}
          {!loading && (
            <div ref={libraryRef} className="scroll-mt-4 mb-3">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-baseline gap-2 min-w-0">
                  <LibraryBig size={16} className="text-violet-200 self-center flex-shrink-0" />
                  <h2 className="text-base font-bold text-white truncate" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>Bibliothèque</h2>
                  <span className="text-[11px] text-violet-300 flex-shrink-0">· {sorted.length} titre{sorted.length !== 1 ? "s" : ""}</span>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {sorted.length > 0 && (
                    <button onClick={() => { haptics.tap(); setMainListCollapsed(v => !v); }}
                      aria-label={mainListCollapsed ? "Déplier la bibliothèque" : "Replier la bibliothèque"}
                      className="h-8 w-8 flex items-center justify-center rounded-xl bg-violet-900/40 border border-white/10 text-violet-300 hover:bg-white/10 active:scale-95 transition-all">
                      <ChevronDown size={15} className={`transition-transform duration-300 motion-reduce:transition-none ${mainListCollapsed ? "rotate-180" : ""}`} />
                    </button>
                  )}
                  <button onClick={() => { haptics.tap(); setShowFilterPanel(true); }} aria-label="Filtres et tri"
                    className="relative h-8 w-8 flex items-center justify-center rounded-xl bg-violet-900/40 border border-white/10 text-violet-200 hover:bg-white/10 active:scale-95 transition-all">
                    <SlidersHorizontal size={15} />
                    {activeFilterCount > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-[15px] h-[15px] px-1 rounded-full bg-amber-400 text-violet-950 text-[9px] font-bold flex items-center justify-center">{activeFilterCount}</span>
                    )}
                  </button>
                </div>
              </div>

              <div className="flex gap-2 overflow-x-auto scrollbar-none -mx-4 px-4">
                <QuickChip icon={LayoutGrid} active={!hasLibraryFilters}
                  onClick={() => { haptics.tap(); setSelectedStatuses([]); setShowFavoritesOnly(false); setShowCalendarOnly(false); }}>Tout</QuickChip>
                <QuickChip icon={PlayCircle} active={selectedStatuses.includes("en-cours")}
                  onClick={() => { haptics.tap(); toggleStatus("en-cours"); }}>En cours</QuickChip>
                <QuickChip icon={Eye} active={selectedStatuses.includes("a-voir")}
                  onClick={() => { haptics.tap(); toggleStatus("a-voir"); }}>À voir</QuickChip>
                <QuickChip icon={CalendarDays} active={showCalendarOnly} disabled={airingIds.size === 0}
                  onClick={() => { haptics.tap(); setShowCalendarOnly(v => !v); }}>Cette semaine</QuickChip>
              </div>
            </div>
          )}

          {/* ── Contenu principal ── */}
          {loading ? (
            <SkeletonGrid count={6} />

          ) : sorted.length === 0 ? (
            <div className="text-center py-20 rounded-2xl border border-dashed border-white/10 animate-fadeIn">
              {showFavoritesOnly ? (
                <><p className="text-4xl mb-4 animate-popIn">♡</p>
                  <p className="text-violet-300 mb-1">Aucun favori ici</p>
                  <p className="text-violet-500 text-sm">Utilise le ♡ dans les détails d'une série.</p></>
              ) : isSearchActive ? (
                <><p className="text-4xl mb-4 animate-popIn">🔍</p>
                  <p className="text-violet-300 mb-1">Aucun résultat pour <span className="text-violet-100 font-semibold">« {searchQuery} »</span></p>
                  <p className="text-violet-500 text-sm">Essaie un autre terme ou ajoute ce titre.</p></>
              ) : (
                <><p className="text-4xl mb-4 animate-popIn">📭</p>
                  <p className="text-violet-300 mb-1">Aucun titre ici</p>
                  <p className="text-violet-500 text-sm">Ajoute un anime ou une série pour commencer.</p></>
              )}
            </div>

          ) : !mainListCollapsed && (
            typeFilter === "all" ? (
              <div key={gridKey} className="space-y-5 animate-fadeIn">
                {filteredAnime.length > 0 && (
                  <section>
                    <GroupLabel icon={MonitorPlay} label="ANIMES" count={filteredAnime.length} />
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
                      {filteredAnime.map((e, i) => <Card key={e.id} entry={e} onEdit={openEditForm} index={i} isAiring={isAiringThisWeek(e)} />)}
                    </div>
                  </section>
                )}
                {filteredSerie.length > 0 && (
                  <section>
                    <GroupLabel icon={Tv} label="SÉRIES" count={filteredSerie.length} />
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
                      {filteredSerie.map((e, i) => <Card key={e.id} entry={e} onEdit={openEditForm} index={i} isAiring={isAiringThisWeek(e)} />)}
                    </div>
                  </section>
                )}
                {filteredFilm.length > 0 && (
                  <section>
                    <GroupLabel icon={Clapperboard} label="FILMS" count={filteredFilm.length} />
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
                      {filteredFilm.map((e, i) => <Card key={e.id} entry={e} onEdit={openEditForm} index={i} isAiring={isAiringThisWeek(e)} />)}
                    </div>
                  </section>
                )}
              </div>
            ) : (
              <div key={gridKey} className="grid grid-cols-1 lg:grid-cols-2 gap-2.5 animate-fadeIn">
                {sorted.map((e, i) => <Card key={e.id} entry={e} onEdit={openEditForm} index={i} isAiring={isAiringThisWeek(e)} />)}
              </div>
            )
          )}

          {/* ── Cachette secrète — un seul bloc, thème rosé, fusionné une fois ouvert ── */}
          {hiddenFullEntries.length > 0 && (
            <div
              className={`mt-6 rounded-2xl border overflow-hidden transition-colors motion-reduce:transition-none ${
                cachetteOpen ? "border-pink-500/25 bg-pink-950/40" : "border-pink-500/15 bg-pink-950/10 hover:bg-pink-950/20"
              }`}
              id="cachette-section"
            >
              <button onClick={() => setCachetteOpen(v => !v)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-pink-300/80 hover:text-pink-200 transition-colors active:scale-[0.99] motion-reduce:transition-none">
                <span className="flex items-center gap-2 min-w-0">
                  {cachetteOpen ? <EyeOff size={13} className="flex-shrink-0" /> : <Eye size={13} className="flex-shrink-0" />}
                  <span className="font-mono text-[10px] uppercase tracking-widest truncate">
                    {cachetteOpen ? "Masquer" : "Cachette secrète"} · {hiddenFullEntries.length} titre{hiddenFullEntries.length > 1 ? "s" : ""}
                  </span>
                </span>
                {!cachetteOpen && <HeartIcon size={14} strokeWidth={18} className="text-pink-400 flex-shrink-0" />}
              </button>

              {cachetteOpen && (
                <div className="border-t border-pink-500/15 animate-fadeIn">
                  <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-pink-500/15 flex-wrap">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-pink-300/70 flex-shrink-0">Contenu secret</p>
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      <div className="relative" ref={cachetteSortRef}>
                        <button
                          onClick={() => setCachetteSortOpen(v => !v)}
                          className="flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[10px] font-mono
                            bg-white/5 border border-pink-500/20 text-pink-200
                            hover:bg-white/10 hover:text-pink-100 transition-all active:scale-95"
                        >
                          {SORT_OPTIONS.find(o => o.key === cachetteSortBy)?.label}
                          <ChevronDown size={10} className={`transition-transform motion-reduce:transition-none ${cachetteSortOpen ? "rotate-180" : ""}`} />
                        </button>
                        {cachetteSortOpen && (
                          <div className="absolute right-0 top-full mt-1 z-20 w-32 rounded-xl bg-violet-900 border border-pink-500/20 shadow-xl overflow-hidden animate-fadeIn">
                            {SORT_OPTIONS.map(opt => (
                              <button
                                key={opt.key}
                                onClick={() => { setCachetteSortBy(opt.key); setCachetteSortOpen(false); }}
                                className={`w-full text-left px-3 py-2 text-[11px] font-mono transition-colors motion-reduce:transition-none ${
                                  opt.key === cachetteSortBy ? "text-pink-300 bg-pink-500/10" : "text-violet-200 hover:bg-white/5"
                                }`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <button onClick={() => setCachetteRevealed(v => !v)}
                        className={`flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[10px] font-mono border transition-all active:scale-95 flex-shrink-0 ${cachetteRevealed
                          ? "bg-pink-500/20 border-pink-500/40 text-pink-300"
                          : "bg-white/5 border-pink-500/20 text-pink-200 hover:bg-pink-500/10 hover:border-pink-500/30 hover:text-pink-100"}`}>
                        {cachetteRevealed ? <Eye size={11} /> : <EyeOff size={11} />}
                        {cachetteRevealed ? "Flouter" : "Révéler"}
                      </button>
                    </div>
                  </div>
                  <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-2.5">
                    {sortedHiddenEntries.map((e, i) => (
                      <div key={e.id} className={`transition-all duration-500 ${cachetteRevealed ? "" : "blur-sm hover:blur-none"}`}>
                        <Card entry={e} onEdit={openEditForm} index={i} isAiring={isAiringThisWeek(e)} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <Footer />
      </PullToRefresh>

      <AnimatePresence>
        {showAddChoice && (
          <AddChoiceModal key="add-choice" onAddTitle={openNewForm} onCreateList={handleCreateList}
            onClose={() => setShowAddChoice(false)} />
        )}
        {showFilterPanel && (
          <FilterPanel
            key="filter-panel"
            selectedStatuses={selectedStatuses} onToggleStatus={toggleStatus}
            showFavoritesOnly={showFavoritesOnly} onToggleFavorites={() => { haptics.tap(); setShowFavoritesOnly(v => !v); }}
            onClearStatuses={() => setSelectedStatuses([])}
            sortBy={sortBy} onSortChange={setSortBy}
            onClose={() => setShowFilterPanel(false)}
          />
        )}
        {showForm && (
          <TitleFormModal key="title-form" editingEntry={editingEntry}
            onClose={() => { setShowForm(false); setEditingEntry(null); }} />
        )}
      </AnimatePresence>
    </div>
  );
}