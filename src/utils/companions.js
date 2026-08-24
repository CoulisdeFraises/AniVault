// Compagnons — personnalisation du profil qui change les émojis de note.
//
// Les émojis ci-dessous sont des PLACEHOLDERS en attendant les ressources
// personnalisées (dessins). Pour brancher de vraies images plus tard :
//   1. Dépose les fichiers dans /public/companions/<id>/rating-0.png … rating-5.png
//      OU, comme pour Chlo, dans un dossier personnalisé défini ci-dessous.
//   2. Dans getRatingIcon() (Rating.jsx), remplace le <span>{emoji}</span>
//      par <img src={`/companions/${companionId}/rating-${band}.png`} .../>
//      EN PRENANT EN COMPTE LA PROPRIÉTÉ 'imageFolder' SI PRÉSENTE.
//   3. Le reste du système (sélection, sauvegarde, affichage) ne change pas.

export const COMPANIONS = [
  {
    id: "default",
    name: "Classique",
    description: "Le jeu d'émojis par défaut.",
    swatch: "#a78bfa",
    imageFolder: null, // Pas de dossier d'images personnalisé
  },
  {
    id: "chlo",
    name: "Chlo",
    description: "La petite démone.",
    swatch: "#818cf8",
    imageFolder: "chlo", // <--- CHANGE: Indique que les images sont dans /public/chlo/
  },
  {
    id: "sora",
    name: "Sora",
    description: "Un compagnon solaire.",
    swatch: "#fbbf24",
    imageFolder: null,
  },
];

// Configuration des notes. Gardez les émojis pour le fallback, 
// mais notez que 'chlo' utilisera des images si configuré dans getRatingIcon().
export const RATING_EMOJIS = {
  default: ["😭", "😞", "😐", "😊", "😁", "🤩"],
  // Placeholder pour Chlo — à remplacer par les vraies images depuis le dossier 'imageFolder'
  chlo:   ["🖼️", "🖼️", "🖼️", "🖼️", "🖼️", "🖼️"], // Indique "Image ici" visuellement si besoin
  sora:   ["🥱", "😑", "🙂", "😃", "😄", "🌟"],
};

export function getCompanion(id) {
  return COMPANIONS.find((c) => c.id === id) || COMPANIONS[0];
}

// AJOUTER CETTE FONCTION SI RATING.JSX L'UTILISE
// Si Rating.jsx ne lit pas cette propriété, il doit être mis à jour pour construire le chemin :
// `getCompanion(id)?.imageFolder ? `/companions/${companion.imageFolder}` : `/companions/${id}``
