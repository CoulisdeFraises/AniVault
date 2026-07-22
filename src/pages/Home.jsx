import { useState, useMemo, useEffect } from "react";
import { Plus, Film, Tv } from "lucide-react";
import { Header } from "../components/Header/Header";
import { Card } from "../components/Card/Card";
import { TitleFormModal } from "../components/Modal/TitleFormModal";
import { Confetti } from "../components/common/Confetti";
import { useLibrary } from "../context/LibraryContext";
import { useSync } from "../hooks/useSync";

export function Home() {
  const { entries, loading, saveError, showConfetti } = useLibrary();
  const { syncAll, syncing, progress } = useSync();

  const [filter,       setFilter]       = useState("all");
  const [typeFilter,   setTypeFilter]   = useState("all");
  const [showForm,     setShowForm]     = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);

  // ── Sync automatique au premier chargement des entrées ──
  useEffect(() => {
    if (!loading && entries.length > 0) {
      // Léger délai pour ne pas bloquer le rendu initial
      const t = setTimeout(() => syncAll(), 1500);
      return () => clearTimeout(t);
    }
  }, [loading]); // eslint-disable-line react-hooks/exhaustive-deps

  const byType = useMemo(
    () => (typeFilter === "all" ? entries : entries.filter((e) => e.type === typeFilter)),
    [entries, typeFilter]
  );
  const filtered = useMemo(
    () => (filter === "all" ? byType : byType.filter((e) => e.status === filter)),
    [byType, filter]
  );
  const filteredAnime = useMemo(() => filtered.filter((e) => e.type === "anime"), [filtered]);
  const filteredSerie = useMemo(() => filtered.filter((e) => e.type === "serie"), [filtered]);

  function openNewForm() {
    setEditingEntry(null);
    setShowForm(true);
  }
  function openEditForm(entry) {
    setEditingEntry(entry);
    setShowForm(true);
  }

  return (
    <div className="min-h-screen bg-violet-950 text-violet-50" style={{ fontFamily: "'Inter', sans-serif" }}>
      <Confetti active={showConfetti} />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <Header
          filter={filter}
          typeFilter={typeFilter}
          onFilterChange={setFilter}
          onTypeFilterChange={setTypeFilter}
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
          <div className="text-center py-20 rounded-2xl border border-dashed border-white/10">
            <p className="text-violet-300 mb-4">
              {entries.length === 0
                ? "C'est bien vide ici — Commence ton journal et ajoute donc une série !"
                : "Hello Darkness My Old Friend..."}
            </p>
            {entries.length === 0 && (
              <button onClick={openNewForm} className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-300 hover:text-amber-200">
                <Plus size={15} /> Ajouter un titre
              </button>
            )}
          </div>
        ) : typeFilter === "all" ? (
          <div className="space-y-8">
            {filteredAnime.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <Film size={15} className="text-violet-400" />
                  <h2 className="font-mono text-xs uppercase tracking-widest text-violet-400">Animes</h2>
                  <span className="font-mono text-xs text-violet-600">({filteredAnime.length})</span>
                </div>
                <div className="grid grid-cols-1 gap-4">
                  {filteredAnime.map((entry) => (
                    <Card key={entry.id} entry={entry} onEdit={openEditForm} />
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
                  {filteredSerie.map((entry) => (
                    <Card key={entry.id} entry={entry} onEdit={openEditForm} />
                  ))}
                </div>
              </section>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filtered.map((entry) => (
              <Card key={entry.id} entry={entry} onEdit={openEditForm} />
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <TitleFormModal editingEntry={editingEntry} onClose={() => setShowForm(false)} />
      )}
    </div>
  );
}