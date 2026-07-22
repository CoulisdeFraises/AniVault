import { Search, Loader2 } from "lucide-react";
import { useAnime } from "../../hooks/useAnime";
import { useSeries } from "../../hooks/useSeries";

export function SearchBar({ type, query, onQueryChange, onSelect }) {
  // Les deux hooks sont toujours appelés (règles des Hooks) ; celui qui ne
  // correspond pas au type actif reçoit une requête vide et ne fait rien.
  const anime = useAnime(type === "anime" ? query : "");
  const series = useSeries(type === "serie" ? query : "");
  const { results, searching, error } = type === "anime" ? anime : series;

  return (
    <div className="mb-4 mt-2 rounded-xl bg-violet-950/50 border border-white/10 p-3">
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-violet-500" />
        <input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={type === "anime" ? "Chercher un anime sur AniList…" : "Chercher une série sur TVmaze…"}
          className="w-full pl-9 pr-3 py-2 rounded-lg bg-violet-950/60 border border-white/10 text-violet-50 placeholder-violet-500 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
        {searching && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-violet-500 animate-spin motion-reduce:animate-none" />}
      </div>
      {error && <p className="text-[11px] text-violet-400 mt-2">{error}</p>}
      {results.length > 0 && (
        <ul className="mt-2 space-y-1 max-h-56 overflow-y-auto">
          {results.map((r) => (
            <li key={`${r.source}-${r.id}`}>
              <button type="button" onClick={() => onSelect(r)} className="w-full flex items-center gap-2 p-1.5 rounded-lg hover:bg-white/10 text-left">
                {r.image ? <img src={r.image} alt="" className="w-8 h-11 object-cover rounded flex-shrink-0" /> : <div className="w-8 h-11 rounded bg-white/10 flex-shrink-0" />}
                <span className="min-w-0">
                  <span className="block text-sm text-violet-50 truncate">{r.title}</span>
                  <span className="block text-[11px] text-violet-400">{r.year || "—"}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-[10px] text-violet-500 mt-2">
        Données fournies par {type === "anime" ? "AniList" : "TVmaze"} — les saisons et épisodes sont détectés automatiquement.
      </p>
    </div>
  );
}