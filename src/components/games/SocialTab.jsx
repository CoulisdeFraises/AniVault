import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Trophy, Medal, RefreshCw, ArrowLeftRight, Check, Clock,
  AlertTriangle, Search, X, Sparkles, ChevronDown,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { fetchFriends, fetchMyProfile } from "../../services/community";
import { fetchWaifinityItems, fetchWaifinityItemsBulk } from "../../services/waifinitySocial";
import { RARITY, RARITY_ORDER, normalizeTier, countByTier, collectionScore } from "../../utils/waifinity";
import { Avatar } from "../common/Avatar";
import { RarityBadge } from "./RarityBadge";
import { PillTabs } from "./PillTabs";
import { haptics } from "../../utils/haptics";

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

function TradeCard({ item, selected, onClick, disabled = false }) {
  const r = RARITY[normalizeTier(item.tier)];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={`group relative w-full overflow-hidden rounded-xl border-2 text-left transition-all duration-200
        ${selected
          ? "border-amber-300 ring-2 ring-amber-400/40 -translate-y-0.5"
          : `${r.border} hover:-translate-y-0.5 hover:border-white/30`}
        ${disabled ? "opacity-40 cursor-not-allowed" : "active:scale-[0.97]"}`}
    >
      <div className="relative aspect-[3/4] bg-violet-900">
        {item.image
          ? <img src={item.image} alt="" loading="lazy" className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center text-violet-600 text-xl">?</div>}
        <div className="absolute top-1 left-1"><RarityBadge tier={item.tier} /></div>
        <span className="absolute top-1 right-1 min-w-[20px] h-[20px] px-1 rounded-full bg-black/75 text-white text-[9px] font-mono font-bold flex items-center justify-center">
          ×{item.count}
        </span>
        {selected && (
          <div className="absolute inset-0 bg-amber-400/20 flex items-center justify-center">
            <span className="w-8 h-8 rounded-full bg-amber-300 text-violet-950 flex items-center justify-center shadow-lg shadow-amber-400/30">
              <Check size={16} strokeWidth={3} />
            </span>
          </div>
        )}
      </div>
      <div className="px-2 py-1.5 bg-black/55">
        <p className="text-[10px] font-semibold text-white truncate">{item.name}</p>
        <p className={`text-[9px] ${r.text} truncate`}>{r.label}{item.series ? ` · ${item.series}` : ""}</p>
      </div>
    </button>
  );
}

function CardPicker({ title, subtitle, items, selected, onSelect, loading, accent = "amber", emptyText }) {
  const [query, setQuery] = useState("");
  const [tier, setTier] = useState("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      const matchesQuery = !q || item.name?.toLowerCase().includes(q) || item.series?.toLowerCase().includes(q);
      const matchesTier = tier === "all" || normalizeTier(item.tier) === tier;
      return matchesQuery && matchesTier;
    });
  }, [items, query, tier]);

  return (
    <section className="rounded-2xl border border-white/10 bg-violet-900/35 overflow-hidden">
      <div className="p-3 sm:p-4 border-b border-white/10">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className={`text-sm font-semibold ${accent === "amber" ? "text-amber-200" : "text-sky-200"}`}>{title}</p>
            <p className="text-[10.5px] text-violet-400 mt-0.5">{subtitle}</p>
          </div>
          <span className="flex-shrink-0 rounded-full bg-white/5 border border-white/10 px-2 py-1 text-[10px] font-mono text-violet-300">
            {items.length} carte{items.length > 1 ? "s" : ""}
          </span>
        </div>

        <div className="flex gap-2 mt-3">
          <label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl bg-black/20 border border-white/10 px-2.5 focus-within:border-white/25">
            <Search size={14} className="text-violet-500 flex-shrink-0" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher un personnage ou une série"
              className="min-w-0 w-full bg-transparent py-2 text-xs text-white placeholder:text-violet-600 outline-none"
              aria-label={`Rechercher dans ${title}`}
            />
            {query && <button type="button" onClick={() => setQuery("")} className="text-violet-400 hover:text-white"><X size={13} /></button>}
          </label>

          <label className="relative flex-shrink-0">
            <select
              value={tier}
              onChange={(e) => setTier(e.target.value)}
              className="h-full appearance-none rounded-xl bg-black/20 border border-white/10 pl-2.5 pr-7 text-[10px] text-violet-200 outline-none"
              aria-label="Filtrer par rareté"
            >
              <option value="all">Toutes raretés</option>
              {RARITY_ORDER.map((key) => <option key={key} value={key}>{RARITY[key].label}</option>)}
            </select>
            <ChevronDown size={12} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-violet-500" />
          </label>
        </div>
      </div>

      <div className="p-3 sm:p-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2 text-violet-400">
            <RefreshCw size={19} className="animate-spin motion-reduce:animate-none" />
            <p className="text-xs">Chargement de la collection…</p>
          </div>
        ) : filtered.length ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2.5">
            {filtered.map((item) => (
              <TradeCard
                key={item.id}
                item={item}
                selected={selected?.id === item.id}
                onClick={() => onSelect(selected?.id === item.id ? null : item)}
              />
            ))}
          </div>
        ) : (
          <div className="py-10 text-center">
            <Search size={20} className="mx-auto text-violet-600 mb-2" />
            <p className="text-xs text-violet-400">{emptyText || "Aucune carte ne correspond à ta recherche."}</p>
          </div>
        )}
      </div>
    </section>
  );
}

function TradeSummary({ mine, theirs, friendName, proposing, onPropose }) {
  if (!mine || !theirs) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 pb-nav animate-fadeIn">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pb-3">
        <div className="rounded-2xl border border-amber-300/25 bg-violet-950/95 backdrop-blur-xl shadow-2xl shadow-black/40 p-2.5 sm:p-3">
          <div className="flex items-center gap-2.5 mb-2.5">
            <div className="min-w-0 flex-1 flex items-center gap-2 rounded-xl bg-white/5 p-2">
              <img src={mine.image} alt="" className="w-8 h-10 rounded-md object-cover bg-violet-900 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[9px] uppercase tracking-widest text-violet-500">Tu donnes</p>
                <p className="text-[11px] font-semibold text-white truncate">{mine.name}</p>
              </div>
            </div>
            <ArrowLeftRight size={15} className="text-amber-300 flex-shrink-0" />
            <div className="min-w-0 flex-1 flex items-center gap-2 rounded-xl bg-white/5 p-2">
              <img src={theirs.image} alt="" className="w-8 h-10 rounded-md object-cover bg-violet-900 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[9px] uppercase tracking-widest text-violet-500">{friendName} donne</p>
                <p className="text-[11px] font-semibold text-white truncate">{theirs.name}</p>
              </div>
            </div>
          </div>
          <button
            onClick={onPropose}
            disabled={proposing}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-amber-300 text-violet-950 font-bold text-sm shadow-lg shadow-amber-500/10 active:scale-[0.98] disabled:opacity-50 transition-transform"
          >
            {proposing ? <RefreshCw size={15} className="animate-spin" /> : <ArrowLeftRight size={16} />}
            {proposing ? "Envoi de la proposition…" : "Proposer cet échange"}
          </button>
        </div>
      </div>
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
            <p className="mt-2 text-sm font-semibold text-white truncate">{incoming.name}</p>
            <p className={`text-[10px] ${RARITY[normalizeTier(incoming.tier)].text}`}>{RARITY[normalizeTier(incoming.tier)].label}</p>
          </div>

          <div className="trade-outgoing absolute left-1/2 top-1/2 w-44 -translate-x-1/2 -translate-y-1/2">
            <div className="rounded-2xl overflow-hidden border-2 border-amber-300/40 bg-violet-900 shadow-2xl shadow-amber-500/20">
              {outgoing.image && <img src={outgoing.image} alt="" className="w-full aspect-[3/4] object-cover" />}
            </div>
            <p className="mt-2 text-sm font-semibold text-white truncate">{outgoing.name}</p>
            <p className="text-[10px] text-violet-400">Carte échangée</p>
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

const STATUS_LABEL = { pending: "En attente", accepted: "Accepté", declined: "Refusé", cancelled: "Annulé", failed: "Échoué" };

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

  const myCards = useMemo(() => (game.collectionList || []).filter((c) => c.count > 0), [game.collectionList]);
  const [selectedFriendId, setSelectedFriendId] = useState(null);
  const [friendCards, setFriendCards] = useState([]);
  const [friendCardsLoading, setFriendCardsLoading] = useState(false);
  const [myPick, setMyPick] = useState(null);
  const [theirPick, setTheirPick] = useState(null);
  const [proposing, setProposing] = useState(false);
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
    if (!selectedFriendId) {
      setFriendCards([]);
      return;
    }
    setFriendCardsLoading(true);
    setTheirPick(null);
    fetchWaifinityItems(selectedFriendId)
      .then((items) => {
        setFriendCards(items.map((it) => ({ ...it, id: it.character_id })).filter((it) => it.count > 0));
      })
      .catch(() => setFriendCards([]))
      .finally(() => setFriendCardsLoading(false));
  }, [selectedFriendId]);

  function selectFriend(id) {
    setSelectedFriendId(id);
    setMyPick(null);
    setTheirPick(null);
    setError(null);
  }

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
    try {
      const resolved = await game.acceptTrade(trade);
      haptics.success();
      setAnimationTrade(resolved || trade);
    } catch (e) {
      setError(e?.message || "Cet échange n'a pas pu être accepté.");
    } finally {
      setBusyTradeId(null);
    }
  }

  async function handleDecline(id) {
    setBusyTradeId(id);
    setError(null);
    try { await game.declineTrade(id); } catch (e) { setError(e?.message || "Impossible de refuser cet échange."); }
    finally { setBusyTradeId(null); }
  }

  async function handleCancel(id) {
    setBusyTradeId(id);
    setError(null);
    try { await game.cancelTrade(id); } catch (e) { setError(e?.message || "Impossible d'annuler cet échange."); }
    finally { setBusyTradeId(null); }
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
        <p className="text-sm text-violet-200">Ajoute des amis sur AniVault pour débloquer le classement et les échanges de cartes.</p>
      </div>
    );
  }

  const pendingTrades = (game.trades || []).filter((t) => t.status === "pending");
  const pastTrades = (game.trades || []).filter((t) => t.status !== "pending");
  const selectedFriend = friendsById[selectedFriendId];

  return (
    <div className="space-y-4">
      <div className="flex justify-center">
        <PillTabs tabs={SOCIAL_VIEWS} value={view} onChange={setView} layoutId="waifinity-social-view" size="sm" />
      </div>

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
        <div className="space-y-4">
          {pendingTrades.length > 0 && (
            <div className="space-y-2">
              <p className="font-mono text-[10px] uppercase tracking-widest text-violet-400">En attente</p>
              {pendingTrades.map((t) => (
                <TradeRow
                  key={t.id}
                  trade={t}
                  myId={myId}
                  friendsById={friendsById}
                  onAccept={handleAccept}
                  onDecline={handleDecline}
                  onCancel={handleCancel}
                  busy={busyTradeId === t.id}
                />
              ))}
            </div>
          )}

          <div className="rounded-2xl border border-white/10 bg-violet-900/25 p-3 sm:p-4">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-300/10 border border-amber-300/20 flex items-center justify-center text-amber-300 flex-shrink-0">
                <ArrowLeftRight size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">Créer un échange</p>
                <p className="text-[11px] text-violet-400 mt-0.5">
                  Choisis une carte que tu possèdes et une carte que ton ami possède. Les cartes uniques sont aussi échangeables.
                </p>
              </div>
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-widest text-violet-500 mb-2">1 · Avec qui ?</p>
              <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
                {friends.map((f) => (
                  <button
                    key={f.user_id}
                    type="button"
                    onClick={() => selectFriend(f.user_id)}
                    className={`flex flex-col items-center gap-1.5 flex-shrink-0 min-w-[64px] px-2 py-2 rounded-xl border transition-colors ${
                      selectedFriendId === f.user_id
                        ? "bg-amber-300/10 border-amber-300/45"
                        : "bg-white/[0.02] border-transparent hover:border-white/10"
                    }`}
                  >
                    <Avatar name={f.username} color={f.avatar_color} photoUrl={f.avatar_url} size="sm" />
                    <span className={`text-[10px] max-w-[70px] truncate ${selectedFriendId === f.user_id ? "text-amber-200" : "text-violet-300"}`}>{f.username}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {selectedFriendId && (
            <div className="space-y-3 pb-28">
              <div className="flex items-center gap-2 px-1">
                <Avatar name={selectedFriend?.username || "Ami"} color={selectedFriend?.avatar_color} photoUrl={selectedFriend?.avatar_url} size="sm" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white">Échange avec {selectedFriend?.username || "cet ami"}</p>
                  <p className="text-[10px] text-violet-500">Sélectionne une carte de chaque côté</p>
                </div>
              </div>

              <div className="grid lg:grid-cols-2 gap-3">
                <CardPicker
                  title="Ta carte"
                  subtitle="N'importe quelle carte de ta collection peut être offerte."
                  items={myCards}
                  selected={myPick}
                  onSelect={setMyPick}
                  emptyText={myCards.length ? "Aucune carte ne correspond à ta recherche." : "Ta collection est encore vide."}
                />
                <CardPicker
                  title={`${selectedFriend?.username || "Son"} carte`}
                  subtitle="Toutes les cartes que cet ami possède sont disponibles."
                  items={friendCards}
                  selected={theirPick}
                  onSelect={setTheirPick}
                  loading={friendCardsLoading}
                  accent="sky"
                  emptyText="Cet ami ne possède aucune carte correspondant à cette recherche."
                />
              </div>

              {(!myPick || !theirPick) && (
                <div className="flex items-center justify-center gap-2 text-[10px] text-violet-500">
                  <span className={myPick ? "text-emerald-300" : ""}>{myPick ? "✓ Ta carte sélectionnée" : "Choisis ta carte"}</span>
                  <span>•</span>
                  <span className={theirPick ? "text-emerald-300" : ""}>{theirPick ? "✓ Sa carte sélectionnée" : "Choisis sa carte"}</span>
                </div>
              )}
            </div>
          )}

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

      <TradeSummary
        mine={myPick}
        theirs={theirPick}
        friendName={selectedFriend?.username || "Ton ami"}
        proposing={proposing}
        onPropose={handlePropose}
      />

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
