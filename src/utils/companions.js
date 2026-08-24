// Compagnons — personnalisation du profil qui change les émojis de note.

// Liste des compagnons
export const COMPANIONS = [
  {
    id: "default",
    name: "Classique",
    description: "Le jeu d'émojis par défaut.",
    swatch: "#a78bfa",
    imageFolder: null, // Pas de dossier personnalisé
  },
  {
    id: "chlo",
    name: "Chlo",
    description: "La petite démone.",
    swatch: "#818cf8",
    imageFolder: "/companions/chlo", // CORRECTION : Pointe vers le dossier réel des images
  },
  {
    id: "sora",
    name: "Sora",
    description: "Un compagnon solaire.",
    swatch: "#fbbf24",
    imageFolder: null,
  },
];

// Émojis de fallback (pour le cas où les images ne sont pas chargées)
export const RATING_EMOJIS = {
  default: ["😭", "😞", "😐", "😊", "😁", "🤩"],
  chlo:   ["😿", "😾", "😼", "😺", "😸", "😻"],
  sora:   ["🥱", "😑", "🙂", "😃", "😄", "🌟"],
};

/**
 * Récupère le compagnon par ID.
 * Utilisé pour déterminer les préférences (images ou émojis).
 */
export function getCompanion(id) {
  return COMPANIONS.find((c) => c.id === id) || COMPANIONS[0];
}
