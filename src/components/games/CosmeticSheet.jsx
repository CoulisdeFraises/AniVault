import { useMemo, useState } from "react";
import { X, Gem, ChevronLeft, Search, Minus, Plus, Check, AlertTriangle } from "lucide-react";
import { Modal } from "../Modal/Modal";
import { GameButton } from "./ui";
import { CardFrame } from "./CardFrame";
import { CosmeticPreview, GradeChip, SLOT_LABEL } from "./CosmeticPreview";
import { LoadMore } from "./LoadMore";
import { RARITY_ORDER, normalizeTier } from "../../utils/waifinity";
import { COSMETICS_BY_ID, MAX_BUY_AT_ONCE, MAX_COSMETIC_STOCK } from "../../utils/waifinityCosmetics";
import { haptics } from "../../utils/haptics";

const HEADING = { fontFamily: "'Space Grotesk',sans-serif" };
const PAGE = 30;

const STEP_TITLE = {
  detail:  null,
  pick:    "Choisis une carte",
  confirm: "Confirmer",
  done:    "C'est fait",
};

/** Tuile d'une carte dans le sélecteur : volontairement statique (pas d'animation) pour rester fluide. */
function PickTile({ c, item, current, onPick }) {
  const same = current?.[item.slot] === item.id;
  const replaces = !!current?.[item.slot] && !same;
  return (
    <button
      onClick={() => { haptics.tap(); onPick(c); }}
      disabled={same}
      className="text-left disabled:opacity-45 disabled:cursor-not-allowed active:scale-95 transition-transform motion-reduce:transition-none"
    >
      <CardFrame tier={c.tier} className="relative aspect-[3/4] w-full">
        {c.image
          ? <img src={c.image} alt="" loading="lazy" draggable={false} className="absolute inset-0 w-full h-full object-cover" />
          : <div className="absolute inset-0 flex items-center justify-center text-violet-600">?</div>}
        {(replaces || same) && (
          <span className={`absolute bottom-1 left-1 z-20 px-1.5 py-0.5 rounded-full text-[8.5px] font-mono font-bold tracking-wide ${same ? "bg-black/70 text-white" : "bg-amber-400 text-violet-950"}`}>
            {same ? "DÉJÀ" : "REMPLACE"}
          </span>
        )}
      </CardFrame>
      <p className="mt-1 text-[10.5px] leading-tight text-violet-100 truncate">{c.name}</p>
    </button>
  );
}

/**
 * Fiche d'un cosmétique, en 4 temps :
 *   detail  → aperçu sur ta carte, achat (quantité), accès à l'application ;
 *   pick    → choix de la carte à décorer (recherche) ;
 *   confirm → aperçu final, avertissement si un objet va être remplacé ;
 *   done    → résultat, avec raccourci pour en appliquer un autre si le stock le permet.
 */
export function CosmeticSheet({
  item, initialStep = "detail", previewCard, fragments, stock, collectionList, favorites, equipped,
  onBuy, onApply, onClose,
}) {
  const [step, setStep] = useState(initialStep);
  const [qty, setQty] = useState(1);
  const [target, setTarget] = useState(null);
  const [appliedTo, setAppliedTo] = useState(null);
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE);

  const maxBuy = Math.max(0, Math.min(MAX_BUY_AT_ONCE, MAX_COSMETIC_STOCK - stock));
  const q = Math.max(1, Math.min(qty, Math.max(maxBuy, 1)));
  const total = item.cost * q;
  const canBuy = maxBuy > 0 && fragments >= total;

  const favSet = useMemo(() => new Set(favorites), [favorites]);
  const sorted = useMemo(() => {
    const rank = Object.fromEntries(RARITY_ORDER.map((t, i) => [t, i]));
    return [...collectionList].sort((a, b) =>
      (Number(favSet.has(b.id)) - Number(favSet.has(a.id)))
      || ((rank[normalizeTier(b.tier)] ?? 0) - (rank[normalizeTier(a.tier)] ?? 0))
      || String(a.name).localeCompare(String(b.name)));
  }, [collectionList, favSet]);
  const filtered = useMemo(() => {
    const t = query.trim().toLowerCase();
    return t ? sorted.filter((c) => `${c.name} ${c.series}`.toLowerCase().includes(t)) : sorted;
  }, [sorted, query]);
  const shown = filtered.slice(0, limit);

  function buy() {
    if (!canBuy) return;
    if (onBuy(item.id, q)) { haptics.success(); setQty(1); }
  }

  function confirmApply() {
    if (!target) return;
    if (onApply(target.id, item.id)) {
      haptics.success();
      setAppliedTo(target);
      setStep("done");
    }
  }

  const back = step === "pick" ? () => setStep("detail") : step === "confirm" ? () => setStep("pick") : null;
  const title = STEP_TITLE[step];
  const current = target ? (equipped[target.id] || {}) : {};
  const replaced = target && current[item.slot] && current[item.slot] !== item.id ? COSMETICS_BY_ID[current[item.slot]] : null;

  return (
    <Modal onClose={onClose} maxWidth="max-w-sm" zIndex="z-50">
      <div className="p-4 sm:p-5">
        {/* En-tête */}
        <div className="flex items-start gap-2 mb-4">
          {back && (
            <button onClick={() => { haptics.tap(); back(); }} aria-label="Retour"
              className="w-8 h-8 -ml-1 rounded-full flex items-center justify-center text-violet-200 hover:bg-white/10 flex-shrink-0">
              <ChevronLeft size={18} />
            </button>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <GradeChip grade={item.grade} />
              <span className="font-mono text-[10px] uppercase tracking-widest text-violet-400">{SLOT_LABEL[item.slot]}</span>
            </div>
            <h3 className="mt-1 text-lg font-bold text-white leading-tight" style={HEADING}>{title || item.name}</h3>
            {title && step !== "done" && <p className="text-xs text-violet-300">{item.name} · {stock} en stock</p>}
          </div>
          <button onClick={onClose} aria-label="Fermer"
            className="w-8 h-8 rounded-full flex items-center justify-center text-violet-300 hover:bg-white/10 flex-shrink-0">
            <X size={16} />
          </button>
        </div>

        {/* 1. Détail + achat */}
        {step === "detail" && (
          <div className="space-y-4">
            <div className="w-40 mx-auto">
              <CosmeticPreview card={previewCard} cosmetic={item.slot === "frame" ? { frame: item.id } : { effect: item.id }} />
            </div>
            <p className="text-sm text-violet-200 text-center">{item.desc}</p>

            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="rounded-xl bg-white/[0.04] border border-white/10 py-2">
                <p className="font-mono text-[10px] uppercase tracking-widest text-violet-400">En stock</p>
                <p className="text-lg font-bold text-white tabular-nums" style={HEADING}>{stock}</p>
              </div>
              <div className="rounded-xl bg-white/[0.04] border border-white/10 py-2">
                <p className="font-mono text-[10px] uppercase tracking-widest text-violet-400">Fragments</p>
                <p className="flex items-center justify-center gap-1 text-lg font-bold text-violet-100 tabular-nums" style={HEADING}><Gem size={14} className="text-violet-300" />{fragments}</p>
              </div>
            </div>

            {maxBuy > 1 && (
              <div className="flex items-center justify-between rounded-xl bg-white/[0.04] border border-white/10 px-3 py-2">
                <span className="text-xs text-violet-300">Quantité</span>
                <div className="flex items-center gap-3">
                  <button onClick={() => { haptics.tap(); setQty(Math.max(1, q - 1)); }} disabled={q <= 1} aria-label="Moins"
                    className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-violet-100 disabled:opacity-35 active:scale-90"><Minus size={14} /></button>
                  <span className="w-5 text-center font-semibold text-white tabular-nums">{q}</span>
                  <button onClick={() => { haptics.tap(); setQty(Math.min(maxBuy, q + 1)); }} disabled={q >= maxBuy} aria-label="Plus"
                    className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-violet-100 disabled:opacity-35 active:scale-90"><Plus size={14} /></button>
                </div>
              </div>
            )}

            <div>
              <GameButton full size="lg" className="!justify-between" disabled={!canBuy} onClick={buy}>
                <span>{maxBuy <= 0 ? "Stock plein" : `Acheter${q > 1 ? ` ×${q}` : ""}`}</span>
                <span className="flex items-center gap-1 tabular-nums"><Gem size={14} />{total}</span>
              </GameButton>
              {maxBuy > 0 && !canBuy && (
                <p className="mt-1.5 text-center text-[11px] text-violet-400">Il te manque {total - fragments} fragments.</p>
              )}
              {maxBuy <= 0 && (
                <p className="mt-1.5 text-center text-[11px] text-violet-400">Tu ne peux pas en stocker plus de {MAX_COSMETIC_STOCK}.</p>
              )}
            </div>

            <GameButton full variant="secondary" disabled={stock <= 0 || !collectionList.length} onClick={() => setStep("pick")}>
              Appliquer sur une carte{stock > 0 ? ` (${stock})` : ""}
            </GameButton>
            <p className="text-[11px] text-violet-400 text-center leading-relaxed">
              Un cosmétique est consommé quand tu l'appliques : il reste sur la carte choisie. Pour en décorer une autre, il faut en avoir un autre en stock.
            </p>
          </div>
        )}

        {/* 2. Choix de la carte */}
        {step === "pick" && (
          <div className="space-y-3">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-violet-500 pointer-events-none" />
              <input
                value={query}
                onChange={(e) => { setQuery(e.target.value); setLimit(PAGE); }}
                placeholder="Chercher un personnage ou une série…"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white/[0.06] border border-white/10 text-sm text-violet-50 placeholder-violet-500 focus:outline-none focus:border-violet-300/50"
              />
            </div>
            {shown.length ? (
              <>
                <div className="grid grid-cols-3 gap-2.5">
                  {shown.map((c) => (
                    <PickTile key={c.id} c={c} item={item} current={equipped[c.id]} onPick={(card) => { setTarget(card); setStep("confirm"); }} />
                  ))}
                </div>
                <LoadMore hasMore={filtered.length > shown.length} onMore={() => setLimit((l) => l + PAGE)} shown={shown.length} total={filtered.length} />
              </>
            ) : (
              <p className="py-8 text-center text-sm text-violet-400">
                {collectionList.length ? "Aucune carte ne correspond." : "Tu n'as encore aucune carte à décorer."}
              </p>
            )}
          </div>
        )}

        {/* 3. Confirmation */}
        {step === "confirm" && target && (
          <div className="space-y-4">
            <div className="w-44 mx-auto">
              <CosmeticPreview card={target} cosmetic={{ ...current, [item.slot]: item.id }} />
            </div>
            <p className="text-sm text-violet-100 text-center">
              Appliquer <strong className="text-white">{item.name}</strong> sur <strong className="text-white">{target.name}</strong> ?
            </p>
            {replaced && (
              <p className="flex items-start gap-2 rounded-xl bg-amber-400/10 border border-amber-300/30 px-3 py-2 text-xs text-amber-100">
                <AlertTriangle size={14} className="flex-shrink-0 mt-px" />
                {replaced.name} est déjà sur cette carte : il sera remplacé et perdu.
              </p>
            )}
            <p className="text-[11px] text-violet-400 text-center">1 exemplaire sera consommé. L'objet restera sur cette carte.</p>
            <div className="grid grid-cols-2 gap-2">
              <GameButton variant="secondary" onClick={() => setStep("pick")}>Changer de carte</GameButton>
              <GameButton onClick={confirmApply}>Appliquer</GameButton>
            </div>
          </div>
        )}

        {/* 4. Résultat */}
        {step === "done" && appliedTo && (
          <div className="space-y-4">
            <div className="w-44 mx-auto">
              <CosmeticPreview card={appliedTo} cosmetic={equipped[appliedTo.id]} />
            </div>
            <p className="flex items-center justify-center gap-1.5 text-sm text-emerald-200">
              <Check size={15} />{item.name} appliqué sur {appliedTo.name}
            </p>
            <div className="grid gap-2">
              {stock > 0 && (
                <GameButton variant="secondary" full onClick={() => { setTarget(null); setStep("pick"); }}>
                  Appliquer sur une autre carte ({stock})
                </GameButton>
              )}
              <GameButton full onClick={onClose}>Terminer</GameButton>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
