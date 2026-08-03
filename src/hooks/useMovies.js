import { useState, useEffect } from "react";
import { search }  from "../api";
import { hasTMDB } from "../api/tmdb";

export function useMovies(query) {
  const [results,   setResults]   = useState([]);
  const [searching, setSearching] = useState(false);
  const [error,     setError]     = useState("");

  useEffect(() => {
    if (!query || query.trim().length < 2) {
      setResults([]);
      setError("");
      return;
    }
    if (!hasTMDB()) {
      setError("Clé TMDB manquante — ajoute VITE_TMDB_TOKEN dans ton .env.local pour chercher des films.");
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const r = await search("film", query);
        setResults(r);
        setError(r.length === 0 ? "Aucun film trouvé." : "");
      } catch {
        setError("Recherche TMDB indisponible pour le moment.");
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [query]);

  return { results, searching, error };
}