// ── Réglages du compagnon ───────────────────────────────────────────────────
//
// Deux préférences locales (localStorage, comme les autres pref_* de
// Settings), lues au moment où une réaction se déclenche : un changement dans
// Réglages s'applique donc tout de suite, sans rechargement.
//
//   pref_companionFrequency : "off" | "rare" | "normal" | "often"
//       off     → aucune bulle
//       rare    → seulement les événements marquants (succès, anime terminé,
//                 record de streak, Legendary/Secret, vœu, série complétée…)
//       normal  → comportement par défaut
//       often   → comme normal, et les boosters ordinaires réagissent plus souvent
//   pref_companionWaifinity : "true" | "false" — réactions dans Waifinity

export const COMPANION_FREQUENCIES = [
  { key: "off",    label: "Silencieux" },
  { key: "rare",   label: "Rares" },
  { key: "normal", label: "Normales" },
  { key: "often",  label: "Fréquentes" },
];

const FREQ_KEY = "pref_companionFrequency";
const WF_KEY   = "pref_companionWaifinity";

// Réactions toujours conservées en mode « Rares ».
const ESSENTIAL = new Set([
  "achievement", "finished", "caughtUp", "streakRecord",
  "wfPackTop", "wfWish", "wfSeriesComplete", "wfMissionsAll",
]);

const read = (key) => { try { return localStorage.getItem(key); } catch { return null; } };
const write = (key, value) => { try { localStorage.setItem(key, value); } catch { /* stockage indisponible : réglage non conservé */ } };

export function getCompanionFrequency() {
  const v = read(FREQ_KEY);
  return COMPANION_FREQUENCIES.some((f) => f.key === v) ? v : "normal";
}
export function setCompanionFrequency(v) { write(FREQ_KEY, v); }

export function getCompanionWaifinity() { return read(WF_KEY) !== "false"; }
export function setCompanionWaifinity(v) { write(WF_KEY, String(!!v)); }

/** Cette catégorie de réaction a-t-elle le droit de s'afficher avec les réglages actuels ? */
export function isCategoryAllowed(category) {
  const freq = getCompanionFrequency();
  if (freq === "off") return false;
  if (category.startsWith("wf") && !getCompanionWaifinity()) return false;
  if (freq === "rare") return ESSENTIAL.has(category);
  return true;
}

/** Facteur appliqué aux probabilités des réactions « ordinaires » de Waifinity. */
export function chanceMultiplier() {
  return getCompanionFrequency() === "often" ? 2 : 1;
}

export const COMPANION_PREF_KEYS = [FREQ_KEY, WF_KEY];
