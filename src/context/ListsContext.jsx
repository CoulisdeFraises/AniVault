import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "./AuthContext";

const ListsContext = createContext(null);
const SAVE_DEBOUNCE_MS = 800;
export const FAVORITES_ID   = "favorites";
export const HIDDEN_LIST_ID = "cachette-secrete";

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

function ensureSpecialLists(raw) {
  const fav     = raw.find(l => l.isFavorites)           || createFavoritesList();
  const hidden  = raw.find(l => l.id === HIDDEN_LIST_ID) || createHiddenList();
  const normals = raw.filter(l => !l.isFavorites && l.id !== HIDDEN_LIST_ID);
  return [fav, ...normals, hidden];
}

export function ListsProvider({ children }) {
  const { user } = useAuth();
  const [lists,   setListsState] = useState([]);
  const [loading, setLoading]    = useState(true);
  const listsRef  = useRef([]);
  const saveTimer = useRef(null);

  useEffect(() => {
    if (!user) { setListsState([]); setLoading(false); return; }
    setLoading(true);
    supabase
      .from("libraries")
      .select("lists")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) console.error("[AniVault] Erreur chargement lists:", error);
        const raw   = Array.isArray(data?.lists) ? data.lists : [];
        const final = ensureSpecialLists(raw);
        applyLists(final);
        setLoading(false);
      });
  }, [user?.id]);

  function applyLists(next) {
    listsRef.current = next;
    setListsState(next);
  }

  /**
   * FIX : on utilise upsert({ user_id, lists }) exactement comme
   * LibraryContext utilise upsert({ user_id, entries }).
   *
   * - Si la ligne n'existe pas → INSERT avec lists = next, entries = [] (default DB)
   * - Si la ligne existe → UPDATE SET lists = next  (entries n'est PAS touché)
   *
   * L'ancien code utilisait .update() qui ne génère aucune erreur quand
   * aucune ligne ne correspond, donc le fallback insert ne se déclenchait jamais.
   */
  async function saveToSupabase(next) {
    if (!user) return;
    const { error } = await supabase
      .from("libraries")
      .upsert(
        { user_id: user.id, lists: next },
        { onConflict: "user_id" }
      );
    if (error) console.error("[AniVault] Erreur sauvegarde lists:", error);
  }

  function persist(next) {
    const ordered = ensureSpecialLists(next);
    applyLists(ordered);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(
      () => saveToSupabase(listsRef.current),
      SAVE_DEBOUNCE_MS
    );
  }

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
  }, []);

  const deleteList = useCallback((listId) => {
    if (listId === FAVORITES_ID || listId === HIDDEN_LIST_ID) return;
    persist(listsRef.current.filter(l => l.id !== listId));
  }, []);

  const renameList = useCallback((listId, name) => {
    if (listId === HIDDEN_LIST_ID) return;
    persist(listsRef.current.map(l =>
      l.id === listId ? { ...l, name: name.trim(), updatedAt: Date.now() } : l
    ));
  }, []);

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
  }, []);

  const removeEntryFromList = useCallback((listId, entryId) => {
    persist(listsRef.current.map(l =>
      l.id !== listId
        ? l
        : { ...l, entries: l.entries.filter(e => e.entryId !== entryId), updatedAt: Date.now() }
    ));
  }, []);

  const isInList = useCallback(
    (listId, entryId) =>
      (listsRef.current.find(l => l.id === listId)?.entries || []).some(e => e.entryId === entryId),
    []
  );

  const isInFavorites  = useCallback((entryId) => isInList(FAVORITES_ID, entryId),   [isInList]);
  const isInHiddenList = useCallback((entryId) => isInList(HIDDEN_LIST_ID, entryId), [isInList]);

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

export async function fetchUserFavorites(userId) {
  const { data } = await supabase
    .from("libraries")
    .select("lists")
    .eq("user_id", userId)
    .maybeSingle();
  const lists = Array.isArray(data?.lists) ? data.lists : [];
  return lists.find(l => l.isFavorites) || null;
}