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
// l'autre API pour retrouver le bon ID et casser l'ambiguïté.
//
// Les résultats des deux fonctions ci-dessous passent déjà par le cache
// existant de searchAniList/searchTMDBMovies, donc les appels répétés
// (ex : au chargement de la page recommandations) restent bon marché.

import { searchTMDBMovies } from "./tmdb";
import { searchAniList }    from "./anilist";

/**
 * Essaie de retrouver l'ID AniList d'un film, à partir d'une liste de
 * titres candidats (du plus fiable au moins fiable — idéalement le titre
 * original/romaji en premier, le titre affiché en dernier recours).
 * Retourne le premier match trouvé, ou null.
 */
export async function findAniListMovieId(...titles) {
  for (const t of titles) {
    if (!t) continue;
    try {
      const results = await searchAniList(t);
      if (results?.[0]?.id) return results[0].id;
    } catch {
      // on tente le titre candidat suivant
    }
  }
  return null;
}

/**
 * Essaie de retrouver l'ID TMDB (film) correspondant à un titre d'anime,
 * à partir d'une liste de titres candidats (romaji/anglais en priorité).
 * Retourne le premier match trouvé, ou null.
 */
export async function findTmdbMovieId(...titles) {
  for (const t of titles) {
    if (!t) continue;
    try {
      const results = await searchTMDBMovies(t);
      if (results?.[0]?.id) return results[0].id;
    } catch {
      // on tente le titre candidat suivant
    }
  }
  return null;
}
