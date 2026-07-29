import { anilistQuery } from "./anilist";
import { getMediaDetails } from "./media";

function isCultureModeOn() {
  return localStorage.getItem("pref_culture_mode") === "true";
}

function mapMedia(m) {
  return {
    source:      "anilist",
    id:          m.id,
    title:       m.title.english || m.title.romaji,
    image:       m.coverImage?.large,
    genres:      m.genres || [],
    episodes:    m.episodes,
    year:        m.seasonYear,
    score:       m.averageScore,
    description: m.description,
    isAdult:     m.isAdult || false,
  };
}

// Récupère des recommandations AniList basées sur les genres fournis
// et exclut les IDs déjà dans la bibliothèque.
// Utilisé pour les recommandations générales (basées sur les goûts globaux).
export async function fetchAniListRecommendations(genres = [], excludeAnilistIds = []) {
  if (!genres.length) return [];
  const cultureMode = isCultureModeOn();

  const query = `
    query ($genres: [String], $page: Int) {
      Page(page: $page, perPage: 30) {
        media(
          genre_in: $genres
          type: ANIME
          sort: POPULARITY_DESC
          status_in: [FINISHED, RELEASING]
          format_in: [TV, TV_SHORT, OVA, ONA, MOVIE]
        ) {
          id
          title { english romaji }
          coverImage { large }
          genres
          episodes
          description(asHtml: false)
          seasonYear
          averageScore
          isAdult
        }
      }
    }
  `;

  try {
    const json = await anilistQuery(query, { genres, page: 1 });
    const media = json.data?.Page?.media || [];
    return media
      .filter((m) => !excludeAnilistIds.includes(m.id))
      .filter((m) => cultureMode || !m.isAdult)
      .slice(0, 24)
      .map(mapMedia);
  } catch {
    return [];
  }
}

// Récupère les "titres similaires" à une œuvre précise via le graphe de
// recommandations AniList (votes communautaires "si tu as aimé X, tu aimeras Y").
// Beaucoup plus pertinent qu'un simple filtre par genre car spécifique au titre,
// et fonctionne aussi bien pour du contenu adulte (hentai) puisqu'on part du
// titre lui-même plutôt que d'une liste de genres génériques.
//
// Passe par le cache partagé (fonction Edge Supabase) : la fiche de `anilistId`
// est très probablement déjà en cache (consultée via Details.jsx), donc cet
// appel ne déclenche souvent aucune requête réseau supplémentaire.
export async function fetchSimilarTitles(anilistId, excludeAnilistIds = []) {
  if (!anilistId) return [];
  const cultureMode = isCultureModeOn();

  try {
    const media = await getMediaDetails("anilist", anilistId);
    const nodes = media?.recommendations?.nodes || [];
    const similar = nodes
      .map((n) => n.mediaRecommendation)
      .filter(Boolean)
      .filter((m) => !excludeAnilistIds.includes(m.id))
      .filter((m) => cultureMode || !m.isAdult);

    // Filet de sécurité : si le titre est trop récent/confidentiel pour avoir
    // des recommandations communautaires, on complète avec ses propres genres.
    if (similar.length < 6 && media?.genres?.length) {
      const fallback = await fetchAniListRecommendations(
        media.genres,
        [...excludeAnilistIds, anilistId, ...similar.map((m) => m.id)]
      );
      return [...similar.map(mapMedia), ...fallback].slice(0, 20);
    }

    return similar.slice(0, 20).map(mapMedia);
  } catch {
    return [];
  }
}