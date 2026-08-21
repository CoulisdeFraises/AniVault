// src/components/common/ListIcon.jsx
//
// Icône d'une liste, sans emoji : cœur (HeartIcon) pour la Cachette secrète,
// cœur plein (lucide) pour les Favoris, dossier pour les listes perso.
// Le champ `list.emoji` reste en base (compat sync/export) mais n'est plus
// utilisé pour l'affichage.
import { Heart, Database } from "lucide-react";
import { HeartIcon } from "./icons";
import { HIDDEN_LIST_ID } from "../../context/ListsContext";

export function ListIcon({ list, size = 16, className = "" }) {
  if (list.id === HIDDEN_LIST_ID) {
    return <HeartIcon size={size} className={`text-pink-400 ${className}`} />;
  }
  if (list.isFavorites) {
    return <Heart size={size} className={`text-pink-300 ${className}`} fill="currentColor" />;
  }
  return <Database size={size} className={`text-violet-400 ${className}`} />;
}
