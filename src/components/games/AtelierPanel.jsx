import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence } from "motion/react";
import { Gem, Check, Palette, Package, Store } from "lucide-react";
import {
  COSMETICS, COSMETICS_BY_ID, COSMETIC_SLOTS, MAX_COSMETIC_STOCK, stockCount,
} from "../../utils/waifinityCosmetics";
import { CardFrame } from "./CardFrame";
import { PillTabs } from "./PillTabs";
import { GameButton, Panel, SectionTitle } from "./ui";
import { CosmeticPreview, GradeChip, SLOT_LABEL } from "./CosmeticPreview";
import { CosmeticSheet } from "./CosmeticSheet";
import { haptics } from "../../utils/haptics";

const HEADING = { fontFamily: "'Space Grotesk',sans-serif" };
const previewOf = (item) => (item.slot === "frame" ? { frame: item.id } : { effect: item.id });

/** Carte produit de la boutique : aperçu sur ta propre carte, grade, prix, achat rapide. */
function ProductCard({ item, previewCard, qty, fragments, flashed, onOpen, onBuy }) {
  const full = qty >= MAX_COSMETIC_STOCK;
  const affordable = fragments >= item.cost;
  return (
    <li className="flex flex-col rounded-2xl border border-white/10 bg-gradient-to-br from-violet-800/45 to-violet-900/30 p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
      <button onClick={onOpen} className="block w-full text-left rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70" aria-label={`${item.name} : voir le détail`}>
        <div className="relative">
          <CosmeticPreview card={previewCard} cosmetic={previewOf(item)} />
          {qty > 0 && (
            <span className="absolute top-1.5 right-1.5 z-20 min-w-[22px] h-[20px] px-1.5 rounded-full bg-black/70 border border-white/15 text-white text-[10px] font-mono font-bold flex items-center justify-center">
              ×{qty}
            </span>
          )}
        </div>
        <div className="mt-2.5 flex items-center gap-1.5">
          <GradeChip grade={item.grade} />
        </div>
        <p className="mt-1 text-sm font-semibold text-white leading-tight" style={HEADING}>{item.name}</p>
        <p className="mt-0.5 text-[11px] leading-snug text-violet-300 line-clamp-2 min-h-[2.1rem]">{item.desc}</p>
      </button>
      <GameButton size="sm" className="mt-2 !justify-between" disabled={!affordable || full} onClick={onBuy}>
        {flashed
          ? <span className="flex items-center gap-1 mx-auto"><Check size={13} />Ajouté</span>
          : <>
              <span>{full ? "Stock plein" : "Acheter"}</span>
              <span className="flex items-center gap-1 tabular-nums"><Gem size={12} />{item.cost}</span>
            </>}
      </GameButton>
      {!affordable && !full && (
        <p className="mt-1 text-center text-[10px] text-violet-400">Il manque {item.cost - fragments}</p>
      )}
    </li>
  );
}

/** Ligne du stock : un objet que l'on possède, prêt à être appliqué. */
function StockRow({ item, qty, previewCard, onApply, onOpen }) {
  return (
    <li className="flex items-center gap-3 rounded-2xl border border-white/10 bg-gradient-to-br from-violet-800/45 to-violet-900/30 p-2.5">
      <button onClick={onOpen} className="w-14 flex-shrink-0 rounded-lg" aria-label={`${item.name} : voir le détail`}>
        <CosmeticPreview card={previewCard} cosmetic={previewOf(item)} />
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <GradeChip grade={item.grade} />
          <span className="font-mono text-[10px] uppercase tracking-widest text-violet-400">{SLOT_LABEL[item.slot]}</span>
        </div>
        <p className="mt-0.5 text-sm font-semibold text-white truncate" style={HEADING}>{item.name}</p>
        <p className="text-xs text-violet-300">En stock : <span className="font-semibold text-violet-100 tabular-nums">×{qty}</span></p>
      </div>
      <GameButton size="sm" onClick={onApply}>Appliquer</GameButton>
    </li>
  );
}

/**
 * Atelier : les fragments gagnés sur les doublons s'échangent contre des
 * cosmétiques CONSOMMABLES. On les achète (boutique), ils rejoignent le stock,
 * puis on les applique à une carte précise — l'objet est consommé et reste sur
 * cette carte. Tout se fait ici : aperçu sur ta propre carte, achat, choix de la
 * carte, confirmation.
 */
export function AtelierPanel({
  fragments, stock = {}, collectionList = [], favorites = [], equipped = {},
  onBuy, onApply, onOpenSheet,
}) {
  const [view, setView] = useState("shop");
  const [slotFilter, setSlotFilter] = useState("all");
  const [sheet, setSheet] = useState(null); // { id, step }
  const [flashId, setFlashId] = useState(null);
  const flashTimer = useRef(null);
  useEffect(() => () => clearTimeout(flashTimer.current), []);

  const total = stockCount(stock);

  // Carte servant d'aperçu : un favori, sinon la plus récente — tu vois le cosmétique sur TON personnage.
  const previewCard = useMemo(() => {
    const fav = new Set(favorites);
    return collectionList.find((c) => fav.has(c.id) && c.image) || collectionList.find((c) => c.image) || null;
  }, [collectionList, favorites]);

  const inStock = useMemo(() => COSMETICS.filter((c) => (stock[c.id] || 0) > 0), [stock]);
  const customized = useMemo(() => collectionList.filter((c) => equipped[c.id]), [collectionList, equipped]);

  function quickBuy(item) {
    if (!onBuy(item.id, 1)) return;
    haptics.success();
    setFlashId(item.id);
    clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlashId(null), 1400);
  }

  const tabs = [
    { key: "shop",  label: "Boutique", icon: Store },
    { key: "stock", label: total ? `Mon stock (${total})` : "Mon stock", icon: Package },
  ];
  const slotChips = [{ key: "all", label: "Tout" }, ...COSMETIC_SLOTS];
  const sheetItem = sheet ? COSMETICS_BY_ID[sheet.id] : null;

  return (
    <div className="space-y-5">
      {/* En-tête : solde + règle du jeu en une phrase */}
      <Panel>
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-violet-500/20 border border-violet-400/30 flex items-center justify-center flex-shrink-0 text-violet-200">
            <Palette size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white" style={HEADING}>Personnalise tes cartes</p>
            <p className="text-xs text-violet-300 mt-0.5">1 objet = 1 carte. Une fois appliqué, il y reste.</p>
          </div>
          <span className="flex items-center gap-1.5 text-2xl font-bold text-violet-100 tabular-nums" style={HEADING} aria-label={`${fragments} fragments`}>
            <Gem size={18} className="text-violet-300" />{fragments}
          </span>
        </div>
        <p className="mt-3 text-[11px] text-violet-400">Les fragments viennent des doublons de boosters et des missions du jour.</p>
      </Panel>

      <div className="flex justify-center">
        <PillTabs tabs={tabs} value={view} onChange={setView} layoutId="waifinity-atelier-view" size="sm" tone="violet" />
      </div>

      {/* ── Boutique ── */}
      {view === "shop" && (
        <div className="space-y-5">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrer par type">
            {slotChips.map(({ key, label }) => (
              <button key={key} onClick={() => { haptics.tap(); setSlotFilter(key); }} aria-pressed={slotFilter === key}
                className={`px-3 py-1 rounded-full text-[11px] font-medium border active:scale-95 transition-colors motion-reduce:transition-none ${
                  slotFilter === key ? "bg-amber-400 text-violet-950 border-amber-400 font-semibold" : "bg-white/5 border-white/10 text-violet-200 hover:bg-white/10"}`}>
                {label}
              </button>
            ))}
          </div>

          {COSMETIC_SLOTS.filter(({ key }) => slotFilter === "all" || slotFilter === key).map(({ key, label }) => (
            <section key={key} className="space-y-2.5">
              <SectionTitle title={label} hint={key === "frame" ? "Remplace la bordure et le halo de la carte." : "Calque animé par-dessus l'illustration."} />
              <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {COSMETICS.filter((c) => c.slot === key).map((item) => (
                  <ProductCard key={item.id} item={item} previewCard={previewCard}
                    qty={stock[item.id] || 0} fragments={fragments} flashed={flashId === item.id}
                    onOpen={() => setSheet({ id: item.id, step: "detail" })}
                    onBuy={() => quickBuy(item)} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {/* ── Stock + cartes personnalisées ── */}
      {view === "stock" && (
        <div className="space-y-6">
          <section className="space-y-2.5">
            <SectionTitle title="Prêts à appliquer" hint={total ? `${total} objet${total > 1 ? "s" : ""} en stock` : undefined} />
            {inStock.length ? (
              <ul className="space-y-2">
                {inStock.map((item) => (
                  <StockRow key={item.id} item={item} qty={stock[item.id]} previewCard={previewCard}
                    onApply={() => setSheet({ id: item.id, step: "pick" })}
                    onOpen={() => setSheet({ id: item.id, step: "detail" })} />
                ))}
              </ul>
            ) : (
              <Panel className="text-center">
                <p className="text-sm font-semibold text-white" style={HEADING}>Ton stock est vide</p>
                <p className="mt-1 text-xs text-violet-300">Achète un cadre ou un effet avec tes fragments, puis applique-le sur la carte de ton choix.</p>
                <GameButton className="mt-3" size="sm" onClick={() => setView("shop")}>Voir la boutique</GameButton>
              </Panel>
            )}
          </section>

          {customized.length > 0 && (
            <section className="space-y-2.5">
              <SectionTitle title="Cartes personnalisées" hint="Touche une carte pour ouvrir sa fiche et gérer ses cosmétiques." />
              <ul className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                {customized.slice(0, 12).map((c) => (
                  <li key={c.id}>
                    <button onClick={() => onOpenSheet?.(c.id)} className="block w-full text-left active:scale-95 transition-transform motion-reduce:transition-none">
                      <CardFrame tier={c.tier} cosmetic={equipped[c.id]} className="relative aspect-[3/4] w-full">
                        {c.image
                          ? <img src={c.image} alt="" loading="lazy" draggable={false} className="absolute inset-0 w-full h-full object-cover" />
                          : <div className="absolute inset-0 flex items-center justify-center text-violet-600">?</div>}
                      </CardFrame>
                      <p className="mt-1 text-[10.5px] leading-tight text-violet-100 truncate">{c.name}</p>
                    </button>
                  </li>
                ))}
              </ul>
              {customized.length > 12 && (
                <p className="text-center text-[11px] text-violet-400">+ {customized.length - 12} autres dans ta collection.</p>
              )}
            </section>
          )}
        </div>
      )}

      <AnimatePresence>
        {sheetItem && (
          <CosmeticSheet
            key={`${sheetItem.id}:${sheet.step}`}
            item={sheetItem}
            initialStep={sheet.step}
            previewCard={previewCard}
            fragments={fragments}
            stock={stock[sheetItem.id] || 0}
            collectionList={collectionList}
            favorites={favorites}
            equipped={equipped}
            onBuy={onBuy}
            onApply={onApply}
            onClose={() => setSheet(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
