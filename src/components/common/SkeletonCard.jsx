/**
 * SkeletonCard — placeholder animé affiché pendant le chargement
 * de la bibliothèque. Remplace le simple texte "Chargement…".
 */
export function SkeletonCard() {
  return (
    <div className="relative rounded-2xl overflow-hidden bg-violet-900/30 border border-white/5
      p-3 sm:p-4 flex gap-3 animate-pulse">
      {/* Barre de couleur latérale */}
      <div className="absolute inset-y-0 left-0 w-[3px] rounded-l-2xl bg-white/10" />
      {/* Cover */}
      <div className="w-14 h-20 sm:w-16 sm:h-24 rounded-xl bg-white/10 flex-shrink-0 self-start" />
      {/* Contenu */}
      <div className="flex-1 space-y-2.5 min-w-0">
        <div className="flex items-center gap-2">
          <div className="h-3 w-10 bg-white/10 rounded-full" />
          <div className="h-3 w-16 bg-white/10 rounded-full" />
        </div>
        <div className="h-4 bg-white/10 rounded w-3/4" />
        <div className="flex gap-1.5 mt-1">
          <div className="h-5 w-14 bg-white/10 rounded-full" />
          <div className="h-5 w-12 bg-white/10 rounded-full" />
          <div className="h-5 w-16 bg-white/10 rounded-full" />
        </div>
        <div className="h-3 bg-white/10 rounded w-1/2 mt-1" />
      </div>
      {/* Note */}
      <div className="flex flex-col items-center justify-center gap-1 pl-2 border-l border-white/5 min-w-[40px]">
        <div className="h-3 w-6 bg-white/10 rounded" />
        <div className="h-6 w-6 bg-white/10 rounded" />
        <div className="h-5 w-5 bg-white/10 rounded-full" />
      </div>
    </div>
  );
}

/** Grille de N squelettes (défaut : 6) */
export function SkeletonGrid({ count = 6 }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      {Array.from({ length: count }, (_, i) => <SkeletonCard key={i} />)}
    </div>
  );
}
