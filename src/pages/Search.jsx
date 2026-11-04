import { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate }        from "react-router-dom";
import {
  ChevronLeft, Search, Loader2, MonitorPlay, Tv, Clapperboard,
  X, Plus, Check, SearchX, PencilLine,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { EyePlus }            from "../components/common/icons";
import { TopBar }             from "../components/common/TopBar";
import { PageBanner }         from "../components/common/PageBanner";
import { useAnime }           from "../hooks/useAnime";
import { useSeries }          from "../hooks/useSeries";
import { useMovies }          from "../hooks/useMovies";
import { importResult }       from "../api";
import { useLibrary }         from "../context/LibraryContext";
import { TitleFormModal }     from "../components/Modal/TitleFormModal";
import { SynopsisModal }      from "../components/common/SynopsisModal";
import { FORMAT_TO_CATEGORY, emptyForm } from "../utils/entry";

// ── Onglets (mêmes icônes que la recherche de l'accueil) ──────────────────────
const TABS = [
  { key: "anime", label: "Animes", icon: MonitorPlay,  source: "AniList", placeholder: "Rechercher un anime",
    examples: ["Fullmetal Alchemist", "Frieren", "Blue Lock"] },
  { key: "serie", label: "Séries", icon: Tv,           source: "TVmaze",  placeholder: "Rechercher une série",
    examples: ["Breaking Bad", "Severance", "The Bear"] },
  { key: "film",  label: "Films",  icon: Clapperboard, source: "TMDB",    placeholder: "Rechercher un film",
    examples: ["Spider-Man 2002", "Princesse Mononoké", "Interstellar"] },
];

// ── Badge de format (animes uniquement : TVmaze/TMDB n'en fournissent pas) ────
const FORMAT_BADGE = {
  tv:    { label: "Série TV", className: "bg-sky-500/15 text-sky-300" },
  ova:   { label: "OAV",      className: "bg-purple-500/15 text-purple-300" },
  movie: { label: "Film",     className: "bg-amber-500/15 text-amber-300" },
};

const keyOf = (r) => `${r.source}-${r.id}`;

// Marque toutes les saisons comme vues et passe l'entrée en « Terminé »
function asSeen(data) {
  return {
    ...data,
    seasons: data.seasons.map((s) => ({ ...s, watchedEpisodes: s.totalEpisodes ?? 1 })),
    status: "termine",
  };
}

// ── Convertit un résultat de recherche au format attendu par SynopsisModal ────
function toRec(r) {
  return {
    source:       r.source,
    id:           r.id,
    title:        r.title,
    image:        r.image        ?? null,
    year:         r.year         ?? null,
    score:        r.averageScore ?? r.score ?? 0,
    episodes:     r.episodes     ?? null,
    genres:       r.genres       ?? [],
    description:  r.overview     ?? r.description ?? null,
    format:       r.format       ?? null,
    // Champs utiles pour importResult (conservés tels quels)
    genreIds:     r.genreIds     ?? [],
    titleRomaji:  r.titleRomaji  ?? null,
    titleEnglish: r.titleEnglish ?? null,
  };
}

// ── Squelette de chargement (même gabarit qu'une ligne de résultat) ───────────
function SkeletonResult() {
  return (
    <div className="flex gap-3 p-2.5 rounded-2xl bg-violet-900/30 border border-white/5 animate-pulse motion-reduce:animate-none">
      <div className="w-[72px] h-[104px] rounded-xl bg-white/10 flex-shrink-0" />
      <div className="flex-1 pt-1 space-y-2.5">
        <div className="h-3.5 bg-white/10 rounded w-3/4" />
        <div className="h-3 bg-white/10 rounded w-1/3" />
        <div className="h-9 bg-white/10 rounded-full w-44 mt-4" />
      </div>
    </div>
  );
}

// ── Ligne de résultat ─────────────────────────────────────────────────────────
function ResultRow({ r, tab, libState, busy, error, onOpen, onQuickAdd }) {
  const key       = keyOf(r);
  const format    = tab.key === "anime" && r.format ? FORMAT_BADGE[FORMAT_TO_CATEGORY[r.format] ?? "tv"] : null;
  const isBusy    = busy?.key === key;
  const subtitle  = r.titleRomaji && r.titleRomaji !== r.title ? r.titleRomaji : null;
  const genres    = (r.genres ?? []).slice(0, 3).join(", ");
  const TabIcon   = tab.icon;

  const actionBase =
    "h-9 inline-flex items-center gap-1.5 pl-3 pr-3.5 rounded-full border text-xs font-semibold " +
    "active:scale-95 transition-all motion-reduce:transition-none disabled:opacity-60 disabled:active:scale-100 " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70";

  return (
    <li className="flex gap-3 p-2.5 rounded-2xl bg-violet-900/30 border border-white/10 hover:border-white/20 transition-colors motion-reduce:transition-none">
      {/* Affiche (double de la zone de titre : hors tabulation) */}
      <button type="button" onClick={() => onOpen(r)} tabIndex={-1} aria-hidden="true"
        className="flex-shrink-0 w-[72px] h-[104px] rounded-xl overflow-hidden bg-white/10 shadow-lg shadow-black/30 active:scale-[0.98] transition-transform motion-reduce:transition-none">
        {r.image
          ? <img src={r.image} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
          : <span className="w-full h-full flex items-center justify-center"><TabIcon size={22} className="text-violet-600" /></span>}
      </button>

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Infos : ouvre la fiche synopsis */}
        <button type="button" onClick={() => onOpen(r)}
          className="text-left min-w-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70">
          <span className="block text-[15px] font-semibold text-violet-50 leading-snug line-clamp-2"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            {r.title}
          </span>
          {subtitle && <span className="block text-[11px] text-violet-400 truncate mt-0.5">{subtitle}</span>}
          <span className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className="text-xs text-violet-300 font-mono">{r.year || "Année inconnue"}</span>
            {format && (
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${format.className}`}>{format.label}</span>
            )}
            {r.episodes ? <span className="text-xs text-violet-400">{r.episodes} ép.</span> : null}
          </span>
          {genres && <span className="block text-[11px] text-violet-500 truncate mt-1">{genres}</span>}
        </button>

        {/* Actions */}
        <div className="mt-auto pt-2.5">
          {libState ? (
            <motion.p
              initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
              className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-full border text-xs font-semibold ${
                libState.fresh
                  ? "bg-teal-500/15 border-teal-500/30 text-teal-300"
                  : "bg-white/5 border-white/10 text-violet-300"}`}
            >
              <Check size={14} />
              {libState.label}
            </motion.p>
          ) : (
            <div className="flex items-center gap-2">
              <button type="button" onClick={(e) => onQuickAdd(e, r, "a-voir")} disabled={!!busy}
                className={`${actionBase} bg-amber-400/15 border-amber-400/30 text-amber-300 hover:bg-amber-400/25`}>
                {isBusy && busy.status === "a-voir" ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                À voir
              </button>
              <button type="button" onClick={(e) => onQuickAdd(e, r, "termine")} disabled={!!busy}
                className={`${actionBase} bg-white/5 border-white/10 text-violet-200 hover:bg-teal-500/15 hover:border-teal-500/30 hover:text-teal-300`}>
                {isBusy && busy.status === "termine" ? <Loader2 size={14} className="animate-spin" /> : <EyePlus size={14} />}
                Déjà vu
              </button>
            </div>
          )}
          {error && <p role="alert" className="text-[11px] text-rose-400 mt-1.5">{error}</p>}
        </div>
      </div>
    </li>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────
export function SearchPage() {
  const navigate    = useNavigate();
  const inputRef    = useRef(null);
  const sentinelRef = useRef(null);
  const errorTimer  = useRef(null);
  const { entries, saveEntry, findDuplicate } = useLibrary();

  const [type,           setType]           = useState("anime");
  const [query,          setQuery]          = useState("");
  const [focused,        setFocused]        = useState(false);
  const [stuck,          setStuck]          = useState(false);   // barre collée en haut
  const [selectedResult, setSelectedResult] = useState(null);    // → SynopsisModal
  const [prefill,        setPrefill]        = useState(null);    // → TitleFormModal
  const [importing,      setImporting]      = useState(false);   // spinner dans SynopsisModal
  const [busy,           setBusy]           = useState(null);    // { key, status } en cours d'ajout rapide
  const [added,          setAdded]          = useState({});      // clé → "a-voir" | "termine" (ajoutés ici)
  const [quickError,     setQuickError]     = useState(null);

  // Hooks de recherche (seul le type actif est interrogé)
  const anime  = useAnime (type === "anime" ? query : "");
  const series = useSeries(type === "serie" ? query : "");
  const movies = useMovies(type === "film"  ? query : "");

  const { results, searching, error } =
    type === "anime" ? anime :
    type === "serie" ? series :
    movies;

  const tab      = TABS.find((t) => t.key === type);
  const TabIcon  = tab.icon;
  const trimmed  = query.trim();
  const isIdle   = trimmed.length < 2;

  // Autofocus à l'ouverture + après changement d'onglet
  useEffect(() => { inputRef.current?.focus(); }, [type]);

  // Nettoyage du timer d'erreur au démontage
  useEffect(() => () => clearTimeout(errorTimer.current), []);

  // Détecte quand la barre de recherche est collée en haut (fond + flou)
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !("IntersectionObserver" in window)) return undefined;
    const io = new IntersectionObserver(
      ([entry]) => setStuck(!entry.isIntersecting && entry.boundingClientRect.top < 0)
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Titres déjà présents dans la bibliothèque (ou ajoutés depuis cette page)
  const libStates = useMemo(() => {
    const map = {};
    for (const r of results) {
      const key = keyOf(r);
      if (added[key]) {
        map[key] = { fresh: true, label: added[key] === "termine" ? "Marqué comme vu" : "Ajouté à voir" };
      } else if (findDuplicate(r.title, null, r.format === "MOVIE" ? "movie" : undefined)) {
        map[key] = { fresh: false, label: "Dans ta bibliothèque" };
      }
    }
    return map;
    // `entries` : recalcule quand la bibliothèque change
  }, [results, added, entries, findDuplicate]);

  function flashError(key, message) {
    setQuickError({ key, message });
    clearTimeout(errorTimer.current);
    errorTimer.current = setTimeout(() => setQuickError(null), 2500);
  }

  // ── Clic sur un résultat → ouvre la SynopsisModal ─────────────────────────
  function handleSelect(result) {
    setSelectedResult(result);
  }

  // ── Depuis SynopsisModal : "Ajouter" → TitleFormModal ─────────────────────
  async function handleSynopsisAdd(rec) {
    setImporting(true);
    try {
      const data = await importResult(rec);
      setSelectedResult(null);
      setPrefill(data);
    } catch {
      // silencieux : l'utilisateur peut réessayer
    } finally {
      setImporting(false);
    }
  }

  // ── Depuis SynopsisModal : "Marquer comme vu" → sauvegarde directe ────────
  async function handleSynopsisAddSeen(rec) {
    setImporting(true);
    try {
      const data = await importResult(rec);
      saveEntry(asSeen(data), null);
      setAdded((prev) => ({ ...prev, [keyOf(rec)]: "termine" }));
      setSelectedResult(null);
    } catch {
      // silencieux
    } finally {
      setImporting(false);
    }
  }

  // ── Ajout rapide : "À voir" (a-voir) ou "Déjà vu" (termine) ───────────────
  async function handleQuickAdd(e, result, status) {
    e.stopPropagation();
    const key = keyOf(result);
    if (busy || added[key]) return;

    if (findDuplicate(result.title, null, result.format === "MOVIE" ? "movie" : undefined)) {
      flashError(key, "Déjà dans ta bibliothèque");
      return;
    }

    setBusy({ key, status });
    setQuickError(null);
    try {
      const data = await importResult(result);
      saveEntry(status === "termine" ? asSeen(data) : data, null);
      setAdded((prev) => ({ ...prev, [key]: status }));
    } catch {
      flashError(key, "Échec de l'ajout, réessaie");
    } finally {
      setBusy(null);
    }
  }

  function handleTypeChange(key) {
    setType(key);
    setQuery("");
    setSelectedResult(null);
    setPrefill(null);
  }

  // ── Saisie manuelle : ouvre le formulaire pré-rempli avec la recherche ────
  function openManual() {
    const isFilm = type === "film";
    setPrefill({
      ...emptyForm,
      title:    trimmed,
      type:     type === "anime" ? "anime" : "serie",
      category: isFilm ? "movie" : "tv",
      seasons:  [{ number: 1, format: isFilm ? "MOVIE" : "TV", totalEpisodes: isFilm ? 1 : null, watchedEpisodes: 0, rating: 0 }],
    });
  }

  // ── Rec pour SynopsisModal ────────────────────────────────────────────────
  const selectedRec = selectedResult ? toRec(selectedResult) : null;
  const selectedKey = selectedResult ? keyOf(selectedResult) : null;
  const isAlreadyInLib = selectedKey ? !!libStates[selectedKey] : false;

  const noResult = !!error && /^Aucun/.test(error);

  return (
    <div className="relative min-h-[100dvh] overflow-x-clip bg-violet-950 text-violet-50"
      style={{ fontFamily: "'Inter', sans-serif" }}>
      <PageBanner height="clamp(200px, 28vw, 290px)" />

      {/* Voile sous l'encoche iOS quand la barre est collée */}
      <div aria-hidden="true"
        className={`fixed inset-x-0 top-0 z-30 pointer-events-none bg-violet-950/90 backdrop-blur-xl transition-opacity duration-200 motion-reduce:transition-none ${stuck ? "opacity-100" : "opacity-0"}`}
        style={{ height: "env(safe-area-inset-top)" }} />

      <div className="relative z-10 max-w-2xl mx-auto px-4 sm:px-6 pt-safe-8 pb-nav">

        {/* ── En-tête (même structure que les autres pages) ─────────────── */}
        <header className="flex items-start justify-between gap-3 mb-5">
          <div className="min-w-0">
            <button onClick={() => navigate(-1)}
              className="flex items-center gap-1.5 text-sm text-violet-300 hover:text-violet-100 [text-shadow:0_1px_8px_rgba(20,8,50,0.9)] transition-colors mb-2">
              <ChevronLeft size={16} /> Retour
            </button>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight [text-shadow:0_2px_14px_rgba(20,8,50,0.9)]"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Ajouter un titre
            </h1>
            <p className="text-sm text-violet-200 mt-1 [text-shadow:0_1px_8px_rgba(20,8,50,0.9)]">
              Cherche, puis ajoute-le d'un geste.
            </p>
          </div>
          <TopBar />
        </header>

        {/* Repère pour détecter le collage de la barre */}
        <div ref={sentinelRef} aria-hidden="true" className="h-px" />

        {/* ── Recherche + type : reste visible pendant le défilement ─────── */}
        <div
          className={`sticky top-[env(safe-area-inset-top)] z-30 -mx-4 sm:-mx-6 px-4 sm:px-6 pt-2 pb-3 mb-3
            before:content-[''] before:absolute before:inset-y-0 before:left-1/2 before:w-screen before:-translate-x-1/2 before:-z-10
            before:bg-violet-950/90 before:backdrop-blur-xl before:border-b before:border-white/5
            before:transition-opacity before:duration-200 motion-reduce:before:transition-none
            ${stuck ? "before:opacity-100" : "before:opacity-0"}`}
        >
          <div role="search"
            className={`flex items-center gap-2 pl-4 pr-2 h-12 rounded-2xl border mb-3 transition-colors duration-200 motion-reduce:transition-none ${
              focused
                ? "bg-violet-900/70 border-violet-500/60 shadow-[0_0_0_3px_rgba(139,92,246,0.15)]"
                : "bg-violet-900/50 border-white/10"}`}>
            <Search size={17} className={focused || query ? "text-violet-200" : "text-violet-400"} />
            <input
              ref={inputRef}
              type="text"
              inputMode="search"
              enterKeyHint="search"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              aria-label={tab.placeholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onKeyDown={(e) => { if (e.key === "Escape") { setQuery(""); } }}
              placeholder={tab.placeholder}
              className="flex-1 min-w-0 bg-transparent text-sm text-violet-50 placeholder-violet-400 focus:outline-none"
            />
            {searching && !isIdle && <Loader2 size={16} className="text-violet-400 animate-spin motion-reduce:animate-none mr-1" />}
            {query && (
              <button type="button" onClick={() => { setQuery(""); inputRef.current?.focus(); }} aria-label="Effacer la recherche"
                className="h-8 w-8 flex items-center justify-center rounded-full text-violet-300 hover:bg-white/10 active:scale-90 transition-all motion-reduce:transition-none">
                <X size={15} />
              </button>
            )}
          </div>

          <div role="tablist" aria-label="Type de titre"
            className="flex rounded-2xl bg-violet-900/50 border border-white/10 p-0.5">
            {TABS.map(({ key, label, icon: Icon }) => (
              <button key={key} type="button" role="tab" aria-selected={type === key}
                onClick={() => handleTypeChange(key)}
                className={`relative flex-1 flex items-center justify-center gap-1.5 h-9 rounded-[10px] text-xs font-medium active:scale-95 transition-colors motion-reduce:transition-none ${
                  type === key ? "text-violet-950 font-semibold" : "text-violet-200 hover:text-white"}`}>
                {type === key && (
                  <motion.span layoutId="search-type-pill"
                    className="absolute inset-0 bg-amber-400 rounded-[10px] shadow-md shadow-amber-500/20"
                    transition={{ type: "spring", stiffness: 500, damping: 35 }} />
                )}
                <span className="relative z-10 flex items-center gap-1.5"><Icon size={14} />{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Contenu : un seul état à la fois ───────────────────────────── */}

        {/* Accueil : aide + suggestions */}
        {isIdle && (
          <div className="text-center pt-10 pb-6">
            <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-violet-900/50 border border-white/10 flex items-center justify-center">
              <TabIcon size={26} className="text-violet-300" />
            </div>
            <h2 className="text-lg font-bold text-violet-50" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Que veux-tu ajouter ?
            </h2>
            <p className="text-sm text-violet-300 mt-1">
              {trimmed.length === 1
                ? "Encore un caractère pour lancer la recherche."
                : `Tape au moins 2 caractères. Résultats fournis par ${tab.source}.`}
            </p>
            <div className="flex flex-wrap justify-center gap-2 mt-5">
              {tab.examples.map((ex) => (
                <button key={ex} type="button"
                  onClick={() => { setQuery(ex); inputRef.current?.focus(); }}
                  className="px-3.5 h-9 rounded-full bg-white/5 border border-white/10 text-sm text-violet-100 hover:bg-white/10 active:scale-95 transition-all motion-reduce:transition-none">
                  {ex}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Résultats */}
        {!isIdle && results.length > 0 && (
          <>
            <p aria-live="polite" className="text-xs text-violet-300 mb-3 px-1">
              {results.length} résultat{results.length > 1 ? "s" : ""} sur {tab.source}
            </p>

            <ul aria-busy={searching}
              className={`space-y-2.5 transition-opacity duration-200 motion-reduce:transition-none ${searching ? "opacity-50" : "opacity-100"}`}>
              {results.map((r) => {
                const key = keyOf(r);
                return (
                  <ResultRow
                    key={key}
                    r={r}
                    tab={tab}
                    libState={libStates[key]}
                    busy={busy}
                    error={quickError?.key === key ? quickError.message : null}
                    onOpen={handleSelect}
                    onQuickAdd={handleQuickAdd}
                  />
                );
              })}
            </ul>

            {/* Pas trouvé ? saisie manuelle */}
            <div className="mt-6 rounded-2xl border border-dashed border-white/15 p-4 flex items-center justify-between gap-3">
              <p className="text-sm text-violet-300">Tu ne trouves pas ton titre ?</p>
              <button type="button" onClick={openManual}
                className="flex-shrink-0 h-9 inline-flex items-center gap-1.5 px-3.5 rounded-full bg-white/5 border border-white/10 text-xs font-semibold text-violet-100 hover:bg-white/10 active:scale-95 transition-all motion-reduce:transition-none">
                <PencilLine size={14} /> Saisir à la main
              </button>
            </div>

            <p className="text-[11px] text-violet-500 text-center mt-5">
              Données fournies par {tab.source}. Saisons et épisodes importés automatiquement.
            </p>
          </>
        )}

        {/* Chargement (aucun résultat précédent à afficher) */}
        {!isIdle && results.length === 0 && searching && (
          <div className="space-y-2.5" aria-busy="true" aria-label="Chargement des résultats">
            {[...Array(5)].map((_, i) => <SkeletonResult key={i} />)}
          </div>
        )}

        {/* Aucun résultat / recherche indisponible */}
        {!isIdle && results.length === 0 && !searching && error && (
          <div className="text-center pt-10 pb-6">
            <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-violet-900/50 border border-white/10 flex items-center justify-center">
              <SearchX size={26} className="text-violet-300" />
            </div>
            <h2 className="text-lg font-bold text-violet-50" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              {noResult ? `Aucun résultat pour « ${trimmed} »` : "Recherche indisponible"}
            </h2>
            <p className="text-sm text-violet-300 mt-1 max-w-xs mx-auto">
              {noResult ? "Vérifie l'orthographe ou essaie le titre original." : error}
            </p>
            <button type="button" onClick={openManual}
              className="mt-5 h-10 inline-flex items-center gap-2 px-4 rounded-full bg-amber-400/15 border border-amber-400/30 text-sm font-semibold text-amber-300 hover:bg-amber-400/25 active:scale-95 transition-all motion-reduce:transition-none">
              <PencilLine size={15} /> Saisir à la main
            </button>
          </div>
        )}
      </div>

      <AnimatePresence>
        {/* ── SynopsisModal : détails + boutons Ajouter / Vu ─────────────── */}
        {selectedRec && (
          <SynopsisModal
            key="synopsis"
            rec={selectedRec}
            onClose={() => setSelectedResult(null)}
            onAdd={handleSynopsisAdd}
            onAddSeen={handleSynopsisAddSeen}
            adding={importing}
            alreadyInLib={isAlreadyInLib}
          />
        )}

        {/* ── TitleFormModal : confirmation/édition après import ou saisie ── */}
        {prefill && (
          <TitleFormModal
            key="title-form"
            editingEntry={prefill}
            onClose={() => setPrefill(null)}
            onSave={() => navigate("/")}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
