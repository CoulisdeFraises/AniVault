import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "./AuthContext";

const ListsContext = createContext(null);
const SAVE_DEBOUNCE_MS = 800;
export const FAVORITES_ID   = "favorites";
export const HIDDEN_LIST_ID = "cachette-secrete";

function createFavoritesList() {
  return {
    id: FAVORITES_ID, name: "Favoris", emoji: "♡",
    isFavorites: true, isHidden: false,
    entries: [], createdAt: Date.now(), updatedAt: Date.now(),
  };
}

function createHiddenList() {
  return {
    id: HIDDEN_LIST_ID, name: "Cachette secrète", emoji: "🙈",
    isFavorites: false, isHidden: true,
    entries: [], createdAt: Date.now(), updatedAt: Date.now(),
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
  const userRef   = useRef(null); // ← ref pour éviter les problèmes de closure dans setTimeout

  useEffect(() => { userRef.current = user; }, [user]);

  // ── Chargement ────────────────────────────────────────────────────────────
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
        const raw = Array.isArray(data?.lists) ? data.lists : [];

        // Normalise chaque liste : garantit qu'entries est toujours un tableau
        const normalized = raw.map(l => ({
            ...l,
            entries: Array.isArray(l.entries) ? l.entries : [],
        }));

        const final = ensureSpecialLists(normalized);
        listsRef.current = final;
        setListsState(final);
        setLoading(false);
        });
  }, [user?.id]);

  // ── Sauvegarde via RPC (bulletproof) ─────────────────────────────────────
  async function saveToSupabase(next) {
    const currentUser = userRef.current;
    if (!currentUser) {
      console.warn("[AniVault] Save lists annulée : pas d'utilisateur connecté");
      return;
    }

    console.log("[AniVault] Sauvegarde lists →", next.length, "listes");

    const { error } = await supabase.rpc("save_my_lists", { p_lists: next });

    if (error) {
      console.error("[AniVault] Erreur RPC save_my_lists:", error);
      // Fallback : essai direct upsert
      const { error: e2 } = await supabase
        .from("libraries")
        .upsert({ user_id: currentUser.id, lists: next }, { onConflict: "user_id" });
      if (e2) console.error("[AniVault] Erreur fallback upsert lists:", e2);
      else console.log("[AniVault] Fallback upsert lists OK");
    } else {
      console.log("[AniVault] RPC save_my_lists OK ✓");
    }
  }

  function persist(next) {
    const ordered = ensureSpecialLists(next);
    listsRef.current = ordered;
    setListsState(ordered);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(
      () => saveToSupabase(listsRef.current),
      SAVE_DEBOUNCE_MS
    );
  }

  // ── Actions ───────────────────────────────────────────────────────────────
  const createList = useCallback((name, emoji = "📋") => {
    const id = Date.now().toString();
    persist([...listsRef.current, {
      id, name: name.trim(), emoji,
      isFavorites: false, isHidden: false,
      entries: [], createdAt: Date.now(), updatedAt: Date.now(),
    }]);
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

  const isInFavorites  = useCallback((e) => isInList(FAVORITES_ID, e),   [isInList]);
  const isInHiddenList = useCallback((e) => isInList(HIDDEN_LIST_ID, e), [isInList]);

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