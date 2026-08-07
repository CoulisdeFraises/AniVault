import { useState, useEffect } from "react";
import { Download, X } from "lucide-react";

/**
 * InstallPrompt — bannière discrète d'invitation à installer l'app en PWA.
 * Intercepte l'événement natif `beforeinstallprompt` du navigateur.
 * Dismissée une fois = plus jamais affichée (stocké en localStorage).
 */
export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (localStorage.getItem("pwa_install_dismissed") === "true") return;

    function handler(e) {
      e.preventDefault();
      setDeferredPrompt(e);
      setVisible(true);
    }

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  // Masquer si déjà installé
  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) setVisible(false);
  }, []);

  function handleInstall() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(() => { setDeferredPrompt(null); setVisible(false); });
  }

  function handleDismiss() {
    localStorage.setItem("pwa_install_dismissed", "true");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-24 sm:bottom-4 inset-x-4 sm:inset-x-auto sm:right-4 sm:left-auto sm:w-80 z-50
      bg-violet-900 border border-white/10 rounded-2xl p-4 shadow-2xl shadow-violet-950/80
      animate-fadeInUp">
      <button onClick={handleDismiss} aria-label="Fermer"
        className="absolute top-3 right-3 p-1 rounded-lg text-violet-400 hover:bg-white/10
          hover:text-violet-200 transition-colors">
        <X size={14} />
      </button>
      <div className="flex items-center gap-3 pr-6">
        <div className="w-10 h-10 rounded-xl bg-amber-400/15 border border-amber-400/20
          flex items-center justify-center flex-shrink-0">
          <Download size={18} className="text-amber-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-violet-50"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Installer AniVault</p>
          <p className="text-[11px] text-violet-400 leading-snug">
            Accès rapide · Fonctionne hors-ligne
          </p>
        </div>
      </div>
      <button onClick={handleInstall}
        className="mt-3 w-full py-2.5 rounded-xl bg-amber-400 text-violet-950 font-semibold
          text-sm hover:bg-amber-300 active:scale-[0.98] transition-all">
        Installer l'application
      </button>
    </div>
  );
}
