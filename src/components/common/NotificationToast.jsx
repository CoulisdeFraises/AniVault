import { useEffect, useState } from "react";
import { useNotificationStore } from "../../hooks/useNotificationStore"; // Ajuste le chemin si besoin
import { Bell, X } from "lucide-react";

export function NotificationToast() {
  const { notifications } = useNotificationStore();
  const [currentToast, setCurrentToast] = useState(null);

  useEffect(() => {
    if (!notifications.length) return;
    const latest = notifications[0];
    // On s'assure qu'on ne l'a pas déjà affichée et qu'elle n'est pas lue
    if (!latest.readAt) {
      setCurrentToast(latest);
      const timer = setTimeout(() => setCurrentToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [notifications[0]?.id]); // Se déclenche uniquement si l'ID de la dernière notif change
  if (!currentToast) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 max-w-sm w-full bg-violet-950/90 border border-violet-500/30 backdrop-blur-md rounded-2xl p-4 shadow-2xl animate-slide-up flex items-start gap-3">
      <div className="p-2 rounded-xl bg-amber-400/15 text-amber-400 mt-0.5">
        <Bell size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-violet-100">{currentToast.title}</p>
        <p className="text-xs text-violet-300 mt-0.5 line-clamp-2">{currentToast.body}</p>
      </div>
      <button
        onClick={() => setCurrentToast(null)}
        className="text-violet-400 hover:text-violet-200 transition-colors"
      >
        <X size={16} />
      </button>
    </div>
  );
}