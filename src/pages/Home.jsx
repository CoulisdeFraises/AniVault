import { useState, useMemo, useEffect } from "react";
import { Header }         from "../components/Header/Header";
import { Card }           from "../components/Card/Card";
import { TitleFormModal } from "../components/Modal/TitleFormModal";
import { Confetti }       from "../components/common/Confetti";
import { Footer }         from "../components/common/Footer";
import { useLibrary }     from "../context/LibraryContext";
import { useLists, HIDDEN_LIST_ID } from "../context/ListsContext";
import { useSync }        from "../hooks/useSync";
import { Film, Tv, ListPlus, X, Heart, Eye, EyeOff } from "lucide-react";
import { useNavigate }    from "react-router-dom";

// ── Modal de choix "Ajouter quoi ?" ──────────────────────────────────────────
function AddChoiceModal({ onAddTitle, onCreateList, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}>
      <div className="w-full max-w-xs bg-violet-900 border border-white/10 rounded-2xl overflow-hidden shadow-2xl animate-fadeInUp"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
          <p className="font-mono text-[11px] uppercase tracking-widest text-violet-400">Ajouter</p>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/10 text-violet-400"><X size={14} /></button>
        </div>
        <div className="p-3 space-y-2">
          <button onClick={onAddTitle}
            className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl bg-white/[0.04] border border-white/5 hover:bg-white/10 active:scale-[0.98] transition-all text-left">
            <div className="w-9 h-9 rounded-xl bg-violet-700/40 flex items-center justify-center flex-shrink-0">
              <Film size={18} className="text-violet-300" />
            </div>
            <div>
              <p className="text-sm font-semibold text-violet-100" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>Anime ou Série</p>
              <p className="text-[11px] text-violet-400 mt-0.5">Ajouter un titre à ta bibliothèque</p>
            </div>
          </button>
          <button onClick={onCreateList}
            className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl bg-white/[0.04] border border-white/5 hover:bg-white/10 active:scale-[0.98] transition-all text-left">
            <div className="w-9 h-9 rounded-xl bg-amber-400/15 flex items-center justify-center flex-shrink-0">
              <ListPlus size={18} className="text-amber-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-violet-100" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>Créer une liste</p>
              <p className="text-[11px] text-violet-400 mt-0.5">Organise tes titres en collections</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

export function Home() {
  const { entries, loading, saveError, showConfetti } = useLibrary();
  const { lists } = useLists();
  const { syncAll, syncing, progress } = useSync();
  const navigate = useNavigate();

  // FIX : initialise le filtre depuis la préférence sauvegardée
  const [typeFilter,        setTypeFilter]        = useState(
    () => localStorage.getItem("pref_defaultFilter") || "all"
  );
  const [selectedStatuses,  setSelectedStatuses]  = useState([]);
  const [searchQuery,       setSearchQuery]       = useState("");
  const [showForm,          setShowForm]          = useState(false);
  const [editingEntry,      setEditingEntry]      = useState(null);
  const [showAddChoice,     setShowAddChoice]     = useState(false);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [cachetteOpen,      setCachetteOpen]      = useState(false);
  const [cachetteRevealed,  setCachetteRevealed]  = useState(false);

  useEffect(() => {
    if (!loading && entries.length > 0) {
      const t = setTimeout(() => syncAll(), 1500);
      return () => clearTimeout(t);
    }
  }, [loading]); // eslint-disable-line react-hooks/exhaustive-deps

  // IDs des entrées cachées (cachette secrète)
  const hiddenListEntries = useMemo(() => {
    const hidden = lists.find(l => l.id === HIDDEN_LIST_ID);
    return new Set((hidden?.entries || []).map(e => e.entryId));
  }, [lists]);

  // IDs des favoris
  const favoritesEntryIds = useMemo(() => {
    const favList = lists.find(l => l.isFavorites);
    return new Set((favList?.entries || []).map(e => e.entryId));
  }, [lists]);

  function toggleStatus(status) {
    setSelectedStatuses((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );
  }

  // Entrées visibles (excluant celles dans la cachette)
  const visibleEntries = useMemo(
    () => entries.filter(e => !hiddenListEntries.has(e.id)),
    [entries, hiddenListEntries]
  );

  // Entrées de la cachette (objets complets)
  const hiddenFullEntries = useMemo(
    () => entries.filter(e => hiddenListEntries.has(e.id)),
    [entries, hiddenListEntries]
  );

  const byType = useMemo(
    () => typeFilter === "all" ? visibleEntries : visibleEntries.filter((e) => e.type === typeFilter),
    [visibleEntries, typeFilter]
  );

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return byType.filter((e) => {
      const statusOk    = selectedStatuses.length === 0 || selectedStatuses.includes(e.status);
      const favOk       = !showFavoritesOnly || favoritesEntryIds.has(e.id);
      const searchOk    = !q || e.title.toLowerCase().includes(q) || (e.genres || []).some((g) => g.toLowerCase().includes(q)) || (e.notes || "").toLowerCase().includes(q);
      return statusOk && favOk && searchOk;
    });
  }, [byType, selectedStatuses, searchQuery, showFavoritesOnly, favoritesEntryIds]);

  const filteredAnime = useMemo(() => filtered.filter((e) => e.type === "anime"), [filtered]);
  const filteredSerie = useMemo(() => filtered.filter((e) => e.type === "serie"),  [filtered]);

  function openAddChoice()      { setShowAddChoice(true); }
  function openNewForm()        { setShowAddChoice(false); setEditingEntry(null); setShowForm(true); }
  function openEditForm(entry)  { setEditingEntry(entry); setShowForm(true); }
  function handleCreateList()   { setShowAddChoice(false); navigate("/lists"); }

  const isSearchActive = searchQuery.trim().length > 0;
  const gridKey = `${typeFilter}-${selectedStatuses.join(",")}-${searchQuery}-${showFavoritesOnly}`;

  return (
    <div className="min-h-screen bg-violet-950 text-violet-50 flex flex-col" style={{ fontFamily: "'Inter', sans-serif" }}>
      <Confetti active={showConfetti} />

      <div className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-8">
        <Header
          typeFilter={typeFilter}
          selectedStatuses={selectedStatuses}
          searchQuery={searchQuery}
          onTypeFilterChange={setTypeFilter}
          onToggleStatus={toggleStatus}
          onClearFilters={() => setSelectedStatuses([])}
          onSearchChange={setSearchQuery}
          onAddClick={openAddChoice}
          syncing={syncing}
          syncProgress={progress}
          onSyncClick={() => syncAll(true)}
        />

        {/* ── Filtre Favoris (sous le header) ── */}
        <div className="flex gap-2 mt-3 mb-4 flex-wrap">
          <button
            onClick={() => setShowFavoritesOnly(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono border transition-all active:scale-95 ${
              showFavoritesOnly
                ? "bg-pink-500/20 border-pink-500/40 text-pink-300"
                : "bg-white/5 border-white/10 text-violet-400 hover:bg-pink-500/10 hover:border-pink-500/30 hover:text-pink-400"
            }`}
          >
            <Heart size={12} fill={showFavoritesOnly ? "currentColor" : "none"} />
            Favoris
          </button>
        </div>

        {saveError && (
          <div className="mb-4 text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2 animate-fadeIn">
            La sauvegarde a échoué. Tes changements restent visibles mais pourraient ne pas persister.
          </div>
        )}

        {loading ? (
          <p className="text-violet-400 text-sm font-mono animate-fadeIn">Chargement…</p>

        ) : filtered.length === 0 ? (
          <div className="text-center py-20 rounded-2xl border border-dashed border-white/10 animate-fadeIn">
            {showFavoritesOnly ? (
              <>
                <p className="text-4xl mb-4 animate-popIn">♡</p>
                <p className="text-violet-300 mb-1">Aucun favori ici</p>
                <p className="text-violet-500 text-sm">Utilise le ♡ dans les détails d'une série pour l'ajouter.</p>
              </>
            ) : isSearchActive ? (
              <>
                <p className="text-4xl mb-4 animate-popIn">🔍</p>
                <p className="text-violet-300 mb-1">Aucun résultat pour <span className="text-violet-100 font-semibold">« {searchQuery} »</span></p>
                <p className="text-violet-500 text-sm">Essaie un autre terme ou ajoute ce titre.</p>
              </>
            ) : (
              <>
                <p className="text-4xl mb-4 animate-popIn">📭</p>
                <p className="text-violet-300 mb-1">Aucun titre ici</p>
                <p className="text-violet-500 text-sm">Ajoute un anime ou une série pour commencer.</p>
              </>
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
                  {filteredAnime.map((e, i) => (
                    <Card key={e.id} entry={e} onEdit={openEditForm} index={i} />
                  ))}
                </div>
              </section>
            )}
            {filteredSerie.length > 0 && (
              <section>
                <p className="font-mono text-[10px] uppercase tracking-widest text-violet-500 mb-3">
                  Séries · {filteredSerie.length}
                </p>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {filteredSerie.map((e, i) => (
                    <Card key={e.id} entry={e} onEdit={openEditForm} index={i} />
                  ))}
                </div>
              </section>
            )}
          </div>
        ) : (
          <div key={gridKey} className="grid grid-cols-1 lg:grid-cols-2 gap-3 animate-fadeIn">
            {filtered.map((e, i) => (
              <Card key={e.id} entry={e} onEdit={openEditForm} index={i} />
            ))}
          </div>
        )}

        {/* ── Section Cachette secrète (toujours tout en bas) ── */}
        {hiddenFullEntries.length > 0 && (
          <div className="mt-10">
            <button
              onClick={() => setCachetteOpen(v => !v)}
              className="w-full flex items-center justify-center gap-3 py-3 px-5 rounded-2xl border border-violet-700/30 bg-violet-900/20 hover:bg-violet-900/40 transition-all group"
            >
              <span className={`text-violet-500 group-hover:text-violet-300 transition-all duration-300 ${cachetteOpen ? "scale-110" : "animate-pulse"}`}>
                {cachetteOpen ? <EyeOff size={20} /> : <Eye size={20} />}
              </span>
              <span className="font-mono text-[11px] uppercase tracking-widest text-violet-500 group-hover:text-violet-300 transition-colors select-none">
                {cachetteOpen ? "Masquer" : "Cachette secrète"} · {hiddenFullEntries.length} titre{hiddenFullEntries.length > 1 ? "s" : ""}
              </span>
              {!cachetteOpen && (
                <span className="font-mono text-[10px] text-violet-700 animate-bounce">👀</span>
              )}
            </button>

            {cachetteOpen && (
              <div className="mt-4 rounded-2xl border border-violet-700/20 bg-violet-950/60 overflow-hidden animate-fadeIn">
                <div className="flex items-center justify-between px-4 py-3 border-b border-violet-800/30">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-violet-600">Contenu secret</p>
                  <button
                    onClick={() => setCachetteRevealed(v => !v)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-mono border transition-all active:scale-95 ${
                      cachetteRevealed
                        ? "bg-pink-500/20 border-pink-500/40 text-pink-300"
                        : "bg-white/5 border-white/10 text-violet-500 hover:bg-pink-500/10 hover:border-pink-500/30 hover:text-pink-400"
                    }`}
                  >
                    {cachetteRevealed ? <Eye size={11} /> : <EyeOff size={11} />}
                    {cachetteRevealed ? "Flouter" : "Révéler"}
                  </button>
                </div>

                <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {hiddenFullEntries.map((e, i) => (
                    <div
                      key={e.id}
                      className={`transition-all duration-500 ${cachetteRevealed ? "" : "blur-sm hover:blur-none"}`}
                    >
                      <Card entry={e} onEdit={openEditForm} index={i} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <Footer />

      {showAddChoice && (
        <AddChoiceModal
          onAddTitle={openNewForm}
          onCreateList={handleCreateList}
          onClose={() => setShowAddChoice(false)}
        />
      )}

      {showForm && (
        <TitleFormModal
          editingEntry={editingEntry}
          onClose={() => { setShowForm(false); setEditingEntry(null); }}
        />
      )}
    </div>
  );
}
