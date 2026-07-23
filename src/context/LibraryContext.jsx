import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "./AuthContext";
import { seasonTotals, autoStatus } from "../utils/status";

const LibraryContext = createContext(null);
const SAVE_DEBOUNCE_MS = 800;

export function LibraryProvider({ children }) {
  const { user } = useAuth();
  const [entries, setEntriesState] = useState([]);
  const [loading, setLoading]      = useState(true);
  const [saveError, setSaveError]  = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const entriesRef = useRef([]); const saveTimer = useRef(null);

  useEffect(() => {
    if (!user) { setEntriesState([]); setLoading(false); return; }
    setLoading(true);
    supabase.from("libraries").select("entries").eq("user_id", user.id).maybeSingle()
      .then(({ data, error }) => { if (error) setSaveError(true); else applyEntries(data?.entries || []); setLoading(false); });
  }, [user?.id]);

  function applyEntries(next) { entriesRef.current = next; setEntriesState(next); }

  async function saveToSupabase(next) {
    if (!user) return;
    const { error } = await supabase.from("libraries").upsert({ user_id: user.id, entries: next });
    setSaveError(!!error);
  }

  function persist(next) {
    const newlyDone = next.some((e) => { const old = entriesRef.current.find((p) => p.id === e.id); return old && old.status !== "termine" && e.status === "termine"; });
    if (newlyDone) { setShowConfetti(true); setTimeout(() => setShowConfetti(false), 3000); }
    applyEntries(next);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveToSupabase(entriesRef.current), SAVE_DEBOUNCE_MS);
  }

  const findDuplicate = useCallback((title, editingId) =>
    entriesRef.current.find((e) => e.id !== editingId && e.title.toLowerCase().trim() === title.toLowerCase().trim()) ?? null, []);

  const saveEntry = useCallback((form, editingId) => {
    const forceAll = !editingId && form.status === "termine";
    const seasons  = form.seasons.map((s) => {
      const total   = s.totalEpisodes == null ? null : Math.max(0, Number(s.totalEpisodes) || 0);
      const watched = total != null ? Math.min(total, forceAll && total != null ? total : Math.max(0, Number(s.watchedEpisodes) || 0)) : Math.max(0, Number(s.watchedEpisodes) || 0);
      return { number: s.number, format: s.format ?? "TV", totalEpisodes: total, watchedEpisodes: watched, coverImage: s.coverImage ?? null };
    });
    const cleaned = { ...form, title: form.title.trim(), seasons, rating: Math.min(10, Math.max(0, Number(form.rating) || 0)), id: editingId || Date.now().toString(), watchHistory: editingId ? (entriesRef.current.find((e) => e.id === editingId)?.watchHistory || []) : [] };
    persist(editingId ? entriesRef.current.map((e) => e.id === editingId ? cleaned : e) : [cleaned, ...entriesRef.current]);
  }, [user]);

  const setEntries   = useCallback((next) => persist(next), [user]);
  const deleteEntry  = useCallback((id)  => persist(entriesRef.current.filter((e) => e.id !== id)), [user]);

  const incrementEpisode = useCallback((id, seasonIndex) => {
    const now  = Date.now();
    const next = entriesRef.current.map((e) => {
      if (e.id !== id) return e;
      const seasons = e.seasons.map((s, i) => { if (i !== seasonIndex) return s; const n = s.watchedEpisodes + 1; return { ...s, watchedEpisodes: s.totalEpisodes != null ? Math.min(s.totalEpisodes, n) : n }; });
      const history = [...(e.watchHistory || []), { seasonIndex, episode: seasons[seasonIndex].watchedEpisodes, watchedAt: now }];
      return { ...e, seasons, status: autoStatus(e, seasons), watchHistory: history };
    });
    persist(next);
  }, [user]);

  const decrementEpisode = useCallback((id, seasonIndex) => {
    persist(entriesRef.current.map((e) => { if (e.id !== id) return e; const seasons = e.seasons.map((s, i) => i !== seasonIndex ? s : { ...s, watchedEpisodes: Math.max(0, s.watchedEpisodes - 1) }); return { ...e, seasons, status: autoStatus(e, seasons) }; }));
  }, [user]);

  const setEpisodeCount = useCallback((id, seasonIndex, value) => {
    const now  = Date.now();
    const next = entriesRef.current.map((e) => {
      if (e.id !== id) return e;
      const old     = e.seasons[seasonIndex]?.watchedEpisodes || 0;
      const seasons = e.seasons.map((s, i) => { if (i !== seasonIndex) return s; const c = s.totalEpisodes != null ? Math.min(s.totalEpisodes, Math.max(0, value)) : Math.max(0, value); return { ...s, watchedEpisodes: c }; });
      const nw      = seasons[seasonIndex].watchedEpisodes;
      const entries = nw > old ? Array.from({ length: nw - old }, (_, i) => ({ seasonIndex, episode: old + i + 1, watchedAt: now + i })) : [];
      return { ...e, seasons, status: autoStatus(e, seasons), watchHistory: [...(e.watchHistory || []), ...entries] };
    });
    persist(next);
  }, [user]);

  const markDone         = useCallback((id) => persist(entriesRef.current.map((e) => e.id === id ? { ...e, status: "termine" } : e)), [user]);
  const updateRating     = useCallback((id, rating) => persist(entriesRef.current.map((e) => e.id === id ? { ...e, rating } : e)), [user]);
  const updateSeasonTotal = useCallback((id, seasonIndex, totalEpisodes) => {
    persist(entriesRef.current.map((e) => { if (e.id !== id) return e; const seasons = e.seasons.map((s, i) => i === seasonIndex ? { ...s, totalEpisodes } : s); return { ...e, seasons, status: autoStatus(e, seasons) }; }));
  }, [user]);

  const addSeason = useCallback((id, seasonData = {}) => {
    persist(entriesRef.current.map((e) => {
      if (e.id !== id) return e;
      const newSeason = { number: e.seasons.length + 1, format: seasonData.format ?? "TV", totalEpisodes: seasonData.totalEpisodes ?? null, watchedEpisodes: 0, coverImage: seasonData.coverImage ?? null };
      const newIds    = seasonData.anilistId ? [...(e.anilistIds || []), seasonData.anilistId] : (e.anilistIds || []);
      return { ...e, seasons: [...e.seasons, newSeason], anilistIds: newIds };
    }));
  }, [user]);

  const deleteSeason = useCallback((id, seasonIndex) => {
    persist(entriesRef.current.map((e) => { if (e.id !== id || e.seasons.length <= 1) return e; const seasons = e.seasons.filter((_, i) => i !== seasonIndex).map((s, i) => ({ ...s, number: i + 1 })); return { ...e, seasons, status: autoStatus(e, seasons) }; }));
  }, [user]);

  return (
    <LibraryContext.Provider value={{ entries, setEntries, loading, saveError, showConfetti, findDuplicate, saveEntry, deleteEntry, incrementEpisode, decrementEpisode, setEpisodeCount, markDone, updateRating, updateSeasonTotal, addSeason, deleteSeason }}>
      {children}
    </LibraryContext.Provider>
  );
}

export function useLibrary() {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error("useLibrary must be used within LibraryProvider");
  return ctx;
}
