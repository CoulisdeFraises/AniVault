// Retour haptique centralisé — vocabulaire sémantique plutôt que des appels
// bruts à navigator.vibrate() éparpillés. Respecte le réglage utilisateur
// (Paramètres → Retour haptique, activé par défaut) et l'absence de support.

function isEnabled() {
  return (
    typeof navigator !== "undefined" &&
    "vibrate" in navigator &&
    localStorage.getItem("pref_haptics") !== "false"
  );
}

function fire(pattern) {
  if (!isEnabled()) return;
  try { navigator.vibrate(pattern); } catch { /* certains navigateurs refusent hors interaction utilisateur */ }
}

export const haptics = {
  /** Sélection / toggle léger : favori, filtre, chip. */
  tap()         { fire(15); },
  /** Action confirmée sans gravité : ajout à une liste, note changée. */
  light()       { fire(25); },
  /** Déclenchement d'un long-press. */
  longPress()   { fire(40); },
  /** Action significative : suppression, abandon, swipe validé. */
  medium()      { fire(30); },
  /** Succès notable : épisode marqué, saison qui avance. */
  success()     { fire([20, 40, 20]); },
  /** Grande célébration : saison ou série terminée. */
  celebration() { fire([30, 60, 30, 60, 50]); },
  /** Échec / erreur : sync ratée, action refusée. */
  error()       { fire([50, 40, 50]); },
};
