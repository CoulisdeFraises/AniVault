import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "./AuthContext";

const ListsContext = createContext(null);
export const FAVORITES_ID   = "favorites";
export const HIDDEN_LIST_ID = "cachette-secrete";

// ── Persistance localStorage (clé par utilisateur) ───────────────────────────
function storageKey(userId) {
  return `anivault:${userId}:lists`;
}

function loadFromStorage(userId) {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveToStorage(userId, lists) {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(lists));
  } catch (e) {
    console.warn("[AniVault] Impossible de sauvegarder les listes :", e);
  }
}

// ── Listes spéciales (toujours présentes) ────────────────────────────────────
function createFavoritesList() {
  return {
    id: FAVORITES_ID,
    name: "Favoris",
    emoji: "♡",
    isFavorites: true,
    isHidden: false,
    entries: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function createHiddenList() {
  return {
    id: HIDDEN_LIST_ID,
    name: "Cachette secrète",
    emoji: "🙈",
    isFavorites: false,
    isHidden: true,
    entries: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Garantit que les deux listes système existent et sont dans le bon ordre :
 * [Favoris, ...listes normales..., Cachette secrète]
 */
function ensureSpecialLists(raw) {
  const fav     = raw.find(l => l.isFavorites)           || createFavoritesList();
  const hidden  = raw.find(l => l.id === HIDDEN_LIST_ID) || createHiddenList();
  const normals = raw.filter(l => !l.isFavorites && l.id !== HIDDEN_LIST_ID);
  return [fav, ...normals, hidden];
}

// ── Provider ─────────────────────────────────────────────────────────────────
export function ListsProvider({ children }) {
  const { user } = useAuth();
  const [lists,   setListsState] = useState([]);
  const [loading, setLoading]    = useState(true);
  const listsRef = useRef([]);

  // Chargement depuis localStorage à chaque changement d'utilisateur
  useEffect(() => {
    if (!user) {
      setListsState([]);
      setLoading(false);
      return;
    }
    const raw   = loadFromStorage(user.id);
    const final = ensureSpecialLists(raw);
    listsRef.current = final;
    setListsState(final);
    setLoading(false);
  }, [user?.id]);

  /**
   * Sauvegarde immédiate + synchrone en localStorage.
   * Aucune promesse, aucun délai, aucune dépendance réseau.
   */
  function persist(next) {
    const ordered = ensureSpecialLists(next);
    listsRef.current = ordered;
    setListsState(ordered);
    if (user) saveToStorage(user.id, ordered);
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  const createList = useCallback((name, emoji = "📋") => {
    const id = Date.now().toString();
    const newList = {
      id,
      name:        name.trim(),
      emoji,
      isFavorites: false,
      isHidden:    false,
      entries:     [],
      createdAt:   Date.now(),
      updatedAt:   Date.now(),
    };
    persist([...listsRef.current, newList]);
    return id;
  }, [user]);

  const deleteList = useCallback((listId) => {
    if (listId === FAVORITES_ID || listId === HIDDEN_LIST_ID) return;
    persist(listsRef.current.filter(l => l.id !== listId));
  }, [user]);

  const renameList = useCallback((listId, name) => {
    if (listId === HIDDEN_LIST_ID) return;
    persist(listsRef.current.map(l =>
      l.id === listId ? { ...l, name: name.trim(), updatedAt: Date.now() } : l
    ));
  }, [user]);

  const addEntryToList = useCallback((listId, entry) => {
    persist(listsRef.current.map(l => {
      if (l.id !== listId) return l;
      if (l.entries.some(e => e.entryId === entry.id)) return l;
      return {
        ...l,
        entries: [...l.entries, {
          entryId:    entry.id,
          title:      entry.title,
          coverImage: entry.coverImage || entry.seasons?.[0]?.coverImage || null,
          type:       entry.type,
          addedAt:    Date.now(),
        }],
        updatedAt: Date.now(),
      };
    }));
  }, [user]);

  const removeEntryFromList = useCallback((listId, entryId) => {
    persist(listsRef.current.map(l =>
      l.id !== listId
        ? l
        : { ...l, entries: l.entries.filter(e => e.entryId !== entryId), updatedAt: Date.now() }
    ));
  }, [user]);

  const isInList = useCallback(
    (listId, entryId) =>
      (listsRef.current.find(l => l.id === listId)?.entries || []).some(e => e.entryId === entryId),
    []
  );

  const isInFavorites = useCallback(
    (entryId) => isInList(FAVORITES_ID, entryId),
    [isInList]
  );

  const isInHiddenList = useCallback(
    (entryId) => isInList(HIDDEN_LIST_ID, entryId),
    [isInList]
  );

  const toggleFavorite = useCallback((entry) => {
    if (isInFavorites(entry.id)) removeEntryFromList(FAVORITES_ID, entry.id);
    else addEntryToList(FAVORITES_ID, entry);
  }, [isInFavorites, addEntryToList, removeEntryFromList]);

  const toggleHidden = useCallback((entry) => {
    if (isInHiddenList(entry.id)) removeEntryFromList(HIDDEN_LIST_ID, entry.id);
    else addEntryToList(HIDDEN_LIST_ID, entry);
  }, [isInHiddenList, addEntryToList, removeEntryFromList]);

  return (
    <ListsContext.Provider value={{
      lists, loading,
      createList, deleteList, renameList,
      addEntryToList, removeEntryFromList,
      isInList, isInFavorites, isInHiddenList,
      toggleFavorite, toggleHidden,
      FAVORITES_ID, HIDDEN_LIST_ID,
    }}>
      {children}
    </ListsContext.Provider>
  );
}

export function useLists() {
  const ctx = useContext(ListsContext);
  if (!ctx) throw new Error("useLists must be used within ListsProvider");
  return ctx;
}

// Conservé pour la compatibilité des imports dans Profile/Community
// (uniquement pour le propre utilisateur connecté — localStorage est local)
export function fetchUserFavorites(userId) {
  try {
    const raw   = localStorage.getItem(`anivault:${userId}:lists`);
    const lists = raw ? JSON.parse(raw) : [];
    return Promise.resolve(lists.find(l => l.isFavorites) || null);
  } catch {
    return Promise.resolve(null);
  }
}