import { MarqueeText } from "../common/MarqueeText";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Trophy, Medal, RefreshCw, AlertTriangle, Sparkles } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { fetchFriends, fetchMyProfile } from "../../services/community";
import { fetchWaifinityItemsBulk } from "../../services/waifinitySocial";
import { RARITY, normalizeTier, countByTier, collectionScore } from "../../utils/waifinity";
import { Avatar } from "../common/Avatar";
import { PillTabs } from "./PillTabs";
import { GameButton } from "./ui";
import { TradesView } from "./TradesView";

const SOCIAL_VIEWS = [
  { key: "leaderboard", label: "Classement" },
  { key: "trades", label: "Échanges" },
];

const MEDAL_COLOR = ["text-amber-300", "text-slate-300", "text-orange-400"];

function RankRow({ rank, name, color, photoUrl, score, owned, isMe }) {
  return (
    <div className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${isMe ? "bg-amber-400/10 border border-amber-400/30" : "bg-violet-900/40 border border-white/10"}`}>
      <div className="w-6 flex-shrink-0 text-center">
        {rank <= 3
          ? <Medal size={16} className={`mx-auto ${MEDAL_COLOR[rank - 1]}`} />
          : <span className="font-mono text-xs text-violet-400">{rank}</span>}
      </div>
      <Avatar name={name} color={color} photoUrl={photoUrl} size="sm" />
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-semibold truncate ${isMe ? "text-amber-200" : "text-white"}`}>{name}{isMe && " (toi)"}</p>
        <p className="text-[10.5px] text-violet-400">{owned} personnage{owned > 1 ? "s" : ""}</p>
      </div>
      <p className="font-mono text-sm font-bold text-violet-100 flex-shrink-0">{score}</p>
    </div>
  );
}

function TradeTransferOverlay({ trade, myId, onClose }) {
  const isFrom = trade.from_user === myId;
  const outgoing = {
    name: isFrom ? trade.offer_name : trade.request_name,
    image: isFrom ? trade.offer_image : trade.request_image,
    tier: isFrom ? trade.offer_tier : trade.request_tier,
  };
  const incoming = {
    name: isFrom ? trade.request_name : trade.offer_name,
    image: isFrom ? trade.request_image : trade.offer_image,
    tier: isFrom ? trade.request_tier : trade.offer_tier,
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center overflow-hidden bg-violet-950/92 backdrop-blur-md animate-fadeIn"
      role="dialog"
      aria-label="Échange effectué"
      onClick={onClose}
    >
      <div className="absolute inset-0 pointer-events-none trade-transfer-stars" />
      <div className="relative w-full max-w-sm px-6 text-center">
        <div className="mb-6 animate-tradeTitle">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/25 bg-amber-300/10 px-3 py-1.5 text-[10px] uppercase tracking-[0.22em] text-amber-200">
            <Sparkles size={12} /> Échange effectué
          </div>
          <h2 className="mt-3 text-2xl font-bold text-white" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>
            Ta nouvelle carte arrive
          </h2>
          <p className="mt-1 text-xs text-violet-300">Ton ancienne carte quitte ta collection.</p>
        </div>

        <div className="relative h-[330px]">
          <div className="trade-incoming absolute left-1/2 top-1/2 w-44 -translate-x-1/2 -translate-y-1/2 opacity-0">
            <div className="rounded-2xl overflow-hidden border-2 border-white/20 bg-violet-900 shadow-2xl shadow-fuchsia-500/20">
              {incoming.image && <img src={incoming.image} alt="" className="w-full aspect-[3/4] object-cover" />}
            </div>
            <MarqueeText as="p" className="mt-2 text-sm font-semibold text-white">{incoming.name}</MarqueeText>
            <p className={`text-[10px] ${RARITY[normalizeTier(incoming.tier)].text}`}>{RARITY[normalizeTier(incoming.tier)].label}</p>
          </div>

          <div className="trade-outgoing absolute left-1/2 top-1/2 w-44 -translate-x-1/2 -translate-y-1/2">
            <div className="rounded-2xl overflow-hidden border-2 border-amber-300/40 bg-violet-900 shadow-2xl shadow-amber-500/20">
              {outgoing.image && <img src={outgoing.image} alt="" className="w-full aspect-[3/4] object-cover" />}
            </div>
            <MarqueeText as="p" className="mt-2 text-sm font-semibold text-white">{outgoing.name}</MarqueeText>
            <p className={`text-[10px] ${RARITY[normalizeTier(outgoing.tier)].text}`}>{RARITY[normalizeTier(outgoing.tier)].label} · carte échangée</p>
          </div>

          <div className="absolute left-1/2 top-1/2 w-72 h-72 -translate-x-1/2 -translate-y-1/2 rounded-full border border-amber-300/10 animate-tradeRing pointer-events-none" />
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-2 inline-flex items-center justify-center rounded-xl bg-white/10 border border-white/10 px-5 py-2.5 text-xs font-semibold text-white hover:bg-white/15"
        >
          Continuer
        </button>
      </div>
    </div>
  );
}

export function SocialTab({ game, initialView }) {
  const { user } = useAuth();
  const myId = user?.id || null;

  const [view, setView] = useState(initialView === "trades" ? "trades" : "leaderboard");
  useEffect(() => { if (initialView === "trades" || initialView === "leaderboard") setView(initialView); }, [initialView]);

  const [friends, setFriends] = useState([]);
  const [friendsLoading, setFriendsLoading] = useState(true);
  const [myProfile, setMyProfile] = useState(null);
  // Classement : les DONNÉES (miroir de chaque joueur) sont lues une fois puis
  // conservées ; le score est recalculé à la volée (voir `leaderboard` plus bas), donc
  // un changement de bassin ne déclenche pas de nouvelle requête.
  const [itemsByUser, setItemsByUser] = useState(null);
  const [boardError, setBoardError] = useState(false);
  const [boardLoading, setBoardLoading] = useState(false);
  const [boardUpdatedAt, setBoardUpdatedAt] = useState(null);
  const [animationTrade, setAnimationTrade] = useState(null);

  const friendsById = useMemo(() => Object.fromEntries(friends.map((f) => [f.user_id, f])), [friends]);

  const loadFriends = useCallback(async () => {
    if (!myId) return;
    setFriendsLoading(true);
    const [list, profile] = await Promise.all([fetchFriends(myId), fetchMyProfile(myId)]);
    setFriends(list);
    setMyProfile(profile);
    setFriendsLoading(false);
  }, [myId]);

  useEffect(() => { loadFriends(); }, [loadFriends]);

  // Rareté « de référence » de chaque personnage = celle du bassin ACTUEL.
  // La colonne `tier` du miroir est figée au dernier envoi de la carte : dès que
  // le bassin est re-classé, elle est périmée pour tout joueur qui n'a pas rouvert
  // le jeu depuis — d'où des scores qui divergeaient selon qui regardait.
  const poolTier = useMemo(() => new Map((game.pool || []).map((c) => [String(c.id), c.tier])), [game.pool]);

  // Score + nombre de personnages DISTINCTS d'un joueur, calculés à partir de son
  // miroir (même source, même formule pour tout le monde, moi compris).
  const scoreItems = useCallback((items) => {
    const seen = new Set();
    const tiered = [];
    for (const it of items || []) {
      if (!(Number(it.count) > 0)) continue;
      const key = String(it.character_id);
      if (seen.has(key)) continue;
      seen.add(key);
      tiered.push({ tier: poolTier.get(key) ?? it.tier });
    }
    return { score: collectionScore(countByTier(tiered)), owned: tiered.length };
  }, [poolTier]);

  const collectionSize = (game.collectionList || []).length;

  const friendIds = useMemo(() => friends.map((f) => f.user_id), [friends]);
  const lastItemsLoadRef = useRef(0);

  // Moi + mes amis, lus au même endroit (colonnes minimales, lecture paginée) : tous
  // les scores sont comparables et identiques à ce que mes amis voient de moi.
  // En cas d'erreur on GARDE le dernier classement connu et on l'indique, plutôt que
  // d'afficher des scores calculés sur des données incomplètes.
  const loadItems = useCallback(async () => {
    if (!myId) return;
    lastItemsLoadRef.current = Date.now();
    setBoardLoading(true);
    const byUser = await fetchWaifinityItemsBulk([myId, ...friendIds], "user_id, character_id, count, tier");
    setBoardLoading(false);
    if (!byUser) { setBoardError(true); return; }
    setBoardError(false);
    setItemsByUser(byUser);
    setBoardUpdatedAt(Date.now());
  }, [myId, friendIds]);

  // Relu à l'ouverture, quand ma collection change (booster, échange) et au retour sur l'app.
  useEffect(() => { if (!friendsLoading) loadItems(); }, [friendsLoading, loadItems, collectionSize]);
  useEffect(() => {
    // Au retour sur l'app : pas plus d'une relecture toutes les 5 min (chaque relecture télécharge la
    // collection de MOI + de TOUS mes amis). Les changements de ma collection relancent déjà la lecture.
    const onVisible = () => {
      if (document.visibilityState !== "visible" || friendsLoading) return;
      if (Date.now() - lastItemsLoadRef.current < 5 * 60 * 1000) return;
      loadItems();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [friendsLoading, loadItems]);

  const leaderboard = useMemo(() => {
    if (!myId || !itemsByUser) return null;
    const rows = friends.map((f) => ({
      userId: f.user_id, name: f.username, color: f.avatar_color, photoUrl: f.avatar_url, ...scoreItems(itemsByUser[f.user_id]),
    }));
    rows.push({
      userId: myId, isMe: true,
      name: myProfile?.username || "Toi", color: myProfile?.avatar_color, photoUrl: myProfile?.avatar_url,
      ...scoreItems(itemsByUser[myId]),
    });
    // Tri déterministe : à score égal, mêmes critères pour tous (sinon l'ordre
    // dépendrait de l'ordre de la liste d'amis de chacun).
    rows.sort((a, b) =>
      b.score - a.score ||
      b.owned - a.owned ||
      String(a.name).localeCompare(String(b.name), "fr", { sensitivity: "base" }) ||
      String(a.userId).localeCompare(String(b.userId))
    );
    return rows;
  }, [myId, friends, myProfile, itemsByUser, scoreItems]);



  // Échange terminé par l'autre ami pendant que l'écran est ouvert → animation.
  const { completedTrade, clearCompletedTrade } = game;
  useEffect(() => {
    if (completedTrade) { setAnimationTrade(completedTrade); clearCompletedTrade(); }
  }, [completedTrade, clearCompletedTrade]);

  if (friendsLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-violet-300">
        <RefreshCw size={22} className="animate-spin motion-reduce:animate-none" />
        <p className="text-sm">Chargement…</p>
      </div>
    );
  }

  if (!friends.length) {
    return (
      <div className="rounded-2xl border border-dashed border-white/15 bg-violet-900/20 py-10 text-center px-4">
        <Trophy size={26} className="mx-auto text-violet-500 mb-2" />
        <p className="text-sm text-violet-200">Ajoute des amis sur AniVault pour débloquer le classement et les échanges de cartes.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-center">
        <PillTabs tabs={SOCIAL_VIEWS} value={view} onChange={setView} layoutId="waifinity-social-view" size="sm" tone="violet" />
      </div>

      {view === "leaderboard" && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 px-0.5">
            <p className="text-[11px] text-violet-400">
              {boardUpdatedAt ? `Mis à jour à ${new Date(boardUpdatedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}` : "Chargement du classement…"}
            </p>
            <GameButton variant="ghost" size="sm" onClick={loadItems} loading={boardLoading}>
              {!boardLoading && <RefreshCw size={12} />}Actualiser
            </GameButton>
          </div>

          {boardError && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs">
              <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
              <span>Impossible de lire toutes les collections.{leaderboard ? " Le classement affiché date de la dernière lecture réussie." : ""} Réessaie avec « Actualiser ».</span>
            </div>
          )}

          {(leaderboard || []).map((r, i) => (
            <RankRow key={r.userId} rank={i + 1} name={r.name} color={r.color} photoUrl={r.photoUrl} score={r.score} owned={r.owned} isMe={r.isMe} />
          ))}
          <p className="text-[10px] text-violet-500 px-1 pt-1">
            Score = personnages distincts pondérés par rareté (les doublons ne comptent qu'une fois), d'après les collections synchronisées. À score égal : plus de personnages, puis ordre alphabétique.
          </p>
        </div>
      )}

      {view === "trades" && (
        <TradesView
          game={game}
          myId={myId}
          friends={friends}
          friendsById={friendsById}
          itemsByUser={itemsByUser}
          onRefreshItems={loadItems}
          onAccepted={setAnimationTrade}
        />
      )}

      {animationTrade && (
        <TradeTransferOverlay
          trade={animationTrade}
          myId={myId}
          onClose={() => setAnimationTrade(null)}
        />
      )}
    </div>
  );
}
