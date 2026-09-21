import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { supabase }     from "../lib/supabase";
import { initProfile, fetchMyProfile } from "../services/community";

const AuthContext = createContext(null);

// Marqueur persistant, séparé du stockage interne de Supabase : retient le
// dernier utilisateur authentifié avec succès sur cet appareil. Sert de
// filet de sécurité hors ligne — voir plus bas.
const LAST_UID_KEY = "anivault:last-uid";

export function AuthProvider({ children }) {
  const [user,        setUser]        = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [userProfile, setUserProfile] = useState(null);
  // true quand `user` est un repli hors ligne (voir ci-dessous) plutôt
  // qu'une session confirmée par le serveur — permet à l'UI de nuancer
  // l'affichage si besoin, sans bloquer l'accès à l'app.
  const [authOffline, setAuthOffline] = useState(false);

  async function loadProfile(u) {
    if (!u) { setUserProfile(null); return; }
    try {
      await initProfile(u);
      const p = await fetchMyProfile(u.id);
      setUserProfile(p);
      // Cache local pour un accès synchrone rapide (ex: getRatingEmoji dans
      // les listes de cartes, qui ne peut pas attendre un fetch async).
      if (p?.companion) localStorage.setItem("pref_companion", p.companion);
    } catch (_) {}
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null;

      if (u) {
        // Session confirmée : on mémorise cet utilisateur comme "dernier
        // connu" pour le repli hors ligne, et on efface tout état de repli.
        localStorage.setItem(LAST_UID_KEY, u.id);
        setAuthOffline(false);
        setUser(u);
        loadProfile(u).finally(() => setLoading(false));
        return;
      }

      // Pas de session retournée par getSession(). Deux cas très différents
      // produisent exactement ce même résultat côté Supabase :
      //   1. L'utilisateur n'est vraiment pas connecté (jamais connecté sur
      //      cet appareil, ou déconnexion explicite) → direction /login.
      //   2. Le token d'accès est expiré et sa vérification/rafraîchissement
      //      nécessite le réseau — hors ligne, cet appel échoue et
      //      getSession() retombe silencieusement sur `session: null`, alors
      //      que l'utilisateur EST bien connecté. Rediriger vers /login dans
      //      ce cas est exactement le bug rapporté : l'app "a besoin
      //      d'internet pour s'ouvrir", puisque /login lui-même ne peut pas
      //      fonctionner hors ligne.
      // On distingue les deux via navigator.onLine (heuristique standard,
      // déjà utilisée ailleurs dans l'app) + la présence d'un utilisateur
      // déjà connu sur cet appareil : hors ligne + déjà connu → on reste
      // connecté en mode dégradé (bibliothèque servie depuis le cache local
      // par LibraryContext, qui gère déjà ce cas pour peu qu'il ait un
      // user.id). Un vrai logout (voir plus bas) efface ce marqueur, donc ce
      // repli ne s'active jamais après une déconnexion volontaire.
      const lastUid = localStorage.getItem(LAST_UID_KEY);
      if (!navigator.onLine && lastUid) {
        setAuthOffline(true);
        setUser({ id: lastUid });
        setLoading(false);
        return;
      }

      setAuthOffline(false);
      setUser(null);
      loadProfile(null).finally(() => setLoading(false));
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      const u = session?.user ?? null;
      if (u) {
        localStorage.setItem(LAST_UID_KEY, u.id);
        setAuthOffline(false);
      }
      setUser(u);
      loadProfile(u);
    });
    return () => subscription.unsubscribe();
  }, []);

  const loginWithEmail = useCallback(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const signUpWithEmail = useCallback(async (email, password) => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
  }, []);

  const loginWithGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) throw error;
  }, []);

  const logout = useCallback(async () => {
    localStorage.removeItem(LAST_UID_KEY);
    setAuthOffline(false);
    await supabase.auth.signOut();
    setUserProfile(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!user || authOffline) return; // repli hors ligne : pas d'id de profil fiable à interroger
    const p = await fetchMyProfile(user.id);
    setUserProfile(p);
    if (p?.companion) localStorage.setItem("pref_companion", p.companion);
  }, [user, authOffline]);

  // Nom affiché — priorité : profil public > user_metadata
  const profile =
    userProfile?.username ||
    user?.user_metadata?.username ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split("@")[0] ||
    null;

  return (
    <AuthContext.Provider value={{
      user, profile, userProfile, loading, authOffline,
      loginWithEmail, signUpWithEmail, loginWithGoogle, logout, refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}