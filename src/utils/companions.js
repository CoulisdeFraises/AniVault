// Compagnons — personnalisation du profil qui change les émojis de note.
//
// Les émojis ci-dessous sont des PLACEHOLDERS en attendant les ressources
// personnalisées (dessins). Pour brancher de vraies images plus tard :
//   1. Dépose les fichiers dans /public/companions/<id>/rating-0.png … rating-5.png
//   2. Dans getRatingIcon() (Rating.jsx), remplace le <span>{emoji}</span>
//      par <img src={`/companions/${companionId}/rating-${band}.png`} .../>
//   3. Le reste du système (sélection, sauvegarde, affichage) ne change pas.

export const COMPANIONS = [
  {
    id: "default",
    name: "Classique",
    description: "Le jeu d'émojis par défaut.",
    swatch: "#a78bfa",
  },
  {
    id: "luna",
    name: "Luna",
    description: "Un compagnon lunaire — à personnaliser avec tes propres dessins.",
    swatch: "#818cf8",
  },
  {
    id: "sora",
    name: "Sora",
    description: "Un compagnon solaire — à personnaliser avec tes propres dessins.",
    swatch: "#fbbf24",
  },
];

// 6 tranches de note (≤2, ≤4, =5, ≤7, ≤9, >9) — mêmes seuils que l'ancien
// getRatingEmoji, un jeu d'émojis différent par compagnon.
export const RATING_EMOJIS = {
  default: ["😭", "😞", "😐", "😊", "😁", "🤩"],
  // Placeholders "Luna" — à remplacer par les dessins personnalisés
  luna:    ["😿", "😾", "😼", "😺", "😸", "😻"],
  // Placeholders "Sora" — à remplacer par les dessins personnalisés
  sora:    ["🥱", "😑", "🙂", "😃", "😄", "🌟"],
};

export function getCompanion(id) {
  return COMPANIONS.find((c) => c.id === id) || COMPANIONS[0];
}
