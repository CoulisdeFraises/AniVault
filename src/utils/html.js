// src/utils/html.js
//
// Les synopsis renvoyés par AniList (GraphQL) contiennent souvent du HTML
// brut (<br>, <i>, <b>...) destiné à leur propre site — jamais nettoyé côté
// API. TMDB/Jikan sont généralement déjà en texte brut, mais peuvent malgré
// tout contenir quelques entités HTML. Comme ces objets `rec` sont affichés
// tels quels dans SynopsisModal (utilisée sur Recommandations, Détails,
// Recherche, Calendrier des films...), on nettoie une seule fois ici plutôt
// que dans chaque page/appel API.

const ENTITIES = {
  "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": "\"", "&#39;": "'",
  "&apos;": "'", "&nbsp;": " ", "&mdash;": "—", "&ndash;": "–", "&hellip;": "…",
};

/**
 * Retire les balises HTML d'un texte et décode les entités les plus
 * courantes. Les <br> deviennent des sauts de ligne pour ne pas coller deux
 * phrases distinctes.
 */
export function stripHtml(html) {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&amp;|&lt;|&gt;|&quot;|&#39;|&apos;|&nbsp;|&mdash;|&ndash;|&hellip;/g, (m) => ENTITIES[m])
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
