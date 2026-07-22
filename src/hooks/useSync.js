import { useState, useCallback } from "react";
import { fetchSeasonInfo } from "../api";
import { useLibrary } from "../context/LibraryContext";

const INTER_CALL_DELAY_MS = 400;
const SYNC_COOLDOWN_MS    = 6 * 60 * 60 * 1000; // 6 heures
const LAST_SYNC_KEY       = "anivault:lastSync";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export function useSync() {
  const { entries, updateSeasonTotal } = useLibrary();
  const [syncing,  setSyncing]  = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const syncAll = useCallback(async (force = false) => {
    if (syncing) return;

    // Vérification du cooldown (sauf si forcé manuellement)
    const lastSync = parseInt(localStorage.getItem(LAST_SYNC_KEY) || "0");
    if (!force && Date.now() - lastSync < SYNC_COOLDOWN_MS) return;

    // Uniquement les entrées avec une source connue
    const toSync = entries.filter(
      (e) => e.source === "anilist" || e.source === "tvmaze"
    );
    if (!toSync.length) return;

    setSyncing(true);
    setProgress({ current: 0, total: toSync.length });

    for (let i = 0; i < toSync.length; i++) {
      const entry = toSync[i];
      setProgress({ current: i + 1, total: toSync.length });

      for (let s = 0; s < entry.seasons.length; s++) {
        try {
          const data = await fetchSeasonInfo(entry, s);
          if (
            data?.totalEpisodes != null &&
            data.totalEpisodes !== entry.seasons[s].totalEpisodes
          ) {
            updateSeasonTotal(entry.id, s, data.totalEpisodes);
          }
        } catch (_) {}
        await sleep(INTER_CALL_DELAY_MS);
      }
    }

    localStorage.setItem(LAST_SYNC_KEY, Date.now().toString());
    setSyncing(false);
    setProgress({ current: 0, total: 0 });
  }, [entries, syncing, updateSeasonTotal]);

  return { syncAll, syncing, progress };
}