import { useEffect, useRef, useState } from "react";
import { useNotificationStore } from "../../hooks/useNotificationStore";
import { Bell, X } from "lucide-react";

export function NotificationToast() {
  const { notifications } = useNotificationStore();
  const [currentToast, setCurrentToast] = useState(null);

  const mountTimeRef = useRef(Date.now());   // ignore les notifs antérieures au montage
  const shownRef     = useRef(new Set());    // évite d'afficher deux fois le même ID
  const timerRef     = useRef(null);

  useEffect(() => {
    const latest = notifications[0];
    if (!latest) return;
    if (latest.readAt) return;                                    // déjà lue
    if (shownRef.current.has(latest.id)) return;                 // déjà montrée
    if (latest.createdAt < mountTimeRef.current) return;         // chargée depuis localStorage

    shownRef.current.add(latest.id);
    setCurrentToast(latest);

    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCurrentToast(null), 4500);
  }, [notifications[0]?.id]); // eslint-disable-line

  useEffect(() => () => clearTimeout(timerRef.current), []);

  if (!currentToast) return null;

  return (
    <div
      className="
        fixed left-1/2 -translate-x-1/2 z-[9998]
        max-w-sm w-[92%]
        bg-violet-950/95 border border-violet-500/30
        backdrop-blur-md rounded-2xl
        px-4 py-3 shadow-2xl
        flex items-start gap-3
        relative overflow-hidden
        animate-slideDown
      "
      style={{ top: "calc(env(safe-area-inset-top, 0px) + 8px)" }}
      role="alert"
      aria-live="polite"
    >
      <div className="flex-shrink-0 mt-0.5 w-8 h-8 rounded-xl bg-amber-400/15 border border-amber-400/25 flex items-center justify-center">
        <Bell size={15} className="text-amber-400" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-violet-100 leading-snug">
          {currentToast.title}
        </p>
        <p className="text-[11px] text-violet-300/80 mt-0.5 line-clamp-2 leading-snug">
          {currentToast.body}
        </p>
      </div>

      <button
        onClick={() => setCurrentToast(null)}
        aria-label="Fermer"
        className="flex-shrink-0 p-1 rounded-lg text-violet-500 hover:text-violet-200 hover:bg-white/10 transition-colors"
      >
        <X size={14} />
      </button>

      <div className="absolute bottom-0 left-0 right-0 h-[2px]">
        <div
          className="h-full bg-gradient-to-r from-violet-500 to-amber-400 origin-left"
          style={{ animation: "toast-progress 4.5s linear forwards" }}
        />
      </div>

      <style>{`
        @keyframes toast-progress {
          from { transform: scaleX(1); }
          to   { transform: scaleX(0); }
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translateX(-50%) translateY(-12px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        .animate-slideDown {
          animation: slideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
      `}</style>
    </div>
  );
}