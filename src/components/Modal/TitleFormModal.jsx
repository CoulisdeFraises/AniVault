import { useState } from "react";
import { X, Search, Check } from "lucide-react";
import { Modal, ConfirmDialog } from "./Modal";
import { SearchBar } from "../SearchBar/SearchBar";
import { Chip } from "../common/Chip";
import { RatingMeter } from "../common/Rating";
import { STATUS, STATUS_ORDER, seasonTotals } from "../../utils/status";
import { GENRE_SUGGESTIONS } from "../../utils/genres";
import { emptyForm } from "../../utils/entry";
import { useLibrary } from "../../context/LibraryContext";
import { importResult } from "../../api";

export function TitleFormModal({ editingEntry, onClose }) {
  const { findDuplicate, saveEntry } = useLibrary();
  const editingId = editingEntry?.id ?? null;

  const [form, setForm] = useState(() =>
    editingEntry
      ? { ...editingEntry, seasons: editingEntry.seasons.map((s) => ({ ...s })) }
      : emptyForm
  );
  const [genreInput,       setGenreInput]       = useState("");
  const [formError,        setFormError]        = useState("");
  const [searchOpen,       setSearchOpen]       = useState(!editingEntry);
  const [searchQuery,      setSearchQuery]      = useState("");
  const [importing,        setImporting]        = useState(false);
  const [importedFrom,     setImportedFrom]     = useState(null);
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  // false par défaut → Naruto et Shippuden séparés ; cocher pour AoT, Demon Slayer…
  const [importAllSeasons, setImportAllSeasons] = useState(false);

  function handleTypeChange(type) {
    setForm((f) => ({ ...f, type, category: "tv" }));
    setSearchQuery("");
    setImportedFrom(null);
  }

  async function handleSelectResult(result) {
    setImporting(true);
    try {
      const imported = await importResult(result, importAllSeasons);
      setForm((f) => ({ ...f, ...imported }));
      setImportedFrom(result.source === "anilist" ? "AniList" : "TVmaze");
    } finally {
      setImporting(false);
      setSearchQuery("");
      setSearchOpen(false);
    }
  }

  function toggleGenre(g) {
    setForm((f) => ({
      ...f,
      genres: f.genres.includes(g) ? f.genres.filter((x) => x !== g) : [...f.genres, g],
    }));
  }

  function addCustomGenre() {
    const g = genreInput.trim();
    if (g && !form.genres.includes(g)) setForm((f) => ({ ...f, genres: [...f.genres, g] }));
    setGenreInput("");
  }

  function commit() { saveEntry(form, editingId); onClose(); }

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim()) { setFormError("Le titre est obligatoire."); return; }
    const duplicate = findDuplicate(form.title, editingId);
    if (duplicate) { setDuplicateWarning(duplicate); return; }
    commit();
  }

  const isTVAnime = form.type === "anime" && (form.category ?? "tv") === "tv";

  return (
    <>
      <Modal onClose={onClose}>
        <form onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit} className="p-6">

          {/* ── En-tête ── */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              {editingId ? "Modifier le titre" : "Nouveau titre"}
            </h2>
            <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-white/10" aria-label="Fermer">
              <X size={18} />
            </button>
          </div>

          {/* ── Type : Anime / Série ── */}
          <div className="flex gap-2 mb-2">
            <Chip active={form.type === "anime"} onClick={() => handleTypeChange("anime")} colorClass="bg-white/20 border-white/30">Anime</Chip>
            <Chip active={form.type === "serie"} onClick={() => handleTypeChange("serie")} colorClass="bg-white/20 border-white/30">Série</Chip>
            {!editingId && (
              <button type="button" onClick={() => setSearchOpen((v) => !v)} className="ml-auto flex items-center gap-1 text-xs text-violet-300 hover:text-violet-100">
                <Search size={13} /> {searchOpen ? "Ajout manuel" : "Rechercher"}
              </button>
            )}
          </div>

          {/* ── Toggle "importer toutes les saisons" (TV, ajout uniquement) ── */}
          {isTVAnime && !editingId && (
            <label className="flex items-start gap-2 text-xs text-violet-300 cursor-pointer mb-2 select-none">
              <input
                type="checkbox"
                checked={importAllSeasons}
                onChange={(e) => setImportAllSeasons(e.target.checked)}
                className="mt-0.5 rounded accent-amber-400 flex-shrink-0"
              />
              <span>
                Importer toutes les saisons de la franchise automatiquement
                <span className="block text-violet-500 mt-0.5">
                  Cocher pour AoT, Demon Slayer… Laisser décoché pour Naruto, Shippuden, Boruto…
                </span>
              </span>
            </label>
          )}

          {/* ── Barre de recherche ── */}
          {!editingId && searchOpen && (
            <SearchBar
              type={form.type}
              query={searchQuery}
              onQueryChange={setSearchQuery}
              onSelect={handleSelectResult}
            />
          )}

          {/* ── Feedback import ── */}
          {importedFrom && (
            <p className="text-[11px] text-teal-300 mb-2 flex items-center gap-1">
              <Check size={12} /> Importé depuis {importedFrom} — {form.seasons.length} saison
              {form.seasons.length > 1 ? "s" : ""} détectée{form.seasons.length > 1 ? "s" : ""}.
            </p>
          )}
          {importing && <p className="text-[11px] text-violet-400 mb-2">Import en cours…</p>}

          {/* ── Titre ── */}
          <label className="block text-xs uppercase tracking-wide text-violet-400 mb-1">Titre</label>
          <input
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="ex : Frieren, Severance…"
            className="w-full mb-1 px-3 py-2 rounded-lg bg-violet-950/60 border border-white/10 text-violet-50 placeholder-violet-500 focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
          {formError && <p className="text-rose-300 text-xs mb-2">{formError}</p>}

          {/* ── Statut ── */}
          <div className="mt-3">
            <label className="block text-xs uppercase tracking-wide text-violet-400 mb-1">Statut</label>
            <select
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg bg-violet-950/60 border border-white/10 text-violet-50 focus:outline-none focus:ring-2 focus:ring-amber-400"
            >
              {STATUS_ORDER.map((k) => <option key={k} value={k}>{STATUS[k].label}</option>)}
            </select>
          </div>

          {!importedFrom && !editingId && (
            <p className="text-[11px] text-violet-500 mt-2">
              Les saisons se gèrent depuis la fiche une fois le titre ajouté (bouton + Saison).
            </p>
          )}

          {/* ── Genres ── */}
          <div className="mt-3">
            <label className="block text-xs uppercase tracking-wide text-violet-400 mb-1">Genres</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {GENRE_SUGGESTIONS.map((g) => (
                <Chip key={g} active={form.genres.includes(g)} onClick={() => toggleGenre(g)} colorClass="bg-white/20 border-white/30">{g}</Chip>
              ))}
              {form.genres.filter((g) => !GENRE_SUGGESTIONS.includes(g)).map((g) => (
                <Chip key={g} active onClick={() => toggleGenre(g)} colorClass="bg-white/20 border-white/30">{g}</Chip>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={genreInput}
                onChange={(e) => setGenreInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomGenre(); } }}
                placeholder="Ajouter un genre personnalisé…"
                className="flex-1 px-3 py-1.5 rounded-lg bg-violet-950/60 border border-white/10 text-violet-50 placeholder-violet-500 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              <button type="button" onClick={addCustomGenre} className="px-3 rounded-lg bg-white/10 text-sm hover:bg-white/20">
                Ajouter
              </button>
            </div>
          </div>

          {/* ── Note + Avis : édition uniquement ── */}
          {editingId && (
            <>
              <div className="mt-3">
                <label className="block text-xs uppercase tracking-wide text-violet-400 mb-1">Note</label>
                <RatingMeter value={form.rating} onChange={(v) => setForm((f) => ({ ...f, rating: v }))} size="lg" />
              </div>
              <div className="mt-3">
                <label className="block text-xs uppercase tracking-wide text-violet-400 mb-1">Avis / notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={3}
                  placeholder="Ce que tu en as pensé…"
                  className="w-full px-3 py-2 rounded-lg bg-violet-950/60 border border-white/10 text-violet-50 placeholder-violet-500 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
            </>
          )}

          {/* ── Actions ── */}
          <div className="flex justify-end gap-2 mt-5">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-violet-300 hover:bg-white/10">
              Annuler
            </button>
            <button type="submit" className="px-4 py-2 rounded-lg text-sm font-semibold bg-amber-400 text-violet-950 hover:bg-amber-300">
              {editingId ? "Enregistrer" : "Ajouter"}
            </button>
          </div>
        </form>
      </Modal>

      {duplicateWarning && (
        <ConfirmDialog
          icon={<span className="text-amber-400 text-sm font-bold">!</span>}
          tone="amber"
          title="Titre déjà présent"
          description={
            <>
              <span className="text-violet-50 font-medium">« {duplicateWarning.title} »</span> est déjà dans ton suivi avec le statut{" "}
              <span className={`font-medium ${STATUS[duplicateWarning.status].text}`}>{STATUS[duplicateWarning.status].label}</span>.
              {duplicateWarning.seasons && (
                <span className="block mt-2 text-[11px] font-mono text-violet-400">
                  {duplicateWarning.seasons.length} saison{duplicateWarning.seasons.length > 1 ? "s" : ""} · {seasonTotals(duplicateWarning.seasons).watched} épisodes vus
                </span>
              )}
            </>
          }
          confirmLabel="Ajouter quand même"
          onConfirm={() => { setDuplicateWarning(null); commit(); }}
          onCancel={() => setDuplicateWarning(null)}
        />
      )}
    </>
  );
}