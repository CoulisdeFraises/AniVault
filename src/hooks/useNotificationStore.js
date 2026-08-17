import { useState, useCallback, useEffect } from "react";

const STORAGE_KEY      = "anivault:notifications";
const MAX_NOTIFS       = 50;
const DEDUPE_WINDOW_MS = 2 * 60 * 60 * 1000; // 2 h

// ── Singleton partagé entre tous les composants ────────────────────────────────
let _listeners      = [];   // abonnés au store complet (panel, badge…)
let _toastListeners = [];   // abonnés uniquement aux nouvelles notifs (toast)

let _state = (() => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; }
})();

function _save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(_state)); } catch {}
}

function _notify() {
  _listeners.forEach((fn) => fn([..._state]));

  // Badge PWA
  try {
    if (typeof navigator !== "undefined" && "setAppBadge" in navigator) {
      const unread = _state.filter((n) => !n.readAt).length;
      if (unread > 0) navigator.setAppBadge(unread).catch(() => {});
      else if ("clearAppBadge" in navigator) navigator.clearAppBadge().catch(() => {});
    }
  } catch {}
}

// Signal aux listeners de toast qu'une nouvelle notif vient d'être ajoutée.
// Distinct de _notify pour ne pas déclencher de toast au chargement initial.
function _notifyToast(notif) {
  _toastListeners.forEach((fn) => fn(notif));
}

// ────────────────────────────────────────────────────────────────────────────────

/**
 * Ajoute une notification dans le store.
 *
 * `dedupeKey` (si fourni) évite les doublons dans la fenêtre DEDUPE_WINDOW_MS.
 * Format canonique : `"${entryId}-ep${episode}"` — à respecter partout.
 */
export function addNotification({ title, body, entryId = null, icon = "sparkles", dedupeKey = null, link = null }) {
  if (dedupeKey) {
    const cutoff     = Date.now() - DEDUPE_WINDOW_MS;
    const alreadySeen = _state.some((n) => n.dedupeKey === dedupeKey && n.createdAt > cutoff);
    if (alreadySeen) return;
  }

  const newNotif = {
    id: `${Date.now()}-${Math.random()}`,
    title,
    body,
    entryId,
    icon,
    link, // ── route interne à ouvrir au clic (ex: "/community"), prioritaire sur entryId ──
    dedupeKey,
    readAt:    null,
    createdAt: Date.now(),
  };

  _state = [newNotif, ..._state].slice(0, MAX_NOTIFS);
  _save();
  _notify();
  _notifyToast(newNotif); // ← signale uniquement pour les vrais ajouts runtime
}

// ────────────────────────────────────────────────────────────────────────────────

/**
 * useNotificationStore — hook principal (panel, header badge).
 */
export function useNotificationStore() {
  const [notifications, setNotifications] = useState(() => [..._state]);

  useEffect(() => {
    // Rafraîchit l'état local au cas où des notifs ont été ajoutées
    // entre le rendu initial et l'enregistrement du listener.
    setNotifications([..._state]);

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

/**
 * useNotificationToast — hook léger réservé au composant NotificationToast.
 *
 * Ne reçoit un signal QUE lorsque addNotification() est appelé à l'exécution,
 * jamais lors du chargement depuis localStorage — ce qui élimine les faux toasts
 * au démarrage.
 */
export function useNotificationToast() {
  const [pendingNotif, setPendingNotif] = useState(null);

  useEffect(() => {
    _toastListeners.push(setPendingNotif);
    return () => { _toastListeners = _toastListeners.filter((fn) => fn !== setPendingNotif); };
  }, []);

  const dismissToast = useCallback(() => setPendingNotif(null), []);

  return { pendingNotif, dismissToast };
}

// ── NOTE : l'écouteur Service Worker a été retiré de ce module ────────────────
// Un seul écouteur SW doit exister — celui dans NotificationLayer (App.jsx) —
// car il a un nettoyage correct (removeEventListener dans le return du useEffect).
// Deux écouteurs + des dedupeKey différents = doublons garantis.
