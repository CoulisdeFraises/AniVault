import { useState, useEffect, useCallback } from "react";
import { pull, push } from "../services/sync";

export function useSync(profile) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saveError, setSaveError] = useState(false);

  useEffect(() => {
    if (!profile) {
      setEntries([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    pull(profile).then((data) => {
      if (cancelled) return;
      setEntries(data);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [profile]);

  const persist = useCallback((next) => {
    setEntries(next);
    if (!profile) return;
    push(profile, next)
      .then((ok) => setSaveError(!ok))
      .catch(() => setSaveError(true));
  }, [profile]);

  return { entries, loading, saveError, persist };
}