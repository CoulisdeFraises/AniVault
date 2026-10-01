import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence } from "motion/react";
import { ChevronLeft, Sparkles, LayoutGrid, Store, Coins, Users, AlertTriangle } from "lucide-react";
import { TopBar } from "../components/common/TopBar";
import { PageBanner } from "../components/common/PageBanner";
import { PullToRefresh } from "../components/common/PullToRefresh";
import { useWaifinity } from "../hooks/useWaifinity";
import { useWaifinityCompanion } from "../hooks/useWaifinityCompanion";
import { MAX_FAVORITES } from "../utils/waifinity";
import { PackOpening } from "../components/games/PackOpening";
import { PackResultModal } from "../components/games/PackResultModal";
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

/** Solde, progression de la collection et boosters ouverts — toujours visibles. */
function Overview({ game }) {
  const owned = game.collectionList.length;
  const total = game.pool.length;
  const pct = total ? Math.min(100, (owned / total) * 100) : 0;
  return (
    <section className="mb-5 rounded-3xl bg-gradient-to-br from-violet-800/60 to-violet-900/40 backdrop-blur-md border border-white/10 p-4 sm:p-5">
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs text-violet-300">Solde</p>
          <p className="mt-0.5 flex items-center gap-2 text-3xl font-bold text-amber-300 tabular-nums" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>
            <Coins size={24} className="flex-shrink-0" />
            {game.coins.toLocaleString("fr-FR")}
            <span className="text-sm font-medium text-amber-200/70">Anigold</span>
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-xs text-violet-300">Boosters ouverts</p>
          <p className="mt-0.5 text-lg font-semibold text-white tabular-nums">{game.stats.opened}</p>
        </div>
      </div>
      <div className="mt-4">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="text-violet-300">Collection</span>
          <span className="text-violet-100 tabular-nums">{owned}{total ? ` / ${total}` : ""}</span>
        </div>
        <div className="h-2 rounded-full bg-white/10 overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-fuchsia-500 transition-[width] duration-700 motion-reduce:transition-none"
            style={{ width: `${Math.max(pct, owned ? 2 : 0)}%` }} />
        </div>
      </div>
    </section>
  );
}

const BANNER_TONE = {
  error: "bg-rose-500/10 border-rose-500/30 text-rose-200",
  warn:  "bg-amber-400/10 border-amber-400/30 text-amber-200",
};
function Banner({ tone = "error", children }) {
  return (
    <div role="alert" className={`flex items-start gap-2.5 mb-4 px-3 py-2.5 rounded-xl border text-xs leading-relaxed ${BANNER_TONE[tone]}`}>
      <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
      <p>{children}</p>
    </div>
  );
}

export function GamesWaifinity() {
  const navigate = useNavigate();
  const game = useWaifinity();
  // Réactions du compagnon (booster, série complétée, favori, récompense du jour…)
  const companion = useWaifinityCompanion(game);
  const [tab, setTab] = useState("boosters");
  const [result, setResult] = useState(null);
  const [sheetId, setSheetId] = useState(null);

  const sheetEntry = sheetId != null ? game.collection[sheetId] : null;
  const sheetCharacter = sheetId != null ? (game.pool.find((c) => c.id === sheetId) || sheetEntry || null) : null;

  // Même action que le bouton de l'en-tête. Pas de rafraîchissement pendant
  // l'ouverture d'un booster : la page est alors dans un état transitoire.
  const handlePullRefresh = () => (game.pendingPack ? undefined : game.refreshWaifinity());

  async function handleClaimPack() {
    const r = await game.claimPack();
    if (r?.length) setResult(r);
  }

  return (
    <div className="relative min-h-screen bg-violet-950 text-violet-50" style={{ fontFamily: "'Inter',sans-serif" }}>
      <PageBanner height="clamp(180px, 26vw, 280px)" position="80% 20%" />

      <PullToRefresh onRefresh={handlePullRefresh} className="relative z-10">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pb-nav pt-safe-8">

        {/* ── En-tête ── */}
        <div className="flex items-start justify-between gap-3 mb-6">
          <div className="min-w-0">
            <button onClick={() => navigate("/games")}
              className="flex items-center gap-1.5 text-sm text-violet-300 hover:text-violet-100 transition-colors mb-3 [text-shadow:0_1px_8px_rgba(20,8,50,0.9)]">
              <ChevronLeft size={16} /> Jeux
            </button>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2 [text-shadow:0_2px_14px_rgba(20,8,50,0.9)]" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>
              <Sparkles size={26} className="text-violet-200" /> Waifinity
            </h1>
            <p className="mt-1 text-sm text-violet-200 [text-shadow:0_1px_8px_rgba(20,8,50,0.9)]">Ouvre des boosters et complète ta collection.</p>
          </div>
          <TopBar onRefresh={game.refreshWaifinity} refreshing={game.refreshing} refreshLabel="Rafraîchir Waifinity" />
        </div>

        <Overview game={game} />

        {game.saveIssue && game.syncIssue && (
          <Banner>Sauvegarde locale et synchronisation en ligne impossibles (stockage plein et pas de connexion). Ta dernière action risque de ne pas être conservée : vérifie ta connexion et libère de l'espace sur cet appareil.</Banner>
        )}
        {game.walletIssue && (
          <Banner>Synchronisation de l'Anigold impossible : {game.walletIssue}</Banner>
        )}
        {game.saveIssue && !game.syncIssue && (
          <Banner tone="warn">Stockage local plein sur cet appareil. Ta collection reste sauvegardée en ligne et sera réparée à la prochaine ouverture ; libère de l'espace pour faire disparaître ce message.</Banner>
        )}

        {/* ── Onglets ── */}
        <div className="flex justify-center mb-6">
          <PillTabs tabs={TABS} value={tab} onChange={setTab} layoutId="waifinity-tab-pill" disabled={!!game.pendingPack} />
        </div>

        {/* Un booster en cours d'ouverture prend le pas sur les onglets */}
        {game.pendingPack ? (
          <PackOpening pack={game.pendingPack} collection={game.collection} onConfirm={handleClaimPack} />
        ) : (
          <>
            {tab === "boosters"   && <BoostersTab game={{ ...game, claimDaily: companion.claimDaily }} onGoShop={() => setTab("shop")} />}
            {tab === "collection" && <CollectionGrid collectionList={game.collectionList} pool={game.pool} collection={game.collection} favorites={game.favorites} onOpenSheet={setSheetId} />}
            {tab === "social" && <SocialTab game={game} />}
            {tab === "shop" && (
              <ShopPanel
                pool={game.pool} pendingPack={game.pendingPack} coins={game.coins}
                canAffordBooster={game.canAffordBooster} canAffordTarget={game.canAffordTarget} canAffordGender={game.canAffordGender}
                onBuyStandard={game.openStandardBooster} onBuyTargeted={game.openTargetedBooster} onBuyGender={game.openGenderBooster}
              />
            )}
          </>
        )}
      </div>
      </PullToRefresh>

      <AnimatePresence>
        {result && (
          <PackResultModal
            key="pack-result"
            results={result}
            // La bulle du compagnon est plein écran : elle réagit une fois le récap fermé.
            onClose={() => { companion.onPackClosed(result); setResult(null); }}
          />
        )}
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
            onToggleFavorite={companion.toggleFavorite}
            onClose={() => setSheetId(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
