import { useEffect, useState } from "react";
import { useNotificationStore } from "../../hooks/useNotificationStore"; // Ajuste le chemin si besoin
import { Bell, X } from "lucide-react";

export function NotificationToast() {
  const { notifications } = useNotificationStore();
  const [currentToast, setCurrentToast] = useState(null);

  // Surveille l'ajout de la toute dernière notification reçue
  useEffect(() => {
    if (!notifications.length) return;
    const latest = notifications[0];

    // Si la notification est très récente (moins de 3 secondes) et non lue, on affiche le toast
    const isRecent = Date.now() - latest.createdAt < 3000;
    if (isRecent && !latest.readAt) {
      setCurrentToast(latest);
      const timer = setTimeout(() => setCurrentToast(null), 4000); // Disparaît après 4s
      return () => clearTimeout(timer);
    }
  }, [notifications]);

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