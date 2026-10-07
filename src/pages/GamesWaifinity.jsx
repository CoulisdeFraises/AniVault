import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, Sparkles, AlertTriangle } from "lucide-react";
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
import { WaifinityNav } from "../components/games/WaifinityNav";
import { WalletHero } from "../components/games/WalletHero";
import { useAuth } from "../context/AuthContext";
import { tradeNeedsMe } from "../utils/waifinityTrades";

// Les 4 écrans du jeu. La navigation se fait par la barre du bas (WaifinityNav) ;
// l'écran actif vit dans l'URL (?tab=…) pour que les liens des notifications,
// le bouton retour et le rechargement retombent au bon endroit.
const TABS = [
  { key: "boosters",   title: "Boosters",   desc: "Récupère tes récompenses et ouvre des boosters." },
  { key: "collection", title: "Collection", desc: "Tes personnages, tes séries et tes favoris." },
  { key: "social",     title: "Social",     desc: "Compare ta collection et échange avec tes amis." },
  { key: "shop",       title: "Boutique",   desc: "Dépense ton Anigold et tes fragments." },
];

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
  const { user } = useAuth();
  // Écran actif dans l'URL — lien profond depuis une notification : ?tab=social&view=trades
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const tabMeta = TABS.find((t) => t.key === tabParam) || TABS[0];
  const tab = tabMeta.key;
  function setTab(key) {
    if (key === tab) { window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    setSearchParams(key === "boosters" ? {} : { tab: key }, { replace: true });
    window.scrollTo(0, 0);
  }

  // Pastilles de la barre : ce qui attend une action du joueur.
  const tradesTodo = (game.trades || []).filter((t) => tradeNeedsMe(t, user?.id)).length;
  const missionsReady = game.missions?.list?.filter((m) => m.done && !m.claimed).length || 0;
  const bonusReady = game.missions?.allClaimed && !game.missions?.bonusClaimed ? 1 : 0;
  const boostersTodo = (game.canOpenFree ? 1 : 0) + (game.daily && !game.daily.claimed ? 1 : 0) + missionsReady + bonusReady;
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
        <div className="flex items-start justify-between gap-3 mb-5">
          <div className="min-w-0">
            <button onClick={() => navigate("/games")}
              className="flex items-center gap-1.5 text-sm text-violet-300 hover:text-violet-100 transition-colors mb-3 [text-shadow:0_1px_8px_rgba(20,8,50,0.9)]">
              <ChevronLeft size={16} /> Jeux
            </button>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2 [text-shadow:0_2px_14px_rgba(20,8,50,0.9)]" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>
              <Sparkles size={26} className="text-amber-300" /> Waifinity
              <span className="text-violet-300 font-medium">/ {tabMeta.title}</span>
            </h1>
            <p className="mt-1 text-sm text-violet-200 [text-shadow:0_1px_8px_rgba(20,8,50,0.9)]">{tabMeta.desc}</p>
          </div>
          <TopBar onRefresh={game.refreshWaifinity} refreshing={game.refreshing} refreshLabel="Rafraîchir Waifinity" />
        </div>

        <WalletHero game={game} compact={tab !== "boosters"} />

        {game.saveIssue && game.syncIssue && (
          <Banner>Sauvegarde locale et synchronisation en ligne impossibles (stockage plein et pas de connexion). Ta dernière action risque de ne pas être conservée : vérifie ta connexion et libère de l'espace sur cet appareil.</Banner>
        )}
        {game.walletIssue && (
          <Banner>Synchronisation de l'Anigold impossible : {game.walletIssue}</Banner>
        )}
        {game.saveIssue && !game.syncIssue && (
          <Banner tone="warn">Stockage local plein sur cet appareil. Ta collection reste sauvegardée en ligne et sera réparée à la prochaine ouverture ; libère de l'espace pour faire disparaître ce message.</Banner>
        )}

        {/* Un booster en cours d'ouverture prend le pas sur les écrans */}
        {game.pendingPack ? (
          <PackOpening pack={game.pendingPack} collection={game.collection} onConfirm={handleClaimPack} />
        ) : (
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16, ease: "easeOut" }}
            >
              {tab === "boosters" && (
                <BoostersTab
                  game={{ ...game, claimDaily: companion.claimDaily, claimMission: companion.claimMission, claimMissionBonus: companion.claimMissionBonus }}
                  onGoShop={() => setTab("shop")}
                />
              )}
              {tab === "collection" && (
                <CollectionGrid collectionList={game.collectionList} pool={game.pool} collection={game.collection} favorites={game.favorites} equipped={game.equipped} onOpenSheet={setSheetId}
                  onMoveFavorite={game.moveFavorite} onReorderFavorites={game.setFavoritesOrder} onToggleFavorite={companion.toggleFavorite} />
              )}
              {tab === "social" && <SocialTab game={game} initialView={searchParams.get("view")} />}
              {tab === "shop" && (
                <ShopPanel
                  pool={game.pool} pendingPack={game.pendingPack} coins={game.coins}
                  canAffordBooster={game.canAffordBooster} canAffordTarget={game.canAffordTarget} canAffordGender={game.canAffordGender}
                  onBuyStandard={game.openStandardBooster} onBuyTargeted={game.openTargetedBooster} onBuyGender={game.openGenderBooster}
                  banner={game.banner} canAffordBanner={game.canAffordBanner} onBuyBanner={game.openBannerBooster}
                  fragments={game.fragments} ownedCosmetics={game.ownedCosmetics} onBuyCosmetic={companion.buyCosmetic}
                />
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
      </PullToRefresh>

      {/* Barre de navigation du jeu — masquée pendant l'ouverture d'un booster (écran immersif) */}
      {!game.pendingPack && (
        <WaifinityNav tab={tab} onChange={setTab} badges={{ boosters: boostersTodo, social: tradesTodo }} />
      )}

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
            cosmetic={game.equipped[sheetId]}
            ownedCosmetics={game.ownedCosmetics}
            onEquip={(slot, id) => game.equipCosmetic(sheetId, slot, id)}
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
