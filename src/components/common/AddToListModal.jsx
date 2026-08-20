import { useState } from "react";
import { X, Plus, Check } from "lucide-react";
import { useLists } from "../../context/ListsContext";
import { Modal } from "../Modal/Modal";
import { ListIcon } from "./ListIcon";

export function AddToListModal({ entry, onClose }) {
  const { lists, addEntryToList, removeEntryFromList, isInList, createList } = useLists();
  const [creating, setCreating] = useState(false);
  const [newName,  setNewName]  = useState("");

  function handleToggle(listId) {
    if (isInList(listId, entry.id)) removeEntryFromList(listId, entry.id);
    else addEntryToList(listId, entry);
  }

  function handleCreate() {
    if (!newName.trim()) return;
    const id = createList(newName.trim());
    addEntryToList(id, entry);
    setNewName("");
    setCreating(false);
  }

  return (
    <Modal onClose={onClose} maxWidth="max-w-xs" zIndex="z-[70]">
      <div>

        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-violet-50 truncate" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>
              Ajouter à une liste
            </h3>
            <p className="font-mono text-[10px] text-violet-500 truncate">{entry.title}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-violet-400 hover:text-violet-200 flex-shrink-0 ml-2">
            <X size={14} />
          </button>
        </div>

        <div className="p-3 space-y-1.5 max-h-64 overflow-y-auto">
          {lists.map(list => {
            const inList = isInList(list.id, entry.id);
            return (
              <button key={list.id} onClick={() => handleToggle(list.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all active:scale-[0.98] ${
                  inList
                    ? "bg-teal-500/15 border border-teal-500/30 text-teal-300"
                    : "bg-white/[0.04] border border-white/5 hover:bg-white/10 text-violet-200"
                }`}>
                <ListIcon list={list} size={16} className="flex-shrink-0" />
                <span className="flex-1 text-left font-medium truncate">{list.name}</span>
                {inList && <Check size={13} className="flex-shrink-0 text-teal-400" />}
              </button>
            );
          })}
        </div>

        <div className="px-3 pb-3 pt-2 border-t border-white/5">
          {creating ? (
            <div className="flex gap-2">
              <input
                autoFocus
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") setCreating(false); }}
                placeholder="Nom de la liste…"
                maxLength={40}
                className="flex-1 px-3 py-1.5 rounded-lg bg-violet-950/60 border border-white/10 text-sm text-violet-50 placeholder-violet-500 focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              <button onClick={handleCreate}
                className="px-3 py-1.5 rounded-lg bg-amber-400/20 text-amber-300 hover:bg-amber-400/30 text-sm font-medium active:scale-95">
                OK
              </button>
            </div>
          ) : (
            <button onClick={() => setCreating(true)}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-dashed border-white/10 text-violet-400 hover:text-violet-200 hover:border-white/20 text-sm transition-colors">
              <Plus size={13} /> Nouvelle liste
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}