import { useState, useEffect, useCallback, useMemo } from "react";
import { Trophy, Medal, RefreshCw, ArrowLeftRight, Check, Clock, AlertTriangle } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { fetchFriends, fetchMyProfile } from "../../services/community";
import { fetchWaifinityItems, fetchWaifinityItemsBulk } from "../../services/waifinitySocial";
import { RARITY, normalizeTier, countByTier, collectionScore } from "../../utils/waifinity";
import { Avatar } from "../common/Avatar";
import { RarityBadge } from "./RarityBadge";
import { PillTabs } from "./PillTabs";
import { haptics } from "../../utils/haptics";

const SOCIAL_VIEWS = [
  { key: "leaderboard", label: "Classement" },
  { key: "trades",      label: "Échanges" },
];

const MEDAL_COLOR = ["text-amber-300", "text-slate-300", "text-orange-400"];

/** Ligne du classement (moi ou un ami). */
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

/** Petite carte sélectionnable pour choisir un doublon à offrir / demander. */
function DupeCard({ item, selected, onClick }) {
  const r = RARITY[normalizeTier(item.tier)];
  return (
    <button onClick={onClick}
      className={`relative rounded-lg overflow-hidden border-2 text-left active:scale-95 transition-transform motion-reduce:transition-none
        ${selected ? "border-amber-400 ring-2 ring-amber-400/50" : r.border}`}>
      <div className="relative aspect-[3/4] bg-violet-900">
        {item.image
          ? <img src={item.image} alt="" loading="lazy" className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center text-violet-600 text-xl">?</div>}
        <div className="absolute top-0.5 left-0.5"><RarityBadge tier={item.tier} /></div>
        <span className="absolute top-0.5 right-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-black/70 text-white text-[9px] font-mono font-bold flex items-center justify-center">×{item.count}</span>
        {selected && (
          <div className="absolute inset-0 bg-amber-400/20 flex items-center justify-center">
            <span className="w-6 h-6 rounded-full bg-amber-400 text-violet-950 flex items-center justify-center"><Check size={13} strokeWidth={3} /></span>
          </div>
        )}
      </div>
      <p className="px-1.5 py-1 text-[10px] font-semibold text-white truncate bg-black/50">{item.name}</p>
    </button>
  );
}

const STATUS_LABEL = { pending: "En attente", accepted: "Accepté", declined: "Refusé", cancelled: "Annulé", failed: "Échoué" };

/** Ligne d'un échange en cours ou passé, avec les actions possibles selon le côté. */
function TradeRow({ trade, myId, friendsById, onAccept, onDecline, onCancel, busy }) {
  const isFrom = trade.from_user === myId;
  const otherId = isFrom ? trade.to_user : trade.from_user;
  const otherName = friendsById[otherId]?.username || "un ami";
  const mine = isFrom
    ? { name: trade.offer_name, image: trade.offer_image }
    : { name: trade.request_name, image: trade.request_image };
  const theirs = isFrom
    ? { name: trade.request_name, image: trade.request_image }
    : { name: trade.offer_name, image: trade.offer_image };

  return (
    <div className="rounded-xl bg-violet-900/40 border border-white/10 p-3">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <div className="w-9 h-11 rounded-md overflow-hidden bg-violet-950 flex-shrink-0">
            {mine.image && <img src={mine.image} alt="" className="w-full h-full object-cover" />}
          </div>
          <ArrowLeftRight size={13} className="text-violet-500 flex-shrink-0" />
          <div className="w-9 h-11 rounded-md overflow-hidden bg-violet-950 flex-shrink-0">
            {theirs.image && <img src={theirs.image} alt="" className="w-full h-full object-cover" />}
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] text-violet-300 truncate">
            {isFrom ? "Toi" : otherName} donne <span className="text-white font-medium">{mine.name}</span>
          </p>
          <p className="text-[11px] text-violet-300 truncate">
            {isFrom ? otherName : "Toi"} donne <span className="text-white font-medium">{theirs.name}</span>
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between mt-2.5">
        <span className="flex items-center gap-1 text-[10.5px] text-violet-400">
          <Clock size={11} />{STATUS_LABEL[trade.status] || trade.status}
        </span>
        {trade.status === "pending" && (
          <div className="flex items-center gap-2">
            {isFrom ? (
              <button onClick={() => onCancel(trade.id)} disabled={busy}
                className="text-[11px] px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-violet-300 active:scale-95 disabled:opacity-40">
                Annuler
              </button>
            ) : (
              <>
                <button onClick={() => onDecline(trade.id)} disabled={busy}
                  className="text-[11px] px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-violet-300 active:scale-95 disabled:opacity-40">
                  Refuser
                </button>
                <button onClick={() => onAccept(trade)} disabled={busy}
                  className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-amber-400 text-violet-950 font-semibold active:scale-95 disabled:opacity-40">
                  <Check size={12} strokeWidth={3} />Accepter
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Onglet Social : classement entre amis + échange de doublons. */
export function SocialTab({ game }) {
  const { user } = useAuth();
  const myId = user?.id || null;

  const [view, setView] = useState("leaderboard");
  const [friends, setFriends] = useState([]);
  const [friendsLoading, setFriendsLoading] = useState(true);
  const [myProfile, setMyProfile] = useState(null);
  const [leaderboard, setLeaderboard] = useState(null);
  const [busyTradeId, setBusyTradeId] = useState(null);
  const [error, setError] = useState(null);

  // Doublons proposables : les miens (état local, toujours à jour) et ceux
  // de l'ami sélectionné (miroir Supabase — voir syncWaifinityItem).
  const myDupes = useMemo(() => (game.collectionList || []).filter((c) => c.count > 1), [game.collectionList]);
  const [selectedFriendId, setSelectedFriendId] = useState(null);
  const [friendDupes, setFriendDupes] = useState([]);
  const [friendDupesLoading, setFriendDupesLoading] = useState(false);
  const [myPick, setMyPick] = useState(null);
  const [theirPick, setTheirPick] = useState(null);
  const [proposing, setProposing] = useState(false);

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

  const loadLeaderboard = useCallback(async () => {
    if (!myId || !friends.length) { setLeaderboard(myId ? [{ isMe: true }] : []); return; }
    const byUser = await fetchWaifinityItemsBulk(friends.map((f) => f.user_id));
    const rows = friends.map((f) => {
      const items = byUser[f.user_id] || [];
      const tierCounts = countByTier(items);
      return { userId: f.user_id, name: f.username, color: f.avatar_color, photoUrl: f.avatar_url, score: collectionScore(tierCounts), owned: items.length };
    });
    const myTierCounts = countByTier(game.collectionList || []);
    rows.push({
      userId: myId, isMe: true,
      name: myProfile?.username || "Toi", color: myProfile?.avatar_color, photoUrl: myProfile?.avatar_url,
      score: collectionScore(myTierCounts), owned: (game.collectionList || []).length,
    });
    rows.sort((a, b) => b.score - a.score);
    setLeaderboard(rows);
  }, [myId, friends, game.collectionList, myProfile]);

  useEffect(() => { if (!friendsLoading) loadLeaderboard(); }, [friendsLoading, loadLeaderboard]);

  useEffect(() => {
    if (!selectedFriendId) { setFriendDupes([]); return; }
    setFriendDupesLoading(true);
    setTheirPick(null);
    fetchWaifinityItems(selectedFriendId).then((items) => {
      setFriendDupes(items.filter((it) => it.count > 1).map((it) => ({ ...it, id: it.character_id })));
      setFriendDupesLoading(false);
    });
  }, [selectedFriendId]);

  async function handlePropose() {
    if (!myPick || !theirPick || !selectedFriendId) return;
    setProposing(true);
    setError(null);
    try {
      await game.proposeTrade(selectedFriendId, myPick, theirPick);
      haptics.success();
      setMyPick(null);
      setTheirPick(null);
    } catch (e) {
      setError(e?.message || "Impossible de proposer cet échange.");
    } finally {
      setProposing(false);
    }
  }

  async function handleAccept(trade) {
    setBusyTradeId(trade.id);
    setError(null);
    try { await game.acceptTrade(trade); }
    catch (e) { setError(e?.message || "Cet échange n'a pas pu être accepté."); }
    finally { setBusyTradeId(null); }
  }
  async function handleDecline(id) {
    setBusyTradeId(id);
    try { await game.declineTrade(id); } finally { setBusyTradeId(null); }
  }
  async function handleCancel(id) {
    setBusyTradeId(id);
    try { await game.cancelTrade(id); } finally { setBusyTradeId(null); }
  }

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
        <p className="text-sm text-violet-200">Ajoute des amis sur AniVault pour débloquer le classement et les échanges de doublons.</p>
      </div>
    );
  }

  const pendingTrades = (game.trades || []).filter((t) => t.status === "pending");
  const pastTrades = (game.trades || []).filter((t) => t.status !== "pending");

  return (
    <div className="space-y-4">
      <PillTabs tabs={SOCIAL_VIEWS} value={view} onChange={setView} layoutId="waifinity-social-view" size="sm" />

      {error && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs">
          <AlertTriangle size={13} className="flex-shrink-0" />{error}
        </div>
      )}

      {view === "leaderboard" && (
        <div className="space-y-2">
          {(leaderboard || []).map((r, i) => (
            <RankRow key={r.userId} rank={i + 1} name={r.name} color={r.color} photoUrl={r.photoUrl} score={r.score} owned={r.owned} isMe={r.isMe} />
          ))}
          <p className="text-[10px] text-violet-500 px-1 pt-1">
            Score = personnages distincts pondérés par rareté (les doublons ne comptent pas plus qu'une fois).
          </p>
        </div>
      )}

      {view === "trades" && (
        <div className="space-y-5">
          {pendingTrades.length > 0 && (
            <div className="space-y-2">
              <p className="font-mono text-[10px] uppercase tracking-widest text-violet-400">En attente</p>
              {pendingTrades.map((t) => (
                <TradeRow key={t.id} trade={t} myId={myId} friendsById={friendsById}
                  onAccept={handleAccept} onDecline={handleDecline} onCancel={handleCancel}
                  busy={busyTradeId === t.id} />
              ))}
            </div>
          )}

          <div className="space-y-3">
            <p className="font-mono text-[10px] uppercase tracking-widest text-violet-400">Nouvel échange</p>

            <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
              {friends.map((f) => (
                <button key={f.user_id} onClick={() => { setSelectedFriendId(f.user_id); setMyPick(null); }}
                  className={`flex flex-col items-center gap-1 flex-shrink-0 px-1 py-1.5 rounded-xl ${selectedFriendId === f.user_id ? "bg-amber-400/15 border border-amber-400/40" : "border border-transparent"}`}>
                  <Avatar name={f.username} color={f.avatar_color} photoUrl={f.avatar_url} size="sm" />
                  <span className="text-[10px] text-violet-300 max-w-[56px] truncate">{f.username}</span>
                </button>
              ))}
            </div>

            {selectedFriendId && (
              <>
                <div>
                  <p className="text-[11px] text-violet-400 mb-1.5">Tu proposes (tes doublons)</p>
                  {myDupes.length ? (
                    <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                      {myDupes.map((c) => (
                        <DupeCard key={c.id} item={c} selected={myPick?.id === c.id}
                          onClick={() => setMyPick((cur) => (cur?.id === c.id ? null : c))} />
                      ))}
                    </div>
                  ) : <p className="text-xs text-violet-500">Tu n'as encore aucun doublon à proposer.</p>}
                </div>

                <div>
                  <p className="text-[11px] text-violet-400 mb-1.5">Tu demandes (ses doublons)</p>
                  {friendDupesLoading ? (
                    <p className="text-xs text-violet-500">Chargement…</p>
                  ) : friendDupes.length ? (
                    <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                      {friendDupes.map((c) => (
                        <DupeCard key={c.id} item={c} selected={theirPick?.id === c.id}
                          onClick={() => setTheirPick((cur) => (cur?.id === c.id ? null : c))} />
                      ))}
                    </div>
                  ) : <p className="text-xs text-violet-500">Cet ami n'a pas encore de doublon.</p>}
                </div>
              </>
            )}
          </div>

          {pastTrades.length > 0 && (
            <div className="space-y-2">
              <p className="font-mono text-[10px] uppercase tracking-widest text-violet-400">Historique</p>
              {pastTrades.slice(0, 10).map((t) => (
                <TradeRow key={t.id} trade={t} myId={myId} friendsById={friendsById}
                  onAccept={handleAccept} onDecline={handleDecline} onCancel={handleCancel} busy={false} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Barre de confirmation d'échange, sticky au-dessus de la BottomNav */}
      {view === "trades" && myPick && theirPick && (
        <div className="fixed inset-x-0 bottom-0 z-30 pb-nav animate-fadeIn">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 pb-3">
            <button onClick={handlePropose} disabled={proposing}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-amber-400 text-violet-950 font-semibold shadow-2xl active:scale-[0.98] disabled:opacity-50 transition-transform">
              <ArrowLeftRight size={16} />
              {proposing ? "Envoi…" : `Proposer : ${myPick.name} contre ${theirPick.name}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
