import { useState, useMemo, useEffect, useRef } from "react";
import { Plus, Film, Tv, Search, X as XIcon } from "lucide-react";
import { Header } from "../components/Header/Header";
import { Card }   from "../components/Card/Card";
import { TitleFormModal } from "../components/Modal/TitleFormModal";
import { Confetti } from "../components/common/Confetti";
import { Footer }  from "../components/common/Footer";
import { useLibrary } from "../context/LibraryContext";
import { useSync }    from "../hooks/useSync";

export function Home() {
  const { entries, loading, saveError, showConfetti } = useLibrary();
  const { syncAll, syncing, progress } = useSync();

  const [typeFilter,       setTypeFilter]       = useState("all");
  const [selectedStatuses, setSelectedStatuses] = useState([]);
  const [selectedFormats,  setSelectedFormats]  = useState([]);
  const [searchQuery,      setSearchQuery]      = useState("");
  const [showForm,         setShowForm]         = useState(false);
  const [editingEntry,     setEditingEntry]     = useState(null);

  useEffect(() => {
    if (!loading && entries.length > 0) {
      const t = setTimeout(() => syncAll(), 1500);
      return () => clearTimeout(t);
    }
  }, [loading]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleTypeFilterChange(type) {
    setTypeFilter(type);
    if (type !== "anime") setSelectedFormats([]);
  }

  function toggleStatus(status) {
    setSelectedStatuses((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );
  }

  function toggleFormat(format) {
    setSelectedFormats((prev) =>
      prev.includes(format) ? prev.filter((f) => f !== format) : [...prev, format]
    );
  }

  // ── Filtrage type ────────────────────────────────────────────────────────
  const byType = useMemo(
    () => typeFilter === "all" ? entries : entries.filter((e) => e.type === typeFilter),
    [entries, typeFilter]
  );

  // ── Filtrage complet (statut + format + recherche) ───────────────────────
  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return byType.filter((e) => {
      const statusOk =
        selectedStatuses.length === 0 || selectedStatuses.includes(e.status);
      const formatOk =
        selectedFormats.length === 0 ||
        e.type !== "anime" ||
        selectedFormats.includes(e.category ?? "tv");
      const searchOk =
        !q ||
        e.title.toLowerCase().includes(q) ||
        (e.genres || []).some((g) => g.toLowerCase().includes(q)) ||
        (e.notes  || "").toLowerCase().includes(q);
      return statusOk && formatOk && searchOk;
    });
  }, [byType, selectedStatuses, selectedFormats, searchQuery]);

  const filteredAnime = useMemo(() => filtered.filter((e) => e.type === "anime"), [filtered]);
  const filteredSerie = useMemo(() => filtered.filter((e) => e.type === "serie"),  [filtered]);

  function openNewForm()       { setEditingEntry(null);  setShowForm(true); }
  function openEditForm(entry) { setEditingEntry(entry); setShowForm(true); }

  const isSearchActive = searchQuery.trim().length > 0;
  const gridKey = `${typeFilter}-${selectedStatuses.join(",")}-${selectedFormats.join(",")}-${searchQuery}`;

  return (
    <div className="min-h-screen bg-violet-950 text-violet-50 flex flex-col" style={{ fontFamily: "'Inter', sans-serif" }}>
      <Confetti active={showConfetti} />

      <div className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-8">
        <Header
          typeFilter={typeFilter}
          selectedStatuses={selectedStatuses}
          selectedFormats={selectedFormats}
          searchQuery={searchQuery}
          onTypeFilterChange={handleTypeFilterChange}
          onToggleStatus={toggleStatus}
          onToggleFormat={toggleFormat}
          onClearFilters={() => { setSelectedStatuses([]); setSelectedFormats([]); }}
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
                <p className="text-violet-500 text-sm">Essaie un autre titre, genre ou mot-clé.</p>
                <button
                  onClick={() => setSearchQuery("")}
                  className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-amber-300 hover:text-amber-200 active:scale-95 transition-transform motion-reduce:transition-none"
                >
                  <XIcon size={14} /> Effacer la recherche
                </button>
              </>
            ) : (
              <>
                <p className="text-violet-300 mb-4">
                  {entries.length === 0
                    ? "C'est bien vide ici — Commence ton journal et ajoute donc une série !"
                    : "Hello Darkness My Old Friend..."}
                </p>
                {entries.length === 0 && (
                  <button
                    onClick={openNewForm}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-300 hover:text-amber-200 active:scale-95 transition-transform motion-reduce:transition-none"
                  >
                    <Plus size={15} /> Ajouter un titre
                  </button>
                )}
              </>
            )}
          </div>

        ) : (
          <>
            {/* Compteur de résultats quand la recherche est active */}
            {isSearchActive && (
              <p className="text-xs font-mono text-violet-400 mb-3 animate-fadeIn">
                <span className="text-violet-200 font-semibold">{filtered.length}</span>
                {" "}résultat{filtered.length > 1 ? "s" : ""} pour{" "}
                <span className="text-amber-300">« {searchQuery} »</span>
              </p>
            )}

            {typeFilter === "all" ? (
              <div key={gridKey} className="space-y-8 animate-fadeIn motion-reduce:animate-none">
                {filteredAnime.length > 0 && (
                  <section>
                    <div className="flex items-center gap-2 mb-3">
                      <Film size={15} className="text-violet-400" />
                      <h2 className="font-mono text-xs uppercase tracking-widest text-violet-400">Animes</h2>
                      <span className="font-mono text-xs text-violet-600">({filteredAnime.length})</span>
                    </div>
                    <div className="grid grid-cols-1 gap-4">
                      {filteredAnime.map((entry, i) => (
                        <Card key={entry.id} entry={entry} onEdit={openEditForm} index={i} searchQuery={searchQuery} />
                      ))}
                    </div>
                  </section>
                )}
                {filteredSerie.length > 0 && (
                  <section>
                    <div className="flex items-center gap-2 mb-3">
                      <Tv size={15} className="text-violet-400" />
                      <h2 className="font-mono text-xs uppercase tracking-widest text-violet-400">Séries</h2>
                      <span className="font-mono text-xs text-violet-600">({filteredSerie.length})</span>
                    </div>
                    <div className="grid grid-cols-1 gap-4">
                      {filteredSerie.map((entry, i) => (
                        <Card key={entry.id} entry={entry} onEdit={openEditForm} index={i} searchQuery={searchQuery} />
                      ))}
                    </div>
                  </section>
                )}
              </div>
            ) : (
              <div key={gridKey} className="grid grid-cols-1 gap-4 animate-fadeIn motion-reduce:animate-none">
                {filtered.map((entry, i) => (
                  <Card key={entry.id} entry={entry} onEdit={openEditForm} index={i} searchQuery={searchQuery} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <Footer />

      {showForm && (
        <TitleFormModal editingEntry={editingEntry} onClose={() => setShowForm(false)} />
      )}
    </div>
  );
}
