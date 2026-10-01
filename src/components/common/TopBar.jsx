import { RefreshCw } from "lucide-react";
import { useSync } from "../../hooks/useSync";
import { NotificationPanel } from "./NotificationPanel";
import { BurgerMenu } from "./BurgerMenu";

/**
 * TopBar — cluster d'actions "compte" affiché en haut de chaque page
 * secondaire : Sync, Notifications, Menu (Paramètres / Historique /
 * Données & Sauvegarde / Déconnexion).
 * La navigation entre les grandes sections vit désormais dans <BottomNav />.
 *
 * Une page peut remplacer l'action du bouton de synchro par la sienne (ex :
 * Waifinity rafraîchit sa collection, son solde et ses échanges) avec
 * `onRefresh` ; `refreshing` pilote alors le spinner et `refreshLabel` le titre.
 */
export function TopBar({ onRefresh, refreshing = false, refreshLabel = "Actualiser" }) {
  const { syncAll, syncing: syncingAll, progress } = useSync();
  const custom = typeof onRefresh === "function";
  const syncing = custom ? refreshing : syncingAll;

  return (
    <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
      <button
        onClick={() => (custom ? onRefresh() : syncAll(true))}
        disabled={syncing}
        aria-label={custom ? refreshLabel : "Actualiser les données"}
        title={custom ? refreshLabel : syncing ? `Sync… ${progress.current}/${progress.total}` : "Actualiser les données"}
        className="h-9 flex items-center gap-1.5 px-2.5 sm:px-3 rounded-xl bg-violet-900/50 backdrop-blur-md border border-white/10 hover:bg-violet-800/50 disabled:opacity-70 active:scale-95 transition-all motion-reduce:transition-none"
      >
        <RefreshCw size={14} className={`text-violet-400 ${syncing ? "animate-spin motion-reduce:animate-none" : ""}`} />
        {!custom && syncing && (
          <span className="text-xs font-mono text-violet-400 hidden sm:inline">{progress.current}/{progress.total}</span>
        )}
      </button>
      <NotificationPanel />
      <BurgerMenu />
    </div>
  );
}
