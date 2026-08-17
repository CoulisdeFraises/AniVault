import { useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import { addNotification } from "./useNotificationStore";

/**
 * useFriendRequestNotifications — écoute en temps réel (Supabase Realtime)
 * les évènements de la table `friendships` qui concernent l'utilisateur
 * courant, et pousse une notification in-app (toast + badge + panel) :
 *
 *  - une nouvelle demande d'ami reçue   (INSERT, target_id = moi, pending)
 *  - une de mes demandes qui est acceptée (UPDATE, requester_id = moi, → accepted)
 *
 * ⚠️ Ne fonctionne que quand l'app est ouverte (le canal Realtime tourne
 * dans l'onglet). Pour une vraie notification système quand l'app est
 * fermée, il faudrait un trigger Postgres + une fonction Edge qui envoie
 * un push (même principe que supabase/functions/notify-episodes pour les
 * épisodes) — non couvert ici, à ajouter côté Supabase si besoin.
 *
 * Prérequis côté Supabase : la table `friendships` doit être ajoutée à la
 * publication realtime : ALTER PUBLICATION supabase_realtime ADD TABLE friendships;
 */
export function useFriendRequestNotifications(userId) {
  const usernameCacheRef = useRef(new Map());

  useEffect(() => {
    if (!userId) return;

    async function usernameOf(id) {
      if (usernameCacheRef.current.has(id)) return usernameCacheRef.current.get(id);
      const { data } = await supabase.from("profiles").select("username").eq("user_id", id).maybeSingle();
      const name = data?.username || "Quelqu'un";
      usernameCacheRef.current.set(id, name);
      return name;
    }

    const channel = supabase
      .channel(`friendships-${userId}`)
      // ── Nouvelle demande reçue ────────────────────────────────────────────
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "friendships", filter: `target_id=eq.${userId}` },
        async (payload) => {
          const row = payload.new;
          if (row.status !== "pending") return;
          const username = await usernameOf(row.requester_id);
          addNotification({
            title: "Nouvelle demande d'ami",
            body: `@${username} veut devenir ton ami.`,
            icon: "user-plus",
            link: "/community",
            dedupeKey: `friend-req-${row.id}`,
          });
        }
      )
      // ── Une de mes demandes vient d'être acceptée ──────────────────────────
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "friendships", filter: `requester_id=eq.${userId}` },
        async (payload) => {
          const row = payload.new;
          if (row.status !== "accepted" || payload.old?.status === "accepted") return;
          const username = await usernameOf(row.target_id);
          addNotification({
            title: "Demande acceptée",
            body: `@${username} a accepté ta demande d'ami !`,
            icon: "user-check",
            link: "/community",
            dedupeKey: `friend-acc-${row.id}`,
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId]);
}
