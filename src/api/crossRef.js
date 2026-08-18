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

import { searchTMDBMovies } from "./tmdb";
import { searchAniList }    from "./anilist";

/**
 * Essaie de retrouver la fiche AniList d'un film, à partir d'une liste de
 * titres candidats (du plus fiable au moins fiable — idéalement le titre
 * original/romaji en premier, le titre affiché en dernier recours).
 * Retourne le meilleur résultat ({ id, title, ... }), ou null.
 */
export async function findAniListMovie(...titles) {
  for (const t of titles) {
    if (!t) continue;
    try {
      const results = await searchAniList(t);
      if (results?.[0]) return results[0];
    } catch {
      // on tente le titre candidat suivant
    }
  }
  return null;
}

/**
 * Essaie de retrouver la fiche TMDB (film) correspondant à un titre
 * d'anime, à partir d'une liste de titres candidats (romaji/anglais en
 * priorité). Retourne le meilleur résultat ({ id, title, ... } — le titre
 * est déjà en français, TMDB étant interrogé en fr-FR), ou null.
 */
export async function findTmdbMovie(...titles) {
  for (const t of titles) {
    if (!t) continue;
    try {
      const results = await searchTMDBMovies(t);
      if (results?.[0]) return results[0];
    } catch {
      // on tente le titre candidat suivant
    }
  }
  return null;
}
