import { useState, useEffect } from "react";
import { Languages, Loader2, Check, AlertTriangle } from "lucide-react";
import { Modal } from "../Modal/Modal";
import { useLibrary } from "../../context/LibraryContext";
import { fetchAniListTitles } from "../../api/anilist";

// Résout l'ID AniList de référence pour l'entrée : le premier de anilistIds,
// sinon celui de la première saison qui en porte un (cas des franchises
// importées sans franchise complète — voir importResult()).
function resolveAnilistId(entry) {
  if (entry.anilistIds?.length) return entry.anilistIds[0];
  const withId = (entry.seasons || []).find((s) => s.anilistId != null);
  return withId?.anilistId ?? null;
}

export function TitlePickerModal({ entry, onClose }) {
  const { saveEntry } = useLibrary();
  const anilistId = resolveAnilistId(entry);

  const [loading, setLoading] = useState(!!anilistId);
  const [error,   setError]   = useState("");
  const [options, setOptions] = useState([]);
  const [custom,  setCustom]  = useState(entry.title || "");
  const [saving,  setSaving]  = useState(false);

  useEffect(() => {
    if (!anilistId) return;
    let cancelled = false;
    (async () => {
      try {
        const titles = await fetchAniListTitles(anilistId);
        if (!cancelled) setOptions(titles);
      } catch (e) {
        if (!cancelled) setError(e.message || "Impossible de récupérer les titres.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [anilistId]);

  function handleConfirm() {
    const next = custom.trim();
    if (!next || next === entry.title) { onClose(); return; }
    setSaving(true);
    saveEntry({ ...entry, title: next }, entry.id, true);
    onClose();
  }

  return (
    <Modal onClose={onClose} maxWidth="max-w-sm" zIndex="z-[70]">
      <div className="p-4">
        <div className="flex items-center gap-2.5 mb-3">
          <span className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center flex-shrink-0">
            <Languages size={15} className="text-violet-300" />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-violet-50 truncate" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>
              Changer le titre
            </h3>
            <p className="font-mono text-[10px] text-violet-500 truncate">{entry.title}</p>
          </div>
        </div>

        {!anilistId && (
          <p className="text-[11px] text-violet-500 bg-white/5 border border-white/5 rounded-lg px-3 py-2 mb-3">
            Ce titre n'est pas lié à AniList — pas de suggestions automatiques, mais tu peux le renommer manuellement ci-dessous.
          </p>
        )}

        {loading && (
          <div className="flex items-center gap-2 text-violet-400 text-sm py-3">
            <Loader2 size={14} className="animate-spin" /> Recherche des noms alternatifs…
          </div>
        )}

        {error && (
          <p className="flex items-center gap-1.5 text-[11px] text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2 mb-3">
            <AlertTriangle size={12} className="flex-shrink-0" /> {error}
          </p>
        )}

        {!loading && !error && anilistId && options.length === 0 && (
          <p className="text-[11px] text-violet-500 mb-3">Aucun nom alternatif trouvé sur AniList.</p>
        )}

        {!loading && options.length > 0 && (
          <div className="space-y-1.5 mb-3 max-h-52 overflow-y-auto">
            {options.map((opt, i) => (
              <button
                key={`${opt.label}-${i}`}
                onClick={() => setCustom(opt.value)}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-left text-sm transition-all active:scale-[0.98] motion-reduce:transition-none ${
                  custom === opt.value
                    ? "bg-teal-500/15 border border-teal-500/30 text-teal-200"
                    : "bg-white/[0.04] border border-white/5 hover:bg-white/10 text-violet-200"
                }`}
              >
                <span className="min-w-0 truncate">{opt.value}</span>
                <span className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="font-mono text-[8px] uppercase tracking-wide text-violet-500">{opt.label}</span>
                  {custom === opt.value && <Check size={12} className="text-teal-400" />}
                </span>
              </button>
            ))}
          </div>
        )}

        <div>
          <label className="font-mono text-[10px] uppercase tracking-widest text-violet-400 block mb-1.5">Titre personnalisé</label>
          <input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleConfirm(); }}
            placeholder="Nom à afficher…"
            className="w-full px-3.5 py-2.5 rounded-xl bg-violet-950/60 border border-white/10 text-violet-50 placeholder-violet-500 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>

        <div className="flex gap-2 pt-4">
          <button onClick={onClose}
            className="flex-1 px-4 py-2 rounded-xl text-sm font-medium bg-white/10 text-violet-200 hover:bg-white/20 transition-colors motion-reduce:transition-none">
            Annuler
          </button>
          <button onClick={handleConfirm} disabled={saving || !custom.trim()}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-amber-400 text-violet-950 hover:bg-amber-300 disabled:opacity-50 transition-colors motion-reduce:transition-none">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Valider
          </button>
        </div>
      </div>
    </Modal>
  );
}
