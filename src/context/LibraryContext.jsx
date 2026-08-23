import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "./AuthContext";
import { seasonTotals, autoStatus, computeOverallRating } from "../utils/status";
import { normalizeSeriesTitle } from "../utils/titles";
import { getStaleCached, setCached, TTL } from "../lib/cache";

const libraryCacheKey = (uid) => `library_${uid}`;

const LibraryContext = createContext(null);
const SAVE_DEBOUNCE_MS  = 800;
const BACKUP_INTERVAL   = 30 * 60 * 1000; // Sauvegarde auto toutes les 30 min
const BACKUP_SLOTS      = 5;              // 5 sauvegardes rotatoires
const LAST_BACKUP_KEY   = "anivault:lastBackup";

function sanitizeEntry(e) {
  if (!e || typeof e !== "object") return null;
  const VALID_STATUS = ["en-cours", "termine", "a-voir", "abandonne"];
  const VALID_TYPES  = ["anime", "serie"];
  const seasonsClean = Array.isArray(e.seasons) && e.seasons.length > 0
    ? e.seasons.map(s => ({
        ...s,
        rating: typeof s.rating === "number" ? Math.min(10, Math.max(0, s.rating)) : 0,
      }))
    : null;
  // La note globale affichée est désormais la moyenne des saisons notées.
  // Tant qu'aucune saison n'a été notée individuellement, on conserve
  // l'ancienne note globale (rétrocompatibilité avec les titres existants).
  const seasonRating = seasonsClean ? computeOverallRating(seasonsClean) : 0;
  const legacyRating  = typeof e.rating === "number" ? Math.min(10, Math.max(0, e.rating)) : 0;
  return {
    ...e,
    id:           typeof e.id === "string" && e.id ? e.id : String(Date.now() + Math.random()),
    title:        typeof e.title === "string" ? e.title : "",
    type:         VALID_TYPES.includes(e.type) ? e.type : "anime",
    status:       VALID_STATUS.includes(e.status) ? e.status : "a-voir",
    rating:       seasonRating > 0 ? seasonRating : legacyRating,
    genres:       Array.isArray(e.genres) ? e.genres.filter(g => typeof g === "string") : [],
    watchHistory: Array.isArray(e.watchHistory) ? e.watchHistory : [],
    // Normalisation en Number : évite les faux-négatifs de dédup (ex. côté
    // Details.jsx, recommandations similaires) si un id a été stocké en
    // string quelque part dans la chaîne (cache, ancien import, etc.).
    ...(Array.isArray(e.anilistIds) ? { anilistIds: e.anilistIds.map(Number).filter((n) => !Number.isNaN(n)) } : {}),
    ...(e.tmdbId != null ? { tmdbId: Number(e.tmdbId) } : {}),
    // Entrées existantes sans updatedAt : on estime à partir du dernier épisode
    // pointé comme vu dans l'historique, sinon 0 (ira en bas du tri "Récents").
    updatedAt:    typeof e.updatedAt === "number"
      ? e.updatedAt
      : (Array.isArray(e.watchHistory) && e.watchHistory.length
          ? Math.max(...e.watchHistory.map(h => h.watchedAt || 0))
          : 0),
    seasons: Array.isArray(e.seasons) && e.seasons.length > 0
      ? e.seasons.map(s => ({
          ...s,
          number:          Number(s.number) || 1,
          format:          typeof s.format === "string" ? s.format : "TV",
          totalEpisodes:   s.totalEpisodes != null ? Math.max(0, Number(s.totalEpisodes) || 0) : null,
          watchedEpisodes: Math.max(0, Number(s.watchedEpisodes) || 0),
          coverImage:      s.coverImage ?? null,
          rating:          Math.min(10, Math.max(0, Number(s.rating) || 0)),
        }))
      : [{ number: 1, format: "TV", totalEpisodes: null, watchedEpisodes: 0, coverImage: null, rating: 0 }],
  };
}

function shouldAutoStatus() {
  return localStorage.getItem("pref_autoStatus") !== "false";
}

/** Sauvegarde automatique rotative dans localStorage (5 slots) */
function autoBackup(entries) {
  try {
    const lastBackup = parseInt(localStorage.getItem(LAST_BACKUP_KEY) || "0");
    if (Date.now() - lastBackup < BACKUP_INTERVAL) return;

    // Lire le slot actuel (0-4 en rotation)
    const slotKey  = "anivault:backupSlot";
    const curSlot  = (parseInt(localStorage.getItem(slotKey) || "0")) % BACKUP_SLOTS;
    const nextSlot = (curSlot + 1) % BACKUP_SLOTS;

    localStorage.setItem(
      `anivault_backup_${curSlot}`,
      JSON.stringify({ entries, savedAt: Date.now() })
    );
    localStorage.setItem(slotKey, String(nextSlot));
    localStorage.setItem(LAST_BACKUP_KEY, String(Date.now()));
  } catch { /* localStorage plein — on ignore */ }
}

export function LibraryProvider({ children }) {
  const { user } = useAuth();
  const [entries, setEntriesState] = useState([]);
  const [loading, setLoading]      = useState(true);
  const [saveError, setSaveError]  = useState(false);
  const [offline, setOffline]      = useState(false); // true = données affichées depuis le cache local, pas confirmées par le serveur
  const entriesRef = useRef([]); const saveTimer = useRef(null);

  useEffect(() => {
    if (!user) { setEntriesState([]); setLoading(false); setOffline(false); return; }

    // Affichage immédiat depuis le cache local (même périmé) pendant que la
    // requête réseau part en parallèle — évite un écran de bibliothèque vide
    // le temps du chargement, et permet une consultation hors-ligne complète.
    const cached = getStaleCached(libraryCacheKey(user.id));
    if (cached) {
      applyEntries(cached.map(sanitizeEntry).filter(Boolean));
      setLoading(false);
    } else {
      setLoading(true);
    }

    supabase.from("libraries").select("entries").eq("user_id", user.id).maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          setSaveError(true);
          // Pas de réseau/serveur injoignable : on reste sur le cache déjà affiché
          // ci-dessus (le cas échéant) plutôt que de vider la bibliothèque.
          if (cached) setOffline(true);
        } else {
          const raw   = Array.isArray(data?.entries) ? data.entries : [];
          const clean = raw.map(sanitizeEntry).filter(Boolean);
          applyEntries(clean);
          setCached(libraryCacheKey(user.id), clean, TTL.LIBRARY);
          setOffline(false);
        }
        setLoading(false);
      });
  }, [user?.id]);

  function applyEntries(next) { entriesRef.current = next; setEntriesState(next); }

  async function saveToSupabase(next) {
    if (!user) return;
    const { error } = await supabase.from("libraries").upsert({ user_id: user.id, entries: next });
    setSaveError(!!error);
  }

  function persist(next) {
    applyEntries(next);

    // ── Cache local (lecture hors-ligne) ────────────────────────────────
    // Écrit immédiatement, même si la sauvegarde réseau derrière échoue :
    // au prochain lancement hors-ligne, on retrouve au moins cet état-ci.
    if (user) setCached(libraryCacheKey(user.id), next, TTL.LIBRARY);

    // ── Sauvegarde auto rotative ──────────────────────────────────────────
    autoBackup(next);

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveToSupabase(entriesRef.current), SAVE_DEBOUNCE_MS);
  }

  // Compare en titre "normalisé" (sans suffixe de saison/partie : "Blue Box"
  // et "Blue Box Season 2" sont donc bien reconnus comme le même titre) et
  // non plus en égalité stricte, sinon une saison ultérieure d'une œuvre
  // déjà en bibliothèque passe à travers le garde-fou et crée un doublon.
  const findDuplicate = useCallback((title, editingId, category) => {
    const isMovie = category === "movie";
    if (!normalizeSeriesTitle(title, !isMovie)) return null;
    return entriesRef.current.find((e) => {
      if (e.id === editingId) return false;
      // Un film ne se fait jamais absorber par un autre numéro de la même
      // franchise : dès que l'un des deux titres comparés est un film, on
      // garde le numéro final dans la clé de comparaison (Toy Story 5 ≠
      // Toy Story 4), au lieu de le retirer comme pour une saison de série.
      const stripBareNumber = !isMovie && e.category !== "movie";
      const key = normalizeSeriesTitle(title, stripBareNumber);
      const candidates = [e.title, e.titleFrench, e.titleRomaji, e.titleEnglish].filter(Boolean);
      return candidates.some((t) => normalizeSeriesTitle(t, stripBareNumber) === key);
    }) ?? null;
  }, []);

  // silent = true : correction automatique (ex. statut "Terminé" incohérent
  // corrigé en arrière-plan) → ne touche pas updatedAt, pour ne pas faire
  // remonter le titre dans le tri "récent" sans action réelle de l'utilisateur.
  const saveEntry = useCallback((form, editingId, silent = false) => {
    const forceAll = !editingId && form.status === "termine";
    const seasons  = form.seasons.map((s) => {
      const total   = s.totalEpisodes == null ? null : Math.max(0, Number(s.totalEpisodes) || 0);
      const watched = total != null
        ? Math.min(total, forceAll ? total : Math.max(0, Number(s.watchedEpisodes) || 0))
        : Math.max(0, Number(s.watchedEpisodes) || 0);
      return {
        number: s.number,
        format: s.format ?? "TV",
        title: s.title ?? null,
        totalEpisodes: total,
        watchedEpisodes: watched,
        coverImage: s.coverImage ?? null,
        rating: Math.min(10, Math.max(0, Number(s.rating) || 0)),
        ...(s.anilistId != null ? { anilistId: s.anilistId } : {}),
      };
    });
    const prevEntry = editingId ? entriesRef.current.find((e) => e.id === editingId) : null;
    const cleaned = sanitizeEntry({
      ...form, title: form.title.trim(), seasons,
      rating: Math.min(10, Math.max(0, Number(form.rating) || 0)),
      id: editingId || Date.now().toString(),
      watchHistory: editingId ? (prevEntry?.watchHistory || []) : [],
      updatedAt: silent ? (prevEntry?.updatedAt ?? Date.now()) : Date.now(),
    });
    persist(editingId
      ? entriesRef.current.map((e) => e.id === editingId ? cleaned : e)
      : [cleaned, ...entriesRef.current]);
  }, [user]);

  const setEntries   = useCallback((next) => persist(next), [user]);
  const deleteEntry  = useCallback((id) => persist(entriesRef.current.filter((e) => e.id !== id)), [user]);

  const incrementEpisode = useCallback((id, seasonIndex) => {
    const now = Date.now(); const auto = shouldAutoStatus();
    persist(entriesRef.current.map((e) => {
      if (e.id !== id) return e;
      const seasons = e.seasons.map((s, i) => {
        if (i !== seasonIndex) return s;
        const n = s.watchedEpisodes + 1;
        return { ...s, watchedEpisodes: s.totalEpisodes != null ? Math.min(s.totalEpisodes, n) : n };
      });
      const history = [...(e.watchHistory || []),
        { seasonIndex, episode: seasons[seasonIndex].watchedEpisodes, watchedAt: now }];
      return { ...e, seasons, status: auto ? autoStatus(e, seasons) : e.status, watchHistory: history, updatedAt: now };
    }));
  }, [user]);

  const decrementEpisode = useCallback((id, seasonIndex) => {
    const now = Date.now(); const auto = shouldAutoStatus();
    persist(entriesRef.current.map((e) => {
      if (e.id !== id) return e;
      const seasons = e.seasons.map((s, i) =>
        i !== seasonIndex ? s : { ...s, watchedEpisodes: Math.max(0, s.watchedEpisodes - 1) });
      return { ...e, seasons, status: auto ? autoStatus(e, seasons) : e.status, updatedAt: now };
    }));
  }, [user]);

  const setEpisodeCount = useCallback((id, seasonIndex, value) => {
    const now = Date.now(); const auto = shouldAutoStatus();
    persist(entriesRef.current.map((e) => {
      if (e.id !== id) return e;
      const old = e.seasons[seasonIndex]?.watchedEpisodes || 0;
      const seasons = e.seasons.map((s, i) => {
        if (i !== seasonIndex) return s;
        const c = s.totalEpisodes != null
          ? Math.min(s.totalEpisodes, Math.max(0, value)) : Math.max(0, value);
        return { ...s, watchedEpisodes: c };
      });
      const nw = seasons[seasonIndex].watchedEpisodes;
      const hist = nw > old
        ? Array.from({ length: nw - old }, (_, i) =>
            ({ seasonIndex, episode: old + i + 1, watchedAt: now + i }))
        : [];
      return { ...e, seasons,
        status: auto ? autoStatus(e, seasons) : e.status,
        watchHistory: [...(e.watchHistory || []), ...hist],
        updatedAt: now };
    }));
  }, [user]);

  const markDone = useCallback((id) =>
    persist(entriesRef.current.map((e) => e.id === id ? { ...e, status: "termine", updatedAt: Date.now() } : e)), [user]);

  const updateRating = useCallback((id, rating) =>
    persist(entriesRef.current.map((e) => e.id === id ? { ...e, rating, updatedAt: Date.now() } : e)), [user]);

  // Note par saison : la note globale affichée sur la carte est ensuite
  // recalculée automatiquement (moyenne des saisons notées).
  const updateSeasonRating = useCallback((id, seasonIndex, rating) => {
    persist(entriesRef.current.map((e) => {
      if (e.id !== id) return e;
      const clamped = Math.min(10, Math.max(0, Number(rating) || 0));
      const seasons = e.seasons.map((s, i) => i === seasonIndex ? { ...s, rating: clamped } : s);
      return { ...e, seasons, rating: computeOverallRating(seasons), updatedAt: Date.now() };
    }));
  }, [user]);

  // silent = true : correction passive (resynchro du nb d'épisodes en arrière-
  // plan à l'ouverture de la fiche) → ne doit pas faire remonter le titre dans
  // le tri "récent", puisque ce n'est pas une action de l'utilisateur.
  const updateSeasonTotal = useCallback((id, seasonIndex, totalEpisodes, silent = false) => {
    persist(entriesRef.current.map((e) => {
      if (e.id !== id) return e;
      const seasons = e.seasons.map((s, i) => i === seasonIndex ? { ...s, totalEpisodes } : s);
      return { ...e, seasons, status: autoStatus(e, seasons), ...(silent ? {} : { updatedAt: Date.now() }) };
    }));
  }, [user]);

  const addSeason = useCallback((id, seasonData = {}) => {
    persist(entriesRef.current.map((e) => {
      if (e.id !== id) return e;
      const newSeason = { number: e.seasons.length + 1, format: seasonData.format ?? "TV",
        title: seasonData.title ?? null, totalEpisodes: seasonData.totalEpisodes ?? null,
        watchedEpisodes: 0, coverImage: seasonData.coverImage ?? null, rating: 0 };
      const newIds = seasonData.anilistId
        ? [...(e.anilistIds || []), seasonData.anilistId] : (e.anilistIds || []);
      return { ...e, seasons: [...e.seasons, newSeason], anilistIds: newIds, updatedAt: Date.now() };
    }));
  }, [user]);

  const deleteSeason = useCallback((id, seasonIndex) => {
    persist(entriesRef.current.map((e) => {
      if (e.id !== id || e.seasons.length <= 1) return e;
      const seasons = e.seasons.filter((_, i) => i !== seasonIndex).map((s, i) => ({ ...s, number: i + 1 }));
      return { ...e, seasons, status: autoStatus(e, seasons), updatedAt: Date.now() };
    }));
  }, [user]);

  return (
    <LibraryContext.Provider value={{
      entries, setEntries, loading, saveError, offline,
      findDuplicate, saveEntry, deleteEntry,
      incrementEpisode, decrementEpisode, setEpisodeCount,
      markDone, updateRating, updateSeasonRating, updateSeasonTotal, addSeason, deleteSeason,
    }}>
      {children}
    </LibraryContext.Provider>
  );
}

export function useLibrary() {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error("useLibrary must be used within LibraryProvider");
  return ctx;
}