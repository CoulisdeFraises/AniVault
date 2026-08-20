import { X } from "lucide-react";
import { Modal } from "../Modal/Modal";
import { STATUS, FILTER_STATUS_ORDER } from "../../utils/status";

function Chip({ active, onClick, disabled, children, colorClass }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all active:scale-95 motion-reduce:transition-none whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed ${active ? colorClass || "bg-violet-600 border-violet-500 text-white" : "bg-white/5 border-white/10 text-violet-300 hover:bg-white/10 hover:text-violet-100"}`}>
      {children}
    </button>
  );
}

const STATUS_CHIP_COLOR = {
  "en-cours":  "bg-amber-400/90 border-amber-400 text-violet-950",
  "a-jour":    "bg-lime-400/90 border-lime-400 text-violet-950",
  "termine":   "bg-teal-400/90 border-teal-400 text-violet-950",
  "a-voir":    "bg-sky-400/90 border-sky-400 text-violet-950",
  "abandonne": "bg-rose-400/90 border-rose-400 text-violet-950",
};

const SORT_OPTIONS = [
  { key: "date",       label: "Récents"     },
  { key: "title",      label: "A → Z"       },
  { key: "title-desc", label: "Z → A"       },
  { key: "rating",     label: "Notes +"     },
  { key: "rating-asc", label: "Notes -"     },
  { key: "progress",   label: "Progression" },
];

/**
 * FilterPanel — regroupe en un seul endroit les filtres cumulatifs
 * (statut, "cette semaine") et le tri (exclusif) de la bibliothèque.
 *
 * La logique reste inchangée : les statuts se cumulent entre eux (OR),
 * "cette semaine" s'applique en ET par-dessus, et le tri est un choix
 * unique appliqué au résultat final.
 */
export function FilterPanel({
  selectedStatuses, onToggleStatus, onClearStatuses,
  sortBy, onSortChange,
  onClose,
}) {
  const hasStatusFilters = selectedStatuses.length > 0;

  return (
    <Modal onClose={onClose} maxWidth="max-w-sm" zIndex="z-50">
      <div>
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
          <p className="font-mono text-[11px] uppercase tracking-widest text-violet-400">Filtres</p>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/10 text-violet-400">
            <X size={14} />
          </button>
        </div>

        <div className="p-4 space-y-5">
          {/* ── Statut (cumulatif) ── */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <p className="font-mono text-[10px] uppercase tracking-widest text-violet-500">Statut</p>
              {hasStatusFilters && (
                <button onClick={onClearStatuses}
                  className="flex items-center gap-1 text-[10px] font-mono text-violet-400 hover:text-violet-200 transition-colors">
                  <X size={10} /> Réinitialiser
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {FILTER_STATUS_ORDER.map(k => (
                <Chip key={k} active={selectedStatuses.includes(k)} onClick={() => onToggleStatus(k)} colorClass={STATUS_CHIP_COLOR[k]}>
                  <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${STATUS[k].dot}`} />
                  {STATUS[k].label}
                </Chip>
              ))}
            </div>
          </div>

          {/* ── Tri (exclusif) ── */}
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-violet-500 mb-2.5">Trier par</p>
            <div className="flex flex-wrap gap-1.5">
              {SORT_OPTIONS.map(opt => (
                <Chip key={opt.key} active={sortBy === opt.key} onClick={() => onSortChange(opt.key)}>
                  {opt.label}
                </Chip>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
