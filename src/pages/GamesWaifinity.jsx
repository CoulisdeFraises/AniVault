import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle } from "lucide-react";
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
import { SeriesExplorer } from "../components/games/SeriesExplorer";
import { WaifinityHud } from "../components/games/WaifinityHud";
import { Eyebrow, HEADING } from "../components/games/ui";
import { useAuth } from "../context/AuthContext";
import { tradeNeedsMe } from "../utils/waifinityTrades";

// Les 5 écrans du jeu. La navigation se fait par la barre du bas (WaifinityNav) ;
// l'écran actif vit dans l'URL (?tab=…) pour que les liens des notifications,
// le bouton retour et le rechargement retombent au bon endroit.
const TABS = [
  { key: "boosters",   title: "Boosters",   desc: "Récupère tes récompenses et ouvre des boosters." },
  { key: "collection", title: "Collection", desc: "Tes personnages, tes favoris, ta progression." },
  { key: "social",     title: "Social",     desc: "Compare ta collection et échange avec tes amis." },
  { key: "series",     title: "Séries",     desc: "Explore toutes les séries et complète-les." },
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
  const favSet = useMemo(() => new Set(game.favorites), [game.favorites]);

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
      {/* Décor : lueurs fixes derrière tous les écrans (l'illustration n'habille que l'écran Boosters) */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 80% 45% at 50% -8%, rgba(109,40,217,0.55) 0%, transparent 70%)" }} />
        <div className="absolute -top-20 -right-24 w-96 h-96 rounded-full bg-fuchsia-600/[0.14] blur-3xl" />
        <div className="absolute bottom-10 -left-28 w-96 h-96 rounded-full bg-amber-400/[0.08] blur-3xl" />
      </div>
      {tab === "boosters" && <PageBanner height="clamp(200px, 28vw, 300px)" position="80% 20%" />}

      <PullToRefresh onRefresh={handlePullRefresh} className="relative z-10">
      {/* Barre de statut du joueur : niveau, Anigold, fragments — collée en haut de tous les écrans */}
      <WaifinityHud game={game} />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 pb-nav pt-5">

        {/* ── En-tête de l'écran ── */}
        <div className="flex items-start justify-between gap-3 mb-5">
          <div className="min-w-0">
            <Eyebrow className="[text-shadow:0_1px_8px_rgba(20,8,50,0.9)]">Waifinity</Eyebrow>
            <h1 className="mt-0.5 text-[1.7rem] sm:text-3xl font-bold tracking-tight text-white [text-shadow:0_2px_14px_rgba(20,8,50,0.9)]" style={HEADING}>
              {tabMeta.title}
            </h1>
            <p className="mt-1 text-sm text-violet-200 [text-shadow:0_1px_8px_rgba(20,8,50,0.9)]">{tabMeta.desc}</p>
          </div>
          <TopBar onRefresh={game.refreshWaifinity} refreshing={game.refreshing} refreshLabel="Rafraîchir Waifinity" />
        </div>

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
                <CollectionGrid collectionList={game.collectionList} pool={game.pool} collection={game.collection} favorites={game.favorites} equipped={game.equipped} onOpenSheet={setSheetId} onGoBoosters={() => setTab("boosters")}
                  onMoveFavorite={game.moveFavorite} onReorderFavorites={game.setFavoritesOrder} onToggleFavorite={companion.toggleFavorite} />
              )}
              {tab === "series" && (
                <SeriesExplorer
                  pool={game.pool} collection={game.collection} favorites={favSet} equipped={game.equipped} onOpenSheet={setSheetId}
                  onBuyTargeted={game.openTargetedBooster} canAffordTarget={game.canAffordTarget} coins={game.coins} busy={!!game.pendingPack}
                />
              )}
              {tab === "social" && <SocialTab game={game} initialView={searchParams.get("view")} />}
              {tab === "shop" && (
                <ShopPanel
                  pool={game.pool} pendingPack={game.pendingPack} coins={game.coins}
                  canAffordBooster={game.canAffordBooster} canAffordTarget={game.canAffordTarget} canAffordGender={game.canAffordGender}
                  onBuyStandard={game.openStandardBooster} onBuyTargeted={game.openTargetedBooster} onBuyGender={game.openGenderBooster}
                  banner={game.banner} canAffordBanner={game.canAffordBanner} onBuyBanner={game.openBannerBooster}
                  fragments={game.fragments} cosmeticStock={game.cosmeticStock} collectionList={game.collectionList}
                  favorites={game.favorites} equipped={game.equipped}
                  onBuyCosmetic={companion.buyCosmetic} onApplyCosmetic={game.applyCosmetic} onOpenSheet={setSheetId}
                  onGoSeries={() => setTab("series")}
                  initialView={searchParams.get("view")}
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
            stock={game.cosmeticStock}
            onApplyCosmetic={(id) => game.applyCosmetic(sheetId, id)}
            onRemoveCosmetic={(slot) => game.removeCosmetic(sheetId, slot)}
            onGoAtelier={() => { setSheetId(null); setSearchParams({ tab: "shop", view: "atelier" }, { replace: true }); window.scrollTo(0, 0); }}
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
