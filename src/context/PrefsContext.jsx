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

/** Lecture directe localStorage — utilisable hors hook (ex: anilist.js) */
export function getCultureMode() {
  return localStorage.getItem("pref_culture_mode") === "true";
}

/**
 * Afficher la barre de progression sur les cartes.
 * Valeur par défaut : true (activé).
 */
export function getShowProgress() {
  return localStorage.getItem("pref_showProgress") !== "false";
}

/**
 * Changer le statut automatiquement selon les épisodes cochés.
 * Valeur par défaut : true (activé).
 */
export function getAutoStatus() {
  return localStorage.getItem("pref_autoStatus") !== "false";
}
