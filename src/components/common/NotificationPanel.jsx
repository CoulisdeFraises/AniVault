import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Bell, X, Check, Trash2, BellOff } from "lucide-react";
import { useNotificationStore } from "../../hooks/useNotificationStore";
import { requestNotificationPermission } from "../../hooks/useNotifications";
import { useNavigate, useLocation } from "react-router-dom";

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

export function NotificationPanel() {
  const { notifications, unreadCount, markAllRead, markRead, clearAll } = useNotificationStore();

  const navigate  = useNavigate();
  const location  = useLocation();
  const btnRef    = useRef(null);
  const panelRef  = useRef(null);
  const [open, setOpen] = useState(false);
  const [pos,  setPos]  = useState({ top: 0, right: 0, maxWidth: 320 });
  const [permGranted, setPermGranted] = useState(
    () => "Notification" in window && Notification.permission === "granted"
  );

  function openPanel() {
    const rect = btnRef.current?.getBoundingClientRect();
    if (rect) {
      const MARGIN   = 8;
      const panelW   = Math.min(320, window.innerWidth - MARGIN * 2);
      // right = distance depuis le bord droit de la fenêtre
      const rawRight = window.innerWidth - rect.right;
      // On clamp pour que le panneau ne déborde pas à gauche
      const clampedRight = Math.max(MARGIN, Math.min(rawRight, window.innerWidth - panelW - MARGIN));
      setPos({ top: rect.bottom + MARGIN, right: clampedRight, maxWidth: panelW });
    }
    setOpen(true);
    if (unreadCount > 0) setTimeout(markAllRead, 800);
  }

  useEffect(() => {
    if (!open) return;
    function handleOutside(e) {
      if (!btnRef.current?.contains(e.target) && !panelRef.current?.contains(e.target)) setOpen(false);
    }
    function handleKey(e) { if (e.key === "Escape") setOpen(false); }
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown",   handleKey);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown",   handleKey);
    };
  }, [open]);

  async function handleRequestPermission() {
    const granted = await requestNotificationPermission();
    setPermGranted(granted);
  }

  function handleClickNotif(notif) {
    markRead(notif.id);
    setOpen(false);
    if (notif.entryId) navigate(`/details/${notif.entryId}`, { state: { backgroundLocation: location } });
  }

  const panel = open && createPortal(
    <div
      ref={panelRef}
      style={{
        position: "fixed",
        top: pos.top,
        right: pos.right,
        zIndex: 9999,
        width: pos.maxWidth,
        // Hauteur max : ne pas dépasser le bas de l'écran (avec 8px de marge)
        maxHeight: `calc(100dvh - ${pos.top + 8}px)`,
      }}
      className="rounded-2xl bg-violet-900 border border-white/10 shadow-2xl overflow-hidden flex flex-col animate-fadeIn"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Bell size={14} className="text-amber-400" />
          <p className="font-semibold text-sm text-violet-50">Notifications</p>
          {unreadCount > 0 && (
            <span className="bg-rose-500 text-white font-mono text-[9px] px-1.5 py-0.5 rounded-full">{unreadCount}</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {notifications.length > 0 && (
            <button onClick={clearAll} title="Tout supprimer"
              className="p-1.5 rounded-lg text-violet-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors">
              <Trash2 size={12} />
            </button>
          )}
          <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg text-violet-500 hover:text-violet-200 hover:bg-white/10 transition-colors">
            <X size={13} />
          </button>
        </div>
      </div>

      {/* Permission banner */}
      {!permGranted && (
        <div className="px-4 py-3 border-b border-white/5 bg-amber-400/5 flex-shrink-0">
          <p className="text-[11px] text-amber-300 mb-2">Active les notifications pour être alerté quand un épisode sort.</p>
          <button onClick={handleRequestPermission}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-400/20 text-amber-300 text-[11px] font-medium hover:bg-amber-400/30 active:scale-95 transition-all">
            <Bell size={11} /> Activer les notifications
          </button>
        </div>
      )}

      {/* Liste — scrollable */}
      <div className="overflow-y-auto flex-1 overscroll-contain">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2">
            <BellOff size={24} className="text-violet-600" />
            <p className="text-[11px] text-violet-500 font-mono">Aucune notification</p>
          </div>
        ) : (
          notifications.map((n) => (
            <button
              key={n.id}
              onClick={() => handleClickNotif(n)}
              className={`w-full flex items-start gap-3 px-4 py-3 text-left border-b border-white/5 last:border-0 transition-colors hover:bg-white/5 ${!n.readAt ? "bg-violet-800/20" : ""}`}
            >
              <span className="text-lg flex-shrink-0 mt-0.5">{n.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-violet-100 leading-snug">{n.title}</p>
                <p className="text-[11px] text-violet-400 leading-snug mt-0.5 line-clamp-2">{n.body}</p>
                <p className="font-mono text-[10px] text-violet-600 mt-1">{timeAgo(n.createdAt)}</p>
              </div>
              {!n.readAt && <span className="w-2 h-2 rounded-full bg-rose-400 flex-shrink-0 mt-1.5" />}
            </button>
          ))
        )}
      </div>

      {/* Footer */}
      {unreadCount > 0 && (
        <div className="px-4 py-2.5 border-t border-white/5 flex-shrink-0">
          <button onClick={markAllRead}
            className="flex items-center gap-1.5 text-[11px] text-violet-400 hover:text-violet-200 transition-colors font-mono">
            <Check size={11} /> Tout marquer comme lu
          </button>
        </div>
      )}
    </div>,
    document.body
  );

  return (
    <>
      <button
        ref={btnRef}
        onClick={openPanel}
        aria-label="Notifications"
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