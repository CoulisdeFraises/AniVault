import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users, UserPlus, Search, ChevronLeft, Check, X,
  Loader2, Trophy, Film, Clock, UserCheck, UserX,
} from "lucide-react";
import { useAuth }    from "../context/AuthContext";
import { BurgerMenu } from "../components/common/BurgerMenu";
import {
  fetchFriends, fetchPendingRequests, searchUserByUsername,
  sendFriendRequest, acceptFriendRequest, removeFriend,
} from "../services/community";

// ── Helpers ───────────────────────────────────────────────────────────────────
function getInitials(name) {
  if (!name) return "?";
  const p = name.trim().split(/\s+/);
  return p.length >= 2 ? (p[0][0] + p[1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
}

function Avatar({ name, color, size = "md" }) {
  const sz = size === "lg" ? "w-16 h-16 text-xl" : size === "sm" ? "w-8 h-8 text-xs" : "w-10 h-10 text-sm";
  return (
    <div className={`${sz} rounded-full flex items-center justify-center font-bold text-white flex-shrink-0`}
      style={{ backgroundColor: color || "#7c3aed" }}>
      {getInitials(name)}
    </div>
  );
}

// ── Modal profil ami ──────────────────────────────────────────────────────────
function FriendProfileModal({ friend, onClose, onRemove }) {
  const achievementsCount = Array.isArray(friend.achievements) ? friend.achievements.length : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}>
      <div className="w-full max-w-sm bg-violet-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-fadeInUp"
        onClick={e => e.stopPropagation()}>

        {/* Bannière + avatar */}
        <div className="relative h-20 bg-gradient-to-br from-violet-800 to-violet-950 flex items-end px-5 pb-0">
          <div className="absolute -bottom-8 left-5">
            <Avatar name={friend.username} color={friend.avatar_color} size="lg" />
          </div>
          <button onClick={onClose}
            className="absolute top-3 right-3 p-1.5 rounded-full bg-black/30 hover:bg-black/50 text-white/70 hover:text-white transition-colors">
            <X size={14} />
          </button>
        </div>

        <div className="pt-10 px-5 pb-5">
          {/* Identité */}
          <h2 className="text-lg font-bold text-violet-50" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>
            @{friend.username}
          </h2>
          {friend.description ? (
            <p className="text-sm text-violet-300/80 mt-1 leading-relaxed">{friend.description}</p>
          ) : (
            <p className="text-xs text-violet-600 mt-1 italic">Pas de description.</p>
          )}

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 mt-4">
            {[
              { icon: <Film size={14} />,  value: friend.entries_count  ?? 0, label: "Titres"  },
              { icon: <Clock size={14} />, value: friend.episodes_watched ?? 0, label: "Épisodes" },
              { icon: <Trophy size={14} />, value: achievementsCount,            label: "Succès"   },
            ].map(({ icon, value, label }) => (
              <div key={label} className="rounded-xl bg-white/5 border border-white/5 p-3 text-center">
                <div className="flex justify-center mb-1 text-violet-400">{icon}</div>
                <p className="font-mono text-lg font-bold text-violet-50">{value}</p>
                <p className="font-mono text-[9px] uppercase tracking-wider text-violet-500">{label}</p>
              </div>
            ))}
          </div>

          {/* Succès débloqués */}
          {achievementsCount > 0 && (
            <div className="mt-4">
              <p className="font-mono text-[10px] uppercase tracking-widest text-violet-500 mb-2">
                Succès débloqués · {achievementsCount}
              </p>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                {friend.achievements.map((id) => (
                  <span key={id}
                    className="px-2 py-0.5 rounded-full bg-amber-400/15 border border-amber-400/20 font-mono text-[10px] text-amber-300">
                    🏆 {id}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <button onClick={() => { onRemove(friend.friendshipId); onClose(); }}
            className="mt-4 w-full flex items-center justify-center gap-2 py-2 rounded-xl text-sm text-rose-400 hover:bg-rose-500/10 border border-rose-500/20 transition-colors">
            <UserX size={14} /> Retirer de mes amis
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Carte ami ─────────────────────────────────────────────────────────────────
function FriendCard({ friend, onClick }) {
  return (
    <button onClick={onClick}
      className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/5 hover:bg-white/10 active:scale-[0.98] transition-all text-left">
      <Avatar name={friend.username} color={friend.avatar_color} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-violet-100 truncate">@{friend.username}</p>
        {friend.description
          ? <p className="text-[11px] text-violet-400 truncate">{friend.description}</p>
          : <p className="text-[11px] text-violet-600 italic">Pas de description</p>}
      </div>
      <div className="text-right flex-shrink-0">
        <p className="font-mono text-xs text-violet-300">{friend.entries_count ?? 0}</p>
        <p className="font-mono text-[9px] text-violet-600">titres</p>
      </div>
    </button>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export function Community() {
  const navigate      = useNavigate();
  const { user }      = useAuth();

  const [friends,     setFriends]     = useState([]);
  const [pending,     setPending]     = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResult, setSearchResult] = useState(null);
  const [searching,   setSearching]   = useState(false);
  const [searchError, setSearchError] = useState("");
  const [addingId,    setAddingId]    = useState(null);
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [actionMsg,   setActionMsg]   = useState("");

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [f, p] = await Promise.all([fetchFriends(user.id), fetchPendingRequests(user.id)]);
    setFriends(f);
    setPending(p);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  async function handleSearch() {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchError("");
    setSearchResult(null);
    const result = await searchUserByUsername(searchQuery.trim());
    setSearching(false);
    if (!result) { setSearchError("Aucun utilisateur trouvé avec ce pseudo."); return; }
    if (result.user_id === user.id) { setSearchError("C'est toi ! 😄"); return; }
    const alreadyFriend = friends.some(f => f.user_id === result.user_id);
    setSearchResult({ ...result, alreadyFriend });
  }

  async function handleAddFriend(targetId) {
    setAddingId(targetId);
    try {
      await sendFriendRequest(user.id, targetId);
      setSearchResult(null);
      setSearchQuery("");
      flash("Demande envoyée !");
    } catch (e) {
      setSearchError(e.message || "Erreur lors de l'envoi.");
    }
    setAddingId(null);
  }

  async function handleAccept(friendshipId) {
    await acceptFriendRequest(friendshipId);
    await load();
    flash("Ami ajouté !");
  }

  async function handleRemove(friendshipId) {
    await removeFriend(friendshipId);
    await load();
    flash("Ami retiré.");
    setSelectedFriend(null);
  }

  function flash(msg) {
    setActionMsg(msg);
    setTimeout(() => setActionMsg(""), 2500);
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6" style={{ fontFamily: "'Inter',sans-serif" }}>

      {/* ── En-tête ── */}
      <div className="flex items-start justify-between">
        <div>
          <button onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-sm text-violet-400 hover:text-violet-200 transition-colors mb-3">
            <ChevronLeft size={16} /> Retour
          </button>
          <p className="font-mono text-[11px] tracking-[0.3em] text-violet-400 uppercase mb-0.5">Social</p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2"
            style={{ fontFamily: "'Space Grotesk',sans-serif" }}>
            <Users size={24} className="text-violet-400" /> Communauté
          </h1>
        </div>
        <BurgerMenu />
      </div>

      {/* ── Flash message ── */}
      {actionMsg && (
        <div className="px-4 py-2.5 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-300 text-sm animate-fadeIn">
          {actionMsg}
        </div>
      )}

      {/* ── Demandes en attente ── */}
      {pending.length > 0 && (
        <div className="rounded-2xl bg-amber-400/5 border border-amber-400/20 p-4 space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-widest text-amber-400 mb-3">
            Demandes reçues · {pending.length}
          </p>
          {pending.map(req => (
            <div key={req.friendshipId} className="flex items-center gap-3 p-2.5 rounded-xl bg-white/5">
              <Avatar name={req.username} color={req.avatar_color} size="sm" />
              <p className="flex-1 text-sm font-medium text-violet-100">@{req.username}</p>
              <button onClick={() => handleAccept(req.friendshipId)}
                className="p-1.5 rounded-lg bg-teal-500/20 text-teal-300 hover:bg-teal-500/30 active:scale-95 transition-all">
                <Check size={14} />
              </button>
              <button onClick={() => handleRemove(req.friendshipId)}
                className="p-1.5 rounded-lg bg-white/5 text-violet-400 hover:bg-rose-500/20 hover:text-rose-300 active:scale-95 transition-all">
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Ajouter un ami ── */}
      <div className="rounded-2xl bg-violet-900/30 border border-white/5 p-4">
        <p className="font-mono text-[10px] uppercase tracking-widest text-violet-500 mb-3">
          Ajouter un ami
        </p>
        <div className="flex gap-2">
          <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl bg-violet-950/60 border border-white/10 focus-within:border-violet-500/60">
            <Search size={14} className="text-violet-500 flex-shrink-0" />
            <input
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setSearchError(""); setSearchResult(null); }}
              onKeyDown={e => e.key === "Enter" && handleSearch()}
              placeholder="Rechercher par pseudo…"
              className="flex-1 bg-transparent text-sm text-violet-50 placeholder-violet-500 focus:outline-none"
            />
          </div>
          <button onClick={handleSearch} disabled={searching || !searchQuery.trim()}
            className="h-9 px-4 rounded-xl bg-amber-400 text-violet-950 font-semibold text-sm hover:bg-amber-300 active:scale-95 transition-all disabled:opacity-50">
            {searching ? <Loader2 size={14} className="animate-spin" /> : "Chercher"}
          </button>
        </div>

        {searchError && <p className="text-rose-300 text-xs mt-2">{searchError}</p>}

        {searchResult && (
          <div className="mt-3 flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10 animate-fadeIn">
            <Avatar name={searchResult.username} color={searchResult.avatar_color} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-violet-100">@{searchResult.username}</p>
              {searchResult.description && (
                <p className="text-[11px] text-violet-400 truncate">{searchResult.description}</p>
              )}
            </div>
            {searchResult.alreadyFriend ? (
              <span className="font-mono text-[11px] text-teal-400 flex items-center gap-1">
                <UserCheck size={12} /> Amis
              </span>
            ) : (
              <button onClick={() => handleAddFriend(searchResult.user_id)}
                disabled={addingId === searchResult.user_id}
                className="h-8 px-3 rounded-xl bg-violet-700 hover:bg-violet-600 text-white text-xs font-medium active:scale-95 transition-all disabled:opacity-50 flex items-center gap-1">
                {addingId === searchResult.user_id
                  ? <Loader2 size={12} className="animate-spin" />
                  : <><UserPlus size={12} /> Ajouter</>}
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Liste d'amis ── */}
      <div>
        <p className="font-mono text-[10px] uppercase tracking-widest text-violet-500 mb-3">
          Mes amis · {friends.length}
        </p>
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 size={20} className="animate-spin text-violet-500" />
          </div>
        ) : friends.length === 0 ? (
          <div className="text-center py-14 rounded-2xl border border-dashed border-white/10">
            <p className="text-4xl mb-3">👥</p>
            <p className="text-violet-400 text-sm">Pas encore d'amis.</p>
            <p className="text-violet-600 text-xs mt-1">Cherche un pseudo pour commencer !</p>
          </div>
        ) : (
          <div className="space-y-2">
            {friends.map(f => (
              <FriendCard key={f.user_id} friend={f} onClick={() => setSelectedFriend(f)} />
            ))}
          </div>
        )}
      </div>

      {/* ── Modal profil ami ── */}
      {selectedFriend && (
        <FriendProfileModal
          friend={selectedFriend}
          onClose={() => setSelectedFriend(null)}
          onRemove={handleRemove}
        />
      )}
    </div>
  );
}