export const COMPANIONS = [
  {
    id: "default",
    name: "Classique",
    description: "Le jeu d'émojis par défaut.",
    swatch: "#a78bfa",
    imageFolder: null, 
  },
  {
    id: "chlo",
    name: "Chlo",
    description: "La petite démone.",
    swatch: "#818cf8",
    imageFolder: "/companions/chlo", // CORRECT : Le chemin absolu sans le préfixe /public/
  },
  {
    id: "sora",
    name: "Sora",
    description: "Un compagnon solaire.",
    swatch: "#fbbf24",
    imageFolder: null,
  },
];

export const RATING_EMOJIS = {
  default: ["😭", "😞", "😐", "😊", "😁", "🤩"],
  chlo:   ["😿", "😾", "😼", "😺", "😸", "😻"],
  sora:   ["🥱", "😑", "🙂", "😃", "😄", "🌟"],
};

export function getCompanion(id) {
  return COMPANIONS.find((c) => c.id === id) || COMPANIONS[0];
}
