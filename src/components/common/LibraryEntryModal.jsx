import { X, Star, Trash2, Film, Tv, Clapperboard } from "lucide-react";
import { Modal } from "../Modal/Modal";
import { STATUS, seasonTotals, formatRating } from "../../utils/status";
import { RatingBadge } from "./Rating";

// -----------------------------------------------------------------------------
// LibraryEntryModal — ouverte au clic sur une carte dans "Mes Listes"
// (listes perso + favoris). Contrairement à SynopsisModal (page Recommandations,
// titres pas encore en bibliothèque), ici le titre est déjà dans la bibliothèque :
// on affiche synopsis + quelques stats (statut, progression, note) et un bouton
// "Retirer de la liste" plutôt qu'un bouton d'ajout.
// -----------------------------------------------------------------------------
export function LibraryEntryModal({ item, entry, onClose, onRemove }) {
  if (!item) return null;

  const title = entry?.title || item.title;
  const image = entry?.coverImage || entry?.seasons?.[0]?.coverImage || item.coverImage;
  const type     = entry?.type || item.type;
  const category = entry?.category || item.category;
  const s     = entry ? STATUS[entry.status] : null;

  const { watched, total } = entry ? seasonTotals(entry.seasons) : { watched: 0, total: null };
  const pct = total ? Math.min(100, Math.round((watched / total) * 100)) : null;

  return (
    <Modal onClose={onClose} maxWidth="max-w-sm" zIndex="z-[70]">
      <div>
        {/* Image header */}
        <div className="relative h-44 overflow-hidden flex-shrink-0">
          {image
            ? <img src={image} alt="" className="w-full h-full object-cover" />
            : <div className="w-full h-full bg-violet-950" />
          }
          <div className="absolute inset-0 bg-gradient-to-t from-violet-900 via-black/20 to-transparent" />
          <button onClick={onClose}
            className="absolute top-3 right-3 p-1.5 rounded-full bg-black/50 hover:bg-black/70 text-white/70 hover:text-white transition-colors">
            <X size={14} />
          </button>
          {entry?.rating > 0 && (
            <span className="absolute bottom-3 right-3 inline-flex items-center gap-1 font-mono text-[11px] text-amber-400 bg-black/60 px-2 py-0.5 rounded-full backdrop-blur-sm">
              <Star size={9} fill="#fbbf24" strokeWidth={0} /> {formatRating(entry.rating)}/10
              <RatingBadge rating={entry.rating} className="text-[11px] ml-0.5" />
            </span>
          )}
          {s && (
            <span className={`absolute bottom-3 left-3 inline-flex items-center gap-1 font-mono text-[10px] ${s.text} bg-black/60 px-2 py-0.5 rounded-full backdrop-blur-sm`}>
              <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} /> {s.label}
            </span>
          )}
        </div>

        <div className="p-4 space-y-3">
          <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-violet-300">
            {category === "movie" ? <Clapperboard size={10} /> : type === "anime" ? <Film size={10} /> : <Tv size={10} />}
            {category === "movie" ? "Film" : type === "anime" ? "Anime" : "Série"}
          </div>

          <h3 className="text-base font-bold text-violet-50 leading-tight"
            style={{ fontFamily: "'Space Grotesk',sans-serif" }}>
            {title}
          </h3>

          {entry?.genres?.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {entry.genres.slice(0, 4).map(g => (
                <span key={g} className="px-1.5 py-0.5 rounded-full bg-white/5 text-[10px] text-violet-300 font-mono">{g}</span>
              ))}
            </div>
          )}

          {/* Quelques stats */}
          {entry && (
            <div className="rounded-xl bg-violet-950/40 border border-white/5 p-2.5 space-y-1.5">
              <div className="flex items-center justify-between font-mono text-[10px] text-violet-400">
                <span>Progression</span>
                <span>{watched}{total != null ? ` / ${total}` : ""} ép.</span>
              </div>
              {pct != null && (
                <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                  <div className="h-full bg-amber-400" style={{ width: `${pct}%` }} />
                </div>
              )}
            </div>
          )}

          <div className="max-h-28 overflow-y-auto pr-1">
            {entry?.description
              ? <p className="text-[11px] text-violet-300/80 leading-relaxed">{entry.description}</p>
              : <p className="text-[11px] text-violet-600 italic">Aucun synopsis disponible.</p>
            }
          </div>

          <button
            onClick={onRemove}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-rose-500/15 border border-rose-500/25 text-rose-300 text-sm font-medium hover:bg-rose-500/25 active:scale-95 transition-all"
          >
            <Trash2 size={14} />
            Retirer de la liste
          </button>
        </div>
      </div>
    </Modal>
  );
}
