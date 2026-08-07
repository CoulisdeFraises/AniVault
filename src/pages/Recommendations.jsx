import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronLeft, Loader2, Film, Tv, Clapperboard, WifiOff,
} from "lucide-react";
import { useLibrary }          from "../context/LibraryContext";
import { TopBar }          from "../components/common/TopBar";
import { TitleFormModal }      from "../components/Modal/TitleFormModal";
import { SynopsisModal }       from "../components/common/SynopsisModal";
import { PullToRefresh }       from "../components/common/PullToRefresh";
import {
  fetchAniListRecommendations,
  fetchTMDBMovieRecommendations,
  fetchTMDBSeriesRecommendations,
} from "../api/recommendations";
import { hasTMDB }             from "../api/tmdb";
import { importResult }        from "../api";
import { getCached, getStaleCached, setCached, removeCached, TTL } from "../lib/cache";
import { toEnglishGenres }     from "../utils/genres";
import { haptics } from "../utils/haptics";
import { normalizeSeriesTitle } from "../utils/titles";

// ── Carte de recommandation ───────────────────────────────────────────────────
function RecCard({ rec, onClick }) {
  return (
    <div
      onClick={onClick}
      className="relative rounded-xl overflow-hidden bg-violet-950 group cursor-pointer active:scale-[0.97] transition-transform"
    >
      <div className="aspect-[2/3] w-full overflow-hidden">
        {rec.image ? (
          <img
            src={rec.image} alt={rec.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 motion-reduce:transition-none"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-violet-900/50">
            <Film size={24} className="text-violet-600" />
          </div>
        )}
      </div>
      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent p-2 pt-8">
        <p className="font-mono text-[10px] text-white leading-tight line-clamp-2 mb-0.5" title={rec.title}>
          {rec.title}
        </p>
        <div className="flex items-center gap-1.5">
          {rec.score > 0 && (
            <span className="font-mono text-[9px] text-amber-400">★ {(rec.score / 10).toFixed(1)}</span>
          )}
          {rec.year && (
            <span className="font-mono text-[9px] text-violet-500">{rec.year}</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Onglets ───────────────────────────────────────────────────────────────────
const TABS = [
  { key: "anime", label: "Animes", Icon: Film        },
  { key: "serie", label: "Séries", Icon: Tv          },
  { key: "film",  label: "Films",  Icon: Clapperboard },
];

// ── Page Recommandations ──────────────────────────────────────────────────────
export function Recommendations() {
  const navigate       = useNavigate();
  const { entries }    = useLibrary();

  const [activeTab,    setActiveTab]    = useState("anime");
  const [recs,         setRecs]         = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState("");   // "" | "no_tmdb" | message
  const [isStale,      setIsStale]      = useState(false);
  const [tabTopGenres, setTabTopGenres] = useState([]);
  const [adding,       setAdding]       = useState(null);
  const [editingEntry, setEditingEntry] = useState(null);
  const [synopsisRec,  setSynopsisRec]  = useState(null);

  // ── Données animes (AniList) ───────────────────────────────────────────────
  const animeTopGenres = useMemo(() => {
    const tally = {};
    entries.forEach((e) => {
      if (e.type !== "anime") return;
      const w = (e.status === "termine" || e.status === "en-cours") ? 2 : 1;
      (e.genres || []).forEach((g) => { tally[g] = (tally[g] || 0) + w; });
    });
    return Object.entries(tally).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([g]) => g);
  }, [entries]);

  const animeTopGenresEN = useMemo(() => toEnglishGenres(animeTopGenres), [animeTopGenres]);
  const libraryIds       = useMemo(() => new Set(entries.flatMap((e) => e.anilistIds || [])), [entries]);
  const libraryTmdbIds   = useMemo(() => new Set(entries.map((e) => e.tmdbId).filter(Boolean)), [entries]);
  const libraryTitles    = useMemo(() => {
    const set = new Set();
    entries.forEach((e) => {
      [e.title, e.titleRomaji, e.titleEnglish, e.titleFrench].forEach((t) => {
        if (t) set.add(normalizeSeriesTitle(t));
      });
    });
    return set;
  }, [entries]);
  const animeCacheKey    = useMemo(
    () => `recs_en_${[...animeTopGenresEN].sort().join("_")}`,
    [animeTopGenresEN]
  );

  // ── Fetch selon l'onglet ───────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      setIsStale(false);

      // ── Animes ────────────────────────────────────────────────────────────
      if (activeTab === "anime") {
        if (!animeTopGenresEN.length) { setLoading(false); return; }
        const cached = getCached(animeCacheKey);
        if (cached) {
          if (!cancelled) { setRecs(cached); setTabTopGenres(animeTopGenres); setLoading(false); }
          return;
        }
        try {
          const data = await fetchAniListRecommendations(animeTopGenresEN, [...libraryIds]);
          setCached(animeCacheKey, data, TTL.RECOMMENDATIONS);
          if (!cancelled) { setRecs(data); setTabTopGenres(animeTopGenres); setLoading(false); }
        } catch {
          const stale = getStaleCached(animeCacheKey);
          if (!cancelled) {
            if (stale) { setRecs(stale); setIsStale(true); setLoading(false); }
            else { setError("Impossible de charger les recommandations. Vérifie ta connexion."); setLoading(false); }
          }
        }

      // ── Films ─────────────────────────────────────────────────────────────
      } else if (activeTab === "film") {
        if (!hasTMDB()) {
          if (!cancelled) { setError("no_tmdb"); setLoading(false); }
          return;
        }
        const ck = "recs_film_tmdb";
        const cached = getCached(ck);
        if (cached) {
          if (!cancelled) { setRecs(cached.recs); setTabTopGenres(cached.topGenres || []); setLoading(false); }
          return;
        }
        try {
          const { recs: data, topGenres } = await fetchTMDBMovieRecommendations(entries);
          setCached(ck, { recs: data, topGenres }, TTL.RECOMMENDATIONS);
          if (!cancelled) { setRecs(data); setTabTopGenres(topGenres); setLoading(false); }
        } catch {
          const stale = getStaleCached(ck);
          if (!cancelled) {
            if (stale) { setRecs(stale.recs); setTabTopGenres(stale.topGenres || []); setIsStale(true); setLoading(false); }
            else { setError("Impossible de charger les recommandations."); setLoading(false); }
          }
        }

      // ── Séries ────────────────────────────────────────────────────────────
      } else {
        if (!hasTMDB()) {
          if (!cancelled) { setError("no_tmdb"); setLoading(false); }
          return;
        }
        const ck = "recs_serie_tmdb";
        const cached = getCached(ck);
        if (cached) {
          if (!cancelled) { setRecs(cached.recs); setTabTopGenres(cached.topGenres || []); setLoading(false); }
          return;
        }
        try {
          const { recs: data, topGenres } = await fetchTMDBSeriesRecommendations(entries);
          setCached(ck, { recs: data, topGenres }, TTL.RECOMMENDATIONS);
          if (!cancelled) { setRecs(data); setTabTopGenres(topGenres); setLoading(false); }
        } catch {
          const stale = getStaleCached(ck);
          if (!cancelled) {
            if (stale) { setRecs(stale.recs); setTabTopGenres(stale.topGenres || []); setIsStale(true); setLoading(false); }
            else { setError("Impossible de charger les recommandations."); setLoading(false); }
          }
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, [activeTab, animeCacheKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Pull-to-refresh ────────────────────────────────────────────────────────
  async function handlePullRefresh() {
    setError(""); setIsStale(false);

    if (activeTab === "anime") {
      if (!animeTopGenresEN.length) return;
      removeCached(animeCacheKey);
      try {
        const data = await fetchAniListRecommendations(animeTopGenresEN, [...libraryIds]);
        setCached(animeCacheKey, data, TTL.RECOMMENDATIONS);
        setRecs(data); setTabTopGenres(animeTopGenres);
      } catch {
        const stale = getStaleCached(animeCacheKey);
        if (stale) { setRecs(stale); setIsStale(true); }
        else setError("Impossible de charger les recommandations. Vérifie ta connexion.");
      }
    } else if (activeTab === "film") {
      const ck = "recs_film_tmdb";
      removeCached(ck);
      try {
        const { recs: data, topGenres } = await fetchTMDBMovieRecommendations(entries);
        setCached(ck, { recs: data, topGenres }, TTL.RECOMMENDATIONS);
        setRecs(data); setTabTopGenres(topGenres);
      } catch {
        const stale = getStaleCached(ck);
        if (stale) { setRecs(stale.recs); setTabTopGenres(stale.topGenres || []); setIsStale(true); }
        else setError("Impossible de charger les recommandations.");
      }
    } else {
      const ck = "recs_serie_tmdb";
      removeCached(ck);
      try {
        const { recs: data, topGenres } = await fetchTMDBSeriesRecommendations(entries);
        setCached(ck, { recs: data, topGenres }, TTL.RECOMMENDATIONS);
        setRecs(data); setTabTopGenres(topGenres);
      } catch {
        const stale = getStaleCached(ck);
        if (stale) { setRecs(stale.recs); setTabTopGenres(stale.topGenres || []); setIsStale(true); }
        else setError("Impossible de charger les recommandations.");
      }
    }
  }

  // ── Dédoublonnage ─────────────────────────────────────────────────────────
  const dedupedRecs = useMemo(() => {
    const seen = new Set();
    return recs.filter((rec) => {
      const key = normalizeSeriesTitle(rec.title);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 20);
  }, [recs]);

  // Vérifie l'appartenance à la bibliothèque quelle que soit la source
  // (AniList ou TMDB) + filet de sécurité par titre normalisé, pour éviter
  // les doublons croisés (ex : un titre présent à la fois côté AniList et TMDB).
  function isInLibrary(rec) {
    if (libraryIds.has(rec.id)) return true;
    if ((rec.source === "tmdb_movie" || rec.source === "tmdb_tv") && libraryTmdbIds.has(rec.id)) return true;
    return libraryTitles.has(normalizeSeriesTitle(rec.title));
  }

  async function handleAdd(rec) {
    if (isInLibrary(rec)) { setSynopsisRec(null); return; } // garde-fou pour les doublons
    setAdding(rec.id);
    try {
      const prefilled = await importResult(rec);
      haptics.light();
      setSynopsisRec(null);
      setEditingEntry(prefilled);
    } catch {
      setError("Erreur lors de l'import du titre.");
    } finally {
      setAdding(null);
    }
  }

  const isNoTmdb      = error === "no_tmdb";
  const displayGenres = activeTab === "anime" ? animeTopGenres : tabTopGenres;

  return (
    <div className="min-h-screen bg-violet-950 text-violet-50" style={{ fontFamily: "'Inter', sans-serif" }}>
      <PullToRefresh onRefresh={handlePullRefresh}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 pb-nav pt-safe-8">

          {/* ── En-tête ── */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <button onClick={() => navigate(-1)}
                className="flex items-center gap-1.5 text-sm text-violet-400 hover:text-violet-200 transition-colors mb-2">
                <ChevronLeft size={16} /> Retour
              </button>
              <p className="font-mono text-[11px] tracking-[0.3em] text-violet-400 uppercase mb-1">Basé sur tes goûts</p>
              <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                Recommandations
              </h1>
            </div>
            <TopBar />
          </div>

          {/* ── Sélecteur Anime / Séries / Films ── */}
          <div className="flex justify-center mb-6">
            <div className="inline-flex rounded-full bg-white/5 border border-white/10 p-0.5">
              {TABS.map(({ key, label, Icon }) => (
                <button
                  key={key}
                  onClick={() => { if (activeTab !== key) { setActiveTab(key); setRecs([]); setError(""); } }}
                  className={`flex items-center gap-1.5 px-5 py-1.5 rounded-full text-xs font-medium transition-all duration-200
                    active:scale-95 motion-reduce:transition-none ${
                    activeTab === key
                      ? "bg-amber-400 text-violet-950 font-semibold shadow-sm"
                      : "text-violet-300 hover:text-violet-100"
                  }`}
                >
                  <Icon size={12} />{label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Genres utilisés ── */}
          {displayGenres.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-5">
              <span className="text-[11px] text-violet-400 font-mono uppercase tracking-wide self-center">Basé sur :</span>
              {displayGenres.map((g) => (
                <span key={g}
                  className="px-2.5 py-1 rounded-full bg-amber-400/15 border border-amber-400/30 text-amber-300 text-[11px] font-mono">
                  {g}
                </span>
              ))}
            </div>
          )}

          {/* ── Bannière hors-ligne ── */}
          {isStale && (
            <div className="flex items-center gap-2 mb-4 px-4 py-2.5 rounded-xl bg-amber-400/10 border border-amber-400/20 text-amber-300 text-sm animate-fadeIn">
              <WifiOff size={14} className="flex-shrink-0" />
              <span>Mode hors-ligne — données mises en cache affichées.</span>
            </div>
          )}

          {/* ── Contenu principal ── */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-32 gap-3">
              <Loader2 size={28} className="animate-spin text-violet-400" />
              <p className="text-sm text-violet-400 font-mono">Recherche de recommandations…</p>
            </div>

          ) : isNoTmdb ? (
            <div className="text-center py-20 rounded-2xl border border-dashed border-white/10 animate-fadeIn">
              <Clapperboard size={32} className="text-violet-500 mx-auto mb-3" />
              <p className="text-violet-300 mb-2">Clé TMDB requise</p>
              <p className="text-sm text-violet-500 max-w-xs mx-auto leading-relaxed">
                Ajoute ta clé dans{" "}
                <span className="font-mono text-violet-300">.env.local</span> :{" "}
                <span className="font-mono text-amber-400">VITE_TMDB_TOKEN=…</span>
              </p>
            </div>

          ) : error ? (
            <div className="text-sm text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3">
              {error}
            </div>

          ) : displayGenres.length === 0 && activeTab === "anime" ? (
            <div className="text-center py-20 rounded-2xl border border-dashed border-white/10">
              <Film size={32} className="text-violet-500 mx-auto mb-3" />
              <p className="text-violet-300 mb-1">Pas encore assez de données</p>
              <p className="text-sm text-violet-500">
                Ajoute des titres à ta bibliothèque pour recevoir des recommandations.
              </p>
            </div>

          ) : dedupedRecs.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-violet-400">Aucune recommandation trouvée pour ces genres.</p>
            </div>

          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 sm:gap-3">
              {dedupedRecs.map((rec) => (
                <RecCard key={`${rec.source}-${rec.id}`} rec={rec} onClick={() => setSynopsisRec(rec)} />
              ))}
            </div>
          )}

        </div>
      </PullToRefresh>

      {synopsisRec && (
        <SynopsisModal
          rec={synopsisRec}
          onClose={() => setSynopsisRec(null)}
          onAdd={handleAdd}
          adding={adding === synopsisRec.id}
          alreadyInLib={isInLibrary(synopsisRec)}
        />
      )}

      {editingEntry && (
        <TitleFormModal
          editingEntry={editingEntry}
          onClose={() => setEditingEntry(null)}
        />
      )}
    </div>
  );
}