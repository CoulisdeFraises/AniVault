import { useMemo, useEffect, useRef, useState, useCallback } from "react";
import { useLibrary } from "../context/LibraryContext";
import { ACHIEVEMENTS, computeUnlocked } from "../utils/achievements";

const STORAGE_KEY = "anivault:achievements:unlocked";

function loadSeen() {
  try {
    return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

function saveSeen(set) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
}

export function useAchievements() {
  const { entries, loading } = useLibrary();

  const unlocked   = useMemo(() => computeUnlocked(entries), [entries]);
  const initialized = useRef(false);          // vrai après le 1er chargement réel
  const seenRef    = useRef(loadSeen());      // succès déjà vus (persiste)

  // File d'attente des toasts + toast courant
  const [queue,        setQueue]        = useState([]);
  const [currentToast, setCurrentToast] = useState(null);

  // ── Détection des nouveaux succès ─────────────────────────────────────────
  useEffect(() => {
    if (loading) return; // bibliothèque pas encore chargée

    if (!initialized.current) {
      // Premier chargement : on prend le snapshot sans afficher de toast
      initialized.current = true;
      unlocked.forEach((a) => seenRef.current.add(a.id));
      saveSeen(seenRef.current);
      return;
    }

    const newOnes = unlocked.filter((a) => !seenRef.current.has(a.id));
    if (newOnes.length === 0) return;

    newOnes.forEach((a) => seenRef.current.add(a.id));
    saveSeen(seenRef.current);
    setQueue((q) => [...q, ...newOnes]);
  }, [unlocked, loading]);

  // ── Défilement de la file de toasts (1 à la fois) ────────────────────────
  useEffect(() => {
    if (currentToast || queue.length === 0) return;
    const [next, ...rest] = queue;
    setCurrentToast(next);
    setQueue(rest);
  }, [queue, currentToast]);

  const dismissToast = useCallback(() => setCurrentToast(null), []);

  return {
    allAchievements: ACHIEVEMENTS,
    unlocked,
    unlockedIds:     new Set(unlocked.map((a) => a.id)),
    currentToast,
    dismissToast,
  };
}