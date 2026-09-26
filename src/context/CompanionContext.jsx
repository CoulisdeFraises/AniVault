import { createContext, useContext, useCallback, useEffect, useRef, useState } from "react";
import { pickCompanionLine } from "../utils/companionLines";

// ── CompanionContext ─────────────────────────────────────────────────────
//
// Système de réactions du compagnon (façon visual novel) : sur certains
// événements (achievement débloqué, anime terminé, streak...), une bulle
// apparaît au centre de l'écran avec une réplique piochée dans
// utils/companionLines.js.
//
// Fonctionne en file d'attente (même pattern que useAchievements) : si
// plusieurs événements se déclenchent au même moment, ils s'affichent l'un
// après l'autre plutôt que de se chevaucher. Triée par priorité — un
// achievement passe avant un simple message d'accueil aléatoire.
//
// IMPORTANT : ce Provider doit englober LibraryProvider dans App.jsx, car
// LibraryContext appelle useCompanion() directement (ajout d'entrée, anime
// terminé). Voir l'ordre des providers dans App.jsx.

const CompanionContext = createContext(null);

// Plus le nombre est petit, plus la réaction est prioritaire dans la file.
const PRIORITY = {
  achievement:   1,
  finished:      2,
  caughtUp:      2,
  streakRecord:  3,
  streakLost:    4,
  streakDanger:  5,
  newEntry:      6,
  comeback:      7,
  idle:          8,
};

export function CompanionProvider({ children }) {
  const [queue, setQueue]     = useState([]);
  const [current, setCurrent] = useState(null);
  const nextId = useRef(0);

  // Marque les catégories déjà déclenchées dans CETTE session (onglet ouvert),
  // pour éviter par exemple qu'un idle random et un comeback s'affichent tous
  // les deux à l'ouverture. Reset à chaque rechargement de page (volontaire).
  const firedThisSession = useRef(new Set());

  const triggerCompanion = useCallback((category, vars = {}, opts = {}) => {
    const { allowRepeat = false } = opts;
    if (!allowRepeat && firedThisSession.current.has(category)) return;

    const text = pickCompanionLine(category, vars);
    if (!text) return;

    firedThisSession.current.add(category);

    const reaction = { id: nextId.current++, category, text, priority: PRIORITY[category] ?? 99 };
    setQueue((q) => [...q, reaction].sort((a, b) => a.priority - b.priority));
  }, []);

  // Fait avancer la file : appelé quand l'utilisateur ferme la bulle actuelle.
  const dismissCompanion = useCallback(() => {
    setCurrent(null);
  }, []);

  // Dépile la file dès que la place est libre (aucune bulle affichée).
  useEffect(() => {
    if (current || queue.length === 0) return;
    const [next, ...rest] = queue;
    setCurrent(next);
    setQueue(rest);
  }, [current, queue]);

  return (
    <CompanionContext.Provider value={{ current, triggerCompanion, dismissCompanion }}>
      {children}
    </CompanionContext.Provider>
  );
}

export function useCompanion() {
  const ctx = useContext(CompanionContext);
  if (!ctx) throw new Error("useCompanion doit être utilisé dans un CompanionProvider");
  return ctx;
}
