import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Loader2, Star, Plus, Film } from "lucide-react";
import { useLibrary } from "../context/LibraryContext";
import { BurgerMenu } from "../components/common/BurgerMenu";
import { TitleFormModal } from "../components/Modal/TitleFormModal";
import { fetchAniListRecommendations } from "../api/recommendations";
import { importResult } from "../api";

export function Recommendations() {
  const navigate = useNavigate();
  const { entries } = useLibrary();

  const [recs,        setRecs]        = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState("");
  const [adding,      setAdding]      = useState(null); // entry en cours d'import
  const [editingEntry, setEditingEntry] = useState(null);

  // Genres préférés extraits des titres terminés
  const topGenres = useMemo(() => {
    const tally = {};
    entries
      .filter((e) => e.status === "termine" || e.status === "en-cours")
      .forEach((e) => e.genres.forEach((g) => { tally[g] = (tally[g] || 0) + 1; }));
    return Object.entries(tally)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([g]) => g);
  }, [entries]);

  // IDs AniList déjà dans la bibliothèque
  const libraryIds = useMemo(
    () => new Set(entries.flatMap((e) => e.anilistIds || [])),
    [entries]
  );

  useEffect(() => {
    if (!topGenres.length) { setLoading(false); return; }
    setLoading(true);
    fetchAniListRecommendations(topGenres, [...libraryIds])
      .then((data) => { setRecs(data); setLoading(false); })
      .catch(() => { setError("Impossible de charger les recommandations."); setLoading(false); });
  }, [topGenres.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleAdd(rec) {
    setAdding(rec.id);
    try {
      const prefilled = await importResult(rec);
      setEditingEntry({ ...prefilled, _isNew: true });
    } catch {
      setError("Erreur lors de l'import du titre.");
    } finally {
      setAdding(null);
    }
  }

  return (
    <div className="min-h-screen bg-violet-950 text-violet-50" style={{ fontFamily: "'Inter', sans-serif" }}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">

        {/* ── En-tête ── */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-violet-400 hover:text-violet-200 transition-colors mb-2">
              <ChevronLeft size={16} /> Retour
            </button>
            <p className="font-mono text-[11px] tracking-[0.3em] text-violet-400 uppercase mb-1">Basé sur tes goûts</p>
            <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Recommandations
            </h1>
          </div>
          <BurgerMenu />
        </div>

        {/* ── Genres de référence ── */}
        {topGenres.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            <span className="text-[11px] text-violet-400 font-mono uppercase tracking-wide self-center">Basé sur :</span>
            {topGenres.map((g) => (
              <span key={g} className="px-2.5 py-1 rounded-full bg-amber-400/15 border border-amber-400/30 text-amber-300 text-[11px] font-mono">
                {g}
              </span>
            ))}
          </div>
        )}

        {/* ── Contenu ── */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-3">
            <Loader2 size={28} className="animate-spin text-violet-400" />
            <p className="text-sm text-violet-400 font-mono">Recherche de recommandations…</p>
          </div>
        ) : error ? (
          <div className="text-sm text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3">{error}</div>
        ) : topGenres.length === 0 ? (
          <div className="text-center py-20 rounded-2xl border border-dashed border-white/10">
            <Film size={32} className="text-violet-500 mx-auto mb-3" />
            <p className="text-violet-300 mb-1">Pas encore assez de données</p>
            <p className="text-sm text-violet-500">Ajoute et termine des titres pour recevoir des recommandations personnalisées.</p>
          </div>
        ) : recs.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-violet-400">Aucune recommandation trouvée pour ces genres.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {recs.map((rec) => (
              <div key={rec.id} className="rounded-2xl bg-violet-900/30 border border-white/5 overflow-hidden flex flex-col hover:bg-violet-800/40 transition-colors">
                {/* Cover */}
                <div className="aspect-[2/3] bg-violet-950 overflow-hidden">
                  {rec.image ? (
                    <img src={rec.image} alt={rec.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Film size={32} className="text-violet-600" />
                    </div>
                  )}
                </div>

                {/* Infos */}
                <div className="p-3 flex flex-col gap-2 flex-1">
                  <div>
                    <h3 className="text-sm font-semibold text-violet-50 leading-tight line-clamp-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                      {rec.title}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      {rec.year && <span className="text-[10px] text-violet-400 font-mono">{rec.year}</span>}
                      {rec.score && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-400 font-mono">
                          <Star size={9} fill="#fbbf24" strokeWidth={0} /> {(rec.score / 10).toFixed(1)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Genres */}
                  <div className="flex flex-wrap gap-1 overflow-hidden max-h-5">
                    {rec.genres.slice(0, 2).map((g) => (
                      <span key={g} className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/5 text-violet-400">{g}</span>
                    ))}
                  </div>

                  {/* Bouton ajouter */}
                  <button
                    onClick={() => handleAdd(rec)}
                    disabled={adding === rec.id}
                    className="mt-auto flex items-center justify-center gap-1.5 w-full py-1.5 rounded-lg bg-amber-400/15 border border-amber-400/30 text-amber-300 text-xs font-medium hover:bg-amber-400/25 active:scale-95 transition-all disabled:opacity-50"
                  >
                    {adding === rec.id
                      ? <Loader2 size={12} className="animate-spin" />
                      : <><Plus size={12} /> Ajouter</>
                    }
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal d'ajout prérempli */}
      {editingEntry && (
        <TitleFormModal
          editingEntry={editingEntry._isNew ? null : editingEntry}
          prefillData={editingEntry._isNew ? editingEntry : null}
          onClose={() => setEditingEntry(null)}
        />
      )}
    </div>
  );
}