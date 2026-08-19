// src/api/crossRef.js
//
// Rattachement croisé AniList ↔ TMDB, pour les FILMS uniquement — le seul
// cas où une même œuvre peut se retrouver dans la bibliothèque sous un ID
// et un titre totalement différents selon la source d'ajout :
//   - ajouté via la recherche "Film" (TMDB) → titre français, ex.
//     « Les enfants du temps », tmdbId renseigné, AUCUN anilistId
//   - reproposé plus tard en recommandation "Anime" (AniList) → titre
//     anglais/romaji, ex. « Weathering With You »
// Les deux titres n'ayant aucun texte en commun, aucune normalisation ni
// recherche floue ne peut les relier : il faut une recherche croisée sur
// l'autre API pour retrouver le bon ID (et, côté AniList → TMDB, le vrai
// titre français à afficher — AniList n'expose que romaji/anglais).
//
// Sert à deux choses :
//   1. Détecter les doublons croisés, y compris quand l'entrée de
//      bibliothèque n'a AUCUN ID externe (ex : ajoutée via le formulaire
//      manuel) — on compare alors le TITRE résolu par la recherche croisée,
//      pas seulement l'ID.
//   2. Afficher le bon titre (français) sur les recos de films d'anime
//      côté AniList, qui n'ont sinon que l'anglais/romaji.
//
// Les résultats des deux fonctions ci-dessous passent déjà par le cache
// existant de searchAniList/searchTMDBMovies, donc les appels répétés
// (ex : au chargement de la page recommandations) restent bon marché.
//
// GARDE-FOU : on ne peut PAS valider un match en comparant le texte du
// titre cherché à celui du résultat — c'est précisément parce que ces deux
// titres sont censés être différents (langues différentes) que la
// recherche croisée existe. Un texte proche prouverait juste que la
// recherche a mal cherché. À la place, on valide par l'ANNÉE de sortie,
// un signal fiable et indépendant de la langue que les deux APIs exposent.
// Sans ce garde-fou, la recherche plein-texte de TMDB peut remonter un
// résultat sans rapport dont le titre partage juste quelques mots avec la
// requête (ex : chercher « Weathering With You » a pu remonter un ouvrage
// sur le modélisme ferroviaire titré « Weathering Railroad Models With
// Malcolm Furlow » — même mot "weathering", film totalement différent).
import { searchTMDBMovies } from "./tmdb";
import { searchAniList }    from "./anilist";

function isPlausibleYear(expectedYear, candidateYear) {
  if (expectedYear == null || candidateYear == null) return true; // pas assez d'info pour trancher, on garde le comportement précédent
  return Math.abs(expectedYear - candidateYear) <= 1;
}

/**
 * Essaie de retrouver la fiche AniList d'un film, à partir d'une liste de
 * titres candidats (du plus fiable au moins fiable — idéalement le titre
 * original/romaji en premier, le titre affiché en dernier recours) et,
 * si connue, de l'année de sortie attendue (filtre les faux positifs).
 * Retourne le meilleur résultat ({ id, title, ... }), ou null.
 */
export async function findAniListMovie(titles, expectedYear = null) {
  for (const t of titles) {
    if (!t) continue;
    try {
      const results = await searchAniList(t);
      const top = results?.[0];
      if (top && isPlausibleYear(expectedYear, top.year)) return top;
    } catch {
      // on tente le titre candidat suivant
    }
  }
  return null;
}

/**
 * Essaie de retrouver la fiche TMDB (film) correspondant à un titre
 * d'anime, à partir d'une liste de titres candidats (romaji/anglais en
 * priorité) et, si connue, de l'année de sortie attendue (filtre les faux
 * positifs). Retourne le meilleur résultat ({ id, title, ... } — le titre
 * est déjà en français, TMDB étant interrogé en fr-FR), ou null.
 */
export async function findTmdbMovie(titles, expectedYear = null) {
  for (const t of titles) {
    if (!t) continue;
    try {
      const results = await searchTMDBMovies(t);
      const top = results?.[0];
      if (top && isPlausibleYear(expectedYear, top.year)) return top;
    } catch {
      // on tente le titre candidat suivant
    }
  }
  return null;
}
