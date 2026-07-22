import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Trash2, Download, Upload, Info, Film, Tv, RotateCcw } from "lucide-react";
import { useAuth }    from "../context/AuthContext";
import { useLibrary } from "../context/LibraryContext";

const STORAGE_KEY = "playlog-entries";

// ─── Bloc de section réutilisable ────────────────────────────────────────────
const Section = ({ title, children }) => (
  <div className="rounded-2xl bg-violet-900/30 border border-white/5 overflow-hidden">
    <div className="px-5 py-3 border-b border-white/5">
      <p className="font-mono text-[10px] uppercase tracking-widest text-violet-400">{title}</p>
    </div>
    <div className="divide-y divide-white/5">{children}</div>
  </div>
);

// ─── Ligne de setting avec label + contenu droit ─────────────────────────────
const Row = ({ label, sublabel, children, onClick, danger = false }) => (
  <div
    onClick={onClick}
    className={`flex items-center justify-between gap-4 px-5 py-4 ${onClick ? "cursor-pointer hover:bg-white/5 transition-colors motion-reduce:transition-none" : ""}`}
  >
    <div className="min-w-0">
      <p className={`text-sm font-medium ${danger ? "text-rose-300" : "text-violet-100"}`}>{label}</p>
      {sublabel && <p className="text-[11px] text-violet-400 mt-0.5">{sublabel}</p>}
    </div>
    <div className="flex items-center gap-2 flex-shrink-0">
      {children}
      {onClick && <ChevronRight size={14} className="text-violet-500" />}
    </div>
  </div>
);

// ─── Toggle switch ────────────────────────────────────────────────────────────
const Toggle = ({ checked, onChange }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={() => onChange(!checked)}
    className={`relative w-9 h-5 rounded-full transition-colors motion-reduce:transition-none focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${checked ? "bg-amber-400" : "bg-white/20"}`}
  >
    <span
      className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform motion-reduce:transition-none ${checked ? "translate-x-4" : "translate-x-0"}`}
    />
  </button>
);

// ─── Page principale ─────────────────────────────────────────────────────────
export function Settings() {
  const navigate     = useNavigate();
  const { profile, logout } = useAuth();
  // Si LibraryContext expose les entries, sinon on lit directement localStorage
  const libraryCtx   = useLibrary?.() ?? {};
  const entries      = libraryCtx.entries ?? (() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; }
  })();

  // ── Préférences locales ──
  const [prefs, setPrefs] = useState({
    defaultFilter: localStorage.getItem("pref_defaultFilter") || "all",
    showProgress:  localStorage.getItem("pref_showProgress") !== "false",
    autoStatus:    localStorage.getItem("pref_autoStatus")   !== "false",
  });

  // ── États de confirmation ──
  const [confirmClear, setConfirmClear] = useState(false);
  const [exportDone,   setExportDone]   = useState(false);
  const [importError,  setImportError]  = useState("");

  function setPref(key, value) {
    setPrefs((p) => ({ ...p, [key]: value }));
    localStorage.setItem(`pref_${key}`, String(value));
  }

  // ── Stats rapides ──
  const animeCount  = entries.filter((e) => e.type === "anime").length;
  const serieCount  = entries.filter((e) => e.type === "serie").length;
  const totalEps    = entries.reduce(
    (sum, e) => sum + e.seasons.reduce((s2, s) => s2 + (s.watchedEpisodes || 0), 0), 0
  );

  // ── Export JSON ──
  function handleExport() {
    try {
      const blob = new Blob([JSON.stringify(entries, null, 2)], { type: "application/json" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `anivault-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setExportDone(true);
      setTimeout(() => setExportDone(false), 2500);
    } catch { /* silencieux */ }
  }

  // ── Import JSON ──
  function handleImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result);
        if (!Array.isArray(parsed)) throw new Error();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
        // Si LibraryContext a un setter, l'utiliser
        libraryCtx.setEntries?.(parsed);
        setImportError("");
        navigate("/"); // retour à l'accueil après import
      } catch {
        setImportError("Fichier invalide. Vérifie qu'il s'agit d'un export ANIVAULT.");
      }
    };
    reader.readAsText(file);
  }

  // ── Vider la bibliothèque ──
  function handleClear() {
    localStorage.removeItem(STORAGE_KEY);
    libraryCtx.setEntries?.([]);
    setConfirmClear(false);
    navigate("/");
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 space-y-6">

      {/* ── Titre ── */}
      <div className="mb-2">
        <p className="font-mono text-[11px] tracking-[0.3em] text-violet-400 uppercase mb-1">Configuration</p>
        <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          Paramètres
        </h1>
      </div>

      {/* ── Statistiques ── */}
      <Section title="Ma bibliothèque">
        <div className="grid grid-cols-3 divide-x divide-white/5">
          <div className="px-5 py-4 text-center">
            <p className="font-mono text-xl font-medium text-violet-50">{entries.length}</p>
            <p className="text-[10px] text-violet-400 uppercase tracking-wide mt-0.5">Titres</p>
          </div>
          <div className="px-5 py-4 text-center">
            <p className="font-mono text-xl font-medium text-violet-50 flex items-center justify-center gap-1">
              <Film size={14} className="text-violet-400" />{animeCount}
              <span className="text-violet-500 mx-1">/</span>
              <Tv size={14} className="text-violet-400" />{serieCount}
            </p>
            <p className="text-[10px] text-violet-400 uppercase tracking-wide mt-0.5">Anime / Série</p>
          </div>
          <div className="px-5 py-4 text-center">
            <p className="font-mono text-xl font-medium text-violet-50">{totalEps.toLocaleString("fr-FR")}</p>
            <p className="text-[10px] text-violet-400 uppercase tracking-wide mt-0.5">Éps vus</p>
          </div>
        </div>
      </Section>

      {/* ── Affichage ── */}
      <Section title="Affichage">
        <Row
          label="Barre de progression"
          sublabel="Afficher le scrubber d'épisodes sur les cartes"
        >
          <Toggle
            checked={prefs.showProgress}
            onChange={(v) => setPref("showProgress", v)}
          />
        </Row>
        <Row
          label="Changement de statut automatique"
          sublabel="Passe à « En cours » / « Terminé » selon les épisodes cochés"
        >
          <Toggle
            checked={prefs.autoStatus}
            onChange={(v) => setPref("autoStatus", v)}
          />
        </Row>
        <Row label="Filtre par défaut" sublabel="Vue affichée à l'ouverture de l'app">
          <select
            value={prefs.defaultFilter}
            onChange={(e) => setPref("defaultFilter", e.target.value)}
            onClick={(e) => e.stopPropagation()}
            className="text-sm bg-violet-950/60 border border-white/10 text-violet-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-amber-400"
          >
            <option value="all">Tous</option>
            <option value="en-cours">En cours</option>
            <option value="a-voir">À voir</option>
            <option value="termine">Terminé</option>
            <option value="abandonne">Abandonné</option>
          </select>
        </Row>
      </Section>

      {/* ── Données ── */}
      <Section title="Données">
        <Row
          label="Exporter la bibliothèque"
          sublabel="Télécharge un fichier JSON de sauvegarde"
          onClick={handleExport}
        >
          {exportDone
            ? <span className="text-[11px] text-teal-300 font-mono">Téléchargé ✓</span>
            : <Download size={15} className="text-violet-400" />
          }
        </Row>
        <label className="flex items-center justify-between gap-4 px-5 py-4 cursor-pointer hover:bg-white/5 transition-colors motion-reduce:transition-none">
          <div>
            <p className="text-sm font-medium text-violet-100">Importer une sauvegarde</p>
            <p className="text-[11px] text-violet-400 mt-0.5">Remplace la bibliothèque actuelle par un fichier JSON</p>
            {importError && <p className="text-[11px] text-rose-300 mt-1">{importError}</p>}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Upload size={15} className="text-violet-400" />
            <ChevronRight size={14} className="text-violet-500" />
          </div>
          <input type="file" accept=".json" className="hidden" onChange={handleImport} />
        </label>
        <Row
          label="Réinitialiser les préférences"
          sublabel="Remet tous les paramètres d'affichage à leur valeur par défaut"
          onClick={() => {
            ["pref_defaultFilter", "pref_showProgress", "pref_autoStatus"].forEach((k) => localStorage.removeItem(k));
            setPrefs({ defaultFilter: "all", showProgress: true, autoStatus: true });
          }}
        >
          <RotateCcw size={15} className="text-violet-400" />
        </Row>
      </Section>

      {/* ── Zone danger ── */}
      <Section title="Zone de danger">
        {!confirmClear ? (
          <Row
            label="Vider la bibliothèque"
            sublabel={`Supprime définitivement les ${entries.length} titre${entries.length > 1 ? "s" : ""} et toute la progression`}
            onClick={() => setConfirmClear(true)}
            danger
          >
            <Trash2 size={15} className="text-rose-400" />
          </Row>
        ) : (
          <div className="px-5 py-4 space-y-3">
            <p className="text-sm text-violet-200">
              Es-tu sûr ? Cette action est <span className="text-rose-300 font-semibold">irréversible</span>.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmClear(false)}
                className="flex-1 px-4 py-2 rounded-xl text-sm font-medium bg-white/10 text-violet-200 hover:bg-white/20 transition-colors motion-reduce:transition-none"
              >
                Annuler
              </button>
              <button
                onClick={handleClear}
                className="flex-1 px-4 py-2 rounded-xl text-sm font-medium bg-rose-500 text-white hover:bg-rose-400 transition-colors motion-reduce:transition-none"
              >
                Tout supprimer
              </button>
            </div>
          </div>
        )}
      </Section>

      {/* ── À propos ── */}
      <Section title="À propos">
        <Row label="ANIVAULT" sublabel="Journal de visionnage anime & séries">
          <Info size={15} className="text-violet-400" />
        </Row>
        <Row label="Sources de données" sublabel="AniList · TVmaze · Jikan (MyAnimeList) · TMDB" />
        <Row label="Stockage" sublabel="100 % local — aucune donnée envoyée sur un serveur" />
      </Section>

      {/* ── Déconnexion ── */}
      {profile && (
        <button
          onClick={logout}
          className="w-full py-3 rounded-2xl text-sm font-semibold text-rose-300 border border-rose-400/30 hover:bg-rose-500/10 transition-colors motion-reduce:transition-none"
        >
          Se déconnecter
        </button>
      )}
    </div>
  );
}