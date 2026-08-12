// src/pages/NextSeason.jsx
import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Loader2, Plus, Check, RefreshCw, Sparkles } from "lucide-react";
import { fetchSeasonalAnime, getNextSeason, seasonLabelFR } from "../api/anilist";
import { importResult } from "../api";
import { useLibrary } from "../context/LibraryContext";
import { TopBar } from "../components/common/TopBar";
import { LazyImage } from "../components/common/LazyImage";
import { PullToRefresh } from "../components/common/PullToRefresh";
import { getCached, getStaleCached, setCached, TTL } from "../lib/cache";

const FORMAT_LABELS = { TV: "TV", TV_SHORT: "TV court", MOVIE: "Film", OVA: "OVA", ONA: "ONA", SPECIAL: "Spécial" };

function TitleCard({ anime, isInLibrary, isAdding, onAdd }) {
  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden flex flex-col">
      <div className="relative aspect-[2/3]">
        <LazyImage src={anime.image} alt={anime.title} className="w-full h-full" />
        {anime.format && (
          <span className="absolute top-1.5 left-1.5 font-mono text-[9px] uppercase tracking-wide bg-black/60 backdrop-blur text-violet-200 px-1.5 py-0.5 rounded-full">
            {FORMAT_LABELS[anime.format] || anime.format}
          </span>
        )}
      </div>
      <div className="p-2.5 flex flex-col flex-1 gap-2">
        <p className="text-xs font-medium text-violet-100 leading-snug line-clamp-2 flex-1">{anime.title}</p>
        {isInLibrary ? (
          <div className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-teal-500/15 text-teal-400">
            <Check size={12} strokeWidth={2.5} />
            <span className="font-mono text-[9px] uppercase tracking-wide">Ma liste</span>
          </div>
        ) : (
          <button
            onClick={onAdd}
            disabled={isAdding}
            aria-label={`Ajouter ${anime.title} à ma liste`}
            className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-amber-400/15 border border-amber-400/25 text-amber-400 hover:bg-amber-400/25 active:scale-95 transition-all motion-reduce:transition-none disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isAdding ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} strokeWidth={2.5} />}
            <span className="font-mono text-[9px] uppercase tracking-wide">{isAdding ? "Ajout…" : "Ajouter"}</span>
          </button>
        )}
      </div>
    </div>
  );
}

export function NextSeason() {
  const navigate = useNavigate();
  const { entries: libraryEntries, saveEntry } = useLibrary();
  const { season, year } = useMemo(() => getNextSeason(), []);
  const cacheKey = `season_preview_${season}_${year}`;

  const [items,      setItems]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState("");
  const [addingIds,  setAddingIds]  = useState(new Set());

  const libraryAnilistIds = useMemo(
    () => new Set(libraryEntries.flatMap((e) => e.anilistIds || []).map(String)),
    [libraryEntries]
  );

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) {
      const cached = getCached(cacheKey);
      if (cached) { setItems(cached); setLoading(false); return; }
    }
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError("");
    try {
      const data = await fetchSeasonalAnime(season, year, { perPage: 40 });
      setCached(cacheKey, data, TTL.SEASON_PREVIEW);
      setItems(data);
    } catch (err) {
      const stale = getStaleCached(cacheKey);
      if (stale) {
        setItems(stale);
        setError(err?.message ? `⚠️ ${err.message} — données précédentes affichées.` : "⚠️ Connexion indisponible — données hors-ligne affichées.");
      } else {
        setError(err?.message || "Impossible de charger la saison. Vérifie ta connexion et réessaie.");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, season, year]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = useCallback(async (anime) => {
    if (addingIds.has(anime.id)) return;
    setAddingIds((prev) => new Set([...prev, anime.id]));
    try {
      const searchResult = {
        id: anime.id, source: "anilist", title: anime.title,
        genres: anime.genres, image: anime.image,
        episodes: anime.episodes, format: anime.format,
      };
      const imported = await importResult(searchResult);
      saveEntry({ ...imported, type: "anime", status: "a-voir", rating: 0 }, null);
    } catch (err) {
      console.error("Erreur lors de l'ajout à la bibliothèque :", err);
    } finally {
      setAddingIds((prev) => { const next = new Set(prev); next.delete(anime.id); return next; });
    }
  }, [addingIds, saveEntry]);

  return (
    <div className="min-h-screen bg-violet-950 text-violet-50" style={{ fontFamily: "'Inter', sans-serif" }}>
      <PullToRefresh onRefresh={() => load(true)}>
        <div className="max-w-5xl mx-auto px-3 sm:px-6 pb-nav pt-safe-8">

          {/* ── En-tête ── */}
          <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
            <div className="min-w-0">
              <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-violet-400 hover:text-violet-200 active:scale-95 transition-all motion-reduce:transition-none mb-2">
                <ChevronLeft size={16} /> Retour
              </button>
              <p className="font-mono text-[11px] tracking-[0.3em] text-violet-400 uppercase mb-0.5">À venir</p>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                Saison prochaine
              </h1>
            </div>
            <TopBar />
          </div>

          {/* ── Bascule Saison en cours / Saison prochaine ── */}
          <div className="flex justify-center mb-4">
            <div className="inline-flex w-full max-w-md items-center gap-1 rounded-full bg-white/5 border border-white/10 p-1">
              <button
                onClick={() => navigate("/calendar")}
                className="flex-1 min-w-0 px-3 py-2 rounded-full text-xs font-medium text-violet-300 hover:bg-white/10 active:scale-95 transition-all motion-reduce:transition-none whitespace-nowrap"
              >
                Saison en cours
              </button>
              <button
                aria-current="page"
                className="flex-1 min-w-0 flex items-center justify-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium bg-amber-400 text-violet-950 whitespace-nowrap"
              >
                <Sparkles size={13} />
                Saison prochaine
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between mb-5">
            <p className="text-sm text-violet-300">{seasonLabelFR(season, year)}</p>
            <button
              onClick={() => load(true)}
              disabled={refreshing}
              title="Actualiser"
              aria-label="Actualiser"
              className="p-2 rounded-xl bg-violet-900/40 border border-white/10 hover:bg-violet-800/50 disabled:opacity-50 active:scale-95 transition-all motion-reduce:transition-none"
            >
              <RefreshCw size={14} className={`text-violet-300 ${refreshing ? "animate-spin motion-reduce:animate-none" : ""}`} />
            </button>
          </div>

          {error && (
            <div className="mb-5 text-sm text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3">{error}</div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-32 gap-3">
              <Loader2 size={28} className="animate-spin text-violet-400" />
              <p className="text-sm text-violet-400 font-mono">Chargement de la saison…</p>
            </div>
          ) : items.length === 0 ? (
            <p className="text-sm text-violet-500 font-mono text-center py-16">Aucune annonce pour l'instant.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
              {items.map((anime) => (
                <TitleCard
                  key={anime.id}
                  anime={anime}
                  isInLibrary={libraryAnilistIds.has(String(anime.id))}
                  isAdding={addingIds.has(anime.id)}
                  onAdd={() => handleAdd(anime)}
                />
              ))}
            </div>
          )}

        </div>
      </PullToRefresh>
    </div>
  );
}
