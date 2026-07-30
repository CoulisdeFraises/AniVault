import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "./AuthContext";
import { seasonTotals, autoStatus } from "../utils/status";

const LibraryContext = createContext(null);
const SAVE_DEBOUNCE_MS  = 800;
const BACKUP_INTERVAL   = 30 * 60 * 1000; // Sauvegarde auto toutes les 30 min
const BACKUP_SLOTS      = 5;              // 5 sauvegardes rotatoires
const LAST_BACKUP_KEY   = "anivault:lastBackup";

function sanitizeEntry(e) {
  if (!e || typeof e !== "object") return null;
  const VALID_STATUS = ["en-cours", "termine", "a-voir", "abandonne"];
  const VALID_TYPES  = ["anime", "serie"];
  return {
    ...e,
    id:           typeof e.id === "string" && e.id ? e.id : String(Date.now() + Math.random()),
    title:        typeof e.title === "string" ? e.title : "",
    type:         VALID_TYPES.includes(e.type) ? e.type : "anime",
    status:       VALID_STATUS.includes(e.status) ? e.status : "a-voir",
    rating:       typeof e.rating === "number" ? Math.min(10, Math.max(0, e.rating)) : 0,
    genres:       Array.isArray(e.genres) ? e.genres.filter(g => typeof g === "string") : [],
    watchHistory: Array.isArray(e.watchHistory) ? e.watchHistory : [],
    seasons: Array.isArray(e.seasons) && e.seasons.length > 0
      ? e.seasons.map(s => ({
          ...s,
          number:          Number(s.number) || 1,
          format:          typeof s.format === "string" ? s.format : "TV",
          totalEpisodes:   s.totalEpisodes != null ? Math.max(0, Number(s.totalEpisodes) || 0) : null,
          watchedEpisodes: Math.max(0, Number(s.watchedEpisodes) || 0),
          coverImage:      s.coverImage ?? null,
        }))
      : [{ number: 1, format: "TV", totalEpisodes: null, watchedEpisodes: 0, coverImage: null }],
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
  const entriesRef = useRef([]); const saveTimer = useRef(null);

  useEffect(() => {
    if (!user) { setEntriesState([]); setLoading(false); return; }
    setLoading(true);
    supabase.from("libraries").select("entries").eq("user_id", user.id).maybeSingle()
      .then(({ data, error }) => {
        if (error) { setSaveError(true); }
        else {
          const raw = Array.isArray(data?.entries) ? data.entries : [];
          applyEntries(raw.map(sanitizeEntry).filter(Boolean));
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

    // ── Sauvegarde auto rotative ──────────────────────────────────────────
    autoBackup(next);

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveToSupabase(entriesRef.current), SAVE_DEBOUNCE_MS);
  }

  const findDuplicate = useCallback((title, editingId) =>
    entriesRef.current.find((e) => e.id !== editingId && e.title.toLowerCase().trim() === title.toLowerCase().trim()) ?? null, []);

  const saveEntry = useCallback((form, editingId) => {
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
        ...(s.anilistId != null ? { anilistId: s.anilistId } : {}),
      };
    });
    const cleaned = {
      ...form, title: form.title.trim(), seasons,
      rating: Math.min(10, Math.max(0, Number(form.rating) || 0)),
      id: editingId || Date.now().toString(),
      watchHistory: editingId ? (entriesRef.current.find((e) => e.id === editingId)?.watchHistory || []) : [],
    };
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
      return { ...e, seasons, status: auto ? autoStatus(e, seasons) : e.status, watchHistory: history };
    }));
  }, [user]);

  const decrementEpisode = useCallback((id, seasonIndex) => {
    const auto = shouldAutoStatus();
    persist(entriesRef.current.map((e) => {
      if (e.id !== id) return e;
      const seasons = e.seasons.map((s, i) =>
        i !== seasonIndex ? s : { ...s, watchedEpisodes: Math.max(0, s.watchedEpisodes - 1) });
      return { ...e, seasons, status: auto ? autoStatus(e, seasons) : e.status };
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
        watchHistory: [...(e.watchHistory || []), ...hist] };
    }));
  }, [user]);

  const markDone = useCallback((id) =>
    persist(entriesRef.current.map((e) => e.id === id ? { ...e, status: "termine" } : e)), [user]);

  const updateRating = useCallback((id, rating) =>
    persist(entriesRef.current.map((e) => e.id === id ? { ...e, rating } : e)), [user]);

  const updateSeasonTotal = useCallback((id, seasonIndex, totalEpisodes) => {
    persist(entriesRef.current.map((e) => {
      if (e.id !== id) return e;
      const seasons = e.seasons.map((s, i) => i === seasonIndex ? { ...s, totalEpisodes } : s);
      return { ...e, seasons, status: autoStatus(e, seasons) };
    }));
  }, [user]);

  const addSeason = useCallback((id, seasonData = {}) => {
    persist(entriesRef.current.map((e) => {
      if (e.id !== id) return e;
      const newSeason = { number: e.seasons.length + 1, format: seasonData.format ?? "TV",
        title: seasonData.title ?? null, totalEpisodes: seasonData.totalEpisodes ?? null,
        watchedEpisodes: 0, coverImage: seasonData.coverImage ?? null };
      const newIds = seasonData.anilistId
        ? [...(e.anilistIds || []), seasonData.anilistId] : (e.anilistIds || []);
      return { ...e, seasons: [...e.seasons, newSeason], anilistIds: newIds };
    }));
  }, [user]);

  const deleteSeason = useCallback((id, seasonIndex) => {
    persist(entriesRef.current.map((e) => {
      if (e.id !== id || e.seasons.length <= 1) return e;
      const seasons = e.seasons.filter((_, i) => i !== seasonIndex).map((s, i) => ({ ...s, number: i + 1 }));
      return { ...e, seasons, status: autoStatus(e, seasons) };
    }));
  }, [user]);

  return (
    <LibraryContext.Provider value={{
      entries, setEntries, loading, saveError,
      findDuplicate, saveEntry, deleteEntry,
      incrementEpisode, decrementEpisode, setEpisodeCount,
      markDone, updateRating, updateSeasonTotal, addSeason, deleteSeason,
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