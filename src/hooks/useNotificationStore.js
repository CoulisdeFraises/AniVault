import { useState, useCallback, useEffect } from "react";

const STORAGE_KEY  = "anivault:notifications";
const MAX_NOTIFS   = 50;

// ── Singleton partagé entre tous les composants ────────────────────────────────
let _listeners = [];
let _state     = (() => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; }
})();

function _save()   { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(_state)); } catch {} }
function _notify() { 
  _listeners.forEach((fn) => fn([..._state]));
  
  // Mise à jour sécurisée du badge
  try {
    if (typeof navigator !== "undefined" && "setAppBadge" in navigator) {
      const unread = _state.filter((n) => !n.readAt).length;
      if (unread > 0) {
        navigator.setAppBadge(unread).catch(() => {});
      } else if ("clearAppBadge" in navigator) {
        navigator.clearAppBadge().catch(() => {});
      }
    }
  } catch (err) {
    // Ignore silencieusement si l'API n'est pas disponible dans ce contexte
  }
}

/**
 * Ajoute une notification (appelable depuis n'importe quel module/hook).
 *
 * `dedupeKey`, si fourni, évite les doublons : le même épisode peut être
 * signalé à la fois par la programmation locale (onglet ouvert) et par le
 * push serveur — on ne garde que la première entrée reçue dans la fenêtre
 * de déduplication.
 */
const DEDUPE_WINDOW_MS = 2 * 60 * 60 * 1000; // 2h

export function addNotification({ title, body, entryId = null, icon = "sparkles", dedupeKey = null }) {
  if (dedupeKey) {
    const cutoff = Date.now() - DEDUPE_WINDOW_MS;
    const alreadySeen = _state.some((n) => n.dedupeKey === dedupeKey && n.createdAt > cutoff);
    if (alreadySeen) return;
  }
  _state = [
    { id: `${Date.now()}-${Math.random()}`, title, body, entryId, icon, dedupeKey, readAt: null, createdAt: Date.now() },
    ..._state,
  ].slice(0, MAX_NOTIFS);
  _save();
  _notify();
}

/**
 * useNotificationStore — hook React pour lire et gérer les notifications.
 */
export function useNotificationStore() {
  const [notifications, setNotifications] = useState(() => [..._state]);

  useEffect(() => {
    _listeners.push(setNotifications);
    return () => { _listeners = _listeners.filter((fn) => fn !== setNotifications); };
  }, []);

  const markAllRead = useCallback(() => {
    const now = Date.now();
    _state = _state.map((n) => (n.readAt ? n : { ...n, readAt: now }));
    _save(); _notify();
  }, []);

  const markRead = useCallback((id) => {
    _state = _state.map((n) => (n.id === id ? { ...n, readAt: Date.now() } : n));
    _save(); _notify();
  }, []);

  const clearAll = useCallback(() => {
    _state = []; _save(); _notify();
  }, []);

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  return { notifications, unreadCount, markAllRead, markRead, clearAll };
}

// ── Écouteur des messages du Service Worker (ajouté ici) ─────────────────────
if (typeof window !== "undefined" && "serviceWorker" in navigator) {
 navigator.serviceWorker.addEventListener("message", (event) => {
   if (event.data && event.data.type === "PUSH_RECEIVED") {
     addNotification({
       title: event.data.title,
       body: event.data.body,
       entryId: event.data.entryId,
       icon: event.data.icon,
       dedupeKey: event.data.entryId && event.data.episode ? `${event.data.entryId}-${event.data.episode}` : null,
     });
   }
 });
}
