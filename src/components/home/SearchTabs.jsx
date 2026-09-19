import { useRef, useState, useEffect } from "react";
import { motion } from "motion/react";
import { Search, X, SlidersHorizontal, LayoutGrid, MonitorPlay, Tv, Clapperboard } from "lucide-react";

const TABS = [
  { key: "all",   label: "Tout",   icon: LayoutGrid },
  { key: "anime", label: "Animes", icon: MonitorPlay },
  { key: "serie", label: "Séries", icon: Tv },
  { key: "film",  label: "Films",  icon: Clapperboard },
];

export function SearchTabs({ searchQuery, onSearchChange, typeFilter, onTypeFilterChange, filterCount, onOpenFilters }) {
  const ref = useRef(null);
  const [focused, setFocused] = useState(false);
  const isSearch = searchQuery.trim().length > 0;

  useEffect(() => {
    function h(e) {
      if (e.key === "/" && !["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName)) {
        e.preventDefault(); ref.current?.focus();
      }
    }
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  return (
    <>
      <div className={`flex items-center gap-2 pl-4 pr-2 h-12 rounded-2xl border mb-3 transition-colors duration-200 motion-reduce:transition-none ${
        focused ? "bg-violet-900/60 border-violet-500/60 shadow-[0_0_0_3px_rgba(139,92,246,0.15)]" : "bg-violet-900/40 border-white/10"}`}>
        <Search size={17} className={focused || isSearch ? "text-violet-200" : "text-violet-400"} />
        <input ref={ref} type="text" value={searchQuery} onChange={(e) => onSearchChange(e.target.value)}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          placeholder="Rechercher dans ta bibliothèque (Titre, genre, …)"
          className="flex-1 min-w-0 bg-transparent text-sm text-violet-50 placeholder-violet-400 focus:outline-none" />
        {isSearch && (
          <button onClick={() => { onSearchChange(""); ref.current?.focus(); }} aria-label="Effacer"
            className="p-1 rounded-full text-violet-300 hover:bg-white/10 active:scale-90"><X size={14} /></button>
        )}
        <button onClick={onOpenFilters} aria-label="Filtres et tri"
          className="relative h-9 w-9 flex items-center justify-center rounded-xl text-amber-400 hover:bg-white/10 active:scale-90 transition-all border-l border-white/10 rounded-l-none ml-1">
          <SlidersHorizontal size={17} />
          {filterCount > 0 && (
            <span className="absolute -top-0.5 right-0 min-w-[15px] h-[15px] px-1 rounded-full bg-amber-400 text-violet-950 text-[9px] font-bold flex items-center justify-center">{filterCount}</span>
          )}
        </button>
      </div>

      <div className="flex rounded-2xl bg-violet-900/40 border border-white/10 p-1 mb-5">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => onTypeFilterChange(key)}
            className={`relative flex-1 flex items-center justify-center gap-1.5 h-10 rounded-xl text-[13px] font-medium active:scale-95 transition-colors motion-reduce:transition-none ${
              typeFilter === key ? "text-violet-950 font-semibold" : "text-violet-200 hover:text-white"}`}>
            {typeFilter === key && (
              <motion.span layoutId="home-type-filter-pill" className="absolute inset-0 bg-amber-400 rounded-xl shadow-md shadow-amber-500/20"
                transition={{ type: "spring", stiffness: 500, damping: 35 }} />
            )}
            <span className="relative z-10 flex items-center gap-1.5"><Icon size={15} />{label}</span>
          </button>
        ))}
      </div>
    </>
  );
}
