import { createContext, useContext, useState, useCallback } from "react";

const PrefsContext = createContext(null);

export function PrefsProvider({ children }) {
  const [cultureMode, setCultureModeState] = useState(
    () => localStorage.getItem("pref_culture_mode") === "true"
  );

  const setCultureMode = useCallback((value) => {
    setCultureModeState(value);
    localStorage.setItem("pref_culture_mode", String(value));
  }, []);

  return (
    <PrefsContext.Provider value={{ cultureMode, setCultureMode }}>
      {children}
    </PrefsContext.Provider>
  );
}

export function usePrefs() {
  const ctx = useContext(PrefsContext);
  if (!ctx) throw new Error("usePrefs must be used within PrefsProvider");
  return ctx;
}

/** Helper pur — lisible partout sans hook (ex: dans anilist.js) */
export function getCultureMode() {
  return localStorage.getItem("pref_culture_mode") === "true";
}