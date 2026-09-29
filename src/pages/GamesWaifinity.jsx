import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence } from "motion/react";
import { ChevronLeft, Sparkles, LayoutGrid, Store, Coins, Library, PackageOpen, Users, AlertTriangle } from "lucide-react";
import { TopBar } from "../components/common/TopBar";
import { PageBanner } from "../components/common/PageBanner";
import { useWaifinity } from "../hooks/useWaifinity";
import { MAX_FAVORITES } from "../utils/waifinity";
import { PackOpening } from "../components/games/PackOpening";
import { PickResultModal } from "../components/games/PickResultModal";
import { CharacterSheetModal } from "../components/games/CharacterSheetModal";
import { CollectionGrid } from "../components/games/CollectionGrid";
import { ShopPanel } from "../components/games/ShopPanel";
import { BoostersTab } from "../components/games/BoostersTab";
import { SocialTab } from "../components/games/SocialTab";
import { PillTabs } from "../components/games/PillTabs";

const TABS = [
  { key: "boosters",   label: "Boosters",   icon: Sparkles },
  { key: "collection", label: "Collection", icon: LayoutGrid },
  { key: "social",     label: "Social",     icon: Users },
  { key: "shop",       label: "Boutique",   icon: Store },
];

function StatTile({ icon, label, value, sub, accent }) {
  return (
    <div className="min-w-0 rounded-2xl bg-violet-900/40 backdrop-blur-md border border-white/10 px-3 sm:px-3.5 py-2.5">
      <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-violet-400">
        {icon}<span className="truncate">{label}</span>
      </div>
      <p className={`mt-1 font-mono text-lg font-bold truncate ${accent || "text-white"}`}>
        {value}{sub && <span className="ml-1 text-[11px] font-medium text-violet-400">{sub}</span>}
      </p>
    </div>
  );
}

export function GamesWaifinity() {
  const navigate = useNavigate();
  const game = useWaifinity();
  const [tab, setTab] = useState("boosters");
  const [result, setResult] = useState(null);
  const [sheetId, setSheetId] = useState(null);

  const sheetEntry = sheetId != null ? game.collection[sheetId] : null;
  const sheetCharacter = sheetId != null ? (game.pool.find((c) => c.id === sheetId) || sheetEntry || null) : null;

  function handleConfirmPick(slot) {
    const r = game.pickCard(slot);
    if (r) setResult(r);
  }

  return (
    <div className="relative min-h-screen bg-violet-950 text-violet-50" style={{ fontFamily: "'Inter',sans-serif" }}>
      <PageBanner height="clamp(180px, 26vw, 280px)" position="80% 20%" />

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 pb-nav pt-safe-8">

        {/* ── En-tête ── */}
        <div className="flex items-start justify-between gap-3 mb-6">
          <div className="min-w-0">
            <button onClick={() => navigate("/games")}
              className="flex items-center gap-1.5 text-sm text-violet-300 hover:text-violet-100 transition-colors mb-3 [text-shadow:0_1px_8px_rgba(20,8,50,0.9)]">
              <ChevronLeft size={16} /> Jeux
            </button>
            <p className="font-mono text-[11px] tracking-[0.3em] text-violet-300 uppercase mb-0.5 [text-shadow:0_1px_8px_rgba(20,8,50,0.9)]">Collectionne tes personnages</p>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2 [text-shadow:0_2px_14px_rgba(20,8,50,0.9)]" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>
              <Sparkles size={26} className="text-violet-200" /> Waifinity
            </h1>
          </div>
          <TopBar />
        </div>

        {/* ── Stats — toujours visibles ── */}
        <div className="grid grid-cols-3 gap-2.5 mb-5">
          <StatTile icon={<Coins size={11} className="text-amber-400" />} label="Anigold" value={game.coins} accent="text-amber-300" />
          <StatTile icon={<Library size={11} />} label="Collection" value={game.collectionList.length}
            sub={game.pool.length ? `/ ${game.pool.length}` : undefined} />
          <StatTile icon={<PackageOpen size={11} />} label="Boosters" value={game.stats.opened} />
        </div>

        {game.saveIssue && game.syncIssue && (
          <div className="flex items-center gap-2 mb-4 px-3 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs">
            <AlertTriangle size={14} className="flex-shrink-0" />
            Sauvegarde locale ET synchronisation en ligne impossibles (stockage plein + pas de connexion) — ta dernière action risque de ne pas être conservée. Vérifie ta connexion et libère de l'espace de stockage sur cet appareil.
          </div>
        )}
        {game.saveIssue && !game.syncIssue && (
          <div className="flex items-center gap-2 mb-4 px-3 py-2.5 rounded-xl bg-amber-400/10 border border-amber-400/30 text-amber-200 text-xs">
            <AlertTriangle size={14} className="flex-shrink-0" />
            Stockage local plein sur cet appareil — ta collection reste correctement sauvegardée en ligne et sera réparée automatiquement à la prochaine ouverture. Tu peux libérer de l'espace pour que ça cesse de s'afficher.
          </div>
        )}

        {/* ── Onglets ── */}
        <div className="flex justify-center mb-6">
          <PillTabs tabs={TABS} value={tab} onChange={setTab} layoutId="waifinity-tab-pill" disabled={!!game.pendingPack} />
        </div>

        {/* Un booster en cours d'ouverture prend le pas sur les onglets */}
        {game.pendingPack ? (
          <PackOpening pack={game.pendingPack} collection={game.collection} onConfirm={handleConfirmPick} />
        ) : (
          <>
            {tab === "boosters"   && <BoostersTab game={game} onGoShop={() => setTab("shop")} />}
            {tab === "collection" && <CollectionGrid collectionList={game.collectionList} pool={game.pool} collection={game.collection} favorites={game.favorites} onOpenSheet={setSheetId} />}
            {tab === "social" && <SocialTab game={game} />}
            {tab === "shop" && (
              <ShopPanel
                pool={game.pool} pendingPack={game.pendingPack}
                canAffordChance={game.canAffordChance} canAffordTarget={game.canAffordTarget} canAffordGender={game.canAffordGender}
                onBuyChance={game.openChanceBooster} onBuyTargeted={game.openTargetedBooster} onBuyGender={game.openGenderBooster}
              />
            )}
          </>
        )}
      </div>

      <AnimatePresence>
        {result && <PickResultModal key="pick-result" result={result} onClose={() => setResult(null)} />}
      </AnimatePresence>

      <AnimatePresence>
        {sheetCharacter && (
          <CharacterSheetModal
            key="character-sheet"
            character={sheetCharacter}
            entry={sheetEntry}
            canAffordTarget={game.canAffordTarget}
            canAffordWish={game.canAffordWish}
            busy={!!game.pendingPack}
            isFavorite={sheetId != null && game.favorites.includes(sheetId)}
            favoritesFull={game.favorites.length >= MAX_FAVORITES}
            onBuyTargeted={game.openTargetedBooster}
            onBuyWish={game.openWishBooster}
            onToggleFavorite={game.toggleFavorite}
            onClose={() => setSheetId(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
