import { useState, useMemo, useEffect } from "react";
import { Header }         from "../components/Header/Header";
import { Card }           from "../components/Card/Card";
import { TitleFormModal } from "../components/Modal/TitleFormModal";
import { Confetti }       from "../components/common/Confetti";
import { Footer }         from "../components/common/Footer";
import { useLibrary }     from "../context/LibraryContext";
import { useSync }        from "../hooks/useSync";

export function Home() {
  const { entries, loading, saveError, showConfetti } = useLibrary();
  const { syncAll, syncing, progress } = useSync();

  const [typeFilter,       setTypeFilter]       = useState("all");
  const [selectedStatuses, setSelectedStatuses] = useState([]);
  const [searchQuery,      setSearchQuery]      = useState("");
  const [showForm,         setShowForm]         = useState(false);
  const [editingEntry,     setEditingEntry]     = useState(null);

  useEffect(() => {
    if (!loading && entries.length > 0) {
      const t = setTimeout(() => syncAll(), 1500);
      return () => clearTimeout(t);
    }
  }, [loading]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleStatus(status) {
    setSelectedStatuses((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );
  }

  // ── Filtrage type ────────────────────────────────────────────────────────
  const byType = useMemo(
    () => typeFilter === "all" ? entries : entries.filter((e) => e.type === typeFilter),
    [entries, typeFilter]
  );

  // ── Filtrage complet (statut + recherche) ────────────────────────────────
  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return byType.filter((e) => {
      const statusOk = selectedStatuses.length === 0 || selectedStatuses.includes(e.status);
      const searchOk =
        !q ||
        e.title.toLowerCase().includes(q) ||
        (e.genres || []).some((g) => g.toLowerCase().includes(q)) ||
        (e.notes  || "").toLowerCase().includes(q);
      return statusOk && searchOk;
    });
  }, [byType, selectedStatuses, searchQuery]);

  const filteredAnime = useMemo(() => filtered.filter((e) => e.type === "anime"), [filtered]);
  const filteredSerie = useMemo(() => filtered.filter((e) => e.type === "serie"),  [filtered]);

  function openNewForm()       { setEditingEntry(null);  setShowForm(true); }
  function openEditForm(entry) { setEditingEntry(entry); setShowForm(true); }

  const isSearchActive = searchQuery.trim().length > 0;
  const gridKey = `${typeFilter}-${selectedStatuses.join(",")}-${searchQuery}`;

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
          onAddClick={openNewForm}
          syncing={syncing}
          syncProgress={progress}
          onSyncClick={() => syncAll(true)}
        />

        {saveError && (
          <div className="mb-4 text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2 animate-fadeIn">
            La sauvegarde a échoué. Tes changements restent visibles mais pourraient ne pas persister.
          </div>
        )}

        {loading ? (
          <p className="text-violet-400 text-sm font-mono animate-fadeIn">Chargement…</p>

        ) : filtered.length === 0 ? (
          <div className="text-center py-20 rounded-2xl border border-dashed border-white/10 animate-fadeIn">
            {isSearchActive ? (
              <>
                <p className="text-4xl mb-4 animate-popIn">🔍</p>
                <p className="text-violet-300 mb-1">
                  Aucun résultat pour <span className="text-violet-100 font-semibold">« {searchQuery} »</span>
                </p>
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
      </div>

      <Footer />

      {showForm && (
        <TitleFormModal
          editingEntry={editingEntry}
          onClose={() => { setShowForm(false); setEditingEntry(null); }}
        />
      )}
    </div>
  );
}