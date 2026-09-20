import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// ── Config build/perf ──────────────────────────────────────────────────────
// Avant : config par défaut → un seul gros chunk "vendor" contenant React,
// Supabase, motion, les icônes, etc. Résultat : le moindre patch de code
// applicatif invalide le cache de TOUT ce bundle chez l'utilisateur (obligé
// de re-télécharger des centaines de Ko de libs qui n'ont pas changé), et le
// premier écran doit parser un seul énorme fichier JS avant de pouvoir
// afficher quoi que ce soit.
//
// Ici on découpe manuellement par librairie stable : ces chunks ne changent
// (quasi) jamais entre deux déploiements et restent donc en cache navigateur
// indéfiniment, seul le petit chunk applicatif change à chaque mise à jour.
export default defineConfig({
  plugins: [react()],
  build: {
    target: "es2020",
    sourcemap: false,
    // Supprime console.log/debugger du bundle de prod : moins de code à
    // parser/exécuter, et évite le petit coût (sérialisation d'objets,
    // parfois de tableaux d'entrées entiers) de logs de debug oubliés.
    esbuild: { drop: ["console", "debugger"] },
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react":    ["react", "react-dom", "react-router-dom"],
          "vendor-motion":   ["motion"],
          "vendor-supabase": ["@supabase/supabase-js"],
          "vendor-icons":    ["lucide-react", "@mdi/js"],
        },
      },
    },
  },
});
