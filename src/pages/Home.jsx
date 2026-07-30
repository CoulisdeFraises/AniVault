import { useState, useMemo, useEffect, useCallback } from "react";
import { useSearchParams, useNavigate }  from "react-router-dom";
import { Header }           from "../components/Header/Header";
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
  ChevronDown, CalendarDays,
} from "lucide-react";
import { ContinueWatching } from "../components/common/ContinueWatching";
import { fetchWeeklySchedule } from "../api/anilist";
import { getCached, setCached, getStaleCached, TTL } from "../lib/cache";
import { haptics } from "../utils/haptics";

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

// ── Options de tri ────────────────────────────────────────────────────────────
const SORT_OPTIONS = [
  { key: "date",     label: "Récents"           },
  { key: "title",    label: "A → Z"             },
  { key: "rating",   label: "Meilleures notes"  },
  { key: "progress", label: "Progression"       },
];

function sortEntries(entries, sortBy) {
  if (sortBy === "date") return entries;
  return [...entries].sort((a, b) => {
    if (sortBy === "title")
      return a.title.localeCompare(b.title, "fr", { sensitivity: "base" });
    if (sortBy === "rating")
      return (b.rating || 0) - (a.rating || 0);
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
  const { entries, loading, saveError } = useLibrary();
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
  const [cachetteOpen,      setCachetteOpen]      = useState(false);
  const [cachetteRevealed,  setCachetteRevealed]  = useState(false);
  const [cachetteSortBy,    setCachetteSortBy]    = useState("date");

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

  const byType = useMemo(
    () => typeFilter === "all" ? visibleEntries : visibleEntries.filter((e) => e.type === typeFilter),
    [visibleEntries, typeFilter]);

  const isAiringThisWeek = useCallback(
    (e) => (e.anilistIds || []).some((id) => airingIds.has(String(id))),
    [airingIds]
  );

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return byType.filter((e) => {
      const statusOk   = selectedStatuses.length === 0 || selectedStatuses.includes(e.status);
      const favOk      = !showFavoritesOnly || favoritesEntryIds.has(e.id);
      const calendarOk = !showCalendarOnly  || isAiringThisWeek(e);
      const searchOk = !q || e.title.toLowerCase().includes(q)
        || (e.genres || []).some((g) => g.toLowerCase().includes(q))
        || (e.notes || "").toLowerCase().includes(q);
      return statusOk && favOk && calendarOk && searchOk;
    });
  }, [byType, selectedStatuses, searchQuery, showFavoritesOnly, favoritesEntryIds, showCalendarOnly, isAiringThisWeek]);

  const sorted = useMemo(() => sortEntries(filtered, sortBy), [filtered, sortBy]);

  const filteredAnime = useMemo(() => sorted.filter((e) => e.type === "anime"), [sorted]);
  const filteredSerie = useMemo(() => sorted.filter((e) => e.type === "serie"),  [sorted]);

  const openNewForm    = () => { setShowAddChoice(false); setEditingEntry(null); setShowForm(true); };
  const openEditForm   = (entry) => { setEditingEntry(entry); setShowForm(true); };
  const handleCreateList = () => { setShowAddChoice(false); navigate("/lists"); };

  const isSearchActive = searchQuery.trim().length > 0;
  const gridKey = `${typeFilter}-${selectedStatuses.join(",")}-${searchQuery}-${showFavoritesOnly}-${showCalendarOnly}-${sortBy}`;

  return (
    <div className="min-h-screen bg-violet-950 text-violet-50 flex flex-col"
      style={{ fontFamily: "'Inter', sans-serif" }}>
      {/*
       * PullToRefresh wrappe TOUT le contenu scrollable.
       * onRefresh déclenche une synchronisation forcée des données.
       * Le composant utilise des listeners natifs (passive: false sur touchmove)
       * pour fonctionner correctement en mode PWA standalone sur Android/iOS.
       */}
      <PullToRefresh onRefresh={() => syncAll(true)}>
        <div className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-8">
          <Header
            typeFilter={typeFilter} selectedStatuses={selectedStatuses} searchQuery={searchQuery}
            onTypeFilterChange={setTypeFilter} onToggleStatus={toggleStatus}
            onClearFilters={() => setSelectedStatuses([])} onSearchChange={setSearchQuery}
            onAddClick={() => setShowAddChoice(true)} syncing={syncing}
            syncProgress={progress} onSyncClick={() => syncAll(true)}
          />

          {/* ── Barre de contrôles : Favoris + Calendrier + Tri ── */}
          <div className="flex flex-wrap items-center gap-2 mt-3 mb-4">
            {/* Favoris */}
            <button
              onClick={() => { haptics.tap(); setShowFavoritesOnly(v => !v); }}
              className={`flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-mono border flex-shrink-0
                transition-all active:scale-95 motion-reduce:transition-none ${showFavoritesOnly
                  ? "bg-pink-500/20 border-pink-500/40 text-pink-300"
                  : "bg-white/5 border-white/10 text-violet-400 hover:bg-pink-500/10 hover:border-pink-500/30 hover:text-pink-400"}`}
            >
              <Heart size={12} className="flex-shrink-0" fill={showFavoritesOnly ? "currentColor" : "none"} />
              Favoris
            </button>

            {/* Dans le calendrier */}
            <button
              onClick={() => { haptics.tap(); setShowCalendarOnly(v => !v); }}
              disabled={airingIds.size === 0}
              className={`flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-mono border flex-shrink-0
                transition-all active:scale-95 motion-reduce:transition-none disabled:opacity-40 disabled:cursor-not-allowed ${showCalendarOnly
                  ? "bg-teal-500/20 border-teal-500/40 text-teal-300"
                  : "bg-white/5 border-white/10 text-violet-400 hover:bg-teal-500/10 hover:border-teal-500/30 hover:text-teal-400"}`}
            >
              <CalendarDays size={12} className="flex-shrink-0" />
              Semaine
            </button>

            {/* Tri — liste déroulante */}
            <div className="relative flex-shrink-0">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="appearance-none flex items-center gap-1.5 h-8 pl-3 pr-7 rounded-full
                  text-xs font-mono border border-white/10 bg-white/5 text-violet-400
                  hover:bg-white/10 hover:text-violet-100
                  focus:outline-none focus:border-violet-500/50
                  transition-all active:scale-95 motion-reduce:transition-none cursor-pointer max-w-[130px]"
              >
                {SORT_OPTIONS.map(opt => (
                  <option key={opt.key} value={opt.key}
                    className="bg-violet-900 text-violet-100">
                    {opt.label}
                  </option>
                ))}
              </select>
              {/* Icône chevron */}
              <ChevronDown size={11} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-violet-500" />
            </div>
          </div>

          {saveError && (
            <div className="mb-4 text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30
              rounded-lg px-3 py-2 animate-fadeIn">
              La sauvegarde a échoué. Tes changements restent visibles mais pourraient ne pas persister.
            </div>
          )}

          {/* ── Widget Continuer à regarder ── */}
          {!loading && <ContinueWatching />}
          {/* ── Contenu ── */}
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

          ) : typeFilter === "all" ? (
            <div key={gridKey} className="space-y-8 animate-fadeIn">
              {filteredAnime.length > 0 && (
                <section>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-violet-500 mb-3">
                    Animes · {filteredAnime.length}
                  </p>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {filteredAnime.map((e, i) => <Card key={e.id} entry={e} onEdit={openEditForm} index={i} isAiring={isAiringThisWeek(e)} />)}
                  </div>
                </section>
              )}
              {filteredSerie.length > 0 && (
                <section>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-violet-500 mb-3">
                    Séries · {filteredSerie.length}
                  </p>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {filteredSerie.map((e, i) => <Card key={e.id} entry={e} onEdit={openEditForm} index={i} isAiring={isAiringThisWeek(e)} />)}
                  </div>
                </section>
              )}
            </div>
          ) : (
            <div key={gridKey} className="grid grid-cols-1 lg:grid-cols-2 gap-3 animate-fadeIn">
              {sorted.map((e, i) => <Card key={e.id} entry={e} onEdit={openEditForm} index={i} isAiring={isAiringThisWeek(e)} />)}
            </div>
          )}

          {/* ── Cachette secrète ── */}
          {hiddenFullEntries.length > 0 && (
            <div className="mt-10" id="cachette-section">
              <button onClick={() => setCachetteOpen(v => !v)}
                className="w-full flex items-center justify-center gap-3 py-3 px-5 rounded-2xl
                  border border-violet-700/30 bg-violet-900/20 hover:bg-violet-900/40 transition-all group">
                <span className={`text-violet-500 group-hover:text-violet-300 transition-all duration-300 ${cachetteOpen ? "scale-110" : "animate-pulse"}`}>
                  {cachetteOpen ? <EyeOff size={20} /> : <Eye size={20} />}
                </span>
                <span className="font-mono text-[11px] uppercase tracking-widest text-violet-500 group-hover:text-violet-300 transition-colors select-none">
                  {cachetteOpen ? "Masquer" : "Cachette secrète"} · {hiddenFullEntries.length} titre{hiddenFullEntries.length > 1 ? "s" : ""}
                </span>
                {!cachetteOpen && <span className="font-mono text-[10px] text-violet-700 animate-bounce">👀</span>}
              </button>

              {cachetteOpen && (
                <div className="mt-4 rounded-2xl border border-violet-700/20 bg-violet-950/60 overflow-hidden animate-fadeIn">
                  <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-violet-800/30">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-violet-600 flex-shrink-0">Contenu secret</p>
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <select
                          value={cachetteSortBy}
                          onChange={(e) => setCachetteSortBy(e.target.value)}
                          className="appearance-none pl-3 pr-7 py-1.5 rounded-full text-[10px] font-mono
                            bg-white/5 border border-white/10 text-violet-400
                            hover:bg-white/10 hover:text-violet-200
                            focus:outline-none focus:border-violet-500/50
                            transition-all cursor-pointer"
                        >
                          {SORT_OPTIONS.map(opt => (
                            <option key={opt.key} value={opt.key} className="bg-violet-900 text-violet-100">
                              {opt.label}
                            </option>
                          ))}
                        </select>
                        <ChevronDown size={10} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-violet-500" />
                      </div>
                      <button onClick={() => setCachetteRevealed(v => !v)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-mono border transition-all active:scale-95 flex-shrink-0 ${cachetteRevealed
                          ? "bg-pink-500/20 border-pink-500/40 text-pink-300"
                          : "bg-white/5 border-white/10 text-violet-500 hover:bg-pink-500/10 hover:border-pink-500/30 hover:text-pink-400"}`}>
                        {cachetteRevealed ? <Eye size={11} /> : <EyeOff size={11} />}
                        {cachetteRevealed ? "Flouter" : "Révéler"}
                      </button>
                    </div>
                  </div>
                  <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-3">
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

      {showAddChoice && (
        <AddChoiceModal onAddTitle={openNewForm} onCreateList={handleCreateList}
          onClose={() => setShowAddChoice(false)} />
      )}
      {showForm && (
        <TitleFormModal editingEntry={editingEntry}
          onClose={() => { setShowForm(false); setEditingEntry(null); }} />
      )}
    </div>
  );
}