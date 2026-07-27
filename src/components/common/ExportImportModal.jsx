import { useState, useRef } from "react";
import { Download, Upload, X, AlertTriangle, Check, Clock, Shield, Database } from "lucide-react";
import { useLibrary } from "../../context/LibraryContext";

export function ExportImportModal({ onClose }) {
  const { entries, setEntries } = useLibrary();
  const fileRef = useRef(null);
  const [confirmImport, setConfirmImport] = useState(null);
  const [importMsg,     setImportMsg]     = useState(null);

  // Récupère les sauvegardes auto depuis localStorage (5 slots rotatifs)
  const backups = (() => {
    const list = [];
    for (let i = 0; i < 5; i++) {
      try {
        const raw = localStorage.getItem(`anivault_backup_${i}`);
        if (!raw) continue;
        const { entries: bEntries, savedAt } = JSON.parse(raw);
        if (Array.isArray(bEntries)) list.push({ key: `anivault_backup_${i}`, entries: bEntries, savedAt });
      } catch {}
    }
    return list.sort((a, b) => b.savedAt - a.savedAt);
  })();

  function handleExport() {
    const blob = new Blob(
      [JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), app: "AniVault", entries }, null, 2)],
      { type: "application/json" }
    );
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), {
      href: url,
      download: `anivault-export-${new Date().toISOString().slice(0, 10)}.json`,
    });
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        const imported = data.entries || (Array.isArray(data) ? data : null);
        if (!Array.isArray(imported)) throw new Error();
        setConfirmImport(imported);
        setImportMsg(null);
      } catch {
        setImportMsg({ type: "error", text: "Fichier invalide ou corrompu." });
      }
    };
    reader.readAsText(file);
  }

  function confirmDoImport(data) {
    setEntries(data);
    setConfirmImport(null);
    setImportMsg({ type: "success", text: `${data.length} titre(s) importé(s) !` });
    setTimeout(onClose, 1500);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md bg-violet-900 border border-white/10 rounded-2xl shadow-2xl animate-fadeInUp max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <Database size={16} className="text-violet-400" />
            <div>
              <h2 className="font-semibold text-violet-50" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Données & Sauvegarde</h2>
              <p className="text-[11px] text-violet-400">{entries.length} titre(s) en bibliothèque</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-violet-400"><X size={15} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* Export */}
          <div className="rounded-xl bg-teal-500/5 border border-teal-500/20 p-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-teal-500/15 flex items-center justify-center flex-shrink-0">
                <Download size={16} className="text-teal-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-violet-50">Exporter la bibliothèque</p>
                <p className="text-[11px] text-violet-400 mt-0.5">Télécharge un fichier JSON complet — idéal pour changer d'appareil ou faire une sauvegarde manuelle.</p>
                <button onClick={handleExport}
                  className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-500/20 text-teal-300 text-xs font-medium hover:bg-teal-500/30 active:scale-95 transition-all">
                  <Download size={12} /> Télécharger .json
                </button>
              </div>
            </div>
          </div>

          {/* Import */}
          <div className="rounded-xl bg-amber-500/5 border border-amber-500/20 p-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center flex-shrink-0">
                <Upload size={16} className="text-amber-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-violet-50">Importer un fichier</p>
                <p className="text-[11px] text-violet-400 mt-0.5">
                  Restaure un export JSON AniVault. La bibliothèque actuelle sera <span className="text-rose-400 font-medium">remplacée</span>.
                </p>
                <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleFileChange} />
                <button onClick={() => fileRef.current?.click()}
                  className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 text-xs font-medium hover:bg-amber-500/30 active:scale-95 transition-all">
                  <Upload size={12} /> Choisir un fichier…
                </button>
              </div>
            </div>
          </div>

          {/* Confirm dialog */}
          {confirmImport && (
            <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 p-4 animate-fadeIn">
              <div className="flex items-start gap-2 mb-3">
                <AlertTriangle size={14} className="text-rose-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-rose-200">
                  Importer <strong>{confirmImport.length}</strong> titre(s) et remplacer ta bibliothèque actuelle (<strong>{entries.length}</strong> titre(s)) ?
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setConfirmImport(null)}
                  className="flex-1 px-3 py-1.5 rounded-lg bg-white/10 text-violet-200 text-xs hover:bg-white/20 active:scale-95">Annuler</button>
                <button onClick={() => confirmDoImport(confirmImport)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/30 text-rose-200 text-xs font-semibold hover:bg-rose-500/40 active:scale-95">
                  <Check size={11} /> Confirmer
                </button>
              </div>
            </div>
          )}

          {/* Message résultat */}
          {importMsg && (
            <div className={`rounded-xl px-3 py-2.5 text-xs font-mono flex items-center gap-2 animate-fadeIn ${
              importMsg.type === "success" ? "bg-teal-500/15 border border-teal-500/30 text-teal-300" : "bg-rose-500/15 border border-rose-500/30 text-rose-300"
            }`}>
              {importMsg.type === "success" ? <Check size={12} /> : <AlertTriangle size={12} />}
              {importMsg.text}
            </div>
          )}

          {/* Sauvegardes auto */}
          {backups.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Shield size={12} className="text-violet-500" />
                <p className="font-mono text-[10px] uppercase tracking-widest text-violet-500">Sauvegardes automatiques</p>
              </div>
              <div className="space-y-2">
                {backups.map((b) => (
                  <div key={b.key} className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/5">
                    <div className="flex items-center gap-2 min-w-0">
                      <Clock size={11} className="text-violet-500 flex-shrink-0" />
                      <div>
                        <p className="font-mono text-[10px] text-violet-300">
                          {new Date(b.savedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                          {" · "}
                          {new Date(b.savedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                        <p className="font-mono text-[10px] text-violet-500">{b.entries.length} titre(s)</p>
                      </div>
                    </div>
                    <button onClick={() => setConfirmImport(b.entries)}
                      className="flex-shrink-0 px-2.5 py-1 rounded-lg bg-violet-700/40 text-violet-300 text-[10px] font-mono hover:bg-violet-700/60 active:scale-95 transition-all">
                      Restaurer
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}