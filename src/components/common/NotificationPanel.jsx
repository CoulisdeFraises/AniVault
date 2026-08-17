import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Bell, X, Check, Trash2, BellOff, Sparkles, UserPlus, UserCheck } from "lucide-react";
import { useNotificationStore } from "../../hooks/useNotificationStore";
import { requestNotificationPermission } from "../../hooks/useNotifications";
import { subscribeToPush } from "../../utils/push";
import { useAuth } from "../../context/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";

const MOBILE_BREAKPOINT = 640; // aligné sur le "sm" de Tailwind

function timeAgo(ts) {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 1)  return "À l'instant";
  if (m < 60) return `Il y a ${m} min`;
  if (h < 24) return `Il y a ${h}h`;
  return `Il y a ${d}j`;
}

const NOTIF_ICONS = { sparkles: Sparkles, "user-plus": UserPlus, "user-check": UserCheck };

export function NotificationPanel() {
  const { user } = useAuth();
  const { notifications, unreadCount, markAllRead, markRead, clearAll } = useNotificationStore();

  const navigate = useNavigate();
  const location = useLocation();
  const btnRef   = useRef(null);
  const panelRef = useRef(null);

  const [open, setOpen] = useState(false);
  const [pos,  setPos]  = useState({ top: 0, right: 0, maxWidth: 320 });
  const [isMobile, setIsMobile] = useState(false);

  const [permGranted,     setPermGranted]     = useState(
    () => "Notification" in window && Notification.permission === "granted"
  );
  const [subscribeError,  setSubscribeError]  = useState(null);
  const [subscribing,     setSubscribing]     = useState(false);

  // ── Ouverture ────────────────────────────────────────────────────────────
  // Sur mobile : bottom-sheet plein largeur, plus facile à atteindre/scroller
  // au pouce qu'un petit dropdown ancré à la cloche.
  // Sur desktop : dropdown ancré au bouton, comme avant.
  function openPanel() {
    const mobile = window.innerWidth < MOBILE_BREAKPOINT;
    setIsMobile(mobile);
    if (!mobile) {
      const rect = btnRef.current?.getBoundingClientRect();
      if (rect) {
        const MARGIN      = 8;
        const panelW      = Math.min(320, window.innerWidth - MARGIN * 2);
        const rawRight    = window.innerWidth - rect.right;
        const clampedRight = Math.max(MARGIN, Math.min(rawRight, window.innerWidth - panelW - MARGIN));
        setPos({ top: rect.bottom + MARGIN, right: clampedRight, maxWidth: panelW });
      }
    }
    setOpen(true);
    // Marque comme lu après un court délai (laisse le temps à l'animation de s'afficher)
    if (unreadCount > 0) {
      setTimeout(markAllRead, 800);
    }
  }

  function closePanel() { setOpen(false); }

  // ── Fermeture au clic extérieur / Échap ─────────────────────────────────
  useEffect(() => {
    if (!open) return;
    function handleOutside(e) {
      if (!btnRef.current?.contains(e.target) && !panelRef.current?.contains(e.target)) {
        setOpen(false);
      }
    }
    function handleKey(e) { if (e.key === "Escape") setOpen(false); }
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown",   handleKey);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown",   handleKey);
    };
  }, [open]);

  // ── Verrouillage du scroll de la page pendant que le panneau est ouvert ──
  // Sans ça, une fois arrivé en bas de la liste de notifs, le scroll
  // "fuyait" vers la page derrière (overscroll-contain seul ne suffit pas
  // à bloquer ce chaînage sur mobile).
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prevOverflow; };
  }, [open]);

  // ── Permission / abonnement push ─────────────────────────────────────────
  async function handleRequestPermission() {
    setSubscribing(true);
    setSubscribeError(null);
    if (user?.id) {
      const result = await subscribeToPush(user.id);
      setPermGranted(result.ok);
      if (!result.ok) setSubscribeError(result.reason);
    } else {
      const granted = await requestNotificationPermission();
      setPermGranted(granted);
      if (!granted) setSubscribeError("Permission refusée par le navigateur.");
    }
    setSubscribing(false);
  }

  function handleClickNotif(notif) {
    markRead(notif.id);
    setOpen(false);
    if (notif.link) {
      navigate(notif.link);
    } else if (notif.entryId) {
      navigate(`/details/${notif.entryId}`, { state: { backgroundLocation: location } });
    }
  }

  // ── Rendu du panneau (portal) ────────────────────────────────────────────
  const panel = open && createPortal(
    <>
      {/* Backdrop — capte les clics/touchs extérieurs et empêche tout scroll
          de fuiter vers la page derrière. */}
      <div
        className="fixed inset-0 z-[9998] bg-black/40 animate-fadeIn"
        onClick={closePanel}
        onTouchMove={(e) => e.preventDefault()}
      />
      <div
        ref={panelRef}
        style={isMobile ? {
          position:  "fixed",
          left:      0,
          right:     0,
          bottom:    0,
          zIndex:    9999,
          maxHeight: "80dvh",
        } : {
          position:  "fixed",
          top:       pos.top,
          right:     pos.right,
          zIndex:    9999,
          width:     pos.maxWidth,
          maxHeight: `calc(100dvh - ${pos.top + 8}px)`,
        }}
        className={`bg-violet-900 border border-white/10 shadow-2xl overflow-hidden flex flex-col animate-fadeIn ${
          isMobile ? "rounded-t-2xl pb-[env(safe-area-inset-bottom)]" : "rounded-2xl"
        }`}
      >
        {isMobile && (
          <div className="flex justify-center pt-2.5 pb-1 flex-shrink-0">
            <div className="w-9 h-1 rounded-full bg-white/15" />
          </div>
        )}
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Bell size={14} className="text-amber-400" />
            <p className="font-semibold text-sm text-violet-50">Notifications</p>
            {unreadCount > 0 && (
              <span className="bg-rose-500 text-white font-mono text-[9px] px-1.5 py-0.5 rounded-full">
                {unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {notifications.length > 0 && (
              <button onClick={clearAll} title="Tout supprimer"
                className="p-1.5 rounded-lg text-violet-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors">
                <Trash2 size={12} />
              </button>
            )}
            <button onClick={closePanel}
              className="p-1.5 rounded-lg text-violet-500 hover:text-violet-200 hover:bg-white/10 transition-colors">
              <X size={13} />
            </button>
          </div>
        </div>

        {/* ── Bannière permission ── */}
        {(!permGranted || subscribeError) && (
          <div className={`px-4 py-3 border-b border-white/5 flex-shrink-0 ${subscribeError ? "bg-rose-500/5" : "bg-amber-400/5"}`}>
            <p className={`text-[11px] mb-2 ${subscribeError ? "text-rose-300" : "text-amber-300"}`}>
              {subscribeError || "Active les notifications pour être alerté quand un épisode sort."}
            </p>
            <button onClick={handleRequestPermission} disabled={subscribing}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium active:scale-95 transition-all disabled:opacity-50 ${
                subscribeError
                  ? "bg-rose-400/20 text-rose-300 hover:bg-rose-400/30"
                  : "bg-amber-400/20 text-amber-300 hover:bg-amber-400/30"
              }`}>
              <Bell size={11} />
              {subscribing ? "…" : subscribeError ? "Réessayer" : "Activer les notifications"}
            </button>
          </div>
        )}

        {/* ── Liste ── */}
        <div className="overflow-y-auto flex-1 overscroll-contain">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <BellOff size={24} className="text-violet-600" />
              <p className="text-[11px] text-violet-500 font-mono">Aucune notification</p>
            </div>
          ) : (
            notifications.map((n) => {
              const Icon = NOTIF_ICONS[n.icon] || Sparkles;
              return (
                <button
                  key={n.id}
                  onClick={() => handleClickNotif(n)}
                  className={`w-full flex items-start gap-3 px-4 py-3 text-left border-b border-white/5 last:border-0 transition-colors hover:bg-white/5 ${!n.readAt ? "bg-violet-800/20" : ""}`}
                >
                  <span className="flex-shrink-0 mt-0.5 w-7 h-7 rounded-full bg-amber-400/15 border border-amber-400/30 flex items-center justify-center">
                    <Icon size={13} className="text-amber-300" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-violet-100 leading-snug">{n.title}</p>
                    <p className="text-[11px] text-violet-400 leading-snug mt-0.5 line-clamp-2">{n.body}</p>
                    <p className="font-mono text-[10px] text-violet-600 mt-1">{timeAgo(n.createdAt)}</p>
                  </div>
                  {!n.readAt && <span className="w-2 h-2 rounded-full bg-rose-400 flex-shrink-0 mt-1.5" />}
                </button>
              );
            })
          )}
        </div>

        {/* ── Footer ── */}
        {unreadCount > 0 && (
          <div className="px-4 py-2.5 border-t border-white/5 flex-shrink-0">
            <button onClick={markAllRead}
              className="flex items-center gap-1.5 text-[11px] text-violet-400 hover:text-violet-200 transition-colors font-mono">
              <Check size={11} /> Tout marquer comme lu
            </button>
          </div>
        )}
      </div>
    </>,
    document.body
  );

  // ── Bouton cloche ────────────────────────────────────────────────────────
  return (
    <>
      <button
        ref={btnRef}
        onClick={open ? closePanel : openPanel}
        aria-label="Notifications"
        aria-expanded={open}
        className="relative h-9 w-9 flex items-center justify-center rounded-xl bg-violet-900/40 border border-white/10 hover:bg-violet-800/50 active:scale-95 transition-all motion-reduce:transition-none"
      >
        <Bell size={15} className="text-violet-400" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-rose-500 text-white font-mono text-[9px] font-bold animate-fadeIn">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>
      {panel}
    </>
  );
}
