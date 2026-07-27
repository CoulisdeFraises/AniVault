import { useState, useCallback, useEffect } from "react";
//changement de nom du fichier

const STORAGE_KEY  = "anivault:notifications";
const MAX_NOTIFS   = 50;

// ── Singleton partagé entre tous les composants ────────────────────────────────
let _listeners = [];
let _state     = (() => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; }
})();

function _save()   { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(_state)); } catch {} }
function _notify() { _listeners.forEach((fn) => fn([..._state])); }

/**
 * Ajoute une notification (appelable depuis n'importe quel module/hook).
 */
export function addNotification({ title, body, entryId = null, icon = "🎌" }) {
  _state = [
    { id: `${Date.now()}-${Math.random()}`, title, body, entryId, icon, readAt: null, createdAt: Date.now() },
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
