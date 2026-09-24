import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence } from "motion/react";
import { ChevronLeft, Sparkles, LayoutGrid, Store, Coins, Clock, RefreshCw, AlertTriangle } from "lucide-react";
import { TopBar } from "../components/common/TopBar";
import { PageBanner } from "../components/common/PageBanner";
import { useWaifinity } from "../hooks/useWaifinity";
import { PackOpening } from "../components/games/PackOpening";
import { PickResultModal } from "../components/games/PickResultModal";
import { CollectionGrid } from "../components/games/CollectionGrid";
import { ShopPanel } from "../components/games/ShopPanel";
import { formatCountdown } from "../utils/waifinity";
import { haptics } from "../utils/haptics";

const TABS = [
  { key: "boosters",   label: "Boosters",   icon: Sparkles },
  { key: "collection", label: "Collection", icon: LayoutGrid },
  { key: "shop",        label: "Boutique",   icon: Store },
];

function BoostersTab({ game }) {
  const { pool, poolLoading, poolError, canOpenFree, cooldownMs, openFreeBooster, reloadPool } = game;

  if (poolLoading && !pool.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-violet-300">
        <RefreshCw size={22} className="animate-spin" />
        <p className="text-sm">Chargement des personnages depuis AniList…</p>
      </div>
    );
  }
  if (poolError && !pool.length) {
    return (
      <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-5 text-center">
        <AlertTriangle size={22} className="mx-auto text-rose-300 mb-2" />
        <p className="text-sm text-rose-200 mb-3">{poolError}</p>
        <button onClick={reloadPool} className="px-4 py-2 rounded-xl bg-rose-500/20 border border-rose-400/40 text-rose-100 text-sm">Réessayer</button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-gradient-to-br from-violet-800/50 to-violet-950/50 border border-white/10 p-6 text-center">
      <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-400/15 border border-amber-400/30 flex items-center justify-center mb-3">
        <Sparkles size={26} className="text-amber-300" />
      </div>
      <p className="text-lg font-bold text-white mb-1" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>Booster gratuit</p>
      <p className="text-xs text-violet-300 mb-5">10 waifus à révéler, choisis-en une à adopter. Un booster gratuit toutes les heures.</p>

      <button
        onClick={() => { haptics.success(); openFreeBooster(); }}
        disabled={!canOpenFree}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-amber-400 text-violet-950 font-semibold disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] transition-transform"
      >
        {canOpenFree ? <><Sparkles size={16} />Ouvrir le booster</> : <><Clock size={16} />Disponible dans {formatCountdown(cooldownMs)}</>}
      </button>
    </div>
  );
}

export function GamesWaifinity() {
  const navigate = useNavigate();
  const game = useWaifinity();
  const [tab, setTab] = useState("boosters");
  const [result, setResult] = useState(null);

  function handleConfirmPick(slot) {
    const r = game.pickCard(slot);
    if (r) setResult(r);
  }

  return (
    <div className="relative min-h-screen bg-violet-950 text-violet-50" style={{ fontFamily: "'Inter',sans-serif" }}>
      <PageBanner height="clamp(180px, 26vw, 280px)" position="80% 20%" />

      <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 pb-nav pt-safe-8">
        <div className="flex items-start justify-between flex-wrap gap-3 mb-5">
          <div className="min-w-0">
            <button onClick={() => navigate("/games")} className="flex items-center gap-1.5 text-sm text-violet-300 hover:text-violet-100 transition-colors mb-3 [text-shadow:0_1px_8px_rgba(20,8,50,0.9)]">
              <ChevronLeft size={16} /> Jeux
            </button>
            <p className="font-mono text-[11px] tracking-[0.3em] text-violet-300 uppercase mb-0.5 [text-shadow:0_1px_8px_rgba(20,8,50,0.9)]">Waifinity</p>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2 [text-shadow:0_2px_14px_rgba(20,8,50,0.9)]" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>
              Collectionne tes waifus
            </h1>
          </div>
          <TopBar />
        </div>

        {/* Solde de pièces — toujours visible */}
        <div className="flex items-center gap-2 mb-4 px-3.5 py-2 rounded-xl bg-violet-900/40 border border-white/10 w-fit">
          <Coins size={15} className="text-amber-400" />
          <span className="font-mono text-sm font-bold text-amber-300">{game.coins}</span>
          <span className="text-xs text-violet-300">Waifu Coins</span>
        </div>

        {/* Onglets */}
        <div className="flex rounded-2xl bg-violet-900/40 border border-white/10 p-1 mb-5">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setTab(key)} disabled={!!game.pendingPack}
              className={`flex-1 flex items-center justify-center gap-1.5 h-9 rounded-xl text-[13px] font-medium active:scale-95 transition-colors motion-reduce:transition-none disabled:opacity-40 ${
                tab === key ? "bg-amber-400 text-violet-950 font-semibold" : "text-violet-200 hover:text-white"}`}>
              <Icon size={14} />{label}
            </button>
          ))}
        </div>

        {/* Un booster en cours d'ouverture prend le pas sur les onglets */}
        {game.pendingPack ? (
          <PackOpening pack={game.pendingPack} onConfirm={handleConfirmPick} />
        ) : (
          <>
            {tab === "boosters" && <BoostersTab game={game} />}
            {tab === "collection" && <CollectionGrid collectionList={game.collectionList} poolSize={game.pool.length} />}
            {tab === "shop" && (
              <ShopPanel
                coins={game.coins} pool={game.pool} pendingPack={game.pendingPack}
                canAffordChance={game.canAffordChance} canAffordTarget={game.canAffordTarget}
                onBuyChance={game.openChanceBooster} onBuyTargeted={game.openTargetedBooster}
              />
            )}
          </>
        )}
      </div>

      <AnimatePresence>
        {result && <PickResultModal key="pick-result" result={result} onClose={() => setResult(null)} />}
      </AnimatePresence>
    </div>
  );
}
