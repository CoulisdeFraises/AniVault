import { useState, useMemo, useEffect } from "react";
import { Plus, Film, Tv } from "lucide-react";
import { Header } from "../components/Header/Header";
import { Card } from "../components/Card/Card";
import { TitleFormModal } from "../components/Modal/TitleFormModal";
import { Confetti } from "../components/common/Confetti";
import { Footer } from "../components/common/Footer";
import { useLibrary } from "../context/LibraryContext";
import { useSync } from "../hooks/useSync";

export function Home() {
  const { entries, loading, saveError, showConfetti } = useLibrary();
  const { syncAll, syncing, progress } = useSync();

  const [typeFilter,        setTypeFilter]        = useState("all");
  const [selectedStatuses,  setSelectedStatuses]  = useState([]); // [] = tous
  const [selectedFormats,   setSelectedFormats]   = useState([]); // [] = tous
  const [showForm,          setShowForm]          = useState(false);
  const [editingEntry,      setEditingEntry]      = useState(null);

  useEffect(() => {
    if (!loading && entries.length > 0) {
      const t = setTimeout(() => syncAll(), 1500);
      return () => clearTimeout(t);
    }
  }, [loading]); // eslint-disable-line react-hooks/exhaustive-deps

  // Réinitialise les formats quand on quitte la vue anime
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

  const byType = useMemo(
    () => typeFilter === "all" ? entries : entries.filter((e) => e.type === typeFilter),
    [entries, typeFilter]
  );

  const filtered = useMemo(() => {
    return byType.filter((e) => {
      // Filtre statut : si aucun sélectionné → tout passe
      const statusOk =
        selectedStatuses.length === 0 || selectedStatuses.includes(e.status);
      // Filtre format : uniquement sur les animes, si aucun sélectionné → tout passe
      const formatOk =
        selectedFormats.length === 0 ||
        e.type !== "anime" ||
        selectedFormats.includes(e.category ?? "tv");
      return statusOk && formatOk;
    });
  }, [byType, selectedStatuses, selectedFormats]);

  const filteredAnime = useMemo(() => filtered.filter((e) => e.type === "anime"), [filtered]);
  const filteredSerie = useMemo(() => filtered.filter((e) => e.type === "serie"), [filtered]);

  function openNewForm()       { setEditingEntry(null);  setShowForm(true); }
  function openEditForm(entry) { setEditingEntry(entry); setShowForm(true); }

  const gridKey = `${typeFilter}-${selectedStatuses.join(",")}-${selectedFormats.join(",")}`;

  return (
    <div className="min-h-screen bg-violet-950 text-violet-50 flex flex-col" style={{ fontFamily: "'Inter', sans-serif" }}>
      <Confetti active={showConfetti} />

      <div className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-8">
        <Header
          typeFilter={typeFilter}
          selectedStatuses={selectedStatuses}
          selectedFormats={selectedFormats}
          onTypeFilterChange={handleTypeFilterChange}
          onToggleStatus={toggleStatus}
          onToggleFormat={toggleFormat}
          onClearFilters={() => { setSelectedStatuses([]); setSelectedFormats([]); }}
          onAddClick={openNewForm}
          syncing={syncing}
          syncProgress={progress}
          onSyncClick={() => syncAll(true)}
        />

        {saveError && (
          <div className="mb-4 text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">
            La sauvegarde a échoué. Tes changements restent visibles mais pourraient ne pas persister.
          </div>
        )}

        {loading ? (
          <p className="text-violet-400 text-sm font-mono">Chargement…</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 rounded-2xl border border-dashed border-white/10 animate-fadeIn">
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
          </div>
        ) : typeFilter === "all" ? (
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
                    <Card key={entry.id} entry={entry} onEdit={openEditForm} index={i} />
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
                    <Card key={entry.id} entry={entry} onEdit={openEditForm} index={i} />
                  ))}
                </div>
              </section>
            )}
          </div>
        ) : (
          <div key={gridKey} className="grid grid-cols-1 gap-4 animate-fadeIn motion-reduce:animate-none">
            {filtered.map((entry, i) => (
              <Card key={entry.id} entry={entry} onEdit={openEditForm} index={i} />
            ))}
          </div>
        )}
      </div>

      <Footer />

      {showForm && (
        <TitleFormModal editingEntry={editingEntry} onClose={() => setShowForm(false)} />
      )}
    </div>
  );
}