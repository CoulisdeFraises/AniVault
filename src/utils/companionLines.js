// src/utils/companionLines.js
//
// Pool de répliques du compagnon, par catégorie. Chaque ligne peut contenir
// des tokens {nom} remplacés dynamiquement via pickCompanionLine().
// Une ligne est piochée au hasard dans le pool de sa catégorie à chaque
// déclenchement (évite la répétition immédiate si le pool fait 4-6 lignes).

export const COMPANION_LINES = {
  achievement: [
    "Nouveau succès : {name} ! Tu m'impressionnes.",
    "{name} débloqué. Pas mal du tout.",
    "Encore un trophée pour la collection : {name} !",
    "{name}... tu commences à devenir dangereux(se).",
  ],
  finished: [
    "{title}, terminé ! Alors, ce dénouement ?",
    "Tu viens de finir {title}. Un de plus sur la pile !",
    "{title} bouclé. Tu veux enchaîner sur autre chose ?",
    "Voilà, {title} c'est dans la boîte.",
  ],
  streakRecord: [
    "{streak} jours d'affilée — nouveau record ! Impressionnant.",
    "Tu viens de battre ton record : {streak} jours de suite.",
    "{streak} jours. Personne ne t'arrête, on dirait.",
  ],
  streakLost: [
    "Ta série de jours s'est arrêtée là. Ça arrive, on repart de zéro.",
    "Streak terminée pour cette fois. Prêt(e) à en relancer une nouvelle ?",
    "Bon, la série est cassée — mais rien n'empêche d'en commencer une autre.",
  ],
  streakDanger: [
    "Ta streak de {streak} jours tient encore à un fil ce soir...",
    "Plus beaucoup de temps pour sauver tes {streak} jours de suite !",
    "{streak} jours en jeu — un épisode et c'est réglé.",
  ],
  newEntry: [
    "{title} ajouté à ta liste. Bon choix ?",
    "Une nouvelle entrée : {title}. On verra si ça tient la distance.",
    "{title} rejoint la collection. À voir quand tu t'y mets !",
  ],
  comeback: [
    "Ça faisait {days} jours ! Content(e) de te revoir.",
    "{days} jours sans nouvelles... tout va bien ?",
    "Retour après {days} jours d'absence. Ta liste t'a attendu(e).",
  ],
  idle: [
    "Alors, on regarde quoi aujourd'hui ?",
    "Ta bibliothèque n'attend que toi.",
    "Prêt(e) pour un épisode ou deux ?",
    "Toujours là ! Une petite suggestion : reprends ce que tu as en cours.",
  ],
};

/** Remplace les tokens {clé} d'une ligne par les valeurs de `vars`. */
function interpolate(line, vars) {
  return line.replace(/\{(\w+)\}/g, (_, key) => (vars[key] != null ? String(vars[key]) : ""));
}

/** Pioche une ligne au hasard dans la catégorie et l'interpole avec `vars`. */
export function pickCompanionLine(category, vars = {}) {
  const pool = COMPANION_LINES[category];
  if (!pool?.length) return null;
  const line = pool[Math.floor(Math.random() * pool.length)];
  return interpolate(line, vars);
}
