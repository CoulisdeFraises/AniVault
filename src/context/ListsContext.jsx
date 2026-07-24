import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Plus, Trash2, Pencil, X, Check, ListPlus, Eye, EyeOff } from "lucide-react";
import { useLists, HIDDEN_LIST_ID } from "../context/ListsContext";
import { BurgerMenu } from "../components/common/BurgerMenu";

function EntryCard({ item, onRemove, blurred = false, onClick }) {
  return (
    <div
      className={`relative group rounded-xl overflow-hidden bg-violet-950 cursor-pointer transition-all duration-300 ${blurred ? "blur-sm hover:blur-none" : ""}`}
      onClick={onClick}
    >
      <div className="aspect-[2/3] overflow-hidden">
        {item.coverImage
          ? <img src={item.coverImage} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 motion-reduce:transition-none" />
          : <div className="w-full h-full bg-violet-900/50 flex items-center justify-center text-2xl">
              {item.type === "anime" ? "🎌" : "📺"}
            </div>
        }
      </div>
      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-1.5 pt-4">
        <p className="font-mono text-[9px] text-white leading-tight line-clamp-2" title={item.title}>{item.title}</p>
      </div>
      <button
        onClick={e => { e.stopPropagation(); onRemove(item.entryId); }}
        className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/60 text-white/60 hover:text-rose-300 hover:bg-black/80 opacity-0 group-hover:opacity-100 transition-all active:scale-90"
      >
        <X size={10} />
      </button>
    </div>
  );
}

function ListCard({ list, onDelete, onRename, onRemoveEntry }) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const [editing,  setEditing]  = useState(false);
  const [name,     setName]     = useState(list.name);

  function handleRename() {
    if (name.trim() && name.trim() !== list.name) onRename(list.id, name.trim());
    setEditing(false);
  }

  // ← Guard : entries peut être undefined si la donnée vient d'une source externe
  const entries  = list.entries || [];
  const previews = entries.slice(0, 4);

  return (
    <div className={`rounded-2xl border overflow-hidden transition-colors ${list.isFavorites ? "bg-pink-950/20 border-pink-500/20" : "bg-violet-900/20 border-white/5"}`}>
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="text-xl flex-shrink-0">{list.emoji}</span>
        {editing ? (
          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            onBlur={handleRename}
            onKeyDown={e => { if (e.key === "Enter") handleRename(); if (e.key === "Escape") { setName(list.name); setEditing(false); } }}
            className="flex-1 px-2 py-0.5 rounded-lg bg-violet-950/60 border border-white/10 text-sm text-violet-50 focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        ) : (
          <button onClick={() => setExpanded(v => !v)} className="flex-1 text-left min-w-0">
            <p className={`font-semibold text-sm truncate ${list.isFavorites ? "text-pink-200" : "text-violet-100"}`}
              style={{ fontFamily: "'Space Grotesk',sans-serif" }}>
              {list.name}
            </p>
            <p className="font-mono text-[10px] text-violet-500 mt-0.5">
              {entries.length} titre{entries.length !== 1 ? "s" : ""}
            </p>
          </button>
        )}

        {!expanded && !editing && previews.length > 0 && (
          <div className="flex -space-x-1.5 flex-shrink-0">
            {previews.map(e => (
              <div key={e.entryId} className="w-6 h-9 rounded overflow-hidden border border-violet-900 flex-shrink-0">
                {e.coverImage
                  ? <img src={e.coverImage} alt="" className="w-full h-full object-cover" />
                  : <div className="w-full h-full bg-violet-800" />
                }
              </div>
            ))}
            {entries.length > 4 && (
              <div className="w-6 h-9 rounded bg-violet-800/80 border border-violet-700 flex items-center justify-center flex-shrink-0">
                <span className="font-mono text-[8px] text-violet-300">+{entries.length - 4}</span>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-0.5 flex-shrink-0">
          {!list.isFavorites && !list.isHidden && (
            <>
              <button onClick={() => setEditing(true)} className="p-1.5 rounded-lg text-violet-500 hover:text-violet-200 hover:bg-white/10 transition-colors">
                <Pencil size={12} />
              </button>
              <button onClick={() => onDelete(list.id)} className="p-1.5 rounded-lg text-violet-500 hover:text-rose-300 hover:bg-rose-500/10 transition-colors">
                <Trash2 size={12} />
              </button>
            </>
          )}
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4">
          {entries.length === 0 ? (
            <p className="text-sm text-violet-600 italic text-center py-4">Cette liste est vide.</p>
          ) : (
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
              {entries.map(item => (
                <EntryCard
                  key={item.entryId}
                  item={item}
                  onRemove={id => onRemoveEntry(list.id, id)}
                  onClick={() => navigate(`/details/${item.entryId}`)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function HiddenListCard({ list, onRemoveEntry }) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const entries = list.entries || []; // ← Guard

  return (
    <div className="rounded-2xl border border-violet-600/30 bg-violet-950/40 overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="text-xl flex-shrink-0 select-none">🙈</span>
        <button onClick={() => setExpanded(v => !v)} className="flex-1 text-left min-w-0">
          <p className="font-semibold text-sm text-violet-300 truncate" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>
            {list.name}
          </p>
          <p className="font-mono text-[10px] text-violet-500 mt-0.5">
            {entries.length} titre{entries.length !== 1 ? "s" : ""} · liste spéciale
          </p>
        </button>

        {expanded && entries.length > 0 && (
          <button
            onClick={() => setRevealed(v => !v)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[10px] font-mono border transition-all active:scale-95 ${
              revealed
                ? "bg-pink-500/20 border-pink-500/40 text-pink-300"
                : "bg-white/5 border-white/10 text-violet-500 hover:bg-pink-500/10 hover:border-pink-500/30 hover:text-pink-400"
            }`}
          >
            {revealed ? <Eye size={11} /> : <EyeOff size={11} />}
            {revealed ? "Flou off" : "Révéler"}
          </button>
        )}
      </div>

      {expanded && (
        <div className="px-4 pb-4">
          {entries.length === 0 ? (
            <p className="text-sm text-violet-600 italic text-center py-4">Rien de caché ici… pour l'instant 👀</p>
          ) : (
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
              {entries.map(item => (
                <EntryCard
                  key={item.entryId}
                  item={item}
                  onRemove={id => onRemoveEntry(list.id, id)}
                  blurred={!revealed}
                  onClick={() => navigate(`/details/${item.entryId}`)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function Lists() {
  const navigate = useNavigate();
  const { lists, createList, deleteList, renameList, removeEntryFromList } = useLists();
  const [creating,  setCreating]  = useState(false);
  const [newName,   setNewName]   = useState("");
  const [confirmId, setConfirmId] = useState(null);

  function handleCreate() {
    if (!newName.trim()) return;
    createList(newName.trim());
    setNewName("");
    setCreating(false);
  }

  function handleDelete(id) {
    if (confirmId === id) { deleteList(id); setConfirmId(null); }
    else setConfirmId(id);
  }

  const favorites  = lists.find(l => l.isFavorites);
  const hiddenList = lists.find(l => l.id === HIDDEN_LIST_ID);
  const otherLists = lists.filter(l => !l.isFavorites && l.id !== HIDDEN_LIST_ID);

  return (
    <div className="min-h-screen bg-violet-950 text-violet-50" style={{ fontFamily: "'Inter',sans-serif" }}>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        <div className="flex items-start justify-between">
          <div>
            <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-violet-400 hover:text-violet-200 transition-colors mb-3">
              <ChevronLeft size={16} /> Retour
            </button>
            <p className="font-mono text-[11px] tracking-[0.3em] text-violet-400 uppercase mb-0.5">Organisation</p>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>
              <ListPlus size={26} className="text-violet-400" /> Mes Listes
            </h1>
          </div>
          <BurgerMenu />
        </div>

        {favorites && (
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-pink-400/70 mb-2">Liste spéciale</p>
            <ListCard list={favorites} onDelete={() => {}} onRename={renameList} onRemoveEntry={removeEntryFromList} />
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="font-mono text-[10px] uppercase tracking-widest text-violet-500">
              Mes listes · {otherLists.length}
            </p>
            <button onClick={() => setCreating(true)}
              className="flex items-center gap-1.5 text-[11px] font-mono px-3 py-1.5 rounded-lg bg-amber-400/15 border border-amber-400/25 text-amber-300 hover:bg-amber-400/25 active:scale-95 transition-all">
              <Plus size={12} /> Nouvelle liste
            </button>
          </div>

          {creating && (
            <div className="flex gap-2 mb-3 animate-fadeIn">
              <input
                autoFocus
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") setCreating(false); }}
                placeholder="Nom de la liste…"
                maxLength={40}
                className="flex-1 px-4 py-2 rounded-xl bg-violet-900/40 border border-white/10 text-sm text-violet-50 placeholder-violet-500 focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              <button onClick={handleCreate} className="px-4 py-2 rounded-xl bg-amber-400/20 text-amber-300 hover:bg-amber-400/30 font-medium text-sm active:scale-95">
                Créer
              </button>
              <button onClick={() => setCreating(false)} className="p-2 rounded-xl hover:bg-white/10 text-violet-400">
                <X size={14} />
              </button>
            </div>
          )}

          {otherLists.length === 0 && !creating ? (
            <div className="text-center py-12 rounded-2xl border border-dashed border-white/10">
              <p className="text-3xl mb-3">📋</p>
              <p className="text-violet-300 mb-1">Aucune liste pour l'instant</p>
              <p className="text-sm text-violet-500">Crée ta première liste pour organiser tes titres.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {otherLists.map(list => (
                <div key={list.id}>
                  {confirmId === list.id && (
                    <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 mb-1.5 animate-fadeIn">
                      <p className="flex-1 text-sm text-rose-200">Supprimer <span className="font-semibold">«&nbsp;{list.name}&nbsp;»</span> ?</p>
                      <button onClick={() => handleDelete(list.id)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 text-xs font-mono active:scale-95">
                        <Check size={11} /> Oui
                      </button>
                      <button onClick={() => setConfirmId(null)} className="p-1.5 rounded-lg hover:bg-white/10 text-violet-400">
                        <X size={13} />
                      </button>
                    </div>
                  )}
                  <ListCard list={list} onDelete={handleDelete} onRename={renameList} onRemoveEntry={removeEntryFromList} />
                </div>
              ))}
            </div>
          )}
        </div>

        {hiddenList && (
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-violet-600/70 mb-2">Zone secrète</p>
            <HiddenListCard list={hiddenList} onRemoveEntry={removeEntryFromList} />
          </div>
        )}

      </div>
    </div>
  );
}