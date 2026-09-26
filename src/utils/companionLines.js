// src/utils/companionLines.js
//
// Pool de répliques du compagnon, par catégorie. Chaque ligne peut contenir
// des tokens {nom} remplacés dynamiquement via pickCompanionLine().
// Une ligne est piochée au hasard dans le pool de sa catégorie à chaque
// déclenchement (évite la répétition immédiate si le pool fait 4-6 lignes).
//
// COMPANION_LINES est le pool générique (utilisé par tous les compagnons).
// COMPANION_LINE_OVERRIDES ajoute des répliques propres au caractère d'un
// compagnon donné (ex. Chlo : drôle, incisive, ironique, chaotique, lazy) —
// piochées EN PLUS du pool générique pour ce compagnon, plutôt qu'à sa
// place, pour garder de la variété.

import { getCompanion } from "./companions";

export const COMPANION_LINES = {
  achievement: [
    "Nouveau succès : {name} ! Tu m'impressionnes.",
    "{name} débloqué. Pas mal du tout.",
    "Encore un trophée pour la collection : {name} !",
    "{name}... tu commences à devenir dangereux(se).",
  ],
  finished: [
    "{title}, terminé ! Alors, c'était comment ?",
    "Tu viens de finir {title}. Un de plus sur la pile !",
    "{title} bouclé. Tu veux enchaîner sur autre chose ?",
    "Voilà, {title} finit ! C'est dans la boîte !",
  ],
  // Titre encore en diffusion dont on vient de rattraper tous les épisodes
  // sortis (≠ "finished" : la suite arrive, il faut juste attendre).
  caughtUp: [
    "{title} : tu es à jour ! Plus qu'à attendre l'épisode {episode}.",
    "À jour sur {title}. Aucun spoiler à craindre, profites-en !",
    "Rattrapé ! {title} n'a plus une once d'avance sur toi.",
    "{title}, à jour. Rendez-vous à la prochaine diffusion !",
    "Tu as rattrapé {title}. L'épisode {episode} se fait désirer, hein ?",
  ],
  streakRecord: [
    "{streak} jours d'affilée — nouveau record ! Impressionnant.",
    "Tu viens de battre ton record : {streak} jours de suite.",
    "{streak} jours. Personne ne t'arrête, on dirait.",
  ],
  streakLost: [
    "Ta série de jours s'est arrêtée là. Ça arrive, on repart de zéro.",
    "Streak terminée pour cette fois. On se remet dedans ?",
    "Bon, la série est cassée — mais rien n'empêche d'en commencer une autre.",
    "T'as rompu la streak nullos !"
  ],
  streakDanger: [
    "Ta streak de {streak} jours tient encore à un fil ce soir...",
    "Plus beaucoup de temps pour sauver tes {streak} jours de suite !",
    "{streak} jours en jeu — un épisode et c'est réglé.",
  ],
  newEntry: [
    "{title} ajouté à ta liste. Bon choix ?",
    "Une nouvelle entrée : {title}. On regarde ça quand ?",
    "{title} rejoint la collection. À voir quand tu t'y mets !",
  ],
  comeback: [
    "Ça faisait {days} jours ! Content(e) de te revoir.",
    "{days} jours sans nouvelles... tout va bien ?",
    "Retour après {days} jours d'absence. Je commençais à m'inquiéter !",
    "Eeeeeeeh !!! Ça fait {days} jours ! T'étais où ?!",

  ],
  idle: [
    "Alors, on regarde quoi aujourd'hui ?",
    "Ta bibliothèque n'attend que toi.",
    "Prêt(e) pour un épisode ou deux ?",
    "Toujours là ! Une petite suggestion : reprends ce que tu as en cours.",
  ],
};

// Répliques spécifiques à Chlo — "la petite démone" : drôle, incisive,
// ironique, un peu chaotique, et fondamentalement flemmarde. Ajoutées au
// pool générique ci-dessus quand Chlo est le compagnon actif.
const CHLO_LINES = {
  achievement: [
    "{name} débloqué. Même moi je suis vaguement fière, c'est dire.",
    "Oh wow, {name}. Quelqu'un a enfin un but dans la vie.",
    "{name}... alerte générale, l'utilisateur a des ambitions.",
    "Franchement {name}, je m'attendais à pire de ta part.",
  ],
  finished: [
    "{title} terminé. Tu vas faire semblant d'avoir une vie sociale maintenant ?",
    "Aaah, {title} plié. Bon, next épisode... euh, next série, je veux dire.",
    "{title}, dans la boîte. Moi je retourne dormir, bon courage pour la suite.",
    "Terminé {title} ? Émotionnellement dévasté(e) ou juste vide comme d'hab ?",
  ],
  caughtUp: [
    "À jour sur {title}. Tu peux enfin arrêter de fuir les spoilers, bravo.",
    "{title} rattrapé. Maintenant tu attends comme tout le monde. Bienvenue au club de la frustration.",
    "Plus rien à voir sur {title} avant l'épisode {episode}. Parfait, ça laisse le temps d'une sieste.",
    "Tu es à jour sur {title}. Première fois que t'es dans les temps pour quelque chose, non ?",
    "{title} : à jour. Je te connais, tu seras là à la seconde où l'épisode {episode} sort.",
  ],
  streakRecord: [
    "{streak} jours d'affilée. C'est fort mais je fais mieux de mon côté.",
    "Nouveau record : {streak} jours. T'as vraiment rien d'autre à faire, hein ?",
    "{streak} jours de suite, même moi je suis impressionnée, et c'est dire si c'est difficile.",
    "{streak} jours de suite, pas mal, mais si tu cherches à m'impressionner va falloir faire mieux !",
  ],
  streakLost: [
    "Bon, la streak est morte. On la pleurera pas vu comment tu t'en occupes.",
    "Série cassée. C'est pas comme si je t'avais prévenu(e) genre 50 fois.",
    "R.I.P ta streak. Elle a bien vécu, vu tes horaires de sommeil.",
    "Compteur de streak à 0, loser.",
    "Ta streak : 'Veni, vedi, vici.' C'est elle qui t'a battu cette fois.",
  ],
  streakDanger: [
    "Ta streak de {streak} jours agonise, mais bon, fais comme tu veux.",
    "{streak} jours en jeu ce soir. Moi je dis rien, je regarde juste le désastre approcher.",
    "Encore un peu et ta streak de {streak} jours part en fumée. Juste FYI, hein.",
    "Tu vas t'occuper de ta streak ou la laisser crever ? {streak} jours, allez un petit effort non ?"
  ],
  newEntry: [
    "{title} ajouté. Encore un truc que tu ne finiras jamais, statistiquement.",
    "{title}, dans la pile. C'est plus une pile !.. C'est un tas!.. C'est un un mont!.. Que dis-je, c'est une... une.. Je sais pas en fait mais c'est trop là...",
    "Tiens, {title}. Ambitieux(se) aujourd'hui, on dirait.",
  ],
  comeback: [
    "{days} jours d'absence et je t'en veux même pas, j'ai fait une sieste de {days} jours aussi.",
    "Ah, tu reviens après {days} jours. J'avais presque oublié ton visage.",
    "{days} jours sans toi... j'ai survécu, contre toute attente.",
  ],
  idle: [
    "Bon, tu fais quelque chose ou tu comptes juste me fixer ?",
    "J'ai zéro suggestion utile aujourd'hui, mais je suis là quand même.",
    "Techniquement je devrais te motiver là... bon courage avec ça.",
    "Franchement, un épisode, c'est pas la mort. Vas-y, bouge.",
  ],
};

const COMPANION_LINE_OVERRIDES = {
  chlo: CHLO_LINES,
};

/** Remplace les tokens {clé} d'une ligne par les valeurs de `vars`. */
function interpolate(line, vars) {
  return line.replace(/\{(\w+)\}/g, (_, key) => (vars[key] != null ? String(vars[key]) : ""));
}

/** Pioche une ligne au hasard dans la catégorie (pool générique + répliques
 * propres au compagnon actif, s'il en a) et l'interpole avec `vars`. */
export function pickCompanionLine(category, vars = {}) {
  const base = COMPANION_LINES[category] || [];
  // Même résolution du compagnon actif que resolveCompanion() (Rating.jsx),
  // dupliquée ici pour ne pas faire dépendre ce module utilitaire d'un
  // fichier de composant.
  const companionId =
    (typeof localStorage !== "undefined" ? localStorage.getItem("pref_companion") : null) || "default";
  const extra = COMPANION_LINE_OVERRIDES[getCompanion(companionId).id]?.[category] || [];
  const pool = [...base, ...extra];
  if (!pool.length) return null;
  const line = pool[Math.floor(Math.random() * pool.length)];
  return interpolate(line, vars);
}
