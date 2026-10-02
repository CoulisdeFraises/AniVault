import { useCallback, useEffect, useMemo, useState } from "react";

/**
 * Affichage progressif d'une longue liste : ne rend que les `pageSize`
 * premiers éléments, puis `more()` en ajoute autant. Revient à la première
 * page quand `resetKey` change (nouvelle recherche, nouveau filtre, nouveau
 * tri…) pour ne pas laisser l'utilisateur au milieu d'une liste différente.
 * À utiliser avec <LoadMore /> (chargement automatique au défilement).
 */
export function usePagedList(items, { pageSize = 60, resetKey = "" } = {}) {
  const [count, setCount] = useState(pageSize);
  useEffect(() => { setCount(pageSize); }, [resetKey, pageSize]);

  const visible = useMemo(() => items.slice(0, count), [items, count]);
  const more = useCallback(() => setCount((n) => n + pageSize), [pageSize]);
  return { visible, hasMore: count < items.length, more, shown: Math.min(count, items.length), total: items.length };
}
