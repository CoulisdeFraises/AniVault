import { useState, useCallback } from "react";
import { fetchSeasonInfo } from "../api";
import { useLibrary } from "../context/LibraryContext";

const INTER_CALL_DELAY_MS = 700;              // relevé de 400→700ms (fix rate limit)
const SYNC_COOLDOWN_MS    = 6 * 60 * 60 * 1000;
const LAST_SYNC_KEY       = "anivault:lastSync";

// Statuts pour lesquels totalEpisodes peut encore changer
const ACTIVE_STATUSES = new Set(["en-cours", "a-voir"]);

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

export function useSync() {
  const { entries, updateSeasonTotal } = useLibrary();
  const [syncing,  setSyncing]  = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const syncAll = useCallback(async (force = false) => {
    if (syncing) return;

    const lastSync = parseInt(localStorage.getItem(LAST_SYNC_KEY) || "0");
    if (!force && Date.now() - lastSync < SYNC_COOLDOWN_MS) return;

    const toSync = entries.filter((e) => {
      // 1. Source connue
      if (e.source !== "anilist" && e.source !== "tvmaze") return false;
      // 2. Statut actif uniquement — les titres terminés/abandonnés
      //    ont des données figées, inutile de les refetcher.
      return ACTIVE_STATUSES.has(e.status);
    });

    if (!toSync.length) {
      // Rien à sync mais on marque quand même pour réinitialiser le cooldown
      localStorage.setItem(LAST_SYNC_KEY, Date.now().toString());
      return;
    }

    setSyncing(true);
    setProgress({ current: 0, total: toSync.length });

    for (let i = 0; i < toSync.length; i++) {
      const entry = toSync[i];
      setProgress({ current: i + 1, total: toSync.length });

      // 3. Pour les animes multi-saisons, ne sync que la dernière saison :
      //    c'est la seule dont le totalEpisodes peut encore évoluer.
      //    Exception : si le titre a une seule saison, on la sync quand même.
      const seasonsToSync = entry.seasons.length <= 1
        ? entry.seasons.map((_, idx) => idx)
        : [entry.seasons.length - 1]; // dernière saison uniquement

      for (const s of seasonsToSync) {
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