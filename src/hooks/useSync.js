import { useState, useCallback, useRef } from "react";
import { fetchSeasonInfo, fetchNextAiring } from "../api";
import { fetchWeeklySchedule, fetchAniListFranchise } from "../api/anilist";
import { getCached, setCached, TTL } from "../lib/cache";
import { useLibrary } from "../context/LibraryContext";
import { autoStatus, isEnProduction, AIRING_REFRESH_EVENT } from "../utils/status";

// ── Synchro automatique bibliothèque ⇄ calendrier ───────────────────────────
//
// Lancée à l'OUVERTURE de l'app (voir NotificationLayer dans App.jsx) et au tirer-pour-
// rafraîchir de l'accueil. Elle va chercher ce qui a pu changer côté AniList / TVmaze pour
// les titres suivis :
//  1. titres de la bibliothèque QUI SONT AU CALENDRIER de la semaine → données relues en
//     forçant les caches : nombre d'épisodes sortis, nouvelle saison annoncée, prochaine
//     diffusion (les cartes la relisent ensuite — événement AIRING_REFRESH_EVENT) ;
//  2. titres suivis dont la dernière saison n'est pas connue comme terminée (donnée
//     ancienne, saison prévue…) → relus une fois toutes les 6 h au plus, via le cache ;
//  3. séries TVmaze « en production » → total de la dernière saison, comme avant.
// Aucune de ces mises à jour ne touche à la progression (épisodes vus, notes) : elles sont
// appliquées sur la version LA PLUS RÉCENTE de l'entrée (patchEntry), pas sur une copie lue
// avant les appels réseau.

const INTER_CALL_DELAY_MS = 700;
const AUTO_COOLDOWN_MS    = 20 * 60 * 1000;       // pas plus d'une synchro auto toutes les 20 min
const RECHECK_MS          = 6 * 60 * 60 * 1000;   // relecture des titres hors calendrier
const MAX_PER_RUN         = 30;                   // garde-fou : le calendrier passe toujours en premier
const LAST_SYNC_KEY       = "anivault:lastSync";
const CHECKED_KEY         = "anivault:syncChecked"; // { [entryId]: timestamp }
const CALENDAR_CACHE_KEY  = "calendar_week_0";      // même clé que Home / Calendrier

let inFlight = false; // une seule synchro à la fois (auto au lancement + tirer-pour-rafraîchir)

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function isTV(s) { return !s.format || s.format === "TV" || s.format === "TV_SHORT"; }

function loadChecked() {
  try { return JSON.parse(localStorage.getItem(CHECKED_KEY) || "{}"); } catch { return {}; }
}

/** Dernière saison TV d'une entrée (celle dont l'état peut encore évoluer). */
function lastTVSeason(entry) {
  const tv = (entry.seasons || []).filter(isTV);
  return tv[tv.length - 1] ?? null;
}

/** Statut de sortie « définitif » côté AniList : inutile de relire un titre dans cet état. */
function isFinalRelease(season) {
  return season?.releaseStatus === "FINISHED" || season?.releaseStatus === "CANCELLED";
}

/** Calendrier de la semaine (cache partagé avec l'accueil → pas de requête en double). */
async function loadWeeklySchedules() {
  const cached = getCached(CALENDAR_CACHE_KEY);
  if (cached?.schedules) return cached.schedules;
  const { schedules, monday } = await fetchWeeklySchedule(0);
  setCached(CALENDAR_CACHE_KEY, { schedules, monday }, TTL.CALENDAR);
  return schedules;
}

/**
 * Applique les données fraîches de la franchise AniList à une entrée, SANS rien perdre :
 *  • saisons déjà connues → on met à jour nombre d'épisodes sortis, statut de sortie, couverture ;
 *  • nouvelles saisons TV → ajoutées (0 épisode vu) à la suite des saisons TV ;
 *  • on n'ajoute ni ne retire jamais OVA / films, et on ne supprime aucune saison.
 * Renvoie la MÊME entrée s'il n'y a rien à changer (patchEntry ne réécrit alors rien).
 */
function applyFranchise(entry, fresh, freshIds) {
  const seasons = entry.seasons.map((s) => s);
  const byId = new Map();
  entry.seasons.forEach((s, i) => {
    const id = s.anilistId ?? entry.anilistIds?.[i] ?? null;
    if (id != null) byId.set(String(id), i);
  });

  let changed = false;
  for (const f of fresh) {
    const i = byId.get(String(f.anilistId));
    if (i == null) continue;
    const cur = seasons[i];
    const next = {
      ...cur,
      anilistId:     cur.anilistId ?? f.anilistId,
      releaseStatus: f.releaseStatus ?? cur.releaseStatus,
      totalEpisodes: f.totalEpisodes ?? cur.totalEpisodes,
      coverImage:    cur.coverImage ?? f.coverImage ?? null,
    };
    if (next.anilistId !== cur.anilistId || next.releaseStatus !== cur.releaseStatus
        || next.totalEpisodes !== cur.totalEpisodes || next.coverImage !== cur.coverImage) {
      seasons[i] = next;
      changed = true;
    }
  }

  const newTV = fresh.filter((f) => f.format === "TV" && !byId.has(String(f.anilistId)));
  const anilistIds = [...(entry.anilistIds || [])];
  if (newTV.length) {
    let insertAt = seasons.reduce((acc, s, i) => (s.format === "TV" || !s.format ? i + 1 : acc), 0);
    let tvCount  = seasons.filter((s) => s.format === "TV" || !s.format).length;
    for (const f of newTV) {
      seasons.splice(insertAt++, 0, {
        number: ++tvCount, format: "TV", title: f.title ?? null,
        totalEpisodes: f.totalEpisodes ?? null, watchedEpisodes: 0,
        coverImage: f.coverImage ?? null, rating: 0,
        anilistId: f.anilistId, releaseStatus: f.releaseStatus ?? null,
      });
      if (!anilistIds.includes(f.anilistId)) anilistIds.push(f.anilistId);
    }
    changed = true;
  }
  if (!changed) return entry;
  // freshIds sert de contrôle de cohérence uniquement : on ne remplace jamais la liste existante.
  void freshIds;
  return { ...entry, seasons, anilistIds, status: autoStatus(entry, seasons) };
}

export function useSync() {
  const { entries, updateSeasonTotal, patchEntry } = useLibrary();
  const entriesRef = useRef(entries);
  entriesRef.current = entries;

  const [syncing,  setSyncing]  = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  /**
   * @param force  true = tirer-pour-rafraîchir : ignore le délai minimal entre deux synchros
   *               et relit aussi les titres hors calendrier.
   */
  const syncAll = useCallback(async (force = false) => {
    if (inFlight) return;
    const lastSync = parseInt(localStorage.getItem(LAST_SYNC_KEY) || "0");
    if (!force && Date.now() - lastSync < AUTO_COOLDOWN_MS) return;

    const library = entriesRef.current.filter((e) => e.status !== "abandonne");
    if (!library.length) return;

    inFlight = true;
    setSyncing(true);
    setProgress({ current: 0, total: 0 });

    try {
      // ── Calendrier de la semaine : ids AniList diffusés ────────────────────
      const airingIds = new Set();
      let calendarOk = false;
      try {
        const schedules = await loadWeeklySchedules();
        schedules.forEach((s) => { if (s.media?.id != null) airingIds.add(Number(s.media.id)); });
        calendarOk = true;
      } catch { /* calendrier injoignable : on retombe sur les titres « à vérifier » seuls */ }

      const anilist = library.filter((e) =>
        e.source === "anilist" && (e.anilistIds?.[0] ?? e.seasons?.find((s) => s.anilistId)?.anilistId) != null);

      // 1) bibliothèque ∩ calendrier — priorité absolue, lecture forcée
      const inCalendar = calendarOk
        ? anilist.filter((e) => (e.anilistIds || []).some((id) => airingIds.has(Number(id))))
        : [];
      const calendarIds = new Set(inCalendar.map((e) => e.id));

      // 2) titres suivis dont l'état de sortie n'est pas définitif, relus au plus toutes les 6 h
      const checked = loadChecked();
      const toCheck = anilist.filter((e) =>
        !calendarIds.has(e.id)
        && e.status !== "termine"
        && !isFinalRelease(lastTVSeason(e))
        && (force || Date.now() - (checked[e.id] || 0) > RECHECK_MS));

      // 3) TVmaze en production (pas de calendrier global pour cette source)
      const tvmaze = library.filter((e) =>
        e.source === "tvmaze" && e.tvmazeId && e.status === "en-cours" && isEnProduction(e));

      const queue = [
        ...inCalendar.map((e) => ({ e, kind: "calendar" })),
        ...toCheck.map((e) => ({ e, kind: "check" })),
      ].slice(0, MAX_PER_RUN);
      const total = queue.length + tvmaze.length;
      setProgress({ current: 0, total });

      let done = 0;
      let refreshedAiring = false;

      for (const { e, kind } of queue) {
        setProgress({ current: ++done, total });
        const seed = e.anilistIds?.[0] ?? e.seasons?.find((s) => s.anilistId)?.anilistId;
        try {
          const { seasons: fresh, anilistIds: freshIds } = await fetchAniListFranchise(seed, { force: kind === "calendar" });
          if (fresh?.length) patchEntry(e.id, (latest) => applyFranchise(latest, fresh, freshIds));
          if (kind === "calendar") {
            // Amorce le cache avec la prochaine diffusion FRAÎCHE (les cartes la relisent ensuite).
            await fetchNextAiring(e, { force: true }).catch(() => {});
            refreshedAiring = true;
          }
          checked[e.id] = Date.now();
        } catch { /* réseau / limite : on réessaiera à la prochaine synchro */ }
        await sleep(INTER_CALL_DELAY_MS);
      }

      for (const e of tvmaze) {
        setProgress({ current: ++done, total });
        const lastIdx = (() => {
          let idx = null;
          e.seasons.forEach((s, i) => { if (isTV(s)) idx = i; });
          return idx;
        })();
        if (lastIdx == null) continue;
        try {
          const data = await fetchSeasonInfo(e, lastIdx);
          if (data?.totalEpisodes != null && data.totalEpisodes !== e.seasons[lastIdx].totalEpisodes) {
            updateSeasonTotal(e.id, lastIdx, data.totalEpisodes, true);
          }
        } catch { /* idem */ }
        await sleep(INTER_CALL_DELAY_MS);
      }

      try { localStorage.setItem(CHECKED_KEY, JSON.stringify(checked)); } catch { /* quota */ }
      localStorage.setItem(LAST_SYNC_KEY, Date.now().toString());
      if (refreshedAiring) window.dispatchEvent(new Event(AIRING_REFRESH_EVENT));
    } finally {
      inFlight = false;
      setSyncing(false);
      setProgress({ current: 0, total: 0 });
    }
  }, [patchEntry, updateSeasonTotal]);

  return { syncAll, syncing, progress };
}
