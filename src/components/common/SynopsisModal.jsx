import { X, Star, Plus, Loader2, Eye} from "lucide-react";
import { EyePlus } from "./icons";
import { Modal } from "../Modal/Modal";

export function SynopsisModal({ rec, onClose, onAdd, onAddSeen, adding, alreadyInLib }) {
  if (!rec) return null;
  return (
    <Modal onClose={onClose} maxWidth="max-w-sm" zIndex="z-[70]">
      <div>
        {/* Image header */}
        <div className="relative h-44 overflow-hidden flex-shrink-0">
          {rec.image
            ? <img src={rec.image} alt="" className="w-full h-full object-cover" />
            : <div className="w-full h-full bg-violet-950" />
          }
          <div className="absolute inset-0 bg-gradient-to-t from-violet-900 via-black/20 to-transparent" />
          <button onClick={onClose}
            className="absolute top-3 right-3 p-1.5 rounded-full bg-black/50 hover:bg-black/70 text-white/70 hover:text-white transition-colors">
            <X size={14} />
          </button>
          {rec.score > 0 && (
            <span className="absolute bottom-3 right-3 inline-flex items-center gap-1 font-mono text-[11px] text-amber-400 bg-black/60 px-2 py-0.5 rounded-full backdrop-blur-sm">
              <Star size={9} fill="#fbbf24" strokeWidth={0} /> {(rec.score / 10).toFixed(1)}
            </span>
          )}
          {rec.year && (
            <span className="absolute bottom-3 left-3 font-mono text-[10px] text-violet-300 bg-black/60 px-2 py-0.5 rounded-full backdrop-blur-sm">
              {rec.year}{rec.episodes ? ` · ${rec.episodes} ép.` : ""}
            </span>
          )}
        </div>

        <div className="p-4 space-y-3">
          <h3 className="text-base font-bold text-violet-50 leading-tight"
            style={{ fontFamily: "'Space Grotesk',sans-serif" }}>
            {rec.title}
          </h3>

          {rec.genres?.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {rec.genres.slice(0, 4).map(g => (
                <span key={g} className="px-1.5 py-0.5 rounded-full bg-white/5 text-[10px] text-violet-300 font-mono">{g}</span>
              ))}
            </div>
          )}

          <div className="max-h-28 overflow-y-auto pr-1">
            {rec.description
              ? <p className="text-[11px] text-violet-300/80 leading-relaxed">{rec.description}</p>
              : <p className="text-[11px] text-violet-600 italic">Aucun synopsis disponible.</p>
            }
          </div>

          {alreadyInLib ? (
            <p className="text-center font-mono text-[11px] text-violet-500 py-1">✓ Déjà dans ta liste</p>
          ) : (
            <div className="space-y-2">
              {/* Ajouter → ouvre le formulaire de confirmation */}
              <button
                onClick={() => onAdd(rec)}
                disabled={adding}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-amber-400/20 border border-amber-400/30 text-amber-300 text-sm font-medium hover:bg-amber-400/30 active:scale-95 transition-all disabled:opacity-50"
              >
                {adding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                Ajouter à ma liste
              </button>

              {/* Marquer comme vu — uniquement si le handler est fourni */}
              {onAddSeen && (
                <button
                  onClick={() => onAddSeen(rec)}
                  disabled={adding}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-teal-500/15 border border-teal-500/25 text-teal-300 text-sm font-medium hover:bg-teal-500/25 active:scale-95 transition-all disabled:opacity-50"
                >
                  {adding ? <Loader2 size={14} className="animate-spin" /> : <EyePlus size={14} />}
                  Marquer comme vu
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}