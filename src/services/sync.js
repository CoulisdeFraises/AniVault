import { loadEntries, saveEntries } from "./storage";

// Aujourd'hui : persistance locale uniquement (profils sans compte réel).
// Demain : si vous branchez un backend (ex. Supabase), c'est ici — et
// uniquement ici — qu'il faudra remplacer loadEntries/saveEntries par des
// appels réseau. Le reste de l'app (context, hooks, pages) ne changera pas,
// tant que pull()/push() gardent la même signature.

export async function pull(profile) {
  return loadEntries(profile);
}

export async function push(profile, entries) {
  return saveEntries(profile, entries);
}