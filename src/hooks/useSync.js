import { useState, useCallback } from "react";
import { fetchSeasonInfo }      from "../api";
import { fetchWeeklySchedule }  from "../api/anilist";
import { useLibrary }           from "../context/LibraryContext";

const INTER_CALL_DELAY_MS = 700;
const SYNC_COOLDOWN_MS    = 6 * 60 * 60 * 1000;
const LAST_SYNC_KEY       = "anivault:lastSync";

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

/**
 * Détermine si une entrée affiche le chip "En Production".
 * Condition : statut actif (pas terminé/abandonné) ET dernière saison TV
 * avec un nombre d'épisodes inconnu (null) ou nul (0).
 * Doit correspondre exactement à la logique de Card.jsx → showUpcoming.
 */
function isEnProduction(entry) {
  if (entry.status === "termine" || entry.status === "abandonne") return false;
  const tvSeasons = entry.seasons.filter((s) => {
    const f = s.format;
    return !f || f === "TV" || f === "TV_SHORT";
  });
  if (!tvSeasons.length) return false;
  const lastTV = tvSeasons[tvSeasons.length - 1];
  return lastTV.totalEpisodes == null || lastTV.totalEpisodes === 0;
}

export function useSync() {
  const { entries, updateSeasonTotal } = useLibrary();
  const [syncing,  setSyncing]  = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const syncAll = useCallback(async (force = false) => {
    if (syncing) return;

    const lastSync = parseInt(localStorage.getItem(LAST_SYNC_KEY) || "0");
    if (!force && Date.now() - lastSync < SYNC_COOLDOWN_MS) return;

    // ── Étape 1 : isoler les entrées "En Production" ──────────────────────
    // On ne sync que ce qui peut encore changer (épisode total inconnu).
    // Les titres avec totalEpisodes connu et terminés/abandonnés sont ignorés.
    const enProduction = entries.filter((e) => {
      if (e.source !== "anilist" && e.source !== "tvmaze") return false;
      return isEnProduction(e);
    });

    if (!enProduction.length) {
      localStorage.setItem(LAST_SYNC_KEY, Date.now().toString());
      return;
    }

    setSyncing(true);
    setProgress({ current: 0, total: 0 });

    // ── Étape 2 (AniList) : 1 seule requête calendrier → filtrage local ───
    // Au lieu de N requêtes (une par entrée), on récupère le calendrier
    // de la semaine en UNE requête puis on ne garde que les entrées dont
    // un anilistId figure dans ce calendrier.
    const anilistEntries = enProduction.filter((e) => e.source === "anilist");
    const tvmazeEntries  = enProduction.filter((e) => e.source === "tvmaze");

    let airingIds = new Set(); // IDs AniList diffusés cette semaine
    if (anilistEntries.length > 0) {
      try {
        const { schedules } = await fetchWeeklySchedule(0);
        schedules.forEach((s) => { if (s.media?.id) airingIds.add(s.media.id); });
      } catch (_) {
        // Calendrier inaccessible → fallback : on sync tout de même
        anilistEntries.forEach((e) =>
          (e.anilistIds || []).forEach((id) => airingIds.add(id))
        );
      }
    }

    // Garder uniquement les entrées AniList dont au moins un ID est au calendrier
    const anilistToSync = anilistEntries.filter((e) =>
      (e.anilistIds || []).some((id) => airingIds.has(id))
    );

    // TVmaze : pas de calendrier global dispo, on les sync directement
    const toSync = [...anilistToSync, ...tvmazeEntries];

    if (!toSync.length) {
      localStorage.setItem(LAST_SYNC_KEY, Date.now().toString());
      setSyncing(false);
      return;
    }

    setProgress({ current: 0, total: toSync.length });

    // ── Étape 3 : sync ciblée ──────────────────────────────────────────────
    for (let i = 0; i < toSync.length; i++) {
      const entry = toSync[i];
      setProgress({ current: i + 1, total: toSync.length });

      // On ne sync que la dernière saison TV : c'est la seule dont
      // le totalEpisodes peut encore évoluer pour les "En Production".
      const tvSeasonIndices = entry.seasons
        .map((s, idx) => ({ s, idx }))
        .filter(({ s }) => { const f = s.format; return !f || f === "TV" || f === "TV_SHORT"; })
        .map(({ idx }) => idx);

      const lastTVIdx = tvSeasonIndices[tvSeasonIndices.length - 1];
      if (lastTVIdx == null) continue;

      try {
        const data = await fetchSeasonInfo(entry, lastTVIdx);
        if (
          data?.totalEpisodes != null &&
          data.totalEpisodes !== entry.seasons[lastTVIdx].totalEpisodes
        ) {
          updateSeasonTotal(entry.id, lastTVIdx, data.totalEpisodes);
        }
      } catch (_) {}

      await sleep(INTER_CALL_DELAY_MS);
    }

    localStorage.setItem(LAST_SYNC_KEY, Date.now().toString());
    setSyncing(false);
    setProgress({ current: 0, total: 0 });
  }, [entries, syncing, updateSeasonTotal]);

  return { syncAll, syncing, progress };
}