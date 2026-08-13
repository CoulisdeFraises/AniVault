import { useState, useRef, useEffect } from "react";
import { useNavigate }        from "react-router-dom";
import { ArrowLeft, Search, Loader2, Film, Tv, Clapperboard, X, Plus, Check, Eye } from "lucide-react";
import { EyePlus } from "../components/common/icons";
import { mdiEyePlus } from '@mdi/js';
import { useAnime }           from "../hooks/useAnime";
import { useSeries }          from "../hooks/useSeries";
import { useMovies }          from "../hooks/useMovies";
import { importResult }       from "../api";
import { useLibrary }         from "../context/LibraryContext";
import { TitleFormModal }     from "../components/Modal/TitleFormModal";
import { SynopsisModal }      from "../components/common/SynopsisModal";
import { AnimatePresence }    from "motion/react";
import { FORMAT_TO_CATEGORY, CATEGORY_LABELS, CATEGORY_ICONS } from "../utils/entry";

// ── Couleurs badges format ────────────────────────────────────────────────────
const FORMAT_BADGE_COLOR = {
  tv:    "bg-sky-500/20 text-sky-300",
  ova:   "bg-purple-500/20 text-purple-300",
  movie: "bg-amber-500/20 text-amber-300",
};

const TABS = [
  { key: "anime", label: "Anime",  icon: Film,        source: "AniList" },
  { key: "serie", label: "Série",  icon: Tv,           source: "TVmaze"  },
  { key: "film",  label: "Film",   icon: Clapperboard, source: "TMDB"    },
];

// ── Convertit un résultat de recherche au format attendu par SynopsisModal ────
function toRec(r) {
  return {
    source:      r.source,
    id:          r.id,
    title:       r.title,
    image:       r.image        ?? null,
    year:        r.year         ?? null,
    score:       r.averageScore ?? r.score ?? 0,
    episodes:    r.episodes     ?? null,
    genres:      r.genres       ?? [],
    description: r.overview     ?? r.description ?? null,
    format:      r.format       ?? null,
    // Champs utiles pour importResult (conservés tels quels)
    genreIds:    r.genreIds     ?? [],
    titleRomaji: r.titleRomaji  ?? null,
    titleEnglish: r.titleEnglish ?? null,
  };
}

// ── Squelette de chargement ───────────────────────────────────────────────────
function SkeletonResult() {
  return (
    <div className="flex items-center gap-3 p-3 rounded-2xl animate-pulse">
      <div className="w-14 h-20 rounded-xl bg-white/10 flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 bg-white/10 rounded w-3/4" />
        <div className="h-3 bg-white/10 rounded w-1/4" />
      </div>
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────
export function SearchPage() {
  const navigate   = useNavigate();
  const inputRef   = useRef(null);
  const { saveEntry, findDuplicate } = useLibrary();

  const [type,           setType]           = useState("anime");
  const [query,          setQuery]          = useState("");
  const [selectedResult, setSelectedResult] = useState(null);  // → SynopsisModal
  const [prefill,        setPrefill]        = useState(null);  // → TitleFormModal
  const [importing,      setImporting]      = useState(false); // spinner dans SynopsisModal
  const [quickAdding,    setQuickAdding]    = useState(null);  // clé en cours d'ajout rapide
  const [quickAdded,     setQuickAdded]     = useState(() => new Set());
  const [quickError,     setQuickError]     = useState(null);

  // Hooks de recherche (seul le type actif est interrogé)
  const anime  = useAnime (type === "anime" ? query : "");
  const series = useSeries(type === "serie" ? query : "");
  const movies = useMovies(type === "film"  ? query : "");

  const { results, searching, error } =
    type === "anime" ? anime :
    type === "serie" ? series :
    movies;

  const activeTab = TABS.find((t) => t.key === type);

  // Autofocus à l'ouverture + après changement d'onglet
  useEffect(() => { inputRef.current?.focus(); }, [type]);

  // ── Clic sur un résultat → ouvre la SynopsisModal ─────────────────────────
  function handleSelect(result) {
    setSelectedResult(result);
  }

  // ── Depuis SynopsisModal : "Ajouter à ma liste" → TitleFormModal ──────────
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
      const seenSeasons = data.seasons.map((s) => ({
        ...s,
        watchedEpisodes: s.totalEpisodes ?? 1,
      }));
      saveEntry({ ...data, seasons: seenSeasons, status: "termine" }, null);
      // Marque comme ajouté pour les boutons de la liste
      setQuickAdded((prev) => new Set(prev).add(`${rec.source}-${rec.id}`));
      setSelectedResult(null);
    } catch {
      // silencieux
    } finally {
      setImporting(false);
    }
  }

  // ── Ajout rapide "+" → À voir ─────────────────────────────────────────────
  async function handleQuickAdd(e, result) {
    e.stopPropagation();
    const key = `${result.source}-${result.id}`;
    if (quickAdding || quickAdded.has(key)) return;

    const dup = findDuplicate(result.title);
    if (dup) {
      setQuickError({ key, message: "Déjà dans ta bibliothèque" });
      setTimeout(() => setQuickError(null), 2500);
      return;
    }

    setQuickAdding(key);
    setQuickError(null);
    try {
      const data = await importResult(result);
      saveEntry(data, null);
      setQuickAdded((prev) => new Set(prev).add(key));
    } catch {
      setQuickError({ key, message: "Échec de l'ajout — réessaie" });
      setTimeout(() => setQuickError(null), 2500);
    } finally {
      setQuickAdding(null);
    }
  }

  // ── Ajout rapide "👁" → Terminé (tous les épisodes cochés) ───────────────
  async function handleQuickAddSeen(e, result) {
    e.stopPropagation();
    const key     = `${result.source}-${result.id}`;
    const seenKey = `seen-${key}`;
    if (quickAdding || quickAdded.has(key)) return;

    const dup = findDuplicate(result.title);
    if (dup) {
      setQuickError({ key, message: "Déjà dans ta bibliothèque" });
      setTimeout(() => setQuickError(null), 2500);
      return;
    }

    setQuickAdding(seenKey);
    setQuickError(null);
    try {
      const data = await importResult(result);
      const seenSeasons = data.seasons.map((s) => ({
        ...s,
        watchedEpisodes: s.totalEpisodes ?? 1,
      }));
      saveEntry({ ...data, seasons: seenSeasons, status: "termine" }, null);
      setQuickAdded((prev) => new Set(prev).add(key));
    } catch {
      setQuickError({ key, message: "Échec de l'ajout — réessaie" });
      setTimeout(() => setQuickError(null), 2500);
    } finally {
      setQuickAdding(null);
    }
  }

  function handleTypeChange(key) {
    setType(key);
    setQuery("");
    setSelectedResult(null);
    setPrefill(null);
  }

  // ── Rec pour SynopsisModal ────────────────────────────────────────────────
  const selectedRec = selectedResult ? toRec(selectedResult) : null;
  const selectedKey = selectedResult ? `${selectedResult.source}-${selectedResult.id}` : null;
  const isAlreadyInLib =
    selectedResult
      ? (!!findDuplicate(selectedResult.title) || quickAdded.has(selectedKey))
      : false;

  return (
    <div className="min-h-screen bg-violet-950 text-violet-50"
      style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* ── Barre supérieure ─────────────────────────────────────────────── */}
      <div
        className="sticky top-0 z-40 bg-violet-950/95 backdrop-blur-md border-b border-white/5 px-4 sm:px-6"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))", paddingBottom: "0.75rem" }}
      >
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-xl hover:bg-white/10 text-violet-400 hover:text-violet-200 active:scale-95 transition-all"
            aria-label="Retour"
          >
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-lg font-bold tracking-tight"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Ajouter un titre
          </h1>
        </div>
      </div>

      {/* ── Contenu ──────────────────────────────────────────────────────── */}
      <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-6 pb-nav">

        {/* Onglets type */}
        <div className="flex gap-2 mb-5">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => handleTypeChange(key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95 motion-reduce:transition-none
                ${type === key
                  ? "bg-amber-400 text-violet-950 shadow-md"
                  : "bg-white/5 text-violet-300 hover:bg-white/10 hover:text-violet-100 border border-white/10"
                }`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        {/* Input de recherche */}
        <div className="relative mb-6">
          <Search size={16}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-violet-500 pointer-events-none" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              type === "anime" ? "Chercher un anime… (ex. Fullmetal Alchemist)" :
              type === "serie" ? "Chercher une série… (ex. Breaking Bad)" :
                                 "Chercher un film… (ex. Spider-Man 2002)"
            }
            className="w-full pl-11 pr-10 py-3.5 rounded-2xl bg-violet-900/40 border border-white/10 text-violet-50 placeholder-violet-500 focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all"
          />
          {query && (
            <button
              onClick={() => { setQuery(""); inputRef.current?.focus(); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-violet-400 hover:text-violet-200 hover:bg-white/10 transition-all"
              aria-label="Effacer"
            >
              <X size={14} />
            </button>
          )}
          {searching && (
            <Loader2 size={15} className="absolute right-4 top-1/2 -translate-y-1/2 text-violet-500 animate-spin" />
          )}
        </div>

        {/* ── États ──────────────────────────────────────────────────────── */}

        {/* Chargement des résultats */}
        {searching && (
          <div className="space-y-1">
            {[...Array(6)].map((_, i) => <SkeletonResult key={i} />)}
          </div>
        )}

        {/* Erreur */}
        {!searching && error && (
          <div className="text-center py-16">
            <Search size={40} className="mx-auto mb-3 text-violet-700" />
            <p className="text-violet-400 text-sm">{error}</p>
          </div>
        )}

        {/* Prompt initial */}
        {!searching && !error && query.trim().length < 2 && (
          <div className="text-center py-16">
            <activeTab.icon size={44} className="mx-auto mb-3 text-violet-800" />
            <p className="text-violet-500 text-sm">
              Tape au moins 2 caractères pour lancer la recherche
            </p>
            <p className="text-violet-600 text-xs mt-1">Source : {activeTab.source}</p>
          </div>
        )}

        {/* Résultats */}
        {!searching && results.length > 0 && (
          <>
            <p className="text-[11px] text-violet-500 uppercase tracking-wider mb-3 font-medium">
              {results.length} résultat{results.length > 1 ? "s" : ""} · {activeTab.source}
            </p>

            {/* Légende des boutons d'action */}
            <div className="flex items-center gap-3 mb-3 px-1">
              <span className="text-[10px] text-violet-600 font-mono ml-auto flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <Plus size={10} className="text-violet-500" /> À voir
                </span>
                <span className="flex items-center gap-1">
                  <Eye size={10} className="text-teal-500" /> Vu
                </span>
              </span>
            </div>

            <ul className="space-y-1.5">
              {results.map((r) => {
                const cat      = FORMAT_TO_CATEGORY[r.format] ?? "tv";
                const badge    = FORMAT_BADGE_COLOR[cat] ?? FORMAT_BADGE_COLOR.tv;
                const key      = `${r.source}-${r.id}`;
                const seenKey  = `seen-${key}`;
                const isAdding     = quickAdding === key;
                const isSeenAdding = quickAdding === seenKey;
                const isAdded      = quickAdded.has(key);
                const rowError     = quickError?.key === key ? quickError.message : null;

                return (
                  <li key={key}>
                    <div className="w-full flex items-center gap-2 p-2 rounded-2xl hover:bg-white/[0.05] border border-transparent hover:border-white/10 transition-all group">

                      {/* Zone cliquable → SynopsisModal */}
                      <button
                        type="button"
                        onClick={() => handleSelect(r)}
                        className="flex-1 min-w-0 flex items-center gap-3 p-1 text-left active:scale-[0.99] motion-reduce:transition-none"
                      >
                        {/* Poster */}
                        {r.image
                          ? <img
                              src={r.image} alt=""
                              className="w-14 h-20 object-cover rounded-xl flex-shrink-0 shadow-lg group-hover:shadow-violet-900/40"
                            />
                          : <div className="w-14 h-20 rounded-xl bg-white/10 flex-shrink-0 flex items-center justify-center">
                              <activeTab.icon size={20} className="text-violet-600" />
                            </div>
                        }

                        {/* Infos */}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-violet-50 truncate leading-snug">
                            {r.title}
                          </p>
                          {r.titleRomaji && r.titleRomaji !== r.title && (
                            <p className="text-[11px] text-violet-400 truncate">{r.titleRomaji}</p>
                          )}
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="text-xs text-violet-400 font-mono">{r.year || "—"}</span>
                            {r.format && (
                              <span className={`font-mono text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded-full ${badge}`}>
                                {CATEGORY_ICONS[cat]} {CATEGORY_LABELS[cat]}
                              </span>
                            )}
                          </div>
                          {rowError && (
                            <p className="text-[10px] text-rose-400 mt-1">{rowError}</p>
                          )}
                        </div>
                      </button>

                      {/* ── Boutons d'action rapide ── */}
                      <div className="flex items-center gap-1.5 flex-shrink-0">

                        {/* 👁 Ajout rapide comme "Vu" (terminé) */}
                        <button
                          type="button"
                          onClick={(e) => handleQuickAddSeen(e, r)}
                          disabled={isAdding || isSeenAdding || isAdded}
                          aria-label="Marquer comme vu"
                          title="Ajouter comme vu"
                          className={`w-9 h-9 rounded-full flex items-center justify-center border transition-all active:scale-90 motion-reduce:transition-none disabled:active:scale-100 ${
                            isAdded
                              ? "bg-teal-500/20 border-teal-500/30 text-teal-300"
                              : "bg-white/5 border-white/10 text-violet-500 hover:bg-teal-500/15 hover:border-teal-500/30 hover:text-teal-300"
                          }`}
                        >
                          {isSeenAdding
                            ? <Loader2 size={14} className="animate-spin" />
                            : isAdded
                              ? <Check size={14} className="text-teal-300" />
                              : <EyePlus size={14} />}
                        </button>

                        {/* + Ajout rapide "À voir" */}
                        <button
                          type="button"
                          onClick={(e) => handleQuickAdd(e, r)}
                          disabled={isAdding || isSeenAdding || isAdded}
                          aria-label={isAdded ? "Déjà ajouté" : "Ajouter à voir"}
                          title={isAdded ? "Ajouté" : "Ajouter à voir"}
                          className={`w-9 h-9 rounded-full flex items-center justify-center border transition-all active:scale-90 motion-reduce:transition-none disabled:active:scale-100 ${
                            isAdded
                              ? "bg-teal-500/20 border-teal-500/30 text-teal-300"
                              : "bg-white/5 border-white/10 text-violet-400 hover:bg-amber-400/15 hover:border-amber-400/30 hover:text-amber-300"
                          }`}
                        >
                          {isAdding
                            ? <Loader2 size={14} className="animate-spin" />
                            : isAdded
                              ? <Check size={14} />
                              : <Plus size={14} />}
                        </button>

                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            <p className="text-[10px] text-violet-600 text-center mt-6">
              Données fournies par {activeTab.source} · Saisons et épisodes importés automatiquement
            </p>
          </>
        )}
      </div>

      <AnimatePresence>
        {/* ── SynopsisModal — détails + boutons Ajouter / Vu ──────────────── */}
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

        {/* ── TitleFormModal — confirmation/édition après import ───────────── */}
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