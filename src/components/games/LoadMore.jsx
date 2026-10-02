import { useEffect, useRef } from "react";
import { ChevronDown } from "lucide-react";

/**
 * Pied de liste paginée : charge la page suivante tout seul quand il
 * approche de l'écran (IntersectionObserver, marge de 500 px), et garde un
 * bouton « Afficher plus » — accessible au clavier, et utile si l'observer
 * n'est pas disponible. Ne rend rien quand tout est affiché.
 */
export function LoadMore({ hasMore, onMore, shown, total, className = "" }) {
  const sentinel = useRef(null);

  useEffect(() => {
    if (!hasMore || !sentinel.current || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) onMore();
    }, { rootMargin: "500px 0px" });
    io.observe(sentinel.current);
    return () => io.disconnect();
    // `shown` relance l'observation après chaque page : si le pied de liste
    // est encore visible une fois la page ajoutée, on enchaîne la suivante.
  }, [hasMore, onMore, shown]);

  if (!hasMore) return null;
  return (
    <div ref={sentinel} className={`flex justify-center ${className}`}>
      <button onClick={onMore}
        className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-[11px] font-medium text-violet-200 hover:bg-white/10 active:scale-95 transition-colors motion-reduce:transition-none">
        <ChevronDown size={12} />Afficher plus{total ? ` (${shown}/${total})` : ""}
      </button>
    </div>
  );
}
