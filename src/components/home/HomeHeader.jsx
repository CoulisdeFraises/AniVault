import { useState, useRef, useEffect } from "react";
import { RefreshCw } from "lucide-react";
import { NotificationPanel } from "../common/NotificationPanel";
import { BurgerMenu }        from "../common/BurgerMenu";

export function HomeHeader({ syncing, syncProgress, onSyncClick }) {
  const [logoPlaying, setLogoPlaying] = useState(false);
  const timerRef = useRef(null);

  // Rejoue le gif du logo une fois au clic (le ?t= force le redémarrage).
  function playLogoOnce() {
    clearTimeout(timerRef.current);
    setLogoPlaying(Date.now());
    timerRef.current = setTimeout(() => setLogoPlaying(false), 850);
  }
  useEffect(() => () => clearTimeout(timerRef.current), []);

  return (
    <header className="relative flex items-center justify-between gap-2 mb-5"
      style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}>
      <div className="flex items-center gap-2.5 min-w-0">
        <button type="button" onClick={playLogoOnce} aria-label="Rejouer l'animation du logo"
          className="flex-shrink-0 h-12 w-12 rounded-full bg-white p-[3px] shadow-lg shadow-black/30 active:scale-95 transition-transform motion-reduce:transition-none">
          <img src={logoPlaying ? `/splash-anim.gif?t=${logoPlaying}` : "/logo.png"} alt="Logo AniVault"
            className="h-full w-full rounded-full object-cover" />
        </button>
        <h1 className="text-[1.65rem] font-bold italic tracking-tight leading-none truncate"
          style={{ fontFamily: "'Space Grotesk',sans-serif" }}>
          <span className="text-white">ANI</span><span className="text-amber-400">VAULT</span>
        </h1>
      </div>

      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button onClick={onSyncClick} disabled={syncing}
          title={syncing ? `Sync… ${syncProgress.current}/${syncProgress.total}` : "Actualiser les données"}
          aria-label="Actualiser les données"
          className="h-9 w-9 flex items-center justify-center rounded-xl bg-violet-900/40 border border-white/10 hover:bg-violet-800/50 disabled:opacity-70 active:scale-95 transition-all motion-reduce:transition-none">
          <RefreshCw size={14} className={`text-violet-300 ${syncing ? "animate-spin motion-reduce:animate-none" : ""}`} />
        </button>
        <NotificationPanel />
        <BurgerMenu />
      </div>
    </header>
  );
}
