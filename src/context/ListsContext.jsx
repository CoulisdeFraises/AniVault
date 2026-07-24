import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "./AuthContext";

const ListsContext = createContext(null);
const SAVE_DEBOUNCE_MS = 800;
export const FAVORITES_ID = "favorites";

function createFavoritesList() {
  return {
    id: FAVORITES_ID,
    name: "Favoris",
    emoji: "♡",
    isFavorites: true,
    entries: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export function ListsProvider({ children }) {
  const { user } = useAuth();
  const [lists, setListsState] = useState([]);
  const [loading, setLoading]  = useState(true);
  const listsRef  = useRef([]);
  const saveTimer = useRef(null);

  useEffect(() => {
    if (!user) { setListsState([]); setLoading(false); return; }
    setLoading(true);
    supabase.from("libraries").select("lists").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => {
        const raw    = Array.isArray(data?.lists) ? data.lists : [];
        const hasFav = raw.some(l => l.isFavorites);
        const final  = hasFav ? raw : [createFavoritesList(), ...raw];
        applyLists(final);
        setLoading(false);
      });
  }, [user?.id]);

  function applyLists(next) { listsRef.current = next; setListsState(next); }

  async function saveToSupabase(next) {
    if (!user) return;
    await supabase.from("libraries").upsert({ user_id: user.id, lists: next });
  }

  function persist(next) {
    applyLists(next);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveToSupabase(listsRef.current), SAVE_DEBOUNCE_MS);
  }

  const createList = useCallback((name, emoji = "📋") => {
    const id = Date.now().toString();
    const newList = { id, name: name.trim(), emoji, isFavorites: false, entries: [], createdAt: Date.now(), updatedAt: Date.now() };
    persist([...listsRef.current, newList]);
    return id;
  }, []);

  const deleteList = useCallback((listId) => {
    if (listId === FAVORITES_ID) return;
    persist(listsRef.current.filter(l => l.id !== listId));
  }, []);

  const renameList = useCallback((listId, name) => {
    persist(listsRef.current.map(l => l.id === listId ? { ...l, name: name.trim(), updatedAt: Date.now() } : l));
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
      l.id !== listId ? l : { ...l, entries: l.entries.filter(e => e.entryId !== entryId), updatedAt: Date.now() }
    ));
  }, []);

  const isInList      = useCallback((listId, entryId) => (listsRef.current.find(l => l.id === listId)?.entries || []).some(e => e.entryId === entryId), []);
  const isInFavorites = useCallback((entryId) => isInList(FAVORITES_ID, entryId), [isInList]);

  const toggleFavorite = useCallback((entry) => {
    if (isInFavorites(entry.id)) removeEntryFromList(FAVORITES_ID, entry.id);
    else addEntryToList(FAVORITES_ID, entry);
  }, [isInFavorites, addEntryToList, removeEntryFromList]);

  return (
    <ListsContext.Provider value={{ lists, loading, createList, deleteList, renameList, addEntryToList, removeEntryFromList, isInList, isInFavorites, toggleFavorite, FAVORITES_ID }}>
      {children}
    </ListsContext.Provider>
  );
}

export function useLists() {
  const ctx = useContext(ListsContext);
  if (!ctx) throw new Error("useLists must be used within ListsProvider");
  return ctx;
}

// Fetch public des favoris d'un autre utilisateur
export async function fetchUserFavorites(userId) {
  const { data } = await supabase.from("libraries").select("lists").eq("user_id", userId).maybeSingle();
  const lists = Array.isArray(data?.lists) ? data.lists : [];
  return lists.find(l => l.isFavorites) || null;
}