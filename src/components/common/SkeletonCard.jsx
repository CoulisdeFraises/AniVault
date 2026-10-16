/**
 * SkeletonCard — placeholder animé affiché pendant le chargement
 * de la bibliothèque. Remplace le simple texte "Chargement…".
 */
export function SkeletonCard() {
  return (
    <div className="relative rounded-2xl overflow-hidden bg-violet-900/30 border border-white/10 h-[118px] pl-[92px] pr-3 py-3 animate-pulse">
      {/* Image collée à gauche, fondue vers la droite */}
      <div className="absolute inset-y-0 left-0 w-[96px] bg-gradient-to-r from-white/15 via-white/10 to-transparent" />
      {/* Contenu */}
      <div className="h-full flex flex-col justify-between min-w-0">
        <div className="flex items-center gap-2 h-[18px]">
          <div className="h-3 w-10 bg-white/10 rounded-full" />
          <div className="h-3 w-16 bg-white/10 rounded-full" />
        </div>
        <div className="h-4 bg-white/10 rounded w-3/4" />
        <div className="h-3 bg-white/10 rounded w-1/2" />
        <div className="flex gap-1.5 h-[18px] items-center">
          <div className="h-4 w-14 bg-white/10 rounded-full" />
          <div className="h-4 w-12 bg-white/10 rounded-full" />
        </div>
        <div className="h-1.5 bg-white/10 rounded-full" />
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
