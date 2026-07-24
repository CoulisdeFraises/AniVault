import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { supabase }     from "../lib/supabase";
import { initProfile, fetchMyProfile } from "../services/community";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,        setUser]        = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [userProfile, setUserProfile] = useState(null);

  async function loadProfile(u) {
    if (!u) { setUserProfile(null); return; }
    try {
      await initProfile(u);
      const p = await fetchMyProfile(u.id);
      setUserProfile(p);
    } catch (_) {}
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null;
      setUser(u);
      loadProfile(u).finally(() => setLoading(false));
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      const u = session?.user ?? null;
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
    await supabase.auth.signOut();
    setUserProfile(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    const p = await fetchMyProfile(user.id);
    setUserProfile(p);
  }, [user]);

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
      user, profile, userProfile, loading,
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