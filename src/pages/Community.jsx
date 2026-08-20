import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users, UserPlus, Search, ChevronLeft, Check, X,
  Loader2, Trophy, Film, Clock, UserCheck, UserX,
  ChevronDown, Heart, ListPlus, Send, XCircle,
} from "lucide-react";
import { useAuth }    from "../context/AuthContext";
import { TopBar } from "../components/common/TopBar";
import { Modal }      from "../components/Modal/Modal";
import { AnimatePresence } from "motion/react";
import { Avatar }     from "../components/common/Avatar";
import { ListIcon }   from "../components/common/ListIcon";
import {
  fetchFriends, fetchPendingRequests, fetchSentRequests, searchUserByUsername,
  sendFriendRequest, acceptFriendRequest, removeFriend,
  fetchFriendFavorites, fetchFriendPublicLists,
} from "../services/community";
import { ACHIEVEMENTS } from "../utils/achievements";

// ── Lookup rapide id → métadonnées du succès (icône, nom, description) ──────
const ACHIEVEMENTS_BY_ID = Object.fromEntries(ACHIEVEMENTS.map(a => [a.id, a]));

// ── Helpers ───────────────────────────────────────────────────────────────────
// ── Modal profil ami ──────────────────────────────────────────────────────────
function FriendProfileModal({ friend, onClose, onRemove }) {
  const achievementsCount = Array.isArray(friend.achievements) ? friend.achievements.length : 0;

  // ── Repli succès ─────────────────────────────────────────────────────────
  const [achievementsOpen, setAchievementsOpen] = useState(false);

  // ── Favoris ──────────────────────────────────────────────────────────────
  const [favOpen,    setFavOpen]    = useState(false);
  const [favEntries, setFavEntries] = useState([]);
  const [favLoading, setFavLoading] = useState(false);
  const [favLoaded,  setFavLoaded]  = useState(false);

  async function handleToggleFav() {
    const next = !favOpen;
    setFavOpen(next);
    if (next && !favLoaded) {
      setFavLoading(true);
      try {
        const entries = await fetchFriendFavorites(friend.user_id);
        setFavEntries(entries);
      } catch { setFavEntries([]); }
      setFavLoading(false);
      setFavLoaded(true);
    }
  }

  // ── Listes publiques ─────────────────────────────────────────────────────
  const [listsOpen,    setListsOpen]    = useState(false);
  const [publicLists,  setPublicLists]  = useState([]);
  const [listsLoading, setListsLoading] = useState(false);
  const [listsLoaded,  setListsLoaded]  = useState(false);
  const [openListId,   setOpenListId]   = useState(null);

  async function handleToggleLists() {
    const next = !listsOpen;
    setListsOpen(next);
    if (next && !listsLoaded) {
      setListsLoading(true);
      try {
        const lists = await fetchFriendPublicLists(friend.user_id);
        setPublicLists(lists);
      } catch { setPublicLists([]); }
      setListsLoading(false);
      setListsLoaded(true);
    }
  }

  return (
    <Modal onClose={onClose} maxWidth="max-w-sm" zIndex="z-50">
      <div>

        {/* Bannière + avatar */}
        <div className="relative h-20 bg-gradient-to-br from-violet-800 to-violet-950 flex items-end px-5 pb-0">
          <div className="absolute -bottom-8 left-5">
            <Avatar name={friend.username} color={friend.avatar_color} photoUrl={friend.avatar_url} size="lg" />
          </div>
          <button onClick={onClose}
            className="absolute top-3 right-3 p-1.5 rounded-full bg-black/30 hover:bg-black/50 text-white/70 hover:text-white transition-colors">
            <X size={14} />
          </button>
        </div>

        <div className="pt-10 px-5 pb-5 space-y-4">

          {/* Identité */}
          <div>
            <h2 className="text-lg font-bold text-violet-50" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>
              @{friend.username}
            </h2>
            {friend.description
              ? <p className="text-sm text-violet-300/80 mt-1 leading-relaxed">{friend.description}</p>
              : <p className="text-xs text-violet-600 mt-1 italic">Pas de description.</p>}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { icon: <Film size={14} />,   value: friend.entries_count    ?? 0, label: "Titres"   },
              { icon: <Clock size={14} />,  value: friend.episodes_watched ?? 0, label: "Épisodes" },
              { icon: <Trophy size={14} />, value: achievementsCount,             label: "Succès"   },
            ].map(({ icon, value, label }) => (
              <div key={label} className="rounded-xl bg-white/5 border border-white/5 p-3 text-center">
                <div className="flex justify-center mb-1 text-violet-400">{icon}</div>
                <p className="font-mono text-lg font-bold text-violet-50">{value}</p>
                <p className="font-mono text-[9px] uppercase tracking-wider text-violet-500">{label}</p>
              </div>
            ))}
          </div>

          {/* ── Favoris (collapsible, chargement lazy) ── */}
          <div className="rounded-xl border border-white/5 overflow-hidden">
            <button
              onClick={handleToggleFav}
              className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-white/5 transition-colors"
            >
              <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-violet-400">
                <Heart size={12} className={favOpen && favEntries.length > 0 ? "text-pink-400" : ""} />
                Favoris{favLoaded ? ` · ${favEntries.length}` : ""}
              </span>
              {favLoading
                ? <Loader2 size={12} className="animate-spin text-violet-500" />
                : <ChevronDown size={12} className={`text-violet-500 transition-transform duration-200 ${favOpen ? "rotate-180" : ""}`} />
              }
            </button>

            {favOpen && !favLoading && (
              <div className="px-3 pb-3">
                {favEntries.length === 0 ? (
                  <p className="text-[11px] text-violet-600 font-mono italic py-2">Aucun favori public.</p>
                ) : (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto overscroll-contain">
                    {favEntries.map(e => (
                      <div key={e.entryId} className="flex items-center gap-2 py-1">
                        {e.coverImage
                          ? <img src={e.coverImage} alt="" className="w-7 h-10 object-cover rounded flex-shrink-0" />
                          : <div className="w-7 h-10 rounded bg-white/10 flex-shrink-0" />
                        }
                        <p className="text-xs text-violet-200 leading-tight line-clamp-2">{e.title}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Listes publiques (collapsible, chargement lazy) ── */}
          <div className="rounded-xl border border-white/5 overflow-hidden">
            <button
              onClick={handleToggleLists}
              className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-white/5 transition-colors"
            >
              <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-violet-400">
                <ListPlus size={12} className={listsOpen && publicLists.length > 0 ? "text-amber-400" : ""} />
                Listes publiques{listsLoaded ? ` · ${publicLists.length}` : ""}
              </span>
              {listsLoading
                ? <Loader2 size={12} className="animate-spin text-violet-500" />
                : <ChevronDown size={12} className={`text-violet-500 transition-transform duration-200 ${listsOpen ? "rotate-180" : ""}`} />
              }
            </button>

            {listsOpen && !listsLoading && (
              <div className="px-3 pb-3 space-y-1.5">
                {publicLists.length === 0 ? (
                  <p className="text-[11px] text-violet-600 font-mono italic py-2">Aucune liste publique.</p>
                ) : (
                  publicLists.map(l => {
                    const entries = Array.isArray(l.entries) ? l.entries : [];
                    const isOpen  = openListId === l.id;
                    return (
                      <div key={l.id} className="rounded-lg bg-white/[0.03] overflow-hidden">
                        <button
                          onClick={() => setOpenListId(isOpen ? null : l.id)}
                          className="w-full flex items-center gap-2 px-2.5 py-2 hover:bg-white/5 transition-colors"
                        >
                          <ListIcon list={l} size={14} className="flex-shrink-0" />
                          <span className="flex-1 text-left text-xs text-violet-200 truncate">{l.name}</span>
                          <span className="font-mono text-[10px] text-violet-500 flex-shrink-0">{entries.length}</span>
                          <ChevronDown size={11} className={`text-violet-500 flex-shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                        </button>
                        {isOpen && (
                          <div className="px-2.5 pb-2.5">
                            {entries.length === 0 ? (
                              <p className="text-[11px] text-violet-600 font-mono italic py-1">Liste vide.</p>
                            ) : (
                              <div className="space-y-1.5 max-h-40 overflow-y-auto overscroll-contain">
                                {entries.map(e => (
                                  <div key={e.entryId} className="flex items-center gap-2 py-1">
                                    {e.coverImage
                                      ? <img src={e.coverImage} alt="" className="w-7 h-10 object-cover rounded flex-shrink-0" />
                                      : <div className="w-7 h-10 rounded bg-white/10 flex-shrink-0" />
                                    }
                                    <p className="text-xs text-violet-200 leading-tight line-clamp-2">{e.title}</p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* ── Succès débloqués (collapsible) ── */}
          {achievementsCount > 0 && (
            <div className="rounded-xl border border-white/5 overflow-hidden">
              <button
                onClick={() => setAchievementsOpen(v => !v)}
                className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-white/5 transition-colors"
              >
                <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-violet-400">
                  <Trophy size={12} className={achievementsOpen ? "text-amber-400" : ""} />
                  Succès débloqués · {achievementsCount}
                </span>
                <ChevronDown size={12} className={`text-violet-500 transition-transform duration-200 ${achievementsOpen ? "rotate-180" : ""}`} />
              </button>

              {achievementsOpen && (
                <div className="px-3 pb-3">
                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto overscroll-contain">
                    {friend.achievements.map(id => {
                      const meta = ACHIEVEMENTS_BY_ID[id];
                      return (
                        <span key={id}
                          title={meta?.description}
                          className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-400/15 border border-amber-400/20 font-mono text-[10px] text-amber-300">
                          {meta ? <meta.icon size={11} /> : <Trophy size={11} />}
                          {meta ? meta.name : id}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Retirer */}
          <button
            onClick={() => { onRemove(friend.friendshipId); onClose(); }}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-sm text-rose-400 hover:bg-rose-500/10 border border-rose-500/20 transition-colors"
          >
            <UserX size={14} /> Retirer de mes amis
          </button>

        </div>
      </div>
    </Modal>
  );
}

// ── Carte ami ─────────────────────────────────────────────────────────────────
function FriendCard({ friend, onClick }) {
  return (
    <button onClick={onClick}
      className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/5 hover:bg-white/10 active:scale-[0.98] transition-all text-left">
      <Avatar name={friend.username} color={friend.avatar_color} photoUrl={friend.avatar_url} />
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
  const navigate   = useNavigate();
  const { user }   = useAuth();

  const [friends,       setFriends]       = useState([]);
  const [pending,       setPending]       = useState([]);
  const [sent,          setSent]          = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [cancelingId,   setCancelingId]   = useState(null);
  const [searchQuery,   setSearchQuery]   = useState("");
  const [searchResult,  setSearchResult]  = useState(null);
  const [searching,     setSearching]     = useState(false);
  const [searchError,   setSearchError]   = useState("");
  const [addingId,      setAddingId]      = useState(null);
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [actionMsg,     setActionMsg]     = useState("");

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [f, p, s] = await Promise.all([
      fetchFriends(user.id), fetchPendingRequests(user.id), fetchSentRequests(user.id),
    ]);
    setFriends(f);
    setPending(p);
    setSent(s);
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
    const alreadySent   = sent.some(s => s.user_id === result.user_id);
    setSearchResult({ ...result, alreadyFriend, alreadySent });
  }

  async function handleAddFriend(targetId) {
    setAddingId(targetId);
    try {
      await sendFriendRequest(user.id, targetId);
      setSearchResult(null);
      setSearchQuery("");
      await load();
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

  async function handleCancelSent(friendshipId) {
    setCancelingId(friendshipId);
    try {
      await removeFriend(friendshipId);
      await load();
      flash("Demande annulée.");
    } catch {
      setCancelingId(null);
    }
    setCancelingId(null);
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
    // ── Wrapper bg — couvre toute la surface y compris sous le Dynamic Island ──
    <div className="min-h-screen bg-violet-950 text-violet-50" style={{ fontFamily: "'Inter',sans-serif" }}>
      {/*
        pt-safe-8 : padding-top = max(2rem, env(safe-area-inset-top))
        → évite que le contenu soit masqué par le Dynamic Island / notch iOS.
        Défini dans src/styles/custom.css.
      */}
      <div className="max-w-2xl mx-auto px-4 sm:px-6 pb-nav pt-safe-8 space-y-6">

        {/* ── En-tête ── */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div className="min-w-0">
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
          <TopBar />
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
                <Avatar name={req.username} color={req.avatar_color} photoUrl={req.avatar_url} size="sm" />
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

        {/* ── Demandes envoyées ── */}
        {sent.length > 0 && (
          <div className="rounded-2xl bg-violet-900/20 border border-white/5 p-4 space-y-2">
            <p className="font-mono text-[10px] uppercase tracking-widest text-violet-400 mb-3 flex items-center gap-1.5">
              <Send size={11} /> Demandes envoyées · {sent.length}
            </p>
            {sent.map(req => (
              <div key={req.friendshipId} className="flex items-center gap-3 p-2.5 rounded-xl bg-white/5">
                <Avatar name={req.username} color={req.avatar_color} photoUrl={req.avatar_url} size="sm" />
                <p className="flex-1 text-sm font-medium text-violet-100">@{req.username}</p>
                <span className="font-mono text-[10px] text-violet-500 flex-shrink-0">En attente</span>
                <button onClick={() => handleCancelSent(req.friendshipId)}
                  disabled={cancelingId === req.friendshipId}
                  className="p-1.5 rounded-lg bg-white/5 text-violet-400 hover:bg-rose-500/20 hover:text-rose-300 active:scale-95 transition-all disabled:opacity-50">
                  {cancelingId === req.friendshipId
                    ? <Loader2 size={14} className="animate-spin" />
                    : <XCircle size={14} />}
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
          <div className="flex w-full gap-2">
            <div className="flex-1 min-w-0 flex items-center gap-2 px-3 py-2 rounded-xl bg-violet-950/60 border border-white/10 focus-within:border-violet-500/60">
              <Search size={14} className="text-violet-500 flex-shrink-0" />
              <input
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setSearchError(""); setSearchResult(null); }}
                onKeyDown={e => e.key === "Enter" && handleSearch()}
                placeholder="Rechercher par pseudo…"
                className="flex-1 min-w-0 bg-transparent text-base sm:text-sm text-violet-50 placeholder-violet-500 focus:outline-none"
              />
            </div>
            <button onClick={handleSearch} disabled={searching || !searchQuery.trim()}
              className="h-9 shrink-0 px3 sm:px-4 rounded-xl bg-amber-400 text-violet-950 font-semibold text-sm hover:bg-amber-300 active:scale-95 transition-all disabled:opacity-50 whitespace-nowrap">
              {searching ? <Loader2 size={14} className="animate-spin" /> : " Chercher "}
            </button>
          </div>

          {searchError && <p className="text-rose-300 text-xs mt-2">{searchError}</p>}

          {searchResult && (
            <div className="mt-3 flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10 animate-fadeIn">
              <Avatar name={searchResult.username} color={searchResult.avatar_color} photoUrl={searchResult.avatar_url} />
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
              ) : searchResult.alreadySent ? (
                <span className="font-mono text-[11px] text-violet-400 flex items-center gap-1">
                  <Send size={12} /> Envoyée
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
        <AnimatePresence>
          {selectedFriend && (
            <FriendProfileModal
              key="friend-profile"
              friend={selectedFriend}
              onClose={() => setSelectedFriend(null)}
              onRemove={handleRemove}
            />
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}