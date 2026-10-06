import { Reorder, useDragControls } from "motion/react";
import {
  ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
  GripVertical, Eye, ListOrdered, HeartOff, Check,
} from "lucide-react";
import { Modal } from "../Modal/Modal";
import { RarityBadge } from "./RarityBadge";
import { haptics } from "../../utils/haptics";

// ── Gestion de l'ordre des favoris ────────────────────────────────────────
//
//  • FavoriteActionSheet : menu ouvert par un appui long (ou clic droit) sur
//    une carte du carrousel. Reste ouvert après un déplacement pour pouvoir
//    enchaîner plusieurs ajustements ; la position affichée suit l'état réel.
//  • FavoritesReorderModal : liste complète, glisser-déposer par la poignée,
//    avec des flèches pour le clavier / les petits écrans.
//
// Les deux travaillent sur `items` (favoris dans l'ordre courant) et ne
// modifient l'ordre que via onMove(id, toIndex) / onReorder(ids).

function ActionButton({ icon: Icon, label, onClick, disabled, danger = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-left text-sm border transition-colors active:scale-[0.98] motion-reduce:transition-none disabled:opacity-35 disabled:cursor-not-allowed
        ${danger
          ? "bg-rose-500/10 border-rose-500/25 text-rose-200 hover:bg-rose-500/15"
          : "bg-white/5 border-white/10 text-violet-100 hover:bg-white/10"}`}
    >
      <Icon size={16} className="flex-shrink-0" />
      <span className="font-medium">{label}</span>
    </button>
  );
}

export function FavoriteActionSheet({ items, characterId, onMove, onOpenSheet, onOpenReorder, onRemove, onClose }) {
  const index = items.findIndex((c) => c.id === characterId);
  const card = items[index];
  if (!card) return null;
  const last = items.length - 1;

  const move = (to) => { haptics.tap(); onMove(card.id, to); };

  return (
    <Modal onClose={onClose} maxWidth="max-w-sm" zIndex="z-[60]">
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-16 rounded-lg overflow-hidden bg-violet-950 flex-shrink-0">
            {card.image && <img src={card.image} alt="" className="w-full h-full object-cover" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-white truncate" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>{card.name}</p>
            <p className="text-[11px] text-violet-300 truncate">{card.series}</p>
            <div className="flex items-center gap-2 mt-1">
              <RarityBadge tier={card.tier} />
              <span className="font-mono text-[11px] text-amber-300">Favori {index + 1} / {items.length}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <ActionButton icon={ChevronsLeftIcon} label="En premier" onClick={() => move(0)} disabled={index === 0} />
          <ActionButton icon={ChevronsRightIcon} label="En dernier" onClick={() => move(last)} disabled={index === last} />
          <ActionButton icon={ChevronLeft} label="Avancer" onClick={() => move(index - 1)} disabled={index === 0} />
          <ActionButton icon={ChevronRight} label="Reculer" onClick={() => move(index + 1)} disabled={index === last} />
        </div>

        <div className="space-y-2">
          <ActionButton icon={ListOrdered} label="Réorganiser tous les favoris" onClick={onOpenReorder} />
          <ActionButton icon={Eye} label="Voir la fiche" onClick={() => onOpenSheet(card.id)} />
          <ActionButton icon={HeartOff} label="Retirer des favoris" danger
            onClick={() => { haptics.medium(); onRemove(card.id); onClose(); }} />
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-amber-300 text-violet-950 font-bold text-sm active:scale-[0.98]"
        >
          Terminé
        </button>
      </div>
    </Modal>
  );
}

// Petites icônes « double chevron » horizontales, absentes de lucide 0.383 sous ce nom.
function ChevronsLeftIcon(props) {
  return (
    <svg width={props.size || 16} height={props.size || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className} aria-hidden="true">
      <path d="m11 17-5-5 5-5" /><path d="m18 17-5-5 5-5" />
    </svg>
  );
}
function ChevronsRightIcon(props) {
  return (
    <svg width={props.size || 16} height={props.size || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className} aria-hidden="true">
      <path d="m6 17 5-5-5-5" /><path d="m13 17 5-5-5-5" />
    </svg>
  );
}

function ReorderRow({ card, index, total, onMove }) {
  const controls = useDragControls();
  const btn = "w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 border border-white/10 text-violet-200 active:scale-90 disabled:opacity-25 disabled:cursor-not-allowed";

  return (
    <Reorder.Item
      value={card.id}
      dragListener={false}
      dragControls={controls}
      onDragStart={() => haptics.longPress()}
      whileDrag={{ scale: 1.02, boxShadow: "0 12px 30px rgba(0,0,0,0.5)" }}
      className="relative flex items-center gap-2.5 rounded-xl bg-violet-800/70 border border-white/10 p-2 list-none"
    >
      {/* Poignée : seule zone qui démarre le glisser, pour ne pas bloquer le scroll de la liste */}
      <button
        type="button"
        aria-label={`Déplacer ${card.name} par glisser-déposer`}
        onPointerDown={(e) => controls.start(e)}
        className="w-8 h-10 flex items-center justify-center text-violet-300 cursor-grab active:cursor-grabbing touch-none flex-shrink-0"
      >
        <GripVertical size={18} />
      </button>

      <span className="w-5 text-center font-mono text-[11px] text-violet-400 flex-shrink-0">{index + 1}</span>

      <div className="w-9 h-12 rounded-md overflow-hidden bg-violet-950 flex-shrink-0">
        {card.image && <img src={card.image} alt="" draggable="false" className="w-full h-full object-cover" />}
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-white truncate">{card.name}</p>
        <div className="mt-0.5"><RarityBadge tier={card.tier} /></div>
      </div>

      <div className="flex gap-1 flex-shrink-0">
        <button type="button" className={btn} aria-label="Monter" disabled={index === 0} onClick={() => onMove(card.id, index - 1)}>
          <ChevronUp size={15} />
        </button>
        <button type="button" className={btn} aria-label="Descendre" disabled={index === total - 1} onClick={() => onMove(card.id, index + 1)}>
          <ChevronDown size={15} />
        </button>
      </div>
    </Reorder.Item>
  );
}

export function FavoritesReorderModal({ items, onReorder, onMove, onClose }) {
  const ids = items.map((c) => c.id);
  const byId = new Map(items.map((c) => [c.id, c]));

  return (
    <Modal onClose={onClose} maxWidth="max-w-md" zIndex="z-[60]">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <p className="text-base font-bold text-white" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>Ordre des favoris</p>
            <p className="text-[11px] text-violet-300 mt-0.5">
              Glisse la poignée ou utilise les flèches. Le premier favori ouvre ton carrousel et ta vitrine.
            </p>
          </div>
          <span className="flex-shrink-0 rounded-full bg-white/5 border border-white/10 px-2 py-1 text-[10px] font-mono text-violet-300">
            {items.length}
          </span>
        </div>

        <Reorder.Group
          axis="y"
          values={ids}
          onReorder={onReorder}
          className="space-y-1.5 max-h-[60vh] overflow-y-auto pr-0.5 p-0 m-0"
        >
          {ids.map((id, i) => (
            <ReorderRow key={id} card={byId.get(id)} index={i} total={ids.length} onMove={onMove} />
          ))}
        </Reorder.Group>

        <button
          type="button"
          onClick={onClose}
          className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-amber-300 text-violet-950 font-bold text-sm active:scale-[0.98]"
        >
          <Check size={16} strokeWidth={3} />Terminé
        </button>
      </div>
    </Modal>
  );
}
