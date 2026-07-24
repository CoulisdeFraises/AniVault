import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Loader2, Plus, Film } from "lucide-react";
import { useLibrary } from "../context/LibraryContext";
import { BurgerMenu } from "../components/common/BurgerMenu";
import { TitleFormModal } from "../components/Modal/TitleFormModal";
import { fetchAniListRecommendations } from "../api/recommendations";
import { importResult } from "../api";

// Normalisation du titre pour déduplication des saisons
function normalizeSeriesTitle(title) {
  return (title || "")
    .replace(/\s*:?\s*(season|saison|part|cour)\s*\d+/gi, "")
    .replace(/\s+\d+(st|nd|rd|th)\s+season/gi, "")
    .replace(/\s+s\d+$/i, "")
    .replace(/\s+\d+$/, "")
    .trim()
    .toLowerCase();
}

// ── Carte recommandation ──────────────────────────────────────────────────────
function RecCard({ rec, onAdd, adding }) {
  return (
    <div className="relative rounded-xl overflow-hidden bg-violet-950 group cursor-pointer">
      {/* Image */}
      <div className="aspect-[2/3] w-full overflow-hidden">
        {rec.image ? (
          <img
            src={rec.image}
            alt={rec.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 motion-reduce:transition-none"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-violet-900/50">
            <Film size={24} className="text-violet-600" />
          </div>
        )}
      </div>

      {/* Overlay fade bas */}
      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent p-2 pt-8">
        {/* Titre */}
        <p
          className="font-mono text-[10px] text-white leading-tight line-clamp-2 mb-1"
          title={rec.title}
        >
          {rec.title}
        </p>

        {/* Score + année */}
        <div className="flex items-center gap-1.5 mb-1.5">
          {rec.score > 0 && (
            <span className="font-mono text-[9px] text-amber-400">
              ★ {(rec.score / 10).toFixed(1)}
            </span>
          )}
          {rec.year && (
            <span className="font-mono text-[9px] text-violet-500">{rec.year}</span>
          )}
        </div>

        {/* Bouton ajouter */}
        <button
          onClick={() => onAdd(rec)}
          disabled={adding}
          className="w-full flex items-center justify-center gap-1 py-1 rounded-md bg-amber-400/25 border border-amber-400/30 text-amber-300 font-mono text-[9px] hover:bg-amber-400/40 active:scale-95 transition-all disabled:opacity-50"
        >
          {adding ? (
            <Loader2 size={10} className="animate-spin" />
          ) : (
            <><Plus size={10} /> Ajouter</>
          )}
        </button>
      </div>
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export function Recommendations() {
  const navigate = useNavigate();
  const { entries } = useLibrary();

  const [recs,         setRecs]         = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState("");
  const [adding,       setAdding]       = useState(null);
  const [editingEntry, setEditingEntry] = useState(null);

  // Genres préférés extraits des titres terminés / en cours
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

  // Fetch des recommandations (plus de résultats pour compenser la déduplication)
  useEffect(() => {
    if (!topGenres.length) { setLoading(false); return; }
    setLoading(true);
    fetchAniListRecommendations(topGenres, [...libraryIds])
      .then((data) => { setRecs(data); setLoading(false); })
      .catch(() => { setError("Impossible de charger les recommandations."); setLoading(false); });
  }, [topGenres.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  // Déduplication : une seule occurrence par série (on garde la première = S1 / série parente)
  const dedupedRecs = useMemo(() => {
    const seen = new Set();
    return recs.filter((rec) => {
      const key = normalizeSeriesTitle(rec.title);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [recs]);

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
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-1.5 text-sm text-violet-400 hover:text-violet-200 transition-colors mb-2"
            >
              <ChevronLeft size={16} /> Retour
            </button>
            <p className="font-mono text-[11px] tracking-[0.3em] text-violet-400 uppercase mb-1">
              Basé sur tes goûts
            </p>
            <h1
              className="text-3xl font-bold tracking-tight"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              Recommandations
            </h1>
          </div>
          <BurgerMenu />
        </div>

        {/* ── Genres de référence ── */}
        {topGenres.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            <span className="text-[11px] text-violet-400 font-mono uppercase tracking-wide self-center">
              Basé sur :
            </span>
            {topGenres.map((g) => (
              <span
                key={g}
                className="px-2.5 py-1 rounded-full bg-amber-400/15 border border-amber-400/30 text-amber-300 text-[11px] font-mono"
              >
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
          <div className="text-sm text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3">
            {error}
          </div>
        ) : topGenres.length === 0 ? (
          <div className="text-center py-20 rounded-2xl border border-dashed border-white/10">
            <Film size={32} className="text-violet-500 mx-auto mb-3" />
            <p className="text-violet-300 mb-1">Pas encore assez de données</p>
            <p className="text-sm text-violet-500">
              Ajoute et termine des titres pour recevoir des recommandations personnalisées.
            </p>
          </div>
        ) : dedupedRecs.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-violet-400">Aucune recommandation trouvée pour ces genres.</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 sm:gap-3">
            {dedupedRecs.map((rec) => (
              <RecCard
                key={rec.id}
                rec={rec}
                onAdd={handleAdd}
                adding={adding === rec.id}
              />
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