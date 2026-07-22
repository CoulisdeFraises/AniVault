// Stockage bas niveau. Chaque profil a son propre espace de clés, pour que
// les bibliothèques de plusieurs profils locaux ne se marchent pas dessus.

const LEGACY_KEY = "playlog-entries"; // clé utilisée avant l'introduction des profils
export const PROFILES_KEY = "anivault:profiles";
export const CURRENT_PROFILE_KEY = "anivault:current-profile";

function entriesKey(profile) {
  return `anivault:${profile}:entries`;
}

export function loadProfiles() {
  try {
    const raw = localStorage.getItem(PROFILES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveProfiles(profiles) {
  try {
    localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
    return true;
  } catch {
    return false;
  }
}

export function loadCurrentProfile() {
  try {
    return localStorage.getItem(CURRENT_PROFILE_KEY);
  } catch {
    return null;
  }
}

export function saveCurrentProfile(profile) {
  try {
    if (profile) localStorage.setItem(CURRENT_PROFILE_KEY, profile);
    else localStorage.removeItem(CURRENT_PROFILE_KEY);
    return true;
  } catch {
    return false;
  }
}

// Si un profil vient d'être créé et qu'il n'a pas encore de bibliothèque,
// on récupère les données de l'ancienne version (mono-utilisateur) une seule fois.
export function migrateLegacyIfNeeded(profile) {
  try {
    const alreadyHasData = localStorage.getItem(entriesKey(profile));
    if (alreadyHasData) return;
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) localStorage.setItem(entriesKey(profile), legacy);
  } catch {
    // tant pis, on repart d'une bibliothèque vide
  }
}

export function loadEntries(profile) {
  try {
    const raw = localStorage.getItem(entriesKey(profile));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    // Migration : anciennes entrées à plat (sans tableau "seasons")
    return parsed.map((e) =>
      e.seasons ? e : { ...e, seasons: [{ number: 1, totalEpisodes: e.totalEpisodes ?? null, watchedEpisodes: e.watchedEpisodes || 0 }] }
    );
  } catch {
    return [];
  }
}

export function saveEntries(profile, entries) {
  try {
    localStorage.setItem(entriesKey(profile), JSON.stringify(entries));
    return true;
  } catch {
    return false;
  }
}

export function exportEntriesAsJSON(profile) {
  return JSON.stringify(loadEntries(profile), null, 2);
}

export function clearEntries(profile) {
  try {
    localStorage.removeItem(entriesKey(profile));
    return true;
  } catch {
    return false;
  }
}