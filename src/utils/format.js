/**
 * Retourne le groupe d'affichage d'un format AniList/TVmaze.
 * TV_SHORT est volontairement inclus dans "tv" :
 * les animes courts (ex : Cool Doji Danshi) ont format="TV_SHORT"
 * mais doivent se comporter comme des saisons TV normales.
 */
export function getFormatGroup(f) {
  if (!f || f === "TV" || f === "TV_SHORT") return "tv";
  if (f === "MOVIE") return "movie";
  return "extra";
}