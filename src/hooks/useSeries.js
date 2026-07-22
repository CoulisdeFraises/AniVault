import { useState, useEffect } from "react";
import { search, importResult } from "../api";

// query === "" désactive la recherche (utilisé quand ce n'est pas le type actif)
export function useSeries(query) {
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!query || query.trim().length < 2) {
      setResults([]);
      setError("");
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const r = await search("serie", query); // ← "serie" au lieu de "anime"
        setResults(r);
        setError(r.length === 0 ? "Aucun résultat." : "");
      } catch {
        setError("Recherche indisponible pour le moment — tu peux ajouter le titre puis compléter plus tard.");
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [query]);

  return { results, searching, error };
}

export const importSerie = importResult;