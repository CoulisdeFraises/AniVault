import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Loader2, Film, WifiOff } from "lucide-react";
import { useLibrary } from "../context/LibraryContext";
import { BurgerMenu } from "../components/common/BurgerMenu";
import { TitleFormModal } from "../components/Modal/TitleFormModal";
import { SynopsisModal }  from "../components/common/SynopsisModal";
import { fetchAniListRecommendations } from "../api/recommendations";
import { importResult } from "../api";
import { getCached, getStaleCached, setCached, TTL } from "../lib/cache";

function normalizeSeriesTitle(title) {
  return (title || "")
    .replace(/\s*:?\s*(season|saison|part|cour)\s*\d+/gi, "")
    .replace(/\s+\d+(st|nd|rd|th)\s+season/gi, "")
    .replace(/\s+s\d+$/i, "")
    .replace(/\s+\d+$/, "")
    .trim()
    .toLowerCase();
}

function RecCard({ rec, onClick }) {
  return (
    <div
      onClick={onClick}
      className="relative rounded-xl overflow-hidden bg-violet-950 group cursor-pointer active:scale-[0.97] transition-transform"
    >
      <div className="aspect-[2/3] w-full overflow-hidden">
        {rec.image ? (
          <img src={rec.image} alt={rec.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 motion-reduce:transition-none" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-violet-900/50">
            <Film size={24} className="text-violet-600" />
          </div>
        )}
      </div>
      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent p-2 pt-8">
        <p className="font-mono text-[10px] text-white leading-tight line-clamp-2 mb-0.5" title={rec.title}>{rec.title}</p>
        <div className="flex items-center gap-1.5">
          {rec.score > 0 && <span className="font-mono text-[9px] text-amber-400">★ {(rec.score / 10).toFixed(1)}</span>}
          {rec.year && <span className="font-mono text-[9px] text-violet-500">{rec.year}</span>}
        </div>
      </div>
    </div>
  );
}

export function Recommendations() {
  const navigate = useNavigate();
  const { entries } = useLibrary();

  const [recs,          setRecs]          = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState("");
  const [isStale,       setIsStale]       = useState(false); // données hors-ligne
  const [adding,        setAdding]        = useState(null);
  const [editingEntry,  setEditingEntry]  = useState(null);
  const [synopsisRec,   setSynopsisRec]   = useState(null);

  const topGenres = useMemo(() => {
    const tally = {};
    entries.filter((e) => e.status === "termine" || e.status === "en-cours")
      .forEach((e) => e.genres.forEach((g) => { tally[g] = (tally[g] || 0) + 1; }));
    return Object.entries(tally).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([g]) => g);
  }, [entries]);

  const libraryIds = useMemo(() => new Set(entries.flatMap((e) => e.anilistIds || [])), [entries]);

  const cacheKey = useMemo(
    () => `recs_${[...topGenres].sort().join("_")}`,
    [topGenres]
  );

  useEffect(() => {
    if (!topGenres.length) { setLoading(false); return; }

    // 1. Cache valide → affichage immédiat
    const cached = getCached(cacheKey);
    if (cached) {
      setRecs(cached);
      setIsStale(false);
      setLoading(false);
      return;
    }

    // 2. Fetch réseau
    setLoading(true);
    setError("");
    setIsStale(false);

    fetchAniListRecommendations(topGenres, [...libraryIds])
      .then((data) => {
        setCached(cacheKey, data, TTL.RECOMMENDATIONS);
        setRecs(data);
        setLoading(false);
      })
      .catch(() => {
        // 3. Fallback cache périmé (hors-ligne)
        const stale = getStaleCached(cacheKey);
        if (stale) {
          setRecs(stale);
          setIsStale(true);
          setLoading(false);
        } else {
          setError("Impossible de charger les recommandations. Vérifie ta connexion.");
          setLoading(false);
        }
      });
  }, [cacheKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const dedupedRecs = useMemo(() => {
    const seen = new Set();
    return recs.filter((rec) => {
      const key = normalizeSeriesTitle(rec.title);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 20);
  }, [recs]);

  async function handleAdd(rec) {
    setAdding(rec.id);
    try {
      const prefilled = await importResult(rec);
      setSynopsisRec(null);
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

        <div className="flex items-start justify-between mb-6">
          <div>
            <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-violet-400 hover:text-violet-200 transition-colors mb-2">
              <ChevronLeft size={16} /> Retour
            </button>
            <p className="font-mono text-[11px] tracking-[0.3em] text-violet-400 uppercase mb-1">Basé sur tes goûts</p>
            <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Recommandations</h1>
          </div>
          <BurgerMenu />
        </div>

        {topGenres.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-5">
            <span className="text-[11px] text-violet-400 font-mono uppercase tracking-wide self-center">Basé sur :</span>
            {topGenres.map((g) => (
              <span key={g} className="px-2.5 py-1 rounded-full bg-amber-400/15 border border-amber-400/30 text-amber-300 text-[11px] font-mono">{g}</span>
            ))}
          </div>
        )}

        {/* Bandeau hors-ligne */}
        {isStale && (
          <div className="flex items-center gap-2 mb-4 px-4 py-2.5 rounded-xl bg-amber-400/10 border border-amber-400/20 text-amber-300 text-sm animate-fadeIn">
            <WifiOff size={14} className="flex-shrink-0" />
            <span>Mode hors-ligne — données mises en cache affichées.</span>
          </div>
        )}

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
        ) : dedupedRecs.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-violet-400">Aucune recommandation trouvée pour ces genres.</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 sm:gap-3">
            {dedupedRecs.map((rec) => (
              <RecCard key={rec.id} rec={rec} onClick={() => setSynopsisRec(rec)} />
            ))}
          </div>
        )}
      </div>

      {synopsisRec && (
        <SynopsisModal
          rec={synopsisRec}
          onClose={() => setSynopsisRec(null)}
          onAdd={handleAdd}
          adding={adding === synopsisRec.id}
          alreadyInLib={libraryIds.has(synopsisRec.id)}
        />
      )}

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