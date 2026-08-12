import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import "./index.css";

// ── Auto-reload en cas de chunk JS obsolète ────────────────────────────────
// Après un déploiement, les fichiers JS hashés d'une ancienne session
// (ex: Profile-CBpBJhjp.js) n'existent plus sur le serveur. Le lazy-loading
// d'une page (React.lazy / import() dynamique) échoue alors avec
// "Failed to fetch dynamically imported module". On détecte ce cas précis
// et on recharge la page une seule fois pour récupérer la version à jour,
// plutôt que de laisser l'utilisateur bloqué sur une app plantée.
const RELOAD_FLAG = "anivault:reloaded-after-chunk-error";

function reloadOnce() {
  if (sessionStorage.getItem(RELOAD_FLAG)) return; // évite une boucle infinie
  sessionStorage.setItem(RELOAD_FLAG, "1");
  window.location.reload();
}

window.addEventListener("vite:preloadError", reloadOnce);

window.addEventListener("unhandledrejection", (e) => {
  const msg = String(e?.reason?.message || e?.reason || "");
  if (/failed to fetch dynamically imported module|error loading dynamically imported module/i.test(msg)) {
    reloadOnce();
  }
});

// Un reload réussi (nouvelle page chargée normalement) réarme le garde-fou
// pour un futur déploiement.
window.addEventListener("load", () => {
  setTimeout(() => sessionStorage.removeItem(RELOAD_FLAG), 5000);
});

// ── Enregistrement du Service Worker ──────────────────────────────────────────
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .catch((err) => console.warn("[SW] Échec d'enregistrement :", err));
  });
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);