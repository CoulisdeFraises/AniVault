import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronLeft, Loader2, Film, Tv, Clapperboard, WifiOff, RefreshCw,
  Dices, Dice1, Dice2, Dice3, Dice4, Dice5, Dice6,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useLibrary }          from "../context/LibraryContext";
import { usePrefs }            from "../context/PrefsContext";
import { TopBar }          from "../components/common/TopBar";
import { SynopsisModal }       from "../components/common/SynopsisModal";
import { PullToRefresh }       from "../components/common/PullToRefresh";
import { HeartIcon }           from "../components/common/icons";
import {
  fetchAniListRecommendations,
  fetchTMDBMovieRecommendations,
  fetchTMDBSeriesRecommendations,
  fetchAniListRandomTitle,
  fetchCultureZoneRecommendations,
} from "../api/recommendations";
import { hasTMDB, fetchTMDBRandomMovie, fetchTMDBRandomSeries, fetchTMDBMovieTitles } from "../api/tmdb";
import { findAniListMovie, findTmdbMovie } from "../api/crossRef";
import { importResult }        from "../api";
import { getCached, getStaleCached, setCached, TTL } from "../lib/cache";
import { toEnglishGenres }     from "../utils/genres";
import { haptics } from "../utils/haptics";
import { normalizeSeriesTitle } from "../utils/titles";
import { titleSimilarity } from "../utils/fuzzy";

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

// ── Carte compacte pour le carrousel Culture Zone ──────────────────────────────
function CultureZoneCard({ rec, onClick }) {
  return (
    <div
      onClick={onClick}
      className="relative flex-shrink-0 w-28 rounded-xl overflow-hidden bg-violet-950 group cursor-pointer active:scale-[0.97] transition-transform"
    >
      <div className="aspect-[2/3] w-full overflow-hidden">
        {rec.image ? (
          <img
            src={rec.image} alt={rec.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 motion-reduce:transition-none"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-violet-900/50">
            <Film size={20} className="text-violet-600" />
          </div>
        )}
      </div>
      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent p-1.5 pt-6">
        <p className="font-mono text-[9px] text-white leading-tight line-clamp-2" title={rec.title}>
          {rec.title}
        </p>
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

// ── Faces de dé pour l'animation de tirage ─────────────────────────────────────
const DICE_FACES = [Dice1, Dice2, Dice3, Dice4, Dice5, Dice6];
const ROLL_DURATION_MS = 900; // durée mini de l'animation de suspense

// ── Page Recommandations ──────────────────────────────────────────────────────
export function Recommendations() {
  const navigate           = useNavigate();
  const { entries, saveEntry } = useLibrary();
  const { cultureMode }    = usePrefs();

  const [activeTab,    setActiveTab]    = useState("anime");
  const [recs,         setRecs]         = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState("");   // "" | "no_tmdb" | message
  const [isStale,      setIsStale]      = useState(false);
  const [tabTopGenres, setTabTopGenres] = useState([]);
  const [adding,       setAdding]       = useState(null);
  const [addedToast,   setAddedToast]   = useState(false); // ← confirmation brève après ajout rapide
  const [synopsisRec,  setSynopsisRec]  = useState(null);
  const [surpriseOpen, setSurpriseOpen] = useState(false); // ← carte ouverte via "Surprends-moi" → shake
  const [refreshNotice, setRefreshNotice] = useState(""); // message discret, auto-effacé
  const [swipeDir, setSwipeDir] = useState(1); // 1 = vers la droite (onglet suivant), -1 = vers la gauche — pilote le sens de l'animation de transition

  // ── « Surprends-moi » ──────────────────────────────────────────────────────
  const [rolling,   setRolling]   = useState(false);
  const [diceFace,  setDiceFace]  = useState(0);
  const rollIntervalRef = useRef(null);
  const mountedRef       = useRef(true);
  useEffect(() => () => {
    mountedRef.current = false;
    if (rollIntervalRef.current) clearInterval(rollIntervalRef.current);
  }, []);

  // Dernière page tirée par onglet, pour éviter que deux pull-to-refresh
  // consécutifs retombent sur exactement le même lot par hasard.
  const lastPageRef = useRef({ anime: 1, film: 1, serie: 1 });

  // ── Données animes (AniList) ───────────────────────────────────────────────
  const animeTopGenres = useMemo(() => {
    const tally = {};
    entries.forEach((e) => {
      if (e.type !== "anime") return;
      const w = (e.status === "termine" || e.status === "en-cours") ? 2 : 1;
      (e.genres || []).forEach((g) => { tally[g] = (tally[g] || 0) + w; });
    });
    return Object.entries(tally).sort((a, b) => b[1] - a[1]).slice(0, 7).map(([g]) => g);
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
  const libraryTitleList = useMemo(() => [...libraryTitles], [libraryTitles]);

  // ── Titres alternatifs des films de la bibliothèque (résolus par ID) ───────
  // Pour chaque film de la bibliothèque ajouté via TMDB (tmdbId connu), on
  // récupère son titre anglais + original directement par ID (fiable, pas
  // de recherche floue) — comparable aux titres romaji/anglais qu'expose
  // AniList. C'est la vérification PRINCIPALE pour détecter qu'une reco
  // anime-film est déjà en bibliothèque : chercher par TEXTE le titre
  // anglais d'un anime sur TMDB s'est révélé peu fiable (son classement par
  // pertinence peut remonter un résultat sans rapport — cf. le faux match
  // « Weathering Railroad Models... » pour « Weathering With You »),
  // alors qu'ici on part de l'ID déjà connu, donc aucune ambiguïté.
  const [libraryMovieAltTitles, setLibraryMovieAltTitles] = useState([]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const movies = entries.filter((e) => e.category === "movie" && e.tmdbId);
      if (!movies.length) { if (!cancelled) setLibraryMovieAltTitles([]); return; }

      const settled = await Promise.allSettled(
        movies.slice(0, 60).map((e) => fetchTMDBMovieTitles(e.tmdbId))
      );
      if (cancelled) return;

      setLibraryMovieAltTitles(
        settled.filter((r) => r.status === "fulfilled" && r.value).map((r) => r.value)
      );
    }

    run();
    return () => { cancelled = true; };
  }, [entries]);

  // Une reco anime-film correspond-elle à un film de la bibliothèque sous
  // son titre anglais/original ? Comparaison synchrone, déjà résolue par
  // l'effet ci-dessus — pas d'appel réseau ici.
  function matchesLibraryMovieByAltTitle(rec) {
    if (rec.source !== "anilist" || rec.format !== "MOVIE" || !libraryMovieAltTitles.length) return false;
    const recTitles = [rec.title, ...(rec.titleAlt || [])].filter(Boolean).map(normalizeSeriesTitle);
    return libraryMovieAltTitles.some((m) => {
      // Filet de sécurité par année : un même film a (quasi) la même année
      // des deux côtés — écarte un match texte accidentel entre deux films
      // différents partageant des mots communs.
      if (rec.year != null && m.year != null && Math.abs(rec.year - m.year) > 1) return false;
      const mTitles = [m.title, m.originalTitle].filter(Boolean).map(normalizeSeriesTitle);
      return recTitles.some((rt) =>
        mTitles.some((mt) => rt === mt || titleSimilarity(rt, mt) >= 0.75)
      );
    });
  }

  // ── Anti-doublons croisés (films uniquement) ────────────────────────────
  // Un même film peut être présent dans la bibliothèque sous un ID/titre
  // totalement différent selon la source d'ajout (ex : ajouté via TMDB sous
  // son titre français « Les enfants du temps », reproposé en recommandation
  // AniList sous « Weathering With You » — aucun texte en commun). Aucune
  // normalisation ni fuzzy matching ne peut relier ces deux chaînes : il
  // faut une recherche croisée sur l'autre API. Voir src/api/crossRef.js.
  //
  // Important : on compare aussi par TITRE résolu (pas seulement par ID),
  // car une entrée ajoutée via le formulaire manuel n'a AUCUN ID externe
  // (ni tmdbId, ni anilistIds) — seule une comparaison de texte, sur le
  // titre retrouvé via la recherche croisée, peut alors la détecter.
  //
  // `crossDupKeys` contient les clés `${source}:${id}` des recos ainsi
  // identifiées comme déjà présentes en bibliothèque sous une autre source.
  // `resolvedTitles` contient le titre FRANÇAIS retrouvé pour les recos
  // films AniList (qui n'exposent sinon que le romaji/anglais) — utilisé à
  // l'affichage même quand la reco n'est pas un doublon.
  const [crossDupKeys,    setCrossDupKeys]    = useState(new Set());
  const [resolvedTitles,  setResolvedTitles]  = useState(new Map());

  useEffect(() => {
    let cancelled = false;

    async function run() {
      // Ne cible que les candidats films pas déjà exclus par les checks
      // rapides (ID exact / titre normalisé) — pas la peine de refaire une
      // recherche réseau pour ceux déjà écartés. Plafonné pour borner le
      // nombre d'appels réseau par chargement de page.
      const candidates = recs
        .filter((rec) => {
          const isAnimeMovie = rec.source === "anilist" && rec.format === "MOVIE";
          const isTmdbMovie  = rec.source === "tmdb_movie";
          if (!isAnimeMovie && !isTmdbMovie) return false;
          if (libraryIds.has(rec.id)) return false;
          if (isTmdbMovie && libraryTmdbIds.has(rec.id)) return false;
          if (isAnimeMovie && matchesLibraryMovieByAltTitle(rec)) return false; // déjà détecté, fiable
          const normTitles = [rec.title, ...(rec.titleAlt || [])].map(normalizeSeriesTitle);
          return !normTitles.some((t) => libraryTitles.has(t));
        })
        .slice(0, 12);

      if (!candidates.length) {
        if (!cancelled) { setCrossDupKeys(new Set()); setResolvedTitles(new Map()); }
        return;
      }

      const settled = await Promise.allSettled(candidates.map(async (rec) => {
        const key = `${rec.source}:${rec.id}`;

        if (rec.source === "anilist") {
          const match = await findTmdbMovie([...(rec.titleAlt || []), rec.title], rec.year ?? null);
          if (!match) return null;
          const matchNormTitle = normalizeSeriesTitle(match.title);
          const isDup = libraryTmdbIds.has(match.id)
            || libraryTitles.has(matchNormTitle)
            || libraryTitleList.some((lt) => titleSimilarity(matchNormTitle, lt) >= 0.88);
          // Titre français résolu, à afficher même si ce N'EST PAS un
          // doublon — AniList n'expose que le romaji/anglais.
          return { key, resolvedTitle: match.title, isDup };
        }

        const match = await findAniListMovie([...(rec.titleAlt || []), rec.title], rec.year ?? null);
        if (!match) return null;
        const matchTitle = match.titleEnglish || match.titleRomaji || match.title;
        const matchNormTitle = normalizeSeriesTitle(matchTitle);
        const isDup = libraryIds.has(match.id)
          || libraryTitles.has(matchNormTitle)
          || libraryTitleList.some((lt) => titleSimilarity(matchNormTitle, lt) >= 0.88);
        return { key, resolvedTitle: null, isDup }; // déjà en FR côté TMDB
      }));

      if (cancelled) return;
      const dupKeys  = new Set();
      const titleMap = new Map();
      settled.forEach((r) => {
        if (r.status !== "fulfilled" || !r.value) return;
        const { key, resolvedTitle, isDup } = r.value;
        if (isDup) dupKeys.add(key);
        else if (resolvedTitle) titleMap.set(key, resolvedTitle);
      });
      setCrossDupKeys(dupKeys);
      setResolvedTitles(titleMap);
    }

    run();
    return () => { cancelled = true; };
  }, [recs, libraryIds, libraryTmdbIds, libraryTitles, libraryMovieAltTitles]); // eslint-disable-line react-hooks/exhaustive-deps
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

  // ── Culture Zone (bonus éditorial, onglet Animes uniquement) ────────────────
  // Chargée indépendamment des recos principales : ne dépend pas des goûts du
  // profil, seulement du Mode Culture. Rien n'est interrogé tant que le mode
  // est désactivé.
  const [cultureZoneRecs,       setCultureZoneRecs]       = useState([]);
  const [cultureZoneLoading,    setCultureZoneLoading]    = useState(false);
  const [cultureZoneRefreshing, setCultureZoneRefreshing] = useState(false);
  const cultureZonePageRef = useRef(1);

  useEffect(() => {
    if (activeTab !== "anime" || !cultureMode) { setCultureZoneRecs([]); return; }
    let cancelled = false;

    async function load() {
      setCultureZoneLoading(true);
      const data = await fetchCultureZoneRecommendations([...libraryIds]);
      if (!cancelled) { setCultureZoneRecs(data); setCultureZoneLoading(false); }
    }

    load();
    return () => { cancelled = true; };
  }, [activeTab, cultureMode]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCultureZoneRefresh() {
    setCultureZoneRefreshing(true);
    const excludeIds = [...libraryIds, ...cultureZoneRecs.map((r) => r.id)];
    cultureZonePageRef.current = cultureZonePageRef.current > 1 ? 1 : Math.floor(Math.random() * 4) + 2; // alterne entre page 1 et une page 2-5
    let data = await fetchCultureZoneRecommendations(excludeIds, { page: cultureZonePageRef.current });
    if (data.length === 0 && cultureZonePageRef.current !== 1) {
      data = await fetchCultureZoneRecommendations(excludeIds, { page: 1 });
    }
    if (data.length > 0) setCultureZoneRecs(data);
    setCultureZoneRefreshing(false);
  }

  // ── Pull-to-refresh ────────────────────────────────────────────────────────
  // Tire un nouveau lot de recommandations DIFFÉRENT de celui affiché : page
  // différente de la précédente + exclusion explicite des titres déjà à
  // l'écran (en plus des titres déjà dans la bibliothèque, toujours exclus).
  //
  // Le catalogue AniList filtré sur quelques genres précis est bien plus
  // restreint que celui de TMDB (films/séries) : une page tirée au hasard
  // peut ne quasiment plus contenir d'entrées une fois la bibliothèque et
  // l'affichage courant exclus. On limite donc la plage de pages pour les
  // animes, et surtout on retente automatiquement sur la page 1 (qui reste
  // la plus fournie) avant de conclure qu'il n'y a vraiment plus rien de neuf.
  function pickNextPage(tab, maxPage) {
    const candidates = Array.from({ length: maxPage - 1 }, (_, i) => i + 2) // [2..maxPage]
      .filter((p) => p !== lastPageRef.current[tab]);
    const page = candidates[Math.floor(Math.random() * candidates.length)] ?? 2;
    lastPageRef.current[tab] = page;
    return page;
  }

  async function handlePullRefresh() {
    setError(""); setIsStale(false); setRefreshNotice("");
    const shownIds = recs.map((r) => r.id);

    if (activeTab === "anime") {
      if (!animeTopGenresEN.length) return;
      const excludeIds = [...libraryIds, ...shownIds];
      try {
        let data = await fetchAniListRecommendations(animeTopGenresEN, excludeIds, { page: pickNextPage("anime", 3) });
        // Repli : la page tirée est peut-être trop loin pour ce combo de
        // genres précis — la page 1 (la plus fournie) a plus de chances
        // de contenir encore des titres non vus.
        if (data.length === 0) {
          data = await fetchAniListRecommendations(animeTopGenresEN, excludeIds, { page: 1 });
        }
        if (data.length === 0) {
          setRefreshNotice("Plus de nouvelles suggestions pour l'instant — réessaie plus tard.");
        } else {
          setCached(animeCacheKey, data, TTL.RECOMMENDATIONS);
          setRecs(data); setTabTopGenres(animeTopGenres);
        }
      } catch {
        const stale = getStaleCached(animeCacheKey);
        if (stale) { setRecs(stale); setIsStale(true); }
        else setError("Impossible de charger les recommandations. Vérifie ta connexion.");
      }
    } else if (activeTab === "film") {
      const ck = "recs_film_tmdb";
      const excludeIds = shownIds;
      try {
        let { recs: data, topGenres } = await fetchTMDBMovieRecommendations(entries, { page: pickNextPage("film", 5), extraExcludeIds: excludeIds });
        if (data.length === 0) {
          ({ recs: data, topGenres } = await fetchTMDBMovieRecommendations(entries, { page: 1, extraExcludeIds: excludeIds }));
        }
        if (data.length === 0) {
          setRefreshNotice("Plus de nouvelles suggestions pour l'instant — réessaie plus tard.");
        } else {
          setCached(ck, { recs: data, topGenres }, TTL.RECOMMENDATIONS);
          setRecs(data); setTabTopGenres(topGenres);
        }
      } catch {
        const stale = getStaleCached(ck);
        if (stale) { setRecs(stale.recs); setTabTopGenres(stale.topGenres || []); setIsStale(true); }
        else setError("Impossible de charger les recommandations.");
      }
    } else {
      const ck = "recs_serie_tmdb";
      const excludeIds = shownIds;
      try {
        let { recs: data, topGenres } = await fetchTMDBSeriesRecommendations(entries, { page: pickNextPage("serie", 5), extraExcludeIds: excludeIds });
        if (data.length === 0) {
          ({ recs: data, topGenres } = await fetchTMDBSeriesRecommendations(entries, { page: 1, extraExcludeIds: excludeIds }));
        }
        if (data.length === 0) {
          setRefreshNotice("Plus de nouvelles suggestions pour l'instant — réessaie plus tard.");
        } else {
          setCached(ck, { recs: data, topGenres }, TTL.RECOMMENDATIONS);
          setRecs(data); setTabTopGenres(topGenres);
        }
      } catch {
        const stale = getStaleCached(ck);
        if (stale) { setRecs(stale.recs); setTabTopGenres(stale.topGenres || []); setIsStale(true); }
        else setError("Impossible de charger les recommandations.");
      }
    }
  }

  // Le message d'absence de nouvelles suggestions s'efface tout seul.
  useEffect(() => {
    if (!refreshNotice) return;
    const t = setTimeout(() => setRefreshNotice(""), 4000);
    return () => clearTimeout(t);
  }, [refreshNotice]);

  // Confirmation d'ajout rapide, elle aussi éphémère.
  useEffect(() => {
    if (!addedToast) return;
    const t = setTimeout(() => setAddedToast(false), 2500);
    return () => clearTimeout(t);
  }, [addedToast]);

  // Vérifie l'appartenance à la bibliothèque quelle que soit la source
  // (AniList ou TMDB), en 4 passes de plus en plus tolérantes :
  //  1. ID exact (le plus fiable)
  //  2. Titres alternatifs des films de bibliothèque résolus par ID TMDB
  //     (matchesLibraryMovieByAltTitle) — la vérification la plus fiable
  //     pour les recos anime-films : pas de recherche floue, on part
  //     directement de l'ID connu du film en bibliothèque.
  //  3. Titre normalisé exact — inclut désormais le(s) titre(s) alternatif(s)
  //     de la reco (titleAlt : romaji/anglais/original_title côté TMDB), pas
  //     seulement son titre d'affichage, pour attraper les cas où l'entrée
  //     de bibliothèque a été enregistrée sous un autre titre que celui
  //     renvoyé par la reco (ex : ajoutée sous son titre anglais, reproposée
  //     sous son titre romaji, ou l'inverse).
  //  4. Similarité floue (fuzzy) en filet de sécurité, pour les variantes
  //     quasi-identiques qui échappent encore à la normalisation stricte
  //     (petite faute de frappe, ordre des mots différent…). Seuil élevé
  //     pour ne pas confondre deux œuvres différentes au titre proche.
  function isInLibrary(rec) {
    if (libraryIds.has(rec.id)) return true;
    if ((rec.source === "tmdb_movie" || rec.source === "tmdb_tv") && libraryTmdbIds.has(rec.id)) return true;
    if (matchesLibraryMovieByAltTitle(rec)) return true;
    if (crossDupKeys.has(`${rec.source}:${rec.id}`)) return true;

    const recTitles = [rec.title, ...(rec.titleAlt || [])].filter(Boolean);
    const recNormTitles = recTitles.map(normalizeSeriesTitle);
    if (recNormTitles.some((t) => libraryTitles.has(t))) return true;

    if (!libraryTitleList.length) return false;
    return recNormTitles.some((rt) =>
      libraryTitleList.some((lt) => titleSimilarity(rt, lt) >= 0.88)
    );
  }

  // ── Dédoublonnage + retrait des titres déjà en bibliothèque ────────────────
  // L'exclusion faite côté API (fetch) ne matche que par ID exact et ne
  // rattrape donc pas les cas où le même titre existe déjà sous un autre
  // ID/source (ex : ajouté via AniList mais reproposé via TMDB, ou vice
  // versa). `isInLibrary` fait ce matching plus large par titre normalisé —
  // il faut l'appliquer ici, à l'affichage, pas seulement au clic sur
  // "Ajouter", sinon des titres déjà possédés continuent d'apparaître dans
  // la grille.
  //
  // On applique aussi le titre français résolu (`resolvedTitles`) sur les
  // films d'anime AniList qui en ont un — AniList n'expose que romaji/
  // anglais, alors que le reste de l'appli affiche du français partout.
  const dedupedRecs = useMemo(() => {
    const seen = new Set();
    return recs
      .filter((rec) => !isInLibrary(rec))
      .map((rec) => {
        const resolved = resolvedTitles.get(`${rec.source}:${rec.id}`);
        return resolved ? { ...rec, title: resolved } : rec;
      })
      .filter((rec) => {
        const key = normalizeSeriesTitle(rec.title);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 15);
  }, [recs, libraryIds, libraryTmdbIds, libraryTitles, crossDupKeys, resolvedTitles, libraryMovieAltTitles]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ajout rapide : import + sauvegarde directe en "à voir", sans passer par
  // le formulaire manuel (TitleFormModal) — l'utilisateur veut un ajout en
  // un clic depuis la synopsis modal, pas une étape de confirmation en plus.
  async function handleAdd(rec) {
    if (isInLibrary(rec)) { setSynopsisRec(null); return; } // garde-fou pour les doublons
    setAdding(rec.id);
    try {
      const data = await importResult(rec);
      saveEntry(data, null);
      haptics.success();
      setSynopsisRec(null);
      setSurpriseOpen(false);
      setAddedToast(true);
    } catch {
      haptics.error();
      setError("Erreur lors de l'ajout du titre.");
    } finally {
      setAdding(null);
    }
  }

  // ── Tirage aléatoire d'un titre selon l'onglet actif ──────────────────────
  // Volontairement DÉCORRÉLÉ des recommandations basées sur les goûts : on
  // pioche dans le catalogue populaire général (AniList / TMDB), sans filtre
  // de genre, pour un vrai effet de surprise plutôt qu'une simple variante
  // des recos déjà affichées. Seule l'exclusion des titres déjà en
  // bibliothèque est conservée.
  async function pickRandomAnime() {
    return fetchAniListRandomTitle([...libraryIds]);
  }

  async function pickRandomFilm() {
    if (!hasTMDB()) return null;
    return fetchTMDBRandomMovie([...libraryTmdbIds]);
  }

  async function pickRandomSerie() {
    if (!hasTMDB()) return null;
    return fetchTMDBRandomSeries([...libraryTmdbIds]);
  }

  function pickRandomTitle() {
    if (activeTab === "anime") return pickRandomAnime();
    if (activeTab === "film")  return pickRandomFilm();
    return pickRandomSerie();
  }

  async function handleSurpriseMe() {
    if (rolling) return;
    haptics.tap();
    setRolling(true);
    setDiceFace(0);

    // Animation de suspense : on fait défiler les faces du dé pendant qu'on
    // tire le titre en arrière-plan, avec une durée mini pour que le geste
    // se sente intentionnel même si la requête réseau est instantanée.
    rollIntervalRef.current = setInterval(() => {
      setDiceFace((f) => (f + 1) % DICE_FACES.length);
    }, 90);

    try {
      const [result] = await Promise.all([
        pickRandomTitle(),
        new Promise((r) => setTimeout(r, ROLL_DURATION_MS)),
      ]);

      if (!mountedRef.current) return;
      clearInterval(rollIntervalRef.current);
      setRolling(false);

      if (result) {
        haptics.success();
        setSurpriseOpen(true);
        setSynopsisRec(result);
      } else {
        haptics.error();
        setRefreshNotice("Aucun titre trouvé pour l'instant — réessaie plus tard.");
      }
    } catch {
      if (!mountedRef.current) return;
      clearInterval(rollIntervalRef.current);
      setRolling(false);
      haptics.error();
      setRefreshNotice("Aucun titre trouvé pour l'instant — réessaie plus tard.");
    }
  }

  const isNoTmdb      = error === "no_tmdb";
  const displayGenres = activeTab === "anime" ? animeTopGenres : tabTopGenres;
  const canSurprise    = activeTab === "anime" ? true : hasTMDB();
  const DiceIcon        = rolling ? DICE_FACES[diceFace] : Dices;

  // ── Changement d'onglet (bouton ou swipe) ───────────────────────────────
  // Centralisé ici pour que le sélecteur à onglets et le geste de swipe
  // déclenchent exactement le même comportement (reset recs/erreur/notice)
  // et animent la transition dans le bon sens.
  function switchTab(key) {
    if (key === activeTab) return;
    const fromIdx = TABS.findIndex((t) => t.key === activeTab);
    const toIdx   = TABS.findIndex((t) => t.key === key);
    setSwipeDir(toIdx > fromIdx ? 1 : -1);
    setActiveTab(key);
    setRecs([]);
    setError("");
    setRefreshNotice("");
  }

  // ── Swipe horizontal pour naviguer entre Animes / Séries / Films ───────────
  // Implémenté à la main (touchstart/touchend) plutôt qu'avec le drag de
  // framer-motion, pour ne pas interférer avec le scroll vertical normal de
  // la grille ni avec le geste de PullToRefresh (qui n'observe que le delta
  // vertical — un swipe horizontal ne l'arme jamais). Seuil de distance +
  // exigence de netteté (horizontal nettement dominant sur le vertical)
  // pour ne pas confondre un swipe avec un simple scroll ou un tap sur une
  // carte.
  const swipeStartRef = useRef(null); // { x, y }

  function handleContentTouchStart(e) {
    if (e.touches.length !== 1) { swipeStartRef.current = null; return; }
    swipeStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }

  function handleContentTouchEnd(e) {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    if (!start) return;

    const touch = e.changedTouches[0];
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;

    const SWIPE_THRESHOLD = 55; // px minimum pour compter comme un swipe intentionnel
    if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) < Math.abs(dy) * 1.4) return;

    const currentIdx = TABS.findIndex((t) => t.key === activeTab);
    // Swipe vers la gauche (dx < 0) → onglet suivant ; vers la droite → précédent.
    const nextIdx = currentIdx + (dx < 0 ? 1 : -1);
    if (nextIdx < 0 || nextIdx >= TABS.length) return; // pas de wrap en bout de liste

    haptics.tap();
    switchTab(TABS[nextIdx].key);
  }

  const slideVariants = {
    enter:  (dir) => ({ x: dir > 0 ? 36 : -36, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit:   (dir) => ({ x: dir > 0 ? -36 : 36, opacity: 0 }),
  };

  return (
    <div className="h-[100dvh] bg-violet-950 text-violet-50 flex flex-col overflow-hidden" style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* ══ Zone fixe (non scrollable) : en-tête, onglets, genres, surprise, bannières ══ */}
      <div className="flex-shrink-0 max-w-4xl w-full mx-auto px-4 sm:px-6 pt-safe-8">

        {/* ── En-tête ── */}
        <div className="flex items-start justify-between flex-wrap gap-3 mb-6">
          <div className="min-w-0">
            <button onClick={() => navigate(-1)}
              className="flex items-center gap-1.5 text-sm text-violet-400 hover:text-violet-200 transition-colors mb-2">
              <ChevronLeft size={16} /> Retour
            </button>
            <p className="font-mono text-[11px] tracking-[0.3em] text-violet-400 uppercase mb-1">Basé sur tes goûts</p>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
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
                onClick={() => switchTab(key)}
                className={`relative flex items-center gap-1.5 px-5 py-1.5 rounded-full text-xs font-medium transition-colors duration-200
                  active:scale-95 motion-reduce:transition-none ${
                  activeTab === key
                    ? "text-violet-950 font-semibold"
                    : "text-violet-300 hover:text-violet-100"
                }`}
              >
                {activeTab === key && (
                  <motion.span
                    layoutId="recs-tab-pill"
                    className="absolute inset-0 bg-amber-400 rounded-full shadow-sm"
                    transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-1.5"><Icon size={12} />{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Genres utilisés ──
            Sur mobile, l'encart tient sur une seule ligne : on passe en
            défilement horizontal (flex-nowrap + overflow-x-auto) plutôt que
            de laisser les badges retomber à la ligne. À partir de sm, il y a
            assez de largeur pour repasser en flex-wrap classique. */}
        {displayGenres.length > 0 && (
          <div className="flex flex-nowrap sm:flex-wrap items-center gap-2 mb-5 overflow-x-auto sm:overflow-visible scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0">
            <span className="flex-shrink-0 whitespace-nowrap text-[11px] text-violet-400 font-mono uppercase tracking-wide">Basé sur :</span>
            {displayGenres.map((g) => (
              <span key={g}
                className="flex-shrink-0 whitespace-nowrap px-2.5 py-1 rounded-full bg-amber-400/15 border border-amber-400/30 text-amber-300 text-[11px] font-mono">
                {g}
              </span>
            ))}
          </div>
        )}

        {/* ── Surprends-moi ── */}
        {!loading && !isNoTmdb && !error && (
          <div className="flex justify-center mb-5">
            <button
              onClick={handleSurpriseMe}
              disabled={rolling || !canSurprise}
              title={canSurprise ? undefined : "Pas encore assez de données pour cet onglet"}
              className={`flex items-center gap-2 px-5 py-2 rounded-full border text-xs font-mono uppercase tracking-wide
                transition-all active:scale-95 motion-reduce:transition-none disabled:opacity-40 disabled:cursor-not-allowed ${
                rolling
                  ? "bg-amber-400/20 border-amber-400/40 text-amber-300"
                  : "bg-white/5 border-white/10 text-violet-200 hover:bg-amber-400/10 hover:border-amber-400/30 hover:text-amber-300"
              }`}
            >
              <DiceIcon size={15} className={rolling ? "animate-diceShake" : ""} />
              {rolling ? "Ça tourne…" : "Surprends-moi"}
            </button>
          </div>
        )}

        {/* ── Bannière hors-ligne ── */}
        {isStale && (
          <div className="flex items-center gap-2 mb-4 px-4 py-2.5 rounded-xl bg-amber-400/10 border border-amber-400/20 text-amber-300 text-sm animate-fadeIn">
            <WifiOff size={14} className="flex-shrink-0" />
            <span>Mode hors-ligne — données mises en cache affichées.</span>
          </div>
        )}

        {/* ── Confirmation d'ajout rapide ── */}
        {addedToast && (
          <div className="flex items-center gap-2 mb-4 px-4 py-2.5 rounded-xl bg-emerald-400/10 border border-emerald-400/20 text-emerald-300 text-sm animate-fadeIn">
            <span>✓ Ajouté à ta bibliothèque.</span>
          </div>
        )}

        {/* ── Notice de rafraîchissement sans nouvelles suggestions ── */}
        {refreshNotice && (
          <div className="flex items-center gap-2 mb-4 px-4 py-2.5 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-300 text-sm animate-fadeIn">
            <span>{refreshNotice}</span>
          </div>
        )}
      </div>

      {/* ══ Encart scrollable : uniquement les cartes. Le pull-to-refresh se
          déclenche depuis le haut de CET encart (pas depuis le haut de la
          page) — PullToRefresh détecte lui-même ce conteneur interne via son
          overflow-y-auto et y attache le geste, cf. findScrollableAncestor
          dans PullToRefresh.jsx. ══ */}
      <PullToRefresh onRefresh={handlePullRefresh} className="flex-1 min-h-0 overflow-y-auto">
        <div
          className="max-w-4xl mx-auto px-4 sm:px-6 pb-nav overflow-x-hidden"
          onTouchStart={handleContentTouchStart}
          onTouchEnd={handleContentTouchEnd}
        >

          {/* ── Contenu principal ──
              AnimatePresence + clé sur activeTab : glissement latéral fluide
              au changement d'onglet (swipe ou clic), dans le sens du geste. */}
          <AnimatePresence mode="wait" initial={false} custom={swipeDir}>
            <motion.div
              key={activeTab}
              custom={swipeDir}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: "tween", duration: 0.16, ease: "easeOut" }}
            >
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
                    <RecCard key={`${rec.source}-${rec.id}`} rec={rec} onClick={() => { setSurpriseOpen(false); setSynopsisRec(rec); }} />
                  ))}
                </div>
              )}

              {/* ── Culture Zone ──
                  Bonus éditorial, animes uniquement, visible seulement si le
                  Mode Culture est activé. Ligne scrollable horizontalement,
                  10 titres max, rafraîchissable indépendamment du reste. */}
              {activeTab === "anime" && cultureMode && (cultureZoneRecs.length > 0 || cultureZoneLoading) && (
                <div className="mt-8">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <HeartIcon size={15} className="text-pink-400" />
                      <span className="font-mono text-[11px] text-pink-300 uppercase tracking-wide">
                        Culture Zone
                      </span>
                    </div>
                    <button
                      onClick={handleCultureZoneRefresh}
                      disabled={cultureZoneRefreshing || cultureZoneLoading}
                      className="p-1.5 rounded-full text-pink-300/70 hover:text-pink-300 hover:bg-pink-400/10 transition-colors active:scale-95 motion-reduce:transition-none disabled:opacity-40"
                      aria-label="Rafraîchir la Culture Zone"
                    >
                      <RefreshCw size={13} className={cultureZoneRefreshing ? "animate-spin" : ""} />
                    </button>
                  </div>

                  {cultureZoneLoading ? (
                    <div className="flex items-center justify-center py-10">
                      <Loader2 size={20} className="animate-spin text-pink-400/70" />
                    </div>
                  ) : (
                    <div className="flex flex-nowrap gap-2 sm:gap-3 overflow-x-auto scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0 pb-1">
                      {cultureZoneRecs
                        .filter((rec) => !isInLibrary(rec))
                        .map((rec) => (
                          <CultureZoneCard
                            key={`cz-${rec.source}-${rec.id}`}
                            rec={rec}
                            onClick={() => { setSurpriseOpen(false); setSynopsisRec(rec); }}
                          />
                        ))}
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>

        </div>
      </PullToRefresh>

      <AnimatePresence>
        {synopsisRec && (
          <SynopsisModal
            key="synopsis"
            rec={synopsisRec}
            onClose={() => { setSynopsisRec(null); setSurpriseOpen(false); }}
            onAdd={handleAdd}
            adding={adding === synopsisRec.id}
            alreadyInLib={isInLibrary(synopsisRec)}
            surprise={surpriseOpen}
          />
        )}
      </AnimatePresence>
    </div>
  );
}