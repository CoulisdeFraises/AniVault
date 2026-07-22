export function Modal({ onClose, maxWidth = "max-w-lg", zIndex = "z-50", children }) {
  return (
    <div className={`fixed inset-0 bg-black/70 flex items-center justify-center p-4 ${zIndex}`} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className={`bg-violet-900 border border-white/10 rounded-2xl w-full ${maxWidth} max-h-[90vh] overflow-y-auto`}>
        {children}
      </div>
    </div>
  );
}

export function ConfirmDialog({ icon, tone = "rose", title, description, confirmLabel = "Confirmer", cancelLabel = "Annuler", onConfirm, onCancel }) {
  const toneClasses = tone === "amber"
    ? { bg: "bg-amber-400/20", btn: "bg-amber-400 text-violet-950 hover:bg-amber-300" }
    : { bg: "bg-rose-500/20", btn: "bg-rose-500 text-white hover:bg-rose-400" };
  return (
    <Modal onClose={onCancel} maxWidth="max-w-xs" zIndex="z-[70]">
      <div className="p-5">
        <div className="flex items-start gap-3 mb-4">
          <div className={`w-8 h-8 rounded-full ${toneClasses.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
            {icon}
          </div>
          <div>
            <h3 className="font-semibold text-violet-50 mb-1" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              {title}
            </h3>
            <p className="text-sm text-violet-300">{description}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-white/10 text-violet-200 hover:bg-white/20">
            {cancelLabel}
          </button>
          <button onClick={onConfirm} className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium ${toneClasses.btn}`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}